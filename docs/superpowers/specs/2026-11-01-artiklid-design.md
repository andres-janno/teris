# Artiklid, teenused, inventuur ja saagipartiid (disain)

Kuupäev: 2026-11-01
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust
Eelmine samm: [2026-10-28-laoarvestus-design.md](2026-10-28-laoarvestus-design.md)

## Eesmärk

1. **Kulumaterjalide register muutub universaalseks artiklite registriks.**
   Artikkel on teenus (maksumuse arvestus) või kaup (laoarvestus +
   maksumuse arvestus). Menüüpunkt „Kulumaterjalid“ → **„Laoarvestus“**,
   vahekaart „Materjalid“ → **„Artiklid“**.
2. **Tööaeg on teenus.** Töötaja, masina ja haakeriista tunnid seotakse
   teenusartikliga ja saavad hinna automaatselt.
3. **Kütus on kaup.** Kande kütuserida kantakse laost maha FIFO hinnaga.
4. **Inventuur.** Sisestatakse tegelik seis, süsteem kannab vahe maha või
   võtab juurde.
5. **Saagipartiid.** Koristuskandelt tulevad punkrid; partii kaalumised
   võtavad toodangu lattu; partii sulgemisel arvutatakse punkri kaal ja
   kannete tonnid tagasi. Partii kuivatuskulud jaotatakse põldudele.

Teostus neljas järjestikuses osas, iga osa läheb eraldi live'i:
**1** artiklite register → **2** teenused ja kütus kandel → **3** inventuur →
**4** saagipartiid.

## Otsused

| Teema | Otsus |
|---|---|
| Nimetamine koodis | Päris ümbernimetamine: `Material` → `Article`, `materials` → `articles`, `materialId` → `articleId`, `MaterialStock` → `ArticleStock` jne. Andmed jäävad alles (käsitsi SQL enne `db push`-i) |
| Liigitus | Tüüp (teenus/kaup) tuleneb rühmast; rühm on koodis fikseeritud; liigid on tabel, kus süsteemsed liigid luuakse automaatselt ja kasutaja lisab juurde |
| Teenuse detailsus | Üldine teenusartikkel; masin, haakeriist ja töötaja võivad viidata teisele teenusartiklile ja/või omada oma tunnihinda |
| Teenuse hind ajas | Üks kehtiv hind, kehtivusaega pole. Kanderea hind on salvestatud ja ei muutu artikli hinna muutmisel |
| Kütus | Kaup, kantakse laost maha FIFO-ga; ka ajaloolised kütuseread (käsitsi hinnad asenduvad FIFO-ga) |
| Kütuse ladu | Kütuseartikli vaikimisi ladu (artikli väli, sobib ka teistele kaupadele) |
| Inventuur | Osaline; tühi lahter = rida ei arvestata, 0 = kogu seis maha |
| Inventuuri ülejäägi hind | Lao keskmine hind (väärtus / hinnatud kogus); puudumisel artikli viimase arvelevõtu hind |
| Inventuuri püsivus | Salvestatakse tegelik seis, vahe arvutatakse ümberarvutusel; tagantjärele kanne enne inventuuri kuupäeva muudab vahet, mitte inventuuri seisu |
| Toodangu hind | Hinnata (ainult kogus). Omahind on hilisem eraldi töö |
| Saagipartii | Vabalt loodav; vaikimisi kultuuri ja hooaja viimane lahtine partii, puudumisel luuakse automaatselt |
| Punkri kaal | Arvutatakse ainult partii sulgemisel; sama kaal kõigile lukustamata kannetele |
| Kuivatuskulu | Partii kuluread (teenus ja/või kaup), jaotatakse põldudele punkrite osakaalu järgi |
| PRIA ajaloolised koristuskanded | Jäävad käsitsi tonnidega, partiita, lattu ei lähe |
| Landing-lehe kaart „Kuluarvestus“ | Jääb muutmata |
| Finantsakna pealkiri „Põllutööde finantsid ja kuluarvestus“ | Jääb muutmata |

## Mõisted

- **Artikkel** (`articles`): teenus või kaup.
- **Rühm** (`ArticleGroup`, koodis): `SERVICE` (teenus), `CONSUMABLE`
  (kulumaterjal), `PRODUCE` (toodang), `OTHER_GOODS` (muu kaup). Tüüp on
  teenus ainult rühmal `SERVICE`, muud on kaubad.
- **Liik** (`article_categories`): rühma alamliik. Süsteemsel liigil on
  `systemKind`, mille järgi loogika käitub; kasutaja loodud liigil on
  `systemKind = null`.
- **Laoarvestusega artikkel**: iga kaup. Teenus ei osale laoseisus,
  laokannetes ega inventuuris.

## Osa 1 — artiklite register

### Andmemudel

```prisma
enum ArticleGroup {
  SERVICE // teenus — laoarvestust pole
  CONSUMABLE // kulumaterjal
  PRODUCE // toodang
  OTHER_GOODS // muu kaup
}

// Süsteemne liik: loogika käitub selle järgi. Kasutaja loodud liigil null.
enum ArticleSystemKind {
  LABOR_TIME // töötaja tööaeg
  MACHINE_TIME // masina tööaeg
  IMPLEMENT_TIME // haakeriista tööaeg
  DRYING_TIME // kuivatamise tööaeg
  SEED // seeme: sort, PRIA
  FERTILIZER // väetis: NPK, PRIA
  PLANT_PROTECTION // taimekaitsevahend: toimeaine, PRIA
  FUEL // kütus: masina vaikimisi kütus
  DRYING_OIL // kuivatusõli
  GRAIN // terad: kultuur, saagipartii
}

model ArticleCategory {
  id         String             @id @default(cuid())
  tenantId   String             (nagu teistel)
  name       String
  group      ArticleGroup
  systemKind ArticleSystemKind? // süsteemne liik; ei saa kustutada
  sortOrder  Int                @default(0)
  isActive   Boolean            @default(true)
  (createdAt, updatedAt, createdBy, updatedBy)

  articles Article[]

  @@unique([tenantId, name])
  @@unique([tenantId, systemKind]) // iga süsteemne liik üks kord
  @@map("article_categories")
}

model Article { // endine Material
  ... praegused väljad (category enum eemaldatakse) ...
  categoryId         String   // liik
  price              Decimal? @db.Decimal(12, 4) // ainult teenusel: ühiku (tunni) hind
  isDefaultService   Boolean  @default(false) // tööaja liigi vaikimisi teenusartikkel (osa 2)
  cropId             String?  // ainult GRAIN: kultuur
  defaultWarehouseId String?  // ainult kaubal: vaikimisi ladu (osa 2, kütus)

  @@unique([tenantId, categoryId, name])
  @@map("articles")
}
```

Süsteemsed liigid luuakse igale ettevõttele (olemasolevatele migratsiooniga,
uutele ettevõtte loomisel): *Töötaja tööaeg, Masina tööaeg, Haakeriista
tööaeg, Kuivatamise tööaeg* (teenus); *Seeme, Väetis, Taimekaitsevahend,
Kütus, Kuivatusõli* (kulumaterjal); *Terad* (toodang). Süsteemset liiki saab
ümber nimetada, mitte kustutada ega teise rühma viia. Kasutaja loodud liiki
saab kustutada ainult siis, kui sellel pole artikleid.

### Ümbernimetamine

| Praegu | Uus |
|---|---|
| `Material` / `materials` | `Article` / `articles` |
| `MaterialStock` / `material_stock` | `ArticleStock` / `article_stock` |
| `materialId` (`work_entry_lines`, `field_work_lines`, `stock_document_lines`, `material_stock`) | `articleId` |
| `MaterialCategory` enum | eemaldatakse (asendub `categoryId`-ga) |
| menüü „Kulumaterjalid“, `mainView` `materials` | „Laoarvestus“, `stock` |
| vahekaart „Materjalid“ | „Artiklid“ |
| API `/api/materials` | `/api/articles` |
| AI-ühenduse tööriistad ja kirjeldused, mis räägivad materjalidest | artiklid; kulumaterjalide kohta käivad kirjeldused jäävad sisuliselt samaks |

Muutmata jäävad: `WorkEntryLineKind.MATERIAL` (kandel on see ikka
kulumaterjali rida), `WorkType.usesMaterials` (kandes küsitakse
kulumaterjale), `StockDocumentKind` olemasolevad väärtused.

### Migratsioon

1. Varukoopia (`pg_dump` `PLATFORM_DATABASE_URL`-iga).
2. Käsitsi SQL: tabelite ja veergude ümbernimetamine (`ALTER TABLE ...
   RENAME`), indeksite ja välisvõtmete nimed vastavaks; RLS-poliitikad
   järgnevad tabelile.
3. `article_categories` luuakse, igale ettevõttele süsteemsed liigid ning
   kasutaja liik „Muu kulumaterjal“ (`CONSUMABLE`).
4. `categoryId` täidetakse: `SEED` → Seeme, `FERTILIZER` → Väetis,
   `PLANT_PROTECTION` → Taimekaitsevahend, `OTHER` → Muu kulumaterjal.
5. `db push` (eeldatavalt ilma andmekaota; kui küsib `--accept-data-loss`,
   peatu ja kontrolli).

### Kasutajaliides

- Artiklite nimekiri: filter rühma ja liigi järgi (`FilterClear`), nupp
  „Liigid“ (liikide haldus: nimi, rühm, järjekord, aktiivne).
- Artikli vorm: liigi valik; väljad sõltuvad liigist (teenus → hind, ühik
  vaikimisi `h`; seeme → sort ja PRIA; väetis → NPK; taimekaitse →
  toimeaine; terad → kultuur; kaup → vaikimisi ladu).
- Teenusel laoseisu veerge ei näidata.
- Laokande, inventuuri ja põllutöö kande kulumaterjali valikus ainult
  kaubad (põllutöö kandel ainult rühm `CONSUMABLE`).

## Osa 2 — teenused ja kütus kandel

### Andmemudel

```prisma
model Vehicle {
  serviceArticleId String?  // masina tööaja teenus, kui erineb vaikimisi omast
  hourlyRate       Decimal? @db.Decimal(12, 4) // oma tunnihind
  fuelArticleId    String?  // vaikimisi kütus (liik FUEL)
}
model Implement {
  serviceArticleId String?
  hourlyRate       Decimal? @db.Decimal(12, 4)
}
model RelatedParty { // töötaja
  serviceArticleId String?
  hourlyRate       Decimal? @db.Decimal(12, 4)
}
model WorkEntryLine {
  articleId String? // LABOR/MACHINE/IMPLEMENT: teenus; FUEL/MATERIAL: kaup
}
```

Igal tööaja süsteemsel liigil (`LABOR_TIME`, `MACHINE_TIME`,
`IMPLEMENT_TIME`, `DRYING_TIME`) on täpselt üks vaikimisi teenusartikkel
(`isDefaultService`). Ainulisus tagatakse rakenduses nagu põhilaol.

### Teenuse rea hind

`buildEntryLines` paneb tööaja reale `articleId` = ressursi teenusartikkel
või liigi vaikimisi teenusartikkel. Hind leitakse järjekorras:

1. ressursi `hourlyRate`
2. ressursi teenusartikli `price`
3. vaikimisi teenusartikli `price`
4. tühi (finantsjuht täidab)

Hind kirjutatakse reale **ainult siis, kui rea `unitPrice` on tühi**.
Täidetud hinda (finantsjuhi sisestatud või varem automaatselt pandud) ei
kirjutata üle; artikli või ressursi hinna muutus ei puuduta olemasolevaid
ridu.

### Kütuse rida

- `articleId` = masina `fuelArticleId`; puudumisel ettevõtte ainus aktiivne
  `FUEL` liigi artikkel; mitme või null korral jääb tühjaks.
- Kütuserida kantakse maha **kütuseartikli vaikimisi laost**; kui see on
  määramata, siis kande laost.
- FIFO ümberarvutus (`src/server/stock.ts`) käsitleb `FUEL` rida nagu
  `MATERIAL` rida: väljaminek, `unitPrice` = FIFO ühikuhind.
- Artiklita kütuserida: kanne pole kinnitatav, finantsaknas põhjus
  „Kütuse artikkel määramata“.

### Migratsioon

- Luuakse vaikimisi teenusartiklid „Töötaja tööaeg“, „Masina tööaeg“,
  „Haakeriista tööaeg“, „Kuivatamise tööaeg“ (hind tühi).
- Olemasolevad `LABOR`/`MACHINE`/`IMPLEMENT` read saavad vaikimisi
  teenusartikli; hinnad jäävad samaks.
- Luuakse kütuseartikkel „Diislikütus“ (vaikimisi ladu = põhiladu),
  määratakse kõigi masinate `fuelArticleId`-ks ja kõigi `FUEL` ridade
  `articleId`-ks. Ümberarvutus kirjutab nende hinnad FIFO-ga üle
  (alguses miinus ja hindamata, kuni arvelevõtt katab).

### Kasutajaliides

- Masina, haakeriista ja töötaja vormil: teenus (valikuline), oma tunnihind
  (valikuline, näidatakse ainult finantsõigusega), masinal vaikimisi kütus.
- Töötaja kande vorm ei muutu.

## Osa 3 — inventuur

### Andmemudel

```prisma
enum StockDocumentKind {
  RECEIPT
  WRITE_OFF
  TRANSFER
  INVENTORY // inventuur
}
enum WriteOffReason {
  SPOILED
  INVENTORY // ainult vanadel kannetel; uutel ei pakuta
  SOLD // müük (osa 4)
  OTHER
}
model StockDocumentLine {
  countedQty Float? // INVENTORY: tegelik seis; 0 = kõik maha
  diffQty    Float? // INVENTORY: arvutatud vahe (+ juurde, − maha); kirjutab ümberarvutus
  // quantity: INVENTORY puhul |diffQty| (ümberarvutuse järel)
  // amount: INVENTORY ülejäägi väärtus; fifoCost: puudujäägi väärtus
}
```

`warehouseId` = inventeeritav ladu.

### Arvutus

FIFO ümberarvutus käib artikli kaupa ajas edasi. Kui jõutakse
inventuuri reani:

1. arvestuslik seis selles laos sel hetkel (sama kuupäeva liikumised enne
   inventuuri; inventuur on päeva viimane liikumine);
2. `diffQty = countedQty − arvestuslik seis`;
3. `diffQty < 0` → väljaminek FIFO järgi (`fifoCost`);
4. `diffQty > 0` → sissetulek hinnaga = lao hinnatud partiide väärtus /
   hinnatud kogus; kui hinnatud kogust pole, artikli viimase arvelevõtu
   ühikuhind; kui sedagi pole, hindamata;
5. `diffQty = 0` → liikumist pole.

Tagantjärele salvestatud liikumine, mis jääb samasse lattu enne mõne
inventuuri kuupäeva, muudab selle inventuuri vahet. Salvestamisel näitab
kasutajaliides hoiatust: „See kanne muudab inventuuri pp.kk.aaaa vahet“.

### Kasutajaliides

- Laokannete vahekaardil uus liik „Inventuur“: ladu + kuupäev.
- Vorm näitab selle lao kaupu (artiklid, millel on laos liikumisi või
  seis ≠ 0) arvestusliku seisuga valitud kuupäeval; tegelik seis on
  sisestusväli. **Tühi = rida ei salvestata; 0 = salvestatakse.**
- Real näha vahe ja eeldatav väärtus; kokkuvõttes puudujäägi ja ülejäägi
  summa.
- Artikli lisamine, mida nimekirjas pole (näiteks leitud kaup).

## Osa 4 — saagipartiid

### Andmemudel

```prisma
enum HarvestLotStatus {
  OPEN
  CLOSED
}

model HarvestLot {
  id          String           @id @default(cuid())
  tenantId    String           (nagu teistel)
  name        String           // "Talinisu 2026"
  seasonId    Int
  cropId      String
  articleId   String           // toodanguartikkel (liik GRAIN)
  warehouseId String           // hoidla
  status      HarvestLotStatus @default(OPEN)
  bunkerTonnes Float?          // arvutatud punkri kaal; täitub sulgemisel
  closedAt    DateTime?
  notes       String?
  (createdAt, updatedAt, createdBy, updatedBy)

  entries   WorkEntry[]
  weighings HarvestLotWeighing[]
  costs     HarvestLotCost[]

  @@unique([tenantId, name])
  @@map("harvest_lots")
}

// Kaalumine = toodangu arvelevõtt hoidlasse (hinnata)
model HarvestLotWeighing {
  id     String   @id @default(cuid())
  tenantId, lotId
  date   DateTime
  tonnes Float
  notes  String?
  @@map("harvest_lot_weighings")
}

// Kuivatuskulu: teenus (tunnid) või kaup (laost maha FIFO-ga)
model HarvestLotCost {
  id        String   @id @default(cuid())
  tenantId, lotId
  date      DateTime
  articleId String
  quantity  Float
  unitPrice Decimal? @db.Decimal(12, 4) // teenusel artiklist, kaubal FIFO
  notes     String?
  @@map("harvest_lot_costs")
}

model WorkEntry {
  harvestLotId        String?
  harvestTonnesManual Boolean @default(false) // tonnid lukustatud, jaotusest väljas
}
```

### Voog

1. **Koristuskanne** (töö liik, mis loob saagirea): töötaja sisestab
   punkrid. Kanne seotakse selle hooaja ja kultuuri viimase lahtise
   partiiga; kui seda pole, luuakse partii „‹kultuur› ‹aasta›“ (ladu =
   põhiladu; artikkel = kultuuri teraartikkel, puudumisel luuakse
   „‹kultuur› terad“). Mitme lahtise partii korral saab kandel valida.
   Saagirea kogus on 0 ja kandel näidatakse „kaalumata“, kuni partii on
   suletud või tonnid on käsitsi lukustatud.
2. **Kaalumine**: iga kaalumine on toodanguartikli sissetulek partii
   hoidlas kaalumise kuupäeval, hinnata. Osaleb FIFO ümberarvutuses
   sissetulekuna (nagu arvelevõtt ilma summata).
3. **Sulgemine**:
   `bunkerTonnes = (Σ kaalumised − Σ lukustatud kannete tonnid) / Σ lukustamata kannete punkrid`.
   Iga lukustamata kande saagirida: kogus = punkrid × `bunkerTonnes`,
   `ratePerHa` = kogus / pindala. Kinnitatud kanne, mille kogus muutub, →
   `CHANGED` (olemasolev `mergeLines` loogika). Kui lukustamata punkreid
   on 0 või tulemus negatiivne, sulgemine keelatakse veateatega.
4. **Uuesti avamine**: `bunkerTonnes` tühjendatakse, kannete tonnid jäävad
   alles kuni järgmise sulgemiseni (siis arvutatakse kõik uuesti).
   Lahtisesse partiisse saab lisada kandeid ja kaalumisi; suletud partiisse
   mitte.
5. **Kuivatuskulud**: teenuse rida saab hinna teenusartiklist (sama
   järjekord nagu osas 2, ressursi samm jääb vahele); kauba rida on
   väljaminek artikli vaikimisi laost FIFO hinnaga. Põllu kulu =
   partii kulu × põllu kannete punkrid / partii punkrid (lukustatud
   kannete osakaal tonnide järgi: tonnid / `bunkerTonnes`). Finantsaknas
   eraldi rida „Kuivatamine (‹partii›)“; arvutatakse lugemisel, ei
   kopeerita kanderidadele.

### PRIA ja ajalugu

PRIA impordist tulnud koristuskanded: `harvestLotId = null`,
`harvestTonnesManual = true`, tonnid jäävad, lattu ei lähe. PRIA eksport
kasutab saagirea tonne nagu praegu.

### Kasutajaliides

- Laoarvestuses uus vahekaart „Saagipartiid“: nimekiri (kultuur, hooaeg,
  punkrid, kaalutud t, punkri kaal, staatus), partii vaade kannete,
  kaalumiste ja kuludega, nupud „Sulge partii“ / „Ava uuesti“.
- Koristuskande vormil: punkrid, partii valik (ainult mitme lahtise korral),
  „Sisesta tonnid käsitsi“ (lukustab).

## Väljaspool ulatust

- Toodangu omahind ja toodangu hindamine.
- Jahu jt töödeldud toodangu tootmine (sisend → väljund).
- Teenuse hinna kehtivusajad.
- Hooaja keskel ajutine punkri kaal (hinnanguline saak enne kaalumist).
- Puudujäägiga ülekande sihtlao partii hinnastamine (eelmisest tööst
  pooleli).

## Testimine

- Puhtad funktsioonid (nagu laoarvestuses): liigi ja välja reeglid,
  teenuse hinna valik, kütuseartikli ja lao valik, inventuuri vahe ja
  ülejäägi hind (sh 0 vs tühi, tagantjärele kanne enne inventuuri),
  punkri kaalu jaotus (lukustatud kanded, uuesti avamine, null punkrit),
  kuivatuskulu jaotus põldudele.
- Iga osa järel käsitsi kontroll live'is pärast release'i.
