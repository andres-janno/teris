// src/server/helpArticles.ts — kasutajajuhendid ja peatükid (platvormi tabelid help_articles ja help_article_versions,
// ainult authDb()). Ettevõtte rakendus loeb (GET /api/help), teenusepakkuja muudab (platformApi /api/platform/help*).
// HTML puhastatakse brauseris DOMPurify'ga nii salvestamisel kui ka kuvamisel (src/help/sanitizeHelp.ts).
// Iga salvestus (ka taastamine ja eemaldamine) lisab versioonirea; alles jääb HELP_VERSION_LIMIT viimast võtme kohta.
import type { ServerResponse } from 'http';
import type { Prisma } from '@prisma/client';
import { authDb } from './db.ts';
import { json } from './http.ts';
import { helpMaxLength, isHelpKey } from '../help/helpRegistry.ts';
import { isGuideChapterKey } from '../help/guideChapters.ts';
import { GUIDE_LINK_MAX, isValidGuideLink } from '../help/guideLink.ts';

export const HELP_KEY_ERROR = 'Tundmatu juhendi koht';
export const HELP_LINK_ERROR = 'Seotud peatüki viide on vigane';
export const HELP_LINK_LENGTH_ERROR = `Seotud peatüki viide on liiga pikk (kuni ${GUIDE_LINK_MAX} märki)`;
export const HELP_VERSION_ERROR = 'Juhendi versiooni ei leitud';
export const HELP_VERSION_LIMIT = 50;

export const helpLengthError = (key: string): string => `Juhend on liiga pikk (kuni ${helpMaxLength(key)} märki)`;

/** Tühi = pole nähtavat teksti (nt ainult <p><br></p>) */
export const isBlankHelp = (html: string): boolean => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

const isKnownKey = (key: string): boolean => isHelpKey(key) || isGuideChapterKey(key);

export interface HelpRowLite {
  key: string;
  html: string;
  guideLink: string | null;
}

/** Ettevõtte rakenduse vastus: kohtjuhendid, peatükid ja kohtjuhendite seotud peatükid (ainult täidetud tekstiga). */
export function buildHelpPayload(rows: HelpRowLite[]) {
  const articles: Record<string, string> = {};
  const chapters: Record<string, string> = {};
  const guideLinks: Record<string, string> = {};
  for (const r of rows) {
    if (isBlankHelp(r.html)) continue;
    if (isGuideChapterKey(r.key)) chapters[r.key] = r.html;
    else if (isHelpKey(r.key)) {
      articles[r.key] = r.html;
      if (r.guideLink && isValidGuideLink(r.guideLink)) guideLinks[r.key] = r.guideLink;
    }
  }
  return { articles, chapters, guideLinks };
}

/** Ettevõtte rakendusele: kõik registris olevad täidetud juhendid ja peatükid ühe päringuga. */
export async function handleHelpRead(res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (pathname !== '/api/help' || method !== 'GET') return false;
  const rows = await authDb().helpArticle.findMany({ select: { key: true, html: true, guideLink: true } });
  res.setHeader('Cache-Control', 'no-cache');
  json(res, buildHelpPayload(rows));
  return true;
}

export async function listHelpArticles() {
  return authDb().helpArticle.findMany({ orderBy: { key: 'asc' }, select: { key: true, html: true, guideLink: true, updatedAt: true, updatedBy: true } });
}

type Tx = Prisma.TransactionClient;
type Result = { ok: true; deleted: boolean } | { ok: false; status: number; error: string };

/** Lisab versioonirea ja kustutab selle võtme vanemad versioonid (alles HELP_VERSION_LIMIT viimast). */
export async function writeHelpVersion(tx: Tx, key: string, html: string, guideLink: string | null, author: string | null): Promise<void> {
  await tx.helpArticleVersion.create({ data: { key, html, guideLink, createdBy: author } });
  const old = await tx.helpArticleVersion.findMany({ where: { key }, orderBy: { id: 'desc' }, skip: HELP_VERSION_LIMIT, select: { id: true } });
  if (old.length) await tx.helpArticleVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

/** Kirjutab juhendi (või kustutab, kui tekst on tühi) ja lisab versioonirea. Tagastab, kas kirje kustus. */
async function persist(tx: Tx, key: string, html: string, link: string | null, pu: { id: string; username: string }, op: 'save' | 'restore'): Promise<boolean> {
  const blank = isBlankHelp(html);
  if (blank) {
    const { count } = await tx.helpArticle.deleteMany({ where: { key } });
    if (count === 0) return true; // polnud midagi kustutada: ei versiooni ega auditit
    await writeHelpVersion(tx, key, '', null, pu.username);
  } else {
    await tx.helpArticle.upsert({
      where: { key },
      create: { key, html, guideLink: link, updatedBy: pu.username },
      update: { html, guideLink: link, updatedBy: pu.username }
    });
    await writeHelpVersion(tx, key, html, link, pu.username);
  }
  await tx.platformAuditLog.create({
    data: { action: 'HELP_UPDATE', platformUserId: pu.id, targetTenantId: null, details: { key, op: blank ? 'delete' : op } }
  });
  return blank;
}

/** `guideLink` sisendist: puudub/tühi → null; muidu peab olema kehtiv ja ainult kohtjuhendil. */
function parseLinkInput(key: string, raw: unknown): { ok: true; link: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, link: null };
  if (typeof raw === 'string' && raw.length > GUIDE_LINK_MAX) return { ok: false, error: HELP_LINK_LENGTH_ERROR };
  if (typeof raw !== 'string' || isGuideChapterKey(key) || !isValidGuideLink(raw)) return { ok: false, error: HELP_LINK_ERROR };
  return { ok: true, link: raw };
}

/** Salvestab juhendi; tühi tekst kustutab kirje. Kustutada saab ka koodist eemaldatud võtme. */
export async function saveHelpArticle(key: string, input: { html: unknown; guideLink?: unknown }, pu: { id: string; username: string }): Promise<Result> {
  const { html } = input;
  if (typeof html !== 'string') return { ok: false, status: 400, error: 'Juhendi tekst puudub' };
  if (html.length > helpMaxLength(key)) return { ok: false, status: 400, error: helpLengthError(key) };
  const blank = isBlankHelp(html);
  if (!blank && !isKnownKey(key)) return { ok: false, status: 404, error: HELP_KEY_ERROR };
  const link = parseLinkInput(key, input.guideLink);
  if (!link.ok) return { ok: false, status: 400, error: link.error };
  const deleted = await authDb().$transaction((tx) => persist(tx, key, html, link.link, pu, 'save'));
  return { ok: true, deleted };
}

export async function listHelpVersions(key: string) {
  return authDb().helpArticleVersion.findMany({ where: { key }, orderBy: { id: 'desc' }, select: { id: true, createdAt: true, createdBy: true, guideLink: true } });
}

export async function getHelpVersion(key: string, id: number) {
  return authDb().helpArticleVersion.findFirst({ where: { id, key }, select: { id: true, html: true, guideLink: true, createdAt: true, createdBy: true } });
}

/** Taastamine = uus salvestus vana sisuga (uus versioonirida; ajalugu ei muutu). */
export async function restoreHelpVersion(key: string, id: number, pu: { id: string; username: string }): Promise<Result> {
  const v = await getHelpVersion(key, id);
  if (!v) return { ok: false, status: 404, error: HELP_VERSION_ERROR };
  if (!isBlankHelp(v.html) && !isKnownKey(key)) return { ok: false, status: 404, error: HELP_KEY_ERROR };
  const deleted = await authDb().$transaction((tx) => persist(tx, key, v.html, v.guideLink, pu, 'restore'));
  return { ok: true, deleted };
}

/** Kas juhend on tühi (puudub või pole nähtavat teksti). Mustandite laadimine kontrollib seda enne kirjutamist. */
export async function isHelpEmpty(key: string): Promise<boolean> {
  const row = await authDb().helpArticle.findUnique({ where: { key }, select: { html: true } });
  return !row || isBlankHelp(row.html);
}

/** Seotud peatüki viide mustandi laadijale: peab olema kehtiv ja ainult kohtjuhendil (viga on koodiviga, seega viskab). */
function assertDraftLink(key: string, link: string): void {
  if (isGuideChapterKey(key) || !isValidGuideLink(link)) throw new Error(HELP_LINK_ERROR);
}

/**
 * Kirjutab ainult siis, kui juhend on tühi; olemasolevat teksti ei puudutata. Tagastab, kas kirjutas.
 * `guideLink` (kohtjuhendile) pannakse ainult siis, kui tühjal real pole oma linki (olemasolev link jääb).
 */
export async function writeHelpIfEmpty(key: string, html: string, author: string, guideLink: string | null = null): Promise<boolean> {
  if (guideLink) assertDraftLink(key, guideLink);
  return authDb().$transaction(async (tx) => {
    const row = await tx.helpArticle.findUnique({ where: { key }, select: { html: true, guideLink: true } });
    if (row && !isBlankHelp(row.html)) return false;
    const link = row?.guideLink ?? guideLink;
    await tx.helpArticle.upsert({
      where: { key },
      create: { key, html, guideLink: link, updatedBy: author },
      update: { html, guideLink: link, updatedBy: author }
    });
    await writeHelpVersion(tx, key, html, link, author);
    return true;
  });
}

/** Kas kohtjuhendil on tekst, aga seotud peatükk puudub (siis võib laadija lingi panna). */
export async function canSetGuideLink(key: string): Promise<boolean> {
  const row = await authDb().helpArticle.findUnique({ where: { key }, select: { html: true, guideLink: true } });
  return !!row && !isBlankHelp(row.html) && !row.guideLink;
}

/**
 * Paneb seotud peatüki ainult siis, kui kohtjuhendil on tekst ja link on tühi; teksti ega olemasolevat linki ei puudutata.
 * Teeb versioonirea (sama tekst, uus link). `updatedBy` jääb alles (tekst on kasutaja oma). Tagastab, kas pani.
 */
export async function setGuideLinkIfEmpty(key: string, link: string, author: string): Promise<boolean> {
  assertDraftLink(key, link);
  return authDb().$transaction(async (tx) => {
    const row = await tx.helpArticle.findUnique({ where: { key }, select: { html: true, guideLink: true } });
    if (!row || isBlankHelp(row.html) || row.guideLink) return false;
    await tx.helpArticle.update({ where: { key }, data: { guideLink: link } });
    await writeHelpVersion(tx, key, row.html, link, author);
    return true;
  });
}

export function sendHelpResult(res: ServerResponse, r: Result) {
  if (!r.ok) return json(res, { error: r.error }, r.status);
  json(res, { success: true, deleted: r.deleted });
}

export const HELP_PLATFORM_ROUTE = /^\/api\/platform\/help\/([^/]+)$/;
/** …/help/<võti>/versions, …/versions/<id>, …/versions/<id>/restore */
export const HELP_VERSIONS_ROUTE = /^\/api\/platform\/help\/([^/]+)\/versions(?:\/(\d{1,9})(\/restore)?)?$/;
