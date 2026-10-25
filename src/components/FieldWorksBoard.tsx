// src/components/FieldWorksBoard.tsx — põllutööde tahvel (põhivaade kaardi kõrval).
// Read = hooaja põllud; veerud kalendriaasta järgi: eelmine aasta (sügistööd) → käesolev aasta → järgmine aasta (sügistööd).
// Sügisplokk: Ettevalmistus · Sügiskülv · Sügishooldus (jaotus külvi kuupäeva järgi, vt fieldWorksBoardColumns).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Lock, Calendar, SquareKanban, Check, X, Edit2, Pencil, Trash2, RotateCcw, ListChecks, Sprout, Wheat, Euro, Info, ChevronDown, ChevronRight, Crosshair } from 'lucide-react';
import { api } from '../services/api';
import { matchCrop, isWinterCrop } from '../services/cropMatch';
import { getCropColor } from '../services/cropColors';
import { formatDate, formatDayMonth } from '../services/dateFormat';
import { isCropUndetermined, type FarmingSeason } from '../types/season';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { Crop } from '../types/crop';
import type { RelatedParty } from '../types/party';
import { WORK_PHASE_META, type FieldWork, type Material, type WorkEntry, type WorkPhase, type WorkType } from '../types/fieldWork';
import { FieldWorkEntryDialog } from './FieldWorkEntryDialog';
import { FieldWorkPlanForm } from './FieldWorkPlanForm';
import { AddFieldWorkDialog } from './AddFieldWorkDialog';
import { FinanceModal } from './FinanceModal';
import { FieldShapeModal } from './FieldShapeModal';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { PRIA_ACTIVITIES } from '../services/pria';
import { autumnColumns, boardColumns, type AutumnColumn, type BoardColumn } from '../services/fieldWorksBoardColumns';

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
  canManageFinance?: boolean;
  telemetryEnabled?: boolean;
}

interface Row {
  fieldSeasonId: number;
  field: MasterField;
  rec: FieldYearlyRecord;
  crop: Crop | null;
  cropColor: string | null;
  undetermined: boolean;
  isWinter: boolean;
  works: FieldWork[];
  carriedFromYear: number | null;
  prevRec: FieldYearlyRecord | null;
  nextRec: FieldYearlyRecord | null;
  nextCrop: Crop | null;
  nextCropName: string | null;
  nextCropColor: string | null;
  nextIsWinter: boolean;
  nextUndetermined: boolean;
  nextWorks: FieldWork[];
  allNextWorks: FieldWork[];
  columns: Map<string, BoardColumn>; // käesoleva hooaja tööde veerud
  nextColumns: Map<string, AutumnColumn>; // järgmise hooaja sügistööde veerud
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');
const fmtHa = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 2 });
const fmtNum = (n: number | null | undefined, unit: string) =>
  n == null ? null : `${n.toLocaleString('et-EE', { maximumFractionDigits: 2 })} ${unit}`;
function compareFieldNumbers(a: { num?: string | null; name: string }, b: { num?: string | null; name: string }): number {
  const numA = (a.num ?? '').trim();
  const numB = (b.num ?? '').trim();
  if (numA && numB) {
    const cmp = numA.localeCompare(numB, 'et', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  } else if (numA && !numB) {
    return -1;
  } else if (!numA && numB) {
    return 1;
  }
  return a.name.localeCompare(b.name, 'et');
}

const STATUS_LABEL = { PLANNED: 'Planeeritud', IN_PROGRESS: 'Töös', DONE: 'Lõpetatud' } as const;
const FINANCE_LABEL = { PENDING: 'Ootab finantsi', CONFIRMED: 'Finants kinnitatud', CHANGED: 'Muudetud – kinnita uuesti' } as const;

const StatusIcon: React.FC<{ status: FieldWork['status'] }> = ({ status }) =>
  status === 'DONE' ? <Check size={13} strokeWidth={3} className="fw-status-done" /> : <span className={`fw-status-dot ${status === 'IN_PROGRESS' ? 'doing' : ''}`} />;

const WorkCard: React.FC<{ work: FieldWork; fieldAreaHa: number; selected: boolean; onSelect: () => void }> = ({ work, fieldAreaHa, selected, onSelect }) => {
  const n = work.entries.length;
  // Tehtud osa põllust
  const doneHa = work.entries.reduce((sum, e) => sum + (e.areaHa ?? 0), 0);
  const donePct = fieldAreaHa > 0 && doneHa > 0
    ? Math.min(100, Math.round((doneHa / fieldAreaHa) * 100))
    : null;

  const sortedEntries = useMemo(() => {
    return [...work.entries].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      return 0;
    });
  }, [work.entries]);

  return (
    <button
      type="button"
      className={`fw-card ${work.status.toLowerCase()} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-label={`${work.workTypeName}, ${STATUS_LABEL[work.status].toLowerCase()}`}
    >
      <span className="fw-card-title">
        <StatusIcon status={work.status} />
        <span title={work.priaName}>{work.workTypeName}</span>
      </span>
      {/* Viis (nt väetamisviis) eraldi real, et pealkiri ei läheks kaardist laiemaks */}
      {work.method && <span className="fw-card-method">{work.method}</span>}
      {n > 0 ? (
        <span className="fw-card-entries">
          {sortedEntries.map((e) => {
            const dateStr = formatDayMonth(e.date);
            const timeStr = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : (e.startTime || e.endTime || null);
            const haStr = e.areaHa ? `${fmtHa(e.areaHa)} ha` : null;
            const workerFirstName = e.workerName ? e.workerName.trim().split(/\s+/)[0] : null;

            return (
              <span key={e.id} className="fw-card-entry">
                <span className="fw-card-entry-primary">
                  {dateStr}{timeStr ? ` · ${timeStr}` : ''}
                </span>
                {(haStr || workerFirstName) && (
                  <span className="fw-card-entry-secondary">
                    {[haStr, workerFirstName].filter(Boolean).join(' · ')}
                    {/* Ühe kande korral protsent sama rea lõpus */}
                    {n === 1 && donePct !== null && <span className="fw-card-pct">{donePct}%</span>}
                  </span>
                )}
              </span>
            );
          })}
          {/* Mitme kande korral kokkuvõte: tehtud / põllu pindala ja protsent */}
          {n > 1 && (
            <span className="fw-card-total">
              Kokku {fmtHa(doneHa)} / {fmtHa(fieldAreaHa)} ha
              {donePct !== null && <span className="fw-card-pct">{donePct}%</span>}
            </span>
          )}
        </span>
      ) : (
        <span className="fw-card-sub">
          {work.status === 'DONE'
            ? (work.finishedAt ? `Lõpetatud ${formatDayMonth(work.finishedAt)}` : 'Lõpetatud')
            : (work.plannedDateFrom ? formatDayMonth(work.plannedDateFrom) : work.plannedText || 'planeerimata')}
        </span>
      )}
    </button>
  );
};

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
  onOpenWorkRegister,
  canManageFinance = false,
  telemetryEnabled = true
}) => {
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<string>('all'); // töötüübi id või 'all'
  const [hideDone, setHideDone] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [entryDialog, setEntryDialog] = useState<{ work: FieldWork; entry: WorkEntry | null } | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [addDialog, setAddDialog] = useState<{ row: Row; phase: WorkPhase; isNextCrop?: boolean; plannedText?: string } | null>(null);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [financeEntryId, setFinanceEntryId] = useState<string | null>(null);
  const [shapeView, setShapeView] = useState<{ field: MasterField; record: FieldYearlyRecord } | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!selectedId || entryDialog || isFinanceOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Plaani muutmisel katkestab esimene Esc muutmise, järgmine sulgeb akna
        if (editingPlan) setEditingPlan(false);
        else setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, entryDialog, isFinanceOpen, editingPlan]);

  // Teise töö valimisel või akna sulgemisel lõpeb plaani muutmine
  useEffect(() => {
    setEditingPlan(false);
  }, [selectedId]);

  const pendingFinanceCount = useMemo(() => {
    return fieldWorks
      .flatMap((w) => w.entries)
      .filter((e) => e.financeStatus === 'PENDING' || e.financeStatus === 'CHANGED').length;
  }, [fieldWorks]);

  const season = seasons.find((s) => s.year === year);
  const locked = season?.isLocked ?? false;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFieldWorks(await api.getFieldWorks(year));
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void reload();
    setSelectedId(null);
  }, [reload]);

  // Põldude muutus (nt kultuuri valik või põllu kustutamine registris) → laeme tööd veidi hiljem uuesti.
  // Esmalaadimine on ülal; siin ainult päris muutus pärast seda (mitte esimene renderdus ega
  // põldude esmakordne saabumine käivitusel, mil eelmine loend oli tühi). Aasta vahetus laeb ülal.
  const prevMasterFieldsRef = useRef(masterFields);
  useEffect(() => {
    const prev = prevMasterFieldsRef.current;
    prevMasterFieldsRef.current = masterFields;
    if (prev === masterFields || prev.length === 0) return;
    const t = setTimeout(() => void reload(), 800);
    return () => clearTimeout(t);
  }, [masterFields, reload]);

  useEffect(() => {
    Promise.all([api.getWorkTypes(), api.getMaterials()])
      .then(([w, m]) => {
        setWorkTypes(w);
        setMaterials(m);
      })
      .catch((err) => alertDialog(errorText(err)));
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Hooaja põllud (operaatori filter tuleb masterFields kaudu)
  const allRows: Row[] = useMemo(() => {
    const byFs = new Map<number, FieldWork[]>();
    fieldWorks.forEach((w) => byFs.set(w.fieldSeasonId, [...(byFs.get(w.fieldSeasonId) ?? []), w]));
    return masterFields
      .map((field): Row | null => {
        const rec = field.history.find((h) => h.year === year);
        if (!rec?.fieldSeasonId) return null;
        const works = (byFs.get(rec.fieldSeasonId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
        const carriedWork = works.find((w) => !!w.carriedOverFromYear);
        const prevRec = field.history.find((h) => h.year === year - 1) ?? null;
        const prevIsWinter = prevRec ? isWinterCrop(prevRec.crop, crops) : false;

        const cropName = isCropUndetermined(rec.crop) && prevIsWinter && prevRec?.crop ? prevRec.crop : rec.crop;
        const crop = matchCrop(cropName, crops);
        const cropColor = isCropUndetermined(rec.crop) && prevIsWinter && prevRec?.cropColor
          ? prevRec.cropColor
          : (crop?.color || rec.cropColor || (cropName ? getCropColor(cropName) : null));
        const currentIsWinter = isWinterCrop(cropName, crops);

        const carriedFromYear: number | null = carriedWork?.carriedOverFromYear ?? (currentIsWinter ? year - 1 : null);
        const undetermined = isCropUndetermined(cropName);
        const isWinter = !undetermined && (currentIsWinter || !!carriedWork);

        // Järgmise aasta kultuur (sügiskülvi tuletamiseks)
        const nextRec = field.history.find((h) => h.year === year + 1) ?? null;
        const nextCropName = nextRec?.crop ?? null;
        const nextCrop = nextCropName ? matchCrop(nextCropName, crops) : null;
        const nextCropColor = nextCrop?.color || nextRec?.cropColor || (nextCropName ? getCropColor(nextCropName) : null);
        const nextUndetermined = !nextRec || isCropUndetermined(nextCropName);
        const nextIsWinter = !nextUndetermined && isWinterCrop(nextCropName, crops);
        const allNextWorks = nextRec?.fieldSeasonId
          ? (byFs.get(nextRec.fieldSeasonId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
          : [];
        // Server saadab järgmisest hooajast ainult selle aasta sügistööd
        const nextWorks = allNextWorks.filter((w) => w.phase !== 'HARVEST');

        return {
          fieldSeasonId: rec.fieldSeasonId,
          field,
          rec: { ...rec, crop: cropName, cropColor: cropColor ?? rec.cropColor ?? '#eab308' },
          crop,
          cropColor,
          undetermined,
          isWinter,
          works,
          carriedFromYear,
          prevRec,
          nextRec,
          nextCrop,
          nextCropName,
          nextCropColor,
          nextIsWinter,
          nextUndetermined,
          nextWorks,
          allNextWorks,
          columns: boardColumns(works, year, isWinter),
          nextColumns: autumnColumns(nextWorks)
        };
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => compareFieldNumbers(a.field, b.field));
  }, [masterFields, fieldWorks, year, crops]);

  // Tegevuse filter: ühtne eeldus, mida kasutavad kõik veeruabifunktsioonid
  const workMatches = (w: FieldWork) => activity === 'all' || w.workTypeId === activity;

  // Tahvlil olevad tegevused (käesolevad + järgmise hooaja sügistööd), PRIA järjekorras
  const activityOptions = useMemo(() => {
    const byId = new Map<string, FieldWork>();
    allRows.forEach((r) => [...r.works, ...r.nextWorks].forEach((w) => { if (!byId.has(w.workTypeId)) byId.set(w.workTypeId, w); }));
    const priaIndex = (w: FieldWork) => {
      const i = PRIA_ACTIVITIES.findIndex((a) => a.name === (w.priaCode ?? w.priaName));
      return i < 0 ? 999 : i;
    };
    return Array.from(byId.values())
      .sort((a, b) => priaIndex(a) - priaIndex(b) || a.workTypeName.localeCompare(b.workTypeName, 'et'))
      .map((w) => ({ id: w.workTypeId, name: w.workTypeName }));
  }, [allRows]);

  // Aasta vahetusel lähtesta filter, kui valitud tegevust enam pole
  useEffect(() => {
    if (activity !== 'all' && !loading && !activityOptions.some((o) => o.id === activity)) setActivity('all');
  }, [activity, activityOptions, loading]);

  const rows = allRows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !`${r.field.num ?? ''} ${r.field.name} ${r.rec.crop} ${r.nextCropName ?? ''} ${r.works.map((w) => w.workTypeName).join(' ')} ${r.nextWorks.map((w) => w.workTypeName).join(' ')}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (activity !== 'all' && !r.works.some(workMatches) && !r.nextWorks.some(workMatches)) return false;
    return true;
  });

  const groups = useMemo(() => {
    const winterRows: Row[] = [];
    const springRows: Row[] = [];
    const undeterminedRows: Row[] = [];

    rows.forEach((r) => {
      if (r.nextUndetermined) {
        undeterminedRows.push(r);
      } else if (r.nextIsWinter) {
        winterRows.push(r);
      } else {
        springRows.push(r);
      }
    });

    const res: {
      key: 'winter' | 'spring' | 'undetermined';
      title: string;
      description: string;
      className: string;
      rows: Row[];
      totalHa: number;
    }[] = [];

    if (winterRows.length > 0) {
      res.push({
        key: 'winter',
        title: 'Sügiskülviga põllud',
        description: `Põllud, kus järgmise (${year + 1}) aasta kultuuriks on talivili ja külv toimub ${year}. a sügisel`,
        className: 'winter',
        rows: winterRows,
        totalHa: winterRows.reduce((sum, r) => sum + (r.rec.areaHa || 0), 0)
      });
    }

    if (springRows.length > 0) {
      res.push({
        key: 'spring',
        title: 'Sügiskülvita põllud',
        description: `Põllud, kus järgmise (${year + 1}) aasta kultuuriks on suvivili ja ${year}. a sügisel külvi ei toimu`,
        className: 'spring',
        rows: springRows,
        totalHa: springRows.reduce((sum, r) => sum + (r.rec.areaHa || 0), 0)
      });
    }

    if (undeterminedRows.length > 0) {
      res.push({
        key: 'undetermined',
        title: 'Järgmine kultuur valimata',
        description: `${year + 1}. a kultuur pole veel külvikorras valitud`,
        className: 'undetermined',
        rows: undeterminedRows,
        totalHa: undeterminedRows.reduce((sum, r) => sum + (r.rec.areaHa || 0), 0)
      });
    }

    return res;
  }, [rows, year]);

  // Käesoleva hooaja tööd tahvli veeru kaupa (eelmise aasta sügistööd eraldi veergudes)
  const columnWorks = (r: Row, col: BoardColumn) => r.works.filter((w) => r.columns.get(w.id) === col && workMatches(w));
  const visibleWorks = (r: Row, col: BoardColumn) => columnWorks(r, col).filter((w) => !hideDone || w.status !== 'DONE');

  const selected = fieldWorks.find((w) => w.id === selectedId) ?? null;
  const selectedRow = selected
    ? allRows.find((r) => r.fieldSeasonId === selected.fieldSeasonId || r.nextRec?.fieldSeasonId === selected.fieldSeasonId) ?? null
    : null;

  const fieldLabel = (row: Row) =>
    `Nr ${row.field.num ?? '–'} ${row.field.name} · ${row.undetermined ? 'kultuur valimata' : row.rec.crop} · ${fmtHa(row.rec.areaHa)} ha · hooaeg ${year}`;

  const workers = parties.filter((p) => p.roles.includes('DRIVER')).map((p) => ({ id: p.id, name: p.name }));

  const deleteEntry = async (e: WorkEntry) => {
    if (!await confirmDialog(`Kas soovid kindlasti kustutada kande ${formatDate(e.date)}?`)) return;
    void run(() => api.deleteWorkEntry(e.id));
  };
  const removeWork = async (w: FieldWork) => {
    if (!await confirmDialog(`Kas soovid kindlasti eemaldada töö "${w.workTypeName}" sellelt põllult?`)) return;
    void run(async () => {
      await api.deleteFieldWork(w.id);
      setSelectedId(null);
    });
  };

  // Nähtavad tööd sellel real (käesoleva hooaja tööd, sh eelmise aasta sügistööd, ja järgmise aasta sügistööd)
  const getRowVisibleWorks = (r: Row): FieldWork[] => {
    return [...r.works, ...r.nextWorks];
  };

  const hasAnyEntries = (r: Row) =>
    r.works.some((w) => (w.entries?.length ?? 0) > 0) || r.nextWorks.some((w) => (w.entries?.length ?? 0) > 0);

  const hasCurrentEntries = (r: Row) =>
    r.works.some((w) => (w.entries?.length ?? 0) > 0);

  const hasNextEntries = (r: Row) =>
    r.nextWorks.some((w) => (w.entries?.length ?? 0) > 0);

  const clearCurrentCropWorks = async (r: Row) => {
    if (hasCurrentEntries(r)) {
      alertDialog(`Põllu "${r.field.name}" kultuuri töödel on juba kandeid. Kandeid omavaid töid ei saa eemaldada.`);
      return;
    }
    const cropName = r.undetermined ? 'valimata kultuur' : r.rec.crop;
    const count = r.works.length;
    if (!await confirmDialog(`Kas soovid kindlasti eemaldada põllult "${r.field.name}" kultuuri "${cropName}" tööd (${count} tk)?`)) return;
    void run(async () => {
      await api.clearFieldWorks(r.fieldSeasonId);
      if (selectedRow?.fieldSeasonId === r.fieldSeasonId && selected && r.works.some((w) => w.id === selected.id)) {
        setSelectedId(null);
      }
    });
  };

  const clearNextCropWorks = async (r: Row) => {
    if (!r.nextRec?.fieldSeasonId) return;
    if (hasNextEntries(r)) {
      alertDialog(`Põllu "${r.field.name}" järgmise kultuuri töödel on juba kandeid. Kandeid omavaid töid ei saa eemaldada.`);
      return;
    }
    const count = r.nextWorks.length;
    const nextName = r.nextCropName || 'järgmine kultuur';
    if (!await confirmDialog(`Kas soovid kindlasti eemaldada põllult "${r.field.name}" järgmise kultuuri "${nextName}" sügistööd (${count} tk)?`)) return;
    void run(async () => {
      // Kustutatakse täpselt sügisplokis kuvatud tööd (ka sügishooldus)
      await api.clearFieldWorks(r.nextRec!.fieldSeasonId!, undefined, undefined, r.nextWorks.map((w) => w.id));
      if (selectedRow?.fieldSeasonId === r.fieldSeasonId && selected && r.nextWorks.some((w) => w.id === selected.id)) {
        setSelectedId(null);
      }
    });
  };

  const clearFieldWorks = async (r: Row) => {
    if (hasAnyEntries(r)) {
      alertDialog(`Põllu "${r.field.name}" töödel on juba kandeid. Kandeid omavaid töid ei saa eemaldada.`);
      return;
    }
    const visibleCount = getRowVisibleWorks(r).length;
    if (!await confirmDialog(`Kas soovid kindlasti eemaldada põllult "${r.field.name}" kõik tööd (${visibleCount} tk)?`)) return;
    void run(async () => {
      await api.clearFieldWorks(r.fieldSeasonId, r.nextRec?.fieldSeasonId ?? null);
      if (selectedRow?.fieldSeasonId === r.fieldSeasonId) setSelectedId(null);
    });
  };

  // Veergude kokkuvõtted
  const countPhase = (col: BoardColumn) => {
    const ws = rows.flatMap((r) => columnWorks(r, col));
    return `${ws.length} tööd · ${ws.filter((w) => w.status === 'DONE').length} lõpetatud`;
  };
  const withCrop = rows.filter((r) => !r.undetermined).length;
  const milestoneCount = (col: BoardColumn) =>
    `${rows.filter((r) => columnWorks(r, col).some((w) => w.status === 'DONE')).length} / ${withCrop} põldu`;
  // Kevadkülv: ainult kevadist külvi vajavad põllud (talivili on külvatud eelmisel sügisel)
  const springSowRows = rows.filter((r) => !r.undetermined && !r.isWinter);
  const springSowCount = () =>
    `${springSowRows.filter((r) => columnWorks(r, 'SOWING').some((w) => w.status === 'DONE')).length} / ${springSowRows.length} põldu`;
  // Eelmise aasta sügiskülv: käesoleva hooaja talivilja põllud
  const prevWinterRows = rows.filter((r) => r.isWinter);
  const prevSownDone = (r: Row) =>
    columnWorks(r, 'PREV_SOWING').some((w) => w.phase === 'SOWING' && (w.status === 'DONE' || w.entries.length > 0));
  const prevMilestoneCount = () =>
    `${prevWinterRows.filter(prevSownDone).length} / ${prevWinterRows.length} talivilja`;

  // Järgmise hooaja sügistööd sügisploki veeru kaupa
  const nextColumnWorks = (r: Row, col: AutumnColumn) => r.nextWorks.filter((w) => r.nextColumns.get(w.id) === col && workMatches(w));
  const countNextPhase = (col: AutumnColumn) => {
    const ws = rows.flatMap((r) => nextColumnWorks(r, col));
    return `${ws.length} tööd · ${ws.filter((w) => w.status === 'DONE').length} lõpetatud`;
  };
  const nextWinterRows = rows.filter((r) => r.nextIsWinter);
  const nextMilestoneCount = () =>
    `${nextWinterRows.filter((r) => nextColumnWorks(r, 'SOWING').some((w) => w.status === 'DONE')).length} / ${nextWinterRows.length || 1} talivilja`;

  const renderCards = (row: Row, col: BoardColumn) =>
    visibleWorks(row, col).map((w) => <WorkCard key={w.id} work={w} fieldAreaHa={row.rec.areaHa} selected={w.id === selectedId} onSelect={() => setSelectedId(w.id)} />);

  // Verstapost (külv/koristus) on alati nähtav; eelmise sügise hooldustööd selles veerus järgivad filtrit
  const renderMilestone = (row: Row, col: BoardColumn) => {
    const ws = columnWorks(row, col).filter((w) => (w.phase !== 'CARE') || !hideDone || w.status !== 'DONE');
    if (ws.length === 0) return <span className="fw-muted">–</span>;
    return ws.map((w) => (
      <WorkCard key={w.id} work={w} fieldAreaHa={row.rec.areaHa} selected={w.id === selectedId} onSelect={() => setSelectedId(w.id)} />
    ));
  };

  const visibleNextWorks = (r: Row, col: AutumnColumn) =>
    nextColumnWorks(r, col).filter((w) => !hideDone || w.status !== 'DONE');

  const renderNextCards = (row: Row, col: AutumnColumn) =>
    visibleNextWorks(row, col).map((w) => (
      <WorkCard key={w.id} work={w} fieldAreaHa={row.nextRec?.areaHa ?? row.rec.areaHa} selected={w.id === selectedId} onSelect={() => setSelectedId(w.id)} />
    ));

  const renderNextMilestone = (row: Row) => {
    const ws = nextColumnWorks(row, 'SOWING');
    if (ws.length === 0) return <span className="fw-muted">–</span>;
    return ws.map((w) => (
      <WorkCard key={w.id} work={w} fieldAreaHa={row.nextRec?.areaHa ?? row.rec.areaHa} selected={w.id === selectedId} onSelect={() => setSelectedId(w.id)} />
    ));
  };

  const sownDone = (row: Row) => {
    if (row.carriedFromYear) {
      const sowWork = row.works.find((w) => w.phase === 'SOWING');
      return sowWork ? sowWork.status === 'DONE' || sowWork.entries.length > 0 : false;
    }
    return row.works.some((w) => w.phase === 'SOWING' && (w.status === 'DONE' || !!w.carriedOverFromYear));
  };

  const nextSownDone = (row: Row) => {
    return nextColumnWorks(row, 'SOWING').some((w) => w.status === 'DONE');
  };

  return (
    <div className="fw-board-view">
      <main className="fw-main">
        <div className="fullpage-board-header">
          <div className="fullpage-title-wrap">
            <SquareKanban className="text-emerald" size={26} />
            <div>
              <h2>Põllutööd</h2>
              <p className="fullpage-subtitle">Põldude tööd hooaja kaupa: külv, hooldus ja koristus, kanded ning edenemine</p>
            </div>
          </div>
        </div>

        <div className="fw-toolbar">
          {/* Hooaja valik ja tegevused samas reas nagu Põldude registris */}
          <div className="year-selector-group">
            <span className="year-label">
              <Calendar size={15} className="text-blue" />
              <span>Hooaeg:</span>
            </span>
            <div className="year-tabs">
              {availableYears.map((y) => {
                const isLocked = seasons.find((x) => x.year === y)?.isLocked ?? false;
                return (
                  <button
                    key={y}
                    type="button"
                    className={`year-tab ${y === year ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                    onClick={() => onSelectYear(y)}
                    title={`${y}. a hooaeg ${isLocked ? '(Suletud muudatusteks)' : '(Aktiivne)'}`}
                  >
                    <span>{y}</span>
                    {isLocked && <Lock size={10} className="tab-lock-icon" />}
                  </button>
                );
              })}
            </div>
            <div className="register-io-buttons">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenWorkRegister} title="Ava tööde register: tööd ja kulumaterjalid">
                <ListChecks size={14} />
                <span>Tööde register</span>
              </button>
              {canManageFinance && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setFinanceEntryId(null);
                    setIsFinanceOpen(true);
                  }}
                  title="Põllutööde finantsid ja kuluarvestus"
                >
                  <Euro size={14} />
                  <span>Finantsid</span>
                  {pendingFinanceCount > 0 && <span className="finance-tab-badge">{pendingFinanceCount}</span>}
                </button>
              )}
            </div>
          </div>

        </div>

        <div className="register-actions-bar">
          <div className="search-box-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Otsi põldu või tööd"
              aria-label="Otsi põldu või tööd"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input search-input"
            />
          </div>
          <label className="fw-filter">
            <span>Tegevus</span>
            <select className="form-input" value={activity} onChange={(e) => setActivity(e.target.value)}>
              <option value="all">Kõik tegevused</option>
              {activityOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label className="fw-filter checkbox fw-filter-end">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            <span>Peida lõpetatud tööd</span>
          </label>
        </div>

        <div className="fw-board" aria-busy={loading}>
          <div className="fw-head">
            <div className="fw-grid fw-head-top">
              <div className="fw-head-section">PÕLD</div>
              <div className="fw-head-section prev" style={{ gridColumn: '2 / 5' }}>
                <span>EELMINE AASTA {year - 1}</span>
              </div>
              <div className="fw-head-section current" style={{ gridColumn: '5 / 9' }}>
                <span>KÄESOLEV AASTA {year}</span>
              </div>
              <div className="fw-head-section next" style={{ gridColumn: '9 / 12' }}>
                <span>JÄRGMINE AASTA {year + 1}</span>
              </div>
            </div>
            <div className="fw-grid fw-head-cols">
              <div className="fw-head-cell">
                <strong>{rows.length} {rows.length === 1 ? 'põld' : 'põldu'}</strong>
              </div>
              <div className="fw-head-cell phase">
                <strong>Ettevalmistus</strong>
                <small>{countPhase('PREV_PREPARATION')}</small>
              </div>
              <div className="fw-head-cell milestone prev-sow">
                <strong><Sprout size={14} /> Sügiskülv</strong>
                <small>{prevMilestoneCount()}</small>
              </div>
              <div className="fw-head-cell phase">
                <strong>Sügishooldus</strong>
                <small>{countPhase('PREV_CARE')}</small>
              </div>
              <div className="fw-head-cell phase year-start">
                <strong>Ettevalmistus</strong>
                <small>{countPhase('PREPARATION')}</small>
              </div>
              <div className="fw-head-cell milestone sow">
                <strong><Sprout size={14} /> Kevadkülv</strong>
                <small>{springSowCount()}</small>
              </div>
              <div className="fw-head-cell phase">
                <strong>Hooldamine</strong>
                <small>{countPhase('CARE')}</small>
              </div>
              <div className="fw-head-cell milestone harvest">
                <strong><Wheat size={14} /> Koristus</strong>
                <small>{milestoneCount('HARVEST')}</small>
              </div>
              <div className="fw-head-cell phase year-start">
                <strong>Ettevalmistus</strong>
                <small>{countNextPhase('PREP')}</small>
              </div>
              <div className="fw-head-cell milestone autumn-sow">
                <strong><Sprout size={14} /> Sügiskülv</strong>
                <small>{nextMilestoneCount()}</small>
              </div>
              <div className="fw-head-cell phase">
                <strong>Sügishooldus</strong>
                <small>{countNextPhase('CARE')}</small>
              </div>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="fw-empty">{allRows.length === 0 ? `${year}. a hooajal pole põlde.` : 'Filtrile vastavaid põlde pole.'}</div>
          )}

          {groups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.key];

            return (
              <React.Fragment key={group.key}>
                <div
                  className={`fw-group-header ${group.className}`}
                  onClick={() => toggleGroup(group.key)}
                  title={`${group.description}. Klõpsa grupi peitmiseks või avamiseks.`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(group.key);
                    }
                  }}
                >
                  <div className="fw-group-toggle">
                    {isCollapsed ? <ChevronRight size={16} className="fw-group-chevron" /> : <ChevronDown size={16} className="fw-group-chevron" />}
                    <span className="fw-group-title">{group.title}</span>
                  </div>

                </div>

                {!isCollapsed &&
                  group.rows.map((row) => {
                    const color = row.crop?.color ?? (row.undetermined ? null : row.cropColor);
                    const nextColor = row.nextCrop?.color ?? (row.nextUndetermined ? null : row.nextCropColor);
                    const fieldNextClass = row.nextIsWinter
                      ? 'winter-next'
                      : !row.nextUndetermined
                        ? 'spring-next'
                        : 'undetermined-next';

                    return (
                      <div key={row.fieldSeasonId} className="fw-row-container">
                        {/* 1. Põllu info (taustavärvitud vastavalt sügiskülvi / järgmise kultuuri staatusele) */}
                        <div
                          className={`fw-field ${fieldNextClass}`}
                          style={{
                            gridColumn: '1 / 2',
                            gridRow: '1 / 3'
                          }}
                        >
                          {/* Põllu kuju nupp lahtri paremas ülanurgas */}
                          <button
                            type="button"
                            className="fw-field-shape-btn corner"
                            title={`Näita ${year}. a põllu kuju`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShapeView({ field: row.field, record: row.rec });
                            }}
                          >
                            <Crosshair size={13} />
                          </button>
                          <div className="fw-field-title">
                            {row.field.num && <span className="field-num-badge">Nr {row.field.num}</span>}
                            <span className="fw-field-name" title={row.field.name}>{row.field.name}</span>
                          </div>
                          <div className="fw-field-sub">
                            <span className="fw-field-ha">{fmtHa(row.rec.areaHa)} ha</span>
                          </div>
                        </div>

                        {/* Rida 1: Käesoleva hooaja kultuuri päis (eelmise aasta sügis + käesolev aasta, Cols 2-8) */}
                        <div
                          className="fw-crop-banner current"
                          style={{
                            gridColumn: '2 / 9',
                            gridRow: '1 / 2',
                            ...(color ? ({ '--crop-color': color } as React.CSSProperties) : {})
                          }}
                        >
                          <div className="fw-crop-banner-main">
                            <span className="fw-crop-name">{row.undetermined ? 'Kultuur valimata' : row.rec.crop}</span>
                          </div>
                          {!locked && row.works.length > 0 && !hasCurrentEntries(row) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs fw-crop-delete-btn"
                              title={`Eemalda kultuuri "${row.undetermined ? 'valimata' : row.rec.crop}" tööd (${row.works.length} tk)`}
                              aria-label="Kustuta plaanitud tööd"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                clearCurrentCropWorks(row);
                              }}
                            >
                              <Trash2 size={11} style={{ color: '#dc2626' }} />
                              <span>Kustuta plaanitud tööd</span>
                            </button>
                          )}
                        </div>

                        {/* Rida 1: Järgmise kultuuri päis (Cols 9-11) */}
                        {!row.nextUndetermined ? (
                          <div
                            className="fw-crop-banner next"
                            style={{
                              gridColumn: '9 / 12',
                              gridRow: '1 / 2',
                              ...(nextColor ? ({ '--next-crop-color': nextColor } as React.CSSProperties) : {})
                            }}
                          >
                            <div className="fw-crop-banner-main">
                              <span className="fw-crop-name">{row.nextCropName}</span>
                            </div>
                            {!locked && row.nextWorks.length > 0 && !hasNextEntries(row) && row.nextRec?.fieldSeasonId && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs fw-crop-delete-btn"
                                title={`Eemalda järgmise kultuuri "${row.nextCropName}" sügistööd (${row.nextWorks.length} tk)`}
                                aria-label="Kustuta plaanitud tööd"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearNextCropWorks(row);
                                }}
                              >
                                <Trash2 size={11} style={{ color: '#dc2626' }} />
                                <span>Kustuta plaanitud tööd</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="fw-crop-banner next undetermined" style={{ gridColumn: '9 / 12', gridRow: '1 / 2' }}>
                            <span className="fw-crop-name muted">Järgmine kultuur määramata</span>
                          </div>
                        )}

                        {/* Rida 2: Eelmise aasta sügistööd (Cols 2-4) */}
                        {/* Col 2: Eelmise aasta ettevalmistus (nt sügiskünd) */}
                        <div className="fw-cell prev" style={{ gridColumn: '2 / 3', gridRow: '2 / 3' }}>
                          {row.undetermined && <span className="fw-muted">Kultuur valimata</span>}
                          {renderCards(row, 'PREV_PREPARATION')}
                          {!locked && !row.undetermined && (
                            <button type="button" className="fw-add" aria-label="Lisa töö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'PREPARATION', plannedText: `Sügis ${year - 1}` })}>
                              <Plus size={13} />
                            </button>
                          )}
                        </div>

                        {/* Col 3: Eelmise aasta sügiskülv */}
                        {row.isWinter ? (
                          <div className={`fw-cell milestone prev-sow ${prevSownDone(row) ? 'done' : ''}`} style={{ gridColumn: '3 / 4', gridRow: '2 / 3' }}>
                            {renderMilestone(row, 'PREV_SOWING')}
                            {!locked && !row.undetermined && (
                              <button type="button" className="fw-add" aria-label="Lisa töö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'SOWING', plannedText: `Sügis ${year - 1}` })}>
                                <Plus size={13} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="fw-cell fw-cell-no-sow" style={{ gridColumn: '3 / 4', gridRow: '2 / 3' }}>
                            {columnWorks(row, 'PREV_SOWING').length > 0
                              ? renderMilestone(row, 'PREV_SOWING')
                              : <span className="fw-muted" title="Suvivili – sügiskülvi ei toimunud">—</span>}
                          </div>
                        )}

                        {/* Col 4: Eelmise aasta sügishooldus (pärast sügiskülvi, nt herbitsiid taliviljal) */}
                        <div className="fw-cell prev" style={{ gridColumn: '4 / 5', gridRow: '2 / 3' }}>
                          {renderCards(row, 'PREV_CARE')}
                          {!locked && !row.undetermined && (
                            <button type="button" className="fw-add" aria-label="Lisa töö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'CARE', plannedText: `Sügis ${year - 1}` })}>
                              <Plus size={13} />
                            </button>
                          )}
                        </div>

                        {/* Rida 2: Käesoleva aasta tööd (Cols 5-8) */}
                        {/* Col 5: Ettevalmistus */}
                        <div className="fw-cell" style={{ gridColumn: '5 / 6', gridRow: '2 / 3' }}>
                          {row.undetermined && <span className="fw-muted">Kultuur valimata</span>}
                          {renderCards(row, 'PREPARATION')}
                          {!locked && !row.undetermined && (
                            <button type="button" className="fw-add" aria-label="Lisa töö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'PREPARATION' })}>
                              <Plus size={13} />
                            </button>
                          )}
                        </div>

                        {/* Col 6: Kevadkülv (talivili on külvatud eelmisel sügisel) */}
                        {row.isWinter && columnWorks(row, 'SOWING').length === 0 ? (
                          <div className="fw-cell fw-cell-no-sow" style={{ gridColumn: '6 / 7', gridRow: '2 / 3' }}>
                            <span className="fw-muted" title={`Talivili – külv ${year - 1}. a sügisel`}>—</span>
                          </div>
                        ) : (
                          <div
                            className={`fw-cell milestone sow ${columnWorks(row, 'SOWING').some((w) => w.status === 'DONE') ? 'done' : ''}`}
                            style={{ gridColumn: '6 / 7', gridRow: '2 / 3' }}
                          >
                            {renderMilestone(row, 'SOWING')}
                            {!locked && !row.undetermined && (
                              <button
                                type="button"
                                className="fw-add"
                                aria-label="Lisa töö"
                                title="Lisa töö"
                                onClick={() => setAddDialog({ row, phase: 'SOWING' })}
                              >
                                <Plus size={13} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Col 7: Hooldus */}
                        <div className={`fw-cell ${sownDone(row) ? '' : 'waiting'}`} style={{ gridColumn: '7 / 8', gridRow: '2 / 3' }}>
                          {renderCards(row, 'CARE')}
                          {!locked && !row.undetermined && (
                            <button type="button" className="fw-add" aria-label="Lisa töö" title="Lisa töö" onClick={() => setAddDialog({ row, phase: 'CARE' })}>
                              <Plus size={13} />
                            </button>
                          )}
                        </div>

                        {/* Col 8: Koristus */}
                        <div className="fw-cell milestone harvest" style={{ gridColumn: '8 / 9', gridRow: '2 / 3' }}>
                          {renderMilestone(row, 'HARVEST')}
                          {!locked && !row.undetermined && (
                            <button
                              type="button"
                              className="fw-add"
                              aria-label="Lisa töö"
                              title="Lisa töö"
                              onClick={() => setAddDialog({ row, phase: 'HARVEST' })}
                            >
                              <Plus size={13} />
                            </button>
                          )}
                        </div>

                        {/* Rida 2: Järgmise kultuuri sügistööd (Cols 9-11) */}
                        {!row.nextUndetermined ? (
                          <>
                            {/* Col 9: Sügise ettevalmistus (nii tali- kui ka suviviljadel, nt sügiskünd) */}
                            <div className="fw-cell" style={{ gridColumn: '9 / 10', gridRow: '2 / 3' }}>
                              {renderNextCards(row, 'PREP')}
                              {!locked && row.nextRec?.fieldSeasonId && (
                                <button
                                  type="button"
                                  className="fw-add"
                                  aria-label="Lisa töö"
                                  title="Lisa töö"
                                  onClick={() => setAddDialog({ row, phase: 'PREPARATION', isNextCrop: true, plannedText: `Sügis ${year}` })}
                                >
                                  <Plus size={13} />
                                </button>
                              )}
                            </div>

                            {/* Col 10: Sügiskülv (ainult taliviljal; suviviljal ei toimu sügisel külvi) */}
                            {row.nextIsWinter ? (
                              <div className={`fw-cell milestone autumn-sow ${nextSownDone(row) ? 'done' : ''}`} style={{ gridColumn: '10 / 11', gridRow: '2 / 3' }}>
                                {renderNextMilestone(row)}
                                {!locked && row.nextRec?.fieldSeasonId && (
                                  <button
                                    type="button"
                                    className="fw-add"
                                    aria-label="Lisa töö"
                                    title="Lisa töö"
                                    onClick={() => setAddDialog({ row, phase: 'SOWING', isNextCrop: true, plannedText: `Sügis ${year}` })}
                                  >
                                    <Plus size={13} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="fw-cell fw-cell-no-sow" style={{ gridColumn: '10 / 11', gridRow: '2 / 3' }}>
                                {nextColumnWorks(row, 'SOWING').length > 0
                                  ? renderNextMilestone(row)
                                  : <span className="fw-muted" title="Suvivili – sügiskülvi ei toimu">—</span>}
                              </div>
                            )}

                            {/* Col 11: Sügishooldus (järgmise kultuuri hooldus pärast sügiskülvi) */}
                            <div className="fw-cell" style={{ gridColumn: '11 / 12', gridRow: '2 / 3' }}>
                              {renderNextCards(row, 'CARE')}
                              {!locked && row.nextRec?.fieldSeasonId && (
                                <button
                                  type="button"
                                  className="fw-add"
                                  aria-label="Lisa töö"
                                  title="Lisa töö"
                                  onClick={() => setAddDialog({ row, phase: 'CARE', isNextCrop: true, plannedText: `Sügis ${year}` })}
                                >
                                  <Plus size={13} />
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="fw-cell fw-cell-next-none" style={{ gridColumn: '9 / 12', gridRow: '2 / 3' }}>
                            <span className="fw-muted">Järgmine kultuur määramata</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </React.Fragment>
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

      {selected && selectedRow && createPortal(
        (() => {
          const isSelectedNext = selected.isNextSeasonWinterSowing || (selectedRow.nextRec?.fieldSeasonId === selected.fieldSeasonId);
          const activeLabel = isSelectedNext
            ? `Nr ${selectedRow.field.num ?? '–'} ${selectedRow.field.name} · ${selectedRow.nextCropName ?? 'Talivili'} (Sügiskülv ${year}, saak ${year + 1}) · ${fmtHa(selectedRow.nextRec?.areaHa ?? selectedRow.rec.areaHa)} ha`
            : fieldLabel(selectedRow);
          const activeArea = isSelectedNext ? (selectedRow.nextRec?.areaHa ?? selectedRow.rec.areaHa) : selectedRow.rec.areaHa;

          return (
            <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
              <div
                className="modal-content animate-scale-up fw-work-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Valitud töö"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="fw-panel-head">
                  <div className="fw-panel-top">
                    <span className="fw-panel-phase" style={{ color: WORK_PHASE_META[selected.phase].color }}>{WORK_PHASE_META[selected.phase].label.toUpperCase()}</span>
                    <button type="button" className="icon-btn-ghost" aria-label="Sulge (Esc)" title="Sulge (Esc)" onClick={() => setSelectedId(null)}>
                      <X size={18} />
                    </button>
                  </div>
                  <h2 title={selected.priaName}>{selected.workTypeName}</h2>
                  <div className="fw-panel-field">{activeLabel}</div>
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

                  {selected.isNextSeasonWinterSowing && (
                    <div className="alert-box info finance-alert">
                      <Info size={14} />
                      <span>See on {year}. a sügisene ettevalmistus/külv järgmise hooaja ({year + 1}) taliviljale {selectedRow.nextCropName ?? ''}.</span>
                    </div>
                  )}
                  {selected.carriedOverFromYear && (
                    <div className="alert-box info finance-alert">
                      <Info size={14} />
                      <span>See külvitöö teostati eelmise aasta ({selected.carriedOverFromYear}) sügisel ja see on üle kantud käesolevasse hooaega.</span>
                    </div>
                  )}
                  {selected.carriedOverToYear && !selected.isNextSeasonWinterSowing && (
                    <div className="alert-box info finance-alert">
                      <Info size={14} />
                      <span>See töö kuulub talivilja {selected.carriedOverToYear}. a saagiaasta tsüklisse ning teostatakse {selected.carriedOverToYear}. a hooajal.</span>
                    </div>
                  )}

                  <section className="fw-plan-section">
                    <div className="fw-plan-section-head">
                      <span>Plaan</span>
                      {!locked && !editingPlan && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingPlan(true)}>
                          <Pencil size={13} />
                          <span>Muuda</span>
                        </button>
                      )}
                    </div>
                    <FieldWorkPlanForm
                      key={selected.id}
                      fieldSeasonId={selected.fieldSeasonId}
                      fieldAreaHa={activeArea}
                      work={selected}
                      workTypes={workTypes}
                      materials={materials}
                      workers={workers}
                      mode={editingPlan && !locked ? 'edit' : 'view'}
                      onSaved={() => {
                        setEditingPlan(false);
                        void reload();
                      }}
                      onCancel={() => setEditingPlan(false)}
                    />
                  </section>

                  {activeArea > 0 && (() => {
                    const done = selected.entries.reduce((s, e) => s + (e.areaHa ?? 0), 0);
                    const pct = Math.min(100, Math.round((done / activeArea) * 100));
                    return (
                      <div className="fw-panel-progress">
                        <div className="fw-panel-progress-head"><span>Tehtud pindala</span><strong>{fmtHa(done)} / {fmtHa(activeArea)} ha ({pct}%)</strong></div>
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
                        <strong>
                          {formatDate(e.date)}
                          {e.startTime && e.endTime ? ` · ${e.startTime}–${e.endTime}` : ''}
                        </strong>
                        <span>
                          {e.areaHa ? `${fmtHa(e.areaHa)} ha` : ''}
                          {e.telemetryAreaHa ? <small style={{ marginLeft: 6, color: 'var(--text-secondary)' }}>({fmtHa(e.telemetryAreaHa)} ha GPS)</small> : null}
                        </span>
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
                        {canManageFinance ? (
                          <button
                            type="button"
                            className={`fw-finance-chip clickable ${e.financeStatus.toLowerCase()}`}
                            title="Ava kande finants ja määra ühikuhinnad"
                            onClick={() => {
                              setFinanceEntryId(e.id);
                              setIsFinanceOpen(true);
                            }}
                          >
                            <Euro size={10} />
                            <span>{FINANCE_LABEL[e.financeStatus]}</span>
                          </button>
                        ) : (
                          <span className={`fw-finance-chip ${e.financeStatus.toLowerCase()}`}>{FINANCE_LABEL[e.financeStatus]}</span>
                        )}
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
                      <Plus size={13} />
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

                {!locked && !hasAnyEntries(selectedRow) && getRowVisibleWorks(selectedRow).length > 1 && (
                  <div className="fw-panel-clear-wrap">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs fw-panel-clear-btn"
                      disabled={busy}
                      onClick={() => clearFieldWorks(selectedRow)}
                    >
                      <Trash2 size={12} />
                      <span>Eemalda kõik selle põllu tööd ({getRowVisibleWorks(selectedRow).length})</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {entryDialog && selectedRow && (() => {
        const isNext = entryDialog.work.isNextSeasonWinterSowing || (selectedRow.nextRec?.fieldSeasonId === entryDialog.work.fieldSeasonId);
        const activeLabel = isNext
          ? `Nr ${selectedRow.field.num ?? '–'} ${selectedRow.field.name} · ${selectedRow.nextCropName ?? 'Talivili'} (Sügiskülv ${year}, saak ${year + 1})`
          : fieldLabel(selectedRow);
        const activeArea = isNext ? (selectedRow.nextRec?.areaHa ?? selectedRow.rec.areaHa) : selectedRow.rec.areaHa;

        return (
          <FieldWorkEntryDialog
            work={entryDialog.work}
            entry={entryDialog.entry}
            fieldLabel={activeLabel}
            fieldAreaHa={activeArea}
            workers={workers}
            vehicles={vehicles}
            implementsList={implementsList}
            materials={materials}
            telemetryEnabled={telemetryEnabled}
            onClose={() => setEntryDialog(null)}
            onSaved={() => {
              setEntryDialog(null);
              void reload();
            }}
          />
        );
      })()}

      {addDialog && (
        <AddFieldWorkDialog
          fieldSeasonId={addDialog.isNextCrop && addDialog.row.nextRec?.fieldSeasonId ? addDialog.row.nextRec.fieldSeasonId : addDialog.row.fieldSeasonId}
          fieldLabel={addDialog.isNextCrop
            ? `Nr ${addDialog.row.field.num ?? '–'} ${addDialog.row.field.name} · ${addDialog.row.nextCropName ?? 'kultuur'} · Saak ${year + 1} (sügistööd ${year})`
            : fieldLabel(addDialog.row)
          }
          workTypes={workTypes}
          existing={addDialog.isNextCrop ? addDialog.row.allNextWorks : addDialog.row.works}
          initialPhase={addDialog.phase}
          initialPlannedText={addDialog.plannedText}
          allowedPhases={
            addDialog.isNextCrop
              ? (addDialog.row.nextIsWinter ? ['PREPARATION', 'SOWING', 'CARE'] : ['PREPARATION', 'CARE'])
              : undefined
          }
          onClose={() => setAddDialog(null)}
          onSaved={() => {
            setAddDialog(null);
            void reload();
          }}
        />
      )}

      {isFinanceOpen && (
        <FinanceModal
          isOpen={isFinanceOpen}
          onClose={() => {
            setIsFinanceOpen(false);
            setFinanceEntryId(null);
          }}
          year={year}
          initialEntryId={financeEntryId}
          onEntryUpdated={reload}
        />
      )}

      {shapeView && (
        <FieldShapeModal
          field={shapeView.field}
          record={shapeView.record}
          baseMap="maaamet-pohikaart"
          onClose={() => setShapeView(null)}
        />
      )}
    </div>
  );
};
