// Põllutööde tahvli veergude jaotus: eelmise aasta sügistööd vs käesoleva aasta tööd
import { describe, it, expect } from 'vitest';
import { autumnColumns, boardColumns, boardYearGroup, type BoardWorkLike } from './fieldWorksBoardColumns';

let seq = 0;
const work = (over: Partial<BoardWorkLike>): BoardWorkLike => ({
  id: `w${++seq}`,
  phase: 'PREPARATION',
  priaCode: null,
  entries: [],
  plannedDateFrom: null,
  plannedText: null,
  ...over
});
const col = (w: BoardWorkLike, year: number, isWinter: boolean) => boardColumns([w], year, isWinter).get(w.id);

describe('boardYearGroup / boardColumns', () => {
  it('01.11.2025 kandega ettevalmistus hooajal 2026 → eelmine aasta, Ettevalmistus', () => {
    const w = work({ phase: 'PREPARATION', entries: [{ date: '2025-11-01' }] });
    expect(boardYearGroup(w, 2026, false)).toBe('PREV');
    expect(col(w, 2026, false)).toBe('PREV_PREPARATION');
  });

  it('27.04.2026 kandega töö → käesolev aasta', () => {
    const w = work({ phase: 'PREPARATION', entries: [{ date: '2026-04-27' }] });
    expect(boardYearGroup(w, 2026, false)).toBe('CURRENT');
    expect(col(w, 2026, false)).toBe('PREPARATION');
  });

  it('kasutab varaseimat kandekuupäeva', () => {
    const w = work({ phase: 'PREPARATION', entries: [{ date: '2026-04-27' }, { date: '2025-10-20' }] });
    expect(boardYearGroup(w, 2026, false)).toBe('PREV');
  });

  it('kandeta töö puhul kasutab planeeritud algust', () => {
    const w = work({ phase: 'PREPARATION', plannedDateFrom: '2025-09-15' });
    expect(col(w, 2026, false)).toBe('PREV_PREPARATION');
  });

  it('taliviljal kuupäevata külv → eelmine aasta, Sügiskülv', () => {
    const w = work({ phase: 'SOWING' });
    expect(boardYearGroup(w, 2026, true)).toBe('PREV');
    expect(col(w, 2026, true)).toBe('PREV_SOWING');
  });

  it('15.10.2025 hooldus ilma dateeritud külvita → eelmise aasta Ettevalmistus', () => {
    const w = work({ phase: 'CARE', entries: [{ date: '2025-10-15' }] });
    expect(col(w, 2026, true)).toBe('PREV_PREPARATION');
  });

  it('suvivilja kuupäevata ettevalmistus "Sügis 2025" → eelmine aasta', () => {
    const w = work({ phase: 'PREPARATION', plannedText: 'Sügis 2025' });
    expect(boardYearGroup(w, 2026, false)).toBe('PREV');
    expect(col(w, 2026, false)).toBe('PREV_PREPARATION');
  });

  it('suvivilja kuupäevata ettevalmistus "apr–mai" → käesolev aasta', () => {
    const w = work({ phase: 'PREPARATION', plannedText: 'apr–mai' });
    expect(boardYearGroup(w, 2026, false)).toBe('CURRENT');
  });

  it('taliviljal kuupäevata hooldus jääb käesolevasse aastasse', () => {
    expect(col(work({ phase: 'CARE' }), 2026, true)).toBe('CARE');
  });

  it('kuupäevata hooldus "Sügis 2025" → eelmise aasta Sügishooldus', () => {
    expect(col(work({ phase: 'CARE', plannedText: 'Sügis 2025' }), 2026, true)).toBe('PREV_CARE');
  });

  it('eelmisel aastal dateeritud koristus jääb käesolevasse Koristusse', () => {
    const w = work({ phase: 'HARVEST', entries: [{ date: '2025-12-01' }] });
    expect(col(w, 2026, false)).toBe('HARVEST');
  });

  it('Nr 15 hooaeg 2026: sügistööd jagunevad külvi kuupäeva järgi', () => {
    const plough = work({ phase: 'PREPARATION', priaCode: 'Kündmine', entries: [{ date: '2025-08-19' }] });
    const disc = work({ phase: 'CARE', priaCode: 'Randaalimine', entries: [{ date: '2025-08-27' }] });
    const fert = work({ phase: 'CARE', priaCode: 'Väetamine', entries: [{ date: '2025-08-27' }] });
    const sow = work({ phase: 'SOWING', priaCode: 'Külvamine/istutamine', entries: [{ date: '2025-08-27' }] });
    const spray1 = work({ phase: 'CARE', priaCode: 'Taimekaitsevahendi kasutamine', entries: [{ date: '2025-09-13' }] });
    const spray2 = work({ phase: 'CARE', priaCode: 'Taimekaitsevahendi kasutamine', entries: [{ date: '2025-09-21' }] });
    const spring = work({ phase: 'CARE', priaCode: 'Väetamine', entries: [{ date: '2026-04-20' }] });
    const m = boardColumns([plough, disc, fert, sow, spray1, spray2, spring], 2026, true);
    expect([plough, disc, fert, sow, spray1, spray2, spring].map((w) => m.get(w.id))).toEqual([
      'PREV_PREPARATION', 'PREV_PREPARATION', 'PREV_PREPARATION', 'PREV_SOWING', 'PREV_CARE', 'PREV_CARE', 'CARE'
    ]);
  });
});

describe('autumnColumns', () => {
  it('külvita plokis on kõik dateeritud tööd Ettevalmistus', () => {
    const a = work({ phase: 'CARE', entries: [{ date: '2025-09-01' }] });
    const b = work({ phase: 'PREPARATION', plannedDateFrom: '2025-10-01' });
    const m = autumnColumns([a, b]);
    expect([m.get(a.id), m.get(b.id)]).toEqual(['PREP', 'PREP']);
  });

  it('kuupäevata tööd faasi järgi', () => {
    const prep = work({ phase: 'PREPARATION' });
    const sow = work({ phase: 'SOWING' });
    const care = work({ phase: 'CARE' });
    const m = autumnColumns([prep, sow, care]);
    expect([m.get(prep.id), m.get(sow.id), m.get(care.id)]).toEqual(['PREP', 'SOWING', 'CARE']);
  });

  it('PRIA külvi kood on külv ka teise faasiga; arvestab varaseimat külvi', () => {
    const sowA = work({ phase: 'PREPARATION', priaCode: 'Külvamine/istutamine', plannedDateFrom: '2025-09-10' });
    const sowB = work({ phase: 'SOWING', plannedDateFrom: '2025-09-05' });
    const mid = work({ phase: 'CARE', plannedDateFrom: '2025-09-07' });
    const m = autumnColumns([sowA, sowB, mid]);
    expect([m.get(sowA.id), m.get(sowB.id), m.get(mid.id)]).toEqual(['SOWING', 'SOWING', 'CARE']);
  });
});
