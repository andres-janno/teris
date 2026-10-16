// src/server/platformAuth.ts — teenusepakkuja sisselogimine (parool + TOTP), eraldi sessioonid ja küpsis.
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db.ts';
import { json, parseBody, hasRequestBody } from './http.ts';
import {
  verifyPassword,
  hashPassword,
  generateSessionToken,
  hashToken,
  parseCookies,
  createLoginLimiter,
  checkMutationRequest,
  clientIpFrom
} from './auth.ts';
import { verifyTotp, decryptTotpSecret } from './totp.ts';

export const PLATFORM_COOKIE = '__Host-teris_platform_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_ERROR = 'Vale kasutajanimi, parool või kood';
const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const users = new WeakMap<IncomingMessage, { id: string; username: string } | null>();

let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('teris-platform-dummy-password'));

export const platformUserOf = (req: IncomingMessage) => users.get(req) ?? null;

const cookie = (token: string, maxAgeSec: number) =>
  `${PLATFORM_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;

const loginFailed = (res: ServerResponse, keys: string[], username: string, ip: string) => {
  console.warn('[Platform] Ebaõnnestunud sisselogimine', { username, ip });
  for (const k of keys) limiter.registerFailure(k);
  json(res, { error: LOGIN_ERROR }, 401);
  return true;
};

async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const key = process.env.PLATFORM_TOTP_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    console.error('[platformAuth] PLATFORM_TOTP_KEY puudub või on vales vormingus');
    json(res, { error: 'Platvorm pole seadistatud' }, 500);
    return true;
  }
  let body: any;
  try {
    body = await parseBody(req, 16 * 1024);
  } catch {
    json(res, { error: 'Vigane päring' }, 400);
    return true;
  }
  const username = String(body?.username ?? '').trim().toLowerCase().slice(0, 100);
  const password = String(body?.password ?? '');
  const code = String(body?.code ?? '');
  const ip = clientIpFrom(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
  const keys = [`pu:${username}`, `pip:${ip}`];
  if (keys.some((k) => limiter.isBlocked(k))) {
    console.warn('[Platform] Ebaõnnestunud sisselogimine', { username, ip, reason: 'liiga palju katseid (429)' });
    json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);
    return true;
  }

  const db = authDb();
  const user = username ? await db.platformUser.findUnique({ where: { username } }) : null;
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.isActive || !passwordOk) return loginFailed(res, keys, username, ip);

  let step: number | null;
  try {
    step = verifyTotp(decryptTotpSecret(user.totpSecretEnc, key), code, new Date(), user.totpLastStep);
  } catch (err) {
    console.error('[platformAuth] TOTP saladuse dekrüpteerimine ebaõnnestus', (err as Error).message);
    return loginFailed(res, keys, username, ip);
  }
  if (step === null) return loginFailed(res, keys, username, ip);

  // Atomaarne: paralleelne või korduv sama koodi kasutus ei saa kahte sessiooni
  const upd = await db.platformUser.updateMany({
    where: { id: user.id, totpLastStep: { lt: step } },
    data: { totpLastStep: step, lastLoginAt: new Date() }
  });
  if (upd.count === 0) return loginFailed(res, keys, username, ip);

  for (const k of keys) limiter.reset(k);
  const token = generateSessionToken();
  const ua = req.headers['user-agent'];
  await db.platformSession.create({
    data: {
      platformUserId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null
    }
  });
  await db.platformSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  await db.platformAuditLog.create({ data: { platformUserId: user.id, action: 'LOGIN', details: { ip, userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null } } }).catch((err) => {
    console.error('[platformAuth] auditilogi viga', (err as Error).message);
  });
  res.setHeader('Set-Cookie', cookie(token, Math.floor(SESSION_TTL_MS / 1000)));
  json(res, { user: { username: user.username } });
  return true;
}

async function loadSession(req: IncomingMessage) {
  const token = parseCookies(req.headers.cookie)[PLATFORM_COOKIE];
  if (!token) return null;
  const s = await authDb().platformSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { platformUser: true }
  });
  if (!s || s.expiresAt.getTime() <= Date.now() || !s.platformUser.isActive) return null;
  return { tokenHash: s.tokenHash, user: { id: s.platformUser.id, username: s.platformUser.username } };
}

export async function handlePlatformAuth(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  options: { allowedOrigins: string[] }
): Promise<boolean> {
  res.setHeader('Cache-Control', 'no-store');
  const check = checkMutationRequest(
    {
      method,
      origin: req.headers.origin as string | undefined,
      contentType: req.headers['content-type'] as string | undefined,
      hasBody: hasRequestBody(req)
    },
    options.allowedOrigins
  );
  if (check !== 'ok') {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }

  if (pathname === '/api/platform/auth/login' && method === 'POST') return handleLogin(req, res);

  if (pathname === '/api/platform/auth/logout' && method === 'POST') {
    const token = parseCookies(req.headers.cookie)[PLATFORM_COOKIE];
    if (token) await authDb().platformSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.setHeader('Set-Cookie', cookie('', 0));
    json(res, { success: true });
    return true;
  }

  const session = await loadSession(req);
  if (!session) {
    json(res, { error: 'Sisselogimine on vajalik' }, 401);
    return true;
  }
  users.set(req, session.user);
  if (pathname === '/api/platform/auth/me' && method === 'GET') {
    json(res, { user: { username: session.user.username } });
    return true;
  }
  return false;
}
