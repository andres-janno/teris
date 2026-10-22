// src/components/FieldWorkPlanDialog.tsx — töö (plaani) lisamine ja muutmine: tegevus, kuupäevad, pindala, viis, teostaja, read.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DateInput } from './DateInput';
import { api } from '../services/api';
import { PRIA_ACTIVITY, FERTILIZING_METHODS, PRIA_ACTIVITIES } from '../services/pria';
import type { FieldWork, FieldWorkPlanLine, Material, WorkType } from '../types/fieldWork';
import { PriaLinesEditor, HarvestEditor, planLineToRow, rowToPlanLine, type PriaRow, type HarvestRow } from './PriaLinesEditor';

interface FieldWorkPlanDialogProps {
  fieldSeasonId: number;
  fieldLabel: string;
  fieldAreaHa: number;
  work: FieldWork | null; // null = uus töö
  workTypes: WorkType[];
  materials: Material[];
  workers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 2, useGrouping: false }));

export const FieldWorkPlanDialog: React.FC<FieldWorkPlanDialogProps> = ({ fieldSeasonId, fieldLabel, fieldAreaHa, work, workTypes, materials, workers, onClose, onSaved }) => {
  // PRIA tegevused tööloogika järjekorras; muudetava töö tüüp jääb valikusse ka siis, kui see pole enam aktiivne
  const ordered = workTypes.filter((w) => (w.isActive && w.priaCode) || w.id === work?.workTypeId)
    .sort((a, b) => PRIA_ACTIVITIES.findIndex((p) => p.name === a.priaCode) - PRIA_ACTIVITIES.findIndex((p) => p.name === b.priaCode));
  const [workTypeId, setWorkTypeId] = useState(work?.workTypeId ?? '');
  const workType = workTypes.find((w) => w.id === workTypeId);
  const activity = workType?.priaCode ?? work?.priaCode ?? '';
  const [dateFrom, setDateFrom] = useState(work?.plannedDateFrom ?? '');
  const [dateTo, setDateTo] = useState(work?.plannedDateTo ?? '');
  const [plannedText, setPlannedText] = useState(work?.plannedText ?? '');
  const [areaHa, setAreaHa] = useState(fmt(work?.plannedAreaHa ?? fieldAreaHa));
  const [method, setMethod] = useState(work?.method ?? '');
  const [workerId, setWorkerId] = useState(work?.plannedWorkerId ?? '');
  const [notes, setNotes] = useState(work?.notes ?? '');
  const area = parseNum(areaHa) ?? fieldAreaHa;
  const [rows, setRows] = useState<PriaRow[]>(() => work?.lines.filter((l) => l.kind === 'MATERIAL').map((l) => planLineToRow(l, area)) ?? []);
  const harvestLine = work?.lines.find((l) => l.kind === 'HARVEST');
  const [harvest, setHarvest] = useState<HarvestRow>({ ratePerHa: fmt(harvestLine?.ratePerHa), total: '', priaKind: harvestLine?.priaKind ?? '', priaSpec: harvestLine?.priaSpec ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc sulgeb ainult selle dialoogi (capture-faasis, enne täisvaate Esc-käsitlejat)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const usesMaterials = workType?.usesMaterials ?? work?.usesMaterials ?? false;
  const isHarvest = activity === PRIA_ACTIVITY.HARVEST;
  // Plaanitud teostaja, keda pole töötajate loendis (nt PRIA impordist), jääb valikusse
  const workerOptions = work?.plannedWorkerId && !workers.some((w) => w.id === work.plannedWorkerId)
    ? [...workers, { id: work.plannedWorkerId, name: work.plannedWorkerName ?? work.plannedWorkerId }]
    : workers;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!workTypeId) return setError('Vali tegevus');
    if (dateTo && dateFrom && dateTo < dateFrom) return setError('Lõpp ei saa olla enne algust');
    const lines: FieldWorkPlanLine[] = [
      ...(usesMaterials ? rows.map(rowToPlanLine).filter((l): l is FieldWorkPlanLine => l !== null) : []),
      ...(isHarvest && (harvest.ratePerHa || harvest.priaKind || harvest.priaSpec)
        ? [{ kind: 'HARVEST' as const, materialId: null, label: 'Saak', unit: 't', ratePerHa: parseNum(harvest.ratePerHa), priaRegister: null, priaKind: harvest.priaKind || null, priaSpec: harvest.priaSpec || null, activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null }]
        : [])
    ];
    const plan = {
      plannedText: plannedText.trim() || null, plannedDateFrom: dateFrom || null, plannedDateTo: dateTo || null,
      plannedAreaHa: parseNum(areaHa), method: method || null, plannedWorkerId: workerId || null, notes: notes.trim() || null, lines
    };
    setBusy(true);
    try {
      if (work) await api.updateFieldWork(work.id, plan);
      else await api.addFieldWork({ fieldSeasonId, workTypeId, ...plan });
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
            <h3>{work ? `Muuda tööd: ${work.workTypeName}` : 'Lisa töö'}</h3>
            <p className="modal-subtitle">{fieldLabel}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body work-entry-body">
          <div className="work-entry-grid">
            <div className="form-group">
              <label htmlFor="wp-type">Tegevus *</label>
              <select id="wp-type" className="form-input" value={workTypeId} disabled={!!work} onChange={(e) => setWorkTypeId(e.target.value)}>
                <option value="">– vali –</option>
                {ordered.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label htmlFor="wp-from">Planeeritud algus</label><DateInput id="wp-from" value={dateFrom} onChange={setDateFrom} className="form-input" /></div>
            <div className="form-group"><label htmlFor="wp-to">Planeeritud lõpp</label><DateInput id="wp-to" value={dateTo} onChange={setDateTo} className="form-input" /></div>
            <div className="form-group">
              <label htmlFor="wp-text">Ligikaudne aeg</label>
              <input id="wp-text" className="form-input" placeholder="nt apr–mai" value={plannedText} onChange={(e) => setPlannedText(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="wp-area">Pindala, ha</label>
              <input id="wp-area" className="form-input num" inputMode="decimal" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </div>
            {activity === PRIA_ACTIVITY.FERTILIZING && (
              <div className="form-group">
                <label htmlFor="wp-method">Väetamisviis</label>
                <select id="wp-method" className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="">– vali –</option>
                  {FERTILIZING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  {method && !(FERTILIZING_METHODS as readonly string[]).includes(method) && <option value={method}>{method}</option>}
                </select>
              </div>
            )}
            {activity === PRIA_ACTIVITY.PLANT_PROTECTION && (
              <div className="form-group">
                <label htmlFor="wp-worker">Teostaja</label>
                <select id="wp-worker" className="form-input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                  <option value="">– valimata –</option>
                  {workerOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {usesMaterials && (
            <section className="work-entry-section">
              <h4>Planeeritud materjalid (norm ha kohta)</h4>
              <PriaLinesEditor activity={activity} rows={rows} onChange={setRows} materials={materials} areaHa={area} showTotals={false} />
            </section>
          )}
          {isHarvest && (
            <section className="work-entry-section">
              <h4>Planeeritud saak</h4>
              <HarvestEditor value={harvest} onChange={setHarvest} areaHa={area} showTotals={false} />
            </section>
          )}
          <div className="form-group">
            <label htmlFor="wp-notes">Märkused</label>
            <textarea id="wp-notes" rows={3} maxLength={1000} className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <div className="alert-box error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
        </div>
      </form>
    </div>,
    document.body
  );
};
