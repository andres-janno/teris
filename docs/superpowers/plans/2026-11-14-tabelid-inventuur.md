# Tabelite inventuur (2026-11-14) — etapi 2.3 lähteandmed

Kaardistatud failidest (src/, v.a admin ja landing), serveris `grep`/`sed`iga. Numbrid (#) viitavad peatabelile.
Read-numbrid on serveri praeguse seisu järgi (HEAD `ee1937c`).

**Parandus ülesandele:** `<table>` esinemisi on **27** (mitte 24), 23 failis: FinanceModal 2, FieldWorkPlanForm 2,
HarvestLotDialog 3, ülejäänud 20 faili 1 kaupa. `ui/Table.tsx` kasutajaid rakenduses ei ole (ainult `ui/index.ts` ja
`UiGallery.tsx`).

`ui/Table.tsx` praegu: `Table` (ümbris `w-full overflow-x-auto` + `containerClassName`, `<table>` `border-collapse text-xs`),
`TableHeader` (päiserea hover välja), `TableBody`, `TableFooter` (`bg-muted font-semibold`), `TableRow` (`border-b`, hover
`bg-muted`, `selected` → `bg-primary/10`), `TableHead` (`px-2.5 py-2 text-2xs` uppercase, nowrap, `numeric` → paremale),
`TableCell` (`px-2.5 py-1.5 align-middle`, `numeric` → paremale + tabular-nums). Puudub: kleepuv päis/veerg/jalus, ääris,
kursor klõpsatavale reale, sorteerimine, tühja rea abi, tihedus, `nowrap` vaikimisi.

## 1. Faktid

### 1.1 Tabeliklassid src/index.css-is

Kasutus = esinemisi tsx-failides (src/components, App.tsx), regex `(?<![\w-])klass(?![\w-])`. "Tabelit" = mitu `<table>`-it kasutab klassi.

| Klass | Rida | Mida seab | tsx | Liik |
|---|---|---|---|---|
| `.register-table-wrap` | 3797 | max-height 62vh, overflow auto, ääris 1px, nurk md. Ülekirjutused: 5764/5788 (crop-group-columns font .85rem), 6906–6916 (täislehel `flex:1`, min-height 220, max-height none), 10563 (harvest-lot-section 40vh) | 16 (14 faili) | ÜLDINE |
| `.register-table` | 3804 | font .8rem, `border-collapse: separate`, spacing 0 | 20 tabelit | ÜLDINE |
| `.register-table th` | 3813 | **kleepuv päis** (`sticky; top:0; z-index:2`), läbipaistmatu gradient-taust, .68rem 700 uppercase, letter-spacing .02em, padding 8/10, border-bottom, nowrap | – | ÜLDINE |
| `.register-table td` | 3829 | padding 6/10, border-bottom, **vertical-align: top**, **nowrap**, taust `--bg-modal` (läbipaistmatu sticky-veergude jaoks) | – | ÜLDINE |
| `.register-table tbody tr:hover td` | 3838 | hover: td taust `--bg-card-hover` (mitte tr) | – | ÜLDINE |
| `.register-table .num-col` | 3842 | text-align right + tabular-nums | 43 (3 faili: WeatherView, FieldsTableView, CropRegisterModal) | ÜLDINE (kolme vaate oma) |
| `.register-table .num` | 10678 | sama mis `.num-col` (duplikaat) | vt `num` all | ÜLDINE |
| `.register-table .name-cell` | 3847 | nowrap → normal (+ 3877–3890 `.field-title-line`, `.field-info-btn`, `.field-sub-tags`) | 9 (6 faili) | ÜLDINE |
| `.register-table .mono/.muted/.cell-sub` | 3894–3908 | tabular/hall tekst/alamrida | muted 124 (kogu tsx), cell-sub 9 | ÜLDINE |
| `.sticky-name` / `.sticky-size` | 3852–3876 | sticky left 0 / left 300px, laius 300/110px, z 1 (th 3), varjuäär | 5 / 2 (FieldManagerModal, FieldsTableView) | PER-VIEW (väljade tabelid) |
| `.fields-table` + `-crop` | 3910–3977 | sticky-name 240px, `.wrap-cell` (normal, 140–220px), **kleepuv tfoot** (`sticky; bottom:0; z 2`, border-top), `-crop` värvikast | 1 / 1 | PER-VIEW (#20) |
| `year-col` / `year-cell` / `year-shape-btn` jne | 3981–4126 | maatriksi aastaveerud: päise hover/valitud, lahtri has-crop/selected/editable/editing, ikoonid | 2 / 4 | PER-VIEW (#19) |
| `.register-table .actions-col` | 4149–4170 | **sticky right 0**, center, width 1%, padding 6 (th z 3) | 21 (9 faili) | ÜLDINE |
| `.register-table .row-actions` | 4172 | flex, gap 2, center | 10 (8 faili) | ÜLDINE |
| `.register-table tr.register-group-row td` | 10575 | vahepealkiri: taust `--stat-bg`, padding-top 14, .8rem | 1 (WarehousesPanel) | PER-VIEW |
| `tr.clickable-row` (`.register-table`, `.articles-table`, `.finance-results-table`) | 10679–10680, 10494, 9916–9921 | cursor pointer + hover (3 erinevat varianti; finance: roheline tint `rgba(16,185,129,.06)`) | 3 (FinanceModal, ArticlesView, TripRegister) | ÜLDINE nimi, 3 eri stiili |
| `tr.trip-row-last-opened`, `tr.trip-gap-row(.reviewed)` | 10686–10706 | viimati avatud rea roheline tint + vasak riba; vahe-hoiatuse rea amber tint, hall kui kontrollitud | 1 / 1 (TripRegister) | PER-VIEW |
| `.weather-years` | 10818–10824 | tbody tr cursor pointer; `weather-normal-row` (bold, border-top 2px, cursor default); lahtri tint wet/dry/warm/cool (dünaamiline `weather-${…}`) | 3 (WeatherView) | PER-VIEW |
| `th.num, td.num` | **10498** | **globaalne** (ilma tabeliklassita): right + tabular-nums | `num` th/td-l ca 98 rida (regex-hinnang) | ÜLDINE |
| `.seasons-table-wrap` / `.seasons-table` | 5003 / 5010 | wrap: overflow-x auto, ääris, nurk 10px, taust card; tabel: collapse .82rem; th sticky top (z 1) + gradient-taust, .68rem, padding 8/8; td padding 8/8, vertical middle, nowrap; viimase rea border puudub (5040); hover (5044); `.has-notes` cursor (5048); **`.current` roheline #16a34a valge tekst = valitud rida** (5053–5082); `.num` right (5083), `.mono` tabular (5087); notes-open/season-notes-row (5125–5135) | 1 / 1 | PER-VIEW (#22) |
| `.crop-register-table` | 5855–5890 | kultuuri värviriba (`inset 4px` `--crop-color`), sortide read .76rem, taandega, kultuuri ja sortide vahel joont pole | 1 | PER-VIEW (#25) |
| `.ai-key-table` | 6358–6364 | collapse 13px, th/td vasak, padding 6/8, border-bottom; ≤640px peidab 3. veeru | 1 | PER-VIEW (#27) |
| `.users-admin-table(-wrap)` | 6407–6465 | wrap overflow-x; collapse .82rem; th .68rem uppercase, padding 8/10, **ei kleepu, taustata**; td vertical middle nowrap; `.users-admin-wrap` (normal), `tr.inactive td` hall, actions/date lahtrid (width 1%) | 1 / 1 | PER-VIEW (#3) |
| `.work-register-table` | 6583–6598 | td vertical middle; `.num` right; `tr.inactive td` hall | 1 | PER-VIEW (#12; lisandub `.register-table`-le) |
| `.fw-plan-table(-wrap)` | 8162–8212 | wrap overflow-x; collapse .78rem; **tihe**: th .7rem 600, ei uppercase, padding 3/6; td 4/6; viimase rea border puudub; `.num` right nowrap tabular | 2 / 2 | PER-VIEW (#4, #5) |
| `.finance-lines-table(-wrap)` | 9520–9560 | wrap ääris, nurk 8, overflow hidden; collapse .82rem; th taust `--stat-bg` .72rem uppercase padding 8/12; td 8/12 õrnem border; viimase rea border puudub; `.num` right; `tr.harvest-row` roheline tint | 1 / 1 | PER-VIEW (#1) |
| `.finance-results-table(-wrap)` | 9862–9925 | wrap ääris, nurk 8, overflow auto; collapse .8rem; th taust `--stat-bg`, nowrap, **ei kleepu**; `th.sortable` (cursor, user-select none, hover taust) ; `.th-content(.num)` flex; td nowrap + tabular-nums; clickable-row | 1 / 1 | PER-VIEW (#2) |
| `.articles-table` | 10228, 10494 | `th.num/td.num` right + tabular (duplikaat globaalsega); clickable-row cursor | 1 | PER-VIEW (#21) |
| `.stock-card-table` | 10495–10496 | td/th nowrap, 2. veerg normal; `td.stock-qty(-in/-out)` 10504–10506 (bold, roheline/punane) | 1 | PER-VIEW (#14) |
| `.stock-doc-lines` | 10511–10521 | `input.num` right 110px; td vertical middle; 1. veerg width 100% + select 100%; num-lahtrid nowrap; `.input-with-unit`, `.stock-doc-unit` (2.5em) | 2 (#11, #13) | PERE (2 tabelit) |
| `.article-categories-group .register-table td:first-child` | 10523 | width 60% | 1 (#8) | PER-VIEW |
| `.trip-dialog-fields` | 10785–10787 | width 100%, 13px, td vertical top; `.trip-dialog-entry-cell` **`display:flex` td-l** | 4 (#6) | PER-VIEW |
| `.soil-table` / `.soil-row*` | 1402–1470 | **mitte `<table>`**, flex+grid pseudo-tabel (vt 3) | 2 | vt 3 |

Zebra-triipe pole kusagil. `colgroup`/`<col>` pole kusagil. `text-align` inline ainult #10 ja #23 "Tegevused" th/td-l.

### 1.2 Üldised vs vaatepõhised

- **Üldised (palju tabeleid muutuvad korraga):** `.register-table` + `-wrap` (20 tabelit, sh kõik päis/td/hover/sticky reeglid),
  `.num-col`/`.num` (register-table), **globaalne `th.num, td.num` (10498)**, `.actions-col`, `.row-actions`, `.name-cell`,
  `.clickable-row` (3 eri stiili).
- **Vaatepõhised:** `fields-table`, `year-*`, `sticky-*`, `seasons-table`, `crop-register-table`, `users-admin-table`,
  `work-register-table`, `fw-plan-table`, `finance-lines-table`, `finance-results-table`, `articles-table`,
  `stock-card-table`, `stock-doc-lines`, `trip-dialog-fields`, `weather-years`, `ai-key-table`, `trip-*-row`.

### 1.3 Kas ui-audit loeb vanu tabeliklasse?

**Ei.** `src/tooling/uiAudit.ts:34` `LEGACY_COMPONENT = /\.((?:btn|modal|badge|pill|tab|data-table|table)[\w-]*)/g`
loeb CSS-ist ainult klassinimesid, mis **algavad** nende eesliidetega (`.table…`, `.data-table…`, `.tab…`). Ükski
tegelik tabeliklass (`register-table`, `seasons-table`, `users-admin-table` jne) ei alga nii, seega need annavad
0 (`index.css`-is pole ühtegi `.table…` selektorit; test `uiAudit.test.ts:108` kontrollib ainult `.data-table td`).
tsx-poolel on eraldi loendurid ainult nuppudele (`LEGACY_BUTTON`) ja modaalidele (`LEGACY_MODAL`); tabeleid ei loeta.
Ainus kaudne tabelinäit on üldine `style={{…}}` kohtade arv (`scripts/ui-audit.mts` rida "style={{…}} kohti").
Soovitus etapile 2.3: lisada `LEGACY_TABLE` (tsx: `<table`, `<thead`, `register-table`-laadsed klassid) ja CSS-poolel
laiendada regexit tabeliklassidele; muidu ei näe mõõdik edenemist.

## 2. Peatabel

Lühendid veergudes: **Kl** = kleepuv päis (`th{position:sticky;top:0}` kehtib kõigil `.register-table`-itel ja `.seasons-table`-il;
kerimiskonteiner kirjas); **Sort** = klõpsatavad päised; **Klõps** = klõpsatav/valitud rida; **Num** = numbriveerud ja joondus;
**Kokku** = tfoot/kokkuvõterida; **Sis** = sisendid lahtrites; **Grupp** = grupi-/sektsioonirida (colSpan); **Tegev** =
tegevusnuppude veerg; **Lai.** = laiused; **Tühi** = tühja rea `<tr><td colSpan>`; **style** = `style=` arv tabeli sees.
Asukoht: **D** = ui/Dialog sees, **L** = täisleht/paneel (`fullpage-board-*` või vahekaart).

| # | fail:rida | Otstarve | Klass(id) | Kl | Sort | Klõps | Num | Kokku | Sis | Grupp | Tegev | Laiend. | style | Lai. | Tühi | Lai/kerimine | Asukoht |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FinanceModal.tsx:647 | Põllutöö kulude read (hinnastamine) | `finance-lines-table-wrap` > `finance-lines-table` | ei (wrap overflow hidden) | ei | ei (rea `harvest-row` tint) | `num` (Kogus, Summa); Ühikuhind vasakul | ei | 1× `input type=text inputMode=decimal` (`form-input`) | ei | ei | ei | 1 (märgi värv, dünaamiline) | ei | ei (ternaar enne tabelit) | ei | D (FinanceModal) |
| 2 | FinanceModal.tsx:915 | Põldude kasumlikkus (tulemused) | `finance-results-table-wrap` > `finance-results-table` | ei | **jah** 6 päist (`th.sortable`, ArrowUpDown ikoon) | **jah**, rea klõps avab kanded (`clickable-row`) | `num` (10 veergu) | ei | ei | ei | ei | ei | 1 (vasak riba `borderLeftColor` kultuuri värv) | ei | jah (colSpan 13) | **13 veergu**, wrap overflow auto | D |
| 3 | UsersAdminModal.tsx:165 | Kasutajad | `users-admin-table-wrap` > `users-admin-table` | ei | ei | ei (`tr.inactive` hall) | ei | ei | ei | ei | jah (`users-admin-actions-cell`, ghost-nupud) | ei | 0 | actions width 1% | ei | 7 veergu; nimi/e-post murduvad | D |
| 4 | FieldWorkPlanForm.tsx:97 | Planeeritud materjalid (vaade) | `fw-plan-table-wrap` > `fw-plan-table` | ei | ei | ei | `num` (`c.num` järgi, dünaamilised veerud) | ei | ei | ei | ei | ei | 0 | ei | ei | ei | D (FieldWorksBoard "valitud töö paneel") |
| 5 | FieldWorkPlanForm.tsx:112 | Planeeritud saak (1 rida) | `fw-plan-table-wrap` > `fw-plan-table` | ei | ei | ei | `num` (Saak t/ha) | ei | ei | ei | ei | ei | 0 | ei | ei | ei | D (sama) |
| 6 | TripDialog.tsx:205 | Sõidu põllud | `register-table trip-dialog-fields` (ilma wrapita) | jah (dialoogi kerimisalas) | ei | ei (rea sees nupud "Kanne" `trip-dialog-entry`) | `num` (ha, Kütus l) + alamrida `text-muted` | ei | ei | ei | ei (nupud andmelahtris) | ei | 0 | ei | ei | ei | D |
| 7 | WeatherView.tsx:93 | Ilm: aastad (võrdlus) | `register-table weather-years` (`register-table-wrap weather-years-wrap`) | jah (wrap) | ei | **jah** (tr klõps lülitab võrdluse; checkbox lahtris `stopPropagation`) | `num-col` (6 veergu) | "Keskmine"-rida tbody lõpus (`weather-normal-row`, bold, border-top 2px) | 1× `checkbox` | ei | ei | ei | 0 | ei | ei | 8 veergu | L |
| 8 | ArticleCategoriesDialog.tsx:65 | Artikli kategooriad (grupi kaupa, 1 tabel grupi kohta) | `register-table` (ilma wrapita, **ilma `<thead>`**) | (puudub päis) | ei | ei (`inactive` klass, stiili pole) | `num` (artikleid) | ei | **2**: `input` (`form-input`, nimi onBlur-salvestus), `checkbox` | ei | jah (`actions-col`: lukk või kustuta) | ei | 0 | `td:first-child` 60% (CSS 10523) | ei | ei | D |
| 9 | StockDocumentsPanel.tsx:93 | Laokanded (dokumendid) | `register-table-wrap` > `register-table` | jah (wrap; täislehel flex-täide) | ei | ei | `num` (Ridu, Summa) | ei | ei | ei | jah (`actions-col` + `row-actions`: muuda/kustuta) | ei | 0 | ei | jah (colSpan 8) | ei | L (ArticlesView vahekaart) |
| 10 | VehicleTracker.tsx:2017 | Haakimised (haakeriist ↔ masin) | `register-table-wrap glass-card` (+inline `overflowX:auto`) > `register-table` | jah | ei | ei (aktiivse rea inline `background`) | puudub; päis/lahter `textAlign:'right'` (Tegevused) | ei | ei | ei | jah (3 nuppu, `textAlign:right`) | ei | **20** (ikoonikastid, fondid, värvid, aktiivse rea taust) | 2 inline `width:26px` nuppudel | ei (tühi olek on tabeli asemel plokk, rida 2003) | ei | L (tehnika leht) |
| 11 | InventoryDialog.tsx:145 | Inventuur: read (arvestuslik/tegelik/vahe) | `register-table stock-doc-lines` (ilma wrapita) | jah (dialoogi kerimine) | ei | ei | `num` (4 veergu); sisend `form-input num` | ei | **1** `input inputMode=decimal` (`form-input num`) + ühik | ei | ei | ei | 0 | `stock-doc-lines td:first-child` 100% | jah (colSpan 5, "Laen…"/tühi) | ei | D |
| 12 | WorkRegisterModal.tsx:96 | Tööde register (PRIA tegevused) | `register-table-wrap` > `register-table work-register-table` | jah (62vh) | ei | ei (`tr.inactive` hall) | `num` (Põldudel) | ei | ei | ei | jah (`actions-col`+`row-actions`) | ei | 0 | ei | ei | ei | D |
| 13 | StockDocumentDialog.tsx:159 | Lao dokumendi read | `register-table stock-doc-lines` (ilma wrapita) | jah (dialoogi kerimine) | ei | ei | `num` (3–5 veergu, tingimuslikud `kind` järgi) | ei | **3**: `select` (materjal), 2× `input inputMode=decimal` (`form-input num`) | ei | jah (`actions-col`, eemalda rida, `tabIndex=-1`) | ei | 0 | `td:first-child` 100%, select min-width 160 | ei | ei | D |
| 14 | ArticleStockCard.tsx:71 | Laokaart (liikumised) | `register-table-wrap` > `register-table stock-card-table` | jah (62vh) | ei | ei | `num` (+ `stock-qty-in/out` värv, `article-overuse`) | ei | ei | ei | ei | ei | 0 | ei | jah (colSpan 5, kuid veerge 4–6) | ei | D |
| 15 | HarvestLotDialog.tsx:192 | Saagipartii: kanded | `register-table-wrap` > `register-table` | jah (**40vh**, CSS 10563) | ei | ei | `num` (Punkreid, Tonnid) | ei | ei | ei | ei | ei | 0 | ei | jah (colSpan 5) | ei | D |
| 16 | HarvestLotDialog.tsx:218 | Saagipartii: kaalumised | sama | jah (40vh) | ei | ei | `num` (Tonnid) | ei | ei | ei | jah (`actions-col`, kustuta; ainult `!closed`) | ei | 0 | ei | jah (colSpan 4) | ei | D |
| 17 | HarvestLotDialog.tsx:264 | Saagipartii: kuivatuskulud | sama | jah (40vh) | ei | ei | `num` (4 veergu) | ei | ei | ei | jah (`actions-col`) | ei | 0 | ei | jah (colSpan **6**, veerge 6) | ei | D |
| 18 | WarehousesPanel.tsx:87 | Ladude register | `register-table-wrap` > `register-table` | jah | ei | ei | puudub | ei | ei | **jah**: vahepealkiri "Põllu laod" `register-group-row` colSpan 4 | jah (`actions-col`+`row-actions`) | ei | 0 | ei | ei | ei | L (vahekaart) |
| 19 | FieldManagerModal.tsx:499 | Põllud × aastad maatriks (kultuur aastas) | `register-table-wrap` > `register-table` | jah | ei, kuid **päise klõps valib hooaja** (`year-col`) | lahtri klõps avab kultuuri muutmise (`year-cell editable`), valitud aasta veerg esile | puudub | ei | **3 `select`** inline-muutmise lahtris (kultuur/sort/allakülv) + ikoonnupud | ei | ei (nupud lahtri sees) | ei | 1 (dünaamiline) | `sticky-name` 300px, `sticky-size` 110px | ei | **dünaamilised veerud** (2 + N aastat), horisontaalne kerimine, 2 kleepuvat vasakut veergu | L |
| 20 | FieldsTableView.tsx:339 | Põllud (hooaja põhjal) | `register-table-wrap` > `register-table fields-table` | jah | ei | ei | `num-col` (6 veergu) | **jah `<tfoot>`, kleepuv alla** (`sticky bottom:0`), "Kokku: N põldu" | ei | ei | jah (`actions-col`, kleepuv paremal) | ei | 1 (`--crop-color`, dünaamiline) | `sticky-name` 240px, `wrap-cell` 140–220px | ei | **15 veergu**, horisontaalne kerimine, kleepuv vasak + parem + jalus | L |
| 21 | ArticlesView.tsx:248 | Artiklite register | `register-table-wrap` > `register-table articles-table` | jah | ei | **jah** (`clickable-row`; nupud `stopPropagation`) | `num` (kuni 8 veergu; tingimuslikud `canManageFinance`) | ei | ei | ei | jah (`actions-col`, 3 nuppu) | ei | 0 | ei | jah (colSpan 14/11, kaks teksti) | 14 veergu | L |
| 22 | SeasonManagerModal.tsx:208 | Hooaegade register | `seasons-table-wrap` > `seasons-table` | jah (wrap overflow-x → sisemine kerimine) | ei | **jah** (tr klõps avab märkused `has-notes`; **valitud hooaeg `current` = roheline rida**) | `num mono` (Pindala, Põlde) | ei | ei | **laiendatav rida** `season-notes-row` colSpan 5 | jah (`season-row-actions`, `stopPropagation`) | **jah** (märkuste rida) | 1 (badge värv, dünaamiline) | ei | ei | ei | L |
| 23 | DeviceAssignmentRegister.tsx:281 | Seadmete seosed | `register-table-wrap glass-card` (+inline `overflowX`) > `register-table` | jah | ei | ei (aktiivse rea inline `background`) | puudub; `textAlign:'right'` (Tegevused) | ei | ei | ei | jah (3 nuppu) | ei | **21** | 2 inline `width:26px` | ei (tühi olek tabeli asemel, rida 267) | ei | L |
| 24 | TripRegister.tsx:220 | Sõitude register | `register-table-wrap glass-card` (+inline `overflowX`) > `register-table` | jah | ei | **jah** (`clickable-row`, `trip-row-last-opened`, kustutatud: inline `opacity:.55`) | `num` (7 veergu) | ei | ei | **jah**: `trip-gap-row` colSpan 13 (hoiatus + 2 nuppu) | ei | ei | 1 (opacity) | ei | ei | **13 veergu**, horisontaalne kerimine | L (tehnika leht) |
| 25 | CropRegisterModal.tsx:784 | Kultuuride ja sortide register (üks tabel grupi kohta) | `register-table-wrap` > `register-table crop-register-table` | jah | ei | ei (nupud) | `num-col` (Pind, Külvinorm, Saagiootus) | ei | ei | ei, kuid **hierarhia**: `crop-row` + `variety-row` (taane, värviriba) | jah (`actions-col`, kuni 3 nuppu) | ei | 2 (`style={cropStyle}` = `--crop-color`) | ei | ei | ei | L (`fullpage-board`) ja D (`size="full"` kui sisse lülitatud) |
| 26 | HarvestLotsPanel.tsx:69 | Saagipartiide register | `register-table-wrap` > `register-table` | jah | ei | **jah** (tr `style={{cursor:'pointer'}}` + onClick) | `num` (5 veergu) | ei | ei | ei | ei | ei | 1 (cursor) | ei | jah (colSpan 8) | ei | L (vahekaart) |
| 27 | AiConnectionModal.tsx:131 | AI võtmed | `ai-key-table` (ilma wrapita) | ei | ei | ei | puudub | ei | ei | ei | jah (1 ikoonnupp, tühi th) | ei | 0 | ei | jah (colSpan 5) | mobiilis peidab 3. veeru | D |

### Kokkuvõte peatabelist

- Dialoogis (D): #1–#6, #8, #11–#17, #27 (+ #25 tingimuslikult). Täislehel/paneelis (L): #7, #9, #10, #18–#26.
- Kleepuv päis (CSS-ist): kõik `register-table` (20) + `seasons-table` (1) = 21. Neist ilma kerimisümbrisega wrapita on 4 (#6, #8, #11, #13) — päis kleepub dialoogi sisu kerimisalas.
- Ei kleepu: #1, #2, #3, #4, #5, #27.
- Sorteerimine: ainult #2. Klõpsatavad read: #2, #7, #21, #22, #24, #26 (+ #19 lahtri tasemel).
- Kokkuvõtterida: ainult #20 (tfoot, kleepuv alla); #7 "Keskmine" on tbody-rida.
- Sisendid lahtrites: #1, #8, #11, #13, #19 (+ checkbox #7).
- Grupi-/eririda colSpan-iga: #18, #22 (laiendatav), #24 (vahe-hoiatus), #7 (keskmine).
- Tühja rea abi vajajad: #2, #9, #11, #14, #15, #16, #17, #21, #26, #27 (10 tabelit; colSpan käsitsi; #14 colSpan 5 ei vasta alati veergude arvule 4–6 — vt 4.3).
- Inline `style`: #10 (20) ja #23 (21) on ainsad suured; kokku 49 `style=` tabelites, neist ainult ca 6 on tõeliselt dünaamilised.
- Numbrijoondus praegu: klass `num` (98 th/td rida; globaalne `th.num, td.num` + kohalikud dubleerivad reeglid) ja `num-col` (3 faili); inline `textAlign` ainult tegevuste veerus (#10, #23).

## 3. Pseudo-tabelid (div/grid-rearead)

| # | Koht | Mis see on | Soovitus |
|---|---|---|---|
| P1 | SoilSamplesSection.tsx:76 (`.soil-table`, CSS 1402) | Päisrida + aastaread (`<button class=soil-row soil-row-year>`, klõps laiendab punktiread) + `soil-footnote`; grid 9 veergu (`1.6fr .8fr repeat(7,1fr)`), numbrid paremal, värvitud väärtused; FieldEditDialog sees | **Teisenda ui/Table-iks** (päris tabeliandmed, ainult `th/td` + laiendatav rida). Sõltub #22-ga ühisest "laiendatav rida" mustrist; teine laine. |
| P2 | WeatherSeasonSection.tsx:19, 80 (sama `.soil-row`) | Päis + 1 praegune + ajaloo read, 8 veergu, numbrid paremal, kaldkirjas "nihutatud" periood, jalus-märkus; FieldEditDialog sees | **Teisenda koos P1-ga** (jagavad `.soil-row` CSS-i; muutes ühte muutub teine). |
| P3 | PriaLinesEditor.tsx:168, 217, 259 (`.pria-grid` + `.pria-grid-head`, CSS 10217) | Muudetavad read FilterSelect/input lahtritega; päis `aria-hidden`; mobiilis `flex-wrap` ja päis peidetakse; veerulaiused inline `gridTemplateColumns` | **Jäta**: vormi sisestusgrid, mitte andmetabel; mobiilne ümberpaigutus ei sobi `<table>`-ga. Hiljem eraldi "vormirea" komponent. |
| P4 | FieldWorksBoard.tsx:776, 788, 875 (`.fw-grid`, `fw-row-container`, CSS ~7021) | Põllutööde tahvel: 11-veeruline grid, kaheastmeline päis (`gridColumn` ulatused aastaplokkidele), min-width 1400px, kaardid lahtrites, kleepuv põllu veerg | **Jäta** (tahvel/kaardipaigutus, päises ulatuslahtrid, lahtrid pole tavalised väärtused). |
| P5 | RelatedPartiesModal.tsx:518 (`vehicle-card glass-card` per isik) | Kaardiruudustik (nimi, rollid, kontaktid, nupud) | **Jäta** (kaardid). |
| P6 | PoiManagerModal.tsx:412 (`vehicle-card`, `v-info-rows`) | Kaardiruudustik asukohtadest | **Jäta** (kaardid). |
| P7 | MapView.tsx külglistid | MapView.tsx-is ei ole `list/row/item` klassiga ridu (otsitud); lähimad: MapYearSelector.tsx:148 `crop-list` (legend), FieldMapCard.tsx:35,39 `fmc-row` (võti–väärtus), SatellitePanel.tsx:285–342 (juhtelemendid) | **Jäta** (legend, võti–väärtus, kontrollid; pole päisega andmeread). |
| P8 | VehicleTracker kaardid (`vehicle-grid`, `devices-grid`, `imp-card`) | Kaardid | **Jäta**. |
| P9 | `.work-entry-article-row` (CSS 8870), `.register-fields-list` (4381) | Ainult CSS, tsx-is kasutust pole | Surnud CSS (vt 5). |

## 4. Perekonnad ja riskid

### 4.1 Perekonnad (ühe klassi muutmine mõjutab teist)

| Pere | Liikmed | Risk |
|---|---|---|
| `.register-table` | #6–#26 (20 tabelit: kõik peale #1–#5, #22, #27, kus pole) | Üks päise/td/hover reegel mõjutab kõiki 20. Ümberkirjutades tuleb päis, läbipaistmatu taust, nowrap ja `vertical-align: top` teadlikult kas säilitada või muuta. |
| `th.num, td.num` (10498) + `.register-table .num` (10678) + `.articles-table .num` (10228) + kohalikud | kõik `num`-tabelid | Dubleerivad reeglid. Globaalne reegel jääb kehtima ka teisaldatud tabelitele, kuni klass kustutatakse; `td.stock-qty*` (värv) on sellest sõltumatu. |
| väljade tabelid | #19, #20 | Jagavad `sticky-name`, `name-cell`, `field-title-line`, `field-num-badge`, `cell-sub`, `num-col`, `actions-col`. Kleepuv vasak (300px/110px) ja parem veerg, kleepuv tfoot (#20). Läbipaistmatu td-taust on vajalik, et kleepuvad lahtrid ei läbipaistaks. |
| `stock-doc-lines` | #11, #13 | Ühine laiusloogika (esimene veerg 100%), `input.num` 110px, ühiku laius 2.5em. |
| tehnika registrid | #10, #23, #24 | Sama wrap-muster (`register-table-wrap glass-card` + inline `overflowX`); #10/#23 raskelt inline-stiilitud; täislehel `fleet-board-body` flex-täide (CSS 6906). |
| saagipartii | #15–#17, #26 | `.harvest-lot-section .register-table-wrap { max-height: 40vh }` ainult dialoogitabelitel (#15–#17). |
| finantstabelid | #1, #2 | Kopeeritud CSS (taust, uppercase, padding 8/10–12, õrn border); `finance-*` põhine tint. |
| `.soil-row` | P1, P2 | Üks CSS, kaks komponenti. |
| `.seasons-table` | #22 | Üksik, kuid `current` roheline ridavärv on teise välimusega kui ui/Table `selected`. |

### 4.2 Mida ui/Table ei kata (ja minimaalne ettepanek)

| Vajadus | Kus | Ettepanek |
|---|---|---|
| Kleepuv päis (opaakne taust, z-index) | 21 tabelit | `Table stickyHeader` (lisab `th` klassid `sticky top-0 z-10 bg-muted`); kerimiskonteineri kõrgus `containerClassName="max-h-[62vh]"` (suurused lubatud) |
| Ääris ümber tabeli (kerimisümbris, nurk) | wrapid #7, #9, #12, #14–#26 | `Table bordered` (ümbrisele `border border-border rounded-md`) |
| Klõpsatav rida | #2, #7, #21, #22, #24, #26 | `TableRow` `onClick` korral automaatselt `cursor-pointer` või eksplitsiitne `clickable`; valitud rida `selected` (seasons roheline `current` asendub `selected`-iga, see on disainiotsus) |
| Sorteeritav päis | #2 | `TableHead sortable` (cursor, hover, `select-none`) + `aria-sort`; ikoon jääb kutsuja ülesandeks. Ainult üks kasutaja → võib ka esialgu jätta kutsuja klassideks. |
| Tühja rea abi | 10 tabelit | `TableEmpty colSpan` (üks rida, muted, tsentreeritud). Kutsuja annab colSpan'i; kõrvalmärkus: #14 ja #17 colSpan ei vasta veergude arvule. |
| `nowrap` ja vertikaaljoondus | kõik register-tabelid | Praegu `td` nowrap + `vertical-align: top`; ui/Table: wrap + `align-middle`. Otsus: `td` nowrap vaikimisi (laiad tabelid #2, #20, #21, #24), `whitespace-normal` nimelahtritele; üldine `align-middle`, `align-top` käsitsi (#6, mitmerealised lahtrid). |
| Kleepuvad veerud (vasak/parem) | #19, #20 (vasak, jalus), `actions-col` 9 tabelit (parem) | `sticky="start|end"` lahtrile koos dünaamilise `left` offsetiga (inline lubatud). **Soovitus: jäta #19/#20 teise lainesse**, sest vajavad ka kleepuvat jalust (#20) ja läbipaistmatut `bg-inherit`; tavaline `actions-col` paremal kleepuv vaikimisi samuti hilisem. |
| Tihedus | #4, #5 (3/6px, .78rem), #6 (13px), #27 | `Table dense` (`px-1.5 py-1`), ainult kui #4/#5 migreeritakse; vastasel juhul jäta `className`. |
| Kokkuvõtterida | #20 (sticky bottom), #7 (keskmine) | `TableFooter` olemas; kleepuvaks `className="sticky bottom-0"`; #7 keskmine = tavaline `TableRow className="font-bold border-t-2"`. Uut propsi pole vaja. |
| Grupi-/laiendatav/erirea (colSpan) | #18, #22, #24, #7 | Uut komponenti pole vaja: `TableRow` + `TableCell colSpan`, taust `className="bg-muted"`; laiendatava rea kasutus `onClick` + state. |
| Tint-read (aktiivne masin, harvest-row, viimati avatud, vahe-hoiatus, ilmatintid) | #1, #7, #10, #23, #24 | Läbi `className` tokenitega (`bg-success/10` jms); ei vaja propsi. #10/#23 inline `background` asendub klassiga. |
| Sisendid lahtrites | #1, #8, #11, #13, #19 | Ei ole Table'i teema; sõltub `ui/Input`/`Select` migratsioonist. Numbrisisendile `text-right`; `numeric` TableCell on vaikimisi paremal. Rea kõrgus muutub sisendi tõttu. |
| Zebra | – | Mitte vaja (pole kusagil kasutusel). |
| Veerulaiused | `actions-col` 1%, `stock-doc-lines` esimene 100%, `sticky-*` 300/110/240px, kategooriad 60% | Läbi `className="w-px"`/`w-full` lahtril; `colgroup` pole vaja. |

Minimaalne lisanduv API: `Table`: `stickyHeader`, `bordered` (+ juba olemasolev `containerClassName`); `TableRow`: `clickable`;
`TableHead`: `sortable`; uus `TableEmpty`. Ülejäänu `className`-iga. Kleepuvad veerud ja tihedus sõltuvalt faasist.

### 4.3 Muud riskid migreerimisel

- **`td` `display:flex`** (`.trip-dialog-entry-cell`, #6): rikub tabeli lahtri paigutust; migreerimisel mähi sisu `<div>`-iga.
- **Hover mehhanism:** `.register-table` värvib `td` (opaakne `--bg-modal`), ui/Table värvib `tr`; opaakne td-taust katab ui hoveri. Teisaldamisel taust ära (või `bg-inherit` kleepuvatele lahtritele).
- **Päise taust:** ui/TableHead ei kleepu ega oma tausta; `stickyHeader` peab andma läbipaistmatu tausta (praegu gradient `--stat-bg` + `--bg-modal`), muidu paistavad read läbi.
- **`.inactive` read:** #8 ja #21 annavad `inactive` klassi, millel `.register-table`-il stiili pole (ainult `users-admin-table`/`work-register-table`-il on). Migreerimisel otsustada, kas hallistada (`text-muted-foreground`).
- **Duplikaadid:** `.num` globaalne + 3 kohalikku; `.clickable-row` 3 eri stiili — pärast migratsiooni kustutada kõik.
- **Mobiil:** #27 peidab 3. veeru ≤640px (`:nth-child(3)`); ui/Table'is `hidden sm:table-cell` klassidega.
- **Sticky päis wrapita tabelitel** (#6, #11, #13): ui/Table ümbris on `overflow-x-auto`, mis loob uue kerimiskonteineri; `th` kleepub siis ümbrise, mitte dialoogi sisu suhtes (ja ei kleepu kunagi, kui ümbrisel pole max-height). Kontrollida, et dialoogitabelitel `Table` ümbris ei muudaks kleepuvuse käitumist (võib jätta `stickyHeader` ära neil, kui read mahuvad).
- **#14 colSpan:** colSpan 5, veerge 4–6 (valikulised); `TableEmpty` võiks võtta colSpan-i veergude arvust. Teised tühja rea colSpan-id (#11, #15, #16, #17) vastavad.
- **Kolm eri valitud-rea mustrit:** `.seasons-table tr.current` (roheline), `year-col.selected`, `trip-row-last-opened` (roheline tint + riba). `TableRow selected` katab ainult esimese.

## 5. Surnud CSS (ükski tsx ei kasuta)

Kontrollitud `grep -w` kogu src/ tsx/ts peal (v.a admin/landing).

| Klass | Rida(d) index.css-is | Märkus |
|---|---|---|
| `.varieties-table-wrap`, `.varieties-table` (th/td/hover) | 5891–5940 | Sortide alamregistri tabel, enam ei kasutata (sordid on `crop-register-table` sees) |
| `.variety-table-actions` | 6017 | |
| `.register-fields-list` | 4381, 6908, 6916 | Põldude kaardiloend, asendunud |
| `.trip-dialog-metrics` (+ `th`) | 10683, 10782 | |
| `.work-entry-article-row` | 8870 | |
| `.register-table .name-cell .field-info-btn` (+ hover) | 3881–3889 | |
| `.crop-dot`, `.register-table .year-crop .crop-dot` | 3359, 4570, 4120 | tsx-is 0 kasutust (võib olla kolm duplikaati) |
| `.season-delta`, `.season-delta.up/.down`, `.seasons-table tr.current .season-delta` | 5062, 5157–5168 | |
| `tr.inactive` registreeritud mõjuta | (tsx: #8, #21 annavad klassi) | stiilita `.register-table`-il (mitte surnud CSS, vaid surnud klass tsx-is) |

Osaliselt kontrollimata: `.variety-name-cell` (5940, mitte `.crop-register-table .variety-name-cell`), `.variety-badge-*`.
Ülejäänud tabeliklassid on elus (seega kustutatavad alles pärast migratsiooni).
