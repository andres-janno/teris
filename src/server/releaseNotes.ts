// src/server/releaseNotes.ts — väljalaske märkmete (release notes) äriloogika, platvormi haldus,
// kliendi lugemise/eelistuste API ja avalik e-kirjadest loobumise endpoint. Ainult authDb().
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { authDb } from './db.ts';
import { json, parseBody } from './http.ts';
import { generateSessionToken, hashToken } from './auth.ts';
import { APP_BASE_URL, MAIL_FROM, buildReleaseNoteMail, escapeHtml, normalizeEmail, sendMail } from './mail.ts';
import type { SessionUser } from './authGate.ts';
import {
  RELEASE_NOTE_CATEGORIES,
  type PlatformReleaseNoteRow,
  type ReleaseNoteAudience,
  type ReleaseNoteCategory,
  type ReleaseNoteDeliveryCounts,
  type ReleaseNoteItem,
  type ReleaseNoteSourceCommit,
  type ReleaseNoteStatus
} from '../types/releaseNotes.ts';

export class ReleaseNoteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const VALID_CATEGORIES = new Set<string>(RELEASE_NOTE_CATEGORIES);
const VALID_AUDIENCES = new Set<string>(['ALL_ACTIVE_USERS', 'TENANT_ADMINS']);
const VERSION_RE = /^[A-Za-z0-9._-]{1,40}$/;
const MAX_TITLE_LEN = 200;
const MAX_SUMMARY_LEN = 2000;
const MAX_ITEMS = 100;
const MAX_ITEM_TEXT_LEN = 1000;
const MAX_AREA_LEN = 60;
const CLIENT_RELEASE_LIMIT = 30;

export function parseReleaseNoteItems(raw: unknown): ReleaseNoteItem[] {
  if (!Array.isArray(raw)) throw new ReleaseNoteError(400, 'Muudatuste nimekiri peab olema massiiv');
  if (raw.length > MAX_ITEMS) throw new ReleaseNoteError(400, `Liiga palju punkte (kuni ${MAX_ITEMS})`);
  const out: ReleaseNoteItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') throw new ReleaseNoteError(400, 'Vigane muudatuse punkt');
    const obj = entry as Record<string, unknown>;
    const category = String(obj.category ?? '').toUpperCase();
    if (!VALID_CATEGORIES.has(category)) throw new ReleaseNoteError(400, 'Vigane muudatuse kategooria');
    const text = String(obj.text ?? '').trim();
    if (!text) throw new ReleaseNoteError(400, 'Muudatuse punkti tekst ei tohi olla tühi');
    if (text.length > MAX_ITEM_TEXT_LEN) throw new ReleaseNoteError(400, `Punkti tekst on liiga pikk (kuni ${MAX_ITEM_TEXT_LEN} märki)`);
    const areaRaw = obj.area === undefined || obj.area === null ? '' : String(obj.area).trim();
    if (areaRaw.length > MAX_AREA_LEN) throw new ReleaseNoteError(400, `Valdkonna nimi on liiga pikk (kuni ${MAX_AREA_LEN} märki)`);
    const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim().slice(0, 64) : randomUUID();
    out.push({
      id,
      category: category as ReleaseNoteCategory,
      ...(areaRaw ? { area: areaRaw } : {}),
      text
    });
  }
  return out;
}

function parseSourceCommits(raw: unknown): ReleaseNoteSourceCommit[] {
  if (!Array.isArray(raw)) return [];
  const out: ReleaseNoteSourceCommit[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    const hash = String(obj.hash ?? '').trim();
    const subject = String(obj.subject ?? '').trim();
    if (!hash || !subject) continue;
    const date = typeof obj.date === 'string' && obj.date.trim() ? obj.date.trim() : undefined;
    out.push({ hash: hash.slice(0, 40), subject: subject.slice(0, 300), ...(date ? { date } : {}) });
  }
  return out;
}

function normalizeVersion(raw: unknown): string {
  const version = String(raw ?? '').trim();
  if (!VERSION_RE.test(version)) throw new ReleaseNoteError(400, 'Vigane versioon (lubatud tähed, numbrid, punkt, kriips)');
  return version;
}

function normalizeTitle(raw: unknown): string {
  const title = String(raw ?? '').trim();
  if (!title) throw new ReleaseNoteError(400, 'Pealkiri on kohustuslik');
  if (title.length > MAX_TITLE_LEN) throw new ReleaseNoteError(400, `Pealkiri on liiga pikk (kuni ${MAX_TITLE_LEN} märki)`);
  return title;
}

function normalizeSummary(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > MAX_SUMMARY_LEN) throw new ReleaseNoteError(400, `Sissejuhatus on liiga pikk (kuni ${MAX_SUMMARY_LEN} märki)`);
  return s;
}

function normalizeAudience(raw: unknown, fallback: ReleaseNoteAudience = 'ALL_ACTIVE_USERS'): ReleaseNoteAudience {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const v = String(raw);
  if (!VALID_AUDIENCES.has(v)) throw new ReleaseNoteError(400, 'Vigane sihtrühm');
  return v as ReleaseNoteAudience;
}

function safeItemsFromDb(raw: unknown): ReleaseNoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      id: typeof i.id === 'string' && i.id ? i.id : randomUUID(),
      category: (VALID_CATEGORIES.has(String(i.category)) ? String(i.category) : 'IMPROVEMENT') as ReleaseNoteCategory,
      ...(typeof i.area === 'string' && i.area.trim() ? { area: i.area.trim() } : {}),
      text: String(i.text ?? '')
    }))
    .filter((i) => i.text.trim() !== '');
}

function emptyCounts(): ReleaseNoteDeliveryCounts {
  return { total: 0, pending: 0, sent: 0, failed: 0 };
}

function toPlatformRow(
  row: {
    id: string;
    version: string;
    title: string;
    summary: string | null;
    itemsJson: Prisma.JsonValue;
    sourceCommitsJson: Prisma.JsonValue | null;
    fromCommit: string | null;
    toCommit: string | null;
    status: ReleaseNoteStatus;
    publishedAt: Date | null;
    publishedBy: string | null;
    emailAudience: ReleaseNoteAudience | null;
    emailQueuedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  counts: ReleaseNoteDeliveryCounts
): PlatformReleaseNoteRow {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    summary: row.summary,
    items: safeItemsFromDb(row.itemsJson),
    sourceCommits: parseSourceCommits(row.sourceCommitsJson),
    fromCommit: row.fromCommit,
    toCommit: row.toCommit,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedBy: row.publishedBy,
    emailAudience: row.emailAudience,
    emailQueuedAt: row.emailQueuedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deliveryCounts: counts
  };
}

async function deliveryCountsByRelease(ids: string[]): Promise<Map<string, ReleaseNoteDeliveryCounts>> {
  const map = new Map<string, ReleaseNoteDeliveryCounts>();
  if (ids.length === 0) return map;
  const groups = await authDb().releaseNoteDelivery.groupBy({
    by: ['releaseNoteId', 'status'],
    where: { releaseNoteId: { in: ids } },
    _count: { _all: true }
  });
  for (const g of groups) {
    const c = map.get(g.releaseNoteId) ?? emptyCounts();
    const n = g._count._all;
    c.total += n;
    if (g.status === 'PENDING') c.pending += n;
    else if (g.status === 'SENT') c.sent += n;
    else if (g.status === 'FAILED') c.failed += n;
    map.set(g.releaseNoteId, c);
  }
  return map;
}

export async function listPlatformReleaseNotes(): Promise<PlatformReleaseNoteRow[]> {
  const rows = await authDb().releaseNote.findMany({
    orderBy: [{ status: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }]
  });
  const counts = await deliveryCountsByRelease(rows.map((r) => r.id));
  return rows.map((r) => toPlatformRow(r, counts.get(r.id) ?? emptyCounts()));
}

export async function getPlatformReleaseNote(id: string): Promise<PlatformReleaseNoteRow> {
  const row = await authDb().releaseNote.findUnique({ where: { id } });
  if (!row) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');
  const counts = await deliveryCountsByRelease([row.id]);
  return toPlatformRow(row, counts.get(row.id) ?? emptyCounts());
}

export async function createReleaseNote(
  body: Record<string, unknown>,
  pu: { id: string; username: string }
): Promise<PlatformReleaseNoteRow> {
  const version = normalizeVersion(body.version);
  const title = normalizeTitle(body.title);
  const summary = normalizeSummary(body.summary);
  const items = parseReleaseNoteItems(body.items ?? []);
  const sourceCommits = parseSourceCommits(body.sourceCommits);
  const fromCommit = typeof body.fromCommit === 'string' && body.fromCommit.trim() ? body.fromCommit.trim().slice(0, 40) : null;
  const toCommit = typeof body.toCommit === 'string' && body.toCommit.trim() ? body.toCommit.trim().slice(0, 40) : null;

  try {
    const row = await authDb().releaseNote.create({
      data: {
        version,
        title,
        summary,
        itemsJson: items as unknown as Prisma.InputJsonValue,
        sourceCommitsJson: sourceCommits.length ? (sourceCommits as unknown as Prisma.InputJsonValue) : undefined,
        fromCommit,
        toCommit,
        status: 'DRAFT',
        createdBy: pu.username,
        updatedBy: pu.username
      }
    });
    await authDb().platformAuditLog.create({
      data: { action: 'RELEASE_CREATE', platformUserId: pu.id, targetTenantId: null, details: { id: row.id, version } }
    });
    return toPlatformRow(row, emptyCounts());
  } catch (err: any) {
    if (err?.code === 'P2002') throw new ReleaseNoteError(409, `Versioon „${version}“ on juba olemas`);
    throw err;
  }
}

export async function updateReleaseNote(
  id: string,
  body: Record<string, unknown>,
  pu: { id: string; username: string }
): Promise<PlatformReleaseNoteRow> {
  const existing = await authDb().releaseNote.findUnique({ where: { id } });
  if (!existing) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');

  const version = body.version !== undefined ? normalizeVersion(body.version) : existing.version;
  const title = body.title !== undefined ? normalizeTitle(body.title) : existing.title;
  const summary = body.summary !== undefined ? normalizeSummary(body.summary) : existing.summary;
  const items = body.items !== undefined ? parseReleaseNoteItems(body.items) : safeItemsFromDb(existing.itemsJson);

  try {
    const row = await authDb().releaseNote.update({
      where: { id },
      data: {
        version,
        title,
        summary,
        itemsJson: items as unknown as Prisma.InputJsonValue,
        updatedBy: pu.username
      }
    });
    const counts = await deliveryCountsByRelease([row.id]);
    return toPlatformRow(row, counts.get(row.id) ?? emptyCounts());
  } catch (err: any) {
    if (err?.code === 'P2002') throw new ReleaseNoteError(409, `Versioon „${version}“ on juba olemas`);
    throw err;
  }
}

export async function deleteReleaseNote(id: string, pu: { id: string; username: string }): Promise<void> {
  const existing = await authDb().releaseNote.findUnique({ where: { id } });
  if (!existing) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');
  if (existing.status !== 'DRAFT') throw new ReleaseNoteError(400, 'Kustutada saab ainult mustandit');
  await authDb().releaseNote.delete({ where: { id } });
  await authDb().platformAuditLog.create({
    data: { action: 'RELEASE_DELETE', platformUserId: pu.id, targetTenantId: null, details: { id, version: existing.version } }
  });
}

// Ajutine mäluvahemälu toor-tokenitele (ainult värskelt järjekorda pandud kirjadele protsessi eluea jooksul;
// andmebaasis hoitakse ainult SHA-256 räsi). Kui server taaskäivitub enne kirja saatmist, genereerib saatja uue tokeni.
const pendingUnsubscribeRawTokens = new Map<string, string>();

export function takePendingUnsubscribeToken(deliveryId: string): string | undefined {
  const tok = pendingUnsubscribeRawTokens.get(deliveryId);
  if (tok) pendingUnsubscribeRawTokens.delete(deliveryId);
  return tok;
}

export async function issueFreshUnsubscribeToken(deliveryId: string): Promise<string> {
  const raw = generateSessionToken();
  await authDb().releaseNoteDelivery.update({
    where: { id: deliveryId },
    data: { unsubscribeTokenHash: hashToken(raw) }
  });
  return raw;
}

export async function queueReleaseNoteEmails(
  id: string,
  audienceRaw: unknown,
  pu: { id: string; username: string },
  onQueued?: () => void
): Promise<{ queued: number; row: PlatformReleaseNoteRow }> {
  const release = await authDb().releaseNote.findUnique({ where: { id } });
  if (!release) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');
  if (release.status !== 'PUBLISHED') throw new ReleaseNoteError(400, 'E-kirju saab saata ainult avaldatud väljalaskele');

  const audience = normalizeAudience(audienceRaw, release.emailAudience ?? 'ALL_ACTIVE_USERS');

  // Leia kõik aktiivsete ettevõtete aktiivsed, e-postiga ja teavitustega nõustunud kasutajad
  const activeTenants = await authDb().tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true }
  });
  const activeTenantIds = activeTenants.map((t) => t.id);

  const users = activeTenantIds.length
    ? await authDb().user.findMany({
        where: {
          tenantId: { in: activeTenantIds },
          isActive: true,
          receiveReleaseNotes: true,
          email: { not: null },
          ...(audience === 'TENANT_ADMINS' ? { isAdmin: true } : {})
        },
        select: { id: true, email: true, displayName: true }
      })
    : [];

  const existingDeliveries = await authDb().releaseNoteDelivery.findMany({
    where: { releaseNoteId: id },
    select: { userId: true }
  });
  const alreadyQueued = new Set(existingDeliveries.map((d) => d.userId));

  let queued = 0;
  for (const u of users) {
    if (alreadyQueued.has(u.id)) continue;
    const email = normalizeEmail(u.email);
    if (!email) continue;
    const rawToken = generateSessionToken();
    const delivery = await authDb().releaseNoteDelivery.create({
      data: {
        releaseNoteId: id,
        userId: u.id,
        email,
        displayName: u.displayName,
        status: 'PENDING',
        unsubscribeTokenHash: hashToken(rawToken)
      }
    });
    pendingUnsubscribeRawTokens.set(delivery.id, rawToken);
    queued++;
  }

  await authDb().releaseNote.update({
    where: { id },
    data: {
      emailAudience: audience,
      emailQueuedAt: release.emailQueuedAt ?? new Date(),
      updatedBy: pu.username
    }
  });
  await authDb().platformAuditLog.create({
    data: {
      action: 'RELEASE_EMAIL_QUEUE',
      platformUserId: pu.id,
      targetTenantId: null,
      details: { id, version: release.version, audience, queued }
    }
  });

  if (queued > 0) onQueued?.();
  return { queued, row: await getPlatformReleaseNote(id) };
}

export async function publishReleaseNote(
  id: string,
  body: Record<string, unknown>,
  pu: { id: string; username: string },
  onQueued?: () => void
): Promise<{ row: PlatformReleaseNoteRow; queued: number }> {
  const existing = await authDb().releaseNote.findUnique({ where: { id } });
  if (!existing) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');
  if (existing.status === 'PUBLISHED') throw new ReleaseNoteError(400, 'Väljalase on juba avaldatud');

  const items = safeItemsFromDb(existing.itemsJson);
  if (items.length === 0) throw new ReleaseNoteError(400, 'Lisa enne avaldamist vähemalt üks muudatuse punkt');

  const sendEmail = body.sendEmail === true;
  const audience = normalizeAudience(body.audience, 'ALL_ACTIVE_USERS');

  await authDb().releaseNote.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: pu.username,
      updatedBy: pu.username
    }
  });
  await authDb().platformAuditLog.create({
    data: {
      action: 'RELEASE_PUBLISH',
      platformUserId: pu.id,
      targetTenantId: null,
      details: { id, version: existing.version, sendEmail, audience }
    }
  });

  if (sendEmail) {
    const res = await queueReleaseNoteEmails(id, audience, pu, onQueued);
    return { row: res.row, queued: res.queued };
  }
  return { row: await getPlatformReleaseNote(id), queued: 0 };
}

export async function retryFailedDeliveries(
  id: string,
  pu: { id: string; username: string },
  onQueued?: () => void
): Promise<{ retried: number; row: PlatformReleaseNoteRow }> {
  const existing = await authDb().releaseNote.findUnique({ where: { id } });
  if (!existing) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');

  const { count } = await authDb().releaseNoteDelivery.updateMany({
    where: { releaseNoteId: id, status: 'FAILED' },
    data: { status: 'PENDING', attempts: 0, lastError: null }
  });
  if (count > 0) {
    await authDb().platformAuditLog.create({
      data: { action: 'RELEASE_EMAIL_RETRY', platformUserId: pu.id, targetTenantId: null, details: { id, retried: count } }
    });
    onQueued?.();
  }
  return { retried: count, row: await getPlatformReleaseNote(id) };
}

export async function sendTestReleaseNoteEmail(
  id: string,
  toRaw: unknown,
  pu: { id: string; username: string }
): Promise<{ sent: boolean; to: string }> {
  const to = normalizeEmail(toRaw);
  if (!to) throw new ReleaseNoteError(400, 'Vigane e-posti aadress');
  const release = await authDb().releaseNote.findUnique({ where: { id } });
  if (!release) throw new ReleaseNoteError(404, 'Väljalaset ei leitud');

  const message = buildReleaseNoteMail({
    to,
    from: MAIL_FROM,
    displayName: pu.username,
    version: release.version,
    title: release.title,
    summary: release.summary,
    items: safeItemsFromDb(release.itemsJson),
    appLink: `${APP_BASE_URL}/#releases`,
    unsubscribeLink: `${APP_BASE_URL}/api/release-notes/unsubscribe?token=test`,
    isTest: true
  });
  await sendMail(message, to);
  return { sent: true, to };
}

// ============================================================================
// KLIENDIRAKENDUSE API (/api/release-notes*)
// ============================================================================

export async function handleReleaseNotesApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  sessionUser: SessionUser | null
): Promise<boolean> {
  if (!pathname.startsWith('/api/release-notes')) return false;
  if (!sessionUser) {
    json(res, { error: 'Sisselogimine nõutud' }, 401);
    return true;
  }

  if (pathname === '/api/release-notes' && method === 'GET') {
    const [releases, userRow] = await Promise.all([
      authDb().releaseNote.findMany({
        where: { status: 'PUBLISHED', publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: CLIENT_RELEASE_LIMIT
      }),
      sessionUser.supportView
        ? Promise.resolve(null)
        : authDb().user.findUnique({
            where: { id: sessionUser.id },
            select: { lastSeenReleaseAt: true, receiveReleaseNotes: true }
          })
    ]);

    const lastSeenMs = userRow?.lastSeenReleaseAt?.getTime() ?? null;
    const unreadCount = sessionUser.supportView
      ? 0
      : releases.filter((r) => r.publishedAt && (lastSeenMs === null || r.publishedAt.getTime() > lastSeenMs)).length;

    res.setHeader('Cache-Control', 'no-cache');
    json(res, {
      releases: releases.map((r) => ({
        id: r.id,
        version: r.version,
        title: r.title,
        summary: r.summary,
        items: safeItemsFromDb(r.itemsJson),
        publishedAt: (r.publishedAt ?? r.createdAt).toISOString()
      })),
      unreadCount,
      hasUnread: unreadCount > 0,
      receiveReleaseNotes: userRow?.receiveReleaseNotes ?? true
    });
    return true;
  }

  if (pathname === '/api/release-notes/seen' && method === 'POST') {
    if (!sessionUser.supportView) {
      await authDb().user.update({
        where: { id: sessionUser.id },
        data: { lastSeenReleaseAt: new Date() }
      });
    }
    json(res, { success: true });
    return true;
  }

  if (pathname === '/api/release-notes/preferences' && method === 'PATCH') {
    if (sessionUser.supportView) {
      json(res, { error: 'Tugivaates ei saa seadeid muuta' }, 403);
      return true;
    }
    const body = (await parseBody(req)) as Record<string, unknown> | null;
    if (typeof body?.receiveReleaseNotes !== 'boolean') {
      json(res, { error: 'receiveReleaseNotes peab olema tõeväärtus' }, 400);
      return true;
    }
    await authDb().user.update({
      where: { id: sessionUser.id },
      data: { receiveReleaseNotes: body.receiveReleaseNotes }
    });
    json(res, { receiveReleaseNotes: body.receiveReleaseNotes });
    return true;
  }

  return false;
}

// ============================================================================
// AVALIK LOOBUMISLINK (/api/release-notes/unsubscribe?token=...)
// ============================================================================

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — TERIS</title></head><body style="margin:0;padding:40px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;"><div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;"><h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h1><p style="margin:0 0 20px;line-height:1.6;color:#334155;">${escapeHtml(body)}</p><a href="${escapeHtml(APP_BASE_URL)}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;font-weight:600;padding:9px 16px;border-radius:8px;font-size:14px;">Tagasi TERISesse</a></div></body></html>`;
}

export async function handleReleaseNoteUnsubscribe(
  res: ServerResponse,
  pathname: string,
  method: string,
  url: URL
): Promise<boolean> {
  if (pathname !== '/api/release-notes/unsubscribe') return false;
  if (method !== 'GET' && method !== 'POST') return false;

  const rawToken = (url.searchParams.get('token') ?? '').trim();
  const sendHtml = (status: number, title: string, body: string) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(htmlPage(title, body));
  };

  if (!rawToken || rawToken.length > 200) {
    sendHtml(400, 'Vigane link', 'Loobumislink on puudulik või vigane.');
    return true;
  }

  const delivery = await authDb().releaseNoteDelivery.findUnique({
    where: { unsubscribeTokenHash: hashToken(rawToken) },
    select: { userId: true }
  });
  if (!delivery) {
    sendHtml(404, 'Linki ei leitud', 'Loobumislink ei kehti või on aegunud. Saad teavitusi hallata ka TERISe „Uuendused“ vaates.');
    return true;
  }

  await authDb().user.updateMany({
    where: { id: delivery.userId },
    data: { receiveReleaseNotes: false }
  });

  if (method === 'POST') {
    json(res, { unsubscribed: true });
    return true;
  }
  sendHtml(
    200,
    'Uuenduste e-kirjadest loobutud',
    'Sulle ei saadeta enam TERISe uuenduste e-kirju. Kõik uued versioonid jäävad siiski nähtavaks rakenduse „Uuendused“ vaates, kus saad soovi korral e-kirjad uuesti sisse lülitada.'
  );
  return true;
}
