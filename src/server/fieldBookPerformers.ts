// src/server/fieldBookPerformers.ts — põlluraamatu impordi puuduvad teostajad: leia registrist või lisa töötajana.
// Töötab impordi tehingu sees: kui mõne isiku loomine ebaõnnestub, tühistub kogu import (kõik või mitte midagi).
import { matchPartyByName } from '../services/partyMatch.ts';

type Fn = (args: any) => Promise<any>;
export interface PartyClientLike {
  relatedParty: { findMany: Fn; create: Fn };
}
interface PerformerOp { performerId?: string | null; performerName?: string | null }
interface PerformerField { operations?: PerformerOp[] }

export async function resolveMissingPerformers<F extends PerformerField>(
  client: PartyClientLike,
  fields: F[]
): Promise<{ fields: F[]; created: number }> {
  const known: { id: string; name: string }[] = [];
  let loaded = false;
  let created = 0;
  const out: F[] = [];
  for (const f of fields) {
    const operations: PerformerOp[] = [];
    for (const op of Array.isArray(f.operations) ? f.operations : []) {
      const name = typeof op.performerName === 'string' ? op.performerName.trim() : '';
      if (op.performerId || !name) { operations.push(op); continue; }
      if (!loaded) { known.push(...(await client.relatedParty.findMany({ select: { id: true, name: true } }))); loaded = true; }
      let party = matchPartyByName(name, known);
      if (!party) {
        const row = await client.relatedParty.create({ data: { name, type: 'PERSON', roles: ['DRIVER'] }, select: { id: true, name: true } });
        party = { id: row.id, name: row.name };
        known.push(party);
        created++;
      }
      operations.push({ ...op, performerId: party.id });
    }
    out.push({ ...f, operations });
  }
  return { fields: out, created };
}
