// src/server/harvestLots.ts — saagipartiid: koristuskande partii ja saagirea kogus, kultuuri teraartikkel,
// partii sulgemine (punkri kaal, kannete tonnid) ja uuesti avamine. Reeglid: src/services/harvestLotRules.ts.
import type { TxClient } from './db.ts';
import { ensureSeasons } from './seasons.ts';
import { getDefaultWarehouseId } from './stock.ts';
import { systemCategoryId } from './articleCategories.ts';
import { matchCrop, type LineDraft } from './fieldWorkRules.ts';
import { computeBunkerTonnes, defaultLotName, entryHarvestTonnes } from '../services/harvestLotRules.ts';

export class HarvestLotError extends Error { http?: number }
export const closedLotError = (name: string) => `Partii „${name}“ on suletud — ava partii uuesti`;
export const NO_CROP_ERROR = 'Põllu kultuur on määramata — sisesta tonnid käsitsi';

const rate3 = (qty: number, area: number) => (qty > 0 && area > 0 ? Math.round((qty / area) * 1000) / 1000 : null);

// Automaatse partii loomine serialiseeritakse ettevõtte piires (sama hooaja ja kultuuri topeltpartii vältimiseks)
export async function lockLots(tx: TxClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('harvest-lot:' || current_setting('app.tenant_id')))`;
}

/** Kultuuri teraartikkel (liik GRAIN); puudumisel luuakse „‹kultuur› terad“ (ühik t, vaikimisi ladu = põhiladu). */
export async function ensureGrainArticle(tx: TxClient, crop: { id: string; name: string }): Promise<string> {
  const found = await tx.article.findFirst({
    where: { cropId: crop.id, category: { systemKind: 'GRAIN' } },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: { id: true }
  });
  if (found) return found.id;
  const categoryId = await systemCategoryId(tx, 'GRAIN');
  const name = `${crop.name} terad`;
  const byName = await tx.article.findFirst({ where: { categoryId, name }, select: { id: true } });
  if (byName) return byName.id;
  return (await tx.article.create({ data: { name, categoryId, unit: 't', cropId: crop.id, defaultWarehouseId: await getDefaultWarehouseId(tx) } })).id;
}

/** Põlluhooaja hooaeg ja kultuur; kultuurita või tundmatu kultuuriga põllul partiid pole (null). */
async function lotKeyOf(tx: TxClient, fieldSeasonId: number) {
  const fs = await tx.fieldSeason.findUnique({ where: { id: fieldSeasonId }, select: { year: true, seasonId: true, crop: true, cropId: true } });
  if (!fs) return null;
  const crops = await tx.crop.findMany({ select: { id: true, name: true } });
  const crop = (fs.cropId ? crops.find((c) => c.id === fs.cropId) : undefined) ?? matchCrop(fs.crop, crops);
  if (!crop) return null;
  const seasonId = fs.seasonId ?? (await ensureSeasons([fs.year], tx)).get(fs.year) ?? null;
  return seasonId === null ? null : { seasonId, year: fs.year, crop };
}

/** Põllu hooaja ja kultuuri lahtised partiid, uuemad eespool (kande vormi valik). */
export async function openLotsFor(tx: TxClient, fieldSeasonId: number): Promise<{ id: string; name: string }[]> {
  const key = await lotKeyOf(tx, fieldSeasonId);
  if (!key) return [];
  return tx.harvestLot.findMany({ where: { seasonId: key.seasonId, cropId: key.crop.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } });
}

async function findOrCreateOpenLot(tx: TxClient, key: NonNullable<Awaited<ReturnType<typeof lotKeyOf>>>): Promise<string> {
  await lockLots(tx);
  const open = await tx.harvestLot.findFirst({ where: { seasonId: key.seasonId, cropId: key.crop.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  if (open) return open.id;
  const taken = (await tx.harvestLot.findMany({ select: { name: true } })).map((l) => l.name);
  return (await tx.harvestLot.create({
    data: {
      name: defaultLotName(key.crop.name, key.year, taken), seasonId: key.seasonId, cropId: key.crop.id,
      articleId: await ensureGrainArticle(tx, key.crop), warehouseId: await getDefaultWarehouseId(tx)
    }
  })).id;
}

export interface EntryHarvestInput {
  fieldSeasonId: number;
  areaHa: number | null; // kande pindala; puudumisel põllu pindala
  fieldAreaHa: number;
  bunkers: number | null;
  manual: boolean; // tonnid käsitsi lukustatud
  requestedLotId: string | null; // vormil valitud partii
  old: { harvestLotId: string | null; harvestBunkers: number | null; harvestTonnesManual: boolean; harvestTonnes: number } | null; // muudetav kanne
}

/**
 * Koristuskande partii ja saagirea kogus (muudab drafts-i saagirida). Lukustamata kande kogus = punkrid × punkri kaal
 * suletud partiis, lahtises 0 (kaalumata). Suletud partii kanne ei muutu. Tagastab partii id (saagireata kandel null).
 */
export async function applyEntryHarvest(tx: TxClient, drafts: LineDraft[], input: EntryHarvestInput): Promise<string | null> {
  const line = drafts.find((l) => l.kind === 'HARVEST');
  const oldLotId = input.old?.harvestLotId ?? null;
  // Saagireata kandel, mis polnud partiis, pole partiiga midagi teha
  if (!line && !oldLotId) return null;
  let lotId: string | null = null;
  if (line) {
    if (input.requestedLotId) {
      const req = await tx.harvestLot.findUnique({ where: { id: input.requestedLotId }, select: { id: true, seasonId: true, cropId: true } });
      if (!req) throw new HarvestLotError('Saagipartiid ei leitud');
      // Valitud partii peab olema selle põllu hooaja ja kultuuri oma
      const key = await lotKeyOf(tx, input.fieldSeasonId);
      if (!key || key.seasonId !== req.seasonId || key.crop.id !== req.cropId) throw new HarvestLotError('Valitud partii ei ole selle põllu hooaja ja kultuuri partii');
      lotId = req.id;
    } else if (oldLotId) lotId = oldLotId;
    else if (!input.old || !input.manual) {
      // Automaatne partii: uuele kandele või muudetavale kandele, mille tonnid on lukust lahti; lukustatud partiita kanne (PRIA, ajalugu) jääb partiita
      const key = await lotKeyOf(tx, input.fieldSeasonId);
      if (key) lotId = await findOrCreateOpenLot(tx, key);
    }
    if (!lotId && !input.manual) throw new HarvestLotError(NO_CROP_ERROR);
  }
  // Staatus loetakse pärast lukku, et paralleelne sulgemine ei jääks märkamata
  if (lotId || oldLotId) await lockLots(tx);
  const lots = await tx.harvestLot.findMany({
    where: { id: { in: [lotId, oldLotId].filter((x): x is string => !!x) } },
    select: { id: true, name: true, status: true, bunkerTonnes: true }
  });
  // Suletud partii: uus kanne, partii vahetus või saagi muutus nõuab partii uuesti avamist
  const old = input.old;
  const changed = !old || old.harvestLotId !== lotId || old.harvestBunkers !== input.bunkers || old.harvestTonnesManual !== input.manual
    || (input.manual && old.harvestTonnes !== (line?.quantity ?? 0));
  const closed = lots.find((l) => l.status === 'CLOSED');
  if (closed && changed) throw new HarvestLotError(closedLotError(closed.name));
  if (line && !input.manual) {
    const lot = lots.find((l) => l.id === lotId);
    let qty = 0;
    if (lot?.status === 'CLOSED') qty = entryHarvestTonnes(input.bunkers, lot.bunkerTonnes);
    else if (old && !changed) qty = old.harvestTonnes; // uuesti avatud partii: muutmata kande tonnid jäävad kuni järgmise sulgemiseni
    line.quantity = qty;
    line.ratePerHa = rate3(qty, input.areaHa ?? input.fieldAreaHa);
  }
  return lotId;
}

/** Kustutamise kaitse: suletud partii kannet ei kustutata (kutsuda tehingus). */
export async function assertEntryLotOpen(tx: TxClient, harvestLotId: string | null): Promise<void> {
  if (!harvestLotId) return;
  await lockLots(tx);
  const lot = await tx.harvestLot.findUnique({ where: { id: harvestLotId }, select: { name: true, status: true } });
  if (lot?.status === 'CLOSED') throw new HarvestLotError(closedLotError(lot.name));
}

/** Sulgemine: punkri kaal ja lukustamata kannete saagi tonnid; kinnitatud kanne, mille kogus muutub → CHANGED. */
export async function closeLot(tx: TxClient, id: string): Promise<void> {
  await lockLots(tx);
  const lot = await tx.harvestLot.findUnique({
    where: { id },
    select: {
      status: true,
      weighings: { select: { tonnes: true } },
      entries: {
        select: {
          id: true, harvestBunkers: true, harvestTonnesManual: true, financeStatus: true, areaHa: true,
          fieldWork: { select: { fieldSeason: { select: { areaHa: true } } } },
          lines: { where: { kind: 'HARVEST' }, select: { id: true, quantity: true, confirmedQuantity: true } }
        }
      }
    }
  });
  if (!lot) throw new HarvestLotError('Saagipartiid ei leitud');
  if (lot.status === 'CLOSED') throw new HarvestLotError('Partii on juba suletud');
  const r = computeBunkerTonnes(
    lot.weighings.reduce((s, w) => s + w.tonnes, 0),
    lot.entries.map((e) => ({ key: e.id, bunkers: e.harvestBunkers, manual: e.harvestTonnesManual, tonnes: e.lines[0]?.quantity ?? 0 }))
  );
  if (!r.ok) throw new HarvestLotError(r.error);
  for (const e of lot.entries) {
    const line = e.lines[0];
    if (e.harvestTonnesManual || !line) continue;
    const qty = entryHarvestTonnes(e.harvestBunkers, r.bunkerTonnes);
    await tx.workEntryLine.update({ where: { id: line.id }, data: { quantity: qty, ratePerHa: rate3(qty, e.areaHa ?? e.fieldWork.fieldSeason.areaHa) } });
    if (e.financeStatus === 'CONFIRMED' && line.confirmedQuantity !== qty) await tx.workEntry.update({ where: { id: e.id }, data: { financeStatus: 'CHANGED' } });
  }
  await tx.harvestLot.update({ where: { id }, data: { status: 'CLOSED', bunkerTonnes: r.bunkerTonnes, closedAt: new Date() } });
}

/** Uuesti avamine: punkri kaal tühjaks; kannete tonnid jäävad kuni järgmise sulgemiseni. */
export async function reopenLot(tx: TxClient, id: string): Promise<void> {
  const lot = await tx.harvestLot.findUnique({ where: { id }, select: { status: true } });
  if (!lot) throw new HarvestLotError('Saagipartiid ei leitud');
  if (lot.status === 'OPEN') throw new HarvestLotError('Partii on juba lahtine');
  await tx.harvestLot.update({ where: { id }, data: { status: 'OPEN', bunkerTonnes: null, closedAt: null } });
}
