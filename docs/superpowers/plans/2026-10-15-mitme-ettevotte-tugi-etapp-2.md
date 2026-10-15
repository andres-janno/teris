# Mitme ettevõtte tugi, etapp 2: litsents ja moodulid — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Igal ettevõttel on litsents (kehtivusaeg + moodulid); aegunud litsentsiga on andmed ainult lugemiseks ja litsentsis puuduvate moodulite (telemeetria, satelliit, ilmaradar) API-d keelatud ning kasutajaliideses peidetud.

**Architecture:** Uus teenusepakkuja tabel `TenantLicense` (nagu `tenants`, ilma RLS-ita, loetakse `authDb()` kaudu). Puhas moodul `src/server/license.ts` arvutab litsentsi oleku ja kaardistab API teekonnad mooduliteks; `src/server/licenseGate.ts` rakendab keelud ühes kohas `routeApiRequest`-is pärast `setRequestUser`-it ja jätab oleku päringule (`licenseOf(req)`). `/api/auth/me` ja `/api/auth/login` tagastavad kasutajaga koos ettevõtte nime ja litsentsi; klient näitab ülariba ja peidab moodulid. Litsentsi määratakse käsurealt (`npm run tenant`), kuni etapp 3 toob teenusepakkuja keskkonna.

**Tech Stack:** Node 22, TypeScript 6, Prisma 6.19 (`prisma db push`), PostgreSQL 17, React 19, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md` — osad 1.1 (`TenantLicense`), 3.3, 3.4, 8 (etapp 2).

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi**; käsud käivitatakse serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta. Git kohalikult.
- Rollid: rakendus `teris_app` (RLS), autentimine/platvorm `authDb()` = `teris_platform` (BYPASSRLS), skeem `MIGRATE_DATABASE_URL` / PG* muutujad = `teris` (omanik). `.env` URL-id lõpevad `?schema=public` — psql jaoks kasuta PG* muutujaid, mitte URL-e. Saladusi ei trükita.
- Enne skeemimuudatust `pg_dump` varukoopia `~/backups/` (kaust 700, failid 600). `prisma db push` võib Claude Code'i automaatrežiimis keelatud olla — siis annab kasutaja selle ise terminalis.
- `npm run build` ainult release'i ajal — live-kaustas ehitamine muudab kohe seda, mida töötav server serveerib.
- Moodulid (enum `LicenseModule`): `TELEMETRY`, `SATELLITE`, `WEATHER`. Põhimoodul (sh finants ja mullaproovid) on alati sees.
- Aegunud litsents (`validUntil < täna`, kuupäev Europe/Tallinn ajavööndis): ainult lugemine. Kasutaja saab sisse logida, vaadata, välja logida ja oma parooli vahetada. Litsentsi puudumisel: ainult lugemine ja ükski moodul (fail-closed).
- Veateated (täpselt): aegunud — `Litsents on aegunud — andmed on ainult lugemiseks` (HTTP 403, `code: 'LICENSE_READ_ONLY'`); moodul puudub — `See moodul ei kuulu teie litsentsi` (HTTP 403, `code: 'MODULE_NOT_LICENSED'`).
- Hoiatus 14 päeva enne aegumist, ainult ettevõtte adminile.
- Loisu Agro OÜ (`tenant-loisu-agro`) litsents: kõik kolm moodulit, `validUntil = 2099-12-31`.
- Kasutajaliideses aegunud litsentsi korral **nupud jäävad nähtavale** (kasutaja otsus): ülariba + serveri keeld + selge teade iga keelatud katse korral.
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release (`npm run release`) ja `git push` ainult kasutaja kinnitusel (Task 8).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `enum LicenseModule`, `model TenantLicense` |
| `src/server/license.ts` (uus) | Puhas loogika: `licenseState`, `tallinnToday`, `moduleForRoute`, `isAllowedWhenReadOnly`; DB: `loadLicenseState(tenantId)` |
| `src/server/license.test.ts` (uus) | Puhta loogika testid + `loadLicenseState` integratsioonitest |
| `src/server/tenantCli.ts` (uus) | `npm run tenant -- list` / `license <id> --until <kuupäev> --modules <A,B>` |
| `src/server/licenseGate.ts` (uus) | `applyLicenseGate(req, res, pathname, method, tenantId)`, `licenseOf(req)` |
| `src/server/apiHandler.ts` | Värava kutse; `/api/fleet` ilma telemeetriata |
| `src/server/authGate.ts` | `/api/auth/me` ja login vastusesse ettevõte + litsents |
| `src/types/auth.ts`, `src/services/license.ts` (uus), `src/services/license.test.ts` (uus) | Kliendi tüübid ja `hasModule`, `licenseBannerText` |
| `src/services/api.ts` | 403 litsentsivea käsitleja |
| `src/components/LicenseBanner.tsx` (uus), `src/App.tsx`, `src/index.css` | Ülariba, veateade |
| `src/components/LayerControl.tsx`, `MapView.tsx`, `VehicleTracker.tsx`, `FieldWorkEntryDialog.tsx`, `FieldDetailsDrawer.tsx` | Moodulite peitmine |

---

### Task 1: `TenantLicense` mudel

**Files:**
- Modify: `prisma/schema.prisma` (ettevõtete plokk faili lõpus, `Tenant` mudeli järel)

**Interfaces:**
- Produces: Prisma mudel `tenantLicense` (`tenantId String @unique`, `validUntil DateTime @db.Date`, `modules LicenseModule[]`, `updatedAt`, `updatedBy String?`), enum `LicenseModule`.

- [ ] **Step 1: Skeem**

```prisma
enum LicenseModule {
  TELEMETRY
  SATELLITE
  WEATHER
}

// Ettevõtte litsents — teenusepakkuja andmed (ilma RLS-ita, loetakse authDb() kaudu)
model TenantLicense {
  id         String          @id @default(cuid())
  tenantId   String          @unique
  validUntil DateTime        @db.Date // Viimane kehtiv päev (Europe/Tallinn)
  modules    LicenseModule[] // Litsentsitud lisamoodulid; põhimoodul on alati sees
  updatedAt  DateTime        @updatedAt
  updatedBy  String? // Kes viimati muutis (teenusepakkuja kasutaja või "cli")

  @@map("tenant_licenses")
}
```
Ära lisa `tenantId` vaikeväärtust ega RLS-i — see on teenusepakkuja tabel nagu `tenants`.

- [ ] **Step 2: Varukoopia, `db push`, õigused**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -f ~/backups/teris-$(date +%F-%H%M)-etapp2.dump && chmod 600 ~/backups/*.dump && npx prisma db push && npx prisma generate'
```
Expected: `in sync`, ilma andmekao hoiatuseta (ainult uus tabel ja enum). Kui käsk on keelatud, peatu ja anna käsk kasutajale.

`ALTER DEFAULT PRIVILEGES` (etapp 1 `02-rls.sql`) annab uuele tabelile õigused `teris_app`-ile ja `teris_platform`-ile automaatselt. Kontrolli:
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql -Atc "select grantee, string_agg(privilege_type, \",\" order by privilege_type) from information_schema.role_table_grants where table_name = '"'"'tenant_licenses'"'"' and grantee like '"'"'teris_%'"'"' group by grantee"'
```
Expected: `teris_app|DELETE,INSERT,SELECT,UPDATE` ja `teris_platform|DELETE,INSERT,SELECT,UPDATE`. Kui puudub, käivita `psql -c "GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_licenses TO teris_app, teris_platform"`.

- [ ] **Step 3: Kontrolli ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test` (serveris). Expected: kõik PASS.
```bash
git add prisma/schema.prisma
git commit -m "Litsents: TenantLicense mudel ja LicenseModule enum"
```

---

### Task 2: Litsentsi loogika (`license.ts`)

**Files:**
- Create: `src/server/license.ts`
- Create: `src/server/license.test.ts`

**Interfaces:**
- Consumes: `authDb()` (`./db.ts`), Prisma `tenantLicense` (Task 1)
- Produces:
  - `type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER'`; `const LICENSE_MODULES: readonly LicenseModule[]`
  - `interface LicenseState { readOnly: boolean; validUntil: string | null; expiresSoon: boolean; modules: LicenseModule[] }`
  - `tallinnToday(now: Date): string` — `YYYY-MM-DD` Europe/Tallinn ajavööndis
  - `licenseState(license: { validUntil: Date; modules: string[] } | null, today: string): LicenseState`
  - `moduleForRoute(pathname: string): LicenseModule | null`
  - `isAllowedWhenReadOnly(pathname: string, method: string): boolean`
  - `loadLicenseState(tenantId: string, now?: Date): Promise<LicenseState>`
  - konstandid `LICENSE_READ_ONLY_MESSAGE`, `MODULE_NOT_LICENSED_MESSAGE`, `EXPIRY_WARNING_DAYS = 14`

- [ ] **Step 1: Kirjuta failiv test**

`src/server/license.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest';
import {
  tallinnToday, licenseState, moduleForRoute, isAllowedWhenReadOnly, loadLicenseState, LICENSE_MODULES
} from './license';
import { authDb } from './db';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('tallinnToday', () => {
  it('kasutab Eesti aega, mitte UTC-d', () => {
    expect(tallinnToday(new Date('2026-10-15T21:30:00Z'))).toBe('2026-10-16'); // EEST +3
    expect(tallinnToday(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-16'); // EET +2
    expect(tallinnToday(new Date('2026-01-15T21:30:00Z'))).toBe('2026-01-15');
  });
});

describe('licenseState', () => {
  it('kehtiv litsents: kirjutamine lubatud, moodulid alles', () => {
    expect(licenseState({ validUntil: d('2026-12-31'), modules: ['TELEMETRY'] }, '2026-10-15')).toEqual({
      readOnly: false, validUntil: '2026-12-31', expiresSoon: false, modules: ['TELEMETRY']
    });
  });
  it('viimane kehtiv päev on veel kehtiv', () => {
    expect(licenseState({ validUntil: d('2026-10-15'), modules: [] }, '2026-10-15').readOnly).toBe(false);
  });
  it('järgmisel päeval ainult lugemine', () => {
    expect(licenseState({ validUntil: d('2026-10-15'), modules: [] }, '2026-10-16').readOnly).toBe(true);
  });
  it('hoiatus 14 päeva enne, mitte varem', () => {
    expect(licenseState({ validUntil: d('2026-10-29'), modules: [] }, '2026-10-15').expiresSoon).toBe(true);
    expect(licenseState({ validUntil: d('2026-10-30'), modules: [] }, '2026-10-15').expiresSoon).toBe(false);
    expect(licenseState({ validUntil: d('2026-10-10'), modules: [] }, '2026-10-15').expiresSoon).toBe(false);
  });
  it('litsentsi puudumisel ainult lugemine ja ükski moodul', () => {
    expect(licenseState(null, '2026-10-15')).toEqual({ readOnly: true, validUntil: null, expiresSoon: false, modules: [] });
  });
  it('tundmatud moodulid jäetakse välja', () => {
    expect(licenseState({ validUntil: d('2099-12-31'), modules: ['SATELLITE', 'MIDAGI'] }, '2026-10-15').modules).toEqual(['SATELLITE']);
  });
});

describe('moduleForRoute', () => {
  it.each([
    ['/api/fleet/devices', 'TELEMETRY'],
    ['/api/fleet/devices/abc', 'TELEMETRY'],
    ['/api/fleet/devices/assign', 'TELEMETRY'],
    ['/api/fleet/device-assignments', 'TELEMETRY'],
    ['/api/fleet/device-assignments/x1', 'TELEMETRY'],
    ['/api/telemetry/history', 'TELEMETRY'],
    ['/api/field-works/telemetry-suggestions', 'TELEMETRY'],
    ['/api/satellite/dates', 'SATELLITE'],
    ['/api/satellite/cloud-check', 'SATELLITE'],
    ['/api/weather/radar', 'WEATHER'],
    ['/api/weather/radar.png', 'WEATHER']
  ])('%s → %s', (path, mod) => expect(moduleForRoute(path)).toBe(mod));

  it.each(['/api/fleet', '/api/fleet/vehicles', '/api/fleet/implements', '/api/fleet/implement-assignments', '/api/seasons', '/api/fleetdevices'])(
    '%s on põhimoodul', (path) => expect(moduleForRoute(path)).toBeNull()
  );
});

describe('isAllowedWhenReadOnly', () => {
  it('lugemised on lubatud', () => {
    expect(isAllowedWhenReadOnly('/api/seasons', 'GET')).toBe(true);
    expect(isAllowedWhenReadOnly('/api/weather/radar.png', 'HEAD')).toBe(true);
  });
  it('sisuliselt lugemine olev POST on lubatud', () => {
    expect(isAllowedWhenReadOnly('/api/satellite/cloud-check', 'POST')).toBe(true);
  });
  it('muudatused on keelatud', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(isAllowedWhenReadOnly('/api/seasons', m)).toBe(false);
  });
});

describe('loadLicenseState (andmebaas)', () => {
  const T = `test-license-${process.pid}`;
  afterAll(async () => {
    await authDb().tenantLicense.deleteMany({ where: { tenantId: T } });
  });
  it('loeb litsentsi ja puudumisel on fail-closed', async () => {
    expect(await loadLicenseState(T)).toEqual({ readOnly: true, validUntil: null, expiresSoon: false, modules: [] });
    await authDb().tenantLicense.create({ data: { tenantId: T, validUntil: d('2099-12-31'), modules: [...LICENSE_MODULES] } });
    const s = await loadLicenseState(T, new Date('2026-10-15T10:00:00Z'));
    expect(s).toEqual({ readOnly: false, validUntil: '2099-12-31', expiresSoon: false, modules: ['TELEMETRY', 'SATELLITE', 'WEATHER'] });
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/license.test.ts`. Expected: FAIL — `Cannot find module './license'`.

- [ ] **Step 3: Implementeeri**

`src/server/license.ts`:
```ts
// src/server/license.ts
// Ettevõtte litsents: kehtivus (aegunud → ainult lugemine) ja litsentsitud lisamoodulid.
// Põhimoodul (põllud, tööd, finants, mullaproovid jm) on alati sees.
import { authDb } from './db.ts';

export type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER';
export const LICENSE_MODULES: readonly LicenseModule[] = ['TELEMETRY', 'SATELLITE', 'WEATHER'];
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
```

- [ ] **Step 4: Testid**

Run: `npx vitest run src/server/license.test.ts && npx tsc --noEmit -p tsconfig.app.json`. Expected: kõik PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/license.ts src/server/license.test.ts
git commit -m "Litsentsi olek, mooduli teekonnad ja ainult lugemise reegel (license.ts)"
```

---

### Task 3: Käsurea tööriist `npm run tenant` ja Loisu Agro litsents

**Files:**
- Create: `src/server/tenantCli.ts`
- Modify: `vite.server.config.ts` (`input`-i `tenantCli`), `package.json` (`"tenant": "node dist-server/tenantCli.js"`)

**Interfaces:**
- Consumes: `authDb()`, `LICENSE_MODULES`, `LicenseModule` (Task 2)

- [ ] **Step 1: Implementeeri**

`src/server/tenantCli.ts`:
```ts
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Error(`Vigane kuupäev "${s}" (YYYY-MM-DD)`);
  return new Date(`${s}T00:00:00.000Z`);
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
```
`npm run tenant -- license X --until D --modules ""` annab argumendiks tühja stringi `''`, mis ei alga `--`-ga — `argValue` tagastab `''` ja `parseModules('')` → `[]`. Kontrolli seda Step 3-s.

`vite.server.config.ts` `input`: lisa `tenantCli: 'src/server/tenantCli.ts'`. `package.json` `scripts`: lisa `"tenant": "node dist-server/tenantCli.js"` rea `"user"` järele.

- [ ] **Step 2: Ehita ja sea Loisu Agro litsents**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm run build:server && npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules TELEMETRY,SATELLITE,WEATHER && npm run tenant -- list'
```
Expected: `Litsents: tenant-loisu-agro kuni 2099-12-31 [TELEMETRY, SATELLITE, WEATHER]` ja list-rida samaga.

- [ ] **Step 3: Veakäitumine**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run tenant -- license nope --until 2030-01-01; npm run tenant -- license tenant-loisu-agro --until 2030-13-45; npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules FOO; npm run tenant -- list'
```
Expected: `Ettevõtet "nope" pole`, `Vigane kuupäev`, `Tundmatu moodul: FOO`; list näitab endiselt 2099-12-31 ja kõiki mooduleid.

Tühja moodulite loendi kontroll (ja taastamine):
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules "" && npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules TELEMETRY,SATELLITE,WEATHER && npm run tenant -- list'
```
Expected: esimene rida `[—]`, lõpuks list kõigi moodulitega.

- [ ] **Step 4: Commit**

```bash
git add src/server/tenantCli.ts vite.server.config.ts package.json
git commit -m "Käsurea ettevõtete ja litsentside haldus (npm run tenant); Loisu Agro litsents"
```

---

### Task 4: Serveri litsentsivärav ja `/api/fleet` ilma telemeetriata

**Files:**
- Create: `src/server/licenseGate.ts`
- Create: `src/server/licenseGate.test.ts`
- Modify: `src/server/apiHandler.ts:352-356` (värava kutse), `:724-905` (`GET /api/fleet`)

**Interfaces:**
- Consumes: `loadLicenseState`, `moduleForRoute`, `isAllowedWhenReadOnly`, `LicenseState`, sõnumikonstandid (Task 2); `json` (`./http.ts`)
- Produces:
  - `decideLicense(state: LicenseState, pathname: string, method: string): { status: 403; body: { error: string; code: 'MODULE_NOT_LICENSED' | 'LICENSE_READ_ONLY' } } | null`
  - `applyLicenseGate(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, tenantId: string): Promise<boolean>` — `true`, kui vastus on saadetud (keelatud)
  - `licenseOf(req: IncomingMessage): LicenseState | null`
  - `hasModule(state: LicenseState | null, m: LicenseModule): boolean`

- [ ] **Step 1: Kirjuta failiv test**

`src/server/licenseGate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { decideLicense, hasModule } from './licenseGate';
import type { LicenseState } from './license';

const full: LicenseState = { readOnly: false, validUntil: '2099-12-31', expiresSoon: false, modules: ['TELEMETRY', 'SATELLITE', 'WEATHER'] };
const basic: LicenseState = { ...full, modules: [] };
const expired: LicenseState = { ...full, readOnly: true };

describe('decideLicense', () => {
  it('lubab kõik täislitsentsiga', () => {
    expect(decideLicense(full, '/api/fleet/devices', 'POST')).toBeNull();
    expect(decideLicense(full, '/api/seasons', 'POST')).toBeNull();
  });
  it('keelab litsentsita mooduli ka lugemisel', () => {
    expect(decideLicense(basic, '/api/weather/radar', 'GET')).toEqual({
      status: 403, body: { error: 'See moodul ei kuulu teie litsentsi', code: 'MODULE_NOT_LICENSED' }
    });
    expect(decideLicense(basic, '/api/telemetry/history', 'GET')?.body.code).toBe('MODULE_NOT_LICENSED');
  });
  it('põhimoodul jääb litsentsita moodulite korral tööle', () => {
    expect(decideLicense(basic, '/api/fleet', 'GET')).toBeNull();
    expect(decideLicense(basic, '/api/seasons', 'POST')).toBeNull();
  });
  it('aegunud litsents: lugemine lubatud, muutmine keelatud', () => {
    expect(decideLicense(expired, '/api/seasons', 'GET')).toBeNull();
    expect(decideLicense(expired, '/api/satellite/cloud-check', 'POST')).toBeNull();
    expect(decideLicense(expired, '/api/seasons', 'POST')).toEqual({
      status: 403, body: { error: 'Litsents on aegunud — andmed on ainult lugemiseks', code: 'LICENSE_READ_ONLY' }
    });
  });
  it('moodulikeeld on tähtsam kui aegumine', () => {
    expect(decideLicense({ ...expired, modules: [] }, '/api/fleet/devices', 'POST')?.body.code).toBe('MODULE_NOT_LICENSED');
  });
});

describe('hasModule', () => {
  it('kontrollib moodulit; olekuta päringul pole ühtki moodulit', () => {
    expect(hasModule(full, 'TELEMETRY')).toBe(true);
    expect(hasModule(basic, 'TELEMETRY')).toBe(false);
    expect(hasModule(null, 'TELEMETRY')).toBe(false);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/licenseGate.test.ts`. Expected: FAIL — `Cannot find module './licenseGate'`.

- [ ] **Step 3: Implementeeri `licenseGate.ts`**

```ts
// src/server/licenseGate.ts
// Litsentsi jõustamine API-s: litsentsita moodulite teekonnad ja aegunud litsentsi korral
// muudatused keelatakse. Olek jäetakse päringule (licenseOf), et käsitlejad saaksid
// vastust kohandada (nt /api/fleet ilma telemeetriata).
import type { IncomingMessage, ServerResponse } from 'http';
import { json } from './http.ts';
import {
  loadLicenseState, moduleForRoute, isAllowedWhenReadOnly,
  LICENSE_READ_ONLY_MESSAGE, MODULE_NOT_LICENSED_MESSAGE,
  type LicenseState, type LicenseModule
} from './license.ts';

type Denial = { status: 403; body: { error: string; code: 'MODULE_NOT_LICENSED' | 'LICENSE_READ_ONLY' } };

export function decideLicense(state: LicenseState, pathname: string, method: string): Denial | null {
  const module = moduleForRoute(pathname);
  if (module && !state.modules.includes(module)) {
    return { status: 403, body: { error: MODULE_NOT_LICENSED_MESSAGE, code: 'MODULE_NOT_LICENSED' } };
  }
  if (state.readOnly && !isAllowedWhenReadOnly(pathname, method)) {
    return { status: 403, body: { error: LICENSE_READ_ONLY_MESSAGE, code: 'LICENSE_READ_ONLY' } };
  }
  return null;
}

const states = new WeakMap<IncomingMessage, LicenseState>();

export function licenseOf(req: IncomingMessage): LicenseState | null {
  return states.get(req) ?? null;
}

export function hasModule(state: LicenseState | null, m: LicenseModule): boolean {
  return !!state && state.modules.includes(m);
}

export async function applyLicenseGate(
  req: IncomingMessage, res: ServerResponse, pathname: string, method: string, tenantId: string
): Promise<boolean> {
  const state = await loadLicenseState(tenantId);
  states.set(req, state);
  const denial = decideLicense(state, pathname, method);
  if (!denial) return false;
  json(res, denial.body, denial.status);
  return true;
}
```
Kontrolli `src/server/http.ts` `json` signatuuri (`json(res, body, status?)`) ja kohanda vajadusel.

- [ ] **Step 4: Värav `routeApiRequest`-i**

`apiHandler.ts` pärast `setRequestUser(...)` (rida ~354) ja enne `handleAdminUsers`:
```ts
    if (sessionUser && (await applyLicenseGate(req, res, pathname, method, sessionUser.tenantId))) return;
```
Import: `import { applyLicenseGate, licenseOf, hasModule } from './licenseGate.ts';`. (`requireAuth: true` tähendab, et `/api/auth/*` välised päringud ilma sessioonita on authGate juba tagasi lükanud.)

- [ ] **Step 5: `GET /api/fleet` ilma telemeetriata** (`apiHandler.ts:724-905`)

Käsitleja alguses: `const telemetry = hasModule(licenseOf(req), 'TELEMETRY');`. Kui `!telemetry`:
- ära kutsu `fetchCellularTelemetry` ega `fetchEyeTelemetry` (rida ~779-786) — kasuta tühje `Map`-e;
- vastuses `devices: []`;
- masinatel `lastKnownPosition: null` ja `lastActiveAt: null` (rida ~752-756) — need tulevad telemeetriast;
- ülejäänud (masinad, haakeriistad, haakimised) muutmata.
Kirjuta muudatus nii, et `telemetry === true` korral on vastus baidi-täpselt sama mis enne.

- [ ] **Step 6: Testid**

Run: `npx vitest run src/server/licenseGate.test.ts src/server/license.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: kõik PASS.

Käsitsi (serveris, arendusserver või ajutine skript pole vajalik): kontrolli, et Loisu litsentsiga (Task 3) jääb kõik tööle — `npm test` sisaldab live-andmete teste.

- [ ] **Step 7: Commit**

```bash
git add src/server/licenseGate.ts src/server/licenseGate.test.ts src/server/apiHandler.ts
git commit -m "Litsentsivärav API-s (moodulid, ainult lugemine); /api/fleet ilma telemeetriata"
```

---

### Task 5: `/api/auth/me` ja sisselogimise vastus koos ettevõtte ja litsentsiga

**Files:**
- Modify: `src/server/authGate.ts` (`toAuthUser` ~46, login ~171, `/api/auth/me` ~302)
- Modify: `src/types/auth.ts`

**Interfaces:**
- Consumes: `loadLicenseState`, `LicenseState` (Task 2), `authDb()`
- Produces (klient ja server): `AuthUser` saab väljad `tenantName: string` ja `license: { readOnly: boolean; validUntil: string | null; expiresSoon: boolean; modules: LicenseModule[] }`; `src/types/auth.ts` ekspordib `type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER'` ja `interface AuthLicense`.

- [ ] **Step 1: Server**

`authGate.ts`: asenda sünkroonne `toAuthUser` asünkroonse abifunktsiooniga, mis loeb ettevõtte nime ja litsentsi:
```ts
async function authUserPayload(u: DbUser) {
  const [tenant, license] = await Promise.all([
    authDb().tenant.findUnique({ where: { id: u.tenantId }, select: { name: true } }),
    loadLicenseState(u.tenantId)
  ]);
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? null,
    isAdmin: u.isAdmin,
    isFinanceManager: u.isFinanceManager,
    mustChangePassword: u.mustChangePassword,
    tenantName: tenant?.name ?? '',
    license
  };
}
```
Login (`json(res, { user: toAuthUser(user) })`) → `json(res, { user: await authUserPayload(user) })`; `/api/auth/me` samuti. Eemalda vana `toAuthUser`, kui seda mujal ei kasutata (`grep -n toAuthUser src/server`).

- [ ] **Step 2: Kliendi tüübid** (`src/types/auth.ts`)

```ts
export type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER';

export interface AuthLicense {
  readOnly: boolean; // aegunud litsents: andmed ainult lugemiseks
  validUntil: string | null; // YYYY-MM-DD
  expiresSoon: boolean; // aegub 14 päeva jooksul
  modules: LicenseModule[];
}
```
ja `AuthUser`-isse: `tenantName: string;` ning `license: AuthLicense;`.

- [ ] **Step 3: Kontrolli**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/auth.test.ts && npm test`. Expected: PASS. Kui `tsc` näitab kliendis kohti, kus `AuthUser` luuakse käsitsi (nt testides või vaikeväärtustes), lisa neile `tenantName: ''` ja `license: { readOnly: false, validUntil: null, expiresSoon: false, modules: [] }`.

- [ ] **Step 4: Commit**

```bash
git add src/server/authGate.ts src/types/auth.ts
git commit -m "/api/auth/me ja sisselogimise vastus: ettevõtte nimi ja litsents"
```

---

### Task 6: Kliendi ülariba ja litsentsivea teade

**Files:**
- Create: `src/services/license.ts`, `src/services/license.test.ts`
- Create: `src/components/LicenseBanner.tsx`
- Modify: `src/services/api.ts:13-24` (403 käsitleja), `src/App.tsx` (riba + käsitleja registreerimine), `src/index.css` (riba stiil)

**Interfaces:**
- Consumes: `AuthUser`, `AuthLicense`, `LicenseModule` (Task 5)
- Produces:
  - `hasModule(user: AuthUser | null, m: LicenseModule): boolean` (`src/services/license.ts`)
  - `licenseBannerText(license: AuthLicense, isAdmin: boolean): string | null`
  - `setLicenseErrorHandler(fn: ((message: string) => void) | null): void` (`src/services/api.ts`)

- [ ] **Step 1: Kirjuta failiv test** (`src/services/license.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { hasModule, licenseBannerText } from './license';
import type { AuthUser, AuthLicense } from '../types/auth';

const lic = (o: Partial<AuthLicense> = {}): AuthLicense => ({ readOnly: false, validUntil: '2099-12-31', expiresSoon: false, modules: [], ...o });
const user = (license: AuthLicense, isAdmin = false): AuthUser => ({
  id: 'u', username: 'u', displayName: null, isAdmin, isFinanceManager: false, mustChangePassword: false, tenantName: 'T', license
});

describe('hasModule', () => {
  it('vaatab kasutaja litsentsi', () => {
    expect(hasModule(user(lic({ modules: ['SATELLITE'] })), 'SATELLITE')).toBe(true);
    expect(hasModule(user(lic()), 'SATELLITE')).toBe(false);
    expect(hasModule(null, 'SATELLITE')).toBe(false);
  });
});

describe('licenseBannerText', () => {
  it('aegunud litsents — kõigile', () => {
    expect(licenseBannerText(lic({ readOnly: true, validUntil: '2026-10-01' }), false))
      .toBe('Litsents aegus 01.10.2026. Andmed on ainult lugemiseks — pikendamiseks võtke ühendust teenusepakkujaga.');
  });
  it('litsents puudub', () => {
    expect(licenseBannerText(lic({ readOnly: true, validUntil: null }), false))
      .toBe('Ettevõttel puudub kehtiv litsents. Andmed on ainult lugemiseks — võtke ühendust teenusepakkujaga.');
  });
  it('aegub peagi — ainult adminile', () => {
    expect(licenseBannerText(lic({ expiresSoon: true, validUntil: '2026-10-20' }), true))
      .toBe('Litsents aegub 20.10.2026. Pikendamiseks võtke ühendust teenusepakkujaga.');
    expect(licenseBannerText(lic({ expiresSoon: true, validUntil: '2026-10-20' }), false)).toBeNull();
  });
  it('kehtiv litsents — riba pole', () => {
    expect(licenseBannerText(lic(), true)).toBeNull();
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/services/license.test.ts`. Expected: FAIL — moodulit pole.

- [ ] **Step 3: Implementeeri `src/services/license.ts`**

```ts
// src/services/license.ts — ettevõtte litsents kliendis (moodulite nähtavus, ülariba tekst)
import type { AuthUser, AuthLicense, LicenseModule } from '../types/auth';

export function hasModule(user: AuthUser | null, m: LicenseModule): boolean {
  return !!user && user.license.modules.includes(m);
}

const etDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function licenseBannerText(license: AuthLicense, isAdmin: boolean): string | null {
  if (license.readOnly) {
    return license.validUntil
      ? `Litsents aegus ${etDate(license.validUntil)}. Andmed on ainult lugemiseks — pikendamiseks võtke ühendust teenusepakkujaga.`
      : 'Ettevõttel puudub kehtiv litsents. Andmed on ainult lugemiseks — võtke ühendust teenusepakkujaga.';
  }
  if (license.expiresSoon && isAdmin && license.validUntil) {
    return `Litsents aegub ${etDate(license.validUntil)}. Pikendamiseks võtke ühendust teenusepakkujaga.`;
  }
  return null;
}
```
Kui projektis on juba kuupäeva vormindaja (`src/services/dateFormat.ts`), kasuta seda `etDate` asemel, kui see annab sama `DD.MM.YYYY` kuju.

- [ ] **Step 4: 403 litsentsivea käsitleja** (`src/services/api.ts`)

`unauthorizedHandler` kõrvale:
```ts
let licenseErrorHandler: ((message: string) => void) | null = null;

// Kutsutakse, kui server keeldub litsentsi tõttu (aegunud litsents või litsentsita moodul).
export function setLicenseErrorHandler(fn: ((message: string) => void) | null): void {
  licenseErrorHandler = fn;
}
```
`apiFetch`-is pärast 401 kontrolli:
```ts
  if (res.status === 403 && licenseErrorHandler) {
    const data = await res.clone().json().catch(() => null);
    if (data?.code === 'LICENSE_READ_ONLY' || data?.code === 'MODULE_NOT_LICENSED') licenseErrorHandler(String(data.error));
  }
```

- [ ] **Step 5: `LicenseBanner` ja App**

`src/components/LicenseBanner.tsx`:
```tsx
// Ülariba: aegunud litsents (kõigile) või peatne aegumine (adminile)
import type { AuthUser } from '../types/auth';
import { licenseBannerText } from '../services/license';

export function LicenseBanner({ user }: { user: AuthUser }) {
  const text = licenseBannerText(user.license, user.isAdmin);
  if (!text) return null;
  return (
    <div className={`license-banner ${user.license.readOnly ? 'expired' : 'warning'}`} role="status">
      {text}
    </div>
  );
}
```
`App.tsx`: `<div className="app-container">` esimeseks lapseks (enne `<Header`) `<LicenseBanner user={user} />`. Registreeri käsitleja `useEffect`-iga (sama koha lähedal, kus `setUnauthorizedHandler` registreeritakse — `grep -n setUnauthorizedHandler src`): kuva teade `alertDialog(message)`-iga (`src/components/ConfirmDialog.tsx`), aga mitte uuesti, kui eelmine sama teade on veel avatud (lipp `useRef<boolean>`); eemalda käsitleja unmount'il (`setLicenseErrorHandler(null)`).

`src/index.css`: lisa `.license-banner` (täislaiuses, keskele joondatud tekst, `padding: 6px 16px`, `font-size: 0.85rem`), `.license-banner.expired` (punakas taust, nt `#fee2e2`, tekst `#991b1b`), `.license-banner.warning` (kollakas, `#fef3c7` / `#92400e`). Kasuta olemasolevaid CSS-muutujaid, kui projektis on sobivad (`grep -n "\-\-danger\|\-\-warning" src/index.css`).

- [ ] **Step 6: Testid ja kontroll**

Run: `npx vitest run src/services/license.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.

Käsitsi (arendusserver serveris + SSH tunnel, kasutaja kinnitusel): `npm run tenant -- license tenant-loisu-agro --until 2026-01-01` → logi sisse → riba „Litsents aegus 01.01.2026…“; proovi salvestada hooaeg → teade „Litsents on aegunud — andmed on ainult lugemiseks“. **Taasta kohe:** `npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules TELEMETRY,SATELLITE,WEATHER`.

- [ ] **Step 7: Commit**

```bash
git add src/services/license.ts src/services/license.test.ts src/components/LicenseBanner.tsx src/services/api.ts src/App.tsx src/index.css
git commit -m "Litsentsi ülariba ja litsentsivea teade kliendis"
```

---

### Task 7: Litsentsita moodulite peitmine kasutajaliideses

**Files:**
- Modify: `src/App.tsx`, `src/components/LayerControl.tsx` (~318-338 masinapark, ~366-377 satelliit, ~381-397 radar), `src/components/MapView.tsx` (~540-603 radar, ~611-641 ja ~906-918 satelliit), `src/components/VehicleTracker.tsx` (~766-799 tabid, ~1671, ~1816), `src/components/FieldWorkEntryDialog.tsx` (~146-170), `src/components/FieldDetailsDrawer.tsx` (~374)

**Interfaces:**
- Consumes: `hasModule(user, m)` (`src/services/license.ts`, Task 6)

- [ ] **Step 1: Arvuta App-is ja anna edasi**

`App.tsx`:
```ts
const modules = useMemo(() => ({
  telemetry: hasModule(user, 'TELEMETRY'),
  satellite: hasModule(user, 'SATELLITE'),
  weather: hasModule(user, 'WEATHER')
}), [user]);
```
Anna `modules` (või vajalikud tõeväärtused eraldi propidena, vastavalt olemasolevale propimustrile) `LayerControl`-ile, `MapView`-le, `VehicleTracker`-ile, `FieldDetailsDrawer`-ile ja `FieldWorkEntryDialog`-ile (vaata, kus need App-is renderdatakse; kui dialoog renderdatakse sügavamal, anna prop läbi vahekomponendi).

- [ ] **Step 2: Peida**

- **Ilmaradar** (`!weather`): `LayerControl` radari rida ei renderdu; `MapView` radari efekt ei käivitu (lisa tingimus efekti algusesse koos `visibility.weatherRadar`-iga) ja legend ei renderdu. `App.tsx` `visibility.weatherRadar` algväärtus (rida ~161) jääb, aga efekt ei tee päringut.
- **Satelliit** (`!satellite`): `LayerControl` satelliidi rida ei renderdu; `MapView` satelliidi kiht ja `SatellitePanel` ei renderdu; `FieldDetailsDrawer`-is `FieldNdviSection` ei renderdu.
- **Telemeetria** (`!telemetry`): `VehicleTracker` tabid `devices` ja `deviceHistory` (nupud ja sisu) ei renderdu; kui aktiivne tab on nende seas, lülita `vehicles`-ile. `LayerControl` masinapargi live-kihi lüliti, masinate rajad/simulaator ja `CultivationControl` (App ~1737-1757) ei renderdu. `FieldWorkEntryDialog` ei tee `api.getTelemetrySuggestions` päringut ega näita soovituste plokki. Masinate ja haakeriistade tabid jäävad.

Ära muuda midagi, kui moodul on litsentsis — täislitsentsiga peab UI olema identne praegusega.

- [ ] **Step 3: Kontroll**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build` (serveris; `build` ei taaskäivita teenust). Expected: PASS.

Käsitsi (arendusserver + SSH tunnel): `npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules ""` → logi välja ja sisse → kaardikihtides pole satelliiti ega radarit, Tehnika vaates pole seadmete tabe, tööde kande dialoogis pole telemeetriasoovitusi; põllud ja masinad töötavad. **Taasta kohe:** `npm run tenant -- license tenant-loisu-agro --until 2099-12-31 --modules TELEMETRY,SATELLITE,WEATHER` ja kontrolli, et kõik on tagasi.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/LayerControl.tsx src/components/MapView.tsx src/components/VehicleTracker.tsx src/components/FieldWorkEntryDialog.tsx src/components/FieldDetailsDrawer.tsx
git commit -m "Litsentsita moodulid peidetud (telemeetria, satelliit, ilmaradar)"
```

---

### Task 8: Tootmisse viimine (kasutaja kinnitusel)

- [ ] **Step 1:** `npm run tenant -- list` näitab Loisu Agro: kuni 2099-12-31, kõik moodulid.
- [ ] **Step 2:** `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'` — tüübikontroll, testid, ehitus, taaskäivitus.
- [ ] **Step 3:** `systemctl is-active teris`, `journalctl -u teris -n 30 --no-pager`, `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts` → „KÕIK KORRAS“.
- [ ] **Step 4:** Käsitsi https://teris.ee: riba puudub, kõik kolm moodulit nähtavad.
- [ ] **Step 5:** `git push`.

---

## Väljas sellest etapist

- Litsentsi muutmine kasutajaliidesest (etapp 3, teenusepakkuja keskkond); seni käsurida.
- Muutmisnuppude peitmine aegunud litsentsi korral (kasutaja otsus: riba + serveri keeld piisab).
- Etapi 1 „Enne teise päris ettevõtte lisamist“ nimekiri kehtib edasi.

Enne etappi 3 / hiljem:

- GET /api/field-works kirjutab (fieldSeason.update) ka aegunud litsentsiga — liigutada GET-ist välja või jätta readOnly korral vahele.
- teris_app õigused tenant_licenses/tenants tabelitel karmistada (REVOKE).
- Litsentsi ülariba tumeda teema värvid.
- tenantName kuvamine UI-s.
- Automaatsete POST-ide kontroll aegunud litsentsiga testettevõttel.
- Litsentsipäringu vahemälu mitme ettevõtte korral.
