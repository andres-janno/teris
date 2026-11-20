// src/lib/dataColors.ts — andmevärvid ühes kohas (kasutaja otsus 2026-11-16). Need on andmed (kultuur, kaardikiht,
// mulla tase, graafiku seeria), mitte teema tokenid: kaardil ja andmebaasis on sama värv mõlemas teemas.
// UI värvid (tekst, nupp, ääris) on tokenid index.css / app.css-is. Server impordib selle faili `.ts` laiendiga.

/** Kultuur, millel registris värvi pole (ka andmebaasi vaikeväärtus). */
export const DEFAULT_CROP_COLOR = '#eab308';
/** Määramata kultuur (hooaeg ilma kultuurita) ja puuduv mõõtetulemus. */
export const UNDETERMINED_CROP_COLOR = '#94a3b8';
/** Uue sõiduki/märgi vaikevärv kaardil. */
export const DEFAULT_VEHICLE_COLOR = '#22c55e';

/** Kaardil põllu vaikevärv (värvi puudumisel; võrdlusväärtus). */
export const DEFAULT_FIELD_COLOR = '#3b82f6';

export type SoilLevel = 'bad' | 'warn' | 'good';
/** Mulla näitaja tase kaardil, legendis ja punktina. Tekstina kasuta toonitokenit (`soilValueClass`, components/ui/variants.ts). */
export const SOIL_LEVEL_COLOR: Record<SoilLevel, string> = { bad: '#dc2626', warn: '#eab308', good: '#16a34a' };

/** Finantsi kulujaotuse seeriad (tulemuste riba legend). */
export const FINANCE_COST_COLOR = { labor: '#0284c7', equipment: '#d97706', fuel: '#ea580c', articles: '#16a34a' } as const;

/** Sõidu kaart (Leaflet): algus, lõpp, põllulõik haakeriista laiusega, rada. */
export const TRIP_MAP_COLOR = { start: '#10b981', end: '#ef4444', swath: '#16a34a', track: '#3b82f6' } as const;

/** Kaardikihtide värvimärgid kihtide paneelis. Põllud ja Masinapark on teemapõhised (heledas ja tumedas erinev toon, vanas CSS-is
    `--amber-400` / `--emerald-400`), seepärast CSS-muutuja; ülejäänud on kaardi kihi värv mõlemas teemas sama. */
export const LAYER_SWATCH = {
  fields: 'var(--amber-400)',
  vehicles: 'var(--emerald-400)',
  cultivation: '#38bdf8',
  poi: '#ec4899',
  cadastre: '#f97316',
  soil: '#a16207',
  weather: '#1e6fff',
  satellite: 'linear-gradient(135deg, #2b7c4c, #c9d292 50%, #8f6b3a)',
} as const;

/** Ilmavaate graafikute seeriad: aasta järjekord võrdluses (tulbad, jooned, legend); 6 värvi kordub. */
export const WEATHER_SERIES_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#64748b'] as const;
/** Seeria värv aasta järjekorra järgi (kordub). */
export const weatherSeriesColor = (i: number): string => WEATHER_SERIES_COLORS[i % WEATHER_SERIES_COLORS.length];
/** Pikaajaline keskmine graafikul: tulp ja katkendjoon. */
export const WEATHER_NORMAL_BAR_COLOR = '#cbd5e1';
export const WEATHER_NORMAL_LINE_COLOR = '#94a3b8';
/** Aastate tabeli lahtri taust, kui näitaja erineb keskmisest üle ühe standardhälbe (märg, kuiv, soe, jahe). */
export const WEATHER_DEVIATION_COLOR = {
  wet: 'rgba(59, 130, 246, 0.16)',
  dry: 'rgba(249, 115, 22, 0.18)',
  warm: 'rgba(239, 68, 68, 0.16)',
  cool: 'rgba(14, 165, 233, 0.12)'
} as const;
