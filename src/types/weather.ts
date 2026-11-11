// src/types/weather.ts — ilmaandmete (ERA5-Land) kliendi tüübid; vastavad src/server/weather/weatherApi.ts vastustele.
export interface WeatherSummary {
  from: string; to: string; days: number;
  gdd: number; precipMm: number; rainDays: number; waterBalanceMm: number | null;
  longestDrySpell: number; hotDays: number; frostDays: number;
  soilMoistureAvg: number | null; soilMoistureMin: number | null;
  dataUntil: string | null; complete: boolean;
}
export type WeatherPointRef = 'all' | number;
export interface WeatherPointInfo { id: number; lat: number; lon: number; hasData: boolean | null; loadedUntil: string | null; fieldCount: number }
export type WeatherNumericKey = 'gdd' | 'precipMm' | 'rainDays' | 'waterBalanceMm' | 'longestDrySpell' | 'hotDays' | 'frostDays';
export interface WeatherYears {
  years: { year: number; summary: WeatherSummary }[];
  normal: Partial<Record<WeatherNumericKey, number | null>>;
  sd: Partial<Record<WeatherNumericKey, number | null>>;
  normalYears: number[];
  dataUntil: string | null;
}
export interface WeatherMonth { month: number; years: { year: number; precipMm: number | null; gdd: number | null }[]; normalPrecipMm: number | null; normalGdd: number | null }
export interface WeatherCumulativePoint { day: number; gdd: number; precipMm: number }
export interface WeatherCumulativeSeries { year: number; points: WeatherCumulativePoint[] }
export interface WeatherCumulative { series: WeatherCumulativeSeries[]; normal: { years: number[]; points: WeatherCumulativePoint[] } | null }
export type WeatherSeasonReason = 'NO_SEEDING' | 'NOT_STARTED' | 'INVALID_DATES' | 'NO_POINT' | 'LOADING';
export interface WeatherSeasonReport { summary: WeatherSummary | null; reason: WeatherSeasonReason | null; gddBaseC: number; harvested: boolean }
export interface WeatherSeasonHistoryRow { year: number; crop: string | null; actualYieldTonsHa: number | null; ownDates: boolean; gddBaseC: number; summary: WeatherSummary }
export interface WeatherCredentialStatus {
  configured: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  canEdit: boolean;
}
