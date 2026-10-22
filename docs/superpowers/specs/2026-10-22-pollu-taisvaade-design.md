# Põllu täisvaade ja PRIA põlluraamatu viimine Terise töödesse (disain)

Kuupäev: 2026-10-22
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust

## Eesmärk

1. **Teris on põlluraamatu tõeallikas.** Planeeritud tööl ja kandel on
   olemas PRIA e-põlluraamatu kohustuslikud väljad. Järgmises etapis
   eksporditakse Terisest PRIA-sse (eraldi disain).
2. **PRIA väljavõtte import loob Terise tööd.** Iga PRIA tegevuse rida on
   üks planeeritud töö (`field_works`) ja selle töö üks kanne
   (`work_entries`). Terises võib tööle kandeid juurde lisada. PRIA tõmmist
   eraldi ei hoita.
3. **Uus põllu täisvaade** asendab praeguse põllu popup'i
   (`FieldDetailsDrawer`): üldandmed + põllu tööde ajajoon (plaan ja
   tegelikult tehtud kanded).

Muudab 2026-09-24 disaini: põlluraamat ei ole enam eraldi impordiandmestik
(`field_operations`), vaid Terise tööd ja kanded.

### Mõisted

- **Töö** (`field_works`) = üks planeeritud tegevus põllul hooajas, nt
  "Taimekaitsevahendi kasutamine 18.–20.05.2025, Flexity 0,25 l/ha + MOXA
  0,20 l/ha". Samal põllul võib sama tüüpi töid olla mitu.
- **Kanne** (`work_entries`) = tegelikult tehtud töö osa (päev, pindala,
  töötaja, masin, kasutatud materjalid). Tööl võib olla mitu kannet.
- Töö on tehtud, kui kanded katavad töö pindala või töö märgitakse käsitsi
  tehtuks (olemasolev loogika `syncFieldWorkStatus`, `ONCE` reegel kehtib
  nüüd igale tööle).

### Prototüüp

Kood tehakse kohe kõigile põldudele (väljavõtte formaat on kontrollitud
ühesugune: 2025 ja 2026 failides 31 lehte, sama päis ja tegevuste tabel).
Olemasolevate PRIA andmete üleviimine (vt "Üleviimine") käivitatakse esmalt
ainult Loisu-Agro põllule **nr 10** (massiiv 60944386810), hooajad 2025 ja
2026. Pärast ülevaatust ülejäänud põllud ja ettevõtted.

## Lähteolukord

- PRIA väljavõtte import: `FieldBookUploadModal` → `fieldBookWorkbook.ts` →
  `fieldBookParser.ts` → `fieldBookImport.ts` →
  `POST /api/field-operations/import` → `field_operations` +
  `field_operation_products`.
- Popup'i parem veerg (`FieldOperationsSection`) näitab ainult PRIA ridu.
- Terise tööd: `field_works` (unikaalne `(fieldSeasonId, workTypeId)`,
  kordused `plannedCount` + kande `occurrenceNo`) → `work_entries` →
  `work_entry_lines`. Töötüübid ja mallid tulevad platvormi kataloogist
  (`catalog_work_types`, `catalog_work_templates`; `src/server/catalog.ts`).
- Andmebaasis 2026-10-22: Loisu-Agro 7 kannet, 1 kulumaterjal; PRIA tegevusi
  Loisu-Agro 2025: 325, 2026: 221; teistel ettevõtetel 332 (2026) ja 325 (2025).
- Hooajad 2025 ja 2026 on lahti.
- Töötüübid (kõigil kolmel ettevõttel samad 14): Kõrrekoorimine, Künd,
  Kivikoristus, Randaalimine, Libistamine, Rullimine, Umbrohutõrje (enne
  külvi), Külv, Väetamine, Taimekaitse, Leheväetamine, Umbrohutõrje, Seire,
  Koristus.

## 1. Andmemudel

### 1.1 Töötüübid = PRIA klassifikaator

`work_types` ja `catalog_work_types` asendatakse PRIA e-põlluraamatu 29
tegevusega üks-ühele. Uus väli mõlemas:

```prisma
priaCode String? // PRIA tegevuse nimi klassifikaatoris, nt "Taimekaitsevahendi kasutamine"
@@unique([tenantId, priaCode]) // work_types
```

`name` = PRIA nimi. Faas ja `usesMaterials` vaikimisi:

| PRIA tegevus | Faas | Materjalid |
|---|---|---|
| Kündmine, Kultiveerimine, Libistamine, Randaalimine, Rullimine, Sügavkobestamine, Vagude moodustamine, Äestamine, Freesimine, Kivikorjamine | PREPARATION | ei |
| Lupjamine | PREPARATION | jah |
| Külvamine/istutamine | SOWING | jah |
| Väetamine, Taimekaitsevahendi kasutamine | CARE | jah |
| Seire | CARE | ei (leiud) |
| Vaheltharimine, Leegitamine, Istandike hooldus, Kastmine, Purustusniide (hekseldamine), Niitmine, Kaarutamine, Vaalutamine, Karjatamine, Maaparandushoiutööd, Sõnniku aunastamine, Mullaproovi võtmine | CARE | ei |
| Saagikoristus, Saagi vedu põllult | HARVEST | ei |

**Kordumine kaob töötüübist.** Iga töö on üks kord; korduv töö = mitu tööd.
`repeatMode`, `maxRepeats`, `intervalDays` (töötüüp) ja `occurrenceNo`
(kanne) jäävad andmebaasi, kuid neid ei kasutata ega kuvata (eemaldamine
hiljem). Malli rea `plannedCount` jääb: malli rakendamine loob nii mitu
eraldi tööd.

**Migratsioon** (skript `scripts/pria-work-types.mts`, kõigile ettevõtetele
ja kataloogile, ettevõtte kaupa ühes transaktsioonis, idempotentne):

| Vana | Uus PRIA tegevus |
|---|---|
| Kõrrekoorimine, Randaalimine | Randaalimine |
| Künd | Kündmine |
| Kivikoristus | Kivikorjamine |
| Libistamine | Libistamine |
| Rullimine | Rullimine |
| Umbrohutõrje (enne külvi), Umbrohutõrje, Taimekaitse | Taimekaitsevahendi kasutamine |
| Külv | Külvamine/istutamine |
| Väetamine, Leheväetamine | Väetamine |
| Seire | Seire |
| Koristus | Saagikoristus |

Sammud:

1. Luua puuduvad PRIA töötüübid (29).
2. `field_works` tõsta uuele tüübile. Kordustega töö (`plannedCount > 1`)
   jagatakse: üks töö iga kanne `occurrenceNo` kohta + kanneteta tööd
   puuduvate korduste jaoks (kuni `plannedCount`). Leheväetamise töödel
   `method = "Pritsimine"`.
3. Mallide read tõsta; samale tüübile langevad read liita (`plannedCount`
   summa, `typicalTiming` esimeselt).
4. Vanad kasutuseta tüübid kustutada.

### 1.2 Töö (`field_works`) = plaan

```prisma
model FieldWork {
  // ... olemasolevad; EEMALDATAKSE @@unique([fieldSeasonId, workTypeId]) → @@index([fieldSeasonId, workTypeId])
  plannedDateFrom DateTime? // planeeritud algus (PRIA "Kuupäev")
  plannedDateTo   DateTime? // planeeritud lõpp; tühi = üks päev
  plannedAreaHa   Float?    // planeeritud pindala; tühi = põllu pindala
  method          String?   // "Paisklaotamine", "Pritsimine", ...
  plannedWorkerId String?   // planeeritud teostaja (taimekaitse)
  source          WorkSource @default(MANUAL)

  lines FieldWorkLine[]
}

enum WorkSource {
  MANUAL      // Terises loodud (käsitsi või mallist)
  PRIA_IMPORT // PRIA väljavõtte impordist
}

// Planeeritud materjal / saak / seire leid
model FieldWorkLine {
  id          String            @id @default(cuid())
  tenantId    String            // nagu teistel
  fieldWorkId String
  kind        WorkEntryLineKind // MATERIAL | HARVEST | OBSERVATION
  materialId  String?
  label       String
  ratePerHa   Float?            // kogus ha kohta
  unit        String            // kg, l, t, g, tk; seirel "taime/m2" jne
  // PRIA atribuudid — samad mis WorkEntryLine (1.4)
  priaRegister String?
  priaKind     String?
  priaSpec     String?
  activeIngredient String?
  nKgHa Float?
  pKgHa Float?
  kKgHa Float?
  sortOrder   Int @default(0)

  fieldWork FieldWork @relation(fields: [fieldWorkId], references: [id], onDelete: Cascade)
  material  Material? @relation(fields: [materialId], references: [id], onDelete: Restrict)
}
```

`plannedText` ("apr–mai") jääb mallist tulnud ligikaudse aja jaoks;
`plannedDateFrom` täidetakse PRIA impordist või käsitsi.

### 1.3 Kanne (`work_entries`) = tegelik

```prisma
model WorkEntry {
  // ...
  dateTo DateTime?  // vahemiku lõpp; tühi = üks päev
  method String?    // tegelik viis (vaikimisi töö oma)
  source WorkSource @default(MANUAL)
}
```

PRIA "Teostaja" = `workerId`, "Märkused" = `notes`, "Pindala" = `areaHa`.

### 1.4 Kande read (`work_entry_lines`)

```prisma
enum WorkEntryLineKind {
  // ... olemasolevad
  OBSERVATION // seire leid (ei osale finantsis)
}

model WorkEntryLine {
  // ...
  priaRegister     String? // "Väetis registrist", "Taimekaitsevahendid registrist", "Märgaja/kleepaine", "Biostimulaator", "Eesti sordiregister", "EL ühtne sordileht"; seirel seire liik ("Umbrohud")
  priaKind         String? // "Herbitsiid", "NPK väetis", "Suvinisu"; saagil saagi tüüp ("Terad")
  priaSpec         String? // seemne kategooria ("C1", "OTS"); saagil kultuuri tüüp ("Põhikultuur")
  activeIngredient String? // toimeaine
  ratePerHa        Float?  // kogus ha kohta
  nKgHa            Float?
  pKgHa            Float?
  kKgHa            Float?
}
```

- MATERIAL: `quantity` = kogus kokku, `ratePerHa` = kogus ha kohta;
  `quantity = ratePerHa × areaHa` (2 komakohta), üks arvutab teise.
- HARVEST: `quantity` = t kokku, `ratePerHa` = t/ha, `priaKind` = saagi
  tüüp, `priaSpec` = kultuuri tüüp.
- OBSERVATION: `label` = leid ("Põldsinep"), `priaRegister` = seire liik,
  `quantity`/`unit` = kogus ("7", "taime/m2"; "Muu oluline sündmus" puhul
  0 ja tühi ühik). Finantsi kokkuvõtted jätavad OBSERVATION read välja.

Uus kanne tööle eeltäidetakse töö plaanist (kuupäev, pindala, viis,
teostaja, read normiga ha kohta).

### 1.5 Kulumaterjalid

Import loob puuduvad `materials` kirjed toote nime järgi
(`@@unique([tenantId, category, name])`). Kategooria tegevusest:
Külvamine → SEED, Väetamine/Lupjamine → FERTILIZER,
Taimekaitsevahendi kasutamine → PLANT_PROTECTION (ka märgaja,
biostimulaator), muu → OTHER. Ühik PRIA koguse ühikust ilma "/ha" osata.

### 1.6 `field_operations`

Pärast üleviimist (vt allpool) tabelid `field_operations` ja
`field_operation_products` kustutatakse koos `FieldOperationsSection`,
`/api/field-operations*` ja tüüpidega `src/types/fieldOperation.ts`.

Skeemimuudatused on aditiivsed (`npx prisma db push`), v.a unikaalsuse
eemaldamine `field_works` tabelist ja `field_operations` kustutamine
(tehakse pärast üleviimist eraldi sammuna).

## 2. Malli rakendamine

`applyCropTemplate` ja `applyAutumnTemplate` (`fieldWorks.ts`) ei kasuta
enam "tüüp on juba olemas" kontrolli. Malli rea kohta luuakse
`plannedCount` (vaikimisi 1) tööd, millest lahutatakse sama tüübi juba
olemasolevad tööd selles hooaja põllus. Kultuuri vahetusel kustutatakse
nagu praegu ainult mallist tulnud kanneteta tööd.

## 3. PRIA väljavõtte import

Sama nupp (Põllud vaade → "Põlluraamatu väljavõte"), ainult admin. Parser
ja põllu leidmine (massiiv + põllu nr + operaator + hooaeg) jäävad samaks.
Uus endpoint `POST /api/field-book/import` asendab
`/api/field-operations/import`.

Põllu-hooaja kohta, ühes transaktsioonis, iga PRIA tegevuse rea kohta:

1. **Duplikaadi kontroll.** Kui põllu-hooajal on sama töötüübiga töö, mille
   plaani või mõne kande kuupäevavahemik lõikub PRIA reaga või vahe on
   **≤ 2 päeva** (taimekaitsel ja väetamisel lisaks vähemalt üks ühine toode
   nime järgi), loetakse rida juba olemas olevaks:
   - tööl täidetakse tühjad plaaniväljad (kuupäevad, pindala, viis,
     teostaja, märkused) ja puuduvad plaaniread;
   - kannet juurde ei looda; kandeid ei muudeta.
2. **Uus töö + kanne** (vastet pole):
   - `field_works`: `source = PRIA_IMPORT`, plaan PRIA reast
     (kuupäevad, pindala, viis, teostaja, märkused, read);
   - `work_entries`: sama sisuga üks kanne (`source = PRIA_IMPORT`,
     `financeStatus = PENDING`), read `quantity = ratePerHa × areaHa`;
   - töö staatus `syncFieldWorkStatus` järgi (PRIA rida = tehtud).
3. Töötaja leitakse nime järgi seotud isikute registrist (nagu praegu
   teostajaga); kui ei leita, jääb tühjaks ja märkustesse lisatakse
   "Teostaja: <nimi>".
4. Hooaja saak ja kuupäevad (`field_seasons`) uuenevad nagu praegu (tühjad
   väärtused ei kirjuta üle).

Lukus hooaega import ei puuduta (põld jäetakse vahele, kokkuvõttes
põhjusega).

**Eelvaade ja tulemus** põldude kaupa: uusi töid, juba olemas (täiendatud),
vahele jäetud.

### Üleviimine olemasolevast `field_operations` tabelist

Skript `scripts/pria-to-field-works.mts --tenant <id> [--field-code X --num N] [--year Y] [--dry-run]`
käivitab sama loogika olemasolevate `field_operations` ridade peal (faile
uuesti üles laadimata). Järjekord:

1. `--dry-run` Loisu-Agro põld nr 10, 2025 ja 2026 → kokkuvõte.
2. Sama päriselt → kasutaja vaatab täisvaate üle.
3. Ülejäänud põllud ja ettevõtted.
4. `field_operations` tabelite ja koodi eemaldamine (1.6).

## 4. Põllu täisvaade

Uus komponent `FieldFullView` (asendab `FieldDetailsDrawer`). Avaneb kaardil
põllule või registris (Põllud, Külvikord) info-nupule klikkides. Katab kogu
sisuala; kaart jääb taha alles. Sulgemine ✕ või Esc → tagasi samasse kohta.

### Päis

- Põllu nimi, `#id`, `Nr <num>`, massiivi number, kultuur, pindala.
- Hooaja valik (lukk nagu praegu).
- Nupud: "Muuda põldu" (`FieldEditDialog`), "Fookusta kaardil", sulge.

### Vasak veerg (~1/3)

Praeguse popup'i sisu + väike piirikaart (valitud hooaja geomeetria):
pindala, kultuur ja sort, haritud, staatus, kasutusõigus, maakasutus,
katastriüksused, geograafia ja piirid, mullaproovid, NDVI (kui on),
märkmed.

### Parem veerg (~2/3): põllutööd

- **Kokkuvõtteriba:** töid kokku / tehtud; N/P/K kg/ha summa tehtud
  kannetest; saak plaan / tegelik t/ha.
- **Filtrid:** kõik / faasi järgi / planeeritud (kanneteta).
- **Ajajoon:** tööd kronoloogiliselt (kanne kuupäev, selle puudumisel
  `plannedDateFrom`, siis `plannedText`). Töö kaart:
  - tegevus, viis, staatus (planeeritud / töös / tehtud), allikas
    (PRIA import märk);
  - **plaan:** kuupäev või vahemik, pindala, read (nimi · liik ·
    register/täpsustus · norm ha kohta · N/P/K · toimeaine);
  - **kanded** (alati nähtavad, mitu): kuupäev, pindala, töötaja, masin +
    haake, tunnid, kütus, read (kogus ha kohta ja kokku); kui kande
    kogus erineb plaanist, näidatakse plaan halliga kõrval;
  - saak (t/ha, kokku, saagi tüüp), seire leiud;
  - märkused kokkupandavalt.
- Töö kaardil: "+ Kanne" (eeltäidetud plaanist) ja töö muutmine. Kande
  klikk avab `FieldWorkEntryDialog`. Päises "+ Lisa töö" (tegevus PRIA 29
  hulgast + plaan).
- Hinnad ja finantsi read ainult finantsõigusega kasutajale.

### Mobiil

Üks veerg: päis, põllutööd, üldandmed kokkupandavas plokis.

### Andmed

- Üldandmed: olemasolev `masterFields`.
- Põllutööd: uus `GET /api/field-season-works?fieldId=&year=` → põllu-hooaja
  tööd koos plaaniridade, kannete ja kande ridadega.

## 5. Vormid

### Töö (plaan)

Uus `FieldWorkPlanDialog`: tegevus, planeeritud kuupäev/vahemik, pindala,
viis, teostaja, read (tegevuse järgi nagu allpool, ainult norm ha kohta),
märkused. Kasutatakse täisvaates ja põllutööde vaates.

### Kanne (`FieldWorkEntryDialog`)

Lisanduvad PRIA väljad tegevuse (`priaCode`) järgi:

| Tegevus | Lisaväljad |
|---|---|
| kõik | lõppkuupäev (`dateTo`), pindala, märkused |
| Külvamine/istutamine | seeme: sordiregister, sort, liik, seemne kategooria, kogus ha ↔ kokku |
| Väetamine | väetamisviis; materjal: register, toode, liik, kogus ha ↔ kokku, N/P/K kg/ha |
| Lupjamine | materjal: register, toode, liik, kogus t/ha ↔ t |
| Taimekaitsevahendi kasutamine | teostaja (kohustuslik); materjalid (mitu): register, toode, liik, toimeaine, kogus ha ↔ kokku |
| Seire | leiud (mitu): seire liik, leid, kogus (ühik liigi järgi) |
| Saagikoristus | kultuuri tüüp, saagi tüüp, t/ha ↔ t kokku |

Ülejäänud tegevustel ainult põhiväljad. Kordumise väli (`occurrenceNo`)
eemaldatakse vormist. Kuupäevad Eesti formaadis (`pp.kk.aaaa`, mitte
natiivne `type=date`).

Klassifikaatorid (väetamisviisid, seemne kategooriad, saagi tüübid,
kultuuri tüübid, seire liigid, TKV materjali tüübid) on konstandid
`src/types/pria.ts`. PTA registreid (väetised, TKV-d, sordid) selles etapis
ei päri — toode valitakse Kulumaterjalidest või sisestatakse vabatekstina.

## 6. Põllutööde vaade (`FieldWorksBoard`)

Kohandus uue mudeliga: sama tüüpi mitu tööd on reas eraldi kaartidena
(sildil kuupäev või `plannedText`), korduste loendur (`↻ 0/3`) ja
`plannedCount` muutmine eemalduvad. Töötüüpide register
(`WorkRegisterModal`, platvormi `CatalogView`) ei näita enam kordumise
seadeid; malli real jääb "kordi".

## Väljaspool ulatust

- Eksport Terisest PRIA-sse (järgmine etapp, eraldi disain; enne tuleb
  selgitada, kas PRIA pakub tegevuste andmevahetust või jääb käsitsi
  sisestamine väljavõtte abil).
- PTA väetise-, TKV- ja sordiregistri liidestus.
- Karjatamise, maaparandushoiutööde, sõnniku aunastamise ja mullaproovi
  võtmise erivormid (kasutavad põhivälju + märkusi).
- `repeatMode`/`maxRepeats`/`intervalDays`/`occurrenceNo` veergude
  eemaldamine andmebaasist.

## Testimine

- Ühiktestid (Vitest):
  - töötüüpide migratsioon: tüüpide liitmine, kordustega töö jagamine,
    mallide liitmine;
  - malli rakendamine `plannedCount` järgi (sh olemasolevad sama tüübi
    tööd);
  - impordi duplikaadi kontroll: vahemike lõikumine, 2 päeva piir,
    tootenime nõue taimekaitsel/väetamisel, täiendamine ei kirjuta üle;
  - kogus ha ↔ kokku arvutus;
  - finantsi kokkuvõte jätab OBSERVATION read välja.
- Üleviimine `--dry-run` põllul nr 10: 2025 → 10 tööd + 10 kannet,
  2026 → 8 tööd + 8 kannet.
- Korduvimport sama failiga ei loo uusi töid ega kandeid.
- Release: `npm run release` serveris (tüübikontroll, testid, build).
