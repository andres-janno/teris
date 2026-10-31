// src/server/apiKeys.ts — kasutaja isiklikud API-võtmed AI ühenduse (MCP) jaoks.
// Võtit ennast ei salvestata: tabelis on SHA-256 räsi ja äratundmiseks 10-märgiline algus.
// Platvormi tabel (nagu sessions) — loetakse authDb() kaudu, enne kui päringul on ettevõtte kontekst.
import type { IncomingMessage, ServerResponse } from 'http';
import { randomBytes } from 'crypto';
import { authDb } from './db.ts';
import { hashToken } from './auth.ts';
import { sessionUserOf } from './authGate.ts';
import { APP_BASE_URL } from './mail.ts';
import { json, parseBody } from './http.ts';

export const API_KEY_PREFIX = 'trs_';
export const MAX_ACTIVE_KEYS = 5;
export const INVALID_KEY_MESSAGE = 'Vigane võti';
const NAME_MAX = 100;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const SUPPORT_FORBIDDEN = 'Tugivaates ei saa AI ühenduse võtmeid hallata';
const KEY_ROUTE = /^\/api\/api-keys\/([^/]+)$/;

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString('base64url');
}

export const mcpUrlFor = (key: string): string => `${APP_BASE_URL}/mcp/${key}`;

export type ApiKeyUser = {
  id: string;
  username: string;
  displayName: string | null;
  tenantId: string;
  isAdmin: boolean;
  isFinanceManager: boolean;
};

/** Kehtiv võti: pole tühistatud, kasutaja aktiivne ega pea parooli vahetama, ettevõte aktiivne. */
export async function findActiveApiKey(key: string): Promise<{ keyId: string; lastUsedAt: Date | null; user: ApiKeyUser } | null> {
  if (!key.startsWith(API_KEY_PREFIX) || key.length > 100) return null;
  const row = await authDb().apiKey.findUnique({
    where: { keyHash: hashToken(key) },
    include: { user: { select: { id: true, username: true, displayName: true, tenantId: true, isAdmin: true, isFinanceManager: true, isActive: true, mustChangePassword: true } } }
  });
  if (!row || row.revokedAt || !row.user.isActive || row.user.mustChangePassword) return null;
  const tenant = await authDb().tenant.findUnique({ where: { id: row.user.tenantId }, select: { status: true } });
  if (tenant?.status !== 'ACTIVE') return null;
  const { isActive: _a, mustChangePassword: _m, ...user } = row.user;
  return { keyId: row.id, lastUsedAt: row.lastUsedAt, user };
}

/** Viimase kasutamise aeg — kuni kord 5 minuti jooksul, et iga tööriistakutse ei kirjutaks. */
export async function touchApiKey(keyId: string, lastUsedAt: Date | null, now: Date = new Date()): Promise<void> {
  if (lastUsedAt && now.getTime() - lastUsedAt.getTime() < TOUCH_INTERVAL_MS) return;
  await authDb().apiKey.updateMany({ where: { id: keyId }, data: { lastUsedAt: now } });
}

export type ApiKeyRow = { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

const rowOut = (r: { id: string; name: string; keyPrefix: string; createdAt: Date; lastUsedAt: Date | null }): ApiKeyRow => ({
  id: r.id, name: r.name, keyPrefix: r.keyPrefix, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null
});

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const rows = await authDb().apiKey.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
  return rows.map(rowOut);
}

export async function createApiKey(userId: string, name: unknown): Promise<{ ok: true; key: string; url: string; row: ApiKeyRow } | { ok: false; status: number; error: string }> {
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!clean || clean.length > NAME_MAX) return { ok: false, status: 400, error: `Nimi peab olema 1–${NAME_MAX} märki` };
  const active = await authDb().apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) return { ok: false, status: 400, error: `Aktiivseid võtmeid saab olla kuni ${MAX_ACTIVE_KEYS}. Tühista mõni vana võti.` };
  const key = generateApiKey();
  const row = await authDb().apiKey.create({ data: { userId, name: clean, keyHash: hashToken(key), keyPrefix: key.slice(0, 10) } });
  return { ok: true, key, url: mcpUrlFor(key), row: rowOut(row) };
}

/** Tühistab ainult oma aktiivse võtme. */
export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const { count } = await authDb().apiKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count > 0;
}

/** /api/api-keys — sisselogitud kasutaja enda võtmed (sessioon + CSRF nagu ülejäänud API). */
export async function handleApiKeys(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (pathname !== '/api/api-keys' && !pathname.startsWith('/api/api-keys/')) return false;
  const user = sessionUserOf(req);
  if (!user) {
    json(res, { error: 'Pole sisse logitud' }, 401);
    return true;
  }
  if (user.supportView) {
    json(res, { error: SUPPORT_FORBIDDEN }, 403);
    return true;
  }
  if (pathname === '/api/api-keys' && method === 'GET') {
    json(res, await listApiKeys(user.id));
    return true;
  }
  if (pathname === '/api/api-keys' && method === 'POST') {
    const r = await createApiKey(user.id, (await parseBody(req, 16 * 1024))?.name);
    if (!r.ok) json(res, { error: r.error }, r.status);
    else json(res, { key: r.key, url: r.url, ...r.row }, 201);
    return true;
  }
  const m = KEY_ROUTE.exec(pathname);
  if (m && method === 'DELETE') {
    if (!(await revokeApiKey(user.id, decodeURIComponent(m[1])))) json(res, { error: 'Võtit ei leitud' }, 404);
    else json(res, { success: true });
    return true;
  }
  json(res, { error: 'Not found' }, 404);
  return true;
}
