// src/services/landTenure.ts — katastriüksuse omandivorm tuletatakse maaomanikust: omanik = põllu operaator → oma maa,
// muu omanik → renditud. Kui omanik või põllu operaator on sisestamata, on omandivorm teadmata. Sama kliendis ja serveris.
import type { LandTenureType } from '../types/cadastre.ts';

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function deriveOwnershipType(
  owner: { ownerName?: string | null; ownerPartyId?: string | null },
  operator: { id?: string | null; name?: string | null } | null | undefined
): LandTenureType {
  if (owner.ownerPartyId && operator?.id) return owner.ownerPartyId === operator.id ? 'OWNED' : 'RENTED';
  const name = norm(owner.ownerName);
  const operatorName = norm(operator?.name);
  // Võrdlemiseks on vaja mõlemat: omanikku ja operaatorit
  if (!name || !operatorName) return 'UNKNOWN';
  return name === operatorName ? 'OWNED' : 'RENTED';
}

export const OWNERSHIP_LABELS: Record<LandTenureType, string> = { OWNED: 'Oma maa', RENTED: 'Renditud', UNKNOWN: 'Teadmata' };
