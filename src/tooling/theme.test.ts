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

describe('Tehnika tokenid (etapp 4c)', () => {
  it.each(['live', 'day', 'week', 'old', 'none'])('fresh-%s on värvinimi, väärtus index.css --fresh-%s', (k) => {
    expect(css).toMatch(new RegExp(`--color-fresh-${k}:\\s*var\\(--fresh-${k}\\);`));
    expect(indexCss).toMatch(new RegExp(`--fresh-${k}:\\s*#[0-9a-f]{6};`));
  });
  it.each(['moving', 'idle', 'pause'])('trip-%s on värvinimi', (k) => {
    expect(css).toMatch(new RegExp(`--color-trip-${k}:\\s*var\\(--trip-${k}\\);`));
  });
  it('--trip-* muutujad on :root-is mõlemas teemas (mitte .trip-dialog-i all)', () => {
    expect(indexCss).toMatch(/:root\s*\{[^}]*--trip-moving:\s*#2a78d6;[^}]*--trip-idle:\s*#eb6834;[^}]*--trip-pause:\s*#1baf7a;/);
    expect(indexCss).toMatch(/:root\[data-theme=["']dark["']\]\s*\{[^}]*--trip-moving:\s*#3987e5;[^}]*--trip-idle:\s*#d95926;[^}]*--trip-pause:\s*#199e70;/);
  });
});
