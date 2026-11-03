// src/server/articleCategories.ts — artikli liigid: süsteemsete liikide tagamine ja liikide API.
// Liike muudavad ainult finantsjuht ja admin; süsteemset liiki ei kustutata ega viida teise rühma.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction, type TxClient } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import {
  SYSTEM_CATEGORIES, OTHER_CONSUMABLE_NAME, ARTICLE_GROUPS, categoryChangeError,
  type ArticleGroup, type ArticleSystemKind
} from '../services/articleRules.ts';
import type { PriaArticleKind } from '../types/fieldWork.ts';

const FORBIDDEN = 'Artikli gruppe muudavad ainult finantsjuht ja admin';
const canManage = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};

/** Loob puuduvad süsteemsed liigid (korduvkäivitatav; uus ettevõte saab need esimesel kasutusel). */
export async function ensureArticleCategories(tx: TxClient): Promise<void> {
  await tx.articleCategory.createMany({
    data: SYSTEM_CATEGORIES.map((c) => ({ name: c.name, group: c.group, systemKind: c.systemKind, sortOrder: c.sortOrder })),
    skipDuplicates: true
  });
}

export async function systemCategoryId(tx: TxClient, kind: ArticleSystemKind): Promise<string> {
  const found = await tx.articleCategory.findFirst({ where: { systemKind: kind }, select: { id: true } });
  if (found) return found.id;
  await ensureArticleCategories(tx);
  return (await tx.articleCategory.findFirstOrThrow({ where: { systemKind: kind }, select: { id: true } })).id;
}

/** PRIA impordi materjali liik: seeme/väetis/taimekaitse süsteemsest liigist, muu → „Muu kulumaterjal“. */
export async function categoryIdForPriaKind(tx: TxClient, kind: PriaArticleKind): Promise<string> {
  if (kind !== 'OTHER') return systemCategoryId(tx, kind);
  const found = await tx.articleCategory.findFirst({ where: { name: OTHER_CONSUMABLE_NAME, group: 'CONSUMABLE' }, select: { id: true } });
  if (found) return found.id;
  return (await tx.articleCategory.create({ data: { name: OTHER_CONSUMABLE_NAME, group: 'CONSUMABLE', sortOrder: 190 } })).id;
}

const text = (v: unknown, max = 120): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};

export async function handleArticleCategories(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (!pathname.startsWith('/api/article-categories')) return false;

  if (pathname === '/api/article-categories' && method === 'GET') {
    const rows = await tenantTransaction(async (tx) => {
      await ensureArticleCategories(tx);
      return tx.articleCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { articles: true } } } });
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...c }) => ({ ...c, articleCount: _count.articles })));
    return true;
  }

  if (!canManage(req)) {
    json(res, { error: FORBIDDEN }, 403);
    return true;
  }

  if (pathname === '/api/article-categories' && method === 'POST') {
    const b = await parseBody(req, 16 * 1024);
    const name = text(b?.name);
    const group = ARTICLE_GROUPS.includes(b?.group) ? (b.group as ArticleGroup) : null;
    if (!name || !group) {
      json(res, { error: 'Grupi nimi ja tüüp on kohustuslikud' }, 400);
      return true;
    }
    const id = text(b?.id, 64);
    const old = id ? await prisma.articleCategory.findUnique({ where: { id }, select: { group: true, systemKind: true } }) : null;
    if (id && !old) {
      json(res, { error: 'Gruppi ei leitud' }, 404);
      return true;
    }
    const err = categoryChangeError(old, group);
    if (err) {
      json(res, { error: err }, 400);
      return true;
    }
    const data = { name, group, sortOrder: Number.isFinite(Number(b?.sortOrder)) ? Math.trunc(Number(b.sortOrder)) : 0, isActive: b?.isActive !== false };
    try {
      const saved = id ? await prisma.articleCategory.update({ where: { id }, data }) : await prisma.articleCategory.create({ data });
      json(res, saved);
    } catch (e: any) {
      if (e?.code === 'P2002') json(res, { error: 'Selle nimega grupp on juba olemas' }, 409);
      else throw e;
    }
    return true;
  }

  if (pathname.startsWith('/api/article-categories/') && method === 'DELETE') {
    const id = decodeURIComponent(pathname.slice('/api/article-categories/'.length));
    const c = await prisma.articleCategory.findUnique({ where: { id }, include: { _count: { select: { articles: true } } } });
    if (!c) {
      json(res, { error: 'Gruppi ei leitud' }, 404);
      return true;
    }
    if (c.systemKind) {
      json(res, { error: 'Süsteemset gruppi ei saa kustutada' }, 409);
      return true;
    }
    if (c._count.articles) {
      json(res, { error: `Grupis on ${c._count.articles} artiklit. Vii need enne teise gruppi.` }, 409);
      return true;
    }
    await prisma.articleCategory.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }
  return false;
}
