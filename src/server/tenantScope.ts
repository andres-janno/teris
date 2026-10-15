// src/server/tenantScope.ts
// Rakenduse kihi ettevõtte filter: lisab ettevõttepõhiste mudelite päringutele where.tenantId.
// Loomistel täidab tenant_id andmebaasi vaikeväärtus current_setting('app.tenant_id') — see katab
// ka pesastatud loomised. Teine kaitsekiht on Postgres RLS (scripts/tenancy/02-rls.sql).
import { Prisma } from '@prisma/client';
import { MissingTenantError } from './requestContext.ts';

export const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar'))
    .map((m) => m.name)
);

const WHERE_OPERATIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate',
  'groupBy', 'update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert'
]);

type Args = Record<string, unknown>;

export function scopeTenantArgs(model: string, operation: string, args: Args, tenantId: string | null): Args {
  if (!TENANT_MODELS.has(model)) return args;
  if (!tenantId) throw new MissingTenantError();
  if (!WHERE_OPERATIONS.has(operation)) return args;
  // findUnique/update/delete/upsert lubavad unikaalse võtme kõrval lisatingimusi (Prisma 5+ extendedWhereUnique)
  return { ...args, where: { ...((args.where as Args) ?? {}), tenantId } };
}
