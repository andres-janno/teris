import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { scopeTenantArgs, TENANT_MODELS, PLATFORM_MODELS } from './tenantScope';
import { MissingTenantError } from './requestContext';

describe('scopeTenantArgs', () => {
  it('tunneb ettevõttepõhised mudelid skeemist', () => {
    expect(TENANT_MODELS.has('Season')).toBe(true);
    expect(TENANT_MODELS.has('User')).toBe(true);
    expect(TENANT_MODELS.has('Session')).toBe(false);
    expect(TENANT_MODELS.has('Tenant')).toBe(false);
    expect(TENANT_MODELS.has('TenantLicense')).toBe(false);
    expect(TENANT_MODELS.size).toBe(29);
  });

  it('platvormimudelid eksisteerivad skeemis (kirjavea ei jäta mudelit ettevõttefiltri alla)', () => {
    const names = new Set(Prisma.dmmf.datamodel.models.map((m) => m.name));
    for (const model of PLATFORM_MODELS) expect(names.has(model), model).toBe(true);
  });

  it('lisab lugemistele, muutmistele ja kustutamistele where.tenantId', () => {
    for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count',
      'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']) {
      const out = scopeTenantArgs('Season', op, { where: { year: 2026 } }, 't1');
      expect(out.where).toEqual({ year: 2026, tenantId: 't1' });
    }
  });

  it('lisab where ka siis, kui seda polnud', () => {
    expect(scopeTenantArgs('Crop', 'findMany', {}, 't1').where).toEqual({ tenantId: 't1' });
  });

  it('ei luba kliendil ettevõtet üle kirjutada', () => {
    expect(scopeTenantArgs('Crop', 'findMany', { where: { tenantId: 'muu' } }, 't1').where).toEqual({ tenantId: 't1' });
  });

  it('loomistel jätab andmed muutmata (tenant_id tuleb andmebaasi vaikeväärtusest)', () => {
    const args = { data: { name: 'Kaer' } };
    expect(scopeTenantArgs('Crop', 'create', args, 't1')).toEqual({ data: { name: 'Kaer' } });
  });

  it('ei puuduta ettevõtteta mudeleid ega nõua neil konteksti', () => {
    const args = { where: { tokenHash: 'x' } };
    expect(scopeTenantArgs('Session', 'findUnique', args, null)).toEqual(args);
  });

  it('viskab, kui ettevõttepõhisel mudelil pole konteksti', () => {
    expect(() => scopeTenantArgs('Field', 'findMany', {}, null)).toThrow(MissingTenantError);
    expect(() => scopeTenantArgs('Field', 'create', { data: {} }, null)).toThrow(MissingTenantError);
  });
});
