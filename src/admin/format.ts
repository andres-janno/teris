// Vormindus: Eesti aeg (Europe/Tallinn), litsentsi kuupäevad.
export { formatDate } from '../services/dateFormat.ts';

const dtf = new Intl.DateTimeFormat('et-EE', {
  timeZone: 'Europe/Tallinn',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** ISO aeg → '15.08.2026 14:05' Eesti ajas. */
export function formatTallinn(iso?: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export const formatHa = (ha: number): string => (Math.round(ha * 10) / 10).toFixed(1);
