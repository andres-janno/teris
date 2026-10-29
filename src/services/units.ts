// src/services/units.ts — koguse teisendus materjali laoühikusse (kasutavad server ja klient)
const MASS: Record<string, number> = { g: 0.001, kg: 1, t: 1000 };

const norm = (u: string) => u.trim().toLowerCase();

/** Teisendab koguse ühikust `from` ühikusse `to`; teisendamatu paari korral null. */
export function convertQty(qty: number, from: string, to: string): number | null {
  const f = norm(from);
  const t = norm(to);
  if (f === t) return qty;
  if (Object.hasOwn(MASS, f) && Object.hasOwn(MASS, t)) return Math.round(((qty * MASS[f]) / MASS[t]) * 1e9) / 1e9;
  return null;
}

/** Koguse kuvamine: alati 2 komakohta, tuhanded eraldatud (nt "−3 256,00"). */
export const formatQty = (n: number): string => n.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
