# Menüüde ja hüpikute inventuur (2026-11-15) — etapi 2.6 lähteandmed

Kaardistatud failidest `src/` (v.a `src/admin`, `src/landing` ja `src/components/ui`), serveris `grep`, `sed` ja TypeScripti AST-iga (`title=` atribuudid). Read-numbrid on serveri HEAD `d6c8561` järgi. Midagi ei ole muudetud ega brauseris proovitud: kõik "võib katki minna" väited on koodist järeldatud ja märgitud riskina, mitte kontrollitud veana.

**Peamine järeldus:**
- `ui/Menu.tsx` (`DropdownMenu`, `ContextMenu`) ja `ui/Popover.tsx` (`Popover`, `Tooltip`) on olemas, aga rakenduses **ei kasuta neid keegi** (esinemisi väljaspool `ui/` ja `src/admin`-it: 0; ainus kasutus on `/ui` galerii `UiGallery.tsx:245–268`).
- Käsitsi tehtud hüpikuid on **4 komponenti** (`UserMenu`, `OperatorSelector`, `FieldContextMenu`, `HelpHint`): 52 klassi-/rolliesinemist tsx-is, 37 erinevat klassinime ja ~46 CSS-reeglit. Spec (rida 106) nimetas "17 menu klassi", tegelikult on 12 + 12 + 7 + 6.
- Ükski neist ei kasuta positsioneerimiseks teeki, kõik sulgevad end ise `pointerdown`/`mousedown` + Esc kuulajatega ja ükski ei toeta nooleklahve.
- `title=` vihjeid on **249** (ilma `DialogHeader title`-ita, mis on pealkiri).
- Leafleti vihjeid/hüpikuid on 6 `bindTooltip` + 2 `bindPopup` kohta; need jäävad `ui/` ulatusest välja.
- `ui/` menüü/hüpiku puudused: märkeruudu kirje, kerimine pikal loendil, kahe rea kirje, `usePopupContainer`, Esc-i leviku peatamine (`ui/Select.tsx:60` teeb seda, `Menu`/`Popover` mitte), hõljumisega avamine, virtuaalne ankur.

## 1. Käsitsi tehtud menüüd, hüpikud ja ujuvpaneelid

`createPortal` väljaspool `ui/`: `FieldContextMenu.tsx:84`, `HelpHint.tsx:132`, `SatellitePanel.tsx:476` (viimane on kaardi paneelipinu host, mitte hüpik). `ui/`-s: `DateInput.tsx:299` ja `FilterSelect.tsx:199`, mõlemad `usePopupContainer()`-iga ja mõlemad kasutavad `menuContentClass` + `menuItemClass`.

### 1.1 `UserMenu` (`src/components/UserMenu.tsx`, 124 rida)

| Omadus | Väärtus |
|---|---|
| Kasutus | 1 koht: `Header.tsx:199` (import `:16`) |
| Trigger | `<button className="user-menu-trigger">` (`:58–68`): ikoon, nimi, `ChevronDown`; `aria-haspopup="menu"`, `aria-expanded`. Kõrval eraldi `Button size="icon"` "Logi välja" (`:70`, `title="Logi välja"`) |
| Positsioneerimine | Oma CSS: `.user-menu-dropdown {position:absolute; top:calc(100% + 8px); right:0}` (`index.css:4911`). Äärte kontrolli ega üles pööramist pole. Hüpik asub DOM-is triggeri kõrval (mitte portaalis), `.app-header` sees |
| Sulgemine | `useEffect` `:35–49`: `document` `pointerdown` (`:43`) sulgeb, kui `rootRef.contains(target)` on false; `keydown` Esc (`:41`). Portaali sisu (`closest`) ei kontrolli, praegu pole vaja. Esc-i levi ei peata |
| Klaviatuur | Ainult Tab/Enter (natiivsed nupud). Nooleklahve, fookuse viimist menüüsse ega fookuse tagastust triggerile pole, kuigi `role="menu"`/`menuitem` seda lubaks |
| z-index | `2000` (`index.css:4919`); `.app-header` ise `1000` (`:152`) |
| Klassid | 12 nime (vt 2.1) + `glass-card` (`index.css:131`) + `animate-scale-up` (`:3055`) |
| Sisu | Info plokk (nimi, kasutajanimi, ettevõte), 4 tingimuslikku kirjet (parool, AI ühendus, kasutajad, ilmaandmete ühendus), teema vahetus (`Sun` ikoon `text-amber-400` `:107`), jalus (versioon, autoriõigus, andmebaasi punkt, `title="PostgreSQL andmebaas"` `:114`) |
| Ui sihtkomponent | `DropdownMenu` (+ `DropdownMenuLabel`, `DropdownMenuSeparator`) |
| Mis ei sobi | (a) Info ja jalus ei ole kirjed: vaja vabasisulist plokki menüü sees (`DropdownMenuLabel` on suur-tähtede stiilis, ei sobi). (b) Andmebaasi roheline punkt `#10b981` hõõgumisega (`index.css:4987`) vajab Tailwindi nime (`bg-primary` + `shadow`). (c) Trigger on kohandatud nupp: sobib `Button variant="ghost"` + `ChevronDown` (pöörlemine `data-[state=open]`) |

### 1.2 `OperatorSelector` (`src/components/OperatorSelector.tsx`, 85 rida)

| Omadus | Väärtus |
|---|---|
| Kasutus | 1 koht: `Header.tsx:195` (import `:17`) |
| Trigger | `<button className="operator-selector-trigger">` (`:171–186`): roheline pillinupp, ikoon, kaks rida teksti (pealdis "Operaator" + väärtus), kollane punkt kui filter aktiivne, `ChevronDown` pöörleb `[aria-expanded="true"]` järgi. `aria-haspopup="listbox"`. `title` = valitute nimed või abitekst (`:177`) |
| Positsioneerimine | Oma CSS: `.operator-selector-dropdown {position:absolute; top:calc(100% + 8px); right:0; max-height:60vh; overflow-y:auto}` (`index.css:256`) |
| Sulgemine | Sama `useEffect` mis `UserMenu`-l (`:140–154`): `pointerdown` väljaspool + Esc. Mitmikvalik: valik **ei sulge** menüüd |
| Klaviatuur | Ainult Tab/Enter. `role="listbox"` + `option` + `aria-multiselectable`, nooli ei toeta; "Kõik operaatorid" nupul `role` puudub (`:190`) |
| z-index | `2000` (`index.css:269`) |
| Klassid | 12 nime (vt 2.2) + `animate-scale-up` |
| Sisu | "Kõik operaatorid" (nullib valiku) + eraldaja + operaatorite loend (`roles.includes('OPERATOR')` või juba valitud) + tühja oleku tekst. Märkeruut on käsitsi tehtud 16px kast (`.operator-selector-check`) `Check` ikooniga |
| Ui sihtkomponent | `DropdownMenu` märkeruudu kirjetega (vaja lisada `DropdownMenuCheckboxItem`; `onSelect={(e) => e.preventDefault()}` hoiab menüü lahti). Alternatiiv: `Popover` + `CheckboxField` loend. Soovitus: `DropdownMenuCheckboxItem` |
| Mis ei sobi | (a) `ui/Menu.tsx`-is märkeruudu kirjet pole. (b) Trigger on rohelise varjuga pillinupp (`#15803d`, `index.css:195`), mida ükski `Button` variant ei kata. (c) Tekst `max-width:180px` + ellips. (d) Pikk loend vajab kerimist: `menuContentClass` on `overflow-hidden` ilma `max-h`-ta |

### 1.3 `FieldContextMenu` (`src/components/FieldContextMenu.tsx`, 113 rida)

| Omadus | Väärtus |
|---|---|
| Kasutus | 1 koht: `App.tsx:1974` (lazy import `:64`, olek `fieldMenu`, `key` sisaldab koordinaate). Käivitaja: Leafleti `contextmenu` `MapView.tsx:413–416` annab `{x: clientX, y: clientY}` |
| Trigger | Parem hiireklõps põllul kaardil. **Trigger on Leafleti kihisündmus, mitte DOM-element**: Radix `ContextMenuTrigger` ei sobi |
| Positsioneerimine | Oma kood: `position:fixed` (`index.css:8029`) + `style={{left, top}}`; `useLayoutEffect` (`:50–57`) hoiab menüü 8px ekraani servast sees (kärbib, ei pööra ümber). Portaal `document.body`-sse (`:84`, `:111`) |
| Sulgemine | `useEffect` `:60–69`: `document` `mousedown` **capture** (`:63`) väljaspool sulgeb; `keydown` Esc (`:62`, ilma capture'i ja `stopPropagation`-ita). Kirje valik kutsub `onClose()` (`:81`) |
| Klaviatuur | `role="menu"` + `menuitem`, aga fookust menüüsse ei viida; nooli pole. `onContextMenu preventDefault` (`:85`) keelab brauseri menüü menüü peal |
| z-index | `3000` (`index.css:8030`) |
| Klassid | 7 nime (vt 2.3) |
| Sisu | Põllu päis (nimi, nr, kultuur, ha), silt "Lisa kanne", laadimise/vea/tühja oleku märkus, kirjed = lõpetamata tööd (ikoon `ClipboardPlus` + kaks rida: töö nimi; olek · aeg · saak). Andmed laetakse avamisel (`api.getFieldWorks`, `:41–47`) |
| Ui sihtkomponent | `ContextMenu` **ei sobi otse** (trigger on Leafleti sündmus). Variandid: (A) kontrollitud `DropdownMenu` + nähtamatu fikseeritud trigger koordinaatides; (B) `Popover` virtuaalse ankruga (`PopoverAnchor`). Soovitus: (A), sest annab `role="menu"`, nooleklahvid ja Esc tasuta |
| Mis ei sobi | (a) Leafleti trigger (ülal). (b) Kirjed on kahe reaga, `menuItemClass` on `items-center` (vaja `items-start`). (c) Päis, jaotise silt ja laadimisseis ei ole kirjed. (d) Samal Esc-il sulgub ka `FieldMapCard` (vt 3.3) |

### 1.4 `HelpHint` (`src/components/HelpHint.tsx`, 149 rida)

| Omadus | Väärtus |
|---|---|
| Kasutus | 4 JSX-kohta, kõik `inline`: `FieldManagerModal.tsx:410`, `FieldsTableView.tsx:287, 299, 310` |
| Trigger | Kaks vormi: `<button class="help-hint-btn">` (`:127`) või `<span role="button" tabIndex=0 class="help-hint-btn help-hint-inline">` (`:111`, kui ikoon on teise nupu sees). Ikoon `CircleHelp` 15px. Tekst tuleb `helpStore`-ist (admin.teris.ee "Juhendid"); tühja teksti korral ei renderda midagi (`:82`) |
| Positsioneerimine | Oma kood: `useLayoutEffect` `:41–59` arvutab `position:fixed` + `top/left/width` (nupu all keskel, ekraani sees; alla ei mahu → üles); uuesti arvutus `resize` ja `scroll` (capture) peale. Laius 320px, ääred 8px |
| Portaal | `createPortal(…, usePopupContainer())` (`:132–145`). **Ainus käsitsi tehtud hüpik, mis portaalib õigesti dialoogi sisse** |
| Sulgemine | Hõljumine avab 150ms, sulgeb 200ms viivitusega (`:11–12`); klõps "kinnitab" (`pinned`), uus klõps sulgeb. `window` `keydown` Esc **capture** + `stopPropagation` (`:63–69`: sulgeb ainult vihje, mitte akna); `document` `pointerdown` väljaspool nuppu ja hüpikut sulgeb (`:70–73`). Hõljumine ainult `pointerType === 'mouse'` |
| Klaviatuur | Span-variant: Enter/Space (`:117–122`). Hüpik ei avane fookusel, fookus ei liigu hüpikusse. `aria-expanded`, `aria-label`, hüpikul `role="dialog"` |
| z-index | `3200` (`index.css:7877`) |
| Klassid | 6 klassi + `.help-content` (vt 2.4); `.help-content` kasutab ka admin (`HelpView.tsx:158`, `RichTextEditor.tsx:73`), seega **ei kustutata** |
| Sisu | Pealkiri (`HELP_SPOTS[helpKey].label`) + puhastatud HTML (`sanitizeHelp`) |
| Ui sihtkomponent | `Popover`. `Tooltip` ei sobi: sisu sisaldab linke ja loendeid, mida peab saama klõpsata ja kopeerida |
| Mis ei sobi | (a) Hõljumisega avamist `ui/Popover`-is pole (praegu ainult klõps); tuleb kontrollitud `open` + `onPointerEnter/Leave`. (b) Laius 320px vs `popoverContentClass` `w-72` (288px). (c) `max-h` + kerimine (`min(60vh,420px)`) puudub. (d) `ui/Popover` ei kasuta `usePopupContainer()`-it (vt jaotis 4) |

### 1.5 Muud ujuvad elemendid (ei ole menüüd; nimekirja täielikkuse pärast)

| Element | Fail:rida | CSS | z-index | Märkus |
|---|---|---|---|---|
| Valitud põllu kaart | `FieldMapCard.tsx:12–50` | `.field-map-card-anchor` `index.css:8240`, `.field-map-card`, `.fmc-*` | 900 | `window` `keydown` Esc (`:17–21`); sihtkomponent `Card`/`Panel`, mitte hüpik |
| Satelliidi paneel | `SatellitePanel.tsx:290`, portaal `:476` | `.satellite-panel` `:506` | 800 | portaal kaardi paneelipinu hosti |
| Kultiveerimise paneel | `CultivationControl.tsx` | `.cultivation-panel` `:1493` | 900 | |
| Kaardi paneelipinud | `MapView`/`App` | `.map-top-left-stack` `:1068`, `.map-top-right-stack` `:718` | 900 | |
| POI lisamise bänner | | `.add-poi-banner` `:700` | 900 | |
| Andmebaasi vea bänner | | `.db-error-banner` `:2060` | 1500 | |
| Koordinaadid, radari legend | | `.coords-tracker` `:410`, `.radar-legend` `:424` | 800 | |
| Kaardi tööriistariba | | `.map-nav-toolbar` `:638` | 800 | 0 tsx kasutust (vt 5) |
| Kultuuride legend | | `.crop-legend-panel` `:3747` | 850 | 0 tsx kasutust (vt 5) |

### 1.6 `title=` vihjed (ainult arv)

Kokku **289** `title` atribuuti JSX-is (AST), neist **40** on `DialogHeader title` (pealkiri) → **249 vihjet**:

| Element | Arv |
|---|---|
| `Button` | 86 |
| `span` | 40 |
| `button` (toores) | 38 |
| `div` | 22 |
| `Badge`, `Input`, `TableHead` | 11 + 11 + 11 |
| `ToggleGroupItem` | 10 |
| `TableCell` | 7 |
| `NumberInput` | 6 |
| `a` | 3 |
| `TableRow` | 2 |
| `strong`, `dd` | 1 + 1 |

- 164 on kirjatekst, 85 on avaldis (nt `title={p.name}`: kärbitud teksti täistekst).
- 41 vihjega elemendil on ka `aria-label`; 29 on `disabled` (Radix `Tooltip` ei käivitu keelatud nupul, vaja ümbrist).
- Suurimad failid: `FieldWorksBoard.tsx` 30, `VehicleTracker.tsx` 26, `CropRegisterModal.tsx` 21, `FieldManagerModal.tsx` 17, `FieldEditDialog.tsx` 16, `CultivationControl.tsx` 14, `FieldsTableView.tsx` 13, `LayerControl.tsx` 12, `ArticlesView.tsx` 12.
- `ui/` sisemised `title=` (ulatusest väljas): `DateInput.tsx:272, 292, 313, 320, 324`, `FilterClear.tsx:41`, `FilterSelect.tsx:181`, `NumberInput.tsx:86`, `Dialog.tsx:107`.

### 1.7 Leafleti hüpikud ja vihjed (ulatusest väljas, ainult loetelu)

| Koht | Mis | Klass/CSS |
|---|---|---|
| `MapView.tsx:384` | `bindTooltip` põllu hõljumisinfo (HTML-string, `sticky`) | `custom-field-tooltip` (`:403`), `.field-map-label`, `.field-sub-label` (`index.css:2973`, `2979`) |
| `MapView.tsx:617` | `bindTooltip` sõidutrajektoor | Leafleti vaikeklass |
| `MapView.tsx:840` | `bindTooltip` mullaproovi punkt | `custom-field-tooltip` (`:858`) |
| `MapView.tsx:528` | `bindPopup` sõiduk (`.vehicle-popup-content`, `.popup-row`, `.popup-note`, `.popup-title-row`) | `leaflet-popup-*` `index.css:2985`, `2994` |
| `MapView.tsx:779` | `bindPopup` POI (`.poi-popup-content`, `.map-popup-btn poi-warehouse-link` `:786`) | `.map-popup-btn` `index.css:8302` |
| `TripDialog.tsx:48, 49` | `bindTooltip` "Algus"/"Lõpp" | Leafleti vaikeklass |
| `WeatherPointMap.tsx:50, 63` | `bindTooltip` (`sticky`) | Leafleti vaikeklass |

Need kasutavad `--popup-bg/-border/-text` (`index.css:44–46` hele, `:90–92` tume), mida `ui/` teema ei kata (`bg-popover` on `--bg-modal`).

## 2. CSS-reeglid menüüdele ja hüpikutele (`src/index.css`, 9 042 rida)

"tsx" = esinemisi (regex `(?<![\w-])klass(?![\w-])`, ilma admin/landing/ui/tooling).

### 2.1 `user-menu` (read 4872–4990)

| Selektor | Rida | Mida seab | tsx |
|---|---|---|---|
| `.user-menu` | 4872 | relative, flex, gap 8 | 1 |
| `.user-menu-trigger` | 4879 | inline-flex, gap 6, padding 8/10, radius `--radius-md`, border 1px transparent, läbipaistev taust, `--text-secondary`, 0.84rem 600, nowrap | 1 |
| `.user-menu-trigger:hover`, `.open` | 4896 | `--btn-sec-bg`, `--btn-sec-border`, `--text-primary` | `open` dünaamiline (`UserMenu.tsx:60`) |
| `.user-menu-chevron` | 4903 | transition transform | 1 |
| `.user-menu-trigger.open .user-menu-chevron` | 4907 | rotate 180° | |
| `.user-menu-dropdown` | 4911 | absolute, `top:calc(100%+8px)`, `right:0`, min-width 240, padding 6, `--bg-modal`, `--shadow-modal`, **z-index 2000**, flex column | 1 |
| `.user-menu-info` | 4924 | padding 8/10/10, alumine joon, margin-bottom 4 | 1 |
| `.user-menu-info-name` | 4930 | 700, 0.9rem | 1 |
| `.user-menu-info-login` | 4936 | 0.75rem, `--text-secondary`, margin-top 2 | 2 |
| `.user-menu-item` | 4942 | flex gap 10, laius 100%, padding 8/10, **`border:none`, `background:transparent`**, radius `--radius-sm`, 0.84rem 500, left | 5 |
| `.user-menu-item:hover` | 4959 | `--btn-sec-hover` | |
| `.user-menu-footer` | 4963 | ülajoon, padding, 0.72rem, hall, flex column gap 4 | 1 |
| `.user-menu-db` | 4974 | inline-flex gap 5 | 1 |
| `.user-menu-db-dot` | 4980 | 6px ring, `--text-muted` | 1 |
| `.user-menu-db-dot.connected` | 4987 | **`#10b981`** + **`0 0 6px #10b981`** | dünaamiline (`UserMenu.tsx:116`) |

### 2.2 `operator-selector` (read 190–323)

| Selektor | Rida | Mida seab | tsx |
|---|---|---|---|
| `.operator-selector` | 190 | relative, margin-left 4 | 1 |
| `.operator-selector-trigger` | 195 | radius 9999px, padding 6/12, **`border:none`**, taust **`#15803d`**, tekst **`#f8fafc`**, vari **`rgba(21,128,61,.35)`**, transition | 1 |
| `.operator-selector-trigger:hover` | 210 | taust **`#16a34a`**, vari **`rgba(21,128,61,.45)`** | |
| `.operator-selector-text` | 215 | flex column, `line-height 1.15` | 1 |
| `.operator-selector-caption` | 222 | 0.6rem 600, suurtäht, `letter-spacing .08em`, `opacity .7` | 1 |
| `.operator-selector-value` | 230 | 0.84rem 700, `max-width:180px`, ellips | 1 |
| `.operator-selector-dot` | 239 | 7px ring, **`#fef08a`**, **`0 0 6px #fef08a`** | 1 |
| `.operator-selector-chevron` | 247 | `opacity .8`, transition | 1 |
| `.operator-selector-trigger[aria-expanded="true"] .operator-selector-chevron` | 252 | rotate 180° | |
| `.operator-selector-dropdown` | 256 | absolute, `top:calc(100%+8px)`, `right:0`, min-width 240, `max-height:60vh`, overflow-y auto, padding 6, `--bg-modal`, ääris `--border-card`, radius `--radius-md`, `--shadow-modal`, **z-index 2000** | 1 |
| `.operator-selector-option` | 272 | flex gap 10, laius 100%, padding 8/10, **`border:none`**, läbipaistev, `--text-primary`, 0.84rem, left | 2 |
| `.operator-selector-option:hover` | 288 | `--btn-sec-hover` | |
| `.operator-selector-option.checked` | 292 | `font-weight:600` | dünaamiline |
| `.operator-selector-check` | 296 | 16px kast, `1.5px solid --input-border`, radius 4px, **`color:#ffffff`** | 2 |
| `.operator-selector-option.checked .operator-selector-check` | 308 | taust/ääris `--emerald-500` | |
| `.operator-selector-divider` | 313 | 1px, margin 4/0 | 1 |
| `.operator-selector-empty` | 319 | padding 8/10, 0.78rem, hall | 1 |

Trigger saab tsx-is ka klassi `filtered` (`OperatorSelector.tsx:49`), millele **CSS-is reeglit ei ole**.

### 2.3 `map-context-menu` (read 8028–8084)

| Selektor | Rida | Mida seab | tsx |
|---|---|---|---|
| `.map-context-menu` | 8028 | `position:fixed`, **z-index 3000**, min 240 / max 340, `max-height:70vh`, overflow-y auto, padding 6, `--bg-modal`, ääris `--btn-sec-border`, radius `--radius-md`, vari **`0 12px 32px rgba(0,0,0,.25)`** (kõvakodeeritud, mitte `--shadow-modal`), 0.82rem | 1 |
| `.map-context-menu-title` | 8042 | flex column gap 2, padding 6/8/8, alumine joon `--btn-sec-border` | 1 |
| `.map-context-menu-title .muted` | 8050 | 0.74rem | |
| `.map-context-menu-section` | 8051 | padding, 0.68rem 700, suurtäht, hall | 1 |
| `.map-context-menu-item` | 8059 | flex `align-items:flex-start`, gap 8, padding 7/8, **`border:none`**, radius **6px** (kõvakodeeritud), läbipaistev, `font:inherit`, left | 1 |
| `.map-context-menu-item:hover`, `:focus-visible` | 8073 | `--btn-sec-hover`, `outline:none` | |
| `.map-context-menu-item svg` | 8075 | `flex-shrink:0`, `margin-top:2`, **`color:#22c55e`** | |
| `.map-context-menu-item-text` | 8076 | flex column gap 1 | 1 |
| `.map-context-menu-item-text .muted` | 8077 | 0.74rem | |
| `.map-context-menu-note` | 8078 | flex, gap 6, padding 6/8 | 3 (osa `note error`, `note muted`) |
| `.map-context-menu-note.error` | 8084 | **`color:#ef4444`** | 1 |

### 2.4 `help-hint` ja `help-content` (read 7846–7918)

| Selektor | Rida | Mida seab | tsx |
|---|---|---|---|
| `.help-hint-btn` | 7846 | inline-flex, 24×24, **`border:none`**, `padding:0`, ring, läbipaistev, `--text-muted`, `cursor:help` | 1 |
| `.help-hint-btn:hover`, `.is-open`, `:focus-visible` | 7861 | `--emerald-500`, taust **`rgba(34,197,94,.12)`**, `outline:none` | `is-open` dünaamiline |
| `.help-hint-btn.help-hint-inline` | 7870 | 20×20, `margin:-2px -4px -2px 2px` | 1 |
| `.help-hint-popup` | 7876 | **z-index 3200**, `max-height:min(60vh,420px)`, overflow-y auto, padding 12/14, `--bg-modal`, ääris `--border-card`, radius `--radius-md`, vari **`0 10px 25px -5px rgba(0,0,0,.3), 0 8px 10px -6px rgba(0,0,0,.2)`**, animatsioon `help-hint-in` | 1 |
| `@keyframes help-hint-in` | 7889 | fade + 3px nihe | |
| `.help-hint-title` | 7894 | 0.72rem 700, suurtäht, hall | 1 |
| `.help-content` + `p`, `h3`, `h4`, `ul/ol`, `li`, `a` | 7904–7918 | tüpograafia 0.85rem, `a` värv `--emerald-500` | 1 + admin 2 |

### 2.5 Leafleti hüpiku/vihje CSS (ulatusest väljas, ainult nimekiri)

| Selektor | Rida | Mida seab |
|---|---|---|
| `.custom-field-tooltip` (+ `:before`) | 2927, 2937 | `--popup-*` värvid, kõik `!important`, blur 8px, radius 6px, padding 4/8; nool peidetud |
| `.leaflet-popup-content-wrapper` | 2985 | `--popup-*`, blur 12px, `--radius-md`, `--shadow-modal` (`!important`) |
| `.leaflet-popup-tip` | 2994 | `--popup-bg` |
| `.vehicle-popup-content h4` jt | 2998 | pealkiri 0.92rem 700 |
| `.popup-row` | 3009 | flex space-between, 0.74rem (16 tsx kasutust) |
| `.popup-note` | 3027 | **`rgba(245,158,11,.1)`**, 0.7rem, radius 4px (4) |
| `.popup-title-row` (+ `.status-tag`) | 4144 | (1) |
| `.map-popup-btn` | 8302 | nupu koopia vanast `.btn` (1) |

### 2.6 Kõvakodeeritud värvid ja z-index nende nelja komponendi reeglites

- Värvid: `#15803d`, `#16a34a`, `#f8fafc`, `#fef08a`, `#ffffff` (`index.css:195–308`), `#10b981` ×2 (`:4987–4989`), `#22c55e`, `#ef4444` (`:8075, 8084`), `rgba(21,128,61,.35/.45)`, `rgba(0,0,0,.25)`, `rgba(34,197,94,.12)`, `rgba(0,0,0,.3/.2)`: kokku ~14 kõvakodeeritud värvi/varju.
- Muutujad ilma otsese `ui/` nimeta: `--btn-sec-hover` (= `bg-secondary-hover`), `--btn-sec-border` (= `border-secondary-border`), `--border-card` (= `border-border`), `--bg-modal` (= `bg-popover`), `--emerald-500` (= `text-primary`), `--text-muted` (= `text-subtle`); vt README tabel.
- Radius 6px / 4px kõvakodeeritud (`:8059`, `:296`), mitte `--radius-sm`.
- z-index: 2000 (×2), 3000, 3200.

## 3. z-index kaart (kõik ujuvad kihid)

### 3.1 Järjestus

| z-index | Kihi omanik | Allikas |
|---|---|---|
| 5000 | `ConfirmDialog` / `alertDialog` (`layer="alert"`, 1 kasutuskoht) | `ui/variants.ts:139`; `ConfirmDialog.tsx:53` |
| 3200 | `HelpHint` hüpik | `index.css:7877` |
| 3000 | `FieldContextMenu` (`.map-context-menu`) | `index.css:8030` |
| 2100 | `ui` menüüd, hüpikud, vihjed, `Select`, `DateInput`, `FilterSelect` (kõik `menuContentClass`/`popoverContentClass`/`tooltipContentClass`) | `ui/variants.ts:115, 122, 123` |
| 2000 | `ui` dialoog + taust | `ui/variants.ts:139` |
| 2000 | `.user-menu-dropdown`, `.operator-selector-dropdown` | `index.css:4919`, `269` |
| 1500 | `.db-error-banner` | `index.css:2065` |
| 1000 | `.app-header`; Leafleti `.leaflet-top/.leaflet-bottom` | `index.css:152`; `leaflet.css:141` |
| 900 | kaardi paneelipinud, `.cultivation-panel`, `.add-poi-banner`, `.field-map-card-anchor` | `index.css:706, 724, 1073, 1500, 8240` |
| 850 | `.crop-legend-panel` | `index.css:3753` |
| 800 | `.coords-tracker`, `.radar-legend`, `.satellite-panel`, `.map-nav-toolbar`; Leafleti `.leaflet-control` | `index.css:418, 429, 509, 646`; `leaflet.css:134` |
| 700 / 650 | Leaflet `popup-pane` / `tooltip-pane` | `leaflet.css:113–114` |
| 450 / 200–600 | radari paan (`MapView.tsx:230`), Leafleti paanid, kihid (`satelliteLayer.ts:218` 200, `MapView.tsx:322` 300) | |
| 1–3 | tabeli kleepuv päis/lahter, `.fw-head*`, `.fields-table tfoot` | `ui/variants.ts:180–221`; `index.css:5382–5401`, `3293` |

README mainib kuupäevavalija popupi z 3100 ja `FilterSelect` listi z 9000; neid `index.css`-is enam pole, nad kasutavad `menuContentClass` (2100).

### 3.2 Konfliktid ja riskid

1. **`.user-menu-dropdown` ja `.operator-selector-dropdown` (2000) = `ui` dialoog (2000).** Otsustab DOM-järjekord. Praegu varjatud, sest menüü sulgub (`run()`) enne dialoogi avamist. Üleminek `ui` menüüle (2100) kaotab konflikti.
2. **`FieldContextMenu` (3000) on `ui` menüüde (2100) ja dialoogi (2000) kohal, `HelpHint` (3200) veel kõrgemal, aga kinnitus (5000) kõigi all-ülal.** Kui kontekstimenüü oleks avatud, kui kinnitus avaneb, jääb menüü kinnituse alla; praktikas sulgeb menüü end valikul.
3. **`ui` menüü/hüpik (2100) jääb kinnitusdialoogi (5000) alla.** Kinnitusdialoogi sees avatud `Popover`/`DropdownMenu` oleks nähtamatu, kui seda ei portaalita `usePopupContainer()`-iga. Praegu kinnituses valikuid pole, aga `ui/Menu.tsx` ja `ui/Popover.tsx` ei kasuta `usePopupContainer()`-it.
4. **`.app-header` z-index 1000 ilma `position`-ita** (`index.css:143–152`): toimib ainult siis, kui `.app-header` on flex-/grid-laps (kontrollimata). Lisaks `backdrop-filter` loob eraldi stacking contexti, seega **vanad menüüd (2000) on tegelikult päise konteksti sees** ega võrdle end dialoogiga globaalselt. Radix portaal `document.body`-sse seda ei oma.
5. Leafleti kontrollid (800–1000) ja meie kaardipaneelid (800–900) on numbriliselt segamini, kuid asuvad kaardi konteineris; probleemi ei ole.
6. **Kolm erinevat süsteemi:** Tailwindi `z-2100/2000/5000` (`ui/`), käsitsi CSS-i väärtused (`3200/3000/2000/1500/…`) ja Leafleti sisemised. Pärast 2.6 jäävad käsitsi väärtused ainult kaardi paneelidele ja bännritele.

### 3.3 Esc / väljaspool klõpsu kuulajad vaadetes (portaaliriskid)

Radix portaalib `document.body`-sse. Need kuulajad peavad portaaliga sisu ignoreerima `e.target.closest(...)`-iga:

| Kuulaja | Fail:rida | Mida kontrollib | Risk Radix menüü/hüpikuga |
|---|---|---|---|
| `FieldManagerModal` kultuuri kiirmuutmine: `pointerdown` + `keydown` | `FieldManagerModal.tsx:216–232` | `closest('[role="listbox"]')` | Radix `DropdownMenu` kasutab `role="menu"`, `Popover` `role="dialog"`, mitte `listbox`: `ui` menüü klõps sulgeks rea redigeerimise. Praegu seal menüüd ei ole (ainult `Select`/`FilterSelect`, mis on `listbox`) |
| POI asukoha valik: `keydown` Esc | `App.tsx:1352–1357` | `closest('[role="listbox"]')` | Sama |
| `FieldMapCard`: `window` `keydown` Esc | `FieldMapCard.tsx:16–21` | ei kontrolli midagi (README: dialoogid peatavad Esc-i) | **`FieldContextMenu` ja `FieldMapCard` kuulavad mõlemad Esc-i**: praegu sulgeb üks Esc mõlemad. `ui/Menu.tsx` ei peata Esc-i levi (`ui/Select.tsx:60` ja `Dialog.tsx` peatavad), seega sama juhtuks Radix menüüga |
| `UserMenu`, `OperatorSelector`: `document` `pointerdown` + Esc | `UserMenu.tsx:35–49`; `OperatorSelector.tsx:140–154` | `contains(target)` ainult oma juurelemendis | Kaovad üleminekuga |
| `HelpHint`: `pointerdown` | `HelpHint.tsx:70–73` | oma nupp + oma hüpik | Radix portaalis `Select` list jms **sulgeks vihje**; praegu koos ei esine |
| `FieldContextMenu`: `mousedown` capture | `FieldContextMenu.tsx:61` | `menuRef.contains` | Kaob üleminekuga |

Soovitus: `DropdownMenuContent`, `PopoverContent`, `Tooltip` peavad Esc-i **peatama** (nagu `Select`), ja kaks vana `[role="listbox"]` kontrolli tuleb laiendada `[role="menu"], [role="dialog"]` peale.

## 4. Lüngad `ui/Menu.tsx` ja `ui/Popover.tsx` komponentides

Praegu: `DropdownMenu` (`Root`, `Trigger`, `Content`, `Item`, `Separator`, `Label`), `ContextMenu` (sama), `Popover` (`Root`, `Trigger`, `Content`), `Tooltip` (ühe elemendi API).

| Vajadus | Olek | Kes vajab |
|---|---|---|
| **Märkeruudu kirje** (`CheckboxItem` + indikaator) | puudub | `OperatorSelector` |
| Raadiokirje (`RadioGroup`/`RadioItem`) | puudub | kasutust pole |
| Alammenüü (`Sub`, `SubTrigger`, `SubContent`) | puudub | kasutust pole, ei ole vaja |
| Rühm (`Group`), kiirklahvi tekst | puudub | kasutust pole |
| **Ikoon kirjel** | töötab (laps + `gap-2`), kuid suurust ei sea (`[&_svg]:size-4` puudub); vanad kasutavad 15px | `UserMenu`, `FieldContextMenu` |
| Danger kirje | olemas (`danger` prop, `text-destructive`) | |
| **Kahe rea kirje (alamtekst)** | puudub: `menuItemClass` on `items-center` | `FieldContextMenu` |
| Klaviatuur | Radix annab noolklahvid, Home/End, tähe järgi hüpe, Esc ja fookuse tagastuse tasuta | vanadel puudub |
| **Esc-i leviku peatamine** | **puudub** (`Select.tsx:60` ja `Dialog.tsx` teevad) | vt 3.3 |
| **Portaali konteiner dialoogi sees** | **puudub**: `DropdownMenuContent`, `ContextMenuContent`, `PopoverContent`, `Tooltip` portaalivad alati `document.body`-sse. `DropdownMenu`/`ContextMenu` on Radixis vaikimisi modaalsed, seega tõenäoliselt töötavad dialoogis; mittemodaalne `Popover` ja `Tooltip` dialoogi sees võivad jääda `pointer-events:none` alla. Kontrollimata brauseris | uus `Popover` dialoogis, `HelpHint` (kasutab `usePopupContainer` ise) |
| **Kõrguspiirang ja kerimine** | puudub: `menuContentClass` on `overflow-hidden`, ilma `max-h`-ta (`Select` lisab `max-h-72` ise) | `OperatorSelector` (praegu 60vh), `FieldContextMenu` (70vh) |
| **Suurused** | `menuContentClass` `min-w-40` (160px), `popoverContentClass` `w-72` (288px), tooltip `max-w-72`; `size` propi pole. Vanad: min 240px (kolm menüüd), 320px (`HelpHint`) | |
| Nool (arrow) | puudub; vanadel samuti pole | ei vaja |
| Animatsioon | puudub; vanad: `animate-scale-up` (0.2s), `help-hint-in` | |
| **Tooltip: Provider igal Tooltipil** | `Tooltip` ümbritseb end oma `TooltipPrimitive.Provider`-iga (`delayDuration=300`): kiire järjestikune näitamine (skip delay) ei tööta ja 249 vihje korral 249 providerit | vihjete asendamine |
| **Tooltip keelatud elemendil** | Radix ei käivitu `disabled` nupul (29 kohta) | vihjete asendamine |
| **Tooltip puuteekraanil** | Radix ei ava puudutusel | |
| **Trigger ilma `asChild`-ita** | `DropdownMenuTrigger`/`PopoverTrigger` renderdavad `<button>` **ilma `border-0 bg-transparent p-0` nullimiseta** (Tailwindi preflight puudub): halli 3D-nupu oht. Kõik kasutuskohad peavad kasutama `asChild` + `Button` | uus kasutus |
| **Hõljumisega avamine** | puudub (`Popover` ainult klõps) | `HelpHint` |
| **Virtuaalne ankur (koordinaadid)** | puudub (`PopoverAnchor` ei ole eksporditud; `DropdownMenu` pole koordinaatidest avatav) | `FieldContextMenu` |

Raw-`<button>`/`<input>` reset-kontroll `ui/` komponentides: kõik leitud toored elemendid kannavad `border-0 bg-transparent p-0` (`DateInput.tsx:255, 256, 287`, `FilterClear.tsx:45`, `Input.tsx:32`). `DateInput.tsx:318` ("Täna" nupp) on tahtlik ääriga nupp, `FilterSelect.tsx:167` kasutab `fieldControlClass`-i (ääris ja taust antud). **Lünki ei leitud**; `Menu`/`Popover` sisu on Radixi `div`id. Ainus risk on `Trigger` ilma `asChild`-ita (ülal).

## 5. Surnud CSS (0 tsx kasutust)

Kontrollitud dünaamilised nimed: `user-menu-trigger ${open ? 'open' : ''}` (`UserMenu.tsx:60`), `user-menu-db-dot ${… 'connected'}` (`:116`), `operator-selector-trigger ${… 'filtered'}` (`OperatorSelector.tsx:49`), `operator-selector-option ${… 'checked'}` (`:68, 84`), `help-hint-btn${open ? ' is-open' : ''}` (`HelpHint.tsx:95`). Muid mallstringe pole.

**Menüü/hüpikuga seotud:** kõik 37 klassinime on kasutuses. Erand: `operator-selector-trigger` saab tsx-is modifikaatori `filtered`, millele **CSS-is reeglit ei ole** (surnud modifikaator tsx-is).

**Naabruses (kaardi paneelid, ei kuulu 2.6 ulatusse, aga sobivad sama puhastusega):**

| Selektor | Rida | tsx |
|---|---|---|
| `.map-nav-toolbar` | 638 | 0 |
| `.map-nav-btn` (+ `:hover`, `.icon-only`, `.fit-all-btn`, `.fit-all-btn:hover`) | 650–681 | 0 |
| `.toolbar-divider` | 686 | 0 |
| `.crop-legend-panel` (+ `.collapsed`) | 3747, 3764 | 0 |
| `.crop-legend-header` | 3770 | 0 |
| `.crop-legend-body` | 3798 | 0 |
| `.crop-legend-item` | 3829 | 1 (`MapYearSelector.tsx:150`, elus) |

`.help-content` jääb (tsx 1 + admin 2). `.glass-card` (23 tsx + admin 19) ja `.animate-scale-up` (2 tsx + `Dialog.tsx`) jäävad, neil on teisi kasutajaid.

**Pärast 2.6 muutuvad surnuks** 37 klassinime (~46 reeglit): `.user-menu*` (4872–4990), `.operator-selector*` (190–323), `.map-context-menu*` (8028–8084), `.help-hint*` + `@keyframes help-hint-in` (7846–7902). `.help-content*` (7904–7918) jääb.

## 6. ui-audit

### 6.1 Praegune väljund (`npm run ui-audit`)

```
Erinevaid kirjasuurusi (CSS)          39
Erinevaid nurgaraadiusi (CSS)         11
Erinevaid vahe-väärtusi (CSS)         32
Erinevaid värvikoode (CSS)           239
style={{…}} kohti (tsx)              134
Värvikoode/rgba (tsx)                 55
Kirjasuurusi inline (tsx)              5
Vanu komponendiklasse (CSS)            6
Keelatud suvalisi klasse (tsx)         0
Skaalaväliseid vahe-klasse (tsx)       0
Vanu nupuklasse (tsx)                  0
Vanu modaaliklasse (tsx)               0
Vanu tabeleid (tsx)                    0
Vanu märke/sakke (tsx)                 0
Vanu vormivälju (tsx)                  0
```

### 6.2 Ettepanek: "Vanu menüüsid/hüpikuid (tsx)"

Regex `LEGACY_FORM_FIELD` stiilis (`src/tooling/uiAudit.ts:53`), uus konstant:

```ts
// Käsitsi tehtud menüüd ja hüpikud (etapp 2.6): vanad klassid, käsitsi antud menüürollid ja aria-haspopup.
// ui/ kausta ei loeta. Jääb alles valvurina: peab olema 0. Leafleti hüpikuklassid (popup-row jms) ei loe.
const LEGACY_MENU_POPUP =
  /(?<![\w-])((?:operator-selector|user-menu|map-context-menu|help-hint)[\w-]*)(?![\w-])|role="(menu|menuitem|menuitemcheckbox|menuitemradio|tooltip)"|aria-haspopup=/g;
```

- Tulemus praegu **52**: `FieldContextMenu.tsx` 10, `HelpHint.tsx` 4, `OperatorSelector.tsx` 15, `UserMenu.tsx` 23 (testitud serveris, `src/admin`, `src/landing`, `src/styles` ja `src/components/ui` välja jäetud).
- Muudatused:
  - `auditTsx`: `legacyMenuPopups: [...src.matchAll(LEGACY_MENU_POPUP)].map((m) => m[1] ?? m[2] ?? 'aria-haspopup')`;
  - `AuditReport`: `legacyMenuPopupFiles: { path: string; count: number }[]`;
  - `summarize`: filter `!t.path.includes('components/ui/')` nagu eelmistel;
  - `scripts/ui-audit.mts`: `row('Vanu menüüsid/hüpikuid (tsx)', …)`;
  - `uiAudit.test.ts`: blokk nagu `auditTsx: vanad märgid ja sakid` (rida 217): loeb vanad klassid ja rollid, ei loe sarnaseid nimesid (`usermenu`), `summarize` jätab `ui` kausta välja.
- Piirang: `role="listbox"`/`"option"` jäetud välja, sest `ui/FilterSelect` kasutab neid ise; `help-content` jäetud välja, sest admin kasutab.
- Soovi korral eraldi informatiivne rida "title= vihjeid (tsx)" (praegu 249). See ei lähe nulli, seega ei ole valvur.

## 7. Avatud küsimused kasutajale

1. **Kas `title=` vihjed (249 kohta) asendada `Tooltip`-iga?** Soovitus: **ainult ikoonnupud ilma tekstita** (`Button size="icon*"`, ~100 kohta); kärbitud tekstide täisnimed (`title={p.name}`) ja tabeli lahtrite selgitused jäävad natiivseks `title`-iks. Põhjus: `Tooltip` annab ühtse välimuse ja 300ms viivituse, kuid ei tööta keelatud nupul (29 kohta vajaks ümbrist) ega puuteekraanil, ja kõigi 249 vahetamine on suur töö väikese kasuga.
2. **Kuidas muutub kaardi paremklõpsu menüü välimus?** Praegu: kahe reaga kirjed (töö nimi + olek · aeg) ja roheline ikoon. Soovitus: **sisu jääb samaks, välimus läheb `ui` menüüga ühtseks** (sama taust, ääris, vari ja nurk nagu kasutajamenüül; ikoon hall, mitte roheline; kahe rea kirjed jäävad). Põhjus: ühtlus ilma infot kaotamata, töö nimi ja olek on mõlemad vajalikud.
3. **Kas operaatori valija säilitab rohelise pillikuju?** Praegu on see ainus tugevalt rohelise varjuga nupp päises. Soovitus: **jääb silmatorkavaks ja saab uue `Button` variandi** (nt `filter-pill`; aktiivne filter = kollane punkt). Põhjus: filter mõjutab kaarti, statistikat ja registreid ning peab olema nähtav. Alternatiiv: tavaline `secondary` nupp, kui tahate päist rahulikumaks.
4. **Kas kaardi Leafleti hüpikud ja vihjed (põllu hõljumisinfo, sõiduki ja POI hüpik) saavad `ui` menüüdega sama värvi ja tausta?** Praegu on neil tume läbipaistev `--popup-bg`, mis erineb `bg-popover`-ist. Soovitus: **jah, ainult värvid ja taust** (`--popup-*` seotakse `--popover`-iga), sisu jääb HTML-stringiks. Põhjus: kaardil hõljudes näeb kasutaja teistsugust hüpikut kui kõikjal mujal, aga Reacti komponendid Leafleti stringis ei tööta.
5. **Kas juhendi küsimärk (`HelpHint`) jääb hõljumisega avanevaks?** Soovitus: **jah, sama käitumine** (hõljumine avab, klõps kinnitab, Esc sulgeb) ja lisaks avab fookus. Põhjus: kasutaja on sellega harjunud, juhend sisaldab linke ja loendeid, mida `Tooltip` ei lubaks klõpsata, ning klaviatuuriga kasutajal on praegu hüpikule ligipääs ainult Enter/Space kaudu span-variandis.

## 8. Soovituslik töö järjekord

1. `ui/Menu.tsx`, `ui/Popover.tsx`: `DropdownMenuCheckboxItem`, ikooni suurus (`[&_svg]:size-4`), `max-h` + `overflow-y-auto`, kahe rea kirje, Esc-i leviku peatamine, portaal `usePopupContainer()`-isse, jagatud `TooltipProvider`, hõljumisega `Popover` või `HelpHint`-i enda kontroll.
2. `UserMenu` → `DropdownMenu`; `OperatorSelector` → `DropdownMenuCheckboxItem`; `FieldContextMenu` → kontrollitud `DropdownMenu` virtuaalse triggeriga; `HelpHint` → `Popover`.
3. Vanade kuulajate (`FieldManagerModal.tsx:216–232`, `App.tsx:1352–1357`) `closest` laiendada `[role="menu"]`/`[role="dialog"]` peale; `FieldMapCard` Esc-i konflikt `FieldContextMenu`-ga.
4. Kustutada surnud CSS (jaotis 5), lisada `LEGACY_MENU_POPUP` audit, uuendada `ui/README.md` ja `UiGallery.tsx`.
