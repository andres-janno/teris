// src/components/FieldWorkEntryDialog.tsx — kande lisamine/muutmine: töötaja sisestab ainult kogused.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Info } from 'lucide-react';
import { DateInput } from './DateInput';
import { api } from '../services/api';
import type { FieldWork, Material, WorkEntry } from '../types/fieldWork';
import { MATERIAL_CATEGORY_LABEL } from '../types/fieldWork';

interface Option {
  id: string;
  name: string;
}

interface FieldWorkEntryDialogProps {
  work: FieldWork;
  entry: WorkEntry | null; // null = uus kanne
  fieldLabel: string; // "Nr 6 Kodu ümber · Suvioder · 27,52 ha"
  fieldAreaHa: number;
  workers: Option[];
  vehicles: Option[];
  implementsList: Option[];
  materials: Material[];
  onClose: () => void;
  onSaved: () => void;
}

const todayIso = () => new Date().toISOString().split('T')[0];
// Eesti sisend: koma või punkt
const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined, digits = 2) =>
  n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: digits, useGrouping: false });
const fmtHa = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 2 });

export const FieldWorkEntryDialog: React.FC<FieldWorkEntryDialogProps> = ({
  work,
  entry,
  fieldLabel,
  fieldAreaHa,
  workers,
  vehicles,
  implementsList,
  materials,
  onClose,
  onSaved
}) => {
  const isRepeating = work.repeatMode !== 'ONCE';
  const isHarvest = work.phase === 'HARVEST';
  const others = work.entries.filter((e) => e.id !== entry?.id);
  const doneBefore = others.reduce((s, e) => s + (e.areaHa ?? 0), 0);
  const nextOccurrence = Math.max(0, ...others.map((e) => e.occurrenceNo ?? 0)) + 1;

  const [date, setDate] = useState(entry?.date ?? todayIso());
  const [workerId, setWorkerId] = useState(entry?.workerId ?? (workers.length === 1 ? workers[0].id : ''));
  const [laborHours, setLaborHours] = useState(fmt(entry?.laborHours));
  const [vehicleId, setVehicleId] = useState(entry?.vehicleId ?? '');
  const [implementId, setImplementId] = useState(entry?.implementId ?? '');
  const [equipmentHours, setEquipmentHours] = useState(fmt(entry?.equipmentHours));
  const [fuelLiters, setFuelLiters] = useState(fmt(entry?.fuelLiters, 1));
  const [areaHa, setAreaHa] = useState(fmt(entry?.areaHa));
  const [occurrenceNo, setOccurrenceNo] = useState(String(entry?.occurrenceNo ?? (isRepeating ? nextOccurrence : '')));
  const [harvestTonnes, setHarvestTonnes] = useState(fmt(entry?.harvestTonnes, 3));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [finish, setFinish] = useState(false);
  const [rows, setRows] = useState<{ materialId: string; quantity: string }[]>(
    entry?.materials.map((m) => ({ materialId: m.materialId, quantity: fmt(m.quantity, 3) })) ?? []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const activeMaterials = useMemo(() => materials.filter((m) => m.isActive || rows.some((r) => r.materialId === m.id)), [materials, rows]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const areaNum = parseNum(areaHa) ?? 0;
  const totalAfter = doneBefore + areaNum;

  const removeRow = (i: number) => {
    const m = materialById.get(rows[i].materialId);
    if (m && !confirm(`Kas soovid kindlasti eemaldada rea "${m.name}"?`)) return;
    setRows(rows.filter((_, j) => j !== i));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!date) return setError('Kuupäev on kohustuslik');
    if (equipmentHours.trim() && !vehicleId && !implementId) return setError('Vali masin ja/või haakeriist, mille töötunnid sisestasid');
    setBusy(true);
    try {
      await api.saveWorkEntry(
        {
          fieldWorkId: work.id,
          date,
          workerId: workerId || null,
          laborHours: parseNum(laborHours),
          vehicleId: vehicleId || null,
          implementId: implementId || null,
          equipmentHours: parseNum(equipmentHours),
          fuelLiters: parseNum(fuelLiters),
          areaHa: parseNum(areaHa),
          occurrenceNo: isRepeating ? parseNum(occurrenceNo) : null,
          materials: rows
            .map((r) => ({ materialId: r.materialId, quantity: parseNum(r.quantity) ?? 0 }))
            .filter((r) => r.materialId && r.quantity > 0),
          harvestTonnes: isHarvest ? parseNum(harvestTonnes) : null,
          notes: notes.trim() || null,
          finish
        },
        entry?.id
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up work-entry-modal" onSubmit={save}>
        <div className="modal-header">
          <div>
            <h3>{entry ? 'Muuda kannet' : 'Lisa kanne'}: {work.workTypeName}</h3>
            <p className="modal-subtitle">{fieldLabel}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body work-entry-body">
          {(others.length > 0 || !isRepeating) && (
            <div className="work-entry-progress">
              <div className="work-entry-progress-head">
                <strong>Varasemad kanded: {others.length}</strong>
                {!isRepeating && fieldAreaHa > 0 && <span>{fmtHa(doneBefore)} / {fmtHa(fieldAreaHa)} ha tehtud</span>}
              </div>
              {!isRepeating && fieldAreaHa > 0 && (
                <div className="work-progress-bar"><div style={{ width: `${Math.min(100, (doneBefore / fieldAreaHa) * 100)}%` }} /></div>
              )}
            </div>
          )}

          {entry?.financeStatus === 'CONFIRMED' && (
            <div className="work-entry-warning">
              <Info size={14} />
              <span>Kande finants on kinnitatud. Koguste muutmisel tuleb finantsjuhil kanne uuesti kinnitada.</span>
            </div>
          )}

          <div className="work-entry-grid three">
            <div className="form-group">
              <label>Kuupäev *</label>
              <DateInput value={date} onChange={setDate} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="we-worker">Töötaja</label>
              <select id="we-worker" className="form-input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                <option value="">– valimata –</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="we-labor">Tööaeg, h</label>
              <input id="we-labor" className="form-input num" inputMode="decimal" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} />
            </div>
          </div>

          <section className="work-entry-section">
            <h4>Masin ja haakeriist</h4>
            <div className="work-entry-grid four">
              <div className="form-group">
                <label htmlFor="we-vehicle">Masin</label>
                <select id="we-vehicle" className="form-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  <option value="">– pole –</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="we-impl">Haakeriist</label>
                <select id="we-impl" className="form-input" value={implementId} onChange={(e) => setImplementId(e.target.value)}>
                  <option value="">– pole –</option>
                  {implementsList.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="we-eqh">Töötunnid</label>
                <input id="we-eqh" className="form-input num" inputMode="decimal" value={equipmentHours} onChange={(e) => setEquipmentHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="we-fuel">Kütus, l</label>
                <input id="we-fuel" className="form-input num" inputMode="decimal" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} />
              </div>
            </div>
            <p className="work-entry-hint"><Info size={13} /> Töötunnid kehtivad nii masinale kui haakeriistale. Haakeriista vahetusel lisa uus kanne.</p>
          </section>

          {(work.usesMaterials || rows.length > 0) && (
            <section className="work-entry-section">
              <h4>Kulumaterjalid</h4>
              {rows.map((r, i) => (
                <div key={i} className="work-entry-material-row">
                  <select
                    className="form-input"
                    aria-label="Materjal"
                    value={r.materialId}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, materialId: e.target.value } : x)))}
                  >
                    <option value="">– vali materjal –</option>
                    {activeMaterials.map((m) => (
                      <option key={m.id} value={m.id}>{MATERIAL_CATEGORY_LABEL[m.category]}: {m.name}</option>
                    ))}
                  </select>
                  <input
                    className="form-input num"
                    aria-label="Kogus"
                    inputMode="decimal"
                    placeholder="Kogus"
                    value={r.quantity}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                  />
                  <span className="work-entry-unit">{materialById.get(r.materialId)?.unit ?? ''}</span>
                  <button type="button" className="icon-btn-danger" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => removeRow(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {activeMaterials.length === 0 ? (
                <p className="work-entry-hint">Kulumaterjalide register on tühi. Lisa materjalid tööde registris.</p>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm work-entry-add" onClick={() => setRows([...rows, { materialId: '', quantity: '' }])}>
                  <Plus size={13} />
                  <span>Lisa materjal</span>
                </button>
              )}
            </section>
          )}

          <div className="work-entry-grid three">
            <div className="form-group">
              <label htmlFor="we-area">Tehtud pindala, ha</label>
              <input id="we-area" className="form-input num" inputMode="decimal" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </div>
            {isRepeating && (
              <div className="form-group">
                <label htmlFor="we-occ">Mitmes kord</label>
                <input id="we-occ" className="form-input num" inputMode="numeric" value={occurrenceNo} onChange={(e) => setOccurrenceNo(e.target.value)} />
              </div>
            )}
            {isHarvest && (
              <div className="form-group">
                <label htmlFor="we-harvest">Saak, t</label>
                <input id="we-harvest" className="form-input num" inputMode="decimal" value={harvestTonnes} onChange={(e) => setHarvestTonnes(e.target.value)} />
              </div>
            )}
            {!isRepeating && fieldAreaHa > 0 && (
              <p className="work-entry-hint align-end">Kokku pärast kannet {fmtHa(totalAfter)} / {fmtHa(fieldAreaHa)} ha</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="we-notes">Märkus</label>
            <textarea id="we-notes" rows={2} className="form-input" placeholder="nt mullaniiskus, katkestused, tähelepanekud" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {work.status !== 'DONE' && (
            <label className={`work-entry-finish ${finish ? 'on' : ''}`}>
              <input type="checkbox" checked={finish} onChange={(e) => setFinish(e.target.checked)} />
              <span>
                <strong>Töö on sellega lõpetatud</strong>
                <small>Märgi ainult siis, kui rohkem kandeid ei tule. Lõpetamise saab hiljem tagasi võtta.</small>
              </span>
            </label>
          )}

          <p className="work-entry-hint">
            <Info size={13} /> Sisesta ainult kogused. Finantskulu lisab finantsjuht selle kande juurde.
          </p>
          {error && <div className="alert-box error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {finish ? 'Salvesta ja lõpeta töö' : 'Salvesta kanne'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
