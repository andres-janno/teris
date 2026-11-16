// scripts/ui-audit.mts — UI ühtlustamise mõõdik (spec: docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md).
// Käivitus: npm run ui-audit  (väärtuste loetelu: npm run ui-audit -- --details)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { offScaleCss, summarize, undefinedCssVars, unusedCssClasses } from '../src/tooling/uiAudit.ts';

// Landing on eraldi avalik leht (ülemineku ulatusest väljas, mõõdetakse allpool eraldi); styles/ on teema allikas.
const EXCLUDE = ['src/landing', 'src/styles'];

function walk(dir: string, exclude: string[] = EXCLUDE): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (exclude.some((e) => p.startsWith(e)) || name.startsWith('._')) return [];
    return statSync(p).isDirectory() ? walk(p, exclude) : /\.(css|tsx)$/.test(name) ? [p] : [];
  });
}

function walkSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name.startsWith('._')) return [];
    return statSync(p).isDirectory() ? walkSources(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const files = walk('src').map((path) => ({ path, content: readFileSync(path, 'utf8') }));
const r = summarize(files);
const details = process.argv.includes('--details');
const row = (label: string, n: number, list?: string[]) =>
  console.log(`${label.padEnd(34)}${String(n).padStart(6)}${details && list ? `   ${list.join('  ')}` : ''}`);

row('Erinevaid kirjasuurusi (CSS)', r.fontSizes.length, r.fontSizes);
row('Erinevaid nurgaraadiusi (CSS)', r.radii.length, r.radii);
row('Erinevaid vahe-väärtusi (CSS)', r.spacing.length, r.spacing);
row('Erinevaid värvikoode (CSS)', r.cssColors.length, r.cssColors);
row('style={{…}} kohti (tsx)', r.inlineStyles);
row('Värvikoode/rgba (tsx)', r.tsxColors, r.tsxColorFiles.map((f) => `${f.path}: ${f.count}`));
row('Kirjasuurusi inline (tsx)', r.inlineFontSizes.length, r.inlineFontSizes);
const cssText = files.filter((f) => f.path.endsWith('.css')).map((f) => f.content).join('\n');
const off = offScaleCss(cssText);
row('Skaalaväliseid kirjasuurusi (CSS)', off.fontSizes.length, off.fontSizes);
row('Skaalaväliseid vahesid (CSS)', off.spacing.length, off.spacing);
row('Vanu komponendiklasse (CSS)', r.legacyComponentClasses.length, r.legacyComponentClasses);
row('Keelatud suvalisi klasse (tsx)', r.arbitrary.length, r.arbitrary.map((a) => `${a.path}: ${a.cls}`));
row('Skaalaväliseid vahe-klasse (tsx)', r.offScaleSpacing.length, r.offScaleSpacing.map((a) => `${a.path}: ${a.cls}`));
row(
  'Vanu nupuklasse (tsx)',
  r.legacyButtonFiles.reduce((s, f) => s + f.count, 0),
  r.legacyButtonFiles.map((f) => `${f.path}: ${f.count}`)
);
row(
  'Vanu modaaliklasse (tsx)',
  r.legacyModalFiles.reduce((s, f) => s + f.count, 0),
  r.legacyModalFiles.map((f) => `${f.path}: ${f.count}`)
);
row(
  'Vanu tabeleid (tsx)',
  r.legacyTableFiles.reduce((s, f) => s + f.count, 0),
  r.legacyTableFiles.map((f) => `${f.path}: ${f.count}`)
);
row(
  'Vanu märke/sakke (tsx)',
  r.legacyBadgeTabFiles.reduce((s, f) => s + f.count, 0),
  r.legacyBadgeTabFiles.map((f) => `${f.path}: ${f.count}`)
);
row(
  'Vanu vormivälju (tsx)',
  r.legacyFormFieldFiles.reduce((s, f) => s + f.count, 0),
  r.legacyFormFieldFiles.map((f) => `${f.path}: ${f.count}`)
);
row(
  'Vanu menüüsid/hüpikuid (tsx)',
  r.legacyMenuPopupFiles.reduce((s, f) => s + f.count, 0),
  r.legacyMenuPopupFiles.map((f) => `${f.path}: ${f.count}`)
);

row('Vanu kaarte (tsx+css)', r.legacyCardFiles.reduce((s, f) => s + f.count, 0), r.legacyCardFiles.map((f) => `${f.path}: ${f.count}`));
row('Tooreid nuppe (tsx)', r.rawButtonFiles.reduce((s, f) => s + f.count, 0), r.rawButtonFiles.map((f) => `${f.path}: ${f.count}`));

// Muutujad: kõik CSS-failid (sh admin, landing, styles) ja kõik tsx-id (style-võtmed).
const allCss = walk('src', []).filter((p) => p.endsWith('.css')).map((p) => readFileSync(p, 'utf8'));
const allTsx = walk('src', []).filter((p) => p.endsWith('.tsx')).map((p) => readFileSync(p, 'utf8'));
const undefinedVars = undefinedCssVars(allCss, allTsx);
row('Defineerimata CSS-muutujaid', undefinedVars.length, undefinedVars);

// Kasutuseta klassid: rakenduse ja admini CSS vs kõik ts/tsx + html (landing on eraldi leht, välja).
const sourceFiles = [...walkSources('src'), ...['index.html', 'admin.html'].filter((p) => existsSync(p))].map((p) =>
  readFileSync(p, 'utf8')
);
const unusedRows = ['src/index.css', 'src/admin/admin.css'].flatMap((p) => {
  const r = unusedCssClasses(readFileSync(p, 'utf8'), sourceFiles);
  return [...r.unused.map((c) => `${p}: .${c}`), ...r.dynamic.map((c) => `${p}: .${c} (dünaamiline?)`)];
});
row('Kasutuseta klasse (CSS)', unusedRows.filter((r) => !r.endsWith('(dünaamiline?)')).length, unusedRows);

// Landing (avalik leht, oma stiil — ülemineku ulatusest väljas): ainult vanad komponendid ja inline-stiilid.
const landing = summarize(walk('src/landing', []).map((path) => ({ path, content: readFileSync(path, 'utf8') })));
const total = (l: { count: number }[]) => l.reduce((s, f) => s + f.count, 0);
row('Landing: style={{…}} kohti', landing.inlineStyles);
row('Landing: vanu nupuklasse', total(landing.legacyButtonFiles), landing.legacyButtonFiles.map((f) => `${f.path}: ${f.count}`));
row('Landing: tooreid vormivälju', total(landing.legacyFormFieldFiles), landing.legacyFormFieldFiles.map((f) => `${f.path}: ${f.count}`));
