import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const appCss = read('src/styles/app.css');
const appCssNoComments = strip(appCss);

/** Valijate märgid (tokenid), mis algavad `*`, `body`, `html` või `:root`-iga; `.body-x` ja `tbody` ei loe. */
const selectorTokens = (css: string): string[] =>
  [...strip(css).matchAll(/([^{}@;]+)\{/g)].flatMap((m) => m[1].split(/[\s,>+~]+/).filter(Boolean));
const hasBaseRule = (css: string) => selectorTokens(css).some((t) => /^(\*|body|html)(?![\w-])/.test(t));
const hasRootRule = (css: string) => selectorTokens(css).some((t) => /^(:root|html)(?![\w-])/.test(t));
const styleFiles = readdirSync('src/styles').filter((f) => f.endsWith('.css') && f !== 'app.css' && !f.startsWith('._'));

describe('CSS-failide jaotus (etapp 4g)', () => {
  it('vana index.css ja kihita admin.css on kadunud ega tule tagasi', () => {
    expect(existsSync('src/index.css')).toBe(false);
    expect(existsSync('src/admin/admin.css')).toBe(false);
  });
  it('iga src/styles/*.css on app.css-is imporditud, themes → theme, base → base, ülejäänud → exceptions', () => {
    for (const f of styleFiles) {
      const layer = f === 'themes.css' ? 'theme' : f === 'base.css' ? 'base' : 'exceptions';
      expect(appCssNoComments, f).toContain(`@import './${f}' layer(${layer});`);
    }
  });
  it('iga app.css-is imporditud ./*.css fail on kettal olemas', () => {
    const local = [...appCssNoComments.matchAll(/@import\s+['"]\.\/([^'"]+\.css)['"]/g)].map((m) => m[1]);
    expect(local.length).toBeGreaterThan(0);
    for (const f of local) expect(existsSync(`src/styles/${f}`), f).toBe(true);
  });
  it('kihid on kirjas ja kihita @import puudub', () => {
    expect(appCss).toContain('@layer theme, base, exceptions, vendor, components, utilities;');
    const imports = [...appCssNoComments.matchAll(/@import\s+(?:'[^']+'|"[^"]+")([^;]*);/g)];
    expect(imports.length).toBeGreaterThan(0);
    for (const m of imports) expect(m[1], m[0]).toMatch(/layer\(|source\(none\)/);
  });
  it('teemamuutujad (:root) ainult themes.css-is, põhireeglid (*, body, html) ainult base.css-is', () => {
    for (const f of styleFiles) {
      const css = read(`src/styles/${f}`);
      if (f !== 'themes.css') expect(hasRootRule(css), f).toBe(false);
      if (f !== 'base.css') expect(hasBaseRule(css), f).toBe(false);
    }
  });
  it('erandite CSS ei kasva tagasi: src/styles/*.css (v.a app.css) kokku ≤ 1000 rida', () => {
    const lines = styleFiles.reduce((s, f) => s + read(`src/styles/${f}`).split('\n').length, 0);
    expect(lines).toBeLessThanOrEqual(1000);
  });
  it('!important on ainult login-, rotation- ja map-erandites', () => {
    for (const f of styleFiles) {
      const has = /!important/.test(strip(read(`src/styles/${f}`)));
      expect(has, f).toBe(['login.css', 'rotation.css', 'map.css'].includes(f) ? true : false);
    }
  });
  it('põhireegli tuvastus tabab õiged kujud ja ei tabab valesid (valvuri enda kontroll)', () => {
    for (const bad of ['.a, body {}', 'body .x {}', 'body.dark {}', '*::before {}', 'html:root {}', '.a{} body{}', '* {}', '@media (x) { body {} }'])
      expect(hasBaseRule(bad), bad).toBe(true);
    for (const ok of ['.body-x {}', 'tbody {}', 'table tbody td {}', '/* body {} */ .a {}', '.a:hover {}', '@keyframes k { from {} to {} }'])
      expect(hasBaseRule(ok), ok).toBe(false);
    for (const bad of [':root {}', '.a, :root {}', 'html:root {}', 'html {}']) expect(hasRootRule(bad), bad).toBe(true);
    for (const ok of ['.html-x {}', '/* :root {} */ .a {}', '[data-theme="dark"] .a {}']) expect(hasRootRule(ok), ok).toBe(false);
  });
  it('kihita @import tabatakse ka jutumärkidega', () => {
    const imports = (css: string) => [...css.matchAll(/@import\s+(?:'[^']+'|"[^"]+")([^;]*);/g)];
    expect(imports('@import "x.css";')[0][1]).toBe('');
    expect(imports(`@import "x.css" layer(base);`)[0][1]).toMatch(/layer\(/);
  });
});
