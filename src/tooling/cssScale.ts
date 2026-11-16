// src/tooling/cssScale.ts — CSS-i väärtused spec'i skaalale (kirjasuurus 6, nurk 4, vahe 9 astet).
// Kasutaja otsus 2026-11-16: väikseimad kirjad kerkivad 11px-ni; > 32px vahed on paigutuse mõõdud (käsitsi).
export const FONT_SCALE_PX = [11, 12, 13, 14, 16, 20] as const;
export const SPACING_SCALE_PX = [2, 4, 6, 8, 10, 12, 16, 24, 32] as const;

/** Kirjasuurus: inventuuri 9A piirid (0.95rem → 14, 1.15rem → 16). */
export function scaleFontSize(px: number): number {
  if (px < 11.4) return 11;
  if (px < 12.4) return 12;
  if (px < 13.4) return 13;
  if (px < 15.5) return 14;
  if (px < 19) return 16;
  return 20;
}

/** Vahe: lähim skaala väärtus, võrdsel kaugusel väiksem; märk säilib; 0 → 0; > 32 → null (käsitsi). */
export function scaleSpacing(px: number): number | null {
  if (px === 0) return 0;
  const abs = Math.abs(px);
  if (abs > 32) return null;
  let best: number = SPACING_SCALE_PX[0];
  for (const s of SPACING_SCALE_PX) if (Math.abs(s - abs) < Math.abs(best - abs)) best = s;
  return Math.sign(px) * best;
}

/** Nurk: 1–7px → sm (6), 8–12px → md (10), 13–20px → lg (16), 50% / ≥ 999px → 9999px. */
export function scaleRadius(token: string): string {
  const t = token.trim();
  if (t === '50%' || /^(999|9999)px$/.test(t)) return '9999px';
  const m = t.match(/^(\d*\.?\d+)px$/);
  if (!m) return t;
  const px = parseFloat(m[1]);
  if (px === 0) return '0';
  if (px < 8) return 'var(--radius-sm)';
  if (px <= 12) return 'var(--radius-md)';
  if (px <= 20) return 'var(--radius-lg)';
  return '9999px';
}

const toPx = (token: string): number | null => {
  const m = token.match(/^(-?\d*\.?\d+)(px|rem)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' ? n * 16 : n;
};

const fmt = (n: number) => `${n}px`;
// Omadus peab algama reegli/deklaratsiooni piirilt; `--x:` muutujad ei vasta (eesliide `--` ei ole lubatud).
const DECL =
  /(^|[\s;{])(font-size|border-radius|border-(?:top|bottom)-(?:left|right)-radius|(?:padding|margin|gap|row-gap|column-gap|scroll-padding|scroll-margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?)(\s*:\s*)([^;}]+)/g;

/** Asendab deklaratsioonide väärtused; > 32px vahed jäävad ja tulevad `manual` loetellu („rida: omadus: väärtus“). */
export function rescaleCss(css: string): { css: string; manual: string[] } {
  const manual: string[] = [];
  const out = css.replace(DECL, (whole, lead: string, prop: string, sep: string, value: string, offset: number) => {
    const important = /!important/.test(value);
    const raw = value.replace(/!important/, '').trim();
    if (/var\(|calc\(|max\(|min\(|clamp\(/.test(raw)) return whole;
    const tokens = raw.split(/\s+/);
    let mapped: string[];
    if (prop === 'font-size') {
      const px = tokens.length === 1 ? toPx(tokens[0]) : null;
      if (px === null) return whole;
      mapped = [fmt(scaleFontSize(px))];
    } else if (prop === 'border-radius' || /^border-.*-radius$/.test(prop)) {
      mapped = tokens.map(scaleRadius);
    } else {
      let tooBig = false;
      mapped = tokens.map((t) => {
        const px = toPx(t);
        if (px === null) return t;
        const s = scaleSpacing(px);
        if (s === null) {
          tooBig = true;
          return t;
        }
        return s === 0 ? t : fmt(s);
      });
      if (tooBig) {
        const line = css.slice(0, offset + lead.length).split('\n').length;
        manual.push(`${line}: ${prop}: ${raw}`);
        return whole;
      }
    }
    const trail = value.match(/\s*$/)?.[0] ?? '';
    return `${lead}${prop}${sep}${mapped.join(' ')}${important ? ' !important' : ''}${trail}`;
  });
  return { css: out, manual };
}
