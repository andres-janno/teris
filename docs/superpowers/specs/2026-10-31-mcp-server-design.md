# AI ühendus: Terise MCP server (disain)

Kuupäev: 2026-10-31
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust

## Eesmärk

1. **Kasutaja saab oma Terise andmeid küsida AI-assistendilt** (esmalt Claude
   Desktop, aga lahendus on üldine MCP — sobib iga MCP-d toetava kliendiga).
2. **Ainult lugemine.** Esimeses versioonis ükski tööriist andmeid ei muuda.
3. **Kasutaja loob ühenduse ise** — admini ega teenusepakkuja abi pole vaja.
4. **Samad õigused mis rakenduses**: ettevõtte eraldus, finantsjuhi õigused,
   litsentsi moodulid.

### Mõisted

- **MCP** (Model Context Protocol): standard, mille kaudu AI-assistent
  kutsub välise süsteemi tööriistu.
- **API-võti** (`api_keys`): kasutaja loodud salajane võti, mis seob
  MCP päringu selle kasutaja ja tema ettevõttega.
- **Ühenduse link**: `https://teris.ee/mcp/<võti>` — see kleebitakse
  AI-kliendi connectori seadetesse.
- **Finantsõigus**: `isAdmin || isFinanceManager` (sama reegel mis
  `fieldWorks.ts` ja `stockApi.ts`).

## Otsused

| Teema | Otsus |
|---|---|
| Autentimine | Isiklik API-võti; OAuth-i esimeses versioonis pole |
| Võtme edastamine | URL-i teekonnas (`/mcp/<võti>`), sest Claude Desktopi „Add custom connector“ ei luba päiseid. Lisaks aktsepteeritakse `Authorization: Bearer <võti>` päist samal teel `/mcp` (ilma võtmeta URL), et skriptid ja päist toetavad kliendid saaksid võtit URL-ist eemal hoida |
| Ülesehitus | Eraldi lugemiskiht `src/server/mcp/` — iga tööriist oma päring ja kompaktne vastus; keerukas arvutus (FIFO, telemeetria tunnid) kutsub olemasolevat teenusfunktsiooni |
| Transport | `@modelcontextprotocol/sdk`, Streamable HTTP, olekuta (`sessionIdGenerator: undefined`), JSON-vastused |
| Kulud ja hinnad | Samad õigused: finantsõigusega kasutaja näeb, teised mitte |
| Laokanded | Nagu rakenduses: laokanded (`list_stock_movements`) ainult finantsõigusega; laoseisu kogust näevad kõik |
| Telemeetria | Ainult `TELEMETRY` mooduliga ettevõttel; ilma moodulita telemeetriatööriista ja asukohti ei ole |
| Aegunud litsents | Lugemine lubatud (nagu rakenduses) |
| Tugivaade | Võtmeid luua ei saa; MCP ei toeta tugisessiooni |
| Võtmete arv | Kuni 5 aktiivset võtit kasutaja kohta |
| Kes näeb võtmeid | Ainult omanik (ka admin mitte) |
| Parooli vahetus | Võtmeid ei tühista |
| Kasutaja deaktiveerimine / ettevõtte peatamine | Võtmed lakkavad kohe toimimast (kontroll igal päringul) |
| UI nimi | „AI ühendus“ (kasutajamenüüs) |
| Juhis AI-le | Hallatakse admin.teris.ee-s (`platform_settings`); koodis ainult vaikejuhis |

## Andmemudel

Uus ettevõttepõhine tabel (RLS nagu teistel ettevõtte tabelitel):

```prisma
// Kasutaja isiklik API-võti AI ühenduse (MCP) jaoks; võtit ennast ei salvestata
model ApiKey {
  id         String    @id @default(cuid())
  tenantId   String    @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id")
  userId     String
  name       String // kasutaja antud nimi (nt "Claude Desktop sülearvutis")
  keyHash    String    @unique // SHA-256 võtmest
  keyPrefix  String // võtme algus äratundmiseks (nt "trs_ab12cd")
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  createdBy  String?
  updatedBy  String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([userId])
  @@map("api_keys")
}
```

- Võtme kuju: `trs_` + 32 juhuslikku baiti base64url-ina.
- Võtme otsing räsi järgi käib `authDb()` kaudu (nagu sessioon) —
  ettevõtte konteksti enne võtme leidmist veel pole.
- Migratsioon on ainult lisav; RLS-poliitika lisatakse samas stiilis nagu
  `scripts/tenancy/02-rls.sql`.

## Päringu käik `/mcp`

1. Võti loetakse teest `/mcp/<võti>` või päisest `Authorization: Bearer`.
2. IP-põhine piirang: 10 ebaõnnestunud katset / 15 min (`createLoginLimiter`).
3. Võti leitakse räsi järgi; kehtiv ainult siis, kui `revokedAt` on tühi,
   kasutaja `isActive`, `mustChangePassword` on väär ja ettevõtte staatus
   `ACTIVE`. Kõik vead → sama vastus `401 { error: 'Vigane võti' }`.
4. `lastUsedAt` uuendatakse kuni kord 5 minuti jooksul (`updateMany`).
5. Päring käib `runInRequestContext` sees, `setRequestUser(user)` seab
   ettevõtte ja kasutaja; ettevõtte filter ja RLS kehtivad.
6. Laetakse litsentsi olek (`loadLicenseState`).
7. Iga päringu kohta luuakse MCP server, kuhu registreeritakse ainult
   sellele kasutajale lubatud tööriistad (telemeetria → moodul;
   `list_stock_movements` → finantsõigus). Kõik tööriistad
   `annotations: { readOnlyHint: true }`.
8. Lubatud meetodid: `POST` (JSON-RPC). `GET`/`DELETE` → 405 (olekuta
   režiimis SSE voogu ega seanssi pole).

CSRF-i ja päritolu kontrolli `/mcp` ei rakenda (küpsist ei kasutata,
autentimine on võtmega). Keha piir 1 MB.

### Logid

- Apache: `/mcp/` päringud logitakse ilma teeta pärast `/mcp/`
  (eraldi `CustomLog` env-tingimusega või `SetEnvIf` + väljajätt), et võti
  logisse ei jõuaks.
- Node: vealogides ei kirjutata `req.url`-i `/mcp/` päringute kohta;
  `[mcp]` logirida sisaldab ainult võtme id-d ja tööriista nime.

## Tööriistad

Ühised reeglid:

- Vastus on JSON (`content: [{ type: 'text', text }]`), väljanimed
  inglise keeles, väärtused inimloetavad: nimed id-de asemel, kogus
  koos ühikuga, kuupäevad `pp.kk.aaaa` (Tallinna aeg), kogused 2 komakohaga.
- Loendi piir `limit` (vaikimisi 200, max 1000); vastuses `shown` ja
  `total`, et poolikut vastust ei peetaks täielikuks.
- Geomeetriat ei saadeta.
- Sisend valideeritakse zod-skeemiga (SDK nõue); vigane sisend → selge
  eestikeelne veateade tööriista tulemusena (`isError: true`).
- Kuluväljad lisatakse ainult finantsõigusega kasutajale.

| Tööriist | Sisend | Väljund |
|---|---|---|
| `whoami` | — | kasutaja nimi, ettevõte, finantsõigus, litsentsi moodulid, jooksev hooaeg |
| `list_seasons` | — | aasta, nimi, lukus |
| `list_fields` | `year?` (vaikimisi jooksev), `crop?`, `search?`, `limit?` | number, nimi, pindala ha, toetusõiguslik ha, kultuur, sort, staatus, edenemine %, külv, koristus, sihtsaak, tegelik saak t/ha |
| `get_field` | `field` (number või nimi), `year?` | põllu andmed, katastriosad, mullastik, operaator, hooaja tööd ja kanded koos materjalidega |
| `list_field_works` | `year?`, `field?`, `workType?`, `status?`, `from?`, `to?`, `limit?` | põld, töö liik, faas, plaanitud aeg, staatus, plaanitud materjalid |
| `list_work_entries` | `from?`, `to?`, `year?`, `field?`, `workType?`, `material?`, `vehicle?`, `limit?` | kuupäev(vahemik), põld, töö, tegija, masin, haakeriist, pindala, tunnid, kütus, materjalid (kogus, ühik, norm/ha, toimeaine, NPK); finants: ühikuhind, kulu, kinnitamise staatus |
| `summarize_material_usage` | `year?` või `from`/`to`, `groupBy: 'field' \| 'crop'`, `material?` | materjal × põld/kultuur: kogus, ühik, pindala; finants: summa € |
| `list_stock_levels` | `warehouse?`, `material?` | ladu, materjal, kogus, ühik, miinus-märge; finants: väärtus, keskmine hind |
| `list_stock_movements` *(finantsõigus)* | `warehouse?`, `material?`, `from?`, `to?`, `limit?` | kuupäev, liik, ladu, materjal, kogus, allikas (laokanne / põllutöö), tarnija, dokumendi nr, hind |
| `list_vehicles` | `type?` | masinad ja haakeriistad: liik, mudel, reg nr, laius, juht, haakeriist, viimane aktiivsus; telemeetria: viimane asukoht; finants: soetusmaksumus, amortisatsioon |
| `get_vehicle_activity` | `vehicle`, `from`, `to` | telemeetriaga: süüte järgi töötunnid päevade kaupa ja külastatud põllud (olemasolev loogika); ilma: selle masinaga tehtud kanded |

Kuupäevasisend: `pp.kk.aaaa` või `aaaa-kk-pp`. Põllu/masina/materjali
sisend: nimi või number, tõstutundetu osaline vaste; mitme vaste korral
tagastatakse valikute nimekiri (mitte juhuslik esimene).

### Serveri juhis AI-le (`instructions`)

Juhist hallatakse **admin.teris.ee-s**, mitte koodis — seda saab täiendada
ilma väljalaseta. Juhis on ühine kõigile ettevõtetele.

- Andmed: uus platvormi tabel (ilma RLS-ita, `authDb()` kaudu, nagu
  `HelpArticle`):

  ```prisma
  // Platvormi tekstiseaded, mida teenusepakkuja muudab admin.teris.ee-s (nt AI juhis)
  model PlatformSetting {
    key       String   @id // nt "mcp_instructions"
    value     String
    updatedBy String? // platvormi kasutajanimi
    updatedAt DateTime @updatedAt
    createdAt DateTime @default(now())

    @@map("platform_settings")
  }
  ```

- Koodis on ainult **vaikejuhis** (`DEFAULT_MCP_INSTRUCTIONS`), mida
  kasutatakse, kui andmebaasis kirjet pole või see on tühi. Vaikejuhise
  sisu: Teris on põllumajandusettevõtte haldus; **töö** on plaan,
  **kanne** on tegelik tehtud tegevus (põlluraamat); hooaeg = aasta;
  kulusid ja laokandeid näeb ainult finantsõigusega kasutaja — vaata
  `whoami`; loendid on piiratud, kontrolli `total`.
- MCP server loeb juhise igal `initialize` päringul (üks lihtne päring
  võtme järgi; vahemälu pole vaja).
- admin.teris.ee: uus vaade **„AI ühendus“** — lihttekstiväli (mitte
  HTML-redaktor; juhis läheb AI-le tekstina), näha viimane muutja ja aeg
  (`pp.kk.aaaa HH:MM`), nupud „Salvesta“ ja „Taasta vaikejuhis“ (kustutab
  kirje → kehtib koodi vaikejuhis). Maksimaalne pikkus 20 000 märki.
- API: `GET /api/platform/mcp-instructions` →
  `{ value, isDefault, updatedBy, updatedAt }`;
  `PUT /api/platform/mcp-instructions` `{ value }`;
  `DELETE` → taastab vaikejuhise. Platvormi sessioon nagu ülejäänud
  `/api/platform/*`.
- Iga muudatus kirjutatakse `PlatformAuditLog`-i
  (`action: 'MCP_INSTRUCTIONS_UPDATE'` / `'MCP_INSTRUCTIONS_RESET'`).
- Muudatus jõuab AI-kliendini järgmisel ühendusel (klient loeb juhise
  ühenduse alguses).

## Kasutajaliides: „AI ühendus“

- Kasutajamenüüs (`UserMenu.tsx`) uus valik **„AI ühendus“** → modaal
  (stiil nagu `ChangePasswordModal.tsx`).
- Loend: nimi, `trs_ab12…`, loodud, viimati kasutatud (`pp.kk.aaaa HH:MM`),
  „Tühista“ (kinnitusega).
- „Loo uus võti“: nimi → näidatakse täielik link + „Kopeeri“ ja hoiatus:
  „Linki näidatakse ainult üks kord. See annab ligipääsu sinu Terise
  andmetele — ära jaga seda.“
- Juhend: AI-kliendis lisa uus MCP connector ja kleebi link (näide:
  Claude Desktop → Settings → Connectors → Add custom connector).
- Tugivaates valik peidetud; API keelab samuti.

API (sessioon + CSRF nagu ülejäänud API):

- `GET /api/api-keys` — oma aktiivsed võtmed
- `POST /api/api-keys` `{ name }` → `{ key, url, ...meta }` (võti ainult siin)
- `DELETE /api/api-keys/:id` — tühistab (`revokedAt`), ainult oma võtme

## Failid

- `prisma/schema.prisma` — `ApiKey` + `User.apiKeys`, `PlatformSetting`
- `scripts/tenancy/…` — RLS poliitika `api_keys` tabelile
- `src/server/apiKeys.ts` — võtme loomine, räsi, otsing, kehtivus, API teekonnad
- `src/server/mcp/handler.ts` — `/mcp` päring: autentimine, kontekst, transport
- `src/server/mcp/server.ts` — MCP serveri loomine kasutaja/litsentsi järgi
- `src/server/mcp/instructions.ts` — vaikejuhis, lugemine/salvestamine, platvormi teekonnad
- `src/server/platformApi.ts` — `/api/platform/mcp-instructions`
- `src/admin/AiInstructionsView.tsx`, `AdminApp.tsx`, `platformApi.ts` — admini vaade
- `src/server/mcp/format.ts` — kuupäev, kogus, piiramine, nime järgi otsing
- `src/server/mcp/tools/{fields,works,stock,fleet,account}.ts` — tööriistad plokkide kaupa
- `src/server/prod.ts`, `src/server/dbApiPlugin.ts` — `/mcp` marsruut
- `src/components/AiConnectionModal.tsx`, `UserMenu.tsx` — UI
- Apache vhost — logireegel (serveris)

## Testimine

Vitest, olemasolevas stiilis (andmebaasiga testid nagu `authSession.test.ts`):

- võtme kuju, räsi, prefiks;
- tagasilükkamine: tühistatud võti, mitteaktiivne kasutaja, peatatud
  ettevõte, `mustChangePassword`, tundmatu võti — kõik sama vastus;
- ettevõtte eraldus: ettevõtte A võtmega ei näe ettevõtte B põlde ega
  laoseisu;
- finantsõigus: kuluväljad olemas/puudu iga kulusid sisaldava tööriista
  kohta; `list_stock_movements` puudub tavakasutajal;
- telemeetria moodulita: telemeetriatööriist/asukoht puudub;
- iga tööriist SDK in-memory kliendi kaudu: õige kujuga vastus, `total`
  ja `shown`, mitme vaste valikunimekiri;
- `/api/api-keys`: max 5, teise kasutaja võtit ei saa tühistada ega näha;
- juhis: tühi/puuduv kirje → vaikejuhis; salvestatud tekst jõuab
  `initialize` vastusesse; platvormi teekond nõuab platvormi sessiooni;
  muudatus ja taastamine kirjutavad auditilogisse.

Käsitsi pärast väljalaset: võti → MCP Inspector → kõik tööriistad;
Apache logis võtit pole; Claude Desktopis connector töötab.

## Väljaspool ulatust

- Kirjutavad tööriistad
- OAuth (claude.ai connector teiste ettevõtete jaoks ilma võtmeta)
- Võtme aegumisaeg (võti kehtib tühistamiseni)
- Admini ülevaade ettevõtte võtmetest
