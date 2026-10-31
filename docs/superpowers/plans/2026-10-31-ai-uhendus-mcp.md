# AI ühendus (MCP server) — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kasutaja loob Terises endale API-võtme ja ühendab oma andmed AI-kliendiga (Claude Desktop jt) MCP kaudu; 11 lugemistööriista põldude, tööde/kannete, lao ja tehnika kohta, samade õigustega mis rakenduses.

**Architecture:** Uus otspunkt `/mcp/<võti>` samas Node protsessis. Võti leitakse räsi järgi platvormi tabelist `api_keys` (`authDb()`, nagu sessioon); päring käib `runInRequestContext` + `setRequestUser` sees ja iga tööriist lisaks `runAsTenant` sees, nii et ettevõtte filter ja RLS kehtivad. Iga päringu kohta luuakse olekuta `McpServer` (`@modelcontextprotocol/sdk`, Streamable HTTP, JSON-vastused), kuhu registreeritakse ainult kasutajale lubatud tööriistad. Juhis AI-le on platvormi tabelis `platform_settings` ja seda muudetakse admin.teris.ee-s.

**Tech Stack:** `node:http` server (`src/server`), Prisma 6 + PostgreSQL (RLS), `@modelcontextprotocol/sdk@1.32.1`, `zod@4.6.5`, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-mcp-server-design.md`

## Global Constraints

- Kood asub serveris; kohalik `/Users/andresj/Progemine/teris` on sshfs-mount samast kaustast. Faile muuda kohalikult (Edit/Write), **kõik käsud** (npm, npx, git, psql) jooksevad serveris:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`
- Andmebaasi ühendus käsureal: `set -a && . ./.env && set +a` ja siis `psql "${MIGRATE_DATABASE_URL%%\?*}"` (tabelite omanik).
- Varukoopia enne skeemimuudatust:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1'`
- Skeemimuudatus: `npx prisma db push` ja `npx prisma generate` (ilma `--accept-data-loss`-ita; kui Prisma seda nõuab, PEATU ja küsi kasutajalt).
- Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json`. Testid: `npx vitest run <fail>`; kõik: `npm test`.
- Iga ülesande lõpus: commit (ainult nimetatud failid, `git add <failid>`) ja `npm run release`. Commit-sõnum eesti keeles, lõpus rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Identifikaatorid (muutujad, failid, CSS klassid, URL-id, tööriistade nimed, väljanimed, staatused) inglise keeles; koodikommentaarid, UI-tekst ja veateated eesti keeles.
- Kuupäevad UI-s `pp.kk.aaaa HH:MM` Tallinna ajas (`formatDateTimeTallinn` failist `src/services/dateFormat.ts`). MCP vastustes kuupäevad `pp.kk.aaaa` Tallinna ajas.
- Kogused MCP vastustes ümardatud 2 komakohani (number, mitte tekst), alati koos ühikuga (`unit` väli).
- Finantsõigus = `isAdmin || isFinanceManager`. Ilma selleta ei tohi MCP vastuses olla ühtegi rahavälja (hind, kulu, väärtus, soetusmaksumus, rent, maamaks, tarnija, arve nr) ega tööriista `list_stock_movements`.
- Telemeetria (asukohad, `get_vehicle_activity` telemeetria osa) ainult litsentsimooduliga `TELEMETRY`.
- Võtit ei tohi kunagi logida ega salvestada lahtiselt (ainult SHA-256 räsi ja 10-märgiline prefiks).
- Vale/tühistatud/mitteaktiivse võtme kõik juhud → sama vastus `401 { "error": "Vigane võti" }`.
- `authDb()` kasutus lisandub failidesse `apiKeys.ts`, `mcp/handler.ts`, `mcp/instructions.ts` — lisa need `src/server/db.ts` kommentaari loendisse.
- Testides väljamõeldud nimed; päris isikuandmeid ei commit'ita.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `package.json` | `@modelcontextprotocol/sdk`, `zod` |
| `prisma/schema.prisma` | `ApiKey`, `PlatformSetting`, `User.apiKeys` |
| `scripts/tenancy/02-rls.sql`, `scripts/tenancy/04-privileges.sql` | uued platvormi tabelid REVOKE/GRANT loendisse |
| `src/server/db.ts` | ainult kommentaar (authDb lubatud failid) |
| `src/server/apiKeys.ts` (uus) | võtme loomine, räsi, otsing, kehtivus; `/api/api-keys` |
| `src/server/apiKeys.test.ts` (uus) | testid |
| `src/server/apiHandler.ts` | `handleApiKeys` marsruut |
| `src/server/mcp/format.ts` (uus) | puhtad abifunktsioonid: kuupäev, kogus, piiramine, nime järgi valik, vigane sisend |
| `src/server/mcp/format.test.ts` (uus) | testid |
| `src/server/mcp/context.ts` (uus) | `McpContext`, `canSeeFinance`, `defineTool`, `registerTools` |
| `src/server/mcp/instructions.ts` (uus) | vaikejuhis, lugemine, platvormi salvestus/taastamine |
| `src/server/mcp/server.ts` (uus) | `createMcpServer(ctx, instructions)` |
| `src/server/mcp/handler.ts` (uus) | `/mcp` päring: võti, piirang, kontekst, transport |
| `src/server/mcp/tools/account.ts` (uus) | `whoami`, `list_seasons` |
| `src/server/mcp/tools/fields.ts` (uus) | `list_fields`, `get_field` |
| `src/server/mcp/tools/works.ts` (uus) | `list_field_works`, `list_work_entries`, `summarize_material_usage` |
| `src/server/mcp/tools/stock.ts` (uus) | `list_stock_levels`, `list_stock_movements` |
| `src/server/mcp/tools/fleet.ts` (uus) | `list_vehicles`, `get_vehicle_activity` |
| `src/server/mcp/ignitionHours.ts` (uus) | puhas: süüte järgi tunnid päevade kaupa |
| `src/server/mcp/ignitionHours.test.ts` (uus) | testid |
| `src/server/mcp/testTenant.ts` (uus) | testide ajutine ettevõte koos andmetega |
| `src/server/mcp/mcp.test.ts` (uus) | otspunkti ja tööriistade testid (päris HTTP + SDK klient) |
| `src/server/prod.ts`, `src/server/dbApiPlugin.ts` | `/mcp` marsruut |
| `src/server/platformApi.ts` | `/api/platform/mcp-instructions` |
| `src/admin/AiInstructionsView.tsx` (uus), `src/admin/AdminApp.tsx`, `src/admin/platformApi.ts` | admini vaade |
| `src/types/apiKey.ts` (uus), `src/services/api.ts` | kliendi API |
| `src/components/AiConnectionModal.tsx` (uus), `UserMenu.tsx`, `Header.tsx`, `App.tsx`, `src/index.css` | „AI ühendus“ |
| `/etc/apache2/sites-enabled/teris.ee.conf` (serveris, mitte gitis) | `/mcp` logi ilma võtmeta |

---

### Task 1: Sõltuvused ja andmemudel

**Files:**
- Modify: `package.json` (npm install kaudu)
- Modify: `prisma/schema.prisma`
- Modify: `scripts/tenancy/02-rls.sql:29`
- Modify: `scripts/tenancy/04-privileges.sql:3-4`
- Modify: `src/server/db.ts` (authDb kommentaar)
- Test: `src/server/tenantIsolation.test.ts` (olemasolev, kontrollib platvormi tabelite õigusi)

**Interfaces:**
- Produces: Prisma mudelid `apiKey` (`id, userId, name, keyHash, keyPrefix, lastUsedAt, revokedAt, createdAt`) ja `platformSetting` (`key, value, updatedBy, updatedAt, createdAt`); `User.apiKeys`.

- [ ] **Step 1: Paigalda sõltuvused (täpsed versioonid, mõlemad üle 2 nädala vanad)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm install --save-exact @modelcontextprotocol/sdk@1.32.1 zod@4.6.5 && node -e "import(\"@modelcontextprotocol/sdk/server/mcp.js\").then(m=>console.log(typeof m.McpServer))"'
```
Expected: `function`

- [ ] **Step 2: Lisa mudelid** `prisma/schema.prisma` — `model Session` järele:

```prisma
// Kasutaja isiklik API-võti AI ühenduse (MCP) jaoks; võtit ennast ei salvestata (platvormi tabel nagu sessions)
model ApiKey {
  id         String    @id @default(cuid())
  userId     String
  name       String // kasutaja antud nimi (nt "Claude Desktop sülearvutis")
  keyHash    String    @unique // SHA-256 võtmest
  keyPrefix  String // võtme algus äratundmiseks (nt "trs_ab12cd")
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("api_keys")
}
```

ja `model HelpArticle` järele:

```prisma
// Platvormi tekstiseaded, mida teenusepakkuja muudab admin.teris.ee-s (nt AI juhis)
model PlatformSetting {
  key       String   @id // nt "mcp_instructions"
  value     String
  updatedBy String? // platvormi kasutajanimi
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@map("platform_settings")
}
```

`model User` relatsioonide plokki (`sessions Session[]` järele): `apiKeys ApiKey[]`

- [ ] **Step 3: Platvormi tabelite õigused.** `scripts/tenancy/02-rls.sql` REVOKE real ja `scripts/tenancy/04-privileges.sql` read 3–4 (REVOKE ja GRANT): lisa `help_articles` järele `, api_keys, platform_settings`.

- [ ] **Step 4: `src/server/db.ts`** authDb kommentaari loendisse (`… supportGrants.ts (loa tugisessioonide kustutamine), license.ts,`) lisa: `apiKeys.ts ja mcp/handler.ts (API-võtme otsing), mcp/instructions.ts (platvormi AI juhis),`.

- [ ] **Step 5: Varukoopia, skeem ja õigused**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1 && npx prisma db push && npx prisma generate && psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/04-privileges.sql'
```
Expected: „Your database is now in sync“, `DO`, `GRANT`, `REVOKE` ilma vigadeta. Andmekao hoiatuse korral PEATU.

- [ ] **Step 6: Kontrolli eraldust**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tenantIsolation.test.ts'`
Expected: PASS (sh „tabelitel ilma tenant_id veeruta pole teris_app rollil mingeid õigusi“).

- [ ] **Step 7: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add package.json package-lock.json prisma/schema.prisma scripts/tenancy/02-rls.sql scripts/tenancy/04-privileges.sql src/server/db.ts && git commit -m "AI ühendus: API-võtmete ja platvormi seadete tabelid, MCP teek

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 2: API-võtmed (teenus ja `/api/api-keys`)

**Files:**
- Create: `src/server/apiKeys.ts`
- Create: `src/server/apiKeys.test.ts`
- Modify: `src/server/apiHandler.ts` (import + `if (await handleApiKeys(...)) return;` pärast `handleSupportGrants`)

**Interfaces:**
- Consumes: `authDb()`, `hashToken` (`auth.ts`), `sessionUserOf` (`authGate.ts`), `APP_BASE_URL` (`mail.ts`), `json`, `parseBody` (`http.ts`).
- Produces:
  - `API_KEY_PREFIX = 'trs_'`, `MAX_ACTIVE_KEYS = 5`, `INVALID_KEY_MESSAGE = 'Vigane võti'`
  - `generateApiKey(): string`
  - `mcpUrlFor(key: string): string` → `${APP_BASE_URL}/mcp/${key}`
  - `type ApiKeyUser = { id: string; username: string; displayName: string | null; tenantId: string; isAdmin: boolean; isFinanceManager: boolean }`
  - `findActiveApiKey(key: string): Promise<{ keyId: string; lastUsedAt: Date | null; user: ApiKeyUser } | null>`
  - `touchApiKey(keyId: string, lastUsedAt: Date | null, now?: Date): Promise<void>`
  - `type ApiKeyRow = { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null }`
  - `listApiKeys(userId: string): Promise<ApiKeyRow[]>`
  - `createApiKey(userId: string, name: unknown): Promise<{ ok: true; key: string; url: string; row: ApiKeyRow } | { ok: false; status: number; error: string }>`
  - `revokeApiKey(userId: string, id: string): Promise<boolean>`
  - `handleApiKeys(req, res, pathname, method): Promise<boolean>`

- [ ] **Step 1: Kirjuta failivad testid** `src/server/apiKeys.test.ts`

```ts
// API-võtmed: loomine, piirang, kehtivus ja omaniku piir (live-andmebaas, ajutine ettevõte).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from './db';
import { generateApiKey, findActiveApiKey, createApiKey, listApiKeys, revokeApiKey, touchApiKey, MAX_ACTIVE_KEYS } from './apiKeys';

const T = `test-apikey-tenant-${process.pid}`;
const U = `test-apikey-user-${process.pid}`;
const U2 = `test-apikey-user2-${process.pid}`;

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Võtmetest', status: 'ACTIVE' } });
  await authDb().user.createMany({ data: [
    { id: U, username: U, passwordHash: 'x', tenantId: T },
    { id: U2, username: U2, passwordHash: 'x', tenantId: T }
  ] });
});

afterAll(async () => {
  await authDb().apiKey.deleteMany({ where: { userId: { in: [U, U2] } } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().user.deleteMany({ where: { id: { in: [U, U2] } } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } }).catch((e) => console.error('Testi puhastus', e));
});

describe('generateApiKey', () => {
  it('on trs_ eesliitega, base64url ja juhuslik', () => {
    const a = generateApiKey();
    expect(a).toMatch(/^trs_[A-Za-z0-9_-]{43}$/);
    expect(generateApiKey()).not.toBe(a);
  });
});

describe('võtme elutsükkel', () => {
  it('loodud võti kehtib, loendis on ainult prefiks', async () => {
    const r = await createApiKey(U, '  Sülearvuti  ');
    if (!r.ok) throw new Error(r.error);
    expect(r.url).toMatch(/\/mcp\/trs_/);
    expect(r.row.name).toBe('Sülearvuti');
    expect(r.row.keyPrefix).toBe(r.key.slice(0, 10));
    const found = await findActiveApiKey(r.key);
    expect(found?.user.id).toBe(U);
    expect(found?.user.tenantId).toBe(T);
    const rows = await listApiKeys(U);
    expect(JSON.stringify(rows)).not.toContain(r.key);
  });

  it('tühi nimi lükatakse tagasi', async () => {
    const r = await createApiKey(U, '   ');
    expect(r.ok).toBe(false);
  });

  it('tühistatud võti ei kehti; teise kasutaja võtit ei saa tühistada', async () => {
    const r = await createApiKey(U, 'Tühistatav');
    if (!r.ok) throw new Error(r.error);
    expect(await revokeApiKey(U2, r.row.id)).toBe(false);
    expect(await findActiveApiKey(r.key)).not.toBeNull();
    expect(await revokeApiKey(U, r.row.id)).toBe(true);
    expect(await findActiveApiKey(r.key)).toBeNull();
    expect((await listApiKeys(U)).some((k) => k.id === r.row.id)).toBe(false);
  });

  it('mitteaktiivne kasutaja, parooli sundvahetus ja peatatud ettevõte → võti ei kehti', async () => {
    const r = await createApiKey(U2, 'Kontroll');
    if (!r.ok) throw new Error(r.error);
    await authDb().user.update({ where: { id: U2 }, data: { isActive: false } });
    expect(await findActiveApiKey(r.key)).toBeNull();
    await authDb().user.update({ where: { id: U2 }, data: { isActive: true, mustChangePassword: true } });
    expect(await findActiveApiKey(r.key)).toBeNull();
    await authDb().user.update({ where: { id: U2 }, data: { mustChangePassword: false } });
    await authDb().tenant.update({ where: { id: T }, data: { status: 'SUSPENDED' } });
    expect(await findActiveApiKey(r.key)).toBeNull();
    await authDb().tenant.update({ where: { id: T }, data: { status: 'ACTIVE' } });
    expect(await findActiveApiKey(r.key)).not.toBeNull();
  });

  it('tundmatu või vigase kujuga võti ei kehti', async () => {
    expect(await findActiveApiKey('trs_olematu')).toBeNull();
    expect(await findActiveApiKey('')).toBeNull();
  });

  it(`kuni ${MAX_ACTIVE_KEYS} aktiivset võtit`, async () => {
    await authDb().apiKey.deleteMany({ where: { userId: U } });
    for (let i = 0; i < MAX_ACTIVE_KEYS; i++) expect((await createApiKey(U, `Võti ${i}`)).ok).toBe(true);
    const over = await createApiKey(U, 'Liigne');
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.status).toBe(400);
  });

  it('touchApiKey uuendab kuni kord 5 minuti jooksul', async () => {
    const r = await createApiKey(U2, 'Puudutus');
    if (!r.ok) throw new Error(r.error);
    const t0 = new Date('2026-10-31T10:00:00Z');
    await touchApiKey(r.row.id, null, t0);
    await touchApiKey(r.row.id, t0, new Date('2026-10-31T10:03:00Z'));
    expect((await authDb().apiKey.findUnique({ where: { id: r.row.id } }))?.lastUsedAt?.toISOString()).toBe(t0.toISOString());
    await touchApiKey(r.row.id, t0, new Date('2026-10-31T10:06:00Z'));
    expect((await authDb().apiKey.findUnique({ where: { id: r.row.id } }))?.lastUsedAt?.toISOString()).toBe('2026-10-31T10:06:00.000Z');
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/apiKeys.test.ts'`
Expected: FAIL — `Cannot find module './apiKeys'`

- [ ] **Step 3: Kirjuta** `src/server/apiKeys.ts`

```ts
// src/server/apiKeys.ts — kasutaja isiklikud API-võtmed AI ühenduse (MCP) jaoks.
// Võtit ennast ei salvestata: tabelis on SHA-256 räsi ja äratundmiseks 10-märgiline algus.
// Platvormi tabel (nagu sessions) — loetakse authDb() kaudu, enne kui päringul on ettevõtte kontekst.
import type { IncomingMessage, ServerResponse } from 'http';
import { randomBytes } from 'crypto';
import { authDb } from './db.ts';
import { hashToken } from './auth.ts';
import { sessionUserOf } from './authGate.ts';
import { APP_BASE_URL } from './mail.ts';
import { json, parseBody } from './http.ts';

export const API_KEY_PREFIX = 'trs_';
export const MAX_ACTIVE_KEYS = 5;
export const INVALID_KEY_MESSAGE = 'Vigane võti';
const NAME_MAX = 100;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const SUPPORT_FORBIDDEN = 'Tugivaates ei saa AI ühenduse võtmeid hallata';
const KEY_ROUTE = /^\/api\/api-keys\/([^/]+)$/;

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString('base64url');
}

export const mcpUrlFor = (key: string): string => `${APP_BASE_URL}/mcp/${key}`;

export type ApiKeyUser = {
  id: string;
  username: string;
  displayName: string | null;
  tenantId: string;
  isAdmin: boolean;
  isFinanceManager: boolean;
};

/** Kehtiv võti: pole tühistatud, kasutaja aktiivne ega pea parooli vahetama, ettevõte aktiivne. */
export async function findActiveApiKey(key: string): Promise<{ keyId: string; lastUsedAt: Date | null; user: ApiKeyUser } | null> {
  if (!key.startsWith(API_KEY_PREFIX) || key.length > 100) return null;
  const row = await authDb().apiKey.findUnique({
    where: { keyHash: hashToken(key) },
    include: { user: { select: { id: true, username: true, displayName: true, tenantId: true, isAdmin: true, isFinanceManager: true, isActive: true, mustChangePassword: true } } }
  });
  if (!row || row.revokedAt || !row.user.isActive || row.user.mustChangePassword) return null;
  const tenant = await authDb().tenant.findUnique({ where: { id: row.user.tenantId }, select: { status: true } });
  if (tenant?.status !== 'ACTIVE') return null;
  const { isActive: _a, mustChangePassword: _m, ...user } = row.user;
  return { keyId: row.id, lastUsedAt: row.lastUsedAt, user };
}

/** Viimase kasutamise aeg — kuni kord 5 minuti jooksul, et iga tööriistakutse ei kirjutaks. */
export async function touchApiKey(keyId: string, lastUsedAt: Date | null, now: Date = new Date()): Promise<void> {
  if (lastUsedAt && now.getTime() - lastUsedAt.getTime() < TOUCH_INTERVAL_MS) return;
  await authDb().apiKey.updateMany({ where: { id: keyId }, data: { lastUsedAt: now } });
}

export type ApiKeyRow = { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

const rowOut = (r: { id: string; name: string; keyPrefix: string; createdAt: Date; lastUsedAt: Date | null }): ApiKeyRow => ({
  id: r.id, name: r.name, keyPrefix: r.keyPrefix, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null
});

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const rows = await authDb().apiKey.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
  return rows.map(rowOut);
}

export async function createApiKey(userId: string, name: unknown): Promise<{ ok: true; key: string; url: string; row: ApiKeyRow } | { ok: false; status: number; error: string }> {
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!clean || clean.length > NAME_MAX) return { ok: false, status: 400, error: `Nimi peab olema 1–${NAME_MAX} märki` };
  const active = await authDb().apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) return { ok: false, status: 400, error: `Aktiivseid võtmeid saab olla kuni ${MAX_ACTIVE_KEYS}. Tühista mõni vana võti.` };
  const key = generateApiKey();
  const row = await authDb().apiKey.create({ data: { userId, name: clean, keyHash: hashToken(key), keyPrefix: key.slice(0, 10) } });
  return { ok: true, key, url: mcpUrlFor(key), row: rowOut(row) };
}

/** Tühistab ainult oma aktiivse võtme. */
export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const { count } = await authDb().apiKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count > 0;
}

/** /api/api-keys — sisselogitud kasutaja enda võtmed (sessioon + CSRF nagu ülejäänud API). */
export async function handleApiKeys(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (pathname !== '/api/api-keys' && !pathname.startsWith('/api/api-keys/')) return false;
  const user = sessionUserOf(req);
  if (!user) {
    json(res, { error: 'Pole sisse logitud' }, 401);
    return true;
  }
  if (user.supportView) {
    json(res, { error: SUPPORT_FORBIDDEN }, 403);
    return true;
  }
  if (pathname === '/api/api-keys' && method === 'GET') {
    json(res, await listApiKeys(user.id));
    return true;
  }
  if (pathname === '/api/api-keys' && method === 'POST') {
    const r = await createApiKey(user.id, (await parseBody(req, 16 * 1024))?.name);
    if (!r.ok) json(res, { error: r.error }, r.status);
    else json(res, { key: r.key, url: r.url, ...r.row }, 201);
    return true;
  }
  const m = KEY_ROUTE.exec(pathname);
  if (m && method === 'DELETE') {
    if (!(await revokeApiKey(user.id, decodeURIComponent(m[1])))) json(res, { error: 'Võtit ei leitud' }, 404);
    else json(res, { success: true });
    return true;
  }
  json(res, { error: 'Not found' }, 404);
  return true;
}
```

- [ ] **Step 4: Ühenda** `src/server/apiHandler.ts`: importide juurde `import { handleApiKeys } from './apiKeys.ts';` ja `if (await handleSupportGrants(req, res, pathname, method)) return;` järele:

```ts
    if (await handleApiKeys(req, res, pathname, method)) return;
```

- [ ] **Step 5: Testid ja tüübid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/apiKeys.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS, tüübivigu pole.

- [ ] **Step 6: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/apiKeys.ts src/server/apiKeys.test.ts src/server/apiHandler.ts && git commit -m "AI ühendus: kasutaja API-võtmed (loomine, tühistamine, kehtivus)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 3: MCP abifunktsioonid (puhtad)

**Files:**
- Create: `src/server/mcp/format.ts`
- Create: `src/server/mcp/format.test.ts`

**Interfaces:**
- Produces:
  - `class ToolInputError extends Error` — kasutajale näidatav sisendi viga
  - `fmtDate(d: Date | null | undefined): string | null` — `pp.kk.aaaa` Tallinna ajas
  - `fmtDateTime(d: Date | null | undefined): string | null` — `pp.kk.aaaa HH:MM` Tallinna ajas
  - `parseDateInput(s: string | undefined, label: string): Date | undefined` — `pp.kk.aaaa` või `aaaa-kk-pp` → UTC südaöö; vigane → `ToolInputError`
  - `dayAfter(d: Date): Date`
  - `round2(n: number | null | undefined): number | null`
  - `tallinnYear(now?: Date): number`
  - `limitRows<T>(rows: T[], limit: number | undefined): { total: number; shown: number; rows: T[] }` (vaikimisi 200, max 1000)
  - `type Candidate = { id: string; label: string; keys: string[] }`
  - `pickOne(kind: string, query: string, candidates: Candidate[]): Candidate` — täpne vaste (tõstutundetu) mõnele võtmele võidab; muidu osaline; 0 → `ToolInputError('<kind> "<q>" ei leitud')`; >1 → `ToolInputError('<kind> "<q>" sobib mitmele: a; b; … — täpsusta')`
  - `fieldLabel(f: { num: string; name: string }): string` → `"Nr 4 Toosi"`

- [ ] **Step 1: Kirjuta failivad testid** `src/server/mcp/format.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateTime, parseDateInput, round2, limitRows, pickOne, ToolInputError, tallinnYear, fieldLabel, dayAfter } from './format';

describe('kuupäevad', () => {
  it('vormindab Tallinna ajas', () => {
    expect(fmtDate(new Date('2026-05-10T00:00:00Z'))).toBe('10.05.2026');
    expect(fmtDate(new Date('2026-12-31T22:30:00Z'))).toBe('01.01.2027');
    expect(fmtDate(null)).toBeNull();
    expect(fmtDateTime(new Date('2026-10-31T08:05:00Z'))).toBe('31.10.2026 10:05');
  });
  it('loeb eesti ja ISO kuju', () => {
    expect(parseDateInput('5.9.2026', 'from')?.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(parseDateInput('2026-09-05', 'from')?.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(parseDateInput(undefined, 'from')).toBeUndefined();
    expect(() => parseDateInput('31.02.2026', 'to')).toThrow(ToolInputError);
    expect(() => parseDateInput('eile', 'to')).toThrow(/to/);
    expect(dayAfter(new Date('2026-09-05T00:00:00Z')).toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });
  it('aasta Tallinna ajas', () => {
    expect(tallinnYear(new Date('2026-12-31T22:30:00Z'))).toBe(2027);
  });
});

describe('arvud ja loendid', () => {
  it('ümardab 2 kohani', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(null)).toBeNull();
  });
  it('piirab ja ütleb kogusumma', () => {
    const r = limitRows([1, 2, 3], 2);
    expect(r).toEqual({ total: 3, shown: 2, rows: [1, 2] });
    expect(limitRows(Array.from({ length: 1500 }, (_, i) => i), 5000).shown).toBe(1000);
    expect(limitRows(Array.from({ length: 300 }, (_, i) => i), undefined).shown).toBe(200);
  });
  it('põllu silt', () => {
    expect(fieldLabel({ num: '4', name: 'Toosi' })).toBe('Nr 4 Toosi');
  });
});

describe('pickOne', () => {
  const c = [
    { id: '1', label: 'Nr 4 Toosi', keys: ['4', 'Toosi'] },
    { id: '2', label: 'Nr 14 Toosi alumine', keys: ['14', 'Toosi alumine'] },
    { id: '3', label: 'Nr 7 Kase', keys: ['7', 'Kase'] }
  ];
  it('täpne vaste võidab osalise', () => {
    expect(pickOne('Põld', 'toosi', c).id).toBe('1');
    expect(pickOne('Põld', '4', c).id).toBe('1');
  });
  it('üks osaline vaste', () => {
    expect(pickOne('Põld', 'kas', c).id).toBe('3');
  });
  it('mitu vastet → valikud', () => {
    expect(() => pickOne('Põld', 'oos', c)).toThrow(/sobib mitmele: Nr 4 Toosi; Nr 14 Toosi alumine/);
  });
  it('vastet pole', () => {
    expect(() => pickOne('Põld', 'Mets', c)).toThrow('Põld "Mets" ei leitud');
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/format.test.ts'`
Expected: FAIL — moodulit pole.

- [ ] **Step 3: Kirjuta** `src/server/mcp/format.ts`

```ts
// src/server/mcp/format.ts — MCP vastuste vormindus ja sisendi tõlgendus (puhtad funktsioonid).
// Kuupäevad pp.kk.aaaa Tallinna ajas, kogused 2 komakohaga, loendid piiratud koos kogusummaga.

/** Sisendi viga, mille teade näidatakse AI-le (isError tulemus). */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

const TZ = 'Europe/Tallinn';
const dateParts = new Intl.DateTimeFormat('et-EE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const part = (d: Date) => {
  const p = dateParts.formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { day: g('day'), month: g('month'), year: g('year'), hour: g('hour'), minute: g('minute') };
};

export function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = part(d);
  return `${p.day}.${p.month}.${p.year}`;
}

export function fmtDateTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = part(d);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export const tallinnYear = (now: Date = new Date()): number => Number(part(now).year);

/** 'pp.kk.aaaa' või 'aaaa-kk-pp' → UTC südaöö; tühi → undefined; vigane → ToolInputError. */
export function parseDateInput(s: string | undefined, label: string): Date | undefined {
  if (s === undefined || s.trim() === '') return undefined;
  const t = s.trim();
  let y: number, m: number, d: number;
  const et = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (et) [d, m, y] = [Number(et[1]), Number(et[2]), Number(et[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else throw new ToolInputError(`Vigane kuupäev "${s}" (${label}); kasuta pp.kk.aaaa või aaaa-kk-pp`);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new ToolInputError(`Vigane kuupäev "${s}" (${label})`);
  }
  return date;
}

export const dayAfter = (d: Date): Date => new Date(d.getTime() + 24 * 60 * 60 * 1000);

export function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export function limitRows<T>(rows: T[], limit: number | undefined): { total: number; shown: number; rows: T[] } {
  const n = Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const out = rows.slice(0, n);
  return { total: rows.length, shown: out.length, rows: out };
}

export type Candidate = { id: string; label: string; keys: string[] };

/** Nime/numbri järgi üks vaste: täpne (tõstutundetu) võidab; mitu osalist → valikud veateates. */
export function pickOne(kind: string, query: string, candidates: Candidate[]): Candidate {
  const q = query.trim().toLowerCase();
  const exact = candidates.filter((c) => c.keys.some((k) => k.toLowerCase() === q) || c.label.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = exact.length > 1 ? exact : candidates.filter((c) => c.label.toLowerCase().includes(q) || c.keys.some((k) => k.toLowerCase().includes(q)));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new ToolInputError(`${kind} "${query}" ei leitud`);
  const names = partial.slice(0, 15).map((c) => c.label).join('; ');
  throw new ToolInputError(`${kind} "${query}" sobib mitmele: ${names}${partial.length > 15 ? '; …' : ''} — täpsusta`);
}

export const fieldLabel = (f: { num: string; name: string }): string => `Nr ${f.num} ${f.name}`.trim();
```

- [ ] **Step 4: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/format.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit** (release pole vaja — kood pole veel kasutusel, aga reegel on alati release)

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/format.ts src/server/mcp/format.test.ts && git commit -m "AI ühendus: MCP vastuste vormindus ja nime järgi valik

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 4: MCP otspunkt, juhis ja esimesed tööriistad (`whoami`, `list_seasons`)

**Files:**
- Create: `src/server/mcp/context.ts`
- Create: `src/server/mcp/instructions.ts`
- Create: `src/server/mcp/server.ts`
- Create: `src/server/mcp/handler.ts`
- Create: `src/server/mcp/tools/account.ts`
- Create: `src/server/mcp/testTenant.ts`
- Create: `src/server/mcp/mcp.test.ts`
- Modify: `src/server/prod.ts`
- Modify: `src/server/dbApiPlugin.ts`

**Interfaces:**
- Consumes: `findActiveApiKey`, `touchApiKey`, `INVALID_KEY_MESSAGE` (Task 2); `ToolInputError`, `tallinnYear` (Task 3); `runInRequestContext`, `setRequestUser`, `runAsTenant`, `authDb`, `prisma` (`db.ts`); `loadLicenseState`, `LicenseState` (`license.ts`); `createLoginLimiter`, `clientIpFrom` (`auth.ts`); `parseBody`, `json` (`http.ts`); `isPlatformHost` (`platformHost.ts`).
- Produces:
  - `context.ts`: `type McpContext = { user: ApiKeyUser; tenantName: string; license: LicenseState }`; `canSeeFinance(ctx): boolean`; `hasTelemetry(ctx): boolean`; `type ToolDef`; `defineTool<S extends z.ZodRawShape>(def: { name; title; description; input: S; when?: (ctx) => boolean; run: (args: z.infer<z.ZodObject<S>>, ctx: McpContext) => Promise<unknown> }): ToolDef`; `registerTools(server: McpServer, ctx: McpContext, defs: ToolDef[]): void`
  - `instructions.ts`: `MCP_INSTRUCTIONS_KEY`, `MCP_INSTRUCTIONS_MAX = 20000`, `DEFAULT_MCP_INSTRUCTIONS`, `loadMcpInstructions(): Promise<string>`
  - `server.ts`: `createMcpServer(ctx: McpContext, instructions: string): McpServer`; `ALL_TOOLS: ToolDef[]`
  - `handler.ts`: `isMcpPath(pathname: string): boolean`; `handleMcpRequest(req, res): Promise<void>`
  - `testTenant.ts`: `createTestTenant(suffix: string, opts?: { modules?: LicenseModule[] }): Promise<TestTenant>`; `TestTenant = { tenantId; plainKey; financeKey; plainUserId; financeUserId; ids: {...}; cleanup(): Promise<void> }`
  - `mcp.test.ts` abi: `connect(key: string): Promise<Client>`

- [ ] **Step 1: Kirjuta** `src/server/mcp/context.ts`

```ts
// src/server/mcp/context.ts — MCP päringu kontekst ja tööriistade registreerimine.
// Iga tööriist jookseb võtme omaniku ettevõtte kontekstis (runAsTenant) — ettevõtte filter ja RLS kehtivad.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import { runAsTenant } from '../db.ts';
import type { ApiKeyUser } from '../apiKeys.ts';
import type { LicenseState } from '../license.ts';
import { ToolInputError } from './format.ts';

export type McpContext = { user: ApiKeyUser; tenantName: string; license: LicenseState };

export const canSeeFinance = (ctx: McpContext): boolean => ctx.user.isAdmin || ctx.user.isFinanceManager;
export const hasTelemetry = (ctx: McpContext): boolean => ctx.license.modules.includes('TELEMETRY');

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  when?: (ctx: McpContext) => boolean;
  run: (args: any, ctx: McpContext) => Promise<unknown>;
};

export function defineTool<S extends z.ZodRawShape>(def: {
  name: string;
  title: string;
  description: string;
  input: S;
  when?: (ctx: McpContext) => boolean;
  run: (args: z.infer<z.ZodObject<S>>, ctx: McpContext) => Promise<unknown>;
}): ToolDef {
  return def as ToolDef;
}

const text = (s: string) => [{ type: 'text' as const, text: s }];

export function registerTools(server: McpServer, ctx: McpContext, defs: ToolDef[]): void {
  for (const def of defs) {
    if (def.when && !def.when(ctx)) continue;
    server.registerTool(
      def.name,
      { title: def.title, description: def.description, inputSchema: def.input, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (args: unknown) => {
        try {
          const data = await runAsTenant(ctx.user.tenantId, () => def.run(args, ctx), ctx.user.username);
          return { content: text(JSON.stringify(data)) };
        } catch (err) {
          if (err instanceof ToolInputError) return { isError: true, content: text(err.message) };
          console.error('[mcp]', def.name, err instanceof Error ? err.message : err);
          return { isError: true, content: text('Serveri viga') };
        }
      }
    );
  }
}
```

- [ ] **Step 2: Kirjuta** `src/server/mcp/instructions.ts` (ainult lugemine; salvestus tuleb Task 9-s)

```ts
// src/server/mcp/instructions.ts — juhis AI-le (MCP initialize vastuse "instructions").
// Hallatakse admin.teris.ee-s (platform_settings); koodis ainult vaikejuhis.
import { authDb } from '../db.ts';

export const MCP_INSTRUCTIONS_KEY = 'mcp_instructions';
export const MCP_INSTRUCTIONS_MAX = 20000;

export const DEFAULT_MCP_INSTRUCTIONS = `Teris on põllumajandusettevõtte haldustarkvara. Andmed on ühe ettevõtte omad ja ainult lugemiseks.

Mõisted:
- Hooaeg = kalendriaasta. Põllul on igal hooajal oma pindala, kultuur ja sort.
- Töö (list_field_works) on plaan: mida põllul teha kavatsetakse.
- Kanne (list_work_entries) on tegelikult tehtud tegevus (põlluraamat): kuupäev, tegija, masin, materjalid ja kogused.
- Materjalide kulu kokku: summarize_material_usage.
- Laoseis: list_stock_levels. Laokanded ja kõik rahasummad (hinnad, kulud, väärtused) on nähtavad ainult finantsõigusega kasutajale — vaata whoami (financeAccess).

Põllu, masina, materjali ja lao saab anda nime või numbri järgi. Kui nimi sobib mitmele, tuleb vastuseks valikute loend — küsi kasutajalt täpsustust.
Loendid on piiratud: kontrolli vastuses total ja shown; kui shown < total, ütle seda kasutajale või kitsenda päringut.
Kuupäevad on kujul pp.kk.aaaa. Vasta kasutajale tema keeles.`;

export async function loadMcpInstructions(): Promise<string> {
  const row = await authDb().platformSetting.findUnique({ where: { key: MCP_INSTRUCTIONS_KEY }, select: { value: true } });
  return row && row.value.trim() ? row.value : DEFAULT_MCP_INSTRUCTIONS;
}
```

- [ ] **Step 3: Kirjuta** `src/server/mcp/tools/account.ts`

```ts
// src/server/mcp/tools/account.ts — kes ma olen ja millised hooajad on olemas.
import { prisma } from '../../db.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { tallinnYear } from '../format.ts';

export const accountTools = [
  defineTool({
    name: 'whoami',
    title: 'Kasutaja ja õigused',
    description: 'Sisselogitud kasutaja, ettevõte, finantsõigus (kas näeb hindu, kulusid ja laokandeid), litsentsi moodulid ja jooksev aasta. Kutsu esimesena.',
    input: {},
    run: async (_args, ctx) => ({
      user: ctx.user.displayName || ctx.user.username,
      username: ctx.user.username,
      company: ctx.tenantName,
      financeAccess: canSeeFinance(ctx),
      modules: ctx.license.modules,
      licenseReadOnly: ctx.license.readOnly,
      currentYear: tallinnYear()
    })
  }),
  defineTool({
    name: 'list_seasons',
    title: 'Hooajad',
    description: 'Kõik hooajad (aastad) uuemad eespool; locked = hooaeg on suletud.',
    input: {},
    run: async () => {
      const rows = await prisma.season.findMany({ orderBy: { year: 'desc' }, select: { year: true, name: true, isLocked: true } });
      return rows.map((s) => ({ year: s.year, name: s.name, locked: s.isLocked }));
    }
  })
];
```

- [ ] **Step 4: Kirjuta** `src/server/mcp/server.ts`

```ts
// src/server/mcp/server.ts — MCP server ühe päringu jaoks: ainult sellele kasutajale lubatud tööriistad.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools, type McpContext, type ToolDef } from './context.ts';
import { accountTools } from './tools/account.ts';

export const ALL_TOOLS: ToolDef[] = [...accountTools];

export function createMcpServer(ctx: McpContext, instructions: string): McpServer {
  const server = new McpServer({ name: 'teris', title: 'Teris', version: '1.0.0' }, { instructions });
  registerTools(server, ctx, ALL_TOOLS);
  return server;
}
```

- [ ] **Step 5: Kirjuta** `src/server/mcp/handler.ts`

```ts
// src/server/mcp/handler.ts — /mcp/<võti> (või /mcp + Authorization: Bearer <võti>).
// Võti → kasutaja ja ettevõte; päring käib ettevõtte kontekstis; olekuta Streamable HTTP, JSON-vastused.
// URL sisaldab võtit: seda ei logita (ka mitte vealogis).
import type { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authDb, runInRequestContext, setRequestUser } from '../db.ts';
import { json, parseBody } from '../http.ts';
import { createLoginLimiter, clientIpFrom } from '../auth.ts';
import { loadLicenseState } from '../license.ts';
import { findActiveApiKey, touchApiKey, INVALID_KEY_MESSAGE } from '../apiKeys.ts';
import { createMcpServer } from './server.ts';
import { loadMcpInstructions } from './instructions.ts';

const MCP_ROUTE = /^\/mcp(?:\/([^/]+))?\/?$/;
const MAX_BODY_BYTES = 1024 * 1024;
const limiter = createLoginLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

export const isMcpPath = (pathname: string): boolean => MCP_ROUTE.test(pathname);

function keyFrom(req: IncomingMessage, pathname: string): string {
  const fromPath = MCP_ROUTE.exec(pathname)?.[1];
  if (fromPath) return decodeURIComponent(fromPath);
  const auth = req.headers.authorization ?? '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const ip = clientIpFrom(req.headers['x-forwarded-for'], req.socket.remoteAddress);
  const limitKey = `mcp:${ip}`;
  if (limiter.isBlocked(limitKey)) return json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);

  const found = await findActiveApiKey(keyFrom(req, pathname));
  if (!found) {
    limiter.registerFailure(limitKey);
    return json(res, { error: INVALID_KEY_MESSAGE }, 401);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, { error: 'Ainult POST' }, 405);
  }

  let body: unknown;
  try {
    body = await parseBody(req, MAX_BODY_BYTES);
  } catch (err) {
    return json(res, { error: err instanceof Error && err.message === 'Päringu keha on liiga suur' ? err.message : 'Vigane JSON' }, 400);
  }

  const { user, keyId } = found;
  await runInRequestContext(async () => {
    setRequestUser({ username: user.username, tenantId: user.tenantId });
    const [license, tenant, instructions] = await Promise.all([
      loadLicenseState(user.tenantId),
      authDb().tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
      loadMcpInstructions()
    ]);
    const server = createMcpServer({ user, tenantName: tenant?.name ?? '', license }, instructions);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('[mcp] võti', keyId, err instanceof Error ? err.message : err);
      if (!res.headersSent) json(res, { error: 'Serveri viga' }, 500);
    }
  });
  await touchApiKey(keyId, found.lastUsedAt).catch((err) => console.error('[mcp] lastUsedAt', keyId, err instanceof Error ? err.message : err));
}
```

- [ ] **Step 6: Ühenda marsruut** `src/server/prod.ts` — import `import { handleMcpRequest, isMcpPath } from './mcp/handler';` ja `http.createServer` sees `/api` haru järele:

```ts
    } else if (!isPlatformHost(req) && isMcpPath(new URL(req.url ?? '/', 'http://localhost').pathname)) {
      await handleMcpRequest(req, res);
```

ning `catch` plokis asenda `console.error('[server]', err);` reaga, mis `/mcp` korral URL-i ei näita (see on juba nii — `err` ei sisalda URL-i; jäta muutmata).

`src/server/dbApiPlugin.ts` — import `import { handleMcpRequest, isMcpPath } from './mcp/handler.ts';` ja middleware'i algusesse (enne `if (!req.url?.startsWith('/api'))`):

```ts
        if (isMcpPath(new URL(req.url ?? '/', 'http://localhost').pathname)) {
          await handleMcpRequest(req, res);
          return;
        }
```

- [ ] **Step 7: Kirjuta testiettevõte** `src/server/mcp/testTenant.ts`

```ts
// src/server/mcp/testTenant.ts — MCP testide ajutine ettevõte (live-andmebaas): kaks kasutajat
// (tavaline ja finantsjuht) koos võtmetega ning väike andmestik. cleanup() kustutab kõik.
import { prisma, authDb, runAsTenant } from '../db.ts';
import { createApiKey } from '../apiKeys.ts';
import type { LicenseModule } from '../license.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

export type TestTenant = {
  tenantId: string;
  plainKey: string;
  financeKey: string;
  plainUserId: string;
  financeUserId: string;
  ids: { fieldId: number; fieldSeasonId: number; materialId: string; warehouseId: string; vehicleId: string; implementId: string; workTypeId: string };
  cleanup: () => Promise<void>;
};

export async function createTestTenant(suffix: string, opts: { modules?: LicenseModule[] } = {}): Promise<TestTenant> {
  const tenantId = `test-mcp-${suffix}-${process.pid}`;
  const plainUserId = `${tenantId}-plain`;
  const financeUserId = `${tenantId}-fin`;
  await authDb().tenant.create({ data: { id: tenantId, name: `MCP test ${suffix}`, status: 'ACTIVE' } });
  await authDb().tenantLicense.create({ data: { tenantId, validUntil: d('2099-12-31'), modules: opts.modules ?? [] } });
  await authDb().user.createMany({ data: [
    { id: plainUserId, username: plainUserId, displayName: 'Mari Tavaline', passwordHash: 'x', tenantId },
    { id: financeUserId, username: financeUserId, displayName: 'Jaan Finants', passwordHash: 'x', tenantId, isFinanceManager: true }
  ] });
  const plain = await createApiKey(plainUserId, 'test');
  const fin = await createApiKey(financeUserId, 'test');
  if (!plain.ok || !fin.ok) throw new Error('Testvõtme loomine ebaõnnestus');

  const ids = await runAsTenant(tenantId, async () => {
    const season = await prisma.season.create({ data: { year: 2026, name: '2026' } });
    const field = await prisma.field.create({ data: { num: '4', name: 'Toosi', fieldCode: 'T-4', soilType: 'Leostunud liivsavi' } });
    await prisma.field.create({ data: { num: '14', name: 'Toosi alumine', fieldCode: 'T-14' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, seasonId: season.id, year: 2026, areaHa: 12.4, crop: 'Talinisu', cropVariety: 'Ada', geometry: {} } });
    const warehouse = await prisma.warehouse.create({ data: { name: 'Põhiladu', isDefault: true } });
    const material = await prisma.material.create({ data: { name: 'Ammooniumnitraat', category: 'FERTILIZER', unit: 'kg', nPct: 34 } });
    await prisma.materialStock.create({ data: { materialId: material.id, warehouseId: warehouse.id, qty: -150, value: 0, pricedQty: 0, unpricedQty: 150 } });
    const wt = await prisma.workType.create({ data: { name: 'Mineraalväetise kasutamine', shortName: 'Väetamine', phase: 'CARE', usesMaterials: true } });
    const vehicle = await prisma.vehicle.create({ data: { name: 'Valtra T1', type: 'TRACTOR', model: 'T194', regNumber: '123ABC', acquisitionCost: 150000, lastLatitude: 58.1, lastLongitude: 25.5 } });
    const implement = await prisma.implement.create({ data: { name: 'Amazone ZA', type: 'SEEDER', workingWidthM: 24, acquisitionCost: 20000 } });
    const fw = await prisma.fieldWork.create({
      data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'CARE', plannedDateFrom: d('2026-05-01'), status: 'DONE',
        lines: { create: [{ kind: 'MATERIAL', materialId: material.id, label: 'Ammooniumnitraat', unit: 'kg', ratePerHa: 200 }] } }
    });
    await prisma.workEntry.create({
      data: {
        fieldWorkId: fw.id, date: d('2026-05-10'), areaHa: 12.4, vehicleId: vehicle.id, implementId: implement.id, equipmentHours: 3.5, fuelLiters: 40,
        lines: { create: [{ kind: 'MATERIAL', materialId: material.id, label: 'Ammooniumnitraat', quantity: 150, unit: 'kg', ratePerHa: 12.15, unitPrice: 0.45, nKgHa: 4.13 }] }
      }
    });
    await prisma.stockDocument.create({
      data: { kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: warehouse.id, documentNo: 'ARV-1',
        lines: { create: [{ materialId: material.id, quantity: 1000, amount: 450 }] } }
    });
    return { fieldId: field.id, fieldSeasonId: fs.id, materialId: material.id, warehouseId: warehouse.id, vehicleId: vehicle.id, implementId: implement.id, workTypeId: wt.id };
  });

  const cleanup = async () => {
    await runAsTenant(tenantId, async () => {
      await prisma.workEntry.deleteMany({});
      await prisma.fieldWork.deleteMany({});
      await prisma.workType.deleteMany({});
      await prisma.fieldSeason.deleteMany({});
      await prisma.field.deleteMany({});
      await prisma.season.deleteMany({});
      await prisma.stockDocument.deleteMany({});
      await prisma.materialStock.deleteMany({});
      await prisma.material.deleteMany({});
      await prisma.warehouse.deleteMany({});
      await prisma.vehicle.deleteMany({});
      await prisma.implement.deleteMany({});
    }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
    await authDb().apiKey.deleteMany({ where: { userId: { in: [plainUserId, financeUserId] } } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().user.deleteMany({ where: { tenantId } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().tenantLicense.deleteMany({ where: { tenantId } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().tenant.deleteMany({ where: { id: tenantId } }).catch((e) => console.error('Testi puhastus', e));
  };

  return { tenantId, plainKey: plain.key, financeKey: fin.key, plainUserId, financeUserId, ids, cleanup };
}
```

Kui `prisma.season.create` nõuab unikaalset `(tenantId, year)` või `field.create` muid kohustuslikke välju, kohanda andmeid skeemi järgi (`prisma/schema.prisma`) — ära muuda skeemi.

- [ ] **Step 8: Kirjuta failivad testid** `src/server/mcp/mcp.test.ts`

```ts
// MCP otspunkt päris HTTP serveriga (juhuslik port) ja SDK kliendiga; ajutised ettevõtted live-andmebaasis.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcpRequest } from './handler';
import { createTestTenant, type TestTenant } from './testTenant';

let server: http.Server;
let base = '';
let A: TestTenant;
let B: TestTenant;

async function connect(key: string): Promise<Client> {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/${key}`)));
  return client;
}

async function call(key: string, name: string, args: Record<string, unknown> = {}) {
  const client = await connect(key);
  try {
    const r = await client.callTool({ name, arguments: args });
    const textOut = (r.content as { type: string; text: string }[])[0]?.text ?? '';
    return { isError: r.isError === true, text: textOut, data: r.isError ? null : JSON.parse(textOut) };
  } finally {
    await client.close();
  }
}

beforeAll(async () => {
  server = http.createServer((req, res) => void handleMcpRequest(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  A = await createTestTenant('a', { modules: ['TELEMETRY'] });
  B = await createTestTenant('b');
}, 60_000);

afterAll(async () => {
  await A?.cleanup();
  await B?.cleanup();
  await new Promise<void>((r) => server.close(() => r()));
});

describe('autentimine', () => {
  it('vale võti → 401 sama teatega', async () => {
    const r = await fetch(`${base}/mcp/trs_vale`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'Vigane võti' });
  });
  it('võti päises töötab', async () => {
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${A.plainKey}` } } }));
    const tools = await client.listTools();
    expect(tools.tools.some((t) => t.name === 'whoami')).toBe(true);
    await client.close();
  });
  it('GET → 405', async () => {
    const r = await fetch(`${base}/mcp/${A.plainKey}`);
    expect(r.status).toBe(405);
  });
});

describe('server', () => {
  it('juhis ja ainult lugevad tööriistad', async () => {
    const client = await connect(A.plainKey);
    expect(client.getInstructions()).toContain('Teris');
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) expect(t.annotations?.readOnlyHint, t.name).toBe(true);
    await client.close();
  });
  it('whoami: tavakasutaja vs finantsjuht', async () => {
    expect((await call(A.plainKey, 'whoami')).data).toMatchObject({ user: 'Mari Tavaline', company: 'MCP test a', financeAccess: false, modules: ['TELEMETRY'] });
    expect((await call(A.financeKey, 'whoami')).data.financeAccess).toBe(true);
  });
  it('list_seasons näeb ainult oma ettevõtet', async () => {
    expect((await call(A.plainKey, 'list_seasons')).data).toEqual([{ year: 2026, name: '2026', locked: false }]);
  });
});
```

- [ ] **Step 9: Käivita testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS

- [ ] **Step 10: Commit ja release; kontrolli toodangus**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/context.ts src/server/mcp/instructions.ts src/server/mcp/server.ts src/server/mcp/handler.ts src/server/mcp/tools/account.ts src/server/mcp/testTenant.ts src/server/mcp/mcp.test.ts src/server/prod.ts src/server/dbApiPlugin.ts && git commit -m "AI ühendus: MCP otspunkt /mcp, juhis AI-le, whoami ja hooajad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release && curl -s -o /dev/null -w "%{http_code}\n" -X POST https://teris.ee/mcp/trs_vale -H "content-type: application/json" -d "{}"'
```
Expected: `401`

---

### Task 5: Põllutööriistad (`list_fields`, `get_field`)

**Files:**
- Create: `src/server/mcp/tools/fields.ts`
- Modify: `src/server/mcp/server.ts` (`ALL_TOOLS` lisa `...fieldTools`)
- Modify: `src/server/mcp/mcp.test.ts` (uus `describe`)

**Interfaces:**
- Consumes: `defineTool`, `canSeeFinance` (Task 4); `pickOne`, `fieldLabel`, `fmtDate`, `round2`, `limitRows`, `tallinnYear` (Task 3).
- Produces: `fieldTools: ToolDef[]`; `resolveFieldSeason(query: string, year: number): Promise<{ id: number; label: string }>` (kasutab ka Task 6).

- [ ] **Step 1: Lisa failivad testid** `src/server/mcp/mcp.test.ts` lõppu

```ts
describe('põllud', () => {
  it('list_fields: aasta põllud, ümardatud pindala, geomeetriata', async () => {
    const r = (await call(A.plainKey, 'list_fields', { year: 2026 })).data;
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ field: 'Nr 4 Toosi', areaHa: 12.4, crop: 'Talinisu', variety: 'Ada' });
    expect(JSON.stringify(r)).not.toContain('geometry');
  });
  it('get_field: täpne nimi võidab osalist; tööd ja kanded kaasas', async () => {
    const r = (await call(A.plainKey, 'get_field', { field: 'Toosi', year: 2026 })).data;
    expect(r.field).toBe('Nr 4 Toosi');
    expect(r.soilType).toBe('Leostunud liivsavi');
    expect(r.works[0].entries[0].materials[0]).toMatchObject({ name: 'Ammooniumnitraat', quantity: 150, unit: 'kg' });
    expect(r.works[0].entries[0].materials[0].unitPrice).toBeUndefined();
  });
  it('get_field: finantsjuht näeb hinda', async () => {
    const r = (await call(A.financeKey, 'get_field', { field: '4', year: 2026 })).data;
    expect(r.works[0].entries[0].materials[0]).toMatchObject({ unitPrice: 0.45, cost: 67.5 });
  });
  it('get_field: olematu põld → selge viga', async () => {
    const r = await call(A.plainKey, 'get_field', { field: 'Mets', year: 2026 });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('ei leitud');
  });
  it('ettevõte B ei näe ettevõtte A põlde', async () => {
    expect((await call(B.plainKey, 'list_fields', { year: 2026 })).data.total).toBe(1);
    const r = (await call(B.plainKey, 'list_fields', { year: 2026 })).data;
    expect(r.rows.every((x: { field: string }) => x.field === 'Nr 4 Toosi')).toBe(true);
    // B andmestik on samanimeline, aga eraldi: A kanne ei tohi B vastuses olla
    const g = (await call(B.plainKey, 'get_field', { field: '4', year: 2026 })).data;
    expect(g.works.flatMap((w: any) => w.entries)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts -t põllud'`
Expected: FAIL — tööriista `list_fields` pole.

- [ ] **Step 3: Kirjuta** `src/server/mcp/tools/fields.ts`

```ts
// src/server/mcp/tools/fields.ts — põllud hooaja kaupa ja ühe põllu hooaja täisvaade.
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance, type McpContext } from '../context.ts';
import { pickOne, fieldLabel, fmtDate, round2, limitRows, tallinnYear } from '../format.ts';

const year = z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta; vaikimisi jooksev aasta');
const limit = z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)');

/** Põllu hooaeg nime või numbri järgi (mitu vastet → valikud veateates). */
export async function resolveFieldSeason(query: string, y: number): Promise<{ id: number; label: string }> {
  const rows = await prisma.fieldSeason.findMany({ where: { year: y }, select: { id: true, field: { select: { num: true, name: true } } } });
  const hit = pickOne('Põld', query, rows.map((r) => ({ id: String(r.id), label: fieldLabel(r.field), keys: [r.field.num, r.field.name] })));
  return { id: Number(hit.id), label: hit.label };
}

const byNum = (a: { num: string }, b: { num: string }) => a.num.localeCompare(b.num, 'et', { numeric: true });

/** Kande materjalirea väljund; hind ja kulu ainult finantsõigusega. */
export function materialLineOut(l: { label: string; quantity: number; unit: string; ratePerHa: number | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null; unitPrice: unknown }, ctx: McpContext) {
  const unitPrice = l.unitPrice === null || l.unitPrice === undefined ? null : Number(l.unitPrice);
  return {
    name: l.label,
    quantity: round2(l.quantity),
    unit: l.unit,
    ratePerHa: round2(l.ratePerHa),
    activeIngredient: l.activeIngredient ?? undefined,
    nKgHa: round2(l.nKgHa) ?? undefined,
    pKgHa: round2(l.pKgHa) ?? undefined,
    kKgHa: round2(l.kKgHa) ?? undefined,
    ...(canSeeFinance(ctx) ? { unitPrice: round2(unitPrice), cost: unitPrice === null ? null : round2(unitPrice * l.quantity) } : {})
  };
}

export const fieldTools = [
  defineTool({
    name: 'list_fields',
    title: 'Põllud',
    description: 'Hooaja põllud: pindala, toetusõiguslik pindala, kultuur, sort, staatus, töö edenemine, külvi- ja koristuskuupäev, saagi siht ja tegelik saak (t/ha). Filtrid: aasta, kultuur, nime/numbri otsing.',
    input: { year, crop: z.string().optional().describe('Kultuur (osaline nimi)'), search: z.string().optional().describe('Põllu nimi või number (osaline)'), limit },
    run: async (a) => {
      const y = a.year ?? tallinnYear();
      const rows = await prisma.fieldSeason.findMany({
        where: {
          year: y,
          ...(a.crop ? { crop: { contains: a.crop, mode: 'insensitive' as const } } : {}),
          ...(a.search ? { field: { OR: [{ name: { contains: a.search, mode: 'insensitive' as const } }, { num: { contains: a.search, mode: 'insensitive' as const } }] } } : {})
        },
        select: {
          areaHa: true, eligibleAreaHa: true, crop: true, cropVariety: true, status: true, workProgress: true,
          seedingDate: true, harvestDate: true, targetYieldTonsHa: true, actualYieldTonsHa: true,
          field: { select: { num: true, name: true } }
        }
      });
      rows.sort((p, q) => byNum(p.field, q.field));
      const out = limitRows(rows, a.limit);
      return {
        year: y,
        total: out.total,
        shown: out.shown,
        totalAreaHa: round2(rows.reduce((s, r) => s + r.areaHa, 0)),
        rows: out.rows.map((r) => ({
          field: fieldLabel(r.field), areaHa: round2(r.areaHa), eligibleAreaHa: round2(r.eligibleAreaHa), crop: r.crop, variety: r.cropVariety,
          status: r.status, progressPct: round2(r.workProgress), seeded: fmtDate(r.seedingDate), harvested: fmtDate(r.harvestDate),
          targetYieldTHa: round2(r.targetYieldTonsHa), actualYieldTHa: round2(r.actualYieldTonsHa)
        }))
      };
    }
  }),
  defineTool({
    name: 'get_field',
    title: 'Põllu hooaeg',
    description: 'Ühe põllu hooaja täisvaade: põllu andmed, mullastik, operaator, katastriüksused, kõik plaanitud tööd ja nende kanded koos materjalidega.',
    input: { field: z.string().min(1).describe('Põllu nimi või number'), year },
    run: async (a, ctx) => {
      const y = a.year ?? tallinnYear();
      const fs = await resolveFieldSeason(a.field, y);
      const finance = canSeeFinance(ctx);
      const s = await prisma.fieldSeason.findUniqueOrThrow({
        where: { id: fs.id },
        include: {
          field: { include: { operator: { select: { name: true } } } },
          cadastralParcels: { include: { cadastralParcel: { select: { cadastralCode: true, name: true } } } },
          fieldWorks: {
            orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
            include: {
              workType: { select: { name: true, shortName: true } },
              lines: { orderBy: { sortOrder: 'asc' } },
              entries: {
                orderBy: { date: 'asc' },
                include: {
                  worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
                  lines: { where: { kind: { in: ['MATERIAL', 'HARVEST'] } }, orderBy: { sortOrder: 'asc' } }
                }
              }
            }
          }
        }
      });
      return {
        field: fs.label, year: y, areaHa: round2(s.areaHa), eligibleAreaHa: round2(s.eligibleAreaHa), crop: s.crop, variety: s.cropVariety,
        status: s.status, progressPct: round2(s.workProgress), seeded: fmtDate(s.seedingDate), harvested: fmtDate(s.harvestDate),
        targetYieldTHa: round2(s.targetYieldTonsHa), actualYieldTHa: round2(s.actualYieldTonsHa),
        priaCode: s.field.fieldCode, soilType: s.field.soilType, drainage: s.field.drainageSystem, operator: s.field.operator?.name ?? null, notes: s.notes ?? s.field.notes,
        cadastralParcels: s.cadastralParcels.map((p) => ({
          code: p.cadastralParcel.cadastralCode, name: p.cadastralParcel.name, areaHa: round2(p.fieldAreaHa), ownership: p.ownershipType,
          ...(finance ? { rentFeeEurYear: round2(p.rentFeeEurYear), landTaxEurYear: round2(p.landTaxEurYear) } : {})
        })),
        works: s.fieldWorks.map((w) => ({
          work: workTypeDisplayName(w.workType), phase: w.phase, status: w.status,
          planned: w.plannedDateFrom ? [fmtDate(w.plannedDateFrom), fmtDate(w.plannedDateTo)].filter(Boolean).join(' – ') : w.plannedText,
          plannedMaterials: w.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit })),
          entries: w.entries.map((e) => ({
            date: fmtDate(e.date), dateTo: fmtDate(e.dateTo), worker: e.worker?.name ?? null, vehicle: e.vehicle?.name ?? null, implement: e.implement?.name ?? null,
            areaHa: round2(e.areaHa), equipmentHours: round2(e.equipmentHours), fuelLiters: round2(e.fuelLiters),
            materials: e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => materialLineOut(l, ctx)),
            harvest: e.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit }))
          }))
        }))
      };
    }
  })
];
```

- [ ] **Step 4: Registreeri** `src/server/mcp/server.ts`: `import { fieldTools } from './tools/fields.ts';` ja `export const ALL_TOOLS: ToolDef[] = [...accountTools, ...fieldTools];`

- [ ] **Step 5: Testid ja tüübid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS

- [ ] **Step 6: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/tools/fields.ts src/server/mcp/server.ts src/server/mcp/mcp.test.ts && git commit -m "AI ühendus: põldude tööriistad (list_fields, get_field)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 6: Tööde ja kannete tööriistad (`list_field_works`, `list_work_entries`, `summarize_material_usage`)

**Files:**
- Create: `src/server/mcp/tools/works.ts`
- Modify: `src/server/mcp/server.ts` (`...workTools`)
- Modify: `src/server/mcp/mcp.test.ts`

**Interfaces:**
- Consumes: `resolveFieldSeason`, `materialLineOut` (Task 5); `parseDateInput`, `dayAfter`, `pickOne`, `fieldLabel`, `fmtDate`, `round2`, `limitRows`, `tallinnYear`, `ToolInputError` (Task 3).
- Produces: `workTools: ToolDef[]`; `resolveVehicleId(query: string): Promise<string>` (kasutab ka Task 8).

- [ ] **Step 1: Lisa failivad testid** `src/server/mcp/mcp.test.ts`

```ts
describe('tööd ja kanded', () => {
  it('list_field_works: plaan koos plaanitud materjaliga', async () => {
    const r = (await call(A.plainKey, 'list_field_works', { year: 2026 })).data;
    expect(r.rows[0]).toMatchObject({ field: 'Nr 4 Toosi', work: 'Väetamine', status: 'DONE', planned: '01.05.2026' });
    expect(r.rows[0].plannedMaterials[0]).toMatchObject({ name: 'Ammooniumnitraat', ratePerHa: 200, unit: 'kg' });
  });
  it('list_work_entries: kuupäevavahemik ja masina filter', async () => {
    const r = (await call(A.plainKey, 'list_work_entries', { from: '01.05.2026', to: '10.05.2026', vehicle: 'Valtra' })).data;
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ date: '10.05.2026', field: 'Nr 4 Toosi', vehicle: 'Valtra T1', equipmentHours: 3.5 });
    expect(r.rows[0].financeStatus).toBeUndefined();
    const none = (await call(A.plainKey, 'list_work_entries', { from: '11.05.2026', to: '31.05.2026' })).data;
    expect(none.total).toBe(0);
  });
  it('list_work_entries: finantsjuht näeb kulu ja staatust', async () => {
    const r = (await call(A.financeKey, 'list_work_entries', { year: 2026 })).data;
    expect(r.rows[0]).toMatchObject({ financeStatus: 'PENDING', totalCost: 67.5 });
  });
  it('summarize_material_usage: põllu kaupa; raha ainult finantsjuhile', async () => {
    const plain = (await call(A.plainKey, 'summarize_material_usage', { year: 2026, groupBy: 'field' })).data;
    expect(plain.rows[0]).toMatchObject({ material: 'Ammooniumnitraat', group: 'Nr 4 Toosi', quantity: 150, unit: 'kg', areaHa: 12.4 });
    expect(plain.rows[0].cost).toBeUndefined();
    const fin = (await call(A.financeKey, 'summarize_material_usage', { year: 2026, groupBy: 'crop' })).data;
    expect(fin.rows[0]).toMatchObject({ group: 'Talinisu', cost: 67.5 });
  });
  it('vigane kuupäev → selge viga', async () => {
    const r = await call(A.plainKey, 'list_work_entries', { from: '31.02.2026' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Vigane kuupäev');
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts -t "tööd ja kanded"'`
Expected: FAIL — tööriistu pole.

- [ ] **Step 3: Kirjuta** `src/server/mcp/tools/works.ts`

```ts
// src/server/mcp/tools/works.ts — plaanitud tööd, tegelikud kanded (põlluraamat) ja materjalikulu kokkuvõte.
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { parseDateInput, dayAfter, pickOne, fieldLabel, fmtDate, round2, limitRows, tallinnYear, ToolInputError } from '../format.ts';
import { resolveFieldSeason, materialLineOut } from './fields.ts';

const year = z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta');
const from = z.string().optional().describe('Alates (pp.kk.aaaa)');
const to = z.string().optional().describe('Kuni, kaasa arvatud (pp.kk.aaaa)');
const limit = z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)');
const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });

export async function resolveVehicleId(query: string): Promise<string> {
  const rows = await prisma.vehicle.findMany({ select: { id: true, name: true, regNumber: true } });
  return pickOne('Masin', query, rows.map((v) => ({ id: v.id, label: v.regNumber ? `${v.name} (${v.regNumber})` : v.name, keys: [v.name, v.regNumber ?? ''].filter(Boolean) }))).id;
}

function dateRange(a: { from?: string; to?: string }): Prisma.DateTimeFilter | undefined {
  const f = parseDateInput(a.from, 'from');
  const t = parseDateInput(a.to, 'to');
  if (f && t && f > t) throw new ToolInputError('Algus on hilisem kui lõpp');
  if (!f && !t) return undefined;
  return { ...(f ? { gte: f } : {}), ...(t ? { lt: dayAfter(t) } : {}) };
}

/** Kannete filter: ajavahemik või aasta (vaikimisi jooksev, kui vahemikku pole), põld, töö liik, materjal, masin. */
async function entryWhere(a: { year?: number; from?: string; to?: string; field?: string; workType?: string; material?: string; vehicle?: string }): Promise<Prisma.WorkEntryWhereInput> {
  const range = dateRange(a);
  const y = a.year ?? (range ? undefined : tallinnYear());
  const fieldSeasonId = a.field ? (await resolveFieldSeason(a.field, y ?? tallinnYear())).id : undefined;
  return {
    ...(range ? { date: range } : {}),
    fieldWork: {
      ...(y !== undefined ? { fieldSeason: { year: y } } : {}),
      ...(fieldSeasonId !== undefined ? { fieldSeasonId } : {}),
      ...(a.workType ? { workType: { OR: [{ name: ci(a.workType) }, { shortName: ci(a.workType) }] } } : {})
    },
    ...(a.material ? { lines: { some: { kind: 'MATERIAL', label: ci(a.material) } } } : {}),
    ...(a.vehicle ? { vehicleId: await resolveVehicleId(a.vehicle) } : {})
  };
}

const entryFilters = {
  year, from, to,
  field: z.string().optional().describe('Põllu nimi või number'),
  workType: z.string().optional().describe('Töö liik (osaline nimi)'),
  material: z.string().optional().describe('Materjal (osaline nimi)'),
  vehicle: z.string().optional().describe('Masina nimi või reg nr')
};

export const workTools = [
  defineTool({
    name: 'list_field_works',
    title: 'Plaanitud tööd',
    description: 'Põllutööde plaan: põld, töö liik, faas, plaanitud aeg, staatus (PLANNED/IN_PROGRESS/DONE), plaanitud pindala, viis, teostaja ja plaanitud materjalid normiga.',
    input: {
      year,
      field: z.string().optional().describe('Põllu nimi või number'),
      workType: z.string().optional().describe('Töö liik (osaline nimi)'),
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']).optional(),
      from, to, limit
    },
    run: async (a) => {
      const y = a.year ?? tallinnYear();
      const range = dateRange(a);
      const fieldSeasonId = a.field ? (await resolveFieldSeason(a.field, y)).id : undefined;
      const rows = await prisma.fieldWork.findMany({
        where: {
          fieldSeason: { year: y },
          ...(fieldSeasonId !== undefined ? { fieldSeasonId } : {}),
          ...(a.workType ? { workType: { OR: [{ name: ci(a.workType) }, { shortName: ci(a.workType) }] } } : {}),
          ...(a.status ? { status: a.status } : {}),
          ...(range ? { plannedDateFrom: range } : {})
        },
        orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
        include: {
          workType: { select: { name: true, shortName: true } },
          fieldSeason: { select: { field: { select: { num: true, name: true } } } },
          plannedWorker: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { entries: true } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        year: y, total: out.total, shown: out.shown,
        rows: out.rows.map((w) => ({
          field: fieldLabel(w.fieldSeason.field), work: workTypeDisplayName(w.workType), phase: w.phase, status: w.status,
          planned: w.plannedDateFrom ? [fmtDate(w.plannedDateFrom), fmtDate(w.plannedDateTo)].filter(Boolean).join(' – ') : w.plannedText,
          plannedAreaHa: round2(w.plannedAreaHa), method: w.method, plannedWorker: w.plannedWorker?.name ?? null, entries: w._count.entries,
          plannedMaterials: w.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit, activeIngredient: l.activeIngredient ?? undefined }))
        }))
      };
    }
  }),
  defineTool({
    name: 'list_work_entries',
    title: 'Kanded (põlluraamat)',
    description: 'Tegelikult tehtud tööd: kuupäev, põld, töö, tegija, masin, haakeriist, pindala, töötunnid, kütus, materjalid (kogus, ühik, norm/ha, toimeaine, NPK) ja saak. Finantsõigusega ka hinnad, kulud ja kinnitamise staatus. Ilma aasta ja vahemikuta: jooksev aasta.',
    input: { ...entryFilters, limit },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const rows = await prisma.workEntry.findMany({
        where: await entryWhere(a),
        orderBy: { date: 'desc' },
        include: {
          fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } },
          worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        total: out.total, shown: out.shown,
        rows: out.rows.map((e) => {
          const costed = e.lines.filter((l) => l.unitPrice !== null);
          return {
            date: fmtDate(e.date), dateTo: fmtDate(e.dateTo), field: fieldLabel(e.fieldWork.fieldSeason.field), work: workTypeDisplayName(e.fieldWork.workType),
            worker: e.worker?.name ?? null, vehicle: e.vehicle?.name ?? null, implement: e.implement?.name ?? null,
            areaHa: round2(e.areaHa), equipmentHours: round2(e.equipmentHours), laborHours: round2(e.laborHours), fuelLiters: round2(e.fuelLiters),
            method: e.method, notes: e.notes,
            materials: e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => materialLineOut(l, ctx)),
            harvest: e.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit })),
            ...(finance ? { financeStatus: e.financeStatus, totalCost: round2(costed.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0)) } : {})
          };
        })
      };
    }
  }),
  defineTool({
    name: 'summarize_material_usage',
    title: 'Materjalikulu kokku',
    description: 'Kulumaterjalide kogus kokku materjali ja põllu või kultuuri kaupa (kanded). Pindala = nende kannete pindala summa. Finantsõigusega ka summa €.',
    input: { ...entryFilters, groupBy: z.enum(['field', 'crop']).default('field').describe('Grupeeri põllu või kultuuri järgi') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const entries = await prisma.workEntry.findMany({
        where: await entryWhere(a),
        select: {
          id: true, areaHa: true,
          fieldWork: { select: { fieldSeason: { select: { crop: true, field: { select: { num: true, name: true } } } } } },
          lines: { where: { kind: 'MATERIAL', ...(a.material ? { label: ci(a.material) } : {}) }, select: { label: true, quantity: true, unit: true, unitPrice: true } }
        }
      });
      type Acc = { material: string; group: string; unit: string; quantity: number; entryIds: Set<string>; areaHa: number; cost: number };
      const acc = new Map<string, Acc>();
      for (const e of entries) {
        const fs = e.fieldWork.fieldSeason;
        const group = a.groupBy === 'crop' ? fs.crop : fieldLabel(fs.field);
        for (const l of e.lines) {
          const k = `${l.label}\u0000${l.unit}\u0000${group}`;
          const g = acc.get(k) ?? { material: l.label, group, unit: l.unit, quantity: 0, entryIds: new Set<string>(), areaHa: 0, cost: 0 };
          g.quantity += l.quantity;
          if (l.unitPrice !== null) g.cost += Number(l.unitPrice) * l.quantity;
          if (!g.entryIds.has(e.id)) {
            g.entryIds.add(e.id);
            g.areaHa += e.areaHa ?? 0;
          }
          acc.set(k, g);
        }
      }
      const rows = [...acc.values()]
        .sort((p, q) => p.material.localeCompare(q.material, 'et') || p.group.localeCompare(q.group, 'et', { numeric: true }))
        .map((g) => ({ material: g.material, group: g.group, quantity: round2(g.quantity), unit: g.unit, areaHa: round2(g.areaHa), entries: g.entryIds.size, ...(finance ? { cost: round2(g.cost) } : {}) }));
      return { groupBy: a.groupBy, total: rows.length, shown: rows.length, rows };
    }
  })
];
```

- [ ] **Step 4: Registreeri** `src/server/mcp/server.ts`: `import { workTools } from './tools/works.ts';` ja `ALL_TOOLS` lõppu `...workTools`.

- [ ] **Step 5: Testid ja tüübid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS

- [ ] **Step 6: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/tools/works.ts src/server/mcp/server.ts src/server/mcp/mcp.test.ts && git commit -m "AI ühendus: tööde, kannete ja materjalikulu tööriistad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 7: Laotööriistad (`list_stock_levels`, `list_stock_movements`)

**Files:**
- Create: `src/server/mcp/tools/stock.ts`
- Modify: `src/server/mcp/server.ts` (`...stockTools`)
- Modify: `src/server/mcp/mcp.test.ts`

**Interfaces:**
- Consumes: `defineTool`, `canSeeFinance` (Task 4); `pickOne`, `parseDateInput`, `dayAfter`, `fieldLabel`, `fmtDate`, `round2`, `limitRows`, `ToolInputError` (Task 3).
- Produces: `stockTools: ToolDef[]`

- [ ] **Step 1: Lisa failivad testid** `src/server/mcp/mcp.test.ts`

```ts
describe('ladu', () => {
  it('list_stock_levels: kogus kõigile, väärtus ainult finantsjuhile, miinus märgitud', async () => {
    const plain = (await call(A.plainKey, 'list_stock_levels')).data;
    expect(plain.rows[0]).toMatchObject({ warehouse: 'Põhiladu', material: 'Ammooniumnitraat', quantity: -150, unit: 'kg', negative: true });
    expect(plain.rows[0].value).toBeUndefined();
    const fin = (await call(A.financeKey, 'list_stock_levels')).data;
    expect(fin.rows[0]).toHaveProperty('value');
  });
  it('list_stock_movements puudub tavakasutajal, finantsjuht näeb liikumisi', async () => {
    const client = await connect(A.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.some((t) => t.name === 'list_stock_movements')).toBe(false);
    const r = (await call(A.financeKey, 'list_stock_movements', { from: '01.01.2026', to: '31.12.2026' })).data;
    expect(r.rows.map((x: { type: string }) => x.type).sort()).toEqual(['FIELD_WORK', 'RECEIPT']);
    expect(r.rows.find((x: { type: string }) => x.type === 'RECEIPT')).toMatchObject({ quantity: 1000, documentNo: 'ARV-1', cost: 450 });
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts -t ladu'`
Expected: FAIL

- [ ] **Step 3: Kirjuta** `src/server/mcp/tools/stock.ts`

```ts
// src/server/mcp/tools/stock.ts — laoseis (kogus kõigile, raha finantsõigusega) ja laoliikumised (ainult finantsõigusega).
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { pickOne, parseDateInput, dayAfter, fieldLabel, fmtDate, round2, limitRows, ToolInputError } from '../format.ts';

async function resolveWarehouseId(query: string | undefined): Promise<string | undefined> {
  if (!query) return undefined;
  const rows = await prisma.warehouse.findMany({ select: { id: true, name: true } });
  return pickOne('Ladu', query, rows.map((w) => ({ id: w.id, label: w.name, keys: [w.name] }))).id;
}

const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });

export const stockTools = [
  defineTool({
    name: 'list_stock_levels',
    title: 'Laoseis',
    description: 'Kulumaterjalide laoseis lao ja materjali kaupa (laoühikus). negative = laoseis on miinuses (kanded on kulutanud rohkem kui arvele võetud). Finantsõigusega ka väärtus (FIFO) ja keskmine hind.',
    input: { warehouse: z.string().optional().describe('Lao nimi'), material: z.string().optional().describe('Materjal (osaline nimi)') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const warehouseId = await resolveWarehouseId(a.warehouse);
      const rows = await prisma.materialStock.findMany({
        where: { ...(warehouseId ? { warehouseId } : {}), ...(a.material ? { material: { name: ci(a.material) } } : {}), OR: [{ qty: { not: 0 } }, { unpricedQty: { not: 0 } }] },
        include: { material: { select: { name: true, unit: true, category: true } }, warehouse: { select: { name: true } } }
      });
      rows.sort((p, q) => p.warehouse.name.localeCompare(q.warehouse.name, 'et') || p.material.name.localeCompare(q.material.name, 'et'));
      return {
        total: rows.length, shown: rows.length,
        rows: rows.map((r) => ({
          warehouse: r.warehouse.name, material: r.material.name, category: r.material.category, quantity: round2(r.qty), unit: r.material.unit, negative: r.qty < 0,
          ...(finance ? { value: round2(Number(r.value)), avgPrice: r.pricedQty > 0 ? round2(Number(r.value) / r.pricedQty) : null, unpricedQty: round2(r.unpricedQty) } : {})
        }))
      };
    }
  }),
  defineTool({
    name: 'list_stock_movements',
    title: 'Laoliikumised',
    description: 'Laoliikumised: arvele võtmine (RECEIPT), mahakandmine (WRITE_OFF), ülekanne (TRANSFER) ja põllutöö kande kulu (FIELD_WORK), koos tarnija, dokumendi nr ja maksumusega. Uuemad eespool.',
    when: canSeeFinance,
    input: {
      warehouse: z.string().optional().describe('Lao nimi'),
      material: z.string().optional().describe('Materjal (osaline nimi)'),
      from: z.string().optional().describe('Alates (pp.kk.aaaa)'),
      to: z.string().optional().describe('Kuni, kaasa arvatud (pp.kk.aaaa)'),
      limit: z.number().int().min(1).max(1000).optional()
    },
    run: async (a) => {
      const f = parseDateInput(a.from, 'from');
      const t = parseDateInput(a.to, 'to');
      if (f && t && f > t) throw new ToolInputError('Algus on hilisem kui lõpp');
      const date = f || t ? { ...(f ? { gte: f } : {}), ...(t ? { lt: dayAfter(t) } : {}) } : undefined;
      const warehouseId = await resolveWarehouseId(a.warehouse);
      const defaultWh = await prisma.warehouse.findFirst({ where: { isDefault: true }, select: { id: true, name: true } });
      const [docLines, entryLines] = await Promise.all([
        prisma.stockDocumentLine.findMany({
          where: {
            ...(a.material ? { material: { name: ci(a.material) } } : {}),
            document: { ...(date ? { date } : {}), ...(warehouseId ? { OR: [{ warehouseId }, { toWarehouseId: warehouseId }] } : {}) }
          },
          include: {
            material: { select: { name: true, unit: true } },
            document: { include: { warehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, supplier: { select: { name: true } } } }
          }
        }),
        prisma.workEntryLine.findMany({
          where: {
            kind: 'MATERIAL', materialId: { not: null },
            ...(a.material ? { label: ci(a.material) } : {}),
            entry: {
              ...(date ? { date } : {}),
              ...(warehouseId ? (warehouseId === defaultWh?.id ? { OR: [{ warehouseId }, { warehouseId: null }] } : { warehouseId }) : {})
            }
          },
          include: {
            entry: {
              select: {
                date: true, warehouse: { select: { name: true } },
                fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } }
              }
            }
          }
        })
      ]);
      type Row = { sortDate: Date; date: string | null; type: string; warehouse: string; toWarehouse?: string | null; material: string; quantity: number | null; unit: string; supplier?: string | null; documentNo?: string | null; reason?: string | null; field?: string; work?: string; cost: number | null };
      const rows: Row[] = [
        ...docLines.map((l) => ({
          sortDate: l.document.date, date: fmtDate(l.document.date), type: l.document.kind, warehouse: l.document.warehouse.name, toWarehouse: l.document.toWarehouse?.name ?? null,
          material: l.material.name, quantity: round2(l.quantity), unit: l.material.unit, supplier: l.document.supplier?.name ?? null, documentNo: l.document.documentNo,
          reason: l.document.writeOffReason, cost: round2(Number(l.document.kind === 'RECEIPT' ? l.amount : l.fifoCost) || null)
        })),
        ...entryLines.map((l) => ({
          sortDate: l.entry.date, date: fmtDate(l.entry.date), type: 'FIELD_WORK', warehouse: l.entry.warehouse?.name ?? defaultWh?.name ?? '',
          material: l.label, quantity: round2(l.quantity), unit: l.unit,
          field: fieldLabel(l.entry.fieldWork.fieldSeason.field), work: workTypeDisplayName(l.entry.fieldWork.workType),
          cost: l.unitPrice === null ? null : round2(Number(l.unitPrice) * l.quantity)
        }))
      ];
      rows.sort((p, q) => q.sortDate.getTime() - p.sortDate.getTime());
      const out = limitRows(rows, a.limit);
      return { total: out.total, shown: out.shown, rows: out.rows.map(({ sortDate: _s, ...r }) => r) };
    }
  })
];
```

- [ ] **Step 4: Registreeri** `src/server/mcp/server.ts`: `import { stockTools } from './tools/stock.ts';` ja `ALL_TOOLS` lõppu `...stockTools`.

- [ ] **Step 5: Testid ja tüübid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS

- [ ] **Step 6: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/tools/stock.ts src/server/mcp/server.ts src/server/mcp/mcp.test.ts && git commit -m "AI ühendus: laoseisu ja laoliikumiste tööriistad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 8: Tehnika ja telemeetria (`list_vehicles`, `get_vehicle_activity`)

**Files:**
- Create: `src/server/mcp/ignitionHours.ts`
- Create: `src/server/mcp/ignitionHours.test.ts`
- Create: `src/server/mcp/tools/fleet.ts`
- Modify: `src/server/mcp/server.ts` (`...fleetTools`)
- Modify: `src/server/mcp/mcp.test.ts`

**Interfaces:**
- Consumes: `fetchDevicePackets`, `DevicePacket` (`telemetryAccess.ts`); `buildRoute`, `DEFAULT_ROUTE_OPTIONS`, `TRIP_GAP_MS` (`tripRoute.ts`); `loadPlaces` (`tripPlaces.ts`); `resolveVehicleId` (Task 6); `defineTool`, `canSeeFinance`, `hasTelemetry` (Task 4); vormindus (Task 3).
- Produces:
  - `ignitionHoursByDay(points: { time: Date; ignition: boolean | null }[], gapMs?: number): { day: string; hours: number }[]` — `day` = `aaaa-kk-pp` Tallinna ajas
  - `fleetTools: ToolDef[]`

- [ ] **Step 1: Kirjuta failivad testid** `src/server/mcp/ignitionHours.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { ignitionHoursByDay } from './ignitionHours';

const p = (iso: string, ignition: boolean | null = true) => ({ time: new Date(iso), ignition });

describe('ignitionHoursByDay', () => {
  it('summeerib süüte sees olevad vahemikud päevade kaupa (Tallinna aeg)', () => {
    const pts = [p('2026-05-10T05:00:00Z'), p('2026-05-10T05:10:00Z'), p('2026-05-10T05:20:00Z'), p('2026-05-10T21:50:00Z'), p('2026-05-10T22:05:00Z')];
    // 05:00–05:20 = 20 min (10.05); 21:50 UTC → 11.05 00:50 Tallinna aeg, 15 min
    expect(ignitionHoursByDay(pts)).toEqual([{ day: '2026-05-10', hours: 0.33 }, { day: '2026-05-11', hours: 0.25 }]);
  });
  it('süüde väljas või liiga pikk vahe katkestab', () => {
    const pts = [p('2026-05-10T05:00:00Z'), p('2026-05-10T05:10:00Z', false), p('2026-05-10T05:20:00Z'), p('2026-05-10T06:00:00Z')];
    expect(ignitionHoursByDay(pts, 20 * 60 * 1000)).toEqual([]);
  });
  it('süüteväljata seade (null) loetakse sees olevaks', () => {
    expect(ignitionHoursByDay([p('2026-05-10T05:00:00Z', null), p('2026-05-10T05:30:00Z', null)])).toEqual([{ day: '2026-05-10', hours: 0.5 }]);
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/ignitionHours.test.ts'`
Expected: FAIL

- [ ] **Step 3: Kirjuta** `src/server/mcp/ignitionHours.ts`

```ts
// src/server/mcp/ignitionHours.ts — masina töötunnid süüte järgi päevade kaupa (Tallinna aeg).
// Kahe järjestikuse süüte-sees punkti vahe loetakse tööajaks, kui see ei ületa gapMs (sama reegel mis sõidu tuvastusel).
import { TRIP_GAP_MS } from '../tripRoute.ts';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });

export function ignitionHoursByDay(points: { time: Date; ignition: boolean | null }[], gapMs: number = TRIP_GAP_MS): { day: string; hours: number }[] {
  const ms = new Map<string, number>();
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.ignition === false || b.ignition === false) continue;
    const dt = b.time.getTime() - a.time.getTime();
    if (dt <= 0 || dt > gapMs) continue;
    const day = dayFmt.format(a.time);
    ms.set(day, (ms.get(day) ?? 0) + dt);
  }
  return [...ms].sort(([x], [y]) => x.localeCompare(y)).map(([day, v]) => ({ day, hours: Math.round((v / 3_600_000) * 100) / 100 }));
}
```

- [ ] **Step 4: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/ignitionHours.test.ts'`
Expected: PASS

- [ ] **Step 5: Lisa failivad testid** `src/server/mcp/mcp.test.ts`

```ts
describe('tehnika', () => {
  it('list_vehicles: soetusmaksumus ainult finantsjuhile, asukoht ainult telemeetriaga', async () => {
    const plain = (await call(A.plainKey, 'list_vehicles')).data;
    const v = plain.vehicles.find((x: { name: string }) => x.name === 'Valtra T1');
    expect(v).toMatchObject({ regNumber: '123ABC', lastPosition: { lat: 58.1, lng: 25.5 } });
    expect(v.acquisitionCost).toBeUndefined();
    expect(plain.implements[0]).toMatchObject({ name: 'Amazone ZA', workingWidthM: 24 });
    expect((await call(A.financeKey, 'list_vehicles')).data.vehicles[0].acquisitionCost).toBe(150000);
    const noTelemetry = (await call(B.plainKey, 'list_vehicles')).data.vehicles[0];
    expect(noTelemetry.lastPosition).toBeUndefined();
  });
  it('get_vehicle_activity: kanded; telemeetriata ettevõttel telemetry puudub', async () => {
    const r = (await call(B.plainKey, 'get_vehicle_activity', { vehicle: '123ABC', from: '01.05.2026', to: '31.05.2026' })).data;
    expect(r.entries[0]).toMatchObject({ date: '10.05.2026', field: 'Nr 4 Toosi', equipmentHours: 3.5 });
    expect(r.telemetry).toBeUndefined();
  });
  it('get_vehicle_activity: üle 31 päeva → viga', async () => {
    const r = await call(A.plainKey, 'get_vehicle_activity', { vehicle: 'Valtra', from: '01.01.2026', to: '31.03.2026' });
    expect(r.isError).toBe(true);
  });
});
```

- [ ] **Step 6: Kirjuta** `src/server/mcp/tools/fleet.ts`

```ts
// src/server/mcp/tools/fleet.ts — masinad ja haakeriistad; masina tegevus (kanded + telemeetria süüte järgi).
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { fetchDevicePackets, type DevicePacket } from '../../telemetryAccess.ts';
import { buildRoute, DEFAULT_ROUTE_OPTIONS } from '../../tripRoute.ts';
import { loadPlaces } from '../../tripPlaces.ts';
import { defineTool, canSeeFinance, hasTelemetry } from '../context.ts';
import { parseDateInput, dayAfter, fieldLabel, fmtDate, fmtDateTime, round2, ToolInputError } from '../format.ts';
import { resolveVehicleId } from './works.ts';
import { ignitionHoursByDay } from '../ignitionHours.ts';

const MAX_DAYS = 31;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });

const financeOut = (r: { acquisitionCost: number | null; acquisitionDate: Date | null; depreciationRate: number | null; depreciationMethod: string | null }) => ({
  acquisitionCost: r.acquisitionCost, acquired: fmtDate(r.acquisitionDate), depreciationRatePct: r.depreciationRate, depreciationMethod: r.depreciationMethod
});

export const fleetTools = [
  defineTool({
    name: 'list_vehicles',
    title: 'Masinad ja haakeriistad',
    description: 'Masinad (liik, mudel, reg nr, laius, juht, praegu haagitud haakeriist, viimane aktiivsus) ja haakeriistad. Telemeetria mooduliga ka viimane asukoht; finantsõigusega soetusmaksumus ja amortisatsioon.',
    input: {},
    run: async (_a, ctx) => {
      const finance = canSeeFinance(ctx);
      const telemetry = hasTelemetry(ctx);
      const now = new Date();
      const [vehicles, implementRows, hitches] = await Promise.all([
        prisma.vehicle.findMany({ orderBy: { name: 'asc' }, include: { assignedDriver: { select: { name: true } } } }),
        prisma.implement.findMany({ orderBy: { name: 'asc' } }),
        prisma.implementAssignment.findMany({
          where: { startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gt: now } }] },
          orderBy: { startedAt: 'desc' }, select: { vehicleId: true, implement: { select: { name: true } } }
        })
      ]);
      const hitchOf = new Map<string, string>();
      for (const h of hitches) if (!hitchOf.has(h.vehicleId)) hitchOf.set(h.vehicleId, h.implement.name);
      return {
        vehicles: vehicles.map((v) => ({
          name: v.name, type: v.type, category: v.category, manufacturer: v.manufacturer, model: v.model, regNumber: v.regNumber,
          powerKw: v.powerKw, workingWidthM: v.workingWidthM, driver: v.assignedDriver?.name ?? null, implement: hitchOf.get(v.id) ?? null,
          lastActive: fmtDateTime(v.lastActiveAt),
          ...(telemetry && v.lastLatitude != null && v.lastLongitude != null ? { lastPosition: { lat: v.lastLatitude, lng: v.lastLongitude } } : {}),
          ...(finance ? financeOut(v) : {})
        })),
        implements: implementRows.map((i) => ({
          name: i.name, type: i.type, category: i.category, manufacturer: i.manufacturer, model: i.model, year: i.year, workingWidthM: i.workingWidthM,
          ...(finance ? financeOut(i) : {})
        }))
      };
    }
  }),
  defineTool({
    name: 'get_vehicle_activity',
    title: 'Masina tegevus',
    description: `Masina tegevus ajavahemikus (kuni ${MAX_DAYS} päeva): selle masinaga tehtud kanded; telemeetria mooduliga lisaks süüte järgi töötunnid päevade kaupa ja põllud, kus masin käis.`,
    input: { vehicle: z.string().min(1).describe('Masina nimi või reg nr'), from: z.string().describe('Alates (pp.kk.aaaa)'), to: z.string().describe('Kuni, kaasa arvatud (pp.kk.aaaa)') },
    run: async (a, ctx) => {
      const from = parseDateInput(a.from, 'from')!;
      const to = parseDateInput(a.to, 'to')!;
      if (from > to) throw new ToolInputError('Algus on hilisem kui lõpp');
      const end = dayAfter(to);
      if ((end.getTime() - from.getTime()) / 86_400_000 > MAX_DAYS) throw new ToolInputError(`Vahemik võib olla kuni ${MAX_DAYS} päeva`);
      const vehicleId = await resolveVehicleId(a.vehicle);
      const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { name: true, regNumber: true } });
      const entries = await prisma.workEntry.findMany({
        where: { vehicleId, date: { gte: from, lt: end } },
        orderBy: { date: 'asc' },
        include: {
          implement: { select: { name: true } },
          fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } }
        }
      });
      const result: Record<string, unknown> = {
        vehicle: vehicle.name, regNumber: vehicle.regNumber, from: fmtDate(from), to: fmtDate(to),
        entries: entries.map((e) => ({
          date: fmtDate(e.date), field: fieldLabel(e.fieldWork.fieldSeason.field), work: workTypeDisplayName(e.fieldWork.workType),
          implement: e.implement?.name ?? null, areaHa: round2(e.areaHa), equipmentHours: round2(e.equipmentHours), fuelLiters: round2(e.fuelLiters)
        }))
      };
      if (!hasTelemetry(ctx)) return result;

      // Seadmed, mis olid vahemikus selle masina küljes (seoste register), ja nende GPS-paketid seose piires
      const links = await prisma.deviceAssignment.findMany({
        where: { vehicleId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gt: from } }] },
        select: { startedAt: true, endedAt: true, device: { select: { imei: true } } }
      });
      const packets: DevicePacket[] = [];
      for (const l of links) {
        if (!l.device.imei) continue;
        const s = l.startedAt > from ? l.startedAt : from;
        const t = l.endedAt && l.endedAt < end ? l.endedAt : end;
        packets.push(...(await fetchDevicePackets(l.device.imei, s, t)));
      }
      packets.sort((p, q) => p.time.getTime() - q.time.getTime());
      const byDay = new Map<string, DevicePacket[]>();
      for (const p of packets) {
        const day = dayFmt.format(p.time);
        byDay.set(day, [...(byDay.get(day) ?? []), p]);
      }
      const placesByYear = new Map<number, Awaited<ReturnType<typeof loadPlaces>>>();
      const days = [];
      for (const { day, hours } of ignitionHoursByDay(packets)) {
        const pts = (byDay.get(day) ?? []).filter((p) => p.ignition !== false);
        const y = Number(day.slice(0, 4));
        if (!placesByYear.has(y)) placesByYear.set(y, await loadPlaces(y));
        const visits = pts.length ? buildRoute(pts, placesByYear.get(y)!, DEFAULT_ROUTE_OPTIONS).visits.filter((v) => v.place.kind === 'FIELD') : [];
        days.push({
          date: fmtDate(new Date(`${day}T12:00:00Z`)), engineHours: hours,
          fields: visits.map((v) => ({ field: v.place.label, arrive: fmtDateTime(new Date(v.arrive)), leave: fmtDateTime(new Date(v.leave)) }))
        });
      }
      result.telemetry = { devices: links.filter((l) => l.device.imei).length, totalEngineHours: round2(days.reduce((s, d) => s + d.engineHours, 0)), days };
      return result;
    }
  })
];
```

Märkus: `buildRoute` tagastab `visits` ainult sõidu sees; kui päeva punktid sisaldavad mitut sõitu, on külastused ikkagi õiged (vaste tehakse punkti kaupa). Kui `tsdb` puudub (testkeskkond), tagastab `fetchDevicePackets` tühja loendi ja `days` on tühi.

- [ ] **Step 7: Registreeri** `src/server/mcp/server.ts`: `import { fleetTools } from './tools/fleet.ts';` ja `ALL_TOOLS` lõppu `...fleetTools`.

- [ ] **Step 8: Testid ja tüübid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS

- [ ] **Step 9: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/ignitionHours.ts src/server/mcp/ignitionHours.test.ts src/server/mcp/tools/fleet.ts src/server/mcp/server.ts src/server/mcp/mcp.test.ts && git commit -m "AI ühendus: masinate ja masina tegevuse tööriistad (süüte järgi tunnid)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 9: Juhis AI-le admin.teris.ee-s

**Files:**
- Modify: `src/server/mcp/instructions.ts` (salvestus, taastamine, admini lugemine)
- Modify: `src/server/platformApi.ts` (`/api/platform/mcp-instructions`)
- Modify: `src/server/mcp/mcp.test.ts` (juhise test)
- Create: `src/admin/AiInstructionsView.tsx`
- Modify: `src/admin/AdminApp.tsx`, `src/admin/platformApi.ts`

**Interfaces:**
- Consumes: `MCP_INSTRUCTIONS_KEY`, `MCP_INSTRUCTIONS_MAX`, `DEFAULT_MCP_INSTRUCTIONS`, `loadMcpInstructions` (Task 4).
- Produces:
  - `getMcpInstructionsAdmin(): Promise<McpInstructionsDto>`; `McpInstructionsDto = { value: string; isDefault: boolean; defaultValue: string; updatedBy: string | null; updatedAt: string | null; maxLength: number }`
  - `saveMcpInstructions(value: unknown, pu: { id: string; username: string }): Promise<{ ok: true } | { ok: false; error: string }>`
  - `resetMcpInstructions(pu): Promise<void>`
  - kliendis `platformApi.getMcpInstructions()`, `saveMcpInstructions(value)`, `resetMcpInstructions()`

- [ ] **Step 1: Lisa failiv test** `src/server/mcp/mcp.test.ts`

```ts
import { saveMcpInstructions, resetMcpInstructions, getMcpInstructionsAdmin, DEFAULT_MCP_INSTRUCTIONS } from './instructions';
import { authDb } from '../db';

describe('juhis AI-le', () => {
  const pu = { id: `test-pu-${process.pid}`, username: 'testplatvorm' };
  afterAll(async () => {
    await resetMcpInstructions(pu);
    await authDb().platformAuditLog.deleteMany({ where: { platformUserId: pu.id } });
  });
  it('salvestatud juhis jõuab kliendini; taastamine annab vaikejuhise', async () => {
    const before = await getMcpInstructionsAdmin();
    expect(before.isDefault).toBe(true);
    expect((await saveMcpInstructions('Testjuhis: vasta lühidalt.', pu)).ok).toBe(true);
    const client = await connect(A.plainKey);
    expect(client.getInstructions()).toBe('Testjuhis: vasta lühidalt.');
    await client.close();
    expect((await getMcpInstructionsAdmin()).updatedBy).toBe('testplatvorm');
    await resetMcpInstructions(pu);
    const c2 = await connect(A.plainKey);
    expect(c2.getInstructions()).toBe(DEFAULT_MCP_INSTRUCTIONS);
    await c2.close();
    const log = await authDb().platformAuditLog.findMany({ where: { platformUserId: pu.id }, select: { action: true } });
    expect(log.map((l) => l.action).sort()).toEqual(['MCP_INSTRUCTIONS_RESET', 'MCP_INSTRUCTIONS_UPDATE']);
  });
  it('liiga pikk või tühi juhis lükatakse tagasi', async () => {
    expect((await saveMcpInstructions('x'.repeat(20001), pu)).ok).toBe(false);
    expect((await saveMcpInstructions('   ', pu)).ok).toBe(false);
  });
});
```

(`import` read pane faili algusesse teiste importide juurde; `afterAll` on juba imporditud.)

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts -t "juhis AI-le"'`
Expected: FAIL — `saveMcpInstructions` puudub.

- [ ] **Step 3: Lisa** `src/server/mcp/instructions.ts` lõppu

```ts
export type McpInstructionsDto = { value: string; isDefault: boolean; defaultValue: string; updatedBy: string | null; updatedAt: string | null; maxLength: number };

export async function getMcpInstructionsAdmin(): Promise<McpInstructionsDto> {
  const row = await authDb().platformSetting.findUnique({ where: { key: MCP_INSTRUCTIONS_KEY } });
  const isDefault = !row || !row.value.trim();
  return {
    value: isDefault ? DEFAULT_MCP_INSTRUCTIONS : row.value,
    isDefault,
    defaultValue: DEFAULT_MCP_INSTRUCTIONS,
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    maxLength: MCP_INSTRUCTIONS_MAX
  };
}

export async function saveMcpInstructions(value: unknown, pu: { id: string; username: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, error: 'Juhis on tühi — vaikejuhise taastamiseks kasuta „Taasta vaikejuhis“' };
  if (value.length > MCP_INSTRUCTIONS_MAX) return { ok: false, error: `Juhis on liiga pikk (kuni ${MCP_INSTRUCTIONS_MAX} märki)` };
  await authDb().$transaction(async (tx) => {
    await tx.platformSetting.upsert({
      where: { key: MCP_INSTRUCTIONS_KEY },
      create: { key: MCP_INSTRUCTIONS_KEY, value, updatedBy: pu.username },
      update: { value, updatedBy: pu.username }
    });
    await tx.platformAuditLog.create({ data: { action: 'MCP_INSTRUCTIONS_UPDATE', platformUserId: pu.id, targetTenantId: null, details: { length: value.length } } });
  });
  return { ok: true };
}

export async function resetMcpInstructions(pu: { id: string; username: string }): Promise<void> {
  await authDb().$transaction(async (tx) => {
    const { count } = await tx.platformSetting.deleteMany({ where: { key: MCP_INSTRUCTIONS_KEY } });
    if (count > 0) await tx.platformAuditLog.create({ data: { action: 'MCP_INSTRUCTIONS_RESET', platformUserId: pu.id, targetTenantId: null } });
  });
}
```

- [ ] **Step 4: Platvormi teekonnad** `src/server/platformApi.ts` — import `import { getMcpInstructionsAdmin, saveMcpInstructions, resetMcpInstructions } from './mcp/instructions.ts';` ja `route()` sees juhendite (`HELP_PLATFORM_ROUTE`) ploki järele:

```ts
  if (pathname === '/api/platform/mcp-instructions') {
    if (method === 'GET') return json(res, await getMcpInstructionsAdmin());
    if (method === 'PUT') {
      const r = await saveMcpInstructions((await readBody(req))?.value, pu);
      if (!r.ok) throw new HttpError(400, r.error);
      return json(res, await getMcpInstructionsAdmin());
    }
    if (method === 'DELETE') {
      await resetMcpInstructions(pu);
      return json(res, await getMcpInstructionsAdmin());
    }
  }
```

- [ ] **Step 5: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts'`
Expected: PASS. Märkus: reset-testi järjekord — kui `RESET` audit ei teki, sest kirjet polnud, kontrolli, et `saveMcpInstructions` jooksis enne.

- [ ] **Step 6: Kliendi API** `src/admin/platformApi.ts` — tüüp `HelpArticleRow` järele:

```ts
export type McpInstructions = { value: string; isDefault: boolean; defaultValue: string; updatedBy: string | null; updatedAt: string | null; maxLength: number };
```

ja `platformApi` objekti `saveHelp` järele:

```ts
  getMcpInstructions: () => request<McpInstructions>('GET', '/mcp-instructions'),
  saveMcpInstructions: (value: string) => request<McpInstructions>('PUT', '/mcp-instructions', { value }, 'Juhise salvestamine ebaõnnestus'),
  resetMcpInstructions: () => request<McpInstructions>('DELETE', '/mcp-instructions', undefined, 'Vaikejuhise taastamine ebaõnnestus'),
```

- [ ] **Step 7: Vaade** `src/admin/AiInstructionsView.tsx`

```tsx
// AI ühenduse juhis: tekst, mille MCP server saadab AI-kliendile ühenduse alguses (kõigile ettevõtetele ühine).
import { useEffect, useState } from 'react';
import { platformApi, type McpInstructions } from './platformApi.ts';
import { formatTallinn } from './format.ts';

export function AiInstructionsView() {
  const [data, setData] = useState<McpInstructions | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (d: McpInstructions) => {
    setData(d);
    setDraft(d.value);
  };

  useEffect(() => {
    platformApi.getMcpInstructions().then(apply).catch((err) => setError((err as Error).message));
  }, []);

  const run = async (fn: () => Promise<McpInstructions>, done: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      apply(await fn());
      setNotice(done);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="glass-card admin-card">{error || 'Laen…'}</div>;
  const dirty = draft !== data.value;

  return (
    <div className="glass-card admin-card">
      <h2>AI ühendus — juhis AI-le</h2>
      <p className="muted">
        Seda teksti näeb AI-klient (nt Claude) iga uue ühenduse alguses. Juhis on kõigile ettevõtetele ühine. Muudatus kehtib kasutaja järgmisest ühendusest.
      </p>
      <p className="muted">
        {data.isDefault ? 'Kehtib vaikejuhis (koodis).' : `Muudetud: ${data.updatedAt ? formatTallinn(data.updatedAt) : '–'}${data.updatedBy ? `, ${data.updatedBy}` : ''}`}
      </p>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box">{notice}</div>}
      <textarea
        className="form-input ai-instructions-input"
        value={draft}
        maxLength={data.maxLength}
        rows={22}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="ai-instructions-footer">
        <span className="muted num">{draft.length} / {data.maxLength}</span>
        <button type="button" className="btn btn-secondary" disabled={busy || data.isDefault} onClick={() => void run(() => platformApi.resetMcpInstructions(), 'Vaikejuhis taastatud')}>
          Taasta vaikejuhis
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty || !draft.trim()} onClick={() => void run(() => platformApi.saveMcpInstructions(draft), 'Juhis salvestatud')}>
          Salvesta
        </button>
      </div>
    </div>
  );
}
```

Kontrolli enne: `grep -n "export" src/admin/format.ts` — kui `formatTallinn` võtab ISO stringi ja tagastab `pp.kk.aaaa HH:MM`, kasuta seda; muidu kasuta `formatDateTimeTallinn` failist `src/services/dateFormat.ts`. Stiil: lisa `src/admin/admin.css` lõppu

```css
.ai-instructions-input { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.5; resize: vertical; }
.ai-instructions-footer { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-top: 12px; }
.ai-instructions-footer .muted { margin-right: auto; }
```

- [ ] **Step 8: Menüü** `src/admin/AdminApp.tsx`:
  - import `import { AiInstructionsView } from './AiInstructionsView.tsx';`
  - `type View` lisa `| { kind: 'ai' }`
  - „Ettevõtted“ nupu `includes([...])` loendisse lisa `'ai'`
  - „Juhendid“ nupu järele:

```tsx
        <button type="button" className={`btn btn-secondary ${view.kind === 'ai' ? 'active' : ''}`} onClick={() => setView({ kind: 'ai' })}>
          AI ühendus
        </button>
```

  - `{view.kind === 'help' && <HelpView />}` järele `{view.kind === 'ai' && <AiInstructionsView />}`

- [ ] **Step 9: Tüübid, testid, commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/mcp && git add src/server/mcp/instructions.ts src/server/platformApi.ts src/server/mcp/mcp.test.ts src/admin/AiInstructionsView.tsx src/admin/AdminApp.tsx src/admin/platformApi.ts src/admin/admin.css && git commit -m "AI ühendus: juhis AI-le hallatakse admin.teris.ee-s

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

- [ ] **Step 10: Käsitsi kontroll** — ava admin.teris.ee → „AI ühendus“: vaikejuhis on näha, salvesta muudetud tekst → „Muudetud: pp.kk.aaaa HH:MM, <kasutaja>“; „Taasta vaikejuhis“ → „Kehtib vaikejuhis“. Jäta lõpuks vaikejuhis kehtima (või kasutaja soovitud tekst).

---

### Task 10: „AI ühendus“ kasutajamenüüs

**Files:**
- Create: `src/types/apiKey.ts`
- Modify: `src/services/api.ts`
- Create: `src/components/AiConnectionModal.tsx`
- Modify: `src/components/UserMenu.tsx`, `src/components/Header.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `/api/api-keys` (Task 2); `confirmDialog` (`src/components/ConfirmDialog`); `formatDateTimeTallinn` (`src/services/dateFormat.ts`).
- Produces: `api.listApiKeys()`, `api.createApiKey(name)`, `api.revokeApiKey(id)`; `AiConnectionModal({ isOpen, onClose })`; `UserMenu`/`Header` prop `onOpenAiConnection?: () => void`.

- [ ] **Step 1: Tüübid** `src/types/apiKey.ts`

```ts
// src/types/apiKey.ts — AI ühenduse (MCP) API-võti; võtit ennast näidatakse ainult loomisel.
export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string; // ISO
  lastUsedAt: string | null; // ISO
}

export interface CreatedApiKey extends ApiKeyRow {
  key: string;
  url: string;
}
```

- [ ] **Step 2: Kliendi API** `src/services/api.ts` — import `import type { ApiKeyRow, CreatedApiKey } from '../types/apiKey';` ja `api` objekti `changePassword` järele:

```ts
  async listApiKeys(): Promise<ApiKeyRow[]> {
    const res = await apiFetch('/api/api-keys');
    if (!res.ok) throw new Error(await errorMessage(res, 'Võtmete laadimine ebaõnnestus'));
    return res.json();
  },

  async createApiKey(name: string): Promise<CreatedApiKey> {
    const res = await apiFetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Võtme loomine ebaõnnestus'));
    return res.json();
  },

  async revokeApiKey(id: string): Promise<void> {
    const res = await apiFetch(`/api/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Võtme tühistamine ebaõnnestus'));
  },
```

- [ ] **Step 3: Modaal** `src/components/AiConnectionModal.tsx`

```tsx
// src/components/AiConnectionModal.tsx — „AI ühendus“: kasutaja enda API-võtmed AI-kliendi (MCP) jaoks.
// Täielikku linki näidatakse ainult kohe pärast loomist.
import React, { useCallback, useEffect, useState } from 'react';
import { X, Bot, AlertCircle, Copy, Check, Trash2, Plus } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog } from './ConfirmDialog';
import { formatDateTimeTallinn } from '../services/dateFormat';
import type { ApiKeyRow, CreatedApiKey } from '../types/apiKey';

interface AiConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiConnectionModal: React.FC<AiConnectionModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setKeys(await api.listApiKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtmete laadimine ebaõnnestus');
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const close = () => {
    setName('');
    setCreated(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const k = await api.createApiKey(name.trim());
      setCreated(k);
      setCopied(false);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtme loomine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError('Kopeerimine ebaõnnestus — vali link ja kopeeri käsitsi');
    }
  };

  const revoke = async (k: ApiKeyRow) => {
    if (!(await confirmDialog(`Tühistada võti "${k.name}"?\n\nSeda kasutav AI-ühendus lakkab kohe töötamast.`))) return;
    setError(null);
    try {
      await api.revokeApiKey(k.id);
      if (created?.id === k.id) setCreated(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtme tühistamine ebaõnnestus');
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-content animate-scale-up ai-connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Bot className="text-emerald" size={22} />
            <h3>AI ühendus</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-subtitle">
            Ühenda oma Terise andmed AI-assistendiga (nt Claude). AI saab andmeid ainult lugeda ja näeb sama, mida sina Terises.
          </p>
          {error && (
            <div className="alert-box error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {created && (
            <div className="ai-key-created">
              <div className="alert-box">
                <AlertCircle size={16} />
                <span>Linki näidatakse ainult üks kord. See annab ligipääsu sinu Terise andmetele — ära jaga seda.</span>
              </div>
              <div className="ai-key-url">
                <input className="form-input" readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="btn btn-primary" onClick={() => void copy()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Kopeeritud' : 'Kopeeri'}</span>
                </button>
              </div>
            </div>
          )}

          <form className="ai-key-new" onSubmit={create}>
            <input
              className="form-input"
              placeholder="Võtme nimi, nt Claude Desktop sülearvutis"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={busy || !name.trim()}>
              <Plus size={16} />
              <span>Loo uus võti</span>
            </button>
          </form>

          <table className="ai-key-table">
            <thead>
              <tr>
                <th>Nimi</th>
                <th>Võti</th>
                <th>Loodud</th>
                <th>Viimati kasutatud</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys?.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">Võtmeid pole</td>
                </tr>
              )}
              {keys?.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td><code>{k.keyPrefix}…</code></td>
                  <td>{formatDateTimeTallinn(k.createdAt)}</td>
                  <td>{formatDateTimeTallinn(k.lastUsedAt)}</td>
                  <td>
                    <button type="button" className="icon-btn-ghost" title="Tühista" aria-label={`Tühista ${k.name}`} onClick={() => void revoke(k)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ai-key-help">
            <strong>Kuidas ühendada</strong>
            <ol>
              <li>Loo võti ja kopeeri link.</li>
              <li>Ava AI-kliendis connectorite seaded ja lisa uus MCP connector (nt Claude Desktop → Settings → Connectors → Add custom connector).</li>
              <li>Kleebi link URL-i väljale ja salvesta. Seejärel küsi AI-lt näiteks „Mis põllud mul tänavu on?“</li>
            </ol>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={close}>Sulge</button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Stiil** `src/index.css` — `.change-password-modal` reeglite järele:

```css
.ai-connection-modal { max-width: 720px; width: 100%; }
.ai-key-created { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.ai-key-url, .ai-key-new { display: flex; gap: 8px; }
.ai-key-url .form-input, .ai-key-new .form-input { flex: 1; min-width: 0; }
.ai-key-url .form-input { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.ai-key-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
.ai-key-table th, .ai-key-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border-color); }
.ai-key-help { font-size: 13px; }
.ai-key-help ol { margin: 6px 0 0 18px; padding: 0; }
@media (max-width: 640px) {
  .ai-key-url, .ai-key-new { flex-direction: column; }
  .ai-key-table th:nth-child(3), .ai-key-table td:nth-child(3) { display: none; }
}
```

Kontrolli, et `--border-color` muutuja on olemas (`grep -n "\-\-border" src/index.css | head -3`); kui nimi erineb, kasuta olemasolevat äärise muutujat.

- [ ] **Step 5: Menüü** `src/components/UserMenu.tsx`:
  - importi `Bot` lucide-react'ist
  - props liidesesse ja destruktureerimisse `onOpenAiConnection?: () => void;`
  - „Muuda parooli“ nupu järele (samas `!user.supportView` tingimuses eraldi plokina):

```tsx
          {!user.supportView && onOpenAiConnection && (
            <button type="button" role="menuitem" className="user-menu-item" onClick={run(onOpenAiConnection)}>
              <Bot size={15} />
              <span>AI ühendus</span>
            </button>
          )}
```

`src/components/Header.tsx`: props liidesesse `onOpenAiConnection?: () => void;`, destruktureerimisse ja `<UserMenu … onOpenAiConnection={onOpenAiConnection} />`.

`src/App.tsx`:
  - import `import { AiConnectionModal } from './components/AiConnectionModal';`
  - state `isChangePasswordOpen` kõrvale: `const [isAiConnectionOpen, setIsAiConnectionOpen] = useState(false);`
  - `<Header … onChangePassword={…}` järele: `onOpenAiConnection={() => setIsAiConnectionOpen(true)}`
  - `<ChangePasswordModal … />` järele: `<AiConnectionModal isOpen={isAiConnectionOpen} onClose={() => setIsAiConnectionOpen(false)} />`

- [ ] **Step 6: Tüübid, lint, testid, commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx oxlint src/components/AiConnectionModal.tsx && git add src/types/apiKey.ts src/services/api.ts src/components/AiConnectionModal.tsx src/components/UserMenu.tsx src/components/Header.tsx src/App.tsx src/index.css && git commit -m "AI ühendus: kasutajamenüüs võtmete loomine ja tühistamine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

- [ ] **Step 7: Käsitsi kontroll brauseris** — teris.ee → kasutajamenüü → „AI ühendus“: loo võti „Test“ → link kujul `https://teris.ee/mcp/trs_…` + Kopeeri töötab; sulge ja ava uuesti → link pole enam näha, loendis `trs_xxxxxx…` ja loomise aeg `pp.kk.aaaa HH:MM`; tühista → kinnitusdialoog → kaob loendist. Kitsas aken (≤ 640px): pole horisontaalset kerimist.

---

### Task 11: Apache logi, otsast-lõpuni kontroll ja dokumentatsioon

**Files:**
- Modify (serveris, väljaspool gitti): `/etc/apache2/sites-enabled/teris.ee.conf`
- Modify: `docs/superpowers/specs/2026-10-31-mcp-server-design.md` (staatus)

- [ ] **Step 1: Vaata vhost üle**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'sudo cat /etc/apache2/sites-enabled/teris.ee.conf'`
Leia 443 (SSL) `VirtualHost` plokk, kus on `CustomLog /var/log/apache2/teris.ee_access.log combined`. Kui sama `CustomLog` on ka port 80 plokis ja see proxy'b (mitte ainult redirect), muuda mõlemat.

- [ ] **Step 2: Varunda ja muuda** — asenda selles plokis rida `CustomLog /var/log/apache2/teris.ee_access.log combined` järgmisega:

```apache
    # /mcp/<võti>: võti on URL-is — logitakse ilma teeta pärast /mcp
    SetEnvIf Request_URI "^/mcp(/|$)" mcp_request
    LogFormat "%h %l %u %t \"%m /mcp/[peidetud] %H\" %>s %O \"-\" \"%{User-Agent}i\"" mcp_redacted
    CustomLog /var/log/apache2/teris.ee_access.log combined env=!mcp_request
    CustomLog /var/log/apache2/teris.ee_access.log mcp_redacted env=mcp_request
```

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'sudo cp /etc/apache2/sites-enabled/teris.ee.conf ~/backups/teris.ee.conf.$(date +%F-%H%M) && sudo nano /etc/apache2/sites-enabled/teris.ee.conf'
```
(muuda Edit-tööriistaga ei saa — fail on sudo all; kasuta `sudo sed` või `sudo tee` koos ülaltoodud plokiga ja kontrolli tulemust `sudo grep -n mcp …`.)

- [ ] **Step 3: Kontrolli ja laadi uuesti**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'sudo apachectl configtest && sudo systemctl reload apache2'`
Expected: `Syntax OK`. Vea korral taasta varukoopia ja PEATU.

- [ ] **Step 4: Otsast-lõpuni kontroll päris võtmega.** Loo UI-s (Task 10) võti „Inspector test“, siis:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx -y @modelcontextprotocol/inspector@0.17.2 --cli "https://teris.ee/mcp/<VÕTI>" --method tools/list | head -40'
```
Expected: 10 tööriista tavakasutajal (`list_stock_movements` puudub) või 11 finantsjuhil/adminil; `whoami` kutse: `--method tools/call --tool-name whoami`.

Kui see Inspectori versioon ei tööta, tee sama SDK kliendiga ühekordse skriptiga scratchpadis (mitte repos).

- [ ] **Step 5: Logi kontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'sudo grep -c "trs_" /var/log/apache2/teris.ee_access.log; sudo grep "/mcp/" /var/log/apache2/teris.ee_access.log | tail -3; journalctl -u teris --since "-30 min" | grep -c "trs_"'`
Expected: `0`, read kujul `"POST /mcp/[peidetud] HTTP/1.1"`, `0`.

- [ ] **Step 6: Tühista testvõti** UI-s.

- [ ] **Step 7: Spetsifikatsiooni staatus** — `docs/superpowers/specs/2026-10-31-mcp-server-design.md` rida `Staatus:` → `Staatus: teostatud 2026-10-31 (plaan docs/superpowers/plans/2026-10-31-ai-uhendus-mcp.md)`.

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test && git add docs/superpowers/specs/2026-10-31-mcp-server-design.md && git commit -m "AI ühendus: disaini staatus teostatud

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

- [ ] **Step 8: Claude Desktopis proov (kasutaja)** — kasutaja lisab Claude Desktopis custom connectori lingiga ja küsib nt „Mis põllud mul tänavu on ja kui palju väetist neile pandi?“. Kui Desktop ei ühendu (nt nõuab OAuth avastust), kontrolli `journalctl -u teris -f` ja Apache logi; võimalik põhjus on `GET /mcp/…` (SSE) ootus — server vastab 405, mis on Streamable HTTP olekuta režiimis lubatud.
