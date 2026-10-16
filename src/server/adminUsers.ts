// src/server/adminUsers.ts — /api/admin/users* (ainult adminile).
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb } from './db.ts';
import { json, parseBody } from './http.ts';
import { hashPassword, validateNewPassword } from './auth.ts';
import { sessionUserOf } from './authGate.ts';
import { normalizeUsername, USERNAME_ERROR, checkAdminChange } from './adminRules.ts';
import { normalizeEmail } from './mail.ts';
import { sendPasswordLink } from './passwordTokens.ts';

const PREFIX = '/api/admin/users';
const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_ERROR = 'Sisesta korrektne e-posti aadress';
const EMAIL_TAKEN = 'Selline e-posti aadress on juba kasutusel';

const USER_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  passwordHash: true,
  isActive: true,
  isAdmin: true,
  isFinanceManager: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  sessions: {
    select: {
      lastSeenAt: true
    },
    orderBy: {
      lastSeenAt: 'desc'
    },
    take: 1
  }
} as const;

type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  passwordHash: string;
  isActive: boolean;
  isAdmin: boolean;
  isFinanceManager: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  sessions?: { lastSeenAt: Date }[];
};

// Paroolirässi ei saadeta kunagi välja — ainult teave, kas parool on määratud.
// "Viimati sees" võtab arvesse nii viimase sisselogimise kui ka viimase aktiivse sessiooni tegevuse.
const toPublic = ({ passwordHash, sessions, ...rest }: UserRow) => {
  const latestSession = sessions?.[0]?.lastSeenAt ?? null;
  const lastSeenAt = latestSession && rest.lastLoginAt
    ? (latestSession > rest.lastLoginAt ? latestSession : rest.lastLoginAt)
    : (latestSession ?? rest.lastLoginAt ?? null);

  return {
    ...rest,
    hasPassword: passwordHash !== '',
    lastLoginAt: lastSeenAt,
    lastSeenAt
  };
};

const activeAdminCount = () => prisma.user.count({ where: { isActive: true, isAdmin: true } });

function cleanDisplayName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().slice(0, 120);
  return name || null;
}

const uniqueTarget = (err: unknown): string | null => {
  const e = err as { code?: string; meta?: { target?: string[] | string } } | null;
  if (e?.code !== 'P2002') return null;
  return String(e.meta?.target ?? '');
};

export async function handleAdminUsers(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string
): Promise<boolean> {
  if (pathname !== PREFIX && !pathname.startsWith(PREFIX + '/')) return false;

  const actor = sessionUserOf(req);
  if (!actor || !actor.isAdmin) {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }

  const parts = pathname.slice(PREFIX.length).split('/').filter(Boolean);

  if (parts.length === 0 && method === 'GET') {
    const users = await prisma.user.findMany({ select: USER_FIELDS, orderBy: { username: 'asc' } });
    json(res, { users: users.map(toPublic) });
    return true;
  }

  if (parts.length === 0 && method === 'POST') {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const username = normalizeUsername(body?.username);
    if (!username) {
      json(res, { error: USERNAME_ERROR }, 400);
      return true;
    }
    const email = normalizeEmail(body?.email);
    if (!email) {
      json(res, { error: EMAIL_ERROR }, 400);
      return true;
    }
    const password = typeof body?.password === 'string' && body.password !== '' ? body.password : null;
    if (password !== null) {
      const problem = validateNewPassword(password);
      if (problem) {
        json(res, { error: problem }, 400);
        return true;
      }
    }
    try {
      const created = await prisma.user.create({
        data: {
          username,
          email,
          displayName: cleanDisplayName(body?.displayName),
          passwordHash: password !== null ? await hashPassword(password) : '',
          isAdmin: body?.isAdmin === true,
          isFinanceManager: body?.isFinanceManager === true,
          mustChangePassword: password !== null
        },
        select: USER_FIELDS
      });
      const emailSent =
        password === null
          ? await sendPasswordLink({ id: created.id, username, displayName: created.displayName, email }, 'INVITE')
          : false;
      json(res, { user: toPublic(created), emailSent }, 201);
    } catch (err) {
      const target = uniqueTarget(err);
      if (target === null) throw err;
      json(res, { error: target.includes('email') ? EMAIL_TAKEN : 'Selline kasutajanimi on juba olemas' }, 409);
    }
    return true;
  }

  const isUserRoute = parts.length === 1 && (method === 'PATCH' || method === 'DELETE');
  const isPasswordRoute = parts.length === 2 && parts[1] === 'password' && method === 'POST';
  const isSendLinkRoute = parts.length === 2 && parts[1] === 'send-link' && method === 'POST';
  if (!isUserRoute && !isPasswordRoute && !isSendLinkRoute) {
    json(res, { error: 'Not found' }, 404);
    return true;
  }

  const target = await prisma.user.findUnique({ where: { id: parts[0] } });
  if (!target) {
    json(res, { error: 'Kasutajat ei leitud' }, 404);
    return true;
  }

  if (isSendLinkRoute) {
    if (!target.email) {
      json(res, { error: 'Kasutajal pole e-posti aadressi' }, 400);
      return true;
    }
    if (!target.isActive) {
      json(res, { error: 'Seda muudatust ei saa teha: kasutaja on keelatud' }, 400);
      return true;
    }
    const emailSent = await sendPasswordLink(
      { id: target.id, username: target.username, displayName: target.displayName, email: target.email },
      target.passwordHash === '' ? 'INVITE' : 'RESET'
    );
    json(res, { success: true, emailSent });
    return true;
  }

  if (isPasswordRoute) {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const password = String(body?.password ?? '');
    const problem = validateNewPassword(password);
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true }
    });
    // Sessioonid ja tokenid on platvormi tabelid (teris_app ei näe neid); kasutaja on leitud ettevõtte piires.
    await authDb().session.deleteMany({ where: { userId: target.id } });
    // Ajutine parool teeb varasemad kutse/lähtestuslingid kehtetuks.
    await authDb().passwordToken.deleteMany({ where: { userId: target.id } });
    json(res, { success: true });
    return true;
  }

  if (method === 'DELETE') {
    const problem = checkAdminChange(actor.id, target, { kind: 'delete' }, await activeAdminCount());
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    await prisma.user.delete({ where: { id: target.id } });
    json(res, { success: true });
    return true;
  }

  // PATCH
  const body = await parseBody(req, MAX_BODY_BYTES);
  const isObject = body !== null && typeof body === 'object';
  const data: { displayName?: string | null; email?: string | null; isActive?: boolean; isAdmin?: boolean; isFinanceManager?: boolean } = {};
  if (isObject && 'displayName' in body) data.displayName = cleanDisplayName(body.displayName);
  if (isObject && 'email' in body) {
    // Tühi string tähendab "eemalda e-post" — mitte-tühi peab siiski kehtiv olema.
    if (typeof body.email === 'string' && body.email.trim() === '') {
      data.email = null;
    } else {
      const email = normalizeEmail(body.email);
      if (!email) {
        json(res, { error: EMAIL_ERROR }, 400);
        return true;
      }
      data.email = email;
    }
  }
  if (typeof body?.isActive === 'boolean') data.isActive = body.isActive;
  if (typeof body?.isAdmin === 'boolean') data.isAdmin = body.isAdmin;
  if (typeof body?.isFinanceManager === 'boolean') data.isFinanceManager = body.isFinanceManager;

  const problem = checkAdminChange(
    actor.id,
    target,
    { kind: 'update', isActive: data.isActive, isAdmin: data.isAdmin },
    await activeAdminCount()
  );
  if (problem) {
    json(res, { error: problem }, 400);
    return true;
  }

  try {
    const user = await prisma.user.update({ where: { id: target.id }, data, select: USER_FIELDS });
    if (data.isActive === false) await authDb().session.deleteMany({ where: { userId: target.id } });
    // E-posti muutmisel (sh eemaldamisel) kaotavad vanad kutse/lähtestuslingid
    // kehtivuse — need viitasid eelmisele aadressile või pole enam saadetavad.
    if ('email' in data && data.email !== target.email) {
      await authDb().passwordToken.deleteMany({ where: { userId: target.id, usedAt: null } });
    }
    json(res, { user: toPublic(user) });
  } catch (err) {
    if (uniqueTarget(err) === null) throw err;
    json(res, { error: EMAIL_TAKEN }, 409);
  }
  return true;
}
