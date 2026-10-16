// src/server/platformCli.ts
// Teenusepakkuja kasutajate haldus: npm run platform -- <add|list|passwd|reset-totp|disable|enable> [nimi]
// Parool küsitakse varjatult (terminalis) või loetakse stdin'i ridadest (toru kaudu).
// TOTP saladus trükitakse ainult terminali (mitte logisse); andmebaasi läheb see krüpteeritult (PLATFORM_TOTP_KEY).
import readline from 'node:readline';
import { authDb } from './db';
import { hashPassword, validateNewPassword } from './auth';
import { encryptTotpSecret, generateTotpSecret, otpauthUri } from './totp';

// Käsurida töötab platvormirolliga (möödub RLS-ist).
const prisma = authDb();

const USERNAME_RE = /^[a-z0-9._-]+$/;

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

function totpKey(): string {
  const key = process.env.PLATFORM_TOTP_KEY;
  if (!key) throw new Error('PLATFORM_TOTP_KEY puudub');
  return key;
}

function parseUsername(name: string | undefined): string {
  if (!name) throw new Error('Kasutajanimi puudub');
  const username = name.toLowerCase();
  if (username.length > 64) throw new Error('Kasutajanimi on liiga pikk (maksimaalselt 64 märki)');
  if (!USERNAME_RE.test(username)) throw new Error('Kasutajanimi tohib sisaldada ainult tähti a-z, numbreid ning märke . _ -');
  return username;
}

async function findUser(name: string | undefined) {
  const username = parseUsername(name);
  const user = await prisma.platformUser.findUnique({ where: { username } });
  if (!user) throw new Error(`Platvormi kasutajat "${username}" pole`);
  return user;
}

// Trükib saladuse ainult terminali.
function printTotpSetup(username: string, secret: string): void {
  console.log(`TOTP seadistamiseks lisa autentimisrakendusse (Google Authenticator, 1Password jm) käsitsi võti: ${secret}`);
  console.log(`või URI: ${otpauthUri(username, secret)}`);
}

async function main(): Promise<void> {
  const [command, name] = process.argv.slice(2);

  switch (command) {
    case 'add': {
      const username = parseUsername(name);
      const key = totpKey();
      if (await prisma.platformUser.findUnique({ where: { username } })) throw new Error(`Platvormi kasutaja "${username}" on juba olemas`);
      const passwordHash = await hashPassword(await askNewPassword());
      const secret = generateTotpSecret();
      await prisma.platformUser.create({ data: { username, passwordHash, totpSecretEnc: encryptTotpSecret(secret, key) } });
      await prisma.platformAuditLog.create({ data: { action: 'PLATFORM_USER_ADD', platformUserId: null, details: { username } } });
      console.log(`Platvormi kasutaja "${username}" loodud.`);
      printTotpSetup(username, secret);
      break;
    }
    case 'list': {
      const users = await prisma.platformUser.findMany({ orderBy: { username: 'asc' } });
      for (const u of users) {
        console.log([
          u.username.padEnd(24),
          u.isActive ? 'aktiivne' : 'keelatud',
          `viimati: ${u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : '–'}`
        ].join('  '));
      }
      if (users.length === 0) console.log('Platvormi kasutajaid pole.');
      break;
    }
    case 'passwd': {
      const user = await findUser(name);
      const passwordHash = await hashPassword(await askNewPassword());
      await prisma.platformUser.update({ where: { id: user.id }, data: { passwordHash } });
      const { count } = await prisma.platformSession.deleteMany({ where: { platformUserId: user.id } });
      console.log(`Parool muudetud, ${count} sessiooni lõpetatud.`);
      break;
    }
    case 'reset-totp': {
      const user = await findUser(name);
      const key = totpKey();
      const secret = generateTotpSecret();
      await prisma.platformUser.update({ where: { id: user.id }, data: { totpSecretEnc: encryptTotpSecret(secret, key), totpLastStep: 0 } });
      const { count } = await prisma.platformSession.deleteMany({ where: { platformUserId: user.id } });
      await prisma.platformAuditLog.create({ data: { action: 'PLATFORM_USER_RESET_TOTP', platformUserId: null, details: { username: user.username } } });
      console.log(`TOTP lähtestatud, ${count} sessiooni lõpetatud.`);
      printTotpSetup(user.username, secret);
      break;
    }
    case 'disable':
    case 'enable': {
      const user = await findUser(name);
      await prisma.platformUser.update({ where: { id: user.id }, data: { isActive: command === 'enable' } });
      if (command === 'disable') await prisma.platformSession.deleteMany({ where: { platformUserId: user.id } });
      console.log(`Platvormi kasutaja "${user.username}" ${command === 'enable' ? 'lubatud' : 'keelatud'}.`);
      break;
    }
    default:
      throw new Error('Kasutus: npm run platform -- <add|list|passwd|reset-totp|disable|enable> [nimi]');
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
