// src/server/tenantDelete.ts — ettevõtte ja kõigi tema andmete jäädav kustutamine (teenusepakkuja).
// Tabelid ja kustutusjärjekord loetakse andmebaasi kataloogist: iga tabel, millel on tenant_id veerg,
// tühjendatakse selle ettevõtte ridadest. Uus ettevõttepõhine tabel kaetakse seega automaatselt.
// Kasutajatega seotud sessioonid, API-võtmed ja paroolilingid kustuvad kaskaadiga.
// Platvormi logi (platform_audit_log) jääb alles — sinna lisatakse kustutamise kirje.
import type { Prisma } from '@prisma/client';

export type ForeignKey = { child: string; parent: string; onDelete: string };

/**
 * Kustutusjärjekord: lapstabel enne vanemat, kui seos keelab vanema kustutamise (RESTRICT / NO ACTION).
 * CASCADE ja SET NULL seosed järjekorda ei mõjuta. Tsükli korral viskab vea.
 */
export function deleteOrder(tables: string[], fks: ForeignKey[]): string[] {
  const set = new Set(tables);
  // parent → lapsed, mis peavad enne kustuma
  const blockers = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]));
  for (const fk of fks) {
    if (fk.onDelete !== 'r' && fk.onDelete !== 'a') continue;
    if (fk.child === fk.parent || !set.has(fk.child) || !set.has(fk.parent)) continue;
    blockers.get(fk.parent)!.add(fk.child);
  }
  const out: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (t: string, path: string[]) => {
    if (state.get(t) === 'done') return;
    if (state.get(t) === 'visiting') throw new Error(`Kustutusjärjekorras on tsükkel: ${[...path, t].join(' → ')}`);
    state.set(t, 'visiting');
    for (const c of [...blockers.get(t)!].sort()) visit(c, [...path, t]);
    state.set(t, 'done');
    out.push(t);
  };
  for (const t of [...tables].sort()) visit(t, []);
  return out;
}

const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Kustutab ettevõtte kõik read; tagastab kustutatud ridade arvu tabeli kaupa (ainult nullist suuremad). */
export async function deleteTenantData(tx: Prisma.TransactionClient, tenantId: string): Promise<Record<string, number>> {
  const tables = (
    await tx.$queryRaw<{ table_name: string }[]>`
      SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = current_schema() AND c.column_name = 'tenant_id' AND t.table_type = 'BASE TABLE'`
  ).map((r) => r.table_name);
  const fks = await tx.$queryRaw<ForeignKey[]>`
    SELECT con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent, con.confdeltype::text AS "onDelete"
    FROM pg_constraint con WHERE con.contype = 'f' AND con.connamespace = current_schema()::regnamespace`;
  const counts: Record<string, number> = {};
  for (const table of deleteOrder(tables, fks)) {
    const n = await tx.$executeRawUnsafe(`DELETE FROM ${quoteIdent(table)} WHERE tenant_id = $1`, tenantId);
    if (n > 0) counts[table] = n;
  }
  const { count } = await tx.supportSession.deleteMany({ where: { targetTenantId: tenantId } });
  if (count > 0) counts.support_sessions = count;
  await tx.tenantLicense.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
  return counts;
}
