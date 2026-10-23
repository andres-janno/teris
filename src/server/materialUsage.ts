// src/server/materialUsage.ts — kulumaterjalide hooaja kogused: planeeritud (plaaniread) ja kasutatud (kanderead)
export interface PlanLineInput {
  materialId: string | null;
  ratePerHa: number | null;
  areaHa: number; // töö planeeritud pindala, puudumisel põllu hooaja pindala
}
export interface EntryLineInput {
  materialId: string | null;
  quantity: number;
}
export interface MaterialTotals {
  plannedQty: number;
  usedQty: number;
  entryCount: number; // hooaja kanderidade arv selle materjaliga
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function materialSeasonTotals(planLines: PlanLineInput[], entryLines: EntryLineInput[]): Map<string, MaterialTotals> {
  const raw = new Map<string, MaterialTotals>();
  const slot = (id: string) => {
    let t = raw.get(id);
    if (!t) raw.set(id, (t = { plannedQty: 0, usedQty: 0, entryCount: 0 }));
    return t;
  };
  for (const l of planLines) {
    if (!l.materialId || l.ratePerHa == null) continue;
    slot(l.materialId).plannedQty += l.ratePerHa * l.areaHa;
  }
  for (const l of entryLines) {
    if (!l.materialId) continue;
    const t = slot(l.materialId);
    t.usedQty += l.quantity;
    t.entryCount++;
  }
  const out = new Map<string, MaterialTotals>();
  for (const [id, t] of raw) out.set(id, { plannedQty: round2(t.plannedQty), usedQty: round2(t.usedQty), entryCount: t.entryCount });
  return out;
}
