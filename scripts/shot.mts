// scripts/shot.mts — ekraanipildid visuaalseks kontrolliks (ainult serveris, kasutaja otsus 2026-11-15).
// Loob kasutajale 15-minutilise sessiooni, pildistab lehed heledas ja tumedas teemas ning kustutab sessiooni kohe.
// Kasutus: npx tsx scripts/shot.mts --user <e-post|kasutajanimi> [--out /tmp/shots] [--width 1440] [--height 900]
//          [--anon | --platform <kasutajanimi|*>] [--click "<css>"] [--do click:<css> --do key:Escape --do shot:nimi …] [--wait 800] <tee> …
// Brauser (Playwright Chromium) on paigaldatud eraldi kausta /home/debian/tools/shot, et projekti sõltuvused ei muutuks.
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const require = createRequire('/home/debian/tools/shot/package.json');
const { chromium } = require('playwright') as typeof import('playwright');

const args = process.argv.slice(2);
const opt = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const userArg = opt('user');
const platformArg = opt('platform');
const anonIdx = args.indexOf('--anon');
const anon = anonIdx !== -1;
if (anon) args.splice(anonIdx, 1);
const outDir = opt('out', '/tmp/shots')!;
const width = Number(opt('width', '1440'));
const height = Number(opt('height', '900'));
const clickSel = opt('click');
const waitMs = Number(opt('wait', '800'));
// --do võib korduda; tegevused tehakse järjest pärast lehe laadimist (ja --click-i):
//   click:<css>  click-at:<x>,<y>  hover-at:<x>,<y>  rightclick:<css>  rightclick-at:<x>,<y>  hover:<css>  key:<Klahv>  wait:<ms>  shot:<nimi> (vahepilt)
//   eval:<js-avaldis> (prindib tulemuse, nt arvutatud stiilid)
const steps: string[] = [];
for (let s = opt('do'); s !== undefined; s = opt('do')) steps.push(s);
const paths = args.length ? args : ['/ui'];
// --platform: teenusepakkuja admin (admin.teris.ee) — server tunneb selle ära Host-päise järgi.
// Rakendus kuulab ainult lihtsat http-d (TLS lõpetab nginx), seega host-resolver-rules ei sobi; kasutame avalikku aadressi (serverist 200).
const platformHost = process.env.PLATFORM_HOST ?? 'admin.teris.ee';
const base = platformArg ? `https://${platformHost}` : `http://127.0.0.1:${process.env.PORT ?? '8820'}`;

if (!userArg && !platformArg && !anon) {
  console.error('Puudub --user <e-post|kasutajanimi>, --platform <kasutajanimi|*> või --anon');
  process.exit(1);
}
const url = process.env.PLATFORM_DATABASE_URL;
if (!url) {
  console.error('PLATFORM_DATABASE_URL puudub');
  process.exit(1);
}

const db = new PrismaClient({ datasources: { db: { url } } });
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
let cookieName = 'teris_session';
let removeSession = async () => {};
if (platformArg && !anon) {
  const pu = await db.platformUser.findFirst({
    where: { isActive: true, ...(platformArg === '*' ? {} : { username: platformArg.toLowerCase() }) },
  });
  if (!pu) {
    console.error(`Aktiivset teenusepakkuja kasutajat ${platformArg} ei leitud`);
    await db.$disconnect();
    process.exit(1);
  }
  const ps = await db.platformSession.create({
    data: { platformUserId: pu.id, tokenHash, expiresAt, userAgent: 'teris-shot (visuaalne kontroll)' },
  });
  cookieName = '__Host-teris_platform_session';
  removeSession = async () => {
    await db.platformSession.delete({ where: { id: ps.id } }).catch(() => {});
  };
} else if (!anon) {
  const user = await db.user.findFirst({ where: { OR: [{ email: userArg }, { username: userArg }], isActive: true } });
  if (!user) {
    console.error(`Aktiivset kasutajat ${userArg} ei leitud`);
    await db.$disconnect();
    process.exit(1);
  }
  const session = await db.session.create({
    data: { userId: user.id, tokenHash, expiresAt, userAgent: 'teris-shot (visuaalne kontroll)' },
  });
  removeSession = async () => {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
  };
}

mkdirSync(outDir, { recursive: true });
let browser: import('playwright').Browser | undefined;
try {
  browser = await chromium.launch();
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    if (!anon) await ctx.addCookies([{ name: cookieName, value: token, url: base, secure: base.startsWith('https') }]);
    await ctx.addInitScript((t) => {
      localStorage.setItem('agrimap_theme', t);
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    const page = await ctx.newPage();
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      if (clickSel) await page.click(clickSel);
      const stem = p.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root';
      for (const step of steps) {
        const i = step.indexOf(':');
        const kind = i === -1 ? step : step.slice(0, i);
        const arg = i === -1 ? '' : step.slice(i + 1);
        if (kind === 'click') await page.click(arg);
        else if (kind === 'rightclick') await page.click(arg, { button: 'right' });
        else if (kind === 'rightclick-at') {
          const [x, y] = arg.split(',').map(Number);
          await page.mouse.click(x, y, { button: 'right' });
        } else if (kind === 'click-at' || kind === 'hover-at') {
          const [x, y] = arg.split(',').map(Number);
          if (kind === 'click-at') await page.mouse.click(x, y);
          else await page.mouse.move(x, y);
        } else if (kind === 'hover') await page.hover(arg);
        else if (kind === 'key') await page.keyboard.press(arg);
        else if (kind === 'wait') await page.waitForTimeout(Number(arg));
        else if (kind === 'eval') console.log(`eval(${theme}):`, JSON.stringify(await page.evaluate(arg)));
        else if (kind === 'shot') {
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${outDir}/${stem}-${arg}-${theme}.png`, fullPage: true });
          console.log(`${outDir}/${stem}-${arg}-${theme}.png`);
        } else throw new Error(`Tundmatu --do: ${step}`);
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(waitMs);
      const name = `${stem}-${theme}.png`;
      await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
      console.log(`${outDir}/${name}`);
    }
    await ctx.close();
  }
} finally {
  await browser?.close();
  await removeSession();
  await db.$disconnect();
}
