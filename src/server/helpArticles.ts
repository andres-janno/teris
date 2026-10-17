// src/server/helpArticles.ts — kasutajajuhendid (platvormi tabel help_articles, ainult authDb()).
// Ettevõtte rakendus loeb (GET /api/help), teenusepakkuja muudab (platformApi /api/platform/help*).
// HTML puhastatakse brauseris DOMPurify'ga nii salvestamisel kui ka kuvamisel (src/help/sanitizeHelp.ts).
import type { ServerResponse } from 'http';
import { authDb } from './db.ts';
import { json } from './http.ts';
import { HELP_MAX_LENGTH, isHelpKey } from '../help/helpRegistry.ts';

export const HELP_KEY_ERROR = 'Tundmatu juhendi koht';
export const HELP_LENGTH_ERROR = `Juhend on liiga pikk (kuni ${HELP_MAX_LENGTH} märki)`;

/** Tühi = pole nähtavat teksti (nt ainult <p><br></p>) */
export const isBlankHelp = (html: string): boolean => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

/** Ettevõtte rakendusele: kõik registris olevad täidetud juhendid ühe päringuga. */
export async function handleHelpRead(res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (pathname !== '/api/help' || method !== 'GET') return false;
  const rows = await authDb().helpArticle.findMany({ select: { key: true, html: true } });
  const articles: Record<string, string> = {};
  for (const r of rows) if (isHelpKey(r.key) && !isBlankHelp(r.html)) articles[r.key] = r.html;
  res.setHeader('Cache-Control', 'no-cache');
  json(res, { articles });
  return true;
}

export async function listHelpArticles() {
  return authDb().helpArticle.findMany({ orderBy: { key: 'asc' }, select: { key: true, html: true, updatedAt: true, updatedBy: true } });
}

type Result = { ok: true; deleted: boolean } | { ok: false; status: number; error: string };

/** Salvestab juhendi; tühi tekst kustutab kirje. Kustutada saab ka koodist eemaldatud võtme. */
export async function saveHelpArticle(key: string, html: unknown, pu: { id: string; username: string }): Promise<Result> {
  if (typeof html !== 'string') return { ok: false, status: 400, error: 'Juhendi tekst puudub' };
  if (html.length > HELP_MAX_LENGTH) return { ok: false, status: 400, error: HELP_LENGTH_ERROR };
  const blank = isBlankHelp(html);
  if (!blank && !isHelpKey(key)) return { ok: false, status: 404, error: HELP_KEY_ERROR };

  return authDb().$transaction(async (tx) => {
    if (blank) {
      const { count } = await tx.helpArticle.deleteMany({ where: { key } });
      if (count === 0) return { ok: true as const, deleted: true };
    } else {
      await tx.helpArticle.upsert({
        where: { key },
        create: { key, html, updatedBy: pu.username },
        update: { html, updatedBy: pu.username }
      });
    }
    await tx.platformAuditLog.create({
      data: { action: 'HELP_UPDATE', platformUserId: pu.id, targetTenantId: null, details: { key, op: blank ? 'delete' : 'save' } }
    });
    return { ok: true as const, deleted: blank };
  });
}

export function sendHelpResult(res: ServerResponse, r: Result) {
  if (!r.ok) return json(res, { error: r.error }, r.status);
  json(res, { success: true, deleted: r.deleted });
}

export const HELP_PLATFORM_ROUTE = /^\/api\/platform\/help\/([^/]+)$/;
