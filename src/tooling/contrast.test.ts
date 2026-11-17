import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, over, parseColor, resolveColor, themeColors, themeVars, tint, type Rgba } from './contrast';

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
const names = themeColors(appCss);
const AA = 4.5;

describe('kontrasti abifunktsioonid', () => {
  it('valge mustal 21, sama värv 1', () => {
    expect(contrastRatio(parseColor('#ffffff'), parseColor('#000000'))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor('#16a34a'), parseColor('#16a34a'))).toBeCloseTo(1, 5);
  });
  it('#16a34a valgel on 3.30 (WCAG näide inventuurist)', () => {
    expect(contrastRatio(parseColor('#ffffff'), parseColor('#16a34a'))).toBeCloseTo(3.3, 1);
  });
  it('läbipaistev värv segatakse taustaga; tint = Tailwindi bg-x/15', () => {
    expect(Math.round(over(parseColor('rgba(0, 0, 0, 0.5)'), parseColor('#ffffff')).r)).toBe(128);
    expect(Math.round(tint(parseColor('#000000'), 50, parseColor('#ffffff')).g)).toBe(128);
  });
  it('lahendab var() ahela ja varuväärtuse, defineerimata viskab', () => {
    const vars = { '--a': 'var(--b)', '--b': '#112233' };
    expect(resolveColor('var(--a)', vars)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(resolveColor('var(--x, #fff)', vars).r).toBe(255);
    expect(() => resolveColor('var(--x)', vars)).toThrow();
  });
});

for (const theme of ['light', 'dark'] as const) {
  describe(`kontrast ${theme}`, () => {
    const vars = themeVars(indexCss, theme);
    const color = (name: string): Rgba => resolveColor(names[name] ?? name, vars);
    const card = color('card');
    const popover = color('popover');
    const check = (fg: string, bg: Rgba, label: string) =>
      expect(contrastRatio(color(fg), bg), `${theme}: ${label}`).toBeGreaterThanOrEqual(AA);

    it('tekstivärvid kaardil ja dialoogis', () => {
      // 'primary' (roheline) puudub: kasutaja otsusel 2026-11-17 on roheline kõikjal Kaart-nupu heledam #16a34a.
      for (const fg of ['foreground', 'muted-foreground', 'subtle', 'info', 'warning', 'destructive', 'accent',
        'success-text', 'info-text', 'warning-text', 'danger-text', 'accent-text']) {
        check(fg, card, `${fg}/card`);
        check(fg, popover, `${fg}/popover`);
      }
    });
    it('placeholder (text-subtle) sisestusväljal', () => {
      check('subtle', over(color('field'), popover), 'subtle/field');
    });
    // Põhinupu gradient (primary-from/to) ja tahke roheline (primary-strong) on kasutaja otsusel (2026-11-16/17)
    // heledam #16a34a, kontrastist hoolimata — neid paare ei kontrollita. Hõljumise toon peab täitma AA.
    it('valge tekst hõljumise primaartoonil', () => {
      check('white', color('primary-hover'), 'white/primary-hover');
    });
    it('soft märgid: toonitekst 15% toonil kaardi peal', () => {
      const pairs: [string, string][] = [
        ['success-text', 'primary'], ['info-text', 'info'], ['warning-text', 'warning'],
        ['danger-text', 'destructive'], ['accent-text', 'accent'],
      ];
      for (const [fg, bg] of pairs) check(fg, tint(color(bg), 15, card), `${fg} on ${bg}/15`);
    });
    it('solid märgid: valge või tume tekst täisvärvil', () => {
      check('white', color('info-solid'), 'solid info');
      check('white', color('accent-solid'), 'solid accent');
      check('white', color('danger-solid'), 'solid danger');
      check('on-warning', color('warning'), 'solid warning');
    });
  });
}

describe('legacy CSS', () => {
  it('index.css-is pole #16a34a tekstivärvi ega tahket tausta (valge tekst 3.30:1) — kasuta tokenit või primaargradienti', () => {
    expect(indexCss.match(/^\s*(?:color|background(?:-color)?):\s*#16a34a[^;]*;/gim) ?? []).toEqual([]);
  });
  it('valge tekst ei seisa heleda rohelise (#22c55e) taustal', () => {
    const bad = [...indexCss.matchAll(/\{([^{}]*)\}/g)].filter(([, b]) => /background(?:-color)?:\s*#22c55e/i.test(b) && /(?<![\w-])color:\s*(#fff(?:fff)?|white)\b/i.test(b));
    expect(bad.length).toBe(0);
  });
  it('index.css ei kasuta --emerald-600 tekstivärvina (tumedas 3.56:1) — kasuta --tone-success-text', () => {
    expect(indexCss.match(/(?<![\w-])color:\s*var\(--emerald-600\)/g) ?? []).toEqual([]);
  });
  it('tahvli päise tähiste tekst (heleda teema reegel) kasutab toonitekst-tokenit, mitte kõvakodeeritud värvi', () => {
    const rules = [...indexCss.matchAll(/(?:^|\n)(\.fw-head-cell\.milestone\.[\w-]+ strong)\s*\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, sel, body] of rules) {
      const color = body.match(/color:\s*([^;]+);/)?.[1].trim() ?? '';
      expect(color, sel).toMatch(/^var\(--tone-[a-z]+-text\)$|^#(475569)$/);
    }
  });
});
