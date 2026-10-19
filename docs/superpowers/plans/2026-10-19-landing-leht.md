# Avalik landing-leht, mõõtmine ja AI-valmidus — implementatsiooniplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `teris.ee/` näitab sisselogimata külastajale serveris valmis renderdatud turunduslehte („Tunnen huvi“ vormiga), sisselogimine kolib `/login`-ile, külastusi ja AI-roomajaid mõõdetakse oma serveris ning admin.teris.ee näitab statistikat ja huvilisi.

**Architecture:** `landing.html` ja `privacy.html` on Vite'i lisasisendid; nende sisu genereeritakse ehitusel `src/landing/content.et.ts`-ist (HTML, JSON-LD, `llms.txt`, `robots.txt`, `sitemap.xml`). `prod.ts` otsustab `/` puhul sessiooniküpsise järgi, kas serveerida rakendus või landing, ja logib landing'u päringud. Avalikud `/api/landing/*` otspunktid (beacon, huvivorm) on enne sessiooni nõuet; statistika ja huviliste haldus on platvormi API-s.

**Tech Stack:** Node `node:http`, Prisma 6 + PostgreSQL, Vite 8 (rolldown), React 19 (ainult admin), vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-landing-leht-design.md`

## Global Constraints

- Koodi identifikaatorid (URL-id, HTML `id`/`class`, CSS, sündmuste/staatuste väärtused, failinimed) on **inglise keeles**; kommentaarid ja kasutajale nähtav tekst eesti keeles.
- Teed: `/login`, `/privacy`, `/support` (alias `/tugi`), `/set-password` (alias `/parool`), ankur `#interest`.
- Kuupäevad UI-s `pp.kk.aaaa HH:MM` Tallinna ajas; kuupäevaväljad `DateInput` komponendiga, mitte `type="date"`.
- Peamine nupp: **„Tunnen huvi“**; hindu ei näidata.
- IP-d ei salvestata kuhugi; `visitorHash` = sha256(päevasool + IP + UA) esimesed 16 hex-märki, sool ainult mälus.
- Säilitamine: `landing_events` 13 kuud; `CLOSED` huvilised 24 kuud pärast `closedAt`.
- Uued tabelid on platvormi tabelid: ainult `authDb()` kaudu, õigused ainult `teris_platform` rollile.
- Kõik `npm`/`npx` käsud käivitatakse serveris. Lühend **`srv <käsk>`** tähendab:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Failid on kohalikus kaustas sshfs-mountina (sama kaust).
- Testid jooksevad live-andmebaasi vastu (nagu `supportGrants.test.ts`): testiread märgistatakse unikaalse `process.pid`-põhise väärtusega ja kustutatakse `afterAll`-is.
- Commit'i ainult nimetatud failid (`git add <failid>`), mitte `git add -A`. Commit-sõnumi lõppu:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Release'i (`npm run release`) ja `prisma db push`-i live'is teeb kasutaja ise (Task 12).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | mudelid `LandingEvent`, `InterestRequest`, enum `InterestStatus` |
| `scripts/tenancy/02-rls.sql`, `04-privileges.sql` | uute tabelite õigused ainult `teris_platform`-ile |
| `src/server/landing/botDetect.ts` | UA → `visitorClass`, `botName`, `device` |
| `src/server/landing/visitorHash.ts` | päevase soolaga külastaja räsi |
| `src/server/landing/requestMeta.ts` | päringust IP, UA, viitaja domeen, UTM |
| `src/server/landing/landingEvents.ts` | `recordHit`, beacon-otspunkt, säilitamise puhastus |
| `src/server/landing/interest.ts` | huvivormi valideerimine, spämmikaitse, salvestus, e-kiri |
| `src/server/landing/landingApi.ts` | `/api/landing/*` marsruutimine + Origin kontroll |
| `src/server/landing/landingRoute.ts` | `/`, `/login`, `/privacy`, `*.txt/xml` otsus (puhas funktsioon) |
| `src/server/landing/landingStats.ts` | statistika agregaadid admin-vaatele |
| `src/server/landing/interestAdmin.ts` | huviliste nimekiri, muutmine, kustutamine |
| `src/landing/content.et.ts` | kogu landing'u ja privaatsuslehe tekst |
| `src/landing/render.ts` | HTML-i, JSON-LD, `llms.txt`, `robots.txt`, `sitemap.xml` genereerimine |
| `src/landing/landingHtmlPlugin.ts` | Vite'i plugin: süstib HTML-i, emiteerib txt/xml failid, dev-middleware |
| `src/landing/landing.css`, `src/landing/landing.ts` | stiil; vorm ja beacon (ilma Reactita) |
| `landing.html`, `privacy.html` | Vite'i sisendid |
| `src/admin/LandingStatsView.tsx`, `src/admin/InterestView.tsx` | admin-vaated |

---

### Task 1: Andmemudel ja õigused

**Files:**
- Modify: `prisma/schema.prisma` (lõppu)
- Modify: `scripts/tenancy/04-privileges.sql`, `scripts/tenancy/02-rls.sql`

**Interfaces:**
- Produces: Prisma kliendis `authDb().landingEvent`, `authDb().interestRequest`, enum `InterestStatus` (`NEW` | `CONTACTED` | `CLOSED`).

- [ ] **Step 1: Lisa mudelid `prisma/schema.prisma` lõppu**

```prisma
// ============================================================================
// LANDING-LEHT — platvormi tabelid (ilma RLS-ita, ainult authDb())
// ============================================================================

// Landing'u külastuste mõõtmine. IP-d ei salvestata; visitorHash vahetub iga päev.
model LandingEvent {
  id           BigInt   @id @default(autoincrement())
  ts           DateTime @default(now())
  source       String // 'server' | 'beacon'
  event        String // 'hit' | 'view' | 'cta_click' | 'form_submit'
  target       String? // cta_click nupu tunnus
  path         String
  visitorClass String // 'human' | 'ai_bot' | 'search_bot' | 'other_bot'
  botName      String?
  referrerHost String?
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  device       String // 'desktop' | 'mobile' | 'tablet'
  visitorHash  String   @db.Char(16)

  @@index([ts])
  @@map("landing_events")
}

enum InterestStatus {
  NEW
  CONTACTED
  CLOSED
}

// „Tunnen huvi“ vormi päringud. IP-d ei salvestata.
model InterestRequest {
  id           String         @id @default(cuid())
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  name         String
  email        String
  company      String?
  phone        String?
  areaHa       Float?
  message      String?
  status       InterestStatus @default(NEW)
  notes        String?
  closedAt     DateTime?
  utmSource    String?
  referrerHost String?

  @@index([status])
  @@map("interest_requests")
}
```

- [ ] **Step 2: Lisa tabelid ja jada õiguste skriptidesse**

`scripts/tenancy/04-privileges.sql` mõlemas loendis (`REVOKE ALL ON … FROM teris_app;` ja `GRANT … TO teris_platform;`) lisa `help_articles` järele `, landing_events, interest_requests`. Faili lõppu (enne `-- NB:` rida):

```sql
REVOKE ALL ON SEQUENCE landing_events_id_seq FROM teris_app;
GRANT USAGE, SELECT ON SEQUENCE landing_events_id_seq TO teris_platform;
```

`scripts/tenancy/02-rls.sql` viimases `REVOKE ALL ON …` reas lisa samuti `, landing_events, interest_requests` ja faili lõppu:

```sql
REVOKE ALL ON SEQUENCE landing_events_id_seq FROM teris_app;
```

- [ ] **Step 3: Kontrolli skeemi ja genereeri klient (ilma andmebaasi muutmata)**

Run: `srv 'npx prisma validate && npx prisma generate'`
Expected: `The schema at prisma/schema.prisma is valid` ja `Generated Prisma Client`.

> NB: `prisma db push` live-andmebaasi on Task 12 osa (kasutaja). Testid alates Task 6-st vajavad tabeleid — enne Task 6 testide käivitamist küsi kasutajalt luba ja lase tal teha: varukoopia → `npx prisma db push` → `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/04-privileges.sql` (vt Task 12 sammud 1–2).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma scripts/tenancy/04-privileges.sql scripts/tenancy/02-rls.sql
git commit -m "Landing: LandingEvent ja InterestRequest mudelid, platvormi õigused"
```

---

### Task 2: Roboti ja seadme tuvastus

**Files:**
- Create: `src/server/landing/botDetect.ts`
- Test: `src/server/landing/botDetect.test.ts`

**Interfaces:**
- Produces:
  - `type VisitorClass = 'human' | 'ai_bot' | 'search_bot' | 'other_bot'`
  - `type Device = 'desktop' | 'mobile' | 'tablet'`
  - `classifyUserAgent(ua: string | undefined): { visitorClass: VisitorClass; botName: string | null }`
  - `detectDevice(ua: string | undefined): Device`

- [ ] **Step 1: Kirjuta failiv test**

```ts
// src/server/landing/botDetect.test.ts
import { describe, it, expect } from 'vitest';
import { classifyUserAgent, detectDevice } from './botDetect.ts';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

describe('classifyUserAgent', () => {
  it('tunneb AI-roomajad', () => {
    expect(classifyUserAgent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toEqual({ visitorClass: 'ai_bot', botName: 'GPTBot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toEqual({ visitorClass: 'ai_bot', botName: 'ClaudeBot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toEqual({ visitorClass: 'ai_bot', botName: 'PerplexityBot' });
    expect(classifyUserAgent('Mozilla/5.0 ChatGPT-User/1.0')).toEqual({ visitorClass: 'ai_bot', botName: 'ChatGPT-User' });
  });
  it('Applebot-Extended on AI, Applebot otsing', () => {
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Applebot-Extended/0.1)').botName).toBe('Applebot-Extended');
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Applebot/0.1)')).toEqual({ visitorClass: 'search_bot', botName: 'Applebot' });
  });
  it('tunneb otsingurobotid', () => {
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({ visitorClass: 'search_bot', botName: 'Googlebot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toEqual({ visitorClass: 'search_bot', botName: 'bingbot' });
  });
  it('muud robotid ja tühi UA', () => {
    expect(classifyUserAgent('curl/8.4.0')).toEqual({ visitorClass: 'other_bot', botName: null });
    expect(classifyUserAgent('SomeCrawler/1.0')).toEqual({ visitorClass: 'other_bot', botName: null });
    expect(classifyUserAgent('')).toEqual({ visitorClass: 'other_bot', botName: null });
    expect(classifyUserAgent(undefined)).toEqual({ visitorClass: 'other_bot', botName: null });
  });
  it('inimese brauserid', () => {
    for (const ua of [CHROME, IPHONE, IPAD, ANDROID_PHONE]) expect(classifyUserAgent(ua)).toEqual({ visitorClass: 'human', botName: null });
  });
});

describe('detectDevice', () => {
  it('eristab seadmed', () => {
    expect(detectDevice(CHROME)).toBe('desktop');
    expect(detectDevice(IPHONE)).toBe('mobile');
    expect(detectDevice(ANDROID_PHONE)).toBe('mobile');
    expect(detectDevice(IPAD)).toBe('tablet');
    expect(detectDevice(ANDROID_TABLET)).toBe('tablet');
    expect(detectDevice(undefined)).toBe('desktop');
  });
});
```

- [ ] **Step 2: Käivita test — peab kukkuma**

Run: `srv 'npx vitest run src/server/landing/botDetect.test.ts'`
Expected: FAIL (`Failed to resolve import "./botDetect.ts"`).

- [ ] **Step 3: Implementeeri**

```ts
// src/server/landing/botDetect.ts — User-Agent → külastaja klass, roboti nimi ja seadme tüüp.
export type VisitorClass = 'human' | 'ai_bot' | 'search_bot' | 'other_bot';
export type Device = 'desktop' | 'mobile' | 'tablet';

// AI enne otsingut: „Applebot-Extended“ sisaldab „Applebot“-i.
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'CCBot', 'Bytespider', 'Amazonbot', 'meta-externalagent',
  'DuckAssistBot', 'Applebot-Extended', 'cohere-ai', 'Google-CloudVertexBot'
];
const SEARCH_BOTS = ['Googlebot', 'bingbot', 'Applebot', 'YandexBot', 'DuckDuckBot', 'Baiduspider'];
const OTHER_BOT = /bot|crawler|spider|curl|wget|python-requests|headless/i;

const findName = (ua: string, names: string[]) => names.find((n) => ua.includes(n.toLowerCase())) ?? null;

export function classifyUserAgent(ua: string | undefined): { visitorClass: VisitorClass; botName: string | null } {
  const lower = (ua ?? '').toLowerCase();
  if (!lower.trim()) return { visitorClass: 'other_bot', botName: null };
  const ai = findName(lower, AI_BOTS);
  if (ai) return { visitorClass: 'ai_bot', botName: ai };
  const search = findName(lower, SEARCH_BOTS);
  if (search) return { visitorClass: 'search_bot', botName: search };
  if (OTHER_BOT.test(lower)) return { visitorClass: 'other_bot', botName: null };
  return { visitorClass: 'human', botName: null };
}

export function detectDevice(ua: string | undefined): Device {
  const s = ua ?? '';
  if (/iPad|Tablet/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(s)) return 'mobile';
  return 'desktop';
}
```

- [ ] **Step 4: Käivita test — peab läbima**

Run: `srv 'npx vitest run src/server/landing/botDetect.test.ts'`
Expected: PASS (6 testi).

- [ ] **Step 5: Commit**

```bash
git add src/server/landing/botDetect.ts src/server/landing/botDetect.test.ts
git commit -m "Landing: roboti ja seadme tuvastus User-Agenti järgi"
```

---

### Task 3: Külastaja räsi ja päringu metaandmed

**Files:**
- Create: `src/server/landing/visitorHash.ts`, `src/server/landing/requestMeta.ts`
- Test: `src/server/landing/visitorHash.test.ts`, `src/server/landing/requestMeta.test.ts`

**Interfaces:**
- Consumes: `tallinnToday(now: Date): string` (`src/server/license.ts`), `clientIpFrom` (`src/server/auth.ts`).
- Produces:
  - `createVisitorHasher(now?: () => Date, random?: () => Buffer): (ip: string, ua: string) => string`
  - `visitorHashOf(ip: string, ua: string): string` (protsessi ühine hasher)
  - `referrerHostOf(raw: string | null | undefined, ownHosts?: string[]): string | null`
  - `clip(v: unknown, max: number): string | null`
  - `requestMeta(req: IncomingMessage): { ip: string; ua: string; referrerHost: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }`
  - `OWN_HOSTS: string[]`

- [ ] **Step 1: Kirjuta failivad testid**

```ts
// src/server/landing/visitorHash.test.ts
import { describe, it, expect } from 'vitest';
import { createVisitorHasher } from './visitorHash.ts';

describe('createVisitorHasher', () => {
  it('stabiilne päeva sees, uus sool järgmisel Tallinna päeval', () => {
    let now = new Date('2026-10-19T10:00:00Z');
    let n = 0;
    const hash = createVisitorHasher(() => now, () => Buffer.alloc(32, ++n));
    const a = hash('1.2.3.4', 'UA');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hash('1.2.3.4', 'UA')).toBe(a);
    expect(hash('1.2.3.5', 'UA')).not.toBe(a);
    now = new Date('2026-10-19T20:59:00Z'); // Tallinnas 23:59
    expect(hash('1.2.3.4', 'UA')).toBe(a);
    now = new Date('2026-10-19T21:01:00Z'); // Tallinnas järgmine päev
    expect(hash('1.2.3.4', 'UA')).not.toBe(a);
  });
  it('räsi ei sisalda IP-d', () => {
    const hash = createVisitorHasher(() => new Date(), () => Buffer.alloc(32, 7));
    expect(hash('10.0.0.1', 'UA')).not.toContain('10.0.0.1');
  });
});
```

```ts
// src/server/landing/requestMeta.test.ts
import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'http';
import { referrerHostOf, clip, requestMeta } from './requestMeta.ts';

describe('referrerHostOf', () => {
  it('jätab ainult domeeni, oma domeen → null', () => {
    expect(referrerHostOf('https://www.google.com/search?q=teris')).toBe('google.com');
    expect(referrerHostOf('https://chatgpt.com/c/123')).toBe('chatgpt.com');
    expect(referrerHostOf('https://teris.ee/privacy')).toBeNull();
    expect(referrerHostOf('https://www.teris.ee/')).toBeNull();
    expect(referrerHostOf('not a url')).toBeNull();
    expect(referrerHostOf('')).toBeNull();
    expect(referrerHostOf(undefined)).toBeNull();
  });
});

describe('clip', () => {
  it('lõikab ja tühjendab', () => {
    expect(clip('  abc  ', 2)).toBe('ab');
    expect(clip('', 10)).toBeNull();
    expect(clip(42, 10)).toBeNull();
  });
});

describe('requestMeta', () => {
  it('loeb IP, UA, viitaja ja UTM-i', () => {
    const req = {
      url: '/?utm_source=facebook&utm_medium=social&utm_campaign=sygis',
      headers: { 'user-agent': 'UA', referer: 'https://www.facebook.com/x', 'x-forwarded-for': '9.9.9.9' },
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as IncomingMessage;
    expect(requestMeta(req)).toEqual({
      ip: '9.9.9.9', ua: 'UA', referrerHost: 'facebook.com', utmSource: 'facebook', utmMedium: 'social', utmCampaign: 'sygis'
    });
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `srv 'npx vitest run src/server/landing/visitorHash.test.ts src/server/landing/requestMeta.test.ts'`
Expected: FAIL (moodulid puuduvad).

- [ ] **Step 3: Implementeeri**

```ts
// src/server/landing/visitorHash.ts — unikaalsete külastajate loendamine ilma IP-d salvestamata.
// Sool on ainult mälus ja vahetub Tallinna kesköö ületamisel: eri päevade külastusi ei saa siduda.
import { createHash, randomBytes } from 'node:crypto';
import { tallinnToday } from '../license.ts';

export function createVisitorHasher(now: () => Date = () => new Date(), random: () => Buffer = () => randomBytes(32)) {
  let day = '';
  let salt = Buffer.alloc(0);
  return (ip: string, ua: string): string => {
    const today = tallinnToday(now());
    if (today !== day) {
      day = today;
      salt = random();
    }
    return createHash('sha256').update(salt).update(ip).update('\n').update(ua).digest('hex').slice(0, 16);
  };
}

const shared = createVisitorHasher();
export const visitorHashOf = (ip: string, ua: string): string => shared(ip, ua);
```

```ts
// src/server/landing/requestMeta.ts — landing'u päringu metaandmed (IP ainult räsi jaoks, mitte salvestamiseks).
import type { IncomingMessage } from 'http';
import { clientIpFrom } from '../auth.ts';

export const OWN_HOSTS = ['teris.ee', 'admin.teris.ee', 'localhost', '127.0.0.1'];

export function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

export function referrerHostOf(raw: string | null | undefined, ownHosts: string[] = OWN_HOSTS): string | null {
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  return !host || ownHosts.includes(host) ? null : host.slice(0, 100);
}

export function requestMeta(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'http://localhost');
  const referer = req.headers.referer;
  return {
    ip: clientIpFrom(req.headers['x-forwarded-for'], req.socket?.remoteAddress),
    ua: String(req.headers['user-agent'] ?? '').slice(0, 512),
    referrerHost: referrerHostOf(typeof referer === 'string' ? referer : null),
    utmSource: clip(url.searchParams.get('utm_source'), 100),
    utmMedium: clip(url.searchParams.get('utm_medium'), 100),
    utmCampaign: clip(url.searchParams.get('utm_campaign'), 100)
  };
}
```

- [ ] **Step 4: Käivita — peab läbima**

Run: `srv 'npx vitest run src/server/landing/visitorHash.test.ts src/server/landing/requestMeta.test.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/landing/visitorHash.ts src/server/landing/visitorHash.test.ts src/server/landing/requestMeta.ts src/server/landing/requestMeta.test.ts
git commit -m "Landing: päevase soolaga külastaja räsi ja päringu metaandmed"
```

---

### Task 4: Sisu ja renderdamine (HTML, JSON-LD, llms.txt, robots, sitemap)

**Files:**
- Create: `src/landing/content.et.ts`, `src/landing/render.ts`
- Test: `src/landing/render.test.ts`

**Interfaces:**
- Consumes: `COPYRIGHT_TEXT` (`src/copyright.ts`).
- Produces:
  - `type LandingContent` ja `CONTENT_ET: LandingContent`
  - `CTA_TARGETS = ['header', 'header-login', 'hero', 'steps', 'footer'] as const`
  - `renderLandingHead(c)`, `renderLandingBody(c)`, `renderPrivacyHead(c)`, `renderPrivacyBody(c)`, `renderLlmsTxt(c)`, `renderRobotsTxt(siteUrl)`, `renderSitemap(siteUrl)`, `buildJsonLd(c): object[]` — kõik tagastavad `string` (v.a `buildJsonLd`).

- [ ] **Step 1: Loo sisufail**

Tekstid on mustand, kasutaja toimetab need Task 12-s. Väited peavad vastama rakenduse tegelikele võimalustele.

```ts
// src/landing/content.et.ts — landing'u ja privaatsuslehe kogu tekst (eesti keel).
// HTML, JSON-LD (FAQPage) ja llms.txt genereeritakse sellest, et need ei läheks lahku.
import { COPYRIGHT_TEXT } from '../copyright.ts';

export const CTA_TARGETS = ['header', 'header-login', 'hero', 'steps', 'footer'] as const;
export type CtaTarget = (typeof CTA_TARGETS)[number];

export interface LandingContent {
  lang: 'et';
  siteUrl: string;
  name: string;
  title: string;
  description: string;
  ogImage: string;
  organization: { name: string; email: string };
  nav: { features: string; audience: string; faq: string; login: string; cta: string };
  hero: { headline: string; lead: string; cta: string; imageAlt: string; image: string };
  featuresTitle: string;
  features: { id: string; title: string; text: string }[];
  audienceTitle: string;
  audience: { title: string; text: string }[];
  stepsTitle: string;
  steps: { title: string; text: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  interest: {
    title: string;
    lead: string;
    labels: { name: string; email: string; company: string; phone: string; areaHa: string; message: string };
    submit: string;
    sending: string;
    privacyNote: string;
    success: string;
    error: string;
  };
  footer: { copyright: string; privacy: string };
  privacy: { title: string; updated: string; sections: { title: string; paragraphs: string[] }[] };
}

export const CONTENT_ET: LandingContent = {
  lang: 'et',
  siteUrl: 'https://teris.ee',
  name: 'Teris',
  title: 'Teris — teraviljakasvataja põllud, masinad ja põlluraamat ühel kaardil',
  description:
    'Teris on Eesti teraviljakasvatajale mõeldud veebirakendus: PRIA põllud ja külvikord, masinapargi GPS-telemeetria, põllutööde planeerimine, põlluraamat, mullaproovid, ilmaradar ja satelliidipildid ühes kohas.',
  ogImage: '/og-teris.png',
  organization: { name: 'VentCap OÜ', email: 'info@teris.ee' },
  nav: { features: 'Võimalused', audience: 'Kellele', faq: 'KKK', login: 'Logi sisse', cta: 'Tunnen huvi' },
  hero: {
    headline: 'Põllud, masinad ja põlluraamat ühel kaardil',
    lead: 'Teris koondab teraviljakasvataja igapäevase info — PRIA põllud, külvikorra, masinate liikumise ja tehtud tööd — ühte veebirakendusse, mis töötab kontoris ja põllul.',
    cta: 'Tunnen huvi',
    imageAlt: 'Terise kaardivaade: põllud Maa-ameti aluskaardil, külvikord värvidega ja masinate asukohad',
    image: '/landing/hero.webp'
  },
  featuresTitle: 'Mida Teris teeb',
  features: [
    { id: 'fields', title: 'PRIA põllud ja külvikord', text: 'Impordi põllud PRIA SHP-failist, vaata külvikorda hooaegade kaupa ja põlluplokke Maa-ameti aluskaartidel.' },
    { id: 'fleet', title: 'Masinapark ja GPS-telemeetria', text: 'Traktorite ja haakeriistade asukoht ning liikumise ajalugu kaardil (Teltonika seadmed), harimise jäljed põllu kaupa.' },
    { id: 'field-works', title: 'Põllutööde tahvel', text: 'Planeeri tööd kultuuri ja töömallide järgi, märgi tehtud tööd ja näe, mis on igal põllul veel tegemata.' },
    { id: 'field-book', title: 'Põlluraamat', text: 'Impordi olemasolev põlluraamat ja pea tööde, väetiste ja taimekaitse arvestust ühes kohas.' },
    { id: 'soil', title: 'Mullaproovid', text: 'Laadi üles mullaproovide tulemused ja vaata neid põllu juures.' },
    { id: 'satellite', title: 'Satelliidipildid ja NDVI', text: 'Sentinel-2 satelliidipiltide põhjal taimiku seisund (NDVI) põllu kaupa, pilvisuse kontrolliga.' },
    { id: 'weather', title: 'Ilmaradar', text: 'Sademete radar otse põllukaardil, et tööd paremini ajastada.' },
    { id: 'team', title: 'Meeskond ja partnerid', text: 'Mitu kasutajat rollidega, seotud isikute register ning ajutine ainult lugemiseks ligipääs nõustajale.' }
  ],
  audienceTitle: 'Kellele',
  audience: [
    { title: 'Teraviljakasvatajad', text: 'Väikesest pereettevõttest suure tootjani — kõik põllud, masinad ja tööd ühes vaates.' },
    { title: 'Nõustajad ja teenusepakkujad', text: 'Kliendi loal ajutine ligipääs tema andmetele, ilma paroole jagamata.' }
  ],
  stepsTitle: 'Kuidas alustada',
  steps: [
    { title: 'Anna teada', text: 'Täida „Tunnen huvi“ vorm — see ei kohusta sind millekski.' },
    { title: 'Seadistame koos', text: 'Loome sinu ettevõtte keskkonna ja impordime põllud PRIA andmetest.' },
    { title: 'Alusta', text: 'Logi sisse ja kutsu meeskond — Teris töötab brauseris, eraldi programmi pole vaja paigaldada.' }
  ],
  faqTitle: 'Korduma kippuvad küsimused',
  faq: [
    { q: 'Kus minu andmeid hoitakse?', a: 'Andmed asuvad Eestis asuvas serveris. Iga ettevõtte andmed on teistest eraldatud ning teised ettevõtted neid ei näe.' },
    { q: 'Kas teenusepakkuja näeb minu andmeid?', a: 'Ainult siis, kui sinu ettevõtte admin annab selleks ajutise loa. Ligipääs on ainult lugemiseks ja iga sisenemine on sulle nähtav.' },
    { q: 'Kuidas põllud Terisesse saavad?', a: 'Põllud imporditakse PRIA põllumassiivide SHP-failist. Hiljem saab põlde ka käsitsi muuta.' },
    { q: 'Milliseid masinaid saab jälgida?', a: 'Teris toetab Teltonika GPS-seadmeid ja EYE Sensor andureid. Küsi meilt, kui sul on muu seade.' },
    { q: 'Kas Teris töötab telefonis?', a: 'Teris on veebirakendus ja avaneb brauseris nii arvutis, tahvlis kui telefonis.' },
    { q: 'Mis Teris maksab?', a: 'Hind sõltub ettevõtte suurusest ja vajalikest moodulitest. Anna „Tunnen huvi“ vormiga teada ja räägime läbi.' }
  ],
  interest: {
    title: 'Anna teada, kui Teris sind huvitab — võtame ühendust',
    lead: 'Kohustusteta. Räägime läbi, mida su ettevõte vajab, ja näitame Terist sinu põldude peal.',
    labels: { name: 'Nimi', email: 'E-post', company: 'Ettevõte', phone: 'Telefon', areaHa: 'Põllupind (ha)', message: 'Mis sind huvitab?' },
    submit: 'Tunnen huvi',
    sending: 'Saadan…',
    privacyNote: 'Kasutame andmeid ainult sinuga ühenduse võtmiseks.',
    success: 'Aitäh! Võtame peagi ühendust.',
    error: 'Saatmine ebaõnnestus, proovi hiljem uuesti.'
  },
  footer: { copyright: COPYRIGHT_TEXT, privacy: 'Privaatsus' },
  privacy: {
    title: 'Privaatsusteade',
    updated: '19.10.2026',
    sections: [
      { title: 'Vastutav töötleja', paragraphs: ['VentCap OÜ, e-post info@teris.ee.'] },
      {
        title: '„Tunnen huvi“ vorm',
        paragraphs: [
          'Vormi kaudu saadetud andmeid (nimi, e-post ning soovi korral ettevõte, telefon, põllupind ja sõnum) kasutame ainult sinuga ühenduse võtmiseks ja Terise tutvustamiseks. Õiguslik alus on sinu päringule vastamine.',
          'Kui kliendisuhet ei teki, kustutame päringu hiljemalt 24 kuud pärast selle lõpetamist. Võid igal ajal paluda oma andmed kustutada, kirjutades info@teris.ee.'
        ]
      },
      {
        title: 'Külastuste statistika',
        paragraphs: [
          'Loendame lehe külastusi oma serveris ilma küpsisteta ja kolmandate osapoolteta. IP-aadresse ei salvestata; unikaalsete külastajate loendamiseks kasutame igapäevaselt vahetuvat räsi, mille abil ei saa sind eri päevadel ära tunda.',
          'Statistikat hoitakse 13 kuud.'
        ]
      }
    ]
  }
};
```

- [ ] **Step 2: Kirjuta failiv test**

```ts
// src/landing/render.test.ts
import { describe, it, expect } from 'vitest';
import { CONTENT_ET } from './content.et.ts';
import { renderLandingHead, renderLandingBody, renderPrivacyBody, renderLlmsTxt, renderRobotsTxt, renderSitemap, buildJsonLd, escapeHtml } from './render.ts';

const c = CONTENT_ET;

describe('renderLandingBody', () => {
  const html = renderLandingBody(c);
  it('sisaldab ilma JS-ita kõiki sektsioone ja ühte h1-te', () => {
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
    for (const t of [c.hero.headline, c.featuresTitle, c.audienceTitle, c.stepsTitle, c.faqTitle, c.interest.title]) expect(html).toContain(escapeHtml(t));
    for (const f of c.features) expect(html).toContain(escapeHtml(f.title));
    for (const q of c.faq) expect(html).toContain(escapeHtml(q.q));
  });
  it('vorm, ankrud ja CTA märgised', () => {
    expect(html).toContain('id="interest"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('name="website"'); // honeypot
    for (const t of ['header', 'hero', 'steps', 'footer']) expect(html).toContain(`data-cta="${t}"`);
  });
});

describe('JSON-LD', () => {
  it('kehtiv JSON õigete tüüpidega; FAQPage = nähtav KKK', () => {
    const ld = buildJsonLd(c) as any[];
    expect(ld.map((x) => x['@type'])).toEqual(['SoftwareApplication', 'Organization', 'FAQPage']);
    expect(ld[2].mainEntity.map((e: any) => e.name)).toEqual(c.faq.map((f) => f.q));
    const head = renderLandingHead(c);
    const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1])).toHaveLength(3);
  });
  it('head: title, description, canonical, OG', () => {
    const head = renderLandingHead(c);
    expect(head).toContain(`<title>${escapeHtml(c.title)}</title>`);
    expect(head).toContain('<link rel="canonical" href="https://teris.ee/" />');
    expect(head).toContain('property="og:image" content="https://teris.ee/og-teris.png"');
  });
});

describe('masinloetavad failid', () => {
  it('robots.txt ei keela avalehte, keelab api ja login', () => {
    const r = renderRobotsTxt(c.siteUrl);
    expect(r).toContain('User-agent: *\nAllow: /\n');
    expect(r).not.toMatch(/^Disallow: \/$/m);
    for (const p of ['/api/', '/login', '/support', '/set-password', '/tugi', '/parool']) expect(r).toContain(`Disallow: ${p}\n`);
    expect(r).toContain('Sitemap: https://teris.ee/sitemap.xml');
  });
  it('sitemap sisaldab / ja /privacy', () => {
    const s = renderSitemap(c.siteUrl);
    expect(s).toContain('<loc>https://teris.ee/</loc>');
    expect(s).toContain('<loc>https://teris.ee/privacy</loc>');
  });
  it('llms.txt sisaldab kõiki võimalusi ja linke', () => {
    const t = renderLlmsTxt(c);
    expect(t.startsWith('# Teris\n')).toBe(true);
    for (const f of c.features) expect(t).toContain(f.title);
    expect(t).toContain('https://teris.ee/#interest');
  });
  it('privaatsusleht', () => {
    expect(renderPrivacyBody(c)).toContain(escapeHtml(c.privacy.title));
  });
});
```

- [ ] **Step 3: Käivita — peab kukkuma**

Run: `srv 'npx vitest run src/landing/render.test.ts'`
Expected: FAIL (`./render.ts` puudub).

- [ ] **Step 4: Implementeeri `src/landing/render.ts`**

```ts
// src/landing/render.ts — landing'u staatiline HTML, JSON-LD ja masinloetavad failid sisust.
// Kasutatakse ehitusel (landingHtmlPlugin.ts) — brauseris seda koodi ei jookse.
import type { LandingContent } from './content.et.ts';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const e = escapeHtml;
const abs = (c: LandingContent, p: string) => `${c.siteUrl}${p}`;

export function buildJsonLd(c: LandingContent): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: c.name,
      url: `${c.siteUrl}/`,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Farm management',
      operatingSystem: 'Web',
      inLanguage: c.lang,
      description: c.description,
      featureList: c.features.map((f) => f.title),
      publisher: { '@type': 'Organization', name: c.organization.name }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: c.organization.name,
      url: `${c.siteUrl}/`,
      logo: abs(c, '/teris-logo-color.svg'),
      email: c.organization.email
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    }
  ];
}

// </script> ei tohi JSON-i seest skripti sulgeda
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

function metaTags(c: LandingContent, title: string, description: string, path: string): string {
  return [
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}" />`,
    `<link rel="canonical" href="${e(abs(c, path))}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="et_EE" />`,
    `<meta property="og:site_name" content="${e(c.name)}" />`,
    `<meta property="og:title" content="${e(title)}" />`,
    `<meta property="og:description" content="${e(description)}" />`,
    `<meta property="og:url" content="${e(abs(c, path))}" />`,
    `<meta property="og:image" content="${e(abs(c, c.ogImage))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`
  ].join('\n    ');
}

export function renderLandingHead(c: LandingContent): string {
  return `${metaTags(c, c.title, c.description, '/')}
    <link rel="alternate" type="text/markdown" href="/llms.txt" title="llms.txt" />
    <script type="application/ld+json">${jsonForScript(buildJsonLd(c))}</script>`;
}

function header(c: LandingContent, home: boolean): string {
  const a = (hash: string) => (home ? hash : `/${hash}`);
  return `<header class="lp-header">
  <a class="lp-brand" href="/" aria-label="${e(c.name)}"><img src="/teris-horizontal-color.svg" alt="${e(c.name)}" width="132" height="32" /></a>
  <nav class="lp-nav" aria-label="Peamenüü">
    <a href="${a('#features')}">${e(c.nav.features)}</a>
    <a href="${a('#audience')}">${e(c.nav.audience)}</a>
    <a href="${a('#faq')}">${e(c.nav.faq)}</a>
  </nav>
  <div class="lp-header-actions">
    <a class="lp-btn lp-btn-ghost" href="/login" data-cta="header-login">${e(c.nav.login)}</a>
    <a class="lp-btn lp-btn-primary" href="${a('#interest')}" data-cta="header">${e(c.nav.cta)}</a>
  </div>
</header>`;
}

function footer(c: LandingContent): string {
  return `<footer class="lp-footer">
  <span>${e(c.footer.copyright)}</span>
  <a href="mailto:${e(c.organization.email)}">${e(c.organization.email)}</a>
  <a href="/privacy">${e(c.footer.privacy)}</a>
  <a class="lp-btn lp-btn-primary" href="/#interest" data-cta="footer">${e(c.nav.cta)}</a>
</footer>`;
}

export function renderLandingBody(c: LandingContent): string {
  const L = c.interest.labels;
  const field = (id: string, label: string, attrs: string) =>
    `<div class="lp-field"><label for="interest-${id}">${e(label)}</label><input id="interest-${id}" name="${id}" ${attrs} /></div>`;
  return `${header(c, true)}
<main>
  <section class="lp-hero" aria-labelledby="hero-title">
    <div class="lp-hero-text">
      <h1 id="hero-title">${e(c.hero.headline)}</h1>
      <p class="lp-lead">${e(c.hero.lead)}</p>
      <a class="lp-btn lp-btn-primary lp-btn-lg" href="#interest" data-cta="hero">${e(c.hero.cta)}</a>
    </div>
    <img class="lp-hero-image" src="${e(c.hero.image)}" alt="${e(c.hero.imageAlt)}" width="1200" height="750" />
  </section>

  <section id="features" class="lp-section" aria-labelledby="features-title">
    <h2 id="features-title">${e(c.featuresTitle)}</h2>
    <div class="lp-grid">
      ${c.features.map((f) => `<article class="lp-card" id="feature-${e(f.id)}"><h3>${e(f.title)}</h3><p>${e(f.text)}</p></article>`).join('\n      ')}
    </div>
  </section>

  <section id="audience" class="lp-section" aria-labelledby="audience-title">
    <h2 id="audience-title">${e(c.audienceTitle)}</h2>
    <div class="lp-grid lp-grid-2">
      ${c.audience.map((x) => `<article class="lp-card"><h3>${e(x.title)}</h3><p>${e(x.text)}</p></article>`).join('\n      ')}
    </div>
  </section>

  <section id="steps" class="lp-section" aria-labelledby="steps-title">
    <h2 id="steps-title">${e(c.stepsTitle)}</h2>
    <ol class="lp-steps">
      ${c.steps.map((s) => `<li><h3>${e(s.title)}</h3><p>${e(s.text)}</p></li>`).join('\n      ')}
    </ol>
    <a class="lp-btn lp-btn-primary" href="#interest" data-cta="steps">${e(c.nav.cta)}</a>
  </section>

  <section id="faq" class="lp-section" aria-labelledby="faq-title">
    <h2 id="faq-title">${e(c.faqTitle)}</h2>
    ${c.faq.map((f) => `<details class="lp-faq"><summary>${e(f.q)}</summary><p>${e(f.a)}</p></details>`).join('\n    ')}
  </section>

  <section id="interest" class="lp-section lp-interest" aria-labelledby="interest-title">
    <h2 id="interest-title">${e(c.interest.title)}</h2>
    <p class="lp-lead">${e(c.interest.lead)}</p>
    <form id="interest-form" class="lp-form" novalidate data-sending="${e(c.interest.sending)}" data-success="${e(c.interest.success)}" data-error="${e(c.interest.error)}">
      ${field('name', L.name + ' *', 'required maxlength="100" autocomplete="name"')}
      ${field('email', L.email + ' *', 'type="email" required maxlength="254" autocomplete="email"')}
      ${field('company', L.company, 'maxlength="100" autocomplete="organization"')}
      ${field('phone', L.phone, 'type="tel" maxlength="30" autocomplete="tel"')}
      ${field('areaHa', L.areaHa, 'inputmode="decimal" maxlength="10"')}
      <div class="lp-field lp-field-wide"><label for="interest-message">${e(L.message)}</label><textarea id="interest-message" name="message" maxlength="2000" rows="4"></textarea></div>
      <div class="lp-hp" aria-hidden="true"><label for="interest-website">Veebileht</label><input id="interest-website" name="website" tabindex="-1" autocomplete="off" /></div>
      <p class="lp-note lp-field-wide">${e(c.interest.privacyNote)} <a href="/privacy">${e(c.footer.privacy)}</a></p>
      <div class="lp-form-status lp-field-wide" role="status" aria-live="polite"></div>
      <button type="submit" class="lp-btn lp-btn-primary lp-btn-lg">${e(c.interest.submit)}</button>
    </form>
  </section>
</main>
${footer(c)}`;
}

export function renderPrivacyHead(c: LandingContent): string {
  return metaTags(c, `${c.privacy.title} — ${c.name}`, c.privacy.sections[1].paragraphs[0], '/privacy');
}

export function renderPrivacyBody(c: LandingContent): string {
  return `${header(c, false)}
<main class="lp-section lp-prose">
  <h1>${e(c.privacy.title)}</h1>
  <p class="lp-note">Uuendatud ${e(c.privacy.updated)}</p>
  ${c.privacy.sections.map((s) => `<h2>${e(s.title)}</h2>\n  ${s.paragraphs.map((p) => `<p>${e(p)}</p>`).join('\n  ')}`).join('\n  ')}
</main>
${footer(c)}`;
}

export function renderLlmsTxt(c: LandingContent): string {
  return [
    `# ${c.name}`,
    '',
    `> ${c.description}`,
    '',
    `${c.hero.lead}`,
    '',
    `## ${c.featuresTitle}`,
    '',
    ...c.features.map((f) => `- **${f.title}**: ${f.text}`),
    '',
    `## ${c.audienceTitle}`,
    '',
    ...c.audience.map((a) => `- **${a.title}**: ${a.text}`),
    '',
    `## ${c.faqTitle}`,
    '',
    ...c.faq.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## Lingid',
    '',
    `- [Avaleht](${c.siteUrl}/)`,
    `- [Tunnen huvi — kontaktvorm](${c.siteUrl}/#interest)`,
    `- [Privaatsusteade](${c.siteUrl}/privacy)`,
    `- Kontakt: ${c.organization.email}`,
    ''
  ].join('\n');
}

export function renderRobotsTxt(siteUrl: string): string {
  return ['User-agent: *', 'Allow: /', ...['/api/', '/login', '/support', '/set-password', '/tugi', '/parool'].map((p) => `Disallow: ${p}`), '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export function renderSitemap(siteUrl: string): string {
  const url = (p: string) => `  <url><loc>${siteUrl}${p}</loc></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${url('/')}
${url('/privacy')}
</urlset>
`;
}
```

- [ ] **Step 5: Käivita — peab läbima**

Run: `srv 'npx vitest run src/landing/render.test.ts'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/landing/content.et.ts src/landing/render.ts src/landing/render.test.ts
git commit -m "Landing: sisufail ja staatiline renderdamine (HTML, JSON-LD, llms.txt, robots, sitemap)"
```

---

### Task 5: Vite'i plugin, HTML-sisendid, stiil ja kliendi skript

**Files:**
- Create: `src/landing/landingHtmlPlugin.ts`, `landing.html`, `privacy.html`, `src/landing/landing.css`, `src/landing/landing.ts`
- Modify: `vite.config.ts`, `index.html`, `src/server/static.ts` (MIME)

**Interfaces:**
- Consumes: Task 4 render-funktsioonid, `CONTENT_ET`.
- Produces: `landingHtmlPlugin(): Plugin`; `dist/landing.html`, `dist/privacy.html`, `dist/llms.txt`, `dist/robots.txt`, `dist/sitemap.xml`. Klient saadab `POST /api/landing/event` kehaga `{ event, target?, path, referrer, utmSource, utmMedium, utmCampaign }` ja `POST /api/landing/interest` kehaga `{ name, email, company, phone, areaHa, message, website, elapsedMs, referrer, utmSource }`.

- [ ] **Step 1: Loo plugin**

```ts
// src/landing/landingHtmlPlugin.ts — süstib landing'u ja privaatsuslehe sisu HTML-i ehitusel ja
// arendusserveris ning emiteerib llms.txt, robots.txt ja sitemap.xml.
import type { Plugin } from 'vite';
import { CONTENT_ET } from './content.et.ts';
import { renderLandingHead, renderLandingBody, renderPrivacyHead, renderPrivacyBody, renderLlmsTxt, renderRobotsTxt, renderSitemap } from './render.ts';

const c = CONTENT_ET;
const TEXT_FILES: Record<string, { type: string; body: () => string }> = {
  'llms.txt': { type: 'text/plain; charset=utf-8', body: () => renderLlmsTxt(c) },
  'robots.txt': { type: 'text/plain; charset=utf-8', body: () => renderRobotsTxt(c.siteUrl) },
  'sitemap.xml': { type: 'application/xml; charset=utf-8', body: () => renderSitemap(c.siteUrl) }
};

export function landingHtmlPlugin(): Plugin {
  return {
    name: 'landing-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path.endsWith('/landing.html')) {
          return html.replace('<!--landing:head-->', renderLandingHead(c)).replace('<!--landing:body-->', renderLandingBody(c));
        }
        if (ctx.path.endsWith('/privacy.html')) {
          return html.replace('<!--privacy:head-->', renderPrivacyHead(c)).replace('<!--privacy:body-->', renderPrivacyBody(c));
        }
        return html;
      }
    },
    generateBundle() {
      for (const [fileName, f] of Object.entries(TEXT_FILES)) this.emitFile({ type: 'asset', fileName, source: f.body() });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const f = TEXT_FILES[(req.url ?? '').split('?')[0].replace(/^\//, '')];
        if (!f) return next();
        res.setHeader('Content-Type', f.type);
        res.end(f.body());
      });
    }
  };
}
```

- [ ] **Step 2: Loo HTML-sisendid**

```html
<!-- landing.html -->
<!doctype html>
<html lang="et">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
    <link rel="stylesheet" href="/src/landing/landing.css" />
    <!--landing:head-->
  </head>
  <body class="lp">
    <!--landing:body-->
    <script type="module" src="/src/landing/landing.ts"></script>
  </body>
</html>
```

```html
<!-- privacy.html -->
<!doctype html>
<html lang="et">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
    <link rel="stylesheet" href="/src/landing/landing.css" />
    <!--privacy:head-->
  </head>
  <body class="lp">
    <!--privacy:body-->
  </body>
</html>
```

- [ ] **Step 3: Loo stiil `src/landing/landing.css`**

Klassid algavad `lp-`, et mitte põrkuda rakenduse CSS-iga. Värvid `:root` tokenitena, tume teema `prefers-color-scheme` järgi.

```css
/* src/landing/landing.css — avaliku landing'u ja privaatsuslehe stiil (ilma Reactita). */
:root {
  --lp-bg: #f7f8f5;
  --lp-surface: #ffffff;
  --lp-text: #1d2a1f;
  --lp-muted: #556358;
  --lp-border: #dfe5dc;
  --lp-accent: #10b981;
  --lp-accent-strong: #0b8f63;
  --lp-accent-text: #ffffff;
  --lp-radius: 14px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --lp-bg: #0f1511;
    --lp-surface: #18211b;
    --lp-text: #e8efe9;
    --lp-muted: #a3b2a7;
    --lp-border: #2a362d;
    --lp-accent: #34d399;
    --lp-accent-strong: #10b981;
    --lp-accent-text: #062014;
  }
}
* { box-sizing: border-box; }
body.lp { margin: 0; background: var(--lp-bg); color: var(--lp-text); font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.lp h1, .lp h2, .lp h3 { font-family: 'Outfit', sans-serif; line-height: 1.15; margin: 0 0 0.5em; }
.lp h1 { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; }
.lp h2 { font-size: clamp(1.5rem, 3.5vw, 2.1rem); font-weight: 700; }
.lp h3 { font-size: 1.1rem; font-weight: 700; }
.lp a { color: var(--lp-accent-strong); }
.lp-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 24px; padding: 12px max(16px, calc((100% - 1120px) / 2)); background: color-mix(in srgb, var(--lp-bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--lp-border); }
.lp-brand img { display: block; height: 32px; width: auto; }
.lp-nav { display: flex; gap: 20px; margin-right: auto; }
.lp-nav a { color: var(--lp-muted); text-decoration: none; font-weight: 600; }
.lp-nav a:hover { color: var(--lp-text); }
.lp-header-actions { display: flex; gap: 8px; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 1px solid transparent; cursor: pointer; font: inherit; font-weight: 700; user-select: none; }
.lp-btn-primary { background: var(--lp-accent); color: var(--lp-accent-text); }
.lp-btn-primary:hover { background: var(--lp-accent-strong); }
.lp-btn-ghost { color: var(--lp-text); border-color: var(--lp-border); background: transparent; }
.lp-btn-lg { padding: 14px 26px; font-size: 1.05rem; }
.lp-btn:disabled { opacity: 0.6; cursor: default; }
.lp-hero, .lp-section { max-width: 1120px; margin: 0 auto; padding: 64px 16px; }
.lp-hero { display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; align-items: center; }
.lp-lead { font-size: 1.15rem; color: var(--lp-muted); margin: 0 0 24px; }
.lp-hero-image { width: 100%; height: auto; border-radius: var(--lp-radius); border: 1px solid var(--lp-border); box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.35); }
.lp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.lp-grid-2 { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.lp-card { background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: var(--lp-radius); padding: 20px; }
.lp-card p { margin: 0; color: var(--lp-muted); }
.lp-steps { list-style: none; counter-reset: step; padding: 0; margin: 0 0 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.lp-steps li { counter-increment: step; background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: var(--lp-radius); padding: 20px; }
.lp-steps li::before { content: counter(step); display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border-radius: 50%; background: var(--lp-accent); color: var(--lp-accent-text); font-weight: 800; margin-bottom: 8px; }
.lp-steps p { margin: 0; color: var(--lp-muted); }
.lp-faq { background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: var(--lp-radius); padding: 14px 18px; margin-bottom: 8px; }
.lp-faq summary { cursor: pointer; font-weight: 700; }
.lp-faq p { margin: 8px 0 0; color: var(--lp-muted); }
.lp-interest { background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: var(--lp-radius); margin-bottom: 48px; padding: 40px 24px; }
.lp-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; max-width: 760px; }
.lp-field { display: flex; flex-direction: column; gap: 4px; }
.lp-field-wide { grid-column: 1 / -1; }
.lp-field label { font-weight: 600; font-size: 0.9rem; }
.lp-field input, .lp-field textarea { font: inherit; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--lp-border); background: var(--lp-bg); color: var(--lp-text); }
.lp-field input:focus, .lp-field textarea:focus { outline: 2px solid var(--lp-accent); outline-offset: 1px; }
.lp-hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.lp-note { color: var(--lp-muted); font-size: 0.9rem; margin: 0; }
.lp-form-status:empty { display: none; }
.lp-form-status { padding: 10px 14px; border-radius: 10px; background: color-mix(in srgb, var(--lp-accent) 15%, transparent); }
.lp-form-status.error { background: color-mix(in srgb, #ef4444 15%, transparent); }
.lp-form button[type='submit'] { justify-self: start; }
.lp-prose { max-width: 760px; }
.lp-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; padding: 24px max(16px, calc((100% - 1120px) / 2)); border-top: 1px solid var(--lp-border); color: var(--lp-muted); }
.lp-footer .lp-btn { margin-left: auto; }
@media (max-width: 820px) {
  .lp-hero { grid-template-columns: 1fr; padding-top: 32px; }
  .lp-nav { display: none; }
  .lp-header { justify-content: space-between; }
  .lp-header-actions .lp-btn { padding: 8px 12px; }
  .lp-form { grid-template-columns: 1fr; }
  .lp-section { padding: 40px 16px; }
  .lp-footer .lp-btn { margin-left: 0; }
}
```

- [ ] **Step 4: Loo kliendi skript `src/landing/landing.ts`**

```ts
// src/landing/landing.ts — landing'u beacon (vaatamine, CTA klõpsud) ja „Tunnen huvi“ vorm.
// Ilma Reactita, et leht jääks kergeks; sisu on HTML-is juba olemas.
const params = new URLSearchParams(location.search);
const utm = { utmSource: params.get('utm_source'), utmMedium: params.get('utm_medium'), utmCampaign: params.get('utm_campaign') };
const openedAt = Date.now();

function track(event: 'view' | 'cta_click' | 'form_submit', target?: string): void {
  // keepalive: päring jõuab kohale ka siis, kui klõps viib lehelt ära (nt /login)
  fetch('/api/landing/event', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, target, path: location.pathname, referrer: document.referrer, ...utm })
  }).catch(() => undefined);
}

track('view');
document.querySelectorAll<HTMLElement>('[data-cta]').forEach((el) => {
  el.addEventListener('click', () => track('cta_click', el.dataset.cta));
});

const form = document.getElementById('interest-form') as HTMLFormElement | null;
if (form) {
  const status = form.querySelector<HTMLElement>('.lp-form-status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const buttonLabel = button.textContent ?? '';
  const show = (text: string, isError: boolean) => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    button.disabled = true;
    button.textContent = form.dataset.sending ?? '…';
    show('', false);
    try {
      const res = await fetch('/api/landing/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, elapsedMs: Date.now() - openedAt, referrer: document.referrer, utmSource: utm.utmSource })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        show(typeof body?.error === 'string' ? body.error : (form.dataset.error ?? ''), true);
        return;
      }
      track('form_submit');
      form.reset();
      show(form.dataset.success ?? '', false);
    } catch {
      show(form.dataset.error ?? '', true);
    } finally {
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  });
}
```

- [ ] **Step 5: Ühenda Vite'iga**

`vite.config.ts`: lisa import ja plugin ning sisendid.

```ts
import { landingHtmlPlugin } from './src/landing/landingHtmlPlugin.ts';
// …
  plugins: [react(), dbApiPlugin(), landingHtmlPlugin()],
// …
    // Neli lehte: tenant'i rakendus, teenusepakkuja (admin.html), avalik landing ja privaatsusteade.
    rolldownOptions: {
      input: { main: 'index.html', admin: 'admin.html', landing: 'landing.html', privacy: 'privacy.html' }
    }
```

`index.html`: lisa `<meta name="viewport" …>` järele `<meta name="robots" content="noindex" />`.

`src/server/static.ts` `MIME` objekti lisa:

```ts
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webp': 'image/webp',
```

- [ ] **Step 6: Ehita ja kontrolli väljundit**

Ehita **eraldi kausta** — live serveerib `dist/`-ist ja seda ei tohi enne releasi üle kirjutada.

Run: `srv 'npx tsc --noEmit -p tsconfig.app.json && npx vite build --outDir /tmp/teris-landing-check --emptyOutDir && D=/tmp/teris-landing-check && grep -c "Tunnen huvi" $D/landing.html && head -3 $D/llms.txt && cat $D/robots.txt && grep -c "application/ld+json" $D/landing.html'`
Expected: tüübivead puuduvad; `landing.html` sisaldab „Tunnen huvi“ (≥ 3); `llms.txt` algab `# Teris`; `robots.txt` nagu Task 4 testis; JSON-LD skripte 1.

- [ ] **Step 7: Commit**

```bash
git add src/landing/landingHtmlPlugin.ts landing.html privacy.html src/landing/landing.css src/landing/landing.ts vite.config.ts index.html src/server/static.ts
git commit -m "Landing: Vite'i plugin, landing.html ja privacy.html, stiil ning vormi ja beaconi skript"
```

---

### Task 6: Sündmuste salvestus ja beacon-otspunkt

**Files:**
- Create: `src/server/landing/landingEvents.ts`
- Test: `src/server/landing/landingEvents.test.ts`

**Interfaces:**
- Consumes: Task 2 `classifyUserAgent`, `detectDevice`; Task 3 `visitorHashOf`, `requestMeta`, `referrerHostOf`, `clip`; `CTA_TARGETS` (Task 4); `authDb()`; `createLoginLimiter`; `parseBody`, `json`.
- Produces:
  - `recordHit(req: IncomingMessage, path: string): void` (fire-and-forget)
  - `handleLandingEvent(req: IncomingMessage, res: ServerResponse): Promise<void>`
  - `purgeOldLandingData(now?: Date): Promise<{ events: number; interest: number }>`
  - `startLandingRetention(): void`
  - `LANDING_PATHS = ['/', '/privacy']`

> Eeldus: Task 1 tabelid on andmebaasis (vt Task 1 Step 3 märkust).

- [ ] **Step 1: Kirjuta failiv test**

```ts
// src/server/landing/landingEvents.test.ts — live-andmebaas; testiread tunneb ära utmCampaign järgi.
import { describe, it, expect, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { recordHit, handleLandingEvent, purgeOldLandingData } from './landingEvents.ts';

const TAG = `test-le-${process.pid}`;
const CHROME = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';

function fakeReq(body: unknown, headers: Record<string, string> = {}, url = '/api/landing/event') {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return Object.assign(Readable.from([Buffer.from(raw)]), {
    method: 'POST', url,
    headers: { 'user-agent': CHROME, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw)), ...headers },
    socket: { remoteAddress: '203.0.113.7' }
  }) as unknown as IncomingMessage;
}
function fakeRes() {
  const out = { status: 0, body: '' };
  const res = { statusCode: 200, setHeader() {}, end(c?: string) { out.body += c ?? ''; out.status = (res as any).statusCode; } } as unknown as ServerResponse;
  return { res, out };
}
const rows = () => authDb().landingEvent.findMany({ where: { utmCampaign: TAG }, orderBy: { id: 'asc' } });
const waitFor = async (n: number) => { for (let i = 0; i < 50 && (await rows()).length < n; i++) await new Promise((r) => setTimeout(r, 20)); };

afterAll(async () => {
  await authDb().landingEvent.deleteMany({ where: { utmCampaign: TAG } });
});

describe('recordHit', () => {
  it('salvestab serveri hit-i roboti klassi ja UTM-iga, ilma IP-ta', async () => {
    const req = { url: `/?utm_campaign=${TAG}&utm_source=x`, headers: { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2)' }, socket: { remoteAddress: '203.0.113.7' } } as unknown as IncomingMessage;
    recordHit(req, '/');
    await waitFor(1);
    const [r] = await rows();
    expect(r).toMatchObject({ source: 'server', event: 'hit', path: '/', visitorClass: 'ai_bot', botName: 'GPTBot', utmSource: 'x', device: 'desktop' });
    expect(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain('203.0.113.7');
  });
});

describe('handleLandingEvent', () => {
  it('lubatud sündmus → 204 ja rida', async () => {
    const { res, out } = fakeRes();
    await handleLandingEvent(fakeReq({ event: 'cta_click', target: 'hero', path: '/', referrer: 'https://www.google.com/', utmCampaign: TAG }), res);
    expect(out.status).toBe(204);
    await waitFor(2);
    const r = (await rows()).at(-1)!;
    expect(r).toMatchObject({ source: 'beacon', event: 'cta_click', target: 'hero', referrerHost: 'google.com', visitorClass: 'human' });
  });
  it('tundmatu sündmus, tundmatu target, vale path → 400', async () => {
    for (const body of [{ event: 'hack', path: '/' }, { event: 'cta_click', target: 'x', path: '/' }, { event: 'view', path: '/admin' }]) {
      const { res, out } = fakeRes();
      await handleLandingEvent(fakeReq({ ...body, utmCampaign: TAG }), res);
      expect(out.status).toBe(400);
    }
  });
  it('liiga suur keha → 400', async () => {
    const { res, out } = fakeRes();
    await handleLandingEvent(fakeReq({ event: 'view', path: '/', utmCampaign: TAG, pad: 'x'.repeat(3000) }), res);
    expect(out.status).toBe(400);
  });
});

describe('purgeOldLandingData', () => {
  it('kustutab üle 13 kuu vanad sündmused', async () => {
    await authDb().landingEvent.create({
      data: { ts: new Date('2020-01-01T00:00:00Z'), source: 'server', event: 'hit', path: '/', visitorClass: 'human', device: 'desktop', visitorHash: '0000000000000000', utmCampaign: TAG }
    });
    const before = (await rows()).length;
    const result = await purgeOldLandingData(new Date('2026-10-19T00:00:00Z'));
    expect(result.events).toBeGreaterThanOrEqual(1);
    expect((await rows()).length).toBe(before - 1);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `srv 'npx vitest run src/server/landing/landingEvents.test.ts'`
Expected: FAIL (moodul puudub).

- [ ] **Step 3: Implementeeri**

```ts
// src/server/landing/landingEvents.ts — landing'u külastuste salvestus (serveri hit + brauseri beacon) ja säilitamine.
// Mõõtmise viga ei tohi kunagi takistada lehe serveerimist: kõik vead logitakse ja neelatakse.
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { parseBody } from '../http.ts';
import { createLoginLimiter } from '../auth.ts';
import { CTA_TARGETS } from '../../landing/content.et.ts';
import { classifyUserAgent, detectDevice } from './botDetect.ts';
import { visitorHashOf } from './visitorHash.ts';
import { requestMeta, referrerHostOf, clip } from './requestMeta.ts';

export const LANDING_PATHS = ['/', '/privacy'];
const BEACON_EVENTS = ['view', 'cta_click', 'form_submit'];
const MAX_BEACON_BYTES = 2 * 1024;
const EVENT_RETENTION_MONTHS = 13;
const INTEREST_RETENTION_MONTHS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const beaconLimiter = createLoginLimiter({ max: 60, windowMs: 15 * 60 * 1000 });

type EventInput = {
  source: 'server' | 'beacon';
  event: string;
  target?: string | null;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

function save(req: IncomingMessage, e: EventInput): Promise<unknown> {
  const meta = requestMeta(req);
  const { visitorClass, botName } = classifyUserAgent(meta.ua);
  return authDb().landingEvent.create({
    data: { ...e, target: e.target ?? null, visitorClass, botName, device: detectDevice(meta.ua), visitorHash: visitorHashOf(meta.ip, meta.ua) }
  });
}

export function recordHit(req: IncomingMessage, path: string): void {
  try {
    const meta = requestMeta(req);
    save(req, { source: 'server', event: 'hit', path, referrerHost: meta.referrerHost, utmSource: meta.utmSource, utmMedium: meta.utmMedium, utmCampaign: meta.utmCampaign }).catch((err) =>
      console.error('[landing] hit-i salvestamine ebaõnnestus', err)
    );
  } catch (err) {
    console.error('[landing] hit-i salvestamine ebaõnnestus', err);
  }
}

function noContent(res: ServerResponse, status = 204): void {
  res.statusCode = status;
  res.end();
}

export async function handleLandingEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: any;
  try {
    body = await parseBody(req, MAX_BEACON_BYTES);
  } catch {
    return noContent(res, 400);
  }
  const event = typeof body?.event === 'string' ? body.event : '';
  const path = typeof body?.path === 'string' ? body.path : '';
  const target = body?.target == null ? null : String(body.target);
  if (!BEACON_EVENTS.includes(event) || !LANDING_PATHS.includes(path)) return noContent(res, 400);
  if (event === 'cta_click' ? !CTA_TARGETS.includes(target as never) : target !== null) return noContent(res, 400);

  const key = `beacon:${requestMeta(req).ip}`;
  if (beaconLimiter.isBlocked(key)) return noContent(res);
  beaconLimiter.registerFailure(key); // loendur, mitte viga

  try {
    await save(req, {
      source: 'beacon',
      event,
      target,
      path,
      referrerHost: referrerHostOf(typeof body.referrer === 'string' ? body.referrer : null),
      utmSource: clip(body.utmSource, 100),
      utmMedium: clip(body.utmMedium, 100),
      utmCampaign: clip(body.utmCampaign, 100)
    });
  } catch (err) {
    console.error('[landing] beaconi salvestamine ebaõnnestus', err);
  }
  noContent(res);
}

const monthsBefore = (now: Date, months: number) => {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
};

export async function purgeOldLandingData(now: Date = new Date()): Promise<{ events: number; interest: number }> {
  const db = authDb();
  const [events, interest] = await Promise.all([
    db.landingEvent.deleteMany({ where: { ts: { lt: monthsBefore(now, EVENT_RETENTION_MONTHS) } } }),
    db.interestRequest.deleteMany({ where: { status: 'CLOSED', closedAt: { lt: monthsBefore(now, INTEREST_RETENTION_MONTHS) } } })
  ]);
  return { events: events.count, interest: interest.count };
}

export function startLandingRetention(): void {
  const run = () =>
    purgeOldLandingData()
      .then((r) => (r.events || r.interest) && console.log(`[landing] puhastus: ${r.events} sündmust, ${r.interest} huvilist`))
      .catch((err) => console.error('[landing] puhastus ebaõnnestus', err));
  void run();
  setInterval(run, DAY_MS).unref();
}
```

- [ ] **Step 4: Käivita — peab läbima**

Run: `srv 'npx vitest run src/server/landing/landingEvents.test.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/landing/landingEvents.ts src/server/landing/landingEvents.test.ts
git commit -m "Landing: külastuste salvestus, beacon-otspunkt ja säilitamise puhastus"
```

---

### Task 7: „Tunnen huvi“ otspunkt

**Files:**
- Create: `src/server/landing/interest.ts`
- Test: `src/server/landing/interest.test.ts`

**Interfaces:**
- Consumes: `normalizeEmail`, `sendMail`, `MAIL_FROM` (`src/server/mail.ts`); `createLoginLimiter`; Task 3 `requestMeta`, `referrerHostOf`, `clip`.
- Produces:
  - `type InterestData = { name: string; email: string; company: string | null; phone: string | null; areaHa: number | null; message: string | null; utmSource: string | null; referrerHost: string | null }`
  - `validateInterest(body: any): { ok: true; data: InterestData } | { ok: false; error: string }`
  - `isSuspicious(body: any): boolean`
  - `buildInterestMail(data: InterestData, o: { to: string; from: string; adminUrl: string }): string`
  - `handleInterest(req, res, deps?: { send?: (msg: string, to: string) => Promise<void>; notifyTo?: string | undefined }): Promise<void>`
  - `INTEREST_OK_MESSAGE = 'Aitäh! Võtame peagi ühendust.'`

- [ ] **Step 1: Kirjuta failiv test**

```ts
// src/server/landing/interest.test.ts — valideerimine (puhas) + otspunkt live-andmebaasiga.
import { describe, it, expect, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { validateInterest, isSuspicious, buildInterestMail, handleInterest } from './interest.ts';

const EMAIL = `test-int-${process.pid}@example.com`;
const valid = { name: 'Mari Maasikas', email: EMAIL, company: 'Talu OÜ', phone: '+372 5555 5555', areaHa: '120,5', message: 'Huvitab telemeetria', website: '', elapsedMs: 8000 };

let ipSeq = 0;
function fakeReq(body: unknown) {
  const raw = JSON.stringify(body);
  return Object.assign(Readable.from([Buffer.from(raw)]), {
    method: 'POST', url: '/api/landing/interest',
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw)), 'user-agent': 'UA' },
    socket: { remoteAddress: `198.51.100.${++ipSeq}` }
  }) as unknown as IncomingMessage;
}
function fakeRes() {
  const out = { status: 0, body: '' };
  const res = { statusCode: 200, setHeader() {}, end(c?: string) { out.body += c ?? ''; out.status = (res as any).statusCode; } } as unknown as ServerResponse;
  return { res, out };
}

afterAll(async () => {
  await authDb().interestRequest.deleteMany({ where: { email: { startsWith: `test-int-${process.pid}` } } });
});

describe('validateInterest', () => {
  it('kehtiv sisend → normaliseeritud andmed', () => {
    const r = validateInterest({ ...valid, email: ` ${EMAIL.toUpperCase()} `, referrer: 'https://www.google.com/x', utmSource: 'fb' });
    expect(r).toEqual({ ok: true, data: { name: 'Mari Maasikas', email: EMAIL, company: 'Talu OÜ', phone: '+372 5555 5555', areaHa: 120.5, message: 'Huvitab telemeetria', utmSource: 'fb', referrerHost: 'google.com' } });
  });
  it('vigased väljad', () => {
    expect(validateInterest({ ...valid, name: '' })).toEqual({ ok: false, error: 'Nimi on kohustuslik (kuni 100 märki)' });
    expect(validateInterest({ ...valid, name: 'x'.repeat(101) }).ok).toBe(false);
    expect(validateInterest({ ...valid, email: 'pole-epost' })).toEqual({ ok: false, error: 'Kontrolli e-posti aadressi' });
    expect(validateInterest({ ...valid, areaHa: '-5' })).toEqual({ ok: false, error: 'Põllupind peab olema 0–100 000 ha' });
    expect(validateInterest({ ...valid, message: 'x'.repeat(2001) }).ok).toBe(false);
  });
  it('tühjad valikulised väljad → null', () => {
    const r = validateInterest({ name: 'A', email: EMAIL });
    expect(r.ok && r.data).toMatchObject({ company: null, phone: null, areaHa: null, message: null });
  });
});

describe('isSuspicious', () => {
  it('honeypot või liiga kiire saatmine', () => {
    expect(isSuspicious(valid)).toBe(false);
    expect(isSuspicious({ ...valid, website: 'http://spam' })).toBe(true);
    expect(isSuspicious({ ...valid, elapsedMs: 1200 })).toBe(true);
    expect(isSuspicious({ ...valid, elapsedMs: 'x' })).toBe(true);
  });
});

describe('buildInterestMail', () => {
  it('sisaldab välju ja admin-linki, päis on turvaline', () => {
    const m = buildInterestMail({ name: 'Mari', email: EMAIL, company: null, phone: null, areaHa: 50, message: 'Tere', utmSource: null, referrerHost: null }, { to: 'admin@x.ee', from: 'noreply@teris.ee', adminUrl: 'https://admin.teris.ee' });
    expect(m).toContain('To: admin@x.ee');
    expect(m).toContain('Mari');
    expect(m).toContain('50 ha');
    expect(m).toContain('https://admin.teris.ee');
  });
});

describe('handleInterest', () => {
  it('kehtiv → 200, rida ja e-kiri', async () => {
    const sent: string[] = [];
    const { res, out } = fakeRes();
    await handleInterest(fakeReq(valid), res, { send: async (msg) => void sent.push(msg), notifyTo: 'admin@x.ee' });
    expect(out.status).toBe(200);
    expect(await authDb().interestRequest.count({ where: { email: EMAIL } })).toBe(1);
    expect(sent).toHaveLength(1);
  });
  it('kahtlane → 200, aga ei salvestata ega saadeta', async () => {
    const sent: string[] = [];
    const email = `test-int-${process.pid}-spam@example.com`;
    const { res, out } = fakeRes();
    await handleInterest(fakeReq({ ...valid, email, website: 'x' }), res, { send: async (m) => void sent.push(m), notifyTo: 'admin@x.ee' });
    expect(out.status).toBe(200);
    expect(await authDb().interestRequest.count({ where: { email } })).toBe(0);
    expect(sent).toHaveLength(0);
  });
  it('vigane → 400 eestikeelse veaga', async () => {
    const { res, out } = fakeRes();
    await handleInterest(fakeReq({ ...valid, email: 'x' }), res, { send: async () => {}, notifyTo: undefined });
    expect(out.status).toBe(400);
    expect(JSON.parse(out.body).error).toBe('Kontrolli e-posti aadressi');
  });
  it('e-kirja viga ei nurja päringut; notifyTo puudumisel kirja ei saadeta', async () => {
    const email = `test-int-${process.pid}-mailfail@example.com`;
    const { res, out } = fakeRes();
    await handleInterest(fakeReq({ ...valid, email }), res, { send: async () => { throw new Error('sendmail maas'); }, notifyTo: 'admin@x.ee' });
    expect(out.status).toBe(200);
    expect(await authDb().interestRequest.count({ where: { email } })).toBe(1);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `srv 'npx vitest run src/server/landing/interest.test.ts'`
Expected: FAIL (moodul puudub).

- [ ] **Step 3: Implementeeri**

```ts
// src/server/landing/interest.ts — „Tunnen huvi“ vorm: valideerimine, spämmikaitse, salvestus ja teavitus.
// Kahtlane päring saab sama „Aitäh“ vastuse, et robot ei õpiks reegleid tundma. IP-d ei salvestata.
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { json, parseBody } from '../http.ts';
import { createLoginLimiter } from '../auth.ts';
import { normalizeEmail, sendMail, MAIL_FROM } from '../mail.ts';
import { requestMeta, referrerHostOf, clip } from './requestMeta.ts';

export const INTEREST_OK_MESSAGE = 'Aitäh! Võtame peagi ühendust.';
const MAX_INTEREST_BYTES = 8 * 1024;
const MIN_ELAPSED_MS = 3000;
const ADMIN_URL = `https://${process.env.PLATFORM_HOST ?? 'admin.teris.ee'}`;
const interestLimiter = createLoginLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

export type InterestData = {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  areaHa: number | null;
  message: string | null;
  utmSource: string | null;
  referrerHost: string | null;
};

// Pikem kui lubatud → viga (mitte vaikne lõikamine), tühi → null
function optional(v: unknown, max: number): string | null | undefined {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? undefined : s;
}

export function validateInterest(body: any): { ok: true; data: InterestData } | { ok: false; error: string } {
  const name = optional(body?.name, 100);
  if (!name) return { ok: false, error: 'Nimi on kohustuslik (kuni 100 märki)' };
  const email = normalizeEmail(body?.email);
  if (!email) return { ok: false, error: 'Kontrolli e-posti aadressi' };
  const company = optional(body?.company, 100);
  if (company === undefined) return { ok: false, error: 'Ettevõtte nimi on liiga pikk (kuni 100 märki)' };
  const phone = optional(body?.phone, 30);
  if (phone === undefined) return { ok: false, error: 'Telefon on liiga pikk (kuni 30 märki)' };
  const message = optional(body?.message, 2000);
  if (message === undefined) return { ok: false, error: 'Sõnum on liiga pikk (kuni 2000 märki)' };
  const areaRaw = optional(body?.areaHa, 12);
  let areaHa: number | null = null;
  if (areaRaw !== null) {
    areaHa = Number(String(areaRaw).replace(',', '.').replace(/\s/g, ''));
    if (areaRaw === undefined || !Number.isFinite(areaHa) || areaHa < 0 || areaHa > 100_000) return { ok: false, error: 'Põllupind peab olema 0–100 000 ha' };
  }
  return {
    ok: true,
    data: {
      name, email, company, phone, areaHa, message,
      utmSource: clip(body?.utmSource, 100),
      referrerHost: referrerHostOf(typeof body?.referrer === 'string' ? body.referrer : null)
    }
  };
}

export function isSuspicious(body: any): boolean {
  if (typeof body?.website === 'string' && body.website.trim() !== '') return true;
  const elapsed = body?.elapsedMs;
  return typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS;
}

const encodeHeader = (text: string) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
const headerSafe = (v: string) => {
  if (/[\r\n]/.test(v)) throw new Error('Päise väärtus sisaldab reavahetust');
  return v;
};

export function buildInterestMail(d: InterestData, o: { to: string; from: string; adminUrl: string }): string {
  const lines = [
    'Landing-lehelt tuli uus huvi:',
    '',
    `Nimi: ${d.name}`,
    `E-post: ${d.email}`,
    `Ettevõte: ${d.company ?? '–'}`,
    `Telefon: ${d.phone ?? '–'}`,
    `Põllupind: ${d.areaHa != null ? `${d.areaHa} ha` : '–'}`,
    `Allikas: ${d.utmSource ?? d.referrerHost ?? 'otse'}`,
    '',
    d.message ?? '',
    '',
    `Halda: ${o.adminUrl} → Huvilised`
  ];
  const headers = [
    `From: TERIS <${headerSafe(o.from)}>`,
    `To: ${headerSafe(o.to)}`,
    `Subject: ${encodeHeader(`Teris: uus huviline — ${d.name}`)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  return `${headers.join('\n')}\n\n${lines.join('\n')}\n`;
}

export async function handleInterest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { send?: (msg: string, to: string) => Promise<void>; notifyTo?: string | undefined } = {}
): Promise<void> {
  const send = deps.send ?? sendMail;
  const notifyTo = 'notifyTo' in deps ? deps.notifyTo : process.env.LANDING_NOTIFY_EMAIL;
  let body: any;
  try {
    body = await parseBody(req, MAX_INTEREST_BYTES);
  } catch {
    return json(res, { error: 'Vigane päring' }, 400);
  }

  const key = `interest:${requestMeta(req).ip}`;
  if (interestLimiter.isBlocked(key) || isSuspicious(body)) return json(res, { message: INTEREST_OK_MESSAGE });
  const v = validateInterest(body);
  if (!v.ok) return json(res, { error: v.error }, 400);
  interestLimiter.registerFailure(key); // loendur, mitte viga

  try {
    await authDb().interestRequest.create({ data: v.data });
  } catch (err) {
    console.error('[landing] huvilise salvestamine ebaõnnestus', err);
    return json(res, { error: 'Saatmine ebaõnnestus, proovi hiljem uuesti' }, 500);
  }

  if (!notifyTo) {
    console.warn('[landing] LANDING_NOTIFY_EMAIL puudub — teavituskirja ei saadetud');
  } else {
    try {
      await send(buildInterestMail(v.data, { to: notifyTo, from: MAIL_FROM, adminUrl: ADMIN_URL }), notifyTo);
    } catch (err) {
      console.error('[landing] teavituskirja saatmine ebaõnnestus', err);
    }
  }
  json(res, { message: INTEREST_OK_MESSAGE });
}
```

- [ ] **Step 4: Käivita — peab läbima**

Run: `srv 'npx vitest run src/server/landing/interest.test.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/landing/interest.ts src/server/landing/interest.test.ts
git commit -m "Landing: „Tunnen huvi“ otspunkt (valideerimine, spämmikaitse, salvestus, teavitus)"
```

---

### Task 8: Marsruutimine — `/` sessiooni järgi, `/login`, avalik landing API

**Files:**
- Create: `src/server/landing/landingRoute.ts`, `src/server/landing/landingApi.ts`
- Modify: `src/server/authGate.ts` (lisa `hasValidSession`), `src/server/static.ts` (lisa `serveFile`), `src/server/apiHandler.ts:226-233`, `src/server/prod.ts`, `src/server/dbApiPlugin.ts`
- Test: `src/server/landing/landingRoute.test.ts`, `src/server/static.test.ts` (lisa `serveFile` test)

**Interfaces:**
- Consumes: Task 6 `recordHit`, `handleLandingEvent`, `startLandingRetention`; Task 7 `handleInterest`; `checkMutationRequest`, `hasRequestBody`, `findActiveSession`, `findSupportSession`.
- Produces:
  - `type LandingDecision = { kind: 'static' } | { kind: 'file'; file: string; hit: boolean } | { kind: 'redirect'; location: string }`
  - `decideLandingRoute(pathname: string, hasSession: boolean): LandingDecision`
  - `needsSessionCheck(pathname: string): boolean`
  - `PUBLIC_ONLY_FILES = ['landing.html', 'privacy.html', 'llms.txt', 'robots.txt', 'sitemap.xml']`
  - `hasValidSession(req: IncomingMessage): Promise<boolean>`
  - `serveFile(req, res, distDir: string, relPath: string): Promise<void>`
  - `handleLandingApi(req, res, pathname: string, method: string, allowedOrigins: string[]): Promise<boolean>`

- [ ] **Step 1: Kirjuta failivad testid**

```ts
// src/server/landing/landingRoute.test.ts
import { describe, it, expect } from 'vitest';
import { decideLandingRoute, needsSessionCheck } from './landingRoute.ts';

describe('decideLandingRoute', () => {
  it('/ sessiooni järgi', () => {
    expect(decideLandingRoute('/', true)).toEqual({ kind: 'file', file: 'index.html', hit: false });
    expect(decideLandingRoute('/', false)).toEqual({ kind: 'file', file: 'landing.html', hit: true });
  });
  it('/login: sessiooniga suunamine, muidu SPA', () => {
    expect(decideLandingRoute('/login', true)).toEqual({ kind: 'redirect', location: '/' });
    expect(decideLandingRoute('/login', false)).toEqual({ kind: 'static' });
  });
  it('avalikud failid logitakse', () => {
    expect(decideLandingRoute('/privacy', true)).toEqual({ kind: 'file', file: 'privacy.html', hit: true });
    for (const f of ['llms.txt', 'robots.txt', 'sitemap.xml']) expect(decideLandingRoute(`/${f}`, false)).toEqual({ kind: 'file', file: f, hit: true });
  });
  it('muu → tavaline staatiline/SPA', () => {
    expect(decideLandingRoute('/support', false)).toEqual({ kind: 'static' });
    expect(decideLandingRoute('/assets/x.js', false)).toEqual({ kind: 'static' });
  });
  it('sessiooni kontroll ainult / ja /login puhul', () => {
    expect(needsSessionCheck('/')).toBe(true);
    expect(needsSessionCheck('/login')).toBe(true);
    expect(needsSessionCheck('/privacy')).toBe(false);
    expect(needsSessionCheck('/assets/x.js')).toBe(false);
  });
});
```

`src/server/static.test.ts` lõppu (kasutab sama `dir` mustrit; loo eraldi `describe` oma ajutise kaustaga):

```ts
describe('serveFile', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'teris-servefile-'));
    await writeFile(path.join(dir, 'landing.html'), 'LANDING');
    await writeFile(path.join(dir, 'robots.txt'), 'User-agent: *');
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const run = async (method: string, rel: string) => {
    const out = { status: 0, body: '', headers: {} as Record<string, unknown> };
    const res = {
      statusCode: 200,
      setHeader(k: string, v: unknown) { out.headers[k.toLowerCase()] = v; },
      end(b?: Buffer | string) { out.status = (res as any).statusCode; out.body = b ? b.toString() : ''; }
    } as unknown as ServerResponse;
    await serveFile({ method } as IncomingMessage, res, dir, rel);
    return out;
  };
  it('serveerib nimetatud faili õige tüübiga', async () => {
    const r = await run('GET', 'landing.html');
    expect(r).toMatchObject({ status: 200, body: 'LANDING' });
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect((await run('GET', 'robots.txt')).headers['content-type']).toBe('text/plain; charset=utf-8');
  });
  it('puuduv fail → 404, POST → 405', async () => {
    expect((await run('GET', 'missing.html')).status).toBe(404);
    expect((await run('POST', 'landing.html')).status).toBe(405);
  });
});
```

Lisa `static.test.ts` importi `serveFile`: `import { resolveStaticPath, cacheControlFor, serveStatic, serveFile } from './static';`

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `srv 'npx vitest run src/server/landing/landingRoute.test.ts src/server/static.test.ts'`
Expected: FAIL (`landingRoute.ts` puudub, `serveFile` pole eksporditud).

- [ ] **Step 3: Implementeeri `landingRoute.ts`**

```ts
// src/server/landing/landingRoute.ts — avalikud teed: kas serveerida rakendus, landing või suunata.
export type LandingDecision = { kind: 'static' } | { kind: 'file'; file: string; hit: boolean } | { kind: 'redirect'; location: string };

const MACHINE_FILES = ['llms.txt', 'robots.txt', 'sitemap.xml'];
// Neid faile ei serveerita otse oma nime all (ainult decideLandingRoute kaudu); platvormi hostil üldse mitte.
export const PUBLIC_ONLY_FILES = ['landing.html', 'privacy.html', ...MACHINE_FILES];

export const needsSessionCheck = (pathname: string): boolean => pathname === '/' || pathname === '/login';

export function decideLandingRoute(pathname: string, hasSession: boolean): LandingDecision {
  if (pathname === '/') return hasSession ? { kind: 'file', file: 'index.html', hit: false } : { kind: 'file', file: 'landing.html', hit: true };
  if (pathname === '/login') return hasSession ? { kind: 'redirect', location: '/' } : { kind: 'static' };
  if (pathname === '/privacy') return { kind: 'file', file: 'privacy.html', hit: true };
  const name = pathname.slice(1);
  if (MACHINE_FILES.includes(name)) return { kind: 'file', file: name, hit: true };
  return { kind: 'static' };
}
```

- [ ] **Step 4: Lisa `serveFile` `static.ts`-i**

Asenda `serveStatic`-i lõpuosa (alates `const body = await readFile(file);`) ühise funktsiooniga ja lisa `serveFile`:

```ts
async function send(req: IncomingMessage, res: ServerResponse, distDir: string, file: string): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  const body = await readFile(file);
  const rel = path.relative(path.resolve(distDir), file).split(path.sep).join('/');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControlFor(rel));
  res.setHeader('Content-Length', body.length);
  res.end(method === 'HEAD' ? undefined : body);
}

/** Serveerib distDir-i suhtes nimetatud faili (landing'u marsruudid); puuduv → 404. */
export async function serveFile(req: IncomingMessage, res: ServerResponse, distDir: string, relPath: string): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }
  const file = resolveStaticPath(distDir, `/${relPath}`);
  if (!file || !(await isFile(file))) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  await send(req, res, distDir, file);
}
```

ja `serveStatic`-i lõpus: `await send(req, res, distDir, file);` (vana `readFile`…`res.end` plokk eemaldatakse).

- [ ] **Step 5: Lisa `hasValidSession` `authGate.ts`-i** (`currentSupportSession` järele)

```ts
/** Kas päringul on kehtiv tava- või tugisessioon (avalehe valik: rakendus või landing). Ei uuenda sessiooni. */
export async function hasValidSession(req: IncomingMessage): Promise<boolean> {
  const token = sessionToken(req);
  if (token && (await findActiveSession(hashToken(token)))) return true;
  const support = supportToken(req);
  return !!(support && (await findSupportSession(hashToken(support))));
}
```

- [ ] **Step 6: Loo `landingApi.ts` ja ühenda `apiHandler.ts`-iga**

```ts
// src/server/landing/landingApi.ts — avalikud /api/landing/* otspunktid (sessiooni ei nõua, Origin kontrollitakse).
import type { IncomingMessage, ServerResponse } from 'http';
import { json, hasRequestBody } from '../http.ts';
import { checkMutationRequest } from '../auth.ts';
import { handleLandingEvent } from './landingEvents.ts';
import { handleInterest } from './interest.ts';

export async function handleLandingApi(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, allowedOrigins: string[]): Promise<boolean> {
  if (pathname !== '/api/landing/event' && pathname !== '/api/landing/interest') return false;
  if (method !== 'POST') {
    json(res, { error: 'Not found' }, 404);
    return true;
  }
  const csrf = checkMutationRequest(
    {
      method,
      origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      contentType: typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined,
      hasBody: hasRequestBody(req)
    },
    allowedOrigins
  );
  if (csrf !== 'ok') {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }
  if (pathname === '/api/landing/event') await handleLandingEvent(req, res);
  else await handleInterest(req, res);
  return true;
}
```

`src/server/apiHandler.ts` `routeApiRequest`-is rea `if (pathname.startsWith('/api/platform/')) return json(res, { error: 'Not found' }, 404);` järele, **enne** `authGate`-i:

```ts
    if (await handleLandingApi(req, res, pathname, method, options.allowedOrigins)) return;
```

ja importi: `import { handleLandingApi } from './landing/landingApi.ts';`

- [ ] **Step 7: Uuenda `prod.ts`**

```ts
// src/server/prod.ts — toodanguserver: dist/ + /api (sisselogimisega) + avalik landing.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiHandler';
import { serveStatic, serveFile } from './static';
import { isPlatformHost } from './platformHost';
import { hasValidSession } from './authGate';
import { decideLandingRoute, needsSessionCheck, PUBLIC_ONLY_FILES } from './landing/landingRoute';
import { recordHit, startLandingRetention } from './landing/landingEvents';

const PORT = Number(process.env.PORT ?? 8820);
const HOST = '127.0.0.1';
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const API_OPTIONS = {
  allowedOrigins: ['https://teris.ee', 'https://www.teris.ee'],
  requireAuth: true,
  platformAllowedOrigins: ['https://admin.teris.ee']
};

async function serveTenantHost(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  // Sessiooni kontrolli viga → landing (sisselogitud kasutaja jõuab „Logi sisse“ kaudu edasi)
  const session = needsSessionCheck(pathname) ? await hasValidSession(req).catch(() => false) : false;
  const decision = decideLandingRoute(pathname, session);
  if (decision.kind === 'redirect') {
    res.statusCode = 302;
    res.setHeader('Location', decision.location);
    res.end();
    return;
  }
  if (decision.kind === 'file') {
    if (pathname === '/') res.setHeader('Vary', 'Cookie'); // sama URL, sisu sõltub sessioonist
    if (decision.hit) recordHit(req, pathname);
    await serveFile(req, res, DIST_DIR, decision.file);
    return;
  }
  await serveStatic(req, res, DIST_DIR, { spaEntry: 'index.html', blocked: ['admin.html', ...PUBLIC_ONLY_FILES] });
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url ?? '').startsWith('/api')) {
      await handleApiRequest(req, res, API_OPTIONS);
    } else if (isPlatformHost(req)) {
      await serveStatic(req, res, DIST_DIR, { spaEntry: 'admin.html', blocked: ['index.html', ...PUBLIC_ONLY_FILES] });
    } else {
      await serveTenantHost(req, res);
    }
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Serveri viga');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`teris map kuulab http://${HOST}:${PORT} (dist: ${DIST_DIR})`);
  startLandingRetention();
});
```

- [ ] **Step 8: Uuenda arendusserverit `dbApiPlugin.ts`**

Lisa importid ja middleware'i haru (enne `/api` kontrolli). Arenduses hit-e ei logita (sama andmebaas mis live — ei risusta statistikat).

```ts
import { hasValidSession } from './authGate.ts';
import { decideLandingRoute, needsSessionCheck } from './landing/landingRoute.ts';
// …
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
          if (!needsSessionCheck(pathname) && pathname !== '/privacy') return next();
          const d = decideLandingRoute(pathname, needsSessionCheck(pathname) ? await hasValidSession(req).catch(() => false) : false);
          if (d.kind === 'redirect') {
            res.statusCode = 302;
            res.setHeader('Location', d.location);
            res.end();
            return;
          }
          // Vite serveerib ja teisendab mitmelehelise sisendi ise (landingHtmlPlugin süstib sisu)
          if (d.kind === 'file' && (d.file === 'landing.html' || d.file === 'privacy.html')) req.url = `/${d.file}`;
          return next();
        }
        await handleApiRequest(req, res, DEV_OPTIONS);
      });
```

- [ ] **Step 9: Käivita testid ja tüübikontroll**

Run: `srv 'npx vitest run src/server/landing/landingRoute.test.ts src/server/static.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS, tüübivigu pole.

- [ ] **Step 10: Proovi arendusserveris**

Run: `srv 'npm run dev'` (taustal) ja tunnel `ssh -L 5173:127.0.0.1:5173 uvn-243-120.tll07.zonevs.eu`.
Kontrolli:
- `curl -s http://127.0.0.1:5173/ | grep -c 'Tunnen huvi'` → ≥ 3 (ilma küpsiseta landing);
- `curl -sI http://127.0.0.1:5173/login` → `200`;
- `curl -s http://127.0.0.1:5173/llms.txt | head -1` → `# Teris`;
- `curl -s http://127.0.0.1:5173/privacy | grep -c Privaatsusteade` → ≥ 1.

- [ ] **Step 11: Commit**

```bash
git add src/server/landing/landingRoute.ts src/server/landing/landingRoute.test.ts src/server/landing/landingApi.ts src/server/authGate.ts src/server/static.ts src/server/static.test.ts src/server/apiHandler.ts src/server/prod.ts src/server/dbApiPlugin.ts
git commit -m "Landing: / sessiooni järgi rakendus või landing, /login, avalik /api/landing/*"
```

---

### Task 9: Klient — `/login`, `/support`, `/set-password`

**Files:**
- Modify: `src/AuthGate.tsx`, `src/components/LoginPage.tsx`, `src/components/SetPasswordPage.tsx:1` (kommentaar), `src/server/platformApi.ts:224`, `src/server/passwordTokens.ts:69`, `src/server/platformApi.test.ts:612-613`, `src/server/mail.test.ts:24,33`, `README.md`

**Interfaces:**
- Consumes: Task 8 marsruudid (`/login` SPA, `/` landing).
- Produces: tugivaate link `${APP_BASE_URL}/support#<token>`, paroolilink `${APP_BASE_URL}/set-password#<token>`; vanad `/tugi`, `/parool` töötavad edasi.

- [ ] **Step 1: Uuenda testid uutele linkidele (peavad kukkuma)**

`src/server/platformApi.test.ts` read 612–613: asenda `/tugi#` → `/support#`.
`src/server/mail.test.ts` read 24 ja 33: asenda `https://teris.ee/parool#abc` → `https://teris.ee/set-password#abc`.

Run: `srv 'npx vitest run src/server/platformApi.test.ts'`
Expected: FAIL tugivaate testis (`url` algab veel `/tugi#`). (`mail.test.ts` läbib, sest link on sisend — see on ainult näite uuendus.)

- [ ] **Step 2: Muuda lingid serveris**

`src/server/platformApi.ts:224`: `` return { url: `${APP_BASE_URL}/support#${token}` }; ``
`src/server/passwordTokens.ts:69`: `` link: `${APP_BASE_URL}/set-password#${raw}`, ``

- [ ] **Step 3: Uuenda `AuthGate.tsx`**

Ülaosas:

```ts
// /support#<token> — kasutajatoe üleandmislink (vana alias /tugi). Token loetakse ja fragment eemaldatakse kohe
// (enne päringut), et token ei jääks aadressiribale ega ajalukku.
const SUPPORT_PATHS = ['/support', '/tugi'];
const SET_PASSWORD_PATHS = ['/set-password', '/parool'];
const isSupportPath = SUPPORT_PATHS.includes(window.location.pathname);
const supportToken: string | null = isSupportPath && window.location.hash.length > 1 ? window.location.hash.slice(1) : null;
if (isSupportPath) window.history.replaceState(null, '', '/');
```

`linkToken` algväärtus:

```ts
  // /set-password#<token> (vana alias /parool) — e-kirja link parooli määramiseks.
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    SET_PASSWORD_PATHS.includes(window.location.pathname) && window.location.hash.length > 1 ? window.location.hash.slice(1) : null
  );
  const leaveLinkPage = (message?: string) => {
    window.history.replaceState(null, '', '/login');
```

Lisa komponendi kehasse (enne `useEffect`-i) abifunktsioon ja kasuta seda 401 käsitlejas ning väljalogimisel:

```ts
  // Sisselogimata olek elab aadressil /login, et värskendamine ei viiks landing'ule
  const showLogin = () => {
    if (window.location.pathname !== '/login') window.history.replaceState(null, '', '/login');
  };
```

- `setUnauthorizedHandler(() => { showLogin(); setUser(null); … })`
- `logout`-i `.then(() => { showLogin(); setNotice(null); … })`
- `getMe().catch(() => { showLogin(); setUser(null); })` — avalehel ilma sessioonita seda ei juhtu (server serveerib landing'u), muudel teedel viib `/login`-ile.
- `LoginPage` `onLoggedIn`: `if (window.location.pathname === '/login') window.history.replaceState(null, '', '/');` enne `setUser(u)`.

- [ ] **Step 4: Lisa `LoginPage.tsx`-i link avalehele**

`<p className="login-copyright">` ette:

```tsx
        <a className="login-home-link" href="/">← Teris avalehele</a>
```

ja `src/index.css`-i `.login-copyright` reegli juurde:

```css
.login-home-link {
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-decoration: none;
}
.login-home-link:hover { color: var(--text-primary); }
```

`src/components/SetPasswordPage.tsx:1` kommentaar: `(/parool#token)` → `(/set-password#token)`.

- [ ] **Step 5: Uuenda README**

`README.md` „Arhitektuur“ plokki lisa rida `├─ /, /privacy, /llms.txt, robots.txt, sitemap.xml  avalik landing (src/server/landing/, src/landing/)` ja kirjelda, et `/` ilma sessioonita → landing, sisselogimine `/login`. Lisa „Arendusprotsess“ alla: `.env` muutuja `LANDING_NOTIFY_EMAIL` (huvivormi teavituse saaja); landing'u tekstid on `src/landing/content.et.ts`-is.

- [ ] **Step 6: Testid ja tüübikontroll**

Run: `srv 'npx vitest run src/server/platformApi.test.ts src/server/mail.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS.

- [ ] **Step 7: Proovi arendusserveris (brauser)**

Ava `http://localhost:5173/` → landing; „Logi sisse“ → `/login` → logi sisse → aadress muutub `/`, rakendus avaneb; värskenda → rakendus; logi välja → aadress `/login`; värskenda → sisselogimisvaade; „← Teris avalehele“ → landing.

- [ ] **Step 8: Commit**

```bash
git add src/AuthGate.tsx src/components/LoginPage.tsx src/components/SetPasswordPage.tsx src/index.css src/server/platformApi.ts src/server/passwordTokens.ts src/server/platformApi.test.ts src/server/mail.test.ts README.md
git commit -m "Sisselogimine /login-il; lingid /support ja /set-password (vanad /tugi, /parool aliastena)"
```

---

### Task 10: Platvormi API — statistika ja huvilised

**Files:**
- Create: `src/server/landing/landingStats.ts`, `src/server/landing/interestAdmin.ts`
- Modify: `src/server/platformApi.ts` (`route` funktsioon)
- Test: `src/server/landing/landingStats.test.ts`, `src/server/landing/interestAdmin.test.ts`

**Interfaces:**
- Consumes: `authDb()`; Task 1 mudelid.
- Produces:
  - `parseDay(s: string | null): string | null` (`YYYY-MM-DD` või null)
  - `landingStats(from: string, to: string): Promise<LandingStats>`, kus
    ```ts
    type LandingStats = {
      from: string; to: string;
      daily: { day: string; visitors: number; views: number }[];
      sources: { source: string; visitors: number }[];
      devices: { device: string; visitors: number }[];
      bots: { visitorClass: string; botName: string; hits: number; llmsTxtHits: number; lastSeen: string }[];
      funnel: { viewed: number; clicked: number; submitted: number };
    }
    ```
  - `listInterest(status: string | null): Promise<InterestRow[]>` (`InterestRow` = `InterestRequest` väljad, kuupäevad ISO stringina)
  - `parseInterestPatch(body: any): { ok: true; data: { status?: 'NEW'|'CONTACTED'|'CLOSED'; notes?: string | null } } | { ok: false; error: string }`
  - `updateInterest(id: string, data, platformUserId: string): Promise<InterestRow | null>`
  - `deleteInterest(id: string, platformUserId: string): Promise<boolean>`
  - Teekonnad: `GET /api/platform/landing/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/platform/interest?status=…`, `PATCH|DELETE /api/platform/interest/:id`
  - Auditi tegevused: `INTEREST_UPDATE` (`details: { id, status }`), `INTEREST_DELETE` (`details: { id }`) — isikuandmeid auditisse ei kirjutata.

- [ ] **Step 1: Kirjuta failivad testid**

```ts
// src/server/landing/landingStats.test.ts — live-andmebaas; testiread kaugel tulevikus (2099), et päris andmeid mitte segada.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from '../db.ts';
import { landingStats, parseDay } from './landingStats.ts';

const TAG = `test-ls-${process.pid}`;
const base = { path: '/', device: 'desktop', utmCampaign: TAG };
const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  await authDb().landingEvent.createMany({
    data: [
      // päev 1: kaks inimest vaatavad, üks klõpsab ja saadab
      { ...base, ts: at('2099-01-01T08:00:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000001', referrerHost: 'google.com' },
      { ...base, ts: at('2099-01-01T08:01:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000001', referrerHost: 'google.com' },
      { ...base, ts: at('2099-01-01T09:00:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000002', device: 'mobile' },
      { ...base, ts: at('2099-01-01T09:01:00Z'), source: 'beacon', event: 'cta_click', target: 'hero', visitorClass: 'human', visitorHash: 'a000000000000002' },
      { ...base, ts: at('2099-01-01T09:02:00Z'), source: 'beacon', event: 'form_submit', visitorClass: 'human', visitorHash: 'a000000000000002' },
      // robotid
      { ...base, ts: at('2099-01-01T10:00:00Z'), source: 'server', event: 'hit', visitorClass: 'ai_bot', botName: 'GPTBot', visitorHash: 'b000000000000001' },
      { ...base, path: '/llms.txt', ts: at('2099-01-01T10:01:00Z'), source: 'server', event: 'hit', visitorClass: 'ai_bot', botName: 'GPTBot', visitorHash: 'b000000000000001' },
      // väljaspool perioodi
      { ...base, ts: at('2099-03-01T08:00:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000009' }
    ].map((r) => ({ referrerHost: null, botName: null, target: null, ...r }))
  });
});
afterAll(async () => {
  await authDb().landingEvent.deleteMany({ where: { utmCampaign: TAG } });
});

describe('parseDay', () => {
  it('kehtib ainult YYYY-MM-DD', () => {
    expect(parseDay('2099-01-01')).toBe('2099-01-01');
    expect(parseDay('2099-02-30')).toBeNull();
    expect(parseDay('01.01.2099')).toBeNull();
    expect(parseDay(null)).toBeNull();
  });
});

describe('landingStats', () => {
  it('päevad, allikad, seadmed, robotid ja lehter', async () => {
    const s = await landingStats('2099-01-01', '2099-01-31');
    expect(s.daily).toEqual([{ day: '2099-01-01', visitors: 2, views: 3 }]);
    expect(s.sources).toEqual(expect.arrayContaining([{ source: 'google.com', visitors: 1 }, { source: 'otse', visitors: 1 }]));
    expect(s.devices).toEqual(expect.arrayContaining([{ device: 'desktop', visitors: 1 }, { device: 'mobile', visitors: 1 }]));
    expect(s.bots).toEqual([{ visitorClass: 'ai_bot', botName: 'GPTBot', hits: 2, llmsTxtHits: 1, lastSeen: '2099-01-01T10:01:00.000Z' }]);
    expect(s.funnel).toEqual({ viewed: 2, clicked: 1, submitted: 1 });
  });
});
```

> Allikas = `utmSource` ?? `referrerHost` ?? `'otse'` (`utmCampaign` on testis ainult märgis, mitte allikas).

```ts
// src/server/landing/interestAdmin.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { authDb } from '../db.ts';
import { listInterest, parseInterestPatch, updateInterest, deleteInterest } from './interestAdmin.ts';

const EMAIL = `test-ia-${process.pid}@example.com`;
let platformUserId = '';

afterAll(async () => {
  await authDb().interestRequest.deleteMany({ where: { email: EMAIL } });
  await authDb().platformAuditLog.deleteMany({ where: { platformUserId, action: { in: ['INTEREST_UPDATE', 'INTEREST_DELETE'] } } });
  if (platformUserId) await authDb().platformUser.delete({ where: { id: platformUserId } });
});

describe('parseInterestPatch', () => {
  it('lubab ainult staatuse ja märkmed', () => {
    expect(parseInterestPatch({ status: 'CONTACTED' })).toEqual({ ok: true, data: { status: 'CONTACTED' } });
    expect(parseInterestPatch({ notes: '  helistan reedel ' })).toEqual({ ok: true, data: { notes: 'helistan reedel' } });
    expect(parseInterestPatch({ notes: '' })).toEqual({ ok: true, data: { notes: null } });
    expect(parseInterestPatch({ status: 'X' })).toEqual({ ok: false, error: 'Tundmatu staatus' });
    expect(parseInterestPatch({ notes: 'x'.repeat(4001) })).toEqual({ ok: false, error: 'Märkmed on liiga pikad (kuni 4000 märki)' });
    expect(parseInterestPatch({})).toEqual({ ok: false, error: 'Muudatus puudub' });
  });
});

describe('huviliste haldus', () => {
  it('nimekiri, staatuse muutus (closedAt), audit, kustutamine', async () => {
    platformUserId = (await authDb().platformUser.create({ data: { username: `test-ia-${process.pid}`, passwordHash: 'x', totpSecretEnc: 'x' } })).id;
    const row = await authDb().interestRequest.create({ data: { name: 'Test', email: EMAIL } });
    expect((await listInterest('NEW')).some((r) => r.id === row.id)).toBe(true);

    const closed = await updateInterest(row.id, { status: 'CLOSED' }, platformUserId);
    expect(closed?.status).toBe('CLOSED');
    expect(closed?.closedAt).not.toBeNull();
    const reopened = await updateInterest(row.id, { status: 'CONTACTED' }, platformUserId);
    expect(reopened?.closedAt).toBeNull();
    expect(await updateInterest('missing', { status: 'NEW' }, platformUserId)).toBeNull();

    expect(await deleteInterest(row.id, platformUserId)).toBe(true);
    expect(await deleteInterest(row.id, platformUserId)).toBe(false);
    const audit = await authDb().platformAuditLog.findMany({ where: { platformUserId } });
    expect(audit.map((a) => a.action).sort()).toEqual(['INTEREST_DELETE', 'INTEREST_UPDATE', 'INTEREST_UPDATE']);
    expect(JSON.stringify(audit)).not.toContain(EMAIL);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `srv 'npx vitest run src/server/landing/landingStats.test.ts src/server/landing/interestAdmin.test.ts'`
Expected: FAIL (moodulid puuduvad).

- [ ] **Step 3: Implementeeri `landingStats.ts`**

Veergude nimed on camelCase (Prisma ilma `@map`-ita) → SQL-is jutumärkides. Päevad Tallinna ajas.

```ts
// src/server/landing/landingStats.ts — landing'u statistika admin-vaatele (Tallinna päevade kaupa).
// Unikaalne külastaja = päevane visitorHash; perioodi lehter liidab päevad (sama inimene eri päevadel loetakse eraldi).
import { Prisma } from '@prisma/client';
import { authDb } from '../db.ts';

export type LandingStats = {
  from: string;
  to: string;
  daily: { day: string; visitors: number; views: number }[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  bots: { visitorClass: string; botName: string; hits: number; llmsTxtHits: number; lastSeen: string }[];
  funnel: { viewed: number; clicked: number; submitted: number };
};

export function parseDay(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

const n = (v: unknown) => Number(v ?? 0);

export async function landingStats(from: string, to: string): Promise<LandingStats> {
  const db = authDb();
  const day = Prisma.sql`("ts" AT TIME ZONE 'Europe/Tallinn')::date`;
  const inRange = Prisma.sql`${day} BETWEEN ${from}::date AND ${to}::date`;
  const humanViews = Prisma.sql`"source" = 'beacon' AND "visitorClass" = 'human' AND ${inRange}`;

  const [daily, sources, devices, bots, funnel] = await Promise.all([
    db.$queryRaw<{ day: string; visitors: bigint; views: bigint }[]>`
      SELECT to_char(${day}, 'YYYY-MM-DD') AS day, count(DISTINCT "visitorHash") AS visitors, count(*) AS views
      FROM landing_events WHERE "event" = 'view' AND ${humanViews} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ source: string; visitors: bigint }[]>`
      SELECT coalesce("utmSource", "referrerHost", 'otse') AS source, count(DISTINCT ("visitorHash", ${day})) AS visitors
      FROM landing_events WHERE "event" = 'view' AND ${humanViews} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    db.$queryRaw<{ device: string; visitors: bigint }[]>`
      SELECT "device", count(DISTINCT ("visitorHash", ${day})) AS visitors
      FROM landing_events WHERE "event" = 'view' AND ${humanViews} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ visitorClass: string; botName: string; hits: bigint; llmsTxtHits: bigint; lastSeen: Date }[]>`
      SELECT "visitorClass", coalesce("botName", 'muu') AS "botName", count(*) AS hits,
             count(*) FILTER (WHERE "path" = '/llms.txt') AS "llmsTxtHits", max("ts") AS "lastSeen"
      FROM landing_events WHERE "source" = 'server' AND "visitorClass" <> 'human' AND ${inRange}
      GROUP BY 1, 2 ORDER BY 3 DESC`,
    db.$queryRaw<{ viewed: bigint; clicked: bigint; submitted: bigint }[]>`
      SELECT count(DISTINCT ("visitorHash", ${day})) FILTER (WHERE "event" = 'view') AS viewed,
             count(DISTINCT ("visitorHash", ${day})) FILTER (WHERE "event" = 'cta_click') AS clicked,
             count(DISTINCT ("visitorHash", ${day})) FILTER (WHERE "event" = 'form_submit') AS submitted
      FROM landing_events WHERE ${humanViews}`
  ]);

  return {
    from,
    to,
    daily: daily.map((r) => ({ day: r.day, visitors: n(r.visitors), views: n(r.views) })),
    sources: sources.map((r) => ({ source: r.source, visitors: n(r.visitors) })),
    devices: devices.map((r) => ({ device: r.device, visitors: n(r.visitors) })),
    bots: bots.map((r) => ({ visitorClass: r.visitorClass, botName: r.botName, hits: n(r.hits), llmsTxtHits: n(r.llmsTxtHits), lastSeen: r.lastSeen.toISOString() })),
    funnel: { viewed: n(funnel[0]?.viewed), clicked: n(funnel[0]?.clicked), submitted: n(funnel[0]?.submitted) }
  };
}
```

- [ ] **Step 4: Implementeeri `interestAdmin.ts`**

```ts
// src/server/landing/interestAdmin.ts — huviliste haldus admin.teris.ee-s. Auditisse läheb ainult id ja staatus.
import type { InterestRequest } from '@prisma/client';
import { authDb } from '../db.ts';

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED'] as const;
type Status = (typeof STATUSES)[number];
type Patch = { status?: Status; notes?: string | null };

const toRow = (r: InterestRequest) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  closedAt: r.closedAt?.toISOString() ?? null
});
export type InterestRow = ReturnType<typeof toRow>;

export async function listInterest(status: string | null): Promise<InterestRow[]> {
  const where = status && STATUSES.includes(status as Status) ? { status: status as Status } : {};
  return (await authDb().interestRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 })).map(toRow);
}

export function parseInterestPatch(body: any): { ok: true; data: Patch } | { ok: false; error: string } {
  const data: Patch = {};
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { ok: false, error: 'Tundmatu staatus' };
    data.status = body.status;
  }
  if (body?.notes !== undefined) {
    const notes = body.notes == null ? '' : String(body.notes).trim();
    if (notes.length > 4000) return { ok: false, error: 'Märkmed on liiga pikad (kuni 4000 märki)' };
    data.notes = notes || null;
  }
  if (!Object.keys(data).length) return { ok: false, error: 'Muudatus puudub' };
  return { ok: true, data };
}

export async function updateInterest(id: string, patch: Patch, platformUserId: string): Promise<InterestRow | null> {
  const db = authDb();
  return db.$transaction(async (tx) => {
    const current = await tx.interestRequest.findUnique({ where: { id } });
    if (!current) return null;
    const closedAt = patch.status === undefined ? undefined : patch.status === 'CLOSED' ? (current.closedAt ?? new Date()) : null;
    const row = await tx.interestRequest.update({ where: { id }, data: { ...patch, ...(closedAt !== undefined ? { closedAt } : {}) } });
    await tx.platformAuditLog.create({ data: { action: 'INTEREST_UPDATE', platformUserId, details: { id, status: row.status } } });
    return toRow(row);
  });
}

export async function deleteInterest(id: string, platformUserId: string): Promise<boolean> {
  return authDb().$transaction(async (tx) => {
    const { count } = await tx.interestRequest.deleteMany({ where: { id } });
    if (count) await tx.platformAuditLog.create({ data: { action: 'INTEREST_DELETE', platformUserId, details: { id } } });
    return count > 0;
  });
}
```

- [ ] **Step 5: Ühenda `platformApi.ts`**

Importid:

```ts
import { landingStats, parseDay } from './landing/landingStats.ts';
import { listInterest, parseInterestPatch, updateInterest, deleteInterest } from './landing/interestAdmin.ts';
```

Konstandid failis ülal (`TENANT_ROUTE` juurde):

```ts
const INTEREST_ROUTE = /^\/api\/platform\/interest\/([^/]+)$/;
const INTEREST_NOT_FOUND = 'Huvilist ei leitud';
```

`route`-is `help` haru järele:

```ts
  if (pathname === '/api/platform/landing/stats' && method === 'GET') {
    const from = parseDay(url.searchParams.get('from'));
    const to = parseDay(url.searchParams.get('to'));
    if (!from || !to || from > to) throw new HttpError(400, 'Vigane periood (YYYY-MM-DD)');
    return json(res, await landingStats(from, to));
  }
  if (pathname === '/api/platform/interest' && method === 'GET') return json(res, await listInterest(url.searchParams.get('status')));
  const ir = INTEREST_ROUTE.exec(pathname);
  if (ir) {
    const id = decodeId(ir[1], INTEREST_NOT_FOUND);
    if (method === 'PATCH') {
      const p = parseInterestPatch(await readBody(req));
      if (!p.ok) throw new HttpError(400, p.error);
      const row = await updateInterest(id, p.data, pu.id);
      if (!row) throw new HttpError(404, INTEREST_NOT_FOUND);
      return json(res, row);
    }
    if (method === 'DELETE') {
      if (!(await deleteInterest(id, pu.id))) throw new HttpError(404, INTEREST_NOT_FOUND);
      return json(res, { success: true });
    }
  }
```

(`decodeId` ja `readBody` on `platformApi.ts`-is juba olemas.)

- [ ] **Step 6: Käivita — peab läbima**

Run: `srv 'npx vitest run src/server/landing/landingStats.test.ts src/server/landing/interestAdmin.test.ts src/server/platformApi.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/landing/landingStats.ts src/server/landing/landingStats.test.ts src/server/landing/interestAdmin.ts src/server/landing/interestAdmin.test.ts src/server/platformApi.ts
git commit -m "Platvorm: landing'u statistika ja huviliste haldus (auditiga)"
```

---

### Task 11: Admin-vaated „Landing“ ja „Huvilised“

**Files:**
- Create: `src/admin/LandingStatsView.tsx`, `src/admin/InterestView.tsx`
- Modify: `src/admin/platformApi.ts`, `src/admin/AdminApp.tsx`, `src/admin/AuditView.tsx` (`ACTIONS`), `src/admin/admin.css`

**Interfaces:**
- Consumes: Task 10 teekonnad ja tüübid; `DateInput` (`src/components/DateInput.tsx`, väärtus ISO `YYYY-MM-DD`); `formatTallinn`, `formatDate` (`src/admin/format.ts`); `tallinnToday`-ga samaväärne kliendis: `new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(d)`.
- Produces: admin-menüüs nupud „Landing“ ja „Huvilised“.

- [ ] **Step 1: Lisa kliendi tüübid ja meetodid `src/admin/platformApi.ts`-i**

Tüübid (`HelpArticleRow` järele):

```ts
export interface LandingStats {
  from: string;
  to: string;
  daily: { day: string; visitors: number; views: number }[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  bots: { visitorClass: string; botName: string; hits: number; llmsTxtHits: number; lastSeen: string }[];
  funnel: { viewed: number; clicked: number; submitted: number };
}

export type InterestStatus = 'NEW' | 'CONTACTED' | 'CLOSED';
export const INTEREST_STATUS_LABELS: Record<InterestStatus, string> = { NEW: 'Uus', CONTACTED: 'Võetud ühendust', CLOSED: 'Suletud' };

export interface InterestRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  areaHa: number | null;
  message: string | null;
  status: InterestStatus;
  notes: string | null;
  closedAt: string | null;
  utmSource: string | null;
  referrerHost: string | null;
}
```

`platformApi` objekti lõppu:

```ts
  landingStats: (from: string, to: string) => request<LandingStats>('GET', `/landing/stats?from=${enc(from)}&to=${enc(to)}`),
  listInterest: (status?: InterestStatus) => request<InterestRow[]>('GET', `/interest${status ? `?status=${status}` : ''}`),
  updateInterest: (id: string, patch: { status?: InterestStatus; notes?: string | null }) => request<InterestRow>('PATCH', `/interest/${enc(id)}`, patch),
  deleteInterest: (id: string) => request<unknown>('DELETE', `/interest/${enc(id)}`)
```

- [ ] **Step 2: Loo `LandingStatsView.tsx`**

```tsx
// src/admin/LandingStatsView.tsx — landing'u külastused, allikad, robotid ja lehter valitud perioodil.
import { useEffect, useState } from 'react';
import { platformApi, type LandingStats } from './platformApi.ts';
import { DateInput } from '../components/DateInput.tsx';
import { formatDate, formatTallinn } from './format.ts';

const tallinnDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(d);
const CLASS_LABELS: Record<string, string> = { ai_bot: 'AI', search_bot: 'Otsing', other_bot: 'Muu' };
const DEVICE_LABELS: Record<string, string> = { desktop: 'Arvuti', mobile: 'Telefon', tablet: 'Tahvel' };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '–');

export function LandingStatsView() {
  const [from, setFrom] = useState(() => tallinnDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => tallinnDay(new Date()));
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setError('');
    platformApi
      .landingStats(from, to)
      .then((s) => !cancelled && setStats(s))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const totalVisitors = stats?.daily.reduce((s, d) => s + d.visitors, 0) ?? 0;
  const totalViews = stats?.daily.reduce((s, d) => s + d.views, 0) ?? 0;

  return (
    <div className="glass-card admin-card">
      <h2>Landing</h2>
      <div className="admin-filter-row">
        <label htmlFor="ls-from">Alates</label>
        <DateInput id="ls-from" className="form-input" value={from} onChange={setFrom} />
        <label htmlFor="ls-to">Kuni</label>
        <DateInput id="ls-to" className="form-input" value={to} onChange={setTo} />
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {stats && (
        <>
          <div className="admin-stat-row">
            <div className="admin-stat"><span>Külastajad</span><strong>{totalVisitors}</strong></div>
            <div className="admin-stat"><span>Vaatamised</span><strong>{totalViews}</strong></div>
            <div className="admin-stat"><span>„Tunnen huvi“ klõps</span><strong>{stats.funnel.clicked}</strong><small>{pct(stats.funnel.clicked, stats.funnel.viewed)}</small></div>
            <div className="admin-stat"><span>Saadetud vorm</span><strong>{stats.funnel.submitted}</strong><small>{pct(stats.funnel.submitted, stats.funnel.viewed)}</small></div>
          </div>

          <h3>Päevad</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Päev</th><th>Külastajad</th><th>Vaatamised</th></tr></thead>
              <tbody>
                {stats.daily.length === 0 && <tr><td colSpan={3}>Külastusi pole</td></tr>}
                {stats.daily.map((d) => <tr key={d.day}><td>{formatDate(d.day)}</td><td>{d.visitors}</td><td>{d.views}</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="admin-two-col">
            <div>
              <h3>Allikad</h3>
              <table className="admin-table">
                <thead><tr><th>Allikas</th><th>Külastajad</th></tr></thead>
                <tbody>{stats.sources.map((s) => <tr key={s.source}><td>{s.source}</td><td>{s.visitors}</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              <h3>Seadmed</h3>
              <table className="admin-table">
                <thead><tr><th>Seade</th><th>Külastajad</th></tr></thead>
                <tbody>{stats.devices.map((d) => <tr key={d.device}><td>{DEVICE_LABELS[d.device] ?? d.device}</td><td>{d.visitors}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <h3>Robotid ja AI-roomajad</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Tüüp</th><th>Nimi</th><th>Päringuid</th><th>llms.txt</th><th>Viimati</th></tr></thead>
              <tbody>
                {stats.bots.length === 0 && <tr><td colSpan={5}>Roboteid pole</td></tr>}
                {stats.bots.map((b) => (
                  <tr key={`${b.visitorClass}-${b.botName}`}>
                    <td>{CLASS_LABELS[b.visitorClass] ?? b.visitorClass}</td><td>{b.botName}</td><td>{b.hits}</td><td>{b.llmsTxtHits}</td><td>{formatTallinn(b.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Loo `InterestView.tsx`**

```tsx
// src/admin/InterestView.tsx — „Tunnen huvi“ päringud: staatus, märkmed, kustutamine (GDPR).
import { useCallback, useEffect, useState } from 'react';
import { platformApi, INTEREST_STATUS_LABELS, type InterestRow, type InterestStatus } from './platformApi.ts';
import { formatTallinn } from './format.ts';

const STATUSES = Object.keys(INTEREST_STATUS_LABELS) as InterestStatus[];

export function InterestView() {
  const [filter, setFilter] = useState<InterestStatus | ''>('');
  const [rows, setRows] = useState<InterestRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    platformApi
      .listInterest(filter || undefined)
      .then((r) => {
        setRows(r);
        setNotes(Object.fromEntries(r.map((x) => [x.id, x.notes ?? ''])));
      })
      .catch((err) => setError((err as Error).message));
  }, [filter]);
  useEffect(load, [load]);

  const patch = async (id: string, p: { status?: InterestStatus; notes?: string | null }) => {
    try {
      const row = await platformApi.updateInterest(id, p);
      setRows((list) => list?.map((r) => (r.id === id ? row : r)) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (row: InterestRow) => {
    if (!window.confirm(`Kustuta ${row.name} päring jäädavalt?`)) return;
    try {
      await platformApi.deleteInterest(row.id);
      setRows((list) => list?.filter((r) => r.id !== row.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="glass-card admin-card">
      <h2>Huvilised</h2>
      <div className="admin-filter-row">
        <label htmlFor="interest-filter">Staatus</label>
        <select id="interest-filter" className="form-input" value={filter} onChange={(e) => setFilter(e.target.value as InterestStatus | '')}>
          <option value="">Kõik</option>
          {STATUSES.map((s) => <option key={s} value={s}>{INTEREST_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Aeg</th><th>Kontakt</th><th>Ettevõte / pind</th><th>Sõnum</th><th>Allikas</th><th>Staatus</th><th>Märkmed</th><th /></tr></thead>
          <tbody>
            {rows?.length === 0 && <tr><td colSpan={8}>Päringuid pole</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id}>
                <td>{formatTallinn(r.createdAt)}</td>
                <td>
                  {r.name}<br />
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone && <><br /><a href={`tel:${r.phone}`}>{r.phone}</a></>}
                </td>
                <td>{r.company ?? '–'}{r.areaHa != null && <><br />{r.areaHa} ha</>}</td>
                <td className="admin-interest-message">{r.message ?? ''}</td>
                <td>{r.utmSource ?? r.referrerHost ?? 'otse'}</td>
                <td>
                  <select className="form-input" value={r.status} onChange={(e) => void patch(r.id, { status: e.target.value as InterestStatus })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{INTEREST_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    onBlur={() => (notes[r.id] ?? '') !== (r.notes ?? '') && void patch(r.id, { notes: notes[r.id] })}
                  />
                </td>
                <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => void remove(r)}>Kustuta</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ühenda `AdminApp.tsx`, `AuditView.tsx`, `admin.css`**

`AdminApp.tsx`: importi `LandingStatsView`, `InterestView`; `View` tüüpi lisa `| { kind: 'landing' } | { kind: 'interest' }`; „Ettevõtted“ nupu `active` tingimus: `!['audit', 'catalog', 'devices', 'help', 'landing', 'interest'].includes(view.kind)`; lisa enne „Logi“ nuppu:

```tsx
        <button type="button" className={`btn btn-secondary ${view.kind === 'landing' ? 'active' : ''}`} onClick={() => setView({ kind: 'landing' })}>
          Landing
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'interest' ? 'active' : ''}`} onClick={() => setView({ kind: 'interest' })}>
          Huvilised
        </button>
```

ja sisu alla: `{view.kind === 'landing' && <LandingStatsView />}` ning `{view.kind === 'interest' && <InterestView />}`.

`AuditView.tsx` `ACTIONS`-i: `INTEREST_UPDATE: 'Huvilise staatus muudetud'`, `INTEREST_DELETE: 'Huviline kustutatud'`; `detailsText`-i: `case 'INTEREST_UPDATE': return String(d.status ?? '');`.

`src/admin/admin.css` lõppu:

```css
.admin-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 12px; }
.admin-filter-row .form-input { width: auto; }
.admin-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
.admin-stat { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--border-card); border-radius: 10px; }
.admin-stat span { font-size: 0.72rem; text-transform: uppercase; color: var(--text-secondary); }
.admin-stat strong { font-size: 1.4rem; }
.admin-stat small { color: var(--text-secondary); }
.admin-card h3 { font-size: 0.9rem; margin: 16px 0 8px; }
.admin-two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.admin-interest-message { max-width: 320px; white-space: pre-wrap; }
```

- [ ] **Step 5: Tüübikontroll ja proov**

Run: `srv 'npx tsc --noEmit -p tsconfig.app.json'`
Expected: vigu pole.
Arendusserveris (`http://localhost:5173/admin.html`, platvormi kasutajaga): „Landing“ näitab perioodi tabeleid (kuupäevad `pp.kk.aaaa`); „Huvilised“ näitab Task 7 testist üle jäänud ridu (kui on), staatuse muutus ja märkme salvestus töötavad, kustutamine küsib kinnitust; „Logi“ näitab `Huvilise staatus muudetud`.

- [ ] **Step 6: Commit**

```bash
git add src/admin/LandingStatsView.tsx src/admin/InterestView.tsx src/admin/platformApi.ts src/admin/AdminApp.tsx src/admin/AuditView.tsx src/admin/admin.css
git commit -m "Admin: Landing statistika ja Huvilised vaated"
```

---

### Task 12: Juurutus (kasutaja teeb live'i sammud)

**Files:**
- Create: `public/landing/hero.webp`, `public/og-teris.png` (ekraanipildid demo-tenandist)
- Modify: `src/landing/content.et.ts` (kasutaja toimetus)

- [ ] **Step 1: Varukoopia ja skeem (kasutaja, kui Task 1 juures veel tegemata)**

Skeemi push ja õiguste skript (`04-privileges.sql`) on juba 2026-10-19 live-andmebaasis rakendatud; jäänud on ainult kontroll.

```bash
cd /home/debian/teris && set -a && . ./.env && set +a
pg_dump "${MIGRATE_DATABASE_URL%%\?*}" -Fc -f ~/db_backups/teris_db_$(date +%Y%m%d_%H%M%S).dump
npx prisma db push && npx prisma generate
psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql
```

Kontroll: `psql "${DATABASE_URL%%\?*}" -c 'select count(*) from landing_events'` → `permission denied` (teris_app ei näe); `psql "${PLATFORM_DATABASE_URL%%\?*}" -c 'select count(*) from landing_events'` → `0`.

- [ ] **Step 2: `.env`**

Lisa `LANDING_NOTIFY_EMAIL=<kasutaja e-post>`.

- [ ] **Step 3: Ekraanipildid**

Demo-tenant sünteetiliste andmetega (päris ettevõtete andmeid avalikule lehele ei panda): kaardivaade põldude, külvikorra ja masinatega → `public/landing/hero.webp` (1200×750) ja jagamispilt `public/og-teris.png` (1200×630, logo + pealkiri). Kui demo-tenant puudub, loo see `npm run tenant`-iga ja impordi näidispõllud.

- [ ] **Step 4: Tekstide ülevaatus**

Kasutaja toimetab `src/landing/content.et.ts` (sh kontakt-e-post `info@teris.ee`, KKK vastused, privaatsusteade). Seejärel `srv 'npx vitest run src/landing/render.test.ts'` → PASS.

- [ ] **Step 5: Release (kasutaja)**

`npm run release` → `systemctl is-active teris` → `journalctl -u teris -n 30 --no-pager`.

- [ ] **Step 6: Live kontroll**

- `curl -s https://teris.ee/ | grep -c 'Tunnen huvi'` → ≥ 3;
- `curl -sI https://teris.ee/ | grep -i vary` → `Vary: Cookie`;
- `curl -s https://teris.ee/robots.txt`, `/llms.txt`, `/sitemap.xml` → sisu;
- `curl -sI https://admin.teris.ee/robots.txt` → 404 (platvormi hostil blokeeritud);
- brauseris sisselogitult `https://teris.ee/` → rakendus; välja logides → `/login`;
- testvorm landing'ult → rida „Huvilised“ vaates + e-kiri `LANDING_NOTIFY_EMAIL`-ile; kustuta testrida;
- „Landing“ vaates tekib vaatamine; Google Rich Results Test (`https://search.google.com/test/rich-results`) URL-ile `https://teris.ee/` → `FAQPage` ja `SoftwareApplication` tuvastatud.

- [ ] **Step 7: Commit ja push**

```bash
git add public/landing/hero.webp public/og-teris.png src/landing/content.et.ts
git commit -m "Landing: ekraanipildid ja toimetatud tekstid"
git push origin master
```
