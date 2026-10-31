import { describe, it, expect } from 'vitest';
import { ignitionHoursByDay } from './ignitionHours';

const p = (iso: string, ignition: boolean | null = true) => ({ time: new Date(iso), ignition });

describe('ignitionHoursByDay', () => {
  it('summeerib süüte sees olevad vahemikud päevade kaupa (Tallinna aeg)', () => {
    const pts = [p('2026-05-10T05:00:00Z'), p('2026-05-10T05:10:00Z'), p('2026-05-10T05:20:00Z'), p('2026-05-10T21:50:00Z'), p('2026-05-10T22:05:00Z')];
    // 05:00–05:20 = 20 min (10.05); 21:50 UTC → 11.05 00:50 Tallinna aeg, 15 min
    expect(ignitionHoursByDay(pts)).toEqual([{ day: '2026-05-10', hours: 0.33 }, { day: '2026-05-11', hours: 0.25 }]);
  });
  it('süüde väljas või liiga pikk vahe katkestab', () => {
    const pts = [p('2026-05-10T05:00:00Z'), p('2026-05-10T05:10:00Z', false), p('2026-05-10T05:20:00Z'), p('2026-05-10T06:00:00Z')];
    expect(ignitionHoursByDay(pts, 20 * 60 * 1000)).toEqual([]);
  });
  it('süüteväljata seade (null) loetakse sees olevaks', () => {
    expect(ignitionHoursByDay([p('2026-05-10T05:00:00Z', null), p('2026-05-10T05:15:00Z', null), p('2026-05-10T05:30:00Z', null)])).toEqual([{ day: '2026-05-10', hours: 0.5 }]);
  });
});
