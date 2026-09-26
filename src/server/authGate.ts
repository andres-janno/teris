// src/server/authGate.ts
// Rakenduse sisselogimine: sessioonid andmebaasis, /api/auth/* teekonnad,
// CSRF-kontroll muutvatele päringutele ja sessiooni nõue ülejäänud API-le.
import type { IncomingMessage, ServerResponse } from 'http';
import type { ApiOptions } from './apiHandler.ts';
import { prisma } from './db.ts';
import { json, parseBody, hasRequestBody } from './http.ts';
import {
  SESSION_COOKIE,
  verifyPassword,
  hashPassword,
  validateNewPassword,
  generateSessionToken,
  hashToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  createLoginLimiter,
  checkMutationRequest,
  clientIpFrom,
  allowedDuringForcedPasswordChange
} from './auth.ts';
import { normalizeEmail } from './mail.ts';
import { findValidToken, consumeToken, sendPasswordLink } from './passwordTokens.ts';

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const MAX_AUTH_BODY_BYTES = 16 * 1024;
const MAX_USERNAME_LENGTH = 64;
const limiter = createLoginLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const forgotLimiter = createLoginLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

type DbUser = {
  id: string;
  username: string;
  displayName: string | null;
  passwordHash: string;
  isActive: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
};
export type SessionUser = DbUser;

const toAuthUser = (u: DbUser) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName ?? null,
  isAdmin: u.isAdmin,
  mustChangePassword: u.mustChangePassword
});

// Sessiooni kasutaja päringu kohta — hilisemad käsitlejad (nt adminUsers.ts) loevad
// selle siit, et sessiooni ei peaks teist korda andmebaasist otsima.
const sessionUsers = new WeakMap<IncomingMessage, DbUser | null>();

export function sessionUserOf(req: IncomingMessage): SessionUser | null {
  return sessionUsers.get(req) ?? null;
}

// Vale kasutajanime korral kontrollitakse parooli selle vastu, et vastuse aeg ei
// paljastaks, kas kasutaja on olemas.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('agro-map-dummy-password'));

function clientIp(req: IncomingMessage): string {
  return clientIpFrom(req.headers['x-forwarded-for'], req.socket.remoteAddress);
}

function sessionToken(req: IncomingMessage): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

async function currentSession(req: IncomingMessage, res: ServerResponse): Promise<{ user: DbUser; sessionId: string } | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) return null;
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // updateMany, mitte update: kui sessioon on vahepeal (nt paroolivahetusest) kustunud,
    // ei tohi see visata (P2025) — lihtsalt ei uuenda midagi.
    const { count } = await prisma.session.updateMany({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
    });
    // Libisev aegumine peab jõudma ka küpsiseni, muidu brauser kustutab küpsise
    // 14 päeva pärast esimest sisselogimist, kuigi sessioon andmebaasis kehtib.
    if (count > 0) res.appendHeader('Set-Cookie', sessionCookie(token, SESSION_TTL_MS / 1000));
  }
  return { user: session.user, sessionId: session.id };
}

async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  // Ülipikk kasutajanimi ei saa kunagi kehtida (vt userCli.ts piirangut) — vastame
  // nagu vale parooli korral, ilma piirajat ega andmebaasi puudutamata.
  if (username.length > MAX_USERNAME_LENGTH) {
    json(res, { error: 'Vale kasutajanimi või parool' }, 401);
    return;
  }

  const keys = [`u:${username}`, `ip:${clientIp(req)}`];

  if (keys.some((k) => limiter.isBlocked(k))) {
    json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);
    return;
  }

  const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.isActive || !passwordOk) {
    keys.forEach((k) => limiter.registerFailure(k));
    json(res, { error: 'Vale kasutajanimi või parool' }, 401);
    return;
  }

  keys.forEach((k) => limiter.reset(k));

  // Aegunud sessioonide koristus — parim katse, ei tohi sisselogimist katkestada.
  try {
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (err) {
    console.error('[Auth] Aegunud sessioonide koristus ebaõnnestus:', err);
  }

  const token = generateSessionToken();
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: userAgent || null
    }
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_TTL_MS / 1000));
  json(res, { user: toAuthUser(user) });
}

// "Unustasid parooli": vastus on alati sama, et kontode olemasolu ei saaks välja uurida.
async function handleForgot(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const login = String(body?.login ?? '').trim().toLowerCase().slice(0, 254);
  const keys = [`f:${login}`, `fip:${clientIp(req)}`];
  if (keys.some((k) => forgotLimiter.isBlocked(k))) {
    json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);
    return;
  }
  keys.forEach((k) => forgotLimiter.registerFailure(k));
  if (login) {
    const email = normalizeEmail(login);
    const user = await prisma.user.findFirst({ where: email ? { email } : { username: login } });
    if (user && user.isActive && user.email) {
      await sendPasswordLink({ id: user.id, username: user.username, displayName: user.displayName, email: user.email }, 'RESET');
    }
  }
  json(res, { success: true });
}

async function handleTokenCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const token = await findValidToken(String(body?.token ?? ''));
  if (!token) {
    json(res, { error: 'Link on aegunud või juba kasutatud' }, 400);
    return;
  }
  json(res, { valid: true, purpose: token.purpose, username: token.user.username });
}

async function handleSetPassword(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const password = String(body?.password ?? '');
  const token = await findValidToken(String(body?.token ?? ''));
  if (!token) {
    json(res, { error: 'Link on aegunud või juba kasutatud' }, 400);
    return;
  }
  const problem = validateNewPassword(password);
  if (problem) {
    json(res, { error: problem }, 400);
    return;
  }
  await prisma.user.update({
    where: { id: token.user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false }
  });
  await consumeToken(token.id, token.user.id);
  await prisma.session.deleteMany({ where: { userId: token.user.id } });
  json(res, { success: true, username: token.user.username });
}

export async function authGate(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  options: ApiOptions
): Promise<boolean> {
  const csrf = checkMutationRequest(
    {
      method,
      origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      contentType: typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined,
      hasBody: hasRequestBody(req)
    },
    options.allowedOrigins
  );
  if (csrf !== 'ok') {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    await handleLogin(req, res);
    return true;
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = sessionToken(req);
    if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.setHeader('Set-Cookie', clearSessionCookie());
    json(res, { success: true });
    return true;
  }

  if (pathname === '/api/auth/forgot' && method === 'POST') {
    await handleForgot(req, res);
    return true;
  }
  if (pathname === '/api/auth/token' && method === 'POST') {
    await handleTokenCheck(req, res);
    return true;
  }
  if (pathname === '/api/auth/set-password' && method === 'POST') {
    await handleSetPassword(req, res);
    return true;
  }

  const current = await currentSession(req, res);

  sessionUsers.set(req, current?.user ?? null);

  if (current?.user.mustChangePassword && !allowedDuringForcedPasswordChange(pathname, method)) {
    json(res, { error: 'Parool tuleb vahetada' }, 403);
    return true;
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    if (current) json(res, { user: toAuthUser(current.user) });
    else json(res, { error: 'Sisselogimine on vajalik' }, 401);
    return true;
  }

  if (pathname === '/api/auth/password' && method === 'POST') {
    if (!current) {
      json(res, { error: 'Sisselogimine on vajalik' }, 401);
      return true;
    }
    const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');
    if (!(await verifyPassword(currentPassword, current.user.passwordHash))) {
      json(res, { error: 'Praegune parool on vale' }, 401);
      return true;
    }
    // Ajutise parooli puhul on see oluline: admin teab ajutist parooli.
    if (newPassword === currentPassword) {
      json(res, { error: 'Uus parool peab erinema praegusest' }, 400);
      return true;
    }
    const problem = validateNewPassword(newPassword);
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    await prisma.user.update({
      where: { id: current.user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }
    });
    await prisma.session.deleteMany({ where: { userId: current.user.id, NOT: { id: current.sessionId } } });
    json(res, { success: true });
    return true;
  }

  if (pathname.startsWith('/api/auth/')) {
    json(res, { error: 'Not found' }, 404);
    return true;
  }

  if (options.requireAuth && !current) {
    json(res, { error: 'Sisselogimine on vajalik' }, 401);
    return true;
  }

  return false;
}
