// src/tooling/uiAudit.ts — UI ühtlustamise mõõdik: mitu erinevat kirjasuurust, nurka, vahet ja värvikoodi on
// stiilides ning kui palju inline-stiile ja keelatud suvalisi Tailwindi väärtusi komponentides.
// Puhtad funktsioonid; failide lugemine on scripts/ui-audit.mts-is.

export interface AuditReport {
  fontSizes: string[];
  radii: string[];
  spacing: string[];
  cssColors: string[];
  inlineStyles: number;
  tsxColors: number;
  arbitrary: { path: string; cls: string }[];
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const SPACING_DECL =
  /(?:^|[\s;{])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)/g;
// Keelatud ainult skaalaga seotud suvalised väärtused; suurused (w-[…]) ja olekuvariandid (data-[…]:) on lubatud.
const ARBITRARY = /(?<![\w-])(?:text|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|rounded(?:-[a-z]{1,2})?|bg|border)-\[[^\]\s]*\]/g;

const values = (css: string, re: RegExp) => [...css.matchAll(re)].map((m) => m[1].trim());
const uniqueSorted = (list: string[]) => [...new Set(list)].sort();

export function auditCss(css: string) {
  const spacing = values(css, SPACING_DECL)
    .flatMap((v) => v.replace(/!important/, '').trim().split(/\s+/))
    .filter((t) => /^-?\d*\.?\d+(px|rem|em)$/.test(t) && parseFloat(t) !== 0);
  return {
    fontSizes: values(css, /font-size\s*:\s*([^;}]+)/g),
    radii: values(css, /border-radius\s*:\s*([^;}]+)/g),
    spacing,
    colors: css.match(HEX) ?? [],
  };
}

export function auditTsx(src: string) {
  return {
    inlineStyles: (src.match(/style=\{\{/g) ?? []).length,
    colors: (src.match(HEX) ?? []).length + (src.match(/rgba?\(/g) ?? []).length,
    arbitrary: src.match(ARBITRARY) ?? [],
  };
}

export function summarize(files: { path: string; content: string }[]): AuditReport {
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => auditCss(f.content));
  const tsx = files.filter((f) => f.path.endsWith('.tsx')).map((f) => ({ path: f.path, ...auditTsx(f.content) }));
  return {
    fontSizes: uniqueSorted(css.flatMap((c) => c.fontSizes)),
    radii: uniqueSorted(css.flatMap((c) => c.radii)),
    spacing: uniqueSorted(css.flatMap((c) => c.spacing)),
    cssColors: uniqueSorted(css.flatMap((c) => c.colors.map((x) => x.toLowerCase()))),
    inlineStyles: tsx.reduce((s, t) => s + t.inlineStyles, 0),
    tsxColors: tsx.reduce((s, t) => s + t.colors, 0),
    arbitrary: tsx.flatMap((t) => t.arbitrary.map((cls) => ({ path: t.path, cls }))),
  };
}
