# Sõitude register (disain)

Kuupäev: 2026-11-04
Staatus: disain kinnitatud, plaan koostamata

## Eesmärk

1. **Ülevaade, mida tehnikaga tehakse**: iga süüte sisse → välja sõit on eraldi
   kirje — kust alustati, kus käidi, kus lõpetati, kui kaua, mitu km, kütus,
   mootoritunnid.
2. **Automaatne**: telemeetriast imporditakse taustal iga 15 min järel; kasutaja
   midagi ei sisesta.
3. **Alus hilisemale seostamisele** (kanded jm) — seostamine ise ei kuulu siia etappi.

Praegu arvutab kandedialoog (`getTelemetrySuggestionsForField`) sõidud igal
avamisel uuesti ühe põllu ja päeva kohta; kuhugi neid ei salvestata.

## Otsused

| Teema | Otsus |
|---|---|
| Ülesehitus | Taustatöö samas rakenduses (`prod.ts` käivitab), sõidud Terise andmebaasis. Eraldi teenust ega tsdb-poolset arvutust pole |
| Sõidu omanik | Seade (`TelemetryDevice`), mitte masin. Masin/haakeriist leitakse **lugemisel** seadmete seoste registrist sõidu aja järgi — registri tagantjärele parandus kajastub kohe |
| Ettevõte | See, kellele seade sõidu ajal kuulus (omandiperioodid, nagu kogu telemeetria) |
| Muudetavus | Ainult automaatne. Kasutaja saab muuta vaid märkust. Liitmist/poolitamist pole |
| Värskus | Iga 15 min; pooleli sõit nähtav olekuga „käimas“ |
| Ajalugu | Esimene import töötleb kogu omandiperioodi (praegu alates 21.10.2026) |
| Kohad | Ainult oma põllud ja huvipunktid (`loadPlaces`, `buildRoute` loogika). Koordinaate välja ei saadeta, aadressiotsingut pole |
| Seadme kustutamine | Sõidud kustuvad kaasa (tuletatud andmed) |
| Silmsensorid | Välja jäetud (GPS-i pole) |

## Sõidu definitsioon

- **Algus**: esimene punkt süütega sees.
- **Jätkub**, kuni süüde on väljas **üle 10 min** või punktide vahel on **üle 20 min**
  (`TRIP_GAP_MS`) andmeauk.
- **Paus**: süüde väljas ≤ 10 min sõidu sees — sõit jätkub, paus loetakse kokku
  (arv + kogukestus).
- **Müra**: sõit < 1 min või < 3 punkti jäetakse välja.
- Süüteväljata seadme punktid loetakse süüte sees olevaks (nagu `segmentTrip`).
- **Olek**: `ACTIVE` (käimas), kui sõit pole veel lõppenud: viimasest süütega
  punktist on < 10 min (võib olla paus) või süüde on sees ja viimasest punktist
  on < 20 min. Muidu `CLOSED`.
- **Lõplik**: sõit, mille lõpust on möödas > 24 h — import seda enam ei arvuta
  ümber (v.a kohtade ümberarvutus, vt allpool).

## Mõõdikud

| Väli | Arvutus | Puudumisel |
|---|---|---|
| Algus/lõpp aeg | esimene/viimane süütega punkt | — |
| Algus/lõpp koht | koordinaat + `PlaceRef` või `near` (≤ 200 m), nagu `TripStop` | koht tühi, koordinaat alles |
| Läbitud kohad | `TripVisit[]` (`buildRoute`) | tühi loend |
| km | GPS haversine summa; jitter välja (samm < 5 m ja kiirus < 2 km/h ei lähe arvesse) | — |
| Liikumisaeg / seisuaeg süütega | kiirus ≥ 2 km/h vs < 2 km/h, punktide vahed kuni 5 min | — |
| Max / keskmine kiirus | GPS `speed` (keskmine = km / liikumisaeg) | — |
| Pausid | arv + minutid | 0 |
| Kütus (l) | 1) `fuel_consumed_counted` vahe; 2) `fuel_rate_lph` integraal üle aja | tühi (mitte 0) |
| Kütusetase alguses/lõpus (%) | `fuel_level_percent` | tühi |
| Mootoritunnid alguses/lõpus | `engine_total_hours_h` näit | tühi |
| Raja ristkülik | min/max lat/lng | — |

Seadmete andmed erinevad (seisuga 04.11.2026: CAN-kütusekulu ja mootoritunnid
ühel seadmel, loendatud kütus ja tase teisel, kolmandal ainult GPS + süüde).

## Andmemudel (Prisma, `teris_db`, RLS nagu teistel ettevõtte tabelitel)

`VehicleTrip` → `vehicle_trips`
- `id`, `tenantId`, `deviceId` (→ `TelemetryDevice`, `onDelete: Cascade`)
- `startedAt`, `endedAt`, `status` (`ACTIVE` | `CLOSED`)
- `startLat`, `startLng`, `startPlace` (Json: `{ place, near }`), `endLat`, `endLng`, `endPlace` (Json)
- `visits` (Json `TripVisit[]`)
- `distanceKm`, `movingMinutes`, `idleMinutes`, `pauseCount`, `pauseMinutes`
- `maxSpeedKmh`, `avgSpeedKmh`
- `fuelLiters?`, `fuelLevelStartPct?`, `fuelLevelEndPct?`
- `engineHoursStart?`, `engineHoursEnd?`
- `minLat`, `minLng`, `maxLat`, `maxLng`
- `pointCount`, `notes?`, `computedAt`, `createdAt`, `updatedAt`
- indeksid: `(deviceId, startedAt)` unikaalne, `(tenantId, startedAt)`

`TripImportState` → `trip_import_state` (seadme kohta)
- `deviceId` (PK, → `TelemetryDevice`, Cascade), `tenantId`
- `finalizedUntil` (aeg, milleni sõidud on lõplikud)
- `lastRunAt`, `lastError?`, `lastErrorAt?`

`TripPlaceRefresh` → `trip_place_refresh` (kohtade ümberarvutuse järjekord)
- `id`, `tenantId`, `minLat`, `minLng`, `maxLat`, `maxLng`, `createdAt`
- Lisatakse huvipunkti loomisel/muutmisel/kustutamisel ja põllu hooaja geomeetria
  muutmisel (vana ja uus ristkülik).

## Import (`src/server/tripImport.ts` + puhas `src/server/tripSegments.ts`)

**Käivitus**: `prod.ts` — kohe pärast starti ja `setInterval` 15 min. Lukk mälus:
kui eelmine töö käib, uus ei alga. Arendusserveris (`dbApiPlugin`) ei käivitu
(käsitsi käivitus käsurealt: `tenantCli` alamkäsk `trips:import`).

**Ühe käigu sammud**
1. `tsdb` puudub → lõpp, midagi ei muudeta.
2. Iga ettevõte, kelle litsentsis on `TELEMETRY` (`runAsTenant`):
   1. Ettevõtte `CELLULAR` seadmed ja nende omandiperioodid.
   2. Iga seadme kohta (eraldi try/catch):
      - `from` = `finalizedUntil` (puudumisel omandiperioodi algus) − 1 h varu;
        `to` = praegu. Kui vahe > 2 päeva, töödeldakse päevahaaval (ajaloo
        järeltöötlus).
      - Paketid (`fetchDevicePackets` laiendus: + `speed`, `fuel_consumed_counted`,
        `fuel_rate_lph`, `fuel_level_percent`, `engine_total_hours_h`) omandi piires.
      - Puhas funktsioon `segmentTrips(points)` → sõidud + mõõdikud.
      - Kohad: `loadPlaces(aasta)` (sõidu alguse aasta), `buildRoute`.
      - Kirjutamine ühes tehingus: aknas olevad **mittelõplikud** sõidud asenduvad
        uutega; uus sõit, mis kattub ajaliselt vanaga, võtab üle vana `id`
        (seosed püsivad); kattuvuseta vanad kustutatakse.
      - `finalizedUntil` = viimase sellise sõidu lõpp, mis on > 24 h vana
        (või akna algus − 24 h, kui sõite polnud); `lastRunAt`, `lastError = null`.
      - Viga → `lastError`, `lastErrorAt`, logi; `finalizedUntil` ei liigu.
   3. Kohtade ümberarvutus: iga `trip_place_refresh` rea kohta sõidud, mille
      ristkülik kattub → paketid uuesti, `buildRoute`, uuenda ainult kohaväljad;
      rida kustutatakse.

## Vaade

Tehnika lehel uus vahekaart **„🛣️ Sõidud“** (`activeTab = 'trips'`) pärast
„Seadmete seoseid“; ainult `TELEMETRY` mooduliga; lisamisnuppu pole.

- **Tabel** (uuemad ees): kuupäev, masin (haakeriist), algus–lõpp, kestus,
  kust → kuhu, km, kütus l, mootoritunnid, olek. Kuupäevad pp.kk.aaaa HH:MM
  Tallinna ajas; numbrid paremale (`num`, `formatQty`).
- Seoseta seade: seadme nimi + „seos puudub“.
- Tundmatu koht: „tundmatu (Põld X 150 m)“ või „tundmatu“.
- „Käimas“ sõidul lõpu asemel „käimas“.
- **Filtrid** (`FilterClear`): periood (vaikimisi 7 päeva), masin, olek, ainult
  tundmatu algus/lõpp.
- **Sõidu aken**: kaart rajaga (rada tsdb-st), algus- ja lõpumärk; läbitud kohad
  kellaaegadega; kõik mõõdikud; märkuse väli (ainus muudetav).
- **Impordi olek** tabeli kohal: viimane import; hoiatus seadmete kohta, millel
  `lastError`.

**API**
- `GET /api/fleet/trips?from&to&vehicleId&status&unknownPlace` — masin/haakeriist
  liidetakse `DeviceAssignment` (+ `ImplementAssignment`) järgi sõidu alguse ajal.
- `GET /api/fleet/trips/:id/track` — sõidu rada tsdb-st.
- `PATCH /api/fleet/trips/:id` — ainult `notes`.
- `GET /api/fleet/trips/import-status`.
- Kõik: moodul `TELEMETRY`.

## Testimine

- `tripSegments.test.ts` (puhas): süüde väljas ≤ 10 min → paus samas sõidus;
  > 10 min → kaks sõitu; 20 min auk → kaks sõitu; müra välja; `ACTIVE` vs
  `CLOSED`; km jitteriga; kütus loendurist vs tunnikulust vs puudub;
  mootoritunnid; süüteväljata seade.
- `tripImport.test.ts` (andmebaasiga, nagu olemasolevad serveritestid):
  korduv käik ei tekita duplikaate; hilinenud paketid liidavad kaks sõitu ja
  `id` säilib; lõplikku sõitu ei puututa; omandiperioodist väljas punkte ei
  loeta; ühe seadme viga ei peata teisi; ettevõtete eraldus; kohtade
  ümberarvutus pärast huvipunkti lisamist.
- API: moodulita ettevõttel 403; teise ettevõtte sõit pole nähtav; `PATCH` muudab
  ainult märkust.

## Välja jäetud (hilisemad etapid)

Seostamine kannetega; MCP tööriist sõitude lugemiseks; eksport; kokkuvõtted
(km/kütus kuus masina kohta); sõitude liitmine/poolitamine; aadressiotsing.

## Dokumentatsioon

Uuendada `docs/vaated-ja-andmed.md` (Tehnika vaade, API tabel, tabelite maatriks)
ja `docs/andmemudel.md` (uued tabelid).
