// src/server/db.ts
// Prisma kliendid. `new PrismaClient()` laeb projekti .env-i, mistõttu
// TSDB_DATABASE_URL loetakse alles pärast põhikliendi loomist.
import { AsyncLocalStorage } from 'async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';

// Päringu kasutaja (kasutajatunnus), kelle nimel kirjeid luuakse/muudetakse.
// API päring töödeldakse runInAuditContext() sees ja kasutaja määratakse pärast autentimist
// setAuditUser()-iga; väljaspool (nt CLI) on see tühi.
const auditContext = new AsyncLocalStorage<{ username: string | null }>();

export function runInAuditContext<T>(fn: () => Promise<T>): Promise<T> {
  return auditContext.run({ username: null }, fn);
}

export function setAuditUser(username: string | null): void {
  const store = auditContext.getStore();
  if (store) store.username = username;
}

export function currentUsername(): string | null {
  return auditContext.getStore()?.username ?? null;
}

// Mudelid, millel on looja/muutja väljad (createdBy, updatedBy)
const AUDITED_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'createdBy' && f.kind === 'scalar'))
    .map((m) => m.name)
);

type Data = Record<string, unknown>;
const withCreator = (data: Data, username: string): Data => ({ createdBy: username, updatedBy: username, ...data });
const withUpdater = (data: Data, username: string): Data => ({ ...data, updatedBy: username });

// Täidab looja ja muutja automaatselt kõigil kirjutamistel (ka tehingute sees)
export const prisma = new PrismaClient().$extends({
  name: 'audit-user',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const username = currentUsername();
        if (!username || !model || !AUDITED_MODELS.has(model)) return query(args);
        const a = args as Data;
        switch (operation) {
          case 'create':
            a.data = withCreator(a.data as Data, username);
            break;
          case 'createMany':
          case 'createManyAndReturn':
            a.data = Array.isArray(a.data)
              ? (a.data as Data[]).map((d) => withCreator(d, username))
              : withCreator(a.data as Data, username);
            break;
          case 'update':
          case 'updateMany':
          case 'updateManyAndReturn':
            a.data = withUpdater(a.data as Data, username);
            break;
          case 'upsert':
            a.create = withCreator(a.create as Data, username);
            a.update = withUpdater(a.update as Data, username);
            break;
        }
        return query(a as typeof args);
      }
    }
  }
});

/** Kas kasutaja tohib kirjet kustutada: admin alati, teised ainult enda loodud kirjeid. */
export function canDelete(user: { username: string; isAdmin: boolean } | null, createdBy: string | null | undefined): boolean {
  if (!user) return false;
  return user.isAdmin || (!!createdBy && createdBy === user.username);
}

export const DELETE_FORBIDDEN_MESSAGE = 'Seda kirjet saab kustutada ainult kirje looja või admin-rolliga kasutaja.';

// telemetry_tsdb (TimescaleDB) hoiab Teltonika GPS + Eye sensori telemeetriat ühes
// laias mõõtmiste tabelis (mitte Prisma mudelina — $queryRaw teise ühendusega).
export const tsdb = process.env.TSDB_DATABASE_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.TSDB_DATABASE_URL } } })
  : null;
