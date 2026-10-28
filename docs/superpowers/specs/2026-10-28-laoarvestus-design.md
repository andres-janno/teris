# Kulumaterjalide laoarvestus (disain)

Kuupäev: 2026-10-28
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust

## Eesmärk

1. **Kulumaterjalide nimekiri näitab laoseisu** laoühikutes ja rahas.
2. **Laokannete register.** Ühe või mitme materjali arvele võtmine ja
   mahakandmine ühe kandega.
3. **Põllutööde kanded kannavad materjali laost maha** automaatselt.
4. **Laoväärtus kujuneb FIFO meetodil** ja FIFO maksumus on põllutöö
   kande materjalirea ühikuhind (finantsjuht seda enam käsitsi ei sisesta).

### Mõisted

- **Laokanne** (`stock_documents`): arvele võtmine (`RECEIPT`) või
  mahakandmine (`WRITE_OFF`), ühel kandel mitu rida.
- **Liikumine**: sissetulek (arvele võtmise rida) või väljaminek
  (mahakandmise rida või põllutöö kande materjalirida).
- **Partii**: üks sissetulek oma ühikuhinnaga; FIFO võtab väljaminekud
  vanimast partiist.
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
| Ladusid | Üks (ettevõtte kohta) |
| Arvutuse põhimõte | Liikumised salvestatakse; FIFO arvutatakse muudatuse järel materjali kaupa algusest uuesti |
| Kinnitatud kanded | FIFO hinna muutus kirjutab hinna üle, finantsi staatust ei muuda |

## Andmemudel

```prisma
enum StockDocumentKind {
  RECEIPT // arvele võtmine
  WRITE_OFF // mahakandmine
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
  supplierId     String? // seotud isik rolliga Tarnija (ainult RECEIPT)
  documentNo     String? // arve / saatelehe number
  writeOffReason WriteOffReason? // ainult WRITE_OFF
  notes          String?
  createdAt, updatedAt, createdBy, updatedBy // nagu teistel tabelitel

  supplier RelatedParty?        @relation(..., onDelete: SetNull)
  lines    StockDocumentLine[]

  @@index([tenantId]) @@index([date]) @@index([supplierId])
  @@map("stock_documents")
}

model StockDocumentLine {
  id         String   @id @default(cuid())
  tenantId   String   (nagu ülal)
  documentId String
  materialId String
  quantity   Float // laoühikus, > 0
  amount     Decimal? @db.Decimal(12, 2) // rea summa km-ta (RECEIPT)
  fifoCost   Decimal? @db.Decimal(12, 2) // arvutatud maksumus (WRITE_OFF); null = (osaliselt) hindamata
  sortOrder  Int      @default(0)

  document StockDocument @relation(..., onDelete: Cascade)
  material Material      @relation(..., onDelete: Restrict)

  @@index([documentId]) @@index([materialId]) @@index([tenantId])
  @@map("stock_document_lines")
}
```

`Material` lisaväljad (koondseis, uuendab ainult ümberarvutus):

- `stockQty Float @default(0)` laoseis laoühikus (võib olla negatiivne)
- `stockValue Decimal @db.Decimal(12,2) @default(0)` laos olevate partiide väärtus
- `unpricedQty Float @default(0)` hindamata ülekulu kogus
- `stockIssueCount Int @default(0)` arvestusest välja jäänud read (teisendamatu ühik)

`PartyRole` lisandub `SUPPLIER // "Tarnija"`.

RLS-poliitikad uutele tabelitele samamoodi nagu teistel ettevõtte tabelitel.

## FIFO arvutus

### `fifoReplay(movements)` (puhas funktsioon, `src/server/stockFifo.ts`)

Sisend: ühe materjali liikumised
`{ ref, date, direction: 'IN'|'OUT', quantity, amount? }`, kogused
juba laoühikus.

Järjestus: `date` kasvavalt; sama päeva sees enne `IN`, siis `OUT`;
edasi stabiilselt loomise järjekorras.

Algoritm:

- Hoitakse partiide järjekorda `{ qty, unitCost }` ja võla järjekorda
  `{ ref, qty }`.
- `IN`: ühikuhind = `amount / quantity`. Kõigepealt kaetakse võlg
  vanimast alates (iga kaetud osa lisab vastava `ref`-i maksumusele
  `osa × unitCost`), ülejääk läheb partiiks.
- `OUT`: võetakse vanimatest partiidest; mis üle jääb, läheb võlga.
- Väljund: iga `OUT` `ref`-i kohta `cost` (kokku) ja `unpricedQty`;
  materjali kohta `stockQty` (= sissetulekud − väljaminekud), `stockValue`
  (= partiide jääk), `unpricedQty` (= võla jääk).

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
   (`work_entry_lines.materialId`, kuupäev = `work_entries.date`).
2. Käivitab `fifoReplay`.
3. Kirjutab `work_entry_lines.unitPrice` (laoühiku hind, ümberarvutatud
   kanderea ühikusse), `stock_document_lines.fifoCost` ja materjali
   koondväljad.

Kutsutakse samas tehingus pärast:

- laokande loomist, muutmist, kustutamist (materjalid enne ja pärast);
- põllutöö kande loomist, muutmist, kustutamist ning töö/põllu hooaja
  kustutamist, mis kandeid kaasa viib;
- PRIA põlluraamatu importi (kõik puudutatud materjalid korraga);
- materjali ühiku muutmist.

Ebaõnnestumisel veereb kogu tehing tagasi.

## Kasutajaliides

### Kulumaterjalid (`MaterialsView`)

- Olemasolevad hooaja veerud jäävad.
- Uued veerud: **Laoseis** (tänane, hooajast sõltumatu; miinus punane);
  finantsõigusega **Laoväärtus** (€) ja **Keskm. hind**.
- Hoiatusikoon, kui `unpricedQty > 0` („X ühikut ootab arvele võtmist“)
  või `stockIssueCount > 0` („N kannet ei saa laoühikusse teisendada“).
- Rea klõps avab **laokaardi**: liikumised kuupäeva järjekorras (laokanne
  või põllutöö kanne koos põllu nime ja töö liigiga), kogus, jooksev seis;
  finantsõigusega maksumus. Teisendamatud read on eraldi märgitud.
- CSV eksport: lisaks laoseis, finantsõigusega laoväärtus.

### Laokanded (uus vaade)

- Menüüs kulumaterjalide kõrval, nähtav finantsjuhile ja adminile.
- Nimekiri: kuupäev, liik, tarnija või põhjus, dokumendi number, ridade
  arv, summa. Filtrid: liik, periood, tarnija (kõik `FilterClear`-is).
- „Arvele võtmine“ / „Mahakandmine“ avavad vormi: päis + lisatavad read.
  Materjali valikul kuvatakse laoühik ja laoseis. Mahakandmisel
  kuvatakse pärast salvestamist arvutatud maksumus.
- Muutmine ja kustutamine (kinnitusega).
- Kuupäevad `DateInput`-iga, vorming pp.kk.aaaa.

### Põllutöö kande dialoog

Materjali valikul näidatakse laoseisu (ainult kogus). Salvestamist ei
takista.

### Finantsvaade (`FinanceModal`)

Materjaliridade hind pole muudetav; kuvatakse märkega „FIFO laost“ või
„ootab arvele võtmist“. Muude ridade (töö, masin, kütus, saak) käsitsi
hind jääb nagu praegu.

## API

- `GET /api/stock/documents?kind=&from=&to=&supplierId=` (finants)
- `GET /api/stock/documents/:id` (finants)
- `POST /api/stock/documents`, `PUT /api/stock/documents/:id`,
  `DELETE /api/stock/documents/:id` (finants)
- `GET /api/stock/materials/:id/movements` laokaart; rahaväljad ainult
  finantsõigusega
- `GET /api/materials` tagastab lisaks `stockQty`, `unpricedQty`,
  `stockIssueCount`; finantsõigusega `stockValue`
- `/api/finance/entries/:id` PATCH ignoreerib `MATERIAL` ridade hindu

## Vigade käsitlus

- Laokandel peab olema vähemalt üks rida; kogus > 0; arvele võtmisel
  summa nõutud ja ≥ 0; tarnija ainult arvele võtmisel, põhjus ainult
  mahakandmisel.
- Materjali, millel on laokande ridu, kustutada ei saa (nagu kanderidade
  puhul praegu).
- Materjali ühiku muutmisel, kui olemasolevaid ridu ei saa uude ühikusse
  teisendada, hoiatab vorm enne salvestamist.
- Ümberarvutus samas tehingus; viga = muudatus ei salvestu.

## Testimine

- `stockFifo.test.ts`: FIFO üle mitme partii; sama päeva järjekord;
  miinusseis ja hilisem katmine (võla read saavad hinna); tagantjärele
  lisatud arve muudab varasemate väljaminekute hinda; nullsummaga
  sissetulek; ühikute teisendus; teisendamatu rida.
- Serveritestid: laokande CRUD + ümberarvutus; kanderea `unitPrice` pärast
  kande salvestamist; õigused (töötaja ei näe raha ega tee laokandeid);
  RLS-isolatsioon uutel tabelitel.

## Juurutamine

1. Prisma migratsioon (tabelid, enumid, materjali väljad, `SUPPLIER`
   roll, RLS).
2. Ühekordne `recomputeMaterialStock` kõigile materjalidele kõigis
   ettevõtetes.
3. Oodatav tulemus: kasutusega materjalid on miinuses ja hindamata, kuni
   arvele võtmised sisestatakse. Käsitsi hindu materjaliridadel praegu
   pole (live: 0), seega midagi üle ei kirjutata.

## Väljaspool ulatust

- Mitu ladu, ladudevahelised liikumised.
- Inventuuri vorm (loetud kogus → automaatne vahe). Praegu tehakse
  mahakandmise kandega põhjusega „Inventuuri vahe“.
- Laoseisu miinusesse mineku keelamine (võimalik hiljem lisada).
- Tellimused, tarnijate hinnakirjad.
