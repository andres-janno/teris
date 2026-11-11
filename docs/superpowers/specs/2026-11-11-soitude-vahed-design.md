# Sõitude vahede kontroll (jälgimata töö märgid) — disain

Kuupäev: 2026-11-11
Staatus: kinnitatud arutelus, ootab ülevaatust

## Eesmärk

Märgata olukordi, kus masin töötas, aga telemeetriaseade oli lahti ühendatud või muul põhjusel ei salvestanud
(„mootoritundidega petmine“). Kasutaja näeb sõitude registris kahe sõidu vahel hoiatust, saab selle läbi vaadata ja
märkida kontrollituks koos selgitusega. AI (MCP) näeb kontrollimata hoiatusi.

## Taust ja piirang

- Seadme mootoritunnid (`engine_worktime_counted_min`, varem `io_103`) loeb **seade ise**, mitte traktor. Seadme
  lahtiühendamisel jääb ka see lugeja seisma, seega mootoritundide võrdlus pettust ei näita.
- Käsitsi tunnilugeja näitu ei tule (kasutaja otsus 2026-11-11).
- Masina enda mootori koguaega CAN-ist (`engine_total_hours_h`) saadab praegu ainult **kombain** (FMC650), täistundide
  täpsusega. Suur Claas (FMC150) saadab ainult seadme enda lugejat; kui selle seadistuses CAN koguaeg sisse lülitada ja
  Claas seda annab, hakkab tunnimärk ka seal tööle ilma koodimuudatuseta. Väike Claas (FMC125) tunde ei saada.
- Seetõttu kasutame peamiselt **kaudseid märke**; CAN tunnid on ainus otsene märk, kus need olemas on. Need on vihjed, mitte tõend; seepärast on hoiatusel kontrolli märge.
- Seadmel on sisemine aku: toitest lahti olles saadab see edasi ja `external_voltage_v` langeb ~0-ni.

Andmete eelkontroll 2026-11-11 (kõik seadmed, kustutamata sõidud): toitekatkestusi 1 (Claas 03.11 14:58, 1,8 V),
asukohahüppeid > 300 m 2, andmeauke > 3 h 0, kütuse langusi 2 — mõlemad valed (vt „Kütuse lõpunäit“).
Kombaini CAN tundide kasv sõitude vahel: 1 juhtum, 23.10 10:16 → 25.10 09:50 +1 h, samal ajal asukoht +800 m.

## Mõisted

**Vahe** — ajavahemik sama seadme kahe järjestikuse **kustutamata** sõidu vahel: eelmise sõidu `endedAt` →
järgmise sõidu `startedAt`. Kustutatud (müra) sõidu aeg kuulub vahe sisse — ka kustutatud sõit, mille ajal mootor
töötas, on jälgimata töö kandidaat.

Vahe seotakse **järgmise sõiduga** (`nextTripId`). Import säilitab sõidu id ümberarvutamisel (kattuv vana sõit annab
oma id uuele), seega püsib ka vahe ja selle kontrolli märge.

## Märgid ja piirid

| Märk | Väli | Piir | Allikas |
|---|---|---|---|
| Toide kadus | `powerLostMinutes` | pinge < 6 V, kokku ≥ 5 min | seadme punktid vahe ajal (`external_voltage_v`) |
| Seade vaikis | `silentMinutes` | pikim paus järjestikuste punktide vahel ≥ 3 h | seadme punktid vahe ajal (mistahes väli) |
| Kütus kadus | `fuelDropPct` | eelmise sõidu lõpunäit − järgmise algusnäit ≥ 5 | sõitude `fuelLevelEndPct` / `fuelLevelStartPct` |
| Asukoht hüppas | `jumpM` | ≥ 500 m | eelmise sõidu `endLat/Lng` → järgmise `startLat/Lng` |
| Mootoritunnid kasvasid | `engineHoursGrowth` | ≥ 2 h | CAN `engine_total_hours_h`: viimane näit ≤ vahe algus, esimene näit ≥ vahe lõpp |

- Toitekatkestuse kestus: järjestikuste pingepunktide vahed, kus vahe alguspunkti pinge < 6 V; vahe otsad lõigatakse
  vahe piiridele. Seade vaikimise ajal (punktide vahe > 3 h) toitekatkestuse kestust ei loeta (teadmata).
- Seade vaikis: arvestatakse ka vahe algusest esimese punktini ja viimasest punktist vahe lõpuni.
- Mootoritunnid: ainult `engine_total_hours_h` (masina CAN koguaeg), **mitte** seadme enda lugeja
  (`engine_worktime_counted_min` / `io_103`) — see seisab koos seadmega. Näit on täistundides, seepärast üksi annab
  hoiatuse alles ≥ 2 h; kasv +1 h salvestatakse ja kuvatakse, kui mõni teine märk ületab piiri, aga üksi vahet ei tekita.
  Näitu otsitakse kuni 1 h väljapoole vahe piire; kui kummalgi poolel pole, märki ei arvutata.
- Kütuse tõus (tankimine) hoiatust ei anna. Kui kumbki näit puudub, märki ei arvutata.
- Vahe salvestatakse ainult siis, kui **vähemalt üks märk ületab piiri**. Salvestatakse kõigi märkide väärtused
  (ka piiri alla jäänud, `null` = ei saanud arvutada; kõigi viie), et kuvada täit pilti.
- Toide kadus ja seade vaikis arvutatakse ainult seadmetele, millel on märge „saadab ka seisu ajal“ (`TelemetryDevice.reportsWhenParked`, vaikimisi väljas). Live-kontroll 2026-11-11: kombain (FMC650) ei saada pargitult (vaikis kuni 12 p), Väike Claas (FMC125) on süütega toitel (pinge seisus 3–9 V) — mõlemal oleksid need märgid igaöised valehäired. Märke muutmisel arvutab järgmine import seadme sõidud ja vahed uuesti.
- Piirid on konstandid ühes moodulis (`tripGaps.ts`), mitte seaded.

## Kütuse lõpunäit

Kütusetaseme andur annab süüte sisselülitamise hetkel valesid väärtusi (sh 0). Algusnäidul on juba 2 min settimine.
Kontrollitud 09.11 Suure Claasi sõidul: pärast pausi lühike taaskäivitus (üks punkt) andis 0, mis jäi sõidu lõpunäiduks.
Reegel: näit **0 ei loe** ei algus- ega lõpunäiduks (paak 0% ei ole päris olukord); muu jääb samaks.
Alla 2 min sõidul (settinud näitu pole) on algusnäit sõidu viimane nullist erinev näit.
Olemasolevad sõidud arvutatakse uuesti (`finalizedUntil = NULL`, nagu varasematel ümberarvutustel).

## Andmemudel

### `VehicleTripGap` (`vehicle_trip_gaps`)

| väli | tähendus |
|---|---|
| `id` | cuid |
| `tenantId` | ettevõte (nagu teistel ettevõtte tabelitel, RLS) |
| `deviceId` | seade (FK, cascade) |
| `prevTripId` | eelmine sõit (FK, `onDelete: SetNull`) |
| `nextTripId` | järgmine sõit (FK, cascade), **unikaalne** |
| `startedAt`, `endedAt` | vahe piirid |
| `powerLostMinutes`, `silentMinutes`, `fuelDropPct`, `jumpM`, `engineHoursGrowth` | märkide väärtused (Float?) |
| `reviewedAt`, `reviewedBy`, `reviewNote` | kontrolli märge (kõik tühjad = kontrollimata) |
| `computedAt` | viimane arvutus |
| `createdAt`, `updatedAt` | |

Indeksid: `(deviceId, startedAt)`, `(tenantId, reviewedAt)`.

## Arvutus

Uus puhas moodul `src/server/tripGaps.ts`:

```ts
computeGaps(trips: GapTrip[], samples: GapSample[]): GapCalc[]
```

- `trips` — ajas kasvavalt kustutamata sõidud (id, aeg, otsapunktid, kütuse otsanäidud).
- `samples` — vahe ajale jäävad seadme punktid (aeg, pinge või `null`, CAN mootoritunnid või `null`), sh kuni 1 h
  enne ja pärast vahet tunninäitude jaoks.
- Tagastab ainult piiri ületanud vahed.

Telemeetriast uus päring `fetchGapSamples(imei, from, to)` (`telemetryAccess.ts`): iga punkti aeg,
`external_voltage_v` ja `engine_total_hours_h`, omandiperioodide piires, ajas kasvavalt. Asukohta ei nõuta (erinevalt `fetchTripSamples`).

Impordis (`tripImport.ts`): pärast iga `writeChunk`-i arvutatakse vahed seadme sõitudele, mille algus on
vahemikus (`from`, `to`], koos sellele eelneva viimase kustutamata sõiduga. Kirjutamine:

- piiri ületav vahe → upsert `nextTripId` järgi; märkide väärtused, piirid ja `prevTripId` uuenevad, **kontrolli märge jääb**;
- vahemikus olevad olemasolevad vahed, mida uus arvutus ei andnud → kustutatakse, **v.a. kontrollitud** vahed
  (läbivaadatud otsust ei kustutata; need jäävad, kuni järgmine sõit ise kaob).
- Sama tehing ja sama seadme lukk mis sõitudel.

Sõidu kustutamine müraks või taastamine registris muudab vahesid: pärast kustutamist/taastamist arvutatakse selle
seadme vahed ümber kustutatud sõidu ümbruses (eelmine ja järgmine kustutamata sõit).

## API

- `GET /api/fleet/trips` — iga sõidu juures `gapBefore` (vahe, mis lõpeb selle sõidu algusega, või `null`).
  Uus filter `gaps=all|unreviewed`: ainult sõidud, mille ees on vahe (kõik / kontrollimata).
- `PATCH /api/fleet/trips/gaps/:id` — `{ reviewed: boolean, note?: string }`; `reviewed: true` nõuab mittetühja
  selgitust (kuni 1000 märki); `false` tühjendab märke. Õigus: sama mis sõidu märkuse muutmisel (iga kasutaja).
- Kontrollimata vahede arv loetakse kliendis laaditud sõitudest (eraldi päringut pole).

## UI (`TripRegister.tsx`)

- Kahe sõidu vahel hoiatusrida (kogu tabeli laiuses), nt
  „⚠ Sõitude vahel 14 h 05 min: toide kadus 2 h 10 min · kütus −12% · asukoht +1,4 km · mootoritunnid +3 h“.
  Kuvatakse piiri ületanud märgid ja mootoritundide kasv alates +1 h; numbrid Eesti formaadis.
- Real nupp „Märgi kontrollituks“ → väike dialoog selgitusega (kohustuslik). Kontrollitud rida on hall:
  „Kontrollitud pp.kk.aaaa HH:MM, <kasutaja>: <selgitus>“ ja nupp „Ava uuesti“.
- Filtriribal valik „Kõik sõidud / Hoiatustega / Kontrollimata hoiatused“ (`FilterClear`-iga); filtririba kõrval
  kontrollimata vahede arv laaditud perioodis.
- Menüüs loendurit ei tule (menüüs pole loendurite mehhanismi).

## MCP

Sõitude/sõidukite tööriistadesse (`src/server/mcp/tools/fleet.ts`): uus tööriist `list_trip_gaps`
(seade või sõiduk, periood, `unreviewedOnly` vaikimisi `true`) — vahe piirid, sõiduk, märkide väärtused, kontrolli
märge. Kirjeldus ütleb, et need on jälgimata töö **kaudsed märgid**, mitte tõend. Juhis admin.teris.ee-s täiendatakse.

## Testid

- `tripGaps.test.ts`: iga märk eraldi piiril ja piiri all; mootoritunnid +1 h üksi ei tekita vahet, koos teise märgiga
  kuvatakse; seadme enda lugejat ei kasutata; tankimine ei anna hoiatust; kustutatud sõit vahe sees;
  puuduvad näidud (`null`); seade vaikis ka vahe otstes; toitekatkestus vaikimise ajal ei loe.
- `tripSegments.test.ts`: kütuse lõpunäit ignoreerib 0 ja viimast 60 s.
- `tripImport.test.ts`: ümberarvutus säilitab kontrolli märke; kontrollitud vahe ei kao, kui märk langeb piiri alla;
  kontrollimata vahe kaob.
- `tripsApi.test.ts`: `gapBefore`, filter `gaps`, PATCH valideerimine.

## Väljas (YAGNI)

- Käsitsi tunnilugeja näit — kasutaja ei saa seda pakkuda.
- Seadistatavad piirid.
- Teavitused (e-post, push).
