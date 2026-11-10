// src/server/weather/credentials.ts — ettevõtete CDS võtmed ilmaandmete laadimiseks.
// Ilmapunktid on ühised: punkti laeb mistahes ettevõtte võti, kellel on (a) kehtiv WEATHER litsents, (b) sellega seotud hooaegu
// ja (c) salvestatud võti. Võtmeid loetakse üle ettevõtete authDb() kaudu (BYPASSRLS); lahti krüpteeritud võti elab ainult mälus.
import { authDb } from '../db.ts';
import { decryptSecret } from '../secretBox.ts';
import { licenseState, tallinnToday } from '../license.ts';

export const NO_KEY_ERROR = 'Ühelgi selle ruudu ettevõttel pole CDS võtit';
export const NO_SECRETS_KEY_MESSAGE = 'Serveri seadistuses puudub SECRETS_KEY, võtit ei saa salvestada';

export type KeyCandidate = { tenantId: string; key: string };
type CredRef = { tenantId: string; name: string; cdsKeyEnc: string };

/** SECRETS_KEY (64 hex-märki) või null, kui puudub/vigane. */
export function secretsKey(): string | null {
  const k = process.env.SECRETS_KEY;
  return k && /^[0-9a-fA-F]{64}$/.test(k) ? k : null;
}

/**
 * Võtmega ettevõtted, kelle litsents on kehtiv ja sisaldab WEATHER moodulit, iga ruudu kohta järjestatult
 * (viimati kasutatud võti esimesena, kasutamata viimaseks). Kui pointIds on antud, piirdutakse nende ruutudega.
 */
export async function credentialsByPoint(now: Date, pointIds?: number[]): Promise<Map<number, CredRef[]>> {
  const db = authDb();
  const today = tallinnToday(now);
  const creds = await db.tenantWeatherCredential.findMany({ orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { tenantId: 'asc' }] });
  if (!creds.length) return new Map();
  const [licenses, tenants] = await Promise.all([
    db.tenantLicense.findMany({ where: { tenantId: { in: creds.map((c) => c.tenantId) } }, select: { tenantId: true, modules: true, validUntil: true } }),
    db.tenant.findMany({ where: { id: { in: creds.map((c) => c.tenantId) } }, select: { id: true, name: true } })
  ]);
  const valid = new Set(licenses.filter((l) => l.modules.includes('WEATHER') && !licenseState(l, today).readOnly).map((l) => l.tenantId));
  const name = new Map(tenants.map((t) => [t.id, t.name]));
  const eligible = creds.filter((c) => valid.has(c.tenantId));
  if (!eligible.length) return new Map();
  const seasons = await db.fieldSeason.groupBy({
    by: ['weatherPointId', 'tenantId'],
    where: { tenantId: { in: eligible.map((c) => c.tenantId) }, weatherPointId: pointIds ? { in: pointIds } : { not: null } }
  });
  const tenantsOf = new Map<number, Set<string>>();
  for (const s of seasons) {
    if (s.weatherPointId === null) continue;
    (tenantsOf.get(s.weatherPointId) ?? tenantsOf.set(s.weatherPointId, new Set()).get(s.weatherPointId)!).add(s.tenantId);
  }
  const out = new Map<number, CredRef[]>();
  for (const [pointId, ts] of tenantsOf) {
    out.set(pointId, eligible.filter((c) => ts.has(c.tenantId)).map((c) => ({ tenantId: c.tenantId, name: name.get(c.tenantId) ?? c.tenantId, cdsKeyEnc: c.cdsKeyEnc })));
  }
  return out;
}

/** Punkti võtmekandidaadid lahti krüpteerituna. SECRETS_KEY puudumisel hoiatus ja tühi loend. */
export async function keyCandidatesForPoint(pointId: number, now: Date): Promise<KeyCandidate[]> {
  const sk = secretsKey();
  if (!sk) { console.warn('weather: SECRETS_KEY puudub või on vigane, CDS võtmeid ei saa lugeda'); return []; }
  const refs = (await credentialsByPoint(now, [pointId])).get(pointId) ?? [];
  const out: KeyCandidate[] = [];
  for (const r of refs) {
    try { out.push({ tenantId: r.tenantId, key: decryptSecret(r.cdsKeyEnc, sk) }); }
    catch { console.error(`weather: ettevõtte ${r.tenantId} CDS võtit ei õnnestunud lahti krüpteerida`); }
  }
  return out;
}

// Toores UPDATE: Prisma update muudaks updatedAt (= „võti muudetud“), aga kasutus ei ole muudatus.
export async function markKeyUsed(tenantId: string): Promise<void> {
  await authDb().$executeRaw`UPDATE "tenant_weather_credentials" SET "lastUsedAt" = ${new Date()}, "lastError" = NULL WHERE "tenant_id" = ${tenantId}`;
}

export async function markKeyFailed(tenantId: string, message: string): Promise<void> {
  await authDb().$executeRaw`UPDATE "tenant_weather_credentials" SET "lastError" = ${message.slice(0, 500)} WHERE "tenant_id" = ${tenantId}`;
}
