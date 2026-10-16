// Ettevõtete eraldus: kaks ajutist ettevõtet (A, B) live-andmebaasis; kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { TENANT_MODELS } from './tenantScope';
import { MissingTenantError } from './requestContext';
import { tenantRelations } from './tenantRelations';

const A = `test-tenant-a-${process.pid}`;
const B = `test-tenant-b-${process.pid}`;
const LOISU = 'tenant-loisu-agro';
const tableOf = (model: string) => Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.dbName!;
let bCropId = '';

beforeAll(async () => {
  await authDb().tenant.createMany({ data: [{ id: A, name: 'Test A' }, { id: B, name: 'Test B' }] });
  bCropId = await runAsTenant(B, async () => (await prisma.crop.create({ data: { id: `crop-${B}`, name: 'B kaer' } })).id);
  await runAsTenant(A, async () => await prisma.crop.create({ data: { id: `crop-${A}`, name: 'A kaer' } }));
});

afterAll(async () => {
  for (const t of [A, B]) {
    await runAsTenant(t, async () => await prisma.crop.deleteMany({})).catch((e) => console.error('Testi puhastus ebaõnnestus', t, e));
  }
  await authDb().tenant.deleteMany({ where: { id: { in: [A, B] } } });
});

describe('ettevõtete eraldus', () => {
  it('uus ettevõte näeb kõiki ettevõttepõhiseid tabeleid tühjana (RLS, toorpäring)', async () => {
    await runAsTenant(A, async () => await tenantTransaction(async (tx) => {
      for (const model of TENANT_MODELS) {
        const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "${tableOf(model)}" WHERE tenant_id <> $1`, A);
        expect(n, model).toBe(0n);
      }
    }));
  });

  it('kõigil ettevõttepõhistel tabelitel on sunnitud RLS ja tenant_isolation poliitika', async () => {
    await runAsTenant(A, async () => await tenantTransaction(async (tx) => {
      for (const model of TENANT_MODELS) {
        const table = tableOf(model);
        const [cls] = await tx.$queryRawUnsafe<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
          'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = to_regclass($1)', `public."${table}"`);
        expect(cls?.relrowsecurity, `${table}: RLS sisse lülitamata`).toBe(true);
        expect(cls?.relforcerowsecurity, `${table}: FORCE RLS puudub`).toBe(true);
        const pol = await tx.$queryRawUnsafe<{ qual: string | null; with_check: string | null }[]>(
          `SELECT qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = $1 AND policyname = 'tenant_isolation'`, table);
        expect(pol, `${table}: tenant_isolation poliitika puudub`).toHaveLength(1);
        expect(pol[0].qual, `${table}: USING ei viita app.tenant_id-le`).toContain("current_setting('app.tenant_id'");
        expect(pol[0].with_check, `${table}: WITH CHECK ei viita app.tenant_id-le`).toContain("current_setting('app.tenant_id'");
      }
    }));
  });

  it('rakenduse roll ei saa RLS-i mööda minna', async () => {
    await runAsTenant(A, async () => await tenantTransaction(async (tx) => {
      const [r] = await tx.$queryRawUnsafe<{ rolbypassrls: boolean; rolsuper: boolean }[]>(
        'SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user');
      expect(r.rolbypassrls).toBe(false);
      expect(r.rolsuper).toBe(false);
    }));
  });

  it('Loisu Agro näeb oma andmeid', async () => {
    await runAsTenant(LOISU, async () => {
      expect(await prisma.field.count()).toBeGreaterThan(0);
      expect(await prisma.crop.count({ where: { id: bCropId } })).toBe(0);
    });
  });

  it('A ei leia B kirjet ka ID järgi', async () => {
    await runAsTenant(A, async () => {
      expect(await prisma.crop.findUnique({ where: { id: bCropId } })).toBeNull();
      expect(await prisma.crop.findMany()).toHaveLength(1);
    });
  });

  it('RLS üksi peidab B kirje A eest (toorpäring), B näeb seda', async () => {
    const count = (t: string) => runAsTenant(t, async () => await tenantTransaction(async (tx) =>
      (await tx.$queryRawUnsafe<{ n: bigint }[]>('SELECT count(*) AS n FROM crops WHERE id = $1', bCropId))[0].n));
    expect(await count(A)).toBe(0n);
    expect(await count(B)).toBe(1n);
  });

  it('A ei saa B kirjet muuta ega kustutada', async () => {
    await runAsTenant(A, async () => {
      expect((await prisma.crop.updateMany({ where: { id: bCropId }, data: { name: 'häkitud' } })).count).toBe(0);
      expect((await prisma.crop.deleteMany({ where: { id: bCropId } })).count).toBe(0);
      await expect(prisma.crop.update({ where: { id: bCropId }, data: { name: 'häkitud' } })).rejects.toMatchObject({ code: 'P2025' });
    });
    const b = await runAsTenant(B, async () => await prisma.crop.findUnique({ where: { id: bCropId } }));
    expect(b?.name).toBe('B kaer');
  });

  it('RLS keelab kirjutada teise ettevõtte ID-ga ka toorpäringuga', async () => {
    await runAsTenant(A, async () => {
      await expect(tenantTransaction(async (tx) =>
        await tx.$executeRawUnsafe(`INSERT INTO crops (id, name, tenant_id, "updatedAt") VALUES ('x-${A}', 'x', $1, now())`, B)
      )).rejects.toThrow(/row-level security/);
    });
  });

  it('pesastatud loomine saab ettevõtte andmebaasi vaikeväärtusest', async () => {
    await runAsTenant(A, async () => {
      const crop = await prisma.crop.create({
        data: { id: `nested-${A}`, name: 'Pesastatud', varieties: { create: [{ id: `var-${A}`, name: 'Sort 1' }] } },
        include: { varieties: true }
      });
      const raw = await tenantTransaction(async (tx) => await tx.$queryRawUnsafe<{ tenant_id: string }[]>(
        'SELECT tenant_id FROM crop_varieties WHERE "cropId" = $1', crop.id));
      expect(raw.map((r) => r.tenant_id)).toEqual([A]);
      await prisma.cropVariety.deleteMany({ where: { cropId: crop.id } });
    });
  });

  it('ilma ettevõtteta päring viskab', async () => {
    await expect(prisma.field.findMany()).rejects.toThrow(MissingTenantError);
  });
});

describe('platvormi tabelid rakenduse rollile', () => {
  it.each(['tenants', 'tenant_licenses', 'sessions', 'password_tokens'])('%s pole teris_app-ile loetav', async (table) => {
    await runAsTenant(LOISU, async () => {
      await expect(tenantTransaction(async (tx) => tx.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`)))
        .rejects.toThrow(/permission denied/);
    });
  });
});

describe('ettevõtteülesed viited', () => {
  it('A ei saa luua rida, mis viitab Loisu reale', async () => {
    const loisuField = await runAsTenant(LOISU, async () => await prisma.field.findFirst({ select: { id: true } }));
    expect(loisuField).not.toBeNull();
    await runAsTenant(A, async () => {
      await expect(prisma.fieldSeason.create({ data: { fieldId: loisuField!.id, year: 2099, areaHa: 1, crop: 'test', geometry: {} } }))
        .rejects.toThrow(/teise ettevõtte/);
    });
  });

  it('A ei saa oma rida ümber viia Loisu reale (UPDATE)', async () => {
    const loisuField = await runAsTenant(LOISU, async () => await prisma.field.findFirst({ select: { id: true } }));
    await runAsTenant(A, async () => {
      const f = await prisma.field.create({ data: { num: 't', name: 't', fieldCode: 't' } });
      try {
        const fs = await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2099, areaHa: 1, crop: 'test', geometry: {} } });
        await expect(prisma.fieldSeason.update({ where: { id: fs.id }, data: { fieldId: loisuField!.id } }))
          .rejects.toThrow(/teise ettevõtte/);
      } finally {
        await prisma.fieldSeason.deleteMany({});
        await prisma.field.deleteMany({});
      }
    });
  });

  it('platvormi roll (RLS-ita) ei saa luua ettevõtteülest viidet', async () => {
    const loisuField = await runAsTenant(LOISU, async () => await prisma.field.findFirst({ select: { id: true } }));
    await expect(authDb().fieldSeason.create({ data: { tenantId: A, fieldId: loisuField!.id, year: 2099, areaHa: 1, crop: 'test', geometry: {} } }))
      .rejects.toThrow(/teise ettevõtte/);
  });

  it('igal ettevõttesisesel relatsioonil on triger', async () => {
    const expected = tenantRelations().map((r) => `${r.table}.tenant_fk_${r.column}`).sort();
    const rows = await authDb().$queryRawUnsafe<{ t: string }[]>(
      `SELECT c.relname || '.' || tg.tgname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid WHERE tg.tgname LIKE 'tenant_fk_%' AND NOT tg.tgisinternal`);
    expect(rows.map((r) => r.t).sort()).toEqual(expected);
  });
});

describe('muutmine ja kustutamine iga mudeli kohta', () => {
  // Tehing pööratakse alati tagasi — ka siis, kui RLS peaks katki olema, ei kustu ühtki rida.
  class Rollback extends Error {}
  it('A ei muuda ega kustuta ühtki Loisu rida üheski ettevõttepõhises tabelis', async () => {
    const counts: Record<string, { updated: number; deleted: number }> = {};
    await runAsTenant(A, async () => {
      await tenantTransaction(async (tx) => {
        for (const model of TENANT_MODELS) {
          const t = tableOf(model);
          const updated = await tx.$executeRawUnsafe(`UPDATE "${t}" SET tenant_id = tenant_id WHERE tenant_id = $1`, LOISU);
          const deleted = await tx.$executeRawUnsafe(`DELETE FROM "${t}" WHERE tenant_id = $1`, LOISU);
          counts[model] = { updated, deleted };
        }
        throw new Rollback();
      }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
    });
    for (const [model, c] of Object.entries(counts)) expect(c, model).toEqual({ updated: 0, deleted: 0 });
    expect(Object.keys(counts)).toHaveLength(TENANT_MODELS.size);
  });

  it('tabelitel ilma tenant_id veeruta pole teris_app rollil mingeid õigusi (platvormi tabelid)', async () => {
    const rows = await authDb().$queryRawUnsafe<{ table_name: string }[]>(`
      SELECT t.table_name FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'tenant_id')`);
    const platform = rows.map((r) => r.table_name).filter((n) => n !== '_prisma_migrations');
    expect(platform.length).toBeGreaterThan(0);
    const grants = await authDb().$queryRawUnsafe<{ table_name: string }[]>(`
      SELECT DISTINCT table_name FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'teris_app'`);
    const leaked = grants.map((g) => g.table_name).filter((n) => platform.includes(n));
    expect(leaked).toEqual([]);
  });
});
