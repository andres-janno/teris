// scripts/auth-smoke.mts — integratsioonitest töötava toodanguserveri vastu.
// Käivita serveris: BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth.ts';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8820';
const ORIGIN = 'https://agro.ventcap.ee';
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
  check('õige parool → 200 + küpsis', login.status === 200 && cookie.startsWith('agro_session='), `${login.status}`);
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
