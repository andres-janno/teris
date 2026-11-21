// src/components/fieldNdviState.ts — põllu NDVI ploki olek, tekstid ja arvutuse käivitus (ilma Reactita, testitav).
import type { Polygon, MultiPolygon } from 'geojson';
import { computeFieldNdvi } from '../services/fieldNdvi';
import type { NdviSummary } from '../services/ndvi';

export type NdviBlockState =
  | { status: 'loading' }
  | { status: 'ready'; summary: NdviSummary }
  | { status: 'cloudy' }
  | { status: 'error' };

export const NDVI_TEXT = {
  title: 'NDVI',
  mean: 'keskmine NDVI',
  loading: 'Arvutan satelliidipildist',
  error: 'Satelliidipilti ei saanud laadida',
  cloudy: 'Sel päeval on põld pilve all',
  barTitle: 'Põllu pinna jaotus taimkatte tiheduse järgi',
  excluded: 'Välja jäetud: pilved, andmeteta alad ja põllu 10 m serv.'
} as const;

export const formatPercent = (share: number): string => `${Math.round(share * 100)}%`;

/** Allkiri, kui osa põllust jäi arvestusest välja; tühi, kui kaetus on ≥ 90%. */
export function coverageNote(summary: NdviSummary): string | null {
  if (summary.coverage >= 0.9) return null;
  const clouds = summary.cloudShare > 0.01 ? `, ${formatPercent(summary.cloudShare)} oli pilves` : '';
  return `Arvestatud ${formatPercent(summary.coverage)} põllust${clouds}${summary.coverage < 0.5 ? ' — tulemus pole usaldusväärne' : ''}.`;
}

/**
 * Käivitab arvutuse ja annab tulemuse tagasikutsega; tagastab tühistaja. Pärast tühistamist ei kutsuta tagasi enam
 * kunagi (ei tulemust ega viga), nii et hilinenud vana vastus ei kirjuta uut olekut üle.
 */
export function startNdviLoad(geometry: Polygon | MultiPolygon, date: string, onState: (state: NdviBlockState) => void): () => void {
  let cancelled = false;
  onState({ status: 'loading' });
  computeFieldNdvi(geometry, date)
    .then((summary) => { if (!cancelled) onState(summary ? { status: 'ready', summary } : { status: 'cloudy' }); })
    .catch(() => { if (!cancelled) onState({ status: 'error' }); });
  return () => { cancelled = true; };
}
