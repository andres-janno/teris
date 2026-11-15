import { describe, expect, it } from 'vitest';
import { iconTooltip } from './iconTooltip';

describe('iconTooltip', () => {
  it.each(['icon', 'icon-sm', 'icon-xs'] as const)('ikoonnupp %s + title → rakenduse vihje, natiivset title pole', (size) => {
    expect(iconTooltip(size, 'Muuda', undefined)).toEqual({ tooltip: 'Muuda', nativeTitle: undefined, ariaLabel: 'Muuda' });
  });
  it('kutsuja aria-label jääb alles', () => {
    expect(iconTooltip('icon-sm', 'Muuda', 'Muuda põldu')).toEqual({ tooltip: 'Muuda', nativeTitle: undefined, ariaLabel: 'Muuda põldu' });
  });
  it.each(['sm', 'md', 'auto', undefined, null] as const)('tekstinupp (%s) jätab natiivse title', (size) => {
    expect(iconTooltip(size, 'Muuda', undefined)).toEqual({ tooltip: null, nativeTitle: 'Muuda', ariaLabel: undefined });
  });
  it('ikoonnupp ilma title-ita ei saa vihjet', () => {
    expect(iconTooltip('icon', undefined, 'x')).toEqual({ tooltip: null, nativeTitle: undefined, ariaLabel: 'x' });
  });
  it('tühi title ei anna vihjet', () => {
    expect(iconTooltip('icon', '', undefined).tooltip).toBeNull();
  });
});
