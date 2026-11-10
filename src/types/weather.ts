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
export interface WeatherMonth { month: number; precipMm: number | null; gdd: number | null; normalPrecipMm: number | null; normalGdd: number | null }
export interface WeatherCumulativeSeries { year: number; points: { day: number; gdd: number; precipMm: number }[] }
export interface WeatherSeasonReport { summary: WeatherSummary | null; reason: 'NO_SEEDING' | 'NO_POINT' | 'LOADING' | null; gddBaseC: number }
