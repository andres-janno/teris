// scripts/pria-to-field-works.mts — olemasolevad field_operations → Terise tööd + kanded (sama loogika mis import).
// npx tsx scripts/pria-to-field-works.mts --tenant <id> [--field-code X --num N] [--year Y] [--include-locked] [--dry-run]
// --include-locked: ka lukustatud hooajad viiakse üle (field_operations kustutamise eel vajalik).
// Lõpus kokkuvõte: PRIA read = uued + täiendatud + seotud + tundmatud (+ lukus vahele jäetud).
// Käivitus rakenduse rolliga (DATABASE_URL), ettevõtte kontekst seatakse tehingus (RLS).
import { PrismaClient } from '@prisma/client';
import type { FieldBookImportOperation } from '../src/types/fieldOperation.ts';
import { ensurePriaWorkTypes, importFieldSeasonOperations } from '../src/server/fieldBookImport.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tenant = arg('tenant');
if (!tenant) throw new Error('--tenant on kohustuslik');
const fieldCode = arg('field-code');
const num = arg('num');
const year = arg('year') ? Number(arg('year')) : undefined;
const dryRun = process.argv.includes('--dry-run');
const includeLocked = process.argv.includes('--include-locked');
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
      const types = await ensurePriaWorkTypes(tx);
      const total = { rows: 0, created: 0, complemented: 0, linked: 0, entriesAdded: 0, unknown: 0, lockedRows: 0, templateWorksUsed: 0 };
      for (const fs of seasons) {
        const locked = !!fs.season?.isLocked || lockedYears.has(fs.year);
        total.rows += fs.operations.length;
        if (locked && !includeLocked) {
          console.log(`Nr ${fs.field.num} ${fs.year}: hooaeg lukus — vahele jäetud`);
          total.lockedRows += fs.operations.length;
          continue;
        }
        const templateBefore = await tx.fieldWork.count({ where: { fieldSeasonId: fs.id, fromTemplate: true, plannedDateFrom: null } });
        const ops: FieldBookImportOperation[] = fs.operations.map((o) => ({
          type: o.type, dateFrom: day(o.dateFrom)!, dateTo: day(o.dateTo), areaHa: o.areaHa, method: o.method,
          performerId: o.performerId, notes: o.notes,
          products: o.products.map((p) => ({
            category: p.category, name: p.name, kind: p.kind, spec: p.spec, amount: p.amount, unit: p.unit,
            nKgHa: p.nKgHa, pKgHa: p.pKgHa, kKgHa: p.kKgHa, activeIngredient: p.activeIngredient
          }))
        }));
        const r = await importFieldSeasonOperations(tx, fs.id, ops, { userId: null, fieldAreaHa: fs.areaHa, types });
        const templateUsed = templateBefore - (await tx.fieldWork.count({ where: { fieldSeasonId: fs.id, fromTemplate: true, plannedDateFrom: null } }));
        total.created += r.created; total.complemented += r.complemented; total.linked += r.linked;
        total.entriesAdded += r.entriesAdded; total.unknown += r.unknown; total.templateWorksUsed += templateUsed;
        console.log(`Nr ${fs.field.num} ${fs.year}${locked ? ' (lukus hooaeg, üleviimine)' : ''}: ${ops.length} PRIA rida → ${r.created} uut tööd, ${r.complemented} täiendatud (${r.entriesAdded} kannet lisatud, ${templateUsed} mallitööd), ${r.linked} seotud muutmata, ${r.unknown} tundmatu tegevus`);
      }
      const sum = total.created + total.complemented + total.linked + total.unknown + total.lockedRows;
      console.log(`\nKokku (${tenant}): PRIA ridu ${total.rows}; uusi töid ${total.created}; täiendatud ${total.complemented} (neist kanne lisatud ${total.entriesAdded}); seotud muutmata ${total.linked}; tundmatu tegevus ${total.unknown}; lukus vahele jäetud ${total.lockedRows}; mallitöid kasutatud ${total.templateWorksUsed}`);
      console.log(sum === total.rows ? 'Kontroll: read = uued + täiendatud + seotud + tundmatud + lukus — OK' : `Kontroll: VIGA, summa ${sum} ≠ ${total.rows}`);
      if (dryRun) throw new DryRun();
    }, { timeout: 300000 });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
    console.log('Proovikäivitus — muudatusi ei salvestatud.');
  }
}

main().finally(() => db.$disconnect());
