import { describe, expect, it } from 'vitest';
import { formatDate, formatDayMonth, formatDateRange, parseEtDate, formatTimeAgo } from './dateFormat';

describe('formatDate', () => {
  it('vormindab ISO kuupäeva eesti kujule', () => {
    expect(formatDate('2026-08-05')).toBe('05.08.2026');
    expect(formatDate('2026-08-05T10:00:00.000Z')).toBe('05.08.2026');
  });
  it('tühi väärtus → kriips', () => {
    expect(formatDate(null)).toBe('–');
    expect(formatDate('')).toBe('–');
  });
});

describe('formatDayMonth', () => {
  it('vormindab ISO kuupäeva päevaks ja kuuks ilma aastata', () => {
    expect(formatDayMonth('2026-08-05')).toBe('05.08');
    expect(formatDayMonth('2026-10-04T00:00:00.000Z')).toBe('04.10');
  });
  it('tühi väärtus → kriips', () => {
    expect(formatDayMonth(null)).toBe('–');
    expect(formatDayMonth('')).toBe('–');
  });
});

describe('formatDateRange', () => {
  it('sama aasta piires lühem kuju', () => {
    expect(formatDateRange('2026-08-05', '2026-09-25')).toBe('05.08–25.09.2026');
  });
  it('eri aastad täiskujul', () => {
    expect(formatDateRange('2025-12-20', '2026-01-10')).toBe('20.12.2025 – 10.01.2026');
  });
});

describe('parseEtDate', () => {
  it('loeb eri eraldajatega ja lühendatud sisendi', () => {
    expect(parseEtDate('05.09.2026')).toBe('2026-09-05');
    expect(parseEtDate('5.9.2026')).toBe('2026-09-05');
    expect(parseEtDate('5/9/2026')).toBe('2026-09-05');
    expect(parseEtDate('05092026')).toBe('2026-09-05');
  });
  it('tühi → tühi string, vigane → null', () => {
    expect(parseEtDate('  ')).toBe('');
    expect(parseEtDate('31.02.2026')).toBeNull();
    expect(parseEtDate('2026-09-05')).toBeNull();
    expect(parseEtDate('abc')).toBeNull();
  });
});

describe('formatTimeAgo', () => {
  it('tühi või vigane sisend tagastab Andmed puuduvad (mitte Just nüüd)', () => {
    expect(formatTimeAgo(null)).toBe('Andmed puuduvad');
    expect(formatTimeAgo('')).toBe('Andmed puuduvad');
    expect(formatTimeAgo('invalid')).toBe('Andmed puuduvad');
  });

  it('alla 1 minuti tagastab Just nüüd (< 1 min)', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('Just nüüd (< 1 min)');
  });

  it('minutid alla tunni', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatTimeAgo(tenMinsAgo)).toBe('10 min tagasi');
  });

  it('tunnid ja minutid (nt 1197 min -> 19 h 57 min tagasi)', () => {
    const timeAgo = new Date(Date.now() - 1197 * 60 * 1000).toISOString();
    expect(formatTimeAgo(timeAgo)).toBe('19 h 57 min tagasi');
  });

  it('täistund (nt 2 h tagasi)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect(formatTimeAgo(twoHoursAgo)).toBe('2 h tagasi');
  });

  it('päevad ja tunnid (nt 1 p 3 h tagasi)', () => {
    const dayAgo = new Date(Date.now() - (24 + 3) * 3600 * 1000).toISOString();
    expect(formatTimeAgo(dayAgo)).toBe('1 p 3 h tagasi');
  });
});
