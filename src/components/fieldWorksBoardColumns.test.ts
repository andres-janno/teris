// Põllutööde tahvli veergude jaotus: eelmise aasta sügistööd vs käesoleva aasta tööd
import { describe, it, expect } from 'vitest';
import { boardYearGroup, boardColumn, type BoardWorkLike } from './fieldWorksBoardColumns';

const work = (over: Partial<BoardWorkLike>): BoardWorkLike => ({
  phase: 'PREPARATION',
  entries: [],
  plannedDateFrom: null,
  plannedText: null,
  ...over
});

describe('boardYearGroup / boardColumn', () => {
  it('01.11.2025 kandega ettevalmistus hooajal 2026 → eelmine aasta, Ettevalmistus', () => {
    const w = work({ phase: 'PREPARATION', entries: [{ date: '2025-11-01' }] });
    expect(boardYearGroup(w, 2026, false)).toBe('PREV');
    expect(boardColumn(w, 2026, false)).toBe('PREV_PREPARATION');
  });

  it('27.04.2026 kandega töö → käesolev aasta', () => {
    const w = work({ phase: 'PREPARATION', entries: [{ date: '2026-04-27' }] });
    expect(boardYearGroup(w, 2026, false)).toBe('CURRENT');
    expect(boardColumn(w, 2026, false)).toBe('PREPARATION');
  });

  it('kasutab varaseimat kandekuupäeva', () => {
    const w = work({ phase: 'PREPARATION', entries: [{ date: '2026-04-27' }, { date: '2025-10-20' }] });
    expect(boardYearGroup(w, 2026, false)).toBe('PREV');
  });

  it('kandeta töö puhul kasutab planeeritud algust', () => {
    const w = work({ phase: 'PREPARATION', plannedDateFrom: '2025-09-15' });
    expect(boardColumn(w, 2026, false)).toBe('PREV_PREPARATION');
  });

  it('taliviljal kuupäevata külv → eelmine aasta, Sügiskülv', () => {
    const w = work({ phase: 'SOWING' });
    expect(boardYearGroup(w, 2026, true)).toBe('PREV');
    expect(boardColumn(w, 2026, true)).toBe('PREV_SOWING');
  });

  it('15.10.2025 hooldus → eelmine aasta, Sügiskülv', () => {
    const w = work({ phase: 'CARE', entries: [{ date: '2025-10-15' }] });
    expect(boardColumn(w, 2026, true)).toBe('PREV_SOWING');
  });

  it('suvivilja kuupäevata ettevalmistus "Sügis 2025" → eelmine aasta', () => {
    const w = work({ phase: 'PREPARATION', plannedText: 'Sügis 2025' });
    expect(boardYearGroup(w, 2026, false)).toBe('PREV');
    expect(boardColumn(w, 2026, false)).toBe('PREV_PREPARATION');
  });

  it('suvivilja kuupäevata ettevalmistus "apr–mai" → käesolev aasta', () => {
    const w = work({ phase: 'PREPARATION', plannedText: 'apr–mai' });
    expect(boardYearGroup(w, 2026, false)).toBe('CURRENT');
  });

  it('taliviljal kuupäevata hooldus jääb käesolevasse aastasse', () => {
    expect(boardColumn(work({ phase: 'CARE' }), 2026, true)).toBe('CARE');
  });

  it('eelmisel aastal dateeritud koristus jääb käesolevasse Koristusse', () => {
    const w = work({ phase: 'HARVEST', entries: [{ date: '2025-12-01' }] });
    expect(boardColumn(w, 2026, false)).toBe('HARVEST');
  });
});
