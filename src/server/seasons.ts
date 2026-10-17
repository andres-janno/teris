// src/server/seasons.ts — hooaja automaatne loomine: import, mis viitab puuduvale aastale, loob selle hooaja.
import { prisma, requireTenantId, type TxClient } from './db.ts';

type Db = typeof prisma | TxClient;

export const isSeasonYear = (y: unknown): y is number => Number.isInteger(y) && (y as number) >= 1990 && (y as number) <= 2100;

/** Loob puuduvad hooajad (nimi "Hooaeg <aasta>"); olemasolevaid ei muuda. Tagastab aasta → hooaja id. */
export async function ensureSeasons(years: Iterable<unknown>, db: Db = prisma): Promise<Map<number, number>> {
  const tenantId = requireTenantId();
  const ids = new Map<number, number>();
  for (const raw of new Set([...years].map(Number))) {
    if (!isSeasonYear(raw)) continue;
    // Mõlemal kliendil on sama season.upsert; liitüüp ei luba otse kutsuda
    const s = await (db as TxClient).season.upsert({
      where: { tenantId_year: { tenantId, year: raw } },
      update: {},
      create: { year: raw, name: `Hooaeg ${raw}` },
      select: { id: true }
    });
    ids.set(raw, s.id);
  }
  return ids;
}
