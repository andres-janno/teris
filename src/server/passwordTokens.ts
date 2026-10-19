// src/server/passwordTokens.ts — ühekordsed parooli määramise lingid (kutse ja lähtestus).
import { authDb } from './db.ts';
import { generateSessionToken, hashToken } from './auth.ts';
import { APP_BASE_URL, MAIL_FROM, buildPasswordLinkMail, sendMail } from './mail.ts';

export type TokenPurpose = 'INVITE' | 'RESET';

const TTL_MS: Record<TokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  RESET: 60 * 60 * 1000
};

export function tokenExpiry(purpose: TokenPurpose, now: Date = new Date()): Date {
  return new Date(now.getTime() + TTL_MS[purpose]);
}

export async function issuePasswordToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const raw = generateSessionToken();
  await authDb().passwordToken.deleteMany({ where: { userId, usedAt: null } });
  await authDb().passwordToken.create({
    data: { userId, purpose, tokenHash: hashToken(raw), expiresAt: tokenExpiry(purpose) }
  });
  return raw;
}

export async function isTenantActive(tenantId: string): Promise<boolean> {
  const tenant = await authDb().tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
  return tenant?.status === 'ACTIVE';
}

export async function findValidToken(rawToken: string) {
  if (!rawToken || rawToken.length > 200) return null;
  const token = await authDb().passwordToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, username: true, isActive: true, tenantId: true } } }
  });
  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now() || !token.user.isActive) return null;
  // Peatatud (või puuduva) ettevõtte kasutaja link ei kehti.
  if (!(await isTenantActive(token.user.tenantId))) return null;
  return { id: token.id, purpose: token.purpose as TokenPurpose, user: token.user };
}

// Atomselt: märgi token kasutatuks (üks samaaegne kasutus võidab), määra parool,
// kustuta kasutaja muud tokenid ja kõik sessioonid. Tagastab false, kui token oli
// juba kasutusel/kadunud (nt paralleelne päring jõudis ette).
export async function consumeTokenAndSetPassword(tokenId: number, userId: string, passwordHash: string): Promise<boolean> {
  return authDb().$transaction(async (tx) => {
    const { count } = await tx.passwordToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() }
    });
    if (count !== 1) return false;
    await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
    await tx.passwordToken.deleteMany({ where: { userId, NOT: { id: tokenId } } });
    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
}

export async function sendPasswordLink(
  user: { id: string; username: string; displayName: string | null; email: string },
  purpose: TokenPurpose
): Promise<boolean> {
  const raw = await issuePasswordToken(user.id, purpose);
  const message = buildPasswordLinkMail({
    to: user.email,
    from: MAIL_FROM,
    purpose,
    link: `${APP_BASE_URL}/set-password#${raw}`,
    username: user.username,
    displayName: user.displayName
  });
  try {
    await sendMail(message, user.email);
    return true;
  } catch (err) {
    console.error(`[Mail] ${purpose} kirja saatmine ebaõnnestus (kasutaja ${user.username}):`, err instanceof Error ? err.message : err);
    return false;
  }
}
