import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateTime, parseDateInput, round2, limitRows, pickOne, ToolInputError, tallinnYear, fieldLabel, dayAfter } from './format';

describe('kuupäevad', () => {
  it('vormindab Tallinna ajas', () => {
    expect(fmtDate(new Date('2026-05-10T00:00:00Z'))).toBe('10.05.2026');
    expect(fmtDate(new Date('2026-12-31T22:30:00Z'))).toBe('01.01.2027');
    expect(fmtDate(null)).toBeNull();
    expect(fmtDateTime(new Date('2026-10-31T08:05:00Z'))).toBe('31.10.2026 10:05');
  });
  it('loeb eesti ja ISO kuju', () => {
    expect(parseDateInput('5.9.2026', 'from')?.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(parseDateInput('2026-09-05', 'from')?.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(parseDateInput(undefined, 'from')).toBeUndefined();
    expect(() => parseDateInput('31.02.2026', 'to')).toThrow(ToolInputError);
    expect(() => parseDateInput('eile', 'to')).toThrow(/to/);
    expect(dayAfter(new Date('2026-09-05T00:00:00Z')).toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });
  it('aasta Tallinna ajas', () => {
    expect(tallinnYear(new Date('2026-12-31T22:30:00Z'))).toBe(2027);
  });
});

describe('arvud ja loendid', () => {
  it('ümardab 2 kohani', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(null)).toBeNull();
  });
  it('piirab ja ütleb kogusumma', () => {
    const r = limitRows([1, 2, 3], 2);
    expect(r).toEqual({ total: 3, shown: 2, rows: [1, 2] });
    expect(limitRows(Array.from({ length: 1500 }, (_, i) => i), 5000).shown).toBe(1000);
    expect(limitRows(Array.from({ length: 300 }, (_, i) => i), undefined).shown).toBe(200);
  });
  it('põllu silt', () => {
    expect(fieldLabel({ num: '4', name: 'Toosi' })).toBe('Nr 4 Toosi');
  });
});

describe('pickOne', () => {
  const c = [
    { id: '1', label: 'Nr 4 Toosi', keys: ['4', 'Toosi'] },
    { id: '2', label: 'Nr 14 Toosi alumine', keys: ['14', 'Toosi alumine'] },
    { id: '3', label: 'Nr 7 Kase', keys: ['7', 'Kase'] }
  ];
  it('täpne vaste võidab osalise', () => {
    expect(pickOne('Põld', 'toosi', c).id).toBe('1');
    expect(pickOne('Põld', '4', c).id).toBe('1');
  });
  it('üks osaline vaste', () => {
    expect(pickOne('Põld', 'kas', c).id).toBe('3');
  });
  it('mitu vastet → valikud', () => {
    expect(() => pickOne('Põld', 'oos', c)).toThrow(/sobib mitmele: Nr 4 Toosi; Nr 14 Toosi alumine/);
  });
  it('vastet pole', () => {
    expect(() => pickOne('Põld', 'Mets', c)).toThrow('Põld "Mets" ei leitud');
  });
});
