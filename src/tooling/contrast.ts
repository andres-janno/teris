// src/tooling/contrast.ts — WCAG 2.x kontrastsuhe teema tokenitest. Allikad: styles/themes.css heleda/tumeda teema
// :root plokid ja app.css `@theme inline` värvinimed (kasutaja otsus 2026-11-16: tekst ≥ 4.5:1 mõlemas teemas).
export interface Rgba { r: number; g: number; b: number; a: number }

export function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const fn = s.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b, a = '1'] = fn[1].split(/[\s,/]+/).filter(Boolean);
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
  }
  throw new Error(`Tundmatu värv: ${input}`);
}

/** Läbipaistev värv tausta peal; tulemus on läbipaistmatu. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

/** Tailwindi `bg-x/15`: värv pct% läbipaistvusega tausta peal. */
export const tint = (color: Rgba, pct: number, bottom: Rgba): Rgba => over({ ...color, a: (pct / 100) * color.a }, bottom);

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = (c: Rgba): number => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

/** Kontrastsuhe; läbipaistev esiplaan segatakse taustaga. Taust peab olema läbipaistmatu. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const f = fg.a < 1 ? over(fg, bg) : fg;
  const [hi, lo] = [luminance(f), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const declarations = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

/** Teema muutujad: hele = `:root, :root[data-theme="light"]` plokk; tume = hele + esimene `:root[data-theme="dark"]` plokk. */
export function themeVars(indexCss: string, theme: 'light' | 'dark'): Record<string, string> {
  const light = indexCss.match(/:root,\s*:root\[data-theme="light"\]\s*\{([^}]*)\}/);
  if (!light) throw new Error('Heleda teema plokki ei leitud');
  const vars = declarations(light[1]);
  if (theme === 'light') return vars;
  const dark = indexCss.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  if (!dark) throw new Error('Tumeda teema plokki ei leitud');
  return { ...vars, ...declarations(dark[1]) };
}

/** Tailwindi värvinimed app.css `@theme inline` plokist: `--color-primary` → `primary`. */
export function themeColors(appCss: string): Record<string, string> {
  const block = appCss.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error('@theme inline plokki ei leitud');
  return Object.fromEntries(
    Object.entries(declarations(block[1]))
      .filter(([k]) => k.startsWith('--color-'))
      .map(([k, v]) => [k.slice('--color-'.length), v])
  );
}

/** Lahendab var(--x) ahelad teema muutujatest. color-mix'i ei toeta (parseColor viskab). */
export function resolveColor(value: string, vars: Record<string, string>, depth = 0): Rgba {
  if (depth > 10) throw new Error(`Liiga sügav var() ahel: ${value}`);
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (ref) {
    const next = vars[ref[1]] ?? ref[2];
    if (next === undefined) throw new Error(`Defineerimata muutuja ${ref[1]}`);
    return resolveColor(next, vars, depth + 1);
  }
  return parseColor(v);
}
