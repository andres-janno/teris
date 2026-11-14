# Märkide ja sakkide inventuur (2026-11-14) — etapi 2.4 lähteandmed

Kaardistatud failidest (src/, v.a `src/admin` ja `src/landing`), serveris `grep`/`sed`/`node`iga. Read-numbrid on serveri praeguse seisu järgi (HEAD `80e0a50`).
`ui/Badge.tsx` ja `ui/Tabs.tsx` kasutajaid rakenduses **ei ole** (`<Badge`, `<Tabs`, `<TabsTrigger` esinemisi väljaspool `ui/` kausta: 0). Kõik allpool on vana CSS või toored elemendid.

`ui/Badge` praegu: `<span>` + `badgeVariants({tone})`: `inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold`; toonid `success` (`bg-primary/15 text-primary`), `info`, `warning`, `danger` (`destructive`), `accent`, `neutral` (`bg-muted text-muted-foreground`, vaikimisi). Ääriseta, suurust ei ole, `style`/`className`/children läbivad.
`ui/Tabs` praegu: Radix `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `variant` konteksti kaudu. `line`: list `gap-1 border-b`, trigger `-mb-px border-b-2 px-3 py-2 text-sm`, aktiivne `border-primary`. `segmented`: list `gap-0.5 rounded-md bg-muted p-0.5`, trigger `rounded-sm px-2.5 py-1 text-xs`, aktiivne `bg-card shadow-sm`. Trigger: `font-semibold text-muted-foreground cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50` + focusRing. Puudub: kerimine, ikoonid/loendur (kompositsiooniga olemas, sest `gap-1.5`), `ToggleGroup`.

Suurusvõrdlus allpool: ui Badge = 11px (`text-2xs`), `px-2 py-0.5` (8/2px), `rounded-full`, ilma ääreta. rem→px: 0.64=10.2, 0.65=10.4, 0.66=10.6, 0.68=10.9, 0.7=11.2, 0.72=11.5, 0.73=11.7, 0.74=11.8, 0.82=13.1.

## 1. Faktid

### 1.1 Märgiklassid src/index.css-is

tsx = esinemisi tsx/ts-failides (v.a ui/, admin, landing, tooling), regex `(?<![\w-])klass(?![\w-])`; "dün." = klass koostatakse andmest (`status-${…}`, `.toLowerCase()`), seega literaal-grep alahindab. `src/App.css` ja `src/styles/app.css` märgiklasse ei sisalda.

#### Olekumärgid (tähendus → toon)

| Klass | Rida | Mida seab | tsx | Märkus |
|---|---|---|---|---|
| `.status-badge` + `.status-working/-moving/-stopped/-idling/-offline` | 2416 (2423–2447) | 0.68rem 700, padding 2/8, radius 10px, **border 1px** toonivärviga; taust rgba .15 | 4 (+dün. `status-${v.status}`) | working roheline, moving sinine, stopped hall, idling amber, offline tume hall |
| `.fleet-active-badge` | 10178 | lisab `status-badge`-ile inline-flex gap 5px, emerald värv; `.fleet-active-dot` 10185 (6px punkt) | 2 | punkt ikoonina |
| `.active-pill` | 2887 | 0.65rem 700, padding 2/8, radius 10px, **tahke** emerald taust, valge tekst | 2 | |
| `.user-status-pill` + `.status-active/-invited/-pending/-inactive` | 6115 (6134–6152) | 0.73rem 600, padding 3/9, radius 9999px, border 1px, taust rgba .14; `.user-status-dot` 6127 | 4 (+4 punkti) | active roheline, invited amber, pending oranž `#ea580c`, inactive roosa/punane |
| `.fw-status-pill` + `.in_progress/.done/.unplanned` | 7830 (7840–7855) | 0.72rem 700, padding 3/10, radius 999px, ääreta; planned hall, in_progress roheline tint, **done tahke roheline valge tekst**, unplanned amber | 2 (dün. `.toLowerCase()`) | |
| `.fw-finance-chip` + `.clickable/.confirmed/.changed` | 8009 (8020–8039) | 0.66rem 700, padding 2/7, radius 999px, ääreta; vaikimisi (pending) amber `#9a5b00`, confirmed **tahke roheline**, changed sinine; clickable = nupp inline-flex + hover varjuga | 4 (dün.) | |
| `.season-status-badge` | 4922 | 0.72rem 700, padding 2/8, radius 12px; **värv ja taust inline** | 1 | `SEASON_PHASE_META` (types/season.ts:43) |
| `.work-phase-badge` | 6229 | 0.72rem 700, padding 2/9, radius 999px; **värv ja taust inline** | 1 (PhaseBadge) | `WORK_PHASE_META` (types/fieldWork.ts:21) |
| `.support-panel-status` (+`.is-active`) | 9551 (9561) | 0.72rem 600, padding 3/10, radius 999px, hall; aktiivne roheline | 1 | |
| `.stock-shortage-badge` | 9726 | 0.68rem 700, padding 1/6, radius 10px, border 1px, punane `#dc2626` | 1 | |
| `.users-admin-badge` | 6158 | 0.7rem 600, padding 1/6, radius 9999px, amber `rgba(217,119,6,.14)` | 4 | kasutusel "Mitteaktiivne" ja "Põhiladu" (tähendus amber = hoiatus ei kehti kummagi puhul) |
| `.article-default-badge` | 10005 | **11px**, padding 1/6, radius 8px, `--color-surface-muted` (fallback hex) hall | 1 | ainus kuhu 11px literaal |
| `.tenure-badge` + `.owned/.rented/.mixed` | 3861 (3871–3881) | 0.7rem **400**, padding 1/8, radius 999px, ääreta; emerald/blue/amber 14% | 1 (dün. `${r.tenure}`) | |
| `.cad-tenure-tag` + `.owned/.rented/.unknown` | 5406 (5413–5417, 10134) | 0.7rem 600, padding 1/6, radius 999px; owned emerald, **rented amber** (vastuolus `.tenure-badge.rented` sinisega), unknown hall | 1 (dün.) | |
| `.popup-title-row .status-tag` + `.working/.moving/.stopped` | 5076 (5084–5096) | 0.62rem 800 **uppercase**, padding 1.5/6, radius 4px, border 1px | 1 (**HTML-string** MapView.tsx:532) | |
| `.weather-credential-ok/-missing` | 5890–5891 | ainult tekstivärv, taust puudub | 2 | |

#### Loendurid (numbrid)

| Klass | Rida | Mida seab | tsx | Märkus |
|---|---|---|---|---|
| `.count-pill` | 2945 | 0.65rem, padding 1/6, **radius 6px**, border 1px, `--btn-sec-bg`; `.filter-tab.active .count-pill` (2954) valge läbipaistev | 6 | alati `.filter-tab` sees |
| `.finance-count-badge` (+`.all-done`) | 9433 (9442) | 0.72rem 700, padding 2/6, radius 999px, hall; all-done `#dcfce7`/`#15803d` | 1 | "x/y" |
| `.finance-tab-badge` | 8727 | 0.68rem 700, padding 1/6, radius 999px, **tahke amber `#f59e0b` valge tekst** | 2 (üks sakis, üks nupus) | |
| `.crop-group-count` | 5574 | 0.7rem 600, padding 0/7, radius 999px, border 1px | 1 | |
| `.usage-count-badge` | 408 | 0.65rem 700, padding 2/5, radius 999px, border 1px | 1 | nupu sees |
| `.crop-field-count` | 4676 | 0.64rem tekst, pole märk | 1 | vt jaotis 4 |
| `.trip-gap-count` | 10202 | 13px amber tekst + ikoon, pole märk | 1 | vt jaotis 4 |

#### Kategooria-/silditagid (neutraalsed)

| Klass | Rida | Mida seab | tsx | Märkus |
|---|---|---|---|---|
| `.mini-badge` (+`.badge-list`) | 2160 (2154) | 0.68rem 700, padding 2/6, radius 4px, `rgba(255,255,255,.06)` (heledas teemas peaaegu nähtamatu) | 8 (+2 list) | faililaiendid/CRS |
| `.sub-tag` (+`.winter-tag`) | 4405 (4399) | 0.68rem, padding 2/6, radius 4px, border 1px, `--bg-input`; winter sinine | 6 | `.spring-tag`, `.owner-tag`, `.soil-tag`, `.device-tag`, `.implement-tag` **CSS-i ei ole** (tühjad klassid) |
| `.field-sub-tags` | 4378 | flex wrap konteiner | 5 | ei ole märk |
| `.field-num-badge` | 4325 (4343 dark, 4051) | **0.82rem 800**, padding 2/7, radius 5px, valge taust, roheline 1.5px border, varjuga, kõvakodeeritud hex | 5 | "Nr 12" |
| `.finance-field-badge` | 8919 | 0.68rem 800, padding 0/4, radius 4px, valge, roheline border | 1 | `.field-num-badge` duplikaat |
| `.field-code-badge` | 4350 | 0.72rem 600, padding 2/7, radius 4px, sinine tint + border | 3 | PRIA massiivi nr / kultuurikood |
| `.equipment-tag` (+`.tag-text`) | 2271 (2283) | padding 4/8, 0.72rem, border, radius-sm, ikoon + tekst, tekst nowrap ellipsis | 2 (+2) | `.v-equipment-badge-row` 2264 |
| `.finance-year-badge` | 8717 | 0.72rem 700, padding 2/8, radius 999px, border | 1 | |
| `.finance-icon-badge` | 8699 | 38px ikoonikast | 1 | ei ole märk |
| `.year-widget-stat` | 1176 | 0.72rem 700, padding 2/6, radius 4px | 1 | kokkuvõtte tekst |
| `.telemetry-pill-impl/-time/-action/-worker/-field/-vehicle/-meta/-row/-unlink` | 8197–8284 | impl 0.78rem sinine tint 4px, time 0.8rem roheline tint 6px + ikoon, action 0.72rem roheline tint 4px (valitud: tahke); vehicle/worker/field puhas tekst; unlink = nupp | 9 | koos `.telemetry-suggestion-pill` kaardiga (8169) |
| `.add-work-tag` (+`.on-field/.to-add/.to-remove/.removed`), `.add-work-count` | 8634–8689 | ainult tekstivärv, taust puudub | 1 + 1 | vt jaotis 4 |

#### Andmevärviga märgid

| Klass | Rida | Mida seab | tsx | Andmeallikas |
|---|---|---|---|---|
| `.finance-kind-badge` | 9088 | 0.7rem 700, padding 2/7, radius 999px, ikoon 12px + tekst | 1 | inline `info.color/bg` (`LINE_KIND_INFO`, FinanceModal.tsx:39, 7 liiki, kõvakodeeritud hex) |
| `.work-phase-badge` / `.season-status-badge` | vt üleval | | 1 / 1 | `WORK_PHASE_META`, `SEASON_PHASE_META` |
| `.sub-tag` rolli variant | 4405 | | 1 sait | inline `PARTY_ROLE_CONFIG` (types/party.ts:36: color, bgColor, `${color}40` border) |
| `.finance-crop-pill` | 9423 | 0.74rem 600, padding 2/8, **radius `0 4px 4px 0`**, vasak 3px riba | 1 | inline `borderLeftColor: r.cropColor` |
| `.register-crop-stat` | 3747 | 0.92rem, padding 5/12, radius 6px, `color-mix(--crop-color)` + vasak riba; **nupp** | 1 | `--crop-color` inline |
| `.fields-table-crop` | 3846/3852 | kultuuri värvikast tabelis | 1 | `--crop-color` |

#### Klõpsatavad pillid/chipid (tegelikult nupud või segmenteeritud juhtnupud, vt jaotis 1.2)

`.filter-tab` (2911), `.year-tab` (4114), `.year-widget-btn` (1191), `.finance-filter-chip` (8807), `.reg-stat-pill.is-filter` (5336), `.register-crop-stat` (3747), `.segmented-option` (3043), `.cc-segmented button` (1782), `.work-register-tabs button` (6203), `.telemetry-suggestion-pill` (8169), `.telemetry-pill-unlink` (8270), `.fw-finance-chip.clickable` (8020).

### 1.2 Saki- ja segmentklassid

| Klass | Rida | Välimus | role=tab | Klaviatuur | Sisu |
|---|---|---|---|---|---|
| `.category-filter-tabs` + `.filter-tab` | 2905 / 2911 (2926 hover, 2932 active, 2939 dark, 6468–6488 täislehe/flotti ülekirjutus) | **nuppude rida**: padding 6/12, border 1px, radius-sm, bg `--stat-bg`, flex-wrap; aktiivne tume navy `#0f172a` `!important` (täislehe kontekstis roheline `#16a34a` 30px kõrgus) | ei (tavalised `<button>`) | ainult natiivne Tab/Enter; ei nooleklahve | **paneelid vahetuvad**: VehicleTracker, ArticlesView `tab`; **ainult filter**: ArticlesView grupp, FieldsTableView omand, PoiManagerModal kategooria |
| `.year-tabs` + `.year-tab` | 4104 / 4114 (4129, 4134 aktiivne roheline `#15803d`, 4769 locked, 6459–6488) | **segmenteeritud rida** konteineris (bg input, padding 4, border); `.locked` + `Lock size=10` (`.tab-lock-icon`, 4759); `.fullpage-board-body`/`.fw-toolbar` kontekstis konteiner läbipaistev + `flex-wrap` | ei | natiivne | ainult valitud aasta olek (filter/andmevaade), paneele ei vaheta |
| `.work-register-tabs` | 6194 / 6203 / 6215 | **segmenteeritud**: bg stat-bg, padding 3, border, radius 8; aktiivne roheline `#16a34a` | **jah**: `role="tablist"`/`role="tab"`/`aria-selected` (FinanceModal.tsx:416–436) | **puudub** (pole `onKeyDown`, pole roving tabindex, pole `aria-controls`/`tabpanel`) | paneelid vahetuvad (`tab === 'entries' &&`) |
| `.finance-filter-chips` + `.finance-filter-chip` | 8802 / 8807 (8827 aktiivne roheline) | väikesed ristkülik-chipid (radius 6, border) | ei | natiivne | ainult filter-olek |
| `.segmented-control` + `.segmented-option` | 3034 / 3043 (3064 aktiivne navy, 3069 dark) | **segmenteeritud**: bg stat-bg, border, padding 3; ikoon+tekst | ei | natiivne | vormiväli (valik), paneel ei vaheta |
| `.cc-segmented` (+`.cc-speed`) | 1773 / 1782 (1796, 1800 aktiivne `--emerald-600`, 2049) | **segmenteeritud** kõrgus `--cc-h`, padding 2, border | ei, `role="group"` + `aria-label`; **ei `aria-pressed`** | natiivne | valik (režiim/kiirus) |
| `.year-widget-pills` + `.year-widget-btn` | 1185 / 1191 (1206, 1224 aktiivne roheline) | **grid** (gap 6), kaardi sisse kõrvuti nupud; `.locked-btn`, `Lock`+`.pill-lock-icon` (4758) | ei | natiivne | ainult valitud aasta (kaardi vidin) |
| `.satellite-product-row` + `.basemap-btn` | 567 / 829 | nupurida | `role="radiogroup"`/`role="radio"`/`aria-checked` (SatellitePanel.tsx:285–291) | ei nooleklahve | valik |
| `.reg-stat-pill.is-filter`, `.register-crop-stat` | 5336 / 3747 | pill-nupp, aktiivne = rõngas `0 0 0 2px` toonivärviga | ei | natiivne | ümberlülitus (sama klõps tühistab) |
| `.fullpage-tab(s)`, `.v-filter-pill`, `.layer-year-pill(s)`, `.history-pill` | vt jaotis 6 | — | — | — | **kasutuseta** |

Praegu ei ole **ühtegi** nooleklahvikäsitlust (grep `onKeyDown` FinanceModal, VehicleTracker, CultivationControl, ArticlesView, MapYearSelector: 0). Ainult FinanceModal-il on `role="tab"`, ja sellel ka ilma tabpanel-ita.

### 1.3 ui-audit

- `scripts/ui-audit.mts` kutsub `summarize()` (`src/tooling/uiAudit.ts`); **EXCLUDE** = `src/landing`, `src/admin`, `src/styles`.
- `LEGACY_COMPONENT = /\.((?:btn|modal|badge|pill|tab|data-table|table)[\w-]*)/g` skaneerib **ainult CSS-i** (`auditCss`), eesliide `.`-ile järgnevalt (ilma lookbehindita, st ka liitselektori keskel). Märke/sakke tsx-is **ei loeta**: tsx-poolel on vaid `legacyButtons`, `legacyModals`, `legacyTables`.
- index.css-is loeb praegu märgi/saki osas **3** klassi: `.badge-list` (2154), `.pill-lock-icon` (4758), `.tab-lock-icon` (4759). (Lisaks mitte-märgi/saki klassid `.btn…` jt.)
- **Ei lähe arvesse** (nimi ei alga badge/pill/tab-iga): `mini-badge`, `count-pill`, `status-badge`, `filter-tab`, `year-tab`, `field-num-badge`, `user-status-pill`, `reg-stat-pill`, `fw-status-pill`, `telemetry-pill-*`, `work-register-tabs`, `year-tabs`, `category-filter-tabs`, `segmented-*`, `cc-segmented`, `sub-tag`, `equipment-tag` jt. Seega ei näita mõõdik nende kustutamist.
- `.table…` ja `.tab…` eesliide kattuvad (`.table-*` loeks `.tab`-i alla); praegu `.table*` klasse CSS-is pole.
- **Soovitus etapile 2.4:** lisada tsx-poolele `LEGACY_BADGE`/`LEGACY_TAB` (selle inventuuri klassid) ja CSS-poolel nimekiri, või lisada tsx-lugemisse uus rida "Vanu märke/sakke (tsx)", nagu tabelitel (`legacyTableFiles`).

## 2. Märkide tabel

Veerud: # | fail:rida | otstarve | klass(id) | rühm | soovitatav toon + praegune värvitähendus | andmest (inline/dün.) | klõpsatav | ikoon | suurus vs ui Badge.
Rühmad: **S** olek, **L** loendur, **T** silt/kategooria, **D** andmevärv, **M** muu (ei sobi Badge'ina).
"sama" = ~11px; paddingud võrreldes 8/2px.

| # | fail:rida | otstarve | klass | rühm | toon / praegune värv | andmest | klõps | ikoon | suurus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | VehicleTracker.tsx:1447 | masina olek (5 olekut) | `status-badge status-${v.status}` | S | working success / moving info / idling warning / stopped neutral / offline neutral (tumedam hall) | klass andmest, tekst ternary | ei | ei | sama (10.9px), 2/8, border 1px (Badge'il ei ole), radius 10 |
| 2 | VehicleTracker.tsx:2058 | seadme seos "aktiivne" | `status-badge status-working fleet-active-badge` | S | success, roheline | ei | ei | **jah, punkt 6px** | sama |
| 3 | DeviceAssignmentRegister.tsx:316 | sama | sama | S | success | ei | ei | jah, punkt | sama |
| 4 | TripRegister.tsx:259 | sõit käimas | `status-badge status-working` | S | success | ei | ei | ei | sama |
| 5 | VehicleTracker.tsx:2159 | seade "Aktiivne" kaardil | `active-pill` | S | success **tahke** (emerald, valge tekst) | ei | ei | ei | 10.4px, 2/8, radius 10 |
| 6 | VehicleTracker.tsx:2205 | haake "Haagitud" | `active-pill` | S | success tahke | ei | ei | ei | sama |
| 7 | UsersAdminModal.tsx:192 | kasutaja Keelatud | `user-status-pill status-inactive` | S | danger | ei | ei | punkt | **suurem** 11.7px, 3/9, border |
| 8 | UsersAdminModal.tsx:197 | Kutse saadetud | `user-status-pill status-invited` | S | warning | ei | ei | punkt | suurem |
| 9 | UsersAdminModal.tsx:202 | Parool vahetamata | `user-status-pill status-pending` | S | warning (praegu oranž `#ea580c`, eristub amberist; kaob) | ei | ei | punkt | suurem |
| 10 | UsersAdminModal.tsx:207 | Aktiivne | `user-status-pill status-active` | S | success | ei | ei | punkt | suurem |
| 11 | FieldWorksBoard.tsx:1178 | töö "Planeerimata" | `fw-status-pill unplanned` | S | warning | ei | ei | ei | suurem 11.5px, 3/10 |
| 12 | FieldWorksBoard.tsx:1180 | töö olek (Planeeritud/Töös/Lõpetatud) | `fw-status-pill ${status.toLowerCase()}` | S | planned neutral / in_progress success / done **success tahke** | klass andmest | ei | ei | suurem |
| 13 | FieldWorksBoard.tsx:1308 | kande finantsolek (nupp) | `fw-finance-chip clickable ${…}` | S | pending warning / confirmed success tahke / changed info | klass andmest | **jah** (avab finantsi) | jah, `Euro` 10px | väiksem 10.6px, 2/7 |
| 14 | FieldWorksBoard.tsx:1319 | sama, ainult lugemiseks | `fw-finance-chip ${…}` | S | sama | klass andmest | ei | ei | väiksem |
| 15 | FinanceModal.tsx:544 | kande finantsolek kaardil | `fw-finance-chip ${st.className}` | S | sama | klass andmest | ei | ei | väiksem |
| 16 | FinanceModal.tsx:585 | sama detailis | `fw-finance-chip ${…}` | S | sama | klass andmest | ei | ei | väiksem |
| 17 | SeasonManagerModal.tsx:244 | hooaja faas (4 olekut), `title` selgitus | `season-status-badge` | D | faasi tähendus; `SEASON_PHASE_META` colour+bg (nt unopened `#64748b`/hall) — kaardistada tooniks (neutral/info/warning/success) | **jah, inline color+bg** | ei | ei | sama 11.5px, 2/8, radius 12 |
| 18 | WorkRegisterModal.tsx:33 (kasutus :116) | töö faas — komponent `PhaseBadge` | `work-phase-badge` | D | PREPARATION info `#1d4ed8` / SOWING success `#15803d` / CARE accent `#7c3aed` / HARVEST warning `#9a5b00` — **kaardistub 1:1 toonidele** | jah, inline (meta) | ei | ei | sama 11.5px, 2/9 |
| 19 | SupportAccessPanel.tsx:56 | tugiligipääs Lubatud/Suletud | `support-panel-status[.is-active]` | S | success / neutral | klass ternary | ei | ei | suurem, 3/10 |
| 20 | StockDocumentsPanel.tsx:116 | ülekande "puudujääk", `title` | `stock-shortage-badge` | S | danger, border 1px | ei | ei | ei | sama 10.9px, 1/6 |
| 21 | WarehousesPanel.tsx:65 | "Põhiladu" | `users-admin-badge` | S | **info/success** (praegu amber, tähendus vale) | ei | ei | ei | sama 11.2px, 1/6 |
| 22 | WarehousesPanel.tsx:66 | "Mitteaktiivne" | `users-admin-badge` | S | neutral (või warning) | ei | ei | ei | sama |
| 23 | WorkRegisterModal.tsx:113 | "Mitteaktiivne" | `users-admin-badge` | S | sama | ei | ei | ei | sama |
| 24 | ArticlesView.tsx:281 | "Mitteaktiivne" | `users-admin-badge` | S | sama | ei | ei | ei | sama |
| 25 | ArticlesView.tsx:280 | "vaikimisi", `title` | `article-default-badge` | T | neutral | ei | ei | ei | sama 11px, 1/6, radius 8 |
| 26 | FieldsTableView.tsx:406 | omandivorm (omab/rendib/segatud) | `tenure-badge ${r.tenure}` | S | owned success / rented info / mixed warning | klass andmest | ei | ei | sama, 1/8, **kaal 400** |
| 27 | FieldEditDialog.tsx:681 | tuletatud omandivorm, `title` | `cad-tenure-tag ${…toLowerCase()}` | S | owned success / rented **warning (vastuolu #26-ga: seal info)** / unknown neutral | klass andmest | ei | ei | sama 11.2px, 1/6 |
| 28 | FinanceModal.tsx:1016 | kinnitatud/kokku "x/y" | `finance-count-badge[.all-done]` | L | neutral → success kui kõik kinnitatud | klass ternary, tekst andmest | ei | ei | sama 11.5px, 2/6 |
| 29 | WeatherCredentialModal.tsx:105 | API võti salvestatud/puudub | `weather-credential-ok/-missing` | S | success / warning; praegu **ainult tekstivärv** | ei | ei | ei | tekst |
| 30 | MapView.tsx:532 | kaardi popup "TÖÖTAB/LIIKUB/SEISAB" | `status-tag ${vehicle.status}` | S | success/info/neutral | klass andmest | ei | ei | 0.62rem uppercase, **HTML-string, mitte React** → Badge ei sobi; jäta või genereeri sama klassidega |
| 31 | VehicleTracker.tsx:840 | masinate arv saki sees | `count-pill` | L | neutral | tekst andmest | ei | ei | sama 10.4px, **1/6, radius 6, border** |
| 32 | VehicleTracker.tsx:848 | haakeriistade arv | `count-pill` | L | neutral | jah | ei | ei | sama |
| 33 | VehicleTracker.tsx:856 | haakimiste arv | `count-pill` | L | neutral | jah | ei | ei | sama |
| 34 | VehicleTracker.tsx:865 | seadmete arv | `count-pill` | L | neutral | jah | ei | ei | sama |
| 35 | VehicleTracker.tsx:875 | seoste arv | `count-pill` | L | neutral | jah | ei | ei | sama |
| 36 | PoiManagerModal.tsx:237 | huvipunktide arv kategoorias | `count-pill` | L | neutral | jah | ei | ei | sama |
| 37 | FinanceModal.tsx:426 | ootel kannete arv saki sees, `title` | `finance-tab-badge` | L | warning **tahke** (`#f59e0b` valge tekst) | jah | ei | ei | sama 10.9px, 1/6 |
| 38 | FieldWorksBoard.tsx:728 | ootel finantskannete arv nupu sees | `finance-tab-badge` | L | warning tahke (siiski mitte sakk, `ui/Button` sees) | jah | ei | ei | sama |
| 39 | CropRegisterModal.tsx:768 | kultuure plokis | `crop-group-count` | L | neutral | jah | ei | ei | sama 11.2px, 0/7, border |
| 40 | RelatedPartiesModal.tsx:568 | seoste arv kustutusnupu sees | `usage-count-badge` | L | neutral / danger (nupp on keelatud-kustuta) | jah | nupu osa | Link2 nupul | väiksem 10.4px, 2/5, border |
| 41 | FinanceModal.tsx:410 | "2026. a hooaeg" | `finance-year-badge` | T | neutral | jah (aasta) | ei | ei | sama 11.5px, 2/8, border |
| 42–45 | FieldUploadModal.tsx:218–221 | failitüübid .SHP/.DBF/.PRJ/L-EST97 | `mini-badge` | T | neutral | ei | ei | ei | sama 10.9px, 2/6, **radius 4px** |
| 46–49 | SoilSampleUploadModal.tsx:131–134 | .SHP/.DBF/.PRJ/WGS84 | `mini-badge` | T | neutral | ei | ei | ei | sama |
| 50 | FieldManagerModal.tsx:540 | PRIA põllu nr "Nr 12" | `field-num-badge` | T | success **kontuur** (valge/roheline border 1.5px, tume tekst) | jah (num) | ei | ei | **suurem 13.1px**, 2/7, kaal 800, radius 5, varjuga |
| 51 | FieldMapCard.tsx:30 | sama kaardil | `field-num-badge` | T | sama | jah | ei | ei | suurem |
| 52 | FieldWorksBoard.tsx:897 | sama | `field-num-badge` | T | sama | jah | ei | ei | suurem |
| 53 | FieldsTableView.tsx:384 | sama, `title` | `field-num-badge` | T | sama | jah | ei | ei | suurem |
| 54 | FinanceModal.tsx:989 | sama tabelis | `field-num-badge` | T | sama | jah | ei | ei | suurem |
| 55 | FinanceModal.tsx:541 | sama kandekaardil | `finance-field-badge` | T | `field-num-badge` duplikaat, 10.9px | jah | ei | ei | sama |
| 56 | FieldManagerModal.tsx:544 | PRIA massiivi nr, `title` | `field-code-badge` | T | info (sinine tint+border) | jah | ei | ei | sama 11.5px, 2/7, radius 4 |
| 57 | FieldsTableView.tsx:388 | sama | `field-code-badge` | T | info | jah | ei | ei | sama |
| 58 | CropRegisterModal.tsx:811 | PRIA kultuurikood, `title` | `field-code-badge` | T | info | jah | ei | ei | sama |
| 59 | CropRegisterModal.tsx:808 | talivili/suvivili, emoji tekstis | `sub-tag winter-tag`/`spring-tag` | T | winter info / spring neutral | klass ternary | ei | emoji tekstis | sama 10.9px, radius 4, border |
| 60 | CropRegisterModal.tsx:812 | kultuurigrupp, emoji | `sub-tag` | T | neutral | jah | ei | emoji | sama |
| 61 | FieldManagerModal.tsx:545 | operaator 👤 | `sub-tag owner-tag` | T | neutral (`owner-tag` pole stiilitud) | jah | ei | emoji | sama |
| 62 | FieldManagerModal.tsx:546 | mullatüüp 🌱, `title` | `sub-tag soil-tag` | T | neutral (`soil-tag` pole stiilitud) | jah | ei | emoji | sama |
| 63 | RelatedPartiesModal.tsx:598 | isiku roll (Maaomanik/Töötaja/…) | `sub-tag` + inline | D | roll → toon (LANDOWNER emerald→success…); praegu `color`, `backgroundColor`, `${color}40` border, kaal 600 | **jah, inline** | ei | emoji | sama |
| 64 | WorkRegisterModal.tsx:119 | "Tööaeg/Kütus/…" loend (tegelikult info) | `sub-tag` | T | neutral | jah | ei | ei | sama |
| 65 | VehicleTracker.tsx:1490 | seade "GPS …" | `equipment-tag device-tag` | T | neutral, ellips | jah | ei | **lucide Radio 12** | **suurem** padding 4/8 (kõrgem), 11.5px |
| 66 | VehicleTracker.tsx:1510 | haakeriist | `equipment-tag implement-tag` | T | neutral, ellips | jah | ei | lucide Wrench 12 | suurem |
| 67 | FinanceModal.tsx:669 | kande rea liik (7 liiki) | `finance-kind-badge` | D | LABOR info / MACHINE warning / IMPLEMENT neutral / FUEL oranž (**kattub MACHINE-iga**) / MATERIAL success / HARVEST success / OBSERVATION neutral | **jah, inline color+bg** | ei | **lucide ikoon 12** | sama 11.2px, 2/7 |
| 68 | FinanceModal.tsx:995 | põllu kultuur tabelis | `finance-crop-pill` | D | neutral + kultuuri värviriba vasakul (`borderLeftColor`) | **jah, inline** | ei | ei (värviriba) | suurem 11.8px, 2/8, **radius `0 4 4 0`** |
| 69 | MapYearSelector.tsx:87 | "N põldu • X ha" | `year-widget-stat` | T | neutral | jah | ei | ei | sama 11.5px, 2/6, radius 4 |
| 70 | FieldWorkEntryDialog.tsx:464 | haakeriist soovitusel "+nimi" | `telemetry-pill-impl` | T | info tint | jah | osa nupust | ei | suurem 12.5px |
| 71 | FieldWorkEntryDialog.tsx:466 | "(haakeriist puudub)" | `telemetry-pill-impl` + inline `#ef4444` | T | **danger** | jah, inline | osa nupust | ei | suurem |
| 72 | FieldWorkEntryDialog.tsx:468 | sõidu aeg | `telemetry-pill-time` | T | success tint | jah | osa nupust | lucide Clock 12 | suurem 12.8px, radius 6 |
| 73 | FieldWorkEntryDialog.tsx:489 | "Vali see sõit/✓ Valitud/✓ Seotud" | `telemetry-pill-action` | S | success; valitud = tahke | tekst state-st | osa nupust | ei | sama 11.5px |

Märkus: tabelis on 73 rida (#42–45 ja #46–49 on kumbki 4 mini-badge'i ühes failis). Rühmade read: S olek 1–16, 19–24, 26, 27, 29, 30, 73 ; L loendur 28, 31–40 ; T silt 25, 41–62, 64–66, 69–72 ; D andmevärv 17, 18, 63, 67, 68.

## 3. Sakkide tabel

Veerud: # | fail:rida | otstarve | klass(id) | välimus | valikuid | soovitus (`line`/`segmented`/ToggleGroup) | päris sakk või filter | ikoon/loendur/lukk | keelatud valikud | kerimine.

| # | fail:rida | otstarve | klass(id) | välimus | valikuid | soovitus | päris sakk? | ikoon / loendur / lukk | keelatud | kerimine |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | VehicleTracker.tsx:825 | Sõidukivaate peasakid | `category-filter-tabs` + `filter-tab` | pillid-nupud, aktiivne navy | **3–6** (sõidud, seadmed, seoste register on `telemetryEnabled` taga; masinad, haakeriistad, haakimised alati) | `line` (6 + loendur ei mahu `segmented` listi) | **jah**, `activeTab` vahetab paneeli (`closeForm()` + laadimine) | emoji siltides; **5 loendurit** (`count-pill`) | ei | `flex-wrap` (murrab), ei kerimist |
| 2 | ArticlesView.tsx:159 | Artiklid / Laokanded / Saagipartiid / Laod | `category-filter-tabs articles-tabs` + `filter-tab` | pillid-nupud | **3–4** (Saagipartiid vaid `canManageFinance`) | `line` | **jah** (`tab` vahetab paneeli) | ei | ei | wrap |
| 3 | FinanceModal.tsx:416 | Hinnastamine / Põldude tasuvus | `work-register-tabs` (role=tablist/tab) | segmenteeritud, aktiivne roheline | 2 | `segmented` (või `line`) | **jah** (paneelid unmountitakse) | **loendur** `finance-tab-badge` esimeses; ei ikoone | ei | ei |
| 4 | ArticlesView.tsx:176 | hooaasta valik | `year-tabs` + `year-tab` | segmenteeritud, aktiivne roheline | dün. (`availableYearsList`) | `segmented` või ToggleGroup | **filter** (`selectedYear`, paneelid samad) | **lukk** (`Lock 10`, `tab-lock-icon`) lukustatud aastal (:187) | ei | konteiner ei murra, ei keri (ArticlesView kontekstis); aastaid võib tulla rohkem |
| 5 | CropRegisterModal.tsx:361 | hooaasta valik | `year-tabs` | sama | dün. | sama | filter | lukk (:372) | ei | ei keri |
| 6 | FieldManagerModal.tsx:384 | hooaasta valik | `year-tabs` | sama | dün. | sama | filter | lukk (:396) | ei | ei keri |
| 7 | FieldWorksBoard.tsx:694 | hooaasta valik tööde tahvlil | `year-tabs` (täislehel `.fw-toolbar` kontekst: **wrap**, läbipaistev, 30px) | nupud | dün. | sama | filter | lukk (:706) | ei | **wrap** |
| 8 | FieldsTableView.tsx:251 | hooaasta valik | `year-tabs` | segmenteeritud | dün. | sama | filter | lukk (:262) | ei | ei keri |
| 9 | MapYearSelector.tsx:94 | hooaja valik kaardi vidinas | `year-widget-pills` + `year-widget-btn` | **grid** kaardi sees, tahke roheline aktiivne | dün. | **ToggleGroup** (grid-paigutus, mitte rida) | filter (`onSelectYear`) | lukk (:108 `pill-lock-icon`) | ei | grid murrab |
| 10 | ArticlesView.tsx:228 | artikli grupi filter (Kõik + `ARTICLE_GROUPS`) | `category-filter-tabs` + `filter-tab` | pillid | 1 + N | **ToggleGroup** | **filter** (`setGroup`, tabel jääb) | loendur tekstis `(n)`, mitte märk | **jah** (`disabled={count === 0}` :235) | wrap |
| 11 | FieldsTableView.tsx:323 | omandi filter | `category-filter-tabs` + `filter-tab` | pillid | 1 + N (`tenureFilters`) | ToggleGroup | filter | loendur tekstis | **jah** (`disabled` kui 0, :331) | wrap |
| 12 | PoiManagerModal.tsx:221 | POI kategooria filter | `category-filter-tabs` + `filter-tab` | pillid | 1 + N (kategooriad) | ToggleGroup | filter | emoji + `count-pill` (:237) | ei | wrap |
| 13 | FinanceModal.tsx:463 | Ootab / Kõik / Kinnitatud | `finance-filter-chips` + `finance-filter-chip` | väikesed chipid, aktiivne roheline | 3 | ToggleGroup (või `segmented`) | filter (`statusFilter`) | loendur tekstis `Ootab (n)` | ei | ei |
| 14 | VehicleTracker.tsx:1171 | seadme tüüp (Mobiilne GPS / Eye Sensor) | `segmented-control` + `segmented-option` | segmenteeritud, aktiivne navy | 2 | `segmented` / ToggleGroup | **vormiväli** (radio), paneel ei vaheta (vorm muutub) | lucide ikoon valiku ees | ei | ei |
| 15 | CultivationControl.tsx:185 | ajavahemiku režiim | `cc-segmented` (role=group) | segmenteeritud, aktiivne emerald | 2 | ToggleGroup | filter/valik | ei | ei | ei |
| 16 | CultivationControl.tsx:366 | taasesituse kiirus (1×, 2×, 5×, 10×) | `cc-segmented cc-speed` | sama | 4 (`SPEEDS`) | ToggleGroup | valik | ei | ei | ei |
| 17 | SatellitePanel.tsx:285 | satelliidi toode (RGB/NDVI/NRG/NDPI/DNP) | `satellite-product-row` + `basemap-btn` (`role=radiogroup`/`radio`/`aria-checked`) | nupud | 5 | ToggleGroup (kõige täpsem aria juba olemas) | valik | ei | ei | ei |
| 18 | DeviceAssignmentRegister.tsx:222 | Kõik / Aktiivsed / Ajalugu | **`ui/Button`** primary/secondary vaheldumisi | nupud | 3 | ToggleGroup | filter (`statusFilter`) | loendur tekstis | ei | ei |
| 19 | FieldManagerModal.tsx:351,361 | omandi filter (Oma/Rent) | `reg-stat-pill tenure-owned/-rented is-filter` (nupp, aktiivne rõngas) | KPI-kast, mis on ka nupp | 2 | jäta KPI-na (jaotis 4) | ümberlüliti (teine klõps tühistab) | arv sees | ei | ei |
| 20 | FieldManagerModal.tsx:329 | kultuuri filter | `register-crop-stat` (+`.active/.dimmed`) | värvikast-nupp | dün. (kultuurid) | jäta (jaotis 4) | filter, ümberlüliti | `--crop-color` | ei | wrap |
| 21 | FieldWorkEntryDialog.tsx:619 | pindala % presetid | `area-preset-btn` (`.active`) | nupp | dün. | ToggleGroup | valik | ei | **jah** (`disabled={isExceeded}`) | wrap |

Kokkuvõte: **päris sakke 3 saiti** (#1–3), **hooaasta valik 6 saiti** (#4–9), **filter/valik-ümberlülitid 12 saiti** (#10–21). Päris sakke, mis vahetavad paneeli ja kus `Tabs` + `TabsContent` ära tasub kasutada: VehicleTracker, ArticlesView, FinanceModal.

## 4. Mitte märk ega sakk

| Mis | Kus | Miks ei migreeri |
|---|---|---|
| `.crop-bar-segment` | MapYearSelector.tsx:137 (css 4613) | edenemisriba segment, laius ja värv andmest |
| `.crop-legend-item`, `.crop-field-count`, `.crop-name-label` | MapYearSelector.tsx:154–166 | kaardi legend / tekstiread, klõpsatav kultuurifilter |
| `.soil-legend-swatch`, `.radar-legend-swatch`, `.layer-color-indicator`, `.crop-indicator-dot`, `.filter-select-dot`, `.operator-selector-dot` | LayerControl, MapView, FieldMapCard, FilterSelect, OperatorSelector | värvilaigud/legend, mitte tekstmärk |
| `.fw-status-dot`, `.fw-status-done`, `.cc-status-dot`, `.live-status-dot`, `.dev-fresh-dot`, `.dot-idle`, `.trip-stop-dot` | FieldWorksBoard.tsx:99,1149–1151; CultivationControl.tsx:145; MapMarkers.ts:56 jne | ainult olekupunkt/ikoon ilma tekstita (Badge dot-slot ei kata); legendi ridades ühtse `StatusDot`-i teema |
| `.attached-status.attached/.warehouse` | VehicleTracker.tsx:1662,1667 | ikoon + värviline tekst, taust puudub |
| `.add-work-tag`, `.add-work-count` | AddFieldWorkDialog.tsx:112,156 | värviline tekst valikurea sees, valikurida (`aria-pressed`, `.picked`) on kaart/ruut |
| `.reg-stat-pill` (ilma `is-filter`) | RelatedPartiesModal.tsx:438,446,452 | KPI-kast: silt + arv (`.lbl` + `<strong>`), pole märk |
| `.reg-stat-pill.is-filter`, `.register-crop-stat` | FieldManagerModal.tsx:329,351,361 | filtreeriv KPI-nupp, värviriba/rõngas andmest |
| `.telemetry-suggestion-pill` | FieldWorkEntryDialog.tsx:458 | kaart-nupp, mis sisaldab märke; `.telemetry-pill-unlink` (:496) on nupp, minna `ui/Button`'ile |
| `.status-working/-moving/-stopped/-offline` | MapMarkers.ts:33–42 | kaardi markeri klassid (Leaflet divIcon HTML-string), mitte Badge |
| `.popup-title-row .status-tag` | MapView.tsx:532 | HTML-string popupis, React puudub |
| `.finance-icon-badge`, `.legend-icon-badge`, `.season-icon-badge` | FinanceModal.tsx:406 jt | ikoonikast (38px), pole tekstimärk |
| `.dropzone-state` | FieldBookUploadModal.tsx:132 jt | üleslaadimisala olek, mitte märk |
| `.trip-gap-count`, `.trip-import-status`, `.fw-panel-status`, `.finance-results-status-bar`, `.weather-credential-status/-state`, `.imp-status-box` | TripRegister.tsx:131,195; FieldWorksBoard.tsx:1176; FinanceModal.tsx:844; WeatherCredentialModal.tsx:104; VehicleTracker.tsx:1660 | konteinerid/tekstiread (nimes "status", kuid pole märk) |
| `.segmented-*` / `basemap-btn` `.active` LayerControl.tsx:114 | LayerControl.tsx:114 | aluskaardi valija pildinuppudena |
| Header peavaate nupud (`active`) | Header.tsx:89–181 (11 vaadet) | põhinavigatsioon, mitte sakk (vaatevahetus App-tasandil); lisaks `FilterClear` (`filter-clear.active`) |
| `.date-picker-day`, `.filter-select-option` | DateInput.tsx:336, FilterSelect.tsx:202 | kalendri/valikulisti rakud |
| `.year-col`, `.year-cell`, `.year-crop-edit-icon` | FieldManagerModal.tsx:505–656 | tabeli päis/lahter (2.3 tabelid) |
| `.soil-table`, `.soil-row` | SoilSamplesSection.tsx:75, WeatherSeasonSection.tsx:79 | pseudo-tabel (etapp 2.3) |

## 5. Lüngad ui/Badge ja ui/Tabs-is

| Lünk | Kus vaja | Hinnang / ettepanek |
|---|---|---|
| **Suurus** | `field-num-badge` (13.1px, kaal 800 — 5+1 saiti), `user-status-pill` ja `fw-status-pill` (11.5–11.7px, py 3), `equipment-tag` (kõrgem) | vaja `size`: `sm` (vaikimisi, praegune `text-2xs`) ja `md` (`text-xs px-2.5 py-1`). 11.5px vs 11px erinevus tasandub vaikimisi `sm` peale; `field-num-badge` võtab `md`. |
| **Punkt/ikoon** | #2, #3, #7–10 (punkt), #13 (Euro), #65–67, #72 (lucide) | ikoon töötab juba lastena (`inline-flex gap-1`). Punkt: lisa `dot?: boolean` (6px ring `bg-current`). Vaja ainult olekupunktile; ikoonid jäävad kompositsiooniks. |
| **Tahke toon** | #5, #6, #12 (done), #13–16 (confirmed), #37, #38, #73 | lisa `solid?: boolean` (toon → `bg-<tone> text-<tone>-foreground`). Ilma selleta kaob "valmis"/"aktiivne" rõhk. |
| **Kontuur** | `field-num-badge` (valge taust + roheline border), `status-badge` (border) | lisa `outline` (või `variant`: `soft`/`solid`/`outline`). Üks `variant`-telg asendab `solid`. |
| **Andmevärv** | #17 (`SEASON_PHASE_META`), #18, #63, #67, #68 | `style` läheb juba läbi (span props). Parim lahendus: meta-failides asendada hex tooniga (`WORK_PHASE_META` → 4 tooni 1:1; `SEASON_PHASE_META` 4 faasi; `PARTY_ROLE_CONFIG` ~4 rolli; `finance LINE_KIND_INFO` 7 liiki **ei mahu 6 tooni peale**: MACHINE ja FUEL kattuvad). Kultuurivärv (`finance-crop-pill`) = väike punkt/riba `style={{ background: crop.color }}` Badge sees, mitte Badge'i enda värv. Ettepanek: **ära lisa `color` propi**, lase andmevärv minna ainult punktina; ülejäänud toonideks. Kui `finance-kind-badge` peab säilitama 7 värvi, jäta neutral + ikoon + värviline ikoon. |
| **Loendur saki sees** | #31–38 (5 saiti `count-pill`, 2 `finance-tab-badge`) | `<TabsTrigger>` + `<Badge tone="neutral">{n}</Badge>` töötab (gap-1.5). Vaja: aktiivses `line`-sakis neutral Badge sobib; tumedas `segmented` aktiivses `bg-card`-is samuti. Lisandus pole vajalik; kirjuta ui-galeriisse näide. |
| **Filtri-chipide rühm** | #10–13, #15–18, #21 | **ei sobi `Tabs`'i**: Radix Tabs eeldab `TabsContent`-i ja `role=tab`. Filter on `role="radio"`/`aria-pressed`. Ettepanek: **uus `ToggleGroup`** (Radix `ToggleGroup type="single"`, mis lubab tühistamist), mis kasutab **samu** `tabsListVariants`/`tabsTriggerVariants` `segmented` klasse. Radixi aktiivne atribuut on `data-[state=on]`, mitte `active`, seega lisa variantidesse `data-[state=on]:...` kõrvale `data-[state=active]:...`. |
| **Aastasakkide arv** | #4–9 | `TabsList` peab lubama `className="max-w-full overflow-x-auto"` (juba lubatud `className` kaudu) ja trigger `shrink-0`; praegu `inline-flex` ilma `shrink-0`. Vaja lisada `shrink-0` `tabsTriggerVariants`-i. |
| **`tabsTriggerVariants` hover/disabled** | #10, #11, #21 (`disabled`) | praegu `hover:text-foreground disabled:pointer-events-none disabled:opacity-50`. Projekti reegel: `enabled:hover:` ning keelatud element peab jääma hõljutatavaks (tooltip). **Parandada**: `enabled:hover:text-foreground`, `disabled:pointer-events-none` **välja**, asemele `disabled:cursor-not-allowed disabled:opacity-50`. Sama `fieldControlClass`-iga on `disabled:cursor-not-allowed` juba olemas. |
| **Ikooni/luku slot saki sees** | #4–9 (lukk 10px iga lukustatud aasta) | kompositsioon (`<Lock size={10}/>` lapsena) toimib; `gap-1.5` on olemas. |
| **ARIA/klaviatuur** | kõik #1–#21 peale #3 ja #17 | Radix `Tabs` annab nooleklahvid ja `tabpanel`; ToggleGroup annab `role=radio`-sarnase (`aria-pressed` + roving tabindex). See on põhiväärtus migratsioonist. |

**Minimaalne API lisandus (ettepanek):**

1. `badgeVariants`: lisa telg `size: { sm (vaikimisi) , md }`, `variant: { soft (vaikimisi), solid, outline }`. Prop `dot?: boolean` (renderdab 6px `bg-current` punkti enne laste). `Badge.tsx` muutub ~6 rida pikemaks.
2. `tabsTriggerVariants`: `enabled:hover:`, `disabled:cursor-not-allowed`, `shrink-0`, `data-[state=on]:` kaksik `segmented`-ile.
3. Uus `ui/ToggleGroup.tsx` (Radix `ToggleGroup`), ~25 rida, kasutab `tabsListVariants({variant:'segmented'})` ja `tabsTriggerVariants({variant:'segmented'})`; eksport `ui/index.ts`-i. `Tabs` jääb ainult tõelisteks paneelisakkideks (#1, #2, #3) ja jäljelejäänutes, kus sakk ja paneel kokku sobivad (aastavalik ei vaheta paneeli → ToggleGroup).
4. Andmevärv: **ei lisata**. `WORK_PHASE_META`, `SEASON_PHASE_META`, `PARTY_ROLE_CONFIG`: asendada `color/bg` väljad `tone` väljaga; `LINE_KIND_INFO` jaoks otsida kuni 6 tooni (vajab otsust, vt eespool).
5. ui-audit: lisada tsx-poolele `LEGACY_BADGE_TAB` (vt 1.3).

## 6. Surnud CSS (tsx ei kasuta)

Kontrollitud `grep`iga `src/**/*.ts(x)` peale index.css-i, sh MapMarkers.ts ja HTML-stringid; dünaamiliste ehituste mustreid (`badge-${…}`, `…-${…}`) kontrollitud: ainult `status-badge status-${v.status}` ja `.toLowerCase()` modifikaatorid (need on elus).

| Klass | Rida index.css-is |
|---|---|
| `.field-id-badge` | 4314 |
| `.field-season-badge` | 1340 |
| `.fullpage-tabs`, `.fullpage-tab` | 6388, 6393–6421 |
| `.fw-carried-from-pill`, `.fw-carried-to-pill` | 7609–7651, 7580–7605 |
| `.fw-crop-badge-tag` | 6946, 6957 |
| `.fw-group-badge` (+`.winter/.spring/.undetermined`), `.fw-group-stat`, `.fw-group-stat-sep` | 7084–7118, 7132–7143 |
| `.history-pill`, `.history-pills-list`, `a.history-pill` | 4473–4517, 5456–5461 |
| `.layer-year-pills`, `.layer-year-pill` | 1097–1120 |
| `.legend-icon-badge` | 4572 |
| `.live-count-badge` | 5035 |
| `.locked-inline-badge` | 4739 |
| `.meta-tag` | 3313–3331 |
| `.rent-tag` | 5429 |
| `.season-crop-badge` | 4437 |
| `.season-icon-badge` | 4809 |
| `.season-locked-pill` | 4712 |
| `.season-stat-pill` | 4704, 4708, 4814 |
| `.stat-pill` | 332, 345, 349 |
| `.stat-status-tag` (+`.active`, `.locked`) | 4720–4733 |
| `.v-filter-pill` (+`.dot-live`) | 5129–5177 |
| `.variety-badge-sm/-yield/-quality/-maturity` | 5681–5715 |
| `.year-active-tag` | 1217 (`.year-widget-btn` sees, JSX-is pole) |

Vastupidi, **klassid tsx-is ilma CSS-ita (tühjad, nimed jäävad kommentaariks või kustuvad)**: `soil-tag`, `owner-tag`, `device-tag`, `implement-tag`, `spring-tag` (sub-tag lisamärkused; migratsioonil lihtsalt ära jätta).

Märkus: ui-audit loeb sellest nimistust ainult `.badge-list` ja `.pill-lock-icon`/`.tab-lock-icon` (kasutuses). Surnud klassid (nt `.fullpage-tab`, `.history-pill`) ei lähe audit'i arvesse oma nime tõttu (`.fullpage-…`, `.history-…`); kustutamine tuleb teha käsitsi.
