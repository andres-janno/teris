// src/services/harvestLotRules.ts — saagipartii reeglid (puhtad funktsioonid): punkri kaal sulgemisel,
// kande saagi tonnid, kuivatuskulu osakaalud põldudele, automaatse partii nimi.
import { pickServicePrice } from './articleRules.ts';

/** Partii kanne jaotuse ja sulgemise jaoks. */
export interface LotEntryShare {
  key: string; // jaotuse võti (nt põlluhooaja id); sama võtmega kanded liidetakse
  bunkers: number | null;
  manual: boolean; // tonnid käsitsi lukustatud
  tonnes: number; // saagirea kogus
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Punkri kaal: (Σ kaalumised − Σ lukustatud kannete tonnid) / Σ lukustamata kannete punkrid. */
export function computeBunkerTonnes(weighedTonnes: number, entries: LotEntryShare[]): { ok: true; bunkerTonnes: number } | { ok: false; error: string } {
  const lockedTonnes = entries.filter((x) => x.manual).reduce((s, x) => s + x.tonnes, 0);
  const bunkers = entries.filter((x) => !x.manual).reduce((s, x) => s + (x.bunkers ?? 0), 0);
  if (!(bunkers > 0)) return { ok: false, error: 'Partiis pole punkritega kandeid, mille tonne arvutada' };
  const rest = weighedTonnes - lockedTonnes;
  if (rest < 0) return { ok: false, error: 'Kaalutud kogus on väiksem kui käsitsi sisestatud tonnid' };
  return { ok: true, bunkerTonnes: round6(rest / bunkers) };
}

/** Lukustamata kande saagi tonnid: punkrid × punkri kaal; lahtises partiis (punkri kaal puudub) 0 — kaalumata. */
export function entryHarvestTonnes(bunkers: number | null, bunkerTonnes: number | null): number {
  if (bunkerTonnes === null || !(bunkers && bunkers > 0)) return 0;
  return round6(bunkers * bunkerTonnes);
}

/**
 * Partii kulu osakaalud võtme kaupa võrdpunkrite järgi: lukustamata kanne = punkrid;
 * lukustatud kanne = tonnid / punkri kaal (lahtises partiis tema punkrid).
 */
export function lotCostShares(bunkerTonnes: number | null, entries: LotEntryShare[]): Map<string, number> {
  const weights = entries.map((x) => ({
    key: x.key,
    w: Math.max(0, x.manual && bunkerTonnes && bunkerTonnes > 0 ? x.tonnes / bunkerTonnes : x.bunkers ?? 0)
  }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  const out = new Map<string, number>();
  if (!(total > 0)) return out;
  for (const x of weights) out.set(x.key, (out.get(x.key) ?? 0) + x.w / total);
  return out;
}

/** Automaatse partii nimi „‹kultuur› ‹aasta›“; võetud nime korral järjenumber. */
export function defaultLotName(cropName: string, year: number, taken: string[]): string {
  const base = `${cropName} ${year}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
}

/** Kuivatusteenuse ühikuhind: artikli hind, puudumisel sama liigi vaikimisi teenuse hind (ressursi samm jääb vahele). */
export const lotServicePrice = (articlePrice: number | null, defaultPrice: number | null): number | null =>
  pickServicePrice(null, articlePrice, defaultPrice);
