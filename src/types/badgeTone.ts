// src/types/badgeTone.ts — märgi toon (ui/Badge). Eraldi fail, et serveri tsconfig (node16) saaks tüüpi importida
// ilma ui-kausta tõmbamata.
export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'accent' | 'neutral';
// Märgi kuju: soft (hele toon), solid (täisvärv — rõhutatud olek), outline (ääris).
export type BadgeVariant = 'soft' | 'solid' | 'outline';
