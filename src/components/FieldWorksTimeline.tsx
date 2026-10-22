// src/components/FieldWorksTimeline.tsx — põllu hooaja tööd ajajoonena: plaan + kanded (tegelik).
import React, { useMemo, useState } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, FileInput } from 'lucide-react';
import { formatDate, formatDateRange } from '../services/dateFormat';
import { WORK_PHASE_META, WORK_PHASES, type FieldSeasonWorks, type FieldWork, type WorkEntry, type WorkPhase, type FieldWorkPlanLine, type WorkEntryMaterial } from '../types/fieldWork';

const num = (n: number | null | undefined, d = 2) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: d }));
const range = (from: string | null, to: string | null) => (from ? (to && to !== from ? formatDateRange(from, to) : formatDate(from)) : null);
const STATUS_LABEL = { PLANNED: 'Planeeritud', IN_PROGRESS: 'Töös', DONE: 'Tehtud' } as const;

type Filter = 'all' | WorkPhase | 'planned';

// Töö kuupäev ajajoone järjestuseks: esimene kanne, siis plaan
const sortKey = (w: FieldWork) => w.entries.map((e) => e.date).sort()[0] ?? w.plannedDateFrom ?? '9999';

const lineText = (l: Pick<FieldWorkPlanLine, 'label' | 'priaKind' | 'priaRegister' | 'priaSpec' | 'activeIngredient' | 'nKgHa' | 'pKgHa' | 'kKgHa' | 'ratePerHa' | 'unit'>, total?: number | null) =>
  [
    l.label,
    l.priaKind,
    l.priaSpec,
    l.ratePerHa != null ? `${num(l.ratePerHa)} ${l.unit}/ha` : null,
    total != null ? `= ${num(total)} ${l.unit}` : null,
    l.nKgHa != null || l.pKgHa != null || l.kKgHa != null ? `N ${num(l.nKgHa)} P ${num(l.pKgHa)} K ${num(l.kKgHa)}` : null,
    l.activeIngredient ? `toimeaine ${l.activeIngredient}` : null
  ].filter(Boolean).join(' · ');

const EntryRow: React.FC<{ work: FieldWork; entry: WorkEntry; onEdit?: () => void }> = ({ work, entry, onEdit }) => {
  const planByKey = new Map(work.lines.map((l) => [l.label.toLowerCase(), l]));
  return (
    <button type="button" className="fwt-entry" onClick={onEdit} disabled={!onEdit}>
      <span className="fwt-entry-head">
        <strong>{range(entry.date, entry.dateTo)}</strong>
        {entry.areaHa != null && <span>{num(entry.areaHa)} ha</span>}
        {entry.workerName && <span>{entry.workerName}</span>}
        {(entry.vehicleName || entry.implementName) && <span>{[entry.vehicleName, entry.implementName].filter(Boolean).join(' + ')}</span>}
        {entry.equipmentHours != null && <span>{num(entry.equipmentHours)} h</span>}
        {entry.fuelLiters != null && <span>{num(entry.fuelLiters, 1)} l</span>}
        {entry.source === 'PRIA_IMPORT' && <span className="fwt-badge" title="Imporditud PRIA põlluraamatust"><FileInput size={12} /> PRIA</span>}
      </span>
      {entry.materials.map((m: WorkEntryMaterial, i) => {
        const plan = planByKey.get(m.name.toLowerCase());
        const differs = plan?.ratePerHa != null && m.ratePerHa != null && Math.abs(plan.ratePerHa - m.ratePerHa) > 0.005;
        return (
          <span key={i} className="fwt-line">
            {lineText({ label: m.name, unit: m.unit, ratePerHa: m.ratePerHa ?? null, priaKind: m.priaKind ?? null, priaRegister: m.priaRegister ?? null, priaSpec: m.priaSpec ?? null, activeIngredient: m.activeIngredient ?? null, nKgHa: m.nKgHa ?? null, pKgHa: m.pKgHa ?? null, kKgHa: m.kKgHa ?? null }, m.quantity)}
            {differs && <span className="fwt-plan-diff"> (plaan {num(plan!.ratePerHa)} {m.unit}/ha)</span>}
          </span>
        );
      })}
      {entry.harvest && (
        <span className="fwt-line">Saak {num(entry.harvest.ratePerHa)} t/ha = {num(entry.harvest.tonnes)} t{entry.harvest.priaKind ? ` · ${entry.harvest.priaKind}` : ''}{entry.harvest.priaSpec ? ` · ${entry.harvest.priaSpec}` : ''}</span>
      )}
      {!entry.harvest && entry.harvestTonnes != null && <span className="fwt-line">Saak {num(entry.harvestTonnes)} t</span>}
      {entry.observations.map((o, i) => (
        <span key={`o${i}`} className="fwt-line">{o.priaRegister ? `${o.priaRegister}: ` : ''}{o.label}{o.unit ? ` · ${num(o.quantity)} ${o.unit}` : ''}</span>
      ))}
    </button>
  );
};

const WorkItem: React.FC<{ work: FieldWork; canEdit: boolean; onEditWork: () => void; onAddEntry: () => void; onEditEntry: (e: WorkEntry) => void }> = ({ work, canEdit, onEditWork, onAddEntry, onEditEntry }) => {
  const [showNotes, setShowNotes] = useState(false);
  const meta = WORK_PHASE_META[work.phase];
  const entries = [...work.entries].sort((a, b) => a.date.localeCompare(b.date));
  const planned = range(work.plannedDateFrom, work.plannedDateTo) ?? work.plannedText;
  return (
    <article className={`fwt-work ${work.status.toLowerCase()}`} style={{ borderLeftColor: meta.color }}>
      <header className="fwt-work-head">
        <span className="fwt-work-title" title={work.priaName}>{work.workTypeName}{work.method ? <small> · {work.method}</small> : null}</span>
        <span className={`fwt-status ${work.status.toLowerCase()}`}>{STATUS_LABEL[work.status]}</span>
        {canEdit && (
          <span className="fwt-actions">
            <button type="button" className="icon-btn-ghost" title="Muuda plaani" onClick={onEditWork}><Pencil size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onAddEntry}><Plus size={13} /> Kanne</button>
          </span>
        )}
      </header>
      {(planned || work.lines.length > 0 || work.plannedWorkerName) && (
        <div className="fwt-plan">
          <span className="fwt-plan-label">Plaan</span>
          <span>
            {[planned, work.plannedAreaHa != null ? `${num(work.plannedAreaHa)} ha` : null, work.plannedWorkerName].filter(Boolean).join(' · ')}
          </span>
          {work.lines.map((l, i) => <span key={i} className="fwt-line">{lineText(l)}</span>)}
        </div>
      )}
      {entries.map((e) => <EntryRow key={e.id} work={work} entry={e} onEdit={canEdit ? () => onEditEntry(e) : undefined} />)}
      {work.notes && (
        <button type="button" className="fwt-notes-toggle" onClick={() => setShowNotes(!showNotes)}>
          {showNotes ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Märkused
        </button>
      )}
      {showNotes && <p className="fwt-notes">{work.notes}</p>}
    </article>
  );
};

interface FieldWorksTimelineProps {
  data: FieldSeasonWorks | null;
  loading: boolean;
  canEdit: boolean;
  onAddWork: () => void;
  onEditWork: (w: FieldWork) => void;
  onAddEntry: (w: FieldWork) => void;
  onEditEntry: (w: FieldWork, e: WorkEntry) => void;
}

export const FieldWorksTimeline: React.FC<FieldWorksTimelineProps> = ({ data, loading, canEdit, onAddWork, onEditWork, onAddEntry, onEditEntry }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const works = data?.works ?? [];
  const { done, plannedOnly, npk } = useMemo(() => {
    const npk = { n: 0, p: 0, k: 0 };
    for (const w of works) for (const e of w.entries) for (const m of e.materials) {
      const share = e.areaHa && data?.areaHa ? e.areaHa / data.areaHa : 1;
      npk.n += (m.nKgHa ?? 0) * share; npk.p += (m.pKgHa ?? 0) * share; npk.k += (m.kKgHa ?? 0) * share;
    }
    return {
      done: works.filter((w) => w.entries.length > 0).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
      plannedOnly: works.filter((w) => w.entries.length === 0).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
      npk
    };
  }, [works, data?.areaHa]);
  const match = (w: FieldWork) => filter === 'all' || (filter === 'planned' ? w.entries.length === 0 : w.phase === filter);

  return (
    <section className="fwt">
      <header className="fwt-head">
        <div className="fwt-summary">
          <span>{works.length} tööd · {works.filter((w) => w.status === 'DONE').length} tehtud</span>
          {(npk.n || npk.p || npk.k) ? <span>N {num(npk.n, 1)} P {num(npk.p, 1)} K {num(npk.k, 1)} kg/ha</span> : null}
          {(data?.targetYieldTonsHa != null || data?.actualYieldTonsHa != null) && (
            <span>saak {num(data?.targetYieldTonsHa) || '–'} / {num(data?.actualYieldTonsHa) || '–'} t/ha</span>
          )}
        </div>
        {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={onAddWork}><Plus size={14} /> Lisa töö</button>}
      </header>
      <div className="fwt-filters">
        {(['all', ...WORK_PHASES, 'planned'] as Filter[]).map((f) => (
          <button key={f} type="button" className={`field-season-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Kõik' : f === 'planned' ? 'Planeeritud' : WORK_PHASE_META[f].label}
          </button>
        ))}
      </div>
      {loading && <p className="fwt-empty">Laen…</p>}
      {!loading && works.length === 0 && <p className="fwt-empty">Sellel hooajal töid pole.</p>}
      {done.filter(match).map((w) => (
        <WorkItem key={w.id} work={w} canEdit={canEdit} onEditWork={() => onEditWork(w)} onAddEntry={() => onAddEntry(w)} onEditEntry={(e) => onEditEntry(w, e)} />
      ))}
      {plannedOnly.filter(match).length > 0 && <h4 className="fwt-group">Planeeritud</h4>}
      {plannedOnly.filter(match).map((w) => (
        <WorkItem key={w.id} work={w} canEdit={canEdit} onEditWork={() => onEditWork(w)} onAddEntry={() => onAddEntry(w)} onEditEntry={(e) => onEditEntry(w, e)} />
      ))}
    </section>
  );
};
