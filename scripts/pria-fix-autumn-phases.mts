// scripts/pria-fix-autumn-phases.mts — põllu hooaja Y eelmise aasta (Y-1) sügistööde faasi parandus.
// npx tsx scripts/pria-fix-autumn-phases.mts --tenant <id> [--dry-run]
// Hooaja Y tööd, mille kuupäev (varaseim kanne, muidu plaani algus) on aastas < Y, jaotatakse sama reegliga
// mis tahvlil (autumnColumns): külv → SOWING; kuni varaseima külvi päevani (k.a) → PREPARATION; hiljem → CARE.
// Muudetakse ainult salvestatud faasi, kui see erineb. Koristust ei puudutata; lukus hooaegu ei muudeta.
// Käivitus rakenduse rolliga (DATABASE_URL), ettevõtte kontekst seatakse tehingus (RLS).
import { PrismaClient } from '@prisma/client';
import type { WorkPhase } from '../src/types/fieldWork.ts';
import { autumnColumns, boardWorkDate, type AutumnColumn, type BoardWorkLike } from '../src/services/fieldWorksBoardColumns.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tenant = arg('tenant');
if (!tenant) throw new Error('--tenant on kohustuslik');
const dryRun = process.argv.includes('--dry-run');
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const PHASE: Record<AutumnColumn, WorkPhase> = { PREP: 'PREPARATION', SOWING: 'SOWING', CARE: 'CARE' };

const db = new PrismaClient();
class DryRun extends Error {}

async function main() {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenant);
      const lockedYears = new Set((await tx.season.findMany({ where: { isLocked: true }, select: { year: true } })).map((s) => s.year));
      const seasons = await tx.fieldSeason.findMany({
        where: { tenantId: tenant },
        orderBy: [{ fieldId: 'asc' }, { year: 'asc' }],
        include: {
          field: { select: { num: true, name: true } },
          season: { select: { isLocked: true } },
          fieldWorks: {
            orderBy: { sortOrder: 'asc' },
            include: { workType: { select: { name: true, priaCode: true } }, entries: { select: { date: true } } }
          }
        }
      });

      const total = { seasons: 0, works: 0, toPreparation: 0, toSowing: 0, toCare: 0, lockedSkipped: 0 };
      for (const fs of seasons) {
        const autumn: (BoardWorkLike & { name: string })[] = [];
        for (const w of fs.fieldWorks) {
          if (w.phase === 'HARVEST') continue;
          const like = {
            id: w.id,
            name: w.workType.name,
            phase: w.phase as WorkPhase,
            priaCode: w.workType.priaCode,
            entries: w.entries.map((e) => ({ date: iso(e.date)! })),
            plannedDateFrom: iso(w.plannedDateFrom),
            plannedText: w.plannedText
          };
          const date = boardWorkDate(like);
          if (date && Number(date.slice(0, 4)) < fs.year) autumn.push(like);
        }
        if (!autumn.length) continue;
        const cols = autumnColumns(autumn);
        const changes = autumn
          .map((w) => ({ w, to: PHASE[cols.get(w.id)!] }))
          .filter(({ w, to }) => w.phase !== to);
        if (!changes.length) continue;
        const label = `Nr ${fs.field.num ?? '–'} ${fs.field.name} hooaeg ${fs.year}`;
        const list = changes.map(({ w, to }) => `${w.name} ${boardWorkDate(w)} ${w.phase}→${to}`).join('; ');
        if (fs.season?.isLocked || lockedYears.has(fs.year)) {
          console.log(`${label} (lukus, jäeti vahele): ${list}`);
          total.lockedSkipped += changes.length;
          continue;
        }
        console.log(`${label}: ${list}`);
        for (const { w, to } of changes) {
          await tx.fieldWork.update({ where: { id: w.id }, data: { phase: to } });
          if (to === 'PREPARATION') total.toPreparation++;
          else if (to === 'SOWING') total.toSowing++;
          else total.toCare++;
        }
        total.seasons++;
        total.works += changes.length;
      }
      console.log(`\nKokku (${tenant}): ${total.works} tööd ${total.seasons} põllu hooajal (→PREPARATION ${total.toPreparation}, →SOWING ${total.toSowing}, →CARE ${total.toCare}); lukus hooaegadel vahele jäetud ${total.lockedSkipped}`);
      if (dryRun) throw new DryRun();
    }, { timeout: 300000 });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
    console.log('Proovikäivitus — muudatusi ei salvestatud.');
  }
}

main().finally(() => db.$disconnect());
