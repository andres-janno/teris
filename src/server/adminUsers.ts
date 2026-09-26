// src/server/adminUsers.ts — /api/admin/users* (ainult adminile).
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { hashPassword, validateNewPassword } from './auth.ts';
import { sessionUserOf } from './authGate.ts';
import { normalizeUsername, USERNAME_ERROR, checkAdminChange } from './adminRules.ts';

const PREFIX = '/api/admin/users';
const MAX_BODY_BYTES = 16 * 1024;

const PUBLIC_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  isActive: true,
  isAdmin: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true
} as const;

const activeAdminCount = () => prisma.user.count({ where: { isActive: true, isAdmin: true } });

function cleanDisplayName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().slice(0, 120);
  return name || null;
}

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === 'P2002';

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

  // /api/admin/users
  if (parts.length === 0 && method === 'GET') {
    const users = await prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { username: 'asc' } });
    json(res, { users });
    return true;
  }

  if (parts.length === 0 && method === 'POST') {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const username = normalizeUsername(body?.username);
    if (!username) {
      json(res, { error: USERNAME_ERROR }, 400);
      return true;
    }
    const password = String(body?.password ?? '');
    const problem = validateNewPassword(password);
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    try {
      const user = await prisma.user.create({
        data: {
          username,
          displayName: cleanDisplayName(body?.displayName),
          passwordHash: await hashPassword(password),
          isAdmin: body?.isAdmin === true,
          mustChangePassword: true
        },
        select: PUBLIC_FIELDS
      });
      json(res, { user }, 201);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      json(res, { error: 'Selline kasutajanimi on juba olemas' }, 409);
    }
    return true;
  }

  const isUserRoute = parts.length === 1 && (method === 'PATCH' || method === 'DELETE');
  const isPasswordRoute = parts.length === 2 && parts[1] === 'password' && method === 'POST';
  if (!isUserRoute && !isPasswordRoute) {
    json(res, { error: 'Not found' }, 404);
    return true;
  }

  const target = await prisma.user.findUnique({ where: { id: parts[0] } });
  if (!target) {
    json(res, { error: 'Kasutajat ei leitud' }, 404);
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
    await prisma.session.deleteMany({ where: { userId: target.id } });
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
  const data: { displayName?: string | null; isActive?: boolean; isAdmin?: boolean } = {};
  if (body && typeof body === 'object' && 'displayName' in body) data.displayName = cleanDisplayName(body.displayName);
  if (typeof body?.isActive === 'boolean') data.isActive = body.isActive;
  if (typeof body?.isAdmin === 'boolean') data.isAdmin = body.isAdmin;

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

  const user = await prisma.user.update({ where: { id: target.id }, data, select: PUBLIC_FIELDS });
  if (data.isActive === false) await prisma.session.deleteMany({ where: { userId: target.id } });
  json(res, { user });
  return true;
}
