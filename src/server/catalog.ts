// src/server/catalog.ts — algkataloogi kopeerimine uue ettevõtte keskkonda.
// Kutsutakse platvormi rollis (authDb) ettevõtte loomise tehingus: tenantId antakse
// igal real selgesõnaliselt; uued ID-d, mallid seotakse uute kultuuride/tööliikidega.
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

const CATALOG_CHANGED = 'Algkataloog muutus kopeerimise ajal';

export async function copyCatalogToTenant(tx: Prisma.TransactionClient, tenantId: string) {
  const crops = await tx.catalogCrop.findMany({ include: { varieties: true }, orderBy: { name: 'asc' } });
  const workTypes = await tx.catalogWorkType.findMany({ orderBy: { sortOrder: 'asc' } });
  const templates = await tx.catalogWorkTemplate.findMany({ include: { items: true } });
  const cropIds = new Map<string, string>();
  let varieties = 0;
  for (const c of crops) {
    const id = `crop-${randomUUID()}`;
    cropIds.set(c.id, id);
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
  const typeIds = new Map<string, string>();
  for (const w of workTypes) {
    const created = await tx.workType.create({
      data: {
        tenantId, name: w.name, phase: w.phase, repeatMode: w.repeatMode, maxRepeats: w.maxRepeats,
        intervalDays: w.intervalDays, usesMaterials: w.usesMaterials, sortOrder: w.sortOrder, isActive: w.isActive
      }
    });
    typeIds.set(w.id, created.id);
  }
  let items = 0;
  for (const t of templates) {
    const cropId = t.catalogCropId ? cropIds.get(t.catalogCropId) : null;
    if (cropId === undefined) throw new Error(CATALOG_CHANGED);
    const created = await tx.workTemplate.create({ data: { tenantId, cropId, isWinter: t.isWinter } });
    for (const it of t.items) {
      const workTypeId = typeIds.get(it.catalogWorkTypeId);
      if (workTypeId === undefined) throw new Error(CATALOG_CHANGED);
      await tx.workTemplateItem.create({
        data: {
          tenantId, templateId: created.id, workTypeId,
          sortOrder: it.sortOrder, typicalTiming: it.typicalTiming, plannedCount: it.plannedCount
        }
      });
      items++;
    }
  }
  return { crops: crops.length, varieties, workTypes: workTypes.length, templates: templates.length, items };
}
