# e-PRIA põlluraamatu import — 1. etapp (disain)

Kuupäev: 2026-09-24
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust

## Eesmärk

Importida e-PRIA "Põlluraamatu väljavõte" (`.xls`) rakendusse, et iga põllu ja
hooaja kohta oleks näha tehtud põllutööd (külv, väetamine, taimekaitse, seire,
koristus, mullaharimine) ning täituksid hooaja saagid ja külvi-/koristuskuupäevad.

Põlluraamatu andmeid **ei sisestata rakenduses käsitsi** — ainus allikas on import.

### Etapid

1. **See dokument:** andmemudel, import, põllu tööde ajalugu põllu kaardil.
2. Kokkuvõtted (N/P/K, taimekaitse, planeeritud vs tegelik saak) — eraldi disain.
3. Kaardikiht (põllu värv valitud põlluraamatu näitaja järgi, mullaproovide kihi
   mustriga) — eraldi disain.

## Lähtefail (analüüsitud näidis: hooaeg 2025)

- Vana Exceli formaat (BIFF/`.xls`), iga leht = üks põld, lehe nimi = põllunumber
  (`2`, `12-1`, `4-1`).
- Lehe ülesehitus:
  1. **Päis** (read "Hooaeg", "Põllumassiivi number", "Põllu number",
     "Põllu pindala (ha)", "Kasutusõigus", "Maakasutus", "Põllumajanduskultuur").
     Rea 0 veerus A on ettevõte kujul `<nimi> / <kood>`.
  2. **Kultuuriplokk** — päiserida "Kultuuri tüüp | Kultuur | Saagi tüüp |
     Planeeritud saak (t/ha) | Tegelik saak (t/ha)", seejärel 1–2 rida
     ("Põhikultuur"). Saagid võivad olla tühjad.
  3. **Tegevuste tabel** — päiserida "Tegevus | Kuupäev | Pindala | Muud omadused |
     Register/Materjal | Nimi | Liik/tüüp | Täpsustus | Kogus | N (kg/ha) |
     P (kg/ha) | K (kg/ha) | Märkused".
- Tabeli eripärad:
  - **Jätkurida**: tühi "Tegevus" = eelmise tegevuse järgmine toode.
  - Kuupäev on kas `pp.kk.aaaa` või vahemik `pp.kk.aaaa - pp.kk.aaaa`.
  - Kogus sisaldab ühikut: `0,20 kg/ha`, `3,5 t/ha`, `7 taime/m2`, `g/ha`, `l/ha`.
  - Kümnendkoma (`7,67`).
  - "Muud omadused" sisu sõltub reast: `Teostaja: <nimi>`, `Toimeaine: <aine>`
    või meetod (`Paisklaotamine;`, `Pritsimine;`, `Põhikultuur;`).
  - Kokkuvõtterida, kus "Kogus" = `NPK Kokku` — jäetakse välja.
  - Lehe lõpus read "Trükitud: …" ja "Koostaja: …" — jäetakse välja.
- Näidisfaili mahud (kontrolliks): 31 lehte, 325 tegevust, 139 jätkurida,
  18 lehel saagid täidetud, kõik 31 põldu vastavad andmebaasi 2025 Loisu Agro
  hooajakirjetele (massiiv + põllunumber + pindala + kultuur).

## Andmemudel

Kaks uut Prisma mudelit. Tegevuse tüüp hoitakse PRIA originaaltekstina (mitte
enum), sest PRIA tegevuste nimekiri on kontrollitud ja 2. etapi kokkuvõtted
grupeerivad selle järgi.

```prisma
model FieldOperation {
  id            Int       @id @default(autoincrement())
  fieldSeasonId Int
  type          String    // PRIA "Tegevus": "Väetamine", "Kündmine", ...
  dateFrom      DateTime
  dateTo        DateTime? // vahemiku lõpp; tühi, kui üks päev
  areaHa        Float?
  method        String?   // "Paisklaotamine", "Pritsimine", "Põhikultuur"
  performerId   String?   // teostaja seotud isikute registrist
  notes         String?
  sortOrder     Int
  createdAt     DateTime  @default(now())

  fieldSeason   FieldSeason            @relation(fields: [fieldSeasonId], references: [id], onDelete: Cascade)
  performer     RelatedParty?          @relation(fields: [performerId], references: [id], onDelete: SetNull)
  products      FieldOperationProduct[]

  @@index([fieldSeasonId])
  @@map("field_operations")
}

model FieldOperationProduct {
  id               Int     @id @default(autoincrement())
  operationId      Int
  category         String? // "Register/Materjal"
  name             String? // "Nimi": toode, sort, umbrohi
  kind             String? // "Liik/tüüp": "Herbitsiid", "Talinisu", "Terad"
  spec             String? // "Täpsustus": seemne kategooria "OTS", "C2"
  amount           Float?
  unit             String? // "kg/ha", "l/ha", "t/ha", "taime/m2", "g/ha"
  nKgHa            Float?
  pKgHa            Float?
  kKgHa            Float?
  activeIngredient String?
  sortOrder        Int

  operation        FieldOperation @relation(fields: [operationId], references: [id], onDelete: Cascade)

  @@index([operationId])
  @@map("field_operation_products")
}
```

Tagasiseosed: `FieldSeason.operations FieldOperation[]`,
`RelatedParty.performedOperations FieldOperation[]`.

`RelatedParty` kasutusloendurisse (`/api/parties` `_count` → `usageCount`) lisandub
`performedOperations`, et teostajana viidatud isikut ei saaks kustutada.

### Veergude kaardistus

| Faili veerg | Siht |
|---|---|
| Tegevus | `FieldOperation.type` (jätkureal tühi → sama tegevus) |
| Kuupäev | `dateFrom` / `dateTo` |
| Pindala | `areaHa` |
| Muud omadused `Teostaja: X` | `performerId` (vt sobitamine) |
| Muud omadused `Toimeaine: X` | selle rea `FieldOperationProduct.activeIngredient` |
| Muud omadused muu tekst | `method` (lõpu `;` ja tühikud eemaldatakse) |
| Register/Materjal | `category` |
| Nimi | `name` |
| Liik/tüüp | `kind` |
| Täpsustus | `spec` |
| Kogus | `amount` + `unit` |
| N / P / K (kg/ha) | `nKgHa` / `pKgHa` / `kKgHa` |
| Märkused | `FieldOperation.notes` (esimene mittetühi väärtus tegevuse ridadest) |

Toode luuakse reale, kus vähemalt üks tooteveerg (Register/Materjal, Nimi,
Liik/tüüp, Täpsustus, Kogus, N/P/K) on täidetud. Tootevabad tegevused
(nt "Kündmine") jäävad ilma toodeteta.

### `FieldSeason` väljade täitmine

- `targetYieldTonsHa`, `actualYieldTonsHa` — kultuuriploki esimene rida, kus saak
  on täidetud.
- `seedingDate` — tegevus "Külvamine/istutamine", mille toote `kind` sisaldub
  (tõstutundetult) hooaja kultuuri tekstis (nt `Talinisu` ⊂ `talinisu allakülvita`),
  ja mis toimus enne põhikultuuri koristust (koristuse puudumisel esimene selline
  külv); võetakse `dateFrom`. Vaste puudumisel jääb `seedingDate` puutumata.
- `harvestDate` — tegevus "Saagikoristus", meetodiga "Põhikultuur"; võetakse
  `dateTo ?? dateFrom`.
- Järgmise kultuuri külv samas failis (nt taliraps pärast talinisu koristust)
  jääb selle hooaja tegevuseks ega muuda `seedingDate`-i.
- Väli kirjutatakse üle **ainult siis, kui failis on väärtus** — tühi väli failis
  olemasolevat väärtust ei kustuta.

## Parsimine

Uus sõltuvus: **SheetJS** (`xlsx`) ametlikust levitusest (npm registri 0.18.5 on
aegunud ja teadaolevate turvaaukudega — seda ei kasutata).

`src/services/fieldBookParser.ts`, kahes kihis:

1. `readFieldBookWorkbook(buffer: ArrayBuffer): SheetRows[]` — SheetJS loeb iga
   lehe stringide 2D-massiiviks (`{ sheetName, rows: string[][] }`).
2. `parseFieldBookSheet(sheet: SheetRows): ParsedFieldBookSheet` — puhas funktsioon
   ilma SheetJS-ita; tõlgendab päise, kultuuriploki ja tegevused. Viga
   (nt loetamatu kuupäev) visatakse lehe-põhise veana.

```ts
interface ParsedFieldBookSheet {
  sheetName: string;
  season: number;
  fieldCode: string;
  num: string;
  areaHa: number | null;
  crop: string;
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  seedingDate: string | null; // ISO kuupäev
  harvestDate: string | null;
  operations: ParsedOperation[];
}
interface ParsedOperation {
  type: string; dateFrom: string; dateTo: string | null; areaHa: number | null;
  method: string | null; performerName: string | null; notes: string | null;
  products: ParsedProduct[];
}
interface ParsedProduct {
  category: string | null; name: string | null; kind: string | null; spec: string | null;
  amount: number | null; unit: string | null;
  nKgHa: number | null; pKgHa: number | null; kKgHa: number | null;
  activeIngredient: string | null;
}
```

Faili tuvastus: vähemalt ühel lehel on rea 0 lahtris tekst
"Põlluraamatu väljavõte" **ja** leidub rida "Tegevus" — muidu viga
"See ei ole e-PRIA põlluraamatu väljavõte".

## Sobitamine (kliendis, eelvaates)

- **Operaator** — impordiaknas valik operaatori rolliga isikutest; ainsa
  operaatori korral vaikimisi valitud. Faili ettevõtte koodi järgi ei sobitata
  (see ei vasta registris olevale registrikoodile).
- **Põld** — `fieldCode` + `num` + valitud operaator + lehe `season` →
  olemasolev hooajakirje. Vasteta leht jäetakse vahele (hoiatus); põlluraamatu
  import põlde **ei loo**.
- **Teostaja** — `performerName` vs seotud isikute nimed: tõstutundetu,
  tühikud normaliseeritud, proovitakse ka vastupidist nimejärjekorda
  ("Eesnimi Perenimi" ↔ "Perenimi Eesnimi"). Vasteta → `performerId` tühi,
  eelvaates hoiatus sobitamata nimedega. Parandus: lisa isik registrisse ja
  impordi uuesti.
- **Lukus hooaeg** — import on lubatud; eelvaates märge
  "Hooaeg N on lukus — import lisab arhiiviandmed".

## API (`src/server/dbApiPlugin.ts`)

### `POST /api/field-operations/import`

Keha:

```json
{
  "operatorId": "party-…",
  "fields": [{
    "fieldCode": "61044415735", "num": "2", "season": 2025,
    "targetYieldTonsHa": 4.0, "actualYieldTonsHa": 3.5,
    "seedingDate": "2024-09-26", "harvestDate": "2025-08-07",
    "operations": [{ "type": "…", "dateFrom": "…", "dateTo": null, "areaHa": 7.67,
                     "method": null, "performerId": "party-…", "notes": null,
                     "products": [ … ] }]
  }]
}
```

Ühes `prisma.$transaction`-is iga välja kohta:
1. Leia `Field` (`fieldCode`, `num`, `operatorId`) ja selle `FieldSeason` (`year = season`).
   Puudub → kirje lisatakse vastuse `skipped` loendisse, transaktsioon jätkub.
2. Kustuta selle hooajakirje olemasolevad `FieldOperation`-id (tooted kaskaadiga).
3. Loo tegevused ja tooted (`sortOrder` = järjekord failis).
4. Uuenda `FieldSeason` saagid/kuupäevad ainult mitte-`null` väärtustega.

Vastus: `{ success, imported: <põldude arv>, operations: <arv>, products: <arv>, skipped: [{fieldCode, num, season}] }`.
Serveri vea korral transaktsioon tühistatakse ja tagastatakse 500 veateatega.

### `GET /api/field-operations?fieldId=<id>&year=<aasta>`

Tagastab selle põllu ja aasta tegevused koos toodete ja teostaja nimega,
järjestatud `dateFrom`, siis `sortOrder` järgi.

## Kasutajaliides

### Impordiaken `src/components/FieldBookUploadModal.tsx`

- Avatakse põldude registri tööriistaribalt nupust "Impordi põlluraamat"
  ("Impordi mullaproovid" kõrval).
- Olemasolevate impordiakende muster: lohistamisala (`.xls`, `.xlsx`), veateade,
  eelvaade, kinnitusnupp.
- Operaatori valik.
- Kokkuvõte: "31 põldu, hooaeg 2025 · 31 sobitatud · 325 tegevust ·
  1 sobitamata teostaja" (+ lukus hooaja märge).
- Eelvaate tabel: leht/põllunumber, põllu nimi registrist, massiiv, ✓/✗,
  tegevusi, tooteid, hoiatused (sobitamata põld, sobitamata teostaja, lehe viga).
- Kinnitus: "Impordi N põllu tööd hooajale 2025" (mitme hooaja korral loetletakse
  hooajad). Kinnitada saab ainult, kui vähemalt üks leht on sobitatud.
- Pärast edukat importi uuendatakse põldude register andmebaasist
  (`api.getMasterFields()`), et saagid/kuupäevad oleksid kohe näha.

### Põllu kaart `src/components/FieldDetailsDrawer.tsx`

Uus jaotis "Põllutööd {aasta}" (sektsiooni stiil `.section-subtitle`):

- Päises kokkuvõte: "12 tegevust · N 146 kg/ha · saak 3,5 / 4,0 t/ha"
  (N summa = toodete `nKgHa` summa; saak = tegelik / planeeritud).
- Ajatelg: kuupäev või vahemik, tegevuse nimi, meetod; teostaja nimi.
- Tooted kompaktsete ridadena: `nimi · liik · kogus ühik`, väetisel lisaks
  `N x P y K z`, taimekaitsel toimeaine.
- Märkused vaikimisi kokku volditud.
- Tühi seis: "Selle hooaja põllutöid pole imporditud."
- Andmed laetakse kaardi avamisel (`GET /api/field-operations?fieldId&year`),
  mitte rakenduse käivitamisel.

## Veakäsitlus

| Olukord | Käitumine |
|---|---|
| Fail pole põlluraamat | Veateade, eelvaadet ei näidata |
| Lehe parsimise viga | Leht märgitakse eelvaates veaga ja jäetakse välja; ülejäänud imporditakse |
| Tundmatu tegevuse tüüp | Salvestatakse tekstina (tüüp on vaba tekst) |
| Loetamatu kogus | `amount = null`, algtekst `unit` väljale |
| Serveri viga | Transaktsioon tühistatakse, aknas veateade |
| Enne esimest päris importi | Käsitsi `pg_dump` varukoopia |

## Testimine

- Uus arendussõltuvus **Vitest**, skript `npm test`.
- `parseFieldBookSheet` ühiktestid anonüümitud näidisridadega testifailis
  (päris faili repositooriumisse ei lisata — sisaldab isikunimesid):
  päis, kultuuriplokk 1 ja 2 reaga, tühjad saagid, jätkuread, "Muud omadused"
  kolm varianti, kuupäevavahemik, koguse ja ühiku jagamine, `NPK Kokku` ja
  "Trükitud/Koostaja" väljajätmine, tootevaba tegevus, `seedingDate`/`harvestDate`
  loogika (sh järgmise kultuuri külv), loetamatu kuupäeva viga.
- Teostaja nimesobituse ühiktest (mõlemad nimejärjekorrad, tõstutundetus).
- Päris failiga kontrollkäivitus: 31 lehte, 325 tegevust, 139 jätkurida, 18 saagiga
  lehte, 31 sobitust andmebaasiga.
- API: import → kordusimport sama failiga (tegevuste arv ei kahekordistu) →
  kontroll, et teiste põldude/hooaegade `field_seasons` read ja tegevused on
  muutumata.

## Väljaspool ulatust (1. etapp)

- Tegevuste käsitsi lisamine/muutmine rakenduses.
- Kokkuvõtete vaated ja kaardikiht (2. ja 3. etapp).
- Päise kasutusõiguse/maakasutuse väljade salvestamine.
- Põldude loomine põlluraamatu põhjal.
