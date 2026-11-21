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

/** Viivitus enne arvutust: satelliidipaneeli esitusrežiim vahetab päevi kiiresti, iga päeva arvutust ei taheta. */
export const NDVI_DEBOUNCE_MS = 400;

/** Tulemus koos päevaga, millele see kuulub. */
export type NdviEntry = { date: string; state: NdviBlockState };

/** Näidatav olek valitud päevale: teisele päevale kuuluv tulemus on selle päeva jaoks laadimine. */
export function ndviStateFor(entry: NdviEntry | null, date: string): NdviBlockState {
  return entry && entry.date === date ? entry.state : { status: 'loading' };
}

/**
 * Käivitab arvutuse pärast viivitust. Tühistaja katkestab nii ootava taimeri kui pooleli arvutuse,
 * nii et kiiresti vahetatud päevade vahelt arvutatakse ainult viimane, kui päev püsib.
 */
export function scheduleNdviLoad(
  geometry: Polygon | MultiPolygon,
  date: string,
  onState: (state: NdviBlockState) => void,
  delayMs: number = NDVI_DEBOUNCE_MS
): () => void {
  let stopLoad: (() => void) | null = null;
  const timer = setTimeout(() => { stopLoad = startNdviLoad(geometry, date, onState); }, delayMs);
  return () => {
    clearTimeout(timer);
    stopLoad?.();
  };
}
