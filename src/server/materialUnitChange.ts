// src/server/materialUnitChange.ts — kulumaterjali ühiku muutmine teisendusteguriga (1 vana ühik = factor uut ühikut).
// Laokande read on alati materjali ühikus ja teisendatakse kõik; kande- ja plaaniread ainult vanas ühikus olevad
// (muus ühikus read teisendatakse laoarvestuses nagu varemgi). Rahaline väärtus ei muutu: ühikuhind jagatakse teguriga.
import type { TxClient } from './db.ts';
import { recomputeMaterialStock } from './stock.ts';

const norm = (u: string) => u.trim().toLowerCase();
const scale = (n: number | null, f: number) => (n == null ? null : Math.round(n * f * 1e9) / 1e9);

export async function changeMaterialUnit(tx: TxClient, materialId: string, fromUnit: string, toUnit: string, factor: number): Promise<void> {
  if (!(factor > 0)) throw new Error('Teisendustegur peab olema positiivne');

  const docLines = await tx.stockDocumentLine.findMany({ where: { materialId }, select: { id: true, quantity: true, shortageQty: true } });
  for (const l of docLines) {
    await tx.stockDocumentLine.update({ where: { id: l.id }, data: { quantity: scale(l.quantity, factor)!, shortageQty: scale(l.shortageQty, factor) } });
  }

  const entryLines = await tx.workEntryLine.findMany({
    where: { materialId, kind: 'MATERIAL' },
    select: { id: true, unit: true, quantity: true, ratePerHa: true, confirmedQuantity: true, unitPrice: true }
  });
  for (const l of entryLines.filter((x) => norm(x.unit) === norm(fromUnit))) {
    await tx.workEntryLine.update({
      where: { id: l.id },
      data: {
        unit: toUnit,
        quantity: scale(l.quantity, factor)!,
        ratePerHa: scale(l.ratePerHa, factor),
        confirmedQuantity: scale(l.confirmedQuantity, factor),
        unitPrice: l.unitPrice == null ? null : l.unitPrice.div(factor).toDecimalPlaces(4)
      }
    });
  }

  const planLines = await tx.fieldWorkLine.findMany({ where: { materialId }, select: { id: true, unit: true, ratePerHa: true } });
  for (const l of planLines.filter((x) => norm(x.unit) === norm(fromUnit))) {
    await tx.fieldWorkLine.update({ where: { id: l.id }, data: { unit: toUnit, ratePerHa: scale(l.ratePerHa, factor) } });
  }

  await tx.material.update({ where: { id: materialId }, data: { unit: toUnit } });
  await recomputeMaterialStock(tx, [materialId]);
}
