// src/server/mcp/format.ts — MCP vastuste vormindus ja sisendi tõlgendus (puhtad funktsioonid).
// Kuupäevad pp.kk.aaaa Tallinna ajas, kogused 2 komakohaga, loendid piiratud koos kogusummaga.

/** Sisendi viga, mille teade näidatakse AI-le (isError tulemus). */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

const TZ = 'Europe/Tallinn';
const dateParts = new Intl.DateTimeFormat('et-EE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const part = (d: Date) => {
  const p = dateParts.formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { day: g('day'), month: g('month'), year: g('year'), hour: g('hour'), minute: g('minute') };
};

export function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = part(d);
  return `${p.day}.${p.month}.${p.year}`;
}

export function fmtDateTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = part(d);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export const tallinnYear = (now: Date = new Date()): number => Number(part(now).year);

/** 'pp.kk.aaaa' või 'aaaa-kk-pp' → UTC südaöö; tühi → undefined; vigane → ToolInputError. */
export function parseDateInput(s: string | undefined, label: string): Date | undefined {
  if (s === undefined || s.trim() === '') return undefined;
  const t = s.trim();
  let y: number, m: number, d: number;
  const et = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (et) [d, m, y] = [Number(et[1]), Number(et[2]), Number(et[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else throw new ToolInputError(`Vigane kuupäev "${s}" (${label}); kasuta pp.kk.aaaa või aaaa-kk-pp`);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new ToolInputError(`Vigane kuupäev "${s}" (${label})`);
  }
  return date;
}

export const dayAfter = (d: Date): Date => new Date(d.getTime() + 24 * 60 * 60 * 1000);

export function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export function limitRows<T>(rows: T[], limit: number | undefined): { total: number; shown: number; rows: T[] } {
  const n = Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const out = rows.slice(0, n);
  return { total: rows.length, shown: out.length, rows: out };
}

export type Candidate = { id: string; label: string; keys: string[] };

/** Nime/numbri järgi üks vaste: täpne (tõstutundetu) võidab; mitu osalist → valikud veateates. */
export function pickOne(kind: string, query: string, candidates: Candidate[]): Candidate {
  const q = query.trim().toLowerCase();
  const exact = candidates.filter((c) => c.keys.some((k) => k.toLowerCase() === q) || c.label.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = exact.length > 1 ? exact : candidates.filter((c) => c.label.toLowerCase().includes(q) || c.keys.some((k) => k.toLowerCase().includes(q)));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new ToolInputError(`${kind} "${query}" ei leitud`);
  const names = partial.slice(0, 15).map((c) => c.label).join('; ');
  throw new ToolInputError(`${kind} "${query}" sobib mitmele: ${names}${partial.length > 15 ? '; …' : ''} — täpsusta`);
}

export const fieldLabel = (f: { num: string; name: string }): string => `Nr ${f.num} ${f.name}`.trim();
