// src/services/radarScale.ts
// Sajuradari intensiivsuse värviskaala (mm/h) — ühine serveri pildi ja kaardi legendi jaoks.
export const RADAR_RATE_SCALE: { min: number; color: [number, number, number]; alpha: number }[] = [
  { min: 0.1, color: [155, 225, 255], alpha: 140 },
  { min: 0.5, color: [79, 179, 255], alpha: 190 },
  { min: 1, color: [30, 111, 255], alpha: 200 },
  { min: 2, color: [34, 197, 94], alpha: 210 },
  { min: 5, color: [250, 204, 21], alpha: 220 },
  { min: 10, color: [249, 115, 22], alpha: 230 },
  { min: 20, color: [239, 68, 68], alpha: 235 },
  { min: 50, color: [192, 38, 211], alpha: 240 }
];
