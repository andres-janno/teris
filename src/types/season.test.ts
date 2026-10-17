import { describe, expect, it } from 'vitest';
import { deriveSeasonPhase, activeSeasonYear, seasonSelectorYears } from './season';

describe('deriveSeasonPhase', () => {
  it('lukus hooaeg on alati suletud', () => {
    expect(deriveSeasonPhase(true, ['Talinisu'])).toBe('closed');
  });
  it('põlde või kultuure pole → avamata', () => {
    expect(deriveSeasonPhase(false, [])).toBe('unopened');
    expect(deriveSeasonPhase(false, ['', 'Määramata', null, 'Teadmata kultuur'])).toBe('unopened');
  });
  it('osal põldudel kultuur määramata → planeerimisel', () => {
    expect(deriveSeasonPhase(false, ['Talinisu', 'Määramata'])).toBe('planning');
    expect(deriveSeasonPhase(false, ['Talinisu', '  '])).toBe('planning');
  });
  it('kõigil põldudel kultuur → aktiivne', () => {
    expect(deriveSeasonPhase(false, ['Talinisu', 'Taliraps'])).toBe('active');
  });
});

const ys = (...years: number[]) => years.map((year) => ({ year }));

describe('activeSeasonYear', () => {
  it('jooksev aasta, kui see hooaeg on olemas', () => {
    expect(activeSeasonYear(ys(2025, 2026, 2027), 2026)).toBe(2026);
  });
  it('muidu lähim olemasolev, võrdsel kaugusel varasem', () => {
    expect(activeSeasonYear(ys(2022, 2029), 2026)).toBe(2029);
    expect(activeSeasonYear(ys(2025, 2027), 2026)).toBe(2025);
  });
  it('hooaegu pole → jooksev aasta', () => {
    expect(activeSeasonYear([], 2026)).toBe(2026);
  });
});

describe('seasonSelectorYears', () => {
  it('vahemik −4 … +3 ainult olemasolevatest hooaegadest', () => {
    expect(seasonSelectorYears(ys(2020, 2021, 2022, 2024, 2026, 2029, 2030), 2026)).toEqual([2022, 2024, 2026, 2029]);
  });
  it('puuduvaid aastaid ei lisata', () => {
    expect(seasonSelectorYears(ys(2026), 2026)).toEqual([2026]);
    expect(seasonSelectorYears([], 2026)).toEqual([]);
  });
});
