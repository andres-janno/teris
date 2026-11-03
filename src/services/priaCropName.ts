// src/services/priaCropName.ts — hooaja PRIA kultuuri nimetus registri kultuurist, sordist ja allakülvist.
// PRIA nimekirja Teris ei hoia: reegel on kultuuride registris (PRIA nimetus + allakülvi variandid), sama kliendis ja serveris.

export type Undersowing = 'NONE' | 'OTHER' | 'LEGUME';

export const UNDERSOWING_LABELS: Record<Undersowing, string> = {
  NONE: 'Allakülvita',
  OTHER: 'Allakülviga (v.a liblikõielised)',
  LEGUME: 'Liblikõieliste allakülviga'
};

// PRIA nimekirja järelliited
export const UNDERSOWING_SUFFIX: Record<Undersowing, string> = {
  NONE: ' allakülvita',
  OTHER: ' allakülviga, v.a liblikõieliste allakülviga',
  LEGUME: ' liblikõieliste allakülviga'
};

export interface PriaCropRules {
  name: string;
  priaName?: string | null;
  priaUndersowing?: boolean | null;
  priaNameWithoutUndersowing?: string | null;
  priaNameWithUndersowing?: string | null;
  priaNameWithLegumeUndersowing?: string | null;
}

export interface PriaVarietyRules {
  priaName?: string | null;
}

const VARIANT_FIELD: Record<Undersowing, 'priaNameWithoutUndersowing' | 'priaNameWithUndersowing' | 'priaNameWithLegumeUndersowing'> = {
  NONE: 'priaNameWithoutUndersowing',
  OTHER: 'priaNameWithUndersowing',
  LEGUME: 'priaNameWithLegumeUndersowing'
};

const clean = (s: string | null | undefined) => (s ?? '').trim();

/** PRIA nimetuse alus: kultuuri PRIA nimetus või kultuuri nimi. */
export const priaBaseName = (crop: PriaCropRules) => clean(crop.priaName) || crop.name;

/** Allakülvi variandi vaikenimi (alus + PRIA järelliide). */
export const defaultPriaVariantName = (base: string, undersowing: Undersowing) => base + UNDERSOWING_SUFFIX[undersowing];

/** Hooaja PRIA kultuur. Sordi PRIA nimetus asendab kultuuri aluse (erandnimed siis ei kehti). */
export function derivePriaCropName(crop: PriaCropRules, variety: PriaVarietyRules | null | undefined, undersowing: Undersowing): string {
  const varietyBase = clean(variety?.priaName);
  if (varietyBase) return crop.priaUndersowing ? defaultPriaVariantName(varietyBase, undersowing) : varietyBase;
  const base = priaBaseName(crop);
  if (!crop.priaUndersowing) return base;
  return clean(crop[VARIANT_FIELD[undersowing]]) || defaultPriaVariantName(base, undersowing);
}

/** Allakülv PRIA nimest ("… allakülviga, v.a liblikõieliste allakülviga" on muu allakülv). */
export function parseUndersowing(priaText: string | null | undefined): Undersowing {
  const t = clean(priaText).toLowerCase();
  if (/allakülviga,\s*v\.a\.?\s*liblikõieliste/.test(t)) return 'OTHER';
  if (/liblikõieliste\s+allakülviga/.test(t)) return 'LEGUME';
  if (/allakülviga/.test(t)) return 'OTHER';
  return 'NONE';
}

/** Kas PRIA nimes on allakülvi variant. */
export const hasUndersowingVariant = (priaText: string | null | undefined) => /allakülvi(ta|ga)/i.test(clean(priaText));

/** PRIA nime alus ilma allakülvi järelliiteta ("Talinisu allakülvita" → "Talinisu"). */
export function stripUndersowing(priaText: string): string {
  return priaText
    .replace(/,?\s*(liblikõieliste\s+)?allakülviga(,\s*v\.a\.?\s*liblikõieliste\s+allakülviga)?\s*$/i, '')
    .replace(/,?\s*allakülvita\s*$/i, '')
    .trim();
}
