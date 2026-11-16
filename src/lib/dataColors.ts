// src/lib/dataColors.ts — andmevärvid ühes kohas (kasutaja otsus 2026-11-16). Need on andmed (kultuur, kaardikiht,
// mulla tase, graafiku seeria), mitte teema tokenid: kaardil ja andmebaasis on sama värv mõlemas teemas.
// UI värvid (tekst, nupp, ääris) on tokenid index.css / app.css-is. Server impordib selle faili `.ts` laiendiga.

/** Kultuur, millel registris värvi pole (ka andmebaasi vaikeväärtus). */
export const DEFAULT_CROP_COLOR = '#eab308';
/** Määramata kultuur (hooaeg ilma kultuurita) ja puuduv mõõtetulemus. */
export const UNDETERMINED_CROP_COLOR = '#94a3b8';
/** Uue sõiduki/märgi vaikevärv kaardil. */
export const DEFAULT_VEHICLE_COLOR = '#22c55e';

export type SoilLevel = 'bad' | 'warn' | 'good';
/** Mulla näitaja tase kaardil, legendis ja punktina. Tekstina kasuta toonitokenit (.soil-value[data-level]). */
export const SOIL_LEVEL_COLOR: Record<SoilLevel, string> = { bad: '#dc2626', warn: '#eab308', good: '#16a34a' };

/** Finantsi kulujaotuse seeriad (tulemuste riba legend). */
export const FINANCE_COST_COLOR = { labor: '#0284c7', equipment: '#d97706', fuel: '#ea580c', articles: '#16a34a' } as const;

/** Sõidu kaart (Leaflet): algus, lõpp, põllulõik haakeriista laiusega, rada. */
export const TRIP_MAP_COLOR = { start: '#10b981', end: '#ef4444', swath: '#16a34a', track: '#3b82f6' } as const;
