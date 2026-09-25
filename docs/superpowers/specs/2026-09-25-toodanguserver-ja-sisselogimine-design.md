# Toodanguserver ja rakenduse sisselogimine (disain)

Kuupäev: 2026-09-25
Staatus: kinnitatud vestluses osade kaupa, ootab spetsifikatsiooni ülevaatust

## Eesmärk

1. Tuua API Vite'i arendusserverist välja: `agro.ventcap.ee` jookseb **ehitatud
   toodanguversioonina** eraldi Node'i serveris.
2. Lisada **rakenduse enda sisselogimine** (kasutajad, sessioonid) ja eemaldada
   Apache'i Basic Auth.
3. Asendada Vite'i mall-README projekti README-ga.

## Otsused (vestlusest)

| Teema | Otsus |
|---|---|
| Kasutajad | Mõni inimene, kõik samade õigustega; rolle pole |
| Keskkonnad | Üks keskkond: `agro.ventcap.ee` = toodanguserver; koodimuudatus jõuab kasutajateni pärast releasi (build + taaskäivitus) |
| Arendus | Eraldi arenduse alamdomeeni ega arendusteenust pole; `npm run dev` jääb repos alles (nt SSH tunneliga kasutamiseks), aga teenusena ei jookse |
| Kasutajate haldus | Käsurea skript serveris; rakenduses ainult sisse-/väljalogimine ja oma parooli muutmine |
| Server | Väike `node:http` server ilma raamistikuta, API käsitleja taaskasutus |
| Autentimine | Sessiooniküpsis, sessioonid andmebaasis |

## Ülevaade

```
Brauser ──HTTPS──> Apache (agro.ventcap.ee, *.ventcap.ee sertifikaat)
                     └─ ProxyPass ─> 127.0.0.1:8820  agro.service (node dist-server/prod.js)
                                        ├─ /api/*  → handleApiRequest (sessiooni kontroll + API)
                                        └─ muu     → dist/ staatilised failid (SPA)
                                     PostgreSQL agro_db + agro_tsdb (Prisma)
```

## Osa 1: server ja failid

### `src/server/apiHandler.ts` (uus)

- Kogu praegune `src/server/dbApiPlugin.ts` API loogika (Prisma kliendid
  `prisma` ja `tsdb`, telemeetria abifunktsioonid, `json`, `parseBody`, kõik 29
  teekonda) liigub siia.
- Eksport: `handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<void>`.
  Kutsutakse ainult `/api` algusega päringute jaoks; tundmatu `/api` tee → 404 JSON.
- Autentimise kontroll (osa 2) tehakse selle funktsiooni alguses enne teekondi.
- Olemasolevate teekondade käitumine ei muutu.

### `src/server/dbApiPlugin.ts`

- Jääb Vite'i ümbriseks: `configureServer` → kui `req.url` algab `/api`-ga, kutsu
  `handleApiRequest`, muidu `next()`. Kasutusel ainult `npm run dev` puhul.

### `src/server/prod.ts` (uus)

- `node:http` server, kuulab `127.0.0.1:${PORT ?? 8820}`.
- `/api/*` → `handleApiRequest`.
- Muu → staatiline fail kaustast `dist/`:
  - `Content-Type` laiendi järgi (`.html .js .css .svg .png .jpg .ico .json .woff2 .map`).
  - `dist/assets/*` (räsiga failinimed) → `Cache-Control: public, max-age=31536000, immutable`.
  - `index.html` → `Cache-Control: no-cache`.
  - Puuduv fail (ja tee ei alga `/api`-ga) → `index.html` (SPA varuvariant).
  - Tee lahendatakse `path.resolve`-iga ja peab jääma `dist/` sisse; muidu 404.
  - Ainult `GET` ja `HEAD` staatiliste failide jaoks; muu meetod → 405.
- Käsitlemata viga → 500 (API puhul JSON), viga logitakse (`journalctl -u agro`).

### Ehitus ja käivitus (`package.json`)

- `build`: `tsc -b && vite build && vite build --config vite.server.config.ts`.
- `vite.server.config.ts` (uus): SSR-ehitus kahe sisendiga — `src/server/prod.ts` →
  `dist-server/prod.js` ja `src/server/userCli.ts` → `dist-server/userCli.js`;
  `@prisma/client` jm `node_modules` paketid jäävad välisteks (SSR vaikimisi); ilma
  Vite'i pluginateta (eriti ilma `dbApiPlugin`-ita).
- `start`: `node dist-server/prod.js`.
- `user`: `node dist-server/userCli.js` (nt `npm run user -- add andres`).
- `release`: `npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build && sudo systemctl restart agro`.
- `dist-server/` lisatakse `.gitignore`-i.
- `.env` loetakse nagu praegu (Prisma laeb `DATABASE_URL`, `TSDB_DATABASE_URL`).

### Teenus ja Apache

- `/etc/systemd/system/agro.service` (muster: `teltonika-api.service`):
  `User=debian`, `WorkingDirectory=/home/debian/agro`,
  `ExecStart=/usr/bin/node dist-server/prod.js`, `Environment=PORT=8820`,
  `Restart=on-failure`, `RestartSec=5`, `After=network-online.target postgresql.service`.
- `agro-dev.service` peatatakse, keelatakse ja eemaldatakse pärast edukat ümberlülitust.
- `/etc/apache2/sites-available/agro.ventcap.ee.conf`: `ProxyPass / http://127.0.0.1:8820/`,
  WebSocketi reegel ja Basic Auth eemaldatakse; lisatakse `RequestHeader set X-Forwarded-Proto https`.
- `/etc/apache2/.htpasswd-agro` eemaldatakse pärast ümberlülitust.

## Osa 2: sisselogimine

### Andmemudel (Prisma)

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  displayName  String?
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions     Session[]

  @@map("users")
}

model Session {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique
  expiresAt  DateTime
  lastSeenAt DateTime @default(now())
  userAgent  String?
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}
```

`username` salvestatakse väiketähtedega (sisselogimisel võrreldakse väiketähtedega).

### `src/server/auth.ts` (uus, puhtad ja testitavad funktsioonid)

- `hashPassword(pw): Promise<string>` — `crypto.scrypt`, 16-baidine juhuslik sool,
  väljund `scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>` (N=16384, r=8, p=1, keylen 64).
- `verifyPassword(pw, stored): Promise<boolean>` — `timingSafeEqual`.
- `validateNewPassword(pw): string | null` — vähemalt 10 märki, muidu veateade.
- `generateSessionToken(): string` — 32 juhuslikku baiti, base64url.
- `hashToken(token): string` — SHA-256 hex.
- `parseCookies(header): Record<string,string>`, `sessionCookie(token, maxAgeSec)`,
  `clearSessionCookie()` — küpsis `agro_session`, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=…`.
- `createLoginLimiter({ max: 10, windowMs: 15*60*1000 })` — mälupõhine loendur võtmetega
  `u:<username>` ja `ip:<ip>`; `isBlocked(key)`, `registerFailure(key)`, `reset(key)`.
- `checkMutationRequest(req, allowedOrigin): 'ok' | 'bad-origin' | 'bad-content-type'`.

### Sessioon

- Kehtivus 14 päeva, pikeneb kasutamisel; `lastSeenAt` ja `expiresAt` uuendatakse
  kõige rohkem kord tunnis.
- Andmebaasis ainult `tokenHash`; küpsises toortoken.
- Klient-IP võetakse päisest `X-Forwarded-For` (esimene väärtus; Apache lisab selle),
  muidu `req.socket.remoteAddress`.

### Päringu kontroll (`handleApiRequest` alguses)

1. **CSRF:** meetod POST/PUT/PATCH/DELETE → `Origin` peab olema `APP_ORIGIN`
   (vaikimisi `https://agro.ventcap.ee`, arenduses `.env`-ist); kehaga päring peab olema
   `Content-Type: application/json`. Muidu 403 `{ error }`.
2. **Avalikud teed:** `POST /api/auth/login`, `GET /api/auth/me` (vastab 401, kui sessiooni pole).
3. **Kõik muud `/api/*` teed** (sh `/api/status`) nõuavad kehtivat sessiooni ja aktiivset
   kasutajat; muidu 401 `{ error: 'Sisselogimine on vajalik' }`.

### Endpointid

| Meetod ja tee | Keha | Vastus |
|---|---|---|
| `POST /api/auth/login` | `{ username, password }` | 200 `{ user }` + küpsis; 401 `{ error: 'Vale kasutajanimi või parool' }`; 429 `{ error: 'Liiga palju katseid, proovi 15 minuti pärast' }` |
| `POST /api/auth/logout` | — | 200 `{ success: true }`, sessioon kustutatud, küpsis tühjendatud |
| `GET /api/auth/me` | — | 200 `{ user }` või 401 |
| `POST /api/auth/password` | `{ currentPassword, newPassword }` | 200 `{ success: true }` (kasutaja teised sessioonid kustutatakse); 400 valideerimisviga; 401 vale praegune parool |

`user` = `{ id, username, displayName }`. Sisselogimise eduka katse korral: limiteri
võtmed nullitakse, `lastLoginAt` uuendatakse. Keelatud (`isActive=false`) kasutaja → sama
401 teade kui vale parooli korral.

### Käsurea skript `src/server/userCli.ts`

`npm run user -- <käsk>`:

| Käsk | Tegevus |
|---|---|
| `add <nimi> [--display "Nimi"]` | loob kasutaja; parool küsitakse varjatult kaks korda |
| `passwd <nimi>` | muudab parooli, kustutab kasutaja sessioonid |
| `disable <nimi>` / `enable <nimi>` | keelab (kustutab sessioonid) / lubab |
| `list` | kasutajanimi, nimi, aktiivne, viimane sisselogimine, sessioonide arv |
| `logout <nimi>` | kustutab kasutaja sessioonid |

Kasutajaid ei kustutata (ainult keelatakse). Parooli valideerimine sama mis API-s.

## Osa 3: kasutajaliides

- **`src/services/api.ts`:** kõik meetodid kasutavad ühte abifunktsiooni
  `apiFetch(path, init)`, mis 401 vastuse korral kutsub registreeritud käsitleja
  `setUnauthorizedHandler(fn)` ja viskab vea. Meetodite avalik liides ei muutu.
  Uued meetodid: `getMe()`, `login(username, password)`, `logout()`,
  `changePassword(currentPassword, newPassword)`.
- **`src/main.tsx` / uus `src/AuthGate.tsx`:** käivitumisel `getMe()`;
  laadimise ajal lihtne laadimisvaade; 401 → `LoginPage`; OK → `App`.
  `setUnauthorizedHandler` viib `LoginPage`-le teatega "Sessioon aegus, logi uuesti sisse".
- **`src/components/LoginPage.tsx` (uus):** kogu ekraan, rakenduse bränd, kasutajanimi,
  parool, "Logi sisse", veateated serverist (401/429).
- **`src/components/Header.tsx`:** kasutajamenüü (nimi, "Muuda parooli", "Logi välja").
- **`src/components/ChangePasswordModal.tsx` (uus):** praegune parool, uus, kordus;
  kliendipoolne kontroll ≥10 märki ja kokkulangevus; serveri veateade.
- `App` saab `user` ja `onLogout` propsidena.

## Osa 4: ümberlülitus, veakäsitlus, testimine

### Ümberlülitus

1. `prisma db push` (uued tabelid, andmekaota), `prisma generate`, `npm run build`.
2. `agro.service` käivitatakse pordil 8820; `agro-dev` ja Apache töötavad edasi muutmata.
3. Integratsioonitest serveri vastu (`localhost:8820`).
4. **Kasutaja samm:** `npm run user -- add <nimi>` (parool ei satu vestlusesse).
5. Apache'i virtuaalhost suunatakse 8820 peale (vana fail varukoopiaks
   `agro.ventcap.ee.conf.bak-basic-auth`), Basic Auth eemaldatakse, `apache2ctl configtest`,
   `systemctl reload apache2`; `agro-dev` peatatakse ja keelatakse.
6. Tagasipööramine: taasta `.bak` fail, `reload apache2`, `systemctl start agro-dev`.

### Veakäsitlus

| Olukord | Käitumine |
|---|---|
| API käsitlemata viga | 500 JSON; viga `journalctl -u agro` |
| Andmebaas ei vasta | 500; kasutajaliides näitab olemasolevat andmebaasi veateadet |
| Puuduv staatiline fail | `index.html` (SPA) |
| Puuduv `/api/...` | 404 JSON |
| Server kukub | `systemd` taaskäivitab (5 s) |
| Sessioon aegub kasutamise ajal | 401 → sisselogimise leht teatega |

### Testimine

- **Ühiktestid (Vitest)** — `src/server/auth.test.ts`: `hashPassword`/`verifyPassword`
  (õige, vale, rikutud räsi), `validateNewPassword`, `hashToken` (determineeritud),
  `parseCookies`/`sessionCookie`, limiter (10 katset blokeerib, aken möödub, `reset`),
  `checkMutationRequest` (GET ok, POST vale Origin, POST ilma JSON-ita, DELETE ilma kehata ok).
  `src/server/static.test.ts`: tee lahendamine (normaalne fail, `..` väljumine → keeldutud, SPA varuvariant).
- **Integratsioonitest** — `scripts/auth-smoke.mts` (ei käivitata CI-s; käsitsi serveris):
  loob ajutise testkasutaja otse andmebaasi, kontrollib: `/api/status` ilma sessioonita 401;
  vale parool 401; õige parool → küpsis → `/api/auth/me` ja `/api/master-fields` 200;
  POST vale `Origin`-iga 403; väljalogimise järel 401; 11. vale katse 429;
  `/` ja `/assets/*` õigete päistega; `/..%2f.env` → 404; kustutab testkasutaja ja sessioonid.
- **Brauser (kasutaja):** sisselogimine, andmete nägemine, parooli muutmine, väljalogimine.

## Osa 5: README

`README.md` asendatakse projekti README-ga: mis rakendus on; arhitektuur (joonis nagu
ülal); nõuded; käsud (`npm run build`, `npm run release`, `npm test`, `npm run user -- …`);
teenus ja logid (`systemctl`, `journalctl -u agro`); Apache virtuaalhost; andmebaasi
varundus enne ohtlikke muudatusi; `._scratch/` tähendus (git'ist välja jäetud,
isikuandmetega impordifailid).

## Väljaspool ulatust

- Rollid ja operaatoripõhine ligipääs.
- "Kes muutis" logi (kasutaja ID-d andmemuudatustel).
- Parooli taastamine e-postiga.
- Eraldi arenduskeskkond.
