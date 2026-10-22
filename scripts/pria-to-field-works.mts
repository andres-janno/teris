// scripts/pria-to-field-works.mts — olemasolevad field_operations → Terise tööd + kanded (sama loogika mis import).
// npx tsx scripts/pria-to-field-works.mts --tenant <id> [--field-code X --num N] [--year Y] [--dry-run]
// Käivitus rakenduse rolliga (DATABASE_URL), ettevõtte kontekst seatakse tehingus (RLS).
import { PrismaClient } from '@prisma/client';
import type { FieldBookImportOperation } from '../src/types/fieldOperation.ts';
import { importFieldSeasonOperations } from '../src/server/fieldBookImport.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tenant = arg('tenant');
if (!tenant) throw new Error('--tenant on kohustuslik');
const fieldCode = arg('field-code');
const num = arg('num');
const year = arg('year') ? Number(arg('year')) : undefined;
const dryRun = process.argv.includes('--dry-run');
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const db = new PrismaClient();
class DryRun extends Error {}

async function main() {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenant);
      const seasons = await tx.fieldSeason.findMany({
        where: {
          tenantId: tenant,
          ...(year ? { year } : {}),
          ...(fieldCode || num ? { field: { ...(fieldCode ? { fieldCode } : {}), ...(num ? { num } : {}) } } : {}),
          operations: { some: {} }
        },
        orderBy: [{ fieldId: 'asc' }, { year: 'asc' }],
        include: {
          season: { select: { isLocked: true } },
          field: { select: { num: true, name: true } },
          operations: { orderBy: [{ dateFrom: 'asc' }, { sortOrder: 'asc' }], include: { products: { orderBy: { sortOrder: 'asc' } } } }
        }
      });
      // Lukustatud hooaegu ei importita (ka siis, kui põllu hooajal pole hooaja seost, aga aasta on lukus)
      const lockedYears = new Set((await tx.season.findMany({ where: { isLocked: true }, select: { year: true } })).map((s) => s.year));
      for (const fs of seasons) {
        if (fs.season?.isLocked || lockedYears.has(fs.year)) {
          console.log(`Nr ${fs.field.num} ${fs.year}: hooaeg lukus — vahele jäetud`);
          continue;
        }
        const ops: FieldBookImportOperation[] = fs.operations.map((o) => ({
          type: o.type, dateFrom: day(o.dateFrom)!, dateTo: day(o.dateTo), areaHa: o.areaHa, method: o.method,
          performerId: o.performerId, notes: o.notes,
          products: o.products.map((p) => ({
            category: p.category, name: p.name, kind: p.kind, spec: p.spec, amount: p.amount, unit: p.unit,
            nKgHa: p.nKgHa, pKgHa: p.pKgHa, kKgHa: p.kKgHa, activeIngredient: p.activeIngredient
          }))
        }));
        const r = await importFieldSeasonOperations(tx, fs.id, ops, { userId: null, fieldAreaHa: fs.areaHa });
        console.log(`Nr ${fs.field.num} ${fs.year}: ${ops.length} PRIA rida → ${r.created} uut tööd, ${r.complemented} täiendatud`);
      }
      if (dryRun) throw new DryRun();
    }, { timeout: 300000 });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
    console.log('Proovikäivitus — muudatusi ei salvestatud.');
  }
}

main().finally(() => db.$disconnect());
