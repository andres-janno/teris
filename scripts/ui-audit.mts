// scripts/ui-audit.mts — UI ühtlustamise mõõdik (spec: docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md).
// Käivitus: npm run ui-audit  (väärtuste loetelu: npm run ui-audit -- --details)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { summarize } from '../src/tooling/uiAudit.ts';

// Landing ja teenusepakkuja admin on eraldi lehed (ülemineku ulatusest väljas); styles/ on teema allikas.
const EXCLUDE = ['src/landing', 'src/admin', 'src/styles'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (EXCLUDE.some((e) => p.startsWith(e)) || name.startsWith('._')) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(css|tsx)$/.test(name) ? [p] : [];
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
row('Vanu komponendiklasse (CSS)', r.legacyComponentClasses.length, r.legacyComponentClasses);
row('Keelatud suvalisi klasse (tsx)', r.arbitrary.length, r.arbitrary.map((a) => `${a.path}: ${a.cls}`));
row('Skaalaväliseid vahe-klasse (tsx)', r.offScaleSpacing.length, r.offScaleSpacing.map((a) => `${a.path}: ${a.cls}`));
row(
  'Vanu nupuklasse (tsx)',
  r.legacyButtonFiles.reduce((s, f) => s + f.count, 0),
  r.legacyButtonFiles.map((f) => `${f.path}: ${f.count}`)
);
