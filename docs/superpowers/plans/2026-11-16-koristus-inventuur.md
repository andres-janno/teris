# Koristusetapi (3) inventuur (2026-11-16)

Kaardistatud serveri koodist (HEAD `876ae54`): `src/` all kõik `.tsx`/`.ts`/`.css` failid, `scripts/ui-audit.mts`, `src/components/ui/`, `dist/assets/*.css`. Midagi ei ole muudetud ega brauseris proovitud. Arvud on skriptidega loetud (postcss-parsimine, JSX-sildi läbikäik); "kasutuseta" ja "kontrast" on arvutatud, mitte vaadatud. Kontrastsus on WCAG 2.x valemiga tokenite väärtustest (`index.css` `:root` / `[data-theme="dark"]`, `styles/app.css` `@theme`).

## Baas (`npm run ui-audit -- --details`, HEAD `876ae54`)

| Mõõdik | Praegu | Eesmärk (spec) |
|---|---|---|
| Erinevaid kirjasuurusi (CSS) | 39 | ≤ 6 |
| Erinevaid nurgaraadiusi (CSS) | 10 | ≤ 4 |
| Erinevaid vahe-väärtusi (CSS) | 32 | ainult skaala (2, 4, 6, 8, 10, 12, 16, 24, 32) |
| Erinevaid värvikoode (CSS) | 232 | tokenid + andmevärvid |
| `style={{…}}` kohti (tsx) | 126 | ainult dünaamilised |
| Värvikoode (tsx) | 55 (17 faili) | ainult andmevärvid |
| Kirjasuurusi inline (tsx) | 5 (0.72rem, 0.8rem, 12px, 13px, 16px) | 0 |
| Vanu komponendiklasse (CSS) | 6: `.btn .btn-alert-action .btn-full .btn-pick-map-highlight .btn-secondary .btn-sm` | 0 |
| Vanu nupu/modaali/tabeli/märgi/välja/menüü/kaardi klasse (tsx) | 0 | 0 |
| `index.css` | 7 758 rida | ~2 000 |

Teised failid: `admin/admin.css` 271, `landing/landing.css` 249, `App.css` 184, `styles/app.css` 109.

**Oluline pimeala:** `scripts/ui-audit.mts:8` jätab mõõtmisest välja `src/admin`, `src/landing` ja `src/styles` ("ülemineku ulatusest väljas"). Seetõttu näitab audit "vanu nupuklasse 0" ja "vanu tabeleid 0", kuigi **admin kasutab 47 korda `btn btn-*`, 14 toorest `<table>`, 24 toorest `<input>`, 4 `<select>`, 4 `<textarea>`, 30 `form-input`** (loendatud `src/admin/*.tsx`-ist). `index.css`-i `.btn`/`.btn-secondary`/`.btn-sm` on ainult adminil alles. Admin kasutab sama `index.css`-i. Vt "Küsimused kasutajale" 5.

---

## 1. Toored nupud ja ikoonnupud

Väljaspool `ui/` on `<button` 108 kohas. Rakenduses (ilma adminita) 59, adminis 49. Neist ei ole ükski ui `Button` (ui `Button` on `Button.tsx`; suurused `sm 28px`, `md 32px`, `icon-xs 20px`, `icon-sm 28px`, `icon 32px`, `auto`; variandid `primary/secondary/ghost/danger/danger-ghost/filter`). Ui `Button` annab tekstita nupule (`size=icon*` + `title`) rakenduse tooltipi (`iconTooltip`) natiivse `title` asemel. Seda tooltipi toored nupud ei saa.

### 1A. Tekstita ikoonnupud (peamine sihtmärk)

| Perekond | Kus (fail:rida) | Praegune välimus (`index.css`) | Sobiv ui variant | Märkused / risk |
|---|---|---|---|---|
| `.icon-toggle` ×7 | `LayerControl.tsx:157,198,265,294,388,413,439` | `index.css:768`: läbipaistev, ilma äärise ja polstrita, hall ikoon, kursor pointer. Suurus = ikooni suurus (~16px). `title` = Peida/Näita, **`type` puudub** (vaikimisi submit), `aria-label` puudub | `ghost` + `icon-xs` (20px) | Silmaikooni vahetus on olek (nähtav/peidetud). Ainult `title` muutub, `aria-pressed` puudub. Risk: Button annab tooltipi ja 20px hit-ala vs. praegune ~16px, kihi rida võib muutuda kõrgemaks |
| `.fw-add` ×12 | `FieldWorksBoard.tsx:965,976,993,1005,1023,1040,1050,1069,1086,1109` (+2) | `index.css:5774`: 30px lai, min-kõrgus 40px, katkendjoonega ääris `--border-color` (**määratlemata muutuja**, vt 10), `border-radius:7px`, hõljudes täisroheline taust, valge plus | ei sobi otse. Uus `variant="dashed"` + suurus (30×40) või jätta vaate-klassiks (tahvli lahter) | See on "tühi lahter, kuhu töö lisada", mitte ikoonnupp. Soovitus: jätta kaardi/tahvli erijuhuks, aga kasutada ui `Button asChild`-i või uut `dashed` varianti |
| `.fw-card-add` | `FieldWorksBoard.tsx:183` | `index.css:5544`: 18×18px, `position:absolute`, r 4px, läbipaistmatus .6, hõljudes roheline taust | `ghost` + `icon-xs` (20px) | Nähtav ainult kaardi hõljutamisel (`.fw-card-wrap:hover`). Positsioon jääb klassi |
| `.fw-field-shape-btn` ×3 + `.year-shape-btn` ×1 | `FieldManagerModal.tsx:517,618`; `FieldsTableView.tsx:364`; `FieldWorksBoard.tsx:871` | `index.css:5413`: padding 3px, r 4px, hall ikoon (`--text-muted`), hõljudes roheline + `--btn-sec-hover` taust; `.corner` (`:5354`) = absoluutne 6/6; `.year-shape-btn` (`:3074`) `margin-left:auto` | `ghost` + `icon-xs` | Kõige selgem sobivus. Risk: `name-cell.has-corner-btn` (`:5360`) reserveerib `padding-right:30px`, tuleb kontrollida |
| `.cc-play` | `CultivationControl.tsx:261` | `index.css:1492`: 40px ümmargune, roheline `--emerald-600`, valge ikoon, vari, hõljudes `scale(1.05)` | `primary` + uus `size="icon-lg"` (40px, `rounded-full`) | Ainus 40px ümmargune nupp. Kas teha uus suurus või jätta |
| `.cc-icon-btn` | `CultivationControl.tsx:271` | `index.css:1517`: `--cc-h` (kõrgus muutuja), ääris, `--stat-bg` taust, hall ikoon | `secondary` + `icon` (32px) | `--cc-h` väärtus tuleb vaadata; kui ≠ 32px, tekib 1–4px nihe |
| `.cc-start-reset` | `CultivationControl.tsx:316` | `index.css:1569`: padding 2px, ümmargune, hall X, hõljudes `#ef4444` | `ghost` + `icon-xs` + `danger-ghost` hover | Ainus nupp, mille hõljutus on punane |
| `.admin-rte-tool` ×1 JSX (~10 kasutust) | `admin/RichTextEditor.tsx:41` | `admin.css:227`: 30×30px, r 6px, läbipaistev | `ghost` + `icon` (32px) | Admin. `onMouseDown preventDefault` jääb. Aktiivset olekut pole |
| HelpHint (?) | `HelpHint.tsx:92` | Kasutab `ui/variants.helpHintTriggerClass` (24px, `rounded-full`) | juba ui klassid | Korras, ainult `<button>` kasutab klassi otse. Valikuline |

### 1B. Ikoon + lühike tekst (väikesed tegevusnupud)

| Perekond | Kus | Välimus | Sobiv |
|---|---|---|---|
| `.mini-swap-btn` ×2 ("Vaheta") | `VehicleTracker.tsx:1366,1386` | `index.css:1887`: padding 2/6, font .68rem, r 4px, ikoon 11px + tekst, ääris `--btn-sec-border`; hõljudes roheline ääris | `secondary` + uus `size="xs"` (20–22px, `text-2xs`) |
| `.v-action-btn` ×2 ("Sim", silm) | `LayerControl.tsx:339,351` | `index.css:3901`: padding 3/6, font .64rem, r 4px, ääris, `.active` roheline; `.v-map-btn` ainult ikoon | `secondary`/`ghost` + `size="xs"`; **aktiivne olek** (`aria-pressed`) |
| `.basemap-btn` (aluskaardi valik) | `LayerControl.tsx:112` | `index.css:610`: r 6px, `--basemap-active-*` toonid, `.active` roheline | `ToggleGroup`/`Tabs variant="segmented"` või `Button` + pressed-olek |

### 1C. Lingina käituvad tekstinupud

`.cc-link-btn` ×2 (`CultivationControl.tsx:247,298`, `index.css:1461`, roheline tekst, kõrgus `--cc-h`); `.assign-hint-link` ×2 (`VehicleTracker.tsx:1253`, `DeviceAssignmentRegister.tsx:392`, `index.css:7217`); `.login-forgot-link` (`LoginPage.tsx:80`, `index.css:4441` ja `:4561`, kaks reeglit); **`.link-button` (`WeatherSeasonSection.tsx:75`) — klassil pole ühtegi CSS-reeglit** (nupp näeb välja nagu brauseri vaikenupp). Sobiv: uus `variant="link"` (roheline tekst, ilma äärise, hõljudes allajoon).

### 1D. Valitavad kaardid, filter-kiibid, nav (suuremad)

`finance-entry-card` (`FinanceModal.tsx:488`), `fw-card` (`FieldWorksBoard.tsx:128`), `register-crop-stat` ×1 ja `reg-stat-pill is-filter` ×2 (`FieldManagerModal.tsx:329,352,362`), `telemetry-suggestion-pill` (`FieldWorkEntryDialog.tsx:457`), AddFieldWorkDialog valikud (`:124`, `aria-pressed` olemas), `fw-finance-chip-btn` (`FieldWorksBoard.tsx:1292`, mähib Badge'i), `trip-dialog-entry` (`TripDialog.tsx:236`, lingina tekst + kuupäev), `soil-row-year` (`SoilSamplesSection.tsx:89`, rea lahtivõtmine), Header nav ×11 (`Header.tsx:87–179`, `aria-current` olemas). Need ei ole nupud, vaid klõpsatavad kaardid/kiibid; `ui/Card interactive` (`button[data-slot="card"]` reegel `app.css`-is) katab osa. Soovitus: tegeleda ainult siis, kui ülesanne 4 jääb lihtsaks; jätta eraldi küsimuseks.

### 1E. Admin `btn btn-*` ×47

`AdminApp.tsx:49–79` (10, navi + väljalogimine), `CatalogView.tsx` (17), `TenantDetail.tsx` (6), `HelpView.tsx` (5 + `admin-help-item` valikurida), `NewTenantForm.tsx`, `AiInstructionsView.tsx`, `LoginView.tsx`, `TenantsView.tsx`, `InterestView.tsx`, `DevicesView.tsx`, `WeatherAdminView.tsx`, `LandingStatsView.tsx`. Kõik on tekstinupud: `btn-primary` → `primary`, `btn-secondary` → `secondary`, `btn-danger` → `danger`, `btn-sm` → `size="sm"`; navinupud `className="btn btn-secondary active"` → `Tabs`/`ToggleGroup`. Mehaaniline, aga ainult kui admin on ulatuses (küsimus 5).

### 1F. Mida ui `Button` vajab (ettepanek)

1. `size="icon-lg"` (40px ümmargune; ainult `cc-play`) või jätta `cc-play` erijuhuks.
2. `size="xs"` (20–22px, `text-2xs`, padding 6px) mini-nuppudele.
3. `variant="link"` (roheline tekst, ilma polstrita).
4. Pressed-olek: `aria-pressed:` ja `data-[state=on]:` stiil (roheline taust/tekst) variantidele `ghost` ja `secondary`. Ilma selleta ei saa `icon-toggle` ega `v-action-btn.active` üle viia.
5. Ikoonnupu suurus on hetkel 3 (`xs 20`, `sm 28`, `icon 32`); toored on 16–40px. Kui kõik ühtlustada, muutub nähtav tihedus (küsimus 1).

---

## 2. Inline stiilid (`style={{`)

Kokku 126 audit-kohta (minu läbikäik leidis 128 sh mitmerealised). Lisaks 11 kohta `style={muutuja}` / tingimuslik objekt (`App.tsx:1829`, `PriaLinesEditor.tsx:170–272` ×6 `grid`/`OBS_GRID`, `FieldManagerModal.tsx:607`, `RelatedPartiesModal.tsx:493`, `MapView.tsx:1053`, `CropRegisterModal.tsx:757,818`) — need on dünaamilised. `ui/` all 5 (`FilterSelect` ×2, `Badge`, `DateInput`, `FilterSelect:180`), kõik dünaamilised.

Heuristika (ainult literaalväärtused = staatiline): **43 dünaamilised, 85 staatilised** (±3 piirjuhtumit, nt `FieldEditDialog.tsx:472` on staatiline kuju + dünaamiline värv).

### 2A. Dünaamilised, jäävad (~43)

| Rühm | Failid |
|---|---|
| Andmevärv (`color`, `backgroundColor`, `--crop-color`, `borderColor`) | `VehicleTracker.tsx:1308,1309`; `FieldManagerModal.tsx:333`; `FieldsTableView.tsx:387`; `MapYearSelector.tsx:134,151`; `SoilSamplesSection.tsx:93,99,114`; `LayerControl.tsx:235`; `FieldMapCard.tsx:29`; `SatellitePanel.tsx:411,420,434,443,461`; `FieldWorksBoard.tsx:894,926,1156`; `AddFieldWorkDialog.tsx:104`; `MapView.tsx:1098`; `admin/CatalogView.tsx:367`; `FieldEditDialog.tsx:472` |
| Arvutatud laius / flex-grow / vasak-ülemine (%, px) | `CultivationControl.tsx:327`; `FieldWorkEntryDialog.tsx:423`; `FieldWorksBoard.tsx:1255`; `MapView.tsx:1086`; `SatellitePanel.tsx:387,414,437`; `TripDialog.tsx:181`; `FieldContextMenu.tsx:63`; `admin/VisitsChart.tsx:118`; `PriaLinesEditor.tsx:224,240` (`gridColumn: span N`) |
| Taustapilt / gradient andmetest | `LoginBackdrop.tsx:96`; `LayerControl.tsx:226`; `SatellitePanel.tsx:411,434` |

### 2B. Staatiline layout/tekst (~85), asendatav klassiga

| Muster | Arv | Failid |
|---|---|---|
| **Gridi koht tahvlis** `gridColumn/gridRow` literaalid | 25 | `FieldWorksBoard.tsx:764,767,770,865,954,961–1122` (kõik `fw-cell` `N / M`). Asendus: modifikaatorklassid (`.fw-c3`, `.fw-r2`) või `data-col` atribuut. Mitte Tailwind (vaadet ei skaneerita) |
| **Filtririba (identne kolmes failis)** `display:flex; flexDirection:column; gap:16px` + `{flex, center, gap 6}` + "Filtrid:" (13px/600) + `minWidth 150–200px` ×2–4 + `marginLeft:auto` | 29 | `VehicleTracker.tsx:1790–1850`, `DeviceAssignmentRegister.tsx:177–228`, `TripRegister.tsx:127–187` |
| **Tühi olek** `textAlign:center; padding:40px; color:--text-muted` + ikoon `opacity .4` + pealkiri 16px/600 + `p` 13px | 12 (4 + 4 + 4) | `VehicleTracker.tsx:1858–1867`, `DeviceAssignmentRegister.tsx:236–245`, `TripRegister.tsx:195–202` (+ `RelatedPartiesModal.tsx:595,596`) |
| Peidetud failisisend `display:'none'` | 3 | `FieldUploadModal.tsx:196`, `FieldBookUploadModal.tsx:128`, `SoilSampleUploadModal.tsx:109` (asendus: atribuut `hidden` või `sr-only` klass, mis on juba olemas) |
| Alampäise ülaveeris `marginTop:16px` (`form-sub-header`) | 4 | `RelatedPartiesModal.tsx:307,337`, `FieldEditDialog.tsx:428,623` |
| Veabänneri alaveeris `marginBottom:16px` (`auth-error-banner`) | 2 | `VehicleTracker.tsx:1188`, `DeviceAssignmentRegister.tsx:354` |
| Summutatud tekst (`color:var(--text-muted/secondary/primary)` ± `fontSize`) | 10 | `RelatedPartiesModal.tsx:419,595,596,658`; `FieldEditDialog.tsx:535`; `CropRegisterModal.tsx:914`; `AddFieldWorkDialog.tsx:137`; `VehicleTracker.tsx:1701`; kolm `h4/p` eri failides |
| Jaluse nupu `marginRight:auto` | 2 | `TripDialog.tsx:274,277` (asendus `DialogFooter` vasakpoolne slot või klass) |
| Sulgemisvärv nupule (`#dc2626` ikoon) | 2 | `FieldWorksBoard.tsx:916,948` (asendus: `Button variant="danger-ghost"` või klass) |
| Muu üksik (alert-boxi flex, `<p marginTop:0>`, `borderTop 4px` dialoogil, `opacity .4` jne) | ~9 | `AuthGate.tsx:162`, `TripGapReviewDialog.tsx:38`, `CropRegisterModal.tsx:584`, `FieldUploadModal.tsx:251,267`, `VehicleTracker.tsx:1562` |

### 2C. Nimetamist vajavad korduvad mustrid

1. **`FilterBar`** (ui või vaate-komponent): `Card` + flex wrap + "Filtrid" ikoon + lapsed + `marginLeft:auto` tühjenda/värskenda. Kolm koopiat → üks komponent. Kolm koopiat (`history-filter-bar`, `implement-history-section`) on kaardi-inventuuris (2026-11-15) juba nimetatud.
2. **`EmptyState`** (`icon`, `title`, `description`): 4 koopiat + `empty-register-state` (`index.css:3619`).
3. **`MutedText`/`Hint`**: `color` + `fontSize` kombinatsioon (10 kohta).
4. **`<input type="file" hidden>`**: 3 kohta, ühine `HiddenFileInput`.

---

## 3. Värvikoodid `.tsx`/`.ts` failides

Audit loeb 55 kohta `.tsx` failides (17 faili). Kui lisada `.ts` failid (`services/`, `types/`, `server/`, `components/MapMarkers.ts`), on hex/rgb stringe rohkem kui 150. Allpool klassifikatsioon.

### 3A. UI-värvid, peaksid olema tokenid (~12 kohta)

| Kus | Praegu | Soovitus |
|---|---|---|
| `FieldWorksBoard.tsx:916,948` | `<Trash2 style={{ color: '#dc2626' }}>` | `text-destructive` / `danger-ghost` |
| `FieldWorkEntryDialog.tsx:572` | `#ef4444`, `rgba(239,68,68,.08)` veastaatus | `aria-invalid` või `destructive` token |
| `FieldEditDialog.tsx:494,685` | `var(--emerald-500, #10b981)` + terve `Button` stiil ära kirjutatud (`background:transparent; border:none; padding:2px` …) | kustuta ülekirjutus, `ghost icon-sm` annab sama |
| `FieldEditDialog.tsx:478` | `border:1px solid rgba(0,0,0,.2)` värvipunkt | `border-border` |
| `FinanceModal.tsx:815,821,827,833` | `#0284c7 #d97706 #ea580c #16a34a` legendipunktid | on graafiku seeria värvid; vt 3B (andmevärv, aga peab vastama graafiku CSS-ile) |
| `LayerControl.tsx:241` | `#94a3b8` "määramata" värvipunkt | andmevärv (`UNDETERMINED_CROP_COLOR`) |
| `TripDialog.tsx:48,49,58,67` | `#10b981 #ef4444 #16a34a #3b82f6` Leaflet markerid | Leaflet (spec: välja jäetud), tuua `mapColors`-i |
| `LoginBackdrop.tsx:71–73`, `landing/dust.ts:63–65` | `rgba(255,238,190,..)` jne tolmu-animatsioon | dekoratiivne, jääb (sama kood kahes failis) |

### 3B. Andmevärvid (jäävad, aga hajutatud)

| Palett | Kus | Märkus |
|---|---|---|
| Kultuurivärvid (nimi → hex) | `services/cropColors.ts:76–90` (14), `types/crop.ts:56–87` (6 kategooriat + `bgColor` rgba), `server/apiHandler.ts:369,391,1018,1655,1670` (vaikeväärtus `#eab308`/`#10b981`) | kolm erinevat kultuuripaletti |
| **"Vaikimisi kultuuri värv" `#eab308`** | `App.tsx:1475`, `apiHandler.ts` ×4, `CropRegisterModal.tsx:67`, `FieldEditDialog.tsx:82`, `FieldWorksBoard.tsx:359`, `admin/CatalogView.tsx:67`, `types/crop.ts:56` | **11 koopiat** |
| **"Määramata" `#94a3b8`** | `server/fieldSeasonCopy.ts:4` (`UNDETERMINED_CROP_COLOR`), `FieldEditDialog.tsx:23` (teine koopia), `FieldManagerModal.tsx:188,259`, `MapView.tsx:354`, `LayerControl.tsx:241`, `types/fieldRegister.ts:83`, `types/soilSample.ts:147,151` | **9 koopiat**, osa neist ei impordi `fieldSeasonCopy.ts`-i konstanti |
| **"Roheline `#22c55e`"** (vaikimisi uus mark/sõiduk) | `MapMarkers.ts:25`, `VehicleTracker.tsx:285,562`, `FieldManagerModal.tsx:263`, `FieldEditDialog.tsx:190`, `FieldMapCard.tsx:29`, `MapView.tsx:567,613` | 8 |
| Mulla näitajate läved (punane/kollane/roheline) | `types/soilSample.ts:55–111` (`#dc2626 #eab308 #16a34a` ×7 mõõdet) | kordab UI olekuvärve |
| NDVI/satelliit | `services/ndvi.ts:60–62`, `services/satelliteLayer.ts:31–54`, `SatellitePanel.tsx:27–31` (`rgb(...)` legendid, kaks eri versiooni "Paljas haritud muld") | legend peab vastama WMS-kihile |
| Ilma seeriad | `services/weatherFormat.ts:30` (8 värvi) | |
| Töö faasivärvid | `types/fieldWork.ts:24–27` (`#1d4ed8 #15803d #7c3aed #9a5b00`) | **kasutatakse tekstivärvina** (`fw-panel-phase`, `add-work-phase-label`), vt kontrast 6 |
| POI tüübid | `components/MapMarkers.ts:74–79` (bg + border) | |
| Osapoole rolli värvid | `types/party.ts:41–65` | |
| Kaardi kihi stiilid | `MapView.tsx:372,564–623,835`; `FieldShapeModal.tsx:34` | Leaflet |

Soovitus: `src/theme/dataColors.ts` (või `types/colors.ts`) ühe moodulina — `DEFAULT_CROP_COLOR`, `UNDETERMINED_COLOR`, `DEFAULT_MARKER_GREEN`, `STATUS_COLORS {bad, warn, good}`, `PHASE_COLORS`, `MAP_COLORS`. Server (`apiHandler.ts`) ja klient jagavad `fieldSeasonCopy.ts`-i juba, seega sama kohta võib panna.

### 3C. CSS-is (info)

232 erinevat värvikoodi CSS-is (rgba toonid enamik: `rgba(34,197,94,…)` 17 erinevat läbipaistvust, `rgba(16,185,129,…)` 10, `rgba(245,158,11,…)` 9, `rgba(148,163,184,…)` 7, `rgba(239,68,68,…)` 4). Neile on lahendus `color-mix(in srgb, var(--emerald-500) 15%, transparent)` (`index.css`-is on 31 kasutust juba).

---

## 4. Defineerimata `text-*` värviklassid

Kontrollitud: `index.css`, `admin.css`, `App.css`, `landing.css`, `styles/app.css`, ehitatud `dist/assets/ui-*.css`. Vaated pole Tailwindi skaneerimises, seega ei genereeri Tailwind neid kunagi (ja `--color-*: initial` tõttu poleks `text-emerald/blue/amber/rose/purple` Tailwindis ka olemas). **Git ajaloos (`-S`) pole `.text-emerald`, `.text-blue`, `.text-amber`, `.text-rose` ega `.text-purple` kunagi CSS-is olnud**; `.text-muted` oli ainult üks scoped reegel `.trip-dialog-fields .text-muted { font-size: 11px }` (eemaldatud `6aa04a0`, 2026-11-14).

Kasutused `className`-ides (var(--text-muted) ja `text-muted-foreground` välja arvatud): **~109**.

| Klass | Kasutusi | Defineeritud? | Mida autor ilmselt tahtis | Praegu mida näeb kasutaja |
|---|---|---|---|---|
| `text-emerald` | 66 (23 faili; VehicleTracker 13) | ei | roheline `--emerald-500` (`text-primary`). Kasutus: `DialogHeader icon` (~40), väikesed silt-ikoonid, `<strong className={ignition ? 'text-emerald' : 'text-muted'}>` (`VehicleTracker.tsx:1689`, oleku värv) | `DialogHeader` ikooni ümbris ei anna värvi (`Dialog.tsx:105`), seega **ikoon on hall/must nagu tekst**, mitte roheline |
| `text-muted` | 22 (`FinanceModal` 8, `VehicleTracker` 8, `PoiManagerModal` 6, `TripRegister`, `DeviceAssignmentRegister` ×2, ...) | ei (Tailwindis on `text-muted` taust-toon!) | hall abitekst = `text-subtle` või `muted-foreground` | tavaline tekst täisvärvis |
| `text-blue` | 13 (kalendriikoon ×6: `ArticlesView:177`, `CropRegisterModal:355`, `FieldManagerModal:384`, `FieldsTableView:256`, `FieldWorksBoard:694`; `Radio` ikoonid; `FieldManagerModal:371` `sub-val text-blue`) | ei | sinine `--blue-500` = `text-info` | tavaline tekst |
| `text-amber` | 2 (`VehicleTracker:1428` kütus, `RelatedPartiesModal:594` hoiatus) | ei | `text-warning` | tavaline tekst |
| `text-rose` | 2 (`VehicleTracker:1985,2030` `Unlink`) | ei | `text-destructive` | tavaline tekst |
| `text-purple` | 1 (`VehicleTracker:1444`) | ei | `text-accent` | tavaline tekst |
| `text-secondary` | 1 (`VehicleTracker:1701`) | ei (Tailwindis ei ole olemas, aga `bg-secondary` on) | `text-muted-foreground` | tavaline tekst |
| `text-slate-400` | 2 (`FieldEditDialog:323`, `SeasonManagerModal:135`, lukuikoon) | ei | `text-subtle` | tavaline tekst |
| `text-xs` | 2 (`FinanceModal:592,844`) | **jah, juhuslikult** (`ui/` kasutab `text-xs`, seega Tailwind genereerib selle: 12px) | 12px | töötab |
| `text-primary` | 1 (+ `ui` kasutab) | **jah, juhuslikult** | roheline | töötab |

Märkus: `text-primary`/`text-xs` töötavad ainult seni, kuni `ui/` neid kasutab. Kui `ui/` lakkaks neid kasutamast, kaoksid ka vaadetest.

**Visuaalne muutus kui parandada**: dialoogi päiste ikoonid (~40) muutuvad roheliseks, abitekstid hallideks, kalendriikoonid siniseks. See oli autori kavatsus, aga rakendus on nii kuvanud kuid. Vt küsimus 6.

Soovitus: ei defineerida vana nimega `.text-emerald` CSS-is (sünnitaks segadust Tailwindi nimedega), vaid asendada klassid ui nimedega kas `Icon` komponendi kaudu (`<Icon className="text-primary">`) või lisada `DialogHeader`-ile ikoonivärv ühes kohas (siis kõik 40 saavad rohelise ilma muutmata, ainult eemaldada `text-emerald` märkused).

---

## 5. Pseudo-tabelid

### 5A. `SoilSamplesSection` (`components/SoilSamplesSection.tsx:73–135`)

Struktuur: `div.soil-table` (flex veerg, ääris, r 6) > `div.soil-row.soil-row-head` (päis: Aasta, Punkte + 7 mõõdet) > iga aasta `button.soil-row.soil-row-year` (klõps = lahti, summaarsed keskmised) > lahti võetuna `div.soil-row.soil-row-point` ridu > `div.soil-footnote`. CSS (`index.css:1070–1140`): `.soil-row {display:grid; grid-template-columns:1.6fr .8fr repeat(7,1fr); gap:4px; padding:5px 8px; font-size:.74rem; text-align:right}`, esimene veerg vasakul.

ui Table sobivus: **sobib**. `TableHead numeric` / `TableCell numeric` asendavad `.soil-row` grid-i; aasta rida = `TableRow onClick` + chevron; punktirida = `TableRow tone="muted"`; jalus = `TableFooter` või rida `colSpan`. Märk: lahtivõtmine on praegu `<button>` (klaviatuurile ligipääsetav), `TableRow onClick` ei ole (vt 7), seega ülesanne peaks lisama klahvikäsitluse `TableRow`-le või panema chevron-nupu esimesse lahtrisse. Tulemuse värvid (`getSoilMetricColor`) jäävad inline-stiilina. Risk: kitsas ala (põllu detailpaneel, 9 veergu) → `Table scroll="x"`, `dense`.

### 5B. `WeatherSeasonSection` (`components/WeatherSeasonSection.tsx:78–111`)

Sama `soil-table` + `soil-row-head weather-season-row` (8 veergu: Hooaeg, Periood, GDD, Sademed, Veebilanss, Kuiv per., Öökülm, Saak), `WeatherRow` komponent (sama klassid), `.soil-row.weather-season-row {grid-template-columns: minmax(0,1.4fr) max-content repeat(6,minmax(0,1fr))}` (`index.css:7729`), `.weather-season-past` (`:7732`, ülemine joon, hall), `.soil-footnote`. Päisel `title`-id (vihjed).

ui Table sobivus: **sobib**. Päiselahtritel `title` jääb; `current` rida `selected`; "kaldkirjas periood" `tone="muted"` + `italic`. Ühine alus Soil + Weather: üks `MiniTable` ümbrus (`Table dense bordered`). **Ühiselt viiakse üle, siis kustuvad `.soil-table`, `.soil-row*`, `.soil-footnote`, `.weather-season-*` (~70 rida).**

### 5C. Teised div-ridadega "tabelilaadsed"

| Koht | Struktuur | ui Table? |
|---|---|---|
| `PriaLinesEditor.tsx:170–272` (`pria-grid`, `pria-grid-head`) | **muudetavad read** (sisendväljad rida kohta, kokkuvõtterida) | ei, redigeeritav vorm; võiks `Table` aga `Input` lahtrites + "lisa rida" — vaheküsimus |
| `FieldEditDialog.tsx` `edit-cad-grid` (`index.css:4009`, 6 veergu) | katastriüksuste muudetavad read | sama (muudetav, ei ole kuvatabel) |
| `FieldWorksBoard.tsx` `fw-grid` / `fw-row-container` (11 veergu) | tööde tahvel (ajajoon, mitte tabel) | ei |
| `fw-entry-grid` (`index.css:5998`, 5 veergu) | kannete read tööpaneelis | võimalik, aga paneel on kitsas; madal prioriteet |
| `harvest-lot-add-weighing/cost` (`:7499,7500`) | lisamisvormi rida | ei |
| `.trip-details`, `.weather-credential-status dl` | `dl` võtme-väärtuse paarid | ei (definitsioonilist) |
| `FinanceModal` `finance-entry-card` loend | kaartide loend | ei |
| **Admin** 14 toorest `<table className="admin-table">` | `AuditView`, `LandingStatsView` ×4, `CatalogView` ×3, `DevicesView` ×2, `TenantDetail`, `InterestView`, `WeatherAdminView`, `TenantsView` | sobib (kui admin ulatuses): `admin.css:165–170,265–266` kustub |

---

## 6. Kontrastivõlg

Arvutatud tokenitest (WCAG 2.x suhe). `!` = < 4.5 (tavaline tekst), `!!` = < 3 (ka suure teksti/ikooni piir ei täitu). Kaart = `--bg-surface` (hele `#fff`, tume `#0f172a`). Soft märk = toon 15% kaardi taustale (`Badge soft`, `variants.ts:63–69`).

### Hele teema

| Paar | Suhe | Kus kasutatakse |
|---|---|---|
| `text-subtle` `#94a3b8` kaardil | **2.56 !!** | `--text-muted`: placeholder, abitekst, `text-subtle`; ka sisestusvälja placeholder (`#f8fafc`) 2.45 |
| valge `primary` nupu gradient `#16a34a → #22c55e` | **3.30 / 2.28 !!** | **kõik primaarsed nupud** (`buttonVariants primary`); keskmine ~2.7 |
| valge `filter` (päise pill) `#16a34a` | 3.30 ! | `variant="filter"` hover |
| soft **success** `#16a34a` tint-il | **2.79 !!** | `Badge success soft` |
| soft **warning** `#d97706` tint-il | **2.71 !!** | `Badge warning soft` |
| valge `warning` solid `#d97706` | **3.19 !** | `Badge warning solid` (kollane/oranž taust valge tekstiga) |
| `text-warning` `#d97706` kaardil | 3.19 ! | `text-warning` abiklass (`ui/` kasutab) |
| `text-primary` `#16a34a` kaardil | 3.30 ! | ikoonidel OK (≥3), tekstil mitte |
| soft **danger** `#e11d48` tint-il | 3.70 ! | `Badge danger soft` |
| soft **accent** `#9333ea` tint-il | 4.30 ! | `Badge accent soft` |
| soft **info** `#2563eb` tint-il | 4.19 ! | `Badge info soft` |
| soil kollane `#eab308` kaardil | **1.92 !!** | `types/soilSample.ts` tekstivärv (`getSoilMetricColor` kasutatakse `color`-ina) |
| soil roheline `#16a34a` kaardil | 3.30 ! | sama |
| soil hall `#94a3b8` kaardil | **2.56 !!** | "puudub" väärtus |
| korras: `text-secondary` 7.58, `text-info` 5.17, `text-destructive` 4.70, `text-accent` 5.38, solid success `#15803d` 5.02, solid info 5.17, solid accent 5.38, `danger-solid` 4.83, neutral märk 6.99, faasivärvid 5.0–6.7 | | |

### Tume teema

| Paar | Suhe | Kus |
|---|---|---|
| valge `warning` solid `#f59e0b` | **2.15 !!** | `Badge warning solid` (kollane valge tekstiga, kõige halvem) |
| valge `primary` nupu gradient | **3.30 / 2.28 !!** | primaarsed nupud (gradient on mõlemas teemas sama) |
| `phase` tekst `#1d4ed8` kaardil | **2.66 !!** | `fw-panel-phase`, `add-work-phase-label` (Ettevalmistus) |
| `phase` `#7c3aed` / `#9a5b00` / `#15803d` | 3.13 / 3.29 / 3.56 ! | Hooldamine / Koristus / Külv |
| `emerald-600` tekst `#15803d` kaardil | 3.56 ! | `.cc-link-btn` jt (`color: var(--emerald-600)`) |
| valge `info` solid `#3b82f6` | 3.68 ! | `Badge info solid` |
| valge `accent` solid `#a855f7` | 3.96 ! | `Badge accent solid` |
| valge rose (`destructive`) `#f43f5e` | 3.67 ! | kui kasutada `bg-destructive` valge tekstiga |
| soft **accent** `#a855f7` | 3.82 ! | `Badge accent soft` |
| soft **info** `#3b82f6` | 4.02 ! | `Badge info soft` |
| soft **danger** `#f43f5e` | 4.22 ! | `Badge danger soft` |
| `text-subtle` `#64748b` kaardil | 3.75 ! (leht 4.08) | placeholder 3.22 |
| korras: `text-secondary` 6.96, `text-primary` 7.83, `text-warning` 8.31, soft success 6.09, soft warning 6.48, `danger-solid` 4.83, solid success 5.02 | | |

### Ettepanekud (kontrollitud arvutusega)

| Probleem | Parandus | Tulemus |
|---|---|---|
| Hele: `text-subtle` | `#64748b` (hele `--text-muted`) | 4.76 |
| Tume: `text-subtle` | `#7c8aa0` | 5.10 |
| Primary nupp (mõlemad) | gradient `#15803d → #16a34a` (või tahke `#15803d`) | 5.02 / 3.30; tahke 5.02 |
| `filter` hover | `#166534` | 7.13 |
| Hele: soft toonid | tekst tumedam toon (`#15803d`, `#b45309`, `#1d4ed8`, `#be123c`, `#7e22ce`) 15% tindil | 4.09 / 4.08 / 5.30 / 4.84 / 5.43 (kaks esimest vajavad 12% tinti või tumedamat `#166534`/`#92400e`) |
| Tume: soft toonid | helgem tekst (`#60a5fa`, `#fb7185`, `#c084fc`) | 5.48 / 5.37 / 5.34 |
| `warning` solid | tume tekst `#0f172a` kollasel (hele `#d97706` 5.60, tume `#f59e0b` 8.31) | |
| `info` solid tumedas | taust `#2563eb` | 5.17 |
| `accent` solid tumedas | taust `#9333ea` | 5.38 |
| Faasivärvid tekstina tumedas | helgemad variandid (`#60a5fa` = 7.02) | |
| Mulla tekstivärv | tekstina tumedam variant (`#b45309`/`#15803d`/`#b91c1c`), punkt/riba jääb andmevärviks | |

Visuaalne mõju: hele teema primaarnupp muutub tumedamaks roheliseks (kõige nähtavam muutus); soft märgid tumenevad kergelt; `text-subtle` hele teema tumeneb märgatavalt.

---

## 7. Klaviatuurile ligipääsmatud klikitavad elemendid

Skript leidis 33 JSX-silti `onClick`-iga ilma `role`+`tabIndex`+klahvikäsitluseta (või `ui` komponent, mis ei lisa neid). Väljas on: `tel:`/`mailto:` `<a>` `stopPropagation` (3), `TableCell onClick stopPropagation` (3), `<a href="/">` (Header brand, 1) ja dropzone'id (3, drag-and-drop ala + peidetud failisisend). Ülejäänud **~23 päris probleemi**:

| Rühm | Arv | Failid |
|---|---|---|
| `TableRow onClick` (ui `TableRow` ei lisa `tabIndex`/`role`/Enter) | 8 | `ArticlesView.tsx:265`, `FinanceModal.tsx:914`, `HarvestLotsPanel.tsx:82`, `SeasonManagerModal.tsx:224,278`, `TripRegister.tsx:232`, `WeatherView.tsx:106`, admin `TenantsView.tsx:54` (`<tr className="clickable">`) |
| `Card interactive onClick` (ui `Card` ei lisa) | 3 | `PoiManagerModal.tsx:392`, `RelatedPartiesModal.tsx:488`, `VehicleTracker.tsx:1298` |
| `div.swap-option-item` valikuread | 4 | `VehicleTracker.tsx:1976,1997,2021,2042` |
| `div.fleet-card-notes` ("Kliki märkuse muutmiseks") | 3 | `VehicleTracker.tsx:1403,1573,1725` |
| Paneeli päised (`div.layer-control-header`, `div.widget-legend-header`) | 2 | `LayerControl.tsx:89`, `MapYearSelector.tsx:112` |
| Legendi rida `div.crop-legend-item` | 1 | `MapYearSelector.tsx:148` |
| Aasta lahter `TableCell.year-cell` | 1 | `FieldManagerModal.tsx:604` |

Hästi tehtud eeskujud (olemas): `FieldWorksBoard.tsx:830` (`role`+`tabIndex`+`onKeyDown`), `TripRouteView.tsx:55`. Lisaks: `LayerControl` `icon-toggle` ×7 ilma `aria-label`/`type`; `Header` nav `aria-current` on olemas. Lahendus kõige mõjusam ühes kohas: `TableRow` ja `Card` saavad `onClick` korral automaatselt `tabIndex=0`, `role` ja Enter/Space käsitluse (~18 kohta lahendub ühe muudatusega). Ainult loetelu, eraldi a11y samm.

---

## 8. `index.css` maht

7 758 rida; 958 erinevat klassi; 98 muutujat; 162 `!important`; 63 `[data-slot` valijat (ui lahtrite ülekirjutused); 18 `@media`; 13 `@keyframes`; 1 115 tühja rida; 179 kommentaari-rida; 262 ühe deklaratsiooniga reeglit.

### 8A. Plokid (ridu perekonna esimese klassi eesliite järgi; ligikaudne)

| Plokk | Ridu | Näited | Saatus |
|---|---|---|---|
| Põllutööde tahvel | ~1 320 | `fw` 1 024, `work` 154, `add` 142 | vaade; ~200 kustuks surnud klassidega |
| Kaart, Leaflet, paneelid, kihid | ~1 180 | `cc` 353 (CultivationControl), kaart/Leaflet 319, `layer` 138, `year` 148, `popup` 54, `poi` 73, `widget` 39, `basemap` 33 | spec: jääb (~900) |
| Sõidukid, seadmed, sõidud | ~870 | `v` 164, `vehicle` 115, `fleet` 139, `trip` 128, `telemetry` 122, `dev` 56, `imp` 52, `swap` 47 | vaade |
| Põllud, kultuurid, hooajad, muld, ilm | ~800 | `field` 258, `crop` 210, `soil` 117, `season` 91, `weather` 63 | vaade; muld+ilm ~70 kustub tabelitega |
| Finants | ~490 | `finance` 484 | vaade |
| Sisselogimine / lehed / päis / tugi | ~500 | `login` 172, `header` 133, `support` 84, `fullpage` 48, `license` 22 | `login` jääb (udu, taust), ülejäänud vaade |
| Registrid, isikud | ~215 | `register` 114, `reg` 52, `party` 49 | vaade |
| Tokenid (`:root` ×2) | ~117 | `:root` 117 | jääb (üks allikas) |
| `@keyframes` | 96 | | jääb |
| Kommentaarid (plokkide tasandil) | 209 | | |
| Muu (`btn`, `alert`, `form`, `dropzone`, `confirm`, `edit`…) | ~900 | | segu, osa surnud |

### 8B. Kasutuseta klassid (kindlad)

Meetod: iga klassiselektor `index.css`/`admin.css`/`App.css`-ist, otsing sõnena `src/**/*.{ts,tsx}` ja `index.html` (kommentaarideta). `leaflet-*` (Leafleti loodud) välja arvatud. Reegel loetakse surnuks, kui **igal** komaga eraldatud selektoril on vähemalt üks kasutuseta klass.

**index.css: 86 klassi, 112 reeglit, ~535 rida.** (+ 23 "kahtlast" klassi, 30 reeglit, ~71 rida, vt 8C)

Kindlalt kasutuseta (pole ühegi `.tsx`/`.ts` failis):

- vana põllu külgpaneel: `field-detail-header/seasons/seasons-label/columns/col/col-ops/footer`, `field-ops-fill/list/list-fill`, `field-op-item/head/date/type/meta/product/notes-toggle/notes`, `field-title`, `field-code(-row)`, `field-info-col`, `field-active-season-col`, `field-history-row`, `field-change-reason-line`, `history-label`, `cadastre-code`, `drawer-header`
- vana kihi UI: `sub-layer`, `layer-year-selector`, `year-selector-title`, `year-register-link-btn`, `add-year-banner`, `banner-content`, `banner-inputs`, `legend-title`, `legend-subtitle`, `dot-active`, `live-dot-pulse`, `progress-fill`
- vana tööde lisamise dialoog: `add-work-body/phase/phase-label/option/name/check/tag/footer/actions/count`, `work-entry-add`, `on-field`, `to-add`, `to-remove`, `removing`
- tööde tahvel: `work-register-toolbar`, `fw-toolbar-spacer`, `fw-field-clear-btn`, `fw-field-edit-btn`, `fw-field-actions`, `fw-field-kind`, `fw-row`, `fw-group-icon`, `fw-cell-carried`, `fw-cell-next-spring`, `fw-next-spring-banner`, `fw-milestone-done`, `carried`, `three`
- tehtud ui-le üle: `ai-key-created/url/new/table-wrap/help/table` (6), `articles-tabs`, `article-categories-group/add`, `article-form-modal/body`, `article-npk-inputs`, `article-merge-info`, `form-section-title`, `stock-qty`, `finance-occurrence`, `animate-slide-in`
- `admin.css`: `admin-narrow` (1 rida). `App.css`: `framework`, `button-icon` (11 rida, Viten vaikemall)

### 8C. Kahtlased (olemas dünaamiliselt koostatud stringi eesliide)

Eesliited, millega koostatakse klasse (`prefix-${…}` / `'prefix-' +`): `pass-`, `veh-`, `imp-`, `tel-`, `poi-`, `crop-`, `var-`, `season-`, `weather-`, `variety-`, `edit-`, `party-`, `teris-logo-`, `weather-line-`, `rc-rate-`/`rc-service-`, `dev-assign-`. Kahtlased klassid (kontrollida käsitsi enne kustutamist): `teris-logo-horizontal/vertical/icon`, `poi-add-form`, `poi-meta-line`, `edit-title`, `season-year-label`, `season-icon`, `variety-breeder-cell`, `variety-winter-text`, `variety-notes-cell`, `variety-empty-cell`, `weather-wet/dry/warm/cool`, `weather-bar-year`, `weather-line-0…5` (viimased tõenäoliselt kasutuses).

### 8D. Hinnang: kui palju saab kustutada

| Allikas | Ridu | Kindlus |
|---|---|---|
| Kindlasti surnud klassid (8B) | ~550 | kõrge |
| Kahtlased (8C) | ~70 | keskmine |
| Pseudo-tabelid (`soil-*`, `weather-season-*`) pärast üleviimist | ~70 | kõrge |
| Toored ikoonnupud pärast ui Button'i (1A–1C, ~14 perekonda) | ~250 | keskmine (osa jääb positsioneerimiseks) |
| `text-*`/inline-stiilid klassideks (2B) | lisab ~60, aga eemaldab 85 JSX-i inline | |
| Kommentaaride/tühjade ridade koondamine | 0 (ei loe) | |
| **Realistlik kokku selles etapis** | **~900–1 000 rida (7 758 → ~6 800)** | |
| Üleminek `index.css`-i klassid → Tailwind (vaated skaneeritud) | täiendavalt 2–3 tuhat, aga **iga vaade eraldi**, suur muudatus | vt küsimus 3 |

**Hinnang: spec'i ~2 000 rida on selles etapis kättesaamatu ilma Tailwindi skaneerimise laiendamiseta ja vaadete ümberkirjutamiseta.** `index.css` koosneb ~85% vaatepõhistest reeglitest, mitte tüüpilistest komponentidest. Neid ei saa kustutada, ainult teisaldada.

### 8E. Undefined CSS variables (lisaleid)

`index.css` kasutab muutujaid, mis ei ole kuskil defineeritud (ei `:root`, `[data-theme]`, `app.css` ega TS-is). Deklaratsioon muutub kehtetuks ja brauser kasutab vaikeväärtust (`border` jäägi `currentColor`, `background` läbipaistev):

| Muutuja | Kasutusi | Kus (rida) | Mõju |
|---|---|---|---|
| `--border-color` | 6 | 3216, 3339, 4062, 4071, 5781 (`.fw-add`), 5983 | ääris = `currentColor` (tekstivärv) |
| `--border-subtle` | 5 | 326, 817, 3824, 3920 (+ `:6779` fallbackiga) | taust/ääris puudub |
| `--bg-input` | 2 | 3215, 4060 | taust puudub |
| `--bg-hover` | 2 | 5097 (`color-mix`), 5273 | hover-taust puudub |
| `--emerald-300` | 1 | 3949 | |
| `--border-strong` | 1 | 4932 (fallback `#94a3b8` olemas) | |
| `--amber-600` | 1 | 7609 (fallback olemas) | |

`--card-bg` (finants) kasutab fallbacki `#fff`, mis tähendab, et tumedas teemas on finantsplaadid **valged**, kui `--card-bg` pole seatud — kontrollida (`index.css:6975,7261,7344`).

---

## 9. Kirjasuurused, nurgad, vahed

### 9A. Kirjasuurused (39 väärtust) → 6 sammu

Loetud iga `font-size` deklaratsioon (index.css+admin.css+App.css). Skaala (spec): 11 / 12 / 13 / 14 / 16 / 20 px.

| Siht | Praegused väärtused (kasutusi) | Kokku |
|---|---|---|
| **11px** (`2xs`) | 0.6rem (1), 0.60 (1), 0.62 (6), 0.64 (5), 0.65 (2), 0.66 (2), 0.68 (24), 0.7/0.70 (22), 11px (3) | 66 |
| **12px** (`xs`) | 0.72 (37), 0.73 (1), 0.74 (29), 0.75 (9), 0.76 (19), 12px (6) | 101 |
| **13px** (`sm`) | 0.78 (22), 0.8 (26), 0.82 (12), 13px (14) | 74 |
| **14px** (`base`) | 0.84 (7), 0.85 (14), 0.86 (3), 0.875 (1), 0.88 (2), 0.9 (12), 0.92 (6), 0.96 (1), 14px (1); **0.95rem (8) piirjuht: 14 või 16** | 47–55 |
| **16px** (`lg`) | 1rem (3), 1.05 (3), 1.1 (3), 1.15 (2), 16px (2) | 13 |
| **20px** (`xl`) | 1.2 (3), 1.25 (1), 1.3 (1), 1.35 (1), 1.4 (1), 20px (1) | 8 |
| (`inherit`) | 1 | |

Suurimad nihked: **0.6–0.66rem (16 kohta) tõuseb 9.6–10.6px → 11px** (kuni +1.4px; tabelipäised, väikesed märgid: `.v-action-btn` .64rem, `.soil-footnote` .64rem, `.cultivation` päised); 0.76→12px (−0.2); 0.8→13px (+0.2); **0.84–0.9rem → 14px (+0.4…0.6px)**; 1.2–1.4rem → 20px (−0.4…+1.6px, admin `h1` 1.4rem). Inline tsx: `0.72rem → 12px`, `0.8rem → 13px`, `12px/13px/16px` jäävad (skaala väärtused, aga kirjutada `text-xs/sm/lg`-ina ui-s).

Kus: kirjasuurus on ~800 kohas `index.css`-is (kõikides plokkides). Mehaaniline asendus skriptiga (`font-size: 0.74rem` → `font-size: 12px`), siis piirjuhtude ülevaatus.

### 9B. Nurgaraadiused (10 väärtust) → 4

| Praegu (kasutusi) | Siht |
|---|---|
| `50%` (22), `999px` (3) | `--radius-full` 9999px (ümmargused punktid, märgid, avatarid). 50% ruudukujulisel elemendil = täisring; muutub ainult siis, kui element pole ruut |
| 2px (13), 3px (3), 4px (20), 5px (2), 6px (13), 7px (2), `var(--radius-sm)` (16 + 1 fallbackiga) | `sm` 6px (väikesed nupud, ikoonid, sakid) |
| 8px (17), 10px (3), `var(--radius-md)` (13) | `md` 10px (nupud, menüüd, kaardid-plaadid). 8px on piirjuht: nupud/väljad → 6, plaadid/kastid (`finance-*` 8) → 10 |
| `var(--radius-lg)` (3) | `lg` 16px |
| 0, `6px 6px 0 0`, `0 4px 4px 0` | erijuhud (külgmised servad) — käsitsi |

Suurim visuaalne nihe: 2–4px ümarus → 6px (väikesed ikoonnupud, `mini-*`, `fw-card-add`, `swap-option` jne muutuvad ümaramaks). Nii on tegevus-/mini-nuppudel ainult `sm`.

### 9C. Vahed (32 väärtust) → skaala 2, 4, 6, 8, 10, 12, 16, 24, 32

Loetud `margin`/`padding`/`gap` väärtused (kõik nelja serva kombinatsioonid).

| Väärtus | Kasutusi | Siht |
|---|---|---|
| 6px (147), 8px (142), 12px (101), 10px (89), 4px (88), 2px (54), 16px (53) | 674 | skaalas |
| 14px (36) | 36 | 12 või 16 (kaartide padding 14 → 12/16) |
| 3px (24), 5px (20), 1px (7), 1.5px (3) | 54 | 2 / 4 / 6 (3→2 või 4, 5→4 või 6) |
| 18px (15), 20px (12) | 27 | 16 või 24 |
| 22px (9), 24px (9) | | 24 (24 skaalas) |
| 9px (6), 7px (4), 11px (2) | 12 | 8 / 10 |
| 28px (4), 30px (3), 32px (7), 36px (1), 40px (2), 44px (1), 46px (1), 56px (2), 190px (1), 0.12em (2), −8px, −10px | | 32 (suured vahed) või käsitsi (paigutuse mõõtmed: `padding-left:56px`, `margin-left:190px`, negatiivsed margin) |

Kus: kõik ~730 deklaratsiooni; `14px` 32 kohta `index.css`-is (kaardid, paneelid). Kõige suurem visuaalne mõju: 3/5/7/9/11 → ±1px (praktiliselt nähtamatu), 14/18/20/22 → ±2px (vaadatav tabelis ja kaardil).

---

## 10. Muud leiud

1. **`.hidden`/`.block`/`.flex`-laadsete klasside kokkupõrge** vaadete klassidega: ainult `.block-number-label` (ei ole probleem). Vaadetes kasutatavad Tailwindi-sarnased klassinimed: `sr-only` ×14 (defineeritud `index.css:3667` **ja** Tailwindis, sama väärtus), `items-start` ×1 (`FieldContextMenu.tsx:84`, töötab ainult sellepärast, et `ui/` kasutab seda). Enne `@source` laiendamist tuleb kontrollida vaadete klassinimed (`text-muted`, `text-secondary`, `text-amber`… ei ole Tailwindi utiliidid, kui värvid on `--color-*: initial`; aga `text-xs`, `text-primary`, `items-start`, `sr-only`, `block`, `hidden`, `flex`, `grid` on). Hetkel on vaadetes ~110 `text-*` värviklassi, millest 2 töötavad.
2. **Tailwindi skaneerimise laiendamine** (`styles/app.css:19` `@source '../components/ui'`) oleks suurim hoob `index.css`-i vähendamiseks (vaated saaksid `flex gap-2` jne), aga: (a) `README` hoiatab vanade klassinimede kokkupõrgete eest, (b) `legacy` kiht võidab `utilities`-i `!important`-i puhul (162 `!important` index.css-is), (c) kõik utiliidid peavad olema skaalas (praegune ui-audit valvab ainult `ui/`-d, tsx audit-reeglid `Keelatud suvalisi klasse`/`Skaalaväliseid vahe-klasse` loevad ka vaateid).
3. **`ui-audit` pimeala:** admin ja landing mõõtmata (vt Baas). Admin on `index.css`-i ainus `.btn` kasutaja.
4. Toored `<button>` ilma `type` atribuudita: `LayerControl.tsx` `icon-toggle` ×7, `basemap-btn`, `VehicleTracker.tsx:1366,1386` `mini-swap-btn`. Neid vorm-sees pole ilmselt, aga `Button` paneb `type="button"` vaikimisi.
5. Vaadetes `className="num"` on kasutuses, aga globaalset `.num` reeglit pole (ainult `.fw-plan-rows .num`, admin `td.num`). Memory'is ("numbrid paremale `className="num"`") mõeldud ilmselt `TableCell numeric`. Kontrollida, kus `num` tegelikult mõjub (`PriaLinesEditor.tsx:224,240`).

---

## Soovitatav jaotus ülesanneteks

Iga ülesanne = eraldi commit + release, järjekord väiksemast riskist suuremani; mõju nähtavale välimusele märgitud.

1. **Defineerimata ja katkised viited (nähtav mõju: väike, parandab olemasolevat).** (a) `index.css` määramata muutujad (8E): defineerida `--border-color`, `--border-subtle`, `--bg-input`, `--bg-hover`, `--emerald-300` või asendada olemasolevatega; kontrollida `--card-bg`; (b) `link-button` (WeatherSeasonSection) klassile stiil; (c) ~110 `text-*` värviklassi asendada ui nimedega (`text-primary/info/warning/destructive/accent/subtle/muted-foreground`) — dialoogi päiste ikoonid muutuvad roheliseks, abitekstid hallideks (küsimus 6). Risk: väike, aga visuaalselt nähtav kõigis dialoogides; vajab ekraanipilte (`scripts/shot.mts`).
2. **Surnud CSS kustutus + auditi laiendus (nähtav mõju: puudub).** Kustutada 8B klassid (~550 rida) + `admin-narrow`, `framework`, `button-icon`; kahtlased (8C) käsitsi; lisada ui-audit'ile "kasutuseta klassid" ja admin/landing mõõtmine (eraldi read). Risk: Leaflet/dünaamilised klassid; teha skriptiga + `tsc -b` + ekraanipildid.
3. **Kontrast (nähtav mõju: keskmine; vajab kasutaja otsust).** Tokenite väärtused `index.css`/`variants.ts` (6 "Ettepanekud"): primary-nupu gradient, `text-subtle`, soft/solid märkide toonid, warning solid, faasivärvid tumedas, mulla tekstivärvid. Risk: nähtavalt muudab nuppude ja märkide tooni; soovitav küsida (küsimus 4).
4. **Ikoonnupud → ui Button (nähtav mõju: väike).** Lisada `Button` suurused/variandid (1F: `xs`, `link`, pressed-olek, valikuline `icon-lg`), viia üle 1A–1C (~35 nuppu: `fw-field-shape-btn`, `year-shape-btn`, `icon-toggle`, `cc-*`, `mini-swap-btn`, `v-action-btn`, `fw-card-add`, link-nupud), kustutada ~250 rida CSS-i. Risk: suurused muutuvad (küsimus 1), `.name-cell.has-corner-btn` polster, `fw-add` ja kaardinupud (1D) jäävad eraldi.
5. **Pseudo-tabelid → ui Table (nähtav mõju: väike).** `SoilSamplesSection` ja `WeatherSeasonSection` ühise `Table dense bordered`-iga; `TableRow` ja `Card` klaviatuuriligipääs (Enter/Space + `tabIndex`) samas ülesandes, sest soil-rida on praegu `button`. Kustub ~70 rida. Risk: kitsas paneel, veerutihedus; `TableRow` käitumise muutus mõjutab 8 kohta (vt 7).
6. **Inline stiilid ja korduvad mustrid (nähtav mõju: puudub/mikro).** `FilterBar`, `EmptyState`, `HiddenFileInput`, `MutedText`/`Hint` ui-s (või vaate-komponentidena); `fw-cell` grid-kohad modifikaatorklassidena; ülejäänud staatilised (2B) klassideks. Eesmärk: `style={{` ≤ 45 (ainult dünaamilised), "Kirjasuurusi inline" 0. Risk: kolm filtririba teevad veidi erinevat (`TripRegister` 4 filtrit + värskenda); lasta vaadete erinevused argumentideks.
7. **Värvikoodid tsx/ts-is (nähtav mõju: puudub).** `src/theme/dataColors.ts` (andmevärvid ühes kohas, koopiad `#eab308` ×11, `#94a3b8` ×9, `#22c55e` ×8 asendada konstantidega); UI-värvid (3A) tokeniteks; auditi värvi-reegel lubab ainult `dataColors.ts`/`services/*Layer*.ts` ja `types/` palettide faile. Risk: ServerApi (`apiHandler.ts`) importib samu konstante — kontrollida `tsc -b` mõlemat.
8. **Kirjasuurused, nurgad, vahed → skaala `index.css`-is (nähtav mõju: keskmine, hajus).** Skriptiga asendus 9A–9C tabelite järgi kolme alamosana (a) kirjasuurused (39→6), (b) nurgad (10→4), (c) vahed (32→skaala), iga eraldi commit, ekraanipildid kõigist vaadetest mõlemas teemas. Risk: tihedus muutub kuni 1–2px; 0.6–0.66rem → 11px on suurim nähtav nihe; kontrollida kitsaid paneele (tööde tahvel, kaardipaneelid).
9. **(Valikuline, sõltub küsimusest 5) Admin ja landing viia ui-le.** Admin: 47 `btn`, 14 `<table>`, 24+ sisendit, 28 `alert-box`; kustutab `.btn*` ja `admin-table` CSS-i ja viimase vanade komponendiklasside rea (6→0). Landing on staatiline leht, jääb eraldi.

Järjestuse põhjendus: 1 ja 2 on madala riskiga ja puhastavad pinna, mille peal ülejäänud ülesannete mõõtmine on usaldusväärne; 3 on kasutaja otsus; 4–5 vähendavad CSS-i ja liiguvad ühtsele komponentide kihile; 6–7 on koodi koristus; 8 on suurim ja lõpetab etapi (audit peab lõpus näitama kirjasuurusi ≤6, nurki ≤4, vahed skaalas). Ülesanne 9 sõltub ulatuse otsusest.

## Küsimused kasutajale

**1. Kas ikoonnupud ühtlustada ühe suurusega?**
Praegu on tekstita ikoonnuppe 18 / 20 / 24 / 28 / 30 / 32 / 40px ja kujud (ümmargune, 4px, 6px, katkendjoon). Variandid: (a) kõik ikoonnupud 28px (`icon-sm`), mini-nupud 20px; (b) säilitada kontekstipõhine suurus (tabelis 20px, tööriistaribal 28px, mängimine 40px) — kolm ui suurust; (c) ei ühtlusta, ainult nupu stiil (värvid, hover) ühtseks, mõõdud jäävad. **Soovitus: (b).** Tihedus tabelites ja tööde tahvlis on teadlik valik; (a) teeb `fw-card-add` ja `year-shape-btn` suuremaks ja nihutab tabelilahtreid.

**2. Kas laiendada Tailwindi skaneerimist vaadetele (`@source`)?**
Variandid: (a) ei, ainult `ui/` (praegu); (b) lisada ainult uued/üleviidud failid ükshaaval (nagu README kirjeldab); (c) kogu `src/` korraga. **Soovitus: (a) selles etapis.** (c) tekitab ootamatuid stiile vanade klassinimede tõttu (`text-muted`, `block`, `grid`…) ja 162 `!important` reeglit võidavad utiliite; (b) tuleks siis, kui otsustad ~2 000 rea eesmärgi suunas minna (küsimus 3).

**3. Kui palju `index.css`-i selles etapis vähendada?**
Variandid: (a) ~900–1 000 rida (kindlad surnud klassid + tabelid + ikoonnupud; 7 758 → ~6 800); (b) ~2 500 rida (lisaks põllutööde tahvel ja finants Tailwindi peale, vajab (2) variant (b)/(c)); (c) kuni spec'i 2 000 (iga vaade ümber, mitu etappi). **Soovitus: (a)**, ja jätta ~2 000 eesmärk eraldi etapiks "vaated Tailwindi peale", kui sa selle tahad. Spec'i "~2 000" eeldas, et enamik `index.css`-ist on komponendiklassid; tegelikult on ~85% vaatepõhised reeglid.

**4. Kontrastiparanduste toon.**
Primaarnupu gradient (valge tekst 2.3–3.3 : 1) ja soft märgid kukuvad alla 4.5. Variandid: (a) tumedam roheline kõikjal (nupp `#15803d → #16a34a`, märgid tumedam toon): põhivärv visuaalselt tuhmim, kõik täidavad AA; (b) ainult väikesed tekstid ja märgid parandada, primaarnupp jätta ja lugeda "suureks tekstiks" (3:1; praegu 2.3 gradient lõpus, ei täida ka seda); (c) nupu tekst tumedaks (`#052e16`), roheline jääb: kontrast ~7, aga nupu iseloom muutub; (d) ei paranda. **Soovitus: (a)**, tumedas teemas kollane `warning solid` tumeda tekstiga. Nähtavaim muutus on rohelise nupu tumenemine.

**5. Kas admin (ja landing) kuulub koristusetappi?**
Admin kasutab 47 `btn btn-*`, 14 toorest tabelit, 24 sisendit, ja hoiab `.btn` CSS-i elus; audit selle ei näe. Variandid: (a) lisada admin ülesandesse 9 (ui Button, Table, Input), (b) ainult admini loetelu auditisse ja jätta üleviimine hilisemaks, (c) admin jääb igaveseks oma stiiliga. **Soovitus: (a)** viimase ülesandena; admin on sinu enda tööriist (admin.teris.ee), risk madal, ja saab kustutada viimased vanad klassid.

**6. Kas dialoogi ikoonid ja abitekstid muuta nii, nagu autor kavatses (roheline/hall/sinine)?**
~110 klassi (`text-emerald` 66, `text-muted` 22, `text-blue` 13 jt) ei ole kunagi töötanud. Parandades muutuvad dialoogide päiseikoonid roheliseks, abitekstid hallideks, kalendriikoonid siniseks. Variandid: (a) parandada nagu autor mõtles (ikoon `text-primary`/`text-info`, abitekst `text-subtle`); (b) kustutada klassid, jätta praegune välimus (ikoonid tekstivärvis); (c) ainult dialoogi päiste ikoonid roheliseks ühes kohas (`DialogHeader`), ülejäänud (b). **Soovitus: (c)**; dialoogid saavad ühtse tooni, abitekstid ja kalendriikoonid jäävad nagu praegu (muutust ei oska keegi oodata).

**7. Kirjasuuruste ümardus: kas lubad väikseimad (0.6–0.66rem, 16 kohta) kerkida 11px-ni?**
Praegu 9.6–10.6px (tabelipäised, jalusemärkmed, mini-nupud); skaala väikseim on 11px. Variandid: (a) kõik 11px (+0.4…1.4px, nupud ja päised muutuvad veidi suuremaks); (b) lisada skaalale `text-3xs` 10px (7. suurus, spec'i piir ≤6 läheb rikkuma); (c) need tekstid ära kaotada/suurendada ja tihedust parandada. **Soovitus: (a)**; 1 px erinevust ei märka, aga kontrollida tuleb mini-nupud (`v-action-btn`, `fw-card-add`) ja `soil-footnote`.
