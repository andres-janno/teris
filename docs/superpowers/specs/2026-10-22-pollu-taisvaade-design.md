# Põllu täisvaade ja PRIA põlluraamatu ühtlustamine Terise kannetega (disain)

Kuupäev: 2026-10-22
Staatus: kinnitatud vestluses, ootab spetsifikatsiooni ülevaatust

## Eesmärk

1. **Terise kanded on põlluraamatu tõeallikas.** Kandel on olemas kõik PRIA
   e-põlluraamatu kohustuslikud väljad, et hiljem saaks Terisest PRIA-le
   sobiva väljavõtte teha ilma topeltsisestuseta.
2. **PRIA import täiendab, ei kirjuta üle.** e-PRIA "Põlluraamatu väljavõte"
   (`.xls`) seotakse olemasolevate Terise kannetega; puuduvad luuakse.
   Terises sisestatut (töötaja, masin, kogused, finants) import ei muuda.
3. **Uus põllu täisvaade** asendab praeguse põllu popup'i
   (`FieldDetailsDrawer`): üldandmed + ühtne põllutööde ajajoon koos
   PRIA vastavuse märkidega.

Muudab 2026-09-24 disaini põhimõtet "põlluraamatu andmeid ei sisestata
rakenduses käsitsi — ainus allikas on import": nüüdsest on allikas Terise
kanne, PRIA import on täiendus ja kontroll.

### Prototüüp

Kood tehakse kohe kõigile põldudele (väljavõtte formaat on kontrollitud
ühesugune: 2025 ja 2026 failides 31 lehte, sama päis ja tegevuste tabel).
Esmane üleviimine (vt "Esmane üleviimine") käivitatakse esmalt ainult
Loisu-Agro põllule **nr 10** (massiiv 60944386810), hooajad 2025 ja 2026.
Pärast ülevaatust laseb sama skript läbi ülejäänud põllud ja ettevõtted.

## Lähteolukord

- PRIA väljavõtte import on olemas: `FieldBookUploadModal` →
  `fieldBookWorkbook.ts` → `fieldBookParser.ts` → `fieldBookImport.ts` →
  `POST /api/field-operations/import`. Kirjutab `field_operations` +
  `field_operation_products` (põllu-hooaja read kustutatakse ja luuakse uuesti).
- Popup'i parem veerg (`FieldOperationsSection`) näitab ainult PRIA ridu.
- Terise põllutööd (`field_works` → `work_entries` → `work_entry_lines`) on
  PRIA-st täiesti lahus. Andmebaasis 2026-10-22: Loisu-Agro 7 kannet,
  1 kulumaterjal; PRIA tegevusi Loisu-Agro 2025: 325, 2026: 221; teistel
  ettevõtetel 332 (2026) ja 325 (2025).
- Töötüübid (kõigil kolmel ettevõttel samad 14): Kõrrekoorimine, Künd,
  Kivikoristus, Randaalimine, Libistamine, Rullimine, Umbrohutõrje (enne
  külvi), Külv, Väetamine, Taimekaitse, Leheväetamine, Umbrohutõrje, Seire,
  Koristus.

## 1. Andmemudel

### 1.1 Töötüübid = PRIA klassifikaator

`work_types` asendatakse PRIA e-põlluraamatu 29 tegevusega üks-ühele.

Uus väli:

```prisma
model WorkType {
  // ...
  priaCode String? // PRIA tegevuse nimi klassifikaatoris, nt "Taimekaitsevahendi kasutamine"
  @@unique([tenantId, priaCode])
}
```

`name` = PRIA nimi. Faas (`phase`) ja kordumine (`repeatMode`, `maxRepeats`,
`intervalDays`) saavad vaikeväärtused allolevast tabelist; registris
muudetavad. `usesMaterials = true` tegevustel, millel PRIA-s on materjalide
tabel.

| PRIA tegevus | Faas | Kordumine | Materjalid |
|---|---|---|---|
| Kündmine, Kultiveerimine, Libistamine, Randaalimine, Rullimine, Sügavkobestamine, Vagude moodustamine, Äestamine, Freesimine, Kivikorjamine | PREPARATION | UP_TO | ei |
| Külvamine/istutamine | SOWING | UP_TO | jah (seeme, puhis) |
| Väetamine | CARE | UP_TO | jah |
| Lupjamine | PREPARATION | UP_TO | jah |
| Taimekaitsevahendi kasutamine | CARE | UP_TO | jah |
| Seire | CARE | UP_TO | ei (leiud) |
| Vaheltharimine, Leegitamine, Istandike hooldus, Kastmine, Purustusniide (hekseldamine), Niitmine, Kaarutamine, Vaalutamine, Karjatamine, Maaparandushoiutööd, Sõnniku aunastamine, Mullaproovi võtmine | CARE | UP_TO | ei |
| Saagikoristus, Saagi vedu põllult | HARVEST | UP_TO | ei |

`maxRepeats` vaikimisi tühi (piiranguta).

**Migratsioon** (skript `scripts/pria-work-types.mts`, kõigile ettevõtetele,
ühes transaktsioonis ettevõtte kohta):

| Vana | Uus PRIA tegevus |
|---|---|
| Kõrrekoorimine | Randaalimine |
| Künd | Kündmine |
| Kivikoristus | Kivikorjamine |
| Randaalimine | Randaalimine |
| Libistamine | Libistamine |
| Rullimine | Rullimine |
| Umbrohutõrje (enne külvi), Umbrohutõrje, Taimekaitse | Taimekaitsevahendi kasutamine |
| Külv | Külvamine/istutamine |
| Väetamine, Leheväetamine | Väetamine |
| Seire | Seire |
| Koristus | Saagikoristus |

Sammud:

1. Luua puuduvad PRIA töötüübid (29).
2. Iga vana tüübi `field_works` tõsta uuele tüübile. Kuna `field_works` on
   unikaalne `(fieldSeasonId, workTypeId)`, liidetakse kokkulangevad:
   kanded tõstetakse ellujääva `field_works` alla, `plannedCount` summeeritakse,
   `status` arvutatakse uuesti (`syncFieldWorkStatus`), `notes` liidetakse.
   Leheväetamise kannetel `method = "Pritsimine"`.
3. Mallide read (`work_template_items`) tõsta samuti; duplikaadid liita
   (`plannedCount` summa).
4. Vanad, nüüd kasutuseta tüübid kustutada.

Skript on idempotentne (korduval käivitamisel muudatusi ei tee) ja trükib
kokkuvõtte ettevõtte kaupa.

### 1.2 Kanne (`work_entries`)

```prisma
enum WorkEntrySource {
  MANUAL      // sisestatud Terises
  PRIA_IMPORT // loodud PRIA väljavõtte impordist
}

model WorkEntry {
  // ...
  dateTo DateTime?        // vahemiku lõpp (PRIA "27.04.2026 - 30.04.2026"); tühi = üks päev
  method String?          // väetamisviis jms: "Paisklaotamine", "Pritsimine", "Sisestuslaotamine", "Pindlaotamine"
  source WorkEntrySource @default(MANUAL)
}
```

- PRIA "Teostaja" (taimekaitse, mullaproov) = olemasolev `workerId`.
- PRIA "Märkused" = olemasolev `notes`.
- PRIA "Pindala" = olemasolev `areaHa`.

### 1.3 Kande read (`work_entry_lines`)

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
  ratePerHa        Float?  // kogus ha kohta (ühik = unit + "/ha")
  nKgHa            Float?
  pKgHa            Float?
  kKgHa            Float?
}
```

- MATERIAL rida: `quantity` = kogus kokku, `ratePerHa` = kogus ha kohta.
  Kehtib PRIA reegel `quantity = ratePerHa × areaHa` (2 komakohta); kui üks
  on antud, arvutatakse teine.
- HARVEST rida: `quantity` = tonnid kokku, `ratePerHa` = t/ha,
  `priaKind` = saagi tüüp, `priaSpec` = kultuuri tüüp.
- OBSERVATION rida: `label` = leid (nt "Põldsinep"), `priaRegister` = seire
  liik, `quantity`/`unit` = kogus ("7", "taime/m2"; "Muu oluline sündmus"
  puhul 0 ja tühi ühik). Finantsi kokkuvõtted jätavad OBSERVATION read välja.

### 1.4 Kulumaterjalid

Import loob puuduvad `materials` kirjed toote nime järgi
(`@@unique([tenantId, category, name])`). Kategooria tegevusest:
Külvamine → SEED, Väetamine/Lupjamine → FERTILIZER,
Taimekaitsevahendi kasutamine → PLANT_PROTECTION (ka märgaja, biostimulaator),
muu → OTHER. Ühik PRIA koguse ühikust ilma "/ha" osata (kg, l, t, g, tk).

### 1.5 PRIA tõmmis (`field_operations`)

Jääb alles **viimase PRIA impordi tõmmisena** (eraldi ei kuvata).

```prisma
model FieldOperation {
  // ...
  workEntryId String? // Terise kanne, millega PRIA rida on seotud
  workEntry   WorkEntry? @relation(fields: [workEntryId], references: [id], onDelete: SetNull)
  @@index([workEntryId])
}
```

Lahknevused arvutatakse tõmmise ja kande vahel jooksvalt (ei salvestata).

Kõik skeemimuudatused on aditiivsed (`npx prisma db push`); RLS ja
`tenantId` vaikeväärtus nagu teistel tabelitel.

## 2. Import ja sidumine

Sama nupp nagu praegu (Põllud vaade → "Põlluraamatu väljavõte"), endiselt
ainult admin. Parser ja põllu leidmine (massiiv + põllu nr + operaator +
hooaeg) jäävad samaks.

Põllu-hooaja kohta, ühes transaktsioonis:

1. **Tõmmise uuendamine.** `field_operations` asendatakse failist tulnuga.
   Vana rea `workEntryId` kantakse üle uuele reale, millel on sama `type` ja
   `dateFrom` (mitme puhul sama `sortOrder` järjekord).
2. **Sidumine.** Iga sidumata PRIA rea jaoks otsitakse sama põllu-hooaja
   sama töötüübiga (`priaCode = type`) Terise kanne, mis pole veel ühegi
   PRIA reaga seotud:
   - tingimus: kuupäevavahemikud lõikuvad või vahe on **≤ 2 päeva**;
   - mitme kandidaadi korral: taimekaitsel ja väetamisel eelistatakse
     kannet, mille materjalide nimed kattuvad; seejärel lähim kuupäev.
3. **Täiendamine** (sobivus leitud). Ainult tühjad väljad: `dateTo`,
   `method`, `notes`, `areaHa`, `workerId`. Materjaliread seotakse nime
   järgi (tõstutundetu, tühikud normaliseeritud); seotud real täidetakse
   tühjad `priaRegister`, `priaKind`, `priaSpec`, `activeIngredient`,
   `ratePerHa`, N/P/K. PRIA-s olev, Terise kandel puuduv toode **ei lisata**
   kandele, vaid kuvatakse lahknevusena. Kogust, töötajat, masinat ja
   finantsi ei muudeta.
4. **Uus kanne** (sobivust pole). Vajadusel luuakse `field_works`
   (`status` sünkroonitakse), materjalid (p 1.4) ja kanne
   `source = PRIA_IMPORT`, `financeStatus = PENDING`. Töötaja leitakse nime
   järgi seotud isikute registrist (nagu praegu teostajaga); kui ei leita,
   jääb tühjaks ja nimi läheb märkustesse "Teostaja: <nimi>".
5. **Hooaja saak ja kuupäevad** (`field_seasons`) uuenevad nagu praegu.

**Lukus hooaeg:** uuendatakse ainult tõmmis (samm 1) ja olemasolevad seosed;
kandeid ei looda ega täiendata.

**Eelvaade ja tulemus** näitavad põldude kaupa: seotud, loodud,
lahknevusega, Terise kanded ilma PRIA vasteta.

### Esmane üleviimine

Skript `scripts/pria-entries-backfill.mts --tenant <id> [--field-code X --num N] [--year Y] [--dry-run]`
käivitab sammud 2–4 olemasoleva tõmmise peal (faile uuesti üles laadimata).
Teeb lukus hooaegadele erandi (ühekordne, admin). Käivitusjärjekord:

1. `--dry-run` Loisu-Agro põld nr 10, 2025 ja 2026 → kokkuvõte.
2. Sama päriselt → kasutaja vaatab täisvaate üle.
3. Ülejäänud põllud ja ettevõtted.

## 3. Põllu täisvaade

Uus komponent `FieldFullView` (asendab `FieldDetailsDrawer`). Avaneb
kaardil põllule või registris (Põllud, Külvikord) info-nupule klikkides.
Katab kogu sisuala; kaart jääb taha alles (ei unmount'ita). Sulgemine ✕
või Esc → tagasi samasse kohta.

### Päis

- Põllu nimi, `#id`, `Nr <num>`, massiivi number, kultuur, pindala.
- Hooaja valik (2022–2027, lukk nagu praegu).
- Nupud: "Muuda põldu" (`FieldEditDialog`), "Fookusta kaardil", sulge.

### Vasak veerg (~1/3)

Praeguse popup'i sisu + lisad:

- väike piirikaart (valitud hooaja geomeetria);
- pindala, kultuur ja sort, haritud, staatus;
- PRIA põhiandmed: kasutusõigus, maakasutus (kui imporditud);
- katastriüksused, geograafia ja piirid, mullaproovid, NDVI (kui on),
  märkmed.

### Parem veerg (~2/3): põllutööd

- **Kokkuvõtteriba:** tegevuste arv; N/P/K kg/ha summa; saak plaan /
  tegelik t/ha; PRIA loendur (✓ / ⚠ / ✗).
- **Filtrid:** kõik / faasi järgi / "Ainult lahknevused".
- **Ajajoon** kronoloogiliselt (`date`, siis loomise järjekord). Kaart:
  - kuupäev või vahemik (`pp.kk.aaaa`, vahemik `formatDateRange`),
    tegevus, viis;
  - materjaliread: nimi · liik · register/täpsustus · kogus ha kohta ja
    kokku · N/P/K · toimeaine;
  - saak: t/ha ja kokku, saagi tüüp; seire leiud;
  - töötaja, masin + haake, tunnid, kütus;
  - märkused kokkupandavalt;
  - PRIA märk:
    - **✓ PRIA** — seotud, väärtused kattuvad;
    - **⚠ PRIA** — seotud, erinevus (kuupäev > 2 p, pindala, toote kogus
      ha kohta, PRIA-s olev toode puudub kandel või vastupidi); erinevad
      väärtused näidatakse real ("PRIA-s 0,30 l/ha");
    - **✗ PRIA-s puudu** — Terise kanne ilma PRIA vasteta;
    - **Ainult PRIA-s** — tõmmise rida ilma kandeta (lukus hooaeg); kuvatakse
      halli kaardina tõmmise andmetega.
- Kaardile klikk avab `FieldWorkEntryDialog` (vt allpool). "+ Lisa kanne"
  küsib esmalt tegevuse (PRIA 29).
- **Planeeritud:** `field_works` ilma kandeta eraldi plokis lõpus.
- Hinnad ja finantsi read ainult finantsõigusega kasutajale (olemasolev
  õiguste loogika).

### Mobiil

Üks veerg: päis, põllutööd, üldandmed kokkupandavas plokis.

### Andmed

- Üldandmed: olemasolev `masterFields` (muutust pole).
- Põllutööd: uus `GET /api/field-season-works?fieldId=&year=` → põllu-hooaja
  `field_works` koos kannete, ridade ja PRIA tõmmisega ning arvutatud
  vastavusmärkidega. Lahknevuste arvutus serveris eraldi puhtas funktsioonis
  (`priaReconcile.ts`), mida kasutab ka import.

## 4. Kandevorm (`FieldWorkEntryDialog`)

Lisanduvad PRIA väljad tegevuse tüübi järgi (`priaCode`):

| Tegevus | Lisaväljad |
|---|---|
| kõik | lõppkuupäev (`dateTo`), pindala, märkused |
| Külvamine/istutamine | materjal = seeme: sordiregister, sort, liik, seemne kategooria, kogus ha kohta ↔ kokku |
| Väetamine | väetamisviis; materjal: register, toode, liik, kogus ha/kokku, N/P/K kg/ha |
| Lupjamine | materjal: register, toode, liik, kogus t/ha ↔ t |
| Taimekaitsevahendi kasutamine | teostaja (töötaja, kohustuslik); materjalid (mitu): register, toode, liik, toimeaine, kogus ha/kokku |
| Seire | leiud (mitu): seire liik, leid, kogus (ühik liigi järgi) |
| Saagikoristus | kultuuri tüüp, saagi tüüp, t/ha ↔ t kokku |

Ülejäänud PRIA tegevustel ainult põhiväljad. Kogus ha kohta ja kokku
arvutavad teineteist pindala järgi. Kuupäevasisestus Eesti formaadis
(`pp.kk.aaaa`, mitte natiivne `type=date`).

Klassifikaatorid (väetamisviisid, seemne kategooriad, saagi tüübid,
kultuuri tüübid, seire liigid, TKV materjali tüübid) on konstandid
`src/types/pria.ts`. PTA registrite (väetised, TKV-d, sordid) päringut
selles etapis ei tehta — toode valitakse Kulumaterjalidest või
sisestatakse vabatekstina.

## Väljaspool ulatust

- Eksport Terisest PRIA-sse.
- PTA väetise-, TKV- ja sordiregistri liidestus.
- Karjatamise, maaparandushoiutööde, sõnniku aunastamise ja mullaproovi
  võtmise erivormid (kasutavad põhivälju + märkusi).
- `field_operations` tabeli eemaldamine.

## Testimine

- Ühiktestid (Vitest):
  - töötüüpide migratsiooni liitmine (`field_works` duplikaadid, mallid);
  - sidumine: vahemike lõikumine, 2 päeva piir, mitu kandidaati,
    tootenimede kattumine, juba seotud kanne;
  - täiendamine ei kirjuta üle täidetud välju;
  - lahknevuste arvutus (`priaReconcile`);
  - kogus ha ↔ kokku arvutus.
- Esmane üleviimine `--dry-run` põllul nr 10: 2025 → 10 PRIA tegevust,
  2026 → 8 tegevust; kõik loodud kanded kuvatakse täisvaates ✓ märgiga.
- Korduvimport sama failiga ei loo uusi kandeid ega muuda olemasolevaid.
- Release: `npm run release` serveris (tüübikontroll, testid, build).
