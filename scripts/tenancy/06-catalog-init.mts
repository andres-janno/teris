// scripts/tenancy/06-catalog-init.mts — täidab algkataloogi Loisu Agro praegustest kultuuridest,
// sortidest, tööliikidest ja mallidest. Korduvkäivitatav: kui kataloog pole tühi, ei muuda midagi.
// Käivita serveris (PLATFORM_DATABASE_URL keskkonnast): npx tsx scripts/tenancy/06-catalog-init.mts
import { authDb } from '../../src/server/db.ts';

const TENANT_ID = 'tenant-loisu-agro';

// Kopeeritavatest ridadest jäetakse välja identiteet, ettevõte ja audit.
function strip<T extends Record<string, unknown>>(row: T) {
  const { id, tenantId, createdAt, updatedAt, createdBy, updatedBy, ...rest } = row;
  return rest;
}

const db = authDb();
try {
  const message = await db.$transaction(async (tx) => {
    if ((await tx.catalogCrop.count()) > 0 || (await tx.catalogWorkType.count()) > 0) {
      return 'Algkataloog on juba olemas — midagi ei muudetud';
    }

    const cropMap = new Map<string, string>();
    const crops = await tx.crop.findMany({ where: { tenantId: TENANT_ID }, orderBy: { name: 'asc' } });
    for (const c of crops) {
      const created = await tx.catalogCrop.create({ data: strip(c) });
      cropMap.set(c.id, created.id);
    }

    const varieties = await tx.cropVariety.findMany({ where: { tenantId: TENANT_ID }, orderBy: { name: 'asc' } });
    for (const v of varieties) {
      const { cropId, ...rest } = strip(v);
      const catalogCropId = cropMap.get(cropId);
      if (!catalogCropId) throw new Error(`Sordi "${v.name}" kultuur puudub kaardistusest`);
      await tx.catalogCropVariety.create({ data: { ...rest, catalogCropId } });
    }

    const typeMap = new Map<string, string>();
    const workTypes = await tx.workType.findMany({ where: { tenantId: TENANT_ID }, orderBy: { sortOrder: 'asc' } });
    for (const w of workTypes) {
      const created = await tx.catalogWorkType.create({ data: strip(w) });
      typeMap.set(w.id, created.id);
    }

    let itemCount = 0;
    const templates = await tx.workTemplate.findMany({
      where: { tenantId: TENANT_ID },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });
    for (const t of templates) {
      let catalogCropId: string | null = null;
      if (t.cropId) {
        catalogCropId = cropMap.get(t.cropId) ?? null;
        if (!catalogCropId) throw new Error('Malli kultuur puudub kaardistusest');
      }
      const created = await tx.catalogWorkTemplate.create({ data: { catalogCropId, isWinter: t.isWinter } });
      for (const item of t.items) {
        const { templateId, workTypeId, ...rest } = strip(item);
        const catalogWorkTypeId = typeMap.get(workTypeId);
        if (!catalogWorkTypeId) throw new Error('Malli rea tööliik puudub kaardistusest');
        await tx.catalogWorkTemplateItem.create({ data: { ...rest, templateId: created.id, catalogWorkTypeId } });
        itemCount++;
      }
    }

    return `Kultuure ${crops.length}, sorte ${varieties.length}, tööliike ${workTypes.length}, malle ${templates.length} (ridu ${itemCount})`;
  });
  console.log(message);
} catch (err) {
  console.error('Algkataloogi täitmine ebaõnnestus:', err);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
