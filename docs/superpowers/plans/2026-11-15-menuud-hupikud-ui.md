# Menüüd ja hüpikud ui peale (etapp 2.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kasutajamenüü, operaatori valik, põllu paremklõpsu menüü ja abivihjed kasutavad `src/components/ui` menüüd/hüpikut; tekstita ikoonnuppudel on rakenduse stiilis vihje; kaardi hüpikud saavad menüüdega sama värvi ja tausta; vanad menüüklassid kustutatakse.

**Architecture:** Esmalt laiendatakse `ui/Menu.tsx` ja `ui/Popover.tsx` (Esc ei levi edasi, portaal `usePopupContainer()`-isse, kõrguspiir ja kerimine, märkeruudu kirje, kahe rea kirje, ühine vihje-provider, keelatud nupu vihje). Seejärel viiakse neli käsitsi tehtud komponenti üle, `Button` näitab ikoonnupu `title` rakenduse vihjena, Leafleti hüpikud seotakse teema värvidega ja vana CSS kustutatakse.

**Tech Stack:** React 19 + TS, Tailwind v4 (skaneerib AINULT `src/components/ui`), Radix (`radix-ui`), vitest, oxlint, Playwright (ekraanipildid `scripts/shot.mts`).

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md · **Inventuur:** docs/superpowers/plans/2026-11-15-menuud-hupikud-inventuur.md (read-numbrid, CSS, kuulajad — loe oma ülesande osa)

## Global Constraints

- Kasutaja otsused (2026-11-15): (1) rakenduse stiilis vihje **ainult tekstita ikoonnuppudel**; kärbitud tekstide ja muu `title=` jääb brauseri omaks. (2) Põllu paremklõpsu menüü: **sama sisu** (päis, kahe reaga kirjed), **ühtne välimus** teiste menüüdega, klaviatuur juurde. (3) Kaardi (Leaflet) hüpikud ja vihjed: **ainult värv ja taust** ühtseks (sisu/paigutus ei muutu). (4) Abivihje (?): avaneb **hõljumisel ja klõpsul**, lisaks fookusel; välimus ühtne.
- Operaatori valik jääb päises silmatorkavaks roheliseks pillinupuks (kontrollija otsus — kasutaja pole muutust küsinud); aktiivse filtri kollane punkt jääb.
- **Preflight'i pole**: iga toores `<button>`/`<input>` ui komponendis vajab `border-0 bg-transparent p-0` (input ka `appearance-none`); Radix `Trigger` kasuta alati `asChild` + `Button`. Kirjatüüp pärineb base-kihist (`app.css`).
- Radix portaalib body-sse. Ui sisu (`DropdownMenuContent`, `ContextMenuContent`, `PopoverContent`, vihje) **peatab Esc-i levi** (`onEscapeKeyDown` → `e.stopPropagation()`, nagu `Select.tsx` ja `Dialog.tsx`) ja portaalib `usePopupContainer()`-isse (dialoogi sees dialoogi kihti).
- Tailwind skaneerib ainult `src/components/ui` → vaadetes **ei kasutata Tailwindi klasse**. Vaate reegel, mis peab ui utiliidi üle võitma, vajab `!important`.
- Identifikaatorid inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- Keskkond: kohalik kaust on sshfs-mount; käsud serveris `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`.
- Kontrollid iga ülesande lõpus: `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run src/tooling src/components/ui`; `npx oxlint <failid>`; `npm run ui-audit -- --details`.
- **Visuaalne kontroll iga ülesande lõpus (kohustuslik):** pärast release'i `npx tsx scripts/shot.mts --user andresj --height 2400 [--click "<css>"] <tee>` (light + dark), kopeeri `scp -q -o BatchMode=yes 'debian@uvn-243-120.tll07.zonevs.eu:/tmp/shots/*.png' <kohalik kaust>`, vaata pilte Read-tööriistaga, lõika vajadusel `sips -c H W --cropOffset Y X`. Raportisse: millised pildid vaatasid ja mida nägid (hallid brauseri nupud, nähtamatu tekst tumedas, vale kirjatüüp = viga).
- Commit masteris enne release'i, failid nimeliselt; sõnum lõpeb `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Release: `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` ja `systemctl is-active teris` → `active`.

---

### Task 1: ui menüü ja hüpiku alus + audit

**Files:** Modify `src/components/ui/Menu.tsx`, `Popover.tsx`, `variants.ts`, `variants.test.ts`, `index.ts`, `UiGallery.tsx`, `README.md`, `Button.tsx` (ainult uus variant), `src/main.tsx` ja `src/admin/main.tsx` (TooltipProvider), `src/tooling/uiAudit.ts`, `uiAudit.test.ts`, `scripts/ui-audit.mts`, `src/components/FieldManagerModal.tsx` ja `src/App.tsx` (ainult portaali-kontroll).

**Interfaces (Produces):**
- `DropdownMenuContent`, `ContextMenuContent`, `PopoverContent`: portaal `usePopupContainer()`, `onEscapeKeyDown` peatab levi (kutsu ka kasutaja oma `onEscapeKeyDown`), kõrguspiir `max-h-(--radix-dropdown-menu-content-available-height)` / vastav context/popover muutuja + `overflow-y-auto`.
- `menuItemClass` lisab `[&_svg]:size-4 [&_svg]:shrink-0`.
- `DropdownMenuCheckboxItem: ComponentProps<CheckboxItem>` — linnuke vasakul (`Check` 14px `text-primary`, ruut 16px nagu `Checkbox`), valik ei sulge menüüd, kui kutsuja annab `onSelect={(e) => e.preventDefault()}` (README-sse).
- `MenuItemText({ title: ReactNode; description?: ReactNode })` — kahe rea kirje sisu (`flex flex-col`, alamtekst `text-2xs text-muted-foreground`); kirje kasuta `className="items-start"`.
- `PopoverAnchor` (Radix `Popover.Anchor`) eksport.
- `TooltipProvider` (eksport, `delayDuration={300}`) — `Tooltip` EI sisalda enam oma providerit; provider pannakse `src/main.tsx` ja `src/admin/main.tsx` juure ümber ning `UiGallery` töötab selle all.
- `Tooltip` props: `content`, `side?`, `children: ReactElement`, `wrapDisabled?: boolean` (kui true, ümbritseb lapse `<span className="inline-flex" tabIndex={-1}>`-ga, et keelatud nupu vihje töötaks).
- `buttonVariants` uus `variant: 'filter'` — vana `.operator-selector-trigger` välimus (inventuur 2.2: roheline `bg-primary-strong`, valge tekst, `rounded-full`, `shadow-primary`, hover tumedam); lisa `variants.test.ts` test.
- ui-audit rida „Vanu menüüsid/hüpikuid (tsx)“ — regex inventuuri 6.2 järgi (`LEGACY_MENU_POPUP`), test nagu `legacyBadgeTabs`; algtase raportisse (~52).
- Portaali-kontroll: `FieldManagerModal.tsx` (~216–232) ja `App.tsx` (~1352) `closest('[role="listbox"]')` → `closest('[data-radix-popper-content-wrapper], [role="listbox"]')`.

- [ ] Step 1: testid `variants.test.ts`-i: `menuItemClass` sisaldab `[&_svg]:size-4`; `buttonVariants({variant:'filter'})` sisaldab `bg-primary-strong` ja `rounded-full`; ui-audit test LEGACY_MENU_POPUP (loeb `user-menu-dropdown`, `role="menu"`, `aria-haspopup=`, ei loe `usermenu`, `summarize` jätab `components/ui/` välja). Käivita → FAIL.
- [ ] Step 2: teosta ülalnimetatud muudatused (Menu/Popover: `usePopupContainer` import `./Dialog`-ist; kontrolli, et `Portal container={…}` saab `null`-i korral body). Testid → PASS.
- [ ] Step 3: galerii plokk „Dialoog, menüüd, hüpikud“: rippmenüü ikoonidega + ohtlik kirje + eraldaja + märkeruudu kirjed (lahti jääv) + kahe rea kirje; pikk menüü (30 kirjet, kerib); `Button variant="filter"`; ikoonnupp vihjega ja keelatud ikoonnupp `wrapDisabled` vihjega; rippmenüü **dialoogi sees** (Esc sulgeb esmalt menüü, teine Esc akna).
- [ ] Step 4: kontrollid, commit `feat(ui): menüü ja hüpiku alus — Esc ei levi, portaal dialoogi, kerimine, märkeruudu ja kahe rea kirje, ühine vihje-provider, filter-nupp`, release, ekraanipildid `/ui` (ava rippmenüü `--click`), raport.

### Task 2: Kasutajamenüü ja operaatori valik

**Files:** `src/components/UserMenu.tsx`, `src/components/OperatorSelector.tsx`, `src/components/Header.tsx` (kui vaja), `src/index.css` (`.user-menu*`, `.operator-selector*` — kustuta, kui tsx kasutus 0; inventuur 2.1–2.2).

- UserMenu → `DropdownMenu` + `DropdownMenuTrigger asChild` + `Button variant="ghost"` (ikoon, nimi, `ChevronDown`, mis pöörleb `data-[state=open]` järgi — pöörlemine Buttoni `className`-ina on Tailwind ui-s, seega anna ChevronDown-ile klass ui komponendist: lisa vajadusel `Button`-ile ei midagi; kasuta Radixi `data-state` atribuuti vaate CSS-is `[data-state="open"] .user-menu-chevron { transform: rotate(180deg) }` — lubatud vaate klass). Info plokk (nimi, kasutajanimi, ettevõte) ja jalus (versioon, autoriõigus, andmebaasi punkt) jäävad vabasisuna menüü sees (div, mitte kirje); 4 tingimuslikku kirjet + teema vahetus `DropdownMenuItem` ikoonidega. Logi välja nupp kõrval jääb.
- OperatorSelector → `DropdownMenu`; trigger `Button variant="filter"` (kaks rida: „Operaator“ + väärtus, max 180px ellips, kollane punkt aktiivse filtri korral, `ChevronDown`); „Kõik operaatorid“ `DropdownMenuItem`; eraldaja; operaatorid `DropdownMenuCheckboxItem` (`onSelect={(e) => e.preventDefault()}` — menüü jääb lahti); tühja oleku tekst. Kõrguspiir tuleb Task 1-st. `title` triggeril jääb (valitute nimed).
- Valikute loogika ja salvestus **ei muutu**.
- [ ] Steps: teisenda; kustuta surnud CSS (grep enne); kontrollid; commit `refactor(ui): kasutajamenüü ja operaatori valik ui menüü peale`; release; ekraanipildid `/` avatud kasutajamenüüga ja avatud operaatori valikuga (`--click`), mõlemad teemad; raport.

### Task 3: Põllu paremklõpsu menüü

**Files:** `src/components/FieldContextMenu.tsx`, `src/App.tsx` (ainult kui liides muutub), `src/index.css` (`.map-context-menu*`, inventuur 2.3).

- Kontrollitud `DropdownMenu open` (sulgemisel `onClose`), trigger = nähtamatu `position:fixed` 0×0 element koordinaatides (`style={{ left: x, top: y }}` + vaate klass või ui `PopoverAnchor` — vali üks, kirjelda); `DropdownMenuContent align="start"` `onCloseAutoFocus` ei vii fookust kaardile ootamatult.
- Sisu sama: päis (nimi, nr, kultuur, ha) vabasisuna, silt „Lisa kanne“ (`DropdownMenuLabel`), laadimise/vea/tühja oleku märkus, kirjed = lõpetamata tööd `ClipboardPlus` + `MenuItemText title description` (`className="items-start"`). Ikoon hall (ühtne), mitte roheline.
- Esc sulgeb ainult menüü (Task 1 peatab levi) — `FieldMapCard` jääb lahti. Nooleklahvid töötavad. Paremklõps menüü peal ei ava brauseri menüüd.
- [ ] Steps: teisenda; kustuta surnud CSS; kontrollid; commit `refactor(ui): põllu paremklõpsu menüü ui menüü peale`; release; ekraanipilt: kaardil paremklõps põllul (`page.mouse.click(x,y,{button:'right'})` — kui `shot.mts` seda ei toeta, lisa skriptile `--rightclick x,y` valik), mõlemad teemad; raport.

### Task 4: Abivihje (HelpHint)

**Files:** `src/components/HelpHint.tsx`, `src/index.css` (`.help-hint*`, `@keyframes help-hint-in`; `.help-content*` JÄÄB — admin kasutab).

- `Popover` kontrollitud `open`: hõljumine (ainult hiir) avab 150 ms, lahkumine sulgeb 200 ms viivitusega (ka hüpikult lahkumine); klõps kinnitab (`pinned`), uus klõps sulgeb; **fookus avab** (klaviatuur), blur sulgeb, kui pole kinnitatud; Esc sulgeb ainult vihje. Laius 320px (`w-80`), `max-h-[min(60vh,420px)]`-laadne piir + kerimine (ui klass, ilma keelatud suvalise väärtuseta: kasuta `max-h-96 overflow-y-auto` või lisa `variants.ts`-i nimega klass). Trigger `asChild` + toores `<button>` ilma brauseri stiilita (`border-0 bg-transparent p-0`) või `Button variant="ghost" size="icon-xs"`; span-variant (nupu sees) jääb `role="button" tabIndex={0}`.
- Sisu sama (pealkiri + `sanitizeHelp` HTML `.help-content` klassiga). `helpStore` loogika ja tühja teksti korral mitte-renderdamine ei muutu.
- [ ] Steps: teisenda; kustuta surnud CSS; kontrollid; commit `refactor(ui): abivihje ui hüpiku peale (hõljumine, klõps, fookus)`; release; ekraanipilt põldude tabelist avatud vihjega (`--click` vihje nupul), mõlemad teemad; raport.

### Task 5: Ikoonnuppude vihjed

**Files:** `src/components/ui/Button.tsx`, `variants.test.ts`/uus `Button.test.tsx` (kui DOM-testid on võimalikud; muidu loogika eraldi funktsiooni ja testi seda), vaated, kus tekstita ikoonnupp on toores `<button title>` (inventuur 1.6: 38 toorest `button`-it — teisenda `Button size="icon*"`-iks ainult tekstita ikoonnupud).

- `Button`: kui `size` on `icon`/`icon-sm`/`icon-xs` ja `title` on antud → renderda `Tooltip content={title}` ümber, **eemalda natiivne `title`** (topeltvihje ei tohi tekkida), lisa `aria-label={props['aria-label'] ?? title}`; `disabled` korral `wrapDisabled`. Tekstiga nuppudel `title` jääb natiivseks (kasutaja otsus).
- `asChild` Buttonid (Radix trigger) — kontrolli, et Tooltip + DropdownMenuTrigger koos töötavad (Radix lubab pesastada `asChild` kaudu); kui ei, jäta trigger-nupud natiivse `title`-iga ja kirjelda.
- Toored tekstita ikoon-`<button title>` vaadetes → `Button variant="ghost" size="icon-sm"` (või sobiv), kui see ei muuda paigutust; muidu jäta ja loetle raportis.
- [ ] Steps: test (ikoon + title → vihje, natiivset title pole, aria-label olemas; tekstinupp → natiivne title); teosta; kontrollid; commit `feat(ui): tekstita ikoonnuppudel rakenduse stiilis vihje`; release; ekraanipilt hõljutatud ikoonnupuga (lisa `shot.mts`-ile `--hover "<css>"`), mõlemad teemad; raport (mitu nuppu sai vihje, mis jäi).

### Task 6: Kaardi hüpikute värvid, koristus, audit 0

**Files:** `src/index.css`, `src/components/ui/README.md`.

- Leaflet: `--popup-bg/-border/-text` (index.css hele ~44–46, tume ~90–92) seo menüüde teemaga (sama taust, ääris, tekst, vari ja nurk kui `menuContentClass`/`bg-popover`); Leafleti vaikimisi vihje (`.leaflet-tooltip`, sh ilma oma klassita `bindTooltip`: TripDialog, WeatherPointMap, sõidutrajektoor) ja `.leaflet-popup-content-wrapper`, `.leaflet-popup-tip` ning `.custom-field-tooltip` saavad samad värvid mõlemas teemas. Sisu ja paigutus ei muutu.
- Kustuta: kõik `.user-menu*`, `.operator-selector*`, `.map-context-menu*`, `.help-hint*` jäägid, mida Task 2–4 ei kustutanud; inventuuri jaotis 5 naabruse surnud reeglid (`.map-nav-toolbar`, `.map-nav-btn*`, `.toolbar-divider`, `.crop-legend-panel*`, `.crop-legend-header`, `.crop-legend-body` — `.crop-legend-item` JÄÄB). Enne iga kustutamist grep (ts/tsx/html-stringid, admin).
- `npm run ui-audit` → „Vanu menüüsid/hüpikuid (tsx)“ **0**. Sulgude tasakaal index.css-is.
- README: menüü/hüpiku/vihje reeglid (asChild, Esc, portaal, kahe rea kirje, märkeruudu kirje, filter-nupp, ikoonnupu vihje).
- [ ] Steps: teosta; kontrollid; commit `refactor(ui): kaardi hüpikud teemavärvidega; vanad menüüreeglid välja`; release; ekraanipildid kaardilt (hõljuta põldu `--hover`, ava sõiduki hüpik `--click` markeril, kui võimalik), mõlemad teemad; **kasutaja visuaalne kontroll** nimekiri raportisse.
