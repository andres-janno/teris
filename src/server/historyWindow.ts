// src/server/historyWindow.ts
// Telemeetria ajaloo päringuaken: seadme seotuse vahemik [from, to] lõigatakse
// kasutaja valitud tundide arvuga, mõõdetuna akna lõpust (to või praegu).

export const HISTORY_MAX_POINTS = 5000;

export function resolveHistoryWindow(
  hours: number,
  from?: string | null,
  to?: string | null,
  now: Date = new Date()
): { start: Date; end: Date } {
  const parse = (s?: string | null) => {
    const d = s ? new Date(s) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  };
  const end = parse(to) ?? now;
  const hoursStart = new Date(end.getTime() - Math.max(0, hours) * 3600 * 1000);
  const fromDate = parse(from);
  const start = fromDate && fromDate > hoursStart ? fromDate : hoursStart;
  return { start, end };
}
