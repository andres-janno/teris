// src/components/FieldWorkPlanForm.tsx — töö plaan: vaatamine (kompaktne, ainult lugemiseks) ja muutmine (vorm).
// Ühine koht plaani valideerimisele ja salvestamisele (api.addFieldWork / api.updateFieldWork);
// kasutavad FieldWorkPlanDialog (uus töö, täisvaade) ja põllutööde tahvli valitud töö aken.
import React, { useState } from 'react';
import { DateInput } from './DateInput';
import { api } from '../services/api';
import { formatDate, formatDateRange } from '../services/dateFormat';
import { PRIA_ACTIVITY, FERTILIZING_METHODS, PRIA_ACTIVITIES } from '../services/pria';
import type { FieldWork, FieldWorkPlanLine, Material, WorkType } from '../types/fieldWork';
import { PriaLinesEditor, HarvestEditor, planLineToRow, rowToPlanLine, type PriaRow, type HarvestRow } from './PriaLinesEditor';

export interface FieldWorkPlanFormProps {
  fieldSeasonId: number;
  fieldAreaHa: number;
  work: FieldWork | null; // null = uus töö (ainult muutmisrežiimis)
  workTypes: WorkType[];
  materials: Material[];
  workers: { id: string; name: string }[];
  mode: 'view' | 'edit';
  layout?: 'dialog' | 'inline'; // dialog: modal-body + modal-footer; inline: paneeli sees
  onSaved: () => void;
  onCancel?: () => void;
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 2, useGrouping: false }));
const fmtNum = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('et-EE', { maximumFractionDigits: 3, useGrouping: false }));

export const FieldWorkPlanForm: React.FC<FieldWorkPlanFormProps> = (props) =>
  props.mode === 'view' && props.work ? <FieldWorkPlanView {...props} work={props.work} /> : <FieldWorkPlanEditor {...props} />;

// --- Vaatamine ---

const FieldWorkPlanView: React.FC<FieldWorkPlanFormProps & { work: FieldWork }> = ({ work, fieldAreaHa, workers }) => {
  const activity = work.priaCode ?? '';
  const isSeed = activity === PRIA_ACTIVITY.SOWING;
  const isFert = activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING;
  const isTkv = activity === PRIA_ACTIVITY.PLANT_PROTECTION;
  const materialLines = work.lines.filter((l) => l.kind === 'MATERIAL');
  const harvestLine = work.lines.find((l) => l.kind === 'HARVEST');
  const method = activity === PRIA_ACTIVITY.FERTILIZING ? work.method : null;
  const workerName = isTkv && work.plannedWorkerId
    ? work.plannedWorkerName ?? workers.find((w) => w.id === work.plannedWorkerId)?.name ?? work.plannedWorkerId
    : null;
  const hasDate = !!(work.plannedDateFrom || work.plannedDateTo);

  const isEmpty = !hasDate && !work.plannedText && work.plannedAreaHa == null && !method && !workerName
    && materialLines.length === 0 && !harvestLine && !work.notes;
  if (isEmpty) return <div className="fw-plan-view"><div className="fw-panel-empty">Plaan puudub</div></div>;

  const planned = work.plannedDateFrom
    ? (work.plannedDateTo && work.plannedDateTo !== work.plannedDateFrom ? formatDateRange(work.plannedDateFrom, work.plannedDateTo) : formatDate(work.plannedDateFrom))
    : work.plannedDateTo ? `– ${formatDate(work.plannedDateTo)}` : work.plannedText || '–';
  const dash = (s: string | null | undefined) => (s && s.trim() ? s : '–');

  const columns: { label: string; num?: boolean; value: (l: FieldWorkPlanLine) => string }[] = [
    { label: 'Register/materjal', value: (l) => dash(l.priaRegister) },
    { label: isSeed ? 'Sort' : 'Toode', value: (l) => dash(l.label) },
    { label: isSeed || isTkv ? 'Liik' : 'Väetise liik', value: (l) => dash(l.priaKind) },
    ...(isSeed ? [{ label: 'Kategooria', value: (l: FieldWorkPlanLine) => dash(l.priaSpec) }] : []),
    ...(isTkv ? [{ label: 'Toimeaine', value: (l: FieldWorkPlanLine) => dash(l.activeIngredient) }] : []),
    { label: 'Kogus/ha', num: true, value: (l) => (l.ratePerHa == null ? '–' : `${fmtNum(l.ratePerHa)} ${l.unit}`) },
    ...(isFert ? [
      { label: 'N kg/ha', num: true, value: (l: FieldWorkPlanLine) => fmtNum(l.nKgHa) },
      { label: 'P kg/ha', num: true, value: (l: FieldWorkPlanLine) => fmtNum(l.pKgHa) },
      { label: 'K kg/ha', num: true, value: (l: FieldWorkPlanLine) => fmtNum(l.kKgHa) }
    ] : [])
  ];

  return (
    <div className="fw-plan-view">
      <dl className="fw-plan-rows">
        <dt>Tegevus</dt><dd title={work.priaName}>{work.workTypeName}</dd>
        <dt>Planeeritud</dt><dd>{planned}</dd>
        {work.plannedText && hasDate && <><dt>Ligikaudne aeg</dt><dd>{work.plannedText}</dd></>}
        <dt>Pindala</dt><dd className="num">{fmtNum(work.plannedAreaHa ?? fieldAreaHa)} ha</dd>
        {method && <><dt>Väetamisviis</dt><dd>{method}</dd></>}
        {workerName && <><dt>Teostaja</dt><dd>{workerName}</dd></>}
      </dl>
      {materialLines.length > 0 && (
        <div className="fw-plan-block">
          <div className="fw-plan-block-title">Planeeritud materjalid</div>
          <div className="fw-plan-table-wrap">
            <table className="fw-plan-table">
              <thead><tr>{columns.map((c) => <th key={c.label} className={c.num ? 'num' : undefined}>{c.label}</th>)}</tr></thead>
              <tbody>
                {materialLines.map((l, i) => (
                  <tr key={l.id ?? i}>{columns.map((c) => <td key={c.label} className={c.num ? 'num' : undefined}>{c.value(l)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {harvestLine && (
        <div className="fw-plan-block">
          <div className="fw-plan-block-title">Planeeritud saak</div>
          <div className="fw-plan-table-wrap">
            <table className="fw-plan-table">
              <thead><tr><th>Kultuuri tüüp</th><th>Saagi tüüp</th><th className="num">Saak t/ha</th></tr></thead>
              <tbody><tr><td>{dash(harvestLine.priaSpec)}</td><td>{dash(harvestLine.priaKind)}</td><td className="num">{fmtNum(harvestLine.ratePerHa)}</td></tr></tbody>
            </table>
          </div>
        </div>
      )}
      {work.notes && (
        <div className="fw-plan-block">
          <div className="fw-plan-block-title">Märkused</div>
          <div className="fw-plan-notes">{work.notes}</div>
        </div>
      )}
    </div>
  );
};

// --- Muutmine ---

const FieldWorkPlanEditor: React.FC<FieldWorkPlanFormProps> = ({ fieldSeasonId, fieldAreaHa, work, workTypes, materials, workers, layout = 'inline', onSaved, onCancel }) => {
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

  const dialog = layout === 'dialog';
  return (
    <form className={`fw-plan-form ${layout}`} onSubmit={save}>
      <div className={dialog ? 'modal-body work-entry-body' : 'work-entry-body'}>
        <div className="work-entry-grid work-plan-top-grid">
          <div className="form-group">
            <label htmlFor="wp-type">Tegevus *</label>
            <select id="wp-type" className="form-input" value={workTypeId} disabled={!!work} onChange={(e) => setWorkTypeId(e.target.value)}>
              <option value="">– vali –</option>
              {ordered.map((w) => <option key={w.id} value={w.id}>{w.shortName?.trim() ? `${w.shortName.trim()} (${w.name})` : w.name}</option>)}
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
      <div className={dialog ? 'modal-footer' : 'fw-plan-actions'}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Loobu</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
      </div>
    </form>
  );
};
