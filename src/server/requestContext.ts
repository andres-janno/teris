// src/server/requestContext.ts
// Päringu kontekst: kelle nimel (kasutajanimi → createdBy/updatedBy) ja millise ettevõtte
// andmetega päring töötab. API päring töödeldakse runInRequestContext() sees ja kasutaja
// määratakse pärast autentimist setRequestUser()-iga; skriptid ja testid kasutavad runAsTenant().
import { AsyncLocalStorage } from 'async_hooks';

type Store = { username: string | null; tenantId: string | null; inTenantTx: boolean };
const storage = new AsyncLocalStorage<Store>();

export class MissingTenantError extends Error {
  constructor() {
    super('Ettevõtte kontekst puudub — ettevõtte andmeid ei saa ilma selleta pärida');
    this.name = 'MissingTenantError';
  }
}

export function runInRequestContext<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ username: null, tenantId: null, inTenantTx: false }, fn);
}

export function setRequestUser(user: { username: string; tenantId: string } | null): void {
  const store = storage.getStore();
  if (!store) return;
  store.username = user?.username ?? null;
  store.tenantId = user?.tenantId ?? null;
}

export function runAsTenant<T>(tenantId: string, fn: () => Promise<T>, username: string | null = null): Promise<T> {
  return storage.run({ username, tenantId, inTenantTx: false }, fn);
}

export const currentUsername = (): string | null => storage.getStore()?.username ?? null;
export const currentTenantId = (): string | null => storage.getStore()?.tenantId ?? null;

export function requireTenantId(): string {
  const id = currentTenantId();
  if (!id) throw new MissingTenantError();
  return id;
}

export const isInTenantTransaction = (): boolean => storage.getStore()?.inTenantTx ?? false;

// Interaktiivse tehingu sees on app.tenant_id juba seatud — üksikpäringuid ei mähita uuesti.
export function runInTenantTransactionFlag<T>(fn: () => Promise<T>): Promise<T> {
  const store = storage.getStore();
  return storage.run({ username: store?.username ?? null, tenantId: store?.tenantId ?? null, inTenantTx: true }, fn);
}
