// src/services/partyMatch.ts
// Isiku nime järgi sobitamine (PRIA põlluraamat). Puhas funktsioon — kasutavad nii klient kui server.
const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// PRIA võib nime anda kujul "Perenimi Eesnimi"; proovime ka pööratud järjekorda.
export function matchPartyByName<T extends { name: string }>(name: string, parties: T[]): T | null {
  const n = normalizeName(name);
  if (!n) return null;
  const parts = n.split(' ');
  const candidates = new Set([
    n,
    [...parts.slice(1), parts[0]].join(' '),
    [parts[parts.length - 1], ...parts.slice(0, -1)].join(' ')
  ]);
  return parties.find((p) => candidates.has(normalizeName(p.name))) ?? null;
}
