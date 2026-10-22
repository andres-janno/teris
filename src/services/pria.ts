// src/services/pria.ts — PRIA e-põlluraamatu klassifikaatorid ja puhtad abifunktsioonid
// (kasutavad nii klient kui server). Väärtused on PRIA andmed ja jäävad eesti keelde.
import type { MaterialCategory, WorkPhase } from '../types/fieldWork.ts';

export interface PriaActivity {
  name: string;
  phase: WorkPhase;
  usesMaterials: boolean;
  sortOrder: number;
}

const A = (name: string, phase: WorkPhase, usesMaterials = false) => ({ name, phase, usesMaterials });

// PRIA e-põlluraamatu 29 tegevust (järjekord töö loogika järgi)
export const PRIA_ACTIVITIES: readonly PriaActivity[] = [
  A('Kündmine', 'PREPARATION'),
  A('Kultiveerimine', 'PREPARATION'),
  A('Randaalimine', 'PREPARATION'),
  A('Libistamine', 'PREPARATION'),
  A('Äestamine', 'PREPARATION'),
  A('Freesimine', 'PREPARATION'),
  A('Sügavkobestamine', 'PREPARATION'),
  A('Vagude moodustamine', 'PREPARATION'),
  A('Kivikorjamine', 'PREPARATION'),
  A('Rullimine', 'PREPARATION'),
  A('Lupjamine', 'PREPARATION', true),
  A('Külvamine/istutamine', 'SOWING', true),
  A('Väetamine', 'CARE', true),
  A('Taimekaitsevahendi kasutamine', 'CARE', true),
  A('Seire', 'CARE'),
  A('Vaheltharimine', 'CARE'),
  A('Leegitamine', 'CARE'),
  A('Istandike hooldus', 'CARE'),
  A('Kastmine', 'CARE'),
  A('Purustusniide (hekseldamine)', 'CARE'),
  A('Niitmine', 'CARE'),
  A('Kaarutamine', 'CARE'),
  A('Vaalutamine', 'CARE'),
  A('Karjatamine', 'CARE'),
  A('Maaparandushoiutööd', 'CARE'),
  A('Sõnniku aunastamine', 'CARE'),
  A('Mullaproovi võtmine', 'CARE'),
  A('Saagikoristus', 'HARVEST'),
  A('Saagi vedu põllult', 'HARVEST')
].map((a, i) => ({ ...a, sortOrder: i }));

export const PRIA_ACTIVITY = {
  SOWING: 'Külvamine/istutamine',
  HARVEST: 'Saagikoristus',
  FERTILIZING: 'Väetamine',
  LIMING: 'Lupjamine',
  PLANT_PROTECTION: 'Taimekaitsevahendi kasutamine',
  MONITORING: 'Seire'
} as const;

// Enne PRIA klassifikaatorit kasutatud töötüübid → PRIA tegevus (migratsioon)
export const LEGACY_WORK_TYPE_MAP: Readonly<Record<string, string>> = {
  'Kõrrekoorimine': 'Randaalimine',
  'Künd': 'Kündmine',
  'Kivikoristus': 'Kivikorjamine',
  'Randaalimine': 'Randaalimine',
  'Libistamine': 'Libistamine',
  'Rullimine': 'Rullimine',
  'Umbrohutõrje (enne külvi)': 'Taimekaitsevahendi kasutamine',
  'Umbrohutõrje': 'Taimekaitsevahendi kasutamine',
  'Taimekaitse': 'Taimekaitsevahendi kasutamine',
  'Külv': 'Külvamine/istutamine',
  'Väetamine': 'Väetamine',
  'Leheväetamine': 'Väetamine',
  'Seire': 'Seire',
  'Koristus': 'Saagikoristus'
};

export const FERTILIZING_METHODS = ['Pindlaotamine', 'Paisklaotamine', 'Sisestuslaotamine', 'Pritsimine'] as const;
export const SEED_REGISTERS = ['Eesti sordiregister', 'EL ühtne sordileht', 'Muu'] as const;
export const SEED_CATEGORIES = ['OTS', 'AS', 'SE', 'E', 'C1', 'C2', 'C3', 'C', 'ST', 'GR', 'HM', 'CAC', 'PBTC', 'PB', 'S', 'A', 'B', 'F1'] as const;
export const FERTILIZER_REGISTERS = [
  'Väetis registrist', 'EL väetisetooted ja muud', 'Vedelsõnnik sh töödeldult', 'Poolvedelsõnnik sh töödeldult',
  'Tahesõnnik sh töödeldult', 'Sügavallapanusõnnik sh töödeldult', 'Silomahl', 'Kompost, mis ei sisalda sõnnikut',
  'Digestaat mis ei sisalda sõnnikut', 'Vadak', 'Reoveesete'
] as const;
export const LIMING_REGISTERS = [
  'Lubiväetis registrist', 'EL väetisetooted ja muud', 'Tuhk', 'Klinkritolm', 'Dolomiidijahu', 'Lubjakivijahu', 'Tolmpõlevkivituhk'
] as const;
export const PLANT_PROTECTION_REGISTERS = [
  'Taimekaitsevahendid registrist', 'Märgaja/kleepaine', 'Biostimulaator', 'Kasvuinhibiitor', 'Desikant'
] as const;
export const CROP_TYPES = ['Põhikultuur', 'Allakülv', 'Vahekultuur', 'KSM vahekultuur'] as const;
export const YIELD_TYPES = [
  'Terad', 'Haljasmass', 'Pallisilo', 'Hein', 'Põhk', 'Tervikkoristus', 'Marjad', 'Köögiviljad', 'Seemned',
  'Pealsed (Jäägid)', 'Viljad', 'Põletatud jäägid', 'Jääb põllule'
] as const;
// Seire liik → koguse ühik (PRIA määrab ühiku liigi järgi)
export const OBSERVATION_UNITS: Readonly<Record<string, string>> = {
  'Taimehaigused': '% lehepinnast',
  'Umbrohud': 'taime/m2',
  'Kahjurid': 'tk taime kohta',
  'Sündmused': '% külvatud pinnast'
};

export interface PriaAttrs {
  priaRegister: string | null;
  priaKind: string | null;
  priaSpec: string | null;
  activeIngredient: string | null;
  nKgHa: number | null;
  pKgHa: number | null;
  kKgHa: number | null;
}

export const EMPTY_PRIA_ATTRS: PriaAttrs = {
  priaRegister: null, priaKind: null, priaSpec: null, activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null
};

export function materialCategoryFor(activity: string, _priaRegister?: string | null): MaterialCategory {
  if (activity === PRIA_ACTIVITY.SOWING) return 'SEED';
  if (activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING) return 'FERTILIZER';
  if (activity === PRIA_ACTIVITY.PLANT_PROTECTION) return 'PLANT_PROTECTION';
  return 'OTHER';
}

// "kg/ha" → "kg"; ühikud ilma "/ha" osata jäävad samaks
export const baseUnit = (unit: string | null | undefined): string => (unit ?? '').replace(/\/ha$/, '').trim();

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const totalFromRate = (rate: number | null, areaHa: number | null): number | null =>
  rate == null || areaHa == null ? null : round2(rate * areaHa);

export const rateFromTotal = (total: number | null, areaHa: number | null): number | null =>
  total == null || !areaHa ? null : round2(total / areaHa);

export const nameKey = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const dayNo = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000);

// Kahe kuupäevavahemiku vahe päevades (0, kui lõikuvad). ISO "aaaa-kk-pp"; to = null → üks päev.
export function daysApart(a: { from: string; to: string | null }, b: { from: string; to: string | null }): number {
  const a1 = dayNo(a.from), a2 = dayNo(a.to ?? a.from);
  const b1 = dayNo(b.from), b2 = dayNo(b.to ?? b.from);
  if (a1 <= b2 && b1 <= a2) return 0;
  return a2 < b1 ? b1 - a2 : a1 - b2;
}
