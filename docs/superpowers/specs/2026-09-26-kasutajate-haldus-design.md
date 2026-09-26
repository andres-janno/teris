# Kasutajate haldus rakenduses — disain

Kuupäev: 2026-09-26. Eelneb: `2026-09-25-toodanguserver-ja-sisselogimine-design.md`
(kasutajad/sessioonid, `authGate`, `userCli`).

## Eesmärk

Admin saab rakenduses kasutajaid lisada, muuta, keelata/lubada, parooli lähtestada ja
kustutada. Admini loodud või lähtestatud parool on ajutine: kasutaja peab selle esimesel
sisselogimisel vahetama. Käsurea haldus (`npm run user`) jääb alles.

Väljas: muud rollid peale admini, e-posti teel parooli saatmine, tegevuste logi.

## Andmebaas

`User` (tabel `users`) saab väljad:

- `isAdmin Boolean @default(false)` (veerg `is_admin` vastavalt olemasolevale nimetamisele)
- `mustChangePassword Boolean @default(false)`

Migratsioon (`npx prisma db push`, enne `pg_dump` varukoopia): pärast välja lisamist
`UPDATE users SET is_admin = true` — kõik olemasolevad kasutajad saavad admini õiguse.
Veergude täpsed nimed võetakse olemasoleva skeemi `@map` tavast.

## Server

### Parooli sundvahetus (`authGate.ts`)

- `/api/auth/me` vastus: `{ user: { id, username, displayName, isAdmin, mustChangePassword } }`.
- Kui sessiooni kasutajal `mustChangePassword = true`, on lubatud ainult
  `/api/auth/me`, `/api/auth/password`, `/api/auth/logout`; kõik muu → 403
  `{ error: 'Parool tuleb vahetada' }`.
- Õnnestunud `/api/auth/password` paneb `mustChangePassword = false` (lisaks olemasolevale
  teiste sessioonide kustutamisele).

### Admini API (`src/server/adminUsers.ts`)

Kutsutakse `handleApiRequest`-ist pärast `authGate`-i. Kõik `/api/admin/users*` nõuavad
sessiooni ja `isAdmin`; muidu 403 `{ error: 'Keelatud päring' }`. CSRF-kontroll kehtib
nagu teistel muutvatel päringutel.

| Meetod ja tee | Keha | Tegevus |
|---|---|---|
| `GET /api/admin/users` | — | `{ users: [{ id, username, displayName, isActive, isAdmin, mustChangePassword, lastLoginAt, createdAt }] }`, sorteeritud kasutajanime järgi; paroolirässi ei tagastata |
| `POST /api/admin/users` | `{ username, displayName?, password, isAdmin? }` | loob kasutaja, `mustChangePassword = true`; 201 `{ user }` |
| `PATCH /api/admin/users/:id` | `{ displayName?, isActive?, isAdmin? }` | muudab; `isActive=false` kustutab kasutaja sessioonid |
| `POST /api/admin/users/:id/password` | `{ password }` | uus ajutine parool, `mustChangePassword = true`, kustutab kasutaja sessioonid |
| `DELETE /api/admin/users/:id` | — | kustutab kasutaja (sessioonid kaskaadiga) |

Valideerimine (vead 400):

- kasutajanimi: trim + väiketähed, 1–64 märki, ainult `[a-z0-9._-]` → `'Kasutajanimi peab olema 1–64 märki (a–z, 0–9, . _ -)'`
- olemasolev kasutajanimi → 409 `'Selline kasutajanimi on juba olemas'`
- parool: `validateNewPassword` (olemasolev, `'Parool peab olema vähemalt 10 märki'`)
- tundmatu `:id` → 404 `'Kasutajat ei leitud'`

Kaitsereeglid (400 `'Seda muudatust ei saa teha'` + täpsustus):

- admin ei saa iseennast keelata, kustutada ega endalt `isAdmin` võtta;
- ei saa jätta süsteemi ilma ühegi aktiivse adminita (viimase aktiivse admini keelamine,
  kustutamine või admini õiguse äravõtmine).

Reeglid on puhas funktsioon (nt `checkAdminChange(actorId, target, change, activeAdminCount)`),
mida ühiktestid katavad.

### CLI (`userCli.ts`)

- uued käsud `admin <nimi>` ja `unadmin <nimi>` (sama viimase admini kaitsega);
- `list` näitab ka admini ja sundvahetuse lippu;
- CLI `add`/`passwd` ei pane `mustChangePassword` (kasutaja määrab parooli ise).

## Kasutajaliides

- `AuthUser` saab `isAdmin`, `mustChangePassword`.
- **Sundvahetus:** kui `mustChangePassword`, näitab `AuthGate` rakenduse asemel
  paroolivahetuse vaadet (sama vorm mis `ChangePasswordModal`, sulgemata, pealkiri
  „Määra uus parool“, lisaks „Logi välja“). Õnnestumisel laeb `/api/auth/me` uuesti ja
  avab rakenduse.
- **Kasutajamenüü:** adminile punkt „Kasutajad“ (ikoon `Users`), avab akna
  `UsersAdminModal`:
  - tabel: nimi, kasutajanimi, roll (Admin/Kasutaja), olek (Aktiivne/Keelatud,
    „Parool vahetamata“), viimane sisselogimine;
  - rea tegevused: Muuda (nimi, admin), Lähtesta parool, Keela/Luba, Kustuta (kinnitus
    `confirm`); enda real keelatud tegevused on peidetud;
  - „Lisa kasutaja“: kasutajanimi, nimi, ajutine parool ×2, linnuke „Admin“;
  - serveri veateated näidatakse aknas.
- API meetodid `src/services/api.ts`-s `apiFetch` kaudu.

## Testid

- Ühiktestid: `checkAdminChange` (iseenda keelamine/kustutamine/admini äravõtmine,
  viimane admin, tavaline muudatus lubatud), kasutajanime valideerimine, sundvahetuse
  lubatud teede kontroll.
- `scripts/auth-smoke.mts` täiendus (testkasutajad luuakse ja kustutatakse testis):
  admin loob kasutaja → uus kasutaja logib sisse, `/api/status` 403 → vahetab parooli →
  `/api/status` 200 → tavakasutaja `/api/admin/users` 403 → admin kustutab kasutaja.
