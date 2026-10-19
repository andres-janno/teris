// src/server/landing/interestAdmin.ts — huviliste haldus admin.teris.ee-s. Auditisse läheb ainult id ja staatus.
import type { InterestRequest } from '@prisma/client';
import { authDb } from '../db.ts';

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED'] as const;
type Status = (typeof STATUSES)[number];
type Patch = { status?: Status; notes?: string | null };

const toRow = (r: InterestRequest) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  closedAt: r.closedAt?.toISOString() ?? null
});
export type InterestRow = ReturnType<typeof toRow>;

export async function listInterest(status: string | null): Promise<InterestRow[]> {
  const where = status && STATUSES.includes(status as Status) ? { status: status as Status } : {};
  return (await authDb().interestRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 })).map(toRow);
}

export function parseInterestPatch(body: any): { ok: true; data: Patch } | { ok: false; error: string } {
  const data: Patch = {};
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { ok: false, error: 'Tundmatu staatus' };
    data.status = body.status;
  }
  if (body?.notes !== undefined) {
    const notes = body.notes == null ? '' : String(body.notes).trim();
    if (notes.length > 4000) return { ok: false, error: 'Märkmed on liiga pikad (kuni 4000 märki)' };
    data.notes = notes || null;
  }
  if (!Object.keys(data).length) return { ok: false, error: 'Muudatus puudub' };
  return { ok: true, data };
}

export async function updateInterest(id: string, patch: Patch, platformUserId: string): Promise<InterestRow | null> {
  const db = authDb();
  return db.$transaction(async (tx) => {
    const current = await tx.interestRequest.findUnique({ where: { id } });
    if (!current) return null;
    const closedAt = patch.status === undefined ? undefined : patch.status === 'CLOSED' ? (current.closedAt ?? new Date()) : null;
    const row = await tx.interestRequest.update({ where: { id }, data: { ...patch, ...(closedAt !== undefined ? { closedAt } : {}) } });
    await tx.platformAuditLog.create({ data: { action: 'INTEREST_UPDATE', platformUserId, details: { id, status: row.status } } });
    return toRow(row);
  });
}

export async function deleteInterest(id: string, platformUserId: string): Promise<boolean> {
  return authDb().$transaction(async (tx) => {
    const { count } = await tx.interestRequest.deleteMany({ where: { id } });
    if (count) await tx.platformAuditLog.create({ data: { action: 'INTEREST_DELETE', platformUserId, details: { id } } });
    return count > 0;
  });
}
