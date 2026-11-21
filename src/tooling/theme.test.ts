import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { themeVars } from './contrast';

const css = readFileSync('src/styles/app.css', 'utf8');
const themesCss = readFileSync('src/styles/themes.css', 'utf8');

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
    expect(themeVars(themesCss, 'light')['--tone-sky-text']).toBe('#0369a1');
    expect(themeVars(themesCss, 'dark')['--tone-sky-text']).toBe('#38bdf8');
  });
});

describe('Tehnika tokenid (etapp 4c)', () => {
  it.each(['live', 'day', 'week', 'old', 'none'])('fresh-%s on värvinimi app.css-is', (k) => {
    expect(css).toMatch(new RegExp(`--color-fresh-${k}:\\s*var\\(--fresh-${k}\\);`));
  });
  it('--fresh-* väärtused on mõlemas teemas', () => {
    const light = themeVars(themesCss, 'light'), dark = themeVars(themesCss, 'dark');
    expect([light['--fresh-live'], light['--fresh-day'], light['--fresh-week'], light['--fresh-old'], light['--fresh-none']]).toEqual(['#1baf7a', '#2a78d6', '#e0a100', '#d64545', '#94a3b8']);
    expect([dark['--fresh-live'], dark['--fresh-day'], dark['--fresh-week'], dark['--fresh-old'], dark['--fresh-none']]).toEqual(['#199e70', '#3987e5', '#d9a21c', '#e05a5a', '#64748b']);
  });
  it.each(['moving', 'idle', 'pause'])('trip-%s on värvinimi', (k) => {
    expect(css).toMatch(new RegExp(`--color-trip-${k}:\\s*var\\(--trip-${k}\\);`));
  });
  it('--trip-* muutujad on :root-is mõlemas teemas (mitte .trip-dialog-i all)', () => {
    const light = themeVars(themesCss, 'light'), dark = themeVars(themesCss, 'dark');
    expect([light['--trip-moving'], light['--trip-idle'], light['--trip-pause']]).toEqual(['#2a78d6', '#eb6834', '#1baf7a']);
    expect([dark['--trip-moving'], dark['--trip-idle'], dark['--trip-pause']]).toEqual(['#3987e5', '#d95926', '#199e70']);
  });
});

describe('teemamuutujate allikas (etapp 4g)', () => {
  it('surnud muutujad on kustutatud', () => {
    expect(themesCss).not.toMatch(/--(?:bg-card|bg-card-hover|bg-header|blue-400|border-highlight|border-strong|input-color):/);
  });
  it('nurgaraadiusi ei dubleerita: allikas on app.css @theme', () => {
    expect(themesCss).not.toMatch(/--radius-/);
    expect(css).toMatch(/--radius-sm:\s*6px;[\s\S]*--radius-md:\s*10px;[\s\S]*--radius-lg:\s*16px;/);
  });
  it('põhiplokid on kaks: hele (:root) ja tume', () => {
    expect(themesCss.match(/^:root(?:,|\[data-theme="dark"\])/gm)?.length).toBe(2);
    expect(themeVars(themesCss, 'light')['--crop-tint']).toBe('18%');
    expect(themeVars(themesCss, 'dark')['--crop-tint']).toBe('28%');
  });
});
