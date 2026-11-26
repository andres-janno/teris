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
  it('--fresh-* ja --trip-* viitavad põhipaleti teemamuutujatele mõlemas teemas', () => {
    const light = themeVars(themesCss, 'light'), dark = themeVars(themesCss, 'dark');
    for (const vars of [light, dark]) {
      expect([vars['--fresh-live'], vars['--fresh-day'], vars['--fresh-week'], vars['--fresh-old'], vars['--fresh-none']]).toEqual([
        'var(--emerald-500)', 'var(--blue-500)', 'var(--amber-400)', 'var(--rose-500)', 'var(--text-muted)',
      ]);
      expect([vars['--trip-moving'], vars['--trip-idle'], vars['--trip-pause']]).toEqual([
        'var(--blue-500)', 'var(--amber-400)', 'var(--emerald-500)',
      ]);
    }
  });
  it.each(['moving', 'idle', 'pause'])('trip-%s on värvinimi', (k) => {
    expect(css).toMatch(new RegExp(`--color-trip-${k}:\\s*var\\(--trip-${k}\\);`));
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

describe('animatsioonid (etapp 4g)', () => {
  it('scale-up on @theme animatsioon koos @keyframes scaleUp-ga', () => {
    expect(css).toMatch(/--animate-scale-up:\s*scaleUp 0\.2s cubic-bezier\(0\.16, 1, 0\.3, 1\);/);
    expect(css).toMatch(/@keyframes scaleUp\s*\{/);
  });
});
