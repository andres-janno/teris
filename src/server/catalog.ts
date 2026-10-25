// src/server/catalog.ts — algkataloogi kopeerimine uue ettevõtte keskkonda.
// Kutsutakse platvormi rollis (authDb) ettevõtte loomise tehingus: tenantId antakse
// igal real selgesõnaliselt; uued ID-d. Tööde malle ei kopeerita (funktsioon eemaldatud).
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export async function copyCatalogToTenant(tx: Prisma.TransactionClient, tenantId: string) {
  const crops = await tx.catalogCrop.findMany({ include: { varieties: true }, orderBy: { name: 'asc' } });
  const workTypes = await tx.catalogWorkType.findMany({ orderBy: { sortOrder: 'asc' } });
  let varieties = 0;
  for (const c of crops) {
    const id = `crop-${randomUUID()}`;
    await tx.crop.create({
      data: {
        id, tenantId, name: c.name, scientificName: c.scientificName, group: c.group, color: c.color,
        icon: c.icon, priaCode: c.priaCode, defaultSeedRateKgHa: c.defaultSeedRateKgHa,
        defaultYieldTonsHa: c.defaultYieldTonsHa, description: c.description, isWinterCrop: c.isWinterCrop
      }
    });
    for (const v of c.varieties) {
      await tx.cropVariety.create({
        data: {
          id: `variety-${randomUUID()}`, tenantId, cropId: id, name: v.name, breeder: v.breeder,
          maturityDays: v.maturityDays, winterHardiness: v.winterHardiness,
          recommendedSeedRateKgHa: v.recommendedSeedRateKgHa, potentialYieldTonsHa: v.potentialYieldTonsHa,
          qualityClass: v.qualityClass, notes: v.notes, isActive: v.isActive
        }
      });
      varieties++;
    }
  }
  for (const w of workTypes) {
    await tx.workType.create({
      data: {
        tenantId, name: w.name, priaCode: w.priaCode, phase: w.phase, repeatMode: w.repeatMode, maxRepeats: w.maxRepeats,
        intervalDays: w.intervalDays, usesMaterials: w.usesMaterials, sortOrder: w.sortOrder, isActive: w.isActive
      }
    });
  }
  return { crops: crops.length, varieties, workTypes: workTypes.length };
}
