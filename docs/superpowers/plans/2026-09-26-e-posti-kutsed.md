# E-posti kutsed ja parooli lähtestamine — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uus kasutaja saab e-postiga kutse lingi parooli määramiseks; admin saab saata parooli lingi; sisselogimise lehel „Unustasid parooli?“; kirjad lähevad Postfixiga DKIM-allkirjaga.

**Architecture:** `users.email` + tabel `password_tokens` (SHA-256 räsi, eesmärk, aegumine, ühekordne). `src/server/mail.ts` koostab kirja (puhas funktsioon) ja saadab `/usr/sbin/sendmail` kaudu. `src/server/passwordTokens.ts` loob/kontrollib/tarbib tokeneid. Avalikud teed `/api/auth/forgot|token|set-password` authGate'is, admini `send-link` adminUsers'is. Frontend: `SetPasswordPage` (`/parool#token`), „Unustasid parooli?“ LoginPage'il, e-post UsersAdminModal'is.

**Tech Stack:** Node `http` + `child_process`, Prisma 6, React 19, Vitest, Postfix + opendkim.

**Spec:** `docs/superpowers/specs/2026-09-26-e-posti-kutsed-design.md`

## Global Constraints

- Käsud kaugserveris: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/agro && <käsk>"`; kohalik `/Users/andresj/Progemine/agro` = sama kaust (sshfs). `npm`-i Macis ei käivitata. Pärast failide muutmist `touch` kaugel.
- Kontroll: `npx tsc --noEmit -p tsconfig.app.json` (0 viga), `npm test`, live'i `npm run release`; seejärel `systemctl is-active agro`, `journalctl -u agro -n 20 --no-pager`, `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts | tail -1` → `KÕIK KORRAS`. Piiraja on mälus: kui smoke käivitatakse 15 min jooksul teist korda, `sudo systemctl restart agro` enne.
- Serverifailid `vite.config.ts` kaudu kättesaadavad (`apiHandler.ts`, `authGate.ts`, `adminUsers.ts`, `mail.ts`, `passwordTokens.ts`, `auth.ts`, `adminRules.ts`) — suhtelised impordid `.ts` laiendiga. `userCli.ts` laiendita.
- DB: `psql "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)"`; enne skeemimuudatust `pg_dump "…" -Fc -f ~/db_backups/agro_db_$(date +%Y%m%d_%H%M%S).dump`. `db push` andmekaotuse hoiatusel PEATU.
- Uusi npm-sõltuvusi ei lisata. Paroole, tokeneid ega e-posti aadresse ei logita (kirja logis ainult „saadetud“/viga ja teema). Päris kasutaja kontot ei muudeta. Testkasutajad luuakse ja kustutatakse testis; testid päris kirju ei saada.
- Veateated (täpselt): `'Sisesta korrektne e-posti aadress'`, `'Selline e-posti aadress on juba kasutusel'`, `'Kasutajal pole e-posti aadressi'`, `'Link on aegunud või juba kasutatud'`, `'Parool peab olema vähemalt 10 märki'`, `'Liiga palju katseid, proovi 15 minuti pärast'`.
- Commit otse `master`-isse, eesti keeles, ainult nimetatud failid; lõpus `Co-Authored-By: <mudel> <noreply@anthropic.com>`. Push'i ei tehta.

## Failid

| Fail | Vastutus |
|---|---|
| `/etc/postfix/main.cf`, `/etc/opendkim.conf`, `/etc/opendkim/*` (server) | DKIM allkirjastamine, hostinimi |
| `prisma/schema.prisma` | `User.email`, `PasswordToken` |
| `src/server/mail.ts` + `mail.test.ts` | `normalizeEmail`, `buildPasswordLinkMail`, `sendMail` |
| `src/server/passwordTokens.ts` + `passwordTokens.test.ts` | `tokenExpiry`, `issuePasswordToken`, `findValidToken`, `consumeToken` |
| `src/server/authGate.ts` | `/api/auth/forgot`, `/api/auth/token`, `/api/auth/set-password` |
| `src/server/adminUsers.ts` | e-post, kutse, `send-link`, `hasPassword` |
| `src/server/userCli.ts` | `--email`, `list` e-post |
| `scripts/auth-smoke.mts` | tokenite integratsioonitest |
| `src/types/auth.ts`, `src/services/api.ts` | tüübid ja API meetodid |
| `src/components/UsersAdminModal.tsx` | e-post, kutse/ajutine parool, „Saada parooli link“ |
| `src/components/LoginPage.tsx`, `src/components/SetPasswordPage.tsx` (uus), `src/AuthGate.tsx`, `src/index.css`, `README.md` | kasutajaliides |

---

### Task 1: Postfix + opendkim (serveri seadistus, teeb controller)

**Files:** serveris `/etc/postfix/main.cf`, `/etc/opendkim.conf`, `/etc/default/opendkim`, `/etc/opendkim/keys/agro.ventcap.ee/`

- [ ] **Step 1: Varukoopiad ja paigaldus**

```bash
sudo cp /etc/postfix/main.cf /etc/postfix/main.cf.bak-$(date +%Y%m%d)
sudo apt-get install -y opendkim opendkim-tools
```

- [ ] **Step 2: DKIM võti** (selektor `agro`)

```bash
sudo mkdir -p /etc/opendkim/keys/agro.ventcap.ee
sudo opendkim-genkey -b 2048 -d agro.ventcap.ee -s agro -D /etc/opendkim/keys/agro.ventcap.ee
sudo chown -R opendkim:opendkim /etc/opendkim
sudo chmod 600 /etc/opendkim/keys/agro.ventcap.ee/agro.private
```

- [ ] **Step 3: `/etc/opendkim.conf`** — lisa/muuda read:

```
Syslog                  yes
UMask                   007
Mode                    s
Canonicalization        relaxed/simple
Domain                  agro.ventcap.ee
Selector                agro
KeyFile                 /etc/opendkim/keys/agro.ventcap.ee/agro.private
Socket                  inet:8891@localhost
PidFile                 /run/opendkim/opendkim.pid
OversignHeaders         From
```

(Kommenteeri välja olemasolev `Socket local:…` rida.) `sudo systemctl restart opendkim && sudo systemctl enable opendkim`.

- [ ] **Step 4: Postfix**

```bash
sudo postconf -e 'myhostname = agro.ventcap.ee' 'inet_protocols = ipv4' 'smtp_tls_security_level = may' \
  'milter_default_action = accept' 'milter_protocol = 6' \
  'smtpd_milters = inet:localhost:8891' 'non_smtpd_milters = inet:localhost:8891'
sudo systemctl restart postfix
```

- [ ] **Step 5: DNS kirjed kasutajale** — kuva `sudo cat /etc/opendkim/keys/agro.ventcap.ee/agro.txt` ja anna kasutajale kolm kirjet (spec: SPF, DKIM `agro._domainkey.agro.ventcap.ee`, DMARC). Soovita PTR muutmist Zone'ilt.

- [ ] **Step 6: Kontroll pärast DNS-i** — `dig +short TXT agro._domainkey.agro.ventcap.ee`, `sudo opendkim-testkey -d agro.ventcap.ee -s agro -vvv` (`key OK`); testkiri kasutaja aadressile Task 4 lõpus (päringud `dkim=pass`, `spf=pass`).

---

### Task 2: Skeem, kirjad ja tokenid

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/server/mail.ts`, `src/server/mail.test.ts`, `src/server/passwordTokens.ts`, `src/server/passwordTokens.test.ts`
- Modify: `src/server/auth.test.ts` (üks test)

**Interfaces:**
- Produces:
  - `normalizeEmail(raw: unknown): string | null` (mail.ts)
  - `buildPasswordLinkMail(o: { to: string; from: string; purpose: 'INVITE' | 'RESET'; link: string; username: string; displayName: string | null }): string` — kogu RFC 5322 sõnum
  - `sendMail(message: string): Promise<void>` — `MAIL_DISABLED=1` korral ei saada
  - `MAIL_FROM`, `APP_BASE_URL` konstandid (mail.ts, env-ist)
  - `type TokenPurpose = 'INVITE' | 'RESET'`; `tokenExpiry(purpose, now = new Date()): Date` (passwordTokens.ts)
  - `issuePasswordToken(userId: string, purpose: TokenPurpose): Promise<string>` — tagastab toortokeni, kustutab kasutaja varasemad kasutamata tokenid
  - `findValidToken(rawToken: string): Promise<{ id: number; purpose: TokenPurpose; user: { id: string; username: string; isActive: boolean } } | null>`
  - `consumeToken(tokenId: number, userId: string): Promise<void>` — märgib kasutatuks, kustutab kasutaja teised tokenid
  - `sendPasswordLink(user: { id: string; username: string; displayName: string | null; email: string }, purpose: TokenPurpose): Promise<boolean>` — token + kiri; `false` kui saatmine ebaõnnestus (viga logitakse ilma aadressita)

- [ ] **Step 1: Skeem.** `model User` rea `displayName  String?` järele: `email        String?   @unique`; `sessions     Session[]` järele: `passwordTokens PasswordToken[]`. Faili lõppu (pärast `Session`):

```prisma
model PasswordToken {
  id        Int       @id @default(autoincrement())
  userId    String
  purpose   String    // 'INVITE' | 'RESET'
  tokenHash String    @unique // SHA-256 toortokenist (toortoken ainult e-kirjas)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_tokens")
}
```

Serveris: `pg_dump …`, `npx prisma db push`, `npx prisma generate`.

- [ ] **Step 2: Testid (RED)** — `src/server/mail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeEmail, buildPasswordLinkMail } from './mail';

describe('normalizeEmail', () => {
  it('trimmib ja teeb väiketähtedeks', () => {
    expect(normalizeEmail('  Mari.Maasikas@Näide.EE ')).toBe('mari.maasikas@näide.ee');
  });
  it('lükkab tagasi vigased', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('mari')).toBeNull();
    expect(normalizeEmail('mari@')).toBeNull();
    expect(normalizeEmail('mari @x.ee')).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@x.ee`)).toBeNull();
  });
});

describe('buildPasswordLinkMail', () => {
  const base = { to: 'mari@x.ee', from: 'noreply@agro.ventcap.ee', link: 'https://agro.ventcap.ee/parool#abc', username: 'mari', displayName: 'Mari Maasikas' };
  it('kutse: päised, MIME-teema ja link', () => {
    const msg = buildPasswordLinkMail({ ...base, purpose: 'INVITE' });
    const [head, body] = msg.split('\r\n\r\n');
    expect(head).toContain('To: mari@x.ee');
    expect(head).toContain('From: AGRO <noreply@agro.ventcap.ee>');
    expect(head).toContain(`Subject: =?UTF-8?B?${Buffer.from('Kutse AGRO rakendusse').toString('base64')}?=`);
    expect(head).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(body).toContain('https://agro.ventcap.ee/parool#abc');
    expect(body).toContain('kasutajanimega mari');
    expect(body).toContain('7 päeva');
  });
  it('lähtestus: teema ja kehtivus', () => {
    const msg = buildPasswordLinkMail({ ...base, purpose: 'RESET' });
    expect(msg).toContain(`=?UTF-8?B?${Buffer.from('AGRO parooli määramine').toString('base64')}?=`);
    expect(msg).toContain('1 tund');
  });
  it('ei luba päisesse reavahetust', () => {
    expect(() => buildPasswordLinkMail({ ...base, to: 'a@x.ee\r\nBcc: b@y.ee', purpose: 'RESET' })).toThrow();
  });
});
```

`src/server/passwordTokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tokenExpiry } from './passwordTokens';

describe('tokenExpiry', () => {
  const now = new Date('2026-09-26T10:00:00Z');
  it('kutse kehtib 7 päeva', () => {
    expect(tokenExpiry('INVITE', now).toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });
  it('lähtestus kehtib 1 tund', () => {
    expect(tokenExpiry('RESET', now).toISOString()).toBe('2026-09-26T11:00:00.000Z');
  });
});
```

`src/server/auth.test.ts` — `verifyPassword` describe'i lisa:

```ts
  it('tühi räsi (kutsutud kasutaja, parool määramata) ei kehti kunagi', async () => {
    expect(await verifyPassword('', '')).toBe(false);
    expect(await verifyPassword('midagi', '')).toBe(false);
  });
```

(kui `verifyPassword` describe't pole, lisa uus `describe('verifyPassword', …)`.) Käivita `npx vitest run src/server/mail.test.ts src/server/passwordTokens.test.ts` → FAIL (moodulid puuduvad).

- [ ] **Step 3: `src/server/mail.ts`**

```ts
// src/server/mail.ts — e-kirjad (parooli lingid) serveri sendmail'i (Postfix) kaudu.
import { spawn } from 'node:child_process';

export const MAIL_FROM = process.env.MAIL_FROM || 'noreply@agro.ventcap.ee';
export const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://agro.ventcap.ee').replace(/\/+$/, '');

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

const encodeHeader = (text: string) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;

function assertHeaderSafe(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('Päise väärtus sisaldab reavahetust');
  return value;
}

export function buildPasswordLinkMail(o: {
  to: string;
  from: string;
  purpose: 'INVITE' | 'RESET';
  link: string;
  username: string;
  displayName: string | null;
}): string {
  const subject = o.purpose === 'INVITE' ? 'Kutse AGRO rakendusse' : 'AGRO parooli määramine';
  const greeting = o.displayName ? `Tere, ${o.displayName}!` : 'Tere!';
  const lines =
    o.purpose === 'INVITE'
      ? [
          greeting,
          '',
          `Sulle on loodud konto AGRO rakendusse kasutajanimega ${o.username}.`,
          'Määra endale parool alloleval lingil, seejärel saad sisse logida:',
          '',
          o.link,
          '',
          'Link kehtib 7 päeva ja on ühekordne.'
        ]
      : [
          greeting,
          '',
          `Konto ${o.username} parooli saad määrata alloleval lingil:`,
          '',
          o.link,
          '',
          'Link kehtib 1 tund ja on ühekordne. Kui sa seda ei tellinud, võid kirja eirata.'
        ];
  const headers = [
    `From: AGRO <${assertHeaderSafe(o.from)}>`,
    `To: ${assertHeaderSafe(o.to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  return `${headers.join('\r\n')}\r\n\r\n${lines.join('\r\n')}\r\n`;
}

export function sendMail(message: string): Promise<void> {
  if (process.env.MAIL_DISABLED === '1') {
    const subject = /^Subject: (.*)$/m.exec(message)?.[1] ?? '';
    console.log('[Mail] MAIL_DISABLED — kirja ei saadetud:', subject);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/sbin/sendmail', ['-t', '-i', '-f', MAIL_FROM], { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sendmail lõpetas koodiga ${code}: ${stderr.trim()}`))));
    child.stdin.end(message);
  });
}
```

- [ ] **Step 4: `src/server/passwordTokens.ts`**

```ts
// src/server/passwordTokens.ts — ühekordsed parooli määramise lingid (kutse ja lähtestus).
import { prisma } from './db.ts';
import { generateSessionToken, hashToken } from './auth.ts';
import { APP_BASE_URL, MAIL_FROM, buildPasswordLinkMail, sendMail } from './mail.ts';

export type TokenPurpose = 'INVITE' | 'RESET';

const TTL_MS: Record<TokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  RESET: 60 * 60 * 1000
};

export function tokenExpiry(purpose: TokenPurpose, now: Date = new Date()): Date {
  return new Date(now.getTime() + TTL_MS[purpose]);
}

export async function issuePasswordToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const raw = generateSessionToken();
  await prisma.passwordToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordToken.create({
    data: { userId, purpose, tokenHash: hashToken(raw), expiresAt: tokenExpiry(purpose) }
  });
  return raw;
}

export async function findValidToken(rawToken: string) {
  if (!rawToken || rawToken.length > 200) return null;
  const token = await prisma.passwordToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, username: true, isActive: true } } }
  });
  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now() || !token.user.isActive) return null;
  return { id: token.id, purpose: token.purpose as TokenPurpose, user: token.user };
}

export async function consumeToken(tokenId: number, userId: string): Promise<void> {
  await prisma.passwordToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
  await prisma.passwordToken.deleteMany({ where: { userId, NOT: { id: tokenId } } });
}

export async function sendPasswordLink(
  user: { id: string; username: string; displayName: string | null; email: string },
  purpose: TokenPurpose
): Promise<boolean> {
  const raw = await issuePasswordToken(user.id, purpose);
  const message = buildPasswordLinkMail({
    to: user.email,
    from: MAIL_FROM,
    purpose,
    link: `${APP_BASE_URL}/parool#${raw}`,
    username: user.username,
    displayName: user.displayName
  });
  try {
    await sendMail(message);
    return true;
  } catch (err) {
    console.error(`[Mail] ${purpose} kirja saatmine ebaõnnestus (kasutaja ${user.username}):`, err instanceof Error ? err.message : err);
    return false;
  }
}
```

- [ ] **Step 5: GREEN** — `npx vitest run src/server/mail.test.ts src/server/passwordTokens.test.ts src/server/auth.test.ts` → PASS; `npx tsc --noEmit -p tsconfig.app.json`; `npm test`.

- [ ] **Step 6: Commit** (live'i pole vaja — uued moodulid pole veel ühendatud; skeem on lisav)

```bash
git add prisma/schema.prisma src/server/mail.ts src/server/mail.test.ts src/server/passwordTokens.ts src/server/passwordTokens.test.ts src/server/auth.test.ts
git commit -m "E-posti väli, parooli tokenid ja e-kirjade koostamine/saatmine."
```

---

### Task 3: Serveri teed, CLI ja integratsioonitest

**Files:**
- Modify: `src/server/authGate.ts`, `src/server/adminUsers.ts`, `src/server/userCli.ts`, `scripts/auth-smoke.mts`

**Interfaces:**
- Consumes (Task 2): `normalizeEmail`, `findValidToken`, `consumeToken`, `sendPasswordLink`.
- Produces: `POST /api/auth/forgot {login}` → 200 `{success:true}` | 429; `POST /api/auth/token {token}` → 200 `{valid:true,purpose,username}` | 400; `POST /api/auth/set-password {token,password}` → 200 `{success:true,username}` | 400; admin `POST /api/admin/users` `{username,displayName?,email,isAdmin?,password?}` → 201 `{user,emailSent}`; `PATCH …/:id` + `email`; `POST …/:id/send-link` → `{success:true,emailSent}`; kasutaja kuju `{ id, username, displayName, email, isActive, isAdmin, mustChangePassword, hasPassword, lastLoginAt, createdAt }`.

- [ ] **Step 1: `authGate.ts`.** Importi: `import { normalizeEmail } from './mail.ts';` ja `import { findValidToken, consumeToken, sendPasswordLink } from './passwordTokens.ts';`. Konstantide juurde:

```ts
const forgotLimiter = createLoginLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
```

Funktsioonid (enne `export async function authGate`):

```ts
// "Unustasid parooli": vastus on alati sama, et kontode olemasolu ei saaks välja uurida.
async function handleForgot(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const login = String(body?.login ?? '').trim().toLowerCase().slice(0, 254);
  const keys = [`f:${login}`, `fip:${clientIp(req)}`];
  if (keys.some((k) => forgotLimiter.isBlocked(k))) {
    json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);
    return;
  }
  keys.forEach((k) => forgotLimiter.registerFailure(k));
  if (login) {
    const email = normalizeEmail(login);
    const user = await prisma.user.findFirst({ where: email ? { email } : { username: login } });
    if (user && user.isActive && user.email) {
      await sendPasswordLink({ id: user.id, username: user.username, displayName: user.displayName, email: user.email }, 'RESET');
    }
  }
  json(res, { success: true });
}

async function handleTokenCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const token = await findValidToken(String(body?.token ?? ''));
  if (!token) {
    json(res, { error: 'Link on aegunud või juba kasutatud' }, 400);
    return;
  }
  json(res, { valid: true, purpose: token.purpose, username: token.user.username });
}

async function handleSetPassword(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req, MAX_AUTH_BODY_BYTES);
  const password = String(body?.password ?? '');
  const token = await findValidToken(String(body?.token ?? ''));
  if (!token) {
    json(res, { error: 'Link on aegunud või juba kasutatud' }, 400);
    return;
  }
  const problem = validateNewPassword(password);
  if (problem) {
    json(res, { error: problem }, 400);
    return;
  }
  await prisma.user.update({
    where: { id: token.user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false }
  });
  await consumeToken(token.id, token.user.id);
  await prisma.session.deleteMany({ where: { userId: token.user.id } });
  json(res, { success: true, username: token.user.username });
}
```

`authGate`-is, rea `if (pathname === '/api/auth/logout' && method === 'POST') {` ploki järele (enne `const current = …`):

```ts
  if (pathname === '/api/auth/forgot' && method === 'POST') {
    await handleForgot(req, res);
    return true;
  }
  if (pathname === '/api/auth/token' && method === 'POST') {
    await handleTokenCheck(req, res);
    return true;
  }
  if (pathname === '/api/auth/set-password' && method === 'POST') {
    await handleSetPassword(req, res);
    return true;
  }
```

- [ ] **Step 2: `adminUsers.ts` — kogu fail:**

```ts
// src/server/adminUsers.ts — /api/admin/users* (ainult adminile).
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { hashPassword, validateNewPassword } from './auth.ts';
import { sessionUserOf } from './authGate.ts';
import { normalizeUsername, USERNAME_ERROR, checkAdminChange } from './adminRules.ts';
import { normalizeEmail } from './mail.ts';
import { sendPasswordLink } from './passwordTokens.ts';

const PREFIX = '/api/admin/users';
const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_ERROR = 'Sisesta korrektne e-posti aadress';
const EMAIL_TAKEN = 'Selline e-posti aadress on juba kasutusel';

const USER_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  passwordHash: true,
  isActive: true,
  isAdmin: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true
} as const;

type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  passwordHash: string;
  isActive: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

// Paroolirässi ei saadeta kunagi välja — ainult teave, kas parool on määratud.
const toPublic = ({ passwordHash, ...rest }: UserRow) => ({ ...rest, hasPassword: passwordHash !== '' });

const activeAdminCount = () => prisma.user.count({ where: { isActive: true, isAdmin: true } });

function cleanDisplayName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().slice(0, 120);
  return name || null;
}

const uniqueTarget = (err: unknown): string | null => {
  const e = err as { code?: string; meta?: { target?: string[] | string } } | null;
  if (e?.code !== 'P2002') return null;
  return String(e.meta?.target ?? '');
};

export async function handleAdminUsers(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string
): Promise<boolean> {
  if (pathname !== PREFIX && !pathname.startsWith(PREFIX + '/')) return false;

  const actor = sessionUserOf(req);
  if (!actor || !actor.isAdmin) {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }

  const parts = pathname.slice(PREFIX.length).split('/').filter(Boolean);

  if (parts.length === 0 && method === 'GET') {
    const users = await prisma.user.findMany({ select: USER_FIELDS, orderBy: { username: 'asc' } });
    json(res, { users: users.map(toPublic) });
    return true;
  }

  if (parts.length === 0 && method === 'POST') {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const username = normalizeUsername(body?.username);
    if (!username) {
      json(res, { error: USERNAME_ERROR }, 400);
      return true;
    }
    const email = normalizeEmail(body?.email);
    if (!email) {
      json(res, { error: EMAIL_ERROR }, 400);
      return true;
    }
    const password = typeof body?.password === 'string' && body.password !== '' ? body.password : null;
    if (password !== null) {
      const problem = validateNewPassword(password);
      if (problem) {
        json(res, { error: problem }, 400);
        return true;
      }
    }
    try {
      const created = await prisma.user.create({
        data: {
          username,
          email,
          displayName: cleanDisplayName(body?.displayName),
          passwordHash: password !== null ? await hashPassword(password) : '',
          isAdmin: body?.isAdmin === true,
          mustChangePassword: password !== null
        },
        select: USER_FIELDS
      });
      const emailSent =
        password === null
          ? await sendPasswordLink({ id: created.id, username, displayName: created.displayName, email }, 'INVITE')
          : false;
      json(res, { user: toPublic(created), emailSent }, 201);
    } catch (err) {
      const target = uniqueTarget(err);
      if (target === null) throw err;
      json(res, { error: target.includes('email') ? EMAIL_TAKEN : 'Selline kasutajanimi on juba olemas' }, 409);
    }
    return true;
  }

  const isUserRoute = parts.length === 1 && (method === 'PATCH' || method === 'DELETE');
  const isPasswordRoute = parts.length === 2 && parts[1] === 'password' && method === 'POST';
  const isSendLinkRoute = parts.length === 2 && parts[1] === 'send-link' && method === 'POST';
  if (!isUserRoute && !isPasswordRoute && !isSendLinkRoute) {
    json(res, { error: 'Not found' }, 404);
    return true;
  }

  const target = await prisma.user.findUnique({ where: { id: parts[0] } });
  if (!target) {
    json(res, { error: 'Kasutajat ei leitud' }, 404);
    return true;
  }

  if (isSendLinkRoute) {
    if (!target.email) {
      json(res, { error: 'Kasutajal pole e-posti aadressi' }, 400);
      return true;
    }
    if (!target.isActive) {
      json(res, { error: 'Seda muudatust ei saa teha: kasutaja on keelatud' }, 400);
      return true;
    }
    const emailSent = await sendPasswordLink(
      { id: target.id, username: target.username, displayName: target.displayName, email: target.email },
      target.passwordHash === '' ? 'INVITE' : 'RESET'
    );
    json(res, { success: true, emailSent });
    return true;
  }

  if (isPasswordRoute) {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const password = String(body?.password ?? '');
    const problem = validateNewPassword(password);
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true }
    });
    await prisma.session.deleteMany({ where: { userId: target.id } });
    json(res, { success: true });
    return true;
  }

  if (method === 'DELETE') {
    const problem = checkAdminChange(actor.id, target, { kind: 'delete' }, await activeAdminCount());
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    await prisma.user.delete({ where: { id: target.id } });
    json(res, { success: true });
    return true;
  }

  // PATCH
  const body = await parseBody(req, MAX_BODY_BYTES);
  const isObject = body !== null && typeof body === 'object';
  const data: { displayName?: string | null; email?: string; isActive?: boolean; isAdmin?: boolean } = {};
  if (isObject && 'displayName' in body) data.displayName = cleanDisplayName(body.displayName);
  if (isObject && 'email' in body) {
    const email = normalizeEmail(body.email);
    if (!email) {
      json(res, { error: EMAIL_ERROR }, 400);
      return true;
    }
    data.email = email;
  }
  if (typeof body?.isActive === 'boolean') data.isActive = body.isActive;
  if (typeof body?.isAdmin === 'boolean') data.isAdmin = body.isAdmin;

  const problem = checkAdminChange(
    actor.id,
    target,
    { kind: 'update', isActive: data.isActive, isAdmin: data.isAdmin },
    await activeAdminCount()
  );
  if (problem) {
    json(res, { error: problem }, 400);
    return true;
  }

  try {
    const user = await prisma.user.update({ where: { id: target.id }, data, select: USER_FIELDS });
    if (data.isActive === false) await prisma.session.deleteMany({ where: { userId: target.id } });
    json(res, { user: toPublic(user) });
  } catch (err) {
    if (uniqueTarget(err) === null) throw err;
    json(res, { error: EMAIL_TAKEN }, 409);
  }
  return true;
}
```

- [ ] **Step 3: CLI** `userCli.ts`: import `import { normalizeEmail } from './mail';`. `main`-is rea `const displayName = …` järele:

```ts
  const emailIdx = rest.indexOf('--email');
  const emailRaw = emailIdx >= 0 ? rest[emailIdx + 1] ?? '' : null;
```

`case 'add'`: pärast kasutajanime pikkuse kontrolli:

```ts
      const email = emailRaw === null ? null : normalizeEmail(emailRaw);
      if (emailRaw !== null && !email) throw new Error('Vigane e-posti aadress');
      if (email && (await prisma.user.findUnique({ where: { email } }))) throw new Error(`E-post "${email}" on juba kasutusel`);
```

ja `create` andmetesse `email`. `list` väljundisse pärast `(u.displayName ?? '').padEnd(24),`: `(u.email ?? '').padEnd(30),`. Kasutusteadetes `add <nimi> [--display "Nimi"] [--email aadress]`.

- [ ] **Step 4: Integratsioonitest** `scripts/auth-smoke.mts`:

Importi `import { hashToken } from '../src/server/auth.ts';` (lisa olemasolevale `hashPassword` impordile). Konstantidesse: `const LINKUSER = '_smokelink';` ja lisa `TEST_USERS`-i. Enne `const admin = await loginAs(ADMIN, PASS);` asenda admini kasutaja loomise read, et admin ja uus kasutaja saaks e-posti (`create`-is `email: '_smokeadmin@example.invalid'`).

Asenda olemasolev kasutaja loomise kontroll (`admin loob kasutaja → 201`) kehaga, mis sisaldab e-posti ja ajutist parooli (kirja ei saadeta):

```ts
  const created = await send('POST', '/api/admin/users', admin.cookie, { username: NEWUSER, displayName: 'Smoke Uus', email: '_smokenew@example.invalid', password: TEMP_PASS });
```

ja kordused/vigased:

```ts
  check('sama kasutajanimi → 409', (await send('POST', '/api/admin/users', admin.cookie, { username: NEWUSER, email: '_muu@example.invalid', password: TEMP_PASS })).status === 409);
  check('sama e-post → 409', (await send('POST', '/api/admin/users', admin.cookie, { username: '_smokemuu', email: '_smokenew@example.invalid', password: TEMP_PASS })).status === 409);
  check('e-post puudub → 400', (await send('POST', '/api/admin/users', admin.cookie, { username: '_smokemuu', password: TEMP_PASS })).status === 400);
  check('vigane kasutajanimi → 400', (await send('POST', '/api/admin/users', admin.cookie, { username: 'vale nimi', email: '_x@example.invalid', password: TEMP_PASS })).status === 400);
  const listed = await (await send('GET', '/api/admin/users', admin.cookie)).json();
  check('nimekirjas pole paroolirässi', Array.isArray(listed.users) && listed.users.every((u: Record<string, unknown>) => !('passwordHash' in u) && 'hasPassword' in u));
```

Lisa (enne 429 tsüklit) tokenite plokk:

```ts
  // Parooli link: token luuakse otse DB-sse (testis e-kirju ei saadeta).
  const linkUser = await prisma.user.create({ data: { username: LINKUSER, email: '_smokelink@example.invalid', passwordHash: '' } });
  const rawToken = 'smoke-token-' + Date.now();
  await prisma.passwordToken.create({ data: { userId: linkUser.id, purpose: 'INVITE', tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 3600_000) } });
  await prisma.passwordToken.create({ data: { userId: linkUser.id, purpose: 'RESET', tokenHash: hashToken(rawToken + '-old'), expiresAt: new Date(Date.now() - 1000) } });
  check('kutsutud kasutaja ei saa enne parooli sisse', (await post('/api/auth/login', { username: LINKUSER, password: '' })).status === 401);
  check('forgot tundmatu kasutajaga → 200', (await post('/api/auth/forgot', { login: '_olematu_kasutaja' })).status === 200);
  check('vale token → 400', (await post('/api/auth/token', { token: 'vale' })).status === 400);
  check('aegunud token → 400', (await post('/api/auth/token', { token: rawToken + '-old' })).status === 400);
  const tokenCheck = await post('/api/auth/token', { token: rawToken });
  check('kehtiv token → 200', tokenCheck.status === 200 && (await tokenCheck.json()).username === LINKUSER);
  check('liiga lühike parool → 400', (await post('/api/auth/set-password', { token: rawToken, password: 'lyhike' })).status === 400);
  check('parooli määramine → 200', (await post('/api/auth/set-password', { token: rawToken, password: NEW_PASS })).status === 200);
  check('sama token uuesti → 400', (await post('/api/auth/set-password', { token: rawToken, password: NEW_PASS })).status === 400);
  check('uue parooliga sisse → 200', (await loginAs(LINKUSER, NEW_PASS)).status === 200);
```

`finally` kustutab `TEST_USERS` (sisaldab nüüd `LINKUSER`; tokenid kustuvad kaskaadiga).

- [ ] **Step 5: Kontroll ja release.** `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run release`, `systemctl is-active agro`, smoke → `KÕIK KORRAS`; `psql … -tAc "SELECT count(*) FROM users WHERE username LIKE '\_smoke%'"` → 0.

- [ ] **Step 6: Commit**

```bash
git add src/server/authGate.ts src/server/adminUsers.ts src/server/userCli.ts scripts/auth-smoke.mts
git commit -m "Parooli lingid: unustatud parool, tokeni kontroll, parooli määramine, admini kutse ja send-link."
```

---

### Task 4: Kasutajaliides

**Files:**
- Modify: `src/types/auth.ts`, `src/services/api.ts`, `src/components/UsersAdminModal.tsx`, `src/components/LoginPage.tsx`, `src/AuthGate.tsx`, `src/index.css`, `README.md`
- Create: `src/components/SetPasswordPage.tsx`

**Interfaces:**
- Consumes: Task 3 API.

- [ ] **Step 1: Tüübid** — `AdminUser`-isse `email: string | null;` ja `hasPassword: boolean;`.

- [ ] **Step 2: API** (`src/services/api.ts`):
  - `createUser(data: { username: string; displayName: string; email: string; isAdmin: boolean; password?: string }): Promise<{ user: AdminUser; emailSent: boolean }>` — tagastab kogu vastuse (`await res.json()`), mitte ainult `user`.
  - `updateUser(id, data: { displayName?: string; email?: string; isActive?: boolean; isAdmin?: boolean })`.
  - Uued:

```ts
  async sendUserLink(id: string): Promise<{ emailSent: boolean }> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/send-link`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Lingi saatmine ebaõnnestus'));
    return res.json();
  },

  async forgotPassword(login: string): Promise<void> {
    const res = await apiFetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Päring ebaõnnestus'));
  },

  async checkPasswordToken(token: string): Promise<{ purpose: 'INVITE' | 'RESET'; username: string }> {
    const res = await apiFetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Link on aegunud või juba kasutatud'));
    return res.json();
  },

  async setPasswordWithToken(token: string, password: string): Promise<{ username: string }> {
    const res = await apiFetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Parooli määramine ebaõnnestus'));
    return res.json();
  },
```

- [ ] **Step 3: `UsersAdminModal.tsx`** muudatused:
  - lucide importi lisa `Mail`;
  - olek: `const [email, setEmail] = useState('');`, `const [useInvite, setUseInvite] = useState(true);`, `const [notice, setNotice] = useState<string | null>(null);`;
  - `openForm`: `setEmail(next.kind === 'edit' ? next.user.email ?? '' : '');`, `setUseInvite(true);`, `setNotice(null);`;
  - `run` jääb signatuuriga `(action: () => Promise<unknown>)`; alguses `setNotice(null);`, `await action();` asemel `const result = await action(); if (typeof result === 'string') setNotice(result);` (enne `setMode({ kind: 'list' })`) — string-tulemus on kasutajale näidatav teade;
  - `submit`:

```ts
    if (mode.kind === 'reset' || (mode.kind === 'add' && !useInvite)) {
      if (password.length < 10) return setError('Parool peab olema vähemalt 10 märki');
      if (password !== repeat) return setError('Paroolid ei kattu');
    }
    if (mode.kind === 'add') {
      void run(async () => {
        const { emailSent } = await api.createUser({ username, displayName, email, isAdmin, ...(useInvite ? {} : { password }) });
        if (useInvite) {
          return emailSent
            ? `Kutse saadeti aadressile ${email}.`
            : 'Kasutaja loodi, aga e-kirja saatmine ebaõnnestus — proovi „Saada parooli link“.';
        }
      });
    } else if (mode.kind === 'edit') {
      const self = mode.user.id === currentUserId;
      void run(() => api.updateUser(mode.user.id, self ? { displayName, email } : { displayName, email, isAdmin }));
    } else if (mode.kind === 'reset') void run(() => api.resetUserPassword(mode.user.id, password));
```

  - uus tegevus:

```ts
  const sendLink = (u: AdminUser) =>
    void run(async () => {
      const { emailSent } = await api.sendUserLink(u.id);
      return emailSent ? `Parooli link saadeti aadressile ${u.email}.` : 'E-kirja saatmine ebaõnnestus. Proovi hiljem uuesti.';
    });
```

  - teade: vea kasti järele `{notice && <div className="alert-box">{notice}</div>}`;
  - tabelisse veerg „E-post“ (`<th>E-post</th>` pärast „Kasutajanimi“, lahter `<td>{u.email ?? '–'}</td>`); olekus lisaks `{!u.hasPassword && <span className="users-admin-badge">Kutse saadetud</span>}`;
  - rea tegevustes (`!self` plokis, enne „Lähtesta parool“):

```tsx
                                {u.email && u.isActive && (
                                  <button type="button" className="icon-btn-ghost" title="Saada parooli link e-postile" disabled={busy} onClick={() => sendLink(u)}>
                                    <Mail size={15} />
                                  </button>
                                )}
```

  - vormi e-posti väli (`add` ja `edit`), nime välja järele:

```tsx
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <div className="form-group">
                  <label htmlFor="ua-email">E-post{mode.kind === 'add' ? ' (kohustuslik)' : ''}</label>
                  <input id="ua-email" type="email" className="form-input" required={mode.kind === 'add'} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              )}
              {mode.kind === 'add' && (
                <div className="users-admin-mode">
                  <label className="users-admin-checkbox">
                    <input type="radio" name="ua-mode" checked={useInvite} onChange={() => setUseInvite(true)} />
                    <span>Saada kutse e-postiga (kasutaja määrab parooli ise)</span>
                  </label>
                  <label className="users-admin-checkbox">
                    <input type="radio" name="ua-mode" checked={!useInvite} onChange={() => setUseInvite(false)} />
                    <span>Määra ajutine parool</span>
                  </label>
                </div>
              )}
```

  - olemasolev paroolide plokk kuvatakse tingimusel `(mode.kind === 'reset' || (mode.kind === 'add' && !useInvite))`.

- [ ] **Step 4: `SetPasswordPage.tsx` (uus)**

```tsx
// src/components/SetPasswordPage.tsx — parooli määramine e-kirja lingiga (/parool#token).
import React, { useEffect, useState } from 'react';
import { KeyRound, AlertCircle, Check } from 'lucide-react';
import { AgroLogo } from './AgroLogo';
import { api } from '../services/api';

interface SetPasswordPageProps {
  token: string;
  onDone: (notice: string) => void;
  onCancel: () => void;
}

export const SetPasswordPage: React.FC<SetPasswordPageProps> = ({ token, onDone, onCancel }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .checkPasswordToken(token)
      .then((r) => setUsername(r.username))
      .catch((err) => setInvalid(err instanceof Error ? err.message : 'Link on aegunud või juba kasutatud'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError('Parool peab olema vähemalt 10 märki');
    if (password !== repeat) return setError('Paroolid ei kattu');
    setBusy(true);
    try {
      await api.setPasswordWithToken(token, password);
      onDone('Parool määratud. Logi sisse.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parooli määramine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card glass-card" onSubmit={submit}>
        <div className="login-brand">
          <AgroLogo variant="vertical" />
        </div>
        {invalid ? (
          <>
            <div className="alert-box error">
              <AlertCircle size={16} />
              <span>{invalid}</span>
            </div>
            <p className="modal-subtitle">Küsi uus link sisselogimise lehe „Unustasid parooli?“ kaudu või adminilt.</p>
            <button type="button" className="btn btn-primary btn-full" onClick={onCancel}>Sisselogimise lehele</button>
          </>
        ) : username === null ? (
          <p className="modal-subtitle">Kontrollin linki…</p>
        ) : (
          <>
            <p className="modal-subtitle">
              Määra parool kasutajale <strong>{username}</strong>.
            </p>
            {error && (
              <div className="alert-box error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <input type="text" autoComplete="username" value={username} readOnly hidden />
            <div className="form-group">
              <label htmlFor="sp-password">Uus parool (vähemalt 10 märki)</label>
              <input id="sp-password" type="password" className="form-input" autoComplete="new-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="sp-repeat">Korda parooli</label>
              <input id="sp-repeat" type="password" className="form-input" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? <KeyRound size={16} /> : <Check size={16} />}
              <span>{busy ? 'Salvestan…' : 'Määra parool'}</span>
            </button>
          </>
        )}
      </form>
    </div>
  );
};
```

- [ ] **Step 5: `AuthGate.tsx`** — import `SetPasswordPage`. Olek:

```ts
  // /parool#<token> — e-kirja link parooli määramiseks.
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    window.location.pathname === '/parool' && window.location.hash.length > 1 ? window.location.hash.slice(1) : null
  );
  const leaveLinkPage = (message?: string) => {
    window.history.replaceState(null, '', '/');
    setLinkToken(null);
    if (message) setNotice(message);
  };
```

Enne `if (checking) return …` rida:

```tsx
  if (linkToken) {
    return <SetPasswordPage token={linkToken} onDone={(m) => leaveLinkPage(m)} onCancel={() => leaveLinkPage()} />;
  }
```

(Tokenilehel jäetakse `getMe` tulemus arvestamata; `leaveLinkPage` järel näidatakse tavapärast vaadet: kuna `set-password` kustutas sessioonid, on see sisselogimise leht.) Kui `getMe` efekt jookseb ka tokenilehel, pole see probleem.

- [ ] **Step 6: `LoginPage.tsx`** — olek `const [forgotOpen, setForgotOpen] = useState(false); const [forgotLogin, setForgotLogin] = useState(''); const [forgotSent, setForgotSent] = useState(false);`. Nupu „Logi sisse“ järele (vormi sees):

```tsx
        <button type="button" className="login-forgot-link" onClick={() => { setForgotOpen((v) => !v); setForgotSent(false); }}>
          Unustasid parooli?
        </button>
        {forgotOpen && (
          <div className="login-forgot-box">
            {forgotSent ? (
              <div className="alert-box">Kui konto on olemas, saatsime e-posti aadressile parooli määramise lingi.</div>
            ) : (
              <>
                <label htmlFor="forgot-login">Kasutajanimi või e-post</label>
                <div className="login-forgot-row">
                  <input id="forgot-login" className="form-input" value={forgotLogin} onChange={(e) => setForgotLogin(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!forgotLogin.trim()}
                    onClick={async () => {
                      setError(null);
                      try {
                        await api.forgotPassword(forgotLogin.trim());
                        setForgotSent(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Päring ebaõnnestus');
                      }
                    }}
                  >
                    Saada link
                  </button>
                </div>
              </>
            )}
          </div>
        )}
```

- [ ] **Step 7: CSS** (`src/index.css`, `.modal-content.change-password-modal` järele):

```css
.login-forgot-link {
  align-self: center;
  margin-top: 4px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
}

.login-forgot-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8rem;
}

.login-forgot-row {
  display: flex;
  gap: 6px;
}

.login-forgot-row .form-input {
  flex: 1;
}

.users-admin-mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
```

- [ ] **Step 8: README** — kasutajate halduse lõigu lõppu: „Uuele kasutajale saadetakse vaikimisi e-postiga kutse (link kehtib 7 päeva); sisselogimise lehel on „Unustasid parooli?“ (link kehtib 1 tund). Kirjad saadab serveri Postfix (DKIM selektor `agro`, domeen `agro.ventcap.ee`); `.env`: `MAIL_FROM`, `APP_BASE_URL`, `MAIL_DISABLED=1` (arenduses kirju ei saadeta).“ Käsutabelis `add` real `[--email aadress]`.

- [ ] **Step 9: Kontroll ja release.** tsc, `npm test`, `npm run release`, smoke → `KÕIK KORRAS`, `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8820/parool` → 200.

- [ ] **Step 10: Commit**

```bash
git add src/types/auth.ts src/services/api.ts src/components/UsersAdminModal.tsx src/components/LoginPage.tsx src/components/SetPasswordPage.tsx src/AuthGate.tsx src/index.css README.md
git commit -m "Kutse ja parooli lingi kasutajaliides: e-post haldusaknas, parooli määramise leht, unustatud parool."
```

- [ ] **Step 11: KASUTAJA KONTROLL** — admin lisab testkasutaja oma e-posti aadressiga (kutse) → kiri saabub (kontrolli, kas mitte rämpspostis; päistes `dkim=pass`, `spf=pass`) → link avab parooli määramise lehe → pärast määramist sisselogimine; „Unustasid parooli?“ → kiri → uus parool.
