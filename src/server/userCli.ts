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
