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
| `potEvapMm` | mm päevas, potentsiaalne aurumine (positiivne arv) |
| `isFinal` | false = ERA5T esialgne |

### Seos põlluga

`FieldSeason.weatherPointId` (nullable). Arvutatakse hooaja geomeetria keskpunktist lähima andmetega ruuduna geomeetria salvestamisel ja ühekordse täitmisskriptiga olemasolevatele. Keskpunkti nihkumisel teise ruutu seos uueneb; uue punkti puudumisel luuakse see ja käivitub esmalaadimine.

Seos on hooajal (mitte põllul), sest geomeetria on hooajapõhine.

### Kultuuri baastemperatuur

- `Crop.gddBaseC Float @default(5)` — temperatuurisumma baas.
- Sama väli `CatalogCrop`-ile, et platvormi kataloogist loodud kultuurid saaksid õige vaikeväärtuse (nt mais 10).
- UI: kultuuride registri vormis väli „GDD baastemperatuur (°C)“.
- Sordi „vajalik temperatuurisumma valmimiseni“ **ei kuulu sellesse etappi** (etapp 2).

## Laadimine

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
