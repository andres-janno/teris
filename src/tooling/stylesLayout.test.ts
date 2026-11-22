import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const appCss = read('src/styles/app.css');
const styleFiles = readdirSync('src/styles').filter((f) => f.endsWith('.css') && f !== 'app.css' && !f.startsWith('._'));

describe('CSS-failide jaotus (etapp 4g)', () => {
  it('vana index.css ja kihita admin.css on kadunud ega tule tagasi', () => {
    expect(existsSync('src/index.css')).toBe(false);
    expect(existsSync('src/admin/admin.css')).toBe(false);
  });
  it('iga src/styles/*.css on app.css-is imporditud, themes → theme, base → base, ülejäänud → exceptions', () => {
    for (const f of styleFiles) {
      const layer = f === 'themes.css' ? 'theme' : f === 'base.css' ? 'base' : 'exceptions';
      expect(appCss, f).toContain(`@import './${f}' layer(${layer});`);
    }
  });
  it('kihid on kirjas ja kihita @import puudub', () => {
    expect(appCss).toContain('@layer theme, base, exceptions, vendor, components, utilities;');
    const imports = [...strip(appCss).matchAll(/@import\s+'[^']+'([^;]*);/g)];
    for (const m of imports) expect(m[1], m[0]).toMatch(/layer\(|source\(none\)/);
  });
  it('teemamuutujad (:root) ainult themes.css-is, põhireeglid (*, body, html) ainult base.css-is', () => {
    for (const f of styleFiles) {
      const css = strip(read(`src/styles/${f}`));
      if (f !== 'themes.css') expect(css, f).not.toMatch(/(^|[\s,}])(:root|html)\b/);
      if (f !== 'base.css') expect(css, f).not.toMatch(/(^|\n)\s*(\*|body|html)\s*[,{]/);
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
});
