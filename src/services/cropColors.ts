// src/services/cropColors.ts — uue kultuuri värvi automaatne valik.
// Põhimõte: talivili saab külma tooni (sinine–violetne), suvivili sooja tooni
// (kollane–oranž–punane–roosa). Olemasolevaid värve ei muudeta; valitakse
// toon, mida ükski kultuur veel ei kasuta.

export const WINTER_PALETTE = [
  '#2563eb', '#0891b2', '#7c3aed', '#4f46e5', '#0d9488',
  '#0284c7', '#9333ea', '#1d4ed8', '#0e7490', '#6d28d9'
];

export const SPRING_PALETTE = [
  '#eab308', '#f59e0b', '#ea580c', '#dc2626', '#db2777', '#f472b6',
  '#fb923c', '#b45309', '#e11d48', '#ca8a04', '#c2410c', '#be123c'
];

// Värvitooni vahemikud kraadides (HSL), kui valmis palett saab otsa.
const WINTER_HUES: [number, number] = [180, 280];
const SPRING_HUES: [number, number] = [-40, 60]; // −40 = 320° (roosa) … 60° (kollane)

const hexToHue = (hex: string): number | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
};

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** Valib uuele kultuurile värvi, mida `usedColors` hulgas veel pole. */
export const pickCropColor = (isWinterCrop: boolean, usedColors: string[]): string => {
  const used = new Set(usedColors.map((c) => c.trim().toLowerCase()));
  const palette = isWinterCrop ? WINTER_PALETTE : SPRING_PALETTE;
  const free = palette.find((c) => !used.has(c));
  if (free) return free;

  // Palett otsas: vahemikust toon, mis on kasutusel olevatest toonidest kõige kaugemal.
  const [from, to] = isWinterCrop ? WINTER_HUES : SPRING_HUES;
  const usedHues = usedColors.map(hexToHue).filter((h): h is number => h !== null);
  let best = from;
  let bestDist = -1;
  for (let h = from; h <= to; h += 2) {
    const dist = usedHues.length ? Math.min(...usedHues.map((u) => hueDistance(h, u))) : 360;
    if (dist > bestDist) {
      bestDist = dist;
      best = h;
    }
  }
  return hslToHex(best, 0.75, 0.45);
};

// Kultuuri värv nime järgi (kaart, aastavalija, tööde tahvel, SHP import).
const CROP_COLORS: Record<string, string> = {
  'talinisu': '#eab308',      // Yellow/Gold
  'suvinisu': '#facc15',
  'oder': '#ca8a04',          // Amber
  'suvioder': '#d97706',
  'taliraps': '#10b981',      // Emerald Green
  'suviraps': '#34d399',
  'rukis': '#a16207',         // Brown/Bronze
  'kaer': '#fbbf24',          // Light Gold
  'hernes': '#65a30d',        // Lime Green
  'uba': '#84cc16',
  'hein': '#22c55e',          // Bright Green
  'kesa': '#78716c',          // Gray/Stone
  'mais': '#f59e0b',          // Orange-yellow
  'kartul': '#d97706',
  'default': '#3b82f6'        // Blue
};

export function getCropColor(cropName?: string): string {
  if (!cropName) return CROP_COLORS.default;
  const lower = cropName.toLowerCase();
  for (const [key, color] of Object.entries(CROP_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return CROP_COLORS.default;
}
