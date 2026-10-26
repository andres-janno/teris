// src/server/fieldSeasonCopy.ts — uue hooaja kirje loomine põllu viimase varasema aasta põhjal.

/** Hooaja kirje väljad, mis uude aastasse kopeeritakse. */
export interface SeasonSource {
  year: number;
  areaHa: number;
  eligibleAreaHa: number | null;
  crop: string;
  cropVariety: string | null;
  cropColor: string;
  cropId: string | null;
  varietyId: string | null;
  targetYieldTonsHa: number | null;
  geometry: unknown;
  boundaryPointsCount: number | null;
  perimeterM: number | null;
}

/** Katastriüksuse seos, mis uude aastasse kopeeritakse. */
export interface ParcelLinkSource {
  cadastralParcelId: number;
  fieldAreaHa: number;
  ownershipType: 'OWNED' | 'RENTED';
  ownerName: string | null;
  ownerPartyId: string | null;
  landTaxEurHa: number | null;
  landTaxEurYear: number | null;
  rentFeeEurHa: number | null;
  rentFeeEurYear: number | null;
  notes: string | null;
}

/** Viimane aasta enne sihtaastat; kui varasemat pole, siis null (põldu ei kopeerita). */
export function latestEarlierSeason<T extends { year: number }>(records: T[], year: number): T | null {
  let best: T | null = null;
  for (const r of records) {
    if (r.year < year && (!best || r.year > best.year)) best = r;
  }
  return best;
}

/** Uue aasta kirje: pindala, kultuur ja piirid eelmisest aastast, tööd nullist. */
export function buildCopiedSeason(src: SeasonSource, fieldId: number, year: number, seasonId: number | null) {
  return {
    fieldId,
    seasonId,
    year,
    areaHa: src.areaHa,
    eligibleAreaHa: src.eligibleAreaHa,
    crop: src.crop,
    cropVariety: src.cropVariety,
    cropColor: src.cropColor,
    cropId: src.cropId,
    varietyId: src.varietyId,
    targetYieldTonsHa: src.targetYieldTonsHa,
    geometry: src.geometry as object,
    boundaryPointsCount: src.boundaryPointsCount,
    perimeterM: src.perimeterM,
    status: 'NOT_STARTED' as const,
    workedAreaHa: 0,
    workProgress: 0
  };
}

/** Katastriüksuse seos uuele hooaja kirjele (sama üksus, pindala, omand, maksud). */
export function buildCopiedParcelLink(link: ParcelLinkSource, fieldSeasonId: number) {
  return {
    fieldSeasonId,
    cadastralParcelId: link.cadastralParcelId,
    fieldAreaHa: link.fieldAreaHa,
    ownershipType: link.ownershipType,
    ownerName: link.ownerName,
    ownerPartyId: link.ownerPartyId,
    landTaxEurHa: link.landTaxEurHa,
    landTaxEurYear: link.landTaxEurYear,
    rentFeeEurHa: link.rentFeeEurHa,
    rentFeeEurYear: link.rentFeeEurYear,
    notes: link.notes
  };
}
