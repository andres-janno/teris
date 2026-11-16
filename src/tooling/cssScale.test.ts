import { describe, expect, it } from 'vitest';
import { rescaleCss, scaleFontSize, scaleRadius, scaleSpacing } from './cssScale';

describe('kirjasuurus → skaala 11/12/13/14/16/20 (inventuur 9A, kasutaja otsus: väikseimad 11px)', () => {
  it.each([
    [9.6, 11], [10.24, 11], [10.88, 11], [11, 11], [11.2, 11],
    [11.52, 12], [11.84, 12], [12.16, 12], [12, 12],
    [12.48, 13], [12.8, 13], [13.12, 13], [13, 13],
    [13.44, 14], [14.4, 14], [15.2, 14], [14, 14],
    [16, 16], [16.8, 16], [17.6, 16], [18.4, 16],
    [19.2, 20], [20, 20], [21.6, 20], [22.4, 20],
  ])('%spx → %spx', (input, expected) => expect(scaleFontSize(input)).toBe(expected));
});

describe('vahe → skaala 2,4,6,8,10,12,16,24,32 (võrdsel kaugusel väiksem, tihedus jääb)', () => {
  it.each([
    [1, 2], [1.5, 2], [2, 2], [3, 2], [4, 4], [5, 4], [7, 6], [9, 8], [11, 10],
    [14, 12], [18, 16], [20, 16], [22, 24], [25, 24], [28, 24], [30, 32], [32, 32],
    [-8, -8], [-10, -10], [-3, -2], [0, 0],
  ])('%spx → %spx', (input, expected) => expect(scaleSpacing(input)).toBe(expected));
  it('üle 32px jääb käsitsi (paigutuse mõõt)', () => {
    expect(scaleSpacing(36)).toBeNull();
    expect(scaleSpacing(56)).toBeNull();
  });
});

describe('nurk → 4 astet', () => {
  it.each([
    ['2px', 'var(--radius-sm)'], ['4px', 'var(--radius-sm)'], ['7px', 'var(--radius-sm)'],
    ['8px', 'var(--radius-md)'], ['10px', 'var(--radius-md)'], ['12px', 'var(--radius-md)'],
    ['16px', 'var(--radius-lg)'], ['50%', '9999px'], ['999px', '9999px'], ['0', '0'],
    ['var(--radius-sm)', 'var(--radius-sm)'],
  ])('%s → %s', (input, expected) => expect(scaleRadius(input)).toBe(expected));
});

describe('rescaleCss', () => {
  it('asendab rem/px väärtused, säilitab !important, muutujad, calc, auto ja em', () => {
    const r = rescaleCss(
      '.a{font-size:0.64rem;padding:3px 14px;border-radius:4px 4px 0 0;margin:0 auto;gap:var(--g)}\n' +
      '.b{font-size:0.85rem !important;margin-left:-5px;padding-right:0.12em;width:calc(100% - 7px)}'
    );
    expect(r.css).toBe(
      '.a{font-size:11px;padding:2px 12px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;margin:0 auto;gap:var(--g)}\n' +
      '.b{font-size:14px !important;margin-left:-4px;padding-right:0.12em;width:calc(100% - 7px)}'
    );
    expect(r.manual).toEqual([]);
  });
  it('säilitab deklaratsiooni lõpu tühikud ja katab nurgaomadused ning scroll-padding', () => {
    const r = rescaleCss('.a { border-top-left-radius: 12px ; scroll-padding: 3px }\n.b { scroll-margin-top: 5px;\n}');
    expect(r.css).toBe('.a { border-top-left-radius: var(--radius-md) ; scroll-padding: 2px }\n.b { scroll-margin-top: 4px;\n}');
  });
  it('üle 32px vahe jääb muutmata ja läheb käsitsi loetellu (rea nr)', () => {
    const r = rescaleCss('.a {\n  padding: 16px 44px 56px 16px;\n}');
    expect(r.css).toContain('padding: 16px 44px 56px 16px;');
    expect(r.manual).toEqual(['2: padding: 16px 44px 56px 16px']);
  });
  it('ei puutu font-size: inherit, var() ega muutujate definitsioone', () => {
    const css = '.a{font-size:inherit}.b{font-size:var(--x)}:root{--radius-sm: 6px;--cc-h: 32px}';
    expect(rescaleCss(css).css).toBe(css);
  });
});
