// Algkataloogi kopeerimise test: kõik toimub tehingus, mis lõpuks sentinel-veaga tagasi pööratakse.
import { describe, it, expect } from 'vitest';
import { authDb } from './db';
import { copyCatalogToTenant } from './catalog';

class Rollback extends Error {}
const T = `test-catalog-${process.pid}`;

async function inRollbackTx(fn: (tx: Parameters<Parameters<ReturnType<typeof authDb>['$transaction']>[0]>[0]) => Promise<void>) {
  await expect(
    authDb().$transaction(async (tx) => {
      await tx.tenant.create({ data: { id: T, name: `Katalooginäidis ${process.pid}` } });
      await fn(tx);
      throw new Rollback();
    }, { timeout: 30000 })
  ).rejects.toBeInstanceOf(Rollback);
}

describe('copyCatalogToTenant', () => {
  it('kopeerib kataloogi uuele ettevõttele uute ID-dega ja õigete viidetega', async () => {
    await inRollbackTx(async (tx) => {
      const [cc, cv, cw, ct, ci] = await Promise.all([
        tx.catalogCrop.count(), tx.catalogCropVariety.count(), tx.catalogWorkType.count(),
        tx.catalogWorkTemplate.count(), tx.catalogWorkTemplateItem.count()
      ]);
      const otherCropIds = new Set((await tx.crop.findMany({ select: { id: true } })).map((c) => c.id));
      const res = await copyCatalogToTenant(tx, T);
      expect(res).toEqual({ crops: cc, varieties: cv, workTypes: cw, templates: ct, items: ci });
      const where = { tenantId: T };
      const crops = await tx.crop.findMany({ where });
      const varieties = await tx.cropVariety.findMany({ where });
      const types = await tx.workType.findMany({ where });
      const templates = await tx.workTemplate.findMany({ where });
      const items = await tx.workTemplateItem.findMany({ where });
      expect([crops.length, varieties.length, types.length, templates.length, items.length]).toEqual([cc, cv, cw, ct, ci]);
      for (const c of crops) {
        expect(c.id.startsWith('crop-')).toBe(true);
        expect(otherCropIds.has(c.id)).toBe(false);
      }
      const cropIds = new Set(crops.map((c) => c.id));
      const typeIds = new Set(types.map((w) => w.id));
      for (const v of varieties) expect(cropIds.has(v.cropId)).toBe(true);
      for (const t of templates) expect(t.cropId === null || cropIds.has(t.cropId)).toBe(true);
      for (const i of items) expect(typeIds.has(i.workTypeId)).toBe(true);
      const cat = await tx.catalogCrop.findMany();
      for (const c of cat) {
        const copy = crops.find((x) => x.name === c.name);
        expect(copy?.isWinterCrop).toBe(c.isWinterCrop);
      }
    });
  });

  it('tühja kataloogiga tagastab nullid', async () => {
    await inRollbackTx(async (tx) => {
      await tx.catalogWorkTemplateItem.deleteMany();
      await tx.catalogWorkTemplate.deleteMany();
      await tx.catalogWorkType.deleteMany();
      await tx.catalogCropVariety.deleteMany();
      await tx.catalogCrop.deleteMany();
      expect(await copyCatalogToTenant(tx, T)).toEqual({ crops: 0, varieties: 0, workTypes: 0, templates: 0, items: 0 });
    });
  });
});
