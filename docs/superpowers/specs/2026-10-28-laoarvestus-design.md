# Kulumaterjalide laoarvestus (disain)

Kuupäev: 2026-10-28
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust

## Eesmärk

1. **Kulumaterjalide nimekiri näitab laoseisu** laoühikutes ja rahas.
2. **Laokannete register.** Ühe või mitme materjali arvele võtmine,
   mahakandmine ja ladudevaheline ülekanne ühe kandega.
3. **Mitu ladu.** Laoseis ja FIFO arvestatakse lao kaupa; ladu võib olla
   seotud kaardil oleva huvipunktiga.
4. **Põllutööde kanded kannavad materjali laost maha** automaatselt.
5. **Laoväärtus kujuneb FIFO meetodil** ja FIFO maksumus on põllutöö
   kande materjalirea ühikuhind (finantsjuht seda enam käsitsi ei sisesta).

### Mõisted

- **Ladu** (`warehouses`): koht, kus kaupa hoitakse. Ettevõttel on
  täpselt üks põhiladu.
- **Laokanne** (`stock_documents`): arvele võtmine (`RECEIPT`),
  mahakandmine (`WRITE_OFF`) või ülekanne (`TRANSFER`), ühel kandel mitu
  rida.
- **Liikumine**: sissetulek (arvele võtmise rida, ülekande rida sihtlaos)
  või väljaminek (mahakandmise rida, ülekande rida lähtelaos, põllutöö
  kande materjalirida). Liikumine kuulub alati ühele laole.
- **Partii**: üks sissetulek oma ühikuhinnaga ühes laos; FIFO võtab
  väljaminekud selle lao vanimast partiist.
- **Hindamata ülekulu (võlg)**: väljaminek, mille jaoks partiisid polnud.

## Otsused

| Teema | Otsus |
|---|---|
| Millised põllutöö kanded kannavad maha | Kõik, ka PRIA impordist tulnud ajaloolised (2024–) |
| Miinusseis | Lubatud (praegu). Miinus näidatakse punasena, salvestamist ei takista |
| FIFO miinusseisus | Ülekulu jääb hindamata; järgmine sissetulek katab esmalt võla ja võla read saavad selle partii hinna |
| FIFO → finants | Jah. Kande materjalirea `unitPrice` = FIFO ühikuhind, käsitsi ei muudeta |
| Õigused | Laoseisu kogust näevad kõik; raha (väärtus, hinnad) ja laokanded ainult finantsjuht ja admin |
| Tarnija | Seotud isikute registrist, uus roll „Tarnija“ (`SUPPLIER`) |
| Arvele võtmise hind | Rea summa ilma käibemaksuta; ühikuhind = summa / kogus |
| Mahakandmise maksumus | FIFO arvutab, kasutaja ei sisesta |
| Ladusid | Mitu. FIFO, laoseis ja väärtus lao kaupa |
| Ülekanne | Võtab lähtelao vanimad partiid, sihtlaos tekib partii sama hinnaga |
| Ülekande piirang | Ei tohi viia lähteladu miinusesse ega võtta hindamata kaupa (muidu jõuaks sihtlattu tundmatu hinnaga kaup); muud väljaminekud tohivad miinusesse |
| Põllutöö kande ladu | Üks ladu kande päises, vaikimisi põhiladu; PRIA import ja ajalugu → põhiladu |
| Lao asukoht | Valikuline seos huvipunktiga (eelistatult liik „Laohoone“); üks huvipunkt = max üks ladu |
| Arvutuse põhimõte | Liikumised salvestatakse; FIFO arvutatakse muudatuse järel materjali kaupa algusest uuesti |
| Kinnitatud kanded | FIFO hinna muutus kirjutab hinna üle, finantsi staatust ei muuda |

## Andmemudel

```prisma
// Ladu; täpselt üks põhiladu ettevõtte kohta
model Warehouse {
  id        String  @id @default(cuid())
  tenantId  String  (nagu teistel)
  name      String
  isDefault Boolean @default(false) // põhiladu
  isActive  Boolean @default(true)
  poiId     String? @unique // asukoht kaardil (huvipunkt)
  notes     String?
  createdAt, updatedAt, createdBy, updatedBy

  poi PointOfInterest? @relation(..., onDelete: SetNull)

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("warehouses")
}
// Põhiladu: osaline unikaalne indeks (tenant_id) WHERE is_default (migratsioonis SQL-ina)

enum StockDocumentKind {
  RECEIPT // arvele võtmine
  WRITE_OFF // mahakandmine
  TRANSFER // ladudevaheline ülekanne
}

enum WriteOffReason {
  SPOILED // riknenud
  INVENTORY // inventuuri vahe
  OTHER // muu (täpsustus märkuses)
}

// Laokanne: arvele võtmine või mahakandmine
model StockDocument {
  id             String            @id @default(cuid())
  tenantId       String            @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id")
  kind           StockDocumentKind
  date           DateTime
  warehouseId    String // RECEIPT: sihtladu; WRITE_OFF ja TRANSFER: lähteladu
  toWarehouseId  String? // ainult TRANSFER: sihtladu (≠ warehouseId)
  supplierId     String? // seotud isik rolliga Tarnija (ainult RECEIPT)
  documentNo     String? // arve / saatelehe number
  writeOffReason WriteOffReason? // ainult WRITE_OFF
  notes          String?
  createdAt, updatedAt, createdBy, updatedBy // nagu teistel tabelitel

  warehouse   Warehouse          @relation("StockDocFrom", ..., onDelete: Restrict)
  toWarehouse Warehouse?         @relation("StockDocTo", ..., onDelete: Restrict)
  supplier    RelatedParty?      @relation(..., onDelete: SetNull)
  lines       StockDocumentLine[]

  @@index([tenantId]) @@index([date]) @@index([supplierId])
  @@index([warehouseId]) @@index([toWarehouseId])
  @@map("stock_documents")
}

model StockDocumentLine {
  id         String   @id @default(cuid())
  tenantId   String   (nagu ülal)
  documentId String
  materialId String
  quantity   Float // laoühikus, > 0
  amount     Decimal? @db.Decimal(12, 2) // rea summa km-ta (RECEIPT)
  fifoCost   Decimal? @db.Decimal(12, 2) // arvutatud maksumus (WRITE_OFF, TRANSFER); null = (osaliselt) hindamata
  sortOrder  Int      @default(0)

  document StockDocument @relation(..., onDelete: Cascade)
  material Material      @relation(..., onDelete: Restrict)

  @@index([documentId]) @@index([materialId]) @@index([tenantId])
  @@map("stock_document_lines")
}
```

`WorkEntry` lisaväli: `warehouseId String?` (ladu, kust kande materjalid
võetakse; tühi = põhiladu; `onDelete: Restrict`).

Laoseisu koondtabel (uuendab ainult ümberarvutus):

```prisma
model MaterialStock {
  tenantId    String (nagu teistel)
  materialId  String
  warehouseId String
  qty         Float   @default(0) // võib olla negatiivne
  value       Decimal @db.Decimal(12, 2) @default(0) // partiide jääk
  unpricedQty Float   @default(0) // hindamata ülekulu

  @@id([materialId, warehouseId])
  @@index([tenantId])
  @@map("material_stock")
}
```

`Material` lisaväli: `stockIssueCount Int @default(0)` arvestusest välja
jäänud read (teisendamatu ühik).

`PartyRole` lisandub `SUPPLIER // "Tarnija"`.

`PointOfInterest` saab vastasseose `warehouse Warehouse?`.

RLS-poliitikad uutele tabelitele samamoodi nagu teistel ettevõtte tabelitel.

## FIFO arvutus

### `fifoReplay(movements)` (puhas funktsioon, `src/server/stockFifo.ts`)

Sisend: ühe materjali liikumised kõigis ladudes
`{ ref, date, warehouseId, direction: 'IN'|'OUT'|'TRANSFER', toWarehouseId?, quantity, amount? }`,
kogused juba laoühikus. Partiid ja võlg hoitakse lao kaupa.

Järjestus: `date` kasvavalt; sama päeva sees enne `IN`, siis `OUT`;
edasi stabiilselt loomise järjekorras.

Algoritm:

- Hoitakse partiide järjekorda `{ qty, unitCost }` ja võla järjekorda
  `{ ref, qty }`.
- `IN`: ühikuhind = `amount / quantity`. Kõigepealt kaetakse võlg
  vanimast alates (iga kaetud osa lisab vastava `ref`-i maksumusele
  `osa × unitCost`), ülejääk läheb partiiks.
- `OUT`: võetakse lao vanimatest partiidest; mis üle jääb, läheb lao
  võlga.
- `TRANSFER`: võetakse lähtelao vanimatest partiidest, iga võetud osa
  läheb sihtlaos partiiks sama ühikuhinnaga (enne katab sihtlao võla).
  Kui lähtelaos ei jätku hinnaga partiisid, tagastab funktsioon vea
  (`TransferShortage`, saadaolev kogus). Serveri salvestus kasutab seda
  valideerimiseks; ümberarvutuses (nt tagantjärele lisatud põllutöö
  kanne, mis enne ülekannet partii ära võttis) märgitakse ülekande rida
  probleemseks ja ülejääk läheb sihtlattu hindamatuna, et ajalugu ei
  murduks.
- Väljund: iga `OUT` `ref`-i kohta `cost` (kokku) ja `unpricedQty`;
  iga lao kohta `qty`, `value` (= partiide jääk), `unpricedQty`
  (= võla jääk).

Väljamineku ühikuhind = `cost / quantity`, kui `unpricedQty = 0`, muidu
hind puudub (rida „ootab arvele võtmist“).

### Ühikute teisendus

Põllutöö kanderea `unit` → materjali `unit`: teisendatavad on `g`, `kg`
ja `t` omavahel (sama teisendusloogika ühes kohas). Muud erinevused
(nt `l` ↔ `kg`) jäävad arvestusest välja ja suurendavad
`stockIssueCount`-i. Live-andmetes on selliseid ridu praegu 2
(kg/l ja kg/g; teine teisendub).

### `recomputeMaterialStock(tx, materialIds)` (`src/server/stock.ts`)

Iga materjali kohta:

1. Laeb liikumised: laokande read ja põllutöö kande `MATERIAL` read
   (`work_entry_lines.materialId`, kuupäev = `work_entries.date`, ladu =
   `work_entries.warehouseId` või põhiladu).
2. Käivitab `fifoReplay`.
3. Kirjutab `work_entry_lines.unitPrice` (laoühiku hind, ümberarvutatud
   kanderea ühikusse), `stock_document_lines.fifoCost`, `material_stock`
   read ja `materials.stockIssueCount`.

Kutsutakse samas tehingus pärast:

- laokande loomist, muutmist, kustutamist (materjalid enne ja pärast);
- põllutöö kande loomist, muutmist (sh lao vahetus), kustutamist ning töö/põllu hooaja
  kustutamist, mis kandeid kaasa viib;
- PRIA põlluraamatu importi (kõik puudutatud materjalid korraga);
- materjali ühiku muutmist.

Ebaõnnestumisel veereb kogu tehing tagasi.

## Kasutajaliides

### Kulumaterjalid (`MaterialsView`)

- Olemasolevad hooaja veerud jäävad.
- Uued veerud: **Laoseis** (tänane, hooajast sõltumatu; miinus punane);
  finantsõigusega **Laoväärtus** (€) ja **Keskm. hind**.
- Lao filter (vaikimisi „Kõik laod“ = summa üle ladude). Valitud laoga
  näidatakse selle lao seisu ja väärtust.
- Hoiatusikoon, kui `unpricedQty > 0` („X ühikut ootab arvele võtmist“)
  või `stockIssueCount > 0` („N kannet ei saa laoühikusse teisendada“).
- Rea klõps avab **laokaardi**: liikumised kuupäeva järjekorras (laokanne
  või põllutöö kanne koos põllu nime ja töö liigiga), ladu, kogus, jooksev
  seis; finantsõigusega maksumus. Sama lao filter. Teisendamatud read on eraldi märgitud.
- CSV eksport: lisaks laoseis, finantsõigusega laoväärtus.

### Laod (register)

- Kulumaterjalide juures, finantsjuhile ja adminile.
- Väljad: nimi, põhiladu (täpselt üks), aktiivne, asukoht (huvipunkt
  rippmenüüst, laohooned eespool), märkus.
- Ladu, millel on liikumisi või kandeid, ei kustutata, ainult
  mitteaktiivseks. Põhiladu ei saa mitteaktiivseks teha.

### Kaart

Laoga seotud huvipunkti hüpikaknas rida „Ladu: <nimi>“ ja link, mis avab
kulumaterjalide nimekirja selle lao filtriga.

### Laokanded (uus vaade)

- Menüüs kulumaterjalide kõrval, nähtav finantsjuhile ja adminile.
- Nimekiri: kuupäev, liik, ladu (ülekandel „A → B“), tarnija või põhjus,
  dokumendi number, ridade arv, summa. Filtrid: liik, ladu, periood,
  tarnija (kõik `FilterClear`-is).
- „Arvele võtmine“ / „Mahakandmine“ / „Ülekanne“ avavad vormi: päis (sh
  ladu; ülekandel lähte- ja sihtladu) + lisatavad read. Materjali valikul
  kuvatakse laoühik ja valitud lao laoseis. Mahakandmisel
  kuvatakse pärast salvestamist arvutatud maksumus.
- Muutmine ja kustutamine (kinnitusega).
- Kuupäevad `DateInput`-iga, vorming pp.kk.aaaa.

### Põllutöö kande dialoog

Päises lao valik (vaikimisi põhiladu; ainult aktiivsed laod). Materjali
valikul näidatakse selle lao laoseisu (ainult kogus). Salvestamist ei
takista.

### Finantsvaade (`FinanceModal`)

Materjaliridade hind pole muudetav; kuvatakse märkega „FIFO laost“ või
„ootab arvele võtmist“. Muude ridade (töö, masin, kütus, saak) käsitsi
hind jääb nagu praegu.

## API

- `GET /api/warehouses` (kõik), `POST/PUT/DELETE /api/warehouses[/:id]`
  (finants)
- `GET /api/stock/documents?kind=&warehouseId=&from=&to=&supplierId=` (finants)
- `GET /api/stock/documents/:id` (finants)
- `POST /api/stock/documents`, `PUT /api/stock/documents/:id`,
  `DELETE /api/stock/documents/:id` (finants)
- `GET /api/stock/materials/:id/movements?warehouseId=` laokaart;
  rahaväljad ainult finantsõigusega
- `GET /api/materials?warehouseId=` tagastab lisaks `stockQty`,
  `unpricedQty`, `stockIssueCount` (valitud lao või kõigi ladude summa);
  finantsõigusega `stockValue`
- `/api/finance/entries/:id` PATCH ignoreerib `MATERIAL` ridade hindu

## Vigade käsitlus

- Laokandel peab olema vähemalt üks rida; kogus > 0; arvele võtmisel
  summa nõutud ja ≥ 0; tarnija ainult arvele võtmisel, põhjus ainult
  mahakandmisel; ülekandel sihtladu nõutud ja ≠ lähteladu.
- Ülekanne, mille kogust lähtelaos kuupäeval hinnaga kaubana pole:
  salvestamine keelatakse, teade „Laos <nimi> on <kuupäev> seisuga
  saadaval X <ühik>“. Sama kontroll ülekande muutmisel ning sellise
  laokande muutmisel/kustutamisel, mis jätaks hilisema ülekande katteta.
- Materjali, millel on laokande ridu, kustutada ei saa (nagu kanderidade
  puhul praegu).
- Materjali ühiku muutmisel, kui olemasolevaid ridu ei saa uude ühikusse
  teisendada, hoiatab vorm enne salvestamist.
- Ümberarvutus samas tehingus; viga = muudatus ei salvestu.

## Testimine

- `stockFifo.test.ts`: FIFO üle mitme partii; ladude eraldatus;
  ülekanne kannab hinna; ülekanne üle saadaoleva → viga; ülekanne katab
  sihtlao võla; sama päeva järjekord;
  miinusseis ja hilisem katmine (võla read saavad hinna); tagantjärele
  lisatud arve muudab varasemate väljaminekute hinda; nullsummaga
  sissetulek; ühikute teisendus; teisendamatu rida.
- Serveritestid: ladude CRUD (üks põhiladu, kustutamise keeld);
  laokande CRUD + ümberarvutus; ülekande valideerimine; kanderea `unitPrice` pärast
  kande salvestamist; õigused (töötaja ei näe raha ega tee laokandeid);
  RLS-isolatsioon uutel tabelitel.

## Juurutamine

1. Prisma migratsioon (tabelid, enumid, materjali ja kande väljad,
   `SUPPLIER` roll, RLS).
2. Igale ettevõttele luuakse ladu „Põhiladu“ (`isDefault`). Olemasolevad
   kanded jäävad `warehouseId = null` → põhiladu.
3. Ühekordne `recomputeMaterialStock` kõigile materjalidele kõigis
   ettevõtetes.
4. Oodatav tulemus: kasutusega materjalid on miinuses ja hindamata, kuni
   arvele võtmised sisestatakse. Käsitsi hindu materjaliridadel praegu
   pole (live: 0), seega midagi üle ei kirjutata.

## Väljaspool ulatust

- Inventuuri vorm (loetud kogus → automaatne vahe). Praegu tehakse
  mahakandmise kandega põhjusega „Inventuuri vahe“.
- Laoseisu miinusesse mineku keelamine (võimalik hiljem lisada).
- Tellimused, tarnijate hinnakirjad.
