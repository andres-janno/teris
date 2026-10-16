// src/server/license.ts
// Ettevõtte litsents: kehtivus (aegunud → ainult lugemine) ja litsentsitud lisamoodulid.
// Põhimoodul (põllud, tööd, finants, mullaproovid jm) on alati sees.
import { authDb } from './db.ts';

export type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER';
export const LICENSE_MODULES: readonly LicenseModule[] = ['TELEMETRY', 'SATELLITE', 'WEATHER'];
/** Range YYYY-MM-DD ja päris kuupäev (round-trip kontroll); vigase korral null. */
export function parseLicenseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export const EXPIRY_WARNING_DAYS = 14;
export const LICENSE_READ_ONLY_MESSAGE = 'Litsents on aegunud — andmed on ainult lugemiseks';
export const MODULE_NOT_LICENSED_MESSAGE = 'See moodul ei kuulu teie litsentsi';

export interface LicenseState {
  readOnly: boolean;
  validUntil: string | null; // YYYY-MM-DD
  expiresSoon: boolean;
  modules: LicenseModule[];
}

const NO_LICENSE: LicenseState = { readOnly: true, validUntil: null, expiresSoon: false, modules: [] };

/** Tänane kuupäev (YYYY-MM-DD) Eesti ajas — litsents kehtib kuni validUntil päeva lõpuni. */
export function tallinnToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(now);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

export function licenseState(license: { validUntil: Date; modules: string[] } | null, today: string): LicenseState {
  if (!license) return NO_LICENSE;
  const validUntil = license.validUntil.toISOString().slice(0, 10);
  const daysLeft = daysBetween(today, validUntil);
  return {
    readOnly: daysLeft < 0,
    validUntil,
    expiresSoon: daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS,
    modules: LICENSE_MODULES.filter((m) => license.modules.includes(m))
  };
}

// Mooduli API teekonnad (täpne tee või prefiks koos '/'-ga). /api/fleet ise on põhimoodul —
// telemeetria osa sellest jäetakse ilma moodulita vastusest välja (apiHandler.ts).
const MODULE_ROUTES: { module: LicenseModule; exact: string[]; prefixes: string[] }[] = [
  {
    module: 'TELEMETRY',
    exact: ['/api/fleet/devices', '/api/fleet/device-assignments', '/api/telemetry/history', '/api/field-works/telemetry-suggestions'],
    prefixes: ['/api/fleet/devices/', '/api/fleet/device-assignments/', '/api/telemetry/']
  },
  { module: 'SATELLITE', exact: [], prefixes: ['/api/satellite/'] },
  { module: 'WEATHER', exact: [], prefixes: ['/api/weather/'] }
];

export function moduleForRoute(pathname: string): LicenseModule | null {
  for (const r of MODULE_ROUTES) {
    if (r.exact.includes(pathname) || r.prefixes.some((p) => pathname.startsWith(p))) return r.module;
  }
  return null;
}

// POST päringud, mis ainult loevad (ei kirjuta andmebaasi)
const READ_ONLY_POSTS = new Set(['/api/satellite/cloud-check']);

export function isAllowedWhenReadOnly(pathname: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  return method === 'POST' && READ_ONLY_POSTS.has(pathname);
}

export async function loadLicenseState(tenantId: string, now: Date = new Date()): Promise<LicenseState> {
  const license = await authDb().tenantLicense.findUnique({
    where: { tenantId },
    select: { validUntil: true, modules: true }
  });
  return licenseState(license, tallinnToday(now));
}
