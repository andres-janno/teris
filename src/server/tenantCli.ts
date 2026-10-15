// src/server/tenantCli.ts
// Ettevõtete ja litsentside haldus käsurealt (kuni teenusepakkuja keskkonnani):
//   npm run tenant -- list
//   npm run tenant -- license <ettevõtte-id> --until YYYY-MM-DD --modules TELEMETRY,SATELLITE,WEATHER
// --modules "" eemaldab kõik lisamoodulid.
import { authDb } from './db';
import { LICENSE_MODULES, type LicenseModule } from './license';

const db = authDb();

// Lipu väärtus; undefined, kui lippu pole. Tühi string ('--modules ""') on lubatud väärtus.
function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`${flag} vajab väärtust`);
  return v;
}

function parseDate(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new Error(`Vigane kuupäev "${s}" (YYYY-MM-DD)`);
  }
  return d;
}

function parseModules(s: string): LicenseModule[] {
  const list = s.split(',').map((m) => m.trim().toUpperCase()).filter(Boolean);
  const bad = list.filter((m) => !LICENSE_MODULES.includes(m as LicenseModule));
  if (bad.length) throw new Error(`Tundmatu moodul: ${bad.join(', ')} (lubatud: ${LICENSE_MODULES.join(', ')})`);
  return [...new Set(list)] as LicenseModule[];
}

async function main(): Promise<void> {
  const [command, tenantId, ...rest] = process.argv.slice(2);
  if (command === 'list') {
    const tenants = await db.tenant.findMany({ orderBy: { createdAt: 'asc' } });
    const licenses = await db.tenantLicense.findMany();
    for (const t of tenants) {
      const l = licenses.find((x) => x.tenantId === t.id);
      const lic = l ? `kuni ${l.validUntil.toISOString().slice(0, 10)} [${l.modules.join(', ') || '—'}]` : 'litsents puudub';
      console.log(`${t.id}\t${t.name}\t${t.status}\t${lic}`);
    }
    return;
  }
  if (command === 'license') {
    if (!tenantId) throw new Error('Ettevõtte ID puudub');
    if (!(await db.tenant.findUnique({ where: { id: tenantId } }))) throw new Error(`Ettevõtet "${tenantId}" pole`);
    const until = argValue(rest, '--until');
    const modulesArg = argValue(rest, '--modules'); // puudub → kõik moodulid; "" → ükski
    if (!until) throw new Error('--until on kohustuslik');
    const validUntil = parseDate(until);
    const modules = modulesArg === undefined ? [...LICENSE_MODULES] : parseModules(modulesArg);
    await db.tenantLicense.upsert({
      where: { tenantId },
      create: { tenantId, validUntil, modules, updatedBy: 'cli' },
      update: { validUntil, modules, updatedBy: 'cli' }
    });
    console.log(`Litsents: ${tenantId} kuni ${until} [${modules.join(', ') || '—'}]`);
    return;
  }
  throw new Error('Kasutus: npm run tenant -- <list | license <id> --until YYYY-MM-DD [--modules A,B]>');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
