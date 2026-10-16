// src/server/deviceIdentifiers.ts — telemeetriaseadme tunnuste kontroll ja normaliseerimine.
export const IMEI_ERROR = 'Vigane IMEI (15 numbrit, kontrollnumber ei klapi)';
export const MAC_ERROR = 'Vigane MAC-aadress';

export function validateImei(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!/^\d{15}$/.test(s)) return null;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(s[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? s : null;
}

export function normalizeMac(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toUpperCase();
  const m = /^([0-9A-F]{2})([:-]?)([0-9A-F]{2})\2([0-9A-F]{2})\2([0-9A-F]{2})\2([0-9A-F]{2})\2([0-9A-F]{2})$/.exec(s);
  if (!m) return null;
  return [m[1], m[3], m[4], m[5], m[6], m[7]].join(':');
}
