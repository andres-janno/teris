// src/server/supportGrants.ts — /api/support-grants*, /api/support-access-log (ainult ettevõtte adminile).
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, tenantTransaction } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';

const GRANTS = '/api/support-grants';
const LOG = '/api/support-access-log';
const MAX_BODY_BYTES = 4 * 1024;
const FORBIDDEN = 'Ainult admin saab kasutajatoe ligipääsu hallata';

const DURATIONS_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

type GrantRow = {
  id: string;
  validUntil: Date;
  revokedAt: Date | null;
  createdAt: Date;
  grantedBy: { username: string; displayName: string | null };
};

const GRANT_SELECT = {
  id: true,
  validUntil: true,
  revokedAt: true,
  createdAt: true,
  grantedBy: { select: { username: true, displayName: true } }
} as const;

// Kehtiv: tühistamata ja mitte aegunud
const toPublic = (g: GrantRow) => ({
  ...g,
  active: g.revokedAt === null && g.validUntil.getTime() > Date.now()
});

export async function handleSupportGrants(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string
): Promise<boolean> {
  const isGrants = pathname === GRANTS || pathname.startsWith(GRANTS + '/');
  if (!isGrants && pathname !== LOG) return false;

  const actor = sessionUserOf(req);
  if (!actor || !actor.isAdmin) {
    json(res, { error: FORBIDDEN }, 403);
    return true;
  }

  if (pathname === LOG && method === 'GET') {
    const rows = await prisma.supportAccessLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: { startedAt: true, platformUsername: true, supportGrantId: true }
    });
    json(res, rows.map((r) => ({ startedAt: r.startedAt, platformUsername: r.platformUsername, grantId: r.supportGrantId })));
    return true;
  }

  const parts = isGrants ? pathname.slice(GRANTS.length).split('/').filter(Boolean) : [];

  if (isGrants && parts.length === 0 && method === 'GET') {
    const rows = await prisma.supportGrant.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: GRANT_SELECT });
    json(res, rows.map(toPublic));
    return true;
  }

  if (isGrants && parts.length === 0 && method === 'POST') {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const ms = typeof body?.duration === 'string' && Object.hasOwn(DURATIONS_MS, body.duration) ? DURATIONS_MS[body.duration] : null;
    if (ms === null) {
      json(res, { error: 'Vigane kestus' }, 400);
      return true;
    }
    const created = await tenantTransaction(async (tx) => {
      const now = new Date();
      // Korraga on kehtiv ainult üks luba (vastab kasutajaliidesele)
      if (await tx.supportGrant.count({ where: { revokedAt: null, validUntil: { gt: now } } }) > 0) return null;
      return tx.supportGrant.create({
        data: { grantedByUserId: actor.id, validUntil: new Date(now.getTime() + ms) },
        select: GRANT_SELECT
      });
    });
    if (!created) {
      json(res, { error: 'Kasutajatoel on juba kehtiv ligipääs' }, 409);
      return true;
    }
    json(res, toPublic(created), 201);
    return true;
  }

  if (isGrants && parts.length === 2 && parts[1] === 'revoke' && method === 'POST') {
    let id: string;
    try {
      id = decodeURIComponent(parts[0]);
    } catch {
      json(res, { error: 'Luba ei leitud' }, 404);
      return true;
    }
    const result = await tenantTransaction(async (tx) => {
      const grant = await tx.supportGrant.findUnique({ where: { id }, select: GRANT_SELECT });
      if (!grant) return null;
      // Juba tühistatud või aegunud luba jääb muutmata
      if (!toPublic(grant).active) return grant;
      return tx.supportGrant.update({ where: { id }, data: { revokedAt: new Date() }, select: GRANT_SELECT });
    });
    if (!result) {
      json(res, { error: 'Luba ei leitud' }, 404);
      return true;
    }
    // Tugisessioonid on platvormi tabel; kustutame ka juba tühistatud loa omad (idempotentne)
    await authDb().supportSession.deleteMany({ where: { supportGrantId: result.id } });
    json(res, toPublic(result));
    return true;
  }

  json(res, { error: 'Not found' }, 404);
  return true;
}
