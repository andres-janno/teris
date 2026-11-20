import { describe, expect, it } from 'vitest';
import { adminBadgeTone, adminFormGridClass, adminLicenseGridClass } from './adminUi';

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
});
