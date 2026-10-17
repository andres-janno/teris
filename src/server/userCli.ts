// src/server/userCli.ts
// Kasutajate haldus: npm run user -- <add|passwd|disable|enable|admin|unadmin|list|logout> [nimi] [--display "Nimi"] [--email aadress] [--tenant <id>]
// Parool küsitakse varjatult (terminalis) või loetakse stdin'i ridadest (toru kaudu).
import readline from 'node:readline';
import { authDb } from './db';
import { hashPassword, validateNewPassword } from './auth';
import { checkAdminChange } from './adminRules';
import { normalizeEmail } from './mail';

// Käsurida töötab platvormirolliga (möödub RLS-ist): ettevõte antakse selgelt.
const prisma = authDb();

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

async function resolveTenantId(rest: string[]): Promise<string> {
  const idx = rest.indexOf('--tenant');
  let id: string;
  if (idx >= 0) {
    const value = rest[idx + 1];
    if (!value || value.startsWith('--')) throw new Error('--tenant vajab väärtust');
    id = value;
  } else {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    if (tenants.length !== 1) throw new Error('Mitu ettevõtet — anna --tenant <id>');
    id = tenants[0].id;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new Error(`Ettevõtet "${id}" pole`);
  if (tenant.status !== 'ACTIVE') throw new Error(`Ettevõte "${id}" ei ole aktiivne`);
  return id;
}

async function main(): Promise<void> {
  const [command, name, ...rest] = process.argv.slice(2);
  const displayIdx = rest.indexOf('--display');
  const displayName = displayIdx >= 0 ? rest[displayIdx + 1] ?? null : null;
  const emailIdx = rest.indexOf('--email');
  const emailRaw = emailIdx >= 0 ? rest[emailIdx + 1] ?? '' : null;

  switch (command) {
    case 'add': {
      if (!name) throw new Error('Kasutus: add <nimi> [--display "Nimi"] [--email aadress] [--tenant <id>]');
      const username = name.toLowerCase();
      if (username === 'kasutajatugi') throw new Error('Kasutajanimi on reserveeritud');
      if (username.length > 64) throw new Error('Kasutajanimi on liiga pikk (maksimaalselt 64 märki)');
      if (await prisma.user.findUnique({ where: { username } })) throw new Error(`Kasutaja "${username}" on juba olemas`);
      const email = emailRaw === null ? null : normalizeEmail(emailRaw);
      if (emailRaw !== null && !email) throw new Error('Vigane e-posti aadress');
      if (email && (await prisma.user.findUnique({ where: { email } }))) throw new Error('E-post on juba kasutusel');
      const tenantId = await resolveTenantId(rest);
      const passwordHash = await hashPassword(await askNewPassword());
      await prisma.user.create({ data: { username, passwordHash, displayName, email, tenantId } });
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
    case 'admin':
    case 'unadmin': {
      const user = await findUser(name);
      const makeAdmin = command === 'admin';
      if (!makeAdmin) {
        const activeAdmins = await prisma.user.count({ where: { tenantId: user.tenantId, isActive: true, isAdmin: true } });
        const problem = checkAdminChange('', user, { kind: 'update', isAdmin: false }, activeAdmins);
        if (problem) throw new Error(problem);
      }
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: makeAdmin } });
      console.log(`Kasutaja "${user.username}" ${makeAdmin ? 'on nüüd admin' : 'ei ole enam admin'}.`);
      break;
    }
    case 'logout': {
      const user = await findUser(name);
      const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });
      console.log(`${count} sessiooni lõpetatud.`);
      break;
    }
    case 'list': {
      const users = await prisma.user.findMany({
        orderBy: { username: 'asc' },
        include: {
          _count: { select: { sessions: true } },
          sessions: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: 'desc' }, take: 1 }
        }
      });
      for (const u of users) {
        const latestSession = u.sessions?.[0]?.lastSeenAt ?? null;
        const lastSeen = latestSession && u.lastLoginAt
          ? (latestSession > u.lastLoginAt ? latestSession : u.lastLoginAt)
          : (latestSession ?? u.lastLoginAt ?? null);
        console.log([
          u.username.padEnd(20),
          u.tenantId.padEnd(20),
          (u.displayName ?? '').padEnd(24),
          (u.email ?? '').padEnd(30),
          u.isActive ? 'aktiivne' : 'keelatud',
          u.isAdmin ? 'admin' : 'kasutaja',
          u.mustChangePassword ? 'parool vahetamata' : '',
          `viimati: ${lastSeen ? lastSeen.toISOString().slice(0, 16).replace('T', ' ') : '–'}`,
          `sessioone: ${u._count.sessions}`
        ].join('  '));
      }
      if (users.length === 0) console.log('Kasutajaid pole.');
      break;
    }
    default:
      throw new Error('Kasutus: npm run user -- <add|passwd|disable|enable|admin|unadmin|list|logout> [nimi] [--display "Nimi"] [--email aadress] [--tenant <id>]');
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
