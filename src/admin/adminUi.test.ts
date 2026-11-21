import { describe, expect, it } from 'vitest';
import { auditTsx, offByOneBreakpoints } from '../tooling/uiAudit';
import * as ui from './adminUi';
import { adminBadgeTone, adminFormGridClass, adminLicenseGridClass } from './adminUi';

/** Kõik adminUi klassikonstandid (stringid); `adminBadgeTone` on funktsioon ja jääb välja. */
const allAdminClassStrings = (): string[] => Object.values(ui as Record<string, unknown>).filter((x): x is string => typeof x === 'string');

describe('adminUi', () => {
  it('badge toonid vastavad vanale ok/off/neutral', () => {
    expect(adminBadgeTone('ok')).toBe('success');
    expect(adminBadgeTone('off')).toBe('danger');
    expect(adminBadgeTone('neutral')).toBe('neutral');
  });
  it('vormi ruudustik läheb kitsal ekraanil ühe veeruga', () => {
    // Vana `max-width: 640px` = laius ≤ 640; Tailwindi max-[…] on range-süntaks (laius < N), seega 641px.
    expect(adminFormGridClass).toContain('max-[641px]:grid-cols-1');
    expect(adminLicenseGridClass).toContain('max-[641px]:grid-cols-1');
  });
  it('konstante on ja need on stringid (uus konstant satub skaalakontrolli alla)', () => {
    expect(allAdminClassStrings().length).toBeGreaterThan(20);
  });
  it('ükski konstant ei kasuta keelatud suvalisi väärtusi, skaalavälist vahet ega värvi', () => {
    for (const cls of allAdminClassStrings()) {
      const a = auditTsx(`className="${cls}"`);
      expect(a.arbitrary, cls).toEqual([]);
      expect(a.offScaleSpacing, cls).toEqual([]);
      expect(a.colors, cls).toBe(0);
    }
  });
  it('kirjasuurused, paksused ja nurgad ainult skaalast', () => {
    const tokens = allAdminClassStrings().flatMap((c) => c.split(/\s+/));
    const sizeOk = /^(?:\S+:)?text-(2xs|xs|sm|base|lg|xl|foreground|muted-foreground|subtle|info-text|left|right|center)$/;
    const weightOk = new Set(['font-normal', 'font-medium', 'font-semibold']);
    const roundedOk = /^rounded(-(none|sm|md|lg|full))?$/;
    for (const t of tokens) {
      if (/(?:^|:)text-(?!foreground|muted|subtle|info|left|right|center)/.test(t)) expect(t).toMatch(sizeOk);
      const w = /(?:^|:)(font-(?:normal|medium|semibold|bold|extrabold|black|thin|light))$/.exec(t);
      if (w) expect(weightOk.has(w[1]), t).toBe(true);
      const r = /(?:^|:)(rounded[a-z-]*)$/.exec(t);
      if (r) expect(r[1], t).toMatch(roundedOk);
    }
  });
  it('kitsa ekraani murdepunktid on vana max-width + 1 (range-süntaks)', () => {
    for (const cls of allAdminClassStrings()) expect(offByOneBreakpoints(cls), cls).toEqual([]);
  });
});
