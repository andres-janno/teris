// src/services/dateFormat.ts — kuupäevad eesti vormingus (pp.kk.aaaa).
// Andmetes ja API-s on kuupäevad ISO kujul 'YYYY-MM-DD' (või pikem ISO aeg).

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** ISO kuupäev → '15.08.2026'; tühja väärtuse korral '–'. */
export const formatDate = (iso?: string | null): string => {
  if (!iso) return '–';
  const m = ISO_DATE.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/** Vahemik; sama aasta piires lühem kuju: '01.08–30.09.2026'. */
export const formatDateRange = (start?: string | null, end?: string | null): string => {
  if (!start) return '–';
  if (!end) return `${formatDate(start)} –`;
  const a = ISO_DATE.exec(start);
  const b = ISO_DATE.exec(end);
  if (a && b && a[1] === b[1]) return `${a[3]}.${a[2]}–${b[3]}.${b[2]}.${b[1]}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
};

/** ISO aeg → '15.08.2026 14:05' kohalikus ajas. */
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Kasutaja sisestatud eesti kuupäev → ISO 'YYYY-MM-DD'.
 * Lubab '5.9.2026', '05.09.2026', '5/9/2026', '5-9-2026' ja '05092026'.
 * Tühi sisend → '' ; vigane → null.
 */
export const parseEtDate = (input: string): string | null => {
  const s = input.trim();
  if (!s) return '';
  let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (!m) m = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
