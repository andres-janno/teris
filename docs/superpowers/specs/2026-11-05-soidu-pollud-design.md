# Sõidu põllud, ha ja kande seos (disain)

Kuupäev: 2026-11-05
Staatus: live 2026-11-05 (plaan: docs/superpowers/plans/2026-11-05-soidu-pollud.md)
Eelmine etapp: `2026-11-04-soidud-design.md` (sõitude register, live)

## Eesmärk

1. **Sõit näitab tehtud ha** — põldude kaupa ja kokku.
2. **Kande telemeetria soovitused tulevad sõitude registrist** — sama algus/lõpp
   mis registris (pausid sees), lisaks kütus.
3. **Kanne seotakse sõiduga** — registrist näeb, milline põllusõit on kirja panemata.

Praegu arvutab `getTelemetrySuggestionsForField` (fieldWorks.ts) igal kande akna
avamisel GPS-ist uuesti ja teise reegliga (lõpp esimese süüte väljalülituse
järgi), mistõttu kanne ja register näitavad sama sõidu kohta eri aegu.

## Otsused

| Teema | Otsus |
|---|---|
| ha tähendus | Haakeriista laiusega kaetud pindala **põllu piires**, põldude kaupa; sõidul summa. Teed/hoovid ei lähe arvesse |
| ha arvutus | Olemasolev `coverageAreaHa` (ruudustik) |
| ha säilitamine | Arvutatakse impordis ja salvestatakse koos haakeriista ja laiusega; ümberarvutus muutuste korral |
| Puuduv haakeriist/laius | ha tühi (mitte 0) |
| Kütus kandel | Põllu kütus + teekütuse osa (jagatud põllul oldud aja järgi); summa = sõidu kütus. Põllu enda kütus ka eraldi |
| Kanne ↔ sõit | Üks sõit kande kohta. Üks sõit võib olla mitmel kandel ainult eri põldudel |
| Vanad kanded | Ei seota automaatselt. Telemeetria pindala (`telemetryAreaHa`) varundatakse ja tühjendatakse kõigil kannetel; teisi välju ei muudeta |
| Välja jäetud | MCP tööriist, kokkuvõtted |

## Andmemudel

`VehicleTripField` → `vehicle_trip_fields` (ettevõtte tabel, RLS + FK-triggerid)
- `id`, `tenantId`
- `tripId` → `VehicleTrip` (Cascade)
- `fieldSeasonId` (Int) → `FieldSeason` (Cascade)
- `arriveAt`, `leaveAt` — esimene/viimane sõidu punkt põllu piires
- `activeMinutes` — põllul süütega oldud aeg (punktide vahed ≤ 5 min, pausid välja)
- `areaHa?` — kaetud pindala põllu piires
- `implementId?` (teave, mitte FK — haakeriista kustutamisel jääb ajalugu), `widthM?`
  — millega ha arvutati
- `fuelFieldL?` — põllul kulunud kütus
- `fuelSharedL?` — põllu kütus + osa teekütusest
- `computedAt`
- unikaalne `(tripId, fieldSeasonId)`; indeks `(fieldSeasonId, arriveAt)`

`VehicleTrip` lisaväli: `areaHa?` (põldude summa; tühi, kui ühelgi põllul pole ha-d).

`WorkEntry` lisaväli: `tripId?` → `VehicleTrip` (`onDelete: SetNull`).

`TripImportState` lisaväljad: `assignmentsFingerprint?`, `assignmentsCheckedAt?`.

## Arvutus (impordis, `tripFields.ts` puhas + import)

Sõidu kohta, samade punktidega mis kohtade tuvastus:

1. Põllud = sõidu aasta hooaegade geomeetriad (`loadPlaces` FIELD-tüüp).
   Punkt kuulub põllule, kui on polügoonis (turf, bbox eelfilter).
2. Iga põllu kohta: põllu punktid (`brk`, kui vahepeal käis väljas või vahe > 5 min).
   - `arriveAt`/`leaveAt`, `activeMinutes` (järjestikused põllu punktid, vahe ≤ 5 min).
   - Haakeriist: seadme seos põllule jõudmise ajal (`DeviceAssignment` → haakeriist
     otse või masina `ImplementAssignment` kaudu), laius `Implement.workingWidthM`.
   - `areaHa = coverageAreaHa(punktid, polügoon, laius)`; laiuseta tühi.
   - `fuelFieldL`: kütuseloenduri positiivsed juurdekasvud järjestikuste põllu punktide
     vahel; loenduri puudumisel tunnikulu integraal; mõlema puudumisel tühi.
3. Teekütus = sõidu kütus − Σ `fuelFieldL`; `fuelSharedL = fuelFieldL + teekütus ×
   activeMinutes / Σ activeMinutes`. Sõidu kütuse puudumisel tühi.
4. Põld, kus põllu punkte < 3 või `activeMinutes` < 1, jäetakse välja (läbisõit serva pealt).
5. `VehicleTrip.areaHa` = Σ `areaHa` (null, kui kõik null).

**Ümberarvutus** (põllud kirjutatakse alati sõidu kohtade väljadega samal ajal):
- mittelõplikud sõidud — igal impordil (nagu praegu);
- kohtade sõrmejälje muutus — olemasolev loogika; arvutab ümber ka põllud;
- **uus seoste sõrmejälg**: `DeviceAssignment`, `ImplementAssignment`, `Implement`
  arv + max `updatedAt`. Muutusel arvutatakse ümber selle seadme lõplikud sõidud,
  mille ajavahemik kattub pärast `assignmentsCheckedAt` muudetud seose perioodiga
  või mille põllureal on pärast seda muudetud haakeriist. Kustutatud seoste
  tuvastamiseks: sõidud, mille põllurea `implementId` ei vasta enam seosele.

**Id ülevõtt:** kui vana sõidu asemele tekib uus (hilinenud punktid), eelistatakse id
ülevõtul kattuvat vana sõitu, millel on seotud kandeid — seos ei kao liitumisel.

## Kande soovitused

`GET /api/field-works/telemetry-suggestions` (sama tee, sama vastuse kuju + lisad):
- Allikas: `vehicle_trip_fields` selle **põllu** kohta (mis tahes hooaeg), mille `[arriveAt, leaveAt]`
  kattub valitud Tallinna kalendripäevaga.
- Välja jäetakse sõidud, mis on seotud **sama põllu teise** kandega (`excludeEntryId`
  arvestades).
- Soovitus: `tripId`, masin/haakeriist (seoste registrist), `startTime`/`endTime` =
  sõidu algus/lõpp; kui sõit käis enne/pärast teistel põldudel, siis vastavalt
  `arriveAt`/`leaveAt` (olemasolev reegel); `fieldStartTime`/`fieldEndTime` =
  `arriveAt`/`leaveAt`; `durationHours` = `activeMinutes`/60; `workedAreaHa` = `areaHa`;
  **`fuelLiters`** = `fuelSharedL`; `route` = sõidu algus, külastused, lõpp.
- Olek `linked`, kui kanne on juba selle sõiduga seotud.
- Vana GPS-põhine arvutus (`getTelemetrySuggestionsForField` sisu,
  `fetchFieldGpsPackets`, kui muud kasutajat pole) eemaldatakse.

**Kande aken:** soovituse klõps täidab ka kütuse ja jätab meelde `tripId`; seotud
soovitusel nupp „Eemalda seos“. Kande salvestus (`POST`/`PUT /api/work-entries`):
`tripId` lubatud ainult siis, kui sõidul on selle põllu rida ja sõit pole sama
põllu teise kandega seotud (muidu 400 eestikeelse veaga).

**Seos põllu, mitte hooaja järgi:** sõidu põllurida arvutatakse sõidu kalendriaasta
hooaja vastu, sügistööd (nt sügiskülv) kuuluvad aga järgmise aasta hooaja alla. Seepärast
võrdlevad soovitused, kande salvestuse kontroll ja sõitude registri kandeseos füüsilist
põldu (`Field.id`), mitte `FieldSeason.id`-d.

## Sõitude register

- Tabel: veerg **ha** (`areaHa`, `formatQty`, paremale) ja **Kanne** (✓ / —; ✓ kui
  vähemalt ühel põllureal on kanne).
- Filter (FilterClear): „ainult kandeta põllusõidud“ — sõidul on põllurida ilma kandeta.
- Sõidu aken: põldude tabel — põld, põllul (HH:MM–HH:MM, aeg), ha (haakeriist, laius m),
  kütus põllul / koos teega, kanne (töö nimi → avab põllu töö; või „kanne puudub“).
- API `TripDto` lisad: `areaHa`, `fields: { fieldSeasonId, label, arriveAt, leaveAt,
  activeMinutes, areaHa, implementName, widthM, fuelFieldL, fuelSharedL,
  entries: { id, fieldWorkId, workTypeName, date }[] }[]`; filter `unlinkedOnly=1`.

## Vanad andmed (ühekordne, live)

1. Varukoopia: `work_entries` (`id`, `telemetryAreaHa`) kus väärtus pole null →
   JSON-fail serveris `/home/debian/backups/telemetry-area-ha-2026-11-05.json`.
2. `UPDATE work_entries SET "telemetryAreaHa" = NULL`.
3. Kõigi sõitude ümberarvutus (`finalizedUntil = NULL` + `trips:import`), et põllud tekiksid.

## Testimine

- `tripFields.test.ts` (puhas): põllu punktid ja `brk`; `activeMinutes`; ha laiusega /
  laiuseta; põllu kütus loendurist / tunnikulust / puudub; teekütuse jagamine (summa =
  sõidu kütus); läbisõit serva pealt välja.
- `tripImport.test.ts`: sõidule tekivad põllured; seose muutus (haakeriist vahetub)
  arvutab lõpliku sõidu ha ümber; kandega seotud sõidu id säilib liitumisel.
- `fieldWorks`/kande API: soovitus registrist (aeg pausidega, kütus); sama põllu teise
  kandega seotud sõitu ei pakuta (ka teise hooaja kanne, sügistööd); vale `tripId` → 400; eri põldude kanded samale sõidule OK.
- `tripsApi.test.ts`: `areaHa`, `fields` koos kannetega, `unlinkedOnly`.

## Dokumentatsioon

`docs/vaated-ja-andmed.md` (kande aken, Tehnika, API, maatriks), `docs/andmemudel.md`.
