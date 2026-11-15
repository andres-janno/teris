// scripts/shot.mts — ekraanipildid visuaalseks kontrolliks (ainult serveris, kasutaja otsus 2026-11-15).
// Loob kasutajale 15-minutilise sessiooni, pildistab lehed heledas ja tumedas teemas ning kustutab sessiooni kohe.
// Kasutus: npx tsx scripts/shot.mts --user <e-post|kasutajanimi> [--out /tmp/shots] [--width 1440] [--height 900]
//          [--click "<css>"] [--do click:<css> --do key:Escape --do shot:nimi …] [--wait 800] <tee> …
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
const outDir = opt('out', '/tmp/shots')!;
const width = Number(opt('width', '1440'));
const height = Number(opt('height', '900'));
const clickSel = opt('click');
const waitMs = Number(opt('wait', '800'));
// --do võib korduda; tegevused tehakse järjest pärast lehe laadimist (ja --click-i):
//   click:<css>  click-at:<x>,<y>  hover-at:<x>,<y>  rightclick:<css>  rightclick-at:<x>,<y>  hover:<css>  key:<Klahv>  wait:<ms>  shot:<nimi> (vahepilt)
const steps: string[] = [];
for (let s = opt('do'); s !== undefined; s = opt('do')) steps.push(s);
const paths = args.length ? args : ['/ui'];
const base = `http://127.0.0.1:${process.env.PORT ?? '8820'}`;

if (!userArg) {
  console.error('Puudub --user <e-post|kasutajanimi>');
  process.exit(1);
}
const url = process.env.PLATFORM_DATABASE_URL;
if (!url) {
  console.error('PLATFORM_DATABASE_URL puudub');
  process.exit(1);
}

const db = new PrismaClient({ datasources: { db: { url } } });
const user = await db.user.findFirst({ where: { OR: [{ email: userArg }, { username: userArg }], isActive: true } });
if (!user) {
  console.error(`Aktiivset kasutajat ${userArg} ei leitud`);
  await db.$disconnect();
  process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const session = await db.session.create({
  data: {
    userId: user.id,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    userAgent: 'teris-shot (visuaalne kontroll)',
  },
});

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: 'teris_session', value: token, url: base }]);
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
        } else if (kind === 'hover') await page.hover(arg);
        else if (kind === 'key') await page.keyboard.press(arg);
        else if (kind === 'wait') await page.waitForTimeout(Number(arg));
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
  await browser.close();
  await db.session.delete({ where: { id: session.id } }).catch(() => {});
  await db.$disconnect();
}
