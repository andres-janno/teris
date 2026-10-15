# Mitme ettevõtte tugi ja teenusepakkuja keskkond — disain

Kuupäev: 2026-10-15. Eelnevad: `2026-09-25-toodanguserver-ja-sisselogimine-design.md`,
`2026-09-26-kasutajate-haldus-design.md`, `2026-09-26-e-posti-kutsed-design.md`.

## Eesmärk

Teris muutub mitme ettevõtte (tenant) rakenduseks. Teenusepakkuja loob uue ettevõtte oma
admin-keskkonnast; ettevõte saab tühja keskkonna, kus on üks admin-kasutaja ja ettevõte ise
on esimene operaator. Ettevõtte admin lisab edasi kasutajaid, operaatoreid ja kõik muud andmed.

**Põhinõue:** ettevõtted ei tohi mingil moel näha teise ettevõtte andmeid (võivad olla
konkurendid). Eraldus peab pidama ka siis, kui rakenduse koodis on viga.

Teenusepakkuja haldab admin-keskkonnas ettevõtteid, litsentse (kehtivusaeg + moodulid),
algkataloogi ja seadmete vaidlusi.

Väljas (esimeses etapis): kasutaja kuulumine mitmele ettevõttele, litsentsi piirangud kasutajate
arvu või pindala järgi, algkataloogi muudatuste sünkroniseerimine olemasolevatele ettevõtetele,
eraldi andmebaas ettevõtte kohta.

## Otsused

| Teema | Otsus |
|---|---|
| Eraldusmudel | Üks andmebaas, üks skeem, `tenantId` igal ettevõtte real + Prisma laiendus + Postgres RLS |
| Kasutaja ↔ ettevõte | Üks kasutaja = üks ettevõte; kasutajanimi ja e-post unikaalsed kogu süsteemis |
| Kataloogid | Teenusepakkuja hallatav algkataloog (kultuurid, sordid, tööliigid, töömallid), kopeeritakse uuele ettevõttele loomisel; materjale ei kopeerita |
| Litsents | Kehtivusaeg + moodulid |
| Aegunud litsents | Ainult lugemine (sisselogimine ja vaatamine lubatud, muutmine mitte) |
| Moodulid | Põhimoodul (sh finants ja mullaproovid) alati; litsentsitavad: `TELEMETRY`, `SATELLITE`, `WEATHER_RADAR` |
| Kasutajatugi | Ettevõtte andmeid näeb teenusepakkuja ainult ettevõtte admini antud ajutise loaga, ainult lugemiseks, logitult |
| Seadmed | Ettevõte registreerib ise (IMEI Luhni kontroll + globaalne unikaalsus); andmed nähtavad alates registreerimisest; vaidlused lahendab teenusepakkuja |
| Olemasolevad andmed | Kõik praegused andmed → ettevõte **Loisu Agro OÜ**; olemasolev `RelatedParty` „Loisu Agro OÜ“ on selle esimene operaator, teised praegused operaatorid jäävad lisaoperaatoriteks |

## 1. Andmemudel

### 1.1 Teenusepakkuja tabelid (ilma RLS-ita, ligipääs ainult admin-keskkonnast)

- `Tenant` — `id`, `name`, `registryCode?`, `status` (`ACTIVE` | `SUSPENDED`),
  `primaryPartyId` (ettevõtte enda `RelatedParty`, roll `OPERATOR`), `createdAt`, `updatedAt`.
- `TenantLicense` — `tenantId` (unikaalne, üks kehtiv kirje ettevõtte kohta),
  `validUntil` (`@db.Date`), `modules` (enum `LicenseModule[]`: `TELEMETRY`, `SATELLITE`,
  `WEATHER_RADAR`), `updatedAt`, `updatedBy`.
- `PlatformUser` — teenusepakkuja kasutajad, eraldi `User` tabelist: `username`, `passwordHash`,
  `totpSecret` (krüpteeritult), `isActive`, `lastLoginAt`.
- `PlatformSession` — nagu `Session`, aga `PlatformUser` jaoks; eraldi küpsis.
- `SupportGrant` — `tenantId`, `grantedByUserId`, `validUntil`, `revokedAt?`, `createdAt`.
- `SupportAccessLog` — `tenantId`, `supportGrantId`, `platformUserId`, `startedAt`
  (ettevõtte admin näeb seda oma kasutajahalduses).
- `PlatformAuditLog` — `platformUserId`, `action`, `tenantId?`, `details` (JSON), `createdAt`.
- Algkataloog: `CatalogCrop`, `CatalogCropVariety`, `CatalogWorkType`, `CatalogWorkTemplate`,
  `CatalogWorkTemplateItem` — samad väljad nagu ettevõtte vastetel, ilma `tenantId`-ta.
- `DeviceOwnership` — `tenantId`, `imei?`, `macAddress?`, `from`, `to?`, `createdAt`.
  Osaline unikaalne indeks: ühel IMEI-l (ja MAC-il) võib olla ainult üks rida, kus `to IS NULL`.
  Telemeetria nähtavuse aluseks (vt 4).

### 1.2 Ettevõtte andmed

Kõik praegused mudelid peale `Session` ja `PasswordToken` saavad kohustusliku
`tenantId String` (veerg `tenant_id`, `@@index([tenantId])`, seos `Tenant`-iga).
`Session` ja `PasswordToken` on seotud `User`-iga, mis kuulub ettevõttele.

Globaalsed unikaalsuspiirangud muutuvad ettevõttepõhiseks:

| Praegu | Uus |
|---|---|
| `Season.year @unique` | `@@unique([tenantId, year])` |
| `CadastralParcel.cadastralCode @unique` | `@@unique([tenantId, cadastralCode])` |
| `Crop.name @unique` | `@@unique([tenantId, name])` |
| `SoilSample.sampleNumber @unique` | `@@unique([tenantId, sampleNumber])` |
| `WorkType.name @unique` | `@@unique([tenantId, name])` |
| `Material @@unique([category, name])` | `@@unique([tenantId, category, name])` |
| `WorkTemplate @@unique([cropId, isWinter])` | `@@unique([tenantId, cropId, isWinter])` |

Liitvõtmed, mis sisaldavad juba ettevõttepõhist välisvõtit (nt `[fieldId, year]`,
`[cropId, name]`), jäävad samaks. `Crop.id` on praegu käsitsi antud string — kontrollida
implementatsioonis, et ID-d ei põrkuks ettevõtete vahel (vajadusel genereerida `cuid`).

**Globaalseks jäävad:** `User.username`, `User.email` (sisselogimine ilma ettevõtte valikuta),
`TelemetryDevice.imei`, `TelemetryDevice.macAddress` (seade kuulub korraga ühele ettevõttele),
`Session.tokenHash`, `PasswordToken.tokenHash`.

## 2. Eraldus: kaks kihti

### 2.1 Rakenduse kiht (Prisma laiendus)

`src/server/db.ts` praegune `AsyncLocalStorage` kontekst laieneb:
`{ username, tenantId, readOnly, modules, supportGrantId? }`.

Uus laiendus `tenant-scope` (praeguse `audit-user` kõrval):
- lugemised (`findMany`, `findFirst`, `findUnique`, `count`, `aggregate`, `groupBy`) — lisab
  `where.tenantId = ctx.tenantId`; `findUnique` asendatakse `findFirst`-iga või kontrollitakse tulemust;
- `create`, `createMany`, `upsert` — lisab `data.tenantId`;
- `update`, `updateMany`, `delete`, `deleteMany` — lisab `where.tenantId`;
- **kui ettevõttepõhise mudeli päringul puudub kontekstis `tenantId`, viskab vea** (mitte kunagi
  „kõik ettevõtted“). Erand: autentimise teekonnad, mis loevad `User`/`Session`/`PasswordToken`
  enne konteksti tekkimist, kasutavad selleks eraldi selgesõnalist funktsiooni.

### 2.2 Andmebaasi kiht (Postgres RLS)

- Igal ettevõttepõhisel tabelil: `ENABLE` ja `FORCE ROW LEVEL SECURITY`, poliitika
  `USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (sama)`.
- Rollid:
  - tabelite omanik — ainult skeemimuudatused (`prisma db push`, migratsiooniskriptid);
  - `teris_app` — rakendus ja tugivaade; ei ole omanik, RLS kehtib;
  - `teris_platform` — admin-keskkond; `BYPASSRLS`, kasutatakse ainult admin-keskkonna serverikoodis.
- Iga ettevõtte päring käib tehingus, mille esimene lause on
  `SELECT set_config('app.tenant_id', $1, true)` (tehingu-lokaalne). Implementeeritakse
  laiendusena, mis mähib päringu `$transaction([set_config, query])` sisse; olemasolevad
  interaktiivsed tehingud seavad selle oma alguses.
- Toorpäringud (`$queryRaw`, praegu ~5 kohta `apiHandler.ts`, `fieldWorks.ts`) vaadatakse
  üle ja lisatakse selgesõnaline `tenant_id` tingimus; RLS kaitseb ka siis, kui see ununeb.

## 3. Autentimine, päringu teekond, litsents

### 3.1 Ettevõtte kasutaja sisselogimine

- Sama sisselogimisleht. Ettevõte = `User.tenantId`.
- Keeldutakse, kui `Tenant.status = SUSPENDED` või kasutaja on mitteaktiivne; veateade on
  üldine (ei paljasta kasutajanime olemasolu).
- `tenantId` loetakse igal päringul sessiooni kasutaja kirjest, mitte kliendi sisendist.

### 3.2 Päringu teekond

`runInAuditContext` → autentimine (`authGate.ts`) → `setRequestContext({ username, tenantId,
readOnly, modules })` → API (`apiHandler.ts`). Avalikud teekonnad (login, parooli seadmine)
puudutavad ainult `User`, `Session`, `PasswordToken` tabeleid.

### 3.3 Litsentsi jõustamine (serveris)

- `readOnly = validUntil < täna (Europe/Tallinn)`. Kui `readOnly`, lükatakse kõik muutvad
  päringud (POST/PUT/PATCH/DELETE) tagasi `403 „Litsents on aegunud — andmed on ainult
  lugemiseks“`; erandid: väljalogimine, oma parooli muutmine.
- Mooduli teekonnad tagastavad `403`, kui moodul pole litsentsis:
  - `TELEMETRY` — sõidukite jälgimine, seadmed ja nende määramine, taasesitus, kannete
    telemeetriasoovitused;
  - `SATELLITE` — satelliidipildid, indeksid, pilvisus;
  - `WEATHER_RADAR` — radarikiht.
  Andmed jäävad alles; mooduli taaslubamisel on need jälle nähtavad.
- `GET /api/auth/me` vastus saab lisaks: `tenant: { name }`, `readOnly`,
  `licenseValidUntil`, `modules`, `supportView` (kas tegu on tugivaatega).

### 3.4 Kasutajaliides

- Aegunud litsents: ülariba „Litsents aegus <kuupäev>. Andmed on ainult lugemiseks.“;
  muutmisnupud peidetud/keelatud.
- 14 päeva enne aegumist: hoiatusriba ettevõtte adminile.
- Litsentsis puuduvate moodulite menüüpunktid ja kaardikihid peidetud.
- Rollid ettevõtte sees jäävad samaks (`isAdmin`, `isFinanceManager`); ettevõtte admin haldab
  ainult oma ettevõtte kasutajaid ja operaatoreid; uue kasutaja kutse käib praeguse
  e-posti voo kaudu.

## 4. Telemeetria

### 4.1 Seadme registreerimine ettevõtte poolt

- IMEI: 15 numbrit, kehtiv Luhni kontrollnumber. MAC (Eye-sensor): kehtiv MAC-formaat.
- Unikaalsust tagab `DeviceOwnership` osaline unikaalne indeks (aktiivne omand).
- Hõivatud seade → üldine vastus „Seade on juba registreeritud, võtke ühendust
  kasutajatoega“ (ilma ettevõtte nimeta).
- Iga registreerimine → `PlatformAuditLog` / seadmete registreerimislogi admin-keskkonnas.
- Seadme eemaldamine ettevõttes sulgeb omandirea (`to = now()`).

### 4.2 Telemeetria lugemine

- Kõik TimescaleDB päringud koondatakse moodulisse `src/server/telemetryAccess.ts`.
  `allowedWindows(tenantId)` → `[{ imei, from, to }]` omandiridadest; iga päring piiratakse
  nende IMEI-de ja ajavahemikega.
- Andmed nähtavad ainult omandi algusest. Üleandmisel näeb kumbki omanik ainult oma perioodi.
- TimescaleDB mõõtmiste tabelit ei muudeta (väline teenus kirjutab IMEI järgi).
- `DeviceAssignment` (seade sõidukil) jääb ettevõttesiseseks; luua saab ainult seadmele, mis on
  määratud ajal ettevõtte omandis.

### 4.3 Jagatud ressursid

- Ilmaradar — üldine avalik info, jääb ühiseks.
- Satelliidipiltide vahemälu (`satelliteClouds.ts`, `satiladu.ts`) — avalikud Sentinel-2 pildid.
  Implementatsioonis kontrollida, et vahemälu võti ega vastus ei sisalda teise ettevõtte põllu
  geomeetriat; vajadusel muuta vahemälu ettevõttepõhiseks.
- Tausttööd (kui on) käivad ettevõtete kaupa, igaüks oma ettevõtte kontekstis.
- Kettale salvestatavad ettevõtte failid (kui on) → `<andmekaust>/<tenantId>/…`.
  Implementatsioonis kontrollida, kas üleslaadimisi salvestatakse või ainult parsitakse.

## 5. Teenusepakkuja keskkond

### 5.1 Asukoht ja sisselogimine

- Sama rakendus ja server, eraldi alamdomeen (eelistatult `admin.<domeen>`, alternatiiv
  `/platform`), eraldi küpsis ja `PlatformSession`. Ettevõtte sessioon ei kehti admin-keskkonnas
  ega vastupidi.
- `PlatformUser` sisselogimine nõuab TOTP kaheastmelist kinnitust.
- Esimene teenusepakkuja konto luuakse käsurealt (`userCli.ts` laiendus).
- Admin-keskkonna serverikood kasutab `teris_platform` rolli.

### 5.2 Vaated

1. **Ettevõtted** — nimi, staatus, litsentsi lõpp, moodulid, kasutajate arv, põldude arv ja
   pindala, viimane sisselogimine. Ainult koondarvud.
2. **Uus ettevõte** — vorm: nimi, registrikood, admini nimi ja e-post, litsentsi lõpp, moodulid.
   Ühes tehingus: `Tenant` + `TenantLicense` + `RelatedParty` (ettevõte, roll `OPERATOR`,
   `Tenant.primaryPartyId`) + algkataloogi koopia + admin-`User` + parooli seadmise e-kiri.
   Ebaõnnestumisel ei jää poolikut ettevõtet.
3. **Ettevõtte kaart** — litsentsi muutmine, peatamine/taasaktiveerimine, admini kutse uuesti
   saatmine, seadmed, tugiload, ettevõtte logi.
4. **Algkataloog** — kultuurid, sordid, tööliigid, töömallid. Muudatused mõjutavad ainult
   edaspidi loodavaid ettevõtteid.
5. **Seadmed** — kõik IMEI/MAC koos ettevõtte ja registreerimise ajaga; ümbermääramine ja
   sidumise tühistamine; registreerimiste logi.
6. **Logi** — `PlatformAuditLog`.

### 5.3 Tugiligipääs

- Ettevõtte admin: „Anna kasutajatoele ligipääs“ (1 h / 24 h / 7 päeva) → `SupportGrant`;
  tühistatav igal ajal.
- Kehtiva loa korral: admin-keskkonnas „Ava ettevõtte vaade“ → ettevõtte rakendus
  **ainult lugemiseks**, sessioon seotud loaga ja lõpeb hiljemalt loa lõpus; ülariba
  „Tugivaade: <ettevõte>, kehtib kuni …“.
- Iga sisenemine → `SupportAccessLog`; ettevõtte admin näeb „Kasutajatugi vaatas andmeid <aeg>“.
- Tugisessioon kasutab `teris_app` rolli ja selle ettevõtte `tenantId`-d (mitte `BYPASSRLS`).
  Ilma kehtiva loata ettevõtte sisu admin-keskkonnast ei avane.

## 6. Üleminek tootmises

Projekt kasutab `prisma db push`; andmete täitmine ja RLS tehakse eraldi skriptidega.
**Enne iga sammu `pg_dump` varukoopia**; igal sammul tagasipööramise skript.

1. **Lisav samm:** uued tabelid; `tenantId` veerud lubavad `NULL`. Skript loob ettevõtte
   Loisu Agro OÜ (`primaryPartyId` = olemasolev `RelatedParty` „Loisu Agro OÜ“), täidab kõigil
   ridadel `tenantId`, kopeerib praegused kultuurid/sordid/tööliigid/mallid algkataloogi,
   loob litsentsi (kõik moodulid) ja `DeviceOwnership` read praegustele seadmetele.
2. **Kitsendav samm:** `tenantId NOT NULL`, ettevõttepõhised unikaalsuspiirangud, indeksid.
3. **RLS samm:** poliitikad, rollid `teris_app` ja `teris_platform`; rakenduse
   `DATABASE_URL` → `teris_app`.

## 7. Testimine

- **Eraldus (kõige olulisem):** kaks testettevõtet A ja B; iga mudeli kohta kontrollitakse, et
  A kontekstis ei leia lugemine B ridu ja A ei saa B ridu muuta ega kustutada ka otse ID järgi.
- **RLS ilma laienduseta:** sama kontroll toorpäringuga `teris_app` rollis ilma rakenduse
  filtrita — andmebaas tagastab tühja tulemuse.
- **Konteksti puudumine:** ettevõttepõhine päring ilma `tenantId`-ta viskab vea.
- **Litsents:** aegunud → kirjutamine `403`, lugemine `200`; puuduv moodul → teekond `403`.
- **Telemeetria:** üleantud seadme puhul näeb kumbki omanik ainult oma perioodi; vigane IMEI
  ja hõivatud IMEI tagasi lükatud.
- **Tugiligipääs:** ilma loata keeld; loaga ainult lugemine; aegunud loaga keeld; logikirje tekib.
- **Teenusepakkuja:** uue ettevõtte loomine on atomaarne (vea korral ei jää ridu); TOTP nõutud.
- Olemasolevad live-andmetest sõltuvad testid (nt `telemetryHistory.test.ts`) jooksevad
  Loisu Agro OÜ kontekstis.

## 8. Etapid

Iga etapp on eraldi release'itav.

1. **Andmemudel ja eraldus** — `Tenant`, `tenantId` kõikjal, laiendus, RLS, üleminek.
   Kasutaja jaoks ei muutu midagi, aga eraldus kehtib. Suurim ja riskantseim etapp.
2. **Litsents ja moodulid** — `TenantLicense`, ainult lugemise režiim, moodulite peitmine,
   hoiatus- ja aegumisribad.
3. **Teenusepakkuja keskkond** — sisselogimine koos TOTP-ga, ettevõtted, uue ettevõtte
   loomine, algkataloog, logi.
4. **Seadmete omand** — `DeviceOwnership`, iseregistreerimine, telemeetria päringute piiramine,
   seadmete vaade admin-keskkonnas.
5. **Tugiligipääs** — load, tugivaade, logi ettevõttele.
