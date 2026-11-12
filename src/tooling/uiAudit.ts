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

// Värv: hex (HTML-i numbriline võrdlusmärk &#8212; välja arvatud) või rgb/rgba/hsl/hsla; muutujaga värve ei loeta.
const COLOR = /(?<!&)#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\((?:[^()]|\([^()]*\))*\)/gi;
const SPACING_DECL =
  /(?:^|[\s;{])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)/g;
// Keelatud ainult skaalaga seotud suvalised väärtused (sh negatiivsed ja loogilised vahed); suurused (w-[…])
// ja olekuvariandid (data-[…]:) on lubatud. Eesliide "md:" jätab klassi ilma, sest koolon ei kuulu lookbehindi.
const ARBITRARY =
  /(?<![\w-])-?(?:text|p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|rounded(?:-[a-z]{1,2})?|bg|border)-\[[^\]\s]*\]/g;

const values = (css: string, re: RegExp) => [...css.matchAll(re)].map((m) => m[1].trim());
const uniqueSorted = (list: string[]) => [...new Set(list)].sort();
const withoutImportant = (v: string) => v.replace(/!important/g, '').trim();
const isNonZeroNumber = (t: string, unit: RegExp) => unit.test(t) && parseFloat(t) !== 0;
const LENGTH_PCT = /^-?\d*\.?\d+(px|rem|em|%)$/;
const LENGTH = /^-?\d*\.?\d+(px|rem|em)$/;
// Kirjasuurus ja nurk: lühendist (nt "6px 6px 0 0") jäävad alles ainult arvulised väärtused; muutujad, inherit, 0 välja.
const lengthTokens = (css: string, prop: RegExp) =>
  values(css, prop)
    .flatMap((v) => withoutImportant(v).split(/\s+/))
    .filter((t) => isNonZeroNumber(t, LENGTH_PCT));

const colors = (src: string) =>
  (src.match(COLOR) ?? []).filter((c) => !/var\(/i.test(c)).map((c) => c.toLowerCase().replace(/\s+/g, ''));

export function auditCss(css: string) {
  const spacing = values(css, SPACING_DECL)
    .flatMap((v) => withoutImportant(v).split(/\s+/))
    .filter((t) => isNonZeroNumber(t, LENGTH));
  return {
    fontSizes: lengthTokens(css, /font-size\s*:\s*([^;}]+)/g),
    radii: lengthTokens(css, /border-radius\s*:\s*([^;}]+)/g),
    spacing,
    colors: colors(css),
  };
}

export function auditTsx(src: string) {
  return {
    inlineStyles: (src.match(/style=\{\{/g) ?? []).length,
    colors: colors(src).length,
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
