import { describe, it, expect } from 'vitest';
import {
  runInRequestContext, setRequestUser, runAsTenant, currentUsername, currentTenantId,
  requireTenantId, MissingTenantError, isInTenantTransaction, runInTenantTransactionFlag
} from './requestContext';

describe('requestContext', () => {
  it('on väljaspool konteksti tühi', () => {
    expect(currentUsername()).toBeNull();
    expect(currentTenantId()).toBeNull();
    expect(() => requireTenantId()).toThrow(MissingTenantError);
  });

  it('setRequestUser määrab kasutaja ja ettevõtte päringu kontekstis', async () => {
    await runInRequestContext(async () => {
      expect(currentTenantId()).toBeNull();
      setRequestUser({ username: 'mari', tenantId: 't1' });
      expect(currentUsername()).toBe('mari');
      expect(requireTenantId()).toBe('t1');
    });
    expect(currentTenantId()).toBeNull();
  });

  it('runAsTenant ei leki paralleelsetesse kontekstidesse', async () => {
    const seen = await Promise.all([
      runAsTenant('a', async () => { await new Promise((r) => setTimeout(r, 5)); return currentTenantId(); }),
      runAsTenant('b', async () => currentTenantId())
    ]);
    expect(seen).toEqual(['a', 'b']);
  });

  it('tehingu lipp kehtib ainult oma haru sees', async () => {
    await runAsTenant('a', async () => {
      expect(isInTenantTransaction()).toBe(false);
      await runInTenantTransactionFlag(async () => {
        expect(isInTenantTransaction()).toBe(true);
        expect(currentTenantId()).toBe('a');
      });
      expect(isInTenantTransaction()).toBe(false);
    });
  });
});
