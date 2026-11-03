// scripts/pria-crop-names-init.mts — kultuuride registri PRIA nimetused ja hooaegade üleviimine registri kultuurile.
// 1) registrist puuduvad hooaja kultuurid lisatakse registrisse; 2) registri PRIA nimetus (PRIA 2026 loetelu järgi
// või hooaegade andmetest); 3) hooaeg: kultuur = registri nimi, allakülv ja PRIA nimetus senisest pikast nimest.
// Täidab ainult tühje välju, korduvkäivitatav. Käivita: npx tsx scripts/pria-crop-names-init.mts
import { authDb, runAsTenant, tenantTransaction, type TxClient } from '../src/server/db.ts';
import { relinkSeasonCrops } from '../src/server/seasonCropLink.ts';
import { matchCrop, isUndeterminedCrop } from '../src/server/fieldWorkRules.ts';
import { derivePriaCropName, hasUndersowingVariant, parseUndersowing, stripUndersowing, type Undersowing } from '../src/services/priaCropName.ts';

type Rule = { priaName: string; priaUndersowing: boolean; NONE?: string; OTHER?: string; LEGUME?: string };
const undersown = (base: string): Rule => ({ priaName: base, priaUndersowing: true });

// PRIA põllumajanduskultuuride loetelu 2026 (pria.ee) — registri põhikultuurid
const PRIA_2026: Record<string, Rule> = {
  talinisu: undersown('Talinisu'),
  suvinisu: undersown('Suvinisu'),
  talioder: undersown('Talioder'),
  suvioder: undersown('Suvioder'),
  kaer: undersown('Kaer'),
  taliraps: undersown('Taliraps'),
  suviraps: undersown('Suviraps'),
  rukis: {
    priaName: 'Rukis, v.a "Sangaste" rukis', priaUndersowing: true,
    NONE: 'Rukis, v.a "Sangaste" rukis, allakülvita',
    OTHER: 'Rukis, v.a "Sangaste", allakülviga, v.a liblikõieliste allakülviga',
    LEGUME: 'Rukis, v.a "Sangaste", liblikõieliste allakülviga'
  },
  põlduba: { priaName: 'Muu põlduba', priaUndersowing: false },
  põldhernes: { priaName: 'Muu põldhernes (100% põldhernest)', priaUndersowing: false },
  rohttaimed: { priaName: 'Rohttaimed', priaUndersowing: false }
};

// Registrist puuduvad kultuurid (PRIA nimi → registri kultuur)
const NEW_CROPS: Record<string, { name: string; group: 'FORAGE_GRASS' | 'OTHER'; color: string; priaName: string }> = {
  'muu heintaimede segu': { name: 'Heintaimede segu', group: 'FORAGE_GRASS', color: '#65a30d', priaName: 'Muu heintaimede segu' },
  'liblikõieliste ja kõrreliste segu (30-80% liblikõielisi)': { name: 'Liblikõieliste-kõrreliste segu', group: 'FORAGE_GRASS', color: '#0d9488', priaName: 'Liblikõieliste ja kõrreliste segu (30-80% liblikõielisi)' },
  'kartul v.a "ando"': { name: 'Kartul', group: 'OTHER', color: '#a16207', priaName: 'Muu kartul' }
};

const VARIANT_FIELD = { NONE: 'priaNameWithoutUndersowing', OTHER: 'priaNameWithUndersowing', LEGUME: 'priaNameWithLegumeUndersowing' } as const;

async function initTenant(tx: TxClient) {
  const log: string[] = [];
  // 1) Puuduvad kultuurid
  let crops = await tx.crop.findMany({ select: { id: true, name: true } });
  const seasons = await tx.fieldSeason.findMany({ select: { id: true, year: true, crop: true, cropId: true } });
  for (const s of seasons) {
    if (s.cropId || isUndeterminedCrop(s.crop) || matchCrop(s.crop, crops)) continue;
    const spec = NEW_CROPS[s.crop.trim().toLowerCase()];
    if (!spec) { log.push(`sidumata jääb: ${s.crop}`); continue; }
    let crop = crops.find((c) => c.name === spec.name);
    if (!crop) {
      crop = await tx.crop.create({
        data: { id: `crop-${crypto.randomUUID()}`, name: spec.name, group: spec.group, color: spec.color, priaName: spec.priaName },
        select: { id: true, name: true }
      });
      crops = [...crops, crop];
      log.push(`registrisse lisatud: ${spec.name}`);
    }
    await tx.fieldSeason.update({ where: { id: s.id }, data: { cropId: crop.id } });
  }

  // 2) Registri PRIA nimetused (ainult puutumata kultuuridel)
  const all = await tx.crop.findMany({ include: { varieties: true } });
  const linked = await tx.fieldSeason.findMany({ select: { year: true, crop: true, cropId: true } });
  for (const c of all) {
    if (c.priaName || c.priaUndersowing) continue;
    let rule = PRIA_2026[c.name.trim().toLowerCase()];
    if (!rule) {
      // Hooaegade andmetest: viimase aasta PRIA nimi
      const texts = linked
        .filter((s) => (s.cropId === c.id || (!s.cropId && matchCrop(s.crop, all)?.id === c.id)) && s.crop.trim().toLowerCase() !== c.name.toLowerCase())
        .sort((a, b) => b.year - a.year);
      if (!texts.length) continue;
      const latest = texts[0].crop.trim();
      if (hasUndersowingVariant(latest)) {
        const r: Rule = { priaName: stripUndersowing(latest), priaUndersowing: true };
        const seen = new Set<Undersowing>();
        for (const t of texts) { // uusim enne: iga allakülvi variandi kohta viimane nimi
          const u = parseUndersowing(t.crop);
          if (seen.has(u)) continue;
          seen.add(u);
          if (derivePriaCropName({ name: c.name, ...r }, null, u) !== t.crop.trim()) r[u] = t.crop.trim();
        }
        rule = r;
      } else {
        rule = { priaName: latest, priaUndersowing: false };
      }
    }
    await tx.crop.update({
      where: { id: c.id },
      data: {
        priaName: rule.priaName, priaUndersowing: rule.priaUndersowing,
        ...Object.fromEntries((['NONE', 'OTHER', 'LEGUME'] as Undersowing[]).filter((u) => rule[u]).map((u) => [VARIANT_FIELD[u], rule[u]]))
      }
    });
    log.push(`PRIA nimetus: ${c.name} → ${rule.priaName}${rule.priaUndersowing ? ' (+ allakülv)' : ''}`);
  }

  // 3) Hooajad
  log.push(`hooaegu üle viidud: ${await relinkSeasonCrops(tx)}`);
  return log;
}

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const log = await tenantTransaction((tx) => initTenant(tx), { timeout: 120000 });
    console.log(`${t.name}:\n  ${log.join('\n  ')}`);
  });
}

// Platvormi algkataloog (uued ettevõtted)
for (const c of await authDb().catalogCrop.findMany()) {
  const rule = PRIA_2026[c.name.trim().toLowerCase()];
  if (!rule || c.priaName) continue;
  await authDb().catalogCrop.update({ where: { id: c.id }, data: { priaName: rule.priaName, priaUndersowing: rule.priaUndersowing } });
  console.log(`kataloog: ${c.name} → ${rule.priaName}`);
}
await authDb().$disconnect();
process.exit(0);
