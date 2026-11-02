// src/server/entryArticles.ts — kanderidade artiklid: tööaja vaikimisi teenused, ressursi (töötaja, masin,
// haakeriist) teenus ja tunnihind, kande kütuseartikkel ning ressursi vormi teenuse/hinna sisend.
import { prisma, type TxClient } from './db.ts';
import { systemCategoryId } from './articleCategories.ts';
import type { ServiceChoice } from './fieldWorkRules.ts';
import {
  SERVICE_TIME_KINDS, SYSTEM_CATEGORIES, articleAllowedOnLine, pickServicePrice, pickFuelArticleId,
  type ArticleLineKind, type ArticleSystemKind
} from '../services/articleRules.ts';

const num = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

/** Tööaja liikide vaikimisi teenusartiklid (luuakse puudumisel: liigi süsteemne nimi, ühik h, hind tühi). */
export async function ensureDefaultServices(tx: TxClient): Promise<Map<ArticleSystemKind, { id: string; price: number | null }>> {
  const load = () => tx.article.findMany({
    where: { isDefaultService: true, category: { systemKind: { in: SERVICE_TIME_KINDS } } },
    select: { id: true, price: true, category: { select: { systemKind: true } } }
  });
  let rows = await load();
  if (rows.length < SERVICE_TIME_KINDS.length) {
    // Loomine serialiseeritakse ettevõtte piires (nagu põhiladu); lukk vabaneb tehingu lõpus
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('default-service:' || current_setting('app.tenant_id')))`;
    rows = await load();
    for (const kind of SERVICE_TIME_KINDS) {
      if (rows.some((r) => r.category.systemKind === kind)) continue;
      const categoryId = await systemCategoryId(tx, kind);
      const name = SYSTEM_CATEGORIES.find((c) => c.systemKind === kind)!.name;
      // Sama nimega teenus liigis (nt kasutaja loodud) saab vaikimisi teenuseks
      const same = await tx.article.findFirst({ where: { categoryId, name }, select: { id: true } });
      if (same) await tx.article.update({ where: { id: same.id }, data: { isDefaultService: true } });
      else await tx.article.create({ data: { name, categoryId, unit: 'h', isDefaultService: true } });
    }
    rows = await load();
  }
  return new Map(rows.map((r) => [r.category.systemKind!, { id: r.id, price: num(r.price) }]));
}

export interface EntryArticles {
  laborService: ServiceChoice | null;
  machineService: ServiceChoice | null;
  implementService: ServiceChoice | null;
  fuelArticle: { id: string; name: string } | null;
}

type CostResource = { hourlyRate: unknown; serviceArticle: { id: string; price: unknown } | null } | null;

function chooseService(resource: CostResource, fallback: { id: string; price: number | null } | undefined): ServiceChoice | null {
  const own = resource?.serviceArticle ?? null;
  const articleId = own?.id ?? fallback?.id;
  if (!articleId) return null;
  return { articleId, price: pickServicePrice(num(resource?.hourlyRate), num(own?.price), fallback?.price ?? null) };
}

/** Kande tööaja ridade teenused (koos pakutud hinnaga) ja kütuseartikkel. */
export async function loadEntryArticles(
  tx: TxClient,
  ids: { workerId: string | null; vehicleId: string | null; implementId: string | null }
): Promise<EntryArticles> {
  const defaults = await ensureDefaultServices(tx);
  const cost = { hourlyRate: true, serviceArticle: { select: { id: true, price: true } } } as const;
  const worker = ids.workerId ? await tx.relatedParty.findUnique({ where: { id: ids.workerId }, select: cost }) : null;
  const vehicle = ids.vehicleId ? await tx.vehicle.findUnique({ where: { id: ids.vehicleId }, select: { ...cost, fuelArticleId: true } }) : null;
  const implement = ids.implementId ? await tx.implement.findUnique({ where: { id: ids.implementId }, select: cost }) : null;
  const fuels = await tx.article.findMany({ where: { isActive: true, category: { systemKind: 'FUEL' } }, select: { id: true, name: true } });
  const fuelId = pickFuelArticleId(vehicle?.fuelArticleId ?? null, fuels.map((f) => f.id));
  const fuelArticle = fuelId
    ? fuels.find((f) => f.id === fuelId) ?? (await tx.article.findUnique({ where: { id: fuelId }, select: { id: true, name: true } }))
    : null;
  return {
    laborService: chooseService(worker, defaults.get('LABOR_TIME')),
    machineService: chooseService(vehicle, defaults.get('MACHINE_TIME')),
    implementService: chooseService(implement, defaults.get('IMPLEMENT_TIME')),
    fuelArticle
  };
}

/** Kontrollib, et iga rea artikkel sobib rea liigiga; tagastab veateate või null. */
export async function articleLineError(lines: { kind: ArticleLineKind; articleId: string | null }[]): Promise<string | null> {
  const ids = [...new Set(lines.map((l) => l.articleId).filter((id): id is string => !!id))];
  if (!ids.length) return null;
  const rows = await prisma.article.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, category: { select: { group: true, systemKind: true } } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const l of lines) {
    if (l.articleId && !byId.has(l.articleId)) return 'Artiklit ei leitud';
    const a = l.articleId ? byId.get(l.articleId) : null;
    if (a && !articleAllowedOnLine(l.kind, a.category)) return `Artikkel „${a.name}“ ei sobi sellele reale`;
  }
  return null;
}

const idIn = (v: unknown): string | null => {
  const s = String(v ?? '').trim().slice(0, 64);
  return s || null;
};

/**
 * Ressursi vormi teenus, tunnihind ja (masinal) kütus. Väli muutub ainult siis, kui võti on kehas;
 * tunnihinda muudab ainult finantsõigusega kasutaja (muidu jääb vana hind alles).
 */
export async function resourceCostIn(
  b: any,
  kind: 'LABOR' | 'MACHINE' | 'IMPLEMENT',
  withFuel: boolean,
  finance: boolean
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const data: Record<string, unknown> = {};
  const checks: { kind: ArticleLineKind; articleId: string | null }[] = [];
  if (b && 'serviceArticleId' in b) {
    data.serviceArticleId = idIn(b.serviceArticleId);
    checks.push({ kind, articleId: data.serviceArticleId as string | null });
  }
  if (withFuel && b && 'fuelArticleId' in b) {
    data.fuelArticleId = idIn(b.fuelArticleId);
    checks.push({ kind: 'FUEL', articleId: data.fuelArticleId as string | null });
  }
  const err = await articleLineError(checks);
  if (err) return { error: err };
  if (finance && b && 'hourlyRate' in b) {
    const raw = b.hourlyRate;
    const rate = raw === null || raw === undefined || raw === '' ? null : Number(String(raw).replace(',', '.'));
    if (rate !== null && !(Number.isFinite(rate) && rate >= 0 && rate < 100000000)) return { error: 'Hind peab olema 0 või suurem' };
    data.hourlyRate = rate;
  }
  return { data };
}

/** Ressursi teenuse väljad API vastuses; tunnihind ainult finantsõigusega. */
export function resourceCostOut(
  row: { serviceArticleId: string | null; hourlyRate: unknown; fuelArticleId?: string | null },
  finance: boolean
): { serviceArticleId: string | null; hourlyRate?: number | null; fuelArticleId?: string | null } {
  return {
    serviceArticleId: row.serviceArticleId,
    ...(finance ? { hourlyRate: num(row.hourlyRate) } : {}),
    ...('fuelArticleId' in row ? { fuelArticleId: row.fuelArticleId ?? null } : {})
  };
}
