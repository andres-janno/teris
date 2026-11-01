// src/server/articleUsage.ts — kulumaterjalide hooaja kogused: planeeritud (plaaniread) ja kasutatud (kanderead)
export interface PlanLineInput {
  articleId: string | null;
  ratePerHa: number | null;
  areaHa: number; // töö planeeritud pindala, puudumisel põllu hooaja pindala
}
export interface EntryLineInput {
  articleId: string | null;
  quantity: number;
}
export interface ArticleTotals {
  plannedQty: number;
  usedQty: number;
  entryCount: number; // hooaja kanderidade arv selle materjaliga
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function articleSeasonTotals(planLines: PlanLineInput[], entryLines: EntryLineInput[]): Map<string, ArticleTotals> {
  const raw = new Map<string, ArticleTotals>();
  const slot = (id: string) => {
    let t = raw.get(id);
    if (!t) raw.set(id, (t = { plannedQty: 0, usedQty: 0, entryCount: 0 }));
    return t;
  };
  for (const l of planLines) {
    if (!l.articleId || l.ratePerHa == null) continue;
    slot(l.articleId).plannedQty += l.ratePerHa * l.areaHa;
  }
  for (const l of entryLines) {
    if (!l.articleId) continue;
    const t = slot(l.articleId);
    t.usedQty += l.quantity;
    t.entryCount++;
  }
  const out = new Map<string, ArticleTotals>();
  for (const [id, t] of raw) out.set(id, { plannedQty: round2(t.plannedQty), usedQty: round2(t.usedQty), entryCount: t.entryCount });
  return out;
}
