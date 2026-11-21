// src/components/FieldWorksBoard.tsx — põllutööde tahvel (põhivaade kaardi kõrval).
// Read = hooaja põllud; veerud kalendriaasta järgi: eelmine aasta (sügistööd) → käesolev aasta → järgmine aasta (sügistööd).
// Sügisplokk: Ettevalmistus · Sügiskülv · Sügishooldus (jaotus külvi kuupäeva järgi, vt fieldWorksBoardColumns).
import { DEFAULT_CROP_COLOR, UNDETERMINED_CROP_COLOR } from '../lib/dataColors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Lock, Calendar, SquareKanban, Check, Edit2, Pencil, Trash2, RotateCcw, ListChecks, Sprout, Wheat, Euro, Info, ChevronDown, ChevronRight, Crosshair } from 'lucide-react';
import { api } from '../services/api';
import { seasonRegistryCrop, isWinterSeason } from '../services/cropMatch';
import { getCropColor } from '../services/cropColors';
import { formatDate, formatDayMonth } from '../services/dateFormat';
import { formatQty } from '../services/units';
import { isCropUndetermined, type FarmingSeason } from '../types/season';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { Crop } from '../types/crop';
import type { RelatedParty } from '../types/party';
import { WORK_PHASE_META, FINANCE_STATUS_BADGE, type FieldWork, type Article, type WorkEntry, type WorkPhase, type WorkType } from '../types/fieldWork';
import { FieldWorkEntryDialog } from './FieldWorkEntryDialog';
import { FieldWorkPlanForm } from './FieldWorkPlanForm';
import { AddFieldWorkDialog } from './AddFieldWorkDialog';
import { FinanceModal } from './FinanceModal';
import { FieldShapeModal } from './FieldShapeModal';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { PRIA_ACTIVITIES } from '../services/pria';
import { autumnColumns, boardColumns, type AutumnColumn, type BoardColumn } from '../services/fieldWorksBoardColumns';
import { Alert, Badge, Button, Card, CardButton, Dialog, DialogContent, DialogHeader, DialogBody, ToggleGroup, ToggleGroupItem, type BadgeTone, type BadgeVariant, FilterClear, FilterSelect, SearchInput, CheckboxField, PageHeader, ProgressBar, cn, cornerActionClass, emptyBoxClass, subheadingClass } from './ui';
import { boardViewClass, boardMainClass, registerActionsBarClass, registerIoButtonsClass, yearSelectorGroupClass, yearLabelClass, phaseLabelClass } from './ui/variants';

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
  initialWorkId?: string | null; // mujalt (sõidu aknast) avatud töö
  onInitialWorkConsumed?: () => void;
  initialSearch?: string | null; // mujalt (kaardi põllukastist) antud otsing, rakendatakse ühe korra
  onInitialSearchConsumed?: () => void;
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

const NO_CROP = '__none__'; // kultuuri filtri väärtus valimata kultuuriga põldudele
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');
const fmtHa = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 2 });
const fmtNum = (n: number | null | undefined, unit: string) =>
  n == null ? null : `${n.toLocaleString('et-EE', { maximumFractionDigits: 2 })} ${unit}`;
const fmtQtyUnit = (n: number | null | undefined, unit: string) => (n == null ? null : `${formatQty(n)} ${unit}`);
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
const WORK_STATUS_TONE: Record<FieldWork['status'], { tone: BadgeTone; variant: BadgeVariant }> = {
  PLANNED: { tone: 'neutral', variant: 'soft' },
  IN_PROGRESS: { tone: 'success', variant: 'soft' },
  DONE: { tone: 'success', variant: 'solid' }
};
const FINANCE_LABEL = { PENDING: 'Ootab finantsi', CONFIRMED: 'Finants kinnitatud', CHANGED: 'Muudetud – kinnita uuesti' } as const;

/** Tahvli tühja lahtri „Lisa töö“ ruut (katkendjoon, hõljudes roheline). */
const AddWorkButton: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <Button variant="dashed" size="add-slot" aria-label="Lisa töö" title="Lisa töö" onClick={onAdd}>
    <Plus size={13} />
  </Button>
);

const MUTED = 'text-xs text-subtle leading-natural';
const STATUS_DOT = 'inline-block size-2.5 shrink-0 rounded-full border-2 border-subtle';
const STATUS_DOT_DOING = 'border-0 bg-primary ring-3 ring-primary-strong/20';

/** Staatuse märk: tühi ring (planeeritud), täidetud roheline (töös), linnuke (lõpetatud). `unplanned` värvib ringi ääre oranžiks. */
const StatusIcon: React.FC<{ status: FieldWork['status']; unplanned?: boolean }> = ({ status, unplanned }) =>
  status === 'DONE'
    ? <Check size={13} strokeWidth={3} className="shrink-0 text-success-text" />
    : <span className={cn(STATUS_DOT, status === 'IN_PROGRESS' && STATUS_DOT_DOING, unplanned && 'border-warning')} />;

// Planeerimata: kandeid pole ja plaan on tühi (aega, materjale, töötajat ega märkusi pole)
const isUnplanned = (w: FieldWork) =>
  w.status === 'PLANNED' && w.entries.length === 0 && !w.plannedDateFrom && !w.plannedDateTo && !w.plannedText &&
  w.lines.length === 0 && !w.plannedWorkerId && !w.notes;

// Tahvli ruudustik: põld 10%, ülejäänud 90% jagatud 10 tööveeru vahel (sama päisel ja igal real).
const BOARD_GRID = 'grid w-full grid-cols-[minmax(0,10fr)_repeat(10,minmax(0,9fr))]';
const BOARD_MIN_WIDTH = 'min-w-350'; // 1400px: kitsal ekraanil keritakse, põllu veerg jääb paigale

const PLACE = {
  headPrev: 'col-span-3 col-start-2',
  headCurrent: 'col-span-4 col-start-5',
  headNext: 'col-span-3 col-start-9',
  field: 'col-start-1 row-span-2 row-start-1',
  bannerCurrent: 'col-span-7 col-start-2 row-start-1',
  bannerNext: 'col-span-3 col-start-9 row-start-1',
  nextAll: 'col-span-3 col-start-9 row-start-2',
} as const;

const COL: Record<number, string> = {
  2: 'col-start-2 row-start-2', 3: 'col-start-3 row-start-2', 4: 'col-start-4 row-start-2', 5: 'col-start-5 row-start-2',
  6: 'col-start-6 row-start-2', 7: 'col-start-7 row-start-2', 8: 'col-start-8 row-start-2', 9: 'col-start-9 row-start-2',
  10: 'col-start-10 row-start-2', 11: 'col-start-11 row-start-2',
};

type CellTone = 'prev' | 'sow' | 'harvest' | 'prev-sow' | 'autumn-sow';
// Taust poolläbipaistev (nagu vana rgba), `done` tumedam. Verstaposti lahtris kaardid täislaiuses.
const CELL_TONE: Record<CellTone, { base: string; done: string }> = {
  prev: { base: 'bg-muted-foreground/4', done: 'bg-muted-foreground/4' },
  sow: { base: 'bg-primary-strong/5 [&>span]:max-w-full', done: 'bg-primary-strong/10 [&>span]:max-w-full' },
  harvest: { base: 'bg-warning-solid/6 [&>span]:max-w-full', done: 'bg-warning-solid/6 [&>span]:max-w-full' },
  'prev-sow': {
    base: 'bg-muted-foreground/8 dark:bg-muted-foreground/12 [&>span]:max-w-full',
    done: 'bg-muted-foreground/15 dark:bg-muted-foreground/20 [&>span]:max-w-full',
  },
  'autumn-sow': {
    base: 'bg-sky/8 dark:bg-sky/14 [&>span]:max-w-full',
    done: 'bg-sky/15 dark:bg-sky/22 [&>span]:max-w-full',
  },
};

/** Töölahter ruudustikus. `col` = veerg 2–11; `kind` „no-sow“ = külvi ei toimu (roheline, kesksel), „none“ = järgmine kultuur määramata. */
const BoardCell: React.FC<{ col?: number; place?: string; tone?: CellTone; done?: boolean; kind?: 'no-sow' | 'none'; children: React.ReactNode }> = ({ col, place, tone, done, kind, children }) => (
  <div className={cn(
    'flex min-w-0 flex-wrap content-start border-l border-border',
    kind ? 'items-center justify-center px-2.5 py-2' : 'items-start gap-1.5 px-2.5 py-2',
    kind === 'no-sow' && 'bg-card bg-linear-to-b from-primary-strong/9 to-primary-strong/9 dark:from-primary-strong/14 dark:to-primary-strong/14',
    kind === 'none' && 'bg-muted',
    tone && (done ? CELL_TONE[tone].done : CELL_TONE[tone].base),
    col != null && COL[col],
    place
  )}>{children}</div>
);

const CARD_STATUS: Record<string, string> = {
  planned: '',
  in_progress: 'border border-primary-strong hover:border-primary-strong',
  done: 'text-muted-foreground',
};
const CARD_UNPLANNED = 'border border-dashed border-warning bg-warning-solid/8 hover:border-warning-solid hover:bg-warning-solid/8';
/** Kustutusnupu hõljumine (plaanitud tööde kustutus ja „Eemalda kõik tööd“): sama toon kõigil. */
const DELETE_HOVER = 'enabled:hover:bg-destructive/12 enabled:hover:text-danger-text';
/** Töö paneeli kanderida: kitsas paneel (alla 560px) murrab rea kaheks, konteineri päring. */
const EntryRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="@container rounded-md border border-border bg-muted px-2.5 py-2">
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 gap-y-1.5 @max-[561px]:grid-cols-[auto_minmax(0,1fr)_auto]">{children}</div>
  </div>
);
const ENTRY_WHEN = 'flex flex-col gap-0.5 whitespace-nowrap';
const PCT = 'rounded-sm bg-primary-strong/12 px-1 text-2xs font-medium tabular-nums text-success-text';

type GroupTone = 'winter' | 'spring' | 'undetermined'; // = group.className ja fieldNextClass väärtused
const GROUP_TONE: Record<GroupTone, string> = {
  winter: 'bg-sky/9',
  spring: 'bg-primary-strong/9',
  undetermined: 'bg-muted-foreground/9',
};
// Põllu lahter on kleepuv (z-2): läbipaistmatu alus ja toon gradiendina, et kerides ei paistaks lahtrid läbi. Hõljumine rea kohal heledamaks.
const FIELD_TONE: Record<GroupTone, string> = {
  winter: 'bg-card bg-linear-to-b from-sky/9 to-sky/9 dark:from-sky/14 dark:to-sky/14 group-hover/row:from-sky/15 group-hover/row:to-sky/15',
  spring: 'bg-card bg-linear-to-b from-primary-strong/9 to-primary-strong/9 dark:from-primary-strong/14 dark:to-primary-strong/14 group-hover/row:from-primary-strong/15 group-hover/row:to-primary-strong/15',
  undetermined: 'bg-card bg-linear-to-b from-muted-foreground/9 to-muted-foreground/9 dark:from-muted-foreground/14 dark:to-muted-foreground/14 group-hover/row:from-muted-foreground/15 group-hover/row:to-muted-foreground/15',
};

/** Kultuuribänner: andmevärv (kultuuri värv) tõuseb inline stiili; kultuuri värv pärineb andmetest, mitte klassist. */
const cropBannerStyle = (color: string | null, tintPct: number): React.CSSProperties => {
  const c = color ?? UNDETERMINED_CROP_COLOR;
  return { background: `color-mix(in srgb, ${c} ${tintPct}%, var(--bg-surface))`, boxShadow: `inset 3px 0 0 ${c}` };
};

const HEAD_SECTION = 'flex min-w-0 items-center justify-between border-b border-border px-3 py-1.5 text-xs font-semibold uppercase leading-natural tracking-wider text-muted-foreground';

type HeadTone = 'sow' | 'harvest' | 'prev-sow' | 'autumn-sow';
const HEAD_TONE: Record<HeadTone, { bg: string; text: string }> = {
  sow: { bg: 'bg-primary-strong/8', text: 'text-success-text' },
  harvest: { bg: 'bg-warning-solid/10', text: 'text-warning-text' },
  'prev-sow': { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground' },
  'autumn-sow': { bg: 'bg-sky/8', text: 'text-info-text' },
};

/** Veerupäis: nimi + kokkuvõte. `first` = kleepuv põllu veerg, `yearStart` = paks aastavahe vasakul, `tone` = verstaposti toon. */
const HeadCell: React.FC<{ title: React.ReactNode; count?: string; tone?: HeadTone; yearStart?: boolean; first?: boolean }> = ({ title, count, tone, yearStart, first }) => (
  <div className={cn(
    'flex min-w-0 flex-col gap-0.5 px-2.5 py-2 text-2xs font-semibold leading-natural tracking-wider text-muted-foreground',
    first ? 'sticky left-0 z-2 border-r border-border bg-popover' : 'border-l border-border',
    yearStart && 'border-l-3 border-l-subtle',
    tone && HEAD_TONE[tone].bg
  )}>
    <strong className={cn('inline-flex items-center gap-1 text-base font-medium leading-natural tracking-normal text-foreground', tone && HEAD_TONE[tone].text)}>{title}</strong>
    {count != null && <small className="text-2xs font-medium leading-natural tracking-normal">{count}</small>}
  </div>
);

const WorkCard: React.FC<{ work: FieldWork; fieldAreaHa: number; selected: boolean; onSelect: () => void; onAddEntry?: () => void }> = ({ work, fieldAreaHa, selected, onSelect, onAddEntry }) => {
  const n = work.entries.length;
  const unplanned = isUnplanned(work);
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
    <span className="group/card relative flex max-w-45 flex-col">
      <CardButton
        variant="item"
        padding="none"
        selected={selected}
        className={cn('flex min-w-30 max-w-none flex-col gap-0.5 px-2 py-1.5', CARD_STATUS[work.status.toLowerCase()], unplanned && CARD_UNPLANNED)}
        onClick={onSelect}
        aria-label={`${work.workTypeName}, ${STATUS_LABEL[work.status].toLowerCase()}`}
      >
        <span className="flex items-center gap-1.5 pr-4 text-sm font-normal leading-natural">
          <StatusIcon status={work.status} unplanned={unplanned} />
          <span title={work.priaName}>{work.workTypeName}</span>
        </span>
        {/* Viis (nt väetamisviis) eraldi real, et pealkiri ei läheks kaardist laiemaks */}
        {work.method && <span className="text-2xs leading-natural text-muted-foreground">{work.method}</span>}
        {n > 0 ? (
          <span className="flex flex-col gap-0.5">
            {sortedEntries.map((e) => {
              const dateStr = formatDayMonth(e.date);
              const timeStr = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : (e.startTime || e.endTime || null);
              const haStr = e.areaHa ? `${fmtHa(e.areaHa)} ha` : null;
              const workerFirstName = e.workerName ? e.workerName.trim().split(/\s+/)[0] : null;

              return (
                <span key={e.id} className="flex flex-col gap-0.5 not-first:border-x-0 not-first:border-b-0 not-first:border-t not-first:border-dashed not-first:border-border not-first:pt-0.5">
                  <span className="text-2xs font-medium leading-tight text-foreground">
                    {dateStr}{timeStr ? ` · ${timeStr}` : ''}
                  </span>
                  {(haStr || workerFirstName) && (
                    <span className="text-2xs leading-tight tabular-nums text-muted-foreground">
                      {[haStr, workerFirstName].filter(Boolean).join(' · ')}
                      {/* Ühe kande korral protsent sama rea lõpus */}
                      {n === 1 && donePct !== null && <span className={cn(PCT, 'ml-1.5 leading-tight')}>{donePct}%</span>}
                    </span>
                  )}
                </span>
              );
            })}
            {/* Mitme kande korral kokkuvõte: tehtud / põllu pindala ja protsent */}
            {n > 1 && (
              <span className="mt-0.5 border-t border-border pt-0.5 text-2xs font-semibold leading-natural text-foreground">
                Kokku {fmtHa(doneHa)} / {fmtHa(fieldAreaHa)} ha
                {donePct !== null && <span className={cn(PCT, 'ml-1.5 leading-natural')}>{donePct}%</span>}
              </span>
            )}
          </span>
        ) : unplanned ? (
          <span className="self-start rounded-sm bg-warning-solid/18 px-1.5 py-0.5 text-2xs font-medium leading-natural text-warning-text">Planeerimata</span>
        ) : (
          <span className="text-2xs leading-natural text-muted-foreground">
            {work.status === 'DONE'
              ? (work.finishedAt ? `Lõpetatud ${formatDayMonth(work.finishedAt)}` : 'Lõpetatud')
              : (work.plannedDateFrom ? formatDayMonth(work.plannedDateFrom) : work.plannedText || (work.plannedDateTo ? `– ${formatDayMonth(work.plannedDateTo)}` : 'aeg määramata'))}
          </span>
        )}
      </CardButton>
      {/* Kande kiirlisamine otse kaardilt, ilma töö paneeli avamata */}
      {onAddEntry && (
        <Button variant="ghost" size="icon-xs" wrapperClassName="absolute top-1 right-1 opacity-60 group-hover/card:opacity-100" title="Lisa kanne" aria-label={`Lisa kanne: ${work.workTypeName}`} onClick={onAddEntry}>
          <Plus size={12} strokeWidth={2.5} />
        </Button>
      )}
    </span>
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
  telemetryEnabled = true,
  initialWorkId = null,
  onInitialWorkConsumed,
  initialSearch = null,
  onInitialSearchConsumed
}) => {
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedYear, setLoadedYear] = useState<number | null>(null); // aasta, mille tööde laadimine on lõppenud (ka veaga)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<string>('all'); // töötüübi id või 'all'
  const [cropFilter, setCropFilter] = useState<string>('all'); // kultuuri nimi, NO_CROP või 'all'
  const [hideDone, setHideDone] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [entryDialog, setEntryDialog] = useState<{ work: FieldWork; entry: WorkEntry | null } | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planBusy, setPlanBusy] = useState(false); // plaani salvestamine käib: Esc ei sulge
  const [addDialog, setAddDialog] = useState<{ row: Row; phase: WorkPhase; isNextCrop?: boolean; plannedText?: string } | null>(null);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [financeEntryId, setFinanceEntryId] = useState<string | null>(null);
  const [shapeView, setShapeView] = useState<{ field: MasterField; record: FieldYearlyRecord } | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };


  const pendingFinanceCount = useMemo(() => {
    return fieldWorks
      .flatMap((w) => w.entries)
      .filter((e) => e.financeStatus === 'PENDING' || e.financeStatus === 'CHANGED').length;
  }, [fieldWorks]);

  const season = seasons.find((s) => s.year === year);
  const locked = season?.isLocked ?? false;

  // Töö valimisel algab planeerimata töö kohe plaani muutmisega (lukus hooajal ei saa muuta)
  const selectWork = (w: FieldWork) => {
    setSelectedId(w.id);
    setEditingPlan(isUnplanned(w) && !locked);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFieldWorks(await api.getFieldWorks(year));
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setLoading(false);
      setLoadedYear(year);
    }
  }, [year]);

  useEffect(() => {
    void reload();
    setSelectedId(null);
  }, [reload]);

  // Mujalt antud otsing (nt kaardil valitud põld) kirjutatakse otsinguväljale ühe korra
  useEffect(() => {
    if (!initialSearch) return;
    setSearch(initialSearch);
    onInitialSearchConsumed?.();
  }, [initialSearch, onInitialSearchConsumed]);

  // Mujalt avatud töö valitakse, kui tööd on laetud (enne laadimist id-d loendis pole)
  useEffect(() => {
    if (!initialWorkId || loadedYear !== year) return;
    if (fieldWorks.some((w) => w.id === initialWorkId)) {
      // Tahvli enda filtrid ei tohi töö kaarti peita
      setSearch('');
      setActivity('all');
      setCropFilter('all');
      setHideDone(false);
      setSelectedId(initialWorkId);
    }
    // Ootel id tühjendatakse ka siis, kui tööd ei leitud (kustutatud, teine aasta, laadimisviga)
    onInitialWorkConsumed?.();
  }, [initialWorkId, loadedYear, year, fieldWorks, onInitialWorkConsumed]);

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
    Promise.all([api.getWorkTypes(), api.getArticles()])
      .then(([w, m]) => {
        setWorkTypes(w);
        setArticles(m);
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

        // Kultuur on selle aasta hooaja oma (talivili kuulub koristusaasta hooaega; eelmisest aastast ei pärita)
        const cropName = rec.crop;
        const crop = seasonRegistryCrop(rec, crops);
        const cropColor = crop?.color || rec.cropColor || (cropName ? getCropColor(cropName) : null);
        const currentIsWinter = isWinterSeason(rec, crops);

        const carriedFromYear: number | null = carriedWork?.carriedOverFromYear ?? (currentIsWinter ? year - 1 : null);
        const undetermined = isCropUndetermined(cropName);
        const isWinter = !undetermined && (currentIsWinter || !!carriedWork);

        // Järgmise aasta kultuur (sügiskülvi tuletamiseks)
        const nextRec = field.history.find((h) => h.year === year + 1) ?? null;
        const nextCropName = nextRec?.crop ?? null;
        const nextCrop = seasonRegistryCrop(nextRec, crops);
        const nextCropColor = nextCrop?.color || nextRec?.cropColor || (nextCropName ? getCropColor(nextCropName) : null);
        const nextUndetermined = !nextRec || isCropUndetermined(nextCropName);
        const nextIsWinter = !nextUndetermined && isWinterSeason(nextRec, crops);
        const allNextWorks = nextRec?.fieldSeasonId
          ? (byFs.get(nextRec.fieldSeasonId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
          : [];
        // Server saadab järgmisest hooajast ainult selle aasta sügistööd
        const nextWorks = allNextWorks.filter((w) => w.phase !== 'HARVEST');

        return {
          fieldSeasonId: rec.fieldSeasonId,
          field,
          rec: { ...rec, crop: cropName, cropColor: cropColor ?? rec.cropColor ?? DEFAULT_CROP_COLOR },
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

  // Kultuuri filter: põld sobib käesoleva või järgmise hooaja (talivilja) kultuuri järgi.
  // Võti on registri kultuuri nimi ("Talinisu allakülvita" → "Talinisu"); registrist puuduv jääb põllu nimega.
  const cropKey = (r: Row) => (r.undetermined ? null : r.crop?.name ?? r.rec.crop);
  const nextCropKey = (r: Row) => (r.nextUndetermined || !r.nextCropName ? null : r.nextCrop?.name ?? r.nextCropName);
  const cropOptions = useMemo(() => {
    const names = new Set<string>();
    allRows.forEach((r) => {
      const cur = cropKey(r);
      const next = nextCropKey(r);
      if (cur) names.add(cur);
      if (next) names.add(next);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'et'));
  }, [allRows]);
  const hasUndetermined = allRows.some((r) => r.undetermined);

  useEffect(() => {
    if (cropFilter === 'all' || loading) return;
    if (cropFilter === NO_CROP ? !hasUndetermined : !cropOptions.includes(cropFilter)) setCropFilter('all');
  }, [cropFilter, cropOptions, hasUndetermined, loading]);

  const cropMatches = (r: Row) =>
    cropFilter === 'all' ||
    (cropFilter === NO_CROP ? r.undetermined : cropKey(r) === cropFilter || nextCropKey(r) === cropFilter);

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
    if (!cropMatches(r)) return false;
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
      key: GroupTone;
      title: string;
      description: string;
      className: GroupTone;
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

  // Kandedialoogi rida leitakse töö järgi, sest kaardilt lisades ei ole tööd valitud
  const entryRow = entryDialog
    ? allRows.find((r) => r.fieldSeasonId === entryDialog.work.fieldSeasonId || r.nextRec?.fieldSeasonId === entryDialog.work.fieldSeasonId) ?? null
    : null;

  // Uut kannet ei saa lisada tööle, mis on põllu pindalast juba 100% tehtud
  const openNewEntry = (work: FieldWork) => {
    const row = allRows.find((r) => r.fieldSeasonId === work.fieldSeasonId || r.nextRec?.fieldSeasonId === work.fieldSeasonId);
    const isNext = work.isNextSeasonWinterSowing || row?.nextRec?.fieldSeasonId === work.fieldSeasonId;
    const fieldAreaHa = row ? (isNext ? (row.nextRec?.areaHa ?? row.rec.areaHa) : row.rec.areaHa) : 0;
    const doneHa = work.entries.reduce((sum, e) => sum + (e.areaHa ?? 0), 0);
    if (fieldAreaHa > 0 && doneHa >= fieldAreaHa - 0.01) {
      void alertDialog(`Töö „${work.workTypeName}" on juba 100% tehtud (${fmtHa(doneHa)} / ${fmtHa(fieldAreaHa)} ha). Uut kannet ei saa lisada — muuda vajadusel olemasolevat kannet.`);
      return;
    }
    setEntryDialog({ work, entry: null });
  };

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
    visibleWorks(row, col).map((w) => <WorkCard key={w.id} work={w} fieldAreaHa={row.rec.areaHa} selected={w.id === selectedId} onSelect={() => selectWork(w)} onAddEntry={locked || w.status === 'DONE' ? undefined : () => openNewEntry(w)} />);

  // Verstapost (külv/koristus) on alati nähtav; eelmise sügise hooldustööd selles veerus järgivad filtrit
  const renderMilestone = (row: Row, col: BoardColumn) => {
    const ws = columnWorks(row, col).filter((w) => (w.phase !== 'CARE') || !hideDone || w.status !== 'DONE');
    if (ws.length === 0) return <span className={MUTED}>–</span>;
    return ws.map((w) => (
      <WorkCard key={w.id} work={w} fieldAreaHa={row.rec.areaHa} selected={w.id === selectedId} onSelect={() => selectWork(w)} onAddEntry={locked || w.status === 'DONE' ? undefined : () => openNewEntry(w)} />
    ));
  };

  const visibleNextWorks = (r: Row, col: AutumnColumn) =>
    nextColumnWorks(r, col).filter((w) => !hideDone || w.status !== 'DONE');

  const renderNextCards = (row: Row, col: AutumnColumn) =>
    visibleNextWorks(row, col).map((w) => (
      <WorkCard key={w.id} work={w} fieldAreaHa={row.nextRec?.areaHa ?? row.rec.areaHa} selected={w.id === selectedId} onSelect={() => selectWork(w)} onAddEntry={locked || w.status === 'DONE' ? undefined : () => openNewEntry(w)} />
    ));

  const renderNextMilestone = (row: Row) => {
    const ws = nextColumnWorks(row, 'SOWING');
    if (ws.length === 0) return <span className={MUTED}>–</span>;
    return ws.map((w) => (
      <WorkCard key={w.id} work={w} fieldAreaHa={row.nextRec?.areaHa ?? row.rec.areaHa} selected={w.id === selectedId} onSelect={() => selectWork(w)} onAddEntry={locked || w.status === 'DONE' ? undefined : () => openNewEntry(w)} />
    ));
  };

  const nextSownDone = (row: Row) => {
    return nextColumnWorks(row, 'SOWING').some((w) => w.status === 'DONE');
  };

  return (
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader icon={<SquareKanban />} title="Põllutööd" subtitle="Põldude tööd hooaja kaupa: külv, hooldus ja koristus, kanded ning edenemine" />

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hooaja valik ja tegevused samas reas nagu Põldude registris */}
          <div className={yearSelectorGroupClass}>
            <span className={yearLabelClass}>
              <Calendar size={15} />
              <span>Hooaeg:</span>
            </span>
            <ToggleGroup variant="pills" aria-label="Hooaasta" value={String(year)} onValueChange={(v) => onSelectYear(Number(v))}>
              {availableYears.map((y) => {
                const isLocked = seasons.find((x) => x.year === y)?.isLocked ?? false;
                return (
                  <ToggleGroupItem
                    key={y}
                    value={String(y)}
                    title={`${y}. a hooaeg ${isLocked ? '(Suletud muudatusteks)' : '(Aktiivne)'}`}
                  >
                    {y}
                    {isLocked && <Lock size={10} />}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <div className={registerIoButtonsClass}>
              <Button type="button" size="sm" onClick={onOpenWorkRegister} title="Ava tööde register: tööd ja kulumaterjalid">
                <ListChecks size={14} />
                <span>Tööde register</span>
              </Button>
              {canManageFinance && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setFinanceEntryId(null);
                    setIsFinanceOpen(true);
                  }}
                  title="Põllutööde finantsid ja kuluarvestus"
                >
                  <Euro size={14} />
                  <span>Finantsid</span>
                  {pendingFinanceCount > 0 && <Badge tone="warning" variant="solid">{pendingFinanceCount}</Badge>}
                </Button>
              )}
            </div>
          </div>

        </div>

        <div className={registerActionsBarClass}>
          <SearchInput className="max-w-105 flex-1 basis-55" value={search} onChange={setSearch} placeholder="Otsi põldu või tööd" aria-label="Otsi põldu või tööd" />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground leading-natural">
            <span>Tegevus</span>
            <FilterClear active={activity !== 'all'} onClear={() => setActivity('all')}>
              <FilterSelect value={activity} defaultValue="all" onChange={setActivity}
                options={[{ value: 'all', label: 'Kõik tegevused' }, ...activityOptions.map((o) => ({ value: o.id, label: o.name }))]} />
            </FilterClear>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground leading-natural">
            <span>Kultuur</span>
            <FilterClear active={cropFilter !== 'all'} onClear={() => setCropFilter('all')}>
              <FilterSelect value={cropFilter} defaultValue="all" onChange={setCropFilter}
                options={[
                  { value: 'all', label: 'Kõik kultuurid' },
                  ...cropOptions.map((name) => ({ value: name, label: name })),
                  ...(hasUndetermined ? [{ value: NO_CROP, label: 'Kultuur valimata' }] : [])
                ]} />
            </FilterClear>
          </label>
          <CheckboxField className="ml-auto" checked={hideDone} onCheckedChange={setHideDone} label="Peida lõpetatud tööd" />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card" aria-busy={loading}>
          <div className={cn('sticky top-0 z-3 border-b border-border bg-popover', BOARD_MIN_WIDTH)}>
            <div className={BOARD_GRID}>
              <div className={cn(HEAD_SECTION, 'sticky left-0 z-2 border-r bg-popover')}>PÕLD</div>
              <div className={cn(HEAD_SECTION, PLACE.headPrev, 'border-l bg-muted-foreground/10')}>
                <span>EELMINE AASTA {year - 1}</span>
              </div>
              <div className={cn(HEAD_SECTION, PLACE.headCurrent, 'border-l-3 border-l-subtle bg-primary-strong/8 text-success-text')}>
                <span>KÄESOLEV AASTA {year}</span>
              </div>
              <div className={cn(HEAD_SECTION, PLACE.headNext, 'border-l-3 border-l-subtle bg-sky/10 text-sky-text')}>
                <span>JÄRGMINE AASTA {year + 1}</span>
              </div>
            </div>
            <div className={BOARD_GRID}>
              <HeadCell first title={`${rows.length} ${rows.length === 1 ? 'põld' : 'põldu'}`} />
              <HeadCell title="Ettevalmistus" count={countPhase('PREV_PREPARATION')} />
              <HeadCell tone="prev-sow" title={<><Sprout size={14} /> Sügiskülv</>} count={prevMilestoneCount()} />
              <HeadCell title="Sügishooldus" count={countPhase('PREV_CARE')} />
              <HeadCell yearStart title="Ettevalmistus" count={countPhase('PREPARATION')} />
              <HeadCell tone="sow" title={<><Sprout size={14} /> Kevadkülv</>} count={springSowCount()} />
              <HeadCell title="Hooldamine" count={countPhase('CARE')} />
              <HeadCell tone="harvest" title={<><Wheat size={14} /> Koristus</>} count={milestoneCount('HARVEST')} />
              <HeadCell yearStart title="Ettevalmistus" count={countNextPhase('PREP')} />
              <HeadCell tone="autumn-sow" title={<><Sprout size={14} /> Sügiskülv</>} count={nextMilestoneCount()} />
              <HeadCell title="Sügishooldus" count={countNextPhase('CARE')} />
            </div>
          </div>

          {rows.length === 0 && (
            <div className="p-6 text-center text-base text-subtle leading-natural">{allRows.length === 0 ? `${year}. a hooajal pole põlde.` : 'Filtrile vastavaid põlde pole.'}</div>
          )}

          {groups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.key];

            return (
              <React.Fragment key={group.key}>
                <Button
                  variant="plain"
                  size="inline"
                  className={cn('flex cursor-pointer select-none items-center justify-between gap-3 border-y border-border px-3 py-2 hover:brightness-98 dark:hover:brightness-105', BOARD_MIN_WIDTH, GROUP_TONE[group.className])}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                  title={`${group.description}. Klõpsa grupi peitmiseks või avamiseks.`}
                >
                  <span className="sticky left-3.5 flex min-w-0 items-center gap-2">
                    {isCollapsed ? <ChevronRight size={16} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={16} className="shrink-0 text-muted-foreground" />}
                    <span className="inline-flex items-center gap-1.5 text-base font-semibold leading-natural whitespace-nowrap text-foreground">{group.title}</span>
                  </span>
                </Button>

                {!isCollapsed &&
                  group.rows.map((row) => {
                    const color = row.crop?.color ?? (row.undetermined ? null : row.cropColor);
                    const nextColor = row.nextCrop?.color ?? (row.nextUndetermined ? null : row.nextCropColor);
                    const fieldNextClass: GroupTone = row.nextIsWinter
                      ? 'winter'
                      : !row.nextUndetermined
                        ? 'spring'
                        : 'undetermined';

                    return (
                      <div key={row.fieldSeasonId} className={cn('group/row border-b border-border hover:bg-muted-hover/35', BOARD_GRID, BOARD_MIN_WIDTH, 'grid-rows-[auto_1fr]')}>
                        {/* 1. Põllu info (taustavärvitud vastavalt sügiskülvi / järgmise kultuuri staatusele) */}
                        <div
                          className={cn('sticky left-0 z-2 flex min-w-0 flex-col justify-center gap-1 border-r border-border px-3 py-2.5 transition-colors', PLACE.field, FIELD_TONE[fieldNextClass])}
                        >
                          {/* Põllu kuju nupp lahtri paremas ülanurgas */}
                          <Button variant="ghost" size="icon-xs" wrapperClassName={cornerActionClass}
                            title={`Näita ${year}. a põllu kuju`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShapeView({ field: row.field, record: row.rec });
                            }}
                          >
                            <Crosshair size={13} />
                          </Button>
                          <div className="flex min-w-0 flex-col items-start gap-1 pr-4">
                            {row.field.num && <Badge tone="success" variant="outline" size="md">Nr {row.field.num}</Badge>}
                            <span className="line-clamp-2 max-w-full overflow-hidden text-base font-normal leading-tight wrap-anywhere text-foreground" title={row.field.name}>{row.field.name}</span>
                          </div>
                          <div className="flex items-center justify-end text-xs text-muted-foreground">
                            <span className="shrink-0 whitespace-nowrap text-base font-normal leading-natural text-foreground">{fmtHa(row.rec.areaHa)} ha</span>
                          </div>
                        </div>

                        {/* Rida 1: Käesoleva hooaja kultuuri päis (eelmise aasta sügis + käesolev aasta, Cols 2-8) */}
                        <div
                          className={cn('flex min-w-0 items-center justify-between gap-2 border-b border-border px-2.5 py-1 text-sm leading-natural', PLACE.bannerCurrent)}
                          style={cropBannerStyle(color, 12)}
                        >
                          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                            <span className="truncate font-medium text-foreground">{row.undetermined ? 'Kultuur valimata' : row.rec.crop}</span>
                          </div>
                          {!locked && row.works.length > 0 && !hasCurrentEntries(row) && (
                            <Button
                              type="button"
                              size="xs"
                              className={cn('ml-auto shrink-0 enabled:hover:border-destructive/40', DELETE_HOVER)}
                              title={`Eemalda kultuuri "${row.undetermined ? 'valimata' : row.rec.crop}" tööd (${row.works.length} tk)`}
                              aria-label="Kustuta plaanitud tööd"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                clearCurrentCropWorks(row);
                              }}
                            >
                              <Trash2 size={11} className="text-danger-text" />
                              <span>Kustuta plaanitud tööd</span>
                            </Button>
                          )}
                        </div>

                        {/* Rida 1: Järgmise kultuuri päis (Cols 9-11) */}
                        {!row.nextUndetermined ? (
                          <div
                            className={cn('flex min-w-0 items-center justify-between gap-2 border-b border-l border-border px-2.5 py-1 text-sm leading-natural', PLACE.bannerNext)}
                            style={cropBannerStyle(nextColor, 10)}
                          >
                            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                              <span className="truncate font-medium text-foreground">{row.nextCropName}</span>
                            </div>
                            {!locked && row.nextWorks.length > 0 && !hasNextEntries(row) && row.nextRec?.fieldSeasonId && (
                              <Button
                                type="button"
                                size="xs"
                                className={cn('ml-auto shrink-0 enabled:hover:border-destructive/40', DELETE_HOVER)}
                                title={`Eemalda järgmise kultuuri "${row.nextCropName}" sügistööd (${row.nextWorks.length} tk)`}
                                aria-label="Kustuta plaanitud tööd"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearNextCropWorks(row);
                                }}
                              >
                                <Trash2 size={11} className="text-danger-text" />
                                <span>Kustuta plaanitud tööd</span>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className={cn('flex min-w-0 items-center justify-between gap-2 border-b border-l border-border bg-muted px-2.5 py-1 text-sm leading-natural opacity-85', PLACE.bannerNext)}>
                            <span className="truncate font-medium text-foreground">Järgmine kultuur määramata</span>
                          </div>
                        )}

                        {/* Rida 2: Eelmise aasta sügistööd (Cols 2-4) */}
                        {/* Col 2: Eelmise aasta ettevalmistus (nt sügiskünd) */}
                        <BoardCell col={2} tone="prev">
                          {row.undetermined && <span className={MUTED}>Kultuur valimata</span>}
                          {renderCards(row, 'PREV_PREPARATION')}
                          {!locked && !row.undetermined && (
                            <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'PREPARATION', plannedText: `Sügis ${year - 1}` })} />
                          )}
                        </BoardCell>

                        {/* Col 3: Eelmise aasta sügiskülv */}
                        {row.isWinter ? (
                          <BoardCell col={3} tone="prev-sow" done={prevSownDone(row)}>
                            {renderMilestone(row, 'PREV_SOWING')}
                            {!locked && !row.undetermined && (
                              <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'SOWING', plannedText: `Sügis ${year - 1}` })} />
                            )}
                          </BoardCell>
                        ) : (
                          <BoardCell col={3} kind="no-sow">
                            {columnWorks(row, 'PREV_SOWING').length > 0
                              ? renderMilestone(row, 'PREV_SOWING')
                              : <span className={MUTED} title="Suvivili – sügiskülvi ei toimunud">—</span>}
                          </BoardCell>
                        )}

                        {/* Col 4: Eelmise aasta sügishooldus (pärast sügiskülvi, nt herbitsiid taliviljal) */}
                        <BoardCell col={4} tone="prev">
                          {renderCards(row, 'PREV_CARE')}
                          {!locked && !row.undetermined && (
                            <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'CARE', plannedText: `Sügis ${year - 1}` })} />
                          )}
                        </BoardCell>

                        {/* Rida 2: Käesoleva aasta tööd (Cols 5-8) */}
                        {/* Col 5: Ettevalmistus */}
                        <BoardCell col={5}>
                          {row.undetermined && <span className={MUTED}>Kultuur valimata</span>}
                          {renderCards(row, 'PREPARATION')}
                          {!locked && !row.undetermined && (
                            <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'PREPARATION' })} />
                          )}
                        </BoardCell>

                        {/* Col 6: Kevadkülv (talivili on külvatud eelmisel sügisel) */}
                        {row.isWinter && columnWorks(row, 'SOWING').length === 0 ? (
                          <BoardCell col={6} kind="no-sow">
                            <span className={MUTED} title={`Talivili – külv ${year - 1}. a sügisel`}>—</span>
                          </BoardCell>
                        ) : (
                          <BoardCell col={6} tone="sow" done={columnWorks(row, 'SOWING').some((w) => w.status === 'DONE')}>
                            {renderMilestone(row, 'SOWING')}
                            {!locked && !row.undetermined && (
                              <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'SOWING' })} />
                            )}
                          </BoardCell>
                        )}

                        {/* Col 7: Hooldus */}
                        <BoardCell col={7}>
                          {renderCards(row, 'CARE')}
                          {!locked && !row.undetermined && (
                            <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'CARE' })} />
                          )}
                        </BoardCell>

                        {/* Col 8: Koristus */}
                        <BoardCell col={8} tone="harvest">
                          {renderMilestone(row, 'HARVEST')}
                          {!locked && !row.undetermined && (
                            <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'HARVEST' })} />
                          )}
                        </BoardCell>

                        {/* Rida 2: Järgmise kultuuri sügistööd (Cols 9-11) */}
                        {!row.nextUndetermined ? (
                          <>
                            {/* Col 9: Sügise ettevalmistus (nii tali- kui ka suviviljadel, nt sügiskünd) */}
                            <BoardCell col={9}>
                              {renderNextCards(row, 'PREP')}
                              {!locked && row.nextRec?.fieldSeasonId && (
                                <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'PREPARATION', isNextCrop: true, plannedText: `Sügis ${year}` })} />
                              )}
                            </BoardCell>

                            {/* Col 10: Sügiskülv (ainult taliviljal; suviviljal ei toimu sügisel külvi) */}
                            {row.nextIsWinter ? (
                              <BoardCell col={10} tone="autumn-sow" done={nextSownDone(row)}>
                                {renderNextMilestone(row)}
                                {!locked && row.nextRec?.fieldSeasonId && (
                                  <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'SOWING', isNextCrop: true, plannedText: `Sügis ${year}` })} />
                                )}
                              </BoardCell>
                            ) : (
                              <BoardCell col={10} kind="no-sow">
                                {nextColumnWorks(row, 'SOWING').length > 0
                                  ? renderNextMilestone(row)
                                  : <span className={MUTED} title="Suvivili – sügiskülvi ei toimu">—</span>}
                              </BoardCell>
                            )}

                            {/* Col 11: Sügishooldus (järgmise kultuuri hooldus pärast sügiskülvi) */}
                            <BoardCell col={11}>
                              {renderNextCards(row, 'CARE')}
                              {!locked && row.nextRec?.fieldSeasonId && (
                                <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'CARE', isNextCrop: true, plannedText: `Sügis ${year}` })} />
                              )}
                            </BoardCell>
                          </>
                        ) : (
                          <BoardCell kind="none" place={PLACE.nextAll}>
                            <span className={MUTED}>Järgmine kultuur määramata</span>
                          </BoardCell>
                        )}
                      </div>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground leading-natural">
          <span className="inline-flex items-center gap-1.5"><span className={STATUS_DOT} /> Planeeritud</span>
          <span className="inline-flex items-center gap-1.5"><span className={cn(STATUS_DOT, STATUS_DOT_DOING)} /> Töös</span>
          <span className="inline-flex items-center gap-1.5"><Check size={12} strokeWidth={3} className="shrink-0 text-success-text" /> Lõpetatud</span>
          <span className="inline-flex items-center gap-1.5"><strong className="text-info-text">↻</strong> Korduv töö (tehtud / plaanitud kordi)</span>
        </div>
      </main>

      {selected && selectedRow && (() => {
          const isSelectedNext = selected.isNextSeasonWinterSowing || (selectedRow.nextRec?.fieldSeasonId === selected.fieldSeasonId);
          const activeLabel = isSelectedNext
            ? `Nr ${selectedRow.field.num ?? '–'} ${selectedRow.field.name} · ${selectedRow.nextCropName ?? 'Talivili'} (Sügiskülv ${year}, saak ${year + 1}) · ${fmtHa(selectedRow.nextRec?.areaHa ?? selectedRow.rec.areaHa)} ha`
            : fieldLabel(selectedRow);
          const activeArea = isSelectedNext ? (selectedRow.nextRec?.areaHa ?? selectedRow.rec.areaHa) : selectedRow.rec.areaHa;
          const selectedSeedCheck = { seasonCrop: isSelectedNext ? selectedRow.nextCrop : selectedRow.crop, crops };
          // Lõpetatud tööd ei saa muuta enne uuesti avamist
          const workLocked = locked || selected.status === 'DONE';

          return (
            <Dialog open onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
              <DialogContent size="lg" dismissible={!busy}>
                <DialogHeader
                  icon={<span className={phaseLabelClass} data-tone={WORK_PHASE_META[selected.phase].tone}>{WORK_PHASE_META[selected.phase].label.toUpperCase()}</span>}
                  title={<span title={selected.priaName}>{selected.workTypeName}</span>}
                  description={activeLabel}
                />

                <DialogBody className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    {isUnplanned(selected) ? (
                      <Badge tone="warning" size="md">Planeerimata</Badge>
                    ) : (
                      <Badge tone={WORK_STATUS_TONE[selected.status].tone} variant={WORK_STATUS_TONE[selected.status].variant} size="md">{STATUS_LABEL[selected.status]}</Badge>
                    )}
                    <span className={MUTED}>
                      {selected.status === 'PLANNED' && (isUnplanned(selected) ? 'Lisa plaan: aeg, materjalid või töötaja.' : 'Esimene kanne muudab töö olekuks „Töös“.')}
                      {selected.status === 'IN_PROGRESS' && 'Töö on pooleli, kuni see märgitakse lõpetatuks.'}
                      {selected.status === 'DONE' && `Lõpetatud${selected.finishedAt ? ` ${formatDate(selected.finishedAt)}` : ''}${locked ? '' : ' · muutmiseks ava töö uuesti'}`}
                    </span>
                  </div>

                  {selected.isNextSeasonWinterSowing && (
                    <Alert size="sm">
                      <Info size={14} />
                      <span>See on {year}. a sügisene ettevalmistus/külv järgmise hooaja ({year + 1}) taliviljale {selectedRow.nextCropName ?? ''}.</span>
                    </Alert>
                  )}
                  {selected.carriedOverFromYear && (
                    <Alert size="sm">
                      <Info size={14} />
                      <span>See külvitöö teostati eelmise aasta ({selected.carriedOverFromYear}) sügisel ja see on üle kantud käesolevasse hooaega.</span>
                    </Alert>
                  )}
                  {selected.carriedOverToYear && !selected.isNextSeasonWinterSowing && (
                    <Alert size="sm">
                      <Info size={14} />
                      <span>See töö kuulub talivilja {selected.carriedOverToYear}. a saagiaasta tsüklisse ning teostatakse {selected.carriedOverToYear}. a hooajal.</span>
                    </Alert>
                  )}

                  <Card asChild variant="tile" padding="sm" className="flex flex-col gap-2"><section>
                    <div className={cn(subheadingClass, 'flex min-h-6.5 items-center justify-between')}>
                      <span>Plaan</span>
                      {!workLocked && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPlan(true)}>
                          <Pencil size={13} />
                          <span>Muuda</span>
                        </Button>
                      )}
                    </div>
                    <FieldWorkPlanForm
                      key={selected.id}
                      fieldSeasonId={selected.fieldSeasonId}
                      fieldAreaHa={activeArea}
                      work={selected}
                      workTypes={workTypes}
                      articles={articles}
                      workers={workers}
                      seedCheck={selectedSeedCheck}
                      mode="view"
                      onSaved={() => undefined}
                      onCancel={() => undefined}
                    />
                  </section></Card>

                  {/* Plaani muutmine eraldi aknas (nagu kande lisamine); Esc sulgeb ainult selle akna */}
                  {editingPlan && !workLocked && (
                    <Dialog open onOpenChange={(open) => { if (!open) setEditingPlan(false); }}>
                      <DialogContent size="xl" dismissible={!planBusy}>
                        <DialogHeader
                          title={`${isUnplanned(selected) ? 'Lisa plaan' : 'Muuda plaani'}: ${selected.workTypeName}`}
                          description={activeLabel}
                        />
                        <FieldWorkPlanForm
                          key={`edit-${selected.id}`}
                          fieldSeasonId={selected.fieldSeasonId}
                          fieldAreaHa={activeArea}
                          work={selected}
                          workTypes={workTypes}
                          articles={articles}
                          workers={workers}
                          seedCheck={selectedSeedCheck}
                          mode="edit"
                          layout="dialog"
                          onBusyChange={setPlanBusy}
                          onSaved={() => {
                            setEditingPlan(false);
                            void reload();
                          }}
                          onCancel={() => setEditingPlan(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  )}

                  {activeArea > 0 && (() => {
                    const done = selected.entries.reduce((s, e) => s + (e.areaHa ?? 0), 0);
                    const pct = Math.min(100, Math.round((done / activeArea) * 100));
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs leading-natural text-muted-foreground"><span>Tehtud pindala</span><strong className="text-foreground">{fmtHa(done)} / {fmtHa(activeArea)} ha ({pct}%)</strong></div>
                        <ProgressBar value={pct} aria-label="Tehtud pindala" />
                      </div>
                    );
                  })()}

                  <div className={cn(subheadingClass, 'flex justify-between')}>
                    <span>Kanded</span>
                    <span className={MUTED}>{selected.entries.length || ''}</span>
                  </div>
                  {selected.entries.length === 0 && (
                    <div className={emptyBoxClass}>Kandeid pole. Lisa iga tööpäeva kohta kanne koos kulunud aja ja materjalidega.</div>
                  )}
                  {selected.entries.map((e) => (
                    <EntryRow key={e.id}>
                        <div className={ENTRY_WHEN}>
                          <strong className="text-sm leading-natural text-foreground">{formatDate(e.date)}</strong>
                          {e.startTime && e.endTime && <span className="text-xs leading-natural text-muted-foreground">{e.startTime}–{e.endTime}</span>}
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 @max-[561px]:col-span-full @max-[561px]:row-start-2">
                          <div className="text-xs leading-natural text-foreground">{[e.workerName, [e.vehicleName, e.implementName].filter(Boolean).join(' + ')].filter(Boolean).join(' · ') || '–'}</div>
                          <div className="text-xs leading-natural text-muted-foreground">
                            {[
                              fmtNum(e.laborHours, 'h tööaeg'),
                              fmtNum(e.equipmentHours, 'h masin'),
                              fmtNum(e.fuelLiters, 'l kütust'),
                              ...e.articles.map((m) => `${m.name} ${formatQty(m.quantity)} ${m.unit}`),
                              fmtQtyUnit(e.harvestTonnes, 't saaki')
                            ].filter(Boolean).join(' · ') || 'kogused sisestamata'}
                          </div>
                        </div>
                        <div className={cn(ENTRY_WHEN, 'num tabular-nums items-end @max-[561px]:col-start-2 @max-[561px]:-col-end-1 @max-[561px]:row-start-1')}>
                          <strong className="text-sm leading-natural tabular-nums text-foreground">{e.areaHa ? `${fmtHa(e.areaHa)} ha` : '–'}</strong>
                          {e.telemetryAreaHa ? <span className="text-xs leading-natural tabular-nums text-muted-foreground">{fmtHa(e.telemetryAreaHa)} ha GPS</span> : null}
                        </div>
                        <div className="@max-[561px]:col-span-2 @max-[561px]:col-start-1 @max-[561px]:row-start-3">
                          {canManageFinance ? (
                            <Button
                              variant="bare"
                              size="inline"
                              title="Ava kande finants ja määra ühikuhinnad"
                              onClick={() => {
                                setFinanceEntryId(e.id);
                                setIsFinanceOpen(true);
                              }}
                            >
                              <Badge tone={FINANCE_STATUS_BADGE[e.financeStatus].tone} variant={FINANCE_STATUS_BADGE[e.financeStatus].variant}>
                                <Euro size={10} />
                                {FINANCE_LABEL[e.financeStatus]}
                              </Badge>
                            </Button>
                          ) : (
                            <Badge tone={FINANCE_STATUS_BADGE[e.financeStatus].tone} variant={FINANCE_STATUS_BADGE[e.financeStatus].variant}>{FINANCE_LABEL[e.financeStatus]}</Badge>
                          )}
                        </div>
                        <span className="flex gap-0.5 empty:hidden @max-[561px]:col-start-3 @max-[561px]:row-start-3 @max-[561px]:justify-self-end">
                          {!workLocked && (
                            <>
                              <Button type="button" variant="ghost" size="icon-sm" title="Muuda kannet" aria-label="Muuda kannet" onClick={() => setEntryDialog({ work: selected, entry: e })}>
                                <Edit2 size={14} />
                              </Button>
                              <Button type="button" variant="danger-ghost" size="icon-sm" title="Kustuta kanne" aria-label="Kustuta kanne" onClick={() => deleteEntry(e)}>
                                <Trash2 size={14} />
                              </Button>
                            </>
                          )}
                        </span>
                    </EntryRow>
                  ))}
                  {!workLocked && (
                    <Button type="button" onClick={() => openNewEntry(selected)}>
                      <Plus size={13} />
                      <span>Lisa kanne…</span>
                    </Button>
                  )}
                </DialogBody>

                {!locked && (
                  <div className="flex items-center gap-2.5 border-t border-border px-6 py-3">
                    {selected.status === 'DONE' ? (
                      <Button type="button" className="flex-1 justify-center" disabled={busy} onClick={() => void run(() => api.updateFieldWork(selected.id, { status: 'REOPEN' }))}>
                        <RotateCcw size={14} />
                        <span>Ava uuesti</span>
                      </Button>
                    ) : (
                      <Button type="button" variant="primary" className="flex-1 justify-center" disabled={busy} title="Töö on tehtud – rohkem kandeid ei oodata" onClick={() => void run(() => api.updateFieldWork(selected.id, { status: 'DONE' }))}>
                        <Check size={14} />
                        <span>Märgi lõpetatuks</span>
                      </Button>
                    )}
                    {selected.status !== 'DONE' && <Button
                      type="button"
                      variant="danger-ghost"
                      size="icon-sm"
                      title={selected.entries.length ? 'Kannetega tööd ei saa eemaldada' : 'Eemalda töö põllult'}
                      aria-label="Eemalda töö põllult"
                      disabled={busy || selected.entries.length > 0}
                      onClick={() => removeWork(selected)}
                    >
                      <Trash2 size={16} />
                    </Button>}
                  </div>
                )}

                {!locked && !hasAnyEntries(selectedRow) && getRowVisibleWorks(selectedRow).length > 1 && (
                  <div className="flex justify-center px-6 pb-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn('w-full justify-center text-xs text-subtle', DELETE_HOVER)}
                      disabled={busy}
                      onClick={() => clearFieldWorks(selectedRow)}
                    >
                      <Trash2 size={12} />
                      <span>Eemalda kõik selle põllu tööd ({getRowVisibleWorks(selectedRow).length})</span>
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          );
        })()}

      {entryDialog && entryRow && (() => {
        const selectedRow = entryRow;
        const isNext = entryDialog.work.isNextSeasonWinterSowing || (selectedRow.nextRec?.fieldSeasonId === entryDialog.work.fieldSeasonId);
        const activeLabel = isNext
          ? `Nr ${selectedRow.field.num ?? '–'} ${selectedRow.field.name} · ${selectedRow.nextCropName ?? 'Talivili'} (Sügiskülv ${year}, saak ${year + 1})`
          : fieldLabel(selectedRow);
        const activeArea = isNext ? (selectedRow.nextRec?.areaHa ?? selectedRow.rec.areaHa) : selectedRow.rec.areaHa;
        const seedCheck = { seasonCrop: isNext ? selectedRow.nextCrop : selectedRow.crop, crops };

        return (
          <FieldWorkEntryDialog
            work={entryDialog.work}
            entry={entryDialog.entry}
            fieldLabel={activeLabel}
            fieldAreaHa={activeArea}
            workers={workers}
            vehicles={vehicles}
            implementsList={implementsList}
            articles={articles}
            telemetryEnabled={telemetryEnabled}
            seedCheck={seedCheck}
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
