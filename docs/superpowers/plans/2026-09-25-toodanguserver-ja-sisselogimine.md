# Toodanguserver ja sisselogimine — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `teris.ee` jookseb ehitatud toodanguversioonina eraldi Node'i serveris (`teris.service`, port 8820) ja rakendusel on oma sisselogimine; Apache'i Basic Auth ja Vite'i arendusteenus kaovad.

**Architecture:** API käsitleja tõstetakse Vite'i pluginast eraldi moodulisse `handleApiRequest`, mida kasutavad nii arenduse plugin kui uus `node:http` toodanguserver (serveerib ka `dist/`). Autentimine: sessioonid andmebaasis (`users`, `sessions`), `HttpOnly` küpsis, `scrypt` paroolid, päringu kontroll `authGate`-is. Kasutajaliidesesse tuleb sisselogimise leht, kasutajamenüü ja parooli muutmine.

**Tech Stack:** Node 22 (`node:http`, `node:crypto`), Prisma 6 + PostgreSQL, Vite 8 (SSR-ehitus serverile), React 19, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-25-toodanguserver-ja-sisselogimine-design.md`

## Global Constraints

- Käsud jooksevad kaugserveris: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && <käsk>"`. Kohalik `/Users/andresj/Progemine/teris` on sama kaust (sshfs) — faile muuda kohalikult, käivita kaugelt.
- **Pärast mitme faili skriptiga muutmist** tee kaugel `touch <failid>` (Vite on varem tühja faili vahemällu jätnud).
- Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json` (ei tohi olla ühtegi `error TS`). Testid: `npm test`.
- Andmebaas: `psql "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)" -c "<SQL>"`. Enne skeemimuudatust varukoopia: `pg_dump "…" -Fc -f ~/db_backups/teris_db_$(date +%Y%m%d_%H%M%S).dump`.
- Praegune live on `agro-dev.service` (Vite, `127.0.0.1:5173`), logid `journalctl -u teris-dev`; Apache `teris.ee` → 5173 Basic Auth'iga. **Kuni Task 7-ni peab see töötama.**
- Uusi npm-sõltuvusi ei lisata.
- Lubatud päritolud: toodang `['https://teris.ee']`; arenduse plugin `['https://teris.ee', 'http://localhost:5173', 'http://127.0.0.1:5173']`.
- Arenduse plugin: `requireAuth: false` (live'i kaitseb kuni Task 7-ni Basic Auth); toodanguserver: `requireAuth: true`.
- Veateated (täpselt): `'Vale kasutajanimi või parool'`, `'Liiga palju katseid, proovi 15 minuti pärast'`, `'Sisselogimine on vajalik'`, `'Keelatud päring'`, `'Parool peab olema vähemalt 10 märki'`, `'Praegune parool on vale'`, `'Sessioon aegus, logi uuesti sisse'`.
- Küpsis: nimi `teris_session`, `Path=/; HttpOnly; Secure; SameSite=Lax`. Sessioon 14 päeva, uuendus kõige rohkem kord tunnis. Limiter: 10 ebaõnnestumist 15 min kohta võtmetega `u:<username>`, `ip:<ip>`.
- Isikuandmeid ega paroole ei kirjutata faili ega logisse; testkasutajad luuakse ja kustutatakse testi sees.
- Commit: ainult nimetatud failid, sõnum eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Push'i ei tehta.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/server/db.ts` (uus) | `prisma`, `tsdb` kliendid |
| `src/server/http.ts` (uus) | `json`, `parseBody`, `hasRequestBody` |
| `src/server/apiHandler.ts` (uus) | kõik API teekonnad (`handleApiRequest`), kutsub `authGate` |
| `src/server/dbApiPlugin.ts` | Vite'i ümbris ainult |
| `src/server/auth.ts` (uus) + `auth.test.ts` | puhtad autentimise funktsioonid |
| `src/server/authGate.ts` (uus) | sessioonid, `/api/auth/*`, CSRF ja sessiooni kontroll |
| `src/server/static.ts` (uus) + `static.test.ts` | `dist/` failide serveerimine |
| `src/server/prod.ts` (uus) | toodanguserver |
| `src/server/userCli.ts` (uus) | kasutajate haldus käsurealt |
| `vite.server.config.ts` (uus) | serveri SSR-ehitus |
| `scripts/auth-smoke.mts` (uus) | integratsioonitest töötava serveri vastu |
| `src/types/auth.ts` (uus) | `AuthUser` |
| `src/services/api.ts` | `apiFetch`, 401-käsitleja, auth-meetodid |
| `src/AuthGate.tsx`, `src/components/LoginPage.tsx`, `src/components/ChangePasswordModal.tsx` (uued) | sisselogimise voog |
| `src/main.tsx`, `src/App.tsx`, `src/components/Header.tsx`, `src/index.css` | ühendamine, kasutajamenüü, stiilid |
| `README.md` | projekti README |

---

### Task 1: API käsitleja eraldamine Vite'i pluginast

**Files:**
- Create: `src/server/db.ts`, `src/server/http.ts`, `src/server/apiHandler.ts`
- Modify: `src/server/dbApiPlugin.ts` (kogu fail asendub ümbrisega)

**Interfaces:**
- Produces:
  - `db.ts`: `export const prisma: PrismaClient`, `export const tsdb: PrismaClient | null`
  - `http.ts`: `json(res, data, status = 200): void`, `parseBody(req): Promise<any>`, `hasRequestBody(req): boolean`
  - `apiHandler.ts`: `export interface ApiOptions { allowedOrigins: string[]; requireAuth: boolean }`, `export async function handleApiRequest(req: IncomingMessage, res: ServerResponse, options: ApiOptions): Promise<void>`

- [ ] **Step 1: Salvesta API vastuste kontrollsummad enne muudatust**

Run:
```bash
ssh uvn-243-120.tll07.zonevs.eu 'for p in "/api/master-fields" "/api/seasons" "/api/parties" "/api/crops" "/api/poi" "/api/soil-samples" "/api/field-operations?fieldId=21&year=2025"; do printf "%s %s\n" "$p" "$(curl -s "http://127.0.0.1:5173$p" | md5sum | cut -c1-12)"; done' | tee /private/tmp/claude-501/-Users-andresj-Progemine-agro/ae21de2f-a0e7-47b4-902e-6a2b14b28645/scratchpad/api_before.txt
```
Expected: 7 rida, igal md5.

- [ ] **Step 2: Loo `src/server/db.ts`**

```ts
// src/server/db.ts
// Prisma kliendid. `new PrismaClient()` laeb projekti .env-i, mistõttu
// TSDB_DATABASE_URL loetakse alles pärast põhikliendi loomist.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// agro_tsdb (TimescaleDB) hoiab Teltonika GPS + Eye sensori telemeetriat ühes
// laias mõõtmiste tabelis (mitte Prisma mudelina — $queryRaw teise ühendusega).
export const tsdb = process.env.TSDB_DATABASE_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.TSDB_DATABASE_URL } } })
  : null;
```

- [ ] **Step 3: Loo `src/server/http.ts`**

```ts
// src/server/http.ts
import type { IncomingMessage, ServerResponse } from 'http';

export function json(res: ServerResponse, data: any, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function hasRequestBody(req: IncomingMessage): boolean {
  return Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
}
```

- [ ] **Step 4: Teisenda `dbApiPlugin.ts` → `apiHandler.ts` skriptiga**

Käivita kohalikult (kontrollib, et kõik lähtemustrid on täpselt olemas):

```bash
cd /Users/andresj/Progemine/teris && python3 - << 'PYEOF'
src = open('src/server/dbApiPlugin.ts', encoding='utf-8').read()
lines = src.split('\n')

def find(prefix):
    idx = [i for i, l in enumerate(lines) if l.startswith(prefix)]
    assert len(idx) == 1, (prefix, idx)
    return idx[0]

i_plugin = find('export function dbApiPlugin(): Plugin {')
i_json = find('function json(res: ServerResponse')
i_try = next(i for i in range(i_plugin, len(lines)) if lines[i] == '        try {')
i_catch_end = next(i for i in range(len(lines) - 1, i_try, -1) if lines[i] == '        }')

head = lines[:i_json]  # tüübid ja telemeetria abifunktsioonid (json/parseBody liiguvad http.ts-i)
head = [l for l in head if not l.startswith("import type { Plugin } from 'vite'")]
head_text = '\n'.join(head)
old_clients = head_text[head_text.index('const prisma = new PrismaClient();'):head_text.index('const TELEMETRY_STALE_MS')]
head_text = head_text.replace(old_clients, '')
head_text = head_text.replace("import { PrismaClient } from '@prisma/client';\n",
  "import { prisma, tsdb } from './db';\nimport { json, parseBody } from './http';\nimport { authGate } from './authGate';\n")
head_text = head_text.replace('// src/server/dbApiPlugin.ts', '// src/server/apiHandler.ts')

body = lines[i_try:i_catch_end + 1]
body = [l[6:] if l.startswith('      ') else l for l in body]
assert body[0] == '  try {', body[0]
# authGate kohe teekondade try-ploki algusesse (mitte faili esimese `try {` juurde —
# sama taandega try-plokid on ka telemeetria abifunktsioonides).
body[1:1] = ['    if (await authGate(req, res, pathname, method, options)) return;', '']

out = head_text.rstrip() + '\n\n' + '\n'.join([
  'export interface ApiOptions {',
  '  allowedOrigins: string[];',
  '  requireAuth: boolean;',
  '}',
  '',
  'export async function handleApiRequest(req: IncomingMessage, res: ServerResponse, options: ApiOptions): Promise<void> {',
  "  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);",
  '  const pathname = url.pathname;',
  "  const method = req.method?.toUpperCase() || 'GET';",
  '',
] + body + ['}', ''])
assert out.count('if (await authGate(') == 1
open('src/server/apiHandler.ts', 'w', encoding='utf-8').write(out)

open('src/server/dbApiPlugin.ts', 'w', encoding='utf-8').write('''// src/server/dbApiPlugin.ts
// Vite'i arendusserveri ümbris: /api päringud → handleApiRequest.
// Toodangus kasutab sama käsitlejat src/server/prod.ts.
import type { Plugin } from 'vite';
import { handleApiRequest } from './apiHandler';

const DEV_OPTIONS = {
  allowedOrigins: ['https://teris.ee', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  // Kuni toodanguserverile üleminekuni kaitseb arendusserverit Apache'i Basic Auth.
  requireAuth: false
};

export function dbApiPlugin(): Plugin {
  return {
    name: 'db-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();
        await handleApiRequest(req, res, DEV_OPTIONS);
      });
    }
  };
}
''')
print('ok', out.count('if (pathname'), 'teekonda')
PYEOF
```
Expected: `ok 29 teekonda` (või sama arv mis enne, vt `grep -c "if (pathname" src/server/apiHandler.ts`).

- [ ] **Step 5: Ajutine `authGate`, et Task 1 kompileeruks**

`src/server/authGate.ts` (asendatakse Task 4-s täislahendusega):

```ts
// src/server/authGate.ts — ajutine: Task 4 lisab sessioonid ja /api/auth/*.
import type { IncomingMessage, ServerResponse } from 'http';
import type { ApiOptions } from './apiHandler';

export async function authGate(
  _req: IncomingMessage,
  _res: ServerResponse,
  _pathname: string,
  _method: string,
  _options: ApiOptions
): Promise<boolean> {
  return false;
}
```

- [ ] **Step 6: Tüübikontroll**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && touch src/server/*.ts vite.config.ts && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS'; echo done"`
Expected: `done`, vigu pole. Kui `noUnusedLocals` kaebab mõne abifunktsiooni üle, mis enne oli kasutusel ainult pluginas, kontrolli, et teisendus ei jätnud teekondi välja (Step 4 väljund).

- [ ] **Step 7: Kontrolli, et API vastused on samad**

`vite.config.ts` muutus käivitab arendusserveri uuesti. Oota 3 s ja kordu Step 1 käsk, salvestades `api_after.txt`; siis:
Run: `diff /private/tmp/claude-501/-Users-andresj-Progemine-agro/ae21de2f-a0e7-47b4-902e-6a2b14b28645/scratchpad/api_before.txt /private/tmp/claude-501/-Users-andresj-Progemine-agro/ae21de2f-a0e7-47b4-902e-6a2b14b28645/scratchpad/api_after.txt && echo SAMA`
Expected: `SAMA`. Lisaks `ssh … "journalctl -u teris-dev -n 20 --no-pager | grep -i error"` → tühi.

- [ ] **Step 8: Commit**

```bash
git add src/server/db.ts src/server/http.ts src/server/apiHandler.ts src/server/authGate.ts src/server/dbApiPlugin.ts
git commit -m "$(cat <<'EOF'
Eralda API käsitleja Vite'i pluginast (handleApiRequest).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Autentimise puhtad funktsioonid

**Files:**
- Create: `src/server/auth.ts`, `src/server/auth.test.ts`

**Interfaces:**
- Produces (`src/server/auth.ts`):
  - `SESSION_COOKIE = 'teris_session'`
  - `hashPassword(pw: string): Promise<string>`, `verifyPassword(pw: string, stored: string): Promise<boolean>`
  - `validateNewPassword(pw: string): string | null`
  - `generateSessionToken(): string`, `hashToken(token: string): string`
  - `parseCookies(header?: string): Record<string, string>`
  - `sessionCookie(token: string, maxAgeSec: number): string`, `clearSessionCookie(): string`
  - `createLoginLimiter(opts: { max: number; windowMs: number }, now?: () => number): { isBlocked(key: string): boolean; registerFailure(key: string): void; reset(key: string): void }`
  - `checkMutationRequest(r: { method: string; origin?: string; contentType?: string; hasBody: boolean }, allowedOrigins: string[]): 'ok' | 'bad-origin' | 'bad-content-type'`

- [ ] **Step 1: Kirjuta ebaõnnestuvad testid `src/server/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validateNewPassword,
  generateSessionToken,
  hashToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  createLoginLimiter,
  checkMutationRequest
} from './auth';

describe('paroolid', () => {
  it('räsib ja kontrollib', async () => {
    const stored = await hashPassword('saladus-12345');
    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(await verifyPassword('saladus-12345', stored)).toBe(true);
    expect(await verifyPassword('vale-parool-1', stored)).toBe(false);
  });
  it('sama parool annab erineva räsi (sool)', async () => {
    expect(await hashPassword('saladus-12345')).not.toBe(await hashPassword('saladus-12345'));
  });
  it('rikutud räsi ei kehti', async () => {
    expect(await verifyPassword('x', 'rikutud')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$$')).toBe(false);
  });
  it('uue parooli pikkus', () => {
    expect(validateNewPassword('lühike')).toBe('Parool peab olema vähemalt 10 märki');
    expect(validateNewPassword('piisavalt-pikk')).toBeNull();
  });
});

describe('sessioonitoken ja küpsis', () => {
  it('token on juhuslik ja räsi determineeritud', () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('loeb küpsiseid', () => {
    expect(parseCookies('a=1; teris_session=abc%3D; b=2')).toEqual({ a: '1', teris_session: 'abc=', b: '2' });
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('vigane; x=%E0%A4%A')).toEqual({});
  });
  it('seab ja kustutab küpsise', () => {
    expect(sessionCookie('tok', 1209600)).toBe('teris_session=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600');
    expect(clearSessionCookie()).toBe('teris_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  });
});

describe('sisselogimise piiraja', () => {
  it('blokeerib 10 ebaõnnestumise järel ja vabastab akna möödudes', () => {
    let t = 0;
    const lim = createLoginLimiter({ max: 10, windowMs: 1000 }, () => t);
    for (let i = 0; i < 9; i++) lim.registerFailure('u:x');
    expect(lim.isBlocked('u:x')).toBe(false);
    lim.registerFailure('u:x');
    expect(lim.isBlocked('u:x')).toBe(true);
    expect(lim.isBlocked('u:teine')).toBe(false);
    t = 1001;
    expect(lim.isBlocked('u:x')).toBe(false);
  });
  it('reset nullib', () => {
    const lim = createLoginLimiter({ max: 2, windowMs: 1000 }, () => 0);
    lim.registerFailure('ip:1');
    lim.registerFailure('ip:1');
    lim.reset('ip:1');
    expect(lim.isBlocked('ip:1')).toBe(false);
  });
});

describe('checkMutationRequest', () => {
  const allowed = ['https://teris.ee'];
  it('GET on alati lubatud', () => {
    expect(checkMutationRequest({ method: 'GET', hasBody: false }, allowed)).toBe('ok');
  });
  it('POST nõuab lubatud päritolu', () => {
    expect(checkMutationRequest({ method: 'POST', origin: 'https://kuri.ee', contentType: 'application/json', hasBody: true }, allowed)).toBe('bad-origin');
    expect(checkMutationRequest({ method: 'POST', contentType: 'application/json', hasBody: true }, allowed)).toBe('bad-origin');
  });
  it('kehaga päring peab olema JSON', () => {
    expect(checkMutationRequest({ method: 'POST', origin: allowed[0], contentType: 'text/plain', hasBody: true }, allowed)).toBe('bad-content-type');
    expect(checkMutationRequest({ method: 'POST', origin: allowed[0], contentType: 'application/json; charset=utf-8', hasBody: true }, allowed)).toBe('ok');
  });
  it('DELETE ilma kehata lubatud päritoluga on ok', () => {
    expect(checkMutationRequest({ method: 'DELETE', origin: allowed[0], hasBody: false }, allowed)).toBe('ok');
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm test 2>&1 | grep -E 'auth.test|Failed to resolve|Tests '"`
Expected: FAIL, `auth.test.ts` ei leia moodulit `./auth`.

- [ ] **Step 3: Kirjuta `src/server/auth.ts`**

```ts
// src/server/auth.ts
// Autentimise puhtad funktsioonid (ilma andmebaasita, testitavad).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const SESSION_COOKIE = 'teris_session';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length === 0 || !saltB64) return false;
  try {
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export function validateNewPassword(password: string): string | null {
  return password.length >= 10 ? null : 'Parool peab olema vähemalt 10 märki';
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // vigase kodeeringuga küpsis jäetakse vahele
    }
  }
  return out;
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAgeSec)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function createLoginLimiter(opts: { max: number; windowMs: number }, now: () => number = () => Date.now()) {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => (failures.get(key) ?? []).filter((t) => now() - t < opts.windowMs);
  return {
    isBlocked(key: string): boolean {
      const list = recent(key);
      failures.set(key, list);
      return list.length >= opts.max;
    },
    registerFailure(key: string): void {
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
    },
    reset(key: string): void {
      failures.delete(key);
    }
  };
}

export function checkMutationRequest(
  r: { method: string; origin?: string; contentType?: string; hasBody: boolean },
  allowedOrigins: string[]
): 'ok' | 'bad-origin' | 'bad-content-type' {
  const method = r.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'ok';
  if (!r.origin || !allowedOrigins.includes(r.origin)) return 'bad-origin';
  if (r.hasBody && !(r.contentType ?? '').toLowerCase().startsWith('application/json')) return 'bad-content-type';
  return 'ok';
}
```

Märkus: testis `parseCookies('vigane; x=%E0%A4%A')` → `{}` — `vigane` ilma `=`-ita jäetakse vahele, `%E0%A4%A` on vigane kodeering.

- [ ] **Step 4: Testid peavad läbima**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm test 2>&1 | grep -E '✓|×|FAIL|Tests '"`
Expected: kõik testid (sh uued `auth.test.ts`) PASS.

- [ ] **Step 5: Tüübikontroll** (vt Global Constraints) — vigu pole.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth.ts src/server/auth.test.ts
git commit -m "$(cat <<'EOF'
Lisa autentimise abifunktsioonid (scrypt, sessioonitoken, küpsis, piiraja, CSRF).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Kasutajate tabelid ja käsurea haldus

**Files:**
- Modify: `prisma/schema.prisma` (lõppu), `package.json` (skriptid), `.gitignore`
- Create: `src/server/userCli.ts`, `vite.server.config.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `hashPassword`, `validateNewPassword` (Task 2)
- Produces: Prisma mudelid `User`, `Session` (vt spec); `npm run build:server` → `dist-server/userCli.js`; `npm run user -- <käsk>`.

- [ ] **Step 1: Varukoopia** (vt Global Constraints).

- [ ] **Step 2: Lisa mudelid `prisma/schema.prisma` lõppu**

```prisma
// ============================================================================
// 10. KASUTAJAD JA SESSIOONID (rakenduse sisselogimine)
// ============================================================================

model User {
  id           String    @id @default(cuid())
  username     String    @unique // väiketähtedega
  passwordHash String
  displayName  String?
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions     Session[]

  @@map("users")
}

model Session {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique // SHA-256 küpsise tokenist
  expiresAt  DateTime
  lastSeenAt DateTime @default(now())
  userAgent  String?
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}
```

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx prisma db push --skip-generate 2>&1 | tail -3 && npx prisma generate 2>&1 | grep -i 'generated\|error' && sudo systemctl restart teris-dev"`
Expected: "in sync" **ilma** andmekao hoiatuseta, "Generated Prisma Client"; `agro-dev` taaskäivitub (uus Prisma klient).

- [ ] **Step 3: Loo `vite.server.config.ts`**

```ts
// vite.server.config.ts — serveri SSR-ehitus (ilma rakenduse pluginateta).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node22',
    rolldownOptions: {
      input: {
        userCli: 'src/server/userCli.ts'
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es'
      }
    }
  }
});
```

- [ ] **Step 4: Loo `src/server/userCli.ts`**

```ts
// src/server/userCli.ts
// Kasutajate haldus: npm run user -- <add|passwd|disable|enable|list|logout> [nimi] [--display "Nimi"]
// Parool küsitakse varjatult (terminalis) või loetakse stdin'i ridadest (toru kaudu).
import readline from 'node:readline';
import { prisma } from './db';
import { hashPassword, validateNewPassword } from './auth';

const queued: string[] = [];
let waiting: ((line: string) => void) | null = null;
let muted = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY)
});
// Varjatud sisestus: readline'i sisemine väljundkirjutaja vaigistatakse parooli ajal.
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
  if (!muted) process.stdout.write(s);
};
rl.on('line', (line) => {
  if (waiting) {
    const w = waiting;
    waiting = null;
    w(line);
  } else {
    queued.push(line);
  }
});

async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  muted = hidden && Boolean(process.stdin.isTTY);
  const line = queued.length ? queued.shift()! : await new Promise<string>((resolve) => { waiting = resolve; });
  if (muted) process.stdout.write('\n');
  muted = false;
  return line;
}

async function askNewPassword(): Promise<string> {
  const pw = await ask('Uus parool: ', true);
  const problem = validateNewPassword(pw);
  if (problem) throw new Error(problem);
  const again = await ask('Korda parooli: ', true);
  if (again !== pw) throw new Error('Paroolid ei kattu');
  return pw;
}

async function findUser(name: string | undefined) {
  if (!name) throw new Error('Kasutajanimi puudub');
  const user = await prisma.user.findUnique({ where: { username: name.toLowerCase() } });
  if (!user) throw new Error(`Kasutajat "${name}" pole`);
  return user;
}

async function main(): Promise<void> {
  const [command, name, ...rest] = process.argv.slice(2);
  const displayIdx = rest.indexOf('--display');
  const displayName = displayIdx >= 0 ? rest[displayIdx + 1] ?? null : null;

  switch (command) {
    case 'add': {
      if (!name) throw new Error('Kasutus: add <nimi> [--display "Nimi"]');
      const username = name.toLowerCase();
      if (await prisma.user.findUnique({ where: { username } })) throw new Error(`Kasutaja "${username}" on juba olemas`);
      const passwordHash = await hashPassword(await askNewPassword());
      await prisma.user.create({ data: { username, passwordHash, displayName } });
      console.log(`Kasutaja "${username}" loodud.`);
      break;
    }
    case 'passwd': {
      const user = await findUser(name);
      const passwordHash = await hashPassword(await askNewPassword());
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });
      console.log(`Parool muudetud, ${count} sessiooni lõpetatud.`);
      break;
    }
    case 'disable':
    case 'enable': {
      const user = await findUser(name);
      await prisma.user.update({ where: { id: user.id }, data: { isActive: command === 'enable' } });
      if (command === 'disable') await prisma.session.deleteMany({ where: { userId: user.id } });
      console.log(`Kasutaja "${user.username}" ${command === 'enable' ? 'lubatud' : 'keelatud'}.`);
      break;
    }
    case 'logout': {
      const user = await findUser(name);
      const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });
      console.log(`${count} sessiooni lõpetatud.`);
      break;
    }
    case 'list': {
      const users = await prisma.user.findMany({ orderBy: { username: 'asc' }, include: { _count: { select: { sessions: true } } } });
      for (const u of users) {
        console.log([
          u.username.padEnd(20),
          (u.displayName ?? '').padEnd(24),
          u.isActive ? 'aktiivne' : 'keelatud',
          `viimati: ${u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : '–'}`,
          `sessioone: ${u._count.sessions}`
        ].join('  '));
      }
      if (users.length === 0) console.log('Kasutajaid pole.');
      break;
    }
    default:
      throw new Error('Kasutus: npm run user -- <add|passwd|disable|enable|list|logout> [nimi] [--display "Nimi"]');
  }
}

main()
  .then(() => { process.exitCode = 0; })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
```

- [ ] **Step 5: `package.json` skriptid ja `.gitignore`**

`"scripts"` sisse (olemasolevad jäävad; `build` muutub Task 5-s):

```json
    "build:server": "vite build --config vite.server.config.ts",
    "user": "node dist-server/userCli.js",
```

`.gitignore` lõppu:

```
# Serveri ehitus
dist-server
```

- [ ] **Step 6: Ehita ja proovi (ajutine testkasutaja, kustutatakse)**

Run:
```bash
ssh uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS"; npm run -s build:server 2>&1 | tail -2 && printf "lyhike\n" | npm run -s user -- add _kontroll; echo "exit=$?"; printf "Kontroll-12345\nKontroll-12345\n" | npm run -s user -- add _kontroll --display "Test Kasutaja"; npm run -s user -- list; npm run -s user -- disable _kontroll; npm run -s user -- list | grep _kontroll'
```
Expected:
- tüübivigu pole, `dist-server/userCli.js` ehitatud;
- esimene `add` → `Parool peab olema vähemalt 10 märki`, `exit=1`;
- teine → `Kasutaja "_kontroll" loodud.`; `list` näitab `_kontroll … aktiivne … sessioone: 0`;
- `disable` → `keelatud`.

Koristus:
Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -c \"DELETE FROM users WHERE username='_kontroll';\""`
Expected: `DELETE 1`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/server/userCli.ts vite.server.config.ts package.json .gitignore
git commit -m "$(cat <<'EOF'
Lisa kasutajate ja sessioonide tabelid ning käsurea kasutajahaldus.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: KASUTAJA SAMM — loo endale konto**

Palu kasutajal serveris käivitada (parool ei tohi sattuda vestlusesse):
```
ssh uvn-243-120.tll07.zonevs.eu
cd /home/debian/teris && npm run user -- add <kasutajanimi> --display "Ees Perenimi"
```
**Ära jätka Task 6-ga enne, kui kasutaja kinnitab, et konto on loodud** (Task 6 järel küsib live'i leht sisselogimist).

---

### Task 4: Sessioonid, `/api/auth/*` ja päringu kontroll

**Files:**
- Modify: `src/server/authGate.ts` (asendab ajutise versiooni)

**Interfaces:**
- Consumes: `prisma` (Task 1), `json`, `parseBody`, `hasRequestBody` (Task 1), kõik `auth.ts` funktsioonid (Task 2), `ApiOptions` (Task 1)
- Produces: `authGate(req, res, pathname, method, options): Promise<boolean>` — `true`, kui vastus on juba saadetud.
  API: `POST /api/auth/login` `{username,password}` → `{ user: { id, username, displayName } }`; `POST /api/auth/logout` → `{ success: true }`; `GET /api/auth/me` → `{ user }` | 401; `POST /api/auth/password` `{currentPassword,newPassword}` → `{ success: true }`.

- [ ] **Step 1: Kirjuta `src/server/authGate.ts`**

```ts
// src/server/authGate.ts
// Rakenduse sisselogimine: sessioonid andmebaasis, /api/auth/* teekonnad,
// CSRF-kontroll muutvatele päringutele ja sessiooni nõue ülejäänud API-le.
import type { IncomingMessage, ServerResponse } from 'http';
import type { ApiOptions } from './apiHandler';
import { prisma } from './db';
import { json, parseBody, hasRequestBody } from './http';
import {
  SESSION_COOKIE,
  verifyPassword,
  hashPassword,
  validateNewPassword,
  generateSessionToken,
  hashToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  createLoginLimiter,
  checkMutationRequest
} from './auth';

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const limiter = createLoginLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

type DbUser = { id: string; username: string; displayName: string | null; passwordHash: string; isActive: boolean };

const toAuthUser = (u: DbUser) => ({ id: u.id, username: u.username, displayName: u.displayName ?? null });

// Vale kasutajanime korral kontrollitakse parooli selle vastu, et vastuse aeg ei
// paljastaks, kas kasutaja on olemas.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('teris-dummy-password'));

function clientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'tundmatu';
}

function sessionToken(req: IncomingMessage): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

async function currentSession(req: IncomingMessage): Promise<{ user: DbUser; sessionId: string } | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) return null;
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
    });
  }
  return { user: session.user, sessionId: session.id };
}

async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req);
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const keys = [`u:${username}`, `ip:${clientIp(req)}`];

  if (keys.some((k) => limiter.isBlocked(k))) {
    json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);
    return;
  }

  const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.isActive || !passwordOk) {
    keys.forEach((k) => limiter.registerFailure(k));
    json(res, { error: 'Vale kasutajanimi või parool' }, 401);
    return;
  }

  keys.forEach((k) => limiter.reset(k));
  const token = generateSessionToken();
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: userAgent || null
    }
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_TTL_MS / 1000));
  json(res, { user: toAuthUser(user) });
}

export async function authGate(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  options: ApiOptions
): Promise<boolean> {
  const csrf = checkMutationRequest(
    {
      method,
      origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      contentType: typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined,
      hasBody: hasRequestBody(req)
    },
    options.allowedOrigins
  );
  if (csrf !== 'ok') {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    await handleLogin(req, res);
    return true;
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = sessionToken(req);
    if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.setHeader('Set-Cookie', clearSessionCookie());
    json(res, { success: true });
    return true;
  }

  const current = await currentSession(req);

  if (pathname === '/api/auth/me' && method === 'GET') {
    if (current) json(res, { user: toAuthUser(current.user) });
    else json(res, { error: 'Sisselogimine on vajalik' }, 401);
    return true;
  }

  if (pathname === '/api/auth/password' && method === 'POST') {
    if (!current) {
      json(res, { error: 'Sisselogimine on vajalik' }, 401);
      return true;
    }
    const body = await parseBody(req);
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');
    if (!(await verifyPassword(currentPassword, current.user.passwordHash))) {
      json(res, { error: 'Praegune parool on vale' }, 401);
      return true;
    }
    const problem = validateNewPassword(newPassword);
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    await prisma.user.update({ where: { id: current.user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await prisma.session.deleteMany({ where: { userId: current.user.id, NOT: { id: current.sessionId } } });
    json(res, { success: true });
    return true;
  }

  if (pathname.startsWith('/api/auth/')) {
    json(res, { error: 'Not found' }, 404);
    return true;
  }

  if (options.requireAuth && !current) {
    json(res, { error: 'Sisselogimine on vajalik' }, 401);
    return true;
  }

  return false;
}
```

- [ ] **Step 2: Tüübikontroll** — vigu pole. Kui `noUnusedParameters`/`noUnusedLocals` kaebab, paranda (ära lülita reeglit välja).

- [ ] **Step 3: Kontrolli arendusserveri vastu (requireAuth: false)**

`agro-dev` laeb muudatuse ise (plugina fail muutus). Loo ajutine kasutaja ja proovi voogu. Kasuta küpsisekarpi `/tmp/_ck` serveris.

Run:
```bash
ssh uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && touch src/server/authGate.ts && sleep 3 && npm run -s build:server >/dev/null && printf "Kontroll-12345\nKontroll-12345\n" | npm run -s user -- add _kontroll >/dev/null && B=http://127.0.0.1:5173 && O="Origin: https://teris.ee" && J="Content-Type: application/json" && rm -f /tmp/_ck &&
echo "me ilma: $(curl -s -o /dev/null -w %{http_code} $B/api/auth/me)" &&
echo "vale parool: $(curl -s -o /dev/null -w %{http_code} -H "$O" -H "$J" -d "{\"username\":\"_kontroll\",\"password\":\"vale-parool-1\"}" $B/api/auth/login)" &&
echo "ilma Originita: $(curl -s -o /dev/null -w %{http_code} -H "$J" -d "{\"username\":\"_kontroll\",\"password\":\"Kontroll-12345\"}" $B/api/auth/login)" &&
echo "õige: $(curl -s -c /tmp/_ck -H "$O" -H "$J" -d "{\"username\":\"_KONTROLL\",\"password\":\"Kontroll-12345\"}" $B/api/auth/login)" &&
echo "küpsis: $(grep -c teris_session /tmp/_ck)" &&
echo "me: $(curl -s -b /tmp/_ck $B/api/auth/me)" &&
echo "andmed ilma sessioonita (requireAuth false): $(curl -s -o /dev/null -w %{http_code} $B/api/crops)" &&
echo "parooli muutmine lühike: $(curl -s -b /tmp/_ck -H "$O" -H "$J" -d "{\"currentPassword\":\"Kontroll-12345\",\"newPassword\":\"lyhike\"}" $B/api/auth/password)" &&
echo "logout: $(curl -s -b /tmp/_ck -c /tmp/_ck -H "$O" -X POST $B/api/auth/logout)" &&
echo "me pärast: $(curl -s -o /dev/null -w %{http_code} -b /tmp/_ck $B/api/auth/me)"; rm -f /tmp/_ck'
```
Expected:
- `me ilma: 401`; `vale parool: 401`; `ilma Originita: 403`
- `õige: {"user":{"id":"…","username":"_kontroll","displayName":null}}` (suurtähtedega sisestus toimib); `küpsis: 1`
- `me: {"user":{…"_kontroll"…}}`; `andmed ilma sessioonita (requireAuth false): 200`
- `parooli muutmine lühike: {"error":"Parool peab olema vähemalt 10 märki"}`
- `logout: {"success":true}`; `me pärast: 401`

Koristus: `DELETE FROM users WHERE username='_kontroll';` (sessioonid kustuvad kaskaadiga) → `DELETE 1`.

- [ ] **Step 4: Kontrolli, et olemasolev rakendus töötab edasi**

Run: kordu Task 1 Step 1 kontrollsummad ja võrdle `api_before.txt`-ga.
Expected: kõik read samad (andmed pole muutunud). `journalctl -u teris-dev -n 30 --no-pager | grep -i error` → tühi.

- [ ] **Step 5: Commit**

```bash
git add src/server/authGate.ts
git commit -m "$(cat <<'EOF'
Lisa sessioonid, /api/auth/* teekonnad ja päringu kontroll.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Toodanguserver ja integratsioonitest

**Files:**
- Create: `src/server/static.ts`, `src/server/static.test.ts`, `src/server/prod.ts`, `scripts/auth-smoke.mts`
- Modify: `vite.server.config.ts` (lisa `prod` sisend), `package.json` (`build`, `start`, `release`)

**Interfaces:**
- Consumes: `handleApiRequest` (Task 1), `hashPassword` (Task 2)
- Produces: `resolveStaticPath(distDir: string, urlPath: string): string | null`, `cacheControlFor(relPath: string): string`, `serveStatic(req, res, distDir): Promise<void>`; `dist-server/prod.js` (kuulab `127.0.0.1:${PORT ?? 8820}`).

- [ ] **Step 1: Kirjuta ebaõnnestuvad testid `src/server/static.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveStaticPath, cacheControlFor } from './static';

const DIST = path.resolve('/srv/app/dist');

describe('resolveStaticPath', () => {
  it('lahendab tavalise faili', () => {
    expect(resolveStaticPath(DIST, '/assets/index-abc.js')).toBe(path.join(DIST, 'assets/index-abc.js'));
    expect(resolveStaticPath(DIST, '/favicon.svg?v=2')).toBe(path.join(DIST, 'favicon.svg'));
    expect(resolveStaticPath(DIST, '/')).toBe(DIST);
  });
  it('keelab kataloogist väljumise', () => {
    expect(resolveStaticPath(DIST, '/../.env')).toBeNull();
    expect(resolveStaticPath(DIST, '/..%2f.env')).toBeNull();
    expect(resolveStaticPath(DIST, '/assets/../../.env')).toBeNull();
    expect(resolveStaticPath(DIST, '/%E0%A4%A')).toBeNull();
  });
});

describe('cacheControlFor', () => {
  it('räsiga failid pikalt vahemällu, muu no-cache', () => {
    expect(cacheControlFor('assets/index-abc.js')).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFor('index.html')).toBe('no-cache');
    expect(cacheControlFor('favicon.svg')).toBe('no-cache');
  });
});
```

Run: `ssh … "cd /home/debian/teris && npm test 2>&1 | grep -E 'static.test|Tests '"` → FAIL (moodul puudub).

- [ ] **Step 2: Kirjuta `src/server/static.ts`**

```ts
// src/server/static.ts — dist/ failide serveerimine toodanguserveris.
import type { IncomingMessage, ServerResponse } from 'http';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

export function resolveStaticPath(distDir: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const root = path.resolve(distDir);
  const target = path.resolve(root, '.' + (decoded.startsWith('/') ? decoded : `/${decoded}`));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export function cacheControlFor(relPath: string): string {
  return relPath.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

export async function serveStatic(req: IncomingMessage, res: ServerResponse, distDir: string): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }

  const target = resolveStaticPath(distDir, req.url || '/');
  if (!target) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  let file = target;
  if (!(await isFile(file))) {
    const rel = path.relative(path.resolve(distDir), target).split(path.sep).join('/');
    // Puuduv räsiga fail on päris 404; muu tee → SPA index.html.
    if (rel.startsWith('assets/')) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    file = path.join(distDir, 'index.html');
  }

  const body = await readFile(file);
  const rel = path.relative(path.resolve(distDir), file).split(path.sep).join('/');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControlFor(rel));
  res.setHeader('Content-Length', body.length);
  res.end(method === 'HEAD' ? undefined : body);
}
```

Run testid → PASS.

- [ ] **Step 3: Kirjuta `src/server/prod.ts`**

```ts
// src/server/prod.ts — toodanguserver: dist/ + /api (sisselogimisega).
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiHandler';
import { serveStatic } from './static';

const PORT = Number(process.env.PORT ?? 8820);
const HOST = '127.0.0.1';
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const API_OPTIONS = { allowedOrigins: ['https://teris.ee'], requireAuth: true };

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url ?? '').startsWith('/api')) {
      await handleApiRequest(req, res, API_OPTIONS);
    } else {
      await serveStatic(req, res, DIST_DIR);
    }
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Serveri viga');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`teris kuulab http://${HOST}:${PORT} (dist: ${DIST_DIR})`);
});
```

- [ ] **Step 4: Ehituse seadistus**

`vite.server.config.ts` → `input` plokk:

```ts
      input: {
        prod: 'src/server/prod.ts',
        userCli: 'src/server/userCli.ts'
      },
```

`package.json` `"scripts"`:

```json
    "build": "tsc -b && vite build && vite build --config vite.server.config.ts",
    "start": "node dist-server/prod.js",
    "release": "npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build && sudo systemctl restart teris",
```

- [ ] **Step 5: Kirjuta `scripts/auth-smoke.mts`**

```ts
// scripts/auth-smoke.mts — integratsioonitest töötava toodanguserveri vastu.
// Käivita serveris: BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth.ts';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8820';
const ORIGIN = 'https://teris.ee';
const USER = '_smoketest';
const PASS = 'Smoke-test-12345';
const prisma = new PrismaClient();
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'OK  ' : 'VIGA'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers }, body: JSON.stringify(body) });

try {
  await prisma.user.deleteMany({ where: { username: USER } });
  await prisma.user.create({ data: { username: USER, passwordHash: await hashPassword(PASS) } });

  check('status ilma sessioonita → 401', (await fetch(BASE + '/api/status')).status === 401);
  check('vale parool → 401', (await post('/api/auth/login', { username: USER, password: 'vale-parool-1' })).status === 401);
  check('vale Origin → 403', (await post('/api/auth/login', { username: USER, password: PASS }, { Origin: 'https://kuri.ee' })).status === 403);

  const login = await post('/api/auth/login', { username: USER, password: PASS });
  const setCookie = login.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  check('õige parool → 200 + küpsis', login.status === 200 && cookie.startsWith('teris_session='), `${login.status}`);
  check('küpsise atribuudid', /HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Lax/.test(setCookie));

  const me = await fetch(BASE + '/api/auth/me', { headers: { Cookie: cookie } });
  check('me → 200', me.status === 200 && (await me.json()).user?.username === USER);
  check('andmed sessiooniga → 200', (await fetch(BASE + '/api/master-fields', { headers: { Cookie: cookie } })).status === 200);
  check('muutev päring ilma Originita → 403', (await fetch(BASE + '/api/crops', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status === 403);

  await post('/api/auth/logout', {}, { Cookie: cookie });
  check('pärast väljalogimist → 401', (await fetch(BASE + '/api/auth/me', { headers: { Cookie: cookie } })).status === 401);

  let last = 0;
  for (let i = 0; i < 11; i++) last = (await post('/api/auth/login', { username: USER, password: 'vale-parool-1' }, { 'X-Forwarded-For': '203.0.113.9' })).status;
  check('11. vale katse → 429', last === 429, `${last}`);

  const index = await fetch(BASE + '/');
  check('/ → index.html no-cache', index.status === 200 && (index.headers.get('cache-control') ?? '') === 'no-cache' && (await index.text()).includes('<div id="root">'));
  const asset = (await (await fetch(BASE + '/')).text()).match(/\/assets\/[^"]+\.js/)?.[0];
  const assetRes = asset ? await fetch(BASE + asset) : null;
  check('assets → immutable', Boolean(assetRes && assetRes.status === 200 && (assetRes.headers.get('cache-control') ?? '').includes('immutable')), asset ?? 'puudub');
  check('kataloogist väljumine → 404', (await fetch(BASE + '/..%2f.env')).status === 404);
  check('SPA tee → index.html', (await fetch(BASE + '/mingi/tee')).status === 200);
} finally {
  await prisma.user.deleteMany({ where: { username: USER } });
  await prisma.$disconnect();
}

console.log(failures === 0 ? 'KÕIK KORRAS' : `${failures} VIGA`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 6: Ehita, käivita ajutiselt ja testi**

Run:
```bash
ssh uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS"; npm test 2>&1 | grep "Tests " && npm run build 2>&1 | grep -E "built in|rror" && ls dist-server/ && (setsid nohup npm start > /tmp/teris_prod_test.log 2>&1 < /dev/null & disown) && sleep 3 && cat /tmp/teris_prod_test.log | tail -2 && BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts; pkill -f "node dist-server/prod.js"; echo stopped'
```
Expected: tüübivigu pole; kõik testid PASS; kaks `built in`; `dist-server/` sisaldab `prod.js` ja `userCli.js`; logis `teris kuulab http://127.0.0.1:8820`; smoke-testi iga rida `OK`, lõpus `KÕIK KORRAS`; `stopped`.
Kui ehitatud server annab vea `Named export 'PrismaClient' not found`, asenda `src/server/db.ts` import kujul `import pkg from '@prisma/client'; const { PrismaClient } = pkg;` ja kordu.

- [ ] **Step 7: Commit**

```bash
git add src/server/static.ts src/server/static.test.ts src/server/prod.ts scripts/auth-smoke.mts vite.server.config.ts package.json
git commit -m "$(cat <<'EOF'
Lisa toodanguserver (dist + API) ja sisselogimise integratsioonitest.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sisselogimine kasutajaliideses

**Eeltingimus:** kasutaja on Task 3 Step 8 järgi kinnitanud, et tal on konto (see ülesanne muudab live'i lehe sisselogimist nõudvaks).

**Files:**
- Create: `src/types/auth.ts`, `src/AuthGate.tsx`, `src/components/LoginPage.tsx`, `src/components/ChangePasswordModal.tsx`
- Modify: `src/services/api.ts`, `src/main.tsx`, `src/App.tsx` (signatuur ~rida 70, `<Header` ~rida 1100, modaalid lõpus), `src/components/Header.tsx`, `src/index.css`

**Interfaces:**
- Consumes: Task 4 API (`/api/auth/*`)
- Produces: `AuthUser = { id: string; username: string; displayName: string | null }`; `setUnauthorizedHandler(fn: (() => void) | null): void`; `api.getMe(): Promise<AuthUser>`, `api.login(username, password): Promise<AuthUser>`, `api.logout(): Promise<void>`, `api.changePassword(currentPassword, newPassword): Promise<void>`; `App` propsid `{ user: AuthUser; onLogout: () => void }`.

- [ ] **Step 1: `src/types/auth.ts`**

```ts
// src/types/auth.ts
export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
}
```

- [ ] **Step 2: `src/services/api.ts` — `apiFetch` ja auth-meetodid**

Asenda kõik `await fetch(` → `await apiFetch(`:
Run: `cd /Users/andresj/Progemine/teris && sed -i '' 's/await fetch(/await apiFetch(/g' src/services/api.ts && grep -c "await apiFetch(" src/services/api.ts && grep -c "await fetch(" src/services/api.ts`
Expected: esimene arv = varasem `fetch` arv (29), teine `0`.

Importide järele, enne `export const api = {`:

```ts
import type { AuthUser } from '../types/auth';

let unauthorizedHandler: (() => void) | null = null;

// Kutsutakse, kui mõni andmepäring saab vastuseks 401 (sessioon aegus).
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'same-origin', ...init });
  if (res.status === 401 && !input.startsWith('/api/auth/')) unauthorizedHandler?.();
  return res;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : fallback;
}
```

`api` objekti algusesse (enne `getStatus`):

```ts
  async getMe(): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) throw new Error(await errorMessage(res, 'Pole sisse logitud'));
    return (await res.json()).user;
  },

  async login(username: string, password: string): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Sisselogimine ebaõnnestus'));
    return (await res.json()).user;
  },

  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await apiFetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Parooli muutmine ebaõnnestus'));
  },

```

- [ ] **Step 3: `src/components/LoginPage.tsx`**

```tsx
// src/components/LoginPage.tsx
import React, { useState } from 'react';
import { Tractor, LogIn, AlertCircle } from 'lucide-react';
import type { AuthUser } from '../types/auth';
import { api } from '../services/api';

interface LoginPageProps {
  notice?: string | null;
  onLoggedIn: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ notice, onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await api.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sisselogimine ebaõnnestus');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card glass-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo-icon">
            <Tractor className="brand-tractor" size={24} />
          </div>
          <div className="brand-title">
            <span>AGRO</span> kaart
          </div>
        </div>

        {notice && !error && <div className="alert-box">{notice}</div>}
        {error && (
          <div className="alert-box error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="login-username">Kasutajanimi</label>
          <input
            id="login-username"
            className="form-input"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Parool</label>
          <input
            id="login-password"
            type="password"
            className="form-input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          <LogIn size={16} />
          <span>{busy ? 'Login sisse…' : 'Logi sisse'}</span>
        </button>
      </form>
    </div>
  );
};
```

- [ ] **Step 4: `src/components/ChangePasswordModal.tsx`**

```tsx
// src/components/ChangePasswordModal.tsx
import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, Check } from 'lucide-react';
import { api } from '../services/api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setCurrent('');
    setNext('');
    setRepeat('');
    setError(null);
    setDone(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 10) return setError('Parool peab olema vähemalt 10 märki');
    if (next !== repeat) return setError('Uued paroolid ei kattu');
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parooli muutmine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <form className="modal-content animate-scale-up change-password-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-title-group">
            <KeyRound className="text-emerald" size={22} />
            <h3>Muuda parooli</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {done ? (
            <div className="alert-box">
              <Check size={16} />
              <span>Parool muudetud. Teistes seadmetes tuleb uuesti sisse logida.</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="alert-box error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
              <div className="form-group">
                <label htmlFor="pw-current">Praegune parool</label>
                <input id="pw-current" type="password" className="form-input" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="pw-new">Uus parool (vähemalt 10 märki)</label>
                <input id="pw-new" type="password" className="form-input" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="pw-repeat">Korda uut parooli</label>
                <input id="pw-repeat" type="password" className="form-input" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={close}>{done ? 'Sulge' : 'Loobu'}</button>
          {!done && (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Check size={16} />
              <span>Salvesta</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
```

- [ ] **Step 5: `src/AuthGate.tsx` ja `src/main.tsx`**

```tsx
// src/AuthGate.tsx — sisselogimise kontroll enne rakenduse laadimist.
import React, { useEffect, useState } from 'react';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import type { AuthUser } from './types/auth';
import { api, setUnauthorizedHandler } from './services/api';

export const AuthGate: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice('Sessioon aegus, logi uuesti sisse');
    });
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  if (checking) return <div className="auth-loading">Laadin…</div>;

  if (!user) {
    return (
      <LoginPage
        notice={notice}
        onLoggedIn={(u) => {
          setNotice(null);
          setUser(u);
        }}
      />
    );
  }

  return (
    <App
      user={user}
      onLogout={() => {
        api.logout().catch(() => undefined).finally(() => {
          setNotice(null);
          setUser(null);
        });
      }}
    />
  );
};
```

`src/main.tsx` — asenda `import { App } from './App.tsx'` → `import { AuthGate } from './AuthGate.tsx'` ja `<App />` → `<AuthGate />`.

- [ ] **Step 6: `App.tsx` ja `Header.tsx`**

`src/App.tsx`:
- importide juurde: `import { ChangePasswordModal } from './components/ChangePasswordModal';` ja `import type { AuthUser } from './types/auth';`
- `export const App: React.FC = () => {` → 
  ```tsx
  interface AppProps {
    user: AuthUser;
    onLogout: () => void;
  }

  export const App: React.FC<AppProps> = ({ user, onLogout }) => {
  ```
- olekute juurde (nt `const [isPartiesModalOpen, …]` järele): `const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);`
- `<Header` propsidesse (`dbConnected={dbConnected}` järele):
  ```tsx
        currentUser={user}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={onLogout}
  ```
- modaalide lõppu (viimase modaali järele, enne sulgevat `</div>`):
  ```tsx
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
  ```

`src/components/Header.tsx`:
- `lucide-react` importi lisa `User as UserIcon, KeyRound, LogOut`
- `import type { AuthUser } from '../types/auth';`
- `HeaderProps` lõppu:
  ```ts
  currentUser?: AuthUser;
  onChangePassword?: () => void;
  onLogout?: () => void;
  ```
- destruktureerimisse `dbConnected = false` järele: `currentUser, onChangePassword, onLogout`
- `header-actions` lõppu (teema nupu järele, enne `</div>`):
  ```tsx
        {currentUser && (
          <div className="user-menu">
            <span className="user-menu-name" title={currentUser.username}>
              <UserIcon size={14} />
              {currentUser.displayName || currentUser.username}
            </span>
            <button className="btn btn-secondary" onClick={onChangePassword} title="Muuda oma parooli">
              <KeyRound size={16} />
              <span>Muuda parooli</span>
            </button>
            <button className="btn btn-secondary" onClick={onLogout} title="Logi välja">
              <LogOut size={16} />
              <span>Logi välja</span>
            </button>
          </div>
        )}
  ```

- [ ] **Step 7: Stiilid `src/index.css` lõppu**

```css
/* Sisselogimine */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg-dark);
}

.login-card {
  width: min(380px, 100%);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.auth-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--bg-dark);
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-menu-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.modal-content.change-password-modal {
  width: min(420px, 94vw);
}
```

- [ ] **Step 8: Tüübikontroll, testid, ehitus**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && touch src/main.tsx src/AuthGate.tsx src/App.tsx src/services/api.ts src/components/Header.tsx src/components/LoginPage.tsx src/components/ChangePasswordModal.tsx src/types/auth.ts src/index.css && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS'; npm test 2>&1 | grep 'Tests '; npm run build 2>&1 | grep -E 'built in|rror'"`
Expected: tüübivigu pole, testid PASS, kaks `built in`.

Kontrolli, et live (arendus) serveerib uut koodi: `curl -s http://127.0.0.1:5173/src/main.tsx | grep -c AuthGate` → `1`.

- [ ] **Step 9: Commit**

```bash
git add src/types/auth.ts src/services/api.ts src/AuthGate.tsx src/main.tsx src/App.tsx src/components/Header.tsx src/components/LoginPage.tsx src/components/ChangePasswordModal.tsx src/index.css
git commit -m "$(cat <<'EOF'
Lisa sisselogimise leht, kasutajamenüü ja parooli muutmine.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: KASUTAJA KONTROLL** — palu kasutajal avada https://teris.ee (Basic Auth + nüüd ka rakenduse sisselogimine), logida sisse oma kontoga, veenduda, et andmed laevad, ja proovida "Logi välja". (Täielik parooli muutmise test pärast Task 7.)

---

### Task 7: Teenus ja ümberlülitus

**Files:**
- Create (serveris): `/etc/systemd/system/teris.service`
- Modify (serveris): `/etc/apache2/sites-available/teris.ee.conf`
- Remove (serveris): `/etc/systemd/system/agro-dev.service`, `/etc/apache2/.htpasswd-agro`

- [ ] **Step 1: Loo ja käivita `teris.service`** (Apache suunab veel 5173 peale)

Fail `/private/tmp/claude-501/-Users-andresj-Progemine-agro/ae21de2f-a0e7-47b4-902e-6a2b14b28645/scratchpad/teris.service`:

```ini
[Unit]
Description=teris (toodanguserver, 127.0.0.1:8820)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=debian
WorkingDirectory=/home/debian/teris
Environment=PORT=8820
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist-server/prod.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Run:
```bash
cat /private/tmp/claude-501/-Users-andresj-Progemine-agro/ae21de2f-a0e7-47b4-902e-6a2b14b28645/scratchpad/teris.service | ssh uvn-243-120.tll07.zonevs.eu "sudo tee /etc/systemd/system/teris.service >/dev/null && sudo systemctl daemon-reload && cd /home/debian/teris && npm run build 2>&1 | grep -c 'built in' && sudo systemctl enable --now teris && sleep 3 && systemctl is-active teris && journalctl -u teris -n 3 --no-pager | tail -1 && BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts | tail -1"
```
Expected: `2`, `active`, logis `teris kuulab http://127.0.0.1:8820`, smoke `KÕIK KORRAS`.

- [ ] **Step 2: Suuna Apache toodanguserverile, eemalda Basic Auth**

Varukoopia ja uus virtuaalhost (`/private/tmp/…/scratchpad/teris.ee.conf`):

```apache
<VirtualHost *:80>
    ServerName teris.ee
    Redirect permanent / https://teris.ee/
</VirtualHost>

<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName teris.ee
    AddDefaultCharset UTF-8

    # Toodanguserver (teris.service); sisselogimine on rakenduses endas.
    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "https"
    ProxyPass / http://127.0.0.1:8820/
    ProxyPassReverse / http://127.0.0.1:8820/

    LogLevel warn
    CustomLog /var/log/apache2/teris.ee_access.log combined
    ErrorLog /var/log/apache2/teris.ee_error.log

    SSLCertificateFile      /etc/ssl/certs/ventcap-ee.crt
    SSLCertificateKeyFile   /etc/ssl/private/ventcap-ee.key
    SSLCertificateChainFile /etc/ssl/certs/ventcap-ee_ca.crt
    SSLEngine on
    SSLProtocol             all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder     off
    SSLOptions +StrictRequire
</VirtualHost>
</IfModule>
```

Run:
```bash
ssh uvn-243-120.tll07.zonevs.eu "sudo cp /etc/apache2/sites-available/teris.ee.conf /etc/apache2/sites-available/teris.ee.conf.bak-basic-auth" && cat /private/tmp/claude-501/-Users-andresj-Progemine-agro/ae21de2f-a0e7-47b4-902e-6a2b14b28645/scratchpad/teris.ee.conf | ssh uvn-243-120.tll07.zonevs.eu "sudo tee /etc/apache2/sites-available/teris.ee.conf >/dev/null && sudo apache2ctl configtest 2>&1 | tail -1 && sudo systemctl reload apache2 && echo reloaded"
```
Expected: `Syntax OK`, `reloaded`.

- [ ] **Step 3: Kontrolli avalikult**

Run (kohalikult):
```bash
cd /tmp && echo "http: $(curl -s -o /dev/null -w '%{http_code} → %{redirect_url}' http://teris.ee/)" && echo "leht: $(curl -s -o /dev/null -w '%{http_code}' https://teris.ee/)" && echo "status ilma sessioonita: $(curl -s -o /dev/null -w '%{http_code}' https://teris.ee/api/status)" && echo "me: $(curl -s -o /dev/null -w '%{http_code}' https://teris.ee/api/auth/me)" && echo "port 8820 väljast: $(curl -s -m 5 -o /dev/null -w '%{http_code}' http://185.31.243.120:8820/ || echo 'ei vasta')"
```
Expected: `301 → https://teris.ee/`; `leht: 200` (Basic Auth'i enam pole); `status ilma sessioonita: 401`; `me: 401`; `port 8820 väljast: ei vasta`.

- [ ] **Step 4: Eemalda vana arendusteenus ja Basic Auth'i fail**

Run:
```bash
ssh uvn-243-120.tll07.zonevs.eu "sudo systemctl disable --now teris-dev 2>&1 | tail -1; sudo rm -f /etc/systemd/system/agro-dev.service /etc/apache2/.htpasswd-agro && sudo systemctl daemon-reload && systemctl is-active teris-dev; ss -tlnp | grep -E ':5173|:8820'"
```
Expected: `agro-dev` → `inactive` (või "could not be found"), kuulab ainult `127.0.0.1:8820`.

- [ ] **Step 5: KASUTAJA KONTROLL** — https://teris.ee: sisselogimine (Basic Auth'i akent enam pole), andmed, parooli muutmine, väljalogimine.

Tagasipööramine vajadusel:
```bash
ssh uvn-243-120.tll07.zonevs.eu "sudo cp /etc/apache2/sites-available/teris.ee.conf.bak-basic-auth /etc/apache2/sites-available/teris.ee.conf && sudo systemctl reload apache2"
```
(Basic Auth'i paroolifail ja `agro-dev` tuleb siis uuesti luua — Task 7 Step 4 kustutas need.)

- [ ] **Step 6: Mälu uuendus** — `teris_server_setup.md`: teenus `teris.service` (port 8820, `journalctl -u teris`), release `npm run release`, kasutajad `npm run user -- …`, Basic Auth ja `agro-dev` eemaldatud.

---

### Task 8: README

**Files:**
- Modify: `README.md` (kogu sisu asendub)

- [ ] **Step 1: Kirjuta `README.md`**

```markdown
# teris map

Põllumajandusettevõtte kaardirakendus: PRIA põllud ja külvikord, masinapark ja
Teltonika telemeetria, mullaproovid, e-PRIA põlluraamat, seotud isikud.

## Arhitektuur

    Brauser ──HTTPS──> Apache (teris.ee)
                         └─> 127.0.0.1:8820  teris.service (node dist-server/prod.js)
                               ├─ /api/*  API + sisselogimine (src/server/apiHandler.ts, authGate.ts)
                               └─ muu     dist/ (React + Vite)
                             PostgreSQL: teris_db (Prisma), agro_tsdb (telemeetria)

- Kasutajaliides: React 19 + TypeScript + Vite, kaart Leaflet.
- Server: `node:http` ilma raamistikuta, Prisma 6. Sama API käsitleja töötab ka
  `npm run dev` puhul (Vite'i plugin `src/server/dbApiPlugin.ts`).
- Sisselogimine: kasutajad ja sessioonid andmebaasis (`users`, `sessions`),
  `HttpOnly` küpsis, paroolid `scrypt`.

## Käsud (serveris `/home/debian/teris`)

| Käsk | Tegevus |
|---|---|
| `npm run release` | tüübikontroll, testid, ehitus, `teris` teenuse taaskäivitus |
| `npm run build` | kasutajaliides `dist/` + server `dist-server/` |
| `npm test` | ühiktestid (Vitest) |
| `npm run user -- add <nimi> [--display "Nimi"]` | uus kasutaja (parool küsitakse) |
| `npm run user -- passwd <nimi>` | parooli muutmine |
| `npm run user -- disable <nimi>` / `enable <nimi>` | keelamine / lubamine |
| `npm run user -- list` | kasutajad |
| `npm run user -- logout <nimi>` | lõpetab kasutaja sessioonid |
| `npm run dev` | Vite arendusserver `127.0.0.1:5173` (nt SSH tunneliga) |

Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json`.
Integratsioonitest töötava serveri vastu: `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts`.

## Teenus ja logid

- `sudo systemctl status|restart teris`, logid `journalctl -u teris -f`.
- Apache: `/etc/apache2/sites-available/teris.ee.conf` (`*.ventcap.ee` sertifikaat).

## Andmebaas

- Ühendused `.env` failis (`DATABASE_URL`, `TSDB_DATABASE_URL`) — ei ole repos.
- Skeem: `prisma/schema.prisma`; muudatus: `npx prisma db push` + `npx prisma generate` + `npm run release`.
- **Enne ohtlikku muudatust varukoopia:** `pg_dump … -Fc -f ~/db_backups/teris_db_<aeg>.dump`.

## Failid, mis ei käi git'i

- `._scratch/` — impordifailid (PRIA, põlluraamat, mullaproovid); sisaldavad isikuandmeid.
- `.env`, `dist/`, `dist-server/`, `node_modules/`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Asenda Vite'i mall-README projekti README-ga.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```
