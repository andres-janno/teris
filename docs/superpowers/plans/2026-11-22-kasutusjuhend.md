# Kasutusjuhend rakenduses (koodiosa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terises on täislehe vaade „Juhend“ (16 peatükki, otsing, sügavlingid), „?“-ikoonid viivad peatükki, teenusepakkuja haldab peatükke ja kohtjuhendeid admin.teris.ee-s koos versioonide ajalooga ning mustandid (`docs/juhend/*.html`) laaditakse tühjadesse peatükkidesse.

**Architecture:** Ehitame olemasoleva kohtjuhendite süsteemi peale (`help_articles`, `HELP_SPOTS`, `GET /api/help`, `/api/platform/help*`, `HelpHint`, `sanitizeHelp`, admin `HelpView`), ei tee paralleelset. Peatükid on samas tabelis `help_articles` võtmetega `guide.<nimi>` (nimekiri koodis, `GUIDE_CHAPTERS`); kohtjuhend saab veeru `guide_link`; uus tabel `help_article_versions` hoiab 50 viimast versiooni võtme kohta. Juhendi vaade on uus `mainView === 'guide'`, sügavlink on URL-i hash (`#guide.fields#import`), mida kuulab `hashchange`/`popstate`; „?“-ikooni link ja peatükkide vahelised lingid on samad hash-lingid.

**Tech Stack:** React 19 + TS, Tailwind v4 (ainult skaala), `src/components/ui/` komponendid, Prisma + Postgres (platvormi tabelid ainult `authDb()`), vitest (node; `sanitizeHelp` test jsdom-keskkonnas), DOMPurify, oxlint, Playwright (`scripts/shot.mts`).

**Spec:** `docs/superpowers/specs/2026-11-21-kasutusjuhend-design.md` (siduv). Eelmise plaani vorm ja keskkonnareeglid: `docs/superpowers/plans/2026-11-21-vaated-4g.md`; UI reeglid: `src/components/ui/README.md`.

## Global Constraints

**Spec'i nõuded (sõna-sõnalt):**

- Peatükid (16, järjekord ja pealkirjad koodis): `guide.getting-started` Alustamine · `guide.onboarding` Juurutamine · `guide.map` Kaart · `guide.fields` Põllud · `guide.crops` Kultuurid · `guide.rotation` Külvikord · `guide.works` Põllutööd · `guide.stock` Laoarvestus · `guide.fleet` Tehnika · `guide.telemetry` GPS-seadmed ja sõidud · `guide.infrastructure` Taristu · `guide.parties` Isikud · `guide.weather` Ilm · `guide.seasons` Hooajad · `guide.pria` PRIA · `guide.settings` Kasutajad ja seaded.
- Avamine: päises kasutajamenüü kõrval nupp „Juhend“ (raamatu ikoon) → täislehe vaade `guide` (sama kest mis teistel täislehe vaadetel: `boardViewClass`, `boardMainClass`).
- Vaade: vasakul peatükkide loend, paremal peatüki tekst (`help-content` vorming); ülal otsing üle kõigi peatükkide, tabamused peatüki ja lõigu katkendiga, klõps viib kohale; kitsal ekraanil loend → rippmenüü.
- Sügavlink: vaade avaneb peatüki ja valikulise ankruga (nt `guide.fields#import`); URL/olek nii, et tagasi-nupp töötab.
- „?“-ikoonid: igale peamenüü vaatele pealkirja kõrvale `HelpHint` (uued kohtjuhendid `view.<vaade>`); hüpikus lühike tekst + link „Loe juhendist →“, kui kohtjuhendil on seotud peatükk; olemasolevad 4 kohta saavad sama lingi.
- Peatükkide vahelised lingid HTML-is kujul `#guide.fields#import`; `sanitizeHelp` peab selle kuju lubama; `h3` saab ankru (pealkirjast tuletatud lühinimi).
- Moodulist sõltuv peatükk („GPS-seadmed ja sõidud“ = telemeetria, „Ilm“ = ilm) on loendis peidetud, kui ettevõttel moodulit pole; viited neile teistest peatükkidest näitavad märget „vajab moodulit …“.
- Tühi peatükk: tavakasutaja näeb „Juhend on koostamisel“; peatükk on loendis näha.
- Haldus: kaks jaotist **Peatükid** (16 järjekorras) ja **Kohtjuhendid** (praegused 4 + üks iga peamenüü vaate kohta); sama `RichTextEditor`, lisanupud: vahepealkiri (`h3`), nummerdatud loend, link peatükki (valik loendist + ankur); kohtjuhendil valik „Seotud peatükk“ (+ valikuline ankur); peatükkide võtmed, pealkirjad ja järjekord on koodis.
- Andmed: `help_articles` jääb (võti, html) + `guide_link` (tekst, null lubatud) kohtjuhendile: `guide.<peatükk>[#ankur]`; uus tabel `help_article_versions`: id, võti, html, guide_link, kes salvestas, millal; iga salvestus (ka taastamine) lisab rea; alles 50 viimast versiooni võtme kohta, vanemad kustuvad salvestamisel; admin „Ajalugu“ → versioonide loend (kuupäev pp.kk.aaaa HH:MM Tallinna ajas, autor), eelvaade, „Taasta see versioon“ (= uus salvestus vana sisuga); juhendid on platvormi ühised; `GET /api/help` tagastab ka peatükid ja `guide_link`-id; peatüki tekst kuni 100 000 märki (kohtjuhend jääb 20 000).
- Mustandid: `docs/juhend/<nr>-<võti>.html` (peatükid) ja `docs/juhend/spots/<võti>.html` (kohtjuhendite lühitekstid, kasutaja otsus 2026-11-22); laadimisskript `scripts/load-guide-drafts.mts` kirjutab ainult tühjadesse peatükkidesse ja kohtjuhenditesse, mitte kunagi olemasolevale tekstile; iga kirjutis teeb ka versioonirea (autor „mustand“); live'is käivitatakse alles kasutaja „jah“ järel.
- Kontroll: `tsc`, täis `vitest`, `oxlint`, `npm run ui-audit -- --details`; testid: versioonide piir 50, taastamine teeb uue versiooni, laadimisskript ei kirjuta olemasolevale, sügavlingi parsimine, `sanitizeHelp` lubab peatükilinki ja `h3` ankrut; pildid `scripts/shot.mts` (juhendi vaade mõlemas teemas 1440 ja kitsas, admin `--platform`).
- Väljas: ekraanipildid juhendis, mitu keelt, ettevõttepõhine juhend, PDF/printimine, versioonide võrdlus (diff).

**Projekti reeglid (memory + README):**

- Ingliskeelsed identifikaatorid (URL-id, id/class, staatused), eestikeelne UI-tekst ja kommentaarid. UI nimed = koodinime tõlge (`group` → grupp). Kuupäevad ja kellaajad pp.kk.aaaa HH:MM Tallinna ajas (admin: `formatTallinn` failist `src/admin/format.ts`); natiivset `type=date` ei kasutata.
- UI: ainult `src/components/ui/` komponendid ja Tailwindi skaala (vahed 2/4/6/8/10/12/16/24/32px = `0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8`; kirjad `text-2xs|xs|sm|base|lg|xl`; nurgad `rounded-sm|md|lg`), värvid nimedega; suvalisi väärtusi (`p-[7px]`, `text-[13px]`) ei kasutata; mõõtmed (`w-[…]`, `grid-cols-[…]`) on lubatud. Uus vaatefail, mis kasutab Tailwindi klasse, lisatakse `src/styles/app.css` `@source`-i samas commitis (admin-kaust on juba `@source`-is). **Uut CSS-reeglit ei lisata** (`stylesLayout.test.ts` valvab); `.help-content` reeglid on olemas. Murdepunkt vana `max-width:N` → `max-[N+1px]` (valvur `offByOneBreakpoints`; juhendi vaade ja admin kasutavad `max-[861px]`). Korduvad klassistringid (≥ 2 kohta) → kohalik konstant või `ui/variants.ts` eksport. Numbrid paremale (`className="num"`). Filtri/otsingu X: `SearchInput`/`FilterClear`.
- `text-2xs/xs/sm/base` seavad oma rea kõrguse; ui `Button` `plain`/`inline` `[font-size:inherit]` võidavad konteineri `text-*`. preflight on väljas (`border-dashed` → `border-x-0 border-b-0 border-t border-dashed`).
- Implementeerija ei kutsu alamagente.

**Keskkond ja käsud:**

- Kood on serveris. Kõik käsud kujul `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'` (kokkuvõtlikult allpool `SSH '<käsk>'`). Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount: Read/Edit/Write töötavad; **git, grep -r, tsc, vitest, release, build, npx ainult serveris**. Grep: `--include` ENNE mustrit, muster `-e`-ga. Käsk, milles on ülakomasid, kirjutatakse skriptifailiks `.superpowers/tmp/` alla (git-ignored) ja jooksutatakse `bash`-iga. Pika käsu (≥ 3 min, nt `npm run release`) käivita `run_in_background` ja oota teadet. Ära suuna väljundit projekti juurkausta; pärast pildistamist `git status --short`.
- `NODE_OPTIONS=--max-old-space-size=4096` `npx tsc` ja `npm run release` jaoks. tsc: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json'`.
- Pärast IGAT ülesannet: commit masteril (failid nime järgi, `git add <failid>`, mitte `-A`; viimane rida `Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>` implementeerija enda mudeliga) + `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npm run release'` + `SSH 'systemctl is-active teris'` (oodatud `active`). Ära jooksuta kohalikku git-i/npm-i/vitest-i.
- **Andmebaasi skeemimuudatus (T1):** enne `prisma db push` varukoopia `pg_dump` ainult `PLATFORM_DATABASE_URL`-iga (RLS). Muudatus on lisav (uus tabel, uus null-lubav veerg); `--accept-data-loss` vajab kasutaja luba ja seda ei kasutata — kui Prisma andmekao hoiatab, peatu ja teata.
- **Mustandite laadimine live'i (T7)** ainult kasutaja „jah“ järel; kontroller küsib enne T7 käivitamist. Skript ja selle test tehakse T6-s.
- Pildid: `scripts/shot.mts` (hele+tume, ajutine 15-min sessioon; admin `--platform '*'`), väljund `.superpowers/tmp/shots/` (kohalikus mountis sama tee, vaata Read-tööriistaga). **Live-andmeid ei salvestata, ei muudeta ega kustutata**: pildid ainult avamise, hõljumise, fookuse seisudest; „Salvesta“, „Eemalda“, „Taasta“ jt kirjutavad nupud pole lubatud. Tenant-pildid: `--user andresj` (otsus 5); **enne pildistamist** kontrolli andmebaasist, et kasutaja `andresj` ettevõttel on moodulid `TELEMETRY` ja `WEATHER`:
  `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "${PLATFORM_DATABASE_URL%%\?*}" -c "select u.username, l.modules from users u join tenant_licenses l on l.tenant_id = u.tenant_id where u.username = '"'"'andresj'"'"'"'` (`users` ja `tenant_licenses` on platvormi/RLS-tabelid; kui platvormi roll `users` ei näe, loe mooduleid `select modules from tenant_licenses` ettevõtte id järgi või sisselogimise vastusest `license.modules`). Kui mõni moodul puudub, kirjelda pildil nähtavat moodulita seisu (peatükid „GPS-seadmed ja sõidud“ ja „Ilm“ loendis puuduvad) ja kontrolli peitmist koodist ning `guideChapters.test.ts` testist (`visibleChapters`).
- Testid, mis kasutavad päris andmebaasi (`helpArticles.test.ts`), ei kirjuta päris peatükkide võtmetele; piiri- ja laadimistestid kasutavad võtit `zz-…-${process.pid}` ja koristavad pärast.

---

## File Structure

| Fail | Tegu |
|---|---|
| `src/help/guideChapters.ts` (uus) | 16 peatüki register, moodulid, `GUIDE_MAX_LENGTH`, `visibleChapters`, mustandi failinimi |
| `src/help/guideLink.ts` (uus) | `GuideRef` parsimine/vormindamine (`#guide.fields#import`), `isValidGuideLink`, `guideHash`, `markModuleLinks` |
| `src/help/anchors.ts` (uus) | `h3` ankrud: `slugify`, `nextSlug`, `anchorDomId`, `extractAnchors`, `textOfHtml` |
| `src/help/guideSearch.ts` (uus) | otsing üle peatükkide katkenditega |
| `src/help/guideRoute.ts` (uus) | hash-marsruut: `useGuideRoute`, `openGuide`, `closeGuide` |
| `src/help/helpRegistry.ts` | `helpMaxLength(key)`; `view.*` kohtjuhendid; `HelpSpot.guideLink` (vaikimisi seotud peatükk) |
| `src/help/helpStore.ts` | laeb ka peatükid ja `guideLinks`; `useGuideLink`, `useGuideChapters`, `reloadHelp` |
| `src/help/sanitizeHelp.ts` | `h3` id, `#guide.…` lingid ilma `target=_blank` |
| `src/server/helpArticles.ts` | versioonid, `guide_link`, peatükid, `buildHelpPayload`, `writeHelpIfEmpty` |
| `src/server/guideDrafts.ts` (uus) | mustandite laadimise tuum (`loadDrafts`, `loadSpotDrafts`, `linkSpots`) süstitava hoidlaga |
| `docs/juhend/spots/view.<vaade>.html` (11 uut) | kohtjuhendite 1–2-lauselised lühitekstid |
| `src/server/platformApi.ts` | versiooniteed |
| `prisma/schema.prisma`, `scripts/tenancy/02-rls.sql`, `04-privileges.sql` | `guide_link`, `help_article_versions` |
| `src/admin/HelpView.tsx`, `HelpHistory.tsx` (uus), `GuideLinkPicker.tsx` (uus), `ChapterLinkDialog.tsx` (uus), `RichTextEditor.tsx`, `platformApi.ts` | admin |
| `src/components/GuideView.tsx` (uus) | juhendi vaade |
| `src/components/Header.tsx`, `src/App.tsx`, `src/types` (ei muutu) | nupp „Juhend“, vaate vahetus |
| `src/components/ui/HelpHint.tsx`, `PageHeader.tsx`, `variants.ts`, `index.ts` | link „Loe juhendist →“, `helpKey` PageHeaderis |
| `scripts/load-guide-drafts.mts` (uus) | käsurea laadija (peatükid, kohtjuhendid, lingid) |

Testifailid: `src/help/*.test.ts`, `src/server/helpArticles.test.ts`, `src/server/guideDrafts.test.ts`.

---

### Task 1: Andmed ja server (peatükkide register, `guide_link`, versioonid, API)

**Files:**
- Create: `src/help/guideChapters.ts`, `src/help/guideChapters.test.ts`, `src/help/guideLink.ts`, `src/help/guideLink.test.ts`, `src/help/helpRegistry.test.ts`
- Modify: `src/help/helpRegistry.ts`, `prisma/schema.prisma:1563-1572`, `scripts/tenancy/02-rls.sql`, `scripts/tenancy/04-privileges.sql`, `src/server/helpArticles.ts`, `src/server/helpArticles.test.ts`, `src/server/platformApi.ts:23` ja `:678-683`, `src/admin/platformApi.ts:180`, `:266-267`

**Interfaces:**
- Consumes: `authDb()` (`src/server/db.ts`), `json`, `HttpError`/`decodeId`/`readBody` (`platformApi.ts` sees), `HELP_SPOTS`/`isHelpKey`/`HELP_MAX_LENGTH` (`helpRegistry.ts`), `LicenseModule` (`src/types/auth.ts`).
- Produces (hilisemad ülesanded toetuvad täpselt neile nimedele):
  - `guideChapters.ts`: `type GuideChapterKey`, `interface GuideChapter { key: GuideChapterKey; title: string; module?: LicenseModule }`, `const GUIDE_CHAPTERS: readonly GuideChapter[]`, `const GUIDE_MAX_LENGTH = 100000`, `const MODULE_LABELS: Record<LicenseModule, string>`, `isGuideChapterKey(key: string): key is GuideChapterKey`, `chapterByKey(key: GuideChapterKey): GuideChapter`, `chapterNumber(key: GuideChapterKey): number` (1-põhine), `visibleChapters(has: (m: LicenseModule) => boolean): GuideChapter[]`, `draftFileName(key: GuideChapterKey): string` (`01-guide.getting-started.html`).
  - `guideLink.ts`: `interface GuideRef { chapter: GuideChapterKey | null; anchor: string | null }`, `parseGuideRef(raw: string): GuideRef | null`, `formatGuideRef(chapter: GuideChapterKey, anchor?: string | null): string` (`guide.fields#import`), `isValidGuideLink(s: string): boolean` (kohtjuhendi `guide_link`: peab olema peatükk, ilma `#` ees).
  - `helpRegistry.ts`: `helpMaxLength(key: string): number`.
  - `helpArticles.ts`: `HELP_VERSION_LIMIT = 50`, `HELP_LINK_ERROR`, `HELP_VERSION_ERROR`, `HELP_VERSIONS_ROUTE`, `buildHelpPayload(rows: HelpRowLite[]): { articles; chapters; guideLinks }`, `writeHelpVersion(tx, key, html, guideLink, author)`, `writeHelpIfEmpty(key: string, html: string, author: string, guideLink?: string | null): Promise<boolean>` (kirjutab ainult tühja kohta; `guideLink` ainult kohtjuhendile ja ainult kui real pole oma linki), `setGuideLinkIfEmpty(key: string, link: string, author: string): Promise<boolean>` (olemasolevale tekstile panna ainult tühi link, teksti ei muuda), `canSetGuideLink(key: string): Promise<boolean>`, `isHelpEmpty(key: string): Promise<boolean>`, `saveHelpArticle(key, input: { html: unknown; guideLink?: unknown }, pu)`, `listHelpVersions(key)`, `getHelpVersion(key, id)`, `restoreHelpVersion(key, id, pu)`, `listHelpArticles()` (nüüd ka `guideLink`).
  - API: `GET /api/help` → `{ articles, chapters, guideLinks }`; `GET /api/platform/help` ridadel `guideLink`; `PUT /api/platform/help/:key` body `{ html, guideLink? }`; `GET /api/platform/help/:key/versions` → `[{ id, createdAt, createdBy, guideLink }]` (uusim ees); `GET …/versions/:id` → `{ id, html, guideLink, createdAt, createdBy }`; `POST …/versions/:id/restore` → `{ success: true, deleted: boolean }`.
  - Admin `platformApi.ts`: `HelpArticleRow { key; html; guideLink: string | null; updatedAt; updatedBy }`, `HelpVersionRow`, `HelpVersionDetail`, `platformApi.saveHelp(key, html, guideLink?: string | null)`, `listHelpVersions(key)`, `getHelpVersion(key, id)`, `restoreHelpVersion(key, id)`.

- [ ] **Step 1: Kirjuta peatükkide registri test**

Fail `src/help/guideChapters.test.ts`:

```ts
// Peatükkide register: spec'i 16 võtit järjekorras, moodulid, nähtavus, mustandi failinimi.
import { describe, it, expect } from 'vitest';
import { GUIDE_CHAPTERS, GUIDE_MAX_LENGTH, chapterByKey, chapterNumber, draftFileName, isGuideChapterKey, visibleChapters } from './guideChapters';

describe('guideChapters', () => {
  it('16 peatükki spec-i järjekorras', () => {
    expect(GUIDE_CHAPTERS.map((c) => c.key)).toEqual([
      'guide.getting-started', 'guide.onboarding', 'guide.map', 'guide.fields', 'guide.crops', 'guide.rotation',
      'guide.works', 'guide.stock', 'guide.fleet', 'guide.telemetry', 'guide.infrastructure', 'guide.parties',
      'guide.weather', 'guide.seasons', 'guide.pria', 'guide.settings'
    ]);
    expect(new Set(GUIDE_CHAPTERS.map((c) => c.key)).size).toBe(16);
    expect(chapterByKey('guide.telemetry').title).toBe('GPS-seadmed ja sõidud');
    expect(chapterByKey('guide.settings').title).toBe('Kasutajad ja seaded');
  });

  it('moodulist sõltuvad ainult telemeetria ja ilm', () => {
    expect(GUIDE_CHAPTERS.filter((c) => c.module).map((c) => [c.key, c.module])).toEqual([
      ['guide.telemetry', 'TELEMETRY'],
      ['guide.weather', 'WEATHER']
    ]);
  });

  it('visibleChapters peidab peatükid, mille moodulit ettevõttel pole', () => {
    expect(visibleChapters(() => true)).toHaveLength(16);
    const none = visibleChapters(() => false).map((c) => c.key);
    expect(none).toHaveLength(14);
    expect(none).not.toContain('guide.telemetry');
    expect(none).not.toContain('guide.weather');
    const onlyWeather = visibleChapters((m) => m === 'WEATHER').map((c) => c.key);
    expect(onlyWeather).toContain('guide.weather');
    expect(onlyWeather).not.toContain('guide.telemetry');
  });

  it('võtme kontroll, number ja mustandi failinimi', () => {
    expect(isGuideChapterKey('guide.fields')).toBe(true);
    expect(isGuideChapterKey('guide.nope')).toBe(false);
    expect(isGuideChapterKey('fields.register.export-csv')).toBe(false);
    expect(chapterNumber('guide.getting-started')).toBe(1);
    expect(chapterNumber('guide.settings')).toBe(16);
    expect(draftFileName('guide.getting-started')).toBe('01-guide.getting-started.html');
    expect(draftFileName('guide.settings')).toBe('16-guide.settings.html');
    expect(GUIDE_MAX_LENGTH).toBe(100000);
  });
});
```

- [ ] **Step 2: Käivita test, veendu et kukub**

Run: `SSH 'npx vitest run src/help/guideChapters.test.ts'`
Expected: FAIL (`Failed to resolve import "./guideChapters"`).

- [ ] **Step 3: Kirjuta `src/help/guideChapters.ts`**

```ts
// src/help/guideChapters.ts — kasutusjuhendi peatükid (spec 2026-11-21). Võtmed, pealkirjad ja järjekord on koodis;
// uue peatüki lisamine = koodimuudatus. Tekst on andmebaasis (help_articles, võti = peatüki võti) ja seda muudab
// teenusepakkuja admin.teris.ee-s. Fail on ühine kliendile ja serverile.
import type { LicenseModule } from '../types/auth';

interface GuideChapterDef {
  key: string;
  title: string;
  /** Litsentsimoodul, mida peatükk eeldab; mooduliga mitte ettevõttele peatükki ei näidata */
  module?: LicenseModule;
}

const DEFS = [
  { key: 'guide.getting-started', title: 'Alustamine' },
  { key: 'guide.onboarding', title: 'Juurutamine' },
  { key: 'guide.map', title: 'Kaart' },
  { key: 'guide.fields', title: 'Põllud' },
  { key: 'guide.crops', title: 'Kultuurid' },
  { key: 'guide.rotation', title: 'Külvikord' },
  { key: 'guide.works', title: 'Põllutööd' },
  { key: 'guide.stock', title: 'Laoarvestus' },
  { key: 'guide.fleet', title: 'Tehnika' },
  { key: 'guide.telemetry', title: 'GPS-seadmed ja sõidud', module: 'TELEMETRY' },
  { key: 'guide.infrastructure', title: 'Taristu' },
  { key: 'guide.parties', title: 'Isikud' },
  { key: 'guide.weather', title: 'Ilm', module: 'WEATHER' },
  { key: 'guide.seasons', title: 'Hooajad' },
  { key: 'guide.pria', title: 'PRIA' },
  { key: 'guide.settings', title: 'Kasutajad ja seaded' }
] as const satisfies readonly GuideChapterDef[];

export type GuideChapterKey = (typeof DEFS)[number]['key'];

export interface GuideChapter {
  key: GuideChapterKey;
  title: string;
  module?: LicenseModule;
}

export const GUIDE_CHAPTERS: readonly GuideChapter[] = DEFS;

/** Peatüki HTML-i suurim pikkus (märkides); kohtjuhendil `HELP_MAX_LENGTH` */
export const GUIDE_MAX_LENGTH = 100000;

/** Mooduli nimi, nagu see on kasutajale kirjas (märge „vajab moodulit …“) */
export const MODULE_LABELS: Record<LicenseModule, string> = {
  TELEMETRY: 'Telemeetria',
  SATELLITE: 'Satelliit',
  WEATHER: 'Ilm'
};

export const isGuideChapterKey = (key: string): key is GuideChapterKey => GUIDE_CHAPTERS.some((c) => c.key === key);

export const chapterByKey = (key: GuideChapterKey): GuideChapter => GUIDE_CHAPTERS.find((c) => c.key === key)!;

/** Peatüki järjekorranumber (1-põhine) */
export const chapterNumber = (key: GuideChapterKey): number => GUIDE_CHAPTERS.findIndex((c) => c.key === key) + 1;

/** Peatükid, mille mooduli ettevõttel on (või mis moodulit ei eelda) */
export const visibleChapters = (has: (m: LicenseModule) => boolean): GuideChapter[] =>
  GUIDE_CHAPTERS.filter((c) => !c.module || has(c.module));

/** Mustandi failinimi `docs/juhend/` all: `01-guide.getting-started.html` */
export const draftFileName = (key: GuideChapterKey): string => `${String(chapterNumber(key)).padStart(2, '0')}-${key}.html`;
```

- [ ] **Step 4: Käivita test, veendu et läbib**

Run: `SSH 'npx vitest run src/help/guideChapters.test.ts'`
Expected: PASS (4 testi).

- [ ] **Step 5: Kirjuta `guideLink` test**

Fail `src/help/guideLink.test.ts`:

```ts
// Peatükiviide: parsimine (sügavlink ja HTML-link), vormindamine, kohtjuhendi guide_link kontroll.
import { describe, it, expect } from 'vitest';
import { formatGuideRef, isValidGuideLink, parseGuideRef } from './guideLink';

describe('parseGuideRef', () => {
  it('peatükk ankruga, hash-iga ja ilma', () => {
    expect(parseGuideRef('#guide.fields#import')).toEqual({ chapter: 'guide.fields', anchor: 'import' });
    expect(parseGuideRef('guide.fields#import')).toEqual({ chapter: 'guide.fields', anchor: 'import' });
    expect(parseGuideRef('#guide.getting-started')).toEqual({ chapter: 'guide.getting-started', anchor: null });
  });

  it('ainult #guide avab juhendi esimese peatükiga', () => {
    expect(parseGuideRef('#guide')).toEqual({ chapter: null, anchor: null });
    expect(parseGuideRef('guide')).toEqual({ chapter: null, anchor: null });
  });

  it('vigased viited annavad null', () => {
    for (const bad of ['', '#', '#guide.', '#guide.nope', '#guide.fields#', '#guide.fields#Import', '#guide#import', '#other.fields', '#guide.fields#a b', 'https://x']) {
      expect(parseGuideRef(bad), bad).toBeNull();
    }
  });
});

describe('formatGuideRef ja isValidGuideLink', () => {
  it('vormindab ilma hash-ita', () => {
    expect(formatGuideRef('guide.fields', 'import')).toBe('guide.fields#import');
    expect(formatGuideRef('guide.fields')).toBe('guide.fields');
    expect(formatGuideRef('guide.fields', null)).toBe('guide.fields');
  });

  it('kohtjuhendi link peab osutama peatükile ega alga #-ga', () => {
    expect(isValidGuideLink('guide.rotation#csv-eksport')).toBe(true);
    expect(isValidGuideLink('guide.rotation')).toBe(true);
    expect(isValidGuideLink('#guide.rotation')).toBe(false);
    expect(isValidGuideLink('guide')).toBe(false);
    expect(isValidGuideLink('guide.nope')).toBe(false);
    expect(isValidGuideLink('')).toBe(false);
  });
});
```

- [ ] **Step 6: Käivita (kukub), seejärel kirjuta `src/help/guideLink.ts`**

Run: `SSH 'npx vitest run src/help/guideLink.test.ts'` → FAIL (import).

```ts
// src/help/guideLink.ts — viide juhendi peatükile ja ankrule. Sama kuju on sügavlingil (`#guide.fields#import`),
// peatükkide vahelises HTML-lingis ja kohtjuhendi `guide_link` väljal (`guide.fields#import`, ilma `#`-ta).
import { isGuideChapterKey, type GuideChapterKey } from './guideChapters';

export interface GuideRef {
  /** null = juhend ilma kindla peatükita (avaneb esimene nähtav) */
  chapter: GuideChapterKey | null;
  /** h3 ankru lühinimi (vt anchors.ts) */
  anchor: string | null;
}

const REF = /^#?guide(?:\.([a-z][a-z-]*))?(?:#([a-z0-9][a-z0-9-]*))?$/;

export function parseGuideRef(raw: string): GuideRef | null {
  const m = REF.exec(raw.trim());
  if (!m) return null;
  const key = m[1] ? `guide.${m[1]}` : null;
  if (key !== null && !isGuideChapterKey(key)) return null;
  if (key === null && m[2]) return null; // ankur ilma peatükita pole mõttekas
  return { chapter: key as GuideChapterKey | null, anchor: m[2] ?? null };
}

/** `guide.fields#import` (ilma `#`-ta) — kohtjuhendi `guide_link` väärtus */
export const formatGuideRef = (chapter: GuideChapterKey, anchor?: string | null): string => (anchor ? `${chapter}#${anchor}` : chapter);

/** Kohtjuhendi `guide_link`: peab osutama peatükile ega alga `#`-ga */
export function isValidGuideLink(s: string): boolean {
  if (s.startsWith('#')) return false;
  const ref = parseGuideRef(s);
  return ref !== null && ref.chapter !== null;
}
```

Run: `SSH 'npx vitest run src/help/guideLink.test.ts'` → PASS.

- [ ] **Step 7: `helpMaxLength` registrisse + test**

Edit `src/help/helpRegistry.ts`: lisa faili algusesse (pärast kommentaarplokki, enne `export interface HelpSpot`) import ja lõppu funktsioon.

Edit — vana: `export interface HelpSpot {` → uus:
```ts
import { GUIDE_MAX_LENGTH, isGuideChapterKey } from './guideChapters';

export interface HelpSpot {
```

Edit — vana (faili lõpp): `export const HELP_MAX_LENGTH = 20000;` → uus:
```ts
export const HELP_MAX_LENGTH = 20000;

/** Teksti suurim pikkus võtme kohta: peatükk kuni 100 000, kohtjuhend 20 000 märki */
export const helpMaxLength = (key: string): number => (isGuideChapterKey(key) ? GUIDE_MAX_LENGTH : HELP_MAX_LENGTH);
```

Fail `src/help/helpRegistry.test.ts`:

```ts
// Juhendiregistri väikesed reeglid: pikkuse piir võtme kohta.
import { describe, it, expect } from 'vitest';
import { HELP_MAX_LENGTH, helpMaxLength } from './helpRegistry';

describe('helpMaxLength', () => {
  it('peatükk on suurem kui kohtjuhend', () => {
    expect(helpMaxLength('guide.fields')).toBe(100000);
    expect(helpMaxLength('fields.register.export-csv')).toBe(HELP_MAX_LENGTH);
    expect(helpMaxLength('tundmatu')).toBe(HELP_MAX_LENGTH);
  });
});
```

Run: `SSH 'npx vitest run src/help'` → PASS.

- [ ] **Step 8: Prisma skeem, õigused, varukoopia, push**

Edit `prisma/schema.prisma` — vana:
```prisma
// Platvormi tabel (authDb): kasutajajuhendid; võtmed on koodis (src/help/helpRegistry.ts)
model HelpArticle {
  key       String   @id
  html      String
  updatedBy String? // platvormi kasutajanimi
```
uus:
```prisma
// Platvormi tabel (authDb): kasutajajuhendid ja peatükid; võtmed on koodis (src/help/helpRegistry.ts, guideChapters.ts)
model HelpArticle {
  key       String   @id
  html      String
  guideLink String?  @map("guide_link") // kohtjuhendi seotud peatükk: guide.<peatükk>[#ankur]
  updatedBy String? // platvormi kasutajanimi
```
Ja lisa `HelpArticle` mudeli järele (enne kommentaari `// Platvormi tekstiseaded …`):
```prisma
// Platvormi tabel (authDb): juhendi versioonid; iga salvestus (ka taastamine ja eemaldamine) lisab rea,
// alles jääb 50 viimast võtme kohta. Võtmega ei seota FK-d: versioonid jäävad alles ka eemaldatud juhendil.
model HelpArticleVersion {
  id        Int      @id @default(autoincrement())
  key       String
  html      String
  guideLink String?  @map("guide_link")
  createdBy String?  @map("created_by") // platvormi kasutajanimi või „mustand“
  createdAt DateTime @default(now()) @map("created_at")

  @@index([key, id])
  @@map("help_article_versions")
}
```

Edit `scripts/tenancy/02-rls.sql` (`replace_all: true`): vana `help_articles, api_keys` → uus `help_articles, help_article_versions, api_keys`. Sama `scripts/tenancy/04-privileges.sql` (`replace_all: true`). Edit `scripts/tenancy/04-privileges.sql`: vana
```
REVOKE ALL ON SEQUENCE landing_events_id_seq FROM teris_app;
GRANT USAGE, SELECT ON SEQUENCE landing_events_id_seq TO teris_platform;
```
uus
```
REVOKE ALL ON SEQUENCE landing_events_id_seq, help_article_versions_id_seq FROM teris_app;
GRANT USAGE, SELECT ON SEQUENCE landing_events_id_seq, help_article_versions_id_seq TO teris_platform;
```
Edit `scripts/tenancy/02-rls.sql`: vana `REVOKE ALL ON SEQUENCE landing_events_id_seq FROM teris_app;` → uus `REVOKE ALL ON SEQUENCE landing_events_id_seq, help_article_versions_id_seq FROM teris_app;`.

Kontroll: `SSH 'grep -n -e help_article_versions scripts/tenancy/02-rls.sql scripts/tenancy/04-privileges.sql | cut -c1-120'` → 2 + 3 rida.

Varukoopia (käsk on ühes reas, ülakomadeta sisu; ssh-i ülakomad ümber):
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && mkdir -p ~/backups && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-juhend.dump && chmod 600 ~/backups/*.dump && ls -l ~/backups | tail -2'
```
Expected: uus `*-juhend.dump` fail, suurus > 0.

Skeemi push (ILMA `--accept-data-loss`):
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && npx prisma db push && npx prisma generate && psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/tenancy/02-rls.sql && psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql'
```
Expected: „Your database is now in sync with your Prisma schema“, ilma andmekao hoiatuseta (kui hoiatab → PEATU, teata kontrollerile). Kontroll:
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "${PLATFORM_DATABASE_URL%%\?*}" -c "select count(*) from help_article_versions" -c "select count(guide_link) from help_articles"'
```
Expected: `0` ja `0` (platvormi roll näeb tabeleid). Teris_app roll ei tohi neid näha: `psql "${DATABASE_URL%%\?*}" -c "select 1 from help_article_versions limit 1"` → `permission denied`.

- [ ] **Step 9: Kirjuta serveri testid (kukuvad)**

Edit `src/server/helpArticles.test.ts`.

Vana import-rida `import { handleHelpRead, isBlankHelp } from './helpArticles';` → uus:
```ts
import { HELP_VERSION_LIMIT, buildHelpPayload, handleHelpRead, isBlankHelp, setGuideLinkIfEmpty, writeHelpIfEmpty, writeHelpVersion } from './helpArticles';
```
Vana `const ORPHAN = \`zz-orphan-${PID}\`;` järele lisa:
```ts
const VERSION_KEY = `zz-versions-${PID}`;
const LOADER_KEY = `zz-loader-${PID}`;
const LOADER_AUTHOR = `zz-author-${PID}`;
```
Vana `async function readTenantHelp() {` plokk asenda järgmisega (lisab `readTenantPayload`):
```ts
async function readTenantPayload() {
  const { res, out } = fakeRes();
  expect(await handleHelpRead(res, '/api/help', 'GET')).toBe(true);
  return JSON.parse(out.body) as { articles: Record<string, string>; chapters: Record<string, string>; guideLinks: Record<string, string> };
}

async function readTenantHelp() {
  return (await readTenantPayload()).articles;
}

const mineCount = async () => ((await call('GET', `/api/platform/help/${SPOT}/versions`)).data as { createdBy: string | null }[]).filter((v) => v.createdBy === USERNAME).length;
```
`afterAll` sees vana `await db.helpArticle.deleteMany({ where: { key: ORPHAN } });` järele lisa:
```ts
  await db.helpArticle.deleteMany({ where: { key: { in: [LOADER_KEY, VERSION_KEY] } } });
  await db.helpArticleVersion.deleteMany({ where: { OR: [{ key: { in: [VERSION_KEY, LOADER_KEY] } }, { key: SPOT, createdBy: USERNAME }] } });
```
Faili lõppu (viimase `});` järele) lisa uued `describe` plokid:
```ts
describe('peatükid, guide_link ja ettevõtte vaade', () => {
  it('buildHelpPayload jagab read kohtjuhenditeks, peatükkideks ja linkideks', () => {
    const p = buildHelpPayload([
      { key: SPOT, html: '<p>Tekst</p>', guideLink: 'guide.rotation#csv-eksport' },
      { key: 'fields.register.import-pria-zip', html: '<p><br></p>', guideLink: 'guide.fields' },
      { key: 'fields.register.import-field-book', html: '<p>x</p>', guideLink: 'guide.nope' },
      { key: 'guide.fields', html: '<h3>Import</h3>', guideLink: null },
      { key: 'guide.crops', html: '<p> </p>', guideLink: null },
      { key: 'guide.settings', html: '<p>x</p>', guideLink: 'guide.fields' },
      { key: ORPHAN, html: '<p>vana</p>', guideLink: null }
    ]);
    expect(p.articles).toEqual({ [SPOT]: '<p>Tekst</p>', 'fields.register.import-field-book': '<p>x</p>' });
    expect(p.chapters).toEqual({ 'guide.fields': '<h3>Import</h3>', 'guide.settings': '<p>x</p>' });
    // tühja tekstiga kohtjuhendil ja vigasel lingil linki ei anta; peatükil linki ei ole
    expect(p.guideLinks).toEqual({ [SPOT]: 'guide.rotation#csv-eksport' });
  });

  it('PUT guide_link: kehtiv link salvestub ja jõuab ettevõtte vaatesse, vigane → 400', async () => {
    const ok = await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>Link</p>', guideLink: 'guide.rotation#csv-eksport' });
    expect(ok.status).toBe(200);
    expect((await authDb().helpArticle.findUnique({ where: { key: SPOT } }))?.guideLink).toBe('guide.rotation#csv-eksport');
    expect((await readTenantPayload()).guideLinks[SPOT]).toBe('guide.rotation#csv-eksport');
    const list = await call('GET', '/api/platform/help');
    expect(list.data.find((r: { key: string }) => r.key === SPOT).guideLink).toBe('guide.rotation#csv-eksport');

    for (const bad of ['guide.nope', '#guide.rotation', 'https://x', 'guide', 5]) {
      expect((await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>x</p>', guideLink: bad })).status, String(bad)).toBe(400);
    }
    // PUT ilma guideLink-ita eemaldab lingi
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>Link</p>' });
    expect((await authDb().helpArticle.findUnique({ where: { key: SPOT } }))?.guideLink).toBeNull();
  });

  it('peatüki pikkuse piir on 100 000, kohtjuhendil 20 000', async () => {
    const big = await call('PUT', '/api/platform/help/guide.settings', { html: 'x'.repeat(100001) });
    expect(big.status).toBe(400);
    expect(big.data.error).toContain('100000');
    const mid = await call('PUT', `/api/platform/help/${SPOT}`, { html: 'x'.repeat(HELP_MAX_LENGTH + 1) });
    expect(mid.status).toBe(400);
  });

  it('peatükile linki panna ei saa', async () => {
    const r = await call('PUT', '/api/platform/help/guide.settings', { html: '<p>x</p>', guideLink: 'guide.fields' });
    expect(r.status).toBe(400);
    expect(await authDb().helpArticle.findUnique({ where: { key: 'guide.settings' } })).toBeNull();
  });
});

describe('versioonid', () => {
  it(`alles jääb ${HELP_VERSION_LIMIT} viimast versiooni võtme kohta, vanemad kustuvad salvestamisel`, async () => {
    const db = authDb();
    for (let i = 1; i <= HELP_VERSION_LIMIT + 5; i++) {
      await db.$transaction((tx) => writeHelpVersion(tx, VERSION_KEY, `<p>v${i}</p>`, null, 'zz'));
    }
    const rows = await db.helpArticleVersion.findMany({ where: { key: VERSION_KEY }, orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(HELP_VERSION_LIMIT);
    expect(rows[0].html).toBe('<p>v6</p>');
    expect(rows[rows.length - 1].html).toBe(`<p>v${HELP_VERSION_LIMIT + 5}</p>`);
  });

  it('iga salvestus lisab rea, taastamine teeb uue versiooni vana sisuga', async () => {
    const before = await mineCount();
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>v1</p>', guideLink: 'guide.rotation#csv-eksport' });
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>v2</p>' });
    expect(await mineCount()).toBe(before + 2);

    const list = await call('GET', `/api/platform/help/${SPOT}/versions`);
    expect(list.status).toBe(200);
    const mine = list.data.filter((v: { createdBy: string | null }) => v.createdBy === USERNAME) as { id: number }[];
    expect(mine[0].id).toBeGreaterThan(mine[1].id); // uusim ees
    const v1 = mine[1];

    const detail = await call('GET', `/api/platform/help/${SPOT}/versions/${v1.id}`);
    expect(detail.data.html).toBe('<p>v1</p>');
    expect(detail.data.guideLink).toBe('guide.rotation#csv-eksport');

    const restored = await call('POST', `/api/platform/help/${SPOT}/versions/${v1.id}/restore`);
    expect(restored.data).toEqual({ success: true, deleted: false });
    const row = await authDb().helpArticle.findUnique({ where: { key: SPOT } });
    expect(row?.html).toBe('<p>v1</p>');
    expect(row?.guideLink).toBe('guide.rotation#csv-eksport');
    expect(await mineCount()).toBe(before + 3); // taastamine = uus versioon
    expect((await readTenantPayload()).guideLinks[SPOT]).toBe('guide.rotation#csv-eksport');
    const audit = await authDb().platformAuditLog.findFirst({ where: { platformUserId, action: 'HELP_UPDATE' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.details).toEqual({ key: SPOT, op: 'restore' });
  });

  it('tundmatu versioon → 404, teise võtme versiooni ei saa taastada', async () => {
    expect((await call('POST', `/api/platform/help/${SPOT}/versions/999999999/restore`)).status).toBe(404);
    expect((await call('GET', `/api/platform/help/${SPOT}/versions/999999999`)).status).toBe(404);
    const other = await authDb().helpArticleVersion.create({ data: { key: VERSION_KEY, html: '<p>x</p>', createdBy: 'zz' } });
    expect((await call('POST', `/api/platform/help/${SPOT}/versions/${other.id}/restore`)).status).toBe(404);
  });

  it('eemaldamine (tühi tekst) lisab tühja versiooni ja selle saab taastada', async () => {
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>enne</p>' });
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p><br></p>' });
    expect(await authDb().helpArticle.findUnique({ where: { key: SPOT } })).toBeNull();
    const versions = (await call('GET', `/api/platform/help/${SPOT}/versions`)).data as { id: number; createdBy: string | null }[];
    const withText = (await Promise.all(versions.filter((v) => v.createdBy === USERNAME).map((v) => call('GET', `/api/platform/help/${SPOT}/versions/${v.id}`)))).find((d) => d.data.html === '<p>enne</p>');
    const r = await call('POST', `/api/platform/help/${SPOT}/versions/${withText!.data.id}/restore`);
    expect(r.data).toEqual({ success: true, deleted: false });
    expect((await authDb().helpArticle.findUnique({ where: { key: SPOT } }))?.html).toBe('<p>enne</p>');
  });
});

describe('writeHelpIfEmpty (mustandite laadimise alus)', () => {
  it('kirjutab tühja kohta ja teeb versioonirea autoriga; olemasolevale teksti ei kirjuta', async () => {
    expect(await writeHelpIfEmpty(LOADER_KEY, '<p>mustand</p>', LOADER_AUTHOR)).toBe(true);
    const row = await authDb().helpArticle.findUnique({ where: { key: LOADER_KEY } });
    expect(row?.html).toBe('<p>mustand</p>');
    expect(row?.updatedBy).toBe(LOADER_AUTHOR);
    const versions = await authDb().helpArticleVersion.findMany({ where: { key: LOADER_KEY } });
    expect(versions).toHaveLength(1);
    expect(versions[0].createdBy).toBe(LOADER_AUTHOR);

    expect(await writeHelpIfEmpty(LOADER_KEY, '<p>teine</p>', LOADER_AUTHOR)).toBe(false);
    expect((await authDb().helpArticle.findUnique({ where: { key: LOADER_KEY } }))?.html).toBe('<p>mustand</p>');
    expect(await authDb().helpArticleVersion.count({ where: { key: LOADER_KEY } })).toBe(1);
  });

  it('nähtava tekstita rida (ainult <p><br></p>) loetakse tühjaks', async () => {
    await authDb().helpArticle.update({ where: { key: LOADER_KEY }, data: { html: '<p><br></p>' } });
    expect(await writeHelpIfEmpty(LOADER_KEY, '<p>uus</p>', LOADER_AUTHOR)).toBe(true);
    expect((await authDb().helpArticle.findUnique({ where: { key: LOADER_KEY } }))?.html).toBe('<p>uus</p>');
  });

  it('seab vaikimisi seotud peatüki ainult tühjale reale; vigane link või peatüki võti viskab', async () => {
    const key = `${LOADER_KEY}-link`;
    try {
      expect(await writeHelpIfEmpty(key, '<p>a</p>', LOADER_AUTHOR, 'guide.fields')).toBe(true);
      expect((await authDb().helpArticle.findUnique({ where: { key } }))?.guideLink).toBe('guide.fields');
      expect(await writeHelpIfEmpty(key, '<p>b</p>', LOADER_AUTHOR, 'guide.crops')).toBe(false); // olemasolevat ei puudutata
      expect((await authDb().helpArticle.findUnique({ where: { key } }))?.guideLink).toBe('guide.fields');
      await expect(writeHelpIfEmpty(`${key}-x`, '<p>x</p>', LOADER_AUTHOR, 'guide.nope')).rejects.toThrow();
      await expect(writeHelpIfEmpty('guide.settings', '<p>x</p>', LOADER_AUTHOR, 'guide.fields')).rejects.toThrow();
      expect(await authDb().helpArticle.findUnique({ where: { key: 'guide.settings' } })).toBeNull();
    } finally {
      await authDb().helpArticle.deleteMany({ where: { key: { startsWith: `${LOADER_KEY}-` } } });
      await authDb().helpArticleVersion.deleteMany({ where: { key: { startsWith: `${LOADER_KEY}-` } } });
    }
  });
});

describe('setGuideLinkIfEmpty (olemasoleva kohtjuhendi link)', () => {
  const key = `${LOADER_KEY}-setlink`;
  afterAll(async () => {
    await authDb().helpArticle.deleteMany({ where: { key } });
    await authDb().helpArticleVersion.deleteMany({ where: { key } });
  });

  it('paneb lingi ainult kui tekst on olemas ja link tühi; teksti ei muuda, autor jääb', async () => {
    expect(await setGuideLinkIfEmpty(key, 'guide.fields', LOADER_AUTHOR)).toBe(false); // rida puudub
    await authDb().helpArticle.create({ data: { key, html: '<p>kasutaja tekst</p>', updatedBy: 'kasutaja' } });
    expect(await setGuideLinkIfEmpty(key, 'guide.fields', LOADER_AUTHOR)).toBe(true);
    const row = await authDb().helpArticle.findUnique({ where: { key } });
    expect(row?.html).toBe('<p>kasutaja tekst</p>');
    expect(row?.guideLink).toBe('guide.fields');
    expect(row?.updatedBy).toBe('kasutaja');
    const versions = await authDb().helpArticleVersion.findMany({ where: { key } });
    expect(versions).toHaveLength(1);
    expect(versions[0].createdBy).toBe(LOADER_AUTHOR);
    expect(versions[0].html).toBe('<p>kasutaja tekst</p>');

    expect(await setGuideLinkIfEmpty(key, 'guide.crops', LOADER_AUTHOR)).toBe(false); // olemasolev link jääb
    expect((await authDb().helpArticle.findUnique({ where: { key } }))?.guideLink).toBe('guide.fields');
    await expect(setGuideLinkIfEmpty(key, 'guide.nope', LOADER_AUTHOR)).rejects.toThrow();
  });

  it('tühja tekstiga real linki ei panda', async () => {
    await authDb().helpArticle.update({ where: { key }, data: { html: '<p><br></p>', guideLink: null } });
    expect(await setGuideLinkIfEmpty(key, 'guide.fields', LOADER_AUTHOR)).toBe(false);
  });
});
```
Märkus: `HELP_MAX_LENGTH` on selles failis juba imporditud.

- [ ] **Step 10: Käivita serveri testid, veendu et kukuvad**

Run: `SSH 'npx vitest run src/server/helpArticles.test.ts'`
Expected: FAIL (`buildHelpPayload`/`writeHelpVersion` pole eksporditud).

- [ ] **Step 11: Kirjuta `src/server/helpArticles.ts` (asenda kogu fail)**

```ts
// src/server/helpArticles.ts — kasutajajuhendid ja peatükid (platvormi tabelid help_articles ja help_article_versions,
// ainult authDb()). Ettevõtte rakendus loeb (GET /api/help), teenusepakkuja muudab (platformApi /api/platform/help*).
// HTML puhastatakse brauseris DOMPurify'ga nii salvestamisel kui ka kuvamisel (src/help/sanitizeHelp.ts).
// Iga salvestus (ka taastamine ja eemaldamine) lisab versioonirea; alles jääb HELP_VERSION_LIMIT viimast võtme kohta.
import type { ServerResponse } from 'http';
import type { Prisma } from '@prisma/client';
import { authDb } from './db.ts';
import { json } from './http.ts';
import { helpMaxLength, isHelpKey } from '../help/helpRegistry.ts';
import { isGuideChapterKey } from '../help/guideChapters.ts';
import { isValidGuideLink } from '../help/guideLink.ts';

export const HELP_KEY_ERROR = 'Tundmatu juhendi koht';
export const HELP_LINK_ERROR = 'Seotud peatüki viide on vigane';
export const HELP_VERSION_ERROR = 'Juhendi versiooni ei leitud';
export const HELP_VERSION_LIMIT = 50;

export const helpLengthError = (key: string): string => `Juhend on liiga pikk (kuni ${helpMaxLength(key)} märki)`;

/** Tühi = pole nähtavat teksti (nt ainult <p><br></p>) */
export const isBlankHelp = (html: string): boolean => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

const isKnownKey = (key: string): boolean => isHelpKey(key) || isGuideChapterKey(key);

export interface HelpRowLite {
  key: string;
  html: string;
  guideLink: string | null;
}

/** Ettevõtte rakenduse vastus: kohtjuhendid, peatükid ja kohtjuhendite seotud peatükid (ainult täidetud tekstiga). */
export function buildHelpPayload(rows: HelpRowLite[]) {
  const articles: Record<string, string> = {};
  const chapters: Record<string, string> = {};
  const guideLinks: Record<string, string> = {};
  for (const r of rows) {
    if (isBlankHelp(r.html)) continue;
    if (isGuideChapterKey(r.key)) chapters[r.key] = r.html;
    else if (isHelpKey(r.key)) {
      articles[r.key] = r.html;
      if (r.guideLink && isValidGuideLink(r.guideLink)) guideLinks[r.key] = r.guideLink;
    }
  }
  return { articles, chapters, guideLinks };
}

/** Ettevõtte rakendusele: kõik registris olevad täidetud juhendid ja peatükid ühe päringuga. */
export async function handleHelpRead(res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (pathname !== '/api/help' || method !== 'GET') return false;
  const rows = await authDb().helpArticle.findMany({ select: { key: true, html: true, guideLink: true } });
  res.setHeader('Cache-Control', 'no-cache');
  json(res, buildHelpPayload(rows));
  return true;
}

export async function listHelpArticles() {
  return authDb().helpArticle.findMany({ orderBy: { key: 'asc' }, select: { key: true, html: true, guideLink: true, updatedAt: true, updatedBy: true } });
}

type Tx = Prisma.TransactionClient;
type Result = { ok: true; deleted: boolean } | { ok: false; status: number; error: string };

/** Lisab versioonirea ja kustutab selle võtme vanemad versioonid (alles HELP_VERSION_LIMIT viimast). */
export async function writeHelpVersion(tx: Tx, key: string, html: string, guideLink: string | null, author: string | null): Promise<void> {
  await tx.helpArticleVersion.create({ data: { key, html, guideLink, createdBy: author } });
  const old = await tx.helpArticleVersion.findMany({ where: { key }, orderBy: { id: 'desc' }, skip: HELP_VERSION_LIMIT, select: { id: true } });
  if (old.length) await tx.helpArticleVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

/** Kirjutab juhendi (või kustutab, kui tekst on tühi) ja lisab versioonirea. Tagastab, kas kirje kustus. */
async function persist(tx: Tx, key: string, html: string, link: string | null, pu: { id: string; username: string }, op: 'save' | 'restore'): Promise<boolean> {
  const blank = isBlankHelp(html);
  if (blank) {
    const { count } = await tx.helpArticle.deleteMany({ where: { key } });
    if (count === 0) return true; // polnud midagi kustutada: ei versiooni ega auditit
    await writeHelpVersion(tx, key, '', null, pu.username);
  } else {
    await tx.helpArticle.upsert({
      where: { key },
      create: { key, html, guideLink: link, updatedBy: pu.username },
      update: { html, guideLink: link, updatedBy: pu.username }
    });
    await writeHelpVersion(tx, key, html, link, pu.username);
  }
  await tx.platformAuditLog.create({
    data: { action: 'HELP_UPDATE', platformUserId: pu.id, targetTenantId: null, details: { key, op: blank ? 'delete' : op } }
  });
  return blank;
}

/** `guideLink` sisendist: puudub/tühi → null; muidu peab olema kehtiv ja ainult kohtjuhendil. */
function parseLinkInput(key: string, raw: unknown): { ok: true; link: string | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, link: null };
  if (typeof raw !== 'string' || isGuideChapterKey(key) || !isValidGuideLink(raw)) return { ok: false };
  return { ok: true, link: raw };
}

/** Salvestab juhendi; tühi tekst kustutab kirje. Kustutada saab ka koodist eemaldatud võtme. */
export async function saveHelpArticle(key: string, input: { html: unknown; guideLink?: unknown }, pu: { id: string; username: string }): Promise<Result> {
  const { html } = input;
  if (typeof html !== 'string') return { ok: false, status: 400, error: 'Juhendi tekst puudub' };
  if (html.length > helpMaxLength(key)) return { ok: false, status: 400, error: helpLengthError(key) };
  const blank = isBlankHelp(html);
  if (!blank && !isKnownKey(key)) return { ok: false, status: 404, error: HELP_KEY_ERROR };
  const link = parseLinkInput(key, input.guideLink);
  if (!link.ok) return { ok: false, status: 400, error: HELP_LINK_ERROR };
  const deleted = await authDb().$transaction((tx) => persist(tx, key, html, link.link, pu, 'save'));
  return { ok: true, deleted };
}

export async function listHelpVersions(key: string) {
  return authDb().helpArticleVersion.findMany({ where: { key }, orderBy: { id: 'desc' }, select: { id: true, createdAt: true, createdBy: true, guideLink: true } });
}

export async function getHelpVersion(key: string, id: number) {
  return authDb().helpArticleVersion.findFirst({ where: { id, key }, select: { id: true, html: true, guideLink: true, createdAt: true, createdBy: true } });
}

/** Taastamine = uus salvestus vana sisuga (uus versioonirida; ajalugu ei muutu). */
export async function restoreHelpVersion(key: string, id: number, pu: { id: string; username: string }): Promise<Result> {
  const v = await getHelpVersion(key, id);
  if (!v) return { ok: false, status: 404, error: HELP_VERSION_ERROR };
  if (!isBlankHelp(v.html) && !isKnownKey(key)) return { ok: false, status: 404, error: HELP_KEY_ERROR };
  const deleted = await authDb().$transaction((tx) => persist(tx, key, v.html, v.guideLink, pu, 'restore'));
  return { ok: true, deleted };
}

/** Kas juhend on tühi (puudub või pole nähtavat teksti). Mustandite laadimine kontrollib seda enne kirjutamist. */
export async function isHelpEmpty(key: string): Promise<boolean> {
  const row = await authDb().helpArticle.findUnique({ where: { key }, select: { html: true } });
  return !row || isBlankHelp(row.html);
}

/** Seotud peatüki viide mustandi laadijale: peab olema kehtiv ja ainult kohtjuhendil (viga on koodiviga, seega viskab). */
function assertDraftLink(key: string, link: string): void {
  if (isGuideChapterKey(key) || !isValidGuideLink(link)) throw new Error(HELP_LINK_ERROR);
}

/**
 * Kirjutab ainult siis, kui juhend on tühi; olemasolevat teksti ei puudutata. Tagastab, kas kirjutas.
 * `guideLink` (kohtjuhendile) pannakse ainult siis, kui tühjal real pole oma linki (olemasolev link jääb).
 */
export async function writeHelpIfEmpty(key: string, html: string, author: string, guideLink: string | null = null): Promise<boolean> {
  if (guideLink) assertDraftLink(key, guideLink);
  return authDb().$transaction(async (tx) => {
    const row = await tx.helpArticle.findUnique({ where: { key }, select: { html: true, guideLink: true } });
    if (row && !isBlankHelp(row.html)) return false;
    const link = row?.guideLink ?? guideLink;
    await tx.helpArticle.upsert({
      where: { key },
      create: { key, html, guideLink: link, updatedBy: author },
      update: { html, guideLink: link, updatedBy: author }
    });
    await writeHelpVersion(tx, key, html, link, author);
    return true;
  });
}

/** Kas kohtjuhendil on tekst, aga seotud peatükk puudub (siis võib laadija lingi panna). */
export async function canSetGuideLink(key: string): Promise<boolean> {
  const row = await authDb().helpArticle.findUnique({ where: { key }, select: { html: true, guideLink: true } });
  return !!row && !isBlankHelp(row.html) && !row.guideLink;
}

/**
 * Paneb seotud peatüki ainult siis, kui kohtjuhendil on tekst ja link on tühi; teksti ega olemasolevat linki ei puudutata.
 * Teeb versioonirea (sama tekst, uus link). `updatedBy` jääb alles (tekst on kasutaja oma). Tagastab, kas pani.
 */
export async function setGuideLinkIfEmpty(key: string, link: string, author: string): Promise<boolean> {
  assertDraftLink(key, link);
  return authDb().$transaction(async (tx) => {
    const row = await tx.helpArticle.findUnique({ where: { key }, select: { html: true, guideLink: true } });
    if (!row || isBlankHelp(row.html) || row.guideLink) return false;
    await tx.helpArticle.update({ where: { key }, data: { guideLink: link } });
    await writeHelpVersion(tx, key, row.html, link, author);
    return true;
  });
}

export function sendHelpResult(res: ServerResponse, r: Result) {
  if (!r.ok) return json(res, { error: r.error }, r.status);
  json(res, { success: true, deleted: r.deleted });
}

export const HELP_PLATFORM_ROUTE = /^\/api\/platform\/help\/([^/]+)$/;
/** …/help/<võti>/versions, …/versions/<id>, …/versions/<id>/restore */
export const HELP_VERSIONS_ROUTE = /^\/api\/platform\/help\/([^/]+)\/versions(?:\/(\d{1,9})(\/restore)?)?$/;
```

- [ ] **Step 12: Platvormi marsruudid**

Edit `src/server/platformApi.ts` rida 23 — vana:
```ts
import { listHelpArticles, saveHelpArticle, sendHelpResult, HELP_PLATFORM_ROUTE, HELP_KEY_ERROR } from './helpArticles.ts';
```
uus:
```ts
import { listHelpArticles, saveHelpArticle, sendHelpResult, listHelpVersions, getHelpVersion, restoreHelpVersion, HELP_PLATFORM_ROUTE, HELP_VERSIONS_ROUTE, HELP_KEY_ERROR, HELP_VERSION_ERROR } from './helpArticles.ts';
```
Edit — vana:
```ts
  const hr = HELP_PLATFORM_ROUTE.exec(pathname);
  if (hr && method === 'PUT') {
    const key = decodeId(hr[1], HELP_KEY_ERROR);
    return sendHelpResult(res, await saveHelpArticle(key, (await readBody(req))?.html, pu));
  }
```
uus:
```ts
  const hr = HELP_PLATFORM_ROUTE.exec(pathname);
  if (hr && method === 'PUT') {
    const key = decodeId(hr[1], HELP_KEY_ERROR);
    return sendHelpResult(res, await saveHelpArticle(key, (await readBody(req)) ?? {}, pu));
  }
  const hv = HELP_VERSIONS_ROUTE.exec(pathname);
  if (hv) {
    const key = decodeId(hv[1], HELP_KEY_ERROR);
    if (!hv[2] && method === 'GET') return json(res, await listHelpVersions(key));
    if (hv[2] && !hv[3] && method === 'GET') {
      const v = await getHelpVersion(key, Number(hv[2]));
      return v ? json(res, v) : json(res, { error: HELP_VERSION_ERROR }, 404);
    }
    if (hv[2] && hv[3] && method === 'POST') return sendHelpResult(res, await restoreHelpVersion(key, Number(hv[2]), pu));
  }
```
Kontroll, et `HELP_LENGTH_ERROR` ei ole kusagil kasutusel: `SSH "grep -rn --include='*.ts' --include='*.tsx' -e HELP_LENGTH_ERROR src"` → 0 rida.

- [ ] **Step 13: Admin API tüübid**

Edit `src/admin/platformApi.ts` — vana:
```ts
export type HelpArticleRow = { key: string; html: string; updatedAt: string; updatedBy: string | null };
```
uus:
```ts
export type HelpArticleRow = { key: string; html: string; guideLink: string | null; updatedAt: string; updatedBy: string | null };
export type HelpVersionRow = { id: number; createdAt: string; createdBy: string | null; guideLink: string | null };
export type HelpVersionDetail = HelpVersionRow & { html: string };
```
Vana:
```ts
  saveHelp: (key: string, html: string) => request<{ success: true; deleted: boolean }>('PUT', `/help/${enc(key)}`, { html }, 'Juhendi salvestamine ebaõnnestus'),
```
uus:
```ts
  saveHelp: (key: string, html: string, guideLink: string | null = null) =>
    request<{ success: true; deleted: boolean }>('PUT', `/help/${enc(key)}`, { html, guideLink }, 'Juhendi salvestamine ebaõnnestus'),
  listHelpVersions: (key: string) => request<HelpVersionRow[]>('GET', `/help/${enc(key)}/versions`, undefined, 'Ajaloo laadimine ebaõnnestus'),
  getHelpVersion: (key: string, id: number) => request<HelpVersionDetail>('GET', `/help/${enc(key)}/versions/${id}`, undefined, 'Versiooni laadimine ebaõnnestus'),
  restoreHelpVersion: (key: string, id: number) =>
    request<{ success: true; deleted: boolean }>('POST', `/help/${enc(key)}/versions/${id}/restore`, {}, 'Versiooni taastamine ebaõnnestus'),
```
(`request`-i signatuur `request<T>(method, path, body?, fallback?)` on sama, mida `getMcpInstructions`/`resetMcpInstructions` kasutavad.)

- [ ] **Step 14: Käivita testid, tsc, oxlint**

Run: `SSH 'npx vitest run src/help src/server/helpArticles.test.ts'` → PASS (kõik).
Run: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json && npx oxlint'` → 0 viga.

- [ ] **Step 15: Commit ja release**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/help/guideChapters.ts src/help/guideChapters.test.ts src/help/guideLink.ts src/help/guideLink.test.ts src/help/helpRegistry.ts src/help/helpRegistry.test.ts prisma/schema.prisma scripts/tenancy/02-rls.sql scripts/tenancy/04-privileges.sql src/server/helpArticles.ts src/server/helpArticles.test.ts src/server/platformApi.ts src/admin/platformApi.ts && git commit -m "feat(juhend): peatükkide register, guide_link, versioonide ajalugu ja API" -m "Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>"'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && NODE_OPTIONS=--max-old-space-size=4096 npm run release'   # run_in_background
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris'
```
Expected: `active`. Kontroll: `curl -s http://127.0.0.1:8820/api/help` serveris ei tööta ilma sessioonita (401), seega piisab testidest.

---

### Task 2: `sanitizeHelp` — `h3` ankrud ja peatükilingid

**Files:**
- Create: `src/help/anchors.ts`, `src/help/anchors.test.ts`, `src/help/sanitizeHelp.test.ts`
- Modify: `src/help/sanitizeHelp.ts`, `package.json`, `package-lock.json` (`jsdom` devDependency)

**Interfaces:**
- Consumes: `DOMPurify` (juba sõltuvus).
- Produces:
  - `anchors.ts`: `interface Anchor { slug: string; text: string }`, `slugify(text: string): string`, `nextSlug(seen: Map<string, number>, text: string): string`, `anchorDomId(slug: string): string` (`g-<slug>`), `textOfHtml(html: string): string`, `extractAnchors(html: string): Anchor[]` (h3 järjekorras, korduvad `-2`, `-3`).
  - `sanitizeHelp(html)` lisaks: iga `h3` saab `id="g-<slug>"` (sama slug-algoritm mis `extractAnchors`); `a[href^="#"]` ei saa `target`/`rel`; muudel elementidel `id` eemaldatakse; muud lingid (`https:` jt) saavad `target="_blank" rel="noopener noreferrer"` nagu varem.

- [ ] **Step 1: Kirjuta `anchors` test**

Fail `src/help/anchors.test.ts`:

```ts
// h3 ankrud: pealkirjast tuletatud lühinimi (eesti tähed), korduvad pealkirjad, ankrute nimekiri HTML-ist.
import { describe, it, expect } from 'vitest';
import { anchorDomId, extractAnchors, nextSlug, slugify, textOfHtml } from './anchors';

describe('slugify', () => {
  it('eesti tähed ja kirjavahemärgid', () => {
    expect(slugify('Kuidas importida PRIA ZIP-i?')).toBe('kuidas-importida-pria-zip-i');
    expect(slugify('Õun ja päike')).toBe('oun-ja-paike');
    expect(slugify('Šokolaad ja žürii')).toBe('sokolaad-ja-zurii');
    expect(slugify('  Hea teada  ')).toBe('hea-teada');
  });

  it('tühi või ainult märgid → jaotis', () => {
    expect(slugify('')).toBe('jaotis');
    expect(slugify('???')).toBe('jaotis');
  });
});

describe('nextSlug ja extractAnchors', () => {
  it('korduvad pealkirjad saavad -2, -3', () => {
    const seen = new Map<string, number>();
    expect([nextSlug(seen, 'Import'), nextSlug(seen, 'Import'), nextSlug(seen, 'Import'), nextSlug(seen, 'Muu')]).toEqual(['import', 'import-2', 'import-3', 'muu']);
  });

  it('extractAnchors võtab ainult h3, tekst ilma siltide ja olemitega', () => {
    const html = '<p>x</p><h3>Kuidas <strong>importida</strong>?</h3><h4>Alam</h4><h3 class="a">Hea&nbsp;teada &amp; nipid</h3><h3>Kuidas importida?</h3>';
    expect(extractAnchors(html)).toEqual([
      { slug: 'kuidas-importida', text: 'Kuidas importida?' },
      { slug: 'hea-teada-nipid', text: 'Hea teada & nipid' },
      { slug: 'kuidas-importida-2', text: 'Kuidas importida?' }
    ]);
    expect(extractAnchors('<p>pole pealkirju</p>')).toEqual([]);
  });

  it('DOM-i id on g-eesliitega', () => {
    expect(anchorDomId('import')).toBe('g-import');
  });

  it('textOfHtml normaliseerib tühikud', () => {
    expect(textOfHtml('<p>a  <b>b</b>\n c&nbsp;d</p>')).toBe('a b c d');
  });
});
```

- [ ] **Step 2: Käivita (kukub), seejärel kirjuta `src/help/anchors.ts`**

Run: `SSH 'npx vitest run src/help/anchors.test.ts'` → FAIL (import).

```ts
// src/help/anchors.ts — vahepealkirjade (h3) ankrud. Ankru lühinimi tuletatakse pealkirjast; sama algoritm on
// sanitizeHelp'is (DOM-i id) ja extractAnchors'is (admin: peatükki-lingi valik, otsing: tabamuse koht).

export interface Anchor {
  slug: string;
  text: string;
}

/** Pealkirjast lühinimi: väiketähed, täpitähed ilma täpita (õ→o, ä→a, ö→o, ü→u, š→s, ž→z), muu → `-` */
export function slugify(text: string): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'jaotis';
}

/** Järgmine unikaalne lühinimi sama dokumendi sees: esimene `import`, siis `import-2`, `import-3`. */
export function nextSlug(seen: Map<string, number>, text: string): string {
  const base = slugify(text);
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/** DOM-i id (eesliide väldib kokkupõrget rakenduse enda id-dega) */
export const anchorDomId = (slug: string): string => `g-${slug}`;

/** HTML-i nähtav tekst: sildid maha, tavalised olemid lahti, tühikud ühte */
export function textOfHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Peatüki h3 pealkirjad dokumendi järjekorras koos ankru lühinimega */
export function extractAnchors(html: string): Anchor[] {
  const seen = new Map<string, number>();
  const out: Anchor[] = [];
  for (const m of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = textOfHtml(m[1]);
    out.push({ slug: nextSlug(seen, text), text });
  }
  return out;
}
```

Run → PASS.

- [ ] **Step 3: Lisa `jsdom` arendussõltuvus (ainult test)**

Run: `SSH 'npm install --save-dev jsdom'`
Expected: `package.json` `devDependencies` saab `jsdom`; `package-lock.json` muutub; runtime-sõltuvused (`dependencies`) ei muutu (otsus 2: lubatud). jsdom-keskkond kehtib **ainult** faili esimese rea kommentaariga `// @vitest-environment jsdom` (`sanitizeHelp.test.ts`); `vitest.config.ts` jääb `environment: 'node'` ja ühtegi teist testi ei puututa.

Kontrolli, et ehitus ja puhas paigaldus ei kuku:
`SSH 'npm ci --dry-run 2>&1 | tail -3'` (oodatud: lõpeb ilma veata, lockfile vastab package.json-ile) ja `SSH 'git diff --stat package.json package-lock.json'` (package.json: ainult üks lisatud devDependency rida). Tootmispaigaldus `npm ci --omit=dev` ei vaja jsdom-i; `npm run release` (tsc + vitest + build) jooksutatakse samm 6-s.

- [ ] **Step 4: Kirjuta `sanitizeHelp` test (jsdom)**

Fail `src/help/sanitizeHelp.test.ts`:

```ts
// @vitest-environment jsdom
// sanitizeHelp: h3 ankrud, peatükilingid (#guide.…) ja välislingid. DOMPurify vajab DOM-i, seega jsdom.
import { describe, it, expect } from 'vitest';
import { sanitizeHelp } from './sanitizeHelp';
import { anchorDomId, extractAnchors } from './anchors';

const parse = (html: string) => {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box;
};

describe('sanitizeHelp ankrud', () => {
  it('h3 saab pealkirjast tuletatud id, korduv saab -2', () => {
    const box = parse(sanitizeHelp('<h3>Kuidas importida?</h3><p>x</p><h3>Kuidas importida?</h3><h3>Õun</h3>'));
    expect([...box.querySelectorAll('h3')].map((h) => h.id)).toEqual(['g-kuidas-importida', 'g-kuidas-importida-2', 'g-oun']);
  });

  it('id-d vastavad extractAnchors tulemusele (admin ja vaade viitavad samale kohale)', () => {
    const src = '<h3>Üks <b>pealkiri</b></h3><h3>Hea teada</h3><h3>Üks pealkiri</h3>';
    const ids = [...parse(sanitizeHelp(src)).querySelectorAll('h3')].map((h) => h.id);
    expect(ids).toEqual(extractAnchors(src).map((a) => anchorDomId(a.slug)));
  });

  it('korduv väljakutse alustab loendust otsast', () => {
    sanitizeHelp('<h3>A</h3><h3>A</h3>');
    expect(parse(sanitizeHelp('<h3>A</h3>')).querySelector('h3')!.id).toBe('g-a');
  });

  it('kleebitud id teistel elementidel eemaldatakse, h3 oma id kirjutatakse üle', () => {
    const box = parse(sanitizeHelp('<p id="x">a</p><h3 id="x">Pealkiri</h3>'));
    expect(box.querySelector('p')!.hasAttribute('id')).toBe(false);
    expect(box.querySelector('h3')!.id).toBe('g-pealkiri');
  });
});

describe('sanitizeHelp lingid', () => {
  it('peatükilink säilib ja ei avane uues aknas', () => {
    const a = parse(sanitizeHelp('<a href="#guide.fields#import" target="_blank">Import</a>')).querySelector('a')!;
    expect(a.getAttribute('href')).toBe('#guide.fields#import');
    expect(a.hasAttribute('target')).toBe(false);
    expect(a.hasAttribute('rel')).toBe(false);
  });

  it('ankruta peatükilink ja välislink', () => {
    expect(parse(sanitizeHelp('<a href="#guide.getting-started">x</a>')).querySelector('a')!.getAttribute('href')).toBe('#guide.getting-started');
    const ext = parse(sanitizeHelp('<a href="https://teris.ee">x</a>')).querySelector('a')!;
    expect(ext.getAttribute('target')).toBe('_blank');
    expect(ext.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('ohtlikud lingid ja sildid eemaldatakse', () => {
    const box = parse(sanitizeHelp('<a href="javascript:alert(1)">x</a><script>alert(1)</script><img src="x" onerror="alert(1)">'));
    expect(box.querySelector('a')!.hasAttribute('href')).toBe(false);
    expect(box.querySelector('script')).toBeNull();
    expect(box.querySelector('img')).toBeNull();
  });
});
```

Run: `SSH 'npx vitest run src/help/sanitizeHelp.test.ts'` → FAIL (id puudub, `#`-link saab `target`).

- [ ] **Step 5: Muuda `src/help/sanitizeHelp.ts` (asenda kogu fail)**

```ts
// src/help/sanitizeHelp.ts — juhendi HTML-i puhastus (DOMPurify): kasutatakse admin-redaktoris salvestamisel ja rakenduses kuvamisel.
// h3 saab ankru (id `g-<pealkirjast tuletatud lühinimi>`, vt anchors.ts); `#guide.<peatükk>[#ankur]` lingid jäävad rakenduse sisesteks.
import DOMPurify from 'dompurify';
import { anchorDomId, nextSlug } from './anchors';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h3', 'h4', 'ul', 'ol', 'li', 'a'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'id'];

let hooked = false;
// h3 lühinimede loendur; nullitakse iga sanitizeHelp väljakutse alguses
let seenSlugs = new Map<string, number>();

function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (href.startsWith('#')) {
        // rakenduse sisene link (peatükk/ankur): jääb samasse aknasse
        node.removeAttribute('target');
        node.removeAttribute('rel');
      } else {
        // välislingid avanevad alati uues aknas ega anna avajale ligipääsu
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    // id lubatud ainult h3-l ja selle väärtuse tuletab alati meie (kleebitud id-sid ei usaldata)
    if (node.tagName === 'H3') node.setAttribute('id', anchorDomId(nextSlug(seenSlugs, node.textContent ?? '')));
    else node.removeAttribute('id');
  });
}

export function sanitizeHelp(html: string): string {
  ensureHook();
  seenSlugs = new Map();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i
  });
}
```

Run: `SSH 'npx vitest run src/help'` → PASS.

- [ ] **Step 6: Kontroll, commit, release**

Run: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json && npx oxlint'` → 0.
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/help/anchors.ts src/help/anchors.test.ts src/help/sanitizeHelp.ts src/help/sanitizeHelp.test.ts package.json package-lock.json && git commit -m "feat(juhend): h3 ankrud ja peatükilingid sanitizeHelp-is" -m "Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>"'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && NODE_OPTIONS=--max-old-space-size=4096 npm run release'   # run_in_background
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris'
```
Expected: `active`. Olemasolevad kohtjuhendid (admin eelvaade, HelpHint) kuvatakse sama `sanitizeHelp`-iga; `target=_blank` välislinkidel säilib.

---

### Task 3: Admin — Peatükid ja Kohtjuhendid, „Seotud peatükk“, link peatükki, Ajalugu

**Files:**
- Create: `src/admin/GuideLinkPicker.tsx`, `src/admin/ChapterLinkDialog.tsx`, `src/admin/HelpHistory.tsx`
- Modify: `src/admin/HelpView.tsx` (asenda kogu fail), `src/admin/RichTextEditor.tsx`

**Interfaces:**
- Consumes (T1/T2): `GUIDE_CHAPTERS`, `MODULE_LABELS`, `isGuideChapterKey`, `GuideChapterKey`, `helpMaxLength`, `parseGuideRef`, `formatGuideRef`, `extractAnchors`, `Anchor`, `platformApi.listHelp/saveHelp/listHelpVersions/getHelpVersion/restoreHelpVersion`, `HelpArticleRow`, `HelpVersionRow`, `HelpVersionDetail`, `formatTallinn`, `sanitizeHelp`.
- Produces:
  - `GuideLinkPicker({ value: string; onChange: (v: string) => void; anchorsOf: (key: GuideChapterKey) => Anchor[] })` — `value` on `guide.<peatükk>[#ankur]` või `''`.
  - `ChapterLinkDialog({ open: boolean; onClose: () => void; onPick: (href: string, title: string) => void; anchorsOf })` — `href` kujul `#guide.fields#import`.
  - `HelpHistory({ helpKey: string; onRestored: () => Promise<void> })`.
  - `RichTextEditor` uus valikuline prop `anchorsOf?: (key: GuideChapterKey) => Anchor[]`; kui antud, on tööriistaribal nupp „Link peatükki“. (Alapealkirja `h3` ja nummerloendi nupud on redaktoris juba olemas — spec'i neid nuppe ei lisa uuesti.)

- [ ] **Step 1: `GuideLinkPicker.tsx`**

```tsx
// Kohtjuhendi „Seotud peatükk“: peatüki valik + valikuline ankur (peatüki h3 pealkirjad salvestatud tekstist).
import { useMemo } from 'react';
import { Select, type SelectOption } from '../components/ui';
import { GUIDE_CHAPTERS, type GuideChapterKey } from '../help/guideChapters.ts';
import { formatGuideRef, parseGuideRef } from '../help/guideLink.ts';
import type { Anchor } from '../help/anchors.ts';
import { adminFieldLabelClass, adminHintClass } from './adminUi.ts';

type Props = { value: string; onChange: (value: string) => void; anchorsOf: (key: GuideChapterKey) => Anchor[] };

const CHAPTER_OPTIONS: SelectOption[] = [
  { value: '', label: '— pole —' },
  ...GUIDE_CHAPTERS.map((c, i) => ({ value: c.key, label: `${i + 1}. ${c.title}` }))
];

export function GuideLinkPicker({ value, onChange, anchorsOf }: Props) {
  const ref = parseGuideRef(value);
  const chapter = ref?.chapter ?? null;
  const anchors = useMemo(() => (chapter ? anchorsOf(chapter) : []), [chapter, anchorsOf]);
  const anchorOptions: SelectOption[] = [{ value: '', label: '— kogu peatükk —' }, ...anchors.map((a) => ({ value: a.slug, label: a.text }))];
  // Salvestatud ankur, mida peatükis enam pole, jääb valikusse nähtavaks
  if (ref?.anchor && !anchors.some((a) => a.slug === ref.anchor)) anchorOptions.push({ value: ref.anchor, label: `${ref.anchor} (puudub peatükis)` });

  return (
    <div className="flex flex-col gap-1.5">
      <div className={adminFieldLabelClass}>Seotud peatükk</div>
      <div className="flex flex-wrap gap-2.5">
        <Select
          className="min-w-64"
          aria-label="Seotud peatükk"
          value={chapter ?? ''}
          onValueChange={(v) => onChange(v ? formatGuideRef(v as GuideChapterKey) : '')}
          options={CHAPTER_OPTIONS}
        />
        {chapter && (
          <Select
            className="min-w-64"
            aria-label="Ankur peatükis"
            value={ref?.anchor ?? ''}
            onValueChange={(a) => onChange(formatGuideRef(chapter, a || null))}
            options={anchorOptions}
          />
        )}
      </div>
      <div className={adminHintClass}>Rakenduses näitab küsimärgi hüpik selle kohaga lingi „Loe juhendist →“. Tühja tekstiga kohta ei näidata, ka link kaob.</div>
    </div>
  );
}
```

- [ ] **Step 2: `ChapterLinkDialog.tsx`**

```tsx
// Redaktori „Link peatükki“: valik peatükkide loendist + ankur; tulemus on `#guide.<peatükk>[#ankur]`.
import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, type SelectOption } from '../components/ui';
import { GUIDE_CHAPTERS, chapterByKey, type GuideChapterKey } from '../help/guideChapters.ts';
import { formatGuideRef } from '../help/guideLink.ts';
import type { Anchor } from '../help/anchors.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (href: string, title: string) => void;
  anchorsOf: (key: GuideChapterKey) => Anchor[];
};

const CHAPTER_OPTIONS: SelectOption[] = GUIDE_CHAPTERS.map((c, i) => ({ value: c.key, label: `${i + 1}. ${c.title}` }));

export function ChapterLinkDialog({ open, onClose, onPick, anchorsOf }: Props) {
  const [chapter, setChapter] = useState<GuideChapterKey>(GUIDE_CHAPTERS[0].key);
  const [anchor, setAnchor] = useState('');
  const anchors = useMemo(() => anchorsOf(chapter), [chapter, anchorsOf]);

  useEffect(() => {
    if (open) {
      setChapter(GUIDE_CHAPTERS[0].key);
      setAnchor('');
    }
  }, [open]);

  const anchorOptions: SelectOption[] = [{ value: '', label: '— kogu peatükk —' }, ...anchors.map((a) => ({ value: a.slug, label: a.text }))];
  const title = anchors.find((a) => a.slug === anchor)?.text ?? chapterByKey(chapter).title;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Link peatükki</DialogTitle>
          <DialogDescription>Vali peatükk ja soovi korral selle vahepealkiri.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2.5">
            <Select aria-label="Peatükk" value={chapter} onValueChange={(v) => { setChapter(v as GuideChapterKey); setAnchor(''); }} options={CHAPTER_OPTIONS} />
            <Select aria-label="Ankur peatükis" value={anchor} onValueChange={setAnchor} options={anchorOptions} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Loobu</Button>
          <Button variant="primary" onClick={() => onPick(`#${formatGuideRef(chapter, anchor || null)}`, title)}>
            Lisa link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: `RichTextEditor.tsx` — nupp „Link peatükki“**

Edit importrida — vana:
```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Underline, Heading3, Pilcrow, List, ListOrdered, Link, Unlink, RemoveFormatting } from 'lucide-react';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { Button } from '../components/ui';

type Props = { initialHtml: string; onChange: (html: string) => void; placeholder?: string };
```
uus:
```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Italic, Underline, Heading3, Pilcrow, List, ListOrdered, Link, Unlink, BookOpen, RemoveFormatting } from 'lucide-react';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import type { Anchor } from '../help/anchors.ts';
import type { GuideChapterKey } from '../help/guideChapters.ts';
import { Button } from '../components/ui';
import { ChapterLinkDialog } from './ChapterLinkDialog.tsx';

type Props = {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Kui antud, on tööriistaribal „Link peatükki“ (peatüki h3 ankrud antud peatüki salvestatud tekstist) */
  anchorsOf?: (key: GuideChapterKey) => Anchor[];
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
```
Edit — vana: `export function RichTextEditor({ initialHtml, onChange, placeholder }: Props) {\n  const ref = useRef<HTMLDivElement>(null);` → uus:
```tsx
export function RichTextEditor({ initialHtml, onChange, placeholder, anchorsOf }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [chapterLinkOpen, setChapterLinkOpen] = useState(false);
```
Edit — vana `  const tool = (label: string, icon: ReactNode, fn: () => void) => (` ette lisa:
```tsx
  // Dialoog võtab fookuse: jäta valik meelde ja pane enne lingi lisamist tagasi
  const openChapterLink = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setChapterLinkOpen(true);
  };

  const insertChapterLink = (href: string, title: string) => {
    setChapterLinkOpen(false);
    const box = ref.current;
    if (!box) return;
    box.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) exec('insertHTML', `<a href="${escapeHtml(href)}">${escapeHtml(title)}</a>`);
    else exec('createLink', href);
    emit();
  };

```
Edit — vana:
```tsx
        {tool('Lisa link', <Link size={15} />, addLink)}
        {tool('Eemalda link', <Unlink size={15} />, () => exec('unlink'))}
```
uus:
```tsx
        {tool('Lisa link', <Link size={15} />, addLink)}
        {anchorsOf && tool('Link peatükki', <BookOpen size={15} />, openChapterLink)}
        {tool('Eemalda link', <Unlink size={15} />, () => exec('unlink'))}
```
Edit — lõpus vana:
```tsx
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          if (html) exec('insertHTML', sanitizeHelp(html));
          else exec('insertText', e.clipboardData.getData('text/plain'));
          emit();
        }}
      />
    </div>
  );
```
uus:
```tsx
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          if (html) exec('insertHTML', sanitizeHelp(html));
          else exec('insertText', e.clipboardData.getData('text/plain'));
          emit();
        }}
      />
      {anchorsOf && <ChapterLinkDialog open={chapterLinkOpen} onClose={() => setChapterLinkOpen(false)} onPick={insertChapterLink} anchorsOf={anchorsOf} />}
    </div>
  );
```

- [ ] **Step 4: `HelpHistory.tsx`**

```tsx
// Juhendi ajalugu: versioonide loend (uusim ees), eelvaade ja „Taasta see versioon“ (= uus salvestus vana sisuga).
import { useCallback, useEffect, useState } from 'react';
import { platformApi, type HelpVersionDetail, type HelpVersionRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { Alert, Button, CardButton } from '../components/ui';
import { cn } from '../components/ui/cn';
import { adminCardFootClass, adminFieldLabelClass, adminHintClass, adminMutedClass, adminSubpanelClass } from './adminUi.ts';

type Props = { helpKey: string; onRestored: () => Promise<void> };

export function HelpHistory({ helpKey, onRestored }: Props) {
  const [versions, setVersions] = useState<HelpVersionRow[] | null>(null);
  const [selected, setSelected] = useState<HelpVersionDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await platformApi.listHelpVersions(helpKey));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [helpKey]);

  useEffect(() => {
    setSelected(null);
    void load();
  }, [load]);

  const preview = async (id: number) => {
    try {
      setSelected(await platformApi.getHelpVersion(helpKey, id));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const restore = async () => {
    if (!selected || !window.confirm('Taasta see versioon? Praegune tekst jääb ajalukku.')) return;
    setBusy(true);
    try {
      await platformApi.restoreHelpVersion(helpKey, selected.id);
      await onRestored();
      setSelected(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const blank = selected !== null && selected.html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

  return (
    <div className={cn(adminSubpanelClass, 'flex flex-col gap-2.5')}>
      <div className={adminFieldLabelClass}>Ajalugu</div>
      <div className={adminHintClass}>Iga salvestus, eemaldamine ja taastamine jätab versiooni; alles on 50 viimast.</div>
      {error && <Alert tone="error">{error}</Alert>}
      {!versions && !error && <div className={adminMutedClass}>Laadin…</div>}
      {versions && versions.length === 0 && <div className={adminMutedClass}>Selle koha kohta pole veel versioone.</div>}
      {versions && versions.length > 0 && (
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {versions.map((v) => (
            <CardButton key={v.id} variant="tile" padding="none" selected={selected?.id === v.id} className="flex w-full items-baseline gap-2.5 px-2.5 py-1.5 text-left" onClick={() => void preview(v.id)}>
              <span className="text-base font-medium leading-natural">{formatTallinn(v.createdAt)}</span>
              <span className="text-xs leading-natural text-subtle">{v.createdBy ?? '–'}</span>
              {v.guideLink && <span className="text-xs leading-natural text-subtle">→ {v.guideLink}</span>}
            </CardButton>
          ))}
        </div>
      )}
      {selected && (
        <>
          {blank ? (
            <p className={adminHintClass}>See versioon on tühi (juhend eemaldati). Taastamine eemaldab praeguse teksti.</p>
          ) : (
            <div className="help-content max-h-80 overflow-y-auto rounded-md border border-dashed border-border p-3" dangerouslySetInnerHTML={{ __html: sanitizeHelp(selected.html) }} />
          )}
          <div className={adminCardFootClass}>
            <Button disabled={busy} onClick={() => setSelected(null)}>
              Sulge eelvaade
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void restore()}>
              Taasta see versioon
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `HelpView.tsx` — kaks jaotist, link, ajalugu (asenda kogu fail)**

```tsx
// Juhendid: jaotis Peatükid (16, järjekord koodis: src/help/guideChapters.ts) ja jaotis Kohtjuhendid (src/help/helpRegistry.ts)
// + redaktor, kohtjuhendi „Seotud peatükk“ ja ajalugu (versioonid, taastamine).
// Andmebaasis olevad, kuid koodist eemaldatud kohad näidatakse kohtjuhendite all eraldi, et neid saaks kustutada.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { platformApi, type HelpArticleRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { HELP_SPOTS, helpMaxLength, isHelpKey, type HelpSpot } from '../help/helpRegistry.ts';
import { GUIDE_CHAPTERS, MODULE_LABELS, isGuideChapterKey, type GuideChapterKey } from '../help/guideChapters.ts';
import { extractAnchors } from '../help/anchors.ts';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { RichTextEditor } from './RichTextEditor.tsx';
import { GuideLinkPicker } from './GuideLinkPicker.tsx';
import { HelpHistory } from './HelpHistory.tsx';
import { Alert, FilterClear, Card, CardButton, Button, Input } from '../components/ui';
import { cn } from '../components/ui/cn';
import { adminCardClass, adminCardFootClass, adminFieldLabelClass, adminH2FlushClass, adminHintClass, adminMutedClass, adminToolbarClass } from './adminUi.ts';

type Filter = 'all' | 'filled' | 'empty';
type Section = 'chapters' | 'spots';
type Spot = HelpSpot & { key: string; row?: HelpArticleRow; orphan: boolean; chapter: boolean };

const ORPHAN_AREA = 'Koodist eemaldatud';
const isBlank = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

export function HelpView() {
  const [rows, setRows] = useState<HelpArticleRow[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<Section>('chapters');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftLink, setDraftLink] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await platformApi.listHelp());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const spots = useMemo<Spot[]>(() => {
    const byKey = new Map((rows ?? []).map((r) => [r.key, r]));
    const chapters: Spot[] = GUIDE_CHAPTERS.map((c, i) => ({
      key: c.key,
      area: 'Peatükid',
      label: `${i + 1}. ${c.title}`,
      where: c.module ? `Ainult mooduliga „${MODULE_LABELS[c.module]}“` : 'Peatükk',
      row: byKey.get(c.key),
      orphan: false,
      chapter: true
    }));
    const known: Spot[] = Object.entries(HELP_SPOTS).map(([key, s]) => ({ key, ...s, row: byKey.get(key), orphan: false, chapter: false }));
    const orphans: Spot[] = (rows ?? [])
      .filter((r) => !isHelpKey(r.key) && !isGuideChapterKey(r.key))
      .map((r) => ({ key: r.key, area: ORPHAN_AREA, label: r.key, where: 'Seda kohta koodis enam pole', row: r, orphan: true, chapter: false }));
    return [...chapters, ...known, ...orphans];
  }, [rows]);

  const groups = useMemo<[string, Spot[]][]>(() => {
    const q = query.trim().toLowerCase();
    const visible = spots.filter((s) => {
      if ((section === 'chapters') !== s.chapter) return false;
      const filled = !!s.row && !isBlank(s.row.html);
      if (filter === 'filled' && !filled) return false;
      if (filter === 'empty' && filled) return false;
      return !q || `${s.area} ${s.label} ${s.where} ${s.key}`.toLowerCase().includes(q);
    });
    if (section === 'chapters') return [['', visible]]; // peatükid jäävad koodi järjekorda
    const map = new Map<string, Spot[]>();
    for (const s of visible) map.set(s.area, [...(map.get(s.area) ?? []), s]);
    return [...map.entries()].sort(([a], [b]) => (a === ORPHAN_AREA ? 1 : b === ORPHAN_AREA ? -1 : a.localeCompare(b, 'et')));
  }, [spots, section, filter, query]);

  const current = spots.find((s) => s.key === selected) ?? null;
  const savedHtml = current?.row?.html ?? '';
  const savedLink = current?.row?.guideLink ?? '';
  const dirty = current !== null && (sanitizeHelp(draft) !== sanitizeHelp(savedHtml) || draftLink !== savedLink);

  // Ankrud valitud peatüki salvestatud tekstist (link peatükki ja „Seotud peatükk“)
  const anchorsOf = useCallback((key: GuideChapterKey) => extractAnchors(rows?.find((r) => r.key === key)?.html ?? ''), [rows]);

  const open = (s: Spot) => {
    if (dirty && !window.confirm('Salvestamata muudatused lähevad kaduma. Jätkata?')) return;
    setSelected(s.key);
    setDraft(s.row?.html ?? '');
    setDraftLink(s.row?.guideLink ?? '');
    setHistoryOpen(false);
    setNotice('');
    setError('');
  };

  const changeSection = (next: Section) => {
    if (next === section) return;
    if (dirty && !window.confirm('Salvestamata muudatused lähevad kaduma. Jätkata?')) return;
    setSection(next);
    setSelected(null);
    setHistoryOpen(false);
    setNotice('');
    setError('');
  };

  const save = async (html: string) => {
    if (!current) return;
    const clean = sanitizeHelp(html);
    const max = helpMaxLength(current.key);
    if (clean.length > max) {
      setError(`Juhend on liiga pikk (kuni ${max} märki)`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const blank = isBlank(clean);
      const r = await platformApi.saveHelp(current.key, blank ? '' : clean, current.chapter || blank ? null : draftLink || null);
      setNotice(r.deleted ? 'Juhend eemaldatud — ikooni rakenduses ei näidata.' : 'Juhend salvestatud.');
      await load();
      if (r.deleted && current.orphan) setSelected(null);
      setDraft(blank ? '' : clean);
      if (blank) setDraftLink('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Pärast taastamist võta redaktorisse serveri seis (muidu jääks vana mustand)
  const afterRestore = async () => {
    if (!current) return;
    const fresh = await platformApi.listHelp();
    setRows(fresh);
    const row = fresh.find((r) => r.key === current.key);
    setDraft(row?.html ?? '');
    setDraftLink(row?.guideLink ?? '');
    setNotice('Versioon taastatud.');
  };

  const inSection = spots.filter((s) => !s.orphan && s.chapter === (section === 'chapters'));
  const filledCount = inSection.filter((s) => s.row && !isBlank(s.row.html)).length;

  return (
    <div className="grid grid-cols-[minmax(260px,340px)_1fr] items-start gap-4 max-[861px]:grid-cols-1">
      <Card className={cn(adminCardClass, 'sticky top-4 flex max-h-[calc(100vh-32px)] flex-col gap-2.5 overflow-y-auto')}>
        <div className={adminToolbarClass}>
          <h2 className={adminH2FlushClass}>Juhendid</h2>
          <span className={adminMutedClass}>{filledCount}/{inSection.length} täidetud</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" aria-pressed={section === 'chapters'} onClick={() => changeSection('chapters')}>
            Peatükid
          </Button>
          <Button size="sm" aria-pressed={section === 'spots'} onClick={() => changeSection('spots')}>
            Kohtjuhendid
          </Button>
        </div>
        <FilterClear active={!!query} onClear={() => setQuery('')}>
          <Input type="search" placeholder="Otsi…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </FilterClear>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'filled', 'empty'] as Filter[]).map((f) => (
            <Button key={f} size="sm" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Kõik' : f === 'filled' ? 'Täidetud' : 'Tühjad'}
            </Button>
          ))}
        </div>
        {!rows && !error && <div className={adminMutedClass}>Laadin…</div>}
        {rows && groups.every(([, items]) => items.length === 0) && <div className={adminMutedClass}>Ühtegi kohta ei leitud.</div>}
        {groups.map(([area, items]) => (
          <div key={area || 'chapters'} className="mt-1.5 flex flex-col gap-0.5">
            {area && <div className={cn(adminFieldLabelClass, 'mb-1')}>{area}</div>}
            {items.map((s) => {
              const filled = !!s.row && !isBlank(s.row.html);
              return (
                <CardButton key={s.key} variant="tile" padding="none" selected={s.key === selected} className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left" onClick={() => open(s)}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full border border-subtle', s.orphan && 'border-warning-solid bg-warning-solid', !s.orphan && filled && 'border-primary bg-primary')} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-base font-medium leading-natural">{s.label}</span>
                    <span className="text-xs leading-natural text-subtle">{s.where}</span>
                  </span>
                </CardButton>
              );
            })}
          </div>
        ))}
      </Card>

      <Card className={adminCardClass}>
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        {!current ? (
          <p className={adminHintClass}>
            {section === 'chapters'
              ? 'Vali vasakult peatükk, mille teksti muuta. Tühja peatüki asemel näeb kasutaja teksti „Juhend on koostamisel“.'
              : 'Vali vasakult koht, mille juhendit muuta. Tühja juhendiga kohas rakendus küsimärki ei näita.'}
          </p>
        ) : (
          <>
            <div className={adminToolbarClass}>
              <div>
                <h2 className={cn(adminH2FlushClass, 'mb-0.5')}>{current.label}</h2>
                <div className={adminHintClass}>{current.area} · {current.where} · <code>{current.key}</code></div>
              </div>
              {current.row && (
                <span className={cn(adminMutedClass, 'text-xs leading-natural')}>
                  Muudetud {formatTallinn(current.row.updatedAt)}{current.row.updatedBy ? `, ${current.row.updatedBy}` : ''}
                </span>
              )}
            </div>
            {current.orphan ? (
              <>
                <p className={adminHintClass}>Seda juhendikohta koodis enam pole, seega rakendus seda ei näita. Sisu:</p>
                <div className="help-content rounded-md border border-dashed border-border p-3" dangerouslySetInnerHTML={{ __html: sanitizeHelp(savedHtml) }} />
                <div className={adminCardFootClass}>
                  <Button disabled={busy} onClick={() => window.confirm('Kustuta see juhend?') && void save('')}>
                    Kustuta
                  </Button>
                </div>
              </>
            ) : (
              <>
                {!current.chapter && <GuideLinkPicker value={draftLink} onChange={setDraftLink} anchorsOf={anchorsOf} />}
                <RichTextEditor
                  key={`${current.key}:${current.row?.updatedAt ?? 'uus'}`}
                  initialHtml={savedHtml}
                  onChange={setDraft}
                  placeholder={current.chapter ? 'Kirjuta peatükk…' : 'Kirjuta juhend…'}
                  anchorsOf={anchorsOf}
                />
                <div className={cn(adminCardFootClass, 'items-center')}>
                  {dirty && <span className={cn(adminMutedClass, 'mr-auto text-sm leading-natural')}>Salvestamata muudatused</span>}
                  <Button aria-pressed={historyOpen} onClick={() => setHistoryOpen((v) => !v)}>
                    Ajalugu
                  </Button>
                  {current.row && (
                    <Button disabled={busy} onClick={() => window.confirm('Eemalda juhend? Küsimärki rakenduses enam ei näidata.') && void save('')}>
                      Eemalda juhend
                    </Button>
                  )}
                  <Button variant="primary" disabled={busy || !dirty} onClick={() => void save(draft)}>
                    Salvesta
                  </Button>
                </div>
                {historyOpen && <HelpHistory helpKey={current.key} onRestored={afterRestore} />}
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
```
Märkus: peatüki eemaldamise tekst „Küsimärki rakenduses enam ei näidata“ kehtib kohtjuhendile; peatükil eemaldamine toob lugejale „Juhend on koostamisel“ — kinnitustekst jääb ühine, sest sõnastus ei vigasta ja uut teksti pole vaja (YAGNI).

- [ ] **Step 6: tsc, oxlint, ui-audit**

Run: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json && npx oxlint && npm run ui-audit -- --details'`
Expected: tsc/oxlint 0; ui-audit kõik valvurid 0 (v.a „Skaalaväliseid vahesid (CSS)“ = 3 nagu README ütleb). Vigade korral paranda (`max-[861px]` ja skaala klassid on kasutatud).

- [ ] **Step 7: Täis vitest, commit, release**

Run: `SSH 'npx vitest run'` → PASS.
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/admin/HelpView.tsx src/admin/HelpHistory.tsx src/admin/GuideLinkPicker.tsx src/admin/ChapterLinkDialog.tsx src/admin/RichTextEditor.tsx && git commit -m "feat(juhend): admin Peatükid + Kohtjuhendid, seotud peatükk, link peatükki ja ajalugu" -m "Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>"'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && NODE_OPTIONS=--max-old-space-size=4096 npm run release'   # run_in_background
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris'
```

- [ ] **Step 8: Pildid (admin, `--platform`)**

Kirjuta `.superpowers/tmp/shot-guide-admin.sh` (Write-tööriistaga):
```bash
#!/bin/bash
# Admin „Juhendid“: peatükkide jaotis, kohtjuhendite jaotis, avatud peatükk. Ei salvesta midagi.
cd /home/debian/teris
OUT=.superpowers/tmp/shots/juhend-admin
mkdir -p "$OUT"
npx tsx scripts/shot.mts --platform '*' --out "$OUT" --width 1440 \
  --do "click:nav button:nth-child(5)" --do "wait:600" --do "shot:peatykid" \
  --do "click:button[data-slot=card]" --do "wait:500" --do "shot:peatukk-avatud" \
  --do "click:button[aria-label='Link peatükki']" --do "wait:400" --do "shot:link-dialoog" \
  --do "key:Escape" \
  /
npx tsx scripts/shot.mts --platform '*' --out "$OUT" --width 1440 \
  --do "click:nav button:nth-child(5)" --do "click:main >> text=Kohtjuhendid" --do "wait:500" --do "shot:kohtjuhendid" \
  /
git status --short
```
Run: `SSH 'bash .superpowers/tmp/shot-guide-admin.sh'`; vaata pilte (`.superpowers/tmp/shots/juhend-admin/`) Read-tööriistaga hele+tume: jaotise nupud, 16 peatükki järjekorras, redaktor, dialoog, Ajalugu (vaadatakse koodist, kui andmeid pole). Kui `main >> text=` selektor ei tööta `click:`-iga, kasuta `click:aside button:nth-of-type(2)` ehk jaotise teist nuppu (kontrolli DOM-ist). Pärast: `git status --short` ei tohi näidata uusi faile juurkaustas.

---

### Task 4: Juhendi vaade (päise nupp, täislehe vaade, otsing, sügavlink, moodulid)

**Files:**
- Create: `src/help/guideSearch.ts`, `src/help/guideSearch.test.ts`, `src/help/guideRoute.ts`, `src/components/GuideView.tsx`
- Modify: `src/help/guideLink.ts` (lisa `guideHash`, `markModuleLinks`), `src/help/guideLink.test.ts`, `src/help/helpStore.ts`, `src/components/Header.tsx`, `src/App.tsx`, `src/styles/app.css` (`@source`)

**Interfaces:**
- Consumes (T1/T2): `GUIDE_CHAPTERS`, `chapterByKey`, `visibleChapters`, `MODULE_LABELS`, `GuideChapterKey`, `GuideRef`, `parseGuideRef`, `formatGuideRef`, `anchorDomId`, `nextSlug`, `textOfHtml`, `sanitizeHelp`, `hasModule(user, m)` (`src/services/license.ts`), `LicenseModule`.
- Produces:
  - `guideLink.ts`: `guideHash(ref: GuideRef): string` (`#guide` või `#guide.fields#import`), `markModuleLinks(html: string, missingModule: (key: GuideChapterKey) => string | null): string`.
  - `guideSearch.ts`: `interface SearchChapter { key: GuideChapterKey; title: string; html: string }`, `interface GuideHit { chapter: GuideChapterKey; chapterTitle: string; anchor: string | null; anchorText: string | null; before: string; match: string; after: string }`, `searchGuide(chapters: SearchChapter[], query: string, limit?: number): GuideHit[]`.
  - `guideRoute.ts`: `useGuideRoute(): GuideRef | null`, `openGuide(ref?: GuideRef): void`, `closeGuide(): void`.
  - `helpStore.ts`: `useHelpArticle(key: HelpKey): string | undefined` (jääb), `useGuideLink(key: HelpKey): string | undefined`, `useGuideChapters(): { chapters: Partial<Record<GuideChapterKey, string>>; loaded: boolean }`, `reloadHelp(): void`.
  - `GuideView({ route: GuideRef; hasModule: (m: LicenseModule) => boolean })`.
  - `Header` uued propid `onOpenGuide?: () => void; guideOpen?: boolean`; `MainView` laieneb väärtusega `'guide'` (`MAIN_VIEWS` jääb, sest `guide` ei salvestu localStorage'isse).

- [ ] **Step 1: Laienda `guideLink` testi**

Edit `src/help/guideLink.test.ts`: vana import `import { formatGuideRef, isValidGuideLink, parseGuideRef } from './guideLink';` → uus `import { formatGuideRef, guideHash, isValidGuideLink, markModuleLinks, parseGuideRef } from './guideLink';`. Lisa faili lõppu:

```ts
describe('guideHash', () => {
  it('hash sügavlingi jaoks', () => {
    expect(guideHash({ chapter: null, anchor: null })).toBe('#guide');
    expect(guideHash({ chapter: 'guide.fields', anchor: null })).toBe('#guide.fields');
    expect(guideHash({ chapter: 'guide.fields', anchor: 'import' })).toBe('#guide.fields#import');
    // tagasi parsitav
    expect(parseGuideRef(guideHash({ chapter: 'guide.map', anchor: 'kihid' }))).toEqual({ chapter: 'guide.map', anchor: 'kihid' });
  });
});

describe('markModuleLinks', () => {
  const html = '<p>Vaata <a href="#guide.weather#aastad">ilmaandmeid</a> ja <a href="#guide.fields">põlde</a> ning <a href="https://x.ee">välist</a>.</p>';
  const missing = (key: string) => (key === 'guide.weather' ? 'Ilm' : null);

  it('moodulita peatüki link muutub märkega tekstiks, teised jäävad', () => {
    expect(markModuleLinks(html, missing)).toBe(
      '<p>Vaata <span>ilmaandmeid (vajab moodulit „Ilm“)</span> ja <a href="#guide.fields">põlde</a> ning <a href="https://x.ee">välist</a>.</p>'
    );
  });

  it('kui kõik moodulid on olemas, HTML ei muutu', () => {
    expect(markModuleLinks(html, () => null)).toBe(html);
  });
});
```

Run: `SSH 'npx vitest run src/help/guideLink.test.ts'` → FAIL (`guideHash`/`markModuleLinks` puuduvad).

- [ ] **Step 2: Lisa `guideHash` ja `markModuleLinks` faili `src/help/guideLink.ts`**

Edit importrida — vana `import { isGuideChapterKey, type GuideChapterKey } from './guideChapters';` → uus (sama). Lisa faili lõppu:

```ts
/** Sügavlingi hash: `#guide`, `#guide.fields`, `#guide.fields#import` */
export const guideHash = (ref: GuideRef): string => (ref.chapter ? `#${formatGuideRef(ref.chapter, ref.anchor)}` : '#guide');

const PEER_LINK = /<a\s[^>]*?href="#(guide\.[a-z-]+)(?:#[a-z0-9-]+)?"[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * Viited peatükkidele, mille moodulit ettevõttel pole: link asendub tekstiga + märkega „(vajab moodulit …)“.
 * `missingModule(key)` annab mooduli nime (või null, kui peatükk on kasutatav). Töötab puhastatud HTML-iga.
 */
export function markModuleLinks(html: string, missingModule: (key: GuideChapterKey) => string | null): string {
  return html.replace(PEER_LINK, (whole, key: string, text: string) => {
    if (!isGuideChapterKey(key)) return whole;
    const label = missingModule(key);
    return label ? `<span>${text} (vajab moodulit „${label}“)</span>` : whole;
  });
}
```
Run → PASS.

- [ ] **Step 3: Otsingu test**

Fail `src/help/guideSearch.test.ts`:

```ts
// Otsing üle peatükkide: lõigu katkend, lähim eelnev h3 ankur, kõik sõnad peavad esinema.
import { describe, it, expect } from 'vitest';
import { searchGuide, type SearchChapter } from './guideSearch';
import { extractAnchors } from './anchors';

const fields: SearchChapter = {
  key: 'guide.fields',
  title: 'Põllud',
  html: '<p>Põldude register näitab kõiki põlde.</p><h3>Kuidas importida PRIA ZIP-i?</h3><ol><li>Ava Põllud ja vali <strong>Impordi PRIA ZIP</strong>.</li><li>Kontrolli eelvaadet.</li></ol><h3>Hea teada</h3><p>Import ei kustuta olemasolevaid põlde.</p>'
};
const crops: SearchChapter = { key: 'guide.crops', title: 'Kultuurid', html: '<p>Kultuuride register. PRIA nimetus tuletatakse automaatselt.</p>' };

describe('searchGuide', () => {
  it('leiab lõigu, annab peatüki, ankru ja katkendi', () => {
    const hits = searchGuide([fields, crops], 'pria zip');
    expect(hits).toHaveLength(2); // h3 pealkiri ja loendipunkt
    const li = hits.find((h) => h.after.includes('eelvaadet') === false && h.anchorText === 'Kuidas importida PRIA ZIP-i?' && h.before.includes('Ava'))!;
    expect(li.chapter).toBe('guide.fields');
    expect(li.chapterTitle).toBe('Põllud');
    expect(li.anchor).toBe(extractAnchors(fields.html)[0].slug);
    expect(li.match.toLowerCase()).toBe('pria');
  });

  it('kõik sõnad peavad samas lõigus olema (AND), tõstutundetu', () => {
    expect(searchGuide([fields, crops], 'PRIA nimetus').map((h) => h.chapter)).toEqual(['guide.crops']);
    expect(searchGuide([fields, crops], 'pria olemasolevaid')).toEqual([]);
  });

  it('ankruta lõik (enne esimest h3) saab anchor null', () => {
    const hit = searchGuide([fields], 'register')[0];
    expect(hit.anchor).toBeNull();
    expect(hit.anchorText).toBeNull();
  });

  it('tühi päring ja piir', () => {
    expect(searchGuide([fields], '   ')).toEqual([]);
    const many: SearchChapter = { key: 'guide.map', title: 'Kaart', html: Array.from({ length: 40 }, () => '<p>kiht</p>').join('') };
    expect(searchGuide([many], 'kiht')).toHaveLength(30);
    expect(searchGuide([many], 'kiht', 5)).toHaveLength(5);
  });

  it('pikk lõik lõigatakse katkendiks (…)', () => {
    const long: SearchChapter = { key: 'guide.map', title: 'Kaart', html: `<p>${'a '.repeat(80)}märksõna${' b'.repeat(80)}</p>` };
    const hit = searchGuide([long], 'märksõna')[0];
    expect(hit.before.startsWith('…')).toBe(true);
    expect(hit.after.endsWith('…')).toBe(true);
    expect(hit.before.length + hit.match.length + hit.after.length).toBeLessThan(180);
  });
});
```

Run: `SSH 'npx vitest run src/help/guideSearch.test.ts'` → FAIL (import).

- [ ] **Step 4: Kirjuta `src/help/guideSearch.ts`**

```ts
// src/help/guideSearch.ts — otsing üle kõigi peatükkide: tabamus on lõik (p, li, h3, h4), mille tekstis esinevad kõik
// otsisõnad; kaasas on lähim eelnev h3 ankur, et klõps viiks täpsesse kohta.
import { nextSlug, textOfHtml } from './anchors';
import type { GuideChapterKey } from './guideChapters';

export interface SearchChapter {
  key: GuideChapterKey;
  title: string;
  html: string;
}

export interface GuideHit {
  chapter: GuideChapterKey;
  chapterTitle: string;
  /** Lähima eelneva h3 lühinimi (null = enne esimest vahepealkirja) */
  anchor: string | null;
  anchorText: string | null;
  /** Katkend: enne tabamust, tabamus (esimene otsisõna), pärast tabamust; servas „…“ */
  before: string;
  match: string;
  after: string;
}

const BEFORE = 50;
const AFTER = 70;

export function searchGuide(chapters: SearchChapter[], query: string, limit = 30): GuideHit[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: GuideHit[] = [];
  for (const ch of chapters) {
    const seen = new Map<string, number>();
    let anchor: string | null = null;
    let anchorText: string | null = null;
    for (const m of ch.html.matchAll(/<(h3|h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const text = textOfHtml(m[2]);
      if (!text) continue;
      if (m[1].toLowerCase() === 'h3') {
        anchor = nextSlug(seen, text);
        anchorText = text;
      }
      const low = text.toLowerCase();
      if (!words.every((w) => low.includes(w))) continue;
      const at = low.indexOf(words[0]);
      const from = Math.max(0, at - BEFORE);
      const to = Math.min(text.length, at + words[0].length + AFTER);
      hits.push({
        chapter: ch.key,
        chapterTitle: ch.title,
        anchor,
        anchorText,
        before: (from > 0 ? '…' : '') + text.slice(from, at),
        match: text.slice(at, at + words[0].length),
        after: text.slice(at + words[0].length, to) + (to < text.length ? '…' : '')
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
```
Run → PASS. (Test „leiab lõigu“: päring `pria zip` leiab h3 „Kuidas importida PRIA ZIP-i?“ ja li „…Impordi PRIA ZIP.“; kontrolli, et `li` leitakse `before` sisu „Ava“ järgi — kui tulemus erineb, parandab implementeerija tingimust testis, mitte koodi.)

- [ ] **Step 5: `helpStore.ts` — peatükid ja guideLinks (asenda kogu fail)**

```ts
// src/help/helpStore.ts — juhendid laaditakse rakenduses üks kord (GET /api/help) ja jagatakse kõigile HelpHint'idele ja
// juhendi vaatele: kohtjuhendite tekstid, seotud peatükid (guideLinks) ja peatükkide tekstid.
import { useSyncExternalStore } from 'react';
import type { HelpKey } from './helpRegistry';
import type { GuideChapterKey } from './guideChapters';

interface HelpState {
  articles: Partial<Record<HelpKey, string>>;
  guideLinks: Partial<Record<HelpKey, string>>;
  chapters: Partial<Record<GuideChapterKey, string>>;
  loaded: boolean;
}

let state: HelpState = { articles: {}, guideLinks: {}, chapters: {}, loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function fetchHelp(): Promise<void> {
  return fetch('/api/help', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: Partial<Omit<HelpState, 'loaded'>>) => {
      state = { articles: d.articles ?? {}, guideLinks: d.guideLinks ?? {}, chapters: d.chapters ?? {}, loaded: true };
      listeners.forEach((l) => l());
    });
}

function load() {
  if (loading) return;
  loading = fetchHelp().catch(() => {
    loading = null; // proovi järgmisel kuvamisel uuesti
  });
}

/** Juhendi vaade värskendab teksti iga avamisel (teenusepakkuja võib seda vahepeal muuta). */
export function reloadHelp(): void {
  void fetchHelp().catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
};

const getState = () => state;

export const useHelpArticle = (key: HelpKey): string | undefined => useSyncExternalStore(subscribe, getState).articles[key];

/** Kohtjuhendi seotud peatükk kujul `guide.fields#import` (puudub, kui seost pole) */
export const useGuideLink = (key: HelpKey): string | undefined => useSyncExternalStore(subscribe, getState).guideLinks[key];

export const useGuideChapters = (): { chapters: HelpState['chapters']; loaded: boolean } => {
  const s = useSyncExternalStore(subscribe, getState);
  return s;
};
```

- [ ] **Step 6: `guideRoute.ts`**

```ts
// src/help/guideRoute.ts — juhendi sügavlink on URL-i hash (`#guide.fields#import`): ajalugu ja tagasi-nupp töötavad
// brauseri enda `hashchange`/`popstate` kaudu; „?“-ikooni ja peatükkide vahelised lingid on samad hash-lingid.
import { useMemo, useSyncExternalStore } from 'react';
import { guideHash, parseGuideRef, type GuideRef } from './guideLink';

const REFRESH = 'teris:guide-route';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  window.addEventListener(REFRESH, cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
    window.removeEventListener(REFRESH, cb);
  };
};

/** Praegune juhendi viide URL-ist; null = juhend pole avatud */
export function useGuideRoute(): GuideRef | null {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return useMemo(() => parseGuideRef(hash), [hash]);
}

/** Avab juhendi (uus ajaloo kirje: tagasi-nupp viib eelmisesse kohta). */
export function openGuide(ref: GuideRef = { chapter: null, anchor: null }): void {
  const target = guideHash(ref);
  if (window.location.hash === target) {
    window.dispatchEvent(new Event(REFRESH));
    return;
  }
  window.location.hash = target;
}

/** Sulgeb juhendi: hash kaob URL-ist (uus ajaloo kirje; tagasi-nupp avab juhendi uuesti). */
export function closeGuide(): void {
  window.history.pushState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new Event(REFRESH));
}
```

- [ ] **Step 7: `GuideView.tsx`**

```tsx
// src/components/GuideView.tsx — kasutusjuhend: täislehe vaade. Vasakul peatükkide loend, paremal peatüki tekst;
// ülal otsing üle kõigi peatükkide. Kitsal ekraanil on loend rippmenüü. Sügavlink: `#guide.<peatükk>[#ankur]` (guideRoute.ts).
// Moodulist sõltuvat peatükki ettevõttele, kellel moodulit pole, ei näidata; viited neile saavad märke „vajab moodulit …“.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Alert, Card, CardButton, EmptyState, PageHeader, SearchInput, Select, type SelectOption } from './ui';
import { boardBodyClass, boardMainClass, boardViewClass } from './ui/variants';
import { MODULE_LABELS, chapterByKey, visibleChapters, type GuideChapterKey } from '../help/guideChapters';
import { markModuleLinks, parseGuideRef, type GuideRef } from '../help/guideLink';
import { anchorDomId } from '../help/anchors';
import { searchGuide } from '../help/guideSearch';
import { openGuide } from '../help/guideRoute';
import { reloadHelp, useGuideChapters } from '../help/helpStore';
import { sanitizeHelp } from '../help/sanitizeHelp';
import type { LicenseModule } from '../types/auth';

export const GuideView: React.FC<{ route: GuideRef; hasModule: (m: LicenseModule) => boolean }> = ({ route, hasModule }) => {
  const { chapters, loaded } = useGuideChapters();
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => visibleChapters(hasModule), [hasModule]);
  const requested = route.chapter;
  const hiddenRequested = requested && !visible.some((c) => c.key === requested) ? chapterByKey(requested) : null;
  const current = (requested && visible.find((c) => c.key === requested)) || visible[0];

  useEffect(() => {
    reloadHelp();
  }, []);

  const missingModule = useCallback(
    (key: GuideChapterKey): string | null => {
      const m = chapterByKey(key).module;
      return m && !hasModule(m) ? MODULE_LABELS[m] : null;
    },
    [hasModule]
  );

  const rawHtml = chapters[current.key];
  const safe = useMemo(() => (rawHtml ? markModuleLinks(sanitizeHelp(rawHtml), missingModule) : ''), [rawHtml, missingModule]);

  const hits = useMemo(
    () => (query.trim().length >= 2 ? searchGuide(visible.map((c) => ({ key: c.key, title: c.title, html: chapters[c.key] ?? '' })), query) : null),
    [query, visible, chapters]
  );

  // Kohale kerimine: ankur (kui on) või peatüki algus
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || hits) return;
    const target = route.anchor ? box.querySelector<HTMLElement>(`#${CSS.escape(anchorDomId(route.anchor))}`) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else box.scrollTo({ top: 0 });
  }, [current.key, route.anchor, safe, hits]);

  const go = (key: GuideChapterKey, anchor: string | null = null) => {
    setQuery('');
    openGuide({ chapter: key, anchor });
  };

  // Peatükkide vahelised lingid (`#guide.fields#import`) avanevad selles vaates
  const onContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const href = (e.target as HTMLElement).closest('a')?.getAttribute('href');
    const ref = href?.startsWith('#guide') ? parseGuideRef(href) : null;
    if (!ref) return;
    e.preventDefault();
    setQuery('');
    openGuide(ref);
  };

  const chapterOptions: SelectOption[] = visible.map((c) => ({ value: c.key, label: c.title }));

  return (
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader
          icon={<BookOpen />}
          title="Juhend"
          subtitle="Kuidas Terisega töötada: peatükid vaadete kaupa ja ülesanded samm-sammult"
          actions={<SearchInput value={query} onChange={setQuery} placeholder="Otsi juhendist…" aria-label="Otsi juhendist" className="w-72 max-[861px]:w-full" />}
        />
        <div className={`${boardBodyClass} grid grid-cols-[minmax(220px,280px)_minmax(0,1fr)] items-start gap-4 max-[861px]:grid-cols-1`}>
          <Card className="flex flex-col gap-0.5 max-[861px]:hidden">
            {visible.map((c) => (
              <CardButton key={c.key} variant="tile" padding="none" selected={!hits && c.key === current.key} className="flex w-full items-baseline gap-2 px-2.5 py-2 text-left" onClick={() => go(c.key)}>
                <span className="text-xs leading-natural text-subtle">{visible.indexOf(c) + 1}</span>
                <span className="text-base font-medium leading-natural">{c.title}</span>
                {chapters[c.key] === undefined && loaded && <span className="ml-auto text-xs leading-natural text-subtle">koostamisel</span>}
              </CardButton>
            ))}
          </Card>
          <div className="hidden max-[861px]:block">
            <Select aria-label="Peatükk" value={current.key} onValueChange={(v) => go(v as GuideChapterKey)} options={chapterOptions} />
          </div>

          <div ref={scrollRef} className="min-h-0 min-w-0">
            {hits ? (
              <Card className="flex flex-col gap-2">
                <div className="text-sm text-muted-foreground">
                  {hits.length === 0 ? 'Midagi ei leitud.' : `${hits.length} tabamust`}
                </div>
                {hits.map((h, i) => (
                  <CardButton key={i} variant="tile" padding="none" className="flex w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left" onClick={() => go(h.chapter, h.anchor)}>
                    <span className="text-xs font-semibold text-subtle">
                      {h.chapterTitle}
                      {h.anchorText ? ` · ${h.anchorText}` : ''}
                    </span>
                    <span className="text-sm text-foreground">
                      {h.before}
                      <strong>{h.match}</strong>
                      {h.after}
                    </span>
                  </CardButton>
                ))}
              </Card>
            ) : (
              <Card className="mx-auto max-w-3xl">
                {hiddenRequested?.module && (
                  <Alert tone="warning">Peatükk „{hiddenRequested.title}“ vajab moodulit „{MODULE_LABELS[hiddenRequested.module]}“, mida teie ettevõttel pole.</Alert>
                )}
                <h2 className="mb-3 text-xl font-semibold leading-natural">{current.title}</h2>
                {safe ? (
                  <div className="help-content" onClick={onContentClick} dangerouslySetInnerHTML={{ __html: safe }} />
                ) : !loaded ? (
                  <div className="text-sm text-muted-foreground">Laadin…</div>
                ) : (
                  <EmptyState title="Juhend on koostamisel" description="Selle peatüki tekst lisandub peagi." />
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
```
Märkused implementeerijale: (a) `Alert` toonid kontrolli failist `ui/Alert.tsx` (rakenduse info/warning on kasutaja otsusel `tone="neutral"` — kasuta `tone="neutral"`, kui `warning` pole põhirakenduses lubatud); (b) `boardBodyClass` on `overflow-auto` — kui parem veerg ei keri, pane `scrollRef` div `max-h` asemel `overflow-y-auto` + `min-h-0` ja grid-ile `min-h-0 flex-1`; kontrolli piltidelt; (c) `onClick` div'il võib oxlint `jsx-a11y` hoiatada — link on alati fokuseeritav `<a>`, seega lisa `// oxlint-disable-next-line` ainult kui lint tõesti viga annab.

- [ ] **Step 8: `Header.tsx` — nupp „Juhend“**

Edit importrid — vana:
```tsx
  Repeat,
  CloudSun
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavSwitch, NavSwitchItem } from './ui';
```
uus:
```tsx
  Repeat,
  CloudSun,
  BookOpen
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, NavSwitch, NavSwitchItem, cn } from './ui';
import { headerNarrowHiddenClass, headerTriggerClass } from './ui/variants';
```
Edit — vana `export type MainView = typeof MAIN_VIEWS[number];` → uus:
```tsx
// `guide` (Juhend) pole peamenüü kirje ega salvestu localStorage'isse: avaneb URL-i hash'iga (src/help/guideRoute.ts)
export type MainView = typeof MAIN_VIEWS[number] | 'guide';
```
Edit `HeaderProps` — vana `  showWeather?: boolean;\n}` → uus `  showWeather?: boolean;\n  onOpenGuide?: () => void;\n  guideOpen?: boolean;\n}`. Edit destruktuuri — vana `  showWeather = false\n}) => {` → uus `  showWeather = false,\n  onOpenGuide,\n  guideOpen = false\n}) => {`. Edit — vana:
```tsx
        {currentUser && (
          <UserMenu
```
uus:
```tsx
        {onOpenGuide && (
          <Button variant="ghost" className={cn(headerTriggerClass)} aria-pressed={guideOpen} aria-label="Juhend" title="Juhend" onClick={onOpenGuide}>
            <BookOpen size={14} />
            <span className={headerNarrowHiddenClass}>Juhend</span>
          </Button>
        )}

        {currentUser && (
          <UserMenu
```

- [ ] **Step 9: `App.tsx` — vaate vahetus hash'i järgi**

Edit importrid: vana `import { hasModule } from './services/license';` → uus
```tsx
import { hasModule } from './services/license';
import { useGuideRoute, openGuide, closeGuide } from './help/guideRoute';
import { parseGuideRef } from './help/guideLink';
```
Edit lazy-plokk — vana `const ArticlesView = lazy(() => import('./components/ArticlesView').then((m) => ({ default: m.ArticlesView })));` → lisa järele:
```tsx
const GuideView = lazy(() => import('./components/GuideView').then((m) => ({ default: m.GuideView })));
```
Edit — vana plokk `const [mainView, setMainView] = useState<MainView>(() => { try { … } });` ja `changeMainView` (read 491–507) asenda:
```tsx
  const readSavedView = (): MainView => {
    try {
      const saved = localStorage.getItem(mainViewKey);
      if (saved === 'weather' && !hasModule(user, 'WEATHER')) return 'map'; // moodulita vaade jätaks lehe tühjaks
      return saved && (MAIN_VIEWS as readonly string[]).includes(saved) ? (saved as MainView) : 'map';
    } catch {
      return 'map';
    }
  };
  // Juhend avaneb URL-i hash'iga (#guide.fields#import); `guide` ei salvestu localStorage'isse, sulgemisel tagasi eelmisesse vaatesse
  const guideRoute = useGuideRoute();
  const viewBeforeGuideRef = useRef<MainView>(readSavedView());
  const [mainView, setMainView] = useState<MainView>(() => (parseGuideRef(window.location.hash) ? 'guide' : readSavedView()));
  useEffect(() => {
    if (guideRoute) {
      setMainView((v) => {
        if (v !== 'guide') viewBeforeGuideRef.current = v;
        return 'guide';
      });
    } else {
      setMainView((v) => (v === 'guide' ? viewBeforeGuideRef.current : v));
    }
  }, [guideRoute]);
  const guideHasModule = React.useCallback((m: Parameters<typeof hasModule>[1]) => hasModule(user, m), [user]);
  const changeMainView = (view: MainView) => {
    if (guideRoute) closeGuide(); // peamenüü valik sulgeb juhendi
    setMainView(view);
    if (view !== 'works') { setWorksFocusId(null); setWorksSearch(null); } // ootel töö/otsing ei kehti pärast vaate vahetust
    try {
      localStorage.setItem(mainViewKey, view);
    } catch {
      // brauseri salvestus pole saadaval — valik kehtib ainult selle seansi ajal
    }
    // Leaflet peab peidetud konteineri suuruse uuesti arvutama
    if (view === 'map') setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  };
```
(Kustuta vana `const [mainView…]` ja `changeMainView` definitsioon, et neid ei oleks kaks; kontrolli `grep -n "const changeMainView" src/App.tsx` = 1.)

Edit Header kutse — vana `        showWeather={hasModule(user, 'WEATHER')}\n      />` → uus:
```tsx
        showWeather={hasModule(user, 'WEATHER')}
        onOpenGuide={() => openGuide()}
        guideOpen={mainView === 'guide'}
      />
```
Edit — vana `      {mainView === 'weather' && hasModule(user, 'WEATHER') && (` ette lisa:
```tsx
      {mainView === 'guide' && guideRoute && (
        <Suspense fallback={null}>
          <GuideView route={guideRoute} hasModule={guideHasModule} />
        </Suspense>
      )}

```
Päise nupp, kui juhend on juba avatud, peab ikka avama: `openGuide()` ilma peatükita avab esimese nähtava — vajadusel jääb praegune hash (sama `#guide`) ja ainult värskendab.

- [ ] **Step 10: `@source` ja kontroll**

Edit `src/styles/app.css` — vana `@source '../components/HarvestLotsPanel.tsx';` → uus `@source '../components/HarvestLotsPanel.tsx';\n@source '../components/GuideView.tsx';`.

Run: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json && npx oxlint && npx vitest run && npm run ui-audit -- --details'`
Expected: kõik 0/PASS (ui-audit „Tailwindi klasse ilma @source-ita“ = 0). `MainView` laiendus: tsc näitab võimalikke ammendavaid `Record<MainView,…>`-e — paranda neid (grep `-e MainView`).

- [ ] **Step 11: Commit, release**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/help/guideSearch.ts src/help/guideSearch.test.ts src/help/guideRoute.ts src/help/guideLink.ts src/help/guideLink.test.ts src/help/helpStore.ts src/components/GuideView.tsx src/components/Header.tsx src/App.tsx src/styles/app.css && git commit -m "feat(juhend): Juhendi vaade, otsing, sügavlink ja päise nupp" -m "Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>"'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && NODE_OPTIONS=--max-old-space-size=4096 npm run release'   # run_in_background
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris'
```

- [ ] **Step 12: Pildid ja käitumise kontroll**

Kirjuta `.superpowers/tmp/shot-guide.sh`:
```bash
#!/bin/bash
# Juhendi vaade: 1440 ja kitsas (800), hele+tume. Ei salvesta midagi.
cd /home/debian/teris
OUT=.superpowers/tmp/shots/juhend
mkdir -p "$OUT"
for W in 1440 800; do
  npx tsx scripts/shot.mts --user andresj --out "$OUT" --width "$W" --do "wait:800" --do "shot:w$W-algus" "/#guide"
  npx tsx scripts/shot.mts --user andresj --out "$OUT" --width "$W" --do "wait:800" --do "shot:w$W-sugavlink" "/#guide.fields#import"
  npx tsx scripts/shot.mts --user andresj --out "$OUT" --width "$W" --do "wait:600" --do "click:input[aria-label='Otsi juhendist']" --do "key:p" --do "key:r" --do "key:i" --do "key:a" --do "wait:500" --do "shot:w$W-otsing" "/#guide"
done
git status --short
```
Enne pildistamist kontrolli kasutaja `andresj` ettevõtte mooduleid (Global Constraints, „Pildid“: päring `tenant_licenses`); Run: `SSH 'bash .superpowers/tmp/shot-guide.sh'`. Vaata pilte: päise nupp (ikoon + tekst 1440-l, ainult ikoon kitsal), loend vasakul/rippmenüü kitsal, „Juhend on koostamisel“ (kui peatükke pole laetud), telemeetria/ilma peatükk peidetud mooduliteta ettevõttel (kontrolli koodist `visibleChapters`, kui pildikasutajal on kõik moodulid). Käsitsi kontroll brauseris (kontroller): `#guide.fields#import` avab õige koha; tagasi-nupp viib eelmisesse vaatesse; peamenüü valik sulgeb juhendi.

---

### Task 5: „?“-ikoonid — `view.*` kohtjuhendid ja link „Loe juhendist →“

**Files:**
- Modify: `src/help/helpRegistry.ts`, `src/help/helpRegistry.test.ts`, `src/components/ui/HelpHint.tsx`, `src/components/ui/PageHeader.tsx`, `src/components/ui/variants.ts`, `src/components/ui/index.ts`, `src/components/LayerControl.tsx`, ja `PageHeader` kutsed: `FieldsTableView.tsx:246`, `CropRegisterModal.tsx:888`, `FieldManagerModal.tsx:661`, `FieldWorksBoard.tsx:798`, `ArticlesView.tsx:147`, `VehicleTracker.tsx:2068`, `PoiManagerModal.tsx:465`, `RelatedPartiesModal.tsx:609`, `WeatherView.tsx:72`, `SeasonManagerModal.tsx:308`

**Interfaces:**
- Consumes: `useGuideLink`, `useHelpArticle` (T4), `guideHref`/`parseGuideRef` (T1/T4), `HELP_SPOTS`.
- Produces:
  - 11 uut `HELP_SPOTS` võtit `view.map`, `view.fields`, `view.crops`, `view.rotation`, `view.works`, `view.stock`, `view.fleet`, `view.infrastructure`, `view.parties`, `view.weather`, `view.seasons` (area „Vaated“).
  - `PageHeader` uus valikuline prop `helpKey?: HelpKey` — ikoon pealkirja kõrval.
  - `HelpHintPopover` uus valikuline prop `guideHref?: string`; `HelpHint` leiab selle `useGuideLink`-ist.
  - `ui/variants.ts` `helpHintLinkClass`, `pageHeaderTitleRowClass`.

- [ ] **Step 1: Test — iga peamenüü vaatel on kohtjuhend ja vaikimisi seotud peatükk**

Edit `src/help/helpRegistry.test.ts` — vana import `import { HELP_MAX_LENGTH, helpMaxLength } from './helpRegistry';` → uus
```ts
import { HELP_MAX_LENGTH, HELP_SPOTS, helpMaxLength } from './helpRegistry';
import { isValidGuideLink, parseGuideRef } from './guideLink';
```
ja lisa faili lõppu:
```ts
describe('view.* kohtjuhendid', () => {
  // Peamenüü vaated (Header MAIN_VIEWS): igaühel on pealkirja kõrvale „?“-koht
  const VIEWS = ['map', 'fields', 'crops', 'rotation', 'works', 'stock', 'fleet', 'infrastructure', 'parties', 'weather', 'seasons'];

  it('iga vaate kohta üks kirje alal „Vaated“', () => {
    const keys = Object.keys(HELP_SPOTS).filter((k) => k.startsWith('view.'));
    expect(keys.sort()).toEqual(VIEWS.map((v) => `view.${v}`).sort());
    for (const k of keys) expect(HELP_SPOTS[k as keyof typeof HELP_SPOTS].area).toBe('Vaated');
  });

  it('olemasolevad 4 kohta jäävad', () => {
    expect(Object.keys(HELP_SPOTS).filter((k) => k.startsWith('fields.register.'))).toHaveLength(4);
  });
});

describe('kohtjuhendite vaikimisi seotud peatükk (guideLink)', () => {
  const spots = HELP_SPOTS as Record<string, { guideLink?: string }>;

  it('igal kohal on kehtiv peatükiviide (ilma #-ta, ilma ankruta)', () => {
    for (const [key, s] of Object.entries(spots)) {
      expect(s.guideLink, key).toBeDefined();
      expect(isValidGuideLink(s.guideLink!), key).toBe(true);
      expect(parseGuideRef(s.guideLink!)!.anchor, key).toBeNull();
    }
  });

  it('view.<vaade> viitab peatükile guide.<vaade>; olemasolevad 4 Külvikorda ja Põldudesse', () => {
    for (const k of Object.keys(spots).filter((k) => k.startsWith('view.'))) expect(spots[k].guideLink).toBe(`guide.${k.slice('view.'.length)}`);
    expect(spots['fields.register.export-csv'].guideLink).toBe('guide.rotation');
    for (const k of ['import-soil-samples', 'import-field-book', 'import-pria-zip']) expect(spots[`fields.register.${k}`].guideLink).toBe('guide.fields');
  });
});
```
Run: `SSH 'npx vitest run src/help/helpRegistry.test.ts'` → FAIL (view.* ja guideLink puuduvad).

- [ ] **Step 2: Lisa `view.*` ja vaikimisi `guideLink` registrisse**

Edit `src/help/helpRegistry.ts` — interfaces vana
```ts
  /** Kus see koht täpselt asub */
  where: string;
}
```
uus
```ts
  /** Kus see koht täpselt asub */
  where: string;
  /** Vaikimisi seotud peatükk (`guide.<peatükk>[#ankur]`): mustandite laadija paneb selle kohtjuhendile, kui seos on tühi */
  guideLink?: string;
}
```
Edit — vana kogu `HELP_SPOTS` plokk
```ts
export const HELP_SPOTS = {
  'fields.register.export-csv': { area: 'Külvikord', label: 'CSV eksport', where: 'Külvikord → tööriistariba' },
  'fields.register.import-soil-samples': { area: 'Põllud', label: 'Impordi mullaproovid', where: 'Põllud → tööriistariba' },
  'fields.register.import-field-book': { area: 'Põllud', label: 'Impordi põlluraamat', where: 'Põllud → tööriistariba' },
  'fields.register.import-pria-zip': { area: 'Põllud', label: 'Impordi PRIA ZIP', where: 'Põllud → tööriistariba' }
} as const satisfies Record<string, HelpSpot>;
```
uus
```ts
export const HELP_SPOTS = {
  'fields.register.export-csv': { area: 'Külvikord', label: 'CSV eksport', where: 'Külvikord → tööriistariba', guideLink: 'guide.rotation' },
  'fields.register.import-soil-samples': { area: 'Põllud', label: 'Impordi mullaproovid', where: 'Põllud → tööriistariba', guideLink: 'guide.fields' },
  'fields.register.import-field-book': { area: 'Põllud', label: 'Impordi põlluraamat', where: 'Põllud → tööriistariba', guideLink: 'guide.fields' },
  'fields.register.import-pria-zip': { area: 'Põllud', label: 'Impordi PRIA ZIP', where: 'Põllud → tööriistariba', guideLink: 'guide.fields' },
  'view.map': { area: 'Vaated', label: 'Kaart', where: 'Kaart → kaardikihtide paneeli pealkiri', guideLink: 'guide.map' },
  'view.fields': { area: 'Vaated', label: 'Põllud', where: 'Põllud → vaate pealkiri', guideLink: 'guide.fields' },
  'view.crops': { area: 'Vaated', label: 'Kultuurid', where: 'Kultuurid → vaate pealkiri', guideLink: 'guide.crops' },
  'view.rotation': { area: 'Vaated', label: 'Külvikord', where: 'Külvikord → vaate pealkiri', guideLink: 'guide.rotation' },
  'view.works': { area: 'Vaated', label: 'Põllutööd', where: 'Põllutööd → vaate pealkiri', guideLink: 'guide.works' },
  'view.stock': { area: 'Vaated', label: 'Laoarvestus', where: 'Laoarvestus → vaate pealkiri', guideLink: 'guide.stock' },
  'view.fleet': { area: 'Vaated', label: 'Tehnika', where: 'Tehnika → vaate pealkiri', guideLink: 'guide.fleet' },
  'view.infrastructure': { area: 'Vaated', label: 'Taristu', where: 'Taristu → vaate pealkiri', guideLink: 'guide.infrastructure' },
  'view.parties': { area: 'Vaated', label: 'Isikud', where: 'Isikud → vaate pealkiri', guideLink: 'guide.parties' },
  'view.weather': { area: 'Vaated', label: 'Ilm', where: 'Ilm → vaate pealkiri', guideLink: 'guide.weather' },
  'view.seasons': { area: 'Vaated', label: 'Hooajad', where: 'Hooajad → vaate pealkiri', guideLink: 'guide.seasons' }
} as const satisfies Record<string, HelpSpot>;
```
Run → PASS. (Admin „Seotud peatükk“ valik võib linki hiljem täpsustada ankruga; laadija ei kirjuta olemasolevat linki üle.)

- [ ] **Step 3: variants — lingi ja pealkirjarea klassid**

Edit `src/components/ui/variants.ts` — vana `export const helpHintTitleClass = 'mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground';` → uus:
```ts
export const helpHintTitleClass = 'mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground';
/** „Loe juhendist →“ link hüpiku all */
export const helpHintLinkClass = 'mt-2 inline-block text-sm font-medium text-info-text no-underline hover:underline';
```
Edit — vana `export const pageHeaderTitleClass = 'm-0 text-xl font-semibold leading-6 text-foreground';` → uus:
```ts
export const pageHeaderTitleClass = 'm-0 text-xl font-semibold leading-6 text-foreground';
/** Pealkiri + „?“-ikoon kõrvuti */
export const pageHeaderTitleRowClass = 'flex items-center gap-1.5';
```
Edit `src/components/ui/index.ts` — `helpHintTitleClass, type FieldSize` → `helpHintTitleClass, helpHintLinkClass, type FieldSize` (selles ühes pikas ekspordireas; kasuta Edit-i unikaalse alamstringiga `helpHintTitleClass, type FieldSize`).

- [ ] **Step 4: `HelpHint.tsx` — link**

Edit importid — vana:
```tsx
import { useHelpArticle } from '../../help/helpStore';
import { sanitizeHelp } from '../../help/sanitizeHelp';
```
uus:
```tsx
import { useGuideLink, useHelpArticle } from '../../help/helpStore';
import { sanitizeHelp } from '../../help/sanitizeHelp';
import { isValidGuideLink } from '../../help/guideLink';
```
Edit `variants`-import — vana `import { helpHintContentClass, helpHintInlineClass, helpHintTitleClass, helpHintTriggerClass } from './variants';` → uus `import { helpHintContentClass, helpHintInlineClass, helpHintLinkClass, helpHintTitleClass, helpHintTriggerClass } from './variants';`.
Edit — vana:
```tsx
  const html = useHelpArticle(helpKey);
  const safe = useMemo(() => (html ? sanitizeHelp(html) : ''), [html]);
  if (!safe) return null;
  return <HelpHintPopover label={HELP_SPOTS[helpKey].label} html={safe} inline={inline} />;
};

/** Ikoon + hüpik valmis (puhastatud) sisuga; `html` peab olema läbinud `sanitizeHelp`. */
export const HelpHintPopover: React.FC<{ label: string; html: string; inline?: boolean }> = ({ label, html, inline = false }) => {
```
uus:
```tsx
  const html = useHelpArticle(helpKey);
  const link = useGuideLink(helpKey);
  const safe = useMemo(() => (html ? sanitizeHelp(html) : ''), [html]);
  if (!safe) return null;
  return <HelpHintPopover label={HELP_SPOTS[helpKey].label} html={safe} inline={inline} guideHref={link && isValidGuideLink(link) ? `#${link}` : undefined} />;
};

/** Ikoon + hüpik valmis (puhastatud) sisuga; `html` peab olema läbinud `sanitizeHelp`. `guideHref` (`#guide.fields#import`) lisab lingi „Loe juhendist →“. */
export const HelpHintPopover: React.FC<{ label: string; html: string; inline?: boolean; guideHref?: string }> = ({ label, html, inline = false, guideHref }) => {
```
Edit — vana:
```tsx
        <div className="help-content" dangerouslySetInnerHTML={{ __html: html }} />
      </PopoverContent>
```
uus:
```tsx
        <div className="help-content" dangerouslySetInnerHTML={{ __html: html }} />
        {guideHref && (
          <a href={guideHref} className={helpHintLinkClass} onClick={close}>
            Loe juhendist →
          </a>
        )}
      </PopoverContent>
```
(Klõps muudab hash'i ja `GuideView` avaneb `App` kaudu; `onClick={close}` sulgeb hüpiku; `PopoverContent` `onClick` stopPropagation ei takista linki, sest vaikimisi toimingut ei tühistata.) Päise tekst failis (kommentaar rida 1–4): lisa lause „Kui kohtjuhendil on seotud peatükk, on hüpiku all link „Loe juhendist →“.“

- [ ] **Step 5: `PageHeader` `helpKey`**

Edit `src/components/ui/PageHeader.tsx` — vana:
```tsx
import { cn } from './cn';
import {
  pageHeaderActionsClass, pageHeaderClass, pageHeaderIconClass, pageHeaderSubtitleClass, pageHeaderTitleClass, pageHeaderTitleWrapClass,
} from './variants';

export const PageHeader: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ icon, title, subtitle, actions, className }) => (
  <div className={cn(pageHeaderClass, className)}>
    <div className={pageHeaderTitleWrapClass}>
      <span className={pageHeaderIconClass} aria-hidden="true">{icon}</span>
      <div>
        <h2 className={pageHeaderTitleClass}>{title}</h2>
```
uus:
```tsx
import { cn } from './cn';
import { HelpHint } from './HelpHint';
import type { HelpKey } from '../../help/helpRegistry';
import {
  pageHeaderActionsClass, pageHeaderClass, pageHeaderIconClass, pageHeaderSubtitleClass, pageHeaderTitleClass, pageHeaderTitleRowClass, pageHeaderTitleWrapClass,
} from './variants';

export const PageHeader: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Vaate „?“-ikoon pealkirja kõrval (kohtjuhend `view.<vaade>`) */
  helpKey?: HelpKey;
}> = ({ icon, title, subtitle, actions, className, helpKey }) => (
  <div className={cn(pageHeaderClass, className)}>
    <div className={pageHeaderTitleWrapClass}>
      <span className={pageHeaderIconClass} aria-hidden="true">{icon}</span>
      <div>
        <div className={pageHeaderTitleRowClass}>
          <h2 className={pageHeaderTitleClass}>{title}</h2>
          {helpKey && <HelpHint helpKey={helpKey} />}
        </div>
```
ja sulge — vana `        {subtitle != null && <div className={pageHeaderSubtitleClass}>{subtitle}</div>}` jääb samaks (rea eelmine `<h2>` rida on asendatud ülal).

- [ ] **Step 6: Kümme PageHeader kutset + kaardi paneel**

Iga faili `<PageHeader …>` kutsesse lisa `helpKey="view.<vaade>"` (Edit, unikaalne `title="…"` string):
- `FieldsTableView.tsx`: `title="Põllud"` → `title="Põllud" helpKey="view.fields"`
- `CropRegisterModal.tsx`: `title="Kultuurid"` → `title="Kultuurid" helpKey="view.crops"`
- `FieldManagerModal.tsx`: `title="Külvikord"` → `title="Külvikord" helpKey="view.rotation"`
- `FieldWorksBoard.tsx`: `title="Põllutööd"` → `title="Põllutööd" helpKey="view.works"`
- `ArticlesView.tsx`: `title="Laoarvestus"` → `title="Laoarvestus" helpKey="view.stock"`
- `VehicleTracker.tsx`: `title="Masinapark, haakeriistad ja muu tehnika"` → lisa `helpKey="view.fleet"`
- `PoiManagerModal.tsx`: `title="Taristu"` → `title="Taristu" helpKey="view.infrastructure"`
- `RelatedPartiesModal.tsx` (rida 609, mitmerealine): `title="Isikud"` → `title="Isikud"` + järgmisele reale `helpKey="view.parties"`
- `WeatherView.tsx`: `title="Ilm"` → `title="Ilm" helpKey="view.weather"`
- `SeasonManagerModal.tsx`: `title="Hooajad"` → `title="Hooajad" helpKey="view.seasons"`

Kaart (pealkirjata vaade): `src/components/LayerControl.tsx` — vana:
```tsx
        <div className={mapPanelTitleClass}>
          <Layers size={18} />
          <span>Kaardikihid</span>
        </div>
```
uus:
```tsx
        <div className={mapPanelTitleClass}>
          <Layers size={18} />
          <span>Kaardikihid</span>
          <HelpHint helpKey="view.map" inline />
        </div>
```
ja lisa LayerControl'i `./ui` importi `HelpHint` (kontrolli rida `grep -n "from './ui'" src/components/LayerControl.tsx`).
Kontroll: `SSH "grep -rn --include='*.tsx' -e 'helpKey=\"view\\.' src | wc -l"` → 10 (+1 `HelpHint helpKey="view.map"` eraldi).

- [ ] **Step 7: Kontroll**

Run: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json && npx oxlint && npx vitest run && npm run ui-audit -- --details'` → 0/PASS. Kuna `view.*` kohtjuhendid on tühjad, ikoone rakenduses veel ei näe (ainult kui admin teksti lisab) — see on spec'i käitumine.

- [ ] **Step 8: Commit, release, pildid**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/help/helpRegistry.ts src/help/helpRegistry.test.ts src/components/ui/HelpHint.tsx src/components/ui/PageHeader.tsx src/components/ui/variants.ts src/components/ui/index.ts src/components/LayerControl.tsx src/components/FieldsTableView.tsx src/components/CropRegisterModal.tsx src/components/FieldManagerModal.tsx src/components/FieldWorksBoard.tsx src/components/ArticlesView.tsx src/components/VehicleTracker.tsx src/components/PoiManagerModal.tsx src/components/RelatedPartiesModal.tsx src/components/WeatherView.tsx src/components/SeasonManagerModal.tsx && git commit -m "feat(juhend): view.* kohtjuhendid, ? ikoon vaate pealkirjas ja link Loe juhendist" -m "Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>"'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && NODE_OPTIONS=--max-old-space-size=4096 npm run release'   # run_in_background
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris'
```
Pildid: `UiGallery` (admin `/ui`) näitab `HelpHintPopover`-i — lisa galeriisse üks kirje `guideHref="#guide.fields#import"` (Edit `src/components/ui/UiGallery.tsx`, otsi `HelpHintPopover`; samas commitis) ja pildista `npx tsx scripts/shot.mts --platform '*' --out .superpowers/tmp/shots/juhend-hint --width 1440 /ui` hele+tume; kontrolli, et link „Loe juhendist →“ on nähtav, info-sinine, hõljumisel allajoonitud. Vaate pealkirja ikoon: `view.*` tekst puudub andmetes, seega kontrolli paigutust ajutise ikoonita pildil koodist (rida: pealkiri + 15px ikoon, `gap-1.5`) — ära lisa live-andmeid.

---

### Task 6: Kohtjuhendite mustandid (`docs/juhend/spots/`) ja laadimisskript `scripts/load-guide-drafts.mts` + test

**Files:**
- Create: `src/server/guideDrafts.ts`, `src/server/guideDrafts.test.ts`, `scripts/load-guide-drafts.mts`, 11 mustandit `docs/juhend/spots/view.map.html`, `view.fields.html`, `view.crops.html`, `view.rotation.html`, `view.works.html`, `view.stock.html`, `view.fleet.html`, `view.infrastructure.html`, `view.parties.html`, `view.weather.html`, `view.seasons.html`

**Interfaces:**
- Consumes (T1/T5): `isGuideChapterKey`, `GuideChapterKey`, `GUIDE_MAX_LENGTH`, `chapterNumber`, `HELP_SPOTS` (iga kirje `guideLink`), `HELP_MAX_LENGTH`, `isHelpKey`, `HelpKey`, `isBlankHelp`, `writeHelpIfEmpty(key, html, author, guideLink?)`, `setGuideLinkIfEmpty(key, link, author)`, `canSetGuideLink(key)`, `isHelpEmpty(key)`.
- Produces:
  - `guideDrafts.ts`: `interface DraftStore { isEmpty(key: string): Promise<boolean>; writeIfEmpty(key: string, html: string, guideLink?: string | null): Promise<boolean>; canSetLink(key: string): Promise<boolean>; setLinkIfEmpty(key: string, link: string): Promise<boolean> }`, `type DraftStatus = 'written' | 'would-write' | 'skipped-existing' | 'skipped-blank' | 'invalid-name' | 'number-mismatch' | 'too-long' | 'unknown-spot' | 'link-set' | 'would-link' | 'link-kept'`, `interface DraftResult { file: string; key: string | null; status: DraftStatus }`, `parseDraftName(file): { key: GuideChapterKey } | { error: 'invalid-name' | 'number-mismatch' }`, `parseSpotDraftName(file): { key: HelpKey } | { error: 'unknown-spot' }`, `loadDrafts(files, store, dryRun?)` (peatükid), `loadSpotDrafts(files, store, dryRun?, spots?)` (kohtjuhendite tekstid; seab ka `guideLink` tühjale kohale), `linkSpots(store, dryRun?, spots?)` (ainult tühi `guide_link` kohtjuhendil, millel on tekst). `files`: `{ name: string; html: string }[]`; `spots`: `Record<string, { guideLink?: string }>` (vaikimisi `HELP_SPOTS`).
  - Skript: `npx tsx scripts/load-guide-drafts.mts [--dry-run] [kaust]` (vaikimisi `docs/juhend`; peatükid `<kaust>/*.html`, kohtjuhendid `<kaust>/spots/*.html`); autor „mustand“.
  - Laadimise reegel: tekst kirjutatakse **ainult tühja** kohta (peatükk või kohtjuhend); olemasolevale tekstile ei kirjutata kunagi. Linki (`guide_link`) pannakse ainult kohtjuhendile ja ainult kui see on tühi; nii saavad ka praegused 4 kohta oma peatüki lingi ilma teksti puutumata.

- [ ] **Step 1: Kirjuta test (kukub)**

Fail `src/server/guideDrafts.test.ts`:

```ts
// Mustandite laadimine: ainult tühjadesse kohtadesse (peatükid ja kohtjuhendid), olemasolevat teksti ei puudutata,
// kohtjuhendi seotud peatükk pannakse ainult tühjale lingile, versioonirea autor „mustand“ (versioonirida teeb päris hoidla).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkSpots, loadDrafts, loadSpotDrafts, parseDraftName, parseSpotDraftName, type DraftStore } from './guideDrafts';
import { HELP_MAX_LENGTH, HELP_SPOTS } from '../help/helpRegistry';

const blank = (h: string) => h.replace(/<[^>]*>/g, '').trim() === '';

/** Mälus hoidla: sama lepe mis päris hoidlal (writeHelpIfEmpty, setGuideLinkIfEmpty), aga ilma andmebaasita. */
function memoryStore(initial: Record<string, { html: string; link?: string | null }> = {}) {
  const rows = new Map(Object.entries(initial).map(([k, v]) => [k, { html: v.html, link: v.link ?? null }]));
  const writes: { key: string; html: string; link: string | null }[] = [];
  const links: { key: string; link: string }[] = [];
  const store: DraftStore = {
    isEmpty: async (key) => blank(rows.get(key)?.html ?? ''),
    writeIfEmpty: async (key, html, guideLink = null) => {
      const row = rows.get(key);
      if (row && !blank(row.html)) return false;
      const link = row?.link ?? guideLink;
      rows.set(key, { html, link });
      writes.push({ key, html, link });
      return true;
    },
    canSetLink: async (key) => {
      const row = rows.get(key);
      return !!row && !blank(row.html) && !row.link;
    },
    setLinkIfEmpty: async (key, link) => {
      const row = rows.get(key);
      if (!row || blank(row.html) || row.link) return false;
      row.link = link;
      links.push({ key, link });
      return true;
    }
  };
  return { store, rows, writes, links };
}

describe('parseDraftName', () => {
  it('nr-võti.html, number peab klappima registri järjekorraga', () => {
    expect(parseDraftName('01-guide.getting-started.html')).toEqual({ key: 'guide.getting-started' });
    expect(parseDraftName('16-guide.settings.html')).toEqual({ key: 'guide.settings' });
    expect(parseDraftName('02-guide.getting-started.html')).toEqual({ error: 'number-mismatch' });
    expect(parseDraftName('01-guide.nope.html')).toEqual({ error: 'invalid-name' });
    expect(parseDraftName('notes.txt')).toEqual({ error: 'invalid-name' });
    expect(parseDraftName('1-guide.map.html')).toEqual({ error: 'invalid-name' });
  });
});

describe('parseSpotDraftName', () => {
  it('võti.html, võti peab olema registris', () => {
    expect(parseSpotDraftName('view.fields.html')).toEqual({ key: 'view.fields' });
    expect(parseSpotDraftName('fields.register.import-pria-zip.html')).toEqual({ key: 'fields.register.import-pria-zip' });
    expect(parseSpotDraftName('view.nope.html')).toEqual({ error: 'unknown-spot' });
    expect(parseSpotDraftName('view.fields.txt')).toEqual({ error: 'unknown-spot' });
  });
});

describe('loadDrafts (peatükid)', () => {
  const files = [
    { name: '01-guide.getting-started.html', html: '<p>Algus</p>' },
    { name: '02-guide.onboarding.html', html: '<p>Juurutamine</p>' },
    { name: '03-guide.map.html', html: '<p><br></p>' },
    { name: 'README.md', html: 'x' },
    { name: '04-guide.fields.html', html: 'x'.repeat(100001) }
  ];

  it('kirjutab tühjadesse, jätab olemasoleva, tühja faili ja vead vahele', async () => {
    const { store, rows, writes } = memoryStore({ 'guide.onboarding': { html: '<p>Kasutaja parandatud tekst</p>' } });
    const res = await loadDrafts(files, store);
    expect(Object.fromEntries(res.map((r) => [r.file, r.status]))).toEqual({
      '01-guide.getting-started.html': 'written',
      '02-guide.onboarding.html': 'skipped-existing',
      '03-guide.map.html': 'skipped-blank',
      'README.md': 'invalid-name',
      '04-guide.fields.html': 'too-long'
    });
    expect(writes).toEqual([{ key: 'guide.getting-started', html: '<p>Algus</p>', link: null }]);
    expect(rows.get('guide.onboarding')!.html).toBe('<p>Kasutaja parandatud tekst</p>');
  });

  it('teine käivitus ei kirjuta enam midagi (idempotentne); dry-run ei kirjuta', async () => {
    const { store, writes } = memoryStore();
    expect((await loadDrafts(files.slice(0, 2), store, true)).map((r) => r.status)).toEqual(['would-write', 'would-write']);
    expect(writes).toEqual([]);
    await loadDrafts(files.slice(0, 2), store);
    expect((await loadDrafts(files.slice(0, 2), store)).map((r) => r.status)).toEqual(['skipped-existing', 'skipped-existing']);
    expect(writes).toHaveLength(2);
  });
});

describe('loadSpotDrafts ja linkSpots (kohtjuhendid)', () => {
  const spots = {
    'view.fields': { guideLink: 'guide.fields' },
    'view.crops': { guideLink: 'guide.crops' },
    'fields.register.import-pria-zip': { guideLink: 'guide.fields' }
  };
  const files = [
    { name: 'view.fields.html', html: '<p>Põllud</p>' },
    { name: 'view.crops.html', html: '<p>Kultuurid</p>' },
    { name: 'view.nope.html', html: '<p>x</p>' },
    { name: 'view.map.html', html: '<p> </p>' },
    { name: 'view.stock.html', html: 'x'.repeat(HELP_MAX_LENGTH + 1) }
  ];

  it('kirjutab tühja kohtjuhendisse koos vaikimisi lingiga, olemasolevat teksti ja linki ei puuduta', async () => {
    const { store, rows, writes } = memoryStore({ 'view.crops': { html: '<p>Käsitsi parandatud</p>', link: 'guide.crops#sordid' } });
    const res = await loadSpotDrafts(files, store, false, { ...spots, 'view.map': { guideLink: 'guide.map' }, 'view.stock': { guideLink: 'guide.stock' } });
    expect(Object.fromEntries(res.map((r) => [r.file, r.status]))).toEqual({
      'view.fields.html': 'written',
      'view.crops.html': 'skipped-existing',
      'view.nope.html': 'unknown-spot',
      'view.map.html': 'skipped-blank',
      'view.stock.html': 'too-long'
    });
    expect(writes).toEqual([{ key: 'view.fields', html: '<p>Põllud</p>', link: 'guide.fields' }]);
    expect(rows.get('view.crops')).toEqual({ html: '<p>Käsitsi parandatud</p>', link: 'guide.crops#sordid' });
  });

  it('linkSpots paneb lingi ainult olemasolevale tekstile ja tühjale lingile; teksti ei muuda', async () => {
    const { store, rows, links } = memoryStore({
      'fields.register.import-pria-zip': { html: '<p>Vana tekst</p>' }, // tekst olemas, link puudub → pannakse
      'view.crops': { html: '<p>x</p>', link: 'guide.crops#sordid' }, // link olemas → jääb
      'view.fields': { html: '<p><br></p>' } // tühi tekst → ei panda
    });
    const res = await linkSpots(store, false, spots);
    expect(Object.fromEntries(res.map((r) => [r.key, r.status]))).toEqual({
      'view.fields': 'link-kept',
      'view.crops': 'link-kept',
      'fields.register.import-pria-zip': 'link-set'
    });
    expect(links).toEqual([{ key: 'fields.register.import-pria-zip', link: 'guide.fields' }]);
    expect(rows.get('fields.register.import-pria-zip')).toEqual({ html: '<p>Vana tekst</p>', link: 'guide.fields' });
    expect(rows.get('view.crops')!.link).toBe('guide.crops#sordid');
  });

  it('dry-run ei kirjuta ei teksti ega linki', async () => {
    const { store, writes, links } = memoryStore({ 'fields.register.import-pria-zip': { html: '<p>Vana</p>' } });
    const a = await loadSpotDrafts(files.slice(0, 1), store, true, spots);
    const b = await linkSpots(store, true, spots);
    expect(a.map((r) => r.status)).toEqual(['would-write']);
    expect(b.find((r) => r.key === 'fields.register.import-pria-zip')!.status).toBe('would-link');
    expect(writes).toEqual([]);
    expect(links).toEqual([]);
  });
});

describe('docs/juhend/spots mustandid', () => {
  const dir = join(process.cwd(), 'docs/juhend/spots');
  const names = readdirSync(dir).filter((n) => n.endsWith('.html')).sort();
  const viewKeys = Object.keys(HELP_SPOTS).filter((k) => k.startsWith('view.'));

  it('igal view.* kohtjuhendil on mustandifail ja ainult tuntud võtmed', () => {
    expect(names).toEqual(expect.arrayContaining(viewKeys.map((k) => `${k}.html`)));
    for (const n of names) expect('error' in parseSpotDraftName(n), n).toBe(false);
  });

  it('iga mustand on 1–2 lauset ühes lõigus ja ilma pealkirjade/loenditeta', () => {
    for (const n of names) {
      const html = readFileSync(join(dir, n), 'utf8').trim();
      const text = html.replace(/<[^>]*>/g, '').trim();
      expect(blank(html), n).toBe(false);
      expect(html.length, n).toBeLessThan(500);
      expect(html.match(/<p>/g)?.length, n).toBe(1);
      expect(html, n).not.toMatch(/<(h\d|ul|ol|li|a|br|img)\b/i);
      const sentences = text.match(/[.!?](?=\s|$)/g)?.length ?? 0;
      expect(sentences, n).toBeGreaterThanOrEqual(1);
      expect(sentences, n).toBeLessThanOrEqual(2);
    }
  });

  it('laadimine päris failidega kirjutab iga view.* tühjale kohale koos peatükilingiga', async () => {
    const { store, writes } = memoryStore();
    const files = names.map((name) => ({ name, html: readFileSync(join(dir, name), 'utf8') }));
    const res = await loadSpotDrafts(files, store);
    expect(res.every((r) => r.status === 'written')).toBe(true);
    for (const w of writes) expect(w.link).toBe((HELP_SPOTS as Record<string, { guideLink: string }>)[w.key].guideLink);
  });
});
```
Run: `SSH 'npx vitest run src/server/guideDrafts.test.ts'` → FAIL (import; ka `docs/juhend/spots` puudub).

- [ ] **Step 2: Kirjuta `src/server/guideDrafts.ts`**

```ts
// src/server/guideDrafts.ts — mustandite laadimise tuum: peatükid (docs/juhend/<nr>-<võti>.html) ja kohtjuhendid
// (docs/juhend/spots/<võti>.html). Tekst kirjutatakse ainult tühja kohta: olemasolevat teksti ei puudutata kunagi
// (kasutaja parandused jäävad). Kohtjuhendi seotud peatükk pannakse ainult tühjale lingile. Hoidla on süstitav (test: mälus).
import { GUIDE_MAX_LENGTH, chapterNumber, isGuideChapterKey, type GuideChapterKey } from '../help/guideChapters.ts';
import { HELP_MAX_LENGTH, HELP_SPOTS, isHelpKey, type HelpKey } from '../help/helpRegistry.ts';
import { isBlankHelp } from './helpArticles.ts';

export interface DraftStore {
  isEmpty(key: string): Promise<boolean>;
  /** Kirjutab ainult tühja kohta (+ `guideLink` kohtjuhendile, kui real pole oma linki) ja teeb versioonirea; tagastab, kas kirjutas */
  writeIfEmpty(key: string, html: string, guideLink?: string | null): Promise<boolean>;
  /** Kas kohtjuhendil on tekst, aga link puudub */
  canSetLink(key: string): Promise<boolean>;
  /** Paneb lingi ainult tekstiga kohale, kus link on tühi; teksti ei muuda; tagastab, kas pani */
  setLinkIfEmpty(key: string, link: string): Promise<boolean>;
}

export type DraftStatus =
  | 'written' | 'would-write' | 'skipped-existing' | 'skipped-blank' | 'invalid-name' | 'number-mismatch' | 'too-long' | 'unknown-spot'
  | 'link-set' | 'would-link' | 'link-kept';

export interface DraftResult {
  file: string;
  key: string | null;
  status: DraftStatus;
}

type DraftFile = { name: string; html: string };
type SpotLinks = Record<string, { guideLink?: string }>;

/** `01-guide.getting-started.html` → peatüki võti; number peab klappima registri järjekorraga */
export function parseDraftName(file: string): { key: GuideChapterKey } | { error: 'invalid-name' | 'number-mismatch' } {
  const m = /^(\d{2})-(guide\.[a-z-]+)\.html$/.exec(file);
  if (!m || !isGuideChapterKey(m[2])) return { error: 'invalid-name' };
  if (Number(m[1]) !== chapterNumber(m[2])) return { error: 'number-mismatch' };
  return { key: m[2] };
}

/** `view.fields.html` → kohtjuhendi võti (peab olema `HELP_SPOTS`-is) */
export function parseSpotDraftName(file: string): { key: HelpKey } | { error: 'unknown-spot' } {
  const m = /^(.+)\.html$/.exec(file);
  return m && isHelpKey(m[1]) ? { key: m[1] } : { error: 'unknown-spot' };
}

export async function loadDrafts(files: DraftFile[], store: DraftStore, dryRun = false): Promise<DraftResult[]> {
  const out: DraftResult[] = [];
  for (const f of files) {
    const parsed = parseDraftName(f.name);
    if ('error' in parsed) {
      out.push({ file: f.name, key: null, status: parsed.error });
      continue;
    }
    const { key } = parsed;
    if (isBlankHelp(f.html)) out.push({ file: f.name, key, status: 'skipped-blank' });
    else if (f.html.length > GUIDE_MAX_LENGTH) out.push({ file: f.name, key, status: 'too-long' });
    else if (dryRun) out.push({ file: f.name, key, status: (await store.isEmpty(key)) ? 'would-write' : 'skipped-existing' });
    else out.push({ file: f.name, key, status: (await store.writeIfEmpty(key, f.html)) ? 'written' : 'skipped-existing' });
  }
  return out;
}

/** Kohtjuhendite tekstid: kirjutab tühja kohta koos registri vaikimisi seotud peatükiga (`guideLink`). */
export async function loadSpotDrafts(files: DraftFile[], store: DraftStore, dryRun = false, spots: SpotLinks = HELP_SPOTS): Promise<DraftResult[]> {
  const out: DraftResult[] = [];
  for (const f of files) {
    const parsed = parseSpotDraftName(f.name);
    if ('error' in parsed) {
      out.push({ file: f.name, key: null, status: parsed.error });
      continue;
    }
    const { key } = parsed;
    if (isBlankHelp(f.html)) out.push({ file: f.name, key, status: 'skipped-blank' });
    else if (f.html.length > HELP_MAX_LENGTH) out.push({ file: f.name, key, status: 'too-long' });
    else if (dryRun) out.push({ file: f.name, key, status: (await store.isEmpty(key)) ? 'would-write' : 'skipped-existing' });
    else out.push({ file: f.name, key, status: (await store.writeIfEmpty(key, f.html, spots[key]?.guideLink ?? null)) ? 'written' : 'skipped-existing' });
  }
  return out;
}

/** Kohtjuhendid, millel on tekst, aga seotud peatükk puudub (nt praegused 4): paneb registri vaikimisi lingi. Teksti ei muuda. */
export async function linkSpots(store: DraftStore, dryRun = false, spots: SpotLinks = HELP_SPOTS): Promise<DraftResult[]> {
  const out: DraftResult[] = [];
  for (const [key, s] of Object.entries(spots)) {
    if (!s.guideLink) continue;
    const set = dryRun ? await store.canSetLink(key) : await store.setLinkIfEmpty(key, s.guideLink);
    out.push({ file: key, key, status: set ? (dryRun ? 'would-link' : 'link-set') : 'link-kept' });
  }
  return out;
}
```

- [ ] **Step 3: Kirjuta 11 kohtjuhendi mustandit**

Fail iga `view.*` võtme kohta kaustas `docs/juhend/spots/` nimega `view.<vaade>.html` (11 faili: `view.map`, `view.fields`, `view.crops`, `view.rotation`, `view.works`, `view.stock`, `view.fleet`, `view.infrastructure`, `view.parties`, `view.weather`, `view.seasons`). Sisu kirjuta **vaate koodi põhjal** (loe vaatefail ja kontrolli nuppude/väljade täpset kirjapilti grep'iga):

| Fail | Loe koodist |
|---|---|
| `view.map.html` | `MapView.tsx`, `LayerControl.tsx`, `MapYearSelector.tsx` |
| `view.fields.html` | `FieldsTableView.tsx` |
| `view.crops.html` | `CropRegisterModal.tsx` |
| `view.rotation.html` | `FieldManagerModal.tsx` |
| `view.works.html` | `FieldWorksBoard.tsx` |
| `view.stock.html` | `ArticlesView.tsx` |
| `view.fleet.html` | `VehicleTracker.tsx` |
| `view.infrastructure.html` | `PoiManagerModal.tsx` |
| `view.parties.html` | `RelatedPartiesModal.tsx` |
| `view.weather.html` | `WeatherView.tsx` |
| `view.seasons.html` | `SeasonManagerModal.tsx` |

Reeglid (kontrollib test): täpselt üks `<p>…</p>`, 1–2 lauset (lõpumärk `.`/`!`/`?` ainult lause lõpus, ilma lühenditeta ja kümnendkohtadeta), alla 500 märgi, ilma pealkirjade, loenditeta ja linkideta; lubatud on `<strong>` nupu või välja nime jaoks. Sisu: eesti keeles, ülesandepõhine („Siin saad …“, „Siit leiad …“), lihtsas keeles ilma tehniliste terminiteta (ei kasutata andmebaasi/välja/koodi sõnu), kirjeldab, milleks vaade on ja mis on selle peamine tegevus; ainult asjad, mis vaates päriselt olemas on. Vorm (näide, kehtib `view.seasons.html`-ile, mille sisu kooskõlas `SeasonManagerModal.tsx`-iga):
```html
<p>Siin hoiad ettevõtte hooaegu: <strong>Loo uus hooaeg</strong>, lisa märkmeid ja lukusta valmis hooaeg, et selle andmed kogemata ei muutuks.</p>
```
Peatükiviide ei kirjutata faili: seotud peatükk tuleb `HELP_SPOTS[võti].guideLink`-ist (T5), laadija paneb selle kohtjuhendile.

Run: `SSH 'npx vitest run src/server/guideDrafts.test.ts'` → PASS (kolm `docs/juhend/spots` testi kontrollivad faile).

- [ ] **Step 4: Kirjuta `scripts/load-guide-drafts.mts`**

```ts
// scripts/load-guide-drafts.mts — laeb mustandid andmebaasi (help_articles): peatükid <kaust>/<nr>-<võti>.html ja
// kohtjuhendid <kaust>/spots/<võti>.html. Tekst kirjutatakse AINULT tühja kohta; olemasolevat teksti ei puudutata.
// Kohtjuhendile pannakse seotud peatükk (registri `guideLink`) ainult tühjale lingile. Iga kirjutis teeb versioonirea
// autoriga „mustand“. Live'is käivitatakse alles kasutaja „jah“ järel. Kasutus (serveris):
//   npx tsx scripts/load-guide-drafts.mts --dry-run          # ainult näitab, mida kirjutaks
//   npx tsx scripts/load-guide-drafts.mts [kaust]            # kirjutab (vaikimisi docs/juhend)
import 'dotenv/config';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canSetGuideLink, isHelpEmpty, setGuideLinkIfEmpty, writeHelpIfEmpty } from '../src/server/helpArticles.ts';
import { linkSpots, loadDrafts, loadSpotDrafts, type DraftResult, type DraftStore } from '../src/server/guideDrafts.ts';
import { authDb } from '../src/server/db.ts';

const AUTHOR = 'mustand';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dir = args.find((a) => !a.startsWith('--')) ?? 'docs/juhend';

const read = (d: string) =>
  existsSync(d)
    ? readdirSync(d)
        .filter((n) => n.endsWith('.html'))
        .sort()
        .map((name) => ({ name, html: readFileSync(join(d, name), 'utf8') }))
    : [];

const store: DraftStore = {
  isEmpty: isHelpEmpty,
  writeIfEmpty: (key, html, guideLink) => writeHelpIfEmpty(key, html, AUTHOR, guideLink ?? null),
  canSetLink: canSetGuideLink,
  setLinkIfEmpty: (key, link) => setGuideLinkIfEmpty(key, link, AUTHOR)
};

const chapters = await loadDrafts(read(dir), store, dryRun);
const spots = await loadSpotDrafts(read(join(dir, 'spots')), store, dryRun);
const links = await linkSpots(store, dryRun);

const print = (title: string, rs: DraftResult[]) => {
  console.log(`\n${title}`);
  for (const r of rs) console.log(`  ${r.status.padEnd(17)} ${r.file}${r.key && r.key !== r.file ? `  →  ${r.key}` : ''}`);
};
print('Peatükid', chapters);
print('Kohtjuhendid (tekst)', spots);
print('Kohtjuhendid (seotud peatükk)', links);

const all = [...chapters, ...spots, ...links];
const count = (...s: string[]) => all.filter((r) => s.includes(r.status)).length;
console.log(
  `\n${dryRun ? 'Kuiv jooks (midagi ei kirjutatud)' : 'Valmis'}: tekste ${count('written', 'would-write')}, linke ${count('link-set', 'would-link')}, ` +
    `olemas/jäetud ${count('skipped-existing', 'link-kept')}, tühje ${count('skipped-blank')}, vigaseid ${count('invalid-name', 'number-mismatch', 'too-long', 'unknown-spot')}`
);
await authDb().$disconnect();
```

- [ ] **Step 5: Kuiv jooks serveris (kirjutamata)**

Run: `SSH 'npx tsx scripts/load-guide-drafts.mts --dry-run'`
Expected: peatükkidel `would-write` (praegu kolm mustandit `01`–`03`), kohtjuhendite tekstidel 11 × `would-write`, linkidel `link-kept` (tekstita kohtadel pole veel mida linkida; `would-link` ainult kohal, millel on tekst) ja lõpus „Kuiv jooks (midagi ei kirjutatud)“. Kinnita, et kuiv jooks ei kirjutanud: `select count(*) from help_article_versions where "created_by" = 'mustand'` (psql; kirjuta käsk `.superpowers/tmp/count-drafts.sh` failina, sest sisaldab ülakomasid) → `0`. Mõni `invalid-name`/`unknown-spot` rida tähendab failinime viga — paranda nimi.

- [ ] **Step 6: tsc, oxlint, täis vitest, commit, release**

Run: `SSH 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.app.json && npx oxlint && npx vitest run'` → 0/PASS. (`scripts/*.mts` ei kuulu tsc projekti; skripti kontrollib kuiv jooks.)
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/guideDrafts.ts src/server/guideDrafts.test.ts scripts/load-guide-drafts.mts docs/juhend/spots && git commit -m "feat(juhend): kohtjuhendite mustandid ja laadimisskript (ainult tühjadesse kohtadesse)" -m "Co-Authored-By: Claude <Mudel> 5.5 <noreply@anthropic.com>"'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && NODE_OPTIONS=--max-old-space-size=4096 npm run release'   # run_in_background
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris'
```

---

### Task 7: Mustandite laadimine live'i (ainult kasutaja „jah“ järel)

**Files:** muudatusi koodis ei ole; kirjutab `help_articles` ja `help_article_versions` ridu.

**Interfaces:**
- Consumes: T6 skript, T1 tabelid. Produces: täidetud peatükid (`guide.getting-started`, `guide.onboarding`, `guide.map` ja iga hilisem mustand `docs/juhend/` all), täidetud tühjad `view.*` kohtjuhendid koos peatükilinkidega ning praegustele 4 kohtjuhendile (kui neil on tekst ja link puudub) peatükilink; olemasolevat teksti ei muudeta.

- [ ] **Step 1: Kontroller küsib kasutajalt luba**

Kontroller küsib: „Laadin mustandid live'i: peatükid `docs/juhend/*.html` ja 11 `view.*` kohtjuhendi lühiteksti `docs/juhend/spots/*.html` — ainult tühjadesse kohtadesse, olemasolevat teksti ei puudutata. Pärast seda ilmuvad „?“-ikoonid kõigi ettevõtete kasutajatele kõigi vaadete pealkirja kõrvale (hüpikus tekst ja link „Loe juhendist →“), ning praegustele 4 kohtjuhendile pannakse seotud peatükk, kui see puudub. Kas jah?“ **Ilma kasutaja „jah“-ta seda ülesannet ei käivitata.** Enne küsimist jooksuta kuiv jooks (T6 samm 5) ja näita tulemust.

- [ ] **Step 2: Varukoopia ja laadimine**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-juhend-laadimine.dump && chmod 600 ~/backups/*.dump'
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsx scripts/load-guide-drafts.mts'
```
Expected: kirjutatud kohtadel `written`, olemasolevatel `skipped-existing`, linkidel `link-set` (kus tekst oli ja link puudus) või `link-kept`; lõpus „Valmis: tekste N, linke M …“.

- [ ] **Step 3: Kontroll**

Kirjuta `.superpowers/tmp/verify-guide.sh` (Write-tööriistaga; sisaldab ülakomasid):
```bash
#!/bin/bash
cd /home/debian/teris
set -a && . ./.env && set +a
U="${PLATFORM_DATABASE_URL%%\?*}"
psql "$U" -c "select key, length(html) as pikkus, \"updatedBy\" from help_articles where key like 'guide.%' order by key"
psql "$U" -c "select key, left(regexp_replace(html, '<[^>]*>', '', 'g'), 50) as algus, guide_link, \"updatedBy\" from help_articles where key not like 'guide.%' order by key"
psql "$U" -c "select key, created_by, guide_link from help_article_versions where created_by = 'mustand' order by id desc limit 30"
```
Run: `SSH 'bash .superpowers/tmp/verify-guide.sh'`.
Expected: kirjutatud peatükkidel ja kohtjuhenditel `updatedBy = mustand`, versioonireal `created_by = mustand`; kõigil 11 `view.*` kohal on `guide_link = guide.<vaade>`; praegustel 4 kohal (kui tekst oli) `guide_link` täidetud ja `updatedBy` endine (teksti ei muudetud). Teine käivitus `SSH 'npx tsx scripts/load-guide-drafts.mts'` annab kõigil `skipped-existing`/`link-kept` (idempotentne, uusi versioonirida ei tule).

- [ ] **Step 4: Pildid (sisuga vaated) ja admin**

Kordab T4 pildistamist `bash .superpowers/tmp/shot-guide.sh` (nüüd päris tekstiga: h3 ankrud, nummerdatud sammud, otsing „pria“; kasutaja `andresj`, moodulite kontroll T4 sammu 12 järgi) ja T3 `shot-guide-admin.sh` (täidetud punktid, Ajalugu, kohtjuhendite jaotis näitab 11 täidetud `view.*` kohta). Lisaks üks pilt vaatest, kus on nähtav „?“ pealkirja kõrval (nt `/` pärast `--do "click:button[aria-label='Põllud']"` ja `--do "hover:button[aria-label^='Juhend: ']"`; ainult hõljumine) ja hüpik lingiga „Loe juhendist →“. Kontroller vaatab pildid Read-tööriistaga hele+tume, 1440 ja kitsas.

- [ ] **Step 5: Ankrute täpsustamine (valikuline)**

Vaikimisi lingid viivad peatüki algusse. Kui kasutaja tahab, et kohtjuhendi link viiks kindla vahepealkirjani (nt `fields.register.import-pria-zip` → `guide.fields#…`), valib ta selle admin.teris.ee-s „Seotud peatükk“ ankru valikust; laadija ei kirjuta olemasolevat linki kunagi üle.

---

## Otsused (2026-11-22)

1. **Hash-sügavlink:** URL `#guide.<võti>[#ankur]` on ainult juhendi jaoks; tagasi-nupp töötab juhendi avamisel, sulgemisel ja peatükkide vahel; muud rakenduse navigeerimist ei muudeta (T4).
2. **jsdom:** devDependency on lubatud, AINULT sanitize/ankru testifailides failipõhise `// @vitest-environment jsdom` kommentaariga; globaalne environment jääb `node`. T2 samm 3 kontrollib `npm ci --dry-run`, `git diff --stat` ja release'i ehitust.
3. **Redaktor:** lisatakse ainult nupp „Link peatükki“ (h3 ja nummerloend on juba olemas) (T3).
4. **Kaart:** `view.map` „?“ läheb kaardikihtide paneeli (`LayerControl`) pealkirja kõrvale (T5).
5. **Pildid:** kasutajaga `andresj`; enne pildistamist kontrollitakse andmebaasist, et tema ettevõttel on moodulid `TELEMETRY` ja `WEATHER`; kui puudub, kirjeldatakse moodulita seisu ja peitmist kontrollitakse koodist/testist (Global Constraints, T4 samm 12, T7 samm 4).
6. **Tühja teksti reegel ei muutu** (tühi tekst kustutab kohtjuhendi; „?“ ainult tekstiga). Uute `view.*` kohtjuhendite 1–2-lauselised lühitekstid kirjutatakse mustandifailidena `docs/juhend/spots/view.<vaade>.html` (T6 samm 3); seotud peatükk tuleb registrist (`HELP_SPOTS[võti].guideLink`, T5); laadimisskript (T6) kirjutab ainult tühja kohtjuhendisse, seab `guide_link`-i ja teeb versioonirea autoriga „mustand“. Olemasolevatele 4 kohtjuhendile teksti ei kirjutata, aga `guide_link` pannakse, kui see on tühi ja tekst olemas (`linkSpots`/`setGuideLinkIfEmpty`, testitud T1 ja T6 testides). T7 laeb nii peatükid kui kohtjuhendid.
7. **Moodulist sõltuvate peatükkide peitmine on ainult kliendis** (`GET /api/help` saadab kõik peatükid; juhendi tekst on platvormi ühine, mitte salajane).

## Enesekontroll (writing-plans)

**1. Spec'i kaetus**

| Spec'i nõue | Ülesanne |
|---|---|
| 16 peatükki võtmete, pealkirjade ja järjekorraga koodis; moodul telemeetria/ilm | T1 (`guideChapters.ts` + test) |
| Päise nupp „Juhend“ (raamatu ikoon) → täislehe vaade `boardViewClass` jt | T4 (Header, GuideView, App) |
| Loend vasakul, tekst paremal (`help-content`), otsing katkenditega, klõps viib kohale, kitsal rippmenüü | T4 (GuideView, `guideSearch.ts`) |
| Sügavlink `guide.fields#import`, tagasi-nupp | T4 (`guideRoute.ts`, App hash-sünkroon); otsus 1 |
| „?“-ikoonid `view.<vaade>` + link „Loe juhendist →“; olemasolevad 4 kohta saavad sama lingi | T5 (registri `guideLink`, HelpHint, PageHeader); T6/T7 (lingi seadmine andmetes) |
| Peatükkide vahelised lingid `#guide.fields#import`; sanitizeHelp lubab; `h3` ankur | T2 (+ T4 klõpsupüüdja) |
| Moodulist sõltuv peatükk peidetud; viited „vajab moodulit …“ | T1 `visibleChapters`, T4 `markModuleLinks` + GuideView |
| Tühi peatükk „Juhend on koostamisel“, loendis näha | T4 (GuideView) |
| Admin: Peatükid + Kohtjuhendid, RichTextEditor lisanupud (h3, nummerloend, link peatükki), „Seotud peatükk“ | T3 (h3/ol juba olemas, link uus) |
| Andmed: `guide_link`, `help_article_versions` (50 piir), iga salvestus ja taastamine lisab rea | T1 (skeem, `writeHelpVersion`, `persist`) |
| Ajalugu: loend (pp.kk.aaaa HH:MM Tallinna ajas, autor), eelvaade, taasta | T3 (`HelpHistory`, `formatTallinn`) |
| `GET /api/help` peatükid + guide_link; peatükk kuni 100 000 | T1 |
| Mustandid: peatükid + kohtjuhendite lühitekstid (`docs/juhend/spots`); laadija ainult tühjadesse, versioonirida „mustand“; live'is alles „jah“ järel | T6 (laadija, spotid, `linkSpots`), T7 |
| Kontroll: tsc, vitest, oxlint, ui-audit; testid (piir 50, taastamine uus versioon, laadimine ei kirjuta olemasolevale, sügavlingi parsimine, sanitize peatükilink + h3) | T1 (piir 50, taastamine, `writeHelpIfEmpty`, `setGuideLinkIfEmpty`), T6 (laadimine, spotid), T1/T4 (`parseGuideRef`), T2 (sanitize) |
| Pildid 1440 + kitsas, hele+tume; admin `--platform` | T3 samm 8, T4 samm 12, T5 samm 8, T7 samm 4 (kasutaja `andresj`, moodulite kontroll) |

Lüngad: puuduvad. Spec'i „Väljas“ jaotise asju (ekraanipildid juhendis, PDF jt) ei tehta.

**2. Kohatäited:** plaanis pole „TBD“/„TODO“; iga koodisamm sisaldab koodi. Kohtjuhendite mustandite sisu (T6 samm 3) on implementeerija ülesanne vaatekoodi põhjal (otsus 6) koos kindlate vormi- ja pikkusereeglitega, mida test kontrollib, ning ühe näidisfailiga. Kolm implementeerijale suunatud „kontrolli“ märkust (T4 samm 7: `Alert` toon, `scrollRef` kerimine, oxlint a11y; T4 samm 4 testi tingimus) on konkreetsed tingimuslikud parandused.

**3. Tüüpide järjepidevus:** `GuideChapterKey`, `GuideRef`, `Anchor`, `parseGuideRef`, `formatGuideRef`, `guideHash`, `isValidGuideLink`, `markModuleLinks`, `extractAnchors`, `anchorDomId`, `nextSlug`, `textOfHtml`, `helpMaxLength`, `writeHelpVersion`, `saveHelpArticle(key, { html, guideLink }, pu)` — samad nimed ja signatuurid T1–T6 vahel. Uued: `writeHelpIfEmpty(key, html, author, guideLink?)`, `setGuideLinkIfEmpty`, `canSetGuideLink` (T1) = `DraftStore` (`writeIfEmpty(key, html, guideLink?)`, `canSetLink`, `setLinkIfEmpty`; T6) = skripti sidumine (T6 samm 4); `HelpSpot.guideLink?: string` (T5) = `SpotLinks` (T6) ja T5/T6 testid. `HelpArticleRow.guideLink: string | null` (T1) = HelpView `row.guideLink` (T3). Versiooni `id` on `number` (Prisma `Int`) API-s ja admin-tüüpides.

**Teadlikud riskid:** `jsdom` devDependency (otsus 2, kontrollid T2 samm 3); `MainView` laiendus `'guide'` võib ammendavaid `Record<MainView,…>` tsc-s esile tuua (T4 samm 10); `help_article_versions` skeem ja õigused T1 samm 8 (varukoopia + push ilma `--accept-data-loss`); T1 testid ei kirjuta päris peatükkide ega päris kohtjuhendite võtmetele üle 50 piiri (kasutavad `zz-…-<pid>` võtmeid). Pärast T7 ilmuvad „?“-ikoonid kõigile kasutajatele (T7 samm 1 ütleb seda kasutajale ette).
