// src/components/FieldWorkPlanForm.tsx — töö plaan: vaatamine (kompaktne, ainult lugemiseks) ja muutmine (vorm).
// Ühine koht plaani valideerimisele ja salvestamisele (api.addFieldWork / api.updateFieldWork);
// kasutab põllutööde tahvli valitud töö aken.
import React, { useEffect, useState } from 'react';
import { formatQty } from '../services/units';
import { api } from '../services/api';
import { formatDate, formatDateRange } from '../services/dateFormat';
import { PRIA_ACTIVITY, FERTILIZING_METHODS, PRIA_ACTIVITIES } from '../services/pria';
import type { FieldWork, FieldWorkPlanLine, Article, WorkType } from '../types/fieldWork';
import type { SeedCheck } from '../services/seedCropCheck';
import { PriaLinesEditor, HarvestEditor, planLineToRow, rowToPlanLine, recomputeTotals, recomputeHarvestTotal, type PriaRow, type HarvestRow } from './PriaLinesEditor';
import { Button, DialogForm, DialogBody, DialogFooter, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DateInput, FilterSelect, FilterClear } from './ui';

export interface FieldWorkPlanFormProps {
  fieldSeasonId: number;
  fieldAreaHa: number;
  work: FieldWork | null; // null = uus töö (ainult muutmisrežiimis)
  workTypes: WorkType[];
  articles: Article[];
  workers: { id: string; name: string }[];
  mode: 'view' | 'edit';
  onBusyChange?: (busy: boolean) => void; // salvestamise ajal: kutsuja keelab akna sulgemise
  layout?: 'dialog' | 'inline'; // dialog: DialogBody + DialogFooter (kutsuja paneb DialogContenti ja DialogHeaderi); inline: paneeli sees
  onSaved: () => void;
  onCancel?: () => void;
  seedCheck?: SeedCheck; // seemne ja põllu kultuuri võrdlus
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 2, useGrouping: false }));
const fmtNum = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('et-EE', { maximumFractionDigits: 3, useGrouping: false }));
const fmtQ = (n: number | null | undefined) => (n == null ? '–' : formatQty(n));

export const FieldWorkPlanForm: React.FC<FieldWorkPlanFormProps> = (props) =>
  props.mode === 'view' && props.work ? <FieldWorkPlanView {...props} work={props.work} /> : <FieldWorkPlanEditor {...props} />;

// --- Vaatamine ---

const FieldWorkPlanView: React.FC<FieldWorkPlanFormProps & { work: FieldWork }> = ({ work, fieldAreaHa, workers }) => {
  const activity = work.priaCode ?? '';
  const isSeed = activity === PRIA_ACTIVITY.SOWING;
  const isFert = activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING;
  const isTkv = activity === PRIA_ACTIVITY.PLANT_PROTECTION;
  const articleLines = work.lines.filter((l) => l.kind === 'MATERIAL');
  const harvestLine = work.lines.find((l) => l.kind === 'HARVEST');
  const method = activity === PRIA_ACTIVITY.FERTILIZING ? work.method : null;
  const workerName = isTkv && work.plannedWorkerId
    ? work.plannedWorkerName ?? workers.find((w) => w.id === work.plannedWorkerId)?.name ?? work.plannedWorkerId
    : null;
  const hasDate = !!(work.plannedDateFrom || work.plannedDateTo);

  const isEmpty = !hasDate && work.plannedAreaHa == null && !method && !workerName
    && articleLines.length === 0 && !harvestLine && !work.notes;
  if (isEmpty) return <div className="fw-plan-view"><div className="fw-panel-empty">Plaan puudub</div></div>;

  const planned = work.plannedDateFrom
    ? (work.plannedDateTo && work.plannedDateTo !== work.plannedDateFrom ? formatDateRange(work.plannedDateFrom, work.plannedDateTo) : formatDate(work.plannedDateFrom))
    // Ainult kuupäevad; malli ligikaudset aega (nt "august – september") plaanis ei kuvata
    : work.plannedDateTo ? `– ${formatDate(work.plannedDateTo)}` : '–';
  const dash = (s: string | null | undefined) => (s && s.trim() ? s : '–');

  const columns: { label: string; num?: boolean; value: (l: FieldWorkPlanLine) => string }[] = [
    { label: 'Register/materjal', value: (l) => dash(l.priaRegister) },
    { label: isSeed ? 'Sort' : 'Toode', value: (l) => dash(l.label) },
    { label: isSeed || isTkv ? 'Liik' : 'Väetise liik', value: (l) => dash(l.priaKind) },
    ...(isSeed ? [{ label: 'Kategooria', value: (l: FieldWorkPlanLine) => dash(l.priaSpec) }] : []),
    ...(isTkv ? [{ label: 'Toimeaine', value: (l: FieldWorkPlanLine) => dash(l.activeIngredient) }] : []),
    { label: 'Kogus/ha', num: true, value: (l) => (l.ratePerHa == null ? '–' : `${fmtQ(l.ratePerHa)} ${l.unit}`) },
    // Kokku = norm × planeeritud pindala
    { label: 'Kokku', num: true, value: (l) => (l.ratePerHa == null ? '–' : `${fmtQ(l.ratePerHa * (work.plannedAreaHa ?? fieldAreaHa))} ${l.unit}`) },
    ...(isFert ? [
      { label: 'N kg/ha', num: true, value: (l: FieldWorkPlanLine) => fmtQ(l.nKgHa) },
      { label: 'P kg/ha', num: true, value: (l: FieldWorkPlanLine) => fmtQ(l.pKgHa) },
      { label: 'K kg/ha', num: true, value: (l: FieldWorkPlanLine) => fmtQ(l.kKgHa) }
    ] : [])
  ];

  return (
    <div className="fw-plan-view">
      <dl className="fw-plan-rows">
        <div><dt>Tegevus</dt><dd title={work.priaName}>{work.workTypeName}</dd></div>
        <div><dt>Planeeritud</dt><dd>{planned}</dd></div>
        <div><dt>Pindala</dt><dd className="num">{fmtNum(work.plannedAreaHa ?? fieldAreaHa)} ha</dd></div>
        {method && <div><dt>Väetamisviis</dt><dd>{method}</dd></div>}
        {workerName && <div><dt>Teostaja</dt><dd>{workerName}</dd></div>}
      </dl>
      {articleLines.length > 0 && (
        <div className="fw-plan-block">
          <div className="fw-plan-block-title">Planeeritud materjalid</div>
          <Table dense>
            <TableHeader>
              <TableRow>{columns.map((c) => <TableHead key={c.label} numeric={c.num}>{c.label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {articleLines.map((l, i) => (
                <TableRow key={l.id ?? i}>{columns.map((c) => <TableCell key={c.label} numeric={c.num}>{c.value(l)}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {harvestLine && (
        <div className="fw-plan-block">
          <div className="fw-plan-block-title">Planeeritud saak</div>
          <Table dense>
            <TableHeader>
              <TableRow><TableHead>Kultuuri tüüp</TableHead><TableHead>Saagi tüüp</TableHead><TableHead numeric>Saak t/ha</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell>{dash(harvestLine.priaSpec)}</TableCell><TableCell>{dash(harvestLine.priaKind)}</TableCell><TableCell numeric>{fmtQ(harvestLine.ratePerHa)}</TableCell></TableRow>
            </TableBody>
          </Table>
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

const FieldWorkPlanEditor: React.FC<FieldWorkPlanFormProps> = ({ fieldSeasonId, fieldAreaHa, work, workTypes, articles, workers, layout = 'inline', onBusyChange, onSaved, onCancel, seedCheck }) => {
  // PRIA tegevused tööloogika järjekorras; muudetava töö tüüp jääb valikusse ka siis, kui see pole enam aktiivne
  const ordered = workTypes.filter((w) => (w.isActive && w.priaCode) || w.id === work?.workTypeId)
    .sort((a, b) => PRIA_ACTIVITIES.findIndex((p) => p.name === a.priaCode) - PRIA_ACTIVITIES.findIndex((p) => p.name === b.priaCode));
  const [workTypeId, setWorkTypeId] = useState(work?.workTypeId ?? '');
  const workType = workTypes.find((w) => w.id === workTypeId);
  const activity = workType?.priaCode ?? work?.priaCode ?? '';
  const [dateFrom, setDateFrom] = useState(work?.plannedDateFrom ?? '');
  const [dateTo, setDateTo] = useState(work?.plannedDateTo ?? '');
  const [plannedText] = useState(work?.plannedText ?? '');
  const [areaHa, setAreaHa] = useState(fmt(work?.plannedAreaHa ?? fieldAreaHa));
  const [method, setMethod] = useState(work?.method ?? '');
  const [workerId, setWorkerId] = useState(work?.plannedWorkerId ?? '');
  const [notes, setNotes] = useState(work?.notes ?? '');
  const area = parseNum(areaHa) ?? fieldAreaHa;
  const [rows, setRows] = useState<PriaRow[]>(() => work?.lines.filter((l) => l.kind === 'MATERIAL').map((l) => planLineToRow(l, area)) ?? []);
  const harvestLine = work?.lines.find((l) => l.kind === 'HARVEST');
  const [harvest, setHarvest] = useState<HarvestRow>(() => recomputeHarvestTotal({ ratePerHa: fmt(harvestLine?.ratePerHa), total: '', priaKind: harvestLine?.priaKind ?? '', priaSpec: harvestLine?.priaSpec ?? '' }, area));
  // Pindala muutmisel arvutatakse materjalide ja saagi kogus kokku normist uuesti
  const changeArea = (v: string) => {
    setAreaHa(v);
    const a = parseNum(v) ?? fieldAreaHa;
    setRows((rs) => recomputeTotals(rs, a));
    setHarvest((h) => recomputeHarvestTotal(h, a));
  };
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  // Akna sulgumisel (lahtiühendamine) vabasta kutsuja sulgemislukk
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
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
        ? [{ kind: 'HARVEST' as const, articleId: null, label: 'Saak', unit: 't', ratePerHa: parseNum(harvest.ratePerHa), priaRegister: null, priaKind: harvest.priaKind || null, priaSpec: harvest.priaSpec || null, activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null }]
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
  const Form = dialog ? DialogForm : 'form';
  const Body = dialog ? DialogBody : 'div';
  const Footer = dialog ? DialogFooter : 'div';
  return (
    <Form className={`fw-plan-form ${layout}`} onSubmit={save}>
      <Body className="work-entry-body">
        <div className="work-entry-grid work-plan-top-grid">
          <div className="form-group">
            <label htmlFor="wp-type">Tegevus *</label>
            <FilterSelect fill id="wp-type" value={workTypeId} disabled={!!work} onChange={setWorkTypeId} options={[
              { value: '', label: '– vali –' },
              ...ordered.map((w) => ({ value: w.id, label: w.shortName?.trim() ? `${w.shortName.trim()} (${w.name})` : w.name }))
            ]} />
          </div>
          {activity === PRIA_ACTIVITY.FERTILIZING && (
            <div className="form-group">
              <label htmlFor="wp-method">Väetamisviis</label>
              <FilterClear fill active={!!method} onClear={() => setMethod('')}>
                <FilterSelect fill id="wp-method" value={method} onChange={setMethod} options={[
                  { value: '', label: '– vali –' },
                  ...FERTILIZING_METHODS.map((m) => ({ value: m, label: m })),
                  ...(method && !(FERTILIZING_METHODS as readonly string[]).includes(method) ? [{ value: method, label: method }] : [])
                ]} />
              </FilterClear>
            </div>
          )}
          {activity === PRIA_ACTIVITY.PLANT_PROTECTION && (
            <div className="form-group">
              <label htmlFor="wp-worker">Teostaja</label>
              <FilterClear fill active={!!workerId} onClear={() => setWorkerId('')}>
                <FilterSelect fill id="wp-worker" value={workerId} onChange={setWorkerId}
                  options={[{ value: '', label: '– valimata –' }, ...workerOptions.map((w) => ({ value: w.id, label: w.name }))]} />
              </FilterClear>
            </div>
          )}
          {/* Ligikaudset aega vormis ei küsita; olemasolev väärtus (nt mallist "Sügis 2025") jääb salvestamisel alles */}
          <div className="form-group"><label htmlFor="wp-from">Planeeritud algus</label><DateInput id="wp-from" value={dateFrom} onChange={setDateFrom} /></div>
          <div className="form-group"><label htmlFor="wp-to">Planeeritud lõpp</label><DateInput id="wp-to" value={dateTo} onChange={setDateTo} /></div>
          <div className="form-group">
            <label htmlFor="wp-area">Pindala, ha</label>
            <input id="wp-area" className="form-input num" inputMode="decimal" value={areaHa} onChange={(e) => changeArea(e.target.value)} />
          </div>
        </div>
        {usesMaterials && (
          <section className="work-entry-section">
            <h4>Planeeritud materjalid</h4>
            <PriaLinesEditor activity={activity} rows={rows} onChange={setRows} articles={articles} areaHa={area} showTotals seedCheck={seedCheck} />
          </section>
        )}
        {isHarvest && (
          <section className="work-entry-section">
            <h4>Planeeritud saak</h4>
            <HarvestEditor value={harvest} onChange={setHarvest} areaHa={area} showTotals />
          </section>
        )}
        <div className="form-group">
          <label htmlFor="wp-notes">Märkused</label>
          <textarea id="wp-notes" rows={3} maxLength={1000} className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <div className="alert-box error">{error}</div>}
      </Body>
      <Footer className={dialog ? undefined : 'fw-plan-actions'}>
        <Button type="button" variant="ghost" onClick={onCancel}>Loobu</Button>
        <Button type="submit" variant="primary" disabled={busy}>Salvesta</Button>
      </Footer>
    </Form>
  );
};
