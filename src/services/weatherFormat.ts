// src/services/weatherFormat.ts — ilmanäitajate vorming ja keskmisest erinevuse tuvastus (±1 standardhälve).
import type { WeatherPeriod, WeatherPointInfo } from '../types/weather';
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
// `|| 0` väldib „−0“ väikeste negatiivsete väärtuste ümardamisel
export const fmt0 = (n: number | null | undefined): string => (n == null ? '—' : (Math.round(n) || 0).toLocaleString('et-EE'));

export const WEATHER_SOURCE = 'Allikas: Copernicus Climate Change Service, ERA5-Land';
export const MONTH_NAMES: Record<number, string> = { 1: 'jaanuar', 2: 'veebruar', 3: 'märts', 4: 'aprill', 5: 'mai', 6: 'juuni', 7: 'juuli', 8: 'august', 9: 'september', 10: 'oktoober', 11: 'november', 12: 'detsember' };
export const MONTH_SHORT: Record<number, string> = { 1: 'jaan', 2: 'veebr', 3: 'märts', 4: 'apr', 5: 'mai', 6: 'juuni', 7: 'juuli', 8: 'aug', 9: 'sept', 10: 'okt', 11: 'nov', 12: 'dets' };

// Peab vastama serveri WEATHER_PERIODS-ile (src/server/weather/summary.ts)
export const WEATHER_PERIOD_OPTIONS: { value: WeatherPeriod; label: string; range: string; firstMonth: number; lastMonth: number; frostLabel: string }[] = [
  { value: 'growing', label: 'Kasvuperiood', range: '01.04–31.08', firstMonth: 4, lastMonth: 8, frostLabel: 'Öökülmi (apr–juuni)' },
  { value: 'winter', label: 'Taliviljad', range: '01.07–30.11', firstMonth: 7, lastMonth: 11, frostLabel: 'Öökülmi' },
  { value: 'year', label: 'Kogu aasta', range: '01.01–31.12', firstMonth: 1, lastMonth: 12, frostLabel: 'Öökülmi' }
];

// Ilmapunkti värv kaardil ja punktivalikus (järjekord = punktide nimekiri)
const POINT_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#ca8a04', '#db2777', '#475569'];
export const pointColor = (points: WeatherPointInfo[], id: number) => POINT_COLORS[Math.max(0, points.findIndex((p) => p.id === id)) % POINT_COLORS.length];
