// scripts/pria-work-types.mts — töötüübid PRIA e-põlluraamatu 29 tegevuseks (ettevõtted + kataloog).
// Korduvkäivitatav. Käivitus omanikuna: npx tsx scripts/pria-work-types.mts [--dry-run]
// Vanad tüübid → LEGACY_WORK_TYPE_MAP; korduvad tööd jagatakse (iga kord = üks töö);
// mallide read liidetakse sama tüübi korral (plannedCount summa).
import { PrismaClient, type Prisma } from '@prisma/client';
import { PRIA_ACTIVITIES, LEGACY_WORK_TYPE_MAP } from '../src/services/pria.ts';
import { splitRepeatedWork } from '../src/server/workTypeMigration.ts';

const dryRun = process.argv.includes('--dry-run');
const url = process.env.MIGRATE_DATABASE_URL;
if (!url) throw new Error('MIGRATE_DATABASE_URL puudub');
const db = new PrismaClient({ datasources: { db: { url } } });

async function migrateTenant(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenantId);
  const stats = { created: 0, worksMoved: 0, worksSplit: 0, itemsMerged: 0, typesDeleted: 0 };

  // 1. PRIA tüübid (olemasolev sama nimega tüüp saab priaCode)
  const byPria = new Map<string, string>();
  for (const a of PRIA_ACTIVITIES) {
    const existing = await tx.workType.findFirst({ where: { tenantId, OR: [{ priaCode: a.name }, { name: a.name }] } });
    const row = existing
      ? await tx.workType.update({ where: { id: existing.id }, data: { priaCode: a.name, name: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder, repeatMode: 'ONCE', maxRepeats: null, intervalDays: null, isActive: true } })
      : await tx.workType.create({ data: { tenantId, name: a.name, priaCode: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder } });
    if (!existing) stats.created++;
    byPria.set(a.name, row.id);
  }

  // 2. Vanade tüüpide tööd ja mallide read uutele tüüpidele
  const legacy = await tx.workType.findMany({ where: { tenantId, priaCode: null } });
  for (const old of legacy) {
    const target = LEGACY_WORK_TYPE_MAP[old.name];
    if (!target) throw new Error(`${tenantId}: töötüübil "${old.name}" puudub PRIA vaste`);
    const targetId = byPria.get(target)!;
    const works = await tx.fieldWork.findMany({ where: { workTypeId: old.id }, include: { entries: { select: { id: true, occurrenceNo: true } } } });
    for (const w of works) {
      const method = old.name === 'Leheväetamine' ? 'Pritsimine' : w.method;
      await tx.fieldWork.update({ where: { id: w.id }, data: { workTypeId: targetId, phase: w.phase, method } });
      stats.worksMoved++;
    }
    const items = await tx.workTemplateItem.findMany({ where: { workTypeId: old.id } });
    for (const it of items) {
      const dup = await tx.workTemplateItem.findFirst({ where: { templateId: it.templateId, workTypeId: targetId } });
      if (dup) {
        await tx.workTemplateItem.update({ where: { id: dup.id }, data: { plannedCount: (dup.plannedCount ?? 1) + (it.plannedCount ?? 1) } });
        await tx.workTemplateItem.delete({ where: { id: it.id } });
        stats.itemsMerged++;
      } else {
        await tx.workTemplateItem.update({ where: { id: it.id }, data: { workTypeId: targetId } });
      }
    }
    await tx.workType.delete({ where: { id: old.id } });
    stats.typesDeleted++;
  }

  // 3. Korduvad tööd (plannedCount > 1 või mitu kordumisnumbrit) → iga kord oma töö
  const works = await tx.fieldWork.findMany({ include: { entries: { select: { id: true, occurrenceNo: true } } } });
  for (const w of works) {
    const groups = splitRepeatedWork({ plannedCount: w.plannedCount, entries: w.entries });
    if (groups.length === 1) {
      if (w.plannedCount !== 1) await tx.fieldWork.update({ where: { id: w.id }, data: { plannedCount: 1 } });
      continue;
    }
    for (const [i, g] of groups.entries()) {
      const workId = i === 0
        ? w.id
        : (await tx.fieldWork.create({
            data: {
              tenantId, fieldSeasonId: w.fieldSeasonId, workTypeId: w.workTypeId, phase: w.phase, sortOrder: w.sortOrder,
              plannedText: w.plannedText, plannedCount: 1, fromTemplate: w.fromTemplate, method: w.method, notes: null
            }
          })).id;
      if (i > 0 && g.entryIds.length) await tx.workEntry.updateMany({ where: { id: { in: g.entryIds } }, data: { fieldWorkId: workId } });
      const n = g.entryIds.length;
      await tx.fieldWork.update({
        where: { id: workId },
        data: { plannedCount: 1, ...(i > 0 ? { status: n > 0 ? 'IN_PROGRESS' : 'PLANNED' } : {}) }
      });
    }
    stats.worksSplit++;
  }
  await tx.workEntry.updateMany({ data: { occurrenceNo: null } });
  return stats;
}

async function migrateCatalog(tx: Prisma.TransactionClient) {
  for (const a of PRIA_ACTIVITIES) {
    const existing = await tx.catalogWorkType.findFirst({ where: { OR: [{ priaCode: a.name }, { name: a.name }] } });
    if (existing) {
      await tx.catalogWorkType.update({ where: { id: existing.id }, data: { priaCode: a.name, name: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder, repeatMode: 'ONCE', maxRepeats: null, intervalDays: null, isActive: true } });
    } else {
      await tx.catalogWorkType.create({ data: { name: a.name, priaCode: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder } });
    }
  }
  const byName = new Map((await tx.catalogWorkType.findMany({ where: { priaCode: { not: null } } })).map((w) => [w.name, w.id]));
  for (const old of await tx.catalogWorkType.findMany({ where: { priaCode: null } })) {
    const targetId = byName.get(LEGACY_WORK_TYPE_MAP[old.name] ?? '');
    if (!targetId) throw new Error(`Kataloog: töötüübil "${old.name}" puudub PRIA vaste`);
    for (const it of await tx.catalogWorkTemplateItem.findMany({ where: { catalogWorkTypeId: old.id } })) {
      const dup = await tx.catalogWorkTemplateItem.findFirst({ where: { templateId: it.templateId, catalogWorkTypeId: targetId } });
      if (dup) {
        await tx.catalogWorkTemplateItem.update({ where: { id: dup.id }, data: { plannedCount: (dup.plannedCount ?? 1) + (it.plannedCount ?? 1) } });
        await tx.catalogWorkTemplateItem.delete({ where: { id: it.id } });
      } else {
        await tx.catalogWorkTemplateItem.update({ where: { id: it.id }, data: { catalogWorkTypeId: targetId } });
      }
    }
    await tx.catalogWorkType.delete({ where: { id: old.id } });
  }
}

class DryRun extends Error {}

async function main() {
  const tenants = await db.tenant.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  for (const t of tenants) {
    try {
      await db.$transaction(async (tx) => {
        const s = await migrateTenant(tx, t.id);
        console.log(t.id, s);
        if (dryRun) throw new DryRun();
      }, { timeout: 120000 });
    } catch (e) {
      if (!(e instanceof DryRun)) throw e;
    }
  }
  try {
    await db.$transaction(async (tx) => {
      await migrateCatalog(tx);
      console.log('kataloog', await tx.catalogWorkType.count());
      if (dryRun) throw new DryRun();
    });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }
}

main().finally(() => db.$disconnect());
