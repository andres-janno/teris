# ERA5 ilmaandmed — disain

Kuupäev: 2026-11-10
Staatus: kinnitatud arutelus, ootab ülevaatust

## Eesmärk

Anda Terisesse ajalooline ilm, et:

1. **(see etapp)** võrrelda hooaegu ja seostada saagikust ilmaga — majandi tasemel aastate võrdlus ja põllu hooaja ilmakokkuvõte;
2. **(järgmine etapp, mitte siin)** jälgida kultuuri arengut temperatuurisumma järgi.

Etapp 2 jääb välja, kuid andmemudel ja „külvist koristuseni“ arvutus ehitatakse nii, et etapp 2 saab neid otse kasutada.

## Allikas

- **ERA5-Land** (ruut ~9 km, 0,1° samm), Copernicus Climate Change Service (C3S), Climate Data Store (CDS).
- Litsents CC BY 4.0 — äriline kasutus lubatud viitega. Open-Meteo tasuta API ei sobi (ainult mitteäriline).
- Eelistatud andmestik: ERA5-Landi **punkti aegrida** (üks punkt, pikk periood, üks päring). **Esimene teostussamm on katse päris CDS kontoga**, mis kinnitab: kas punkti aegrida pakub kõiki vajalikke muutujaid (sh mullaniiskus kahes kihis ja potentsiaalne aurumine), mis vormingus vastus tuleb ja kui suure viitega andmestikku uuendatakse.
- Tagavara: tavaline ERA5-Land tunniandmete päring väikese ala (bounding box) kohta, vastuse (NetCDF/GRIB) lahtipakkimine serveris.
- CDS võti serveri `.env`-is.

### Katse tulemus

Katse tehti 2026-11-10 päris CDS kontoga (punkt 58,1 N / 25,8 E; skript `scripts/weather/cds-probe.mts`, näidised `src/server/weather/__fixtures__/`).

1. **Muutujad.** `reanalysis-era5-land-timeseries` **ei paku potentsiaalset aurumist** (`potential_evaporation`) ja mullaniiskuse muutujad on nimetatud `volumetric_soil_water_level_1` ... `_4` (mitte `_layer_`). Tundmatud muutujanimed **ei anna viga**: päring võetakse vastu (HTTP 201) ja tundmatu muutuja jäetakse vastusest vaikselt välja, seega klient peab kontrollima, et kõik küsitud veerud tulid. Saadaval on muu hulgas: `2m_temperature`, `2m_dewpoint_temperature`, `total_precipitation`, `snowfall`, `surface_solar_radiation_downwards`, `volumetric_soil_water_level_1..4`, 10 m tuul (u/v). Aurumist ei ole. Tavaline `reanalysis-era5-land` annab `potential_evaporation` (`pev`) NetCDF-ina (kontrollitud: üks tunniruut, `area` [58.15,25.75,58.05,25.85], `download_format: unarchived`, ~65 s). Otsus tuleb teha plaanis: kas aurumi asemel kasutada aegrea kiirgust ja temperatuuri (sh arvutatud evapotranspiratsioon) või lisada `pev` jaoks teine allikas.
2. **Vorming.** Vastus on **zip, mitu CSV-d**: iga CDS muutujagrupp (`sfc-2m-temperature`, `sfc-pressure-precipitation`, `sfc-radiation-heat`, `sfc-snow`, `sfc-soil-water`, `sfc-wind`) on eraldi fail, nimi `reanalysis-era5-land-timeseries-<grupp><juhuslik sufiks>.csv`. Igal failil on päis `valid_time,<muutujad>,latitude,longitude`: `t2m` ja `d2m` on ühes failis (`valid_time,d2m,t2m,...`), `swvl1,swvl2` ühes, `u10,v10` ühes, `tp` eraldi (`valid_time,tp,...`), `ssrd` eraldi, `sf` eraldi. Kombineerimine: lugeda iga CSV ja liita `valid_time` järgi (kõigil sama tunniread). Lat/lon on ujukomavigadega (58.100000000001394 / 25.800000000000097). Muutujagrupi failide valik sõltub küsitud muutujatest, seega parsimine tuleb teha **veeru nime, mitte faili nime järgi**. `valid_time` on kujul `YYYY-MM-DD HH:MM:SS`, ajatsooni märketa, UTC; 24 rida ööpäevas, 00:00..23:00.
3. **`tp` ei ole kumulatiivne.** Tunniväärtused kõiguvad üles-alla ega lähtesta ennast kell 01 UTC (nt 2025-06-10: 0,00091; 0,00080; 0,00058; 0,00025; ...). Aegrea andmestik annab seega juba tunnisademed. Päevasumma = 24 tunni summa. Tavalises `reanalysis-era5-land` on `pev` aga kumulatiivne alates 00 UTC: kell 00:00 on eelmise ööpäeva täissumma, kell 01:00 algab uus kogum (-1,96e-3 siis -4,35e-5 ... -5,57e-3, uuesti -3,06e-5). Selle puhul tuleb päevasumma võtta järgmise päeva 00:00 väärtusest (või ööpäeva 23:00 väärtusest) ja tunnipõhine väärtus on järjestikuste erinevus.
4. **Ühikud.** `t2m`, `d2m`: kelvin. `tp`, `sf`: meetrit (tunnis, vee ekvivalent); vahel tekib mikroskoopiline negatiivne väärtus. `ssrd`: J/m² tunnis (hourly, mitte kumulatiivne; öösel 0, päeval kuni ~2,3e6). `swvl1`, `swvl2`: m³/m³ (0,36–0,43). `pev` (era5-land): meetrid, **negatiivne** (ECMWF märgikonventsioon: aurumine on negatiivne).
5. **Värskus.** Päring `2026-10-31/2026-11-10` tagastas viimase reana **2026-11-04 23:00**, st viide on ~5–6 päeva (viimane täis päev = täna miinus 6). Klient peab küsima ainult kuni selle kuupäevani või taluma lühemat vastust. Latentsus: aegrea päring ~30–45 s (järjekord 20–25 s + töö), era5-land ~65 s. Võti: päis `PRIVATE-TOKEN`, 36-märgiline UUID. Litsentse tuleb CDS veebis nõustuda andmestiku kaupa (ilma selleta HTTP 403 "required licences not accepted").

## Andmemudel

Ilmaandmed on **ettevõtteülesed** (pole äriandmed): tabelitel puudub `tenantId` ja RLS; samas ruudus asuvad eri ettevõtete põllud kasutavad sama punkti.

### `WeatherPoint` (`weather_points`)

| väli | tähendus |
|---|---|
| `id` | |
| `lat`, `lon` | ERA5-Land ruudu keskpunkt (ümardatud 0,1° ruudustikule) — unikaalne paar |
| `hasData` | false, kui ruut on üle vee / andmeteta (siis seotakse lähim andmetega ruut) |
| `loadedFrom`, `loadedUntil` | laetud vahemik |
| `finalUntil` | kuni milleni andmed on lõplikud (ERA5T esialgsed päevad kirjutatakse hiljem üle) |
| `lastAttemptAt`, `lastSuccessAt`, `lastError`, `failCount` | laadimise olek |

### `WeatherDaily` (`weather_daily`)

Võti `(pointId, date)`. Päev = Tallinna aja kalendripäev, koondatud tunniandmetest.

| väli | ühik |
|---|---|
| `tMin`, `tMax`, `tMean` | °C |
| `precipMm` | mm päevas |
| `soilMoisture1` | m³/m³, kiht 0–7 cm |
| `soilMoisture2` | m³/m³, kiht 7–28 cm |
| `potEvapMm` | mm päevas, võrdlusaurumine **Makkinki valemiga** päikesekiirgusest (`ssrd`) ja päeva keskmisest temperatuurist (ERA5-Landi aegrida `pev`-i ei paku) |
| `isFinal` | false = ERA5T esialgne |

### Seos põlluga

`FieldSeason.weatherPointId` (nullable). Arvutatakse hooaja geomeetria keskpunktist lähima andmetega ruuduna **öise töö alguses** (kõik WEATHER-mooduliga ettevõtted) ja ilmavaate avamisel, kui leidub sidumata hooaegu. Salvestusteid (põllu salvestus, import, hooaja kopeerimine) ei muudeta — sidumine ei sõltu sellest, kust geomeetria tuli. Keskpunkti nihkumisel teise ruutu seos uueneb järgmisel ööl; uus punkt laetakse samas öises käigus.

Seos on hooajal (mitte põllul), sest geomeetria on hooajapõhine.

### Kultuuri baastemperatuur

- `Crop.gddBaseC Float @default(5)` — temperatuurisumma baas.
- Sama väli `CatalogCrop`-ile, et platvormi kataloogist loodud kultuurid saaksid õige vaikeväärtuse (nt mais 10).
- UI: kultuuride registri vormis väli „GDD baastemperatuur (°C)“.
- Sordi „vajalik temperatuurisumma valmimiseni“ **ei kuulu sellesse etappi** (etapp 2).

## Laadimine

- Laaditakse ainult `WEATHER` litsentsimooduliga ettevõtete punktid; `/api/weather/*` on juba selle mooduli all (`src/server/license.ts`). Seisuga 10.11.2026 on moodul kõigil kolmel ettevõttel.

- Taustatöö serveris, sama muster mis `src/server/tripImport.ts`: öine käivitus, olekukirje, vigade logimine.
- **Esmalaadimine:** uuele punktile andmed alates 01.01.2015, **aasta kaupa** eraldi päringutena (vea korral korratakse ainult seda aastat).
- **Igapäevane uuendus:** iga punkti kohta küsitakse päevad alates `finalUntil`-ist tänaseni; esialgsed päevad kirjutatakse lõplikega üle.
- Ebaõnnestumisel jäetakse vahele, järgmine öö proovib uuesti (puuduvad päevad tuvastatakse vahemikust). `failCount ≥ 3` → hoiatus admin-liideses.
- Admin-liides (admin.teris.ee): punktide nimekiri, laetud vahemik, viimane õnnestumine/viga, nupp „Lae uuesti“.

## Arvutused

Kõik kokkuvõtted arvutatakse päevaandmetest päringu ajal; kokkuvõtteid ei salvestata (külvikuupäeva muutus kajastub kohe).

Ühine funktsioon `summarizeWeather(days, { from, to, gddBaseC })` (puhas, testitav):

| näitaja | definitsioon |
|---|---|
| temperatuurisumma (GDD) | Σ max(0, tMean − baas) |
| sademed | Σ precipMm |
| vihmapäevad | päevad, kus precipMm ≥ 1 |
| veebilanss | Σ (precipMm − potEvapMm) |
| pikim kuiv periood | pikim järjestikuste päevade jada, kus precipMm < 1 |
| kuumapäevad | päevad, kus tMax > 28 |
| öökülmad | päevad, kus tMin < 0 (vt perioodid) |
| mullaniiskus | juurekihi (`soilMoisture2`) keskmine ja miinimum |
| andmed kuni | viimane olemasolev päev perioodis; kui < perioodi lõpp, näidatakse UI-s |

Majandi keskmine = punktide päevaväärtuste keskmine, enne kokkuvõtet.

### Perioodid

- **Kalendriperiood (majandi vaade):** 01.04–31.08 kokku + iga kuu eraldi. Öökülmad: aprill–juuni. Pikaajaline keskmine = 2015…eelmine täisaasta keskmised kokkuvõtted.
- **Külvist koristuseni (põllu hooaeg):** `seedingDate` → `harvestDate`; koristuseta → tänaseni. Öökülmad: külvist 60 päeva jooksul. Talivili (külv eelmisel aastal) — periood üle aastavahetuse, eraldi loogikat pole vaja (külmad päevad annavad GDD-sse 0). Ilma külvikuupäevata kokkuvõtet ei arvutata.

## Vaated

### „Ilm“ (majandi vaade)

Menüüs analüüsi/aruannete juures. URL `/weather`.

- Filtrid: ilmapunkt (vaikimisi majandi keskmine), GDD baas (vaikimisi 5). Filtrid `FilterClear`-iga.
- **Aastate tabel:** rida = aasta (2015…jooksev), viimane rida pikaajaline keskmine; veerud: sademed, GDD, veebilanss, pikim kuiv periood, kuumapäevad, öökülmad (apr–aug). Keskmisest oluliselt erinevad (±1 standardhälve) väärtused värviga (kuiv/märg, soe/jahe). Numbrid paremale joondatud.
- **Kuude jaotus:** valitud aasta kuude sademed ja GDD pikaajalise keskmise kõrval (tulpdiagramm).
- **Kumulatiivne graafik:** GDD ja sademete kasv 01.04-st, mitu aastat valitavalt kõrvuti.
- Jalus: „Allikas: Copernicus Climate Change Service, ERA5-Land. Andmed kuni pp.kk.aaaa.“
- Esmalaadimise ajal teade „Ilmaandmeid laetakse“.

### Põllu hooaja ilmaplokk

Põllu detailvaates iga hooaja juures: GDD (kultuuri baasiga), sademed, veebilanss, pikim kuiv periood, öökülmad pärast külvi — saagikuse kõrval. Külvikuupäevata: „Ilmakokkuvõte vajab külvikuupäeva“ + link sisestamiseks.

### Hooajavaate tabel

Valikulised veerud „GDD“ ja „Sademed“ (külvist koristuseni), sorditavad.

### AI ühendus (MCP)

Uus lugemistööriist `weather_summary`: periood või aasta(d), valikuliselt põld/hooaeg → kokkuvõtte näitajad. Lisatakse ka admin.teris.ee juhisesse.

## Vead ja piirjuhud

- CDS maas / järjekord ummikus → vahele, järgmisel ööl uuesti; midagi ei kao.
- Mitu ebaõnnestumist järjest → admin-hoiatus; kasutaja näeb „andmed kuni“.
- Ruut üle vee (`hasData = false`) → seotakse lähim andmetega ruut.
- Geomeetria muutus → seos ümber, vajadusel uus punkt ja esmalaadimine.
- Kuupäevad UI-s pp.kk.aaaa Tallinna ajas.

## Testimine

- Automaattestid (vitest) `summarizeWeather` jaoks fikseeritud päevaandmetega: GDD baasiga, kuiv periood, talivili üle aastavahetuse, puuduvad päevad / „andmed kuni“, majandi keskmine.
- Lähima ruudu leidmine, ruudu jagamine põldude vahel, veeruudu asendus.
- Tunniandmete koondamine Tallinna päevadeks (sh suveaja vahetus).
- CDS päring: käsitsi katse päris kontoga; automaattestides salvestatud näidisvastus.

## Väljaspool seda etappi

- Kultuuri arengu jälgimine (sordi vajalik GDD, arengufaasi hinnang) — etapp 2.
- Ilmaprognoos ja reaalajas otsused (pritsimisaken).
- Ilma salvestamine töökannete juurde.
