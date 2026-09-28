import { describe, expect, it } from 'vitest';
import { deriveSeasonPhase } from './season';

describe('deriveSeasonPhase', () => {
  it('lukus hooaeg on alati suletud', () => {
    expect(deriveSeasonPhase(true, ['Talinisu'])).toBe('closed');
  });
  it('põlde või kultuure pole → avamata', () => {
    expect(deriveSeasonPhase(false, [])).toBe('unopened');
    expect(deriveSeasonPhase(false, ['', 'Määramata', null])).toBe('unopened');
  });
  it('osal põldudel kultuur määramata → planeerimisel', () => {
    expect(deriveSeasonPhase(false, ['Talinisu', 'Määramata'])).toBe('planning');
    expect(deriveSeasonPhase(false, ['Talinisu', '  '])).toBe('planning');
  });
  it('kõigil põldudel kultuur → aktiivne', () => {
    expect(deriveSeasonPhase(false, ['Talinisu', 'Taliraps'])).toBe('active');
  });
});
