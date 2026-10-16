// Ettevõttesisesed relatsioonid Prisma DMMF-ist: iga neist saab andmebaasis tenant_fk triger (vt scripts/tenancy/05-tenant-fk-triggers.mts).
import { Prisma } from '@prisma/client';
import { TENANT_MODELS } from './tenantScope';

export type TenantRelation = { table: string; column: string; parentTable: string; parentColumn: string };

const models = Prisma.dmmf.datamodel.models;
const dbTable = (name: string) => { const m = models.find((x) => x.name === name)!; return m.dbName ?? m.name; };
const dbColumn = (model: string, field: string) => {
  const f = models.find((x) => x.name === model)!.fields.find((x) => x.name === field)!;
  return (f as { dbName?: string | null }).dbName ?? f.name;
};

export function tenantRelations(): TenantRelation[] {
  const out: TenantRelation[] = [];
  for (const m of models) {
    if (!TENANT_MODELS.has(m.name)) continue;
    for (const f of m.fields) {
      if (f.kind !== 'object' || !f.relationFromFields?.length || !TENANT_MODELS.has(f.type)) continue;
      if (f.relationFromFields.length !== 1) throw new Error(`${m.name}.${f.name}: liitvõtit ei toetata`);
      out.push({
        table: dbTable(m.name),
        column: dbColumn(m.name, f.relationFromFields[0]),
        parentTable: dbTable(f.type),
        parentColumn: dbColumn(f.type, f.relationToFields![0])
      });
    }
  }
  return out;
}
