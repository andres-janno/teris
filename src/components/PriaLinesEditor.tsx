// src/components/PriaLinesEditor.tsx — PRIA materjaliread (seeme, väetis, lubi, taimekaitse) tegevuse järgi.
// Kogus ha kohta ja kokku arvutavad teineteist pindala järgi (PRIA reegel). Samas failis saagi ja seire plokid.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FieldWorkPlanLine, Material, WorkEntryMaterial, WorkEntryObservation } from '../types/fieldWork';
import {
  PRIA_ACTIVITY, SEED_REGISTERS, SEED_CATEGORIES, FERTILIZER_REGISTERS, LIMING_REGISTERS, PLANT_PROTECTION_REGISTERS,
  CROP_TYPES, YIELD_TYPES, OBSERVATION_UNITS, totalFromRate, rateFromTotal, materialCategoryFor
} from '../services/pria';

export interface PriaRow {
  materialId: string; label: string; unit: string; ratePerHa: string; total: string;
  priaRegister: string; priaKind: string; priaSpec: string; activeIngredient: string; nKgHa: string; pKgHa: string; kKgHa: string;
}

export interface HarvestRow { ratePerHa: string; total: string; priaKind: string; priaSpec: string }

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 3, useGrouping: false }));

export const emptyPriaRow = (): PriaRow => ({
  materialId: '', label: '', unit: 'kg', ratePerHa: '', total: '', priaRegister: '', priaKind: '', priaSpec: '', activeIngredient: '', nKgHa: '', pKgHa: '', kKgHa: ''
});

// Plaanirida (FieldWorkPlanLine) või kande materjal (WorkEntryMaterial) vormireaks
export const planLineToRow = (l: FieldWorkPlanLine | WorkEntryMaterial, areaHa: number): PriaRow => {
  const label = 'label' in l ? l.label : l.name;
  const quantity = 'quantity' in l ? l.quantity : null;
  const ratePerHa = l.ratePerHa ?? null;
  return {
    materialId: l.materialId ?? '', label: label ?? '', unit: l.unit ?? 'kg',
    ratePerHa: fmt(ratePerHa ?? rateFromTotal(quantity, areaHa)),
    total: fmt(quantity ?? totalFromRate(ratePerHa, areaHa)),
    priaRegister: l.priaRegister ?? '', priaKind: l.priaKind ?? '', priaSpec: l.priaSpec ?? '', activeIngredient: l.activeIngredient ?? '',
    nKgHa: fmt(l.nKgHa), pKgHa: fmt(l.pKgHa), kKgHa: fmt(l.kKgHa)
  };
};

export const rowPria = (r: PriaRow) => ({
  priaRegister: r.priaRegister || null, priaKind: r.priaKind || null, priaSpec: r.priaSpec || null,
  activeIngredient: r.activeIngredient || null, nKgHa: parseNum(r.nKgHa), pKgHa: parseNum(r.pKgHa), kKgHa: parseNum(r.kKgHa)
});

export const rowToPlanLine = (r: PriaRow): FieldWorkPlanLine | null =>
  r.label.trim() ? { kind: 'MATERIAL', materialId: r.materialId || null, label: r.label.trim(), unit: r.unit, ratePerHa: parseNum(r.ratePerHa), ...rowPria(r) } : null;

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
  materials: Material[];
  areaHa: number;
  showTotals: boolean; // kandel kogus kokku, plaanil ainult norm
}

export const PriaLinesEditor: React.FC<PriaLinesEditorProps> = ({ activity, rows, onChange, materials, areaHa, showTotals }) => {
  const category = materialCategoryFor(activity);
  const options = materials.filter((m) => (m.category === category && m.isActive) || rows.some((r) => r.materialId === m.id));
  const isSeed = activity === PRIA_ACTIVITY.SOWING;
  const isFert = activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING;
  const isTkv = activity === PRIA_ACTIVITY.PLANT_PROTECTION;
  const set = (i: number, patch: Partial<PriaRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setRate = (i: number, v: string) => set(i, { ratePerHa: v, total: fmt(totalFromRate(parseNum(v), areaHa)) });
  const setTotal = (i: number, v: string) => set(i, { total: v, ratePerHa: fmt(rateFromTotal(parseNum(v), areaHa)) });
  const pickMaterial = (i: number, id: string) => {
    const m = materials.find((x) => x.id === id);
    set(i, m ? { materialId: m.id, label: m.name, unit: m.unit } : { materialId: '', label: '' });
  };

  return (
    <div className="pria-lines">
      {rows.map((r, i) => (
        <div key={i} className="pria-line">
          <select className="form-input" aria-label="Register/materjal" value={r.priaRegister} onChange={(e) => set(i, { priaRegister: e.target.value })}>
            <option value="">– register/materjal –</option>
            {registersFor(activity).map((x) => <option key={x} value={x}>{x}</option>)}
            {r.priaRegister && !registersFor(activity).includes(r.priaRegister) && <option value={r.priaRegister}>{r.priaRegister}</option>}
          </select>
          <select className="form-input" aria-label="Toode" value={r.materialId} onChange={(e) => pickMaterial(i, e.target.value)}>
            <option value="">{r.label && !r.materialId ? r.label : '– vali Kulumaterjalidest –'}</option>
            {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {!r.materialId && (
            <input className="form-input" aria-label="Toote nimi" placeholder="või kirjuta nimi" value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
          )}
          <input className="form-input" aria-label={isSeed ? 'Liik' : 'Liik/tüüp'} placeholder={isSeed ? 'Liik (nt Suvinisu)' : isTkv ? 'Liik (nt Herbitsiid)' : 'Väetise liik'} value={r.priaKind} onChange={(e) => set(i, { priaKind: e.target.value })} />
          {isSeed && (
            <select className="form-input" aria-label="Seemne kategooria" value={r.priaSpec} onChange={(e) => set(i, { priaSpec: e.target.value })}>
              <option value="">– kategooria –</option>
              {SEED_CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          {isTkv && <input className="form-input" aria-label="Toimeaine" placeholder="Toimeaine" value={r.activeIngredient} onChange={(e) => set(i, { activeIngredient: e.target.value })} />}
          <input className="form-input num" aria-label="Kogus ha kohta" inputMode="decimal" placeholder={`${r.unit}/ha`} value={r.ratePerHa} onChange={(e) => setRate(i, e.target.value)} />
          {showTotals && <input className="form-input num" aria-label="Kogus kokku" inputMode="decimal" placeholder={`${r.unit} kokku`} value={r.total} onChange={(e) => setTotal(i, e.target.value)} />}
          {isFert && (
            <>
              <input className="form-input num" aria-label="N kg/ha" inputMode="decimal" placeholder="N kg/ha" value={r.nKgHa} onChange={(e) => set(i, { nKgHa: e.target.value })} />
              <input className="form-input num" aria-label="P kg/ha" inputMode="decimal" placeholder="P kg/ha" value={r.pKgHa} onChange={(e) => set(i, { pKgHa: e.target.value })} />
              <input className="form-input num" aria-label="K kg/ha" inputMode="decimal" placeholder="K kg/ha" value={r.kKgHa} onChange={(e) => set(i, { kKgHa: e.target.value })} />
            </>
          )}
          <button type="button" className="icon-btn-danger" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...rows, emptyPriaRow()])}>
        <Plus size={13} /> Lisa {isSeed ? 'seeme' : 'materjal'}
      </button>
    </div>
  );
};

export const HarvestEditor: React.FC<{ value: HarvestRow; onChange: (v: HarvestRow) => void; areaHa: number; showTotals: boolean }> = ({ value, onChange, areaHa, showTotals }) => (
  <div className="pria-line">
    <select className="form-input" aria-label="Kultuuri tüüp" value={value.priaSpec} onChange={(e) => onChange({ ...value, priaSpec: e.target.value })}>
      <option value="">– kultuuri tüüp –</option>
      {CROP_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
    <select className="form-input" aria-label="Saagi tüüp" value={value.priaKind} onChange={(e) => onChange({ ...value, priaKind: e.target.value })}>
      <option value="">– saagi tüüp –</option>
      {YIELD_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
    <input className="form-input num" aria-label="Saak t/ha" inputMode="decimal" placeholder="t/ha" value={value.ratePerHa}
      onChange={(e) => onChange({ ...value, ratePerHa: e.target.value, total: fmt(totalFromRate(parseNum(e.target.value), areaHa)) })} />
    {showTotals && (
      <input className="form-input num" aria-label="Saak kokku t" inputMode="decimal" placeholder="t kokku" value={value.total}
        onChange={(e) => onChange({ ...value, total: e.target.value, ratePerHa: fmt(rateFromTotal(parseNum(e.target.value), areaHa)) })} />
    )}
  </div>
);

export const ObservationsEditor: React.FC<{ rows: WorkEntryObservation[]; onChange: (rows: WorkEntryObservation[]) => void }> = ({ rows, onChange }) => (
  <div className="pria-lines">
    {rows.map((o, i) => {
      const set = (p: Partial<WorkEntryObservation>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
      return (
        <div key={i} className="pria-line">
          <select className="form-input" aria-label="Seire liik" value={o.priaRegister ?? ''} onChange={(e) => set({ priaRegister: e.target.value || null, unit: OBSERVATION_UNITS[e.target.value] ?? '' })}>
            <option value="">– seire liik –</option>
            {Object.keys(OBSERVATION_UNITS).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="form-input" aria-label="Leid" placeholder="Leid (nt Põldsinep)" value={o.label} onChange={(e) => set({ label: e.target.value })} />
          <ObservationQuantity value={o.quantity} unit={o.unit} onChange={(quantity) => set({ quantity })} />
          <span className="work-entry-unit">{o.unit}</span>
          <button type="button" className="icon-btn-danger" aria-label="Eemalda rida" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      );
    })}
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...rows, { label: '', quantity: 0, unit: '', priaRegister: null }])}>
      <Plus size={13} /> Lisa leid
    </button>
  </div>
);

// Seire koguse sisend hoiab teksti eraldi, et komaga arvu (nt "2,") saaks sisestada
const ObservationQuantity: React.FC<{ value: number; unit: string; onChange: (n: number) => void }> = ({ value, unit, onChange }) => {
  const [text, setText] = React.useState(fmt(value));
  return (
    <input className="form-input num" aria-label="Kogus" inputMode="decimal" placeholder={unit || 'kogus'} value={text}
      onChange={(e) => { setText(e.target.value); onChange(parseNum(e.target.value) ?? 0); }} />
  );
};
