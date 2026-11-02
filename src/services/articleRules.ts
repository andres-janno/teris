// src/services/articleRules.ts — artiklite liigitus ja liigist sõltuvad väljad (server ja klient)
import type { PriaArticleKind } from '../types/fieldWork.ts';

export type ArticleGroup = 'SERVICE' | 'CONSUMABLE' | 'PRODUCE' | 'OTHER_GOODS';
export type ArticleSystemKind =
  | 'LABOR_TIME' | 'MACHINE_TIME' | 'IMPLEMENT_TIME' | 'DRYING_TIME'
  | 'SEED' | 'FERTILIZER' | 'PLANT_PROTECTION' | 'FUEL' | 'DRYING_OIL'
  | 'GRAIN';

export const ARTICLE_GROUPS: ArticleGroup[] = ['SERVICE', 'CONSUMABLE', 'PRODUCE', 'OTHER_GOODS'];

export const ARTICLE_GROUP_LABEL: Record<ArticleGroup, string> = {
  SERVICE: 'Teenus',
  CONSUMABLE: 'Kulumaterjal',
  PRODUCE: 'Toodang',
  OTHER_GOODS: 'Muu kaup'
};

// Süsteemsed liigid: iga ettevõte saab need automaatselt; loogika käitub systemKind'i järgi
export const SYSTEM_CATEGORIES: { systemKind: ArticleSystemKind; group: ArticleGroup; name: string; sortOrder: number }[] = [
  { systemKind: 'LABOR_TIME', group: 'SERVICE', name: 'Töötaja tööaeg', sortOrder: 10 },
  { systemKind: 'MACHINE_TIME', group: 'SERVICE', name: 'Masina tööaeg', sortOrder: 20 },
  { systemKind: 'IMPLEMENT_TIME', group: 'SERVICE', name: 'Haakeriista tööaeg', sortOrder: 30 },
  { systemKind: 'DRYING_TIME', group: 'SERVICE', name: 'Kuivatamise tööaeg', sortOrder: 40 },
  { systemKind: 'SEED', group: 'CONSUMABLE', name: 'Seeme', sortOrder: 110 },
  { systemKind: 'FERTILIZER', group: 'CONSUMABLE', name: 'Väetis', sortOrder: 120 },
  { systemKind: 'PLANT_PROTECTION', group: 'CONSUMABLE', name: 'Taimekaitsevahend', sortOrder: 130 },
  { systemKind: 'FUEL', group: 'CONSUMABLE', name: 'Kütus', sortOrder: 140 },
  { systemKind: 'DRYING_OIL', group: 'CONSUMABLE', name: 'Kuivatusõli', sortOrder: 150 },
  { systemKind: 'GRAIN', group: 'PRODUCE', name: 'Terad', sortOrder: 210 }
];

// PRIA import paneb muud kulumaterjalid sellesse liiki (luuakse vajadusel)
export const OTHER_CONSUMABLE_NAME = 'Muu kulumaterjal';

const PRIA_KINDS: ReadonlySet<ArticleSystemKind> = new Set(['SEED', 'FERTILIZER', 'PLANT_PROTECTION']);
// Kütus ja kuivatusõli lähevad oma ridadele, mitte tavalise kulumaterjali alla
const OWN_LINE_KINDS: ReadonlySet<ArticleSystemKind> = new Set(['FUEL', 'DRYING_OIL']);

/** Kaup = laoarvestusega artikkel; teenuse üle laoarvestust ei peeta. */
export const isGoods = (group: ArticleGroup): boolean => group !== 'SERVICE';

export interface ArticleFieldRules {
  pria: boolean; // PRIA register ja liik
  seed: boolean; // sort ja seemne kategooria
  fertilizer: boolean; // N, P, K %
  plantProtection: boolean; // toimeaine
  price: boolean; // teenuse ühiku hind
  crop: boolean; // terade kultuur
  defaultWarehouse: boolean; // kauba vaikimisi ladu
  stock: boolean; // laoseis
}

export function articleFieldRules(group: ArticleGroup, systemKind: ArticleSystemKind | null): ArticleFieldRules {
  const goods = isGoods(group);
  return {
    pria: !!systemKind && PRIA_KINDS.has(systemKind),
    seed: systemKind === 'SEED',
    fertilizer: systemKind === 'FERTILIZER',
    plantProtection: systemKind === 'PLANT_PROTECTION',
    price: !goods,
    crop: systemKind === 'GRAIN',
    defaultWarehouse: goods,
    stock: goods
  };
}

export interface ArticleOptionalFields {
  price: number | null;
  cropId: string | null;
  defaultWarehouseId: string | null;
  cropVarietyId: string | null;
  priaRegister: string | null;
  priaKind: string | null;
  priaSpec: string | null;
  activeIngredient: string | null;
  nPct: number | null;
  pPct: number | null;
  kPct: number | null;
}

/** Liigiga sobimatud väljad tühjendatakse (nt liigi muutmisel). */
export function sanitizeArticleFields<T extends ArticleOptionalFields>(f: T, r: ArticleFieldRules): T {
  return {
    ...f,
    price: r.price ? f.price : null,
    cropId: r.crop ? f.cropId : null,
    defaultWarehouseId: r.defaultWarehouse ? f.defaultWarehouseId : null,
    cropVarietyId: r.seed ? f.cropVarietyId : null,
    priaRegister: r.pria ? f.priaRegister : null,
    priaKind: r.pria ? f.priaKind : null,
    priaSpec: r.seed ? f.priaSpec : null,
    activeIngredient: r.plantProtection ? f.activeIngredient : null,
    nPct: r.fertilizer ? f.nPct : null,
    pPct: r.fertilizer ? f.pPct : null,
    kPct: r.fertilizer ? f.kPct : null
  };
}

/** Kas artikkel sobib PRIA tegevuse materjalireale (OTHER = muu kulumaterjal). */
export function matchesPriaKind(a: { group: ArticleGroup; systemKind: ArticleSystemKind | null }, kind: PriaArticleKind): boolean {
  if (kind === 'OTHER') {
    return a.group === 'CONSUMABLE' && !(a.systemKind && (PRIA_KINDS.has(a.systemKind) || OWN_LINE_KINDS.has(a.systemKind)));
  }
  return a.systemKind === kind;
}

export type ArticleLineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST' | 'OBSERVATION';

/** Kas artikkel sobib kande- või plaanireale (tööaeg → vastav teenus, kütus → kütus, materjal → muu kulumaterjal). */
export function articleAllowedOnLine(kind: ArticleLineKind, a: { group: ArticleGroup; systemKind: ArticleSystemKind | null }): boolean {
  switch (kind) {
    case 'LABOR': return a.group === 'SERVICE' && a.systemKind === 'LABOR_TIME';
    case 'MACHINE': return a.group === 'SERVICE' && a.systemKind === 'MACHINE_TIME';
    case 'IMPLEMENT': return a.group === 'SERVICE' && a.systemKind === 'IMPLEMENT_TIME';
    case 'FUEL': return a.systemKind === 'FUEL';
    case 'MATERIAL': return a.group === 'CONSUMABLE' && !(a.systemKind && OWN_LINE_KINDS.has(a.systemKind));
    default: return false;
  }
}

/** Liigi lisamise/muutmise kontroll; null = lubatud. */
export function categoryChangeError(
  old: { group: ArticleGroup; systemKind: ArticleSystemKind | null } | null,
  nextGroup: ArticleGroup
): string | null {
  if (!old || old.group === nextGroup) return null;
  if (old.systemKind) return 'Süsteemse liigi rühma ei saa muuta';
  if (isGoods(old.group) !== isGoods(nextGroup)) return 'Liiki ei saa teenuse ja kauba vahel ümber tõsta';
  return null;
}

/** Tööaja süsteemsed liigid; igal on täpselt üks vaikimisi teenusartikkel (src/server/entryArticles.ts). */
export const SERVICE_TIME_KINDS: ArticleSystemKind[] = ['LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME'];

/** Tööaja rea hind: ressursi tunnihind → ressursi teenusartikli hind → vaikimisi teenuse hind → tühi. */
export function pickServicePrice(resourceRate: number | null, resourceArticlePrice: number | null, defaultArticlePrice: number | null): number | null {
  return resourceRate ?? resourceArticlePrice ?? defaultArticlePrice ?? null;
}

/** Kande kütuseartikkel: masina vaikimisi kütus, muidu ettevõtte ainus aktiivne kütus; mitme või puudumisel null. */
export function pickFuelArticleId(vehicleFuelId: string | null, activeFuelIds: string[]): string | null {
  if (vehicleFuelId) return vehicleFuelId;
  return activeFuelIds.length === 1 ? activeFuelIds[0] : null;
}

/** Ladu, kust kanderida maha kantakse: kütus artikli vaikimisi laost (nt mahuti), kulumaterjal kande laost. */
export function entryLineWarehouseId(kind: 'MATERIAL' | 'FUEL', articleDefaultWarehouseId: string | null, entryWarehouseId: string): string {
  return kind === 'FUEL' && articleDefaultWarehouseId ? articleDefaultWarehouseId : entryWarehouseId;
}
