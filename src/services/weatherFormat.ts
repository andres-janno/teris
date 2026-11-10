// src/services/weatherFormat.ts — ilmanäitajate vorming ja keskmisest erinevuse tuvastus (±1 standardhälve).
export type DeviationKind = 'precip' | 'gdd';
export type Deviation = 'wet' | 'dry' | 'warm' | 'cool' | null;

export function deviation(value: number | null | undefined, mean: number | null | undefined, sd: number | null | undefined, kind: DeviationKind): Deviation {
  if (value == null || mean == null || !sd) return null;
  if (value > mean + sd) return kind === 'precip' ? 'wet' : 'warm';
  if (value < mean - sd) return kind === 'precip' ? 'dry' : 'cool';
  return null;
}

export const fmt1 = (n: number | null | undefined): string =>
  n == null ? '—' : n.toLocaleString('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmt0 = (n: number | null | undefined): string => (n == null ? '—' : Math.round(n).toLocaleString('et-EE'));

export const WEATHER_SOURCE = 'Allikas: Copernicus Climate Change Service, ERA5-Land';
export const MONTH_NAMES: Record<number, string> = { 4: 'aprill', 5: 'mai', 6: 'juuni', 7: 'juuli', 8: 'august' };
