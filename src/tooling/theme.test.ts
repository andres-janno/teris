import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/app.css', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');

describe('app.css tokenid (etapp 4b)', () => {
  it('leading-natural on nimega tokenina @theme-s', () => {
    expect(css).toMatch(/--leading-natural:\s*normal;/);
  });
  it('warning-solid on tahke #f59e0b mõlemas teemas', () => {
    expect(css).toMatch(/--color-warning-solid:\s*#f59e0b;/);
  });
  it('sky on tahvli taevasinine #0284c7', () => {
    expect(css).toMatch(/--color-sky:\s*#0284c7;/);
  });
  it('info-solid jääb Badge solid toonile (#2563eb tone-info-solid kaudu), ei kirjutata üle', () => {
    expect(css).toMatch(/--color-info-solid:\s*var\(--tone-info-solid\);/);
  });
  it('sky-text on teemapõhine: heledas #0369a1, tumedas #38bdf8', () => {
    expect(css).toMatch(/--color-sky-text:\s*var\(--tone-sky-text\);/);
    const darkAt = indexCss.indexOf('--tone-info-text: #60a5fa;');
    expect(darkAt).toBeGreaterThan(0);
    const light = indexCss.slice(0, darkAt);
    const dark = indexCss.slice(darkAt);
    expect(light).toMatch(/--tone-sky-text:\s*#0369a1;/);
    expect(dark).toMatch(/--tone-sky-text:\s*#38bdf8;/);
  });
});
