# Kaartide ja paneelide inventuur (2026-11-15) — etapi 2.7 lähteandmed

Kaardistatud serveri koodist (HEAD `22ee8b8`): `src/index.css`, `src/admin/admin.css`, kõik `.tsx`/`.ts` failid `src/` all, `scripts/`, `index.html`. Klassid leitud CSS-reeglite parsimisega (nimes card/panel/box/section/tile/stat/kpi/widget/…) ja kasutused `grep`-iga. Midagi ei ole muudetud ega brauseris proovitud; "võib katki minna" väited on koodist järeldatud.

**Peamine järeldus:**
- `ui/Card.tsx` (`Card`, `Panel`) on olemas ja `cardClass` (`variants.ts:138`) = `rounded-lg border border-border bg-card text-foreground shadow-card backdrop-blur-lg`, st täpselt `.glass-card` (`index.css:128`). Variante pole ühtegi. **Rakenduses ei kasuta `Card` ega `Panel` keegi** (0 kasutust väljaspool `ui/`; ainus on `UiGallery.tsx:306`).
- `.glass-card` on 41 kohas (22 rakenduses, 19 adminis), peaaegu alati koos teise klassiga, mis lisab paddingu/layouti (`admin-card`, `vehicle-card`, `layer-control-panel` …). Seega "kaart" on kaks kihti: välimus (`glass-card`) ja asetus (spetsiifiline klass).
- Lisaks `glass-card`-ile on **vähemalt 7 käsitsi kirjutatud kaardi-sarnast välimust**, mis kordavad sama äärist/raadiust teise taustaga (`--bg-modal`, `--stat-bg`, `--bg-input`, `#fff`).
- Spec (`2026-11-12-ui-uhtlustamine-design.md:62,108`): kaardid ja paneelid `rounded-lg` (16px), "Card, Panel — klaasikaart, päisega paneel" ja "kaartide variatsioonid" on nimetatud, aga variatsioone ei ole defineeritud.

Tokenid: `--bg-card` hele `rgba(255,255,255,.92)`, tume `rgba(15,23,42,.85)` (`index.css:8,58`); `--bg-modal` `#fff` / `#0f172a`; `--stat-bg` `rgba(15,23,42,.04)` / `rgba(255,255,255,.04)`; `--shadow-glass` (`:30,80`), `--shadow-modal` (`:31,81`); `--radius-lg/md/sm` 16/10/6px.

## 1. Perekonnad

Lühend: bg = taust, r = nurga raadius, sh = vari, bf = backdrop-filter.

### A. Klaaskaart (`.glass-card`, `index.css:128`)
bg `--bg-card`, bf blur(16px), border `--border-card`, r 16, sh `--shadow-glass`, color `--text-primary`, transition. Ainult välimus, padding puudub.

Kasutused (41 rida; `grep glass-card`):

| Kasutus | Kus | Lisaklassid / märkus |
|---|---|---|
| Admin lehekaart, 17 kohta | `HelpView.tsx:101,137`; `CatalogView.tsx:547`; `TenantDetail.tsx:122,139,166,186,224,229`; `LandingStatsView.tsx:51`; `AdminApp.tsx:95`; `NewTenantForm.tsx:60`; `AiInstructionsView.tsx:36,40`; `InterestView.tsx:46`; `WeatherAdminView.tsx:45`; `DevicesView.tsx:45`; `TenantsView.tsx:26` | `admin-card` (`admin.css:153`: padding 16, margin-bottom 16, `h2` 1.05rem). `:229` lisaks `admin-danger-card` (punane ääris `rgba(220,38,38,.35)`) |
| Admin sisselogimine, 1 | `LoginView.tsx:27` | `admin-login` (`admin.css:156`: max-width 380, padding 24, margin 12vh auto) |
| Rakenduse sisselogimine, 2 | `LoginPage.tsx:43`, `SetPasswordPage.tsx:51` | `login-card` (`index.css:4620`: padding 30/28, flex column) + **ülekirjutus** `.login-page .login-card.glass-card` (`:4628`): kreemjas gradient-taust, blur(18) saturate, oma ääris, suur vari, `--login-ink`. Eraldi välimus |
| Register-loendi kaart, 3 | `PoiManagerModal.tsx:392`, `RelatedPartiesModal.tsx:488`, `VehicleTracker.tsx:1300` | `vehicle-card` (`:2010`, padding 14, flex column gap 12, cursor pointer, hover bg `--bg-card-hover` + roheline ääris, `.selected` roheline ääris + roheline hõõgumine) |
| Seadmekaardid, 2 | `VehicleTracker.tsx:1490` (`implement-card`), `:1620` (`device-card` + `fresh.cls`) | `index.css:2226` kordab `glass-card`-i omadusi (bg, border, r-lg) ja lisab padding 14, flex column |
| Filtririba, 3 | `VehicleTracker.tsx:1789`, `DeviceAssignmentRegister.tsx:179`, `TripRegister.tsx:137` | `history-filter-bar` + **identne inline `style`** (flex wrap, gap 12, padding 12px 16px) kolmes kohas; `.history-filter-bar` CSS-is ainult `filter-clear` alamreeglid (`:7706,7711`) |
| Tühi olek, 4 | `VehicleTracker.tsx:1859`, `DeviceAssignmentRegister.tsx:240`, `TripRegister.tsx:197`, `RelatedPartiesModal.tsx:593` | inline `style` padding 48/24 (viimane 32px) + `text-align:center`; viimane lisaks `empty-register-state` (`:3619`, padding 32, flex column) |
| Kaardi ujuvpaneelid, 7 | `LayerControl.tsx:88`, `CultivationControl.tsx:143`, `MapYearSelector.tsx:79`, `SatellitePanel.tsx:290`, `MapView.tsx:1064,1070,1124` | vt perekond B |
| Põllu muutmise kinnistu rida, 1 | `FieldEditDialog.tsx:642` | `edit-cad-item` (`:4250`): padding 8/10, ääris `--border-subtle`, r-sm 6; glass-card'i taust ja vari tulevad peale, raadius 6 kirjutab üle 16 |

### B. Kaardi ujuvpaneelid (klaas kaardi peal)
Kõik asuvad `.map-wrapper` või `.map-top-right-stack` (`index.css:586`, `position:absolute`, `top/right 16`, width 300, z 900, flex column gap 10, `pointer-events:none` ja lapsed `auto`) sees.

| Klass | Rida | bg/ääris/raadius/vari | Padding | Muu |
|---|---|---|---|---|
| `layer-control-panel` + glass-card | `:608`, `LayerControl.tsx:88` | glass (r 16) | 14 | `transition: all .2s`; `open/collapsed` klass; päis `layer-control-header` `:615` |
| `satellite-panel` + glass-card | `:423`, `SatellitePanel.tsx:290` | glass, **r ülekirjutus sm 6** | 10/12 | z 800, font .72rem; portaaliga `map-top-right-stack`-i (`SatellitePanel.tsx:476`) |
| `map-year-floating-widget` + glass-card | `:958`, `MapYearSelector.tsx:79` | glass + **sh `--shadow-modal`** (ülekirjutus) + animation fadeIn | 12/14 | flex column gap 10; päis `year-widget-header` |
| `cultivation-panel` + glass-card | `:1361`, `CultivationControl.tsx:143` | glass (r 16) | 14/16 | `position:absolute; bottom 20; left 50%; transform translateX(-50%)`, width min(1040px,…), z 900, font .82rem |
| `add-poi-banner` + glass-card | `:568`, `MapView.tsx:1124` | glass, taust `--bg-card` korratud, **roosa ääris** `rgba(219,39,119,.4)`, tekst `#db2777` | 10/20 | `transform: translateX(-50%)`, z 900 |
| `coords-tracker` + glass-card | `:327`, `MapView.tsx:1064` | glass, **r sm 6** | 6/12 | monospace .72rem, `pointer-events:none`, `left:80 bottom:24` |
| `radar-legend` + glass-card | `:341`, `MapView.tsx:1070` | glass, **r sm 6** | 8/10 | `left:80 bottom:60`, `pointer-events:none` |
| `field-map-card` (+ `field-map-card-anchor`) | `:7953`, `FieldMapCard.tsx:27`, `MapView.tsx:1052` | **bg `--bg-modal` (tahke), r 10px, sh `0 4px 16px rgba(0,0,0,.25)`**, ei kasuta glass-card'i | 10/12 | width 300, anchor `position:absolute z 900`; päis `fmc-header` |

Hälbed: 3 kaardiraadiust (16/10/6) ja 4 vari (`--shadow-glass`, `--shadow-modal`, `0 4px 16px`, login'i oma) ühe perekonna sees.

### C. Loendikirje-kaart (tahke või klaas, klikitav/valitav)
| Klass | Rida | Välimus | Kasutusi |
|---|---|---|---|
| `vehicle-card` (+ glass-card) | `:2010` | vt A | 3 (VehicleTracker, PoiManagerModal, RelatedPartiesModal) |
| `implement-card`, `device-card` (+ glass-card) | `:2226` | padding 14, bg `--bg-card`, border, r-lg (kordab glass-card'i) | 1+1 |
| `finance-entry-card` | `:6975` | **bg `var(--card-bg, #fff)`**, border `--border-card`, **r 8**, padding 10/12; hover `:6989`, `.selected` `:6994` | 1 (`FinanceModal.tsx:490`) |
| `fw-card` | `:5843` | bg `--bg-modal`, border `--border-card`, **r 7**, padding 6/9; wrapper `fw-card-wrap` `:5796` | 1 (`FieldWorksBoard.tsx:130`) |
| `party-role-checkbox` | `:4315` | bg `--bg-card`, border `--border-color`, r 6, padding 6/10 | 1 |
| `edit-cad-item` | `:4250` | vt A | 1 |

### D. Statistika-/KPI-plaat
| Klass | Rida | bg / ääris / r / padding | Kasutusi |
|---|---|---|---|
| `finance-kpi-card` | `:7344` | **`var(--card-bg, #fff)`**, `--border-card`, **r 10**, 12/16 | 5 (`FinanceModal.tsx:747,757,767,777`; `HarvestLotDialog.tsx:136`) |
| `finance-summary-card` | `:7261` | `--stat-bg`, `--border-card`, **r 8**, 12/16 | 1 |
| `finance-results-status-bar` | `:7392` | `--stat-bg`, `--border-card`, r 8, 8/14 | 1 |
| `trip-tile` (+ `trip-tiles` grid 4→2) | `:7913` | `--stat-bg`, `--border-card`, **r md 10**, 10/12 | 1 (`TripDialog.tsx:165`) |
| `harvest-lot-tiles` | `:7771` | grid 4→2, plaadid on `finance-kpi-card` | 1 |
| `admin-stat` (+ `admin-stat-row`) | `admin.css:237` | ilma bg, `--border-card`, **r 10px**, padding 12 | 4 (`LandingStatsView.tsx:76,81,86,92`) |
| `reg-stat-pill` | `:3374` | `--bg-input`, `--border-color`, r md 10, 6/12; modifikaatorid `.highlight`, `.tenure-*`, `.is-filter`, `.active` (`:3394–4229`) | 5 (FieldManagerModal 354,364; RelatedPartiesModal 416,424,430) |
| `register-crop-stat` | `:3052` | crop-värvi `color-mix` + `inset 3px` riba, r 6 | 1 |
| `register-crop-summary` (kast) | `:2975` | `--bg-card`, `--border-card`, r md 10, 10/12, `max-height:30vh` | 1 |
| `cc-stat` (+ `cc-stats`) | `:1439` | ilma kastita, flex column; kaardi sees | 4 |
| `dev-telemetry-summary` | `:2329` | `--stat-bg`, r sm, padding 8, grid 3 | 2 |
| `imp-status-box` | `:2280` | `--stat-bg`, r sm, 8/10 | 1 |

`finance-kpi-label/value/sub` (`:7372,7359,7387`) on plaadi sisu. KPI väärtuse klass `kpi-cost`/`kpi-revenue` on `FinanceModal.tsx:759,769` peal, CSS-is neid ei ole (kontrollimata, kas värv tuleb mujalt).

### E. Sektsioonikast (dialoogi, vormi või detailvaate sees)
| Klass | Rida | Välimus | Kasutusi |
|---|---|---|---|
| `admin-subform` | `admin.css:180` | ääris `--border-card`, **r 8**, padding 12 | 3 (`CatalogView.tsx:113,220,434`) |
| `admin-subpanel` | `admin.css:182` | ainult `border-top`, margin 16 | 1 |
| `support-panel` | `:7546` | `--stat-bg`, `--border-card`, r md 10, 16/18; pealkirjarida ikooniga | 1 (`SupportAccessPanel.tsx:49`), 14 alamklassi |
| `fw-plan-section` | `:6100` | ääris `--border-card`, **r 8**, 10/12, ilma bg | 1 |
| `parsed-preview-box` | `:1883` | **bg `rgba(255,255,255,.03)` kõvakoodis**, ääris, r md 10, padding 12 | 3 (kolm üleslaadimisdialoogi) |
| `layer-field-box` | `:829` | `--stat-bg`, r sm, `overflow:hidden` | 4 (`LayerControl.tsx`) |
| `layer-box-group` | `:4035` | `--stat-bg`, r 8, 6/8 | 0 (surnud) |
| `weather-chart-card` | `:7979` | `--bg-modal`, ääris, r sm, 8/10/4 | 2 |
| `telemetry-suggestions-card` | `:6451` | roheline gradient + roheline ääris, r 10, 10/12 | 1 |
| `fleet-card-notes` | `:2184` | merevaigu taust/ääris, r sm | 3 |
| `crop-group-block` | `:4385` | ilma kastita, ainult flex column | 1 |
| `crop-group-empty` | `:4421` | `--bg-modal`, `1px dashed`, r md | 1 |
| `fw-panel-empty` | `:6249` | `1px dashed`, r 8 | 2 |
| `detail-section` | `:1115` | ainult `margin-top:14` | 4 |
| `section-title` | `:638` | flex-päis (pealkiri) | 3 |

`alert-box` (65 kasutust) on teateriba, mitte kaart; jäetud sellest inventuurist välja (erinev komponent, `Alert`/Badge teema).

### Raadiuste, vahede, varjude ülevaade (kaardi-sarnased kastid)
- Raadius: 16 (`glass-card`, device/implement, `field-edit-season-card`-i surnud koopia), 10 (`field-map-card`, `finance-kpi-card`, `admin-stat`, `trip-tile`, `support-panel`, `reg-stat-pill`, `telemetry-suggestions-card`), 8 (`finance-entry-card`, `finance-summary-card`, `fw-plan-section`, `admin-subform`), 7 (`fw-card`), 6 (`coords-tracker`, `radar-legend`, `satellite-panel`, `edit-cad-item`, `layer-field-box`, `weather-chart-card`). Spec ütleb: kaardid/paneelid 16, menüüd/nupud 10, väikesed 2/4/8 koonduvad.
- Padding: 6/12, 8/10, 10/12, 12/14, 12/16, 14, 14/16, 16, 16/18, 30/28 — 10 erinevat.
- Taust: `--bg-card` (klaas), `--bg-modal` (tahke), `--stat-bg` (sisemine plaat), `--bg-input`, `var(--card-bg, #fff)`, kõvakoodis rgba.
- **Viga:** `--card-bg` ei ole kusagil defineeritud (`grep --card-bg:` src all: 0), seega `finance-entry-card` ja `finance-kpi-card` (`:6978,7345`) on **tumedas teemas alati valge** (`#ffffff`). Kontrollimata ekraanipildiga, aga fallback tabab alati.

## 2. Koondumise soovitus (spec-i raamistikus)

| Uus variant | Asendab | Märkus |
|---|---|---|
| `Card` (vaikimisi, glass) | `glass-card` + `admin-card`/`vehicle-card`/`device-card` jne | padding eraldi `padding`/`size` prop-iga (nt `none/sm/md/lg`), mitte klassiga |
| `Card variant="solid"` (bg-popover) | `field-map-card`, `fw-card`, `weather-chart-card`, `crop-group-empty` | ujuv-/sisemine tahke kast |
| `Card variant="inset"` (`bg-stat`) | `finance-summary-card`, `trip-tile`, `support-panel`, `layer-field-box`, `parsed-preview-box`, `dev-telemetry-summary`, `imp-status-box` | ilma varjuta, sisemine plaat |
| `Card interactive selected` | `vehicle-card`, `finance-entry-card`, `party-role-checkbox` | hover/selected olek |
| `Card variant="dashed"` | `fw-panel-empty`, `crop-group-empty`, tühi olek | tühjad seisundid |
| `StatTile` (label, value, sub, tone) | `finance-kpi-card`, `trip-tile`, `admin-stat` | `reg-stat-pill` jääb Badge/ToggleGroup'i teemaks (nupp) |
| `Panel` (päis + sisu) | `admin-card-head`+h2, `support-panel-head`, `layer-control-header`, `year-widget-header`, `fmc-header` | vt 3 |

## 3. Päisemustrid (pealkiri + tegevused)

| Muster | Klassid (rida) | Kasutusi | Märkus |
|---|---|---|---|
| Kaardi päis ikoon + pealkiri + tegevused | `v-card-header` `:2029`, `v-title-wrap` `:2035`, `card-header-actions` `:2049`, `card-header-right` `:2041`, `card-emoji-avatar` `:2079` | `VehicleTracker.tsx:1303,1304,1318,1314,1499,1633`; `PoiManagerModal.tsx:393–401`; `RelatedPartiesModal.tsx:489–506` | 3 vaadet kasutavad sama komplekti |
| Seade-/riistapäis | `dev-card-header` `:2237`, `dev-icon-wrap` `:2244`, `dev-title-wrap`, `imp-card-header/icon-wrap/title-wrap` (reegleid pole, ainult kasutus `VehicleTracker.tsx:1491–1495`) | 1+1 | kopeerib `v-card-header` mustri |
| Admin | `admin-card-head` `admin.css:189` (flex, wrap, justify between, margin-bottom 14, h2 margin 0) | `HelpView.tsx:102,144`, `TenantDetail.tsx:140,167` | lisaks `admin-split`, `admin-toolbar`, `admin-card-foot` (`:202`) |
| Ujuvpaneel | `layer-control-header` `:615` (klikitav), `year-widget-header` `:969`, `satellite-panel-title` `:434`, `fmc-header` `:7954` | 1+1+1+1 | kokkupandav päis ainult `LayerControl`-il |
| Täisleht | `fullpage-title-wrap` `:4984` (+ `h2`), `fleet-title-wrap` | 9 (`WeatherView`, `PoiManagerModal`, `FieldWorksBoard`, `FieldManagerModal`, `FieldsTableView`, `ArticlesView` …) | vaate päis, mitte kaart; `Panel` ei kata |
| Detail | `field-detail-header` `:1125` (padding 16/22, border-bottom) | 1 | |
| Sektsioon | `section-title` `:638`, `section-subtitle` `:1103`, `detail-section` `:1115` | 3+4+4 | |
| Ujuvkaardi jalus | `finance-entry-card-header/footer`, `v-card-footer` `:2167`, `dev-card-footer` (surnud), `fw-panel-foot` `:6368` | | |
| Admin-päis | `admin.css:150 admin-header-right` | | |

`ui/Panel` (`Card.tsx:19–32`): `h2 text-lg font-semibold`, päis `px-4 py-3 border-b`, sisu `p-4`. Olemasolevad paneelid kasutavad `h2` 1.05rem (admin), 0.9rem (`h3` admin-card), suuri `h2` täislehel. Panel'i pealkirja suurus ei ühti ühegi praegusega.

## 4. Surnud CSS (kasutust pole `src/`, `index.html`, `scripts/` all)

Kontrollitud sõnapiiriga grep'iga ja mallstringide (`status-${…}`) otsinguga; mallstringe ei leitud.

26 klassi (+3 variatsiooni):
`dev-card-footer` (`:2307`), `drawer-title-group` (`:1068`), `edit-card-header` (`:3464`), `field-card-actions` (`:3594`), `field-card-main-row` (`:3495`), `field-edit-season-card` (`:3456`, kordab `.glass-card`-i rohelise äärisega), `field-op-summary` (`:1119`), `fw-group-action-btn` (`:5603`), `fw-group-kind-label` (`:5588`), `fw-group-meta` (`:5594`), `header-button-group` (`:1098`), `header-stats` (`:243`), `kpi-card` (`:2626`), `kpi-label` (`:2633`), `kpi-value` (`:2639`), `kpi-sub` (`:2645`), `layer-box-group` (`:4035`), `layer-text-wrap` (`:3968`), `legend-title-group` (`:3631`), `master-field-card` (`:3479`, kordab `glass-card`-i), `season-form-card` (`:3797`), `stat-icon` (`:249`; variatsioonid `.work-icon`, `.tech-icon`, `.poi-icon` `:253–261`), `stat-label-with-year` (`:265`), `stat-progress-bar` (`:276`), `status-idling` (`:2112`), `year-widget-footer` (`:1035`).

Märkused: `fw-group-icon`: kasutust ja reeglit pole, ei loeta. `.leaflet-popup-content-wrapper`/`-tip` (`:2867,2876`) on teegi klassid, mitte surnud. `kpi-cost`/`kpi-revenue` kasutuses, reeglita (`kpi-card` jt surnud kogum tähendab, et vana KPI-plaat on asendatud `finance-kpi-card`-iga).

## 5. Riskid

1. **`backdrop-filter` loob containing block'i.** `.glass-card` (blur 16), `.login-card.glass-card` (blur 18+saturate), `.app-header` (blur 12, `:143`), leaflet-popup (`:2867`) — `position:fixed` järeltulijad paigutuvad selle ette, mitte viewport'i. Ohtlik on, kui kaardi sisse pannakse mitteportaalitud hüpik. Praegune `ui/` portaalib `usePopupContainer()`-iga dialoogi sisse (README `:44,153`), kuid kaardi (mitte-dialoogi) sees portaalib `document.body`-sse: ok. `Card` komponendil on `backdrop-blur-lg` ka (`cardClass`), seega sama käitumine. Soovitus: `Card` ilma blur'ita vaikimisi, blur ainult `variant="glass"` ujuvpaneelidele.
2. **`transform` kaartidel:** `cultivation-panel` (`:1366`, `translateX(-50%)`) ja `add-poi-banner` (`:572`). Mõlemad loovad containing block'i ja stacking context'i; `Select`/`DateInput` portaalid mööduvad, aga `title` ja `position:fixed` käsitsi hüpikud (`HelpHint`, `FieldContextMenu`) neis kaartides katki. `CultivationControl` sisaldab Select'e — kontrollida, et portaal on `body`-sse. Soovitus: asendada `left:50% + translateX` `left:0;right:0;margin:auto` + `width: fit-content`.
3. **Kaardi klass kannab layouti:** `cultivation-panel` (position/bottom/left/width/z), `add-poi-banner`, `coords-tracker`, `radar-legend`, `satellite-panel` (z-index), `layer-control-panel` (`flex:0 0 auto`, `transition: all`), `field-map-card-anchor`, `admin-login` (centreerimine), `login-card` (padding + flex), `vehicle-card/device-card/finance-entry-card/support-panel/register-crop-summary/admin-stat` (flex column + gap). `Card` jaoks tuleb eraldada (a) välimus ja (b) asend; asendi klassid jäävad kasutuskoha `className`-i.
4. **Spetsiifilisuse ülekirjutused:** kõik legacy reeglid on samas `legacy` kihis; `coords-tracker`/`radar-legend`/`satellite-panel` (`:327,341,423`) kirjutavad glass-card'i raadiuse sm-ks ainult järjekorra tõttu (hiljem kui `:128`). Tailwind `cardClass` (`rounded-lg`) on `utilities` kihis ja võidaks legacy reegli — pärast `Card`-ile üleminekut muutuvad need 6px kastid 16px-ks, kui `className` ei anna `rounded-md`/`rounded-sm`.
5. **`.login-page .login-card.glass-card` (`:4628`)** kirjutab glass'i täielikult üle (taust, ääris, vari, värv). Tuleb jätta variandiks `Card variant="login"` või jätta legacy.
6. **Leaflet:** ükski kaardiklass ei ole Leafleti kontrolli (`leaflet-control*`) sees; `grep leaflet-control src/components/*.tsx`: 0. Paneelid on `.map-wrapper` / `.map-top-right-stack` sees absoluutselt paigutatud, `satellite-panel` portaalitakse DOM-is `map-top-right-stack`-i (`SatellitePanel.tsx:476`). `pointer-events:none` konteinerid (`coords-tracker`, `radar-legend`, `map-top-right-stack`) — `Card` ei tohi `pointer-events`'i ise seada. Kaardi hüpikud/vihjed (`leaflet-popup-*`, `popup-row`, `popup-note`) on spec'i järgi ulatusest väljas.
7. **Tume teema:** `--card-bg` puudu (vt 1. ptk) — kaks plaati valged tumedas teemas.
8. **`transition: all`** `.layer-control-panel`-il (`:611`) ja `.vehicle-card`-il (`:2016`) — animeerib ka `backdrop-filter`'it ja varju; `Card` kasutab `transition-colors`.
9. **Inline style:** 3× identne filtririba `style` ja 3× tühja oleku `style` (täielikult spec'i vastu, "style ainult dünaamiliste väärtuste jaoks") — liigub `Card`/`EmptyState`-i prop'idesse.

## 6. Lahtised küsimused kasutajale

1. **Klaas või tahke registrivaadetes ja adminis?** Praegu on klaas (blur 16) ka tavalisel lehekaardil (adminis 17 kohta, register-loendid), kus taustal pole midagi läbi paistvat. Soovitus: ujuvpaneelid kaardil jäävad klaasiks (`variant="glass"`), kõik muu (admin, registrikaardid, KPI-plaadid) tahke `bg-card` ilma blur'ita; vähem GPU-d ja pole containing block'i riski.
2. **Raadius ja padding.** Praegu 16/10/8/7/6. Soovitus: kaart ja ujuvpaneel 16, sisemine plaat (KPI, tile, sektsioon) 10 (`rounded-md`), väikesed kastid (coords/legend/note) 6→10; padding skaalal `p-3` (12) / `p-4` (16), kompaktsed kaardid `p-3`, kaardi päis `px-4 py-3`.
3. **Vari.** Praegu `--shadow-glass`, `--shadow-modal`, `0 4px 16px`. Soovitus: üks `shadow-card` kõigile kaartidele, ujuvpaneelid ja `field-map-card` ühe astme võrra tugevamalt (`shadow-popover`), sisemised plaadid ilma varjuta.
4. **Kas ümber teha ka sisselogimise kaart ja `admin-login`?** Login on eraldi kreemjas stiil (`:4628`). Soovitus: jätta `login-card` legacy'sse (erijuhtum, sama mõtte nagu "Leaflet jääb"), ainult `admin-login` ja `admin-card` viia `Card`-ile.
