// src/server/supportSession.ts
// Tugisessioon ettevõtte rakenduses: teenusepakkuja vahetab ühekordse üleandmistokeni
// sessiooniküpsise vastu. Sessioon on alati ainult lugemiseks ja admini õigustes.
import { randomBytes } from 'crypto';
import { authDb } from './db.ts';
import { hashToken } from './auth.ts';

export const SUPPORT_SESSION_MAX_MS = 8 * 60 * 60 * 1000;
export const SUPPORT_LINK_ERROR = 'Tugivaate link on aegunud või juba kasutatud';

export type SupportSessionUser = {
  id: string;
  username: string;
  displayName: string | null;
  passwordHash: string;
  isActive: boolean;
  isAdmin: boolean;
  isFinanceManager: boolean;
  mustChangePassword: boolean;
  tenantId: string;
  supportView: true;
  supportValidUntil: Date;
};

/** Kehtiv tugisessioon tokeni räsi järgi: sessioon, luba ja ettevõte kehtivad. Muidu null. */
export async function findSupportSession(tokenHash: string): Promise<{ user: SupportSessionUser; sessionId: string } | null> {
  const s = await authDb().supportSession.findUnique({ where: { sessionTokenHash: tokenHash } });
  if (!s || !s.expiresAt || s.expiresAt.getTime() <= Date.now()) return null;
  const grant = await authDb().supportGrant.findUnique({ where: { id: s.supportGrantId } });
  if (!grant || grant.revokedAt !== null || grant.validUntil.getTime() <= Date.now() || grant.tenantId !== s.targetTenantId) return null;
  const tenant = await authDb().tenant.findUnique({ where: { id: s.targetTenantId }, select: { status: true } });
  if (tenant?.status !== 'ACTIVE') return null;
  return {
    sessionId: s.id,
    user: {
      id: `support:${s.id}`,
      username: 'kasutajatugi',
      displayName: 'Kasutajatugi',
      passwordHash: '',
      isActive: true,
      isAdmin: true,
      isFinanceManager: true,
      mustChangePassword: false,
      tenantId: s.targetTenantId,
      supportView: true,
      supportValidUntil: s.expiresAt
    }
  };
}

/**
 * Vahetab üleandmistokeni tugisessiooni vastu. Tagastab uue sessioonitokeni ja lõpu või null,
 * kui token on tundmatu, aegunud, kasutatud või luba/ettevõte enam ei kehti.
 */
export async function exchangeHandoff(handoffToken: string): Promise<{ token: string; expiresAt: Date } | null> {
  if (!handoffToken) return null;
  const handoffHash = hashToken(handoffToken);
  const now = new Date();

  // Aegunud kasutamata üleandmised — parim katse, ei tohi sisenemist katkestada.
  try {
    await authDb().supportSession.deleteMany({ where: { sessionTokenHash: null, handoffExpiresAt: { lt: now } } });
  } catch (err) {
    console.error('[Tugi] Aegunud üleandmiste koristus ebaõnnestus:', err);
  }

  const s = await authDb().supportSession.findUnique({ where: { handoffTokenHash: handoffHash } });
  if (!s || s.handoffExpiresAt.getTime() <= now.getTime()) return null;
  const grant = await authDb().supportGrant.findUnique({ where: { id: s.supportGrantId } });
  if (!grant || grant.revokedAt !== null || grant.validUntil.getTime() <= now.getTime() || grant.tenantId !== s.targetTenantId) return null;
  const tenant = await authDb().tenant.findUnique({ where: { id: s.targetTenantId }, select: { status: true } });
  if (tenant?.status !== 'ACTIVE') return null;
  const platformUser = await authDb().platformUser.findUnique({ where: { id: s.platformUserId }, select: { username: true, isActive: true } });
  if (!platformUser?.isActive) return null;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Math.min(grant.validUntil.getTime(), now.getTime() + SUPPORT_SESSION_MAX_MS));
  // Atomaarne ühekordne kasutus: võidab ainult üks samaaegne päring.
  const { count } = await authDb().supportSession.updateMany({
    where: { id: s.id, handoffTokenHash: handoffHash, handoffExpiresAt: { gt: now } },
    data: { handoffTokenHash: null, sessionTokenHash: hashToken(token), expiresAt }
  });
  if (count !== 1) return null;

  try {
    await authDb().supportAccessLog.create({
      data: { tenantId: s.targetTenantId, supportGrantId: grant.id, platformUsername: platformUser.username }
    });
  } catch (err) {
    // Logita sisenemist ei tohi olla: võta äsja loodud sessioon tagasi.
    await authDb().supportSession.deleteMany({ where: { id: s.id } }).catch(() => {});
    throw err;
  }
  return { token, expiresAt };
}
