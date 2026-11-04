// scripts/cadastral-sync-from-year.mts — põldude katastriüksuste seosed kõigis teistes hooaegades (ka lukus) lähteaasta järgi:
// sama üksus, pindala, omanik ja omandivorm. Rent ja maamaks kopeeritakse alates aastast KEEP_FEES_FROM, varasematel tühjad.
// Põld, millel lähteaastat pole, jääb puutumata. Käivita: npx tsx scripts/cadastral-sync-from-year.mts 2026 2025 [--field=<id>] [--apply]
import { authDb, runAsTenant, tenantTransaction } from "../src/server/db.ts";
import { buildCopiedParcelLink } from "../src/server/fieldSeasonCopy.ts";

const SOURCE_YEAR = Number(process.argv[2]);
const KEEP_FEES_FROM = Number(process.argv[3]);
const APPLY = process.argv.includes("--apply");
const FIELD_ID = Number(process.argv.find((a) => a.startsWith("--field="))?.slice(8)) || null; // ainult see põld
if (!SOURCE_YEAR || !KEEP_FEES_FROM) throw new Error("Kasutus: <lähteaasta> <rent alates aastast> [--apply]");

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  const r = await runAsTenant(t.id, () => tenantTransaction(async (tx) => {
    const fields = await tx.field.findMany({
      where: { fieldSeasons: { some: { year: SOURCE_YEAR } }, ...(FIELD_ID ? { id: FIELD_ID } : {}) },
      select: { id: true, fieldSeasons: { select: { id: true, year: true, cadastralParcels: { orderBy: { id: "asc" } } } } }
    });
    let seasons = 0, removed = 0, created = 0;
    for (const f of fields) {
      const src = f.fieldSeasons.find((s) => s.year === SOURCE_YEAR)!;
      for (const s of f.fieldSeasons.filter((x) => x.year !== SOURCE_YEAR)) {
        const keepFees = s.year >= KEEP_FEES_FROM;
        const data = src.cadastralParcels.map((l) => ({
          ...buildCopiedParcelLink(l, s.id),
          ...(keepFees ? {} : { landTaxEurHa: null, landTaxEurYear: null, rentFeeEurHa: null, rentFeeEurYear: null })
        }));
        seasons++;
        removed += s.cadastralParcels.length;
        created += data.length;
        if (!APPLY) continue;
        await tx.fieldCadastralParcel.deleteMany({ where: { fieldSeasonId: s.id } });
        if (data.length) await tx.fieldCadastralParcel.createMany({ data });
      }
    }
    return { fields: fields.length, seasons, removed, created };
  }, { timeout: 300000 }));
  if (r.fields) console.log(`${t.name}: põlde ${r.fields}, hooajakirjeid ${r.seasons}, eemaldatud seoseid ${r.removed}, loodud ${r.created}${APPLY ? "" : " (proovijooks)"}`);
}
await authDb().$disconnect();
process.exit(0);
