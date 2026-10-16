// src/server/db.ts
// Prisma kliendid. `new PrismaClient()` laeb projekti .env-i, mistõttu
// TSDB_DATABASE_URL loetakse alles pärast põhikliendi loomist.
import { Prisma, PrismaClient } from '@prisma/client';
import { currentUsername, currentTenantId, requireTenantId, isInTenantTransaction, runInTenantTransactionFlag } from './requestContext.ts';
import { scopeTenantArgs, TENANT_MODELS } from './tenantScope.ts';
export { runInRequestContext, setRequestUser, runAsTenant, currentUsername, currentTenantId, requireTenantId } from './requestContext.ts';

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
const base = new PrismaClient();
const setTenant = (tenantId: string) => base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

export const prisma = base.$extends({
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
})
  .$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeTenantArgs(model, operation, args as Data, currentTenantId()) as typeof args);
        }
      }
    }
    })
  .$extends({
    name: 'tenant-rls',
    query: {
      $allModels: {
        // Iga ettevõttepõhine päring käib tehingus, mille esimene lause seab app.tenant_id (RLS).
        // Interaktiivse tehingu (tenantTransaction) sees on see juba seatud.
        async $allOperations({ model, args, query }) {
          if (!TENANT_MODELS.has(model) || isInTenantTransaction()) return query(args);
          const [, result] = await base.$transaction([setTenant(requireTenantId()), query(args)]);
          return result;
        }
      }
    }
  });

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Interaktiivne tehing ettevõtte kontekstis — kasuta prisma.$transaction(async ...) asemel.
 * Callback'is kasuta AINULT `tx`-i: globaalne `prisma` käiks teise ühendusega tehingust väljas
 * ja RLS-i seade puuduks (tulemus oleks vaikselt tühi).
 */
export function tenantTransaction<T>(fn: (tx: TxClient) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T> {
  const tenantId = requireTenantId();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return runInTenantTransactionFlag(() => fn(tx));
  }, options);
}

// Autentimine (sisselogimine, sessioon, paroolilingid) toimub enne, kui päringul on ettevõtte
// kontekst. teris_platform roll möödub RLS-ist — kasuta AINULT authGate.ts ja passwordTokens.ts sees.
let authClient: PrismaClient | null = null;
export function authDb(): PrismaClient {
  if (!authClient) {
    const url = process.env.PLATFORM_DATABASE_URL;
    if (!url) throw new Error('PLATFORM_DATABASE_URL puudub');
    authClient = new PrismaClient({ datasources: { db: { url } } });
  }
  return authClient;
}

/** Kas kasutaja tohib kirjet kustutada: admin alati, teised ainult enda loodud kirjeid. */
export function canDelete(user: { username: string; isAdmin: boolean } | null, createdBy: string | null | undefined): boolean {
  if (!user) return false;
  return user.isAdmin || (!!createdBy && createdBy === user.username);
}

export const DELETE_FORBIDDEN_MESSAGE = 'Seda kirjet saab kustutada ainult kirje looja või admin-rolliga kasutaja.';

// telemetry_tsdb (TimescaleDB) hoiab GPS-jälgurite + Eye sensorite telemeetriat ühes
// laias mõõtmiste tabelis (mitte Prisma mudelina — $queryRaw teise ühendusega).
export const tsdb = process.env.TSDB_DATABASE_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.TSDB_DATABASE_URL } } })
  : null;
