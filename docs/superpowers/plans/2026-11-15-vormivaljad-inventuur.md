# Vormiväljade inventuur (2026-11-15) — etapi 2.5 lähteandmed

Kaardistatud failidest (src/, v.a `src/admin`, `src/landing` ja `src/components/ui`), serveris `grep`/`sed`/`node`iga. Toored elemendid ja atribuudid loetud TypeScripti AST-iga (mitte regexiga), seega mitmerealised `<input …>` on arvestatud. Read-numbrid on serveri praeguse seisu järgi (HEAD `cfde028`).

**Peamine järeldus:** `ui/Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Field` kasutajaid rakenduses **ei ole** (esinemisi väljaspool `ui/` ja `src/admin`-it: 0). Kogu rakendus kasutab tooreid elemente + `.form-input` / `.form-group`. `src/admin/CatalogView.tsx` kasutab oma kohalikku `Field`-i (ulatusest väljas). `DateInput`, `FilterSelect`, `NumberInput` ja `FilterClear` toetuvad `.form-input`/`.filter-clear*` CSS-ile, mitte `ui/` komponentidele.

`ui/` praegu (kõik üks fail, lugemisel `README.md` + failid):
- `fieldControlClass` (`variants.ts:100`): `w-full rounded-sm border border-input bg-field text-sm text-foreground placeholder:text-subtle transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive`.
- `Input`: `<input>` + `fieldControlClass h-8 px-2.5` (32px, 10px, 13px, radius 6px). `Textarea`: `min-h-16 px-2.5 py-1.5` (64px). Suurust, `invalid` propi, eesliidet/järelliidet ei ole; `aria-invalid` annab punase äärise.
- `Select`: Radix Select, **kontrollitud** `value`/`onValueChange`, `options: {value,label,disabled}[]`, `value=''` = valimata (kuvab `placeholder`), **`value: ''` valik ei ole lubatud**, `optgroup`, `required`, `name`, `autoFocus` puuduvad. Trigger `h-8 px-2.5` + chevron 14px; list portaali (Radix portal, `z-2100`), `max-h-72`.
- `Checkbox`: Radix, `size-4` (16px), kontrollitud `checked`/`onCheckedChange(boolean)`, ilma sildita; `RadioGroup`/`RadioGroupItem` `size-4`; `Switch` `h-5 w-9`.
- `Field`: `label` (`text-xs font-semibold text-muted-foreground`, 12px) + `children` + `hint`/`error` (`text-2xs`), `gap-1` (4px).
- Vana `.form-input` (`index.css:2794`): `padding 7px 10px; font-size 0.8rem (12.8px); radius var(--radius-sm)=6px; border 1px var(--input-border); bg var(--input-bg); outline none`; fookus ainult `border-color: emerald-500` (rida 2805), **ringi ei ole**, **`:disabled` reeglit ei ole** (brauseri vaikimisi). Värvimuutujad (`--input-bg`, `--input-border`, `--input-color`) on määratud heledas (`index.css:48–50`) ja tumedas teemas (`:94–96`); tumeda teema spetsiifilisi `.form-input` reegleid **ei ole**. `styles/app.css:73–74` seob `--color-input` / `--color-field` samade muutujatega, seega `ui` ja vana väli võtavad tooni samast kohast.

## 1. Faktid: toored elemendid

Kokku **173 `<input>`, 51 `<select>`, 13 `<textarea>`, 227 `<label>`** 44 failis (`src/components` + `NumberInput.tsx`/`DateInput.tsx`/`FilterSelect.tsx` sisemised). (`<select` grep annab 52, üks esinemine on `FilterSelect.tsx` kommentaaris.) `type="number"`, `date`, `time`, `hidden`: **0** (reegel kehtib).

### 1.1 `<input>` tüübi järgi

| Tüüp | Arv | Klass(id) | Kus peamiselt |
|---|---|---|---|
| text (vaikimisi) | 115 | 76× `form-input`; 23× `form-input num`; 2× `form-input num readonly`; 6× `form-input search-input`; 2× `form-input auto-field-input`; 1× `form-input text-right`; 1× `form-input finance-price-input`; 1× `cc-start-input`; 2 sisemist (`DateInput.tsx:248`, `NumberInput.tsx:67`); 1× klassita (`SetPasswordPage.tsx:77`, readonly kasutajanimi) | dialoogivormid; `PriaLinesEditor` (12) |
| checkbox | 35 | **klassita** (silt kannab klassi, vt 1.3) | LayerControl 10, UsersAdminModal 2, vormid 17, tööriba 5 |
| password | 9 | `form-input` | LoginPage 1, SetPasswordPage 2, ChangePasswordModal 3, UsersAdminModal 2, WeatherCredentialModal 1 |
| radio | 3 | klassita | LayerControl.tsx:212, UsersAdminModal.tsx:275,279 |
| file | 3 | klassita, `style={{display:'none'}}` | FieldUploadModal.tsx:192, FieldBookUploadModal.tsx:124, SoilSampleUploadModal.tsx:105 |
| color | 2 | `form-input` (+`.fleet-edit-modal .input-split > .form-input[type="color"]` `flex:0 0 56px`, `index.css:3867`) | CropRegisterModal.tsx:492, VehicleTracker.tsx:939 |
| search | 2 | klassita (`.filter-clear > input[type="search"]` peidab brauseri X-i, `index.css:8545`) | FinanceModal.tsx:447,867 |
| email / tel | 2 / 1 | `form-input` | UsersAdminModal, RelatedPartiesModal |
| range | 1 | klassita (`.cc-slider input[type='range']`, `index.css:1849`) | CultivationControl.tsx:339 |
| hidden | 0 | | |

### 1.2 `<select>` ja `<textarea>`

- `<select>` 51: 39× `form-input`; 4× `form-input time-select` (`index.css:7254` lisab ainult `font-weight:600`); 2× `cc-select` (`:1590`) + 2× klassita `.cc-time select` (CultivationControl.tsx:208,218); 1× `satellite-date-select`; 1× `satellite-period-select`; 1× `imp-assign-select`; 1× `dev-assign-select`. 98 `<option>` kokku, **35 neist `value=""`** (tühi valik), **6 `disabled`**, **7 `<optgroup>`** (VehicleTracker.tsx:1807,1814; ArticleFormDialog.tsx:151; WarehouseOptions.tsx:18,19 jne).
- `<textarea>` 13: 9× `form-input`; 2× `form-input auto-resize-textarea` (ArticleFormDialog.tsx:256,260); 1× `form-input auto-resize-textarea ${className}` (VehicleTracker.tsx:251, kohalik `AutoTextarea`-laadne ümbris); 1× `form-input finance-notes-textarea` (FinanceModal.tsx:692).
- `<datalist>`: 6 sidet (ArticleFormDialog.tsx:138,160,224; FieldEditDialog.tsx:551,711; VehicleTracker.tsx:144–153 abikomponent). Radix Select seda ei asenda.

### 1.3 `<label>` (227) ja väljakestad

| Muster | Arv | Klass | CSS | Märkus |
|---|---|---|---|---|
| väljasilt `div.form-group > label + väli` | 191 klassita `<label>` | `.form-group label` | `index.css:2784` (0.72rem 600 `--text-secondary`) | `form-group` tsx esinemisi **191**; asendaja `ui/Field` (12px, 600, 4px vahe) |
| `users-admin-checkbox` | 7+5 `full-width` | `index.css:5373` flex gap 8 0.85rem | 12 | ArticleFormDialog, ArticleCategoriesDialog, UsersAdminModal, WarehousesPanel, WorkRegisterModal, FieldWorkEntryDialog |
| `layer-label` | 8 (+1 `basemap-cadastre-toggle`) | `index.css:851` 0.8rem flex gap 8 | LayerControl | kaardipaneel |
| `crop-winter-toggle` | 3 (+1 `crop-auto-color-toggle`) | `index.css:3976` 0.85rem | CropRegisterModal | |
| `soil-metric-radio-item` | 3 | `index.css:896` 0.78rem | LayerControl | 1 radio + 2 checkbox |
| `checkbox-label` | 2 | puudub CSS-is (tühi klass) | FieldManagerModal.tsx:459, FieldUploadModal.tsx:241 | |
| `fw-filter` (+`checkbox`, `fw-filter-end`) | 3 | `index.css:5688,5713` | FieldWorksBoard.tsx:772 | toolbar, roheline `accent-color` |
| `satellite-cloudfree` | 2 | `index.css:559` | SatellitePanel.tsx:373,378 | |
| `work-entry-finish` | 1 | `index.css:7332` (`accent-color:#16a34a; 16px`) | FieldWorkEntryDialog.tsx:719 | |
| `finance-notes-label`, `text-secondary` | 1 + 1 | `index.css:7918` | FinanceModal | |
| klassita, ümbritseb checkboxi | ~5 | — | TripRegister.tsx:178,184,190; VehicleTracker.tsx:1222; RelatedPartiesModal.tsx:332 | |

Väljakestad (konteinerid): `.form-grid` (`index.css:2733`, **18**, 2 veergu 10px), `.form-group` (`:2739`, 191), `.form-group.full-width` (`:2745`, `full-width` 30), `.form-row-3` (`:2749`, 2) + `.field-auto-row` (`:2762`, 1), `.input-split` (**kaks reeglit**: grid `:3007`, flex `:3900`, 7), `.input-with-unit` (`:8692`, 2), `.form-sub-header` (`:3958`, 8), `.form-section-title` (`:8712`, 1), `.form-header-row` (`:3013`, 1). `.form-label`, `.form-row`, `.form-hint`: **klasse ei ole** (sihtmärk `ui/Field`).

### 1.4 Failide kaupa (`input / select / textarea / label`; ainult toored)

| Fail | in | sel | ta | lab |
|---|---|---|---|---|
| CropRegisterModal.tsx | 19 | 1 | 0 | 22 |
| VehicleTracker.tsx | 18 | 8 | 1 | 36 |
| PriaLinesEditor.tsx | 12 | 0 | 0 | 0 |
| LayerControl.tsx | 11 | 0 | 0 | 11 |
| FieldEditDialog.tsx | 10 | 3 | 0 | 20 |
| ArticleFormDialog.tsx | 10 | 5 | 2 | 17 |
| UsersAdminModal.tsx | 9 | 0 | 0 | 9 |
| RelatedPartiesModal.tsx | 9 | 1 | 1 | 9 |
| HarvestLotDialog.tsx | 7 | 3 | 0 | 12 |
| FieldWorkEntryDialog.tsx | 7 | 0 | 1 | 16 |
| WorkRegisterModal.tsx, WarehousesPanel.tsx, StockDocumentDialog.tsx, PoiManagerModal.tsx | 4 | 1/1/5/1 | 0/0/0/2 | 5/5/7/9 |
| TripRegister, SetPasswordPage, LoginPage, InventoryDialog, FinanceModal, ChangePasswordModal, ArticleCategoriesDialog | 3 | 0–2 | 0–1 | 1–4 |
| SatellitePanel, FieldWorksBoard, FieldUploadModal, FieldManagerModal, CultivationControl, AiConnectionModal | 2 | 2/0/2/3/4/0 | 0 | 2/3/3/1/0/0 |
| 1 input: WeatherView, WeatherCredentialModal, SoilSampleUploadModal, SeasonManagerModal, ResourceCostFields (+2 sel), NumberInput, FieldsTableView, FieldWorkPlanForm, FieldBookUploadModal, DateInput, ArticlesView, AddFieldWorkDialog | 1 | | | |
| ainult select/textarea: DeviceAssignmentRegister 4 sel + 1 ta, TripGapReviewDialog 1 ta, TripDialog 1 ta, FilterSelect 0 (kommentaar), ArticleMergeDialog 1 sel | | | | |

44 faili kokku. Toore `<input|select|textarea>` kokku (audit-regex, ilma `ui/`, `admin`, `landing`, `styles`): **238** (sh 1 kommentaaris).

## 2. Omad komponendid

Kõik asuvad `src/components/`. Kõik neli on projekti reeglite järgi kohustuslikud (`ui/README.md`).

| Komponent | Fail | Kasutusi | Kaustu |
|---|---|---|---|
| `DateInput` | `DateInput.tsx` (348 rida) | 18 JSX-kohta, 11 faili | CultivationControl, DeviceAssignmentRegister 2, FieldWorkEntryDialog, FieldWorkPlanForm 2, HarvestLotDialog 2, InventoryDialog, StockDocumentDialog, StockDocumentsPanel 2, TripRegister 2, VehicleTracker 4 |
| `NumberInput` | `NumberInput.tsx` (82) | 23, 5 faili | CropRegisterModal 5, FieldEditDialog 7, PoiManagerModal 3, SeasonManagerModal 1, VehicleTracker 7 |
| `FilterSelect` | `FilterSelect.tsx` (217) | 41, 15 faili | PriaLinesEditor 7, FieldWorkEntryDialog 7, TripRegister 4, StockDocumentsPanel 3, FieldWorkPlanForm 3, WeatherView 3, jt |
| `FilterClear` | `FilterClear.tsx` (22) | 45, 16 faili | TripRegister 8, StockDocumentsPanel 5, FieldWorkEntryDialog 4, ArticlesView 3, FieldWorksBoard 3, FinanceModal 3, RelatedPartiesModal 3, WeatherView 3, jt |
| otsingukast | `.search-box-wrap` + `.search-input` | 6 + 6 (+2 `type=search` FinanceModal-is `.finance-search-box`) | ArticlesView.tsx:225, CropRegisterModal.tsx:405, FieldManagerModal.tsx:452, FieldWorksBoard.tsx:749, FieldsTableView.tsx:327, RelatedPartiesModal.tsx:469; FinanceModal.tsx:447,867 |

**DateInput** (`DateInput.tsx`):
- Props (8–16): `value` (ISO `YYYY-MM-DD` või `''`), `onChange(iso)`, `className`, `disabled`, `required`, `id`, `popupPlacement` (`top`/`bottom`). Kõik 17 kutsujat annavad `className="form-input"` (1× `cc-input`); **väli ei kanna ise alust**, kutsuja peab klassi andma.
- Käitumine: tekstiväli `type="text"`, `inputMode="numeric"`, `placeholder="pp.kk.aaaa"` (248–256); parsib `parseEtDate` (`services/dateFormat.ts:61`), kinnitab `onBlur` ja `Enter`; vigase sisendi korral `invalid` + `aria-invalid` + `title="Sisesta kuupäev kujul pp.kk.aaaa"`; kalendri nupp `.date-input-btn` (271, `tabIndex=-1`, `CalendarDays` 15px) väljas paremal sees (`absolute right 4px`); kalender `createPortal` `usePopupContainer()`-isse (283), `position:fixed`, `z-index: 4000` inline (119), paigutus eelistatud pool + vastaspool + ekraanipiirid, kuulab `resize`/`scroll`; **Esc** sulgeb ainult kalendri (`window` capture, `stopPropagation`, 86–92); päeva-/kuunimed eesti keeles (hetkeaasta ja kuu). Kalender on oma CSS-iga (`.date-picker-*`, `index.css:2856–2985`, 14 reeglit, hard-coded hex: `#16a34a`, `#1d4ed8`, `#3b82f6`).
- Välimuse erinevus `fieldControlClass`-ist: ümbris `.date-input` (`index.css:2815`, `position:relative; display:flex`); `.date-input>.form-input` `padding-right:34px` (`:2820`); `.date-input.invalid>.form-input` `border-color:#ef4444` (`:2826`) (ui: `aria-invalid:border-destructive`, sama tulemus kui komponent annab `Input`-ile `aria-invalid`).

**NumberInput** (`NumberInput.tsx`):
- Props (19–33): `value: number|null|undefined`, `onChange(number|null)`, `decimals` (vaikimisi **2**), `min`, `max`, `integer`, `className`, `id`, `placeholder`, `disabled`, `required`, `aria-label`, `title`.
- Käitumine: `type="text"` + `inputMode="decimal"|"numeric"`; koma või punkt kümnendmärgiks (`parseNumberText` 4–11); tühi → `null`; vormindab `onBlur` komaga, ilma tuhandete eraldajata (`formatNumberText` 14–17); kärbib `min`/`max` blur'il (57–64); sünkroniseerib väljastpoolt tulnud väärtuse ilma sisestust üle kirjutamata (46–50). Kogused 2 komakohaga vaikimisi, seega reegel kehtib.
- Välimus: **`className="form-input num ..."` kõvakodeeritud** (70); `.form-input.num` = `text-align:right; font-variant-numeric:tabular-nums` (`index.css:7272`). Paremale joondus on olemas; ui `Input` seda ei tee. Lisaks reegel `input[type="number"], .form-input[type="number"], .text-right {text-align:right !important}` (`:3000`): `type="number"` 0, `.text-right` 1 koht (sama sisu kui `.num`).
- Täiendavalt toored 23× `form-input num` (`inputMode="decimal"` käsitsi, ilma NumberInput'ita): ArticleFormDialog 3, HarvestLotDialog 3, InventoryDialog 1, FieldWorkEntryDialog 3(+2 `readonly`), FieldWorkPlanForm 1, ResourceCostFields 1, StockDocumentDialog 2, PriaLinesEditor 9. Need **ei** kasuta NumberInput'i, seega koma/`min`/`max` käitumine puudub (kasutaja sisestus parsitakse kutsuja koodis). Ühtlustamine: need minema NumberInput peale (käitumise muutus, vt küsimus 4).

**FilterSelect** (`FilterSelect.tsx`):
- Props (15–27): `value`, `onChange(string)`, `options: {value,label,group?,color?}[]`, `defaultValue` (vaikimisi `''`: sellest erinev valik kuvatakse paksult), `className`, `style`, `title`, `disabled`, `ariaLabel`, `id`, `fill`.
- Käitumine: trigger `<button class="form-input filter-select-trigger">` (160–182); loend `createPortal` `usePopupContainer()`-isse (183–214), `position:fixed`, `z-index:9000` CSS-is (`index.css:8491`); asukoht all või üleval (`flip` kui all < 200px), kasutab kogu vaba kõrgust; klaviatuur: nooled, Home/End, Enter/Space valib, Tab sulgeb, **tähe järgi hüpe** (`findTypeaheadIndex` 30–37, et-lokaat); Esc sulgeb ainult loendi (capture, 102–108); sulgub kerimisel ja resize'il; rühmapäised (`group`), värvitäpp (`color`); **laius = pikim valik paksus kirjas** (nähtamatud `.filter-select-sizer` lapsed) — filter ei muuda suurust valiku vahetamisel. Otsingut ei ole (seega "otsinguga valik" on valesti kirjeldatud: otsinguga FilterSelect'i pole, spec ütleb "Radix ei toeta otsingut; otsinguga valikud jäävad FilterSelect peale").
- Välimus: `form-input filter-select-trigger[ filter-select-fill][ is-set]`; `index.css:8458–8476` (padding-right 50px, nowrap/ellipsis, SVG-chevron taustapildina), `:8576–8589` (`.form-input.filter-select-trigger:read-only` üle kirjutus, sest `.form-input:read-only` (`:7277`) tabab ka nupu — **lõks**: `:read-only` sobib igale mitteredigeeritavale elemendile, sh `<button>`), `:8595–8611` (sizer/current), `:8628` (fill). Vormides 40+ kohas kutsuja `fill`; toolbarides 11 kohta `style={{fontSize:'13px',height:'34px'}}` (TripRegister 154–172, WeatherView 71–79; DeviceAssignmentRegister 195/207 ja VehicleTracker 1901/1913 kasutavad `style` samuti).
- Jaotus: **vorm 4**, **tööriba/filter 30**, **muu 7** (AST ümbrus), seega suurem osa on filter.

**FilterClear** (`FilterClear.tsx`, 22 rida): props `active`, `onClear`, `className`, `children`. `<span class="filter-clear[ active]">` + lapsed + (kui `active`) `<button class="filter-clear-btn" title/aria-label="Eemalda filter">` `X` 14px (13–21). CSS `index.css:8438–8674`: `position:absolute; right:6px; 20×20 ring`, hover punane `#ef4444`; selecti/FilterSelect'i korral `right:26px` (`:has(> select)`, 8569); modifikaatorid `filter-clear-fill` (6 kohta; laius 100%), `filter-clear-inline` (5; X tavalises voos, gap 4px). **Wrapper ei tea sisu suurusest**: `.filter-clear > input {padding-right:30px}`, `.filter-clear > .filter-select-trigger {padding-right:50px}` kirjutavad välja polsterduse.

**Otsingukast**: `.search-box-wrap` (`index.css:8655`, flex gap 6, `--text-secondary`) = `Search` ikoon + `FilterClear` + `<input className="form-input search-input">`. `.search-input` **omab ainult kõrguse ülekirjutust**: `.fullpage-board-body .search-box-wrap .search-input {height:34px; font-size:0.8rem}` (`:5594`), `.fw-main …` (`:5706`) ja `flex:1 1 220px; max-width:420px` (`:5589`, `:5701`). Kaks erandit: `.finance-search-box` (`:7574`, **oma raam** padding 6/10, radius **8px**, font 0.82rem; sees alasti `input` ilma raamita `:7585`) kasutab `type="search"`; `.fw-search` (`:5657`, 34px, 200px lai) on **kasutuseta** (vt 6).

### Teised sisendilaadsed komponendid ja kohalikud variandid

- **`cc-*` (CultivationControl.tsx 185–366)**: oma kõrgus `--cc-h:32px` (`index.css:1491`), `.cc-select`, `.cultivation-panel .cc-input`, `.cc-time` jagavad reeglit `:1590` (font **0.82rem 600**, border/bg/color samad muutujad), fookus rõngas `0 0 0 3px rgba(16,185,129,.15)` (`:1618`); `.cc-start` (`:1776`, 44px kast, `.cc-start-input` `:1792` ilma äärisega) ja `.cc-slider input[type=range]` (`:1849–1871`, `#ffffff` thumb).
- **`PriaLinesEditor.tsx`**: 12 toort `<input>` (9× `form-input num`, 3× `form-input`) + 7 `FilterSelect`, `.pria-grid .form-input {min-width:0;width:100%}` (`index.css:8418`), `.pria-line .form-input` (**kuolnud**, `:8414`).
- **`ResourceCostFields.tsx:30–44`**, **`VehicleTracker.tsx:144–153`** (datalist-ga sisend), **`VehicleTracker.tsx:251`** (automaatselt kasvav textarea, `field-sizing:content` `index.css:2372`, `min-height:62px; max-height:320px`; 3 kohta).

## 3. CSS-reeglid vormiväljadele

`src/App.css` (184 rida) ja `src/styles/app.css` (93 rida) vormiväljade reegleid **ei sisalda** (`app.css` sisaldab ainult `@theme`-sidumist `--color-field`, `--color-input`). Kõik allpool on `src/index.css` (9 042 rida). "tsx" = esinemisi (regex `(?<![\w-])klass(?![\w-])`, ilma admin/landing/ui/tooling); "—" = ei sobi arvutada.

### 3.1 Põhireeglid

| Selektor | Rida | Mida seab | tsx |
|---|---|---|---|
| `.form-input` | 2794 | padding 7/10, font 0.8rem, radius `--radius-sm`, border 1px `--input-border`, bg `--input-bg`, color `--input-color`, outline none | 206 |
| `.form-input:focus` | 2805 | `border-color: emerald-500` (ilma ringita) | — |
| `.form-input::-webkit-calendar-picker-indicator` | 2809 | `filter:invert(.8)` (natiivse kuupäevavälja jäänuk; `type=date` 0) | **kuolnud loogiliselt** |
| `select.form-input` | 2988 | `appearance:none`, `padding-right:28px`, SVG-chevron taustapildina (stroke `#888`) | 51 selecti |
| `.form-input.num` | 7272 | `text-align:right; tabular-nums` | 23+2+NumberInput |
| `.form-input.readonly, .form-input:read-only` | 7277 | `bg --stat-bg; cursor default; font-weight 700; border rgba(0,0,0,.15)` — tabab **igat** `readOnly`-i (12× tsx `readonly`/`readOnly`) ja `<button>`-i | 2 + 5 |
| `select.form-input:read-only` | 7287 | taastab chevroni | |
| `.form-input.auto-field-input` | 2778 | `cursor:help; color secondary; bg --stat-bg` | 2 |
| `input[type="number"], .form-input[type="number"], .text-right` | 3000 | `text-align:right !important; tabular-nums` | `.text-right` 1 |
| `.form-group` | 2739 | flex-veerg gap 4px | 191 |
| `.form-group label` | 2784 | 0.72rem 600 `--text-secondary` | |
| `.form-group.full-width` | 2745 | `grid-column:span 2` | 30 |
| `.form-grid` | 2733 | grid 2 veergu 10px | 18 |
| `.form-row-3`, `.form-row-3.field-auto-row` | 2749, 2762 (+mobiil 2757, 2767) | 3 veergu | 2 + 1 |
| `.input-split` | 3007 **ja** 3900 | kaks reeglit samale klassile: grid 1fr 1fr gap 6 vs flex gap 8 align center | 7 |
| `.form-sub-header`, `.form-section-title`, `.form-header-row` | 3958, 8712, 3013 | rühmapealkirjad | 8, 1, 1 |
| `.date-input`, `.date-input>.form-input`, `.date-input.invalid>.form-input`, `.date-input-btn(:hover/:disabled)` | 2815, 2820, 2826, 2830–2850 | vt jaotis 2 | 1 (DateInput.tsx) |
| `.date-picker-*` (popup, header, title, nav, nav-btn, today-btn, weekdays, weekday, grid, day, day.other/today/selected) | 2856–2985 | kalender; popup `z-index:3100` (inline 4000 võidab) | DateInput.tsx |
| `.filter-clear*`, `.filter-clear-btn` | 8438–8674 | vt jaotis 2 | 45 JSX |
| `.filter-select-*` (trigger, label, list, option, check, group, sizer, current, dot) | 8458–8611, 8973 (`.filter-select-dot`) | vt jaotis 2 | FilterSelect.tsx |
| `.search-box-wrap`, `.search-box-wrap > .filter-clear` | 8655, 8662 | flex gap 6 | 6 |
| `.auto-resize-textarea` | 2372 | `field-sizing:content; min-height 62px; max-height 320px; line-height 1.45` | 3 |

### 3.2 Vaatepõhised ülekirjutused (kaaluvad kõike üle)

| Selektor | Rida | Mida seab | tsx |
|---|---|---|---|
| `.satellite-date-row .form-input` | 550 | padding 4/6, padding-right 24, **font 0.75rem** | `satellite-date-row` 2 |
| `.cc-select, .cultivation-panel .cc-input, .cc-time` | 1590 | **kõrgus 32px, font 0.82rem 600** | 2+1+1 |
| `.cultivation-panel .cc-input` | 1661 | padding 0 32 0 10 | 1 |
| `.imp-assign-select, .dev-assign-select` | 2487 | flex 1, **font 0.74rem**, padding 5/8 | 1+1 |
| `.fleet-edit-modal .form-group, .form-input` | 3853–3867 | `min-width:0`; `width:100%`; `[type=color]` 56px | 7 |
| `.crop-inline-edit .form-input` | 3689 | padding 4/6, **font 0.78rem** | 1 |
| `.edit-cad-grid .form-input` | 4736 | `min-width:0; width:100%` | 1 |
| `.login-page .login-card .form-input` (+`:focus`) | 5118, 5126 | **oma värvid ja padding 9/12, font 0.85rem**, fookus oranž `#c98a2e` rõngas | LoginPage, SetPasswordPage |
| `.weather-credential-form`, `.ai-key-url/-new`, `.login-forgot-row` `.form-input` | 5155, 5312–5313, 5346 | `flex`; `.ai-key-url` monospace 12px | 1 + 2 + 1 |
| `.fullpage-board-body .search-box-wrap .search-input, … .register-actions-bar select.form-input, … .filter-select-trigger` | 5594–5596 | **height 34px, font 0.8rem** | `register-actions-bar` 10 |
| `.fw-main .search-box-wrap .search-input, … select.form-input, … .filter-select-trigger` | 5706–5708 | sama 34px | |
| `.fw-search`, `.fw-search input` | 5657, 5670 | 34px kast, 200px | **0 (kuolnud)** |
| `.fw-filter.checkbox`, `.fw-filter.checkbox input` | 5688, 5713 | `accent-color:#16a34a` | 3 |
| `.finance-search-box` (+`input`, `> .filter-clear`, `.filter-clear-btn`) | 7574, 7585, 8666–8674 | oma raam radius **8px**, padding 6/10, font 0.82rem | 2 |
| `.finance-field-select` | 7601 | font 0.78rem, padding 4/8 | 1 |
| `.finance-price-input(-wrap, .missing)`, `.finance-unit-suffix` | 7865–7895 | **font 0.85rem 600**, padding 5/8, `padding-right:48px` (suffiksi jaoks `€/{unit}` absoluutselt paigutatud), puuduv väärtus `#f59e0b`/`#fffbeb` | 1+1 |
| `.finance-notes-textarea` | 7927 | `resize:vertical; font 0.8rem` | 1 |
| `.stock-doc-lines input.num`, `td:first-child select`, `.input-with-unit` | 8687–8692 | `width:110px`; select `min-width:160px` | 2 |
| `.harvest-lot-head .form-input`, `.harvest-lot-add .form-input`, `.article-form-modal .form-input` | 8732, 8739, 8708 | `width:100%; min-width:0; box-sizing` (viimane lisab `text-overflow:ellipsis`) | 2+1 |
| `.pria-grid .form-input`, `.pria-line .form-input(.num)` | 8418, 8414–8415, 8423–8424 | mobiilis `flex 1 1 140px` / `.num` `flex 0 1 90px` | 6 / **0** |
| `.history-filter-bar > div > .filter-clear(...)` | 8617–8622 | `width:100%` | 3 |
| `.season-form-fieldset:disabled .form-input` | 4287 | `opacity .75` (ainus `disabled`-reegel väljadele) | 1 |
| `.article-categories-add .form-input:first-child` | 8700 | `max-width:180px` | 1 |
| `.party-role-checkbox input[type="checkbox"]`, `.work-entry-finish input` | 4805, 7332 | `accent-color`, **15px / 16px** | 1+1 |

### 3.3 Vastuolud suuruses

| Kus | Kõrgus | Font | Padding | Radius |
|---|---|---|---|---|
| `ui/Input` (siht) | **32px** (`h-8`) | 13px | 10px | 6px |
| `.form-input` | ~32px (padding 7 + line-height) | **12.8px** | 7/10 | 6px |
| Tööriba (`fullpage-board-body`, `fw-main`) | **34px** | 12.8px | | |
| `WeatherView`, `TripRegister` inline `style` | **34px** | **13px** | | |
| `.cc-*` | **32px** (`--cc-h`) | **13.1px 600** | 0 8/10 | |
| `.finance-search-box` | ~34px | 13.1px | 6/10 | **8px** |
| `.finance-price-input` | ~30px | 13.6px 600 | 5/8 (+48 paremal) | |
| Tabeli sisene (`.finance-field-select`, `.crop-inline-edit`, `.imp-assign-select`, `.satellite-date-row`) | ~28px | 12.0 / 12.5 / 11.8 / 12.0px | 4/8, 4/6, 5/8, 4/6 | |
| Login | ~36px | 13.6px | 9/12 | |

Eri font-suurusi väljadel: 0.74, 0.75, 0.78, 0.8, 0.82, 0.85rem, 12px, 13px — kuus erinevat. Eri kõrgusi: 28(≈), 30(≈), 32, 34, 36(≈). Radius: 6 ja 8px (ainult `finance-search-box`).

Tumedad teemad: kõik üle `--input-*` muutujate (`:48–50` hele, `:94–96` tume); lisaks tumedas **`.form-input::-webkit-calendar-picker-indicator {filter: invert(.8)}`** (kuolnud, vt 6). Eraldi `[data-theme=dark]` reegleid vormiväljadele ei ole.

## 4. Kasutuskohad rolli järgi

Arvud AST-ümbrisega (sisend ∈ DialogBody/form-group → vorm; FilterClear/`register-actions-bar`/`search-box-wrap` → tööriba; `TableCell` → tabeli sees käsitsi kontrollitud).

| Rühm | Arv | Mida | Siht-ui |
|---|---|---|---|
| **A. Dialoogi/paneeli vormiväli** | text 91, password 9, email 2, tel 1, textarea 12, select 40, NumberInput 23, DateInput 13, FilterSelect 4, color 2 | `div.form-group > label + väli` (191 silti) | `Field` + `Input`/`Textarea`/`Select`; DateInput, NumberInput uue alusega; FilterSelect kui valik on pikk |
| **B. Tööriba filter/otsing** | FilterSelect 30, DateInput 4, search-input 6, `type=search` 2, checkbox 5 | `.register-actions-bar`, `.fw-toolbar`, `.history-filter-bar`, `.search-box-wrap` | FilterSelect + FilterClear (uus alus), `Input` (otsing), `Checkbox`; kõrgus 32/34 üle otsustada |
| **C. Rea sees muutmine tabelis / kiirrida** | ~30: StockDocumentDialog.tsx:180–196 (1 select + 2 num), InventoryDialog.tsx:165,184, FinanceModal.tsx:662 (hinnasisend suffiksiga), FieldManagerModal.tsx:570–596 (3 select), PriaLinesEditor 12 input + 7 FilterSelect, WeatherView.tsx:116 (checkbox) | `.stock-doc-lines`, `.crop-inline-edit`, `.pria-grid` | `Input`/`Select` `size="sm"` (lünk), NumberInput |
| **D. Checkbox/radio ritta vormis (seaded)** | checkbox 17, radio 2 | `users-admin-checkbox`, `crop-winter-toggle`, `work-entry-finish`, `checkbox-label` | `Checkbox` + silt (lünk: sildiga komponent) |
| **E. Kaardipaneeli juhtnupud** | LayerControl 10 checkbox + 1 radio, CultivationControl (4 select, 1 range, 1 text, 1 DateInput), SatellitePanel (2 select, 2 checkbox) | `.layer-label`, `.cc-*`, `.satellite-*` | `Checkbox`, osa jääb eraldi (range, `cc-*` kõrgusega juhtpaneel) |
| **F. Sisselogimise lehed** | LoginPage 3, SetPasswordPage 3, ChangePasswordModal 3, WeatherCredentialModal 1 | `.login-page .login-card .form-input` (oma värvid) | `Input`; login jääb oma teemaga (vt "ei sobi") |
| **G. Failid ja värv** | file 3 (peidetud), color 2 | kuvatakse ühe nupu/dropzone'ina | jäävad toorelt (ei ole väli); color → `Input` + `type=color` laius |
| **H. Otsustamata/erijuhud** | VehicleTracker 144–153 (datalist-sisend), 6 datalist, optgroup-selectid 7, TripRegister:178–190 checkbox-chipid, SetPasswordPage:77 | | vt "ei sobi" |

### Mis ei sobi `ui/` praeguste komponentidega

| Mis | Kus | Miks |
|---|---|---|
| `<select>` koos `<option value="">`, `optgroup`, `required` | 35 tühja valikut, 7 optgroup, 61 `required` (kõik väljad kokku) | `ui/Select` ei luba `value=''` valikut, ei toeta `optgroup`i; vt lünk S3, küsimus 3 |
| `datalist`-sisendid (vabatekst + soovitused) | ArticleFormDialog 138/160/224, FieldEditDialog 551/711, VehicleTracker 144 | Select asendab ainult suletud loendit; jääb `Input list=` |
| Login-lehe värviteema | `.login-page .login-card .form-input` (`index.css:5118`) | oma värvid (`--login-ink`, `--login-line`) ja font 0.85rem; jääb teema tasemel `Input`-i ülekirjutusena |
| `.cc-*` juhtpaneel (kõrgus `--cc-h`, raam, `font 600`, 44px `cc-start` kast) | CultivationControl.tsx:185–366 | ühtne 32px kõrgus, sisemine ilma ääreta input kasti sees; ainult värvid/raadius ühtlustada |
| `.finance-search-box` oma raam radius 8px | FinanceModal.tsx:447,867 | sisemine alasti input kasti sees (`FilterClear` kleepub kasti serva) |
| `range` (taasesituse liugur) | CultivationControl.tsx:339 | pole väli, pole ui komponenti |
| `file` | 3 kohta | peidetud, nupp avab; ui komponent ei ole vajalik |
| `type=color` | 2 | natiivne värvivalija, kast 56px; peaks jääma `<input type="color">` |
| Hinnasisend suffiksiga `€/{unit}` | FinanceModal.tsx:662–670 | vajab `suffix` (lünk S2) |
| Leaflet popupid (HTML-string) | MapView.tsx | ulatusest väljas (spec) |

## 5. Lüngad `ui/` komponentides

| # | Lünk | Kus vaja | Ettepanek |
|---|---|---|---|
| S1 | **Suurus** | tööriba 34px, tabeli sisene ~28px, vorm 32px (`Input h-8` fikseeritud) | `size`: `sm` (28px, text-xs 12px, px-2), `md` (32px, text-sm, vaikimisi). 34px kaob või `lg`; tööriba tahetud suurus on küsimus 2. Sama `size` Select, Textarea, FilterSelect, DateInput, NumberInput. |
| S2 | **Eesliide/järelliide (ha, €, kg)** | `finance-unit-suffix` (1), `input-with-unit` (2), `date-input-btn` (kalender), `filter-clear-btn` (X), otsinguikoon (6) | `InputGroup`: ümbris `relative`, `startAdornment`/`endAdornment` slot (`pointer-events-none` tekstile, nupp klõpsatav) + `Input` automaatne `pl-8` / `pr-8` suurus. Siis saavad DateInput kalender, FilterClear X ja `€/h` ühe mehhanismi. |
| S3 | **Select: `value=''`, `optgroup`, `required`** | 35 tühja valikut, 7 optgroup | `Select` sisemine sentinel (`''` ↔ `__none__`), `groups` või `option.group`, `required` ja `name` (Radix peidetud select lisab natiivse valideerimise vormis); `autoFocus`. |
| S4 | **Invalid-olek** | DateInput (`invalid`, `#ef4444`), `.finance-price-input-wrap.missing` (amber), `required` (61, brauseri vihje) | `Input` toetab juba `aria-invalid` → `border-destructive`; vaja `ring-destructive/30` fookusel ja `warning` variant (puuduv hind). `Field error` olemas. |
| S5 | **Numbrijoondus** | NumberInput + 23 toort `form-input num` + 1 `.text-right` | `Input` `numeric` prop (`text-right tabular-nums`) või NumberInput lisab ise; `inputMode` sisse. |
| S6 | **Tühjendusnupp (X)** | FilterClear 45 kohta | FilterClear jääb eraldi (projekti reegel), aga X asukoht/suurus tuleb `InputGroup`-i `endAdornment`-ist, mitte `padding-right:30px/50px` ülekirjutustest. |
| S7 | **Textarea autosize** | 3 kohta (`.auto-resize-textarea`, `field-sizing:content`, min 62px, max 320px) | `Textarea` prop `autosize` (`[field-sizing:content] min-h-16 max-h-80`); praegune min-h-16 = 64px vs 62px. `field-sizing-content` on Tailwind v4 utiliit. |
| S8 | **Sildiga checkbox/radio** | 35 + 3 kohta; silt 191+ | `CheckboxField` / `RadioField` (silt + abitekst, kogu rida klõpsatav) või `Field` `inline` variant; `Checkbox` praegu ei ole `<input>` (Radix button), vormi `name`/`required` ja `htmlFor` vajavad kontrolli. |
| S9 | **Keelatud/readonly välimus** | 12 readonly (`.form-input:read-only` bold + hall taust), 1 `fieldset:disabled` | `Input` `readOnly:` `bg-muted font-bold` (või ainult `bg-muted`); `disabled:opacity-50` on olemas. |
| S10 | **Otsinguväli** | 6 + 2 | `SearchInput` = `InputGroup` (ikoon) + `Input` + FilterClear; ilma selleta jääb `.search-box-wrap` CSS elama. |
| S11 | **Fookus** | `.form-input:focus` ainult äär, `.cc-*` 3px rõngas, login oranž rõngas | ui annab `ring-2 ring-primary/30` kõigile; login-lehe oranž jääb teemamuutujana (`--ring`). |
| S12 | **Hüpikute z-index (DateInput/FilterSelect)** | DateInput inline 4000, FilterSelect CSS 9000, ui menüüd `z-2100` | ühtlustada ühe skaalani (`z-2100` hüpikud; DateInput ja FilterSelect Radix Popover peale või sama väärtus). |

## 6. Surnud CSS (vormiklassid ilma tsx kasutuseta)

Kontrollitud kõik vorm-/sisendiga seotud selektorite klassid (262 reeglit), regex `(?<![\w-])klass(?![\w-])` kogu `src/**/*.ts(x)` peal; dünaamilisi mustreid (`form-${…}`, `…-${…}`) ei leitud, ainult `status-${…}`-laadsed (vt märgi inventuur). Kuolnud:

| Klass | Rida | Märkus |
|---|---|---|
| `.fw-search` + `.fw-search input` | 5657, 5670 | vana otsingukast, asendatud `search-box-wrap`-iga |
| `.pria-line .form-input`, `.pria-line .form-input.num` (+mobiil) | 8414–8415, 8423–8424 | tsx-is on `pria-lines` (konteiner, elus `:8412`) ja `pria-grid`, mitte `pria-line` |
| `.fw-panel-grid label` | 6786 | |
| `.form-card-header` (+`h4`) | 4258, 4267 | |
| `.date-picker-popup-top` | 1667 (esimene selektor) | teine selektor `.cultivation-panel .date-picker-popup` elab |
| `.form-input::-webkit-calendar-picker-indicator` | 2809 | `type="date"` 0 kohta |
| `.checkbox-label` | — | tsx-is 2× kasutuses, **CSS-i ei ole** (tühi klass) |
| `.form-input.readonly` (klassi pool) | 7277 | klass `readonly` tsx-is 12 esinemist on `readOnly`-atribuut; reegli teine pool `:read-only` on elus |
| `.text-right` | 3000 | kasutuses 1 kohas; kaotada koos NumberInput'i ühtlustamisega |
| `.input-split` duplikaat | 3007 vs 3900 | mõlemad elus, aga vastuolus (grid vs flex), tegelik on hiline (3900) |

Märkus: ui-audit loeb `form-` / `input` klasse **mitte** (ei ole `btn|modal|badge|pill|tab|data-table|table`), seega kustutamist mõõdik ei näita; vaja uut rida (jaotis 7).

## 7. ui-audit

Praegune väljund (`npm run ui-audit`, serveris):

```
Erinevaid kirjasuurusi (CSS)          39
Erinevaid nurgaraadiusi (CSS)         11
Erinevaid vahe-väärtusi (CSS)         36
Erinevaid värvikoode (CSS)           241
style={{…}} kohti (tsx)              175
Värvikoode/rgba (tsx)                 57
Kirjasuurusi inline (tsx)              6
Vanu komponendiklasse (CSS)            6
Keelatud suvalisi klasse (tsx)         0
Skaalaväliseid vahe-klasse (tsx)       0
Vanu nupuklasse (tsx)                  0
Vanu modaaliklasse (tsx)               0
Vanu tabeleid (tsx)                    0
Vanu märke/sakke (tsx)                 0
```

Ettepanek: lisada `LEGACY_FORM_FIELD` regex (`src/tooling/uiAudit.ts`) ja rida "Vanu vormivälju (tsx)". "Toored elemendid" hõlmavad ka DateInput/NumberInput sisemisi `<input>`-e; need jäetakse `summarize`-is välja failinimega (nagu `components/ui/`). Kaks osa: toored elemendid + vanad klassid.

```ts
// Toored vormielemendid ja vanad vormiklassid (etapp 2.5). ui/ kausta ning DateInput/NumberInput/FilterSelect
// (omad komponendid, mille sees toores <input>/<select> on lubatud) ei loeta. Jääb alles valvurina: peab olema 0.
const LEGACY_FORM_FIELD =
  /<(input|select|textarea)(?=[\s>])|(?<![\w-])(form-input|form-group|form-grid|form-row-3|input-split|input-with-unit|search-input|search-box-wrap|auto-resize-textarea|auto-field-input|time-select|cc-select|cc-start-input|finance-price-input|finance-field-select|imp-assign-select|dev-assign-select|satellite-date-select|satellite-period-select|users-admin-checkbox|crop-winter-toggle|crop-auto-color-toggle|checkbox-label|layer-label|soil-metric-radio-item|satellite-cloudfree|work-entry-finish|fw-filter)(?![\w-])/g;
```

- `auditTsx`: lisa `legacyFormFields: [...src.matchAll(LEGACY_FORM_FIELD)].map((m) => (m[1] ? `<${m[1]}>` : m[2]))`.
- `summarize`: `legacyFormFieldFiles` = `tsx.filter(t => t.legacyFormFields.length > 0 && !/components\/(ui\/|DateInput|NumberInput|FilterSelect)/.test(t.path)).map(...)`.
- `scripts/ui-audit.mts` rida 51 kõrvale: `r.legacyFormFieldFiles.reduce((s, f) => s + f.count, 0)` ja failide nimekiri; `uiAudit.test.ts`-i test ("loeb `<input` ja `form-input`, ei loe `components/ui/`").
- **Algtase serveri praeguses seisus: 238 toorest elementi + 493 klassi (kokku ~731 ilma failide väljajätuta), 44 faili.** Jaotus klassi järgi: `form-input` 206, `form-group` 191, `form-grid` 18, `users-admin-checkbox` 12, `layer-label` 8, `input-split` 7, `search-input` 6, `search-box-wrap` 6, `time-select` 6, ülejäänud ≤3.
- Ettepanek: `fw-filter` **jäta välja**, kui toolbari kontroll jääb `Checkbox` + `label`ina; lisa siis, kui `fw-filter` kaob. `form-group`/`form-grid` regex sisse, sest need kuuluvad Field/vormi paigutuse üleviimisele (kui `Field` jääb ainult silt + väli, siis `form-grid` võib jääda paigutusklassiks; küsimus 6).

## 8. Avatud küsimused

1. **Kas seadete checkboxid muutuvad Switch'iks?** Soovitus: **ei**. Praegu on 35 checkboxi, mis kõik on vormi väljad ("Mitteaktiivne", "Põhiladu", "Talivili", "Sega Saagi aasta", kaardikihid), ja salvestatakse nupuga või lüliti kohe. `Switch`il ei ole praegu ühtki kasutajat; kui muuta tervikuna, muutub mõte "märgin ja vajutan Salvesta" mõtteks "lülitan ja see salvestub". Üks erand, mida kaaluda: `LayerControl` kaardikihid (10, toimivad kohe) võiksid olla Switch, aga see on kaardipaneeli välimuse muutus, mitte vormiväljade ühtlustus — jäta etapile 2.7 (paneelid). Checkbox + `CheckboxField` (silt + abitekst) on turvaline vaikimisi.
2. **Üks välja kõrgus kõikjal (32px) või jääb tööriba 34px?** Soovitus: **32px kõikjal** (`size="md"`), tabeli sisene 28px (`size="sm"`), 34px kaob. Praegu on neli kõrgust (28/32/34/36) ja kuus fondisuurust (11.8–13.6px), mis oligi ühtlustamise põhjus. Tööriba kaotab 2px, Buttoni kõrgus peab olema sama (kontrolli `Button size="md"` kõrgust, et nupp ja väli kõrvuti ei erineks).
3. **Millega asendada 51 `<select>`: Radix `Select` või natiivne stiilitud?** Soovitus: **laienda Radix `Select`i** (`value=''`, optgroup, `required`/`name`) ja kasuta seda vormides; natiivset `<select>`i ei jäta. Põhjus: projekt on juba kord natiivse `<select>`-i loendist (macOS paksu kirja ja eri platvormide välimus) loobunud (`FilterSelect.tsx:2`), seega natiivne stiilitud valik tooks selle probleemi tagasi. Hind: 35 tühja valikut, 7 optgroup'i, mobiilis kaob natiivne valija. Kui töölaua kasutus on peamine (nagu on), see maksab end ära. Alternatiiv "ei puuduta" on odavam, aga jätab 51 kohta vana välimusega.
4. **Kas 23 toort `form-input num` sisendit viia `NumberInput`i peale?** Soovitus: **jah**. Need parsivad praegu kutsuja koodis ja ei toeta koma, `min`/`max` ega tühjaks tegemist ühtemoodi (`inputMode="decimal"` käsitsi). Üleviimine toob koma-käitumise kõikjale, mis ühtlasi täidab "kogused 2 komakohaga". Risk: kutsuja väärtus muutub tekstist `number|null`-iks; ligi 23 kohta, 8 faili — tee eraldi commit'idena (`PriaLinesEditor` 9 ühes failis esimesena).
5. **Kas `DateInput`/`NumberInput`/`FilterSelect` võtavad aluse ise (ilma `className="form-input"`)?** Soovitus: **jah**. Praegu peab kõik 17 DateInput'i kutsujat andma `form-input` klassi, see viimane tuleb `ui/`-st (`fieldControlClass`) ja kutsuja ei tohi seda enam kirjutada. DateInput/NumberInput sisemiselt `Input` + `InputGroup` (kalendriikoon `endAdornment`), kutsuja annab ainult paigutuse (`className="w-40"`). FilterSelect: `size` prop asendab `style={{ height:'34px' }}` (8 kohta) ja `fill` jääb.
6. **Kas `.form-group`/`.form-grid` tuleb asendada `Field` + uue `FormGrid`-iga või jääb paigutus CSS-i?** Soovitus: **`Field` asendab `form-group` (191 silti) ja `form-grid` (18) jääb kuni vormide ümberehituseni paigutusklassiks, mis läheb `ui/FormGrid`-i (2 veergu, `full` span)**. Spec ütleb "paigutust ei ühtlusta", aga uusi vaate-CSS-klasse ei luua; `form-grid`/`form-row-3`/`input-split` (kaks vastuolulist reeglit!) on ainsad paigutusklassid, mida 18+2+7 kohta vajavad, seega ainult `ui/FormGrid` ja `Field` ilma uue klassita. Päris ümberpaigutamist (nt 3 veeru muutmist) ei tehta.
