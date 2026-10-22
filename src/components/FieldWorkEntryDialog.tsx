// src/components/FieldWorkEntryDialog.tsx — kande lisamine/muutmine: töötaja sisestab ainult kogused.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, Radio, Clock } from 'lucide-react';
import { DateInput } from './DateInput';
import { api } from '../services/api';
import type { FieldWork, Material, WorkEntry, WorkEntryObservation, TelemetrySuggestion } from '../types/fieldWork';
import { PRIA_ACTIVITY, FERTILIZING_METHODS } from '../services/pria';
import { PriaLinesEditor, HarvestEditor, ObservationsEditor, planLineToRow, rowPria, recomputeTotals, recomputeHarvestTotal, type PriaRow, type HarvestRow } from './PriaLinesEditor';

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
  telemetryEnabled?: boolean; // false: telemeetria moodul pole litsentsis → soovitusi ei küsita
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

const AREA_PERCENTAGES = [10, 25, 33, 50, 66, 75, 90, 100] as const;

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 24; h++) {
  if (h === 24) {
    TIME_OPTIONS.push('24:00');
  } else {
    for (let m = 0; m < 60; m += 15) {
      TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
}

const timeToMinutes = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

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
  onSaved,
  telemetryEnabled = true
}) => {
  const activity = work.priaCode ?? '';
  // PRIA tegevuseta (vana) töö puhul jääb saagi tunnuseks koristusfaas
  const isHarvest = activity ? activity === PRIA_ACTIVITY.HARVEST : work.phase === 'HARVEST';
  const imported = entry?.source === 'PRIA_IMPORT'; // imporditud kandel pole kellaaegu ega alati töötajat
  const others = work.entries.filter((e) => e.id !== entry?.id);
  const doneBefore = others.reduce((s, e) => s + (e.areaHa ?? 0), 0);

  const [date, setDate] = useState(entry?.date ?? work.plannedDateFrom ?? todayIso());
  const [dateTo, setDateTo] = useState(entry?.dateTo ?? (entry ? '' : work.plannedDateTo ?? ''));
  const [method, setMethod] = useState(entry?.method ?? work.method ?? '');
  const [workerId, setWorkerId] = useState(entry?.workerId ?? (entry ? '' : work.plannedWorkerId ?? (workers.length === 1 ? workers[0].id : '')));
  const [startTime, setStartTime] = useState(entry?.startTime ?? '');
  const [endTime, setEndTime] = useState(entry?.endTime ?? '');
  const [laborHours, setLaborHours] = useState(fmt(entry?.laborHours));

  const startOptions = useMemo(() => {
    if (startTime && !TIME_OPTIONS.includes(startTime)) {
      return [...TIME_OPTIONS, startTime].sort();
    }
    return TIME_OPTIONS;
  }, [startTime]);

  const endOptions = useMemo(() => {
    const startMins = startTime ? timeToMinutes(startTime) : 0;
    const filtered = TIME_OPTIONS.filter((t) => !startTime || timeToMinutes(t) > startMins);
    if (endTime && !filtered.includes(endTime) && (!startTime || timeToMinutes(endTime) > startMins)) {
      return [...filtered, endTime].sort();
    }
    return filtered;
  }, [startTime, endTime]);

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    let curEnd = endTime;
    if (val && curEnd && timeToMinutes(curEnd) <= timeToMinutes(val)) {
      curEnd = '';
      setEndTime('');
    }
    if (val && curEnd && timeToMinutes(curEnd) > timeToMinutes(val)) {
      const diff = timeToMinutes(curEnd) - timeToMinutes(val);
      const h = Math.round((diff / 60) * 100) / 100;
      setLaborHours(fmt(h));
    } else {
      setLaborHours('');
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (startTime && val) {
      if (timeToMinutes(val) <= timeToMinutes(startTime)) {
        setLaborHours('');
        return;
      }
      const diff = timeToMinutes(val) - timeToMinutes(startTime);
      const h = Math.round((diff / 60) * 100) / 100;
      setLaborHours(fmt(h));
    } else {
      setLaborHours('');
    }
  };
  const [vehicleId, setVehicleId] = useState(entry?.vehicleId ?? '');
  const [implementId, setImplementId] = useState(entry?.implementId ?? '');
  const [equipmentHours, setEquipmentHours] = useState(fmt(entry?.equipmentHours));
  const [fuelLiters, setFuelLiters] = useState(fmt(entry?.fuelLiters, 1));
  const [areaHa, setAreaHa] = useState(fmt(entry ? entry.areaHa : work.plannedAreaHa ?? null));
  const [telemetryAreaHa, setTelemetryAreaHa] = useState(fmt(entry?.telemetryAreaHa));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const initialTotal = doneBefore + (parseNum(fmt(entry ? entry.areaHa : work.plannedAreaHa ?? null)) ?? 0);
  const initial100 = fieldAreaHa > 0 && initialTotal >= fieldAreaHa - 0.01;
  const [finish, setFinish] = useState(initial100);
  // Materjalid: olemasolevast kandest või uue kande puhul töö plaanist (norm ha kohta → kogus kokku)
  const [rows, setRows] = useState<PriaRow[]>(() =>
    entry
      ? entry.materials.map((m) => planLineToRow(m, entry.areaHa ?? fieldAreaHa))
      : work.lines.filter((l) => l.kind === 'MATERIAL').map((l) => planLineToRow(l, work.plannedAreaHa ?? fieldAreaHa))
  );
  const [harvest, setHarvest] = useState<HarvestRow>(() => {
    if (entry) {
      const tonnes = entry.harvest?.tonnes ?? entry.harvestTonnes;
      return { ratePerHa: fmt(entry.harvest?.ratePerHa, 3), total: fmt(tonnes, 3), priaKind: entry.harvest?.priaKind ?? '', priaSpec: entry.harvest?.priaSpec ?? '' };
    }
    const plan = work.lines.find((l) => l.kind === 'HARVEST');
    return recomputeHarvestTotal(
      { ratePerHa: fmt(plan?.ratePerHa, 3), total: '', priaKind: plan?.priaKind ?? '', priaSpec: plan?.priaSpec ?? '' },
      work.plannedAreaHa ?? fieldAreaHa
    );
  });
  const [observations, setObservations] = useState<WorkEntryObservation[]>(entry?.observations ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [telemetrySuggestions, setTelemetrySuggestions] = useState<TelemetrySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!telemetryEnabled || !work.fieldSeasonId || !date) {
      setTelemetrySuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    api.getTelemetrySuggestions(work.fieldSeasonId, date, entry?.id)
      .then((res) => {
        if (isMounted) setTelemetrySuggestions(res);
      })
      .catch((err) => {
        console.error('Telemeetria soovituste laadimine ebaõnnestus:', err);
        if (isMounted) setTelemetrySuggestions([]);
      })
      .finally(() => {
        if (isMounted) setLoadingSuggestions(false);
      });
    return () => {
      isMounted = false;
    };
  }, [telemetryEnabled, work.fieldSeasonId, date, entry?.id]);

  const applySuggestion = (s: TelemetrySuggestion) => {
    setSelectedSuggestionId(s.id);
    if (s.vehicleId) setVehicleId(s.vehicleId);
    setImplementId(s.implementId || '');
    if (s.workerId) setWorkerId(s.workerId);
    setStartTime(s.startTime);
    setEndTime(s.endTime);
    const hStr = fmt(s.durationHours);
    setEquipmentHours(hStr);
    setLaborHours(hStr);
    if (s.workedAreaHa != null) {
      setTelemetryAreaHa(fmt(s.workedAreaHa));
      // Tehtud pindala eeltäidetakse telemeetriast (kasutaja saab muuta); 0 ha (haakeriist puudub) ei kirjuta üle
      if (s.workedAreaHa > 0) changeArea(fmt(Math.round(s.workedAreaHa * 100) / 100));
    }
  };

  const vehicleOptions = useMemo(() => {
    const list = [...vehicles];
    for (const s of telemetrySuggestions) {
      if (s.vehicleId && s.vehicleName && !list.some((v) => v.id === s.vehicleId)) {
        list.push({ id: s.vehicleId, name: s.vehicleName });
      }
    }
    return list;
  }, [vehicles, telemetrySuggestions]);

  const implementOptions = useMemo(() => {
    const list = [...implementsList];
    for (const s of telemetrySuggestions) {
      if (s.implementId && s.implementName && !list.some((i) => i.id === s.implementId)) {
        list.push({ id: s.implementId, name: s.implementName });
      }
    }
    return list;
  }, [implementsList, telemetrySuggestions]);

  const workerOptions = useMemo(() => {
    const list = [...workers];
    // Kande töötaja, keda pole loendis (nt PRIA impordist), jääb valikusse
    if (entry?.workerId && entry.workerName && !list.some((w) => w.id === entry.workerId)) {
      list.push({ id: entry.workerId, name: entry.workerName });
    }
    for (const s of telemetrySuggestions) {
      if (s.workerId && s.workerName && !list.some((w) => w.id === s.workerId)) {
        list.push({ id: s.workerId, name: s.workerName });
      }
    }
    return list;
  }, [workers, telemetrySuggestions, entry?.workerId, entry?.workerName]);

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

  const areaNum = parseNum(areaHa) ?? 0;
  const totalAfter = doneBefore + areaNum;

  // Tehtud pindala muutmine (käsitsi või telemeetriast): kogu põllu täitumisel märgitakse töö lõpetatuks
  // Kande pindala muutmine (käsitsi, kiirvalik, telemeetria): read ja saak arvutatakse normist uuesti
  const setArea = (val: string) => {
    setAreaHa(val);
    const area = parseNum(val) ?? fieldAreaHa;
    setRows((rs) => recomputeTotals(rs, area));
    setHarvest((h) => recomputeHarvestTotal(h, area));
  };

  const changeArea = (val: string) => {
    setArea(val);
    if (fieldAreaHa > 0) {
      setFinish(doneBefore + (parseNum(val) ?? 0) >= fieldAreaHa - 0.01);
    }
  };

  const applyPercentage = (pct: number) => {
    if (fieldAreaHa <= 0) return;
    const targetTotal = pct === 100 ? fieldAreaHa : Math.round(((fieldAreaHa * pct) / 100) * 100) / 100;
    const needed = Math.max(0, targetTotal - doneBefore);
    const roundedNeeded = Math.round(needed * 100) / 100;
    setArea(fmt(roundedNeeded));
    if (pct === 100 || targetTotal >= fieldAreaHa - 0.01) {
      setFinish(true);
    } else {
      setFinish(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!date) return setError('Kuupäev on kohustuslik');
    if (dateTo && dateTo < date) return setError('Lõpu kuupäev ei saa olla enne algust');
    if (activity === PRIA_ACTIVITY.PLANT_PROTECTION && !workerId) return setError('Taimekaitsetöö teostaja on kohustuslik');
    if (!workerId && !imported) return setError('Vali töötaja');
    if ((!startTime || !endTime) && !imported) return setError('Vali algus- ja lõpukellaaeg');
    if (equipmentHours.trim() && !vehicleId && !implementId) return setError('Vali masin ja/või haakeriist, mille töötunnid sisestasid');
    if (startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return setError('Lõpukellaaeg peab olema alguse omast suurem');
    }
    // Kandel peab materjal olema Kulumaterjalide registris (plaanis on vabatekst lubatud)
    if (rows.some((r) => !r.materialId && r.label.trim())) return setError('Vali toode Kulumaterjalidest');
    setBusy(true);
    try {
      await api.saveWorkEntry(
        {
          fieldWorkId: work.id,
          date,
          dateTo: dateTo || null,
          method: method || null,
          workerId: workerId || null,
          laborHours: parseNum(laborHours),
          startTime: startTime || null,
          endTime: endTime || null,
          vehicleId: vehicleId || null,
          implementId: implementId || null,
          equipmentHours: parseNum(equipmentHours),
          fuelLiters: parseNum(fuelLiters),
          areaHa: parseNum(areaHa),
          telemetryAreaHa: parseNum(telemetryAreaHa),
          materials: rows
            .map((r) => ({ materialId: r.materialId, quantity: parseNum(r.total) ?? 0, ratePerHa: parseNum(r.ratePerHa), pria: rowPria(r) }))
            .filter((r) => r.materialId && r.quantity > 0),
          harvest: isHarvest && parseNum(harvest.total) != null
            ? { tonnes: parseNum(harvest.total)!, ratePerHa: parseNum(harvest.ratePerHa), priaKind: harvest.priaKind || null, priaSpec: harvest.priaSpec || null }
            : null,
          harvestTonnes: null,
          observations: observations.filter((o) => o.label.trim()),
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
          {(others.length > 0 || fieldAreaHa > 0) && (
            <div className="work-entry-progress">
              <div className="work-entry-progress-head">
                <strong>Varasemad kanded: {others.length}</strong>
                {fieldAreaHa > 0 && <span>{fmtHa(doneBefore)} / {fmtHa(fieldAreaHa)} ha tehtud</span>}
              </div>
              {fieldAreaHa > 0 && (
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

          {loadingSuggestions && (
            <div className="telemetry-loading-notice">
              <Radio size={14} className="telemetry-pulse-icon" />
              <span>Kontrollin telemeetriat...</span>
            </div>
          )}

          {telemetrySuggestions.length > 0 && (
            <div className="telemetry-suggestions-card">
              <div className="telemetry-suggestions-head">
                <div className="telemetry-suggestions-title">
                  <Radio size={14} className="telemetry-pulse-icon" />
                  <span>Telemeetria tuvastatud põllusõidud ({telemetrySuggestions.length}):</span>
                </div>
                <span className="telemetry-suggestions-hint">Klõpsa kande eeltäitmiseks</span>
              </div>
              <div className="telemetry-suggestions-list">
                {telemetrySuggestions.map((s) => {
                  const isSelected = selectedSuggestionId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`telemetry-suggestion-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => applySuggestion(s)}
                    >
                      <div className="telemetry-pill-row">
                        <span className="telemetry-pill-vehicle">🚜 {s.vehicleName || 'Tehnika'}</span>
                        {s.implementName ? (
                          <span className="telemetry-pill-impl">+{s.implementName}</span>
                        ) : (
                          <span className="telemetry-pill-impl" style={{ color: '#ef4444', fontWeight: 600 }}>(haakeriist puudub)</span>
                        )}
                        <span className="telemetry-pill-time">
                          <Clock size={12} /> {s.startTime} – {s.endTime} ({fmt(s.durationHours)} h)
                          {s.workedAreaHa != null && (
                            (s.workedAreaHa > 0 && s.implementName) ? (
                              <span> · {fmtHa(s.workedAreaHa)} ha</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}> · 0 ha</span>
                            )
                          )}
                        </span>
                      </div>
                      <div className="telemetry-pill-meta">
                        {s.workerName && <span className="telemetry-pill-worker">👤 {s.workerName}</span>}
                        <span className="telemetry-pill-action">
                          {isSelected ? '✓ Valitud' : 'Vali see sõit'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="work-entry-grid work-entry-top-grid">
            <div className="form-group">
              <label htmlFor="we-date">Kuupäev *</label>
              <DateInput id="we-date" value={date} onChange={setDate} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="we-date-to">Lõpp (kui mitu päeva)</label>
              <DateInput id="we-date-to" value={dateTo} onChange={setDateTo} className="form-input" />
            </div>
            {activity === PRIA_ACTIVITY.FERTILIZING && (
              <div className="form-group">
                <label htmlFor="we-method">Väetamisviis</label>
                <select id="we-method" className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="">– vali –</option>
                  {FERTILIZING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  {method && !(FERTILIZING_METHODS as readonly string[]).includes(method) && <option value={method}>{method}</option>}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="we-worker">Töötaja{imported ? '' : ' *'}</label>
              <select id="we-worker" className="form-input" required={!imported} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                <option value="">– valimata –</option>
                {workerOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="we-start-time">Algus{imported ? '' : ' *'}</label>
              <select
                id="we-start-time"
                required={!imported}
                className="form-input time-select"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              >
                <option value="">– algus –</option>
                {startOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="we-end-time">Lõpp{imported ? '' : ' *'}</label>
              <select
                id="we-end-time"
                required={!imported}
                className="form-input time-select"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
              >
                <option value="">– lõpp –</option>
                {endOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="we-labor">Tööaeg, h</label>
              <input
                id="we-labor"
                className="form-input num readonly"
                readOnly
                tabIndex={-1}
                value={laborHours}
                placeholder="–"
                title="Arvutatakse alguse ja lõpu kellaajast"
              />
            </div>
          </div>

          <section className="work-entry-section">
            <h4>Masin ja haakeriist</h4>
            <div className="work-entry-grid four">
              <div className="form-group">
                <label htmlFor="we-vehicle">Masin</label>
                <select id="we-vehicle" className="form-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  <option value="">– pole –</option>
                  {vehicleOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="we-impl">Haakeriist</label>
                <select id="we-impl" className="form-input" value={implementId} onChange={(e) => setImplementId(e.target.value)}>
                  <option value="">– pole –</option>
                  {implementOptions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
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
              <h4>Materjalid</h4>
              <PriaLinesEditor activity={activity} rows={rows} onChange={setRows} materials={materials} areaHa={parseNum(areaHa) ?? fieldAreaHa} showTotals />
            </section>
          )}

          {isHarvest && (
            <section className="work-entry-section">
              <h4>Saak</h4>
              <HarvestEditor value={harvest} onChange={setHarvest} areaHa={parseNum(areaHa) ?? fieldAreaHa} showTotals />
            </section>
          )}

          {activity === PRIA_ACTIVITY.MONITORING && (
            <section className="work-entry-section">
              <h4>Seire leiud</h4>
              <ObservationsEditor rows={observations} onChange={setObservations} />
            </section>
          )}

          <div className="work-entry-section">
            <div className="work-entry-grid work-entry-area-grid">
              <div className="form-group">
                <label htmlFor="we-area">Tehtud pindala, ha</label>
                <input
                  id="we-area"
                  className="form-input num"
                  inputMode="decimal"
                  value={areaHa}
                  onChange={(e) => changeArea(e.target.value)}
                  placeholder="0,00"
                  title="Sisesta pindala või vali allolevatest kiirvalikutest (10% – 100%)"
                />
              </div>
              <div className="form-group">
                <label htmlFor="we-telemetry-area">Telemeetria pindala, ha</label>
                <input
                  id="we-telemetry-area"
                  className="form-input num readonly"
                  readOnly
                  tabIndex={-1}
                  value={telemetryAreaHa}
                  placeholder="–"
                  style={
                    (parseNum(telemetryAreaHa) === 0 && selectedSuggestionId)
                      ? { color: '#ef4444', borderColor: '#ef4444', fontWeight: 600, background: 'rgba(239, 68, 68, 0.08)' }
                      : undefined
                  }
                  title={
                    (parseNum(telemetryAreaHa) === 0 && selectedSuggestionId)
                      ? 'Haakeriista ei leitud seoste tabelist — hektarid on 0'
                      : 'Telemeetriast (GPS) arvutatud tehtud pindala põllu piirides (mittemuudetav)'
                  }
                />
              </div>
              {fieldAreaHa > 0 && (
                <p className="work-entry-hint align-end">Kokku pärast kannet {fmtHa(totalAfter)} / {fmtHa(fieldAreaHa)} ha</p>
              )}
            </div>

            {fieldAreaHa > 0 && (() => {
              // Märgitakse protsent, mis on kogu põllu täitumisele (varasemad + see kanne) kõige lähemal
              const totalPct = (totalAfter / fieldAreaHa) * 100;
              const enabledPcts = AREA_PERCENTAGES.filter((pct) => pct === 100 || doneBefore < (fieldAreaHa * pct) / 100);
              const nearestPct = areaNum > 0 && enabledPcts.length
                ? enabledPcts.reduce((best, pct) => (Math.abs(pct - totalPct) < Math.abs(best - totalPct) ? pct : best))
                : null;
              return (
              <div className="work-entry-area-presets">
                <span className="work-entry-presets-label">Põllust tehtud:</span>
                <div className="work-entry-presets-buttons">
                  {AREA_PERCENTAGES.map((pct) => {
                    const targetTotal = pct === 100 ? fieldAreaHa : Math.round(((fieldAreaHa * pct) / 100) * 100) / 100;
                    const needed = Math.max(0, targetTotal - doneBefore);
                    const roundedNeeded = Math.round(needed * 100) / 100;
                    const isExceeded = doneBefore >= targetTotal && pct < 100;
                    const isSelected = pct === nearestPct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        className={`area-preset-btn ${isSelected ? 'active' : ''}`}
                        disabled={isExceeded}
                        onClick={() => applyPercentage(pct)}
                        title={
                          isExceeded
                            ? `Varasemate kannetega on juba tehtud ${fmtHa(doneBefore)} ha (rohkem kui ${pct}%)`
                            : `Vali ${pct}% (${fmtHa(targetTotal)} ha) → sellesse kandesse ${fmtHa(roundedNeeded)} ha`
                        }
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })()}
          </div>

          <div className="form-group">
            <label htmlFor="we-notes">Märkus</label>
            <textarea id="we-notes" rows={2} className="form-input" placeholder="nt mullaniiskus, katkestused, tähelepanekud" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <label className={`work-entry-finish ${finish ? 'on' : ''}`}>
            <input type="checkbox" checked={finish} onChange={(e) => setFinish(e.target.checked)} />
            <span>
              <strong>Töö on sellega lõpetatud</strong>
              <small>Märgi ainult siis, kui rohkem kandeid ei tule. 100% puhul lõpetatakse automaatselt.</small>
            </span>
          </label>

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
