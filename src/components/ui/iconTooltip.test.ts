import { describe, expect, it } from 'vitest';
import { iconTooltip } from './iconTooltip';

describe('iconTooltip', () => {
  it.each(['icon-lg', 'icon-sm', 'icon-xs'] as const)('ikoonnupp %s + title → rakenduse vihje, natiivset title pole', (size) => {
    expect(iconTooltip(size, 'Muuda', undefined)).toEqual({ tooltip: 'Muuda', nativeTitle: undefined, ariaLabel: 'Muuda' });
  });
  it('kutsuja aria-label jääb alles', () => {
    expect(iconTooltip('icon-sm', 'Muuda', 'Muuda põldu')).toEqual({ tooltip: 'Muuda', nativeTitle: undefined, ariaLabel: 'Muuda põldu' });
  });
  it.each(['xs', 'sm', 'md', 'inline', 'auto', undefined, null] as const)('tekstinupp (%s) jätab natiivse title', (size) => {
    expect(iconTooltip(size, 'Muuda', undefined)).toEqual({ tooltip: null, nativeTitle: 'Muuda', ariaLabel: undefined });
  });
  it('ikoonnupp ilma title-ita ei saa vihjet', () => {
    expect(iconTooltip('icon-sm', undefined, 'x')).toEqual({ tooltip: null, nativeTitle: undefined, ariaLabel: 'x' });
  });
  it('tühi title ei anna vihjet', () => {
    expect(iconTooltip('icon-sm', '', undefined).tooltip).toBeNull();
  });
});
