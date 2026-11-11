// scripts/fields-merge-duplicates.mts — sama põllu topeltkirjete (eri number/operaator eri aastatel) leidmine ja liitmine.
// Identiteet: sama massiiv + kuju kattub eelmise aasta kujuga (src/services/fieldIdentity.ts).
// Vaikimisi ainult plaan (muudatusi ei tee): npx tsx scripts/fields-merge-duplicates.mts [--tenant <id>] [--out plan.md]
// Liitmine (pärast plaani ülevaatust ja varukoopiat): ... --apply
// Käivita PLATFORM_DATABASE_URL-iga (RLS-ist mööda, kõik ettevõtted).
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { linkSeasons, type SeasonShape } from '../src/services/fieldIdentity.ts';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const APPLY = args.includes('--apply');
const ONLY_TENANT = opt('--tenant');
const OUT = opt('--out');

const url = process.env.PLATFORM_DATABASE_URL;
if (!url) throw new Error('PLATFORM_DATABASE_URL puudub');
const db = new PrismaClient({ datasources: { db: { url } } });

interface Rec extends SeasonShape { seasonId: number; areaHa: number; crop: string }

async function main() {
  const tenants = await db.tenant.findMany({ where: ONLY_TENANT ? { id: ONLY_TENANT } : {}, orderBy: { name: 'asc' } });
  const lines: string[] = [];
  const plan: { tenantId: string; targetId: number; sourceIds: number[] }[] = [];
  for (const t of tenants) {
    const fields = await db.field.findMany({
      where: { tenantId: t.id },
      include: { operator: { select: { name: true } }, fieldSeasons: { select: { id: true, year: true, geometry: true, areaHa: true, crop: true } } }
    });
    const byId = new Map(fields.map((f) => [f.id, f]));
    const byCode = new Map<string, Rec[]>();
    for (const f of fields) for (const s of f.fieldSeasons) {
      const list = byCode.get(f.fieldCode) ?? byCode.set(f.fieldCode, []).get(f.fieldCode)!;
      list.push({ fieldId: f.id, year: s.year, geometry: s.geometry, seasonId: s.id, areaHa: s.areaHa, crop: s.crop });
    }
    const groups: { members: number[]; minOverlap: number }[] = [];
    const conflicts: string[] = [];
    for (const [code, recs] of byCode) {
      if (new Set(recs.map((r) => r.fieldId)).size < 2) continue;
      // union-find üle põllu id-de
      const parent = new Map<number, number>();
      const find = (x: number): number => { const p = parent.get(x) ?? x; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
      const minOv = new Map<number, number>();
      for (const l of linkSeasons(recs)) {
        if (l.from.fieldId === l.to.fieldId) continue;
        const a = find(l.from.fieldId), b = find(l.to.fieldId);
        if (a === b) continue;
        // Ühendamine ei tohi tekitada samal aastal kahte hooaega
        const yearsOf = (root: number) => recs.filter((r) => find(r.fieldId) === root).map((r) => r.year);
        const ya = yearsOf(a), yb = new Set(yearsOf(b));
        if (ya.some((y) => yb.has(y))) {
          conflicts.push(`massiiv ${code}: ${byId.get(l.from.fieldId)!.num} ↔ ${byId.get(l.to.fieldId)!.num} — mõlemal sama aasta hooaeg, jäetakse eraldi`);
          continue;
        }
        parent.set(b, a);
        minOv.set(a, Math.min(minOv.get(a) ?? 1, minOv.get(b) ?? 1, l.overlap));
      }
      const roots = new Map<number, number[]>();
      for (const id of new Set(recs.map((r) => r.fieldId))) { const r = find(id); (roots.get(r) ?? roots.set(r, []).get(r)!).push(id); }
      for (const [root, members] of roots) if (members.length > 1) groups.push({ members, minOverlap: minOv.get(root) ?? 1 });
    }
    if (!groups.length && !conflicts.length) continue;
    lines.push(`## ${t.name}`, '', `Liidetavaid gruppe: ${groups.length}, põldu kokku ${groups.reduce((s, g) => s + g.members.length, 0)} → ${groups.length}`, '');
    // Sihtpõld: viimase hooajaga, siis enim hooaegu, siis väikseim id
    const lastYear = (id: number) => Math.max(...byId.get(id)!.fieldSeasons.map((s) => s.year));
    groups.sort((a, b) => byId.get(a.members[0])!.fieldCode.localeCompare(byId.get(b.members[0])!.fieldCode));
    for (const g of groups) {
      const sorted = [...g.members].sort((a, b) => lastYear(b) - lastYear(a) || byId.get(b)!.fieldSeasons.length - byId.get(a)!.fieldSeasons.length || a - b);
      const target = sorted[0];
      plan.push({ tenantId: t.id, targetId: target, sourceIds: sorted.slice(1) });
      const tf = byId.get(target)!;
      lines.push(`### ${tf.fieldCode} → „${tf.num}“ (${tf.name})${g.minOverlap < 0.8 ? ` — väikseim kattuvus ${Math.round(g.minOverlap * 100)}%` : ''}`);
      const rows = g.members.flatMap((id) => byId.get(id)!.fieldSeasons.map((s) => ({ id, s })) ).sort((a, b) => a.s.year - b.s.year);
      for (const { id, s } of rows) {
        const f = byId.get(id)!;
        lines.push(`- ${s.year}: ${f.num} · ${s.areaHa.toFixed(2)} ha · ${s.crop} · ${f.operator?.name ?? 'operaatorita'}${id === target ? '' : ` (põld #${id} liidetakse)`}`);
      }
      lines.push('');
    }
    if (conflicts.length) lines.push('**Eraldi jäetud:**', ...conflicts.map((c) => `- ${c}`), '');
  }
  const text = lines.join('\n');
  if (OUT) writeFileSync(OUT, text); else console.log(text);
  console.error(`Plaan: ${plan.length} gruppi, ${plan.reduce((s, p) => s + p.sourceIds.length, 0)} põldu liidetakse.`);

  if (!APPLY) return;
  for (const p of plan) {
    await db.$transaction(async (tx) => {
      for (const src of p.sourceIds) {
        const target = await tx.field.findUniqueOrThrow({ where: { id: p.targetId }, include: { warehouse: true } });
        const s = await tx.field.findUniqueOrThrow({ where: { id: src }, include: { warehouse: true, fieldSeasons: true } });
        // Hooaeg kannab selle aasta numbri ja operaatori
        for (const fs of s.fieldSeasons) {
          await tx.fieldSeason.update({ where: { id: fs.id }, data: { fieldId: p.targetId, num: fs.num ?? s.num, operatorId: fs.operatorId ?? s.operatorId } });
        }
        if (s.warehouse && !target.warehouse) await tx.warehouse.update({ where: { id: s.warehouse.id }, data: { fieldId: p.targetId } });
        else if (s.warehouse) await tx.warehouse.update({ where: { id: s.warehouse.id }, data: { fieldId: null } });
        // Täidame sihtpõllu tühjad põhiandmed liidetavast
        await tx.field.update({
          where: { id: p.targetId },
          data: {
            cadastralCode: target.cadastralCode ?? s.cadastralCode, soilType: target.soilType ?? s.soilType,
            notes: [target.notes, s.notes].filter(Boolean).join('\n') || null, drainageSystem: target.drainageSystem || s.drainageSystem
          }
        });
        await tx.field.delete({ where: { id: src } });
      }
    }, { timeout: 60_000 });
  }
  console.error('Liidetud.');
}

main().finally(() => db.$disconnect());
