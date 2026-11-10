// src/server/weather/types.ts — ilmaandmete ühised tüübid (ERA5-Land).

/** Üks tund ühes punktis. Kogused (sademed, aurumine) on tunni kohta, mis lõpeb ajal `time` (UTC). */
export type HourlyWeather = {
  time: Date;
  tempC: number | null;
  precipMm: number | null;
  solarJm2: number | null; // päikesekiirgus J/m² tunni kohta, mis lõpeb ajal `time`
  soil1: number | null;
  soil2: number | null;
};

/** Üks Tallinna kalendripäev ühes punktis (või punktide keskmine). */
export type DailyWeather = {
  date: string; // AAAA-KK-PP
  tMin: number;
  tMax: number;
  tMean: number;
  precipMm: number;
  potEvapMm: number | null;
  soilMoisture1: number | null;
  soilMoisture2: number | null;
};

export type WeatherSummary = {
  from: string;
  to: string;
  days: number; // päevi andmetega
  gdd: number;
  precipMm: number;
  rainDays: number;
  waterBalanceMm: number | null;
  longestDrySpell: number;
  hotDays: number;
  frostDays: number;
  soilMoistureAvg: number | null;
  soilMoistureMin: number | null;
  dataUntil: string | null; // viimane päev andmetega
  complete: boolean; // andmed katavad kogu perioodi
};
