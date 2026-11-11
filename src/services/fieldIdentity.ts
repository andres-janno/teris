// src/services/fieldIdentity.ts — põllu identiteet üle aastate: sama massiiv + kattuv kuju.
// Põllu number ja operaator muutuvad aastati (PRIA failis eri kirjapilt, maad harib eri ettevõte),
// kuju ja massiiv jäävad. Kasutab PRIA import (vaste otsimine) ja topeltpõldude liitmise skript.
import * as turf from '@turf/turf';

// Kattuvus = ühisosa pindala / suurema kuju pindala: väike tükk suure sees (jagamine, lõigatud nurk) ei loe samaks põlluks;
// jagamisel jätkab vana põldu tükk, mis katab sellest üle poole
export const MIN_OVERLAP = 0.5;

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
const isArea = (g: unknown): g is Geom => !!g && typeof g === 'object' && ['Polygon', 'MultiPolygon'].includes((g as { type?: string }).type ?? '');

export function overlapRatio(a: unknown, b: unknown): number {
  if (!isArea(a) || !isArea(b)) return 0;
  try {
    const fa = turf.feature(a), fb = turf.feature(b);
    const big = Math.max(turf.area(fa), turf.area(fb));
    if (big <= 0) return 0;
    const inter = turf.intersect(turf.featureCollection([fa, fb]));
    return inter ? Math.min(1, turf.area(inter) / big) : 0;
  } catch {
    return 0; // vigane kuju — ei sobitu
  }
}

// Põllu numbri võrdlus kirjapildist sõltumatult: „2,VARISOO SP“ = „2-Varisoo SP“ = „2 varisoo sp“
export const normalizeFieldNum = (n: string | null | undefined) => (n ?? '').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]/gu, '');

export interface SeasonShape { fieldId: number; year: number; geometry: unknown }

// Ühe massiivi põlluhooaegade sobitamine: igal aastal seotakse iga kuju eelmise olemasoleva aasta
// kujuga, millega see kõige rohkem kattub (üks-ühele, suurim kattuvus enne). Tagastab lingid.
export interface SeasonLink { from: SeasonShape; to: SeasonShape; overlap: number }
export function linkSeasons(shapes: SeasonShape[]): SeasonLink[] {
  const years = [...new Set(shapes.map((s) => s.year))].sort((a, b) => a - b);
  const links: SeasonLink[] = [];
  for (let i = 1; i < years.length; i++) {
    const prev = shapes.filter((s) => s.year === years[i - 1]);
    const cur = shapes.filter((s) => s.year === years[i]);
    const pairs: SeasonLink[] = [];
    for (const c of cur) for (const p of prev) {
      const overlap = overlapRatio(p.geometry, c.geometry);
      if (overlap >= MIN_OVERLAP) pairs.push({ from: p, to: c, overlap });
    }
    pairs.sort((a, b) => b.overlap - a.overlap);
    const usedFrom = new Set<SeasonShape>(), usedTo = new Set<SeasonShape>();
    for (const l of pairs) {
      if (usedFrom.has(l.from) || usedTo.has(l.to)) continue;
      usedFrom.add(l.from); usedTo.add(l.to);
      links.push(l);
    }
  }
  return links;
}

// Impordi vasted faili järjekorras; iga registri põld saab ühe vaste (jagatud põllu teine tükk tuleb uue põlluna)
export function matchImportedFields<T extends IdentityCandidate>(fields: T[], items: { fieldCode: string; geometry: unknown }[], year: number): (T | undefined)[] {
  const taken = new Set<string>();
  return items.map((it) => {
    const m = matchFieldByShape(fields, it.fieldCode, year, it.geometry, taken);
    if (m) taken.add(String(m.id));
    return m;
  });
}

// Impordi vaste: sama massiivi põld, mille lähima varasema (või hilisema) aasta kuju kattub uuega kõige rohkem.
// Põld, millel on imporditaval aastal juba teine kuju, sobib ainult siis, kui see kuju kattub (kordusimport).
export interface IdentityCandidate { id: number | string; fieldCode?: string | null; history: { year: number; geometry?: unknown }[] }
export function matchFieldByShape<T extends IdentityCandidate>(fields: T[], fieldCode: string, year: number, geometry: unknown, taken: Set<string> = new Set()): T | undefined {
  let best: { f: T; overlap: number; dist: number } | undefined;
  for (const f of fields) {
    if (f.fieldCode !== fieldCode || taken.has(String(f.id))) continue;
    const same = f.history.find((h) => h.year === year);
    const ref = same ?? [...f.history].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || b.year - a.year)[0];
    if (!ref?.geometry) continue;
    const overlap = overlapRatio(ref.geometry, geometry);
    if (overlap < MIN_OVERLAP) continue;
    const dist = Math.abs(ref.year - year);
    if (!best || dist < best.dist || (dist === best.dist && overlap > best.overlap)) best = { f, overlap, dist };
  }
  return best?.f;
}
