// src/types/badgeTone.ts — märgi toon (ui/Badge). Eraldi fail, et serveri tsconfig (node16) saaks tüüpi importida
// ilma ui-kausta tõmbamata.
export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'accent' | 'neutral';
