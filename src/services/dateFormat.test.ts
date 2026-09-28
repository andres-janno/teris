import { describe, expect, it } from 'vitest';
import { formatDate, formatDateRange, parseEtDate } from './dateFormat';

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
