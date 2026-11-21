// src/components/PriaLinesEditor.tsx — PRIA materjaliread (seeme, väetis, lubi, taimekaitse) tegevuse järgi.
// Kogus ha kohta ja kokku arvutavad teineteist pindala järgi (PRIA reegel). Samas failis saagi ja seire plokid.
import React from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { FieldWorkPlanLine, Article, WorkEntryArticle, WorkEntryObservation } from '../types/fieldWork';
import {
  PRIA_ACTIVITY, SEED_REGISTERS, SEED_CATEGORIES, FERTILIZER_REGISTERS, LIMING_REGISTERS, PLANT_PROTECTION_REGISTERS,
  CROP_TYPES, YIELD_TYPES, OBSERVATION_UNITS, totalFromRate, rateFromTotal, priaArticleKindFor
} from '../services/pria';
import { convertQty } from '../services/units';
import { matchesPriaKind } from '../services/articleRules';
import { seedCropMismatches, type SeedCheck } from '../services/seedCropCheck';
import { Alert, Button, FilterSelect, Input, NumberInput, cn, infoNoticeClass, type FilterSelectOption } from './ui';

// PRIA read: veerupäisega ruudustik (veerud tulevad style-ist); kitsal ekraanil lahtrid murduvad
const PRIA_GRID = 'grid items-center gap-1.5 [&_[data-slot=input]]:w-full [&_[data-slot=input]]:min-w-0 [&_[data-slot=filter-select]]:w-full [&_[data-slot=filter-select]]:min-w-0 max-[761px]:flex max-[761px]:flex-wrap max-[761px]:[&_[data-slot=input]]:flex-1 max-[761px]:[&_[data-slot=input]]:basis-35 max-[761px]:[&_[data-slot=filter-select]]:flex-1 max-[761px]:[&_[data-slot=filter-select]]:basis-35 max-[761px]:[&_[data-slot=input][inputmode]]:flex-initial max-[761px]:[&_[data-slot=input][inputmode]]:basis-22.5';
const PRIA_HEAD = 'px-0.5 text-xs font-semibold leading-natural text-muted-foreground max-[761px]:hidden [&>.num]:text-right';
const PRIA_LINES = 'flex flex-col gap-1.5';

export interface PriaRow {
  articleId: string; label: string; unit: string; ratePerHa: string; total: string;
  priaRegister: string; priaKind: string; priaSpec: string; activeIngredient: string; nKgHa: string; pKgHa: string; kKgHa: string;
  warehouseId: string; // kande real: ladu, kust materjal maha kantakse
}

export interface HarvestRow { ratePerHa: string; total: string; priaKind: string; priaSpec: string; bunkers?: string }

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
// Rea arvuväli: olek jääb tekstiks (PriaRow/HarvestRow kasutajad parsivad seda), sisend on NumberInput (3 komakohta nagu fmt)
const numValue = (s: string | undefined) => parseNum(s ?? '');
const numText = (n: number | null) => (n == null ? '' : String(n));
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 3, useGrouping: false }));

export const emptyPriaRow = (): PriaRow => ({
  articleId: '', label: '', unit: 'kg', ratePerHa: '', total: '', priaRegister: '', priaKind: '', priaSpec: '', activeIngredient: '', nKgHa: '', pKgHa: '', kKgHa: '', warehouseId: ''
});

// Plaanirida (FieldWorkPlanLine) või kande materjal (WorkEntryArticle) vormireaks
export const planLineToRow = (l: FieldWorkPlanLine | WorkEntryArticle, areaHa: number): PriaRow => {
  const label = 'label' in l ? l.label : l.name;
  const quantity = 'quantity' in l ? l.quantity : null;
  const ratePerHa = l.ratePerHa ?? null;
  return {
    articleId: l.articleId ?? '', label: label ?? '', unit: l.unit ?? 'kg',
    ratePerHa: fmt(ratePerHa ?? rateFromTotal(quantity, areaHa)),
    total: fmt(quantity ?? totalFromRate(ratePerHa, areaHa)),
    priaRegister: l.priaRegister ?? '', priaKind: l.priaKind ?? '', priaSpec: l.priaSpec ?? '', activeIngredient: l.activeIngredient ?? '',
    nKgHa: fmt(l.nKgHa), pKgHa: fmt(l.pKgHa), kKgHa: fmt(l.kKgHa),
    warehouseId: ('warehouseId' in l ? l.warehouseId : null) ?? ''
  };
};

export const rowPria = (r: PriaRow) => ({
  priaRegister: r.priaRegister || null, priaKind: r.priaKind || null, priaSpec: r.priaSpec || null,
  activeIngredient: r.activeIngredient || null, nKgHa: parseNum(r.nKgHa), pKgHa: parseNum(r.pKgHa), kKgHa: parseNum(r.kKgHa)
});

// Pindala muutumisel arvutatakse kogus kokku uuesti normist (kg/ha on PRIA lähteväärtus); normita rida jätab koguse alles
export const recomputeTotals = (rows: PriaRow[], areaHa: number | null): PriaRow[] =>
  rows.map((r) => {
    const rate = parseNum(r.ratePerHa);
    return rate == null ? r : { ...r, total: fmt(totalFromRate(rate, areaHa)) };
  });

export const recomputeHarvestTotal = (h: HarvestRow, areaHa: number | null): HarvestRow => {
  const rate = parseNum(h.ratePerHa);
  return rate == null ? h : { ...h, total: fmt(totalFromRate(rate, areaHa)) };
};

export const rowToPlanLine = (r: PriaRow): FieldWorkPlanLine | null =>
  r.label.trim() ? { kind: 'MATERIAL', articleId: r.articleId || null, label: r.label.trim(), unit: r.unit, ratePerHa: parseNum(r.ratePerHa), ...rowPria(r) } : null;

// Materjali N/P/K sisalduse (%) järgi rea N/P/K kg/ha; ainult massiühikus materjalil, mille sisaldus on teada
const npkFor = (m: Article | undefined, ratePerHa: string): Partial<PriaRow> => {
  if (!m || (m.nPct == null && m.pPct == null && m.kPct == null)) return {};
  const rate = parseNum(ratePerHa);
  const kgHa = rate == null ? null : convertQty(rate, m.unit, 'kg');
  const part = (p: number | null | undefined) => (p == null || kgHa == null ? '' : fmt(Math.round(kgHa * p) / 100));
  return { nKgHa: part(m.nPct), pKgHa: part(m.pPct), kKgHa: part(m.kPct) };
};

const registersFor = (activity: string): readonly string[] =>
  activity === PRIA_ACTIVITY.SOWING ? SEED_REGISTERS
    : activity === PRIA_ACTIVITY.FERTILIZING ? FERTILIZER_REGISTERS
    : activity === PRIA_ACTIVITY.LIMING ? LIMING_REGISTERS
    : activity === PRIA_ACTIVITY.PLANT_PROTECTION ? PLANT_PROTECTION_REGISTERS
    : [];

interface PriaLinesEditorProps {
  activity: string;
  rows: PriaRow[];
  onChange: (rows: PriaRow[]) => void;
  articles: Article[];
  areaHa: number;
  showTotals: boolean; // kandel kogus kokku, plaanil ainult norm
  seedCheck?: SeedCheck; // külvil: hoiatus, kui seemne sort on teise kultuuri oma
  // Kandel: laod rea laovalikuks (veerg ainult siis, kui ladu on rohkem kui üks) ja uue rea vaikimisi ladu
  warehouses?: { id: string; name: string; isActive: boolean }[];
  defaultWarehouseId?: string;
}

// Valikute loend; senine väärtus, mida loendis pole (nt vana kande väärtus), jääb valikuks
const optionsOf = (empty: string, values: readonly string[], current: string): FilterSelectOption[] => [
  { value: '', label: empty },
  ...values.map((x) => ({ value: x, label: x })),
  ...(current && !values.includes(current) ? [{ value: current, label: current }] : [])
];

export const PriaLinesEditor: React.FC<PriaLinesEditorProps> = ({ activity, rows, onChange, articles, areaHa, showTotals, seedCheck, warehouses, defaultWarehouseId }) => {
  const showWarehouse = !!warehouses && warehouses.length > 1;
  const warehouseOptions = (current: string): FilterSelectOption[] =>
    (warehouses ?? []).filter((w) => w.isActive || w.id === current).map((w) => ({ value: w.id, label: w.name }));
  const kind = priaArticleKindFor(activity);
  const options = articles.filter((m) => (matchesPriaKind(m.category, kind) && m.isActive) || rows.some((r) => r.articleId === m.id));
  const isSeed = activity === PRIA_ACTIVITY.SOWING;
  const isFert = activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING;
  const isTkv = activity === PRIA_ACTIVITY.PLANT_PROTECTION;
  const set = (i: number, patch: Partial<PriaRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const articleOf = (r: PriaRow) => articles.find((m) => m.id === r.articleId);
  const setRate = (i: number, v: string) => set(i, { ratePerHa: v, total: fmt(totalFromRate(parseNum(v), areaHa)), ...npkFor(articleOf(rows[i]), v) });
  const setTotal = (i: number, v: string) => {
    const ratePerHa = fmt(rateFromTotal(parseNum(v), areaHa));
    set(i, { total: v, ratePerHa, ...npkFor(articleOf(rows[i]), ratePerHa) });
  };
  // Materjali valimisel tulevad PRIA väljad kulumaterjalide registrist; registris täitmata väli jääb reale alles
  const pickArticle = (i: number, id: string) => {
    const m = articles.find((x) => x.id === id);
    if (!m) return set(i, { articleId: '', label: '' });
    const r = rows[i];
    set(i, {
      articleId: m.id, label: m.name, unit: m.unit,
      priaRegister: m.priaRegister || r.priaRegister,
      priaKind: m.priaKind || r.priaKind,
      priaSpec: m.priaSpec || r.priaSpec,
      activeIngredient: m.activeIngredient || r.activeIngredient,
      ...npkFor(m, r.ratePerHa),
      // Materjali vaikimisi ladu (kui see on valitav), muidu rea senine ladu
      ...(showWarehouse && m.defaultWarehouseId && warehouses!.some((w) => w.id === m.defaultWarehouseId && w.isActive)
        ? { warehouseId: m.defaultWarehouseId } : {})
    });
  };

  // Veerud tegevuse järgi; päis ja read kasutavad sama ruudustikku, et kõik oleks ühel real
  const columns: { label: string; width: string; num?: boolean }[] = [
    { label: 'Register/materjal', width: 'minmax(130px, 1.2fr)' },
    { label: isSeed ? 'Sort' : 'Toode', width: 'minmax(130px, 1.4fr)' },
    { label: isSeed ? 'Liik' : isTkv ? 'Liik' : 'Väetise liik', width: 'minmax(110px, 1fr)' },
    ...(isSeed ? [{ label: 'Kategooria', width: '90px' }] : []),
    ...(isTkv ? [{ label: 'Toimeaine', width: 'minmax(110px, 1fr)' }] : []),
    ...(showWarehouse ? [{ label: 'Ladu', width: 'minmax(100px, 0.9fr)' }] : []),
    { label: 'Kogus/ha', width: '84px', num: true },
    ...(showTotals ? [{ label: 'Kokku', width: '92px', num: true }] : []),
    ...(isFert ? [{ label: 'N kg/ha', width: '70px', num: true }, { label: 'P kg/ha', width: '70px', num: true }, { label: 'K kg/ha', width: '70px', num: true }] : []),
    { label: '', width: '28px' }
  ];
  const grid = { gridTemplateColumns: columns.map((c) => c.width).join(' ') };

  const seedMismatches = isSeed ? seedCropMismatches(rows.map((r) => r.articleId), articles, seedCheck) : [];

  return (
    <div className={PRIA_LINES}>
      {seedMismatches.length > 0 && (
        <Alert size="sm" className={infoNoticeClass} role="alert">
          <AlertTriangle size={14} />
          <span>
            Põllu kultuur on {seedCheck?.seasonCrop?.name}, aga {seedMismatches.map((m) => `„${m.articleName}" on ${m.seedCropName.toLowerCase()} seeme`).join(', ')}.
            Kontrolli seemet või külvikorra kultuuri.
          </span>
        </Alert>
      )}
      {rows.length > 0 && (
        <div className={cn(PRIA_GRID, PRIA_HEAD)} style={grid} aria-hidden="true">
          {columns.map((c, k) => <span key={k} className={c.num ? 'num' : undefined}>{c.label}</span>)}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className={PRIA_GRID} style={grid}>
          <FilterSelect fill size="sm" ariaLabel="Register/materjal" value={r.priaRegister} onChange={(v) => set(i, { priaRegister: v })}
            options={optionsOf('– vali –', registersFor(activity), r.priaRegister)} />
          <div className="flex min-w-0 flex-col">
            <FilterSelect fill size="sm" ariaLabel={isSeed ? 'Sort' : 'Toode'} value={r.articleId} onChange={(v) => pickArticle(i, v)}
              options={[{ value: '', label: r.label && !r.articleId ? r.label : '– Kulumaterjalidest –' }, ...options.map((m) => ({ value: m.id, label: m.name }))]} />
          </div>
          <Input size="sm" aria-label="Liik" placeholder={isSeed ? 'nt Suvinisu' : isTkv ? 'nt Herbitsiid' : 'nt NPK väetis'} value={r.priaKind} onChange={(e) => set(i, { priaKind: e.target.value })} />
          {isSeed && (
            <FilterSelect fill size="sm" ariaLabel="Seemne kategooria" value={r.priaSpec} onChange={(v) => set(i, { priaSpec: v })}
              options={optionsOf('–', SEED_CATEGORIES, r.priaSpec)} />
          )}
          {isTkv && <Input size="sm" aria-label="Toimeaine" value={r.activeIngredient} onChange={(e) => set(i, { activeIngredient: e.target.value })} />}
          {showWarehouse && (
            <FilterSelect fill size="sm" ariaLabel="Ladu" value={r.warehouseId} defaultValue={defaultWarehouseId} onChange={(v) => set(i, { warehouseId: v })}
              options={warehouseOptions(r.warehouseId)} />
          )}
          <NumberInput size="sm" decimals={3} aria-label="Kogus ha kohta" placeholder={`${r.unit}/ha`} value={numValue(r.ratePerHa)} onChange={(n) => setRate(i, numText(n))} />
          {showTotals && <NumberInput size="sm" decimals={3} aria-label="Kogus kokku" placeholder={r.unit} value={numValue(r.total)} onChange={(n) => setTotal(i, numText(n))} />}
          {isFert && (
            <>
              <NumberInput size="sm" decimals={3} aria-label="N kg/ha" value={numValue(r.nKgHa)} onChange={(n) => set(i, { nKgHa: numText(n) })} />
              <NumberInput size="sm" decimals={3} aria-label="P kg/ha" value={numValue(r.pKgHa)} onChange={(n) => set(i, { pKgHa: numText(n) })} />
              <NumberInput size="sm" decimals={3} aria-label="K kg/ha" value={numValue(r.kKgHa)} onChange={(n) => set(i, { kKgHa: numText(n) })} />
            </>
          )}
          <Button type="button" variant="danger-ghost" size="icon-sm" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, { ...emptyPriaRow(), warehouseId: defaultWarehouseId ?? '' }])}>
        <Plus size={13} /> Lisa {isSeed ? 'seeme' : 'materjal'}
      </Button>
    </div>
  );
};

// showBunkers: kandel punkrite arv (PRIA-s pole; hiljem tonnide arvutamiseks)
export const HarvestEditor: React.FC<{ value: HarvestRow; onChange: (v: HarvestRow) => void; areaHa: number; showTotals: boolean; showBunkers?: boolean; tonnesText?: string | null }> = ({ value, onChange, areaHa, showTotals, showBunkers, tonnesText }) => {
  // Sama veerupäisega ruudustik nagu materjaliridadel
  const grid = { gridTemplateColumns: `minmax(140px, 1.2fr) minmax(140px, 1.2fr) ${showBunkers ? '84px ' : ''}84px${showTotals ? ' 92px' : ''}` };
  return (
    <div className={PRIA_LINES}>
      <div className={cn(PRIA_GRID, PRIA_HEAD)} style={grid} aria-hidden="true">
        <span>Kultuuri tüüp</span>
        <span>Saagi tüüp</span>
        {showBunkers && <span className="num">Punkreid *</span>}
        {tonnesText != null
          ? <span className="num" style={{ gridColumn: `span ${showTotals ? 2 : 1}` }}>Saak, t</span>
          : <>
              <span className="num">Saak t/ha</span>
              {showTotals && <span className="num">Kokku, t</span>}
            </>}
      </div>
      <div className={PRIA_GRID} style={grid}>
        <FilterSelect fill size="sm" ariaLabel="Kultuuri tüüp" value={value.priaSpec} onChange={(v) => onChange({ ...value, priaSpec: v })}
          options={optionsOf('– vali –', CROP_TYPES, value.priaSpec)} />
        <FilterSelect fill size="sm" ariaLabel="Saagi tüüp" value={value.priaKind} onChange={(v) => onChange({ ...value, priaKind: v })}
          options={optionsOf('– vali –', YIELD_TYPES, value.priaKind)} />
        {showBunkers && (
          <NumberInput size="sm" aria-label="Punkreid" required placeholder="tk" value={numValue(value.bunkers)}
            onChange={(n) => onChange({ ...value, bunkers: numText(n) })} />
        )}
        {tonnesText != null ? (
          <span className="num" style={{ gridColumn: `span ${showTotals ? 2 : 1}` }}>{tonnesText}</span>
        ) : (
          <>
            <NumberInput size="sm" decimals={3} aria-label="Saak t/ha" placeholder="t/ha" value={numValue(value.ratePerHa)}
              onChange={(n) => onChange({ ...value, ratePerHa: numText(n), total: fmt(totalFromRate(n, areaHa)) })} />
            {showTotals && (
              <NumberInput size="sm" decimals={3} aria-label="Saak kokku t" placeholder="t" value={numValue(value.total)}
                onChange={(n) => onChange({ ...value, total: numText(n), ratePerHa: fmt(rateFromTotal(n, areaHa)) })} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const OBS_GRID = { gridTemplateColumns: 'minmax(140px, 1fr) minmax(160px, 1.6fr) 90px minmax(90px, 0.6fr) 28px' };

export const ObservationsEditor: React.FC<{ rows: WorkEntryObservation[]; onChange: (rows: WorkEntryObservation[]) => void }> = ({ rows, onChange }) => (
  <div className={PRIA_LINES}>
    {rows.length > 0 && (
      <div className={cn(PRIA_GRID, PRIA_HEAD)} style={OBS_GRID} aria-hidden="true">
        <span>Seire liik</span>
        <span>Leid</span>
        <span className="num">Kogus</span>
        <span>Ühik</span>
        <span />
      </div>
    )}
    {rows.map((o, i) => {
      const set = (p: Partial<WorkEntryObservation>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
      return (
        <div key={i} className={PRIA_GRID} style={OBS_GRID}>
          <FilterSelect fill size="sm" ariaLabel="Seire liik" value={o.priaRegister ?? ''} onChange={(v) => set({ priaRegister: v || null, unit: OBSERVATION_UNITS[v] ?? '' })}
            options={optionsOf('– vali –', Object.keys(OBSERVATION_UNITS), o.priaRegister ?? '')} />
          <Input size="sm" aria-label="Leid" placeholder="nt Põldsinep" value={o.label} onChange={(e) => set({ label: e.target.value })} />
          <ObservationQuantity value={o.quantity} unit={o.unit} onChange={(quantity) => set({ quantity })} />
          <span className="text-sm leading-natural text-muted-foreground">{o.unit}</span>
          <Button type="button" variant="danger-ghost" size="icon-sm" aria-label="Eemalda rida" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
        </div>
      );
    })}
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, { label: '', quantity: 0, unit: '', priaRegister: null }])}>
      <Plus size={13} /> Lisa leid
    </Button>
  </div>
);

// Seire kogus: tühi väli = 0 (olek on arv); kohalik väärtus hoiab tühja välja, et seda saaks tühjaks teha ja uuesti sisestada
const ObservationQuantity: React.FC<{ value: number; unit: string; onChange: (n: number) => void }> = ({ value, unit, onChange }) => {
  const [n, setN] = React.useState<number | null>(value);
  // Väärtus muutus väljastpoolt (nt eelmise rea eemaldamisel nihkuvad read indeksi võtmega): sünkrooni
  React.useEffect(() => {
    setN((cur) => ((cur ?? 0) === value ? cur : value));
  }, [value]);
  return (
    <NumberInput size="sm" decimals={3} aria-label="Kogus" placeholder={unit || 'kogus'} value={n}
      onChange={(x) => { setN(x); onChange(x ?? 0); }} />
  );
};
