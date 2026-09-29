// src/components/FieldWorksBoard.tsx — põllutööde tahvel (põhivaade kaardi kõrval).
// Read = hooaja põllud, veerud = Ettevalmistus → Külvatud → Hooldus → Koristatud.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Lock, Check, X, Edit2, Trash2, RotateCcw, ListChecks, Sprout, Wheat } from 'lucide-react';
import { api } from '../services/api';
import { matchCrop } from '../services/cropMatch';
import { formatDate } from '../services/dateFormat';
import { isCropUndetermined, type FarmingSeason } from '../types/season';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { Crop } from '../types/crop';
import type { RelatedParty } from '../types/party';
import { WORK_PHASE_META, type FieldWork, type Material, type WorkEntry, type WorkPhase, type WorkTemplate, type WorkType } from '../types/fieldWork';
import { FieldWorkEntryDialog } from './FieldWorkEntryDialog';
import { AddFieldWorkDialog } from './AddFieldWorkDialog';

interface Option {
  id: string;
  name: string;
}

interface FieldWorksBoardProps {
  year: number;
  onSelectYear: (year: number) => void;
  availableYears: number[];
  seasons: FarmingSeason[];
  masterFields: MasterField[];
  crops: Crop[];
  parties: RelatedParty[];
  vehicles: Option[];
  implementsList: Option[];
  onOpenWorkRegister: () => void;
}

type KindFilter = 'all' | 'winter' | 'spring' | 'none';

interface Row {
  fieldSeasonId: number;
  field: MasterField;
  rec: FieldYearlyRecord;
  crop: Crop | null;
  undetermined: boolean;
  works: FieldWork[];
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');
const fmtHa = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 2 });
const fmtNum = (n: number | null | undefined, unit: string) =>
  n == null ? null : `${n.toLocaleString('et-EE', { maximumFractionDigits: 2 })} ${unit}`;
const fieldNum = (f: MasterField) => {
  const n = parseFloat(String(f.num ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const STATUS_LABEL = { PLANNED: 'Planeeritud', IN_PROGRESS: 'Töös', DONE: 'Lõpetatud' } as const;
const FINANCE_LABEL = { PENDING: 'Ootab finantsi', CONFIRMED: 'Finants kinnitatud', CHANGED: 'Muudetud – kinnita uuesti' } as const;

// Kaardi alumine rida: kanded / kordused / plaan
function workSummary(w: FieldWork): string {
  if (w.status === 'DONE' && w.repeatMode === 'ONCE') return w.finishedAt ? formatDate(w.finishedAt) : 'Lõpetatud';
  const n = w.entries.length;
  if (w.repeatMode !== 'ONCE') return `↻ ${n}/${w.plannedCount}`;
  if (n > 0) {
    const ha = w.entries.reduce((s, e) => s + (e.areaHa ?? 0), 0);
    return `${n} ${n === 1 ? 'kanne' : 'kannet'}${ha > 0 ? ` · ${fmtHa(ha)} ha` : ''}`;
  }
  return w.plannedText || 'planeerimata';
}

const StatusIcon: React.FC<{ status: FieldWork['status'] }> = ({ status }) =>
  status === 'DONE' ? <Check size={13} strokeWidth={3} className="fw-status-done" /> : <span className={`fw-status-dot ${status === 'IN_PROGRESS' ? 'doing' : ''}`} />;

const WorkCard: React.FC<{ work: FieldWork; selected: boolean; onSelect: () => void }> = ({ work, selected, onSelect }) => (
  <button
    type="button"
    className={`fw-card ${work.status.toLowerCase()} ${selected ? 'selected' : ''}`}
    onClick={onSelect}
    aria-label={`${work.workTypeName}, ${STATUS_LABEL[work.status].toLowerCase()}`}
  >
    <span className="fw-card-title">
      <StatusIcon status={work.status} />
      <span>{work.workTypeName}</span>
    </span>
    <span className={`fw-card-sub ${work.repeatMode !== 'ONCE' ? 'repeat' : ''}`}>{workSummary(work)}</span>
  </button>
);

export const FieldWorksBoard: React.FC<FieldWorksBoardProps> = ({
  year,
  onSelectYear,
  availableYears,
  seasons,
  masterFields,
  crops,
  parties,
  vehicles,
  implementsList,
  onOpenWorkRegister
}) => {
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [hideDone, setHideDone] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{ work: FieldWork; entry: WorkEntry | null } | null>(null);
  const [addDialog, setAddDialog] = useState<{ row: Row; phase: WorkPhase } | null>(null);
  const [busy, setBusy] = useState(false);

  const season = seasons.find((s) => s.year === year);
  const locked = season?.isLocked ?? false;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFieldWorks(await api.getFieldWorks(year));
    } catch (err) {
      alert(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void reload();
    setSelectedId(null);
  }, [reload]);

  // Põldude muutus (nt kultuuri valik registris) → server lisab malli; laeme tööd veidi hiljem uuesti.
  useEffect(() => {
    const t = setTimeout(() => void reload(), 800);
    return () => clearTimeout(t);
  }, [masterFields, reload]);

  useEffect(() => {
    Promise.all([api.getWorkTypes(), api.getWorkTemplates(), api.getMaterials()])
      .then(([w, t, m]) => {
        setWorkTypes(w);
        setTemplates(t);
        setMaterials(m);
      })
      .catch((err) => alert(errorText(err)));
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Hooaja põllud (operaatori filter tuleb masterFields kaudu)
  const allRows: Row[] = useMemo(() => {
    const byFs = new Map<number, FieldWork[]>();
    fieldWorks.forEach((w) => byFs.set(w.fieldSeasonId, [...(byFs.get(w.fieldSeasonId) ?? []), w]));
    return masterFields
      .map((field) => {
        const rec = field.history.find((h) => h.year === year);
        if (!rec?.fieldSeasonId) return null;
        return {
          fieldSeasonId: rec.fieldSeasonId,
          field,
          rec,
          crop: matchCrop(rec.crop, crops),
          undetermined: isCropUndetermined(rec.crop),
          works: (byFs.get(rec.fieldSeasonId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
        };
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => fieldNum(a.field) - fieldNum(b.field) || a.field.name.localeCompare(b.field.name, 'et'));
  }, [masterFields, fieldWorks, year, crops]);

  const rows = allRows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !`${r.field.num ?? ''} ${r.field.name} ${r.rec.crop} ${r.works.map((w) => w.workTypeName).join(' ')}`.toLowerCase().includes(q)) return false;
    if (kind === 'none') return r.undetermined;
    if (kind === 'winter') return r.crop?.isWinterCrop === true;
    if (kind === 'spring') return !!r.crop && r.crop.isWinterCrop !== true;
    return true;
  });

  const visibleWorks = (r: Row, phase: WorkPhase) => r.works.filter((w) => w.phase === phase && (!hideDone || w.status !== 'DONE'));
  const withoutWorks = allRows.filter((r) => r.works.length === 0 && !r.undetermined);

  const selected = fieldWorks.find((w) => w.id === selectedId) ?? null;
  const selectedRow = selected ? allRows.find((r) => r.fieldSeasonId === selected.fieldSeasonId) ?? null : null;

  const templateIdsFor = (row: Row) => {
    const t = (row.crop && templates.find((x) => x.cropId === row.crop!.id)) || templates.find((x) => x.cropId === null);
    return new Set(t?.items.map((i) => i.workTypeId) ?? []);
  };
  const fieldLabel = (row: Row) =>
    `Nr ${row.field.num ?? '–'} ${row.field.name} · ${row.undetermined ? 'kultuur valimata' : row.rec.crop} · ${fmtHa(row.rec.areaHa)} ha · hooaeg ${year}`;

  const workers = parties.filter((p) => p.roles.includes('DRIVER')).map((p) => ({ id: p.id, name: p.name }));

  const applyTemplates = (list: Row[]) => {
    if (!list.length) return;
    const msg = list.length === 1
      ? `Lisa põllule "${list[0].field.name}" tööd kultuuri mallist (või üldmallist)?`
      : `Lisa ${list.length} tööta põllule tööd kultuuri mallist (või üldmallist)?`;
    if (!confirm(msg)) return;
    void run(() => api.applyWorkTemplate(list.map((r) => r.fieldSeasonId)));
  };

  const deleteEntry = (e: WorkEntry) => {
    if (!confirm(`Kas soovid kindlasti kustutada kande ${formatDate(e.date)}?`)) return;
    void run(() => api.deleteWorkEntry(e.id));
  };
  const removeWork = (w: FieldWork) => {
    if (!confirm(`Kas soovid kindlasti eemaldada töö "${w.workTypeName}" sellelt põllult?`)) return;
    void run(async () => {
      await api.deleteFieldWork(w.id);
      setSelectedId(null);
    });
  };

  // Veergude kokkuvõtted
  const countPhase = (phase: WorkPhase) => {
    const ws = allRows.flatMap((r) => r.works.filter((w) => w.phase === phase));
    return `${ws.length} tööd · ${ws.filter((w) => w.status === 'DONE').length} lõpetatud`;
  };
  const withCrop = allRows.filter((r) => !r.undetermined).length;
  const milestoneCount = (phase: WorkPhase) =>
    `${allRows.filter((r) => r.works.some((w) => w.phase === phase && w.status === 'DONE')).length} / ${withCrop} põldu`;

  const renderCards = (row: Row, phase: WorkPhase) =>
    visibleWorks(row, phase).map((w) => <WorkCard key={w.id} work={w} selected={w.id === selectedId} onSelect={() => setSelectedId(w.id)} />);

  const renderMilestone = (row: Row, phase: WorkPhase) => {
    const ws = row.works.filter((w) => w.phase === phase);
    if (ws.length === 0) return <span className="fw-muted">–</span>;
    return ws.map((w) =>
      w.status === 'DONE' ? (
        <button key={w.id} type="button" className={`fw-milestone-done ${w.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(w.id)} title={w.workTypeName}>
          <Check size={12} strokeWidth={3} /> {w.finishedAt ? formatDate(w.finishedAt) : 'Lõpetatud'}
        </button>
      ) : (
        <WorkCard key={w.id} work={w} selected={w.id === selectedId} onSelect={() => setSelectedId(w.id)} />
      )
    );
  };

  const sownDone = (row: Row) => row.works.some((w) => w.phase === 'SOWING' && w.status === 'DONE');

  return (
    <div className="fw-board-view">
      <main className="fw-main">
        <div className="fw-toolbar">
          <h1>Põllutööd</h1>
          <span className="fw-season-label">
            {year}. a hooaeg · {allRows.length} põldu{locked && <><Lock size={12} /> lukus</>}
          </span>
          <div className="fw-year-pills">
            {availableYears.map((y) => {
              const s = seasons.find((x) => x.year === y);
              return (
                <button key={y} type="button" className={y === year ? 'active' : ''} onClick={() => onSelectYear(y)}>
                  {y}
                  {s?.isLocked && <Lock size={10} />}
                </button>
              );
            })}
          </div>
          <div className="fw-toolbar-spacer" />
          <label className="fw-search">
            <Search size={14} />
            <input type="search" placeholder="Otsi põldu või tööd" aria-label="Otsi põldu või tööd" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="fw-filter">
            <span>Kultuur</span>
            <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
              <option value="all">Kõik</option>
              <option value="winter">Talivili</option>
              <option value="spring">Suvivili</option>
              <option value="none">Kultuur valimata</option>
            </select>
          </label>
          <label className="fw-filter checkbox">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            <span>Peida lõpetatud tööd</span>
          </label>
          {!locked && withoutWorks.length > 0 && (
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => applyTemplates(withoutWorks)}>
              <ListChecks size={14} />
              <span>Lisa mall tööta põldudele ({withoutWorks.length})</span>
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onOpenWorkRegister}>Tööde register</button>
        </div>

        <div className="fw-board" aria-busy={loading}>
          <div className="fw-grid fw-head">
            <div className="fw-head-cell">PÕLD</div>
            <div className="fw-head-cell phase"><strong>Ettevalmistus</strong><small>{countPhase('PREPARATION')}</small></div>
            <div className="fw-head-cell milestone sow"><strong><Sprout size={14} /> Külvatud</strong><small>{milestoneCount('SOWING')}</small></div>
            <div className="fw-head-cell phase"><strong>Hooldus</strong><small>{countPhase('CARE')}</small></div>
            <div className="fw-head-cell milestone harvest"><strong><Wheat size={14} /> Koristatud</strong><small>{milestoneCount('HARVEST')}</small></div>
          </div>

          {rows.length === 0 && (
            <div className="fw-empty">{allRows.length === 0 ? `${year}. a hooajal pole põlde.` : 'Filtrile vastavaid põlde pole.'}</div>
          )}

          {rows.map((row) => {
            const color = row.crop?.color ?? (row.undetermined ? null : row.rec.cropColor);
            return (
              <div key={row.fieldSeasonId} className="fw-grid fw-row">
                <div className={`fw-field ${color ? 'has-crop' : ''}`} style={color ? ({ '--crop-color': color } as React.CSSProperties) : undefined}>
                  <div className="fw-field-title">
                    {row.field.num && <span className="field-num-badge">Nr {row.field.num}</span>}
                    <span className="fw-field-name" title={row.field.name}>{row.field.name}</span>
                  </div>
                  <div className="fw-field-sub">
                    <strong>{row.undetermined ? 'Kultuur valimata' : row.rec.crop}</strong>
                    <span>{fmtHa(row.rec.areaHa)} ha</span>
                  </div>
                  {row.crop && <div className="fw-field-kind">{row.crop.isWinterCrop ? 'Talivili · sügiskülv' : 'Suvivili · kevadkülv'}</div>}
                </div>

                <div className="fw-cell">
                  {row.undetermined && <span className="fw-muted">Kultuur valimata – tööde mall lisatakse kultuuri valimisel</span>}
                  {!row.undetermined && row.works.length === 0 && !locked && (
                    <button type="button" className="btn btn-secondary btn-xs" onClick={() => applyTemplates([row])}>
                      <ListChecks size={12} /> Lisa mall
                    </button>
                  )}
                  {renderCards(row, 'PREPARATION')}
                  {!locked && !row.undetermined && (
                    <button type="button" className="fw-add" aria-label="Lisa töö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'PREPARATION' })}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className={`fw-cell milestone sow ${sownDone(row) ? 'done' : ''}`}>{renderMilestone(row, 'SOWING')}</div>

                <div className={`fw-cell ${sownDone(row) ? '' : 'waiting'}`}>
                  {!sownDone(row) && visibleWorks(row, 'CARE').length === 0 && !row.undetermined && <span className="fw-muted">Algab pärast külvi</span>}
                  {renderCards(row, 'CARE')}
                  {!locked && !row.undetermined && (
                    <button type="button" className="fw-add" aria-label="Lisa hooldustöö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'CARE' })}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className="fw-cell milestone harvest">{renderMilestone(row, 'HARVEST')}</div>
              </div>
            );
          })}
        </div>

        <div className="fw-legend">
          <span><span className="fw-status-dot" /> Planeeritud</span>
          <span><span className="fw-status-dot doing" /> Töös</span>
          <span><Check size={12} strokeWidth={3} className="fw-status-done" /> Lõpetatud</span>
          <span><strong className="fw-repeat">↻</strong> Korduv töö (tehtud / plaanitud kordi)</span>
        </div>
      </main>

      {selected && selectedRow && (
        <aside className="fw-panel" aria-label="Valitud töö">
          <div className="fw-panel-head">
            <div className="fw-panel-top">
              <span className="fw-panel-phase" style={{ color: WORK_PHASE_META[selected.phase].color }}>{WORK_PHASE_META[selected.phase].label.toUpperCase()}</span>
              <button type="button" className="icon-btn-ghost" aria-label="Sulge" onClick={() => setSelectedId(null)}>
                <X size={16} />
              </button>
            </div>
            <h2>{selected.workTypeName}</h2>
            <div className="fw-panel-field">{fieldLabel(selectedRow)}</div>
          </div>

          <div className="fw-panel-body">
            <div className="fw-panel-status">
              <span className={`fw-status-pill ${selected.status.toLowerCase()}`}>{STATUS_LABEL[selected.status]}</span>
              <span className="fw-muted">
                {selected.status === 'PLANNED' && 'Esimene kanne muudab töö olekuks „Töös“.'}
                {selected.status === 'IN_PROGRESS' && 'Töö on pooleli, kuni see märgitakse lõpetatuks.'}
                {selected.status === 'DONE' && `Lõpetatud ${selected.finishedAt ? formatDate(selected.finishedAt) : ''}`}
              </span>
            </div>

            <div className="fw-panel-grid">
              <label>
                <span>Planeeritud</span>
                <input
                  key={`${selected.id}-planned`}
                  className="form-input"
                  defaultValue={selected.plannedText ?? ''}
                  placeholder="nt okt 2026"
                  disabled={locked}
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== (selected.plannedText ?? null)) void run(() => api.updateFieldWork(selected.id, { plannedText: v }));
                  }}
                />
              </label>
              {selected.repeatMode !== 'ONCE' && (
                <label>
                  <span>Plaanitud kordi</span>
                  <input
                    key={`${selected.id}-count`}
                    className="form-input"
                    type="number"
                    min={1}
                    defaultValue={selected.plannedCount}
                    disabled={locked}
                    onBlur={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      if (v !== selected.plannedCount) void run(() => api.updateFieldWork(selected.id, { plannedCount: v }));
                    }}
                  />
                </label>
              )}
            </div>

            {selected.repeatMode === 'ONCE' && selectedRow.rec.areaHa > 0 && (() => {
              const done = selected.entries.reduce((s, e) => s + (e.areaHa ?? 0), 0);
              const pct = Math.min(100, Math.round((done / selectedRow.rec.areaHa) * 100));
              return (
                <div className="fw-panel-progress">
                  <div className="fw-panel-progress-head"><span>Tehtud pindala</span><strong>{fmtHa(done)} / {fmtHa(selectedRow.rec.areaHa)} ha ({pct}%)</strong></div>
                  <div className="work-progress-bar"><div style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })()}

            <div className="fw-panel-entries-head">
              <span>Kanded</span>
              <span className="fw-muted">{selected.entries.length || ''}</span>
            </div>
            {selected.entries.length === 0 && (
              <div className="fw-panel-empty">Kandeid pole. Lisa iga tööpäeva kohta kanne koos kulunud aja ja materjalidega.</div>
            )}
            {selected.entries.map((e) => (
              <div key={e.id} className="fw-entry">
                <div className="fw-entry-head">
                  <strong>{formatDate(e.date)}{e.occurrenceNo ? ` · ${e.occurrenceNo}. kord` : ''}</strong>
                  <span>{e.areaHa ? `${fmtHa(e.areaHa)} ha` : ''}</span>
                </div>
                <div className="fw-entry-line">{[e.workerName, [e.vehicleName, e.implementName].filter(Boolean).join(' + ')].filter(Boolean).join(' · ') || '–'}</div>
                <div className="fw-entry-line muted">
                  {[
                    fmtNum(e.laborHours, 'h tööaeg'),
                    fmtNum(e.equipmentHours, 'h masin'),
                    fmtNum(e.fuelLiters, 'l kütust'),
                    ...e.materials.map((m) => `${m.name} ${m.quantity.toLocaleString('et-EE')} ${m.unit}`),
                    fmtNum(e.harvestTonnes, 't saaki')
                  ].filter(Boolean).join(' · ') || 'kogused sisestamata'}
                </div>
                <div className="fw-entry-foot">
                  <span className={`fw-finance-chip ${e.financeStatus.toLowerCase()}`}>{FINANCE_LABEL[e.financeStatus]}</span>
                  {!locked && (
                    <span className="fw-entry-actions">
                      <button type="button" className="icon-btn-ghost" title="Muuda kannet" aria-label="Muuda kannet" onClick={() => setEntryDialog({ work: selected, entry: e })}>
                        <Edit2 size={14} />
                      </button>
                      <button type="button" className="icon-btn-danger" title="Kustuta kanne" aria-label="Kustuta kanne" onClick={() => deleteEntry(e)}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!locked && (
              <button type="button" className="btn btn-secondary fw-add-entry" onClick={() => setEntryDialog({ work: selected, entry: null })}>
                <Plus size={14} />
                <span>Lisa kanne…</span>
              </button>
            )}
          </div>

          {!locked && (
            <div className="fw-panel-foot">
              {selected.status === 'DONE' ? (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(() => api.updateFieldWork(selected.id, { status: 'REOPEN' }))}>
                  <RotateCcw size={14} />
                  <span>Ava uuesti</span>
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={busy} title="Töö on tehtud – rohkem kandeid ei oodata" onClick={() => void run(() => api.updateFieldWork(selected.id, { status: 'DONE' }))}>
                  <Check size={14} />
                  <span>Märgi lõpetatuks</span>
                </button>
              )}
              <button
                type="button"
                className="icon-btn-danger"
                title={selected.entries.length ? 'Kannetega tööd ei saa eemaldada' : 'Eemalda töö põllult'}
                aria-label="Eemalda töö põllult"
                disabled={busy || selected.entries.length > 0}
                onClick={() => removeWork(selected)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </aside>
      )}

      {entryDialog && selectedRow && (
        <FieldWorkEntryDialog
          work={entryDialog.work}
          entry={entryDialog.entry}
          fieldLabel={fieldLabel(selectedRow)}
          fieldAreaHa={selectedRow.rec.areaHa}
          workers={workers}
          vehicles={vehicles}
          implementsList={implementsList}
          materials={materials}
          onClose={() => setEntryDialog(null)}
          onSaved={() => {
            setEntryDialog(null);
            void reload();
          }}
        />
      )}

      {addDialog && (
        <AddFieldWorkDialog
          fieldSeasonId={addDialog.row.fieldSeasonId}
          fieldLabel={fieldLabel(addDialog.row)}
          workTypes={workTypes}
          existing={addDialog.row.works}
          templateWorkTypeIds={templateIdsFor(addDialog.row)}
          initialPhase={addDialog.phase}
          onClose={() => setAddDialog(null)}
          onSaved={() => {
            setAddDialog(null);
            void reload();
          }}
        />
      )}
    </div>
  );
};
