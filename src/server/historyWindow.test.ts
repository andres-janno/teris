import { describe, it, expect } from 'vitest';
import { resolveHistoryWindow } from './historyWindow';

const now = new Date('2026-10-07T15:00:00.000Z');

describe('resolveHistoryWindow', () => {
  it('ilma seotuseta: viimased N tundi praegusest hetkest', () => {
    const w = resolveHistoryWindow(6, null, null, now);
    expect(w.start.toISOString()).toBe('2026-10-07T09:00:00.000Z');
    expect(w.end).toBe(now);
  });

  it('aktiivne seotus: valitud tunnid, kuid mitte varem kui seotuse algus', () => {
    expect(resolveHistoryWindow(48, '2026-10-04T16:00:00.000Z', null, now).start.toISOString())
      .toBe('2026-10-05T15:00:00.000Z');
    expect(resolveHistoryWindow(48, '2026-10-07T12:00:00.000Z', null, now).start.toISOString())
      .toBe('2026-10-07T12:00:00.000Z');
  });

  it('lõppenud seotus: tunnid arvestatakse seotuse lõpust', () => {
    const w = resolveHistoryWindow(48, '2026-10-04T09:00:00.000Z', '2026-10-04T16:00:00.000Z', now);
    expect(w.start.toISOString()).toBe('2026-10-04T09:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-04T16:00:00.000Z');
    expect(resolveHistoryWindow(2, '2026-10-04T09:00:00.000Z', '2026-10-04T16:00:00.000Z', now).start.toISOString())
      .toBe('2026-10-04T14:00:00.000Z');
  });

  it('vigane kuupäev jäetakse arvestamata', () => {
    expect(resolveHistoryWindow(6, 'xx', 'yy', now).end).toBe(now);
  });
});
