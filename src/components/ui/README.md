# Ühised komponendid (`src/components/ui/`)

Spec: `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md`. Näidised: `/ui` (admin).

## Reeglid

- Staatiline `style={{…}}` → klass `src/styles/*.css`-is või ui komponent; `style` ainult andmest tulev väärtus (värv, %, px). Peidetud failisisend: atribuut `hidden`. Vea olek väljal: `aria-invalid`.
- Nupud, dialoogid, tabelid, märgid, sakid, väljad, menüüd, hüpikud — ainult siit (`ui/`). Vaates ei looda neile uusi CSS-klasse.
- Andmevärvid (kultuuri vaikevärv, määramata, sõiduk, mulla tase, graafiku seeriad, sõidu kaart) on `src/lib/dataColors.ts`-is; vaates ja serveris ei kirjutata hex-koodi uuesti. Erand: Leafleti kihtide stiilid `MapView.tsx`/`FieldShapeModal.tsx`, satelliidi legend (WMS-iga sama), sisselogimise taust.
- Kui vajalikku pole: lisa variant `variants.ts`-i (ja test) või uus komponent siia — mitte vaate-klass.
- Skaalad: kirjasuurus `text-2xs|xs|sm|base|lg|xl` (11/12/13/14/16/20 px); vahed 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8;
  nurgad `rounded-sm|md|lg|full`.
- Ka `src/styles/*.css`-is ainult skaala: kirjasuurus 11/12/13/14/16/20px, nurk `var(--radius-sm|md|lg)` või `9999px`, vahe 2/4/6/8/10/12/16/24/32px (negatiivne samast skaalast). Paigutuse mõõt (> 32px) reegli-sisese muutujana (`--controls-bottom` jms). `npx tsx scripts/css-scale.mts <fail>` viib faili skaalale; `npm run ui-audit` read „Skaalaväliseid …“ peavad olema 0.
- Suvalised väärtused `text-[…]`, `p-[…]`, `m-[…]`, `gap-[…]`, `rounded-[…]`, `bg-[…]`, `border-[…]` on keelatud
  (`npm run ui-audit` näitab). Suurused (`w-[…]`, `max-h-[…]`) on lubatud.
- Toores klõpsatav `div`/`span` (`role="button"`) on keelatud väljaspool `ui/` (ui-audit „role=button väljaspool ui-d“ = 0): kasuta `Button` (`variant="plain"` kogu rea nupule), `CardButton`, `ChipButton`, `Card interactive` või `TableRow`. Erand ainult pesastatud interaktiivsusel (elemendi sees on teine nupp või ta asub nupu sees): `ROLE_BUTTON_ALLOWED` failis `src/tooling/uiAudit.ts` (failitee → arv, põhjus kommentaaris); siis `role="button" tabIndex={0} onKeyDown={clickOnActivationKey}`.
- Värvid ainult nimedega (`bg-card`, `text-muted-foreground`, `text-warning` …) — need järgivad heledat/tumedat teemat
  ise, `dark:` pole tavaliselt vaja. Erand: andmevärvid (kultuur, kaardikiht) `style={{ … }}` kaudu.
- `style={{ … }}` ainult dünaamiliste väärtuste jaoks.
- Kuupäev: `DateInput` (pp.kk.aaaa); arv: `NumberInput` (`end` = ühik); otsinguga valik: `FilterSelect`; filtri X: `FilterClear`
  (`fill`, `inline`); otsinguväli: `SearchInput`. Kõik asuvad `ui/` all, võtavad `size` (`md` vaikimisi, `sm`) ega vaja
  `form-input` klassi — `className` on ainult paigutuse jaoks.
- **Vormiväljad** (`Input`, `Textarea`, `Select`, `CheckboxField`, `RadioField`, `Field`, `FormGrid`, `FieldRow`):
  - Suurus `size`: `md` 32px (vaikimisi, nagu nupp), `sm` 28px tabeli ridades.
  - `Input numeric`: arv paremale, ühelaiused numbrid. `start` / `end`: ikoon, ühik (ha, €) või nupp; siis ümbritseb
    välja `input-group`, ääris ja fookus on ümbrisel, `className` läheb ümbrisele.
  - `Select`: tühi valik on `{ value: '', label: '— vali —' }`; rühmad `group: 'Laod'` (järjestikused sama rühmaga
    valikud rühmapealkirja alla). Otsinguga valik on `FilterSelect`.
  - `CheckboxField` (märkeruut + silt + `hint`, kogu rida klõpsatav) ja `RadioField` (`RadioGroup` sees,
    `orientation="vertical"` paneb üksteise alla; `labelClassName` seab rea vahe ja kõrguse) asendavad käsitsi tehtud `<label>` + märkeruut kombinatsioone.
  - Paigutus: `FormGrid` (`cols` 2 või 3, `span="full"`), `Field span="full"`, `FieldRow` (väli + nupp ühes reas).
  - `data-slot` nimed: `input`, `input-group`, `textarea`, `select`, `filter-select`, `filter-clear`, `date-picker`.
  - Toored `<input>` / `<select>` / `<textarea>` on keelatud; erand ainult `<input type="file">` ja `<input type="range">`
    (`type` esimese atribuudina). `npm run ui-audit` rida „Vanu vormivälju (tsx)“ peab jõudma nulli.
- Numbriveerg tabelis: `numeric` (paremale joondus); kogused `formatQty`.
- Vaates ei kasutata `text-emerald`/`text-muted`/`text-blue`… — need pole kunagi olnud defineeritud. Värv tuleb ui komponendist
  või vaate CSS-klassist. `npm run ui-audit` rida „Defineerimata CSS-muutujaid“ peab olema 0.
- `npm run ui-audit` rida „Kasutuseta klasse (CSS)“ peab olema 0 — klassi eemaldamisel vaatest kustuta ka CSS-reegel.
- Klassid liida `cn()`-ga (mitte template-stringiga) — see lahendab Tailwindi konfliktid.
- `!`-utiliit (nt `!p-0`) ei võida vana CSS-i `!important` reeglit (`!important` puhul võidab varasem kiht, `exceptions` on
  `utilities`-ist ees) — eemalda vana reegel.

## Dialoog

- `<Dialog open onOpenChange>` + `DialogContent size="sm|md|lg|xl|full|fit"` (vaikimisi `md`): sm 440, md 640, lg 840,
  xl 1240, full min(1600px, 96vw), fit sisu järgi. `fillHeight` annab fikseeritud kõrguse, `layer="alert"` z-5000.
- Sulgemine: Esc sulgeb alati; taustaklõps sulgeb ainult `closeOnOutsideClick` (kinnitus/teade) korral;
  `dismissible={false}` keelab mõlemad (sundparool, salvestamine käib).
- Vorm sisu juurena: `<DialogContent><DialogForm onSubmit>päis, keha, jalus</DialogForm></DialogContent>`.
- `DialogHeader icon title description` (+ lisanupud lastena; `showClose={false}` peidab sulgemisnupu).
- Päise ikoon on alati roheline (`dialogHeaderIconClass`); vaade annab ainult ikooni, värvi (`className`) mitte.
- Hüpikud (kuupäev, otsinguga valik) portaali `usePopupContainer()` elementi, mitte `document.body`-sse.
- Üleminek: `modal-backdrop`/`modal-content` -> `Dialog`/`DialogContent`; `modal-header` -> `DialogHeader`;
  `modal-body`/`modal-footer` -> `DialogBody`/`DialogFooter`; Esc-kuulaja, taustaklõps, `createPortal`, `sub-modal`
  eemaldada (alamaken on oma `<Dialog>`). Vaates Tailwindi klasse ei lisata.

## Tabel

Vaates ei ole toorest `<table>`-it: kasuta `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`,
`TableCell`, `TableEmpty` (import `./ui` kaudu). Päis kleepub tabeli enda kerimisalas (vt allpool); numbrid paremale (`numeric`), kogused vormindab
kutsuja (`formatQty`). `<table>` kannab `data-slot="table"`; tabeli sisu stiili annavad variants.ts konstandid (`cellSubClass`, `tableMutedClass` jt).

| Komponent | Prop'id |
| --- | --- |
| `Table` | `scroll`: `x` (vaikimisi) / `none` / `sm` (40vh) / `md` (62vh) / `fill` (täislehe paneel); `bordered`; `dense`; `containerClassName` (ümbrisele); `className` (`<table>`-ile) |
| `TableFooter` | `sticky` (jalus kleepub alla) |
| `TableRow` | `selected` (valitud rida: hele roheline toon + roheline riba vasakus servas); `tone`: `success` / `warning` / `muted` (mitteaktiivne) / `group` (vahepealkiri) / `total`; `onClick` annab kursori, Tab-fookuse ja Enter/tühiku (sama klõps); rea sees olev nupp/link ei aktiveeri rida |
| `TableHead` | `numeric`; `pin`: `start` / `end`; `actions` (tegevuste veerg); `sort`: `asc` / `desc` / `none` (+ `aria-sort`, ikoon kutsuja) |
| `TableCell` | `numeric`; `wrap` (murdub, vaikimisi ei murdu); `pin`; `actions` (kleepub paremale, nupud keskel reas) |
| `TableEmpty` | `colSpan` = veergude arv; `children` = tühja tabeli tekst |

Märkused:

- **Millal päis kleepub:** ainult kõrgusega piiratud ümbrises (`sm` / `md`, või `fill`, mille vanem on flex-veerg).
  Variandiga `x` / `none` päis välise kerija vastu ei kleepu.
- **Kinnitatud (`pin`) ja tegevuste (`actions`) lahter** hoiab läbipaistmatut tausta ega võta rea tooni värvi
  (`tone`, `selected`).

## Märk, sakk, valikurida

- **`Badge`**: `tone` success / info / warning / danger / accent / neutral (vaikimisi neutral); `variant` soft (vaikimisi) /
  solid (täisvärv, ainult rõhutatud olekutele: lõpetatud, kinnitatud, aktiivne, ootel arv) / outline; `size` sm (11px) / md (12px);
  `dot` = olekupunkt (`dot="#e11d48"` = punkti värv andmetest). Andmevärv (nt kultuur) ainult punktina, mitte märgi taustana.
  Toonid: success = tehtud/aktiivne/oma, info = plaanis/renditud, warning = ootel/kontrolli, danger = viga/puudus, neutral = muu.
  Meta-objekti tüüp: `BadgeTone`.
- **`Tabs`** (`variant="line"`): ainult paneeli vahetavad sakid. `TabsContent` on valikuline — kui paneeli paigutus sõltub
  otsesest flex-lapsest, jäta tingimuslik renderdus ja kasuta ainult `TabsList` + `TabsTrigger`. Loendur = `<Badge>` lapsena.
- **`ToggleGroup`** + `ToggleGroupItem`: aasta valik, filtrid, vormi valik (paneel ei vahetu). `value` on string,
  `onValueChange` ei anna kunagi tühja väärtust. `aria-label` on kohustuslik. Rida murdub, üks hall raam.
- **Peamenüü/navigatsioonirida:** `NavSwitch` + `NavSwitchItem current` (`aria-current="page"`, aktiivne heledam roheline `--selection-bg`); sakid ja valikurida (Tabs/ToggleGroup) on sisu sees vahetamiseks, mitte vaadete vahetamiseks.

## Filtririba ja tühi olek

`<FilterBar actions={…}>` + `<FilterBarItem width="sm|md|lg">` (152/180/200px) registrite filtritele; „Filtrid:“ silt tuleb komponendist.
`<EmptyState icon title description />` tühjale registrile ja laadimisele (ainult `description`).

## Tailwindi skaneerimine

Tailwind genereerib utiliite kataloogist `src/components/ui` ja neist vaatefailidest, mis on `src/styles/app.css`-is fail-faili haaval `@source`-is (praegu `FinanceModal.tsx`, `FieldWorksBoard.tsx`, `FieldWorkPlanForm.tsx`, `ArticleFormDialog.tsx`, `TripRegister.tsx`, `TripGapReviewDialog.tsx`, `TripRouteView.tsx`, `TripDialog.tsx`, `DeviceAssignmentRegister.tsx`, `VehicleTracker.tsx`, `MapYearSelector.tsx`, `LayerControl.tsx`, `SatellitePanel.tsx`, `MapView.tsx`, `CultivationControl.tsx`, 4e dialoogid: `RelatedPartiesModal.tsx`, `PoiManagerModal.tsx`, `FieldManagerModal.tsx`, `FieldShapeModal.tsx`, `CropRegisterModal.tsx`, `SeasonManagerModal.tsx`, `FieldWorkEntryDialog.tsx`, `PriaLinesEditor.tsx`, `AddFieldWorkDialog.tsx`, `FieldEditDialog.tsx`, `FieldUploadModal.tsx`, `SoilSamplesSection.tsx`, `WeatherSeasonSection.tsx`, `ConfirmDialog.tsx`, `AuthGate.tsx`, 4f: päis, menüüd, tugipaneel, Põllud, Ilm, Laoarvestus ja kogu `src/admin` (kataloogina `../admin`), `App.tsx`, `Header.tsx`, `UserMenu.tsx`, `OperatorSelector.tsx`, `LicenseBanner.tsx`, `SupportAccessPanel.tsx`, `FieldsTableView.tsx`, `WeatherView.tsx`, `ArticlesView.tsx`, `StockDocumentDialog.tsx`, `HarvestLotDialog.tsx` jt; täielik loend on `app.css`-is).
Audit-rida „Tailwindi klasse ilma @source-ita“ valvab, et vaatefail, mille klassides on utiliite, oleks `@source`-is (ajutised erandid: `SOURCE_GUARD_ALLOWED` `src/tooling/uiAudit.ts`-is).
Üleviidud fail lisa `app.css`-i `@source`-i; enne kontrolli, et failis pole vanu klassinimesid, mis kattuvad
Tailwindi utiliitidega (nt `text-muted`, `text-secondary`, `hidden`, `flex`) — muidu saavad need ootamatu stiili.

Etapis 4 (2026-11-17) lisatakse vaated `@source`-i faili kaupa (samas commitis, kus klassid üle viiakse); `FinanceModal.tsx` on esimene. Enne kontrolli `python3 scripts/css-utils.py diff` (vt `app.css` kommentaar): surnud klassid (`text-xs`, `text-subtle`, kui CSS-i polnud) hakkavad mõjuma.

## Ülevaate komponendid

Etapp 4.1 asendas vaadete korduvad ülevaatemustrid viie komponendiga. Vanu klasse (`fullpage-board-header`, `form-sub-header`,
`trip-tile*`, `finance-kpi-*`, `soil-legend-*`, `fmc-row` jne) ei tehta uuesti: `npm run ui-audit` rida „Vanu ülevaateklasse (tsx)“ peab olema 0.

| Komponent | Kasutus | Peamised propsid |
|---|---|---|
| `PageHeader` | Vaate päis: ikoon, pealkiri (h2), alapealkiri, tegevused paremal | `icon`, `title`, `subtitle`, `actions` |
| `SectionTitle` | Jaotise pealkiri (väike suurtäheline, 600) vormis ja paneelis | `ruled` (joon all), `spaced` (vahe all) |
| `StatTile` | Näitaja plaat: silt, suur number, ühik, lisarida, selgitus | `label`, `value`, `unit`, `sub`, `note`, `tone`, `empty` |
| `LegendItem` | Legendi kirje: värvimärk (andmevärv), nimi, väärtus, märkus | `color`, `label`, `value`, `note` |
| `KeyValueRow` | Rida „silt … väärtus“, väärtus paremal servas | `label`, lapsed = väärtus |
| `IconBox` | Ikoon/emoji ruudus (registri lahter, kaardi päis, masina avatar) | `size` sm/md/lg, `tone` neutral/info/success/warning; md äär `style.borderColor` |

### Abiklassid ja komponendid, mis tulid tahvlist (etapp 4b)

| Nimi | Kasuta | Vana klass |
| --- | --- | --- |
| `<ProgressBar value aria-label>` | edenemisriba 0–100% (laius on dünaamiline; `clampPercent`) | `work-progress-bar` |
| `cornerActionClass` (`wrapperClassName`) | nurgas olev tegevusnupp, vanem `relative` | `fw-field-shape-corner` |
| `leading-natural` | tekstielemendi rea kõrgus „nagu varem“ (UA `normal`) | `leading-[normal]` |
| `warning-solid`, `sky`, `sky-text` | tahke oranž `#f59e0b` ja taevasinine `#0284c7` tahvli toonidele (`bg-warning-solid/8`, `bg-sky/10`); `sky-text` on taevasinine tekst (heledas `#0369a1`, tumedas `#38bdf8`) | `rgba(245,158,11,…)`, `#0284c7` |

Props-nimi nimele/sildile on kõigil kolmel plaadil/real sama: `label` (`StatTile`, `LegendItem`, `KeyValueRow`; viimasel on väärtus lapsena). `StatTone` (`default | cost | revenue | profit | loss`) on finantsi domeeni toon (kulu/tulu/kasum); teistes vaadetes ära kasuta, vali `Badge` toon või tavaline tekstivärv.

### Tehnika ja sõitude abiklassid (etapp 4c)

| Nimi | Kasuta | Vana klass |
| --- | --- | --- |
| `<IconBox size tone>` | ikoon/emoji ruudus (registri lahter, kaardi päis, masina avatar) | `fleet-icon-box`, `imp-icon-wrap`, `dev-icon-wrap`, `v-avatar` |
| `<FormGrid stackNarrow>` | kaks veergu, kitsal ekraanil (≤ 560px) üks | `fleet-form-grid` |
| `cardGridClass` | kaartide ruudustik (≥ 360px veerud) | `vehicle-grid`, `implements-grid`, `devices-grid` |
| `registerSectionClass` | registri sektsioon (filtririba + tabel), täidab lehe | `implement-history-section` |
| `fleetCell*Class`, `fleetDurationClass`, `fleetNotesClass` | haakimiste/seoste registri lahtrid | `fleet-cell-*` |
| `dateTimeRowClass`, `dateTimeHintClass` | kuupäev + kellaaeg + vihje | `assign-datetime`, `assign-hint` |
| `bg-/text-/border-l-fresh-*`, `bg-trip-*` | seadme värskus, sõidu ajajaotus (teemapõhised) | `fresh-*`, `--trip-*` `.trip-dialog` all |

`PoiManagerModal` ja `RelatedPartiesModal` (Isikud, Taristu) kasutavad `cardGridClass` + `IconBox size="md"` + `infoCard*` konstante (vt 4e tabel). `.v-name` jääb ainult MapMarkers HTML-stringi jaoks.

### Kaardi paneelide abiklassid (etapp 4d)

| Nimi | Kasuta | Vana klass |
| --- | --- | --- |
| `mapPanelTitleClass` | kaardi ujuvpaneeli pealkirjarida (ikoon + 14px poolpaks) | `layer-header-title`, `year-widget-title` |
| `loadingSpinnerClass`, `loadingSpinnerInlineClass` | Loader2 roheline spinner (+ 6px vahe) | `layer-loading-spinner`, `cc-spin` |
| `LAYER_SWATCH` (`src/lib/dataColors.ts`) | kihi värvimärk kihtide paneelis (`style={{ background }}`) | `fields-color`, `tech-color` jt |
| `<RadioField labelClassName>` | raadionupu rea vahe ja rea kõrgus | `soil-metric-radio-item` |
| `Select`/`Input` `className` | sisemine äärisetu väli ääristatud kastis (`border-0 bg-transparent h-full`) | `.cc-time [data-slot=select] !important` |

Kaardi `Card variant="floating"` paneelidele annab vaade ainult asendi (`absolute`, `z-800`/`z-900`), laiuse ja paigutuse. Konteinerid (`MAP_STACK_CLASS` App.tsx-is) on Tailwindi klassid; CSS-i jäävad nende polster (`.map-top-left-stack`, `.map-top-right-stack`: 44/56/40px pole skaalas), `.cc-range`, `.layer-loading-bar::after`, `.crop-legend-item[data-selected]`, `.add-poi-banner` (põhjused kommentaarides).

### Dialoogide ja registrite abiklassid (etapp 4e)

| Nimi | Kasuta | Vana klass |
| --- | --- | --- |
| `<Alert tone size>` | teatekast (error/success/info/warning/neutral; `size="sm"`) | `alert-box` (+ `.error`, `.is-compact`) |
| `infoNoticeClass` | `Alert size="sm"` peal: hele sinine info-teade (kande dialoog, PRIA read) | `work-entry-warning` |
| `cellSubClass`, `cellSubStackedClass` | tabelilahtri/kaardi alamrida (11px, hallim) | `cell-sub`, `fleetCellSubClass` |
| `infoCardClass`, `infoCardTitleWrapClass`, `infoCardNameClass`, `infoCardSubClass`, `infoRowsClass`, `infoRowClass` | registrikaart avatariga (Isikud, Taristu) | `vehicle-card`, `v-*` |
| `tableNameClass`, `tableTitleLineClass`, `tableSubTagsClass`, `tableMutedClass` | tabeli nimelahter ja summutatud tekst | `field-name`, `field-title-line`, `field-sub-tags`, `muted` |
| `dialogStackBodyClass`, `workFormGridClass`, `workFormSectionClass`, `workFormHintClass` | töö kande ja plaani vormi kere, ruudustik, jaotis, vihje | `work-entry-*`, `add-work-body` |
| `soilValueClass`, `soilFootnoteClass`, `soilYearCellClass` | mulla väärtus (`data-level`), joonealune märkus, aasta lahter | `soil-value`, `soil-footnote`, `soil-year-cell` |

Kustutatud klasside valvur: `RETIRED_4E`, `RETIRED_4F` ja `RETIRED_4G` failis `src/tooling/uiAudit.ts` (ui-audit rida „Vanu ülevaateklasse (tsx)“ peab olema 0).

CSS-i jäävad (põhjused kommentaarides): `.year-col(.selected) .year-col-label`, `.year-cell.has-crop/.selected` (Külvikorra aastaveerud), `.login-notice` (login-kaardi palett).

### Päise, kesta ja väikeste vaadete abiklassid (etapp 4f)

| Nimi | Kasuta | Vana klass |
| --- | --- | --- |
| `<Dropzone dragging hasFile>` | faili lohistamise kast (3 üleslaadimise modaali); `role="button"`, `tabIndex=0`, Enter/tühik käivitab `onClick`; sisu ja sündmused tulevad vaatest | `dropzone`, `.dragging`, `.has-file` |
| `hintTextClass`, `hintTextBlockClass` | väike hajutatud selgitustekst | `hint-text`, `.is-block` |
| `boardViewClass`, `boardMainClass`, `boardContentClass`, `boardBodyClass`, `boardFooterClass` (= `hintTextClass`) | täislehe vaate kest | `fullpage-board-*` |
| `belowHeaderHeightClass` | akna kõrgus miinus päis (64px = Header `h-16`); `boardViewClass` ja kaardi konteiner | `h-[calc(100vh-64px)]` |
| `headerTriggerClass`, `headerNarrowHiddenClass`, `headerChevronClass` | päise menüünupud (operaator, kasutaja), kitsal ekraanil ainult ikoon | (4f uus) |
| `dialogHeaderControlsClass`, `dialogActionsBarClass` | dialoogi päise juhtnupud ja tegevusriba | (4f uus) |
| `TerisLogo variant="responsive"` | ikoon alla 1280px, täislogo alates 1280px (Tailwindi vaike `xl:`; päise nimede piir on `max-[1656px]`, need on eri piirid) | (4g: kasutaja logo) |
| `collapsedPanelButtonClass` | kaardi ujuvpaneeli (kaardikihid, hooaja paneel) ahendatud 40px ikoonnupp; asukoha annab pakk (`items-start`/`items-end`) | (4g: kasutaja ahendatavad paneelid) |
| `dropzoneStateClass`, `dropzoneIconClass`, `fileReuploadHintClass`, `uploadFormatListClass` | üleslaadimise modaali kasti sisu | `dropzone-*`, `file-reupload-hint` |
| `previewBoxClass`, `previewHeaderClass`, `previewFieldsScrollClass`, `previewFieldRowClass`, `previewFieldClass`, `previewCropClass`, `previewValueClass` | üleslaadimise eelvaade | `preview-*`, `parsed-preview-box` |
| `overuseClass`, `cellBadgeClass`, `cellBadgeLeadClass`, `stockDocUnitClass`, `stockDocQtyClass`, `stockDocAmountClass`, `stockDocFooterRowClass` | laotabeli ja laokande read | `article-overuse`, `cell-badge*`, `stock-doc-*` |
| `loginPageClass`, `loginColumnClass`, `loginCardClass`, `loginLogoClass`, `loginPrimaryButtonClass`, `loginCopyrightClass`, `loginNoticeClass` | sisselogimise ja parooli määramise leht | `login-*` paigutus |
| `registerActionsBarClass`, `registerHeaderControlsClass`, `registerIoButtonsClass`, `searchFieldClass`, `yearSelectorGroupClass`, `yearLabelClass` | registri tööriistariba | `register-*`, `search-field`, `year-*` |
| `detailSectionClass`, `notesTextClass` | Ilma/Mulla lõigud | `detail-section`, `notes-text` |
| `stockQtyClass({ sign })` | laokoguse märk ja värv | `stock-qty(-in/-out)` |
| `adminUi.ts` (ainult admin) | admin kaardid, vormid, vihjed | `admin-*` |

`xl:` (1280px) on ainus murdepunkt, mis ei ole tuletatud vanast `max-width` päringust (`max-[N+1px]`).

Kustutatud klasside valvur: `RETIRED_4F` ja `RETIRED_4G` (`src/tooling/uiAudit.ts`). Nimi lisatakse sinna ainult siis, kui ükski CSS-reegel seda enam ei kasuta.

CSS-i jäävad (põhjused kommentaarides): login-kaardi palett ja `@keyframes login-*`, `.year-col`/`.year-cell` (Külvikord), `.help-content`, Leaflet ja HTML-string klassid (`MapMarkers.ts`, `MapView`), admin kasutab brändisõnale `.login-brand-word`, teemamuutujad ja põhireeglid (4g).

## CSS-failid ja kihid (etapp 4g)

Kujundus on Tailwindi klassides (`ui/` + vaated). CSS-i jääb ainult see, mis peab seal olema (spec „Mis jääb CSS-i“).
Uut CSS-reeglit ei lisata, kui utiliit või `ui/variants.ts` konstant seda annab; kui lisad, vali fail alt.

| Fail (`src/styles/`) | Kiht | Sisu | Miks CSS-is |
| --- | --- | --- | --- |
| `themes.css` | `theme` | hele/tume teema muutujad (`:root`, `[data-theme="dark"]`) — ÜKS allikas | teemamuutujad |
| `base.css` | `base` | `*` lähtestus, `button`, `body`, vormielementide font | põhireeglid (preflight asendaja) |
| `login.css` | `exceptions` | login palett, `@keyframes login-*`, `!important` ülekirjutused | erand: fotol taustal oma värvid |
| `rotation.css` | `exceptions` | Külvikorra aastaveerud (`th.year-col`, `td.year-cell`) | keerulised kaudsed valijad |
| `help-content.css` | `exceptions` | `.help-content` rikastekst | HTML sisu, järglasvalijad |
| `map.css` | `exceptions` | Leaflet, hüpikud, märgised, sildid, `@keyframes`, `.v-name`, `.status-*` | HTML-string väljaspool Reacti |
| `app.css` | — | `@layer`, `@import`id, `@source`id, `@theme`, `@utility`id | sisenemispunkt |

Kihid: `theme < base < exceptions < vendor < components < utilities`. `!important` puhul võidab VARASEM kiht (seepärast
login/rotation/map `!important` reeglid võidavad utiliite). Admin ega landing ei kasuta kihita CSS-i (landing on eraldi
leht oma `landing.css`-iga). Valvur: `src/tooling/stylesLayout.test.ts` (failide ja kihtide jaotus, `index.css`/`admin.css`
ei tule tagasi, ≤ 1000 rida kokku, `:root` ainult `themes.css`-is, `*`/`body` ainult `base.css`-is).

Murdepunktid: vana `@media (max-width: N)` = `max-[N+1px]`, konteineripäring `@max-[N+1px]`; ainus uus murdepunkt on `xl:`
(1280px, ainult `TerisLogo`). Valvur: `offByOneBreakpoints` (ui-audit „Murdepunkte ilma +1-ta“).

## Vana muutuja -> Tailwindi nimi

HOIATUS: vanad klassi- ja muutujanimed `text-muted` / `text-secondary` EI tähenda Tailwindi `text-muted` /
`text-secondary` utiliite. Tailwindi `text-muted` on taust (`--stat-bg`), mitte hall tekst. Hall abitekst on
`text-muted-foreground` või `text-subtle`.

| Muutuja (`src/styles/themes.css`) | Tailwindi nimi | Kasutus |
| --- | --- | --- |
| `--bg-dark` | `bg-background` | lehe taust |
| `--text-primary` | `text-foreground` | põhitekst |
| `--bg-surface` | `bg-card` | kaart (tahke; `--bg-card` kustus 4g-s) |
| `--bg-surface-hover` | `bg-card-hover` | kaardi hover (tahke) |
| `--bg-modal` | `bg-popover` | dialoog, menüü, hüpik |
| `--stat-bg` | `bg-muted` | vaikne taust, tabeli hover |
| `--stat-bg-hover` | `bg-muted-hover` | vaikse tausta hover |
| `--text-secondary` | `text-muted-foreground` | abitekst, päised |
| `--text-muted` | `text-subtle` | kõige hallim tekst, placeholder |
| `--border-card` | `border-border` | kaardi/tabeli joon |
| `--input-border` | `border-input` | välja ääris |
| `--input-bg` | `bg-field` | välja taust |
| `--btn-sec-bg` | `bg-secondary` | teisene nupp |
| `--btn-sec-hover` | `bg-secondary-hover` | teisene nupp hover |
| `--btn-sec-border` | `border-secondary-border` | teisene nupp ääris |
| `--emerald-500` | `text-primary` / `bg-primary` | põhivärv |
| `--emerald-600` | `bg-primary-strong` | põhivärv tugevam |
| `--blue-500` | `text-info` | info |
| `--amber-500` | `text-warning` | hoiatus |
| `--rose-500` | `text-destructive` | viga |
| `--purple-500` | `text-accent` | rõhk (PRIA) |
| `--tone-success-text` … `--tone-accent-text` | `text-success-text` … `text-accent-text` | soft märgi ja olekuteksti toon |
| `--tone-info-solid` / `--tone-accent-solid` | `bg-info-solid` / `bg-accent-solid` | solid märgi taust (valge tekst) |
| `--on-warning` | `text-on-warning` | hoiatuse solid märgi tekst (heledas valge, tumedas tume) |
| `--shadow-glass` | `shadow-card` | kaardi vari |
| `--shadow-modal` | `shadow-dialog` | dialoogi vari |

Muutujaid, mida loevad Leaflet, login, `dataColors.ts` ja tsx style-stringid, ei nimetata ümber; nimekiri on `themes.css` päises.

Kindlad värvid: `white`, `black`, `danger-solid` (#dc2626), `primary-from` / `primary-to` = `#166534` / `#15803d` (põhinupu gradient),
`overlay` (dialoogi taust).

## Kontrast

Tekst ≥ 4.5:1 mõlemas teemas; `src/tooling/contrast.test.ts` arvutab tokenitest. Tekstina värvilist tooni (`text-primary`, `text-warning`…) kasuta ainult siis, kui test seda paari katab; olekutekst = `text-*-text`. Uue värvi lisamisel lisa paar testi.

**Toored `<button` on keelatud** väljaspool `ui/` (ui-audit „Tooreid nuppe“ = 0). Erandid: `LoginPage` `login-forgot-link`, `MapView` Leafleti popup-string (`RAW_BUTTON_ALLOWED` failis `src/tooling/uiAudit.ts`).

## Nupud: vana → uus

**Ikoonnupu suurused (kasutaja otsus 2026-11-16):** `icon-xs` 20px tabelis/kaardi nurgas, `icon-sm` 28px tööriistaribal ja päises, `icon-lg` 40px esitusnupp (ümmargune). Muud suurust ei lisata.

`wrapperClassName`: asetusklassid (margin, flex-shrink jms) ikoonnupul, mille ümber on vihje (tooltipi ümbris); vihjeta nupul lähevad need nupule endale.

Üldnupud on ainult `<Button>` (`./ui`). Vanad klassid `btn*`, `icon-btn*` tuleb asendada; `npm run ui-audit` loeb neid kohti.

| Vana | Uus |
| --- | --- |
| `<button className="btn btn-primary">` | `<Button variant="primary">` |
| `btn btn-secondary` | `<Button>` (vaikimisi `secondary`, `md`) |
| `btn btn-ghost` | `<Button variant="ghost">` |
| `btn btn-danger` | `<Button variant="danger">` |
| `+ btn-sm` või `+ btn-xs` | `size="sm"` |
| `btn btn-secondary btn-icon-only` | `<Button size="icon-sm">` (oli `icon`) |
| `icon-btn-ghost`, `icon-btn` | `<Button variant="ghost" size="icon-sm">` |
| `icon-btn-danger` | `<Button variant="danger-ghost" size="icon-sm">` |
| `icon-btn-ghost-sm` | `<Button variant="ghost" size="icon-xs">` |
| `icon-toggle` | `<Button variant="ghost" size="icon-xs">` |
| `mini-swap-btn`, `v-action-btn` | `<Button size="xs">` |
| `cc-play` (esitusnupp) | `<Button variant="primary" size="icon-lg">` |
| valitud olek (`.active`) | `aria-pressed={…}` (mitte `.active`), ghost/secondary näitab rohelist tooni |
| `` `btn btn-sm ${c ? 'btn-primary' : 'btn-secondary'}` `` | `variant={c ? 'primary' : 'secondary'} size="sm"` |
| `` `btn btn-secondary ${c ? 'active' : ''}` `` | `<Button>`; `active` jäetakse ära, üldnupul pole `.active` reeglit |
| `link-button`, `assign-hint-link` | `<Button variant="link" size="inline">` |
| `fw-add` (tühja lahtri „+“) | `<Button variant="dashed" size="add-slot">` |
| klõpsatav märk nupuna (`fw-finance-chip-btn`) | `<Button variant="bare" size="inline">` |
| tekstilink kahe reaga (`trip-dialog-entry`) | `<Button variant="text" size="inline">` |
| kogu rea klõpsatav `div` (grupipäis, valikurida, märkus; välimus vaate CSS-ist) | `<Button variant="plain" size="inline" className="vaate-klass">`; nupp annab ainult lähtestuse (laius 100%, ei ääri, tausta, kirja ja värvi pärib). Vaate reegel, mis seab polstri, tausta, äärise, nurga, gapi, `display`, `justify-content`, `font-size`, `color`, vajab `!important` |
| kultuuri-/omandivormikiip (`register-crop-stat`, `reg-stat-pill.is-filter`) | `<ChipButton variant="tint" \| "outline" accent selected dimmed>` (värv andmest, valitud = `selected`) |
| `btn-full` | `className="w-full"` |

Reeglid:

1. **`type`:** `Button` paneb vaikimisi `type="button"`. Vormi sees olev nupp, mis vajab saatmist, saab `type="submit"`.
2. Muud atribuudid (`onClick`, `disabled`, `title`, `aria-*`, `ref`, `style`, `key`, `form`) jäävad muutmata.
3. Vaatepõhine modifikaator (nt `fw-crop-delete-btn`) jääb alles. Kui vana reegel kannab tähendust (olek, hoiatusvärv),
   lisa reeglile `!important`. Muidu kaovad Buttoni omadused (padding, kõrgus, kirjasuurus, värv, taust, nurk) ja see
   on ühtlustamise eesmärk.

## Kaart

- `<Card>` — tahke kaart (kasutaja otsus 2026-11-15: klaasi ja `backdrop-filter`-it ei kasutata kusagil).
  - `variant`: `surface` (vaikimisi; lehe- ja registrikaart, 16px, `shadow-card`), `floating` (kaardi peal ujuv paneel,
    16px, tugevam vari `shadow-dialog`), `tile` (sisemine plaat kaardi/dialoogi sees: KPI, sektsioon, loendikirje; 10px,
    `bg-muted`, varjuta).
  - `padding`: `md` 16px (vaikimisi), `sm` 12px, `none` (klassi ei anta — vaate CSS-i polster kehtib, nt väike kaardinäit).
  - `interactive` (kursor, tahke hover) ja `selected` (roheline ääris + rõngas; hover seda ei nõrgenda). `<button>`-kaardi font/text-align/värv tuleb `src/styles/base.css`-ist (`button[data-slot="card"]`), nii et vaate klassi kirjasuurus kehtib.
  - `interactive` + `onClick` div-kaardil annab `role="button"`, Tab-fookuse ja Enter/tühiku.
  - `asChild`: `<Card asChild><form>…</form></Card>`, samuti `<section>`. Klõpsatavat nuppu `Card asChild` + `<button>` abil ei tehta, selleks on `CardButton`.
- `<CardButton>` — valitav kaart nupuna (kogu kaart on klõpsatav; `type="button"`, `interactive` alati sees). `variant`: `tile` (loendikirje),
  `item` (tahvlikaart, 6px, `bg-popover`; hõljudes täisroheline ääris), `option` (valikurida, 10px, `bg-popover`; hõljudes õrn roheline ääris);
  `padding="none"` korral tuleb polster vaate CSS-ist. `selected` = roheline ääris + rõngas. Vaate olekuäärised (staatus, valitud toon) `!important`-iga.
- Kaart ei sea teksti värvi (pärib), v.a `interactive`.
- Päis: `CardHeader` (`align="center|start"`), `CardTitle` (`as="h2|h3|h4"`, vaikimisi h3), `CardActions` (paremale).
  `Panel` = kaart + päis äärisega + sisu.
- Vaate klass kaardil annab **asetuse, kirjasuuruse ja tekstivärvi** (position, z-index, flex, gap, margin, font-size, color); polstri ainult
  `padding="none"` korral. Välimuse (taust, ääris, nurk, vari, polster) annab `Card`. Vaate olekureegel, mis peab `Card`-i üle võitma (staatuse
  ääris, toonitud taust, erandnurk), vajab `!important` (`login.css`, `rotation.css`, `help-content.css` ja `map.css` on kihis `exceptions`; `themes.css` on kihis `theme`, `base.css` kihis `base`).
  Kihita (unlayered) CSS-i enam pole: `admin.css` kustus 4g-s.
- Vana `.glass-card` on kustutatud (etapp 2.7); uut klaasikaarti ei tehta.
- `npm run ui-audit` rida „Vanu kaarte“ peab olema 0.
- Erandid (jäävad oma CSS-iga): `login-card`. Märgid/valikud (`cc-stat`; `reg-stat-pill` ja `register-crop-stat` kiibid saavad `ChipButton`, Task 3) ja Leafleti hüpikud ei ole kaardid; `detailSectionClass` ja admini `adminSubpanelClass`/`adminToolbarClass`/`adminCardFootClass` kannavad ainult asetust.

## Menüüd, hüpikud, vihjed

- `DropdownMenuContent`, `ContextMenuContent`, `PopoverContent` ja `Tooltip` portaalivad avatud dialoogi sisse (`usePopupContainer`) ja Esc sulgeb ainult nemad (ei levi taha). Menüü ja `PopoverContent` kõrgus piirdub vaba ruuminga ja kerib (Tooltipil piirangut pole — hoia tekst lühike).
- Kirjel ikoon: pane `<Icon />` ilma suuruseta (16px tuleb menüüst). Kahe rea kirje: `<DropdownMenuItem className="items-start"><MenuItemText title description /></DropdownMenuItem>`.
- Märkeruudu kirje `DropdownMenuCheckboxItem`: menüü jääb avatuks, kui annad `onSelect={(e) => e.preventDefault()}`.
- `PopoverAnchor` seab hüpiku asukoha muu elemendi külge.
- Abi-ikoon: `<HelpHint helpKey="…" />` (`ui/HelpHint.tsx`); `inline` kui ikoon on teise nupu sees. Tühja juhendi korral ikooni ei ole. `HelpHintPopover` on sama ilma teenuseta (galerii).
- Päästik: `Trigger` alati `asChild` + `Button` (toores `<button>` jääks preflight'i puudumisel halliks brauserinupuks).
- `collisionPadding` on menüüdel, `PopoverContent`-il ja `Tooltip`-il 8 (Select, DateInput ja FilterSelect kasutavad Radixi vaikimisi väärtust) (ekraani serva ei puudutata); ära kirjuta üle.
- Vihje: ainult tekstita ikoonnuppudele. `<Button size="icon-sm" title="…">` saab rakenduse vihje automaatselt ja on alati `<span>`-ga ümbritsetud (keelatud nupp ei kaota fookust ega vihjet). Kärbitud tekst ja muu `title=` jäävad brauseri omaks.
- `TooltipProvider` peab olema igas React juures (`main.tsx`, `admin/main.tsx` ja kinnitusakna oma juur `ConfirmDialog`); uus juur ilma selleta kukub vihjel.
- Kaardi (Leaflet) hüpikud ja vihjed (`.leaflet-popup-*`, `.leaflet-tooltip`, `.custom-field-tooltip`) loevad värvi `--popup-*` muutujatest, mis viitavad menüüde omadele (`--bg-modal`, `--border-card`, `--text-primary`). Muuda värvi seal, mitte reeglites.
- `<Button variant="filter" size="auto">` — päise rohelise pillina nupp (operaatorivalija).
- Portaalis sisu tunneb ära `closest('[data-radix-popper-content-wrapper], [role="listbox"]')`.

## Admin

Teenusepakkuja admin (`src/admin`) kasutab samu ui komponente. `admin.css` kustus 4g-s: admini paigutus on Tailwindi klassides (`adminUi.ts` ja vaated), kihita CSS-i pole. ui-audit mõõdab admini koos rakendusega; landing on eraldi read.
