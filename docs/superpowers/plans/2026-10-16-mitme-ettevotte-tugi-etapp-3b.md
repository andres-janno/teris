# Mitme ettevõtte tugi, etapp 3b: teenusepakkuja keskkond — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teenusepakkuja (rakenduse autor) logib aadressil https://admin.teris.ee sisse parooli ja TOTP-koodiga, näeb ettevõtete nimekirja koondarvudega, loob uue ettevõtte (litsents + ettevõte ise operaatorina + admin-kasutaja kutsega), muudab litsentse, peatab/taasaktiveerib ettevõtteid ja näeb tegevuste logi.

**Architecture:** Sama Node'i protsess ja port (8820). `Host: admin.teris.ee` päringud suunatakse platvormi API-sse (`/api/platform/*`) ja platvormi kasutajaliidesesse (`admin.html`); muud hostid platvormi API-d ei näe. Platvormi kasutajad, sessioonid ja logi on eraldi tabelites (`teris_app` neid ei näe), kõik platvormi päringud käivad `authDb()` (`teris_platform`, BYPASSRLS) kaudu. TOTP (RFC 6238, SHA-1, 6 numbrit, 30 s) on oma moodul Node'i `crypto`-ga; saladus hoitakse AES-256-GCM-iga krüpteeritult (`PLATFORM_TOTP_KEY`). Platvormi küpsis `teris_platform_session` on hostipõhine ja `SameSite=Strict`.

**Tech Stack:** Node 22 (`crypto`), TypeScript 6, Prisma 6.19, PostgreSQL 17, React 19 + Vite 8 (mitmeleheline ehitus), Vitest 5, Apache 2 + certbot.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md` — osad 1.1 (`PlatformUser`, `PlatformSession`, `PlatformAuditLog`), 5.1, 5.2 (vaated 1–3 ja 6). Väljas: 5.2 vaade 4 (algkataloog → etapp 3c), vaade 5 (seadmed → etapp 4), 5.3 (tugiligipääs → etapp 5).

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi**; käsud serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta. Git kohalikult.
- **`npm run build` ainult release'i ajal** (Task 8). Kontrolliks `npx tsc --noEmit -p tsconfig.app.json` ja `npm test`.
- Rollid: `teris_app` (rakendus, RLS), `teris_platform` (`authDb()`, BYPASSRLS), `teris` (omanik; PG* muutujad). URL-id lõpevad `?schema=public` — psql-iga PG* muutujad või `${VAR%%\?*}`. **Saladusi ei trükita** (ei `cat .env`, ei URL-e, ei paroole, ei TOTP saladusi logidesse).
- Varukoopia enne andmebaasi muudatust `teris_platform` rolliga: `set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-<silt>.dump && chmod 600 ~/backups/*.dump`.
- Kui Claude Code'i automaatrežiim keelab käsu, ära otsi ümbersõitu — lõpeta muu ja anna käsk kasutajale.
- Platvormi host: keskkonnamuutuja `PLATFORM_HOST`, vaikimisi `admin.teris.ee`. Platvormi päritolu (CSRF): `https://admin.teris.ee`.
- Platvormi tabelid ei tohi olla `teris_app`-ile kättesaadavad: lisa need `scripts/tenancy/04-privileges.sql`-i ja `02-rls.sql` lõpu `REVOKE`-i; olemasolev test „iga `tenant_id`-ta tabel on `teris_app`-ile lukus“ kontrollib.
- Platvormi logi väli on **`targetTenantId`** (mitte `tenantId`), et mudel ei satuks `TENANT_MODELS`-i.
- TOTP: 6 numbrit, 30 s samm, SHA-1, aken ±1 samm; sama koodi ei aktsepteerita sama kasutaja jaoks kaks korda (viimase kasutatud sammu number salvestatakse).
- Platvormi sessioon: 12 h, ilma libiseva pikenduseta. Sisselogimise piiraja: 5 katset / 15 min kasutajanime ja IP kohta.
- Veateated eesti keeles; sisselogimise viga alati üldine: `Vale kasutajanimi, parool või kood`.
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release, Apache/certbot muudatus ja `git push` ainult kasutaja kinnitusel (Task 8).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `PlatformUser`, `PlatformSession`, `PlatformAuditLog` |
| `scripts/tenancy/04-privileges.sql`, `02-rls.sql` | REVOKE uutele platvormi tabelitele |
| `src/server/totp.ts` (+ test) | Base32, TOTP genereerimine/kontroll, otpauth URI, saladuse krüpteerimine |
| `src/server/platformCli.ts` | `npm run platform -- add/list/passwd/reset-totp/disable/enable` |
| `src/server/platformAuth.ts` (+ test) | `/api/platform/auth/*`, platvormi sessioon, `platformUserOf(req)` |
| `src/server/platformApi.ts` (+ test) | Ettevõtted, litsentsid, peatamine, kutse uuesti, logi |
| `src/server/platformHost.ts` | `isPlatformHost(req)` |
| `src/server/apiHandler.ts`, `prod.ts`, `static.ts`, `dbApiPlugin.ts` | Hostipõhine suunamine |
| `admin.html`, `src/admin/*` | Platvormi kasutajaliides |
| `vite.config.ts`, `vite.server.config.ts`, `package.json` | Mitmeleheline ehitus, `platformCli` sisend, `platform` skript |

---

### Task 1: Platvormi tabelid

**Files:**
- Modify: `prisma/schema.prisma` (ettevõtete ploki järele)
- Modify: `scripts/tenancy/04-privileges.sql`, `scripts/tenancy/02-rls.sql` (lõpu REVOKE)

**Interfaces:**
- Produces: Prisma mudelid `platformUser`, `platformSession`, `platformAuditLog`.

- [ ] **Step 1: Skeem**

```prisma
// ============================================================================
// TEENUSEPAKKUJA (PLATVORM) — loetakse ainult authDb() kaudu, teris_app ei näe
// ============================================================================
model PlatformUser {
  id            String            @id @default(cuid())
  username      String            @unique // väiketähtedega
  passwordHash  String
  totpSecretEnc String // AES-256-GCM krüpteeritud base32 saladus (PLATFORM_TOTP_KEY)
  totpLastStep  Int               @default(0) // viimati aktsepteeritud TOTP samm (korduskasutuse vastu)
  isActive      Boolean           @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  sessions PlatformSession[]

  @@map("platform_users")
}

model PlatformSession {
  id             String       @id @default(cuid())
  platformUserId String
  tokenHash      String       @unique // SHA-256 küpsise tokenist
  expiresAt      DateTime
  userAgent      String?
  createdAt      DateTime     @default(now())

  platformUser PlatformUser @relation(fields: [platformUserId], references: [id], onDelete: Cascade)

  @@index([platformUserId])
  @@map("platform_sessions")
}

model PlatformAuditLog {
  id             String   @id @default(cuid())
  platformUserId String? // null = käsurida
  action         String // nt TENANT_CREATE, LICENSE_UPDATE, TENANT_SUSPEND, TENANT_ACTIVATE, INVITE_RESEND, LOGIN
  targetTenantId String? // mitte "tenantId" — muidu satuks mudel TENANT_MODELS-i
  details        Json?
  createdAt      DateTime @default(now())

  @@index([targetTenantId])
  @@index([createdAt])
  @@map("platform_audit_log")
}
```

- [ ] **Step 2: REVOKE**

`04-privileges.sql` ja `02-rls.sql` lõpu `REVOKE` lausesse lisa `platform_users, platform_sessions, platform_audit_log` (ja `04` `GRANT ... TO teris_platform` lausesse samuti).

- [ ] **Step 3: Varukoopia, `db push`, õigused**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-3b-t1.dump && chmod 600 ~/backups/*.dump && npx prisma db push && npx prisma generate && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql'
```
Expected: `in sync` (ainult uued tabelid), `REVOKE`, `GRANT`. Kui `db push` on keelatud, peatu ja anna käsk kasutajale.

- [ ] **Step 4: Testid ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS (sh „tenant_id-ta tabelid teris_app-ile lukus“ — nüüd 7 tabelit).
```bash
git add prisma/schema.prisma scripts/tenancy/04-privileges.sql scripts/tenancy/02-rls.sql
git commit -m "Platvormi tabelid: PlatformUser, PlatformSession, PlatformAuditLog (teris_app-ile lukus)"
```

---

### Task 2: TOTP moodul

**Files:**
- Create: `src/server/totp.ts`, `src/server/totp.test.ts`

**Interfaces:**
- Produces:
  - `base32Encode(buf: Buffer): string`, `base32Decode(s: string): Buffer`
  - `generateTotpSecret(): string` (20 juhuslikku baiti, base32)
  - `totpCode(secretBase32: string, step: number): string` (6 numbrit)
  - `totpStep(now: Date): number` (= `Math.floor(now.getTime() / 30000)`)
  - `verifyTotp(secretBase32: string, code: string, now: Date, lastStep: number): number | null` — tagastab aktsepteeritud sammu (aken ±1, `> lastStep`) või `null`
  - `otpauthUri(account: string, secretBase32: string): string` (issuer `Teris`)
  - `encryptTotpSecret(secret: string, keyHex: string): string`, `decryptTotpSecret(enc: string, keyHex: string): string` (AES-256-GCM, vorming `iv.tag.ciphertext` base64url)

- [ ] **Step 1: Kirjuta failiv test**

```ts
import { describe, it, expect } from 'vitest';
import {
  base32Encode, base32Decode, generateTotpSecret, totpCode, totpStep, verifyTotp,
  otpauthUri, encryptTotpSecret, decryptTotpSecret
} from './totp';

// RFC 6238 lisa B: saladus "12345678901234567890" (SHA-1), 8-kohalised koodid → meie 6 viimast numbrit
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('base32', () => {
  it('kodeerib ja dekodeerib', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(RFC_SECRET).toString()).toBe('12345678901234567890');
    expect(base32Decode('gezd gnbv-gy3t')).toEqual(base32Decode('GEZDGNBVGY3T')); // tühikud, sidekriipsud, väiketähed
  });
});

describe('totpCode (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037']
  ])('T=%i → %s', (t, code) => expect(totpCode(RFC_SECRET, Math.floor(t / 30))).toBe(code));
});

describe('verifyTotp', () => {
  const now = new Date(1234567890 * 1000);
  const step = totpStep(now);
  it('aktsepteerib praeguse ja ±1 sammu koodi', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now, 0)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now, 0)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now, 0)).toBe(step + 1);
  });
  it('lükkab tagasi vana, vigase ja juba kasutatud koodi', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '000000', now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abc', now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now, step)).toBeNull();
  });
});

describe('saladus', () => {
  it('genereerib 32-märgilise base32 saladuse', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(s);
  });
  it('otpauth URI', () => {
    expect(otpauthUri('andres', 'ABC')).toBe('otpauth://totp/Teris:andres?secret=ABC&issuer=Teris&algorithm=SHA1&digits=6&period=30');
  });
  it('krüpteerib ja dekrüpteerib; vale võtmega viskab', () => {
    const key = 'a'.repeat(64);
    const enc = encryptTotpSecret('GEZDGNBV', key);
    expect(enc).not.toContain('GEZDGNBV');
    expect(decryptTotpSecret(enc, key)).toBe('GEZDGNBV');
    expect(() => decryptTotpSecret(enc, 'b'.repeat(64))).toThrow();
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/totp.test.ts`. Expected: FAIL — moodulit pole.

- [ ] **Step 3: Implementeeri** (`src/server/totp.ts`)

```ts
// src/server/totp.ts — TOTP (RFC 6238: SHA-1, 6 numbrit, 30 s) teenusepakkuja sisselogimiseks.
import { createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Vigane base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = (): string => base32Encode(randomBytes(20));
export const totpStep = (now: Date): number => Math.floor(now.getTime() / 1000 / STEP_SECONDS);

export function totpCode(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Aktsepteeritud samm või null. Sammud <= lastStep on juba kasutatud (korduskasutuse vastu). */
export function verifyTotp(secretBase32: string, code: string, now: Date, lastStep: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(now);
  for (let s = current - WINDOW; s <= current + WINDOW; s++) {
    if (s <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secretBase32, s)), Buffer.from(code))) return s;
  }
  return null;
}

export function otpauthUri(account: string, secretBase32: string): string {
  return `otpauth://totp/Teris:${encodeURIComponent(account)}?secret=${secretBase32}&issuer=Teris&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

function keyOf(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('PLATFORM_TOTP_KEY peab olema 32 baiti (64 hex-märki)');
  return key;
}

export function encryptTotpSecret(secret: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(keyHex), iv);
  const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

export function decryptTotpSecret(enc: string, keyHex: string): string {
  const [iv, tag, ct] = enc.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyOf(keyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/totp.test.ts && npx tsc --noEmit -p tsconfig.app.json`. Expected: PASS.
```bash
git add src/server/totp.ts src/server/totp.test.ts
git commit -m "TOTP moodul (RFC 6238) ja saladuse krüpteerimine teenusepakkuja sisselogimiseks"
```

---

### Task 3: Käsurea tööriist `npm run platform` ja `PLATFORM_TOTP_KEY`

**Files:**
- Create: `src/server/platformCli.ts`
- Modify: `vite.server.config.ts` (`input` → `platformCli`), `package.json` (`"platform": "node dist-server/platformCli.js"`)

**Interfaces:**
- Consumes: `authDb()`, `hashPassword`, `validateNewPassword` (`./auth`), TOTP funktsioonid (Task 2)

- [ ] **Step 1: Võti `.env`-i (ilma trükkimata)**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && grep -q "^PLATFORM_TOTP_KEY=" .env || { cp .env .env.bak-before-totp && chmod 600 .env.bak-before-totp && echo "PLATFORM_TOTP_KEY=$(openssl rand -hex 32)" >> .env; }; grep -c "^PLATFORM_TOTP_KEY=" .env'
```
Expected: `1`. **NB:** võtme kaotamisel tuleb kõigil platvormi kasutajatel TOTP uuesti seadistada (`reset-totp`).

- [ ] **Step 2: Implementeeri** (`src/server/platformCli.ts`)

Järgi `userCli.ts` mustrit (varjatud parooli küsimine `ask`/`askNewPassword` — kopeeri need abifunktsioonid, ära impordi `userCli.ts`-ist, sest see käivitab `main()`-i importimisel). Käsud:
- `add <nimi>` — küsib parooli kaks korda; genereerib TOTP saladuse; salvestab `totpSecretEnc = encryptTotpSecret(secret, process.env.PLATFORM_TOTP_KEY)`; **trükib ainult terminali** (mitte logisse): `TOTP seadistamiseks lisa autentimisrakendusse (Google Authenticator, 1Password jm) käsitsi võti: <secret>` ja `või URI: <otpauthUri(nimi, secret)>`; logikirje `PlatformAuditLog { action: 'PLATFORM_USER_ADD', platformUserId: null, details: { username } }`.
- `list` — kasutajanimi, aktiivne, viimane sisselogimine.
- `passwd <nimi>` — uus parool; kustutab kasutaja platvormi sessioonid.
- `reset-totp <nimi>` — uus saladus (trükitakse nagu `add`), `totpLastStep = 0`, sessioonid kustutatakse.
- `disable <nimi>` / `enable <nimi>` — `isActive`; `disable` kustutab sessioonid.
Kasutajanimi väiketähtedega, max 64 märki, muster `^[a-z0-9._-]+$`. Kui `PLATFORM_TOTP_KEY` puudub, viga `PLATFORM_TOTP_KEY puudub`.
`vite.server.config.ts` `input`: `platformCli: 'src/server/platformCli.ts'`. `package.json`: `"platform": "node dist-server/platformCli.js"` rea `"tenant"` järele.

- [ ] **Step 3: Kontroll** (ilma `build:server`-ita: käivita `tsx`-iga)

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && printf "Test-parool-12345\nTest-parool-12345\n" | npx tsx src/server/platformCli.ts add zz-cli-test | grep -c "käsitsi võti" && npx tsx src/server/platformCli.ts list | grep zz-cli-test && npx tsx src/server/platformCli.ts disable zz-cli-test && npx tsx src/server/platformCli.ts list | grep zz-cli-test'
```
Expected: `1`, rida `zz-cli-test` aktiivsena, siis mitteaktiivsena. **Koristus:** kustuta testkasutaja `authDb()` kaudu ühekordse `tsx -e` skriptiga (`platformUser.deleteMany({ where: { username: 'zz-cli-test' } })` ja vastav logirida). Ära trüki TOTP võtit raportisse — kontrolli ainult `grep -c`-ga.

- [ ] **Step 4: Commit**

```bash
git add src/server/platformCli.ts vite.server.config.ts package.json
git commit -m "Teenusepakkuja kasutajate käsurea haldus (npm run platform) TOTP-ga"
```

Esimese päris platvormi kasutaja loob **kasutaja ise** pärast release'i (Task 8), et TOTP võti jõuaks ainult tema terminali.

---

### Task 4: Platvormi sisselogimine ja hostipõhine suunamine

**Files:**
- Create: `src/server/platformHost.ts`, `src/server/platformAuth.ts`, `src/server/platformAuth.test.ts`
- Modify: `src/server/apiHandler.ts` (`routeApiRequest` algus, `ApiOptions`), `src/server/prod.ts`, `src/server/dbApiPlugin.ts`

**Interfaces:**
- Consumes: `authDb()`, `verifyPassword`, `hashToken`, `generateSessionToken`, `parseCookies`, `createLoginLimiter`, `checkMutationRequest`, `clientIpFrom` (`./auth.ts`); `verifyTotp`, `decryptTotpSecret` (Task 2); `json`, `parseBody`, `hasRequestBody` (`./http.ts`)
- Produces:
  - `isPlatformHost(req: IncomingMessage): boolean` (`platformHost.ts`) — `Host` päis (ilma pordita, väiketähtedega) võrdub `process.env.PLATFORM_HOST ?? 'admin.teris.ee'`
  - `PLATFORM_COOKIE = 'teris_platform_session'`
  - `handlePlatformAuth(req, res, pathname, method, options: { allowedOrigins: string[] }): Promise<boolean>` — `/api/platform/auth/login|logout|me`; muul juhul laeb sessiooni ja jätab `platformUserOf(req)`; tagastab `true`, kui vastus on saadetud (sh 401 sessioonita)
  - `platformUserOf(req: IncomingMessage): { id: string; username: string } | null`
  - `ApiOptions` saab välja `platformAllowedOrigins: string[]` ja `platformOnAnyHost?: boolean` (arendus)

- [ ] **Step 1: Kirjuta failiv test** (`platformAuth.test.ts`)

Testi abiks loo minimaalne võlts-req/res (vt `adminUsers.test.ts` mustrit): `req` on `Readable` keha + `headers` (`host: 'admin.teris.ee'`, `origin: 'https://admin.teris.ee'`, `content-type: 'application/json'`, `cookie`), `method`, `url`, `socket: { remoteAddress: '127.0.0.1' }`; `res` kogub `statusCode`, päised (`setHeader`/`appendHeader`) ja keha.
Testid (`beforeAll`: loo `authDb()` kaudu platvormi kasutaja `zz-plat-<pid>` teadaoleva parooli ja teadaoleva TOTP saladusega `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, krüpteeritud testivõtmega — testis sea `process.env.PLATFORM_TOTP_KEY = 'c'.repeat(64)` **enne** moodulite importi või loe võtit funktsioonis igal kutsel; `afterAll`: kustuta kasutaja, sessioonid, logiread):
1. õige parool + õige kood → 200, `Set-Cookie` sisaldab `teris_platform_session=`, `HttpOnly`, `SameSite=Strict`, `Max-Age=43200`; `/api/platform/auth/me` selle küpsisega → 200 `{ user: { username } }`.
2. sama koodi teistkordne kasutamine (uus login samas sammus) → 401 `Vale kasutajanimi, parool või kood`.
3. vale kood → 401 sama tekstiga; vale parool → 401 sama tekstiga; olematu kasutaja → 401.
4. `origin: 'https://teris.ee'` POST login → 403.
5. logout → küpsis kustutatud, `me` → 401.
6. `isPlatformHost`: `admin.teris.ee` ja `admin.teris.ee:443` → `true`; `teris.ee` → `false`.

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/platformAuth.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implementeeri**

`platformHost.ts`:
```ts
// src/server/platformHost.ts — kas päring on teenusepakkuja keskkonda (admin.teris.ee)
import type { IncomingMessage } from 'http';

export function isPlatformHost(req: IncomingMessage): boolean {
  const host = String(req.headers.host ?? '').toLowerCase().replace(/:\d+$/, '');
  return host === (process.env.PLATFORM_HOST ?? 'admin.teris.ee').toLowerCase();
}
```

`platformAuth.ts` — põhiloogika:
```ts
// src/server/platformAuth.ts — teenusepakkuja sisselogimine (parool + TOTP), eraldi sessioonid ja küpsis.
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db.ts';
import { json, parseBody, hasRequestBody } from './http.ts';
import { verifyPassword, hashPassword, generateSessionToken, hashToken, parseCookies, createLoginLimiter, checkMutationRequest, clientIpFrom } from './auth.ts';
import { verifyTotp, decryptTotpSecret } from './totp.ts';

export const PLATFORM_COOKIE = 'teris_platform_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_ERROR = 'Vale kasutajanimi, parool või kood';
const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const users = new WeakMap<IncomingMessage, { id: string; username: string } | null>();

let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('teris-platform-dummy-password'));

export const platformUserOf = (req: IncomingMessage) => users.get(req) ?? null;

const cookie = (token: string, maxAgeSec: number) =>
  `${PLATFORM_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
```
Sisselogimine (`POST /api/platform/auth/login`, keha `{ username, password, code }`, max 16 KB):
- piiraja võtmed `pu:<username>` ja `pip:<ip>`; blokeeritud → 429 `Liiga palju katseid, proovi 15 minuti pärast`;
- kasutaja `authDb().platformUser.findUnique({ where: { username } })`; parooli kontroll ka olematu/mitteaktiivse kasutaja korral dummy-räsiga (ajastus);
- TOTP: `verifyTotp(decryptTotpSecret(u.totpSecretEnc, key), code, new Date(), u.totpLastStep)`; edu korral **atomaarne** samm-uuendus: `updateMany({ where: { id: u.id, totpLastStep: { lt: step } }, data: { totpLastStep: step, lastLoginAt: new Date() } })` — kui `count === 0`, siis viga (kood juba kasutatud);
- mis tahes viga → `registerFailure` mõlemale võtmele, 401 `LOGIN_ERROR`;
- edu → `reset`, sessioon (`tokenHash`, `expiresAt = now + 12 h`, `userAgent` ≤300), aegunud platvormi sessioonide koristus (parim katse), logi `LOGIN`, `Set-Cookie: cookie(token, 43200)`, vastus `{ user: { username } }`.
`POST /api/platform/auth/logout` → sessioon kustutatakse, `Set-Cookie: cookie('', 0)`, `{ success: true }`.
`GET /api/platform/auth/me` → `{ user: { username } }` või 401 `Sisselogimine on vajalik`.
Muud `/api/platform/*`: sessioon kehtib (`expiresAt > now`, kasutaja aktiivne) → `users.set(req, …)` ja `false`; muidu 401.
CSRF: iga muutev päring `checkMutationRequest(..., options.allowedOrigins)` — mitte `ok` → 403 `Keelatud päring`.
Võti: `process.env.PLATFORM_TOTP_KEY` loetakse kutse ajal; puudumisel 500 `Platvorm pole seadistatud` (logisse põhjus ilma väärtuseta).

`apiHandler.ts` `routeApiRequest` algusesse (enne `authGate`):
```ts
    if (isPlatformHost(req) || (options.platformOnAnyHost && pathname.startsWith('/api/platform/'))) {
      await handlePlatformRequest(req, res, pathname, method, url, options);
      return;
    }
    if (pathname.startsWith('/api/platform/')) return json(res, { error: 'Not found' }, 404);
```
kus `handlePlatformRequest` (failis `platformApi.ts`, Task 5; selles taskis ajutiselt `platformAuth.ts`-is) kutsub `handlePlatformAuth` ja seejärel (Task 5) platvormi API; tundmatu tee → 404. Platvormi host ei näe kunagi ettevõtte API-t.
`prod.ts` `API_OPTIONS`: `platformAllowedOrigins: ['https://admin.teris.ee']`. `dbApiPlugin.ts` `DEV_OPTIONS`: `platformAllowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173']`, `platformOnAnyHost: true`.

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/platformAuth.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/platformHost.ts src/server/platformAuth.ts src/server/platformAuth.test.ts src/server/apiHandler.ts src/server/prod.ts src/server/dbApiPlugin.ts
git commit -m "Teenusepakkuja sisselogimine (parool + TOTP), eraldi sessioon ja hostipõhine suunamine"
```

---

### Task 5: Platvormi API — ettevõtted, litsentsid, peatamine, kutse, logi

**Files:**
- Create: `src/server/platformApi.ts`, `src/server/platformApi.test.ts`
- Modify: `src/server/apiHandler.ts` (kutsub `handlePlatformRequest` `platformApi.ts`-ist)

**Interfaces:**
- Consumes: `handlePlatformAuth`, `platformUserOf` (Task 4); `authDb()`; `loadLicenseState`, `LICENSE_MODULES` (`./license.ts`); `sendPasswordLink` (`./passwordTokens.ts`); `normalizeUsername`, `USERNAME_ERROR` (`./adminRules.ts`); `normalizeEmail` (`./mail.ts`)
- Produces: `handlePlatformRequest(req, res, pathname, method, url, options): Promise<void>` ja teed:

| Meetod ja tee | Kirjeldus |
|---|---|
| GET `/api/platform/tenants` | `[{ id, name, registryCode, status, createdAt, license: LicenseState, userCount, activeUserCount, fieldCount, areaHa, lastLoginAt }]` |
| POST `/api/platform/tenants` | Keha `{ name, registryCode?, adminUsername, adminDisplayName?, adminEmail, validUntil, modules }` → 201 `{ id }` |
| GET `/api/platform/tenants/:id` | Üks ettevõte (sama kuju) + `users: [{ username, displayName, email, isAdmin, isActive, lastLoginAt, hasPassword }]` |
| PATCH `/api/platform/tenants/:id/license` | `{ validUntil, modules }` |
| POST `/api/platform/tenants/:id/suspend` | `status = SUSPENDED`, ettevõtte kasutajate sessioonid kustutatakse |
| POST `/api/platform/tenants/:id/activate` | `status = ACTIVE` |
| POST `/api/platform/tenants/:id/resend-invite` | Keha `{ username }` — ainult selle ettevõtte kasutaja, kellel parool määramata → kutse uuesti |
| GET `/api/platform/audit?tenantId=&limit=` | Logi (uuemad ees, `limit` ≤ 200, vaikimisi 50), koos platvormi kasutaja nimega |

- [ ] **Step 1: Kirjuta failiv test** (`platformApi.test.ts`, sama võlts-req/res abi mis Task 4-s; `process.env.MAIL_DISABLED = '1'`; platvormi kasutaja ja sessioon luuakse `authDb()` kaudu, küpsis lisatakse päringule)

Testid:
1. **Uue ettevõtte loomine** POST `/api/platform/tenants` `{ name: 'Test Agro <pid>', registryCode: '12345678', adminUsername: 'zz-adm-<pid>', adminEmail: 'zz-adm-<pid>@example.invalid', validUntil: '2027-12-31', modules: ['SATELLITE'] }` → 201; seejärel `authDb()` kaudu kontrolli:
   - `tenants` rida `ACTIVE`, `primaryPartyId` viitab `related_parties` reale, mille `tenant_id` on uus ettevõte, `name` = ettevõtte nimi, `roles` sisaldab `OPERATOR`, `type = LEGAL_ENTITY`, `code = '12345678'`;
   - `tenant_licenses` `2027-12-31`, `['SATELLITE']`;
   - `users` rida `zz-adm-<pid>`, `tenant_id` = uus ettevõte, `isAdmin = true`, `passwordHash = ''` (kutse), e-post normaliseeritud;
   - `password_tokens` rida (kutse) olemas;
   - `platform_audit_log` rida `TENANT_CREATE`, `targetTenantId` = uus ettevõte.
2. **Eraldus:** uue ettevõtte kontekstis (`runAsTenant(newId, ...)`) `prisma.field.count()` → 0 ja `prisma.relatedParty.count()` → 1; Loisu kontekstis uue ettevõtte operaatorit ei leita.
3. **Atomaarsus:** sama `adminUsername`-iga teine loomine → 409 `Kasutajanimi on juba kasutusel`; `tenants` tabelisse ei teki teist rida selle nimega.
4. **Valideerimine:** tühi nimi → 400; vigane kuupäev (`2027-02-30`) → 400; tundmatu moodul → 400; vigane e-post → 400.
5. **Litsents:** PATCH → `loadLicenseState(newId)` vastab; logi `LICENSE_UPDATE` koos vana ja uue väärtusega `details`-is.
6. **Peatamine:** loo uue ettevõtte kasutajale sessioon (`authDb()`), POST suspend → staatus `SUSPENDED`, sessioon kustutatud, `findActiveSession` → null; activate → `ACTIVE`.
7. **Ilma platvormi sessioonita** GET `/api/platform/tenants` → 401; **ettevõtte host** (`host: 'teris.ee'`) `/api/platform/tenants` → 404.
8. **Nimekiri:** GET tenants sisaldab Loisu (`fieldCount > 0`) ja uut ettevõtet (`userCount = 1`, `fieldCount = 0`).
`afterAll` koristus (vigade korral logida, mitte neelata vaikselt): uue ettevõtte `password_tokens`, `sessions`, `users`, `related_parties` (`runAsTenant(newId)` või `authDb()` `where: { tenantId: newId }`), `tenant_licenses`, `tenants`, logiread, platvormi kasutaja ja sessioonid.

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/platformApi.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implementeeri** (`src/server/platformApi.ts`)

Põhimõtted:
- Kõik päringud `authDb()` kaudu; ettevõtte andmeid **ainult koondarvudena** (`groupBy` / `count` `tenantId` järgi):
  - `userCount`/`activeUserCount`: `user.groupBy({ by: ['tenantId'], _count: true, ... })`;
  - `fieldCount`: `field.groupBy({ by: ['tenantId'], _count: true })`;
  - `areaHa`: jooksva aasta (`new Date().getFullYear()`) `fieldSeason.groupBy({ by: ['tenantId'], where: { year }, _sum: { areaHa: true } })`;
  - `lastLoginAt`: `user.groupBy({ by: ['tenantId'], _max: { lastLoginAt: true } })`.
- **Uue ettevõtte loomine ühes tehingus** (`authDb().$transaction(async (tx) => …)`):
  1. valideeri: `name` 1–200 märki; `registryCode` valikuline ≤ 20; `adminUsername` → `normalizeUsername` (vigane → 400 `USERNAME_ERROR`); `adminEmail` → `normalizeEmail` (vigane → 400 `Vigane e-posti aadress`); `validUntil` range `YYYY-MM-DD` ja päris kuupäev (sama round-trip kontroll nagu `tenantCli.ts`); `modules` ⊆ `LICENSE_MODULES`;
  2. `tenant.create({ data: { name, registryCode } })`;
  3. `relatedParty.create({ data: { tenantId: t.id, name, type: 'LEGAL_ENTITY', code: registryCode ?? null, roles: ['OPERATOR'] } })` → `tenant.update({ primaryPartyId })`;
  4. `tenantLicense.create({ data: { tenantId: t.id, validUntil, modules, updatedBy: platformUser.username } })`;
  5. `user.create({ data: { tenantId: t.id, username, displayName, email, passwordHash: '', isAdmin: true } })`;
  6. `platformAuditLog.create({ action: 'TENANT_CREATE', platformUserId, targetTenantId: t.id, details: { name, adminUsername, validUntil, modules } })`;
  Prisma `P2002` (kasutajanimi/e-post) → 409 `Kasutajanimi on juba kasutusel` / `E-posti aadress on juba kasutusel` (vaata `meta.target`). **Pärast** edukat tehingut: `sendPasswordLink(user, 'INVITE')` (viga logitakse, vastus 201 `{ id, inviteSent: boolean }`).
  `tenant_id` antakse kõigil ridadel selgesõnaliselt (platvormi rollil `app.tenant_id` puudub). Etapi 3a trigerid kontrollivad, et `primaryPartyId`-ga seotud read kuuluvad samale ettevõttele.
- **Peatamine:** tehingus `tenant.update({ status: 'SUSPENDED' })` + `session.deleteMany({ where: { user: { tenantId: id } } })` (kui Prisma relatsioonifilter `Session.user` toimib; muidu kasutajate ID-de kaudu) + logi `TENANT_SUSPEND`.
- **Kutse uuesti:** kasutaja peab kuuluma sellele ettevõttele ja `passwordHash === ''` ning `email` olemas; muidu 400. Logi `INVITE_RESEND`.
- Iga muutev tegevus kirjutab `platformAuditLog` rea; logi `details` ei sisalda kunagi paroole ega tokeneid.
- Tundmatu `:id` → 404 `Ettevõtet ei leitud`.

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/platformApi.test.ts src/server/platformAuth.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS. Kontrolli pärast, et testettevõtteid ei jäänud: `npm run tenant -- list` (tsx-iga: `npx tsx src/server/tenantCli.ts list`) näitab ainult Loisu Agro.
```bash
git add src/server/platformApi.ts src/server/platformApi.test.ts src/server/apiHandler.ts
git commit -m "Platvormi API: ettevõtete nimekiri ja loomine, litsentsid, peatamine, kutse, logi"
```

---

### Task 6: Platvormi kasutajaliides (`admin.html`)

**Files:**
- Create: `admin.html`, `src/admin/main.tsx`, `src/admin/AdminApp.tsx`, `src/admin/platformApi.ts`, `src/admin/LoginView.tsx`, `src/admin/TenantsView.tsx`, `src/admin/TenantDetail.tsx`, `src/admin/NewTenantForm.tsx`, `src/admin/AuditView.tsx`, `src/admin/admin.css`
- Modify: `vite.config.ts` (`build.rollupOptions.input`)

**Interfaces:**
- Consumes: Task 5 teed ja vastuste kujud.

- [ ] **Step 1: Mitmeleheline ehitus**

`vite.config.ts`:
```ts
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html' }
    }
  },
```
(Vite 8 kasutab rolldown'i — kui `rollupOptions` hoiatab, kasuta `rolldownOptions` nagu `vite.server.config.ts`-is.) `admin.html` nagu `index.html`, aga pealkiri `Teris — teenusepakkuja`, skript `/src/admin/main.tsx`.

- [ ] **Step 2: Kasutajaliides**

Kasuta rakenduse stiile (`import '../index.css'` + väike `admin.css`), olemasolevaid klasse (`btn`, `btn-primary`, `btn-secondary`, `alert-box`, `glass-card`, tabelid nagu `UsersAdminModal`-is). Lehed (lihtne olekupõhine vaatevahetus, ilma ruuterita):
- **LoginView:** kasutajanimi, parool, „Autentimisrakenduse kood“ (6 numbrit, `inputMode="numeric"`, `autoComplete="one-time-code"`); viga kuvatakse serveri tekstiga.
- **TenantsView:** tabel: nimi, registrikood, staatus (märgis „Aktiivne“/„Peatatud“), litsents („kuni DD.MM.YYYY“ + moodulite nimed eesti keeles: Telemeetria, Satelliit, Ilm; aegunud punaselt, ≤14 päeva kollaselt), kasutajad (aktiivsed/kokku), põlde, pindala (ha, 1 koht), viimane sisselogimine. Nupp „Uus ettevõte“. Rea klõps → TenantDetail.
- **NewTenantForm:** nimi*, registrikood, admini kasutajanimi*, admini nimi, admini e-post*, litsents kuni* (kuupäev), moodulid (kolm märkeruutu). Salvestamisel 201 → teade „Ettevõte loodud. Kutse saadeti aadressile …“ (või „Kutset ei õnnestunud saata — saada uuesti ettevõtte kaardilt“, kui `inviteSent === false`) ja avatakse TenantDetail.
- **TenantDetail:** andmed; litsentsi muutmine (kuupäev + moodulid + „Salvesta litsents“); „Peata ettevõte“ / „Taasaktiveeri“ (kinnitusdialoog: „Peatamisel logitakse kõik selle ettevõtte kasutajad välja ja sisselogimine keelatakse.“); kasutajate tabel (ilma ettevõtte äriandmeteta), „Saada kutse uuesti“ parooli määramata kasutajatele; selle ettevõtte logi (AuditView `tenantId`-ga).
- **AuditView:** aeg (Eesti aeg), tegija, tegevus (eesti keeles: Ettevõte loodud, Litsents muudetud, Ettevõte peatatud, Ettevõte taasaktiveeritud, Kutse saadetud uuesti, Sisselogimine, Platvormi kasutaja lisatud), ettevõte, üksikasjad.
- Päis: „Teris — teenusepakkuja“, sisselogitud kasutaja, „Logi välja“; vaated „Ettevõtted“ ja „Logi“.
- `src/admin/platformApi.ts`: `fetch(..., { credentials: 'same-origin' })`, JSON, `errorMessage` nagu `src/services/api.ts`-is; 401 → tagasi LoginView'sse.

- [ ] **Step 3: Kontroll**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS. (Brauserikontroll Task 8-s.)

- [ ] **Step 4: Commit**

```bash
git add admin.html src/admin vite.config.ts
git commit -m "Teenusepakkuja kasutajaliides (admin.html): sisselogimine, ettevõtted, uus ettevõte, litsents, peatamine, logi"
```

---

### Task 7: Staatiliste failide serveerimine hosti järgi

**Files:**
- Modify: `src/server/static.ts`, `src/server/prod.ts`, `src/server/static.test.ts`

**Interfaces:**
- Produces: `serveStatic(req, res, distDir, options?: { spaEntry?: string })` — SPA tagavarafail (`index.html` vaikimisi, platvormi hostil `admin.html`).

- [ ] **Step 1: Kirjuta failiv test** (`static.test.ts`, olemasoleva testi mustri järgi): platvormi hostil `/` ja `/ettevotted` → `admin.html` sisu; tavalisel hostil `/` → `index.html`; platvormi hostil `/index.html` → **404** (ettevõtte rakendust admin-hostil ei serveerita); tavalisel hostil `/admin.html` → **404**.

- [ ] **Step 2: Implementeeri**

`static.ts`: `spaEntry` valikuga ja keelatud failinimede loendiga (`blocked: string[]`). `prod.ts`:
```ts
      const platform = isPlatformHost(req);
      await serveStatic(req, res, DIST_DIR, platform
        ? { spaEntry: 'admin.html', blocked: ['index.html'] }
        : { spaEntry: 'index.html', blocked: ['admin.html'] });
```
Assetid (`/assets/*`) on mõlemal hostil lubatud.

- [ ] **Step 3: Testid ja commit**

Run: `npx vitest run src/server/static.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/static.ts src/server/static.test.ts src/server/prod.ts
git commit -m "Staatilised failid hosti järgi: admin.teris.ee serveerib admin.html-i"
```

---

### Task 8: Apache, TLS, release ja esimene platvormi kasutaja (kasutaja kinnitusel)

- [ ] **Step 1: Apache vhost** (`sudo`, kasutaja kinnitusel)

`/etc/apache2/sites-available/admin.teris.ee.conf` — sama mis `teris.ee.conf`, aga `ServerName admin.teris.ee`, ilma `ServerAlias`-eta, logid `admin.teris.ee_*.log`, `:80` suunab `https://admin.teris.ee/`. Esialgu ainult `:80` plokk (certbot lisab `:443`):
```apache
<VirtualHost *:80>
    ServerName admin.teris.ee
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / http://127.0.0.1:8820/
    ProxyPassReverse / http://127.0.0.1:8820/
    ErrorLog /var/log/apache2/admin.teris.ee_error.log
    CustomLog /var/log/apache2/admin.teris.ee_access.log combined
</VirtualHost>
```
```bash
sudo a2ensite admin.teris.ee && sudo apachectl configtest && sudo systemctl reload apache2
sudo certbot --apache -d admin.teris.ee --redirect --non-interactive --agree-tos -m <kasutaja e-post — küsi kasutajalt>
```
Pärast certbot'i kontrolli `:443` plokis `RequestHeader set X-Forwarded-Proto "https"` (lisa, kui puudub) ja `sudo apachectl configtest && sudo systemctl reload apache2`.

- [ ] **Step 2: Release**

`ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'`; `systemctl is-active teris`; `journalctl -u teris -n 30 --no-pager`; `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts` → „KÕIK KORRAS“.

- [ ] **Step 3: Kontroll**

- `curl -sI https://admin.teris.ee/` → 200, `text/html`; sisu viitab `admin`-i assetile.
- `curl -s https://admin.teris.ee/api/platform/auth/me` → 401; `curl -s https://admin.teris.ee/api/seasons` → 404; `curl -s https://teris.ee/api/platform/tenants` → 404.
- https://teris.ee töötab nagu enne.

- [ ] **Step 4: Esimene platvormi kasutaja (kasutaja ise terminalis)**

Kasutaja käivitab: `ssh -t debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run platform -- add <kasutajanimi>'`, lisab võtme autentimisrakendusse ja logib sisse https://admin.teris.ee. Controller ei näe ega salvesta võtit.

- [ ] **Step 5:** `git push`.

## Väljas (etapp 3c ja hiljem)

- Algkataloog ja selle kopeerimine uuele ettevõttele; `ensureSeed`/`seedChecked` asendamine — **3c**. Kuni selleni saab uus ettevõte tööliigid/mallid `ensureSeed` kaudu ainult siis, kui protsess pole seemendamist juba teinud (protsessipõhine lipp) — **teist päris ettevõtet ei looda enne 3c ja 4**.
- Parooli lähtestamine peatatud ettevõtte kasutajale (etapp 3a otsus) — vaadata koos 3c-ga.
- Seadmete vaade — **etapp 4**; tugiligipääs — **etapp 5**.
