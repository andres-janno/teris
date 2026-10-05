# Kasutajate haldus rakenduses — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin saab rakenduses kasutajaid lisada, muuta, keelata/lubada, parooli lähtestada ja kustutada; admini antud parool on ajutine ja tuleb esimesel sisselogimisel vahetada.

**Architecture:** `users` tabel saab lipud `isAdmin` ja `mustChangePassword`. `authGate` jätab sessiooni kasutaja päringu külge (`sessionUserOf(req)`) ja blokeerib sundvahetuse ajal kõik peale `/api/auth/me|password|logout`. Uus `src/server/adminUsers.ts` teenindab `/api/admin/users*`; reeglid on puhtad funktsioonid failis `src/server/adminRules.ts`. Frontendis `UsersAdminModal` (kasutajamenüü → „Kasutajad“) ja `ChangePasswordModal` sundvahetuse režiim `AuthGate`-is.

**Tech Stack:** Node `http`, Prisma 6 (PostgreSQL), React 19 + TypeScript, Vite 8, Vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-26-kasutajate-haldus-design.md`

## Global Constraints

- Käsud jooksevad kaugserveris: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && <käsk>"`. Kohalik `/Users/andresj/Progemine/teris` on sama kaust (sshfs) — faile muuda kohalikult, käivita kaugelt; pärast mitme faili muutmist `touch <failid>` kaugel. `npm`-i Macis ei käivitata.
- Tüübikontroll `npx tsc --noEmit -p tsconfig.app.json` (0 viga), testid `npm test`, live'i viimine `npm run release` (tsc + testid + build + `sudo systemctl restart teris`); pärast releasi `systemctl is-active teris` ja `journalctl -u teris -n 20 --no-pager`.
- Serverifailid, mis on `vite.config.ts` kaudu kättesaadavad (`apiHandler.ts`, `authGate.ts`, `adminUsers.ts`, `adminRules.ts`, `auth.ts`), kasutavad suhtelistes importides `.ts` laiendit (tsconfig.node.json nodenext). `userCli.ts` jätkab oma laiendita stiili.
- Andmebaas: `psql "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)"`. Enne skeemimuudatust `pg_dump "…" -Fc -f ~/db_backups/teris_db_$(date +%Y%m%d_%H%M%S).dump`.
- `User` väljadel pole `@map`-i → veerunimed on camelCase (`"isAdmin"`, `"mustChangePassword"`).
- Veateated (täpselt): `'Keelatud päring'`, `'Parool tuleb vahetada'`, `'Kasutajanimi peab olema 1–64 märki (a–z, 0–9, . _ -)'`, `'Selline kasutajanimi on juba olemas'`, `'Kasutajat ei leitud'`, `'Parool peab olema vähemalt 10 märki'`, algus `'Seda muudatust ei saa teha'`.
- Uusi npm-sõltuvusi ei lisata. Paroole ega isikuandmeid ei kirjutata logisse ega commit'itavatesse failidesse (v.a testide läbivisatavad testparoolid); testkasutajad luuakse ja kustutatakse testis. Päris kasutaja kontot ei muudeta.
- Commit otse `master`-isse, sõnum eesti keeles, ainult nimetatud failid; lõpus `Co-Authored-By: <sinu mudel> <noreply@anthropic.com>`. Push'i ei tehta.

## Failid

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `User.isAdmin`, `User.mustChangePassword` |
| `src/server/auth.ts` + `auth.test.ts` | `allowedDuringForcedPasswordChange` |
| `src/server/authGate.ts` | uued väljad `/me` vastuses, sundvahetuse blokk, `sessionUserOf(req)` |
| `src/server/adminRules.ts` (uus) + `adminRules.test.ts` | `normalizeUsername`, `checkAdminChange` |
| `src/server/adminUsers.ts` (uus) | `/api/admin/users*` |
| `src/server/apiHandler.ts` | kutsub `handleAdminUsers` |
| `src/server/userCli.ts` | `admin`, `unadmin`, `list` lipud |
| `scripts/auth-smoke.mts` | admini ja sundvahetuse integratsioonitest |
| `src/types/auth.ts` | `AuthUser` lipud, `AdminUser` |
| `src/services/api.ts` | admini API meetodid |
| `src/components/ChangePasswordModal.tsx` | `forced` režiim |
| `src/AuthGate.tsx` | sundvahetuse vaade |
| `src/components/UsersAdminModal.tsx` (uus) | kasutajate haldusaken |
| `src/components/UserMenu.tsx`, `Header.tsx`, `src/App.tsx`, `src/index.css` | menüüpunkt ja stiilid |
| `README.md` | admin-käsud ja haldusaken |

---

### Task 1: Skeem ja parooli sundvahetus serveris

**Files:**
- Modify: `prisma/schema.prisma` (model `User`)
- Modify: `src/server/auth.ts`, `src/server/auth.test.ts`
- Modify: `src/server/authGate.ts`

**Interfaces:**
- Produces: `allowedDuringForcedPasswordChange(pathname: string, method: string): boolean` (auth.ts); `sessionUserOf(req: IncomingMessage): SessionUser | null` ja `export type SessionUser` (authGate.ts); `/api/auth/me` ja login vastus `{ user: { id, username, displayName, isAdmin, mustChangePassword } }`.

- [ ] **Step 1: Kirjuta ebaõnnestuv test** — lisa `src/server/auth.test.ts` lõppu (import-rea `from './auth'` loetellu lisa `allowedDuringForcedPasswordChange`):

```ts
describe('allowedDuringForcedPasswordChange', () => {
  it('lubab ainult me, parooli vahetuse ja väljalogimise', () => {
    expect(allowedDuringForcedPasswordChange('/api/auth/me', 'GET')).toBe(true);
    expect(allowedDuringForcedPasswordChange('/api/auth/password', 'POST')).toBe(true);
    expect(allowedDuringForcedPasswordChange('/api/auth/logout', 'post')).toBe(true);
  });
  it('keelab muud teed ja meetodid', () => {
    expect(allowedDuringForcedPasswordChange('/api/status', 'GET')).toBe(false);
    expect(allowedDuringForcedPasswordChange('/api/auth/password', 'GET')).toBe(false);
    expect(allowedDuringForcedPasswordChange('/api/admin/users', 'GET')).toBe(false);
  });
});
```

- [ ] **Step 2: Käivita** `npx vitest run src/server/auth.test.ts` — oodatud FAIL (`allowedDuringForcedPasswordChange` pole eksporditud).

- [ ] **Step 3: Implementeeri** — `src/server/auth.ts` lõppu:

```ts
// Parooli sundvahetuse ajal lubatud päringud; kõik muu saab 403 'Parool tuleb vahetada'.
export function allowedDuringForcedPasswordChange(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  return (
    (pathname === '/api/auth/me' && m === 'GET') ||
    (pathname === '/api/auth/password' && m === 'POST') ||
    (pathname === '/api/auth/logout' && m === 'POST')
  );
}
```

- [ ] **Step 4: Käivita** `npx vitest run src/server/auth.test.ts` — PASS.

- [ ] **Step 5: Skeem.** `prisma/schema.prisma` model `User`: rea `isActive     Boolean   @default(true)` järele:

```prisma
  isAdmin            Boolean   @default(false)
  mustChangePassword Boolean   @default(false)
```

Serveris (järjest):

```bash
pg_dump "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)" -Fc -f ~/db_backups/teris_db_$(date +%Y%m%d_%H%M%S).dump
npx prisma db push
npx prisma generate
psql "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)" -c 'UPDATE users SET "isAdmin" = true;'
psql "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)" -tAc 'SELECT count(*) FILTER (WHERE "isAdmin"), count(*) FROM users;'
```

Oodatud: `db push` lisab kaks veergu ilma andmekaotuse hoiatuseta; viimane päring annab kaks võrdset arvu (praegu `1|1`). Kui `db push` hoiatab andmekaotusest — PEATU ja teata.

- [ ] **Step 6: `authGate.ts`.**

Importi `allowedDuringForcedPasswordChange` teistega samast `'./auth.ts'` loetelust.

Asenda `DbUser` tüüp ja `toAuthUser`:

```ts
type DbUser = {
  id: string;
  username: string;
  displayName: string | null;
  passwordHash: string;
  isActive: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
};
export type SessionUser = DbUser;

const toAuthUser = (u: DbUser) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName ?? null,
  isAdmin: u.isAdmin,
  mustChangePassword: u.mustChangePassword
});

// Sessiooni kasutaja päringu kohta — hilisemad käsitlejad (nt adminUsers.ts) loevad
// selle siit, et sessiooni ei peaks teist korda andmebaasist otsima.
const sessionUsers = new WeakMap<IncomingMessage, DbUser | null>();

export function sessionUserOf(req: IncomingMessage): SessionUser | null {
  return sessionUsers.get(req) ?? null;
}
```

Rea `const current = await currentSession(req, res);` järele:

```ts
  sessionUsers.set(req, current?.user ?? null);

  if (current?.user.mustChangePassword && !allowedDuringForcedPasswordChange(pathname, method)) {
    json(res, { error: 'Parool tuleb vahetada' }, 403);
    return true;
  }
```

Paroolivahetuses asenda

```ts
    await prisma.user.update({ where: { id: current.user.id }, data: { passwordHash: await hashPassword(newPassword) } });
```

reaga

```ts
    await prisma.user.update({
      where: { id: current.user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }
    });
```

- [ ] **Step 7: Kontrolli** `npx tsc --noEmit -p tsconfig.app.json` (0 viga), `npm test` (kõik PASS).

- [ ] **Step 8: Release ja kontroll.** `npm run release`; seejärel:

```bash
systemctl is-active teris
BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts | tail -1
```

Oodatud: `active`, `KÕIK KORRAS`.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma src/server/auth.ts src/server/auth.test.ts src/server/authGate.ts
git commit -m "Kasutaja admini ja parooli sundvahetuse lipud, sundvahetuse kontroll serveris."
```

---

### Task 2: Admini API, CLI ja integratsioonitest

**Files:**
- Create: `src/server/adminRules.ts`, `src/server/adminRules.test.ts`, `src/server/adminUsers.ts`
- Modify: `src/server/apiHandler.ts` (import + üks rida pärast `authGate`), `src/server/userCli.ts`, `scripts/auth-smoke.mts`

**Interfaces:**
- Consumes: `sessionUserOf(req)`, `SessionUser` (Task 1); `hashPassword`, `validateNewPassword` (auth.ts); `json`, `parseBody` (http.ts).
- Produces: REST `/api/admin/users` (GET → `{users}`, POST → 201 `{user}`), `/api/admin/users/:id` (PATCH → `{user}`, DELETE → `{success:true}`), `/api/admin/users/:id/password` (POST → `{success:true}`). `user` kuju: `{ id, username, displayName, isActive, isAdmin, mustChangePassword, lastLoginAt, createdAt }` (kuupäevad ISO stringidena JSON-is).

- [ ] **Step 1: Kirjuta ebaõnnestuv test** `src/server/adminRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeUsername, checkAdminChange } from './adminRules';

describe('normalizeUsername', () => {
  it('trimmib ja teeb väiketähtedeks', () => {
    expect(normalizeUsername('  Mari.Maasikas ')).toBe('mari.maasikas');
    expect(normalizeUsername('a_b-c9')).toBe('a_b-c9');
  });
  it('lükkab tagasi tühja, liiga pika ja keelatud märgid', () => {
    expect(normalizeUsername('')).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
    expect(normalizeUsername('a'.repeat(65))).toBeNull();
    expect(normalizeUsername('a'.repeat(64))).toBe('a'.repeat(64));
    expect(normalizeUsername('mari maasikas')).toBeNull();
    expect(normalizeUsername('jüri')).toBeNull();
  });
});

describe('checkAdminChange', () => {
  const admin = { id: 'a1', isActive: true, isAdmin: true };
  const user = { id: 'u1', isActive: true, isAdmin: false };

  it('keelab iseenda keelamise, kustutamise ja admini õiguse äravõtmise', () => {
    expect(checkAdminChange('a1', admin, { kind: 'update', isActive: false }, 2)).toMatch(/^Seda muudatust ei saa teha/);
    expect(checkAdminChange('a1', admin, { kind: 'update', isAdmin: false }, 2)).toMatch(/^Seda muudatust ei saa teha/);
    expect(checkAdminChange('a1', admin, { kind: 'delete' }, 2)).toMatch(/^Seda muudatust ei saa teha/);
  });

  it('keelab viimase aktiivse admini eemaldamise', () => {
    expect(checkAdminChange('x', admin, { kind: 'update', isAdmin: false }, 1)).toMatch(/^Seda muudatust ei saa teha/);
    expect(checkAdminChange('x', admin, { kind: 'delete' }, 1)).toMatch(/^Seda muudatust ei saa teha/);
  });

  it('lubab tavalised muudatused', () => {
    expect(checkAdminChange('a1', admin, { kind: 'update' }, 1)).toBeNull();
    expect(checkAdminChange('a1', user, { kind: 'update', isActive: false }, 1)).toBeNull();
    expect(checkAdminChange('a1', user, { kind: 'delete' }, 1)).toBeNull();
    expect(checkAdminChange('a1', user, { kind: 'update', isAdmin: true }, 1)).toBeNull();
    expect(checkAdminChange('x', admin, { kind: 'update', isAdmin: false }, 2)).toBeNull();
    // keelatud admin ei loe aktiivsete adminite hulka
    expect(checkAdminChange('x', { id: 'a2', isActive: false, isAdmin: true }, { kind: 'delete' }, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Käivita** `npx vitest run src/server/adminRules.test.ts` — oodatud FAIL (moodulit pole).

- [ ] **Step 3: Implementeeri** `src/server/adminRules.ts`:

```ts
// src/server/adminRules.ts — kasutajate halduse puhtad reeglid (testitavad ilma andmebaasita).

export const USERNAME_ERROR = 'Kasutajanimi peab olema 1–64 märki (a–z, 0–9, . _ -)';

export function normalizeUsername(raw: unknown): string | null {
  const username = String(raw ?? '').trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(username) ? username : null;
}

export interface AdminTarget {
  id: string;
  isActive: boolean;
  isAdmin: boolean;
}

export type AdminChange = { kind: 'update'; isActive?: boolean; isAdmin?: boolean } | { kind: 'delete' };

// Tagastab veateate või null, kui muudatus on lubatud. actorId '' = käsurida (pole "iseennast").
export function checkAdminChange(
  actorId: string,
  target: AdminTarget,
  change: AdminChange,
  activeAdminCount: number
): string | null {
  const removesAdmin = change.kind === 'delete' || change.isActive === false || change.isAdmin === false;
  if (!removesAdmin) return null;
  if (actorId === target.id) {
    return 'Seda muudatust ei saa teha: iseennast ei saa keelata, kustutada ega admini õigusest ilma jätta';
  }
  if (target.isActive && target.isAdmin && activeAdminCount <= 1) {
    return 'Seda muudatust ei saa teha: vähemalt üks aktiivne admin peab jääma';
  }
  return null;
}
```

- [ ] **Step 4: Käivita** `npx vitest run src/server/adminRules.test.ts` — PASS.

- [ ] **Step 5: Loo** `src/server/adminUsers.ts`:

```ts
// src/server/adminUsers.ts — /api/admin/users* (ainult adminile).
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { hashPassword, validateNewPassword } from './auth.ts';
import { sessionUserOf } from './authGate.ts';
import { normalizeUsername, USERNAME_ERROR, checkAdminChange } from './adminRules.ts';

const PREFIX = '/api/admin/users';
const MAX_BODY_BYTES = 16 * 1024;

const PUBLIC_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  isActive: true,
  isAdmin: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true
} as const;

const activeAdminCount = () => prisma.user.count({ where: { isActive: true, isAdmin: true } });

function cleanDisplayName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().slice(0, 120);
  return name || null;
}

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === 'P2002';

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

  // /api/admin/users
  if (parts.length === 0 && method === 'GET') {
    const users = await prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { username: 'asc' } });
    json(res, { users });
    return true;
  }

  if (parts.length === 0 && method === 'POST') {
    const body = await parseBody(req, MAX_BODY_BYTES);
    const username = normalizeUsername(body?.username);
    if (!username) {
      json(res, { error: USERNAME_ERROR }, 400);
      return true;
    }
    const password = String(body?.password ?? '');
    const problem = validateNewPassword(password);
    if (problem) {
      json(res, { error: problem }, 400);
      return true;
    }
    try {
      const user = await prisma.user.create({
        data: {
          username,
          displayName: cleanDisplayName(body?.displayName),
          passwordHash: await hashPassword(password),
          isAdmin: body?.isAdmin === true,
          mustChangePassword: true
        },
        select: PUBLIC_FIELDS
      });
      json(res, { user }, 201);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      json(res, { error: 'Selline kasutajanimi on juba olemas' }, 409);
    }
    return true;
  }

  const isUserRoute = parts.length === 1 && (method === 'PATCH' || method === 'DELETE');
  const isPasswordRoute = parts.length === 2 && parts[1] === 'password' && method === 'POST';
  if (!isUserRoute && !isPasswordRoute) {
    json(res, { error: 'Not found' }, 404);
    return true;
  }

  const target = await prisma.user.findUnique({ where: { id: parts[0] } });
  if (!target) {
    json(res, { error: 'Kasutajat ei leitud' }, 404);
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
  const data: { displayName?: string | null; isActive?: boolean; isAdmin?: boolean } = {};
  if (body && 'displayName' in body) data.displayName = cleanDisplayName(body.displayName);
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

  const user = await prisma.user.update({ where: { id: target.id }, data, select: PUBLIC_FIELDS });
  if (data.isActive === false) await prisma.session.deleteMany({ where: { userId: target.id } });
  json(res, { user });
  return true;
}
```

Kontrolli enne, et `parseBody` tagastab objekti (vt `src/server/http.ts`); kui selle tagastustüüp on `any`, sobib `'displayName' in body` nagu kirjas.

- [ ] **Step 6: Ühenda** `src/server/apiHandler.ts`-is: importide juurde

```ts
import { handleAdminUsers } from './adminUsers.ts';
```

ja rea `if (await authGate(req, res, pathname, method, options)) return;` järele:

```ts
    if (await handleAdminUsers(req, res, pathname, method)) return;
```

- [ ] **Step 7: CLI** `src/server/userCli.ts`:

Import: `import { checkAdminChange } from './adminRules';`

Uus `case` enne `case 'logout':`:

```ts
    case 'admin':
    case 'unadmin': {
      const user = await findUser(name);
      const makeAdmin = command === 'admin';
      if (!makeAdmin) {
        const activeAdmins = await prisma.user.count({ where: { isActive: true, isAdmin: true } });
        const problem = checkAdminChange('', user, { kind: 'update', isAdmin: false }, activeAdmins);
        if (problem) throw new Error(problem);
      }
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: makeAdmin } });
      console.log(`Kasutaja "${user.username}" ${makeAdmin ? 'on nüüd admin' : 'ei ole enam admin'}.`);
      break;
    }
```

`list` väljundis asenda `u.isActive ? 'aktiivne' : 'keelatud',` kolme reaga:

```ts
          u.isActive ? 'aktiivne' : 'keelatud',
          u.isAdmin ? 'admin' : 'kasutaja',
          u.mustChangePassword ? 'parool vahetamata' : '',
```

Faili päise kommentaaris ja `default`-haru kasutusteates asenda `<add|passwd|disable|enable|list|logout>` → `<add|passwd|disable|enable|admin|unadmin|list|logout>`.

- [ ] **Step 8: Integratsioonitest** `scripts/auth-smoke.mts`:

Konstantide juurde (pärast `const PASS = …`):

```ts
const ADMIN = '_smokeadmin';
const NEWUSER = '_smokenew';
const TEMP_PASS = 'Ajutine-parool-123';
const NEW_PASS = 'Uus-parool-12345';
const TEST_USERS = [USER, ADMIN, NEWUSER];
```

Funktsiooni `post` järele:

```ts
const send = (method: string, path: string, cookie: string, body?: unknown) =>
  fetch(BASE + path, {
    method,
    headers: { Origin: ORIGIN, Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

async function loginAs(username: string, password: string) {
  const res = await post('/api/auth/login', { username, password });
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  const body = await res.json().catch(() => ({}));
  return { status: res.status, cookie, user: body?.user };
}
```

`try`-ploki alguses asenda kaks esimest rida:

```ts
  await prisma.user.deleteMany({ where: { username: { in: TEST_USERS } } });
  await prisma.user.create({ data: { username: USER, passwordHash: await hashPassword(PASS) } });
  await prisma.user.create({ data: { username: ADMIN, passwordHash: await hashPassword(PASS), isAdmin: true } });
```

Rea `check('muutev päring ilma Originita → 403', …);` järele (enne `await post('/api/auth/logout', …)`):

```ts
  check('tavakasutaja /api/admin/users → 403', (await fetch(BASE + '/api/admin/users', { headers: { Cookie: cookie } })).status === 403);

  const admin = await loginAs(ADMIN, PASS);
  check('admin login → isAdmin', admin.status === 200 && admin.user?.isAdmin === true);
  check('admin kasutajate nimekiri → 200', (await send('GET', '/api/admin/users', admin.cookie)).status === 200);

  const created = await send('POST', '/api/admin/users', admin.cookie, { username: NEWUSER, displayName: 'Smoke Uus', password: TEMP_PASS });
  const newId = (await created.json().catch(() => ({})))?.user?.id as string | undefined;
  check('admin loob kasutaja → 201', created.status === 201 && Boolean(newId), `${created.status}`);
  check('sama kasutajanimi → 409', (await send('POST', '/api/admin/users', admin.cookie, { username: NEWUSER, password: TEMP_PASS })).status === 409);
  check('vigane kasutajanimi → 400', (await send('POST', '/api/admin/users', admin.cookie, { username: 'vale nimi', password: TEMP_PASS })).status === 400);

  const fresh = await loginAs(NEWUSER, TEMP_PASS);
  check('uus kasutaja peab parooli vahetama', fresh.status === 200 && fresh.user?.mustChangePassword === true);
  check('sundvahetuse ajal /api/status → 403', (await fetch(BASE + '/api/status', { headers: { Cookie: fresh.cookie } })).status === 403);
  check('parooli vahetus → 200', (await send('POST', '/api/auth/password', fresh.cookie, { currentPassword: TEMP_PASS, newPassword: NEW_PASS })).status === 200);
  check('pärast vahetust /api/status → 200', (await fetch(BASE + '/api/status', { headers: { Cookie: fresh.cookie } })).status === 200);

  check('admin ei saa ennast keelata → 400', (await send('PATCH', `/api/admin/users/${admin.user?.id}`, admin.cookie, { isActive: false })).status === 400);
  check('parooli lähtestamine → 200', (await send('POST', `/api/admin/users/${newId}/password`, admin.cookie, { password: TEMP_PASS })).status === 200);
  check('lähtestamine lõpetas sessiooni → 401', (await fetch(BASE + '/api/auth/me', { headers: { Cookie: fresh.cookie } })).status === 401);
  check('admin kustutab kasutaja → 200', (await send('DELETE', `/api/admin/users/${newId}`, admin.cookie)).status === 200);
  check('tundmatu kasutaja → 404', (await send('DELETE', `/api/admin/users/${newId}`, admin.cookie)).status === 404);
```

`finally`-plokis asenda `await prisma.user.deleteMany({ where: { username: USER } });` →

```ts
  await prisma.user.deleteMany({ where: { username: { in: TEST_USERS } } });
```

- [ ] **Step 9: Kontrolli** `npx tsc --noEmit -p tsconfig.app.json` (0 viga), `npm test` (kõik PASS).

- [ ] **Step 10: Release ja integratsioonitest.**

```bash
npm run release
systemctl is-active teris
BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts
npm run user -- list
psql "$(sed -n 's/^DATABASE_URL="\(.*\)?schema=public"/\1/p' .env)" -tAc "SELECT count(*) FROM users WHERE username LIKE '\_smoke%';"
```

Oodatud: `active`; kõik read `OK`, lõpus `KÕIK KORRAS`; `list` näitab päris kasutajat `admin` lipuga; testkasutajaid 0.

- [ ] **Step 11: Commit**

```bash
git add src/server/adminRules.ts src/server/adminRules.test.ts src/server/adminUsers.ts src/server/apiHandler.ts src/server/userCli.ts scripts/auth-smoke.mts
git commit -m "Kasutajate halduse API (/api/admin/users), CLI admin-käsud ja integratsioonitest."
```

---

### Task 3: Kasutajaliides

**Files:**
- Modify: `src/types/auth.ts`, `src/services/api.ts`, `src/components/ChangePasswordModal.tsx`, `src/AuthGate.tsx`, `src/components/UserMenu.tsx`, `src/components/Header.tsx`, `src/App.tsx`, `src/index.css`, `README.md`
- Create: `src/components/UsersAdminModal.tsx`

**Interfaces:**
- Consumes: Task 2 REST API; `/api/auth/me` väljad `isAdmin`, `mustChangePassword`.
- Produces: `AdminUser` tüüp; `api.listUsers/createUser/updateUser/resetUserPassword/deleteUser`.

- [ ] **Step 1: Tüübid** — `src/types/auth.ts` kogu sisu:

```ts
// src/types/auth.ts
export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: API** — `src/services/api.ts`: import muuda `import type { AuthUser, AdminUser } from '../types/auth';`. `api` objektis meetodi `changePassword` järele:

```ts
  async listUsers(): Promise<AdminUser[]> {
    const res = await apiFetch('/api/admin/users');
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutajate laadimine ebaõnnestus'));
    return (await res.json()).users;
  },

  async createUser(data: { username: string; displayName: string; password: string; isAdmin: boolean }): Promise<AdminUser> {
    const res = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutaja lisamine ebaõnnestus'));
    return (await res.json()).user;
  },

  async updateUser(id: string, data: { displayName?: string; isActive?: boolean; isAdmin?: boolean }): Promise<AdminUser> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutaja muutmine ebaõnnestus'));
    return (await res.json()).user;
  },

  async resetUserPassword(id: string, password: string): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Parooli lähtestamine ebaõnnestus'));
  },

  async deleteUser(id: string): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutaja kustutamine ebaõnnestus'));
  },
```

- [ ] **Step 3: `ChangePasswordModal` sundvahetuse režiim.**

Props:

```ts
interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Sundvahetus: aken ei sulgu, õnnestumisel kutsutakse onDone, lisaks "Logi välja".
  forced?: boolean;
  onDone?: () => void;
  onLogout?: () => void;
}
```

Komponendi signatuur: `({ isOpen, onClose, forced = false, onDone, onLogout }) =>`.

`submit`-is asenda `setDone(true);` →

```ts
      if (forced) onDone?.();
      else setDone(true);
```

Backdrop: `<div className="modal-backdrop" onClick={forced ? undefined : close}>`.

Pealkiri: `<h3>{forced ? 'Määra uus parool' : 'Muuda parooli'}</h3>`; X-nupp ainult kui `!forced`:

```tsx
          {!forced && (
            <button type="button" className="icon-btn-ghost" onClick={close}>
              <X size={20} />
            </button>
          )}
```

`modal-body` alguses (enne `{done ? …`):

```tsx
          {forced && <p className="modal-subtitle">Sinu parool on ajutine. Määra endale uus parool, et jätkata.</p>}
```

Praeguse parooli silt: `<label htmlFor="pw-current">{forced ? 'Ajutine parool' : 'Praegune parool'}</label>`.

Jaluse esimene nupp asenda:

```tsx
          {forced ? (
            <button type="button" className="btn btn-ghost" onClick={onLogout}>Logi välja</button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={close}>{done ? 'Sulge' : 'Loobu'}</button>
          )}
```

- [ ] **Step 4: `AuthGate.tsx`** — importi `ChangePasswordModal` (`import { ChangePasswordModal } from './components/ChangePasswordModal';`). Tõsta `onLogout` loogika funktsiooniks ja lisa sundvahetuse vaade. Asenda `if (!user) {…}` ploki järel olev `return (<App …/>);` järgmisega:

```tsx
  const logout = () => {
    api
      .logout()
      .then(() => {
        setNotice(null);
        setUser(null);
      })
      .catch((err) => {
        // Väljalogimine ebaõnnestus — jäetakse sisse logituks, kasutajale teatatakse alert()-iga.
        alert(err instanceof Error ? err.message : 'Väljalogimine ebaõnnestus');
      });
  };

  if (user.mustChangePassword) {
    return (
      <div className="forced-password-page">
        <ChangePasswordModal
          isOpen
          forced
          onClose={() => undefined}
          onDone={() => {
            api.getMe().then(setUser).catch(() => setUser(null));
          }}
          onLogout={logout}
        />
      </div>
    );
  }

  return <App user={user} onLogout={logout} />;
```

- [ ] **Step 5: Loo** `src/components/UsersAdminModal.tsx`:

```tsx
// src/components/UsersAdminModal.tsx — kasutajate haldus (ainult adminile).
import React, { useCallback, useEffect, useState } from 'react';
import { X, Users, UserPlus, Pencil, KeyRound, Ban, CheckCircle2, Trash2, AlertCircle, Check } from 'lucide-react';
import { api } from '../services/api';
import type { AdminUser } from '../types/auth';

interface UsersAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; user: AdminUser } | { kind: 'reset'; user: AdminUser };

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' }) : '–';

export const UsersAdminModal: React.FC<UsersAdminModalProps> = ({ isOpen, onClose, currentUserId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setMode({ kind: 'list' });
    setError(null);
    void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const openForm = (next: Mode) => {
    setError(null);
    setUsername('');
    setPassword('');
    setRepeat('');
    setDisplayName(next.kind === 'edit' ? next.user.displayName ?? '' : '');
    setIsAdmin(next.kind === 'edit' ? next.user.isAdmin : false);
    setMode(next);
  };

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      await load();
      setMode({ kind: 'list' });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode.kind === 'add' || mode.kind === 'reset') {
      if (password.length < 10) return setError('Parool peab olema vähemalt 10 märki');
      if (password !== repeat) return setError('Paroolid ei kattu');
    }
    if (mode.kind === 'add') void run(() => api.createUser({ username, displayName, password, isAdmin }));
    else if (mode.kind === 'edit') {
      const self = mode.user.id === currentUserId;
      void run(() => api.updateUser(mode.user.id, self ? { displayName } : { displayName, isAdmin }));
    } else if (mode.kind === 'reset') void run(() => api.resetUserPassword(mode.user.id, password));
  };

  const toggleActive = (u: AdminUser) => void run(() => api.updateUser(u.id, { isActive: !u.isActive }));

  const remove = (u: AdminUser) => {
    if (confirm(`Kustutada kasutaja "${u.username}" jäädavalt?`)) void run(() => api.deleteUser(u.id));
  };

  const formTitle =
    mode.kind === 'add'
      ? 'Lisa kasutaja'
      : mode.kind === 'edit'
        ? `Muuda: ${mode.user.username}`
        : mode.kind === 'reset'
          ? `Lähtesta parool: ${mode.user.username}`
          : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-scale-up users-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Users className="text-emerald" size={22} />
            <h3>Kasutajad</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert-box error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {mode.kind === 'list' ? (
            <>
              <div className="users-admin-toolbar">
                <button type="button" className="btn btn-primary" onClick={() => openForm({ kind: 'add' })}>
                  <UserPlus size={16} />
                  <span>Lisa kasutaja</span>
                </button>
              </div>
              <div className="users-admin-table-wrap">
                <table className="users-admin-table">
                  <thead>
                    <tr>
                      <th>Nimi</th>
                      <th>Kasutajanimi</th>
                      <th>Roll</th>
                      <th>Olek</th>
                      <th>Viimati sees</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const self = u.id === currentUserId;
                      return (
                        <tr key={u.id} className={u.isActive ? '' : 'inactive'}>
                          <td>{u.displayName ?? '–'}</td>
                          <td>{u.username}</td>
                          <td>{u.isAdmin ? 'Admin' : 'Kasutaja'}</td>
                          <td>
                            {u.isActive ? 'Aktiivne' : 'Keelatud'}
                            {u.mustChangePassword && <span className="users-admin-badge">Parool vahetamata</span>}
                          </td>
                          <td>{formatDate(u.lastLoginAt)}</td>
                          <td className="users-admin-actions">
                            <button type="button" className="icon-btn-ghost" title="Muuda" disabled={busy} onClick={() => openForm({ kind: 'edit', user: u })}>
                              <Pencil size={15} />
                            </button>
                            {!self && (
                              <>
                                <button type="button" className="icon-btn-ghost" title="Lähtesta parool" disabled={busy} onClick={() => openForm({ kind: 'reset', user: u })}>
                                  <KeyRound size={15} />
                                </button>
                                <button type="button" className="icon-btn-ghost" title={u.isActive ? 'Keela' : 'Luba'} disabled={busy} onClick={() => toggleActive(u)}>
                                  {u.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                                </button>
                                <button type="button" className="icon-btn-danger" title="Kustuta" disabled={busy} onClick={() => remove(u)}>
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <form id="users-admin-form" className="users-admin-form" onSubmit={submit}>
              <h4>{formTitle}</h4>
              {mode.kind === 'add' && (
                <div className="form-group">
                  <label htmlFor="ua-username">Kasutajanimi (a–z, 0–9, . _ -)</label>
                  <input id="ua-username" className="form-input" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
              )}
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <div className="form-group">
                  <label htmlFor="ua-display">Nimi</label>
                  <input id="ua-display" className="form-input" autoComplete="off" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
              )}
              {(mode.kind === 'add' || mode.kind === 'reset') && (
                <>
                  <div className="form-group">
                    <label htmlFor="ua-password">Ajutine parool (vähemalt 10 märki)</label>
                    <input id="ua-password" type="password" className="form-input" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ua-repeat">Korda parooli</label>
                    <input id="ua-repeat" type="password" className="form-input" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                  </div>
                  <p className="modal-subtitle">Kasutaja peab parooli esimesel sisselogimisel vahetama.</p>
                </>
              )}
              {(mode.kind === 'add' || (mode.kind === 'edit' && mode.user.id !== currentUserId)) && (
                <label className="users-admin-checkbox">
                  <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
                  <span>Admin (saab kasutajaid hallata)</span>
                </label>
              )}
            </form>
          )}
        </div>

        <div className="modal-footer">
          {mode.kind === 'list' ? (
            <button type="button" className="btn btn-ghost" onClick={onClose}>Sulge</button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => { setError(null); setMode({ kind: 'list' }); }}>Tagasi</button>
              <button type="submit" form="users-admin-form" className="btn btn-primary" disabled={busy}>
                <Check size={16} />
                <span>Salvesta</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Menüüpunkt.**

`src/components/UserMenu.tsx`: lucide importi lisa `Users`. Propsidesse `onOpenUsers?: () => void;` ja destruktureerimisse `onOpenUsers,`. Punkti „Muuda parooli“ nupu järele:

```tsx
          {user.isAdmin && onOpenUsers && (
            <button type="button" role="menuitem" className="user-menu-item" onClick={run(onOpenUsers)}>
              <Users size={15} />
              <span>Kasutajad</span>
            </button>
          )}
```

`src/components/Header.tsx`: `HeaderProps`-i rea `onChangePassword?: () => void;` järele `onOpenUsers?: () => void;`; destruktureerimisse `onChangePassword,` järele `onOpenUsers,`; `<UserMenu … onChangePassword={onChangePassword}` järele `onOpenUsers={onOpenUsers}`.

`src/App.tsx`:
- import: `import { UsersAdminModal } from './components/UsersAdminModal';` (rea `import { ChangePasswordModal } …` järele);
- rea `const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);` järele: `const [isUsersAdminOpen, setIsUsersAdminOpen] = useState(false);`;
- `<Header>`-is rea `onChangePassword={() => setIsChangePasswordOpen(true)}` järele: `onOpenUsers={user.isAdmin ? () => setIsUsersAdminOpen(true) : undefined}`;
- rea `<ChangePasswordModal isOpen={isChangePasswordOpen} … />` järele:

```tsx
      <UsersAdminModal isOpen={isUsersAdminOpen} onClose={() => setIsUsersAdminOpen(false)} currentUserId={user.id} />
```

- [ ] **Step 7: CSS** — `src/index.css` reegli `.modal-content.change-password-modal { … }` järele:

```css
.forced-password-page {
  min-height: 100vh;
  background: var(--bg-dark);
}

.modal-content.users-admin-modal {
  width: min(920px, 96vw);
}

.users-admin-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.users-admin-table-wrap {
  overflow-x: auto;
}

.users-admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.users-admin-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-card);
  white-space: nowrap;
}

.users-admin-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-card);
  color: var(--text-primary);
  vertical-align: middle;
}

.users-admin-table tr.inactive td {
  color: var(--text-muted);
}

.users-admin-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  white-space: nowrap;
}

.users-admin-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(217, 119, 6, 0.14);
  color: var(--amber-500);
}

.users-admin-form h4 {
  margin: 0 0 12px;
  font-size: 0.95rem;
}

.users-admin-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  cursor: pointer;
}
```

- [ ] **Step 8: README** — käsutabelis rea `| \`npm run user -- logout <nimi>\` | lõpetab kasutaja sessioonid |` järele:

```markdown
| `npm run user -- admin <nimi>` / `unadmin <nimi>` | annab / võtab admini õiguse |
```

ja tabeli järel oleva rea `Tüübikontroll: …` ette eraldi lõik:

```markdown
Kasutajaid saab hallata ka rakenduses: kasutajamenüü → **Kasutajad** (ainult admin). Admini
lisatud või lähtestatud parool on ajutine — kasutaja peab selle esimesel sisselogimisel vahetama.
```

- [ ] **Step 9: Kontrolli ja vii live'i.** `npx tsc --noEmit -p tsconfig.app.json` (0 viga), `npm test`, `npm run release`, `systemctl is-active teris`, `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts | tail -1` → `KÕIK KORRAS`.

- [ ] **Step 10: Commit**

```bash
git add src/types/auth.ts src/services/api.ts src/components/ChangePasswordModal.tsx src/AuthGate.tsx src/components/UsersAdminModal.tsx src/components/UserMenu.tsx src/components/Header.tsx src/App.tsx src/index.css README.md
git commit -m "Kasutajate haldusaken ja parooli sundvahetus kasutajaliideses."
```

- [ ] **Step 11: KASUTAJA KONTROLL** — https://teris.ee: kasutajamenüü → Kasutajad; lisa testkasutaja, logi temana sisse (teises brauseris/privaatses aknas) → nõutakse parooli vahetust → pärast vahetust avaneb rakendus; keela/luba, lähtesta parool, kustuta.
