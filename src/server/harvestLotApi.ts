// src/server/harvestLotApi.ts — saagipartiid (HTTP): loend, detail, partii loomine/muutmine/kustutamine, sulgemine,
// kaalumised ja kuivatuskulud. Reeglid: harvestLots.ts, src/services/harvestLotRules.ts.
// Lahtiste partiide valik (/open) on kõigile; kõik muu (sh raha) ainult finantsjuhile ja adminile.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import { ensureSeasons, isSeasonYear } from './seasons.ts';
import { recomputeArticleStock } from './stock.ts';
import { ensureDefaultServices } from './entryArticles.ts';
import { closeLot, reopenLot, openLotsFor, ensureGrainArticle, lockLots, HarvestLotError, closedLotError } from './harvestLots.ts';
import { lotServicePrice } from '../services/harvestLotRules.ts';

const FINANCE_FORBIDDEN = 'Saagipartiid on nähtavad ainult finantsjuhile ja adminile';
const canSeeFinance = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};
const text = (v: unknown, max = 500): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().split('T')[0] : null);
const dateOnly = (v: unknown): Date | null => {
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(String(v ?? ''));
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00Z`);
  // Võimatu kuupäev (nt 2026-02-31) veereb teise kuusse — ringi kontroll
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m[1] ? d : null;
};
const money = (d: unknown) => (d === null || d === undefined ? null : Number(d));
const round2 = (n: number) => Math.round(n * 100) / 100;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const SUMMARY_INCLUDE = {
  season: { select: { year: true } },
  crop: { select: { name: true } },
  article: { select: { name: true } },
  warehouse: { select: { name: true } },
  weighings: { select: { tonnes: true } },
  entries: { select: { harvestBunkers: true, harvestTonnesManual: true } }
};

function summaryDto(l: any) {
  return {
    id: l.id, name: l.name, seasonYear: l.season.year, cropId: l.cropId, cropName: l.crop.name,
    articleId: l.articleId, articleName: l.article.name, warehouseId: l.warehouseId, warehouseName: l.warehouse.name,
    status: l.status,
    bunkerTonnes: l.bunkerTonnes,
    bunkers: l.entries.filter((e: any) => !e.harvestTonnesManual).reduce((s: number, e: any) => s + (e.harvestBunkers ?? 0), 0),
    weighedTonnes: round6(l.weighings.reduce((s: number, w: any) => s + w.tonnes, 0)),
    entryCount: l.entries.length,
    closedAt: l.closedAt ? l.closedAt.toISOString() : null
  };
}

async function loadSummary(tx: any, id: string) {
  const l = await tx.harvestLot.findUnique({ where: { id }, include: SUMMARY_INCLUDE });
  return l ? summaryDto(l) : null;
}

export async function handleHarvestLots(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (pathname !== '/api/harvest-lots' && !pathname.startsWith('/api/harvest-lots/')) return false;

  // Lahtiste partiide valik kande vormile: kõigile sisselogitutele
  if (pathname === '/api/harvest-lots/open' && method === 'GET') {
    const fsId = Number(url.searchParams.get('fieldSeasonId'));
    if (!Number.isInteger(fsId) || fsId <= 0) {
      json(res, { error: 'Vali põld' }, 400);
      return true;
    }
    json(res, await tenantTransaction((tx) => openLotsFor(tx, fsId)));
    return true;
  }

  const finance = canSeeFinance(req);
  if (!finance) {
    json(res, { error: FINANCE_FORBIDDEN }, 403);
    return true;
  }
  let parts: string[];
  try {
    parts = pathname.split('/').slice(3).map(decodeURIComponent); // [id, 'weighings', wid] jne
  } catch {
    json(res, { error: 'Vigane aadress' }, 400);
    return true;
  }
  const [id, sub, subId] = parts;
  const fail = (error: string, status = 400) => { json(res, { error }, status); return true; };

  try {
    // --- Loend ---
    if (!id && method === 'GET') {
      const yearRaw = url.searchParams.get('year');
      const year = yearRaw ? Number(yearRaw) : null;
      if (year !== null && !Number.isInteger(year)) return fail('Vigane hooaeg');
      const rows = await prisma.harvestLot.findMany({
        where: year ? { season: { year } } : {},
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: SUMMARY_INCLUDE
      });
      json(res, rows.map(summaryDto));
      return true;
    }

    // --- Loomine / muutmine ---
    if (!id && method === 'POST') {
      const b = await parseBody(req);
      const editId = text(b?.id, 64);
      const name = text(b?.name, 120);
      if (!name) return fail('Partii nimi on kohustuslik');
      const notes = text(b?.notes, 1000);
      const warehouseId = text(b?.warehouseId, 64);
      const saved = await tenantTransaction(async (tx) => {
        const warehouse = warehouseId ? await tx.warehouse.findUnique({ where: { id: warehouseId } }) : null;
        if (!warehouse) throw new HarvestLotError('Ladu ei leitud');
        if (editId) {
          const lot = await tx.harvestLot.findUnique({ where: { id: editId }, select: { id: true, articleId: true, warehouseId: true } });
          if (!lot) { const e = new HarvestLotError('Saagipartiid ei leitud'); e.http = 404; throw e; }
          if (!warehouse.isActive && warehouse.id !== lot.warehouseId) throw new HarvestLotError('Ladu on mitteaktiivne');
          await tx.harvestLot.update({ where: { id: editId }, data: { name, warehouseId: warehouse.id, notes } });
          if (lot.warehouseId !== warehouse.id) await recomputeArticleStock(tx, [lot.articleId]);
          return loadSummary(tx, editId);
        }
        if (!warehouse.isActive) throw new HarvestLotError('Ladu on mitteaktiivne');
        const year = num(b?.year);
        if (!isSeasonYear(year)) throw new HarvestLotError('Hooaeg on kohustuslik');
        const cropId = text(b?.cropId, 64);
        const crop = cropId ? await tx.crop.findUnique({ where: { id: cropId }, select: { id: true, name: true } }) : null;
        if (!crop) throw new HarvestLotError('Kultuuri ei leitud');
        const seasonId = (await ensureSeasons([year], tx)).get(year)!;
        const articleId = await ensureGrainArticle(tx, crop);
        const created = await tx.harvestLot.create({ data: { name, seasonId, cropId: crop.id, articleId, warehouseId: warehouse.id, notes } });
        return loadSummary(tx, created.id);
      });
      json(res, saved);
      return true;
    }

    // --- Detail ---
    if (id && !sub && method === 'GET') {
      const l = await prisma.harvestLot.findUnique({
        where: { id },
        include: {
          ...SUMMARY_INCLUDE,
          entries: {
            orderBy: { date: 'asc' },
            select: {
              id: true, date: true, harvestBunkers: true, harvestTonnesManual: true, financeStatus: true,
              fieldWork: { select: { fieldSeason: { select: { field: { select: { name: true } } } } } },
              lines: { where: { kind: 'HARVEST' }, select: { quantity: true } }
            }
          },
          weighings: { orderBy: { date: 'asc' } },
          costs: { orderBy: { date: 'asc' }, include: { article: { select: { name: true, unit: true, category: { select: { group: true } } } } } }
        }
      });
      if (!l) return fail('Saagipartiid ei leitud', 404);
      json(res, {
        ...summaryDto({ ...l, entries: l.entries.map((e) => ({ harvestBunkers: e.harvestBunkers, harvestTonnesManual: e.harvestTonnesManual })) }),
        notes: l.notes,
        entries: l.entries.map((e) => ({
          id: e.id, date: isoDate(e.date), fieldName: e.fieldWork.fieldSeason.field.name, bunkers: e.harvestBunkers,
          manual: e.harvestTonnesManual, tonnes: e.lines[0]?.quantity ?? 0, financeStatus: e.financeStatus
        })),
        weighings: l.weighings.map((w) => ({ id: w.id, date: isoDate(w.date), tonnes: w.tonnes, notes: w.notes })),
        costs: l.costs.map((c) => {
          const unitPrice = money(c.unitPrice);
          return {
            id: c.id, date: isoDate(c.date), articleId: c.articleId, articleName: c.article.name, unit: c.article.unit,
            isService: c.article.category.group === 'SERVICE', quantity: c.quantity, notes: c.notes,
            unitPrice, total: unitPrice === null ? null : round2(c.quantity * unitPrice)
          };
        })
      });
      return true;
    }

    // --- Kustutamine ---
    if (id && !sub && method === 'DELETE') {
      const result = await tenantTransaction(async (tx) => {
        await lockLots(tx);
        const lot = await tx.harvestLot.findUnique({ where: { id }, select: { articleId: true, _count: { select: { entries: true } }, costs: { select: { articleId: true } } } });
        if (!lot) return 404;
        if (lot._count.entries > 0) return 409;
        await tx.harvestLot.delete({ where: { id } });
        await recomputeArticleStock(tx, [lot.articleId, ...lot.costs.map((c) => c.articleId)]);
        return 200;
      });
      if (result === 404) return fail('Saagipartiid ei leitud', 404);
      if (result === 409) return fail('Partiil on kandeid — kustuta või tõsta kanded enne', 409);
      json(res, { success: true, id });
      return true;
    }

    // --- Sulge / ava ---
    if (id && (sub === 'close' || sub === 'reopen') && !subId && method === 'POST') {
      const out = await tenantTransaction(async (tx) => {
        if (sub === 'reopen') await lockLots(tx);
        await (sub === 'close' ? closeLot(tx, id) : reopenLot(tx, id));
        return loadSummary(tx, id);
      });
      json(res, out);
      return true;
    }

    // --- Kaalumised ---
    if (id && sub === 'weighings' && !subId && method === 'POST') {
      const b = await parseBody(req);
      const tonnes = num(b?.tonnes);
      if (tonnes === null || !(tonnes > 0)) return fail('Kaal peab olema suurem kui 0');
      const date = dateOnly(b?.date);
      if (!date) return fail('Kuupäev on kohustuslik');
      const w = await tenantTransaction(async (tx) => {
        // Lukk enne staatuse lugemist: paralleelne sulgemine ei lase kaalumist läbi
        await lockLots(tx);
        const lot = await tx.harvestLot.findUnique({ where: { id }, select: { name: true, status: true, articleId: true } });
        if (!lot) throw new HarvestLotError('Saagipartiid ei leitud');
        if (lot.status === 'CLOSED') { const e = new HarvestLotError(closedLotError(lot.name)); e.http = 409; throw e; }
        const created = await tx.harvestLotWeighing.create({ data: { lotId: id, date, tonnes, notes: text(b?.notes, 1000) } });
        await recomputeArticleStock(tx, [lot.articleId]);
        return created;
      });
      json(res, { id: w.id, date: isoDate(w.date), tonnes: w.tonnes, notes: w.notes });
      return true;
    }
    if (id && sub === 'weighings' && subId && method === 'DELETE') {
      const result = await tenantTransaction(async (tx) => {
        await lockLots(tx);
        const lot = await tx.harvestLot.findUnique({ where: { id }, select: { name: true, status: true, articleId: true } });
        if (!lot) return { status: 404, error: 'Saagipartiid ei leitud' };
        if (lot.status === 'CLOSED') return { status: 409, error: closedLotError(lot.name) };
        const del = await tx.harvestLotWeighing.deleteMany({ where: { id: subId, lotId: id } });
        if (!del.count) return { status: 404, error: 'Kaalumist ei leitud' };
        await recomputeArticleStock(tx, [lot.articleId]);
        return { status: 200, error: null };
      });
      if (result.error) return fail(result.error, result.status);
      json(res, { success: true, id: subId });
      return true;
    }

    // --- Kuivatuskulud ---
    if (id && sub === 'costs' && !subId && method === 'POST') {
      const b = await parseBody(req);
      const quantity = num(b?.quantity);
      if (quantity === null || !(quantity > 0)) return fail('Kogus peab olema suurem kui 0');
      const date = dateOnly(b?.date);
      if (!date) return fail('Kuupäev on kohustuslik');
      const articleId = text(b?.articleId, 64);
      const c = await tenantTransaction(async (tx) => {
        await lockLots(tx);
        const lot = await tx.harvestLot.findUnique({ where: { id }, select: { id: true } });
        if (!lot) throw new HarvestLotError('Saagipartiid ei leitud');
        const article = articleId
          ? await tx.article.findUnique({ where: { id: articleId }, select: { id: true, price: true, unit: true, name: true, category: { select: { group: true, systemKind: true } } } })
          : null;
        if (!article) throw new HarvestLotError('Materjali ei leitud');
        const isService = article.category.group === 'SERVICE';
        let unitPrice: number | null = null;
        if (isService) {
          const defaults = await ensureDefaultServices(tx);
          const kind = article.category.systemKind;
          unitPrice = lotServicePrice(money(article.price), kind ? defaults.get(kind as any)?.price ?? null : null);
        }
        const created = await tx.harvestLotCost.create({ data: { lotId: id, date, articleId: article.id, quantity, unitPrice, notes: text(b?.notes, 1000) } });
        if (!isService) await recomputeArticleStock(tx, [article.id]);
        const fresh = await tx.harvestLotCost.findUniqueOrThrow({ where: { id: created.id } });
        return { fresh, article, isService };
      });
      const up = money(c.fresh.unitPrice);
      json(res, {
        id: c.fresh.id, date: isoDate(c.fresh.date), articleId: c.article.id, articleName: c.article.name, unit: c.article.unit,
        isService: c.isService, quantity: c.fresh.quantity, notes: c.fresh.notes, unitPrice: up, total: up === null ? null : round2(c.fresh.quantity * up)
      });
      return true;
    }
    if (id && sub === 'costs' && subId && method === 'DELETE') {
      const found = await tenantTransaction(async (tx) => {
        await lockLots(tx);
        const cost = await tx.harvestLotCost.findFirst({ where: { id: subId, lotId: id }, select: { id: true, articleId: true } });
        if (!cost) return false;
        await tx.harvestLotCost.delete({ where: { id: cost.id } });
        await recomputeArticleStock(tx, [cost.articleId]);
        return true;
      });
      if (!found) return fail('Kulu ei leitud', 404);
      json(res, { success: true, id: subId });
      return true;
    }
  } catch (err: any) {
    if (err instanceof HarvestLotError) return fail(err.message, err.http ?? 400);
    if (err?.code === 'P2002') return fail('Sama nimega partii on juba olemas', 409);
    throw err;
  }
  json(res, { error: 'Tundmatu saagipartii päring' }, 404);
  return true;
}
