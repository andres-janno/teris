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
  offScaleSpacing: { path: string; cls: string }[];
  inlineFontSizes: string[];
  tsxColorFiles: { path: string; count: number }[];
  legacyComponentClasses: string[];
  legacyButtonFiles: { path: string; count: number }[];
}

// Värv: hex (HTML-i numbriline võrdlusmärk &#8212; välja arvatud) või rgb/rgba/hsl/hsla; muutujaga värve ei loeta.
const COLOR = /(?<!&)#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\((?:[^()]|\([^()]*\))*\)/gi;
const SPACING_DECL =
  /(?:^|[\s;{])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)/g;
// Keelatud ainult skaalaga seotud suvalised väärtused (sh negatiivsed ja loogilised vahed); suurused (w-[…])
// ja olekuvariandid (data-[…]:) on lubatud. Eesliide "md:" jätab klassi ilma, sest koolon ei kuulu lookbehindi.
// Hõlmab ka Tailwind v4 muutujasüntaksit (text-(--x)) ja külgpiiret (border-t-[…]).
const ARBITRARY =
  /(?<![\w-])-?(?:text|p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|rounded(?:-[a-z]{1,2})?|bg|border(?:-[xytrbl])?)-(?:\[[^\]\s]*\]|\(--[\w-]+\))/g;
// Vahe-klass arvuga (p-5, -mt-3.5, md:gap-x-7); `size-`, `h-`, `w-`, `translate-x-` jne ei lähe lookbehindist läbi.
const SPACING_CLASS = /(?<![\w-])(-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?)-(\d+(?:\.\d+)?|px))(?![\w.[(-])/g;
const SPACING_SCALE = new Set(['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '4', '6', '8']);
// Vana komponendi klassiselektor CSS-is (spec: nupu/dialoogi/tabeli klassid kustutatakse).
const LEGACY_COMPONENT = /\.((?:btn|modal|badge|pill|tab|data-table|table)[\w-]*)/g;
// Üldised vanad nupuklassid (etapp 2.1). Erinupud (basemap-btn jne) ja paigutusklass btn-full ei loe.
const LEGACY_BUTTON =
  /(?<![\w-])(btn|btn-primary|btn-secondary|btn-ghost|btn-danger|btn-sm|btn-xs|btn-icon-only|icon-btn|icon-btn-ghost|icon-btn-danger|icon-btn-ghost-sm)(?![\w-])/g;
const INLINE_FONT_SIZE = /fontSize\s*:\s*(?:(\d+(?:\.\d+)?)|['"](\d+(?:\.\d+)?(?:px|rem))['"])/g;

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
    componentClasses: [...new Set([...css.matchAll(LEGACY_COMPONENT)].map((m) => `.${m[1]}`))],
  };
}

export function auditTsx(src: string) {
  return {
    inlineStyles: (src.match(/style=\{\{/g) ?? []).length,
    colors: colors(src).length,
    arbitrary: src.match(ARBITRARY) ?? [],
    offScaleSpacing: [...src.matchAll(SPACING_CLASS)].filter((m) => !SPACING_SCALE.has(m[2])).map((m) => m[1]),
    inlineFontSizes: [...src.matchAll(INLINE_FONT_SIZE)].map((m) => (m[1] ? `${m[1]}px` : m[2])),
    legacyButtons: [...src.matchAll(LEGACY_BUTTON)].map((m) => m[1]),
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
    offScaleSpacing: tsx.flatMap((t) => [...new Set(t.offScaleSpacing)].map((cls) => ({ path: t.path, cls }))),
    inlineFontSizes: uniqueSorted(tsx.flatMap((t) => t.inlineFontSizes)),
    tsxColorFiles: tsx.filter((t) => t.colors > 0).map((t) => ({ path: t.path, count: t.colors })),
    legacyComponentClasses: uniqueSorted(css.flatMap((c) => c.componentClasses)),
    legacyButtonFiles: tsx.filter((t) => t.legacyButtons.length > 0).map((t) => ({ path: t.path, count: t.legacyButtons.length })),
  };
}
