// scripts/auth-smoke.mts — integratsioonitest töötava toodanguserveri vastu.
// Käivita serveris: BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts
import { PrismaClient } from '@prisma/client';
import { hashPassword, hashToken } from '../src/server/auth.ts';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8820';
const ORIGIN = 'https://teris.ee';
const USER = '_smoketest';
const PASS = 'Smoke-test-12345';
const ADMIN = '_smokeadmin';
const NEWUSER = '_smokenew';
const LINKUSER = '_smokelink';
const TEMP_PASS = 'Ajutine-parool-123';
const NEW_PASS = 'Uus-parool-12345';
const TEST_USERS = [USER, ADMIN, NEWUSER, LINKUSER, '_smokemuu'];
const prisma = new PrismaClient();
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'OK  ' : 'VIGA'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Forwarded-Proto': 'https', ...headers }, body: JSON.stringify(body) });

const send = (method: string, path: string, cookie: string, body?: unknown) =>
  fetch(BASE + path, {
    method,
    headers: { Origin: ORIGIN, Cookie: cookie, 'X-Forwarded-Proto': 'https', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

async function loginAs(username: string, password: string) {
  const res = await post('/api/auth/login', { username, password });
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  const body = await res.json().catch(() => ({}));
  return { status: res.status, cookie, user: body?.user };
}

try {
  await prisma.user.deleteMany({ where: { username: { in: TEST_USERS } } });
  await prisma.user.create({ data: { username: USER, passwordHash: await hashPassword(PASS) } });
  await prisma.user.create({ data: { username: ADMIN, passwordHash: await hashPassword(PASS), isAdmin: true, email: '_smokeadmin@example.invalid' } });

  check('status ilma sessioonita → 401', (await fetch(BASE + '/api/status')).status === 401);
  check('vale parool → 401', (await post('/api/auth/login', { username: USER, password: 'vale-parool-1' })).status === 401);
  check('vale Origin → 403', (await post('/api/auth/login', { username: USER, password: PASS }, { Origin: 'https://kuri.ee' })).status === 403);

  const login = await post('/api/auth/login', { username: USER, password: PASS });
  const setCookie = login.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  check('õige parool → 200 + küpsis', login.status === 200 && (cookie.startsWith('teris_session=')), `${login.status}`);
  check('küpsise atribuudid', /HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Lax/.test(setCookie));

  const me = await fetch(BASE + '/api/auth/me', { headers: { Cookie: cookie } });
  check('me → 200', me.status === 200 && (await me.json()).user?.username === USER);
  check('andmed sessiooniga → 200', (await fetch(BASE + '/api/master-fields', { headers: { Cookie: cookie } })).status === 200);
  check('muutev päring ilma Originita → 403', (await fetch(BASE + '/api/crops', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status === 403);

  check('tavakasutaja /api/admin/users → 403', (await fetch(BASE + '/api/admin/users', { headers: { Cookie: cookie } })).status === 403);
  check('tavakasutaja PRIA import (massiiv) → 403', (await post('/api/master-fields', [], { Cookie: cookie })).status === 403);
  check('tavakasutaja mullaproovide import → 403', (await post('/api/soil-samples/import', [], { Cookie: cookie })).status === 403);
  check('tavakasutaja põlluraamatu import → 403', (await post('/api/field-operations/import', { fields: [] }, { Cookie: cookie })).status === 403);

  const admin = await loginAs(ADMIN, PASS);
  check('admin login → isAdmin', admin.status === 200 && admin.user?.isAdmin === true);
  check('admin kasutajate nimekiri → 200', (await send('GET', '/api/admin/users', admin.cookie)).status === 200);

  const created = await send('POST', '/api/admin/users', admin.cookie, { username: NEWUSER, displayName: 'Smoke Uus', email: '_smokenew@example.invalid', password: TEMP_PASS });
  const newId = (await created.json().catch(() => ({})))?.user?.id as string | undefined;
  check('admin loob kasutaja → 201', created.status === 201 && Boolean(newId), `${created.status}`);
  check('sama kasutajanimi → 409', (await send('POST', '/api/admin/users', admin.cookie, { username: NEWUSER, email: '_muu@example.invalid', password: TEMP_PASS })).status === 409);
  check('sama e-post → 409', (await send('POST', '/api/admin/users', admin.cookie, { username: '_smokemuu', email: '_smokenew@example.invalid', password: TEMP_PASS })).status === 409);
  check('e-post puudub → 400', (await send('POST', '/api/admin/users', admin.cookie, { username: '_smokemuu', password: TEMP_PASS })).status === 400);
  check('vigane kasutajanimi → 400', (await send('POST', '/api/admin/users', admin.cookie, { username: 'vale nimi', email: '_x@example.invalid', password: TEMP_PASS })).status === 400);
  const listed = await (await send('GET', '/api/admin/users', admin.cookie)).json();
  check('nimekirjas pole paroolirässi', Array.isArray(listed.users) && listed.users.every((u: Record<string, unknown>) => !('passwordHash' in u) && 'hasPassword' in u));

  const patchName = await send('PATCH', `/api/admin/users/${newId}`, admin.cookie, { displayName: 'Smoke Uus2' });
  check('admin muudab ainult nime → 200', patchName.status === 200, `${patchName.status}`);
  const patchClearEmail = await send('PATCH', `/api/admin/users/${newId}`, admin.cookie, { email: '' });
  const patchClearBody = await patchClearEmail.json().catch(() => ({}));
  check('admin tühjendab e-posti → 200 ja email null', patchClearEmail.status === 200 && patchClearBody?.user?.email === null, `${patchClearEmail.status}`);

  const fresh = await loginAs(NEWUSER, TEMP_PASS);
  check('uus kasutaja peab parooli vahetama', fresh.status === 200 && fresh.user?.mustChangePassword === true);
  check('sundvahetuse ajal /api/status → 403', (await fetch(BASE + '/api/status', { headers: { Cookie: fresh.cookie } })).status === 403);
  check('uus parool = ajutine → 400', (await send('POST', '/api/auth/password', fresh.cookie, { currentPassword: TEMP_PASS, newPassword: TEMP_PASS })).status === 400);
  check('parooli vahetus → 200', (await send('POST', '/api/auth/password', fresh.cookie, { currentPassword: TEMP_PASS, newPassword: NEW_PASS })).status === 200);
  check('pärast vahetust /api/status → 200', (await fetch(BASE + '/api/status', { headers: { Cookie: fresh.cookie } })).status === 200);

  check('admin ei saa ennast keelata → 400', (await send('PATCH', `/api/admin/users/${admin.user?.id}`, admin.cookie, { isActive: false })).status === 400);
  check('parooli lähtestamine → 200', (await send('POST', `/api/admin/users/${newId}/password`, admin.cookie, { password: TEMP_PASS })).status === 200);
  check('lähtestamine lõpetas sessiooni → 401', (await fetch(BASE + '/api/auth/me', { headers: { Cookie: fresh.cookie } })).status === 401);
  check('admin kustutab kasutaja → 200', (await send('DELETE', `/api/admin/users/${newId}`, admin.cookie)).status === 200);
  check('tundmatu kasutaja → 404', (await send('DELETE', `/api/admin/users/${newId}`, admin.cookie)).status === 404);

  await post('/api/auth/logout', {}, { Cookie: cookie });
  check('pärast väljalogimist → 401', (await fetch(BASE + '/api/auth/me', { headers: { Cookie: cookie } })).status === 401);

  // Parooli link: token luuakse otse DB-sse (testis e-kirju ei saadeta).
  const linkUser = await prisma.user.create({ data: { username: LINKUSER, email: '_smokelink@example.invalid', passwordHash: '' } });
  const rawToken = 'smoke-token-' + Date.now();
  await prisma.passwordToken.create({ data: { userId: linkUser.id, purpose: 'INVITE', tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 3600_000) } });
  await prisma.passwordToken.create({ data: { userId: linkUser.id, purpose: 'RESET', tokenHash: hashToken(rawToken + '-old'), expiresAt: new Date(Date.now() - 1000) } });
  // Sessioon luuakse otse DB-sse, et kontrollida, et parooli määramine lõpetab
  // kasutaja olemasolevad sessioonid (loginAs pole enne parooli määramist võimalik).
  const linkSessionToken = 'smoke-session-' + Date.now();
  await prisma.session.create({ data: { userId: linkUser.id, tokenHash: hashToken(linkSessionToken), expiresAt: new Date(Date.now() + 3600_000) } });
  const linkSessionCookie = `teris_session=${linkSessionToken}`;
  check('linkUseri sessioon kehtib enne parooli määramist', (await fetch(BASE + '/api/auth/me', { headers: { Cookie: linkSessionCookie } })).status === 200);
  check('kutsutud kasutaja ei saa enne parooli sisse', (await post('/api/auth/login', { username: LINKUSER, password: NEW_PASS })).status === 401);
  check('forgot tundmatu kasutajaga → 200', (await post('/api/auth/forgot', { login: '_olematu_kasutaja' })).status === 200);
  check('vale token → 400', (await post('/api/auth/token', { token: 'vale' })).status === 400);
  check('aegunud token → 400', (await post('/api/auth/token', { token: rawToken + '-old' })).status === 400);
  const tokenCheck = await post('/api/auth/token', { token: rawToken });
  check('kehtiv token → 200', tokenCheck.status === 200 && (await tokenCheck.json()).username === LINKUSER);
  check('liiga lühike parool → 400', (await post('/api/auth/set-password', { token: rawToken, password: 'lyhike' })).status === 400);
  check('parooli määramine → 200', (await post('/api/auth/set-password', { token: rawToken, password: NEW_PASS })).status === 200);
  check('sama token uuesti → 400', (await post('/api/auth/set-password', { token: rawToken, password: NEW_PASS })).status === 400);
  check('parooli määramine lõpetas olemasoleva sessiooni', (await fetch(BASE + '/api/auth/me', { headers: { Cookie: linkSessionCookie } })).status === 401);
  check('uue parooliga sisse → 200', (await loginAs(LINKUSER, NEW_PASS)).status === 200);

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
  await prisma.user.deleteMany({ where: { username: { in: TEST_USERS } } });
  await prisma.$disconnect();
}

console.log(failures === 0 ? 'KÕIK KORRAS' : `${failures} VIGA`);
process.exit(failures === 0 ? 0 : 1);
