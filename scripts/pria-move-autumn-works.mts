// scripts/pria-move-autumn-works.mts — PRIA: koristuse järel tehtud sügistööd järgmise aasta põllu hooaja alla.
// npx tsx scripts/pria-move-autumn-works.mts --tenant <id> [--field-code X --num N] [--year Y] [--dry-run]
// Hooaja Y PRIA_IMPORT tööd, mille plannedDateFrom on hilisem kui viimane PRIA saagikoristus, viiakse hooajale Y+1
// (sama reegel mis impordil, vt splitPostHarvestOperations). Vahekultuuri külv (liik ei sobi Y+1 kultuuriga) jääb.
// Y+1 sama töötüübi kuupäevata ja kanneteta mallitöö kustutatakse (imporditud töö asendab selle); muud ei kustutata.
// Käivitus rakenduse rolliga (DATABASE_URL), ettevõtte kontekst seatakse tehingus (RLS).
import { PrismaClient } from '@prisma/client';
import type { WorkPhase } from '../src/types/fieldWork.ts';
import { PRIA_ACTIVITY } from '../src/services/pria.ts';
import { sowingKindMatchesCrop } from '../src/server/fieldBookRules.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tenant = arg('tenant');
if (!tenant) throw new Error('--tenant on kohustuslik');
const fieldCode = arg('field-code');
const num = arg('num');
const year = arg('year') ? Number(arg('year')) : undefined;
const dryRun = process.argv.includes('--dry-run');
const time = (d: Date | null) => d?.getTime() ?? null;

const db = new PrismaClient();
class DryRun extends Error {}

async function main() {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenant);
      const typeRows = await tx.workType.findMany({ where: { priaCode: { not: null } }, select: { id: true, priaCode: true } });
      const typeName = new Map(typeRows.map((t) => [t.id, t.priaCode!]));
      const harvestTypeIds = new Set(typeRows.filter((t) => t.priaCode === PRIA_ACTIVITY.HARVEST).map((t) => t.id));
      const sowingTypeIds = new Set(typeRows.filter((t) => t.priaCode === PRIA_ACTIVITY.SOWING).map((t) => t.id));
      const lockedYears = new Set((await tx.season.findMany({ where: { isLocked: true }, select: { year: true } })).map((s) => s.year));

      const seasons = await tx.fieldSeason.findMany({
        where: {
          tenantId: tenant,
          ...(year ? { year } : {}),
          ...(fieldCode || num ? { field: { ...(fieldCode ? { fieldCode } : {}), ...(num ? { num } : {}) } } : {}),
          fieldWorks: { some: { source: 'PRIA_IMPORT' } }
        },
        orderBy: [{ fieldId: 'asc' }, { year: 'asc' }],
        include: {
          field: { select: { num: true } },
          fieldWorks: {
            where: { source: 'PRIA_IMPORT' },
            orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
            include: { lines: true, entries: { include: { lines: true } } }
          }
        }
      });

      const total = { seasons: 0, moved: 0, templatesDeleted: 0, intercrop: 0, skipped: 0 };
      for (const fs of seasons) {
        const harvests = fs.fieldWorks.filter((w) => harvestTypeIds.has(w.workTypeId) && w.plannedDateFrom).map((w) => time(w.plannedDateFrom)!);
        if (!harvests.length) continue;
        const harvestAt = Math.max(...harvests);
        const candidates = fs.fieldWorks.filter((w) => !harvestTypeIds.has(w.workTypeId) && w.plannedDateFrom && time(w.plannedDateFrom)! > harvestAt);
        if (!candidates.length) continue;
        const label = `Nr ${fs.field.num} ${fs.year} → ${fs.year + 1}`;

        const next = await tx.fieldSeason.findUnique({
          where: { fieldId_year: { fieldId: fs.fieldId, year: fs.year + 1 } },
          include: {
            season: { select: { isLocked: true } },
            fieldWorks: { where: { fromTemplate: true, plannedDateFrom: null, entries: { none: {} } }, select: { id: true, workTypeId: true } }
          }
        });
        if (!next) { console.log(`${label}: ${candidates.length} tööd jäid — ${fs.year + 1} põllu hooaeg puudub`); total.skipped += candidates.length; continue; }
        if (next.season?.isLocked || lockedYears.has(next.year)) { console.log(`${label}: ${candidates.length} tööd jäid — ${next.year} on lukus`); total.skipped += candidates.length; continue; }

        // Vahekultuuri külv (liik ei sobi järgmise hooaja kultuuriga) jääb hooajale Y; liigita külv liigub
        const kindsOf = (w: (typeof candidates)[number]) => {
          const plan = w.lines.filter((l) => l.kind === 'MATERIAL' && l.priaKind).map((l) => l.priaKind!);
          return plan.length ? plan : w.entries.flatMap((e) => e.lines.filter((l) => l.kind === 'MATERIAL' && l.priaKind).map((l) => l.priaKind!));
        };
        let intercrop = 0;
        const moving = candidates.filter((w) => {
          if (!sowingTypeIds.has(w.workTypeId)) return true;
          const kinds = kindsOf(w);
          const ok = !kinds.length || kinds.some((k) => sowingKindMatchesCrop(k, next.crop));
          if (!ok) intercrop++;
          return ok;
        });
        const sowings = moving.filter((w) => sowingTypeIds.has(w.workTypeId)).map((w) => time(w.plannedDateFrom)!);
        const firstSowing = sowings.length ? Math.min(...sowings) : null;

        const templates = [...next.fieldWorks];
        let templatesDeleted = 0;
        for (const w of moving) {
          const phase: WorkPhase = sowingTypeIds.has(w.workTypeId)
            ? 'SOWING'
            : firstSowing != null && time(w.plannedDateFrom)! > firstSowing ? 'CARE' : 'PREPARATION';
          await tx.fieldWork.update({ where: { id: w.id }, data: { fieldSeasonId: next.id, phase } });
          const ti = templates.findIndex((t) => t.workTypeId === w.workTypeId);
          if (ti >= 0) {
            await tx.fieldWork.delete({ where: { id: templates[ti].id } });
            templates.splice(ti, 1);
            templatesDeleted++;
          }
        }
        const types = moving.map((w) => typeName.get(w.workTypeId) ?? w.workTypeId).join(', ');
        console.log(`${label}: ${moving.length} tööd (${types}), ${templatesDeleted} mallitööd asendatud, ${intercrop} vahekultuur jäi`);
        total.seasons++; total.moved += moving.length; total.templatesDeleted += templatesDeleted; total.intercrop += intercrop;
      }
      console.log(`\nKokku (${tenant}${year ? `, ${year}` : ''}): ${total.moved} tööd ${total.seasons} põllu hooajalt järgmise hooaja alla; mallitöid asendatud ${total.templatesDeleted}; vahekultuuri külve jäi ${total.intercrop}; vahele jäetud (Y+1 puudub/lukus) ${total.skipped}`);
      if (dryRun) throw new DryRun();
    }, { timeout: 300000 });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
    console.log('Proovikäivitus — muudatusi ei salvestatud.');
  }
}

main().finally(() => db.$disconnect());
