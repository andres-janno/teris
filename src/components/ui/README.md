# Ühised komponendid (`src/components/ui/`)

Spec: `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md`. Näidised: `/ui` (admin).

## Reeglid

- Nupud, dialoogid, tabelid, märgid, sakid, väljad, menüüd, hüpikud — ainult siit (`ui/`). Vaates ei looda neile uusi CSS-klasse.
- Kui vajalikku pole: lisa variant `variants.ts`-i (ja test) või uus komponent siia — mitte vaate-klass.
- Skaalad: kirjasuurus `text-2xs|xs|sm|base|lg|xl` (11/12/13/14/16/20 px); vahed 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8;
  nurgad `rounded-sm|md|lg|full`.
- Suvalised väärtused `text-[…]`, `p-[…]`, `m-[…]`, `gap-[…]`, `rounded-[…]`, `bg-[…]`, `border-[…]` on keelatud
  (`npm run ui-audit` näitab). Suurused (`w-[…]`, `max-h-[…]`) on lubatud.
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
    `orientation="vertical"` paneb üksteise alla) asendavad käsitsi tehtud `<label>` + märkeruut kombinatsioone.
  - Paigutus: `FormGrid` (`cols` 2 või 3, `span="full"`), `Field span="full"`, `FieldRow` (väli + nupp ühes reas).
  - `data-slot` nimed: `input`, `input-group`, `textarea`, `select`, `filter-select`, `filter-clear`, `date-picker`.
  - Toored `<input>` / `<select>` / `<textarea>` on keelatud; erand ainult `<input type="file">` ja `<input type="range">`
    (`type` esimese atribuudina). `npm run ui-audit` rida „Vanu vormivälju (tsx)“ peab jõudma nulli.
- Numbriveerg tabelis: `numeric` (paremale joondus); kogused `formatQty`.
- Klassid liida `cn()`-ga (mitte template-stringiga) — see lahendab Tailwindi konfliktid.
- `!`-utiliit (nt `!p-0`) ei võida vana CSS-i `!important` reeglit (`!important` puhul võidab varasem kiht, `legacy` on
  `utilities`-ist ees) — eemalda vana reegel.

## Dialoog

- `<Dialog open onOpenChange>` + `DialogContent size="sm|md|lg|xl|full|fit"` (vaikimisi `md`): sm 440, md 640, lg 840,
  xl 1240, full min(1600px, 96vw), fit sisu järgi. `fillHeight` annab fikseeritud kõrguse, `layer="alert"` z-5000.
- Sulgemine: Esc sulgeb alati; taustaklõps sulgeb ainult `closeOnOutsideClick` (kinnitus/teade) korral;
  `dismissible={false}` keelab mõlemad (sundparool, salvestamine käib).
- Vorm sisu juurena: `<DialogContent><DialogForm onSubmit>päis, keha, jalus</DialogForm></DialogContent>`.
- `DialogHeader icon title description` (+ lisanupud lastena; `showClose={false}` peidab sulgemisnupu).
- Hüpikud (kuupäev, otsinguga valik) portaali `usePopupContainer()` elementi, mitte `document.body`-sse.
- Üleminek: `modal-backdrop`/`modal-content` -> `Dialog`/`DialogContent`; `modal-header` -> `DialogHeader`;
  `modal-body`/`modal-footer` -> `DialogBody`/`DialogFooter`; Esc-kuulaja, taustaklõps, `createPortal`, `sub-modal`
  eemaldada (alamaken on oma `<Dialog>`). Vaates Tailwindi klasse ei lisata.

## Tabel

Vaates ei ole toorest `<table>`-it: kasuta `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`,
`TableCell`, `TableEmpty` (import `./ui` kaudu). Päis kleepub tabeli enda kerimisalas (vt allpool); numbrid paremale (`numeric`), kogused vormindab
kutsuja (`formatQty`). `<table>` kannab `data-slot="table"`, et vanad sisuklassid (`.muted`, `.cell-sub`) toimiksid.

| Komponent | Prop'id |
| --- | --- |
| `Table` | `scroll`: `x` (vaikimisi) / `none` / `sm` (40vh) / `md` (62vh) / `fill` (täislehe paneel); `bordered`; `dense`; `containerClassName` (ümbrisele); `className` (`<table>`-ile) |
| `TableFooter` | `sticky` (jalus kleepub alla) |
| `TableRow` | `selected` (valitud rida: hele roheline toon + roheline riba vasakus servas); `tone`: `success` / `warning` / `muted` (mitteaktiivne) / `group` (vahepealkiri) / `total`; `onClick` annab kursori |
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

## Tailwindi skaneerimine

Tailwind genereerib utiliite ainult kataloogist `src/components/ui` (`@source` failis `src/styles/app.css`).
Üleviidud fail lisa `app.css`-i `@source`-i; enne kontrolli, et failis pole vanu klassinimesid, mis kattuvad
Tailwindi utiliitidega (nt `text-muted`, `text-secondary`, `hidden`, `flex`) — muidu saavad need ootamatu stiili.

## Vana muutuja -> Tailwindi nimi

HOIATUS: vanad klassi- ja muutujanimed `text-muted` / `text-secondary` EI tähenda Tailwindi `text-muted` /
`text-secondary` utiliite. Tailwindi `text-muted` on taust (`--stat-bg`), mitte hall tekst. Hall abitekst on
`text-muted-foreground` või `text-subtle`.

| Vana muutuja (index.css) | Tailwindi nimi | Kasutus |
| --- | --- | --- |
| `--bg-dark` | `bg-background` | lehe taust |
| `--text-primary` | `text-foreground` | põhitekst |
| `--bg-surface` | `bg-card` | kaart (tahke; vana `--bg-card` on läbipaistev ja ainult legacy jaoks) |
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
| `--shadow-glass` | `shadow-card` | kaardi vari |
| `--shadow-modal` | `shadow-dialog` | dialoogi vari |

Kindlad värvid: `white`, `black`, `danger-solid` (#dc2626), `primary-from` / `primary-to` (põhinupu gradient),
`overlay` (dialoogi taust).

## Nupud: vana → uus

Üldnupud on ainult `<Button>` (`./ui`). Vanad klassid `btn*`, `icon-btn*` tuleb asendada; `npm run ui-audit` loeb neid kohti.

| Vana | Uus |
| --- | --- |
| `<button className="btn btn-primary">` | `<Button variant="primary">` |
| `btn btn-secondary` | `<Button>` (vaikimisi `secondary`, `md`) |
| `btn btn-ghost` | `<Button variant="ghost">` |
| `btn btn-danger` | `<Button variant="danger">` |
| `+ btn-sm` või `+ btn-xs` | `size="sm"` |
| `btn btn-secondary btn-icon-only` | `<Button size="icon">` |
| `icon-btn-ghost`, `icon-btn` | `<Button variant="ghost" size="icon-sm">` |
| `icon-btn-danger` | `<Button variant="danger-ghost" size="icon-sm">` |
| `icon-btn-ghost-sm` | `<Button variant="ghost" size="icon-xs">` |
| `` `btn btn-sm ${c ? 'btn-primary' : 'btn-secondary'}` `` | `variant={c ? 'primary' : 'secondary'} size="sm"` |
| `` `btn btn-secondary ${c ? 'active' : ''}` `` | `<Button>`; `active` jäetakse ära, üldnupul pole `.active` reeglit |
| `btn-full` | jääb `className="btn-full"` (ainult laius 100%) |

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
  - `interactive` (kursor, tahke hover) ja `selected` (roheline ääris + rõngas; hover seda ei nõrgenda). `<button>`-kaardi font/text-align/värv tuleb `app.css` base-kihist (`button[data-slot="card"]`), nii et vaate klassi kirjasuurus kehtib.
  - `asChild`: `<Card asChild interactive><button type="button">…</button></Card>`, samuti `<form>`, `<section>`.
- Kaart ei sea teksti värvi (pärib), v.a `interactive`.
- Päis: `CardHeader` (`align="center|start"`), `CardTitle` (`as="h2|h3|h4"`, vaikimisi h3), `CardActions` (paremale).
  `Panel` = kaart + päis äärisega + sisu.
- Vaate klass kaardil annab **asetuse, kirjasuuruse ja tekstivärvi** (position, z-index, flex, gap, margin, font-size, color); polstri ainult
  `padding="none"` korral. Välimuse (taust, ääris, nurk, vari, polster) annab `Card`. Vaate olekureegel, mis peab `Card`-i üle võitma (staatuse
  ääris, toonitud taust, erandnurk), vajab `!important` (`index.css` on `legacy` kihis). `admin.css` on kihistamata
  ja võidab ise — sealt kustuta kaardiga dubleeruvad polstrid ja äärised.
- Vana `.glass-card` on kustutatud (etapp 2.7); uut klaasikaarti ei tehta.
- `npm run ui-audit` rida „Vanu kaarte“ peab olema 0.
- Erandid (jäävad oma CSS-iga): `login-card`, `fw-card`, `telemetry-suggestions-card`, `fleet-card-notes`,
  `fw-panel-empty`, `crop-group-empty`, `party-role-checkbox`. Märgid/valikud (`reg-stat-pill`, `register-crop-stat`,
  `cc-stat`) ja Leafleti hüpikud ei ole kaardid; `detail-section`, `section-title`, `admin-subpanel`, `admin-card-head`,
  `admin-card-foot` kannavad ainult asetust.

## Menüüd, hüpikud, vihjed

- `DropdownMenuContent`, `ContextMenuContent`, `PopoverContent` ja `Tooltip` portaalivad avatud dialoogi sisse (`usePopupContainer`) ja Esc sulgeb ainult nemad (ei levi taha). Menüü ja `PopoverContent` kõrgus piirdub vaba ruuminga ja kerib (Tooltipil piirangut pole — hoia tekst lühike).
- Kirjel ikoon: pane `<Icon />` ilma suuruseta (16px tuleb menüüst). Kahe rea kirje: `<DropdownMenuItem className="items-start"><MenuItemText title description /></DropdownMenuItem>`.
- Märkeruudu kirje `DropdownMenuCheckboxItem`: menüü jääb avatuks, kui annad `onSelect={(e) => e.preventDefault()}`.
- `PopoverAnchor` seab hüpiku asukoha muu elemendi külge.
- Päästik: `Trigger` alati `asChild` + `Button` (toores `<button>` jääks preflight'i puudumisel halliks brauserinupuks).
- `collisionPadding` on menüüdel, `PopoverContent`-il ja `Tooltip`-il 8 (Select, DateInput ja FilterSelect kasutavad Radixi vaikimisi väärtust) (ekraani serva ei puudutata); ära kirjuta üle.
- Vihje: ainult tekstita ikoonnuppudele. `<Button size="icon" title="…">` saab rakenduse vihje automaatselt ja on alati `<span>`-ga ümbritsetud (keelatud nupp ei kaota fookust ega vihjet). Kärbitud tekst ja muu `title=` jäävad brauseri omaks.
- `TooltipProvider` peab olema igas React juures (`main.tsx`, `admin/main.tsx` ja kinnitusakna oma juur `ConfirmDialog`); uus juur ilma selleta kukub vihjel.
- Kaardi (Leaflet) hüpikud ja vihjed (`.leaflet-popup-*`, `.leaflet-tooltip`, `.custom-field-tooltip`) loevad värvi `--popup-*` muutujatest, mis viitavad menüüde omadele (`--bg-modal`, `--border-card`, `--text-primary`). Muuda värvi seal, mitte reeglites.
- `<Button variant="filter" size="auto">` — päise rohelise pillina nupp (operaatorivalija).
- Portaalis sisu tunneb ära `closest('[data-radix-popper-content-wrapper], [role="listbox"]')`.
