# Vaated uue stiilisüsteemi peale (etapp 4) — disain

Kuupäev: 2026-11-17. Eelnev: [2026-11-12-ui-uhtlustamine-design.md](2026-11-12-ui-uhtlustamine-design.md) (etapid 0–3c tehtud).

## Eesmärk

Kujundus on keskne: ühised komponendid (`src/components/ui`) + skaala ja värvinimed (`src/styles/app.css` `@theme`).
Vaatepõhine CSS (`src/index.css` 5207 + `src/styles/map.css` 1651 = 6858 rida) viiakse vaadetesse Tailwindi klassideks
või uuteks ühisteks komponentideks. Igapäevane kasutus ei muutu; hilisemad kujundusmuudatused tehakse ühest kohast.

## Kasutaja otsused (2026-11-17)

| Küsimus | Otsus |
|---|---|
| Lähenemine | **Segu**: korduvad mustrid → uued `ui/` komponendid; vaate oma paigutus → Tailwindi klassid otse vaates (ainult skaala); keerulised erijuhud → väike CSS |
| Väikesed erinevused sama mustri vahel | **Ühtlusta**: sama muster saab kõikjal ühe kuju (paar pikslit, üks kirjasuurus kaob). Suuremad muutused (paigutus, värv) näidatakse enne kasutajale |
| Praegused erandid | Jäävad erandiks (LoginPage unustatud-link ja login-kaart, MapView Leafleti hüpiku string, 4 pesastatud role=button kohta, file/range/color sisendid) |

## Lähtepunkt (mõõdetud 2026-11-17)

CSS-i read omaniku järgi: FieldWorksBoard 1149, FinanceModal 609, VehicleTracker 567, CultivationControl 414,
LayerControl 402, MapView 332, FieldManagerModal 281, FieldWorkEntryDialog 226, MapYearSelector 206, CropRegisterModal 193,
SatellitePanel 154, ülejäänud ~30 vaadet < 125 rida; mitme vaate ühised ~1000; põhireeglid (element/global) 567.
Tailwind skaneerib praegu ainult `src/components/ui` (`app.css`: `@source '../components/ui'`); preflight väljas.

## Etapid

Iga etapp (ja iga vaade etapis 4.2–4.8) = commit + release + pildid mõlemas teemas enne/pärast laiusel 1440 ja 1366.

### 4.0 Alus
- `app.css`: `@source` laieneb vaadetele (`src/components`, `src/admin`, `src/App.tsx` jms), testid ja `.md` välja.
- ui-audit laieneb vaadetele: suvalised väärtused (`p-[7px]`, `text-[13px]`) keelatud, vahed/kirjasuurused ainult
  skaalast (olemasolevad read „Keelatud suvalisi klasse“, „Skaalaväliseid vahe-klasse“ katavad nüüd ka vaated). Lubatud
  Tailwindi variandid (`hover:`, `aria-…:`, `data-…:`, `[&>td]:`) nagu `ui/`-s.
- Kihid jäävad: `exceptions` (index.css, map.css; 4g nimetas `legacy` ümber) < `utilities`. Kui vaate klass asendatakse utiliitidega, kustutatakse vana
  reegel samas commitis (mitte kaks võistlevat reeglit). Nähtav muutus: puudub.

### 4.1 Uued ühised komponendid
Inventuur: mustrid, mis korduvad ≥ 2 vaates. Esialgsed kandidaadid: vaate päis (pealkiri, alapealkiri, tegevused),
jaotise pealkiri (väike, suurtäheline, poolpaks), näitaja plaat (silt + suur number), rida „silt: väärtus“, legendi kirje
(värvitäpp, nimi, väärtus), tööriistariba. Iga komponent: `ui/`-s, variandid `variants.ts`-is, test, näide `/ui` lehel.
Olemasolevad kohad viiakse uute komponentide peale samas etapis; vanad klassid kustutatakse.

### 4.2–4.8 Vaated ükshaaval
1. Finantsid (proovivaade — lähenemise kontroll enne suuri vaateid)
2. Põllutööde tahvel
3. Tehnika ja sõidud (VehicleTracker, TripRouteView, TripDialog, TripRegister, DeviceAssignmentRegister)
4. Kaardi paneelid (LayerControl, MapYearSelector, CultivationControl, SatellitePanel)
5. Dialoogid (FieldManager, FieldWorkEntry, CropRegister, RelatedParties, SeasonManager, FieldEdit, AddFieldWork,
   FieldWorkPlanForm, PoiManager)
6. Päis, menüüd ja ülejäänud väikesed vaated (Header, OperatorSelector, UserMenu, WeatherView, LicenseBanner jt) + admin
7. Ühised ja põhireeglid — viimasena; järele jääb ainult see, mis peab CSS-is olema

Etapi sees: vaate klassid → Tailwindi klassid või ui komponendid; vana CSS kustutatakse; mõõdetakse ridade arv.

## Mis jääb CSS-i
Leafleti kaart, hüpikud (HTML-string väljaspool Reacti) ja ülekirjutused; kaardi märgised ja sildid; `@keyframes`
animatsioonid; keerulised valijad, mida utiliitidega ei saa mõistlikult väljendada; põhireeglid (body, kerimisribad,
teemamuutujad); praegused erandid.

## Reeglid
- Kõik väärtused skaalast; värvid ainult nimedega (`text-muted-foreground`, `bg-card` …), andmevärvid `dataColors.ts`-ist.
- `style={{…}}` ainult dünaamiliste väärtuste jaoks (nagu varem).
- Kirjapaksused: 400 tavaline, 500 keskmine (nupud, sildid, nimed), 600 poolpaks (pealkirjad, summad, suurtähtpäised).
- Ingliskeelsed identifikaatorid, eestikeelsed kommentaarid ja UI-tekst; numbrid paremale; Eesti kuupäevavorming.
- Valitud olekute ja põhinupu roheline #16a34a (kasutaja otsus) ei muutu.

## Edu mõõt
- `index.css` + `map.css` kokku ≤ ~2000 rida (praegu 6858).
- ui-audit: vaadetes 0 suvalist väärtust ja 0 skaalavälist klassi; kõik senised read 0 nagu praegu.
- Kasutajale nähtav muutus ainult ühtlustamisest (paar pikslit); paigutus ja värvid samad.
- Tulemus 2026-11-21: `src/styles/*.css` (ilma `app.css`-ita) 6858 → 891 rida; ui-audit kõik 0 (v.a „Skaalaväliseid vahesid (CSS)“ 3: kaardi virna padding 40/44/56, kasutaja otsusel jäetud).

## Kontroll
`tsc`, täis `vitest`, `oxlint`, `npm run ui-audit -- --details`; pildid `scripts/shot.mts` (Inter kirjatüüp, mõlemad
teemad, 1440 ja 1366). Tööviis: plaan → SDD (implementeerijad ja ülevaatused Sonnet, kordusülevaatused Haiku), iga
ülesande ülevaatus, lõpuülevaatus, raport eesti keeles.

## Riskid
- Utiliit vs vana reegel samal elemendil: `exceptions` kiht (varem `legacy`, 4g nimetas ümber) kaotab `utilities`-ile, aga `!important` vanad reeglid võidavad —
  need kustutatakse samas sammus.
- Suured vaated (FieldWorksBoard, VehicleTracker) — pikad klassiread; korduv osa → alamkomponent vaate failis või ui
  komponent.
- Tumeda teema erireeglid (`[data-theme='dark'] .x`) → värvinimed, mis teemaga ise muutuvad; kui nimi puudub, lisatakse
  `@theme`-sse.
- Pildid serveris Interiga — paksused ja laiused lähedased, mitte pikslitäpsed Maci SF Pro'ga.
