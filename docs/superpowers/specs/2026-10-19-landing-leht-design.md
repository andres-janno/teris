# Avalik landing-leht, külastuste mõõtmine ja AI-valmidus — disain

Kuupäev: 2026-10-19. Eelnevad: `2026-09-25-toodanguserver-ja-sisselogimine-design.md`,
`2026-10-15-mitme-ettevotte-tugi-design.md`.

## Eesmärk

`teris.ee` avaleht muutub sisselogimata külastajale avalikuks turunduslehekülgeks, mis kirjeldab
Terise teenust ja kogub huviliste kontakte („Tunnen huvi“). Sisselogimine jääb eraldi vaatesse.
Lehe külastusi mõõdetakse oma serveris (ilma küpsiste ja kolmandate osapoolteta), sh AI-roomajate
külastusi. Leht on „AI ready“: kogu sisu on serveris valmis HTML-ina, struktureeritud andmed,
`llms.txt`, `robots.txt`, `sitemap.xml`.

Väljas (esimeses etapis): ingliskeelne versioon (struktuur valmis), hinnakiri, iseteenindusega
registreerumine, automaatne vastuskiri huvilisele, geo-asukoht.

## Otsused

| Teema | Otsus |
|---|---|
| Eesmärk | Avalik turundusleht + eraldi sisselogimine |
| Tehniline lähenemine | Eraldi staatiline `landing.html` (Vite'i kolmas sisend, ilma Reactita); server valib `/` puhul sessiooni järgi rakenduse või landing'u |
| Sisselogimine | Kolib aadressile `/login` (olemasolev `LoginPage`) |
| Mõõtmine | Oma serveris: serveri logi + brauseri beacon; ilma küpsisteta, IP-d ei salvestata |
| Peamine tegevus | Kohustustevaba „Tunnen huvi“ vorm (mitte „Küsi pakkumist“); hindu lehel ei näidata |
| Keel | Eesti keel; tekstid eraldi sisufailis, et `/en` lisada hiljem |
| Sisu | Claude kirjutab mustandi rakenduse tegelike võimaluste põhjal, kasutaja toimetab |
| Ekraanipildid | Ainult demo-tenandist sünteetiliste andmetega — päris ettevõtete andmeid avalikule lehele ei panda |
| Identifikaatorid | URL-id, HTML `id`/`class`, CSS, sündmuste ja staatuste nimed ning muud koodi identifikaatorid on inglise keeles; kommentaarid ja kasutajale nähtav tekst eesti keeles |

## 1. Marsruutimine

| Tee | Kehtiv sessioon | Sessiooni pole |
|---|---|---|
| `/` | rakendus (`index.html`) | landing (`landing.html`) |
| `/login` | 302 → `/` | rakendus → `LoginPage` |
| `/privacy` | privaatsusteade (staatiline, landing'u stiilis) | sama |
| `/support`, `/set-password` | SPA (endised `/tugi`, `/parool`) | sama |
| `/tugi`, `/parool` | vana alias, töötab edasi (juba saadetud lingid) | sama |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | staatilised failid | sama |
| muu SPA tee | rakendus | rakendus (näitab `LoginPage`) |

- Sessiooni kontroll `/` ja `/login` puhul: sessiooniküpsise räsi otsitakse andmebaasist sama
  loogikaga mis `authGate.ts`-is (eraldatakse eksporditav funktsioon `hasValidSession(req)`).
  Tugivaate küpsis loetakse samuti kehtivaks sessiooniks.
- `admin.teris.ee` (platvormi host) ei muutu; landing'ut seal ei serveerita.
- `landing.html` ja `privacy.html` on platvormi hostil blokeeritud, `admin.html` landing'u hostil
  jääb blokeerituks nagu praegu.
- Klient: pärast sisselogimist `/login` lehel `history.replaceState(null, '', '/')`; pärast
  väljalogimist ja 401 käsitlejas `replaceState(null, '', '/login')`, et värskendamine jääks
  sisselogimise vaatesse.
- Arendusserver (`npm run dev`): `dbApiPlugin.ts` teeb sama `/` otsuse, et landing'ut saaks proovida.
- Olemasolevad eestikeelsed teed nimetatakse ümber: tugivaate link `/tugi#<token>` → `/support#<token>`
  (`platformApi.ts`), parooli määramise link `/parool#<token>` → `/set-password#<token>`
  (`passwordTokens.ts`); `AuthGate.tsx` tunneb ära mõlemad, vanad teed jäävad aliasteks, et juba
  saadetud lingid töötaksid.
- `index.html` saab `<meta name="robots" content="noindex">` — rakenduse kest ei satu otsingusse.

## 2. Lehe struktuur ja sisu

Üks leht, ankrulingid. Sektsioonid:

1. **Päis** — logo, ankrud (Võimalused · Kellele · KKK), nupud „Logi sisse“ (`/login`) ja
   **„Tunnen huvi“** (`#interest`).
2. **Hero** — üks lause, mis Teris on; ekraanipilt kaardivaatest; „Tunnen huvi“.
3. **Võimalused** — 6–8 kaarti: PRIA põllud ja külvikord, masinapark ja GPS-telemeetria,
   põllutööde tahvel, põlluraamat (koos impordiga), mullaproovid, ilmaradar ja satelliidipildid,
   seotud isikud, mitu kasutajat ja ettevõtet.
4. **Kellele** — teraviljakasvatajad; teenusepakkujad ja nõustajad (tugiligipääs).
5. **Kuidas alustada** — 3 sammu: anna teada → seadistame põllud PRIA andmetest → alusta.
6. **KKK** — 5–8 küsimust (andmete asukoht ja turvalisus, PRIA andmed, sobivad masinad, hind,
   mobiil). `<details>`/`<summary>`.
7. **„Tunnen huvi“ vorm** (`id="interest"`), pealkiri nt „Anna teada, kui Teris sind huvitab —
   võtame ühendust“.
8. **Jalus** — `COPYRIGHT_TEXT` (© VentCap OÜ), kontakt, link `/privacy`.

- Kujundus: rakenduse värvid ja fondid (Outfit / Plus Jakarta Sans), hele ja tume teema
  (`prefers-color-scheme`), mobiilivaade, tekst valitav.
- Kogu tekst (sh KKK, võimalused, meta) on failis `src/landing/content.et.ts`; HTML, JSON-LD ja
  `llms.txt` genereeritakse sellest ehituse ajal, nii et need ei lähe omavahel lahku.

## 3. Mõõtmine

### 3.1 Andmeallikad

1. **Serveri logi** — iga päring teedele `/` (landing'u variant), `/privacy`, `/llms.txt`,
   `/robots.txt`, `/sitemap.xml` → üks `hit` sündmus. Näeb ka roboteid, mis JS-i ei käivita.
2. **Beacon** — `src/landing/landing.ts` saadab `navigator.sendBeacon('/api/landing/event', …)`:
   `view` (lehe laadimisel), `cta_click` (koos nupu tunnusega, nt `header`, `hero`, `footer`),
   `form_submit` (edukal saatmisel). Kinnitab, et külastaja käivitas JS-i (inimene).

### 3.2 Tabel `landing_events` (Prisma mudel `LandingEvent`)

| Väli | Tüüp | Märkus |
|---|---|---|
| `id` | bigint autoincrement | |
| `ts` | timestamptz | indeks |
| `source` | `server` \| `beacon` | |
| `event` | `hit` \| `view` \| `cta_click` \| `form_submit` | |
| `target` | text? | `cta_click` nupu tunnus |
| `path` | text | ainult tee, ilma päringuta |
| `visitorClass` | `human` \| `ai_bot` \| `search_bot` \| `other_bot` | |
| `botName` | text? | nt `GPTBot` |
| `referrerHost` | text? | ainult domeen; oma domeen → `null` |
| `utmSource`, `utmMedium`, `utmCampaign` | text? | max 100 märki |
| `device` | `desktop` \| `mobile` \| `tablet` | User-Agenti järgi |
| `visitorHash` | char(16) | vt 3.3 |

Platvormi tabel (ilma `tenantId` ja RLS-ita), loetav ainult platvormi API kaudu.

### 3.3 Külastaja räsi

`visitorHash = sha256(päevaSool + clientIp + userAgent)` esimesed 16 hex-märki.
`päevaSool` on juhuslik 32 baiti, hoitakse ainult protsessi mälus ja vahetatakse Tallinna aja
järgi kesköö ületamisel. IP-d ega soola ei salvestata. Tagajärg: unikaalseid külastajaid saab
lugeda päeva sees, eri päevi samale inimesele siduda ei saa; teenuse taaskäivitus päeva keskel
tekitab uue soola (aktsepteeritav väike ülehindamine).

### 3.4 Roboti tuvastus (`botDetect.ts`)

User-Agent → `{ visitorClass, botName }`, järjekorras:

- `ai_bot`: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot,
  anthropic-ai, PerplexityBot, Perplexity-User, CCBot, Bytespider, Amazonbot, meta-externalagent,
  DuckAssistBot, Applebot-Extended, cohere-ai, Google-CloudVertexBot
- `search_bot`: Googlebot, bingbot, Applebot, YandexBot, DuckDuckBot, Baiduspider
- `other_bot`: tühi UA, `bot|crawler|spider|curl|wget|python-requests|headless` mustrid
- muidu `human`

### 3.5 Beacon-otspunkt `POST /api/landing/event`

- Avalik (sessiooni ei nõua), Origin kontroll `allowedOrigins` järgi.
- Keha max 2 KB JSON; lubatud ainult `event` ∈ {`view`, `cta_click`, `form_submit`}, `path`,
  `target` (lubatud väärtuste nimekiri), `referrer`, `utm*`. Muu → 400.
- Kiiruspiirang IP kohta (`createLoginLimiter`, nt 60/15 min); ületamisel 204 ilma salvestamata.
- Vastus alati 204.

### 3.6 Säilitamine

Igapäevane puhastus (serveri käivitamisel + iga 24 h): kustutatakse `landing_events` read,
mis on vanemad kui 13 kuud.

### 3.7 Admin-vaade „Landing“ (`src/admin/LandingStatsView.tsx`)

Platvormi API `GET /api/platform/landing/stats?from=…&to=…` (vaikimisi viimased 30 päeva,
kuupäevad pp.kk.aaaa Tallinna ajas):

- inimkülastajad päevas (unikaalsed `visitorHash`, `visitorClass = human`, `source = beacon`
  `view`) ja lehe vaatamised;
- allikad (`referrerHost`, UTM) ja seadmed;
- AI- ja otsingurobotid nimede kaupa, sh kas ja millal `/llms.txt` loeti;
- lehter: `view` → `cta_click` → `form_submit` unikaalsete külastajate järgi + konversiooni %.

Ligipääs: ainult platvormi administraatorid (olemasolev `platformAuth`).

## 4. „Tunnen huvi“ vorm

### 4.1 Väljad

| Väli | Kohustuslik | Piir |
|---|---|---|
| nimi | jah | 1–100 |
| e-post | jah | `normalizeEmail` |
| ettevõte | ei | 100 |
| telefon | ei | 30 |
| põllupind (ha) | ei | 0–100 000 |
| „Mis sind huvitab?“ | ei | 2000 |

Vormi all: „Kasutame andmeid ainult sinuga ühenduse võtmiseks“ + link `/privacy`.
Nõusoleku linnukest pole (õiguslik alus: päringule vastamine).

### 4.2 Otspunkt `POST /api/landing/interest`

- Avalik, Origin kontroll, keha max 8 KB.
- Serveripoolne valideerimine (4.1); vigane sisend → 400 eestikeelse veateatega.
- **Spämmikaitse:** peidetud lõksuväli (`website`); vormi avamise aeg (`t`, ms) — alla 3 s
  saatmine on kahtlane; kiiruspiirang IP kohta (5/h). Kahtlane päring saab sama „Aitäh“ vastuse
  (200), kuid ei salvestata ega saadeta e-kirja.
- Edukas päring: salvestus `interest_requests`, e-kiri, `form_submit` beacon kliendist.

### 4.3 Tabel `interest_requests` (Prisma mudel `InterestRequest`)

`id`, `createdAt`, `updatedAt`, `name`, `email`, `company?`, `phone?`, `areaHa?`, `message?`,
`status` (`NEW` | `CONTACTED` | `CLOSED`, vaikimisi `NEW`), `notes?`, `closedAt?`,
`utmSource?`, `referrerHost?`. IP-d ei salvestata. Platvormi tabel (ilma `tenantId`-ta).

### 4.4 Teavitus

E-kiri aadressile `process.env.LANDING_NOTIFY_EMAIL` (`mail.ts` `sendMail`): päringu väljad +
link `https://admin.teris.ee` „Huvilised“ vaatesse. Kui muutuja puudub, e-kirja ei saadeta
(logitakse hoiatus), päring salvestatakse ikka. E-kirja viga ei nurjata päringut.
Huvilisele automaatset vastuskirja ei saadeta.

### 4.5 Admin-vaade „Huvilised“ (`src/admin/InterestView.tsx`)

`GET /api/platform/interest`, `PATCH /api/platform/interest/:id` (`status`, `notes`),
`DELETE /api/platform/interest/:id` (GDPR taotlus). Nimekiri uuemad eespool, staatuse filter.
Muudatused logitakse olemasolevasse platvormi auditisse.

### 4.6 Säilitamine

Igapäevane puhastus kustutab `CLOSED` päringud, mille `closedAt` on vanem kui 24 kuud.
Kirjas privaatsuslehel.

## 5. AI- ja otsinguvalmidus

- **Semantiline HTML ilma JS-ita:** `<header>`, `<main>`, `<section aria-labelledby>`, üks `<h1>`,
  `<details>` KKK jaoks, sisukad `alt` tekstid; kogu sisu on HTML-is ehituse ajal.
- **JSON-LD** `<head>`-is: `SoftwareApplication` (nimi, `applicationCategory: BusinessApplication`,
  kirjeldus, `featureList`, `operatingSystem: Web`, `inLanguage: et`), `Organization`
  (VentCap OÜ, logo, kontakt), `FAQPage` (samast sisufailist mis lehel nähtav KKK).
- **`/llms.txt`** — Markdown: mis Teris on, kellele, peamised võimalused, kuidas huvi märkida,
  lingid (`/`, `/#interest`, `/privacy`). Genereeritakse `content.et.ts`-ist.
- **`/robots.txt`** — `User-agent: *` `Allow: /`; `Disallow: /api/`, `/login`, `/support`,
  `/set-password`, `/tugi`, `/parool`; AI-roomajaid ei blokeerita; `Sitemap: https://teris.ee/sitemap.xml`.
- **`/sitemap.xml`** — `/`, `/privacy`.
- **Meta:** `<title>` ja `description` teenuse kirjeldusena, `canonical`, `<html lang="et">`,
  Open Graph + Twitter-kaart, jagamispilt 1200×630 (`public/og-teris.png`).
  `hreflang` lisandub koos `/en`-iga.

## 6. Koodi paigutus

Uued:

- `landing.html`, `privacy.html` — Vite'i sisendid (`vite.config.ts`: `main`, `admin`,
  `landing`, `privacy`).
- `src/landing/content.et.ts` — kogu tekst; `src/landing/render.ts` — HTML-i, JSON-LD ja
  `llms.txt` genereerimine sisust; `src/landing/landingHtmlPlugin.ts` — Vite'i plugin, mis
  süstib genereeritud HTML-i ehitusel ja arendusserveris ning kirjutab `dist/llms.txt`,
  `robots.txt`, `sitemap.xml`; `src/landing/landing.css`; `src/landing/landing.ts` (vorm, beacon).
- `src/server/landing/botDetect.ts`, `visitorHash.ts`, `landingEvents.ts` (serveri logi,
  beacon-otspunkt, puhastus), `interest.ts` (vorm), `landingRoute.ts` (`/` otsus, logimine).
  Igal oma `*.test.ts`.
- `src/admin/LandingStatsView.tsx`, `src/admin/InterestView.tsx`; platvormi API teekonnad
  `platformApi.ts`-is.
- Prisma: `LandingEvent`, `InterestRequest` (lisav muudatus).

Muudetavad: `src/server/prod.ts`, `src/server/dbApiPlugin.ts`, `src/server/static.ts`
(MIME `.txt`, `.xml`), `src/server/apiHandler.ts` (avalikud `/api/landing/*` enne sessiooni
nõuet), `src/server/authGate.ts` (`hasValidSession`), `src/AuthGate.tsx`, `index.html`,
`src/admin/AdminApp.tsx` (uued vaated menüüs), `src/server/platformApi.ts` ja
`src/server/passwordTokens.ts` (lingid `/support`, `/set-password`), `README.md` (teed).

## 7. Vigade käsitlus

- Mõõtmise viga (andmebaas maas, vigane UA) ei tohi landing'u serveerimist takistada: logimine
  on „fire and forget“, viga logitakse konsooli.
- `hasValidSession` viga → serveeritakse landing (sisselogitud kasutaja saab „Logi sisse“ kaudu
  edasi).
- Vormi andmebaasiviga → 500 „Saatmine ebaõnnestus, proovi hiljem uuesti“; klient näitab teadet
  ja jätab sisestatud andmed alles.

## 8. Testimine (TDD, vitest)

- `botDetect`: AI-, otsingu-, muud robotid ja inimese brauserid (Chrome, Safari, Firefox, mobiil).
- `visitorHash`: stabiilne sama soola korral, erinev soola vahetusel, ei sisalda IP-d.
- `landingRoute`: sessiooniga `/` → `index.html`; ilma → `landing.html`; `/login` sessiooniga
  → 302; platvormi hostil landing'ut pole; `hit` logitakse ainult landing'u teedel.
- Beacon: tundmatu sündmus / liiga suur keha → 400; lubatud → salvestus õigete väljadega;
  `referrerHost` ainult domeen; kiiruspiirang.
- Vorm: valideerimine, honeypot, alla 3 s, kiiruspiirang → salvestamata 200; edukas → rida +
  e-kirja kutse; e-kirja viga ei nurjata päringut.
- Statistika: unikaalsed külastajad, lehter, robotid nimede kaupa (testandmetega).
- Puhastus: 13 kuu ja 24 kuu piirid.
- `render`: genereeritud HTML sisaldab kõiki sektsioonide pealkirju ja KKK-d ilma JS-ita;
  JSON-LD on kehtiv JSON õigete `@type`-idega; `FAQPage` vastab nähtavale KKK-le;
  `robots.txt` ei keela `/`; `llms.txt` sisaldab kõiki võimalusi.

## 9. Juurutus

1. Varukoopia (`pg_dump`) → `npx prisma db push` → `npx prisma generate`.
2. `.env`: `LANDING_NOTIFY_EMAIL`.
3. Demo-tenant sünteetiliste andmetega → ekraanipildid (`public/landing/*.webp`) ja
   jagamispilt.
4. Kasutaja toimetab `content.et.ts` tekstid.
5. `npm run release`.
6. Kontroll: `curl -s https://teris.ee/` ilma küpsiseta → landing; `/robots.txt`, `/llms.txt`,
   `/sitemap.xml`; sisselogitult `/` → rakendus; test-vorm → rida „Huvilised“ vaates + e-kiri;
   `landing_events` ridu tekib; Google Rich Results Test JSON-LD-le.
