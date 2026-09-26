# E-posti kutsed ja parooli lähtestamine — disain

Kuupäev: 2026-09-26. Eelneb: `2026-09-26-kasutajate-haldus-design.md` (admin, ajutine parool,
sundvahetus).

## Eesmärk

- Uue kasutaja lisamisel on e-posti aadress kohustuslik. Vaikimisi saadetakse kasutajale
  kutse unikaalse lingiga, mille kaudu kasutaja määrab parooli ja saab seejärel sisse logida.
- Admini „ajutine parool“ jääb alternatiiviks (kirja ei saadeta).
- Admin saab saata kasutajale parooli määramise lingi („Saada parooli link“).
- Sisselogimise lehel „Unustasid parooli?“.
- Kirjad lähevad serveri Postfixi kaudu aadressilt `noreply@agro.ventcap.ee`, SPF + DKIM +
  DMARC seadistatakse kohe.

Väljas: HTML-kirjad, kirjade mallide haldus, e-posti kinnitamine muutmisel, PTR-kirje muutmine
(hostingu pakkuja teha; soovitus kasutajale).

## Andmebaas

- `User.email String? @unique` — olemasolevatel kasutajatel võib olla tühi; rakenduses uue
  kasutaja lisamisel kohustuslik. Salvestatakse trim + väiketähtedega.
- Uus mudel `PasswordToken` (tabel `password_tokens`):
  `id`, `userId` (→ User, onDelete Cascade), `purpose` (`'INVITE' | 'RESET'`, String),
  `tokenHash` (unikaalne, SHA-256 hex), `expiresAt`, `usedAt?`, `createdAt`; indeks `userId`.
- Kutsutud kasutaja luuakse `passwordHash = ''` (parool puudub). `verifyPassword` tühja räsi
  korral tagastab alati `false` → sisselogimine võimatu kuni parooli määramiseni.
- Kehtivus: `INVITE` 7 päeva, `RESET` 1 tund. Uue tokeni loomisel kustutatakse sama
  kasutaja kõik varasemad kasutamata tokenid.

## E-kirjad

- Saatmine: `spawn('/usr/sbin/sendmail', ['-t', '-i', '-f', MAIL_FROM])`, sõnum stdin'i kaudu
  (RFC 5322, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit`,
  päis `Subject` MIME-kodeeritud (`=?UTF-8?B?…?=`)). Uusi npm-sõltuvusi ei lisata.
- Seaded `.env`-ist: `MAIL_FROM` (vaikimisi `noreply@agro.ventcap.ee`), `APP_BASE_URL`
  (vaikimisi `https://agro.ventcap.ee`), `MAIL_DISABLED=1` → kirja ei saadeta, logitakse ainult
  saaja ja teema (arenduseks).
- Link: `${APP_BASE_URL}/parool#${token}` — token fragmendis, et see ei jõuaks serveri ega
  Apache logidesse. Token: 32 juhuslikku baiti base64url (sama mis sessioonitokenil).
- Kirjade tekst (eesti keeles):
  - Kutse — teema „Kutse AGRO rakendusse“: tervitus (nimi), „Sulle on loodud konto kasutajanimega
    <username>.“, link, „Link kehtib 7 päeva ja on ühekordne.“
  - Lähtestus — teema „AGRO parooli määramine“: link, „Link kehtib 1 tund. Kui sa seda ei
    tellinud, võid kirja eirata.“
- Kirja koostamine on puhas funktsioon (ühiktestitav); saatmine eraldi.

## Server

### Avalikud teed (`authGate.ts`, töötavad ilma sessioonita, CSRF-kontroll kehtib)

| Tee | Keha | Vastus |
|---|---|---|
| `POST /api/auth/forgot` | `{ login }` (kasutajanimi või e-post) | alati 200 `{ success: true }`; kui aktiivne kasutaja e-postiga leitakse → RESET-token + kiri. Piiraja: 5 päringut / 15 min võtmetega `f:<login>` ja `fip:<ip>` → 429 |
| `POST /api/auth/token` | `{ token }` | kehtiv: `{ valid: true, purpose, username }`; muidu 400 `{ error: 'Link on aegunud või juba kasutatud' }` |
| `POST /api/auth/set-password` | `{ token, password }` | parool ≥10 märki; määrab parooli, `mustChangePassword=false`, märgib tokeni kasutatuks, kustutab kasutaja teised tokenid ja kõik sessioonid; 200 `{ success: true, username }` |

Token liigub ainult POST-päringu kehas (mitte URL-is), et see ei jõuaks Apache logidesse.
`forgot` piiraja loeb iga päringut (mitte ainult ebaõnnestumisi).

### Admini API (`adminUsers.ts`)

- `POST /api/admin/users`: `{ username, displayName?, email, isAdmin?, password? }`.
  E-post kohustuslik ja valideeritud (`^[^\s@]+@[^\s@]+\.[^\s@]+$`, ≤254) → 400
  `'Sisesta korrektne e-posti aadress'`; kordus → 409 `'Selline e-posti aadress on juba kasutusel'`.
  - `password` antud → senine voog (ajutine parool, `mustChangePassword=true`, kirja ei saadeta).
  - `password` puudub → `passwordHash=''`, INVITE-token, kiri. Vastus 201
    `{ user, emailSent: boolean }`.
- `PATCH /api/admin/users/:id`: lisaks `email` (sama valideerimine ja unikaalsus).
- `POST /api/admin/users/:id/send-link`: saadab lingi (kasutajal pole parooli → INVITE, muidu
  RESET); kasutajal peab olema e-post (400 `'Kasutajal pole e-posti aadressi'`) ja ta peab
  olema aktiivne. Vastus `{ success: true, emailSent: boolean }`.
- Kasutajate nimekirja väljad: lisaks `email`, `hasPassword` (passwordHash ≠ '').
- Kirja saatmise viga ei tühista kasutaja loomist: `emailSent: false` + serveri logis viga.

### CLI

- `add <nimi> [--display "Nimi"] [--email aadress]`; `list` näitab e-posti.

## Kasutajaliides

- `UsersAdminModal`:
  - lisamisvorm: kasutajanimi, nimi, e-post (kohustuslik), valik „Saada kutse e-postiga“
    (vaikimisi) / „Määra ajutine parool“ (siis paroolid ×2), linnuke „Admin“;
  - muutmisvorm: nimi, e-post, admin;
  - rea tegevus „Saada parooli link“ (ikoon `Mail`), ainult teistel ja e-postiga kasutajatel;
  - veerg „E-post“; olek „Kutse saadetud“, kui `!hasPassword`;
  - `emailSent === false` → teade „Kasutaja loodi, aga e-kirja saatmine ebaõnnestus — proovi
    „Saada parooli link““.
- `LoginPage`: link „Unustasid parooli?“ → vorm (kasutajanimi või e-post) → teade „Kui konto
  on olemas, saatsime e-posti aadressile parooli määramise lingi.“
- `SetPasswordPage` (`/parool#token`): kontrollib tokenit (`POST /api/auth/token`), näitab
  kasutajanime; parool ×2 (≥10); õnnestumisel eemaldab URL-ist tokeni ja näitab
  sisselogimise lehte teatega „Parool määratud. Logi sisse.“; vigane/aegunud link → teade +
  „Unustasid parooli?“ võimalus.
- `AuthGate` näitab `SetPasswordPage`-i, kui `location.pathname === '/parool'`.

## Postfix, DKIM, SPF, DMARC

- Postfix: `myhostname = agro.ventcap.ee`, `inet_protocols = ipv4`, `smtp_tls_security_level = may`.
- opendkim (Debian pakett `opendkim`, `opendkim-tools`): selektor `agro`, domeen
  `agro.ventcap.ee`, võti `/etc/opendkim/keys/agro.ventcap.ee/agro.private`; milter
  `inet:8891@localhost`; Postfix `smtpd_milters`/`non_smtpd_milters = inet:localhost:8891`,
  `milter_default_action = accept`.
- DNS (kasutaja lisab):
  - `agro.ventcap.ee TXT "v=spf1 ip4:185.31.243.120 -all"`
  - `agro._domainkey.agro.ventcap.ee TXT "v=DKIM1; k=rsa; p=<avalik võti>"`
  - `_dmarc.agro.ventcap.ee TXT "v=DMARC1; p=none; adkim=s; aspf=s"`
- Soovitus: paluda hostingu pakkujal (Zone) muuta 185.31.243.120 PTR → `agro.ventcap.ee`.
- Kontroll: testkiri kasutaja postkasti; päises `dkim=pass`, `spf=pass`.

## Testid

- Ühiktestid: e-posti valideerimine/normaliseerimine, tokeni kehtivuse arvutus, kirja
  koostamine (päised, MIME-teema, link fragmendiga), `verifyPassword('', …)` → false.
- `auth-smoke.mts` (server `MAIL_DISABLED` pole vajalik — testis kirju ei looda): testkasutaja +
  token luuakse otse DB-sse teadaoleva toortokeniga; kontrollid: `forgot` tundmatu loginiga →
  200; vale token → 400; `token` kehtiv → 200; `set-password` → 200; uue parooliga login → 200;
  sama token uuesti → 400; aegunud token → 400; admin loob kasutaja ajutise parooliga ilma
  e-postita → 400; kordub e-post → 409.
