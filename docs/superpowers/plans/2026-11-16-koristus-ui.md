# UI ühtlustamise koristusetapp (3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ühtlustamise viimane etapp: katkised viited parandatud, surnud CSS kustutatud (~1000 rida `index.css`-ist), kontrast AA mõlemas teemas, ikoonnupud ja pseudo-tabelid ui komponentidel klaviatuuriligipääsuga, staatilised inline-stiilid klassides, andmevärvid ühes failis, kirjasuurused/nurgad/vahed skaalal ning teenusepakkuja admin ühiskomponentidel.

**Architecture:** Üheksa järjestikust ülesannet, iga = eraldi commit + release. Algul madala riskiga puhastus (katkised viited, surnud CSS, auditi valvurid), siis tokenite ja ui variantide muudatused (kontrast, ikoonnupud, tabelid), siis vaadete koristus (inline-stiilid, andmevärvid), siis skaalade mehaaniline asendus skriptiga ja viimasena admin. Iga uus reegel saab valvuri: vitest (`variants.test.ts`, `contrast.test.ts`, `uiAudit.test.ts`, `cssScale.test.ts`) või `npm run ui-audit` rea, mis peab jääma nulli.

**Tech Stack:** React 19 + TS, Tailwind v4 (skaneerib AINULT `src/components/ui`), Radix (`radix-ui`), class-variance-authority, tailwind-merge (`cn`), vitest (node keskkond, ainult `*.test.ts`), oxlint, Playwright (`scripts/shot.mts`).

**Spec:** `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md` (etapp 3 „Koristus“, „Kontroll“ edukriteeriumid, „Riskid“ CSS-kihtide kohta) · **Inventuur:** `docs/superpowers/plans/2026-11-16-koristus-inventuur.md` (fail:rida viited, arvud, kontrastitabelid). Reanumbrid on HEAD `876ae54` seisuga; pärast eelmisi ülesandeid on need nihkunud — otsi klassinime või teksti järgi. **NB:** inventuuri 8B „kindlalt kasutuseta“ loetelu oli osaliselt vale (`add-work-*`, `ai-key-*`, `articles-tabs`, `stock-qty`, `form-section-title`, `animate-slide-in`, `article-npk-inputs` jt ON kasutusel) — Task 2 kasutab plaani koostamisel kontrollitud loetelu.

## Global Constraints

**Kasutaja otsused (2026-11-16), siduvad — sõna-sõnalt:**

1. Ikoonnupud: **kolm suurust** — tabelis väike 20px, tööriistaribal keskmine 28px, esitusnupp suur 40px; ühtne stiil (ui Button / IconButton variandid), tihedus jääb.
2. index.css vähendus selles etapis **~1000 rida** (7758 → ~6800): kasutuseta klassid, pseudo-tabelid ui Table peale, ikoonnupud. Vaated jäävad oma stiilidega; Tailwindi skaneerimist vaadetele EI laiendata. ~2000 eesmärk jääb hilisemaks etapiks (märgi spec'i/README-sse).
3. Kontrast: **tumedam roheline** — primaarnupp ja märgid tumedama rohelisega, nii et valge tekst/märgitekst täidab 4.5:1 mõlemas teemas; tumedas teemas kollane hoiatusmärk (warning solid) tumeda tekstiga; ka `text-subtle` hele teema ja muud inventuuris loetletud < 4.5 paarid parandada. Lisa test(id), mis arvutab kontrasti tokenitest (kui teostatav), et regressioon ei tuleks.
4. Defineerimata värviklassid (~110): **ainult dialoogipäised** — dialoogi päise ikoonid ühtselt roheliseks ühes kohas (DialogHeader/ui tasemel); ülejäänud mittetöötavad `text-*` klassid kustutada, välimus jääb nagu praegu. Samuti parandada 7 defineerimata CSS-muutujat ja `link-button` (inventuuri „Muud leiud“).
5. Admin (admin.teris.ee) **viiakse ühiskomponentidele viimase ülesandena** (Button, Table, Input jt), ui-audit laiendatakse admin/landing'ule, vanad `.btn` jm klassid kustutatakse, kui enam keegi ei kasuta.
6. Kirjasuurused: väikseimad (0.6–0.66rem) **kerkivad 11px-ni**; kirjasuurusi kokku ≤6, nurki ≤4, vahed skaalast (spec). Kontrolli mini-nupud ja `soil-footnote` pildilt.
7. Klaviatuuriligipääs klikitavatele div-kaartidele/ridadele: teha ui tasemel (`TableRow` klikitav, `Card interactive`) koos pseudo-tabelite ülesandega; ülejäänud toored klikitavad divid loetle ja paranda, kui lihtne (role/tabIndex/Enter-Space), muidu pargi.
8. Inline stiilid: staatilised korduvad mustrid klassideks/komponentideks (FilterBar, EmptyState jne); dünaamilised jäävad. Andmevärvid ühte faili (nt `src/lib/dataColors.ts`), dubleeritud paletid ühendada.

**Plaani koostaja otsused (otsuste 1–8 rakendamiseks):**

- Ikoonnupu suurused `Button`-is: `icon-xs` 20px (tabel, kaardi nurk), `icon-sm` 28px (tööriistariba, päis), **uus `icon-lg` 40px ümmargune** (esitusnupp). Senine `icon` (32px) **kustutatakse** (kasutus: `UserMenu.tsx:91` väljalogimine → `icon-sm`, galerii). Tekstiga mini-nupp: uus `size="xs"` (20px, 11px kiri). Lingina nupp: uus `variant="link"` + `size="inline"`. Valitud olek: `aria-pressed` stiil variantidel `ghost` ja `secondary`.
- Kontrast: heleda teema `--emerald-500` → `#15803d`, `--emerald-600` → `#166534`, `--amber-500` → `#b45309`, `--text-muted` → `#64748b`; tumeda `--text-muted` → `#8796ab`; põhinupu gradient `#166534 → #15803d` mõlemas teemas; uued toonitekstid `--tone-*-text` ja `--tone-info-solid`/`--tone-accent-solid`/`--on-warning` (vt Task 3). Kõik paarid käsitsi arvutatud ≥ 4.5 (test kinnitab).
- Andmevärvide fail: `src/lib/dataColors.ts` (server impordib `.ts` laiendiga).
- `login-forgot-link` (sisselogimise leht) ja `fw-add` (tahvli tühi lahter) jäävad oma stiiliga (erijuhud, nagu `login-card`). Valitavad kaardid/kiibid (inventuur 1D) ei kuulu ikoonnuppude ülesandesse.
- `App.css` pole kuskil imporditud (Vite malli jääk) → kustutatakse tervikuna.

**Keskkond ja kontrollid:**

- Kood on serveris. Käsud: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount: Read/Write/Edit töötavad; **git ja grep jooksuta serveris** (kohalik git annab SIGBUS-i). Kui mount katkeb („Device not configured“), kirjuta fail scratch-kausta ja kopeeri `scp`-ga serverisse.
- **grep-lõks serveris:** `--include` peab olema ENNE mustrit; muster `-e`-ga: `grep -rn --include='*.tsx' --include='*.ts' -e 'muster' src`. Kui `--include` on pärast `--`-i või mustrit, loeb grep selle failinimeks ja annab vale tulemuse.
- Kontrollid iga ülesande lõpus (serveris):
  - `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`
  - `npx vitest run src/tooling src/components/ui` (+ ülesandes nimetatud lisatestid)
  - `npx oxlint <muudetud failid>`
  - `npm run ui-audit -- --details` — oodatavad read on igas ülesandes kirjas; kui erineb, kirjelda raportis miks.
  - `wc -l src/index.css` — oodatav vahemik ülesandes.
- **Commit + release iga ülesande lõpus:** commit masteril, failid nime järgi (`git add <failid>`, mitte `-A`); sõnum lõpeb reaga `Co-Authored-By: Claude Sonnet <noreply@anthropic.com>` (implementeerija mudel; kui sinu sessiooni attribution-meeldetuletus annab teise rea, kasuta seda). Seejärel `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` → `EXIT=0` ja `systemctl is-active teris` → `active`.
- **Visuaalne kontroll iga ülesande lõpus (kohustuslik), pärast release'i:**
  ```bash
  ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && rm -f /tmp/shots/*.png && npx tsx scripts/shot.mts --user andresj --height 1600 <ülesande argumendid> <tee>'
  scp -q -o BatchMode=yes 'debian@uvn-243-120.tll07.zonevs.eu:/tmp/shots/*.png' <sinu kohalik scratch-kaust>/
  ```
  Skript teeb iga pildi heledas ja tumedas. Vaata pilte Read-tööriistaga; lõika vajadusel `sips -c H W --cropOffset Y X`. Põhivaated: `--do 'click:.main-view-switch >> text=<Nimi>'` (Kaart, Põllud, Kultuurid, Külvikord, Põllutööd, Laoarvestus, Tehnika, Taristu, Isikud, Ilm, Hooajad). Admin: `--platform '*'`; sisselogimisleht: `--anon`. Kui ülesande `click:` selektor ei leia elementi, leia õige `grep`-iga (nupu tekst/`title`) ja kirjuta raportisse nii kasutatud käsk kui ka põhjus. Raportisse: millised pildid vaatasid ja mida nägid. **Viga** on: nähtamatu/kahvatu tekst, hall brauseri vaikenupp, nihkunud paigutus, kadunud olekuvärv (valitud, aktiivne), valge plokk tumedas teemas.

**Konventsioonid:** identifikaatorid (klassid, muutujad, failinimed, CSS-muutujad) inglise keeles; kommentaarid ja UI-tekst eesti keeles; numbrid paremale (`className="num"` / `TableCell numeric`); kogused `formatQty`; kuupäevad pp.kk.aaaa (`DateInput`, `formatDate`).

**Lõksud varasematest etappidest:**

- Tailwind skaneerib ainult `src/components/ui` (`@source` failis `src/styles/app.css`). **Vaadetes Tailwindi klasse kasutada ei saa** — need ei genereeru (otsus: jääb nii). Vaate-spetsiifiline välimus = `index.css` klass või ui komponendi prop.
- Preflight puudub: toores `<button>` on hall brauserinupp; Radix `Trigger` alati `asChild` + `Button`.
- `index.css` on kihis `legacy` (enne `utilities`): legacy reegel, mis peab ui utiliidi (nt `Button` taust, `justify-center`) üle võitma, vajab `!important`. `!`-utiliit ei võida legacy `!important`-i (varasem kiht võidab).
- `src/admin/admin.css` on **kihistamata** ja võidab utiliite ise — admini üleviimisel kustuta sealt ui-ga dubleeruvad reeglid.
- `-webkit-backdrop-filter` enne `backdrop-filter` (kui kuskil vaja).
- Duplikaatplokkide kustutamisel kontrolli, millist plokki asendus tabas (eelmises etapis kustutati kogemata heleda teema muutujad). `index.css`-is on `:root` plokke mitu (rida 4 hele teema, 58 tume, 2242/2250 `--fresh-*`) — muuda alati õiget.
- `--popup-*` muutujad on ühes kohas (`:root`, rida ~48) ja viitavad menüü omadele — ära dubleeri.
- Vitest jookseb node keskkonnas ja loeb ainult `src/**/*.test.ts` (mitte `.tsx`) — komponentide käitumist testi puhaste funktsioonide/klassistringide kaudu.
- Server impordib `.ts` laiendiga (`from './fieldSeasonCopy.ts'`); `tsc -b` (release'i `npm run build`) kukub, kui serveri import on laiendita.

---

## Failid

| Fail | Vastutus | Ülesanded |
|---|---|---|
| `src/components/ui/variants.ts`, `variants.test.ts` | nupu `link`/`inline`/`xs`/`icon-lg`/pressed, märkide toonid, dialoogi päise ikoon, tabeli/kaardi fookus, FilterBar/EmptyState klassid | 1, 3, 4, 5, 6 |
| `src/components/ui/Dialog.tsx` | päise ikoon roheline | 1 |
| `src/components/ui/iconTooltip.ts(.test.ts)` | ikoonnupu suurused | 4 |
| `src/components/ui/Table.tsx`, `Card.tsx`, uus `keyActivation.ts(.test.ts)` | Enter/Space klõpsatavatel ridadel/kaartidel | 5 |
| uus `src/components/ui/FilterBar.tsx`, `EmptyState.tsx` | filtririba, tühi olek | 6 |
| `src/components/ui/index.ts`, `UiGallery.tsx`, `README.md` | eksport, näidised, reeglid | 1, 3–9 |
| `src/styles/app.css` | värvinimed (toonitekstid, gradient) | 3 |
| `src/index.css` | muutujad, surnud klassid, tokenid, nuppude/tabelite CSS, skaalad | 1–9 |
| uus `src/tooling/contrast.ts(.test.ts)` | kontrastsuhe tokenitest | 3 |
| `src/tooling/uiAudit.ts(.test.ts)`, `scripts/ui-audit.mts` | read: defineerimata muutujad, kasutuseta klassid, skaalavälised väärtused, admin/landing | 1, 2, 8, 9 |
| uus `src/tooling/cssScale.ts(.test.ts)`, `scripts/css-scale.mts` | skaalade asendus | 8 |
| uus `src/lib/dataColors.ts(.test.ts)` | andmevärvid | 7 |
| `src/types/soilSample.ts`, uus `soilSample.test.ts`, `src/types/fieldWork.ts` | mulla tase, faasi toon | 3, 7 |
| vaated `src/components/*.tsx` | üleviimine | 1, 3–7 |
| `src/admin/*.tsx`, `src/admin/admin.css` | admin ui-le | 9 |
| `src/App.css` | kustutatakse | 2 |
| spec, README | ~2000 rea eesmärk hilisemaks | 2 |

---

### Task 1: Katkised viited — dialoogi päise ikoon, mittetöötavad `text-*` klassid, defineerimata muutujad, link-nupp

**Nähtav mõju:** dialoogide päise ikoonid muutuvad roheliseks (kõik ~45 dialoogi); `link-button` ja `assign-hint-link` muutuvad roheliseks tekstilingiks; mõned äärised/hover-taustad, mis puudusid, ilmuvad (defineerimata muutujad). Muu välimus jääb.

**Files:**
- Modify: `src/components/ui/variants.ts:9-38` (`buttonVariants`), lisa `dialogHeaderIconClass`
- Modify: `src/components/ui/Dialog.tsx:105` (päise ikooni ümbris)
- Modify: `src/components/ui/variants.test.ts` (`allClassStrings`, tsüklid, uus `describe`)
- Modify: `src/components/ui/UiGallery.tsx:59-71` (Nupud: link-näide)
- Modify: `src/components/ui/README.md` (Nupud, Dialoog, Reeglid)
- Modify: `src/components/WeatherSeasonSection.tsx:75`, `src/components/VehicleTracker.tsx:1253`, `src/components/DeviceAssignmentRegister.tsx:392`
- Modify: `src/index.css` (muutujad ridadel 326, 817, 3215, 3216, 3339, 3824, 3920, 3949, 4060, 4062, 4071, 4932, 5097, 5273, 5781, 5983, 6779, 7609; `.assign-hint-link` 7217–7229; `--border-strong` heleda teema plokki)
- Modify: `src/admin/admin.css:53,152`
- Modify: 40 vaatefaili (`text-*` klassid, loetelu Step 8)
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts` (rida „Defineerimata CSS-muutujaid“)

**Interfaces:**
- Produces: `buttonVariants` variant `link`, suurus `inline`; `dialogHeaderIconClass: string`; `undefinedCssVars(css: string[], tsx: string[]): string[]` (`uiAudit.ts`).
- Task 4 kasutab `variant="link"` (`cc-link-btn`).

- [ ] **Step 1: Kirjuta failivad testid (variandid)**

`src/components/ui/variants.test.ts`: `allClassStrings` esimene plokk muuda kujule

```ts
  ...(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'filter', 'link'] as const).flatMap((variant) =>
    (['sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon', 'auto'] as const).map((size) => v.buttonVariants({ variant, size }))
  ),
```

ja lisa massiivi lõppu (enne `];`) `v.dialogHeaderIconClass,`. Testides „nupu äärevärv on täpselt üks variandis“ ja „keelatud nupp jääb hõljutatavaks…“ lisa variantide massiivi `'link'` ja suuruste massiivi `'inline'`. Lisa faili lõppu:

```ts
describe('link-nupp ja dialoogi päis', () => {
  it('link: roheline tekst, ilma tausta ja äärisvärvita, hõljudes allajoon', () => {
    const c = v.buttonVariants({ variant: 'link', size: 'inline' });
    expect(c).toContain('text-primary');
    expect(c).toContain('bg-transparent');
    expect(c).toContain('border-transparent');
    expect(c).toContain('enabled:hover:underline');
  });
  it('inline: kõrgus ja polster puuduvad, kirjasuurus pärib ümbritsevast tekstist', () => {
    const c = cn(v.buttonVariants({ variant: 'link', size: 'inline' }));
    expect(c).toContain('h-auto');
    expect(c).toContain('p-0');
    expect(c).toContain('[font-size:inherit]');
  });
  it('dialoogi päise ikoon on roheline (üks koht kõigile dialoogidele)', () => {
    expect(v.dialogHeaderIconClass).toContain('text-primary');
    expect(v.dialogHeaderIconClass).toContain('shrink-0');
  });
});
```

- [ ] **Step 2: Kirjuta failiv test (auditi defineerimata muutujad)**

`src/tooling/uiAudit.test.ts`: kohanda importi `import { auditCss, auditTsx, legacyCardRules, summarize, undefinedCssVars } from './uiAudit';` ja lisa lõppu:

```ts
describe('defineerimata CSS-muutujad', () => {
  it('leiab var(--x), mida pole üheski CSS-is ega tsx-i style-võtmes; radix/tw muutujad ei loe', () => {
    const css = [
      ':root { --a: 1px; } .x { --local: 2px; color: var(--a); margin: var(--local); border: var(--missing); }',
      '.y { height: var(--radix-popover-content-available-height); width: var(--tw-x); background: var(--from-tsx); gap: var(--gone, 4px); }',
    ];
    const tsx = ["<div style={{ '--from-tsx': c } as React.CSSProperties} />"];
    expect(undefinedCssVars(css, tsx)).toEqual(['--gone', '--missing']);
  });
});
```

- [ ] **Step 3: Käivita testid — peavad kukkuma**

Run: `npx vitest run src/components/ui/variants.test.ts src/tooling/uiAudit.test.ts`
Expected: FAIL (`link` ja `inline` puuduvad; `dialogHeaderIconClass` on `undefined`; `undefinedCssVars` pole eksporditud).

- [ ] **Step 4: Implementeeri variandid**

`src/components/ui/variants.ts` — `buttonVariants` `variant` objekti lõppu (pärast `filter`):

```ts
        // Tekstilink nupuna (vana .link-button, .assign-hint-link, .cc-link-btn): roheline tekst, hõljudes allajoon.
        link: 'border-transparent bg-transparent text-primary underline-offset-2 enabled:hover:underline',
```

`size` objekti (pärast `md`):

```ts
        // Lõigu sees: kõrgus ja polster puuduvad, kirjasuurus tuleb ümbritsevast tekstist.
        inline: 'h-auto p-0 [font-size:inherit]',
```

Faili dialoogi plokki (`DIALOG_SIZES` ette):

```ts
/** Dialoogi päise ikoon: alati põhivärv (kasutaja otsus 2026-11-16) — vaade annab ainult ikooni, mitte värvi. */
export const dialogHeaderIconClass = 'flex shrink-0 items-center text-primary';
```

`src/components/ui/Dialog.tsx` — impordi `dialogHeaderIconClass` (`./variants`) ja asenda rida 105:

```tsx
      {icon && <span className={dialogHeaderIconClass}>{icon}</span>}
```

- [ ] **Step 5: Implementeeri `undefinedCssVars` ja auditi rida**

`src/tooling/uiAudit.ts` faili lõppu:

```ts
// Defineerimata CSS-muutuja: var(--x) on kasutusel, aga --x: pole ühelgi CSS-reeglil ega tsx-i style-võtmena.
// Brauser ignoreerib siis kogu deklaratsiooni (ääris = currentColor, taust läbipaistev). Radixi ja Tailwindi
// käitusaja muutujad (--radix-*, --tw-*) ei loe. Varuväärtusega var(--x, y) loeb samuti (varuväärtus peidab vea).
const VAR_USE = /var\(\s*(--[\w-]+)/g;
const VAR_DEF_CSS = /(--[\w-]+)\s*:/g;
const VAR_DEF_TSX = /['"](--[\w-]+)['"]\s*:/g;

export function undefinedCssVars(css: string[], tsx: string[]): string[] {
  const defined = new Set<string>();
  for (const c of css) for (const m of c.replace(/var\([^)]*\)/g, '').matchAll(VAR_DEF_CSS)) defined.add(m[1]);
  for (const t of tsx) for (const m of t.matchAll(VAR_DEF_TSX)) defined.add(m[1]);
  const used = new Set<string>();
  for (const c of css) for (const m of c.matchAll(VAR_USE)) used.add(m[1]);
  return [...used].filter((v) => !defined.has(v) && !/^--(radix|tw)-/.test(v)).sort();
}
```

`scripts/ui-audit.mts`: impordi `undefinedCssVars` ja lisa faili lõppu:

```ts
// Muutujad: kõik CSS-failid (sh admin, landing, styles) ja kõik tsx-id (style-võtmed).
const allCss = walk('src', []).filter((p) => p.endsWith('.css')).map((p) => readFileSync(p, 'utf8'));
const allTsx = walk('src', []).filter((p) => p.endsWith('.tsx')).map((p) => readFileSync(p, 'utf8'));
const undefinedVars = undefinedCssVars(allCss, allTsx);
row('Defineerimata CSS-muutujaid', undefinedVars.length, undefinedVars);
```

Run testid → PASS. `npm run ui-audit -- --details | grep Defineerimata` enne Step 6: `--accent --amber-600 --bg-hover --bg-input --border-color --border-strong --border-subtle --emerald-300` (8; `--crop-color`, `--next-crop-color`, `--fresh` peavad olema defineeritud — kui ilmuvad, paranda regexit, mitte CSS-i).

- [ ] **Step 6: Paranda defineerimata muutujad**

`src/index.css` (HEAD read; kontrolli enne iga asendust, et rida sisaldab vana väärtust):

| Rida | Vana | Uus |
|---|---|---|
| 326, 817 | `background: var(--border-subtle);` | `background: var(--border-card);` |
| 3824 | `border-top: 1px dashed var(--border-subtle);` | `border-top: 1px dashed var(--border-card);` |
| 3920 | `border-color: var(--border-subtle);` | `border-color: var(--border-card);` |
| 6779 | `border-top: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.05));` | `border-top: 1px solid var(--border-card);` |
| 3216, 4062, 4071 | `border: 1px solid var(--border-color);` | `border: 1px solid var(--border-card);` |
| 3339 | `border-bottom: 1px solid var(--border-color);` | `border-bottom: 1px solid var(--border-card);` |
| 5781, 5983 | `border: 1px dashed var(--border-color);` | `border: 1px dashed var(--border-card);` |
| 3215, 4060 | `background: var(--bg-input);` | `background: var(--input-bg);` |
| 5097 | `color-mix(in srgb, var(--bg-hover) 35%, transparent)` | `color-mix(in srgb, var(--stat-bg-hover) 35%, transparent)` |
| 5273 | `background: var(--bg-hover);` | `background: var(--stat-bg-hover);` |
| 3949 | `border-color: var(--emerald-300);` | `border-color: var(--emerald-400);` |
| 4932 | `var(--border-strong, #94a3b8)` | `var(--border-strong)` |
| 7609 | `color: var(--amber-600, #d97706);` | `color: var(--amber-500);` |

Heleda teema plokki (`:root,\n:root[data-theme="light"] {`, rida 4–56) pärast rida `--border-highlight: …;` lisa:

```css
  /* Tugevam eraldusjoon (vasak serv); tume teema pärib sama väärtuse */
  --border-strong: #94a3b8;
```

`src/admin/admin.css`: rida 53 `var(--border-subtle, rgba(0, 0, 0, 0.15))` → `var(--border-card)`; rida 152 `var(--accent, #10b981)` → `var(--emerald-500)`.

Kontroll: `npm run ui-audit -- --details | grep Defineerimata` → `0`.

- [ ] **Step 7: Link-nupud**

| Fail:rida | Vana | Uus |
|---|---|---|
| `WeatherSeasonSection.tsx:75` | `<button type="button" className="link-button" onClick={onEditSeeding}>Sisesta külvikuupäev</button>` | `<Button variant="link" size="inline" onClick={onEditSeeding}>Sisesta külvikuupäev</Button>` (lisa `import { Button } from './ui';`) |
| `VehicleTracker.tsx:1253` | `<button type="button" className="assign-hint-link" onClick={…}>` … `</button>` | `<Button variant="link" size="inline" onClick={…}>` … `</Button>` |
| `DeviceAssignmentRegister.tsx:392` | sama | sama (kontrolli `Button` importi) |

`src/index.css`: kustuta `.assign-hint-link { … }` ja `.assign-hint-link:hover { … }` (HEAD 7217–7229). Enne: `grep -rn --include='*.tsx' --include='*.ts' -e 'assign-hint-link' -e 'link-button' src` → tühi.

- [ ] **Step 8: Eemalda mittetöötavad `text-*` klassid**

Klassid `text-emerald`, `text-muted`, `text-blue`, `text-amber`, `text-rose`, `text-purple`, `text-secondary`, `text-slate-400` pole üheski CSS-is defineeritud (kontrolli: `grep -n -E '\.text-(emerald|muted|blue|amber|rose|purple|secondary|slate-400)([^a-z-]|$)' src/index.css src/admin/admin.css src/styles/app.css` → tühi). Kasutused (HEAD):

- `AddFieldWorkDialog.tsx:95` · `AiConnectionModal.tsx:89` · `ArticleCategoriesDialog.tsx:62` · `ArticleFormDialog.tsx:119` · `ArticleMergeDialog.tsx:57` · `ArticleStockCard.tsx:51` · `ArticlesView.tsx:148,177` · `ChangePasswordModal.tsx:60`
- `CropRegisterModal.tsx:355,406,587,877,903` · `DeviceAssignmentRegister.tsx:181,350` · `FieldBookUploadModal.tsx:108,133,138` · `FieldEditDialog.tsx:323` (×2) · `FieldManagerModal.tsx:360,371,384,657` · `FieldShapeModal.tsx:54`
- `FieldUploadModal.tsx:179,202,207` · `FieldWorksBoard.tsx:682,694` · `FieldsTableView.tsx:243,256` · `FinanceModal.tsx:558,592,670,682,690,695,736,751,792,844` · `HarvestLotDialog.tsx:143` · `InventoryDialog.tsx:115`
- `LayerControl.tsx:91,461` · `MapYearSelector.tsx:83,118` · `PoiManagerModal.tsx:254 (×2),264,384,436,440,448,450,454,469` · `RelatedPartiesModal.tsx:248,427,570,576,594,608,645`
- `SeasonManagerModal.tsx:135 (×2),303` · `SoilSampleUploadModal.tsx:93,115,120` · `StockDocumentDialog.tsx:100` · `TripDialog.tsx:144` · `TripRegister.tsx:139` · `UsersAdminModal.tsx:144,246`
- `VehicleTracker.tsx:822,964,1073,1184,1362,1382,1420,1428,1436,1444,1453,1534,1547,1554,1560,1562,1567,1626 (×2),1689,1701,1794,1985,2005 (×2),2030,2051,2078`
- `WarehousesPanel.tsx:114` · `WeatherCredentialModal.tsx:85` · `WeatherView.tsx:60` · `WorkRegisterModal.tsx:84,138`

Reegel (fail→vana→uus):

| Vana | Uus |
|---|---|
| `className="text-emerald"` (ainus klass; samuti `text-muted`, `text-blue`, `text-amber`, `text-rose`, `text-purple`, `text-secondary`, `text-slate-400`) | atribuut kustub |
| `className="animate-spin text-emerald"` | `className="animate-spin"` |
| `className="sub-val text-emerald"`, `"sub-val text-blue"` | `className="sub-val"` |
| `className="v-info-item text-muted"` | `className="v-info-item"` |
| `className="text-muted text-xs"` (FinanceModal 592, 844) | `className="text-xs"` |
| `className={dev.ignition ? 'text-emerald' : 'text-muted'}` (VehicleTracker 1689) | atribuut kustub (käsitsi) |

Mehaaniline asendus serveris (`components/ui/` välja):

```bash
FILES=$(grep -rl --include='*.tsx' -E -e '(^|["'"'"' {`])text-(emerald|muted|blue|amber|rose|purple|secondary|slate-400)(["'"'"' }`]|$)' src | grep -v components/ui/)
grep -rho --include='*.tsx' -e 'text-muted-foreground' src | wc -l   # kirjuta arv üles (enne)
perl -0pi -e '
  my $c = qr/text-(?:emerald|muted|blue|amber|rose|purple|secondary|slate-400)(?![\w-])/;
  s/ className="$c"//g;
  1 while s/(className="[^"]*?)\s*(?<![\w-])$c/$1/g;
  s/className="\s+/className="/g;
' $FILES
```

Pärast käsitsi `VehicleTracker.tsx` ternaar (rida ~1689) — eemalda `className={…}` tervikuna. Kontroll:

```bash
grep -rn --include='*.tsx' --include='*.ts' -E -e '(^|["'"'"' {`])text-(emerald|muted|blue|amber|rose|purple|secondary|slate-400)(["'"'"' }`]|$)' src | grep -v components/ui/   # tühi
grep -rho --include='*.tsx' -e 'text-muted-foreground' src | wc -l   # sama arv mis enne
git diff --stat   # ainult loetelu failid
```

- [ ] **Step 9: Galerii ja README**

`UiGallery.tsx` Nupud-sektsiooni (rida ~70, enne `</Section>`) lisa: `<p className="text-sm">Lõigu sees: <Button variant="link" size="inline">ava register</Button></p>`.

`README.md`, „Nupud: vana → uus“ tabelisse rida: `` `link-button`, `assign-hint-link` `` → `<Button variant="link" size="inline">`. Jaotisse „Dialoog“ punkt: „Päise ikoon on alati roheline (`dialogHeaderIconClass`); vaade annab ainult ikooni, värvi (`className`) mitte.“ Jaotisse „Reeglid“: „Vaates ei kasutata `text-emerald`/`text-muted`/`text-blue`… — need pole kunagi olnud defineeritud. Värv tuleb ui komponendist või vaate CSS-klassist. `npm run ui-audit` rida „Defineerimata CSS-muutujaid“ peab olema 0.“

- [ ] **Step 10: Testid ja kontrollid**

`npx vitest run src/tooling src/components/ui` → PASS. `tsc`, `npx oxlint src/components/ui src/tooling scripts/ui-audit.mts src/components/WeatherSeasonSection.tsx src/components/VehicleTracker.tsx src/components/DeviceAssignmentRegister.tsx`.

Oodatav `npm run ui-audit -- --details`: „Defineerimata CSS-muutujaid“ **0**; „Vanu komponendiklasse (CSS)“ 6 (muutumata); muud read muutumata. `wc -l src/index.css` ≈ 7 746–7 750.

- [ ] **Step 11: Commit + release**

```bash
git add src/components/ui/variants.ts src/components/ui/variants.test.ts src/components/ui/Dialog.tsx src/components/ui/UiGallery.tsx src/components/ui/README.md src/tooling/uiAudit.ts src/tooling/uiAudit.test.ts scripts/ui-audit.mts src/index.css src/admin/admin.css $FILES src/components/WeatherSeasonSection.tsx src/components/DeviceAssignmentRegister.tsx
git commit -m "fix(ui): dialoogi päise ikoon roheliseks, mittetöötavad text-* klassid välja, defineerimata CSS-muutujad, link-nupp" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

Release (vt Global Constraints).

- [ ] **Step 12: Ekraanipildid**

1. Galerii: `npx tsx scripts/shot.mts --user andresj --height 2400 /ui` — Nupud-sektsioonis roheline link lõigus.
2. Masina lisamise dialoog: `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Masinad' --do 'click:text=Lisa uus masin' --do 'wait:800' /` — päise traktoriikoon roheline.
3. Haakimise kande dialoog: `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Haakimiste register' --do 'click:text=Lisa haakimise kanne' --do 'wait:800' /` — päise ikoon roheline, väljade välimus muutumata.
4. Sildid muutumata: `--do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500' /` ja `--do 'click:.main-view-switch >> text=Isikud' --do 'wait:1500' /` — tekstid nagu enne (ei muutunud halliks ega värviliseks).

---

### Task 2: Surnud CSS välja, `App.css` välja, auditi rida „Kasutuseta klasse“, ~2000 rea eesmärk hilisemaks

**Nähtav mõju:** puudub.

**Files:**
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts`
- Modify: `src/index.css` (82 reeglit, loetelu Step 4)
- Modify: `src/admin/admin.css:186` (`.admin-narrow`)
- Delete: `src/App.css`
- Modify: `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md` (etapp 3), `src/components/ui/README.md`

**Interfaces:**
- Produces: `unusedCssClasses(css: string, sources: string[]): { unused: string[]; dynamic: string[] }` (`uiAudit.ts`). Tasks 4–6, 9 kasutavad auditi rida „Kasutuseta klasse (CSS)“ — peab jääma 0.

- [ ] **Step 1: Kirjuta failiv test**

`src/tooling/uiAudit.test.ts`: lisa importi `unusedCssClasses` ja lõppu:

```ts
describe('kasutuseta klassid', () => {
  it('leiab klassi, mida lähtekoodis pole; kommentaar, url(), string ja leaflet-* ei loe', () => {
    const css = `/* .old-comment {} */
.used { a: 1 }
.dead, .used:hover { b: 2 }
.leaflet-x { c: 3 }
.bg { background: url("http://www.w3.org/x.svg"); content: ".fake"; }
.tone-3 { d: 4 }
[data-slot="table"] .row-dead { e: 5 }`;
    const r = unusedCssClasses(css, ['<div className="used bg" />', 'const c = `tone-${n}`;']);
    expect(r.unused).toEqual(['dead', 'row-dead']);
    expect(r.dynamic).toEqual(['tone-3']);
  });
  it('kommentaaris olev nimi lähtekoodis ei loe kasutuseks', () => {
    expect(unusedCssClasses('.gone { a: 1 }', ['// gone oli vana klass\n/* gone */ const x = 1;']).unused).toEqual(['gone']);
  });
  it("dünaamiline eesliide ka 'prefix-' + x kujul", () => {
    expect(unusedCssClasses('.weather-wet { a: 1 }', ["const c = 'weather-' + level;"]).dynamic).toEqual(['weather-wet']);
  });
});
```

Run: `npx vitest run src/tooling/uiAudit.test.ts` → FAIL (`unusedCssClasses` puudub).

- [ ] **Step 2: Implementeeri**

`src/tooling/uiAudit.ts` lõppu:

```ts
// Kasutuseta CSS-klass: klassinime pole ühegi lähtefaili tekstis (kommentaarid välja). Klass, mille algus vastab
// lähtekoodis koostatavale eesliitele (`prefix-${…}` või 'prefix-' + …), on "dünaamiline" — kontrolli käsitsi.
// leaflet-* klassid loob Leaflet ise.
const DYNAMIC_PREFIX = /[\s'"`]([a-z][\w-]*-)(?:\$\{|['"]\s*\+)/g;

export function unusedCssClasses(css: string, sources: string[]): { unused: string[]; dynamic: string[] } {
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')
    .replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
  const classes = new Set(
    [...clean.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !c.startsWith('leaflet-'))
  );
  const text = sources.map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).join('\n');
  const tokens = new Set(text.match(/[A-Za-z][\w-]*/g) ?? []);
  const prefixes = [...new Set([...text.matchAll(DYNAMIC_PREFIX)].map((m) => m[1]))];
  const unused: string[] = [];
  const dynamic: string[] = [];
  for (const c of [...classes].sort()) {
    if (tokens.has(c)) continue;
    (prefixes.some((p) => c.startsWith(p)) ? dynamic : unused).push(c);
  }
  return { unused, dynamic };
}
```

`scripts/ui-audit.mts` — faili algusesse (pärast `walk`):

```ts
function walkSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name.startsWith('._')) return [];
    return statSync(p).isDirectory() ? walkSources(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}
```

ja lõppu:

```ts
// Kasutuseta klassid: rakenduse ja admini CSS vs kõik ts/tsx + html (landing on eraldi leht, välja).
const sourceFiles = [...walkSources('src'), ...['index.html', 'admin.html'].filter((p) => existsSync(p))].map((p) =>
  readFileSync(p, 'utf8')
);
const unusedRows = ['src/index.css', 'src/admin/admin.css'].flatMap((p) => {
  const r = unusedCssClasses(readFileSync(p, 'utf8'), sourceFiles);
  return [...r.unused.map((c) => `${p}: .${c}`), ...r.dynamic.map((c) => `${p}: .${c} (dünaamiline?)`)];
});
row('Kasutuseta klasse (CSS)', unusedRows.filter((r) => !r.endsWith('(dünaamiline?)')).length, unusedRows);
```

Impordi `existsSync` (`node:fs`) ja `unusedCssClasses`. Run testid → PASS. Run `npm run ui-audit -- --details | grep Kasutuseta` → enne kustutamist **69** (index.css 68: 58 + 10 Step 3 loetelust; admin.css 1 `admin-narrow`; `w3` EI tohi ilmuda — url() eemaldus) ja dünaamilised `teris-logo-*`, `weather-line-0…5`, `weather-wet/dry/warm/cool` märgisega. Kui arv erineb, võrdle Step 3 loeteluga ja kirjuta raportisse.

- [ ] **Step 3: Kinnita kasutuseta olek (implementeerija kordab enne kustutamist)**

```bash
for c in add-year-banner banner-content banner-inputs cadastre-code carried dot-active drawer-header field-active-season-col field-change-reason-line field-code field-code-row field-detail-col field-detail-col-ops field-detail-columns field-detail-footer field-detail-header field-detail-seasons field-detail-seasons-label field-history-row field-info-col field-op-date field-op-head field-op-item field-op-meta field-op-notes field-op-notes-toggle field-op-product field-op-type field-ops-fill field-ops-list field-ops-list-fill field-title finance-occurrence fw-cell-carried fw-cell-next-spring fw-field-actions fw-field-clear-btn fw-field-edit-btn fw-field-kind fw-group-icon fw-milestone-done fw-next-spring-banner fw-row fw-toolbar-spacer history-label layer-year-selector legend-subtitle legend-title live-dot-pulse progress-fill removing sub-layer three to-remove work-entry-add work-register-toolbar year-register-link-btn year-selector-title edit-title poi-add-form poi-meta-line season-icon season-year-label variety-breeder-cell variety-empty-cell variety-notes-cell variety-winter-text weather-bar-year admin-narrow; do
  n=$(grep -rnw --include='*.ts' --include='*.tsx' -e "$c" src index.html | grep -v -E ':[0-9]+:\s*//' | wc -l); echo "$c $n"; done
```

Kõik peavad olema `0`. Dünaamilise eesliite erikontroll:

```bash
grep -rn --include='*.ts' --include='*.tsx' -E -e '(poi|edit|season|variety|weather-bar)-\$\{' src
```

Oodatav: `apiHandler.ts:770,784` (`poi-${Date.now()}` id), `catalog.ts:24` (`variety-${…}` id), `FieldWorksBoard.tsx:1228` (`key={\`edit-${…}\`}`), `SeasonManagerModal.tsx:115` (id), `App.tsx:1253` (id) — kõik id/key, mitte className. Kui leiad `className`-i koostatud nime, **ära kustuta** seda klassi ja kirjuta raportisse.

- [ ] **Step 4: Kustuta reeglid**

`src/index.css` (HEAD read; pärast Task 1 nihe ±12; kustuta reegel tervikuna koos eelneva tühja reaga; kontrolli iga ploki esimest rida enne kustutamist):

| Read (HEAD) | Selektor |
|---|---|
| 235–239 | `.progress-fill` |
| 660–663 | `.layer-item.sub-layer` |
| 860–880 | `.layer-year-selector`, `[data-theme='dark'] .layer-year-selector`, `.year-selector-title` |
| 979–998 | `.year-register-link-btn`, `:hover` |
| 1001–1005 | `.drawer-header` |
| 1014–1029 | `.field-title`, `.field-code-row`, `.field-code` |
| 1047–1068 | `.field-detail-header`, `.field-detail-seasons`, `.field-detail-seasons-label` |
| 1144–1184 | `.field-detail-columns`, `.field-detail-col`, `.field-detail-col>.detail-section`, `.field-detail-col-ops`, `.field-detail-footer`, `.field-ops-fill`, `.field-ops-list.field-ops-list-fill` |
| 1186–1200 | `@media` plokk, mis sisaldab ainult `.field-detail-columns`, `.field-detail-col`, `.field-detail-col-ops` (kustuta kogu `@media`, kui selles muud pole; muidu ainult need reeglid) |
| 1202–1260 | `.field-ops-list`, `.field-op-item`, `.field-op-head`, `.field-op-date`, `.field-op-type`, `.field-op-meta, .field-op-product`, `.field-op-notes-toggle`, `.field-op-notes` |
| 1269–1273 | `.dot-active` |
| 2428–2433 | `.poi-add-form` |
| 2486–2491 | `.poi-meta-line` |
| 3252–3279 | `.add-year-banner`, `.banner-content`, `.banner-content p`, `.banner-inputs` |
| 3295–3309 | `.edit-title`, `.field-info-col` |
| 3325–3329 | `.cadastre-code` |
| 3371–3386 | `.field-active-season-col`, `.season-year-label` |
| 3395–3411 | `.field-history-row`, `.history-label` |
| 3426–3438 | `.legend-title`, `.legend-subtitle` |
| 3541–3543 | `.season-icon` |
| 3754–3761 | `.live-dot-pulse` |
| 4034–4042 | `.field-change-reason-line` |
| 4227–4254 | `.variety-breeder-cell`, `.variety-winter-text`, `.variety-notes-cell`, `.variety-empty-cell` (vahepealne reegel 4239–4243 jääb, kui see pole loetelus) |
| 4625–4628 | `.work-register-toolbar` |
| 4874–4876 | `.fw-toolbar-spacer` |
| 5147–5149 | `.fw-row-container:hover .fw-field-clear-btn` |
| 5208–5213 | `.fw-crop-banner.carried` |
| 5223–5229 | `.fw-cell.fw-cell-carried` |
| 5231, 5240 | **ainult selektori osa**: `.fw-cell.fw-cell-next-spring, .fw-cell.fw-cell-no-sow` → `.fw-cell.fw-cell-no-sow`; `:root[data-theme="dark"] .fw-cell.fw-cell-next-spring, :root[data-theme="dark"] .fw-cell.fw-cell-no-sow` → `:root[data-theme="dark"] .fw-cell.fw-cell-no-sow` |
| 5253–5264 | `.fw-next-spring-banner` |
| 5328–5342 | `.fw-group-icon.winter/.spring/.undetermined`, `.fw-row` |
| 5405–5411 | `.fw-field-actions` |
| 5455–5458 | `.fw-field-kind` |
| 5742–5772 | `.fw-milestone-done` (4 reeglit), `.fw-field-kind.winter` |
| 6373–6375 | `.work-entry-grid.three` |
| 6431–6433 | `.work-entry-add` |
| 6506–6514 | `.add-work-option.to-remove`, `.add-work-option.to-remove .add-work-name` |
| 6539–6543 | `.add-work-check.removing` |
| 6569–6572 | `.add-work-tag.to-remove` |
| 6578–6594 | `.fw-field-edit-btn`, `:hover` |
| 6762–6766 | `.finance-occurrence` |
| 7715 | `.weather-bar-year` |

Ohutum viis: kirjuta ühekordne postcss-skript **projekti kausta** (postcss on `node_modules`-is; `/tmp`-st käivitatud skript seda ei leia), mis kustutab reeglid, mille **kõigil** komaga eraldatud selektoritel on mõni Step 3 klass, ja kärbib osalised selektorid (5231, 5240); käivita, vaata `git diff src/index.css` läbi, kustuta skript (ära commit'i). Pärast: `git diff src/index.css | grep -E '^-\s*(:root|@keyframes|--)'` → tühi (ükski `:root` plokk, `@keyframes` ega muutuja ei tohi kaduda).

`src/admin/admin.css:186`: kustuta `.admin-narrow { … }` rida.

`src/App.css`: kontrolli `grep -rn -e 'App.css' src index.html vite.config.ts vite.server.config.ts` → tühi; siis `git rm src/App.css`.

- [ ] **Step 5: Märgi ~2000 rea eesmärk hilisemaks**

Spec'i jaotises „3. Üleminek“ punkti 3 („Koristus“) järele lisa:

```markdown
   **Täpsustus 2026-11-16 (kasutaja otsus):** etapis 3 vähendatakse `index.css`-i ~1000 rida (7 758 → ~6 800):
   kasutuseta klassid, pseudo-tabelid ui Table peale, ikoonnupud. ~85% `index.css`-ist on vaatepõhised reeglid; ~2 000
   rea eesmärk eeldab vaadete viimist Tailwindi peale (`@source` laiendus), mis jääb hilisemaks eraldi etapiks.
   Selles etapis Tailwindi skaneerimist vaadetele ei laiendata.
```

`README.md` jaotise „Tailwindi skaneerimine“ lõppu: „Etapis 3 (2026-11-16) skaneerimist vaadetele ei laiendata; `index.css`-i ~2 000 rea eesmärk on hilisem etapp „vaated Tailwindi peale“.“ Jaotisse „Reeglid“: „`npm run ui-audit` rida „Kasutuseta klasse (CSS)“ peab olema 0 — klassi eemaldamisel vaatest kustuta ka CSS-reegel.“

- [ ] **Step 6: Kontrollid**

`npx vitest run src/tooling src/components/ui` → PASS; `tsc`; `npx oxlint src/tooling scripts/ui-audit.mts`.

Oodatav `npm run ui-audit -- --details`: „Kasutuseta klasse (CSS)“ **0** (dünaamilised read märgisega, ei loe); „Defineerimata CSS-muutujaid“ 0; kirjasuuruste/nurkade/vahede/värvide arv väheneb (App.css kadus) — kirjuta uued arvud raportisse. `wc -l src/index.css`: **7 200–7 260**.

- [ ] **Step 7: Commit + release**

```bash
git add src/tooling/uiAudit.ts src/tooling/uiAudit.test.ts scripts/ui-audit.mts src/index.css src/admin/admin.css src/App.css docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md src/components/ui/README.md
git commit -m "refactor(css): kasutuseta klassid ja App.css välja, ui-audit loeb kasutuseta klassid" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

- [ ] **Step 8: Ekraanipildid** (kontroll, et midagi ei kadunud)

1. `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' /` — tahvel, lahtrid, kultuuribännerid nagu enne.
2. `/` (Kaart) — kihipaneel, legend, aasta vidin.
3. `--do 'click:.main-view-switch >> text=Kultuurid' --do 'wait:1500' /` — sordid.
4. `--do 'click:.main-view-switch >> text=Ilm' --do 'wait:2000' /` — graafikute jooned värvilised (`weather-line-*`).

---

### Task 3: Kontrast — tumedam roheline, toonitekstid, kontrastitest

**Nähtav mõju (keskmine):** heledas teemas primaarnupud ja roheline tekst tumedamad; soft-märkide tekst tumedam; hall abitekst (`text-subtle`, placeholder) heledas tumedam, tumedas heledam; tumedas teemas kollane hoiatusmärk tumeda tekstiga; töö faasi sildid ja mulla väärtused toonitekstiga.

**Files:**
- Create: `src/tooling/contrast.ts`, `src/tooling/contrast.test.ts`
- Modify: `src/index.css` (teema plokid ridadel 4–56 ja 58–100; `color: var(--emerald-600)` 6 kohta; uued `.phase-label`, `.soil-value[data-level]`, `.soil-age-dot` reeglid)
- Modify: `src/styles/app.css` (`@theme inline`)
- Modify: `src/components/ui/variants.ts:43-70` (`badgeVariants`), `variants.test.ts`
- Modify: `src/types/fieldWork.ts:22-28`, `src/components/FieldWorksBoard.tsx:1156`, `src/components/AddFieldWorkDialog.tsx:104`
- Modify: `src/types/soilSample.ts:32-35,52-112,146-152`; Create: `src/types/soilSample.test.ts`
- Modify: `src/components/SoilSamplesSection.tsx:93,99,114`, `src/components/LayerControl.tsx:78`
- Modify: `src/components/ui/README.md`

**Interfaces:**
- Produces: Tailwindi värvinimed `success-text`, `info-text`, `warning-text`, `danger-text`, `accent-text`, `info-solid`, `accent-solid`, `on-warning`; CSS-muutujad `--tone-success-text`, `--tone-info-text`, `--tone-warning-text`, `--tone-danger-text`, `--tone-accent-text`, `--tone-info-solid`, `--tone-accent-solid`, `--on-warning`. Task 4 kasutab `text-success-text` (pressed-olek), Task 6 `--tone-danger-text`.
- Produces: `parseColor`, `over`, `tint`, `luminance`, `contrastRatio`, `themeVars`, `themeColors`, `resolveColor`, `type Rgba` (`src/tooling/contrast.ts`).
- Produces: `type SoilLevel = 'bad' | 'warn' | 'good'`, `SOIL_LEVEL_COLOR: Record<SoilLevel, string>`, `getSoilMetricLevel(metric: SoilSampleMetricKey, value?: number | null): SoilLevel | 'none'` (`src/types/soilSample.ts`). Task 5 ja 7 kasutavad.
- `WORK_PHASE_META[phase]` = `{ label: string; tone: BadgeTone }` (`color` kaob).

- [ ] **Step 1: Kirjuta kontrastitest (failib)**

`src/tooling/contrast.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, over, parseColor, resolveColor, themeColors, themeVars, tint, type Rgba } from './contrast';

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
const names = themeColors(appCss);
const AA = 4.5;

describe('kontrasti abifunktsioonid', () => {
  it('valge mustal 21, sama värv 1', () => {
    expect(contrastRatio(parseColor('#ffffff'), parseColor('#000000'))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor('#16a34a'), parseColor('#16a34a'))).toBeCloseTo(1, 5);
  });
  it('#16a34a valgel on 3.30 (WCAG näide inventuurist)', () => {
    expect(contrastRatio(parseColor('#ffffff'), parseColor('#16a34a'))).toBeCloseTo(3.3, 1);
  });
  it('läbipaistev värv segatakse taustaga; tint = Tailwindi bg-x/15', () => {
    expect(Math.round(over(parseColor('rgba(0, 0, 0, 0.5)'), parseColor('#ffffff')).r)).toBe(128);
    expect(Math.round(tint(parseColor('#000000'), 50, parseColor('#ffffff')).g)).toBe(128);
  });
  it('lahendab var() ahela ja varuväärtuse, defineerimata viskab', () => {
    const vars = { '--a': 'var(--b)', '--b': '#112233' };
    expect(resolveColor('var(--a)', vars)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(resolveColor('var(--x, #fff)', vars).r).toBe(255);
    expect(() => resolveColor('var(--x)', vars)).toThrow();
  });
});

for (const theme of ['light', 'dark'] as const) {
  describe(`kontrast ${theme}`, () => {
    const vars = themeVars(indexCss, theme);
    const color = (name: string): Rgba => resolveColor(names[name] ?? name, vars);
    const card = color('card');
    const popover = color('popover');
    const check = (fg: string, bg: Rgba, label: string) =>
      expect(contrastRatio(color(fg), bg), `${theme}: ${label}`).toBeGreaterThanOrEqual(AA);

    it('tekstivärvid kaardil ja dialoogis', () => {
      for (const fg of ['foreground', 'muted-foreground', 'subtle', 'primary', 'info', 'warning', 'destructive', 'accent',
        'success-text', 'info-text', 'warning-text', 'danger-text', 'accent-text']) {
        check(fg, card, `${fg}/card`);
        check(fg, popover, `${fg}/popover`);
      }
    });
    it('placeholder (text-subtle) sisestusväljal', () => {
      check('subtle', over(color('field'), popover), 'subtle/field');
    });
    it('valge tekst põhinupul (gradiendi mõlemas otsas, hõljudes) ja päise pillil', () => {
      for (const bg of ['primary-from', 'primary-to', 'primary-strong', 'primary-hover']) check('white', color(bg), `white/${bg}`);
    });
    it('soft märgid: toonitekst 15% toonil kaardi peal', () => {
      const pairs: [string, string][] = [
        ['success-text', 'primary'], ['info-text', 'info'], ['warning-text', 'warning'],
        ['danger-text', 'destructive'], ['accent-text', 'accent'],
      ];
      for (const [fg, bg] of pairs) check(fg, tint(color(bg), 15, card), `${fg} on ${bg}/15`);
    });
    it('solid märgid: valge või tume tekst täisvärvil', () => {
      check('white', color('primary-strong'), 'solid success');
      check('white', color('info-solid'), 'solid info');
      check('white', color('accent-solid'), 'solid accent');
      check('white', color('danger-solid'), 'solid danger');
      check('on-warning', color('warning'), 'solid warning');
    });
  });
}

describe('legacy CSS', () => {
  it('index.css ei kasuta --emerald-600 tekstivärvina (tumedas 3.56:1) — kasuta --tone-success-text', () => {
    expect(indexCss.match(/(?<![\w-])color:\s*var\(--emerald-600\)/g) ?? []).toEqual([]);
  });
});
```

`src/tooling/contrast.ts` — loo esialgu sisuga `export {};`, et test kukuks importide pärast.

Run: `npx vitest run src/tooling/contrast.test.ts` → FAIL.

- [ ] **Step 2: Implementeeri `contrast.ts`**

```ts
// src/tooling/contrast.ts — WCAG 2.x kontrastsuhe teema tokenitest. Allikad: index.css heleda/tumeda teema
// :root plokid ja app.css `@theme inline` värvinimed (kasutaja otsus 2026-11-16: tekst ≥ 4.5:1 mõlemas teemas).
export interface Rgba { r: number; g: number; b: number; a: number }

export function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const fn = s.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b, a = '1'] = fn[1].split(/[\s,/]+/).filter(Boolean);
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
  }
  throw new Error(`Tundmatu värv: ${input}`);
}

/** Läbipaistev värv tausta peal; tulemus on läbipaistmatu. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

/** Tailwindi `bg-x/15`: värv pct% läbipaistvusega tausta peal. */
export const tint = (color: Rgba, pct: number, bottom: Rgba): Rgba => over({ ...color, a: (pct / 100) * color.a }, bottom);

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = (c: Rgba): number => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

/** Kontrastsuhe; läbipaistev esiplaan segatakse taustaga. Taust peab olema läbipaistmatu. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const f = fg.a < 1 ? over(fg, bg) : fg;
  const [hi, lo] = [luminance(f), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const declarations = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

/** Teema muutujad: hele = `:root, :root[data-theme="light"]` plokk; tume = hele + esimene `:root[data-theme="dark"]` plokk. */
export function themeVars(indexCss: string, theme: 'light' | 'dark'): Record<string, string> {
  const light = indexCss.match(/:root,\s*:root\[data-theme="light"\]\s*\{([^}]*)\}/);
  if (!light) throw new Error('Heleda teema plokki ei leitud');
  const vars = declarations(light[1]);
  if (theme === 'light') return vars;
  const dark = indexCss.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  if (!dark) throw new Error('Tumeda teema plokki ei leitud');
  return { ...vars, ...declarations(dark[1]) };
}

/** Tailwindi värvinimed app.css `@theme inline` plokist: `--color-primary` → `primary`. */
export function themeColors(appCss: string): Record<string, string> {
  const block = appCss.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error('@theme inline plokki ei leitud');
  return Object.fromEntries(
    Object.entries(declarations(block[1]))
      .filter(([k]) => k.startsWith('--color-'))
      .map(([k, v]) => [k.slice('--color-'.length), v])
  );
}

/** Lahendab var(--x) ahelad teema muutujatest. color-mix'i ei toeta (parseColor viskab). */
export function resolveColor(value: string, vars: Record<string, string>, depth = 0): Rgba {
  if (depth > 10) throw new Error(`Liiga sügav var() ahel: ${value}`);
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (ref) {
    const next = vars[ref[1]] ?? ref[2];
    if (next === undefined) throw new Error(`Defineerimata muutuja ${ref[1]}`);
    return resolveColor(next, vars, depth + 1);
  }
  return parseColor(v);
}
```

Run: `npx vitest run src/tooling/contrast.test.ts` → abifunktsioonid PASS, teematestid FAIL (toonid puuduvad, kontrast < 4.5). Kirjuta raportisse failivate paaride loetelu (peab vastama inventuuri jaotisele 6).

- [ ] **Step 3: Tokenid**

`src/index.css` heleda teema plokk (rida 4–56) — muuda olemasolevad ja lisa uued (ainult see plokk!):

```css
  --text-muted: #64748b;            /* oli #94a3b8 (2.56:1) → 4.76:1 kaardil, 4.55:1 väljal */

  --emerald-600: #166534;           /* oli #15803d */
  --emerald-500: #15803d;           /* oli #16a34a (3.30:1) → 5.02:1; tumedam roheline (kasutaja otsus 2026-11-16) */
  --amber-500: #b45309;             /* oli #d97706 (3.19:1) → 5.02:1 */

  /* Toonitekst (soft märk, olekutekst kaardil) ja täisvärvid valge tekstiga — kõik ≥ 4.5:1 (contrast.test.ts) */
  --tone-success-text: #166534;
  --tone-info-text: #1d4ed8;
  --tone-warning-text: #92400e;
  --tone-danger-text: #be123c;
  --tone-accent-text: #7e22ce;
  --tone-info-solid: #2563eb;
  --tone-accent-solid: #9333ea;
  --on-warning: #ffffff;            /* hoiatusmärgi tekst täisvärvil */
```

Tumeda teema plokk (rida 58–100):

```css
  --text-muted: #8796ab;            /* oli #64748b (3.75:1) → 5.95:1 kaardil, 5.09:1 väljal */

  --tone-success-text: #22c55e;
  --tone-info-text: #60a5fa;
  --tone-warning-text: #f59e0b;
  --tone-danger-text: #fb7185;
  --tone-accent-text: #c084fc;
  --tone-info-solid: #2563eb;       /* #3b82f6 valgega 3.68:1 */
  --tone-accent-solid: #9333ea;     /* #a855f7 valgega 3.96:1 */
  --on-warning: #0f172a;            /* kollane märk tumeda tekstiga (kasutaja otsus) */
```

`src/styles/app.css` `@theme inline` plokis asenda kolm rida:

```css
  /* Päise pillinupu hover: mõlemas teemas sama, valge tekst ≥ 4.5:1 */
  --color-primary-hover: #166534;
  /* Põhinupu gradient mõlemas teemas sama; valge tekst ≥ 4.5:1 mõlemas otsas (kasutaja otsus 2026-11-16) */
  --color-primary-from: #166534;
  --color-primary-to: #15803d;
```

ja `--color-accent: var(--purple-500);` järele:

```css
  /* Toonitekstid ja täisvärvid märkidele (kontrast mõlemas teemas) */
  --color-success-text: var(--tone-success-text);
  --color-info-text: var(--tone-info-text);
  --color-warning-text: var(--tone-warning-text);
  --color-danger-text: var(--tone-danger-text);
  --color-accent-text: var(--tone-accent-text);
  --color-info-solid: var(--tone-info-solid);
  --color-accent-solid: var(--tone-accent-solid);
  --color-on-warning: var(--on-warning);
```

`src/index.css`: kuus `color: var(--emerald-600)` deklaratsiooni (HEAD 1378 `.cc-value-sub`, 1471 `.cc-link-btn`, 1987 `.status-working`, 2172 `.attached-status.attached`, 2355 `.confirm-dialog-icon.info`, 2476 `.btn-pick-map-highlight` — viimane `!important`-iga) → `color: var(--tone-success-text)` (säilita `!important`). `background:`/`border:` `--emerald-600`-ga jäävad.

- [ ] **Step 4: Märgid**

`src/components/ui/variants.ts` `badgeVariants.compoundVariants` — asenda soft ja solid read:

```ts
    { variant: 'soft', tone: 'success', class: 'bg-primary/15 text-success-text' },
    { variant: 'soft', tone: 'info', class: 'bg-info/15 text-info-text' },
    { variant: 'soft', tone: 'warning', class: 'bg-warning/15 text-warning-text' },
    { variant: 'soft', tone: 'danger', class: 'bg-destructive/15 text-danger-text' },
    { variant: 'soft', tone: 'accent', class: 'bg-accent/15 text-accent-text' },
    { variant: 'soft', tone: 'neutral', class: 'bg-muted text-muted-foreground' },
    { variant: 'solid', tone: 'success', class: 'bg-primary-strong' },
    { variant: 'solid', tone: 'info', class: 'bg-info-solid' },
    // Hoiatusmärk: heledas valge, tumedas tume tekst kollasel (kasutaja otsus 2026-11-16)
    { variant: 'solid', tone: 'warning', class: 'bg-warning text-on-warning' },
    { variant: 'solid', tone: 'danger', class: 'bg-danger-solid' },
    { variant: 'solid', tone: 'accent', class: 'bg-accent-solid' },
    { variant: 'solid', tone: 'neutral', class: 'bg-foreground text-background' },
```

`variants.test.ts`: testi „märgi toon määrab värvi“ rida `toContain('text-warning')` → `toContain('text-warning-text')`; „kirjasuurused ainult skaalast“ lubatud regexisse lisa `success-text|info-text|warning-text|danger-text|accent-text|on-warning`. Lisa:

```ts
describe('märkide kontrast', () => {
  it('soft märk kasutab toonitekst-tokenit, mitte põhitooni', () => {
    for (const tone of ['success', 'info', 'warning', 'danger', 'accent'] as const) {
      const c = v.badgeVariants({ tone, variant: 'soft' });
      expect(c, tone).toMatch(/text-(success|info|warning|danger|accent)-text/);
    }
  });
  it('solid hoiatus: tekst on-warning võidab valge (cn)', () => {
    const c = cn(v.badgeVariants({ tone: 'warning', variant: 'solid' }));
    expect(c).toContain('text-on-warning');
    expect(c).not.toMatch(/(^|\s)text-white(\s|$)/);
  });
  it('solid info ja accent kasutavad tumedamat täisvärvi', () => {
    expect(v.badgeVariants({ tone: 'info', variant: 'solid' })).toContain('bg-info-solid');
    expect(v.badgeVariants({ tone: 'accent', variant: 'solid' })).toContain('bg-accent-solid');
  });
});
```

Kontrolli, et `Badge.tsx` liidab klassid `cn`-iga (tailwind-merge lahendab `text-white` vs `text-on-warning`). Kui ei liida, muuda `className={cn(badgeVariants(…), className)}`.

- [ ] **Step 5: Töö faasi silt**

`src/types/fieldWork.ts:22-28`:

```ts
// tone = märgi toon (Badge) ja faasi sildi tekstitoon (.phase-label[data-tone], kontrast mõlemas teemas).
export const WORK_PHASE_META: Record<WorkPhase, { label: string; tone: BadgeTone }> = {
  PREPARATION: { label: 'Ettevalmistus', tone: 'info' },
  SOWING: { label: 'Külv', tone: 'success' },
  CARE: { label: 'Hooldamine', tone: 'accent' },
  HARVEST: { label: 'Koristus', tone: 'warning' }
};
```

Enne: `grep -rn --include='*.ts' --include='*.tsx' -e 'WORK_PHASE_META' src | grep '\.color'` → ainult `FieldWorksBoard.tsx:1156` ja `AddFieldWorkDialog.tsx:104`.

| Fail:rida | Vana | Uus |
|---|---|---|
| `FieldWorksBoard.tsx:1156` | `<span className="fw-panel-phase" style={{ color: WORK_PHASE_META[selected.phase].color }}>` | `<span className="fw-panel-phase phase-label" data-tone={WORK_PHASE_META[selected.phase].tone}>` |
| `AddFieldWorkDialog.tsx:104` | `<span className="add-work-phase-label" style={{ color: WORK_PHASE_META[phase].color }}>` | `<span className="add-work-phase-label phase-label" data-tone={WORK_PHASE_META[phase].tone}>` |

`src/index.css` `.fw-panel-phase` reegli järele:

```css
/* Töö faasi silt (tahvli paneel, lisamisdialoog): märgi toon tekstina, kontrast mõlemas teemas */
.phase-label[data-tone="info"] { color: var(--tone-info-text); }
.phase-label[data-tone="success"] { color: var(--tone-success-text); }
.phase-label[data-tone="accent"] { color: var(--tone-accent-text); }
.phase-label[data-tone="warning"] { color: var(--tone-warning-text); }
```

- [ ] **Step 6: Mulla tase (test enne)**

`src/types/soilSample.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getSoilMetricColor, getSoilMetricLevel, SOIL_LEVEL_COLOR } from './soilSample';

describe('mulla näitaja tase', () => {
  it('pH: ≤5.5 halb, ≤6.5 hoiatus, muidu hea', () => {
    expect(getSoilMetricLevel('ph', 5.2)).toBe('bad');
    expect(getSoilMetricLevel('ph', 6.0)).toBe('warn');
    expect(getSoilMetricLevel('ph', 7.1)).toBe('good');
  });
  it('lubjatarve on ümberpööratud: kõrge = halb', () => {
    expect(getSoilMetricLevel('limeRequirement', 0.5)).toBe('good');
    expect(getSoilMetricLevel('limeRequirement', 3)).toBe('warn');
    expect(getSoilMetricLevel('limeRequirement', 5)).toBe('bad');
  });
  it('puuduv väärtus ja vanus → none', () => {
    expect(getSoilMetricLevel('ph', null)).toBe('none');
    expect(getSoilMetricLevel('ph', undefined)).toBe('none');
    expect(getSoilMetricLevel('age', 3)).toBe('none');
  });
  it('kaardi värv tuleb tasemest, puuduv = hall', () => {
    expect(getSoilMetricColor('ph', 5.2)).toBe(SOIL_LEVEL_COLOR.bad);
    expect(getSoilMetricColor('potassium', 200)).toBe(SOIL_LEVEL_COLOR.good);
    expect(getSoilMetricColor('ph', undefined)).toBe('#94a3b8');
  });
});
```

Run: `npx vitest run src/types/soilSample.test.ts` → FAIL.

`src/types/soilSample.ts`:

```ts
export type SoilLevel = 'bad' | 'warn' | 'good';
/** Taseme andmevärv (kaart, legend, punkt). Tekstina kasuta taseme tooni (CSS .soil-value[data-level]), mitte seda. */
export const SOIL_LEVEL_COLOR: Record<SoilLevel, string> = { bad: '#dc2626', warn: '#eab308', good: '#16a34a' };

interface SoilMetricThreshold {
  max: number;
  level: SoilLevel;
}
```

`SOIL_METRIC_CONFIG`-is (HEAD 52–112) asenda lävendite värvid tasemega:

```bash
sed -i -e "52,112s/color: '#dc2626'/level: 'bad'/" -e "52,112s/color: '#eab308'/level: 'warn'/" -e "52,112s/color: '#16a34a'/level: 'good'/" src/types/soilSample.ts
git diff --stat src/types/soilSample.ts   # 21 muudetud lävendirida + tüübi read
```

Funktsioonid (asenda `getSoilMetricColor`, lisa `getSoilMetricLevel`):

```ts
/** Näitaja tase lävendite järgi; vanus (pidev skaala) ja puuduv väärtus → 'none'. */
export function getSoilMetricLevel(metric: SoilSampleMetricKey, value?: number | null): SoilLevel | 'none' {
  if (value === undefined || value === null || isNaN(value) || metric === 'age') return 'none';
  const threshold = (SOIL_METRIC_CONFIG[metric].thresholds || []).find((t) => value <= t.max);
  return threshold ? threshold.level : 'none';
}

export function getSoilMetricColor(metric: SoilSampleMetricKey, value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return '#94a3b8';
  if (metric === 'age') return ageToColor(value);
  const level = getSoilMetricLevel(metric, value);
  return level === 'none' ? '#94a3b8' : SOIL_LEVEL_COLOR[level];
}
```

`LayerControl.tsx:78`: `return { color: t.color, label };` → `return { color: SOIL_LEVEL_COLOR[t.level], label };` (impordi `SOIL_LEVEL_COLOR` `../types/soilSample`-ist).

`SoilSamplesSection.tsx`:

| Rida | Vana | Uus |
|---|---|---|
| 93 | `{age > 0 && <span className="soil-age" style={{ color: getSoilMetricColor('age', age) }}>{age} a</span>}` | `{age > 0 && <span className="soil-age">{age} a<span className="soil-age-dot" style={{ backgroundColor: getSoilMetricColor('age', age) }} /></span>}` |
| 99 | `<span key={m.key} className="soil-value" style={{ color: getSoilMetricColor(m.key, avg) }}>` | `<span key={m.key} className="soil-value" data-level={getSoilMetricLevel(m.key, avg)}>` |
| 114 | `<span key={m.key} className="soil-value" style={{ color: getSoilMetricColor(m.key, v) }}>` | `<span key={m.key} className="soil-value" data-level={getSoilMetricLevel(m.key, v)}>` |

Impordi `getSoilMetricLevel`. `src/index.css` `.soil-value` reegli järele:

```css
/* Mulla väärtus: taseme toon tekstina (kontrast mõlemas teemas); andmevärv jääb kaardile ja vanuse punktile */
.soil-value[data-level="bad"] { color: var(--tone-danger-text); }
.soil-value[data-level="warn"] { color: var(--tone-warning-text); }
.soil-value[data-level="good"] { color: var(--tone-success-text); }
.soil-value[data-level="none"] { color: var(--text-muted); }
.soil-age-dot { display: inline-block; width: 8px; height: 8px; margin-left: 4px; border-radius: 9999px; vertical-align: middle; }
```

Run: `npx vitest run src/types/soilSample.test.ts src/tooling/contrast.test.ts src/components/ui` → PASS. Kui mõni kontrastipaar kukub (oodatav: ei kuku — kõik paarid on käsitsi arvutatud, madalaim tumeda teema `text-accent` 4.51), muuda **ainult** selle paari tokenit tumedamaks (hele) / heledamaks (tume) Tailwindi paleti järgmise astmega ja kirjuta raportisse.

- [ ] **Step 7: README**

„Vana muutuja → Tailwindi nimi“ tabelisse read: `--tone-success-text` … `--tone-accent-text` → `text-success-text` … `text-accent-text` (soft märgi ja olekuteksti toon); `--tone-info-solid`/`--tone-accent-solid` → `bg-info-solid`/`bg-accent-solid`; `--on-warning` → `text-on-warning`. „Kindlad värvid“: `primary-from` / `primary-to` = `#166534` / `#15803d`. Uus jaotis „Kontrast“: „Tekst ≥ 4.5:1 mõlemas teemas; `src/tooling/contrast.test.ts` arvutab tokenitest. Tekstina värvilist tooni (`text-primary`, `text-warning`…) kasuta ainult siis, kui test seda paari katab; olekutekst = `text-*-text`. Uue värvi lisamisel lisa paar testi.“

- [ ] **Step 8: Kontrollid**

`npx vitest run src/tooling src/components/ui src/types/soilSample.test.ts` → PASS; `tsc`; `npx oxlint src/tooling/contrast.ts src/components/ui src/types/soilSample.ts src/types/fieldWork.ts src/components/SoilSamplesSection.tsx src/components/LayerControl.tsx src/components/FieldWorksBoard.tsx src/components/AddFieldWorkDialog.tsx`.

Oodatav ui-audit: „style={{…}} kohti (tsx)“ 126 → **≈122** (−2 faasi, −3 mulla teksti, +1 vanuse punkt; kirjuta tegelik); „Kasutuseta klasse“ 0; „Defineerimata CSS-muutujaid“ 0. `wc -l src/index.css` ≈ +25 (7 225–7 285).

- [ ] **Step 9: Commit + release**

```bash
git add src/tooling/contrast.ts src/tooling/contrast.test.ts src/index.css src/styles/app.css src/components/ui/variants.ts src/components/ui/variants.test.ts src/components/ui/README.md src/types/fieldWork.ts src/types/soilSample.ts src/types/soilSample.test.ts src/components/SoilSamplesSection.tsx src/components/LayerControl.tsx src/components/FieldWorksBoard.tsx src/components/AddFieldWorkDialog.tsx
git commit -m "fix(ui): kontrast AA mõlemas teemas — tumedam roheline, toonitekstid, hoiatusmärk tumeda tekstiga, kontrastitest" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

(Lisa `src/components/ui/Badge.tsx`, kui muutsid.)

- [ ] **Step 10: Ekraanipildid**

1. `/ui --height 3000` — Nupud (primaar tumedam roheline, valge tekst loetav), Märgid (kõik toonid soft/solid/outline; tumedas kollane solid tumeda tekstiga), Vormiväljad (placeholder loetav).
2. `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' /` — staatusemärgid, tahvel.
3. Faasi silt: `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' --do 'click:.fw-card >> nth=0' --do 'wait:800' /` — paneeli pealkirja faasi silt loetav mõlemas teemas.
4. Mullaproovid: `--height 2400 --do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500' --do 'click:[data-slot="table"] tbody tr >> nth=0' --do 'wait:1500' --do 'eval:document.querySelector(".soil-table")?.scrollIntoView()' --do 'shot:soil' /` — väärtused toonitekstina, vanuse punkt. Kui reaklõps ei ava põllu akent, leia avamise tee `grep -n "FieldEditDialog" src/components/FieldsTableView.tsx` järgi.
5. Tehnika → Masinad: `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Masinad' /` — märgid ja nupud.

---

### Task 4: Ikoonnupud ui Button'ile — kolm suurust, pressed-olek, mini- ja linknupud

**Nähtav mõju (väike):** ikoonnupud ühtse hover'iga ja rakenduse vihjega; silmaikoonid, kuju-nupud, kaardi „+“ 20px; juhtpaneeli „Algusesse“ 28px; esitusnupp 40px ümmargune primaar; mini-nupud ühtse 20px kõrgusega; aluskaardi valik ja Sim/rada nupud rohelise valitud olekuga.

**Files:**
- Modify: `src/components/ui/variants.ts` (`buttonVariants`, uus `buttonVariantSizes`), `variants.test.ts`, `iconTooltip.ts`, `iconTooltip.test.ts`, `UiGallery.tsx:66,278,279,281`, `README.md`
- Modify: `src/components/UserMenu.tsx:91`
- Modify: `src/components/LayerControl.tsx:112-119,157-163,198,265,294,339-347,351-360,388,413,439`
- Modify: `src/components/CultivationControl.tsx:247-255,261-270,271-280,298,316`
- Modify: `src/components/VehicleTracker.tsx:1366-1376,1386-1396`
- Modify: `src/components/FieldWorksBoard.tsx:183,871`, `src/components/FieldManagerModal.tsx:517,618`, `src/components/FieldsTableView.tsx:364`
- Modify: `src/index.css` (nupuperekonnad, Step 6)

**Interfaces:**
- Consumes: `variant="link"` (Task 1), `text-success-text` (Task 3).
- Produces: `buttonVariantSizes` (eksport `variants.ts`-ist) suurustega `xs`, `sm`, `md`, `inline`, `icon-xs`, `icon-sm`, `icon-lg`, `auto` (`icon` kaob); `ghost`/`secondary` `aria-pressed` stiil. Task 9 kasutab `aria-pressed` admini navis ja `icon-sm` RTE tööriistal.

- [ ] **Step 1: Kirjuta failivad testid**

`variants.test.ts`: kõigis massiivides asenda suurused `['sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon', 'auto']` → `['xs', 'sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon-lg', 'auto']`. Test „ikoonnupud on 6px nurgaga…“ asenda:

```ts
  it('ikoonnupud: 20px ja 28px 6px nurgaga, 40px ümmargune; tekstinupud 10px', () => {
    for (const size of ['icon-xs', 'icon-sm'] as const) {
      const c = cn(v.buttonVariants({ size }));
      expect(c, size).toContain('rounded-sm');
      expect(c, size).not.toContain('rounded-md');
    }
    expect(v.buttonVariants({ size: 'icon-xs' })).toContain('size-5');
    expect(v.buttonVariants({ size: 'icon-sm' })).toContain('size-7');
    const lg = cn(v.buttonVariants({ variant: 'primary', size: 'icon-lg' }));
    expect(lg).toContain('size-10');
    expect(lg).toContain('rounded-full');
    expect(cn(v.buttonVariants({ size: 'sm' }))).toContain('rounded-md');
  });
  it('ikoonnupu suurusi on täpselt kolm (kasutaja otsus 2026-11-16)', () => {
    const sizes = Object.keys(v.buttonVariantSizes).filter((s) => s.startsWith('icon'));
    expect(sizes.sort()).toEqual(['icon-lg', 'icon-sm', 'icon-xs']);
  });
  it('mini-nupp xs: 20px, 11px kiri, 6px nurk', () => {
    const c = cn(v.buttonVariants({ size: 'xs' }));
    expect(c).toContain('h-5');
    expect(c).toContain('text-2xs');
    expect(c).toContain('rounded-sm');
  });
  it('valitud olek (aria-pressed): roheline toon ghost ja secondary nupul', () => {
    for (const variant of ['ghost', 'secondary'] as const) {
      const c = v.buttonVariants({ variant });
      expect(c, variant).toContain('aria-pressed:bg-primary/15');
      expect(c, variant).toContain('aria-pressed:text-success-text');
    }
  });
```

`iconTooltip.test.ts`: `it.each(['icon', 'icon-sm', 'icon-xs'] as const)` → `it.each(['icon-lg', 'icon-sm', 'icon-xs'] as const)`; testides `iconTooltip('icon', …)` → `iconTooltip('icon-sm', …)`; tekstinupu `it.each` massiivi lisa `'xs'`, `'inline'`.

Run: `npx vitest run src/components/ui` → FAIL.

- [ ] **Step 2: Implementeeri**

`variants.ts` — suurused eraldi konstandiks (test loeb võtmeid), `buttonVariants` ette:

```ts
/** Nupu suurused. Ikoonnupud (kasutaja otsus 2026-11-16): tabel 20px, tööriistariba 28px, esitusnupp 40px. */
export const buttonVariantSizes = {
  // Mini-nupp ikooni ja lühikese tekstiga (kiibi/märgi sees: „Vaheta“, „Sim“).
  xs: 'h-5 gap-1 rounded-sm px-1.5 text-2xs',
  sm: 'h-7 px-3 text-xs',
  md: 'h-8 px-4 text-sm',
  // Lõigu sees: kõrgus ja polster puuduvad, kirjasuurus tuleb ümbritsevast tekstist.
  inline: 'h-auto p-0 [font-size:inherit]',
  // Ikoonnupud: 6px nurk nagu vanadel .icon-btn-*; esitusnupp ümmargune.
  'icon-xs': 'size-5 rounded-sm',
  'icon-sm': 'size-7 rounded-sm',
  'icon-lg': 'size-10 rounded-full',
  // Kõrgus sisu järgi (kahe reaga nupp, nt filter-pill): vana .operator-selector-trigger 6px 12px.
  auto: 'px-3 py-1.5 text-sm',
} as const;
```

`buttonVariants` sees `size: buttonVariantSizes,` (Task 1 `inline` liigub siia) ja variandid:

```ts
        secondary:
          'bg-secondary border-secondary-border text-foreground enabled:hover:bg-secondary-hover aria-pressed:border-primary/40 aria-pressed:bg-primary/15 aria-pressed:text-success-text',
        ghost:
          'border-transparent bg-transparent text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground aria-pressed:bg-primary/15 aria-pressed:text-success-text',
```

`iconTooltip.ts:2`: `const ICON_SIZES = new Set(['icon-xs', 'icon-sm', 'icon-lg']);`

`UserMenu.tsx:91`: `size="icon"` → `size="icon-sm"`. `UiGallery.tsx` read 66, 278, 279, 281: `size="icon"` → `size="icon-sm"`; Nupud-sektsiooni lisa:

```tsx
          <Button variant="primary" size="icon-lg" title="Mängi"><Play size={18} /></Button>
          <Button size="xs"><RotateCcw size={11} /><span>Vaheta</span></Button>
          <Button size="xs" aria-pressed>Sim</Button>
          <Button variant="ghost" size="icon-xs" aria-pressed title="Rada nähtav"><Eye size={12} /></Button>
```

(impordi `Play`, `RotateCcw`, `Eye` `lucide-react`-ist, kui puuduvad). Kontroll: `grep -rn --include='*.tsx' -e 'size="icon"' src` → tühi.

Run: `npx vitest run src/components/ui` → PASS.

- [ ] **Step 3: Vaated — tekstita ikoonnupud**

| Fail:rida (HEAD) | Vana | Uus |
|---|---|---|
| `LayerControl.tsx:157–163`, `:198`, `:265`, `:294`, `:388`, `:413`, `:439` (7×) | `<button className="icon-toggle" onClick={…} title={… ? 'Peida' : 'Näita'}>` … `</button>` | `<Button variant="ghost" size="icon-xs" onClick={…} title={… ? 'Peida' : 'Näita'}>` … `</Button>` |
| `LayerControl.tsx:351–360` | `` <button type="button" className={`v-action-btn v-map-btn ${isTrackVisible ? 'active' : ''}`} title={…} onClick={…} disabled={!hasTrack}> `` | `<Button variant="ghost" size="icon-xs" aria-pressed={isTrackVisible} title={…} onClick={…} disabled={!hasTrack}>` |
| `CultivationControl.tsx:261–270` | `<button type="button" className="cc-play" onClick disabled title aria-label>` | `<Button variant="primary" size="icon-lg" onClick={onTogglePlay} disabled={!hasTrack} title={…} aria-label={…}>` (laps `cc-play-icon` jääb) |
| `CultivationControl.tsx:271–280` | `<button type="button" className="cc-icon-btn" …>` | `<Button size="icon-sm" …>` |
| `CultivationControl.tsx:316` | `<button type="button" className="cc-start-reset" onClick title aria-label>` | `<Button variant="ghost" size="icon-xs" onClick={handleResetToOrigin} title="Raja algusesse" aria-label="Lähtesta alguskellaaeg">` |
| `FieldWorksBoard.tsx:183` | `<button type="button" className="fw-card-add" title aria-label onClick>` | `<Button variant="ghost" size="icon-xs" className="fw-card-add" title="Lisa kanne" aria-label={…} onClick={onAddEntry}>` |
| `FieldWorksBoard.tsx:871`, `FieldManagerModal.tsx:517`, `FieldsTableView.tsx:364` | `<button type="button" className="fw-field-shape-btn corner" …>` | `<Button variant="ghost" size="icon-xs" className="fw-field-shape-btn corner" …>` |
| `FieldManagerModal.tsx:618` | `<button type="button" className="year-shape-btn" …>` | `<Button variant="ghost" size="icon-xs" className="year-shape-btn" …>` |

Vastav `</button>` → `</Button>`; impordi `Button` (`./ui`), kus puudub. `onClick` stopPropagation jm jääb muutmata.

- [ ] **Step 4: Vaated — tekstiga mini-, valik- ja linknupud**

| Fail:rida (HEAD) | Vana | Uus |
|---|---|---|
| `VehicleTracker.tsx:1366–1376`, `:1386–1396` | `<button className="mini-swap-btn" title onClick>` (laps `RotateCcw 11` + `<span>Vaheta</span>`) | `<Button size="xs" title={…} onClick={…}>` |
| `LayerControl.tsx:339–347` | `` <button type="button" className={`v-action-btn v-sim-btn ${isSimActive ? 'active' : ''}`} title onClick> `` | `<Button size="xs" aria-pressed={isSimActive} title={…} onClick={…}>` |
| `LayerControl.tsx:112–119` | `` <button key={id} className={`basemap-btn ${isActive ? 'active' : ''}`} onClick> `` | `<Button key={id} size="sm" aria-pressed={isActive} className="basemap-btn" onClick={() => onSelectBaseMap(id)}>` |
| `CultivationControl.tsx:247–255`, `:298` | `<button type="button" className="cc-link-btn" …>` | `<Button variant="link" size="sm" className="cc-link-btn" …>` |

- [ ] **Step 5: Kinnita, et vanad klassid on kasutuseta**

```bash
for c in icon-toggle v-action-btn v-map-btn v-sim-btn cc-play cc-icon-btn cc-start-reset mini-swap-btn; do
  echo "$c $(grep -rnw --include='*.ts' --include='*.tsx' -e "$c" src | wc -l)"; done
```

Kõik `0` (`cc-play-icon`, `basemap-btn`, `cc-link-btn`, `fw-card-add`, `fw-field-shape-btn`, `year-shape-btn` jäävad asetuse jaoks). Dünaamiline erikontroll: `grep -rn --include='*.tsx' -E -e '(v-|cc-|mini-)\$\{' src` → tühi.

- [ ] **Step 6: CSS**

`src/index.css` (otsi selektori järgi):

| Reegel | Tegevus |
|---|---|
| `.icon-toggle` | kustuta |
| `.basemap-btn` | asenda: `.basemap-btn { justify-content: space-between !important; /* Button keskjoondab */ }` |
| `.basemap-btn:hover`, `.basemap-btn.active` | kustuta |
| `.cc-link-btn` (põhireegel) | asenda: `.cc-link-btn { margin-left: auto; }` |
| `.cc-link-btn:hover` | kustuta |
| `@media` sees `.cc-link-btn { margin-left: 0; }` | jääb |
| `.cc-play`, `.cc-play:hover:not(:disabled)`, `.cc-icon-btn`, `.cc-icon-btn:hover:not(:disabled)`, `.cc-play:disabled, .cc-icon-btn:disabled`, `.cc-start-reset`, `.cc-start-reset:hover` | kustuta (`.cc-play-icon` jääb) |
| `.mini-swap-btn`, `.mini-swap-btn:hover` | kustuta |
| `.v-action-btn`, `:hover`, `:disabled`, `.v-map-btn`, `.v-map-btn.active`, `.v-sim-btn.active` (ja muud `.v-sim-btn*`) | kustuta |
| `.fw-card-add` | asenda: `.fw-card-add { position: absolute; top: 4px; right: 4px; opacity: 0.6; }` |
| `.fw-card-wrap:hover .fw-card-add` | jääb |
| `.fw-card-add:hover` | kustuta |
| `.fw-field-shape-btn`, `.fw-field-shape-btn:hover` | kustuta (`.fw-field-shape-btn.corner` jääb) |
| `[data-slot="table"] .year-shape-btn` | asenda: `[data-slot="table"] .year-shape-btn { margin-left: auto; flex-shrink: 0; }` |
| `[data-slot="table"] .year-shape-btn:hover` | kustuta |

`.name-cell.has-corner-btn { padding-right: 30px !important; }` jääb (20px nupp + 6px nihe mahub). Pärast: `npm run ui-audit -- --details | grep Kasutuseta` → 0; kui mõni klass (nt `.active-dot`, `.basemap-name`) jäi kasutuseta, kustuta ka see.

- [ ] **Step 7: README**

Jaotis „Nupud: vana → uus“: rida `btn btn-secondary btn-icon-only` → `<Button size="icon-sm">` (oli `icon`); lisa read `icon-toggle` → `<Button variant="ghost" size="icon-xs">`; `mini-swap-btn`, `v-action-btn` → `<Button size="xs">`; valitud olek → `aria-pressed={…}` (mitte `.active`). Uus reegel: „**Ikoonnupu suurused (kasutaja otsus 2026-11-16):** `icon-xs` 20px tabelis/kaardi nurgas, `icon-sm` 28px tööriistaribal ja päises, `icon-lg` 40px esitusnupp (ümmargune). Muud suurust ei lisata.“

- [ ] **Step 8: Kontrollid**

`npx vitest run src/tooling src/components/ui` → PASS; `tsc`; `npx oxlint src/components/ui src/components/LayerControl.tsx src/components/CultivationControl.tsx src/components/VehicleTracker.tsx src/components/FieldWorksBoard.tsx src/components/FieldManagerModal.tsx src/components/FieldsTableView.tsx src/components/UserMenu.tsx`. Kontroll: `grep -rn --include='*.tsx' -e '<button' src/components | grep -v components/ui/ | wc -l` → HEAD 59 − Task 1 (3) − Task 4 (21) = **≈35** (loetle järelejäänud raportis: Header nav 11, valitavad kaardid 1D, `fw-add` ×12, `login-forgot-link`, HelpHint, dropzone'id).

Oodatav ui-audit: „Kasutuseta klasse“ 0; „Erinevaid nurgaraadiusi“ väheneb või jääb; `wc -l src/index.css` **7 000–7 080**.

- [ ] **Step 9: Commit + release**

```bash
git add src/components/ui/variants.ts src/components/ui/variants.test.ts src/components/ui/iconTooltip.ts src/components/ui/iconTooltip.test.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/UserMenu.tsx src/components/LayerControl.tsx src/components/CultivationControl.tsx src/components/VehicleTracker.tsx src/components/FieldWorksBoard.tsx src/components/FieldManagerModal.tsx src/components/FieldsTableView.tsx src/index.css
git commit -m "refactor(ui): ikoonnupud ui Button'ile — kolm suurust (20/28/40), xs mini-nupp, aria-pressed olek" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

- [ ] **Step 10: Ekraanipildid**

1. `/ui --height 2400` — Nupud: `icon-lg`, `xs`, pressed.
2. Kihipaneel (silmad, aluskaart, Sim/rada): `/` ja `--do 'click:.layer-control-header' --do 'wait:500' /` (kui paneel on vaikimisi suletud) — silmaikoonid 20px, aluskaardi valitud roheline, Sim/rada nupud.
3. Taasesituse juhtpaneel: `--do 'click:.vehicle-marker-avatar >> nth=0' --do 'wait:1500' /` — esitusnupp 40px ümmargune, „Algusesse“ 28px, „Viimane sõit“ link. Kui marker ei ava juhtpaneeli, leia avamise tee `grep -n "CultivationControl" src/components/*.tsx` järgi ja kirjuta raportisse.
4. Masinate kaardid (mini-nupp „Vaheta“): `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Masinad' /`.
5. Tööde tahvel (kaardi „+“ hõljudes, kuju nupp nurgas): `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' --do 'hover:.fw-card-wrap >> nth=0' --do 'shot:fw-hover' /`.
6. Põllud ja Külvikord (kuju nupp nimelahtris, aasta lahtri nupp): `--do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500' /` ja `--do 'click:.main-view-switch >> text=Külvikord' --do 'wait:1500' /`.
7. Päis (väljalogimine 28px): `/` pildi ülaosa.

---

### Task 5: Pseudo-tabelid ui Table'ile ja klaviatuuriligipääs

**Nähtav mõju (väike):** mullaproovide ja ilma hooaja tabelid ui tabeli välimusega (päis, read, hover); klõpsatavad read, kaardid ja paneelide päised saavad Tab-fookuse ja Enter/Space.

**Files:**
- Create: `src/components/ui/keyActivation.ts`, `src/components/ui/keyActivation.test.ts`
- Modify: `src/components/ui/Table.tsx:36-45` (`TableRow`), `src/components/ui/Card.tsx:15-25`, `variants.ts` (`tableRowClass`, `cardVariants`), `variants.test.ts`, `index.ts`, `README.md`
- Modify: `src/components/SoilSamplesSection.tsx:73-135`, `src/components/WeatherSeasonSection.tsx:18-35,78-111`
- Modify: `src/components/VehicleTracker.tsx:1403,1573,1725,1976,1997,2021,2042`, `src/components/LayerControl.tsx:89`, `src/components/MapYearSelector.tsx:112,148`, `src/components/FieldManagerModal.tsx:604`
- Modify: `src/index.css` (soil/weather reeglid)

**Interfaces:**
- Produces: `handleActivationKey(e: ActivationKeyEvent, activate: () => void): boolean`, `clickOnActivationKey(e: React.KeyboardEvent<HTMLElement>): void`, `interface ActivationKeyEvent` (eksport `./ui` kaudu). `TableRow` `onClick`-iga: `tabIndex=0` + Enter/Space. `Card interactive` + `onClick` (mitte `asChild`): `role="button"`, `tabIndex=0`, Enter/Space. Task 9 (admin `TenantsView`) kasutab `TableRow onClick`.
- Consumes: `getSoilMetricLevel`, `getSoilMetricColor` (Task 3).

- [ ] **Step 1: Kirjuta failivad testid**

`src/components/ui/keyActivation.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { handleActivationKey, type ActivationKeyEvent } from './keyActivation';

const target = {} as EventTarget;
const ev = (key: string, over: Partial<ActivationKeyEvent> = {}): ActivationKeyEvent => {
  const e: ActivationKeyEvent = {
    key, target, currentTarget: target, defaultPrevented: false,
    preventDefault() { e.defaultPrevented = true; }, ...over,
  };
  return e;
};

describe('handleActivationKey', () => {
  it('Enter ja tühik käivitavad ja keelavad vaikimisi tegevuse (lehe kerimine)', () => {
    for (const key of ['Enter', ' ']) {
      const fn = vi.fn();
      const e = ev(key);
      expect(handleActivationKey(e, fn)).toBe(true);
      expect(fn).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    }
  });
  it('muud klahvid ei käivita', () => {
    const fn = vi.fn();
    expect(handleActivationKey(ev('a'), fn)).toBe(false);
    expect(handleActivationKey(ev('Tab'), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
  it('rea sees oleva nupu/välja Enter ei käivita rida', () => {
    const fn = vi.fn();
    expect(handleActivationKey(ev('Enter', { target: {} as EventTarget }), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
  it('kutsuja preventDefault eelnevalt → ei käivita', () => {
    const fn = vi.fn();
    expect(handleActivationKey(ev('Enter', { defaultPrevented: true }), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

`variants.test.ts` lõppu:

```ts
describe('klaviatuuri fookus', () => {
  it('klõpsatav tabelirida ja kaart näitavad fookust', () => {
    expect(v.tableRowClass({ clickable: true })).toContain('focus-visible:outline-primary');
    expect(v.tableRowClass({})).not.toContain('focus-visible:outline-primary');
    expect(v.cardVariants({ interactive: true })).toContain('focus-visible:ring-2');
    expect(v.cardVariants({})).not.toContain('focus-visible:ring-2');
  });
});
```

Run: `npx vitest run src/components/ui` → FAIL.

- [ ] **Step 2: Implementeeri**

`src/components/ui/keyActivation.ts`:

```ts
// src/components/ui/keyActivation.ts — klõpsatav rida/kaart/div klaviatuurilt: Enter või tühik = klõps
// (kasutaja otsus 2026-11-16: klaviatuuriligipääs ui tasemel).
import type React from 'react';

export interface ActivationKeyEvent {
  key: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  defaultPrevented: boolean;
  preventDefault(): void;
}

/** Enter/tühik elemendi enda peal (mitte selle sees oleval nupul/väljal) → activate. Tagastab, kas käivitas. */
export function handleActivationKey(e: ActivationKeyEvent, activate: () => void): boolean {
  if (e.defaultPrevented || e.target !== e.currentTarget) return false;
  if (e.key !== 'Enter' && e.key !== ' ') return false;
  e.preventDefault();
  activate();
  return true;
}

/** onKeyDown klõpsatavale elemendile: klaviatuur käivitab sama onClick'i (e.currentTarget.click()). */
export const clickOnActivationKey = (e: React.KeyboardEvent<HTMLElement>): void => {
  handleActivationKey(e, () => e.currentTarget.click());
};
```

`index.ts`: `export { clickOnActivationKey, handleActivationKey, type ActivationKeyEvent } from './keyActivation';`

`variants.ts`:

```ts
export const tableRowClass = ({ tone, clickable = false }: { tone?: TableRowTone; clickable?: boolean }): string =>
  cn(
    'group transition-colors hover:bg-table-hover data-[selected]:bg-table-selected data-[selected]:[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary)]',
    tone && ROW_TONES[tone],
    clickable && 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
  );
```

`cardVariants` `interactive.true`: `'cursor-pointer transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'`.

`Table.tsx` `TableRow` (impordi `clickOnActivationKey` `./keyActivation`-ist):

```tsx
/** Klõpsatav rida (onClick): Tab-fookus ja Enter/tühik käivitab sama klõpsu. */
export const TableRow: React.FC<React.ComponentProps<'tr'> & { selected?: boolean; tone?: TableRowTone }> = ({
  className, selected, tone, onClick, onKeyDown, tabIndex, ...props
}) => {
  const clickable = !!onClick;
  return (
    <tr
      data-selected={selected || undefined}
      onClick={onClick}
      tabIndex={clickable ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={clickable ? (e) => { onKeyDown?.(e); clickOnActivationKey(e); } : onKeyDown}
      className={cn(tableRowClass({ tone, clickable }), className)}
      {...props}
    />
  );
};
```

`Card.tsx`:

```tsx
export const Card: React.FC<CardProps> = ({
  className, variant, padding, interactive, selected, asChild = false, onClick, onKeyDown, tabIndex, role, ...props
}) => {
  const Comp = asChild ? Slot.Root : 'div';
  // Klõpsatav div-kaart: nupu roll ja Enter/tühik (asChild <button> haldab seda ise).
  const keyboard = !!interactive && !!onClick && !asChild;
  return (
    <Comp
      data-slot="card"
      data-selected={selected ? '' : undefined}
      onClick={onClick}
      role={keyboard ? (role ?? 'button') : role}
      tabIndex={keyboard ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={keyboard ? (e: React.KeyboardEvent<HTMLDivElement>) => { onKeyDown?.(e); clickOnActivationKey(e); } : onKeyDown}
      className={cn(cardVariants({ variant, padding, interactive, selected }), className)}
      {...props}
    />
  );
};
```

Run testid → PASS.

- [ ] **Step 3: Mullaproovid ui Table'ile**

`SoilSamplesSection.tsx` — asenda `<div className="soil-table">…</div>` blokk (HEAD 73–135; Task 3 muudatused selles sees):

```tsx
        <>
          <Table dense bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Aasta</TableHead>
                <TableHead numeric>Punkte</TableHead>
                {METRICS.map((m) => (
                  <TableHead key={m.key} numeric>{m.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {byYear.map(([year, list]) => {
                const age = currentYear - year;
                const isOpen = openYears.has(year);
                return (
                  <React.Fragment key={year}>
                    <TableRow onClick={() => toggleYear(year)} aria-expanded={isOpen} title="Näita punktide kaupa">
                      <TableCell>
                        <span className="soil-year-cell">
                          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {year}
                          {age > 0 && (
                            <span className="soil-age">
                              {age} a<span className="soil-age-dot" style={{ backgroundColor: getSoilMetricColor('age', age) }} />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell numeric>{list.length}</TableCell>
                      {METRICS.map((m) => {
                        const avg = average(list.map((s) => s[m.key as Exclude<SoilSampleMetricKey, 'age'>]));
                        return (
                          <TableCell key={m.key} numeric className="soil-value" data-level={getSoilMetricLevel(m.key, avg)}>
                            {fmt(avg)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {isOpen &&
                      list.map((s) => (
                        <TableRow key={s.sampleNumber} tone="muted">
                          <TableCell>Proov {s.sampleNumber}</TableCell>
                          <TableCell numeric />
                          {METRICS.map((m) => {
                            const v = s[m.key as Exclude<SoilSampleMetricKey, 'age'>];
                            return (
                              <TableCell key={m.key} numeric className="soil-value" data-level={getSoilMetricLevel(m.key, v)}>
                                {fmt(v)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          <p className="soil-footnote">Keskmised; P, K, Ca, Mg mg/kg · Corg % · lubjatarve t/ha</p>
        </>
```

Impordi `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` (`./ui`).

- [ ] **Step 4: Ilma hooaja tabel ui Table'ile**

`WeatherSeasonSection.tsx` — `WeatherRow`:

```tsx
const WeatherRow: React.FC<{ year: number; crop: string | null | undefined; sum: WeatherSummary; gddBaseC: number; yieldTonsHa: number | null | undefined; shifted?: boolean; current?: boolean }> = ({ year, crop, sum, gddBaseC, yieldTonsHa, shifted, current }) => (
  <TableRow tone={current ? undefined : 'muted'} className={current ? undefined : 'weather-season-past'}>
    <TableCell><span className="soil-year-cell">{year}{crop && <span className="weather-season-crop">{crop}</span>}</span></TableCell>
    <TableCell
      className={shifted ? 'weather-season-shifted' : undefined}
      title={shifted ? 'Selle aasta külvikuupäev puudub — kasutatud valitud hooaja kuupäevi' : undefined}
    >
      {formatDate(sum.from)} – {formatDate(sum.to)}
    </TableCell>
    <TableCell numeric className="soil-value" title={`Baas ${gddBaseC} °C`}>{fmt0(sum.gdd)}</TableCell>
    <TableCell numeric className="soil-value">{fmt0(sum.precipMm)}</TableCell>
    <TableCell numeric className="soil-value">{fmt0(sum.waterBalanceMm)}</TableCell>
    <TableCell numeric className="soil-value">{sum.longestDrySpell}</TableCell>
    <TableCell numeric className="soil-value">{sum.frostDays}</TableCell>
    <TableCell numeric className="soil-value">{yieldTonsHa != null ? fmt1(yieldTonsHa) : '—'}</TableCell>
  </TableRow>
);
```

Tabeliplokk (HEAD 78–111):

```tsx
      {(sum || history.length > 0) && (
        <>
          <Table dense bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Hooaeg</TableHead>
                <TableHead>Periood</TableHead>
                <TableHead numeric title="Temperatuurisumma kultuuri baastemperatuuriga">GDD</TableHead>
                <TableHead numeric>Sademed</TableHead>
                <TableHead numeric title="Sademed miinus potentsiaalne aurumine">Veebilanss</TableHead>
                <TableHead numeric title="Pikim järjestikuste kuivade päevade arv">Kuiv per.</TableHead>
                <TableHead numeric title="Öökülmapäevad 60 päeva jooksul pärast külvi">Öökülm</TableHead>
                <TableHead numeric>Saak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sum && year != null && rep && (
                <WeatherRow year={year} crop={crop} sum={sum} gddBaseC={rep.gddBaseC} yieldTonsHa={actualYieldTonsHa} current />
              )}
              {history.map((h) => (
                <WeatherRow key={h.year} year={h.year} crop={h.crop} sum={h.summary} gddBaseC={h.gddBaseC} yieldTonsHa={h.actualYieldTonsHa} shifted={!h.ownDates} />
              ))}
            </TableBody>
          </Table>
          <p className="soil-footnote">
            {sum && !sum.complete && sum.dataUntil && `Andmed kuni ${formatDate(sum.dataUntil)} · `}
            GDD °C kultuuri baastemperatuuriga · sademed ja veebilanss mm · kuiv periood ja öökülm päevi · saak t/ha
            {anyShifted && ' · kaldkirjas periood: selle aasta külvikuupäev puudub, kasutatud valitud hooaja kuupäevi'}
            {' · '}{WEATHER_SOURCE}
          </p>
        </>
      )}
```

Impordi ui tabeli osad.

- [ ] **Step 5: CSS**

Kinnita kasutuseta: `for c in soil-table soil-row soil-row-head soil-row-year soil-row-point weather-season-row weather-season-period; do echo "$c $(grep -rnw --include='*.tsx' --include='*.ts' -e $c src | wc -l)"; done` → kõik 0.

`src/index.css`: kustuta `.soil-table`, `.soil-row`, `.soil-row>span:first-child`, `.soil-row-head`, `.soil-row-year`, `.soil-row-year:hover`, `.soil-row-point`, `.soil-row.weather-season-row`, `.weather-season-period`, `.soil-row.weather-season-past`, `.soil-row.weather-season-past .soil-value`. Asenda `.soil-footnote`:

```css
.soil-footnote {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}
```

Lisa (ilma tabeli mineviku read tavakirjas, käesolev rasvane):

```css
.weather-season-past .soil-value { font-weight: 400; }
```

`.soil-year-cell`, `.soil-age`, `.soil-value`, `.soil-value[data-level=…]`, `.soil-age-dot`, `.weather-season-crop`, `.weather-season-shifted` jäävad.

- [ ] **Step 6: Toored klõpsatavad elemendid**

Impordi igas failis `clickOnActivationKey` (`./ui`).

| Fail:rida (HEAD) | Lisa elemendile |
|---|---|
| `VehicleTracker.tsx:1403`, `:1573`, `:1725` (`div.fleet-card-notes`) | `role="button" tabIndex={0} onKeyDown={clickOnActivationKey}` |
| `VehicleTracker.tsx:1976`, `:1997`, `:2021`, `:2042` (`div.swap-option-item`) | `role="button" tabIndex={0} onKeyDown={clickOnActivationKey}` |
| `LayerControl.tsx:89` (`div.layer-control-header`) | `role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={clickOnActivationKey}` |
| `MapYearSelector.tsx:112` (`div.widget-legend-header`) | `role="button" tabIndex={0} aria-expanded={isLegendOpen} onKeyDown={clickOnActivationKey}` |
| `MapYearSelector.tsx:148` (`div.crop-legend-item`) | `role="button" tabIndex={0} aria-pressed={isSelected} onKeyDown={clickOnActivationKey}` |
| `FieldManagerModal.tsx:604` (`TableCell.year-cell`) | `tabIndex={editable ? 0 : undefined} onKeyDown={editable ? clickOnActivationKey : undefined}` (kasuta sama tingimust mis `onClick`-il; kui `onClick` on alati, siis alati) |

`TableRow onClick` 8 kohta (`ArticlesView:265`, `FinanceModal:914`, `HarvestLotsPanel:82`, `SeasonManagerModal:224,278`, `TripRegister:232`, `WeatherView:106`) ja `Card interactive onClick` 3 kohta (`PoiManagerModal:392`, `RelatedPartiesModal:488`, `VehicleTracker:1298`) saavad klaviatuuri ui kaudu — muuta pole vaja. Kontrolli, et ükski neist ei anna ise `tabIndex={-1}`: `grep -rn --include='*.tsx' -e 'tabIndex={-1}' src/components | grep -v ui/`.

Pargitud (raportisse): dropzone'id (`FieldUploadModal`, `FieldBookUploadModal`, `SoilSampleUploadModal` — failisisend on klaviatuurile kättesaadav valikunupu kaudu), `TableCell onClick stopPropagation` (3, ei ole tegevus), admin `TenantsView` (Task 9).

- [ ] **Step 7: README**

Jaotis „Tabel“: `TableRow` rida — „`onClick` annab kursori, Tab-fookuse ja Enter/tühiku (sama klõps)“. Jaotis „Kaart“: „`interactive` + `onClick` div-kaardil annab `role="button"`, Tab-fookuse ja Enter/tühiku“. „Reeglid“: „Toores klõpsatav `div`/`span`: `role="button" tabIndex={0} onKeyDown={clickOnActivationKey}` (või kasuta `Button`/`Card interactive`/`TableRow`).“

- [ ] **Step 8: Kontrollid**

`npx vitest run src/tooling src/components/ui src/types/soilSample.test.ts` → PASS; `tsc`; `npx oxlint` muudetud failidele. Oodatav ui-audit: „Vanu tabeleid (tsx)“ 0; „Kasutuseta klasse“ 0; „Erinevaid kirjasuurusi (CSS)“ väheneb (0.64/0.66rem soil-reeglitest kadusid — kirjuta arv); „style={{…}}“ muutumata. `wc -l src/index.css` **6 980–7 040**.

- [ ] **Step 9: Commit + release**

```bash
git add src/components/ui/keyActivation.ts src/components/ui/keyActivation.test.ts src/components/ui/Table.tsx src/components/ui/Card.tsx src/components/ui/variants.ts src/components/ui/variants.test.ts src/components/ui/index.ts src/components/ui/README.md src/components/SoilSamplesSection.tsx src/components/WeatherSeasonSection.tsx src/components/VehicleTracker.tsx src/components/LayerControl.tsx src/components/MapYearSelector.tsx src/components/FieldManagerModal.tsx src/index.css
git commit -m "refactor(ui): mulla ja ilma tabelid ui Table'ile; klõpsatavad read, kaardid ja paneelid klaviatuurilt" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

- [ ] **Step 10: Ekraanipildid**

1. Põllu aken (mullaproovid + ilm, kitsas paneel): `--height 2400 --do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500' --do 'click:[data-slot="table"] tbody tr >> nth=0' --do 'wait:2000' --do 'eval:document.querySelector(".soil-footnote")?.scrollIntoView()' --do 'shot:soil-weather' /` — tabelid loetavad, veerud ei kattu, jalusemärkus 11px; kitsas paneel kerib horisontaalselt.
2. Aasta lahtiklõps klaviatuurilt: sama + `--do 'eval:document.querySelector("[data-slot=table] tbody tr[aria-expanded]")?.focus()' --do 'key:Enter' --do 'wait:400' --do 'shot:soil-open'` — punktiread ilmuvad, fookusraam nähtav.
3. Kihipaneel klaviatuurilt: `--do 'eval:document.querySelector(".layer-control-header")?.focus()' --do 'key:Enter' --do 'wait:400' /`.
4. Sõitude register (klõpsatavad read): `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Sõidud' --do 'wait:1500' --do 'eval:document.querySelector("[data-slot=table] tbody tr[tabindex]")?.focus()' /` — fookus nähtav.

---

### Task 6: Inline-stiilid klassideks ja komponentideks — FilterBar, EmptyState, tahvli asukohad

**Nähtav mõju:** puudub või mikro (filtririba vahed ühtlased; Tehnika haakimise registri olekunupud muutuvad `ToggleGroup`-iks nagu seadmete seoste registris; kaks ikooninuppu FieldEditDialog-is muutuvad halliks ghost-nupuks).

**Files:**
- Create: `src/components/ui/FilterBar.tsx`, `src/components/ui/EmptyState.tsx`
- Modify: `src/components/ui/variants.ts`, `variants.test.ts`, `index.ts`, `UiGallery.tsx`, `README.md`
- Modify: `src/components/VehicleTracker.tsx`, `DeviceAssignmentRegister.tsx`, `TripRegister.tsx`, `RelatedPartiesModal.tsx`, `FieldWorksBoard.tsx`, `FieldEditDialog.tsx`, `FieldUploadModal.tsx`, `FieldBookUploadModal.tsx`, `SoilSampleUploadModal.tsx`, `TripDialog.tsx`, `TripGapReviewDialog.tsx`, `CropRegisterModal.tsx`, `AddFieldWorkDialog.tsx`, `AuthGate.tsx`, `FieldWorkEntryDialog.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `--tone-danger-text` (Task 3).
- Produces: `FilterBar: React.FC<{ actions?: React.ReactNode; className?: string; children: React.ReactNode }>`; `FilterBarItem: React.FC<{ width?: 'sm' | 'md' | 'lg'; children: React.ReactNode }>` (sm 152px, md 180px, lg 200px); `EmptyState: React.FC<{ icon?: React.ReactNode; title?: React.ReactNode; description?: React.ReactNode; className?: string; children?: React.ReactNode }>`; variandid `filterBarClass`, `filterBarLabelClass`, `filterBarActionsClass`, `filterBarItemClass(width)`, `emptyStateClass`, `emptyStateIconClass`, `emptyStateTitleClass`, `emptyStateDescriptionClass`.

- [ ] **Step 1: Kirjuta failivad testid**

`variants.test.ts` — `allClassStrings` lõppu: `v.filterBarClass, v.filterBarLabelClass, v.filterBarActionsClass, v.filterBarItemClass('sm'), v.filterBarItemClass('md'), v.filterBarItemClass('lg'), v.emptyStateClass, v.emptyStateIconClass, v.emptyStateTitleClass, v.emptyStateDescriptionClass,` ja faili lõppu:

```ts
describe('filtririba ja tühi olek', () => {
  it('filtririba murdub, vahe 12px, tegevused paremale', () => {
    expect(v.filterBarClass).toContain('flex-wrap');
    expect(v.filterBarClass).toContain('gap-3');
    expect(v.filterBarActionsClass).toContain('ml-auto');
  });
  it('filtri ümbris: miinimumlaius ja rippmenüü täidab ümbrise', () => {
    expect(v.filterBarItemClass('md')).toContain('min-w-45');
    expect(v.filterBarItemClass('sm')).toContain('min-w-38');
    expect(v.filterBarItemClass('lg')).toContain('min-w-50');
    expect(v.filterBarItemClass('md')).toContain('[&>[data-slot=filter-clear]]:w-full');
  });
  it('tühi olek: keskel, 32px polster, pealkiri 16px, kirjeldus 13px, ikoon summutatud', () => {
    expect(v.emptyStateClass).toContain('p-8');
    expect(v.emptyStateClass).toContain('text-center');
    expect(v.emptyStateTitleClass).toContain('text-lg');
    expect(v.emptyStateDescriptionClass).toContain('text-sm');
    expect(v.emptyStateIconClass).toContain('opacity-40');
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implementeeri**

`variants.ts` lõppu:

```ts
// --- Filtririba ja tühi olek (etapp 3) ---
export const filterBarClass = 'flex flex-wrap items-center gap-3';
export const filterBarLabelClass = 'inline-flex items-center gap-1.5 text-sm font-semibold';
export const filterBarActionsClass = 'ml-auto flex items-center gap-2';
const FILTER_BAR_ITEM_WIDTH = { sm: 'min-w-38', md: 'min-w-45', lg: 'min-w-50' } as const;
/** Rippmenüü ümbris filtriribal: miinimumlaius (152/180/200px), FilterClear ja FilterSelect täidavad selle. */
export const filterBarItemClass = (width: keyof typeof FILTER_BAR_ITEM_WIDTH): string =>
  cn(
    FILTER_BAR_ITEM_WIDTH[width],
    '[&>[data-slot=filter-clear]]:flex [&>[data-slot=filter-clear]]:w-full [&>[data-slot=filter-clear]>[data-slot=filter-select]]:w-full'
  );

export const emptyStateClass = 'flex flex-col items-center gap-2 p-8 text-center text-subtle';
export const emptyStateIconClass = 'inline-flex opacity-40';
export const emptyStateTitleClass = 'text-lg font-semibold text-foreground';
export const emptyStateDescriptionClass = 'm-0 text-sm';
```

`src/components/ui/FilterBar.tsx`:

```tsx
// src/components/ui/FilterBar.tsx — registri filtririba: kaart, „Filtrid:“ silt, filtrid, paremal tegevused (tühjenda, värskenda).
import React from 'react';
import { Filter } from 'lucide-react';
import { Card } from './Card';
import { cn } from './cn';
import { filterBarActionsClass, filterBarClass, filterBarItemClass, filterBarLabelClass } from './variants';

export const FilterBar: React.FC<{ actions?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  actions, className, children,
}) => (
  <Card padding="sm" className={cn(filterBarClass, className)}>
    <span className={filterBarLabelClass}>
      <Filter size={15} className="text-subtle" aria-hidden="true" />
      Filtrid:
    </span>
    {children}
    {actions && <div className={filterBarActionsClass}>{actions}</div>}
  </Card>
);

/** Rippmenüü (FilterClear + FilterSelect) ümbris kindla miinimumlaiusega. */
export const FilterBarItem: React.FC<{ width?: 'sm' | 'md' | 'lg'; children: React.ReactNode }> = ({ width = 'md', children }) => (
  <div className={filterBarItemClass(width)}>{children}</div>
);
```

`src/components/ui/EmptyState.tsx`:

```tsx
// src/components/ui/EmptyState.tsx — tühja registri / laadimise olek kaardina: ikoon, pealkiri, selgitus.
import React from 'react';
import { Card } from './Card';
import { cn } from './cn';
import { emptyStateClass, emptyStateDescriptionClass, emptyStateIconClass, emptyStateTitleClass } from './variants';

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}> = ({ icon, title, description, className, children }) => (
  <Card padding="none" className={cn(emptyStateClass, className)}>
    {icon && <span className={emptyStateIconClass} aria-hidden="true">{icon}</span>}
    {title && <div className={emptyStateTitleClass}>{title}</div>}
    {description && <p className={emptyStateDescriptionClass}>{description}</p>}
    {children}
  </Card>
);
```

`index.ts`: `export { FilterBar, FilterBarItem } from './FilterBar';` ja `export { EmptyState } from './EmptyState';`. Galeriisse sektsioon „Filtririba ja tühi olek“: üks `FilterBar` (kaks `FilterBarItem`-it `FilterSelect`-iga, `actions={<Button size="sm">Värskenda</Button>}`) ja üks `<EmptyState icon={<Inbox size={36} />} title="Kirjeid pole" description="Lisa esimene kirje." />`. Run testid → PASS.

- [ ] **Step 3: Filtriribad ja tühjad olekud (kolm registrit)**

`VehicleTracker.tsx` (HEAD 1790–1870), `DeviceAssignmentRegister.tsx` (177–250), `TripRegister.tsx` (127–205):

| Vana | Uus |
|---|---|
| `<div className="implement-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>` | `<div className="implement-history-section">` |
| `<Card padding="sm" className="history-filter-bar">` + `<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Filter size={15} … /><span style={{ fontSize: '13px', fontWeight: 600 }}>Filtrid:</span></div>` … `</Card>` | `<FilterBar actions={…}>` … `</FilterBar>` (silt tuleb komponendist) |
| `<div style={{ minWidth: '180px' }}>` … `</div>` | `<FilterBarItem>` … `</FilterBarItem>` |
| `<div style={{ minWidth: '150px' }}>` (TripRegister 161) | `<FilterBarItem width="sm">` |
| `<div style={{ minWidth: '200px' }}>` (TripRegister 167) | `<FilterBarItem width="lg">` |
| VehicleTracker 1820–1833: `<div style={{ display: 'flex', gap: '4px' }}>` + kolm `Button variant={historyStatusFilter === … ? 'primary' : 'secondary'} size="sm"` | `<ToggleGroup aria-label="Haakimiste filter" value={historyStatusFilter} onValueChange={(next) => setHistoryStatusFilter(next as typeof historyStatusFilter)}><ToggleGroupItem value="all">Kõik ({implementAssignments.length})</ToggleGroupItem><ToggleGroupItem value="active">Aktiivsed ({implementAssignments.filter((a) => !a.endedAt).length})</ToggleGroupItem><ToggleGroupItem value="ended">Ajalugu ({implementAssignments.filter((a) => !!a.endedAt).length})</ToggleGroupItem></ToggleGroup>` (nagu `DeviceAssignmentRegister.tsx:210-214`) |
| „Tühjenda filtrid“ `Button variant="ghost" size="sm" … style={{ fontSize: '12px', marginLeft: 'auto' }}` ja „Värskenda“ `Button size="sm" … style={{ marginLeft: … }}` | mõlemad `actions` prop'i fragmendis samas järjekorras; `style` kustub |
| TripRegister 143 `<span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>` (periood) | `<span className="filter-period">` |
| TripRegister 187 värskenda `style={{ marginLeft: 'auto' }}` | `actions` prop'i, `style` kustub; `trip-gap-count` jääb lastesse |
| `<div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Laen …</div>` | `<EmptyState description="Laen …" />` (tekst samaks) |
| `<Card padding="none" className="empty-register-state is-muted"><X size={36} style={{ opacity: 0.4 }} /><div style={{ fontSize: '16px', … }}>Pealkiri</div><p style={{ fontSize: '13px', margin: 0 }}>Tekst</p></Card>` | `<EmptyState icon={<X size={36} />} title="Pealkiri" description={…} />` |
| `RelatedPartiesModal.tsx:593–597` `Card … empty-register-state` + `AlertCircle size={28}` + `h4 style` + `p style` | `<EmptyState icon={<AlertCircle size={28} />} title="Otsingule vastavaid isikuid ei leitud" description="Proovi muuta otsingusõna või vali teine rollifilter." />` |

Impordi `FilterBar, FilterBarItem, EmptyState, ToggleGroup, ToggleGroupItem` (`./ui`); eemalda `Filter` import, kui enam ei kasutata.

`src/index.css`: kustuta `.history-filter-bar` ja kaks `.history-filter-bar > div > …` reeglit, `.empty-register-state`, `.empty-register-state.is-muted` (enne: `grep -rnw --include='*.tsx' --include='*.ts' -e history-filter-bar -e empty-register-state src` → ainult `src/tooling/uiAudit.ts` LEGACY_CARD_CLASSES valvurinimekiri — see jääb). Lisa:

```css
/* Tehnika registrite sisu: filtririba, tabel, tühi olek üksteise all */
.implement-history-section { display: flex; flex-direction: column; gap: 16px; }
/* Filtririba perioodi valik: kaks kuupäeva kriipsuga */
.filter-period { display: inline-flex; align-items: center; gap: 6px; }
```

(olemasolev `.fleet-board-body > .implement-history-section` jääb).

- [ ] **Step 4: Põllutööde tahvli asukohad**

`src/index.css` `.fw-cell {` reegli ette:

```css
/* Tööde tahvli ruudustiku asukohad (11 veergu: põld | eelmine 2–4 | käesolev 5–8 | järgmine 9–11; 2 rida) */
.fw-place-field { grid-column: 1 / 2; grid-row: 1 / 3; }
.fw-place-banner-current { grid-column: 2 / 9; grid-row: 1 / 2; }
.fw-place-banner-next { grid-column: 9 / 12; grid-row: 1 / 2; }
.fw-place-head-prev { grid-column: 2 / 5; }
.fw-place-head-current { grid-column: 5 / 9; }
.fw-place-head-next { grid-column: 9 / 12; }
.fw-place-next-all { grid-column: 9 / 12; grid-row: 2 / 3; }
.fw-col-2 { grid-column: 2 / 3; grid-row: 2 / 3; }
.fw-col-3 { grid-column: 3 / 4; grid-row: 2 / 3; }
.fw-col-4 { grid-column: 4 / 5; grid-row: 2 / 3; }
.fw-col-5 { grid-column: 5 / 6; grid-row: 2 / 3; }
.fw-col-6 { grid-column: 6 / 7; grid-row: 2 / 3; }
.fw-col-7 { grid-column: 7 / 8; grid-row: 2 / 3; }
.fw-col-8 { grid-column: 8 / 9; grid-row: 2 / 3; }
.fw-col-9 { grid-column: 9 / 10; grid-row: 2 / 3; }
.fw-col-10 { grid-column: 10 / 11; grid-row: 2 / 3; }
.fw-col-11 { grid-column: 11 / 12; grid-row: 2 / 3; }
/* Hoiatusikoon tekstinupus (kustuta-nupp) */
.danger-icon { color: var(--tone-danger-text); }
```

`FieldWorksBoard.tsx` (HEAD read; lisa klass olemasolevale `className`-ile, `style` kustub):

| Rida | `style` | Lisa klass |
|---|---|---|
| 764 | `gridColumn: '2 / 5'` | `fw-place-head-prev` |
| 767 | `'5 / 9'` | `fw-place-head-current` |
| 770 | `'9 / 12'` | `fw-place-head-next` |
| 865–868 | `gridColumn: '1 / 2', gridRow: '1 / 3'` | `fw-place-field` (`` className={`fw-field fw-place-field ${fieldNextClass}`} ``) |
| 894–898 | `gridColumn: '2 / 9', gridRow: '1 / 2', ...(color ? { '--crop-color': color } : {})` | `fw-place-banner-current`; `style={color ? ({ '--crop-color': color } as React.CSSProperties) : undefined}` |
| 926–930 | `gridColumn: '9 / 12', gridRow: '1 / 2', ...(nextColor ? { '--next-crop-color': nextColor } : {})` | `fw-place-banner-next`; `style={nextColor ? ({ '--next-crop-color': nextColor } as React.CSSProperties) : undefined}` |
| 954 | `gridColumn: '9 / 12', gridRow: '1 / 2'` | `fw-place-banner-next` |
| 961 | `'2 / 3'`, `'2 / 3'` | `fw-col-2` |
| 973, 982 | `'3 / 4'` | `fw-col-3` |
| 990 | `'4 / 5'` | `fw-col-4` |
| 1001 | `'5 / 6'` | `fw-col-5` |
| 1013, 1019 | `'6 / 7'` | `fw-col-6` |
| 1037 | `'7 / 8'` | `fw-col-7` |
| 1047 | `'8 / 9'` | `fw-col-8` |
| 1066 | `'9 / 10'` | `fw-col-9` |
| 1083, 1098 | `'10 / 11'` | `fw-col-10` |
| 1106 | `'11 / 12'` | `fw-col-11` |
| 1122 | `'9 / 12'`, `'2 / 3'` | `fw-place-next-all` |
| 916, 948 | `<Trash2 size={11} style={{ color: '#dc2626' }} />` | `<Trash2 size={11} className="danger-icon" />` |

Kontroll: `grep -n -e 'gridColumn' -e 'gridRow' src/components/FieldWorksBoard.tsx` → tühi.

- [ ] **Step 5: Ülejäänud staatilised inline-stiilid**

`src/index.css` lisa (loogilises kohas, iga juurde eestikeelne kommentaar):

```css
.form-sub-header.with-top-gap { margin-top: 16px; }
.auth-error-banner.with-bottom-gap { margin-bottom: 16px; }
.sub-val.is-muted { color: var(--text-muted); }
.secondary-note { font-size: 13px; color: var(--text-secondary); }
.muted-note { font-size: 12px; color: var(--text-muted); }
.work-full-name { display: block; font-weight: 400; color: var(--text-secondary); }
.device-assign-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.inline-icon-text { display: flex; align-items: center; gap: 4px; }
.footer-start { margin-right: auto; }
.alert-box.with-action { margin: 8px; display: flex; gap: 12px; align-items: center; justify-content: space-between; }
.alert-box.is-stacked { flex-direction: column; align-items: stretch; gap: 4px; margin: 8px 0; }
.hint-text.is-block { display: block; margin-top: 4px; }
.crop-color-dot { display: inline-block; width: 10px; height: 10px; border-radius: 9999px; border: 1px solid var(--border-card); }
.crop-edit-modal { border-top: 4px solid var(--blue-500) !important; /* DialogContent ääris on utiliit */ }
```

| Fail:rida (HEAD) | Vana | Uus |
|---|---|---|
| `RelatedPartiesModal.tsx:307,337`, `FieldEditDialog.tsx:428,623` | `<div className="form-sub-header" style={{ marginTop: '16px' }}>` | `<div className="form-sub-header with-top-gap">` |
| `VehicleTracker.tsx:1188`, `DeviceAssignmentRegister.tsx:354` | `<div className="auth-error-banner" style={{ marginBottom: '16px' }}>` | `<div className="auth-error-banner with-bottom-gap">` |
| `RelatedPartiesModal.tsx:419` | `<span className="sub-val" style={{ color: 'var(--text-muted)' }}>` | `<span className="sub-val is-muted">` |
| `RelatedPartiesModal.tsx:658`, `CropRegisterModal.tsx:914` | `<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>` | `<span className="secondary-note">` |
| `FieldEditDialog.tsx:535` | `<span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>` | `<span className="muted-note">` |
| `AddFieldWorkDialog.tsx:137` | `<small style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)' }}>` | `<small className="work-full-name">` |
| `VehicleTracker.tsx:1701` | `<label htmlFor={…} style={{ fontSize: '0.72rem', fontWeight: 600 }}>` (klass `text-secondary` kustus Task 1-s) | `<label htmlFor={…} className="device-assign-label">` |
| `VehicleTracker.tsx:1562` | `<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>` | `<span className="inline-icon-text">` |
| `TripDialog.tsx:274,277` | `style={{ marginRight: 'auto' }}` | `className="footer-start"` |
| `AuthGate.tsx:162` | `<div className="alert-box" role="alert" style={{ margin: 8, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>` | `<div className="alert-box with-action" role="alert">` |
| `FieldUploadModal.tsx:267` | `` className={`alert-box ${importYearLocked ? 'error' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', margin: '8px 0' }} `` | `` className={`alert-box is-stacked ${importYearLocked ? 'error' : ''}`} `` |
| `FieldUploadModal.tsx:251` | `<span className="hint-text" style={{ display: 'block', marginTop: '4px' }}>` | `<span className="hint-text is-block">` |
| `TripGapReviewDialog.tsx:38` | `<p style={{ marginTop: 0 }}>` | `<p>` (globaalne `* { margin: 0 }`) |
| `CropRegisterModal.tsx:584` | `<DialogContent size="lg" className="crop-edit-modal" style={{ borderTop: '4px solid var(--blue-500)' }}>` | `<DialogContent size="lg" className="crop-edit-modal">` |
| `FieldEditDialog.tsx:472–479` | `style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: selectedCropObj.color, border: '1px solid rgba(0, 0, 0, 0.2)' }}` | `className="crop-color-dot" style={{ backgroundColor: selectedCropObj.color }}` |
| `FieldEditDialog.tsx:491–499`, `:682–690` | `Button variant="ghost" size="icon-sm" style={{ background: 'transparent', border: 'none', color: 'var(--emerald-500, #10b981)', … }}` | `style` kustub (ghost icon-sm annab välimuse) |
| `FieldUploadModal.tsx:196`, `FieldBookUploadModal.tsx:128`, `SoilSampleUploadModal.tsx:109` | `<input type="file" … style={{ display: 'none' }}` | `<input type="file" … hidden` (`type` jääb esimeseks atribuudiks) |
| `FieldWorkEntryDialog.tsx:570–574` | `style={(telemetryAreaHa.trim() === '' && hasSelectedSuggestion) ? { color: '#ef4444', borderColor: '#ef4444', fontWeight: 600, background: 'rgba(239, 68, 68, 0.08)' } : undefined}` | `aria-invalid={(telemetryAreaHa.trim() === '' && hasSelectedSuggestion) \|\| undefined}` (ui välja `aria-invalid` stiil) |

- [ ] **Step 6: README**

Uus jaotis „Filtririba ja tühi olek“: „`<FilterBar actions={…}>` + `<FilterBarItem width="sm|md|lg">` (152/180/200px) registrite filtritele; „Filtrid:“ silt tuleb komponendist. `<EmptyState icon title description />` tühjale registrile ja laadimisele (ainult `description`).“ „Reeglid“: „Staatiline `style={{…}}` → klass `index.css`-is või ui komponent; `style` ainult andmest tulev väärtus (värv, %, px). Peidetud failisisend: atribuut `hidden`. Vea olek väljal: `aria-invalid`.“

- [ ] **Step 7: Kontrollid**

`npx vitest run src/tooling src/components/ui src/types/soilSample.test.ts` → PASS; `tsc`; `npx oxlint` muudetud failidele. Kontroll: `grep -rn --include='*.tsx' -e 'style={{' src | grep -v components/ui/` — iga ülejäänud rida peab sisaldama muutujat/avaldist (andmevärv, %, px arvutus, `--crop-color`); loetle raportis.

Oodatav ui-audit: „style={{…}} kohti (tsx)“ **≤ 45**; „Kirjasuurusi inline (tsx)“ **0**; „Kasutuseta klasse“ 0; „Vanu kaarte“ 0. `wc -l src/index.css` **7 000–7 060**.

- [ ] **Step 8: Commit + release**

```bash
git add src/components/ui/FilterBar.tsx src/components/ui/EmptyState.tsx src/components/ui/variants.ts src/components/ui/variants.test.ts src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/VehicleTracker.tsx src/components/DeviceAssignmentRegister.tsx src/components/TripRegister.tsx src/components/RelatedPartiesModal.tsx src/components/FieldWorksBoard.tsx src/components/FieldEditDialog.tsx src/components/FieldUploadModal.tsx src/components/FieldBookUploadModal.tsx src/components/SoilSampleUploadModal.tsx src/components/TripDialog.tsx src/components/TripGapReviewDialog.tsx src/components/CropRegisterModal.tsx src/components/AddFieldWorkDialog.tsx src/components/AuthGate.tsx src/components/FieldWorkEntryDialog.tsx src/index.css
git commit -m "refactor(ui): staatilised inline-stiilid klassideks; FilterBar ja EmptyState ui-s; tahvli asukohad klassidena" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

- [ ] **Step 9: Ekraanipildid**

1. Haakimiste register: `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Haakimiste register' --do 'wait:1500' /` — filtririba, ToggleGroup, värskenda paremal.
2. Seadmete seosed: `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Seadmete seosed' --do 'wait:1500' /`.
3. Sõidud: `--do 'click:.main-view-switch >> text=Tehnika' --do 'wait:1500' --do 'click:text=Sõidud' --do 'wait:1500' /` — perioodi kuupäevad reas, 4 rippmenüüd, märkeruudud.
4. Tühi olek: `--do 'click:.main-view-switch >> text=Isikud' --do 'wait:1500' --do 'click:[data-slot=input] >> nth=0' --do 'key:x' --do 'key:q' --do 'key:z' --do 'wait:500' /`.
5. Põllutööde tahvel: `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' /` — kõik lahtrid samas kohas nagu Task 2 pildil (võrdle).
6. Põllu muutmise dialoog (värvipunkt, ikooninupud): `--do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500' --do 'click:[data-slot="table"] tbody tr >> nth=0' --do 'wait:1500' /`.

---

### Task 7: Andmevärvid ühte faili (`src/lib/dataColors.ts`)

**Nähtav mõju:** puudub.

**Files:**
- Create: `src/lib/dataColors.ts`, `src/lib/dataColors.test.ts`
- Modify: `src/server/fieldSeasonCopy.ts:4`, `src/server/apiHandler.ts:369,391,1655,1670`
- Modify: `src/App.tsx:1475`, `src/components/CropRegisterModal.tsx:67`, `FieldEditDialog.tsx:23,82,190`, `FieldWorksBoard.tsx:359`, `FieldManagerModal.tsx:188,259,263`, `FieldMapCard.tsx:29`, `MapView.tsx:354,567,613`, `VehicleTracker.tsx:285,562`, `components/MapMarkers.ts:25`, `LayerControl.tsx:241`, `FinanceModal.tsx:815,821,827,833`, `TripDialog.tsx:48,49,58,67`, `src/admin/CatalogView.tsx:67`, `src/types/crop.ts:56`, `src/types/fieldRegister.ts:83`, `src/types/soilSample.ts`
- Modify: `src/components/ui/README.md`

**Interfaces:**
- Produces (`src/lib/dataColors.ts`): `DEFAULT_CROP_COLOR = '#eab308'`, `UNDETERMINED_CROP_COLOR = '#94a3b8'`, `DEFAULT_VEHICLE_COLOR = '#22c55e'`, `type SoilLevel`, `SOIL_LEVEL_COLOR: Record<SoilLevel, string>`, `FINANCE_COST_COLOR: { labor; equipment; fuel; articles }`, `TRIP_MAP_COLOR: { start; end; swath; track }`.
- `src/types/soilSample.ts` re-ekspordib `SOIL_LEVEL_COLOR` ja `SoilLevel` (Task 3 importijad ei muutu). `src/server/fieldSeasonCopy.ts` re-ekspordib `UNDETERMINED_CROP_COLOR`.

- [ ] **Step 1: Kirjuta failiv test**

`src/lib/dataColors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as dc from './dataColors';
import { UNDETERMINED_CROP_COLOR as serverUndetermined } from '../server/fieldSeasonCopy';
import { SOIL_LEVEL_COLOR as soilLevelColor } from '../types/soilSample';

const HEX = /^#[0-9a-f]{6}$/;

describe('andmevärvid', () => {
  it('kõik väärtused on 6-kohalised väiketähtedega hex-id', () => {
    const all = [
      dc.DEFAULT_CROP_COLOR, dc.UNDETERMINED_CROP_COLOR, dc.DEFAULT_VEHICLE_COLOR,
      ...Object.values(dc.SOIL_LEVEL_COLOR), ...Object.values(dc.FINANCE_COST_COLOR), ...Object.values(dc.TRIP_MAP_COLOR),
    ];
    for (const c of all) expect(c).toMatch(HEX);
  });
  it('vaikimisi kultuur kollane, määramata hall, uus sõiduk roheline (olemasolevad andmed)', () => {
    expect(dc.DEFAULT_CROP_COLOR).toBe('#eab308');
    expect(dc.UNDETERMINED_CROP_COLOR).toBe('#94a3b8');
    expect(dc.DEFAULT_VEHICLE_COLOR).toBe('#22c55e');
  });
  it('server ja mullatüübid kasutavad sama konstanti', () => {
    expect(serverUndetermined).toBe(dc.UNDETERMINED_CROP_COLOR);
    expect(soilLevelColor).toBe(dc.SOIL_LEVEL_COLOR);
  });
});
```

Run: `npx vitest run src/lib` → FAIL.

- [ ] **Step 2: Loo fail**

`src/lib/dataColors.ts`:

```ts
// src/lib/dataColors.ts — andmevärvid ühes kohas (kasutaja otsus 2026-11-16). Need on andmed (kultuur, kaardikiht,
// mulla tase, graafiku seeria), mitte teema tokenid: kaardil ja andmebaasis on sama värv mõlemas teemas.
// UI värvid (tekst, nupp, ääris) on tokenid index.css / app.css-is. Server impordib selle faili `.ts` laiendiga.

/** Kultuur, millel registris värvi pole (ka andmebaasi vaikeväärtus). */
export const DEFAULT_CROP_COLOR = '#eab308';
/** Määramata kultuur (hooaeg ilma kultuurita) ja puuduv mõõtetulemus. */
export const UNDETERMINED_CROP_COLOR = '#94a3b8';
/** Uue sõiduki/märgi vaikevärv kaardil. */
export const DEFAULT_VEHICLE_COLOR = '#22c55e';

export type SoilLevel = 'bad' | 'warn' | 'good';
/** Mulla näitaja tase kaardil, legendis ja punktina. Tekstina kasuta toonitokenit (.soil-value[data-level]). */
export const SOIL_LEVEL_COLOR: Record<SoilLevel, string> = { bad: '#dc2626', warn: '#eab308', good: '#16a34a' };

/** Finantsi kulujaotuse seeriad (tulemuste riba legend). */
export const FINANCE_COST_COLOR = { labor: '#0284c7', equipment: '#d97706', fuel: '#ea580c', articles: '#16a34a' } as const;

/** Sõidu kaart (Leaflet): algus, lõpp, põllulõik haakeriista laiusega, rada. */
export const TRIP_MAP_COLOR = { start: '#10b981', end: '#ef4444', swath: '#16a34a', track: '#3b82f6' } as const;
```

- [ ] **Step 3: Asenda koopiad**

Server (impordid `.ts` laiendiga):

| Fail:rida | Vana | Uus |
|---|---|---|
| `src/server/fieldSeasonCopy.ts:4` | `export const UNDETERMINED_CROP_COLOR = '#94a3b8';` | `export { UNDETERMINED_CROP_COLOR } from '../lib/dataColors.ts';` (kui failis kasutatakse konstanti ka sees, lisa `import { UNDETERMINED_CROP_COLOR } from '../lib/dataColors.ts';`) |
| `src/server/apiHandler.ts:369,391` | `cropColor: h.cropColor \|\| '#eab308',` | `cropColor: h.cropColor \|\| DEFAULT_CROP_COLOR,` |
| `src/server/apiHandler.ts:1655,1670` | `color: crop.color \|\| '#eab308',` | `color: crop.color \|\| DEFAULT_CROP_COLOR,` |

(`apiHandler.ts` import: `import { DEFAULT_CROP_COLOR } from '../lib/dataColors.ts';`)

Klient (import laiendita, nagu ülejäänud kliendikood):

| Fail:rida | Vana | Uus |
|---|---|---|
| `App.tsx:1475` | `return fallback \|\| '#eab308';` | `return fallback \|\| DEFAULT_CROP_COLOR;` |
| `CropRegisterModal.tsx:67`, `FieldEditDialog.tsx:82` | `useState('#eab308')` | `useState(DEFAULT_CROP_COLOR)` |
| `FieldWorksBoard.tsx:359` | `?? '#eab308'` | `?? DEFAULT_CROP_COLOR` |
| `admin/CatalogView.tsx:67` | `crop?.color ?? '#eab308'` | `crop?.color ?? DEFAULT_CROP_COLOR` |
| `types/crop.ts:56` | `color: '#eab308',` | `color: DEFAULT_CROP_COLOR,` |
| `FieldEditDialog.tsx:23` | `const UNDETERMINED_CROP_COLOR = '#94a3b8';` | rida kustub; impordi `UNDETERMINED_CROP_COLOR` |
| `FieldManagerModal.tsx:188` | `undetermined ? '#94a3b8' : rec.cropColor \|\| '#94a3b8'` | `undetermined ? UNDETERMINED_CROP_COLOR : rec.cropColor \|\| UNDETERMINED_CROP_COLOR` |
| `FieldManagerModal.tsx:259` | `cropColor: '#94a3b8'` | `cropColor: UNDETERMINED_CROP_COLOR` |
| `MapView.tsx:354` | `: '#94a3b8'` | `: UNDETERMINED_CROP_COLOR` |
| `LayerControl.tsx:241` | `style={{ backgroundColor: '#94a3b8' }}` | `style={{ backgroundColor: UNDETERMINED_CROP_COLOR }}` |
| `types/fieldRegister.ts:83` | `cropColor: '#94a3b8',` | `cropColor: UNDETERMINED_CROP_COLOR,` |
| `types/soilSample.ts` `getSoilMetricColor` (2×) | `'#94a3b8'` | `UNDETERMINED_CROP_COLOR` |
| `types/soilSample.ts` (Task 3 read) | `export type SoilLevel = …;` ja `export const SOIL_LEVEL_COLOR = …;` | `import { SOIL_LEVEL_COLOR, UNDETERMINED_CROP_COLOR, type SoilLevel } from '../lib/dataColors';` + `export { SOIL_LEVEL_COLOR, type SoilLevel };` |
| `FieldManagerModal.tsx:263`, `FieldEditDialog.tsx:190` | `\|\| '#22c55e'` | `\|\| DEFAULT_VEHICLE_COLOR` |
| `FieldMapCard.tsx:29` | `p.cropColor \|\| '#22c55e'` | `p.cropColor \|\| DEFAULT_VEHICLE_COLOR` |
| `MapView.tsx:567,613` | `fillColor: '#22c55e',` | `fillColor: DEFAULT_VEHICLE_COLOR,` |
| `VehicleTracker.tsx:285,562` | `useState('#22c55e')`, `setVColor('#22c55e')` | `DEFAULT_VEHICLE_COLOR` |
| `components/MapMarkers.ts:25` | `vehicle.color \|\| '#22c55e'` | `vehicle.color \|\| DEFAULT_VEHICLE_COLOR` |
| `FinanceModal.tsx:815,821,827,833` | `backgroundColor: '#0284c7'` / `'#d97706'` / `'#ea580c'` / `'#16a34a'` | `FINANCE_COST_COLOR.labor` / `.equipment` / `.fuel` / `.articles` |
| `TripDialog.tsx:48,49,58,67` | `'#10b981'`, `'#ef4444'`, `'#16a34a'`, `'#3b82f6'` | `TRIP_MAP_COLOR.start`, `.end`, `.swath`, `.track` |

`types/crop.ts:74` (`'#22c55e'` kategooria värv) ja `services/cropColors.ts` palett jäävad (kultuuripaleti oma väärtused).

Kontroll:

```bash
grep -rn --include='*.ts' --include='*.tsx' -e "'#eab308'" -e "'#94a3b8'" -e "'#22c55e'" src | grep -v -e 'lib/dataColors' -e 'services/cropColors' -e 'types/crop.ts:74' -e '\.test\.'
```

→ tühi.

- [ ] **Step 4: README**

„Reeglid“: „Andmevärvid (kultuuri vaikevärv, määramata, sõiduk, mulla tase, graafiku seeriad, sõidu kaart) on `src/lib/dataColors.ts`-is; vaates ja serveris ei kirjutata hex-koodi uuesti. Erand: Leafleti kihtide stiilid `MapView.tsx`/`FieldShapeModal.tsx`, satelliidi legend (WMS-iga sama), sisselogimise taust.“

- [ ] **Step 5: Kontrollid**

`npx vitest run src/tooling src/components/ui src/types/soilSample.test.ts src/lib src/server/fieldSeasonCopy.test.ts` → PASS; `tsc`; **`npm run build`** (sh `tsc -b` ja serveri build — kontrollib `.ts` importi) → EXIT 0; `npx oxlint src/lib` + muudetud failid.

Oodatav ui-audit: „Värvikoode/rgba (tsx)“ 55 → **≤ 25** (järele: `MapView.tsx`, `FieldShapeModal.tsx`, `SatellitePanel.tsx`, `LoginBackdrop.tsx`, `ui/UiGallery.tsx`, `MapYearSelector.tsx` (võrdlus `'#3b82f6'`) — loetle raportis).

- [ ] **Step 6: Commit + release**

```bash
git add src/lib/dataColors.ts src/lib/dataColors.test.ts src/server/fieldSeasonCopy.ts src/server/apiHandler.ts src/App.tsx src/components/CropRegisterModal.tsx src/components/FieldEditDialog.tsx src/components/FieldWorksBoard.tsx src/components/FieldManagerModal.tsx src/components/FieldMapCard.tsx src/components/MapView.tsx src/components/VehicleTracker.tsx src/components/MapMarkers.ts src/components/LayerControl.tsx src/components/FinanceModal.tsx src/components/TripDialog.tsx src/admin/CatalogView.tsx src/types/crop.ts src/types/fieldRegister.ts src/types/soilSample.ts src/components/ui/README.md
git commit -m "refactor: andmevärvid ühte faili src/lib/dataColors.ts, koopiad konstantideks" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

- [ ] **Step 7: Ekraanipildid** (muutust ei tohi olla)

1. `/` (Kaart) — kultuurivärvid, sõidukimärgid.
2. Mulla kiht: `--do 'click:.layer-control-header' --do 'wait:500' --do 'click:text=Mullaproovid' --do 'wait:1500' /` (kui kihi nimi erineb, leia `grep -n "Mulla" src/components/LayerControl.tsx`) — legendi värvid.
3. Finants: leia avamise nupp `grep -n "FinanceModal" src/App.tsx src/components/Header.tsx` järgi ja kirjuta käsk raportisse — kulujaotuse riba punktid.

---

### Task 8: Kirjasuurused, nurgad ja vahed skaalale (`index.css`)

**Nähtav mõju (keskmine, hajus):** kõige väiksemad tekstid (tabelipäised, jalusemärkmed, mini-nupud) kerkivad 11px-ni; 0.84–0.9rem tekstid 14px; väikesed nurgad 6px; 3/5/7/9/11px vahed ±1px, 14/18/20/22px ±2px.

**Files:**
- Create: `src/tooling/cssScale.ts`, `src/tooling/cssScale.test.ts`, `scripts/css-scale.mts`
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts` (read „Skaalaväliseid kirjasuurusi (CSS)“, „Skaalaväliseid vahesid (CSS)“)
- Modify: `src/index.css` (skriptiga + käsitsi tabel)
- Modify: `src/components/ui/README.md`

**Interfaces:**
- Produces: `FONT_SCALE_PX`, `SPACING_SCALE_PX`, `scaleFontSize(px: number): number`, `scaleSpacing(px: number): number | null` (`null` = > 32px, käsitsi), `scaleRadius(token: string): string`, `rescaleCss(css: string): { css: string; manual: string[] }` (`cssScale.ts`); `offScaleCss(css: string): { fontSizes: string[]; spacing: string[] }` (`uiAudit.ts`). Task 9 kasutab skripti `admin.css`-il.

- [ ] **Step 1: Kirjuta failivad testid**

`src/tooling/cssScale.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rescaleCss, scaleFontSize, scaleRadius, scaleSpacing } from './cssScale';

describe('kirjasuurus → skaala 11/12/13/14/16/20 (inventuur 9A, kasutaja otsus: väikseimad 11px)', () => {
  it.each([
    [9.6, 11], [10.24, 11], [10.88, 11], [11, 11], [11.2, 11],
    [11.52, 12], [11.84, 12], [12.16, 12], [12, 12],
    [12.48, 13], [12.8, 13], [13.12, 13], [13, 13],
    [13.44, 14], [14.4, 14], [15.2, 14], [14, 14],
    [16, 16], [16.8, 16], [17.6, 16], [18.4, 16],
    [19.2, 20], [20, 20], [21.6, 20], [22.4, 20],
  ])('%spx → %spx', (input, expected) => expect(scaleFontSize(input)).toBe(expected));
});

describe('vahe → skaala 2,4,6,8,10,12,16,24,32 (võrdsel kaugusel väiksem, tihedus jääb)', () => {
  it.each([
    [1, 2], [1.5, 2], [2, 2], [3, 2], [4, 4], [5, 4], [7, 6], [9, 8], [11, 10],
    [14, 12], [18, 16], [20, 16], [22, 24], [25, 24], [28, 24], [30, 32], [32, 32],
    [-8, -8], [-10, -10], [-3, -2], [0, 0],
  ])('%spx → %spx', (input, expected) => expect(scaleSpacing(input)).toBe(expected));
  it('üle 32px jääb käsitsi (paigutuse mõõt)', () => {
    expect(scaleSpacing(36)).toBeNull();
    expect(scaleSpacing(56)).toBeNull();
  });
});

describe('nurk → 4 astet', () => {
  it.each([
    ['2px', 'var(--radius-sm)'], ['4px', 'var(--radius-sm)'], ['7px', 'var(--radius-sm)'],
    ['8px', 'var(--radius-md)'], ['10px', 'var(--radius-md)'], ['12px', 'var(--radius-md)'],
    ['16px', 'var(--radius-lg)'], ['50%', '9999px'], ['999px', '9999px'], ['0', '0'],
    ['var(--radius-sm)', 'var(--radius-sm)'],
  ])('%s → %s', (input, expected) => expect(scaleRadius(input)).toBe(expected));
});

describe('rescaleCss', () => {
  it('asendab rem/px väärtused, säilitab !important, muutujad, calc, auto ja em', () => {
    const r = rescaleCss(
      '.a{font-size:0.64rem;padding:3px 14px;border-radius:4px 4px 0 0;margin:0 auto;gap:var(--g)}\n' +
      '.b{font-size:0.85rem !important;margin-left:-5px;padding-right:0.12em;width:calc(100% - 7px)}'
    );
    expect(r.css).toBe(
      '.a{font-size:11px;padding:2px 12px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;margin:0 auto;gap:var(--g)}\n' +
      '.b{font-size:14px !important;margin-left:-4px;padding-right:0.12em;width:calc(100% - 7px)}'
    );
    expect(r.manual).toEqual([]);
  });
  it('üle 32px vahe jääb muutmata ja läheb käsitsi loetellu (rea nr)', () => {
    const r = rescaleCss('.a {\n  padding: 16px 44px 56px 16px;\n}');
    expect(r.css).toContain('padding: 16px 44px 56px 16px;');
    expect(r.manual).toEqual(['2: padding: 16px 44px 56px 16px']);
  });
  it('ei puutu font-size: inherit, var() ega muutujate definitsioone', () => {
    const css = '.a{font-size:inherit}.b{font-size:var(--x)}:root{--radius-sm: 6px;--cc-h: 32px}';
    expect(rescaleCss(css).css).toBe(css);
  });
});
```

`src/tooling/uiAudit.test.ts` (impordi `offScaleCss`):

```ts
describe('skaalavälised väärtused CSS-is', () => {
  it('kirjasuurus ja vahe väljaspool skaalat; muutujad, 0, auto ja negatiivne skaala ei loe', () => {
    const r = offScaleCss('.a{font-size:13px;font-size:0.8rem;font-size:15px;padding:4px 14px;margin:-8px 0 auto;gap:var(--g)}');
    expect(r.fontSizes).toEqual(['0.8rem', '15px']);
    expect(r.spacing).toEqual(['14px']);
  });
});
```

Run: `npx vitest run src/tooling` → FAIL.

- [ ] **Step 2: Implementeeri `cssScale.ts`, skript ja auditi read**

`src/tooling/cssScale.ts`:

```ts
// src/tooling/cssScale.ts — CSS-i väärtused spec'i skaalale (kirjasuurus 6, nurk 4, vahe 9 astet).
// Kasutaja otsus 2026-11-16: väikseimad kirjad kerkivad 11px-ni; > 32px vahed on paigutuse mõõdud (käsitsi).
export const FONT_SCALE_PX = [11, 12, 13, 14, 16, 20] as const;
export const SPACING_SCALE_PX = [2, 4, 6, 8, 10, 12, 16, 24, 32] as const;

/** Kirjasuurus: inventuuri 9A piirid (0.95rem → 14, 1.15rem → 16). */
export function scaleFontSize(px: number): number {
  if (px < 11.5) return 11;
  if (px < 12.5) return 12;
  if (px < 13.5) return 13;
  if (px < 15.5) return 14;
  if (px < 19) return 16;
  return 20;
}

/** Vahe: lähim skaala väärtus, võrdsel kaugusel väiksem; märk säilib; 0 → 0; > 32 → null (käsitsi). */
export function scaleSpacing(px: number): number | null {
  if (px === 0) return 0;
  const abs = Math.abs(px);
  if (abs > 32) return null;
  let best: number = SPACING_SCALE_PX[0];
  for (const s of SPACING_SCALE_PX) if (Math.abs(s - abs) < Math.abs(best - abs)) best = s;
  return Math.sign(px) * best;
}

/** Nurk: 1–7px → sm (6), 8–12px → md (10), 13–20px → lg (16), 50% / ≥ 999px → 9999px. */
export function scaleRadius(token: string): string {
  const t = token.trim();
  if (t === '50%' || /^(999|9999)px$/.test(t)) return '9999px';
  const m = t.match(/^(\d*\.?\d+)px$/);
  if (!m) return t;
  const px = parseFloat(m[1]);
  if (px === 0) return '0';
  if (px < 8) return 'var(--radius-sm)';
  if (px <= 12) return 'var(--radius-md)';
  if (px <= 20) return 'var(--radius-lg)';
  return '9999px';
}

const toPx = (token: string): number | null => {
  const m = token.match(/^(-?\d*\.?\d+)(px|rem)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' ? n * 16 : n;
};

const fmt = (n: number) => `${n}px`;
// Omadus peab algama reegli/deklaratsiooni piirilt; `--x:` muutujad ei vasta (eesliide `--` ei ole lubatud).
const DECL =
  /(^|[\s;{])(font-size|border-radius|(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?)(\s*:\s*)([^;}]+)/g;

/** Asendab deklaratsioonide väärtused; > 32px vahed jäävad ja tulevad `manual` loetellu („rida: omadus: väärtus“). */
export function rescaleCss(css: string): { css: string; manual: string[] } {
  const manual: string[] = [];
  const out = css.replace(DECL, (whole, lead: string, prop: string, sep: string, value: string, offset: number) => {
    if (lead === '' && offset > 0) return whole;
    const important = /!important/.test(value);
    const raw = value.replace(/!important/, '').trim();
    if (/var\(|calc\(|max\(|min\(|clamp\(/.test(raw)) return whole;
    const tokens = raw.split(/\s+/);
    let mapped: string[];
    if (prop === 'font-size') {
      const px = tokens.length === 1 ? toPx(tokens[0]) : null;
      if (px === null) return whole;
      mapped = [fmt(scaleFontSize(px))];
    } else if (prop === 'border-radius') {
      mapped = tokens.map(scaleRadius);
    } else {
      let tooBig = false;
      mapped = tokens.map((t) => {
        const px = toPx(t);
        if (px === null) return t;
        const s = scaleSpacing(px);
        if (s === null) { tooBig = true; return t; }
        return s === 0 ? t : fmt(s);
      });
      if (tooBig) {
        const line = css.slice(0, offset + lead.length).split('\n').length;
        manual.push(`${line}: ${prop}: ${raw}`);
        return whole;
      }
    }
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    return `${lead}${prop}${sep}${mapped.join(' ')}${important ? ' !important' : ''}${trailing}`;
  });
  return { css: out, manual };
}
```

Kontrolli testi esimese juhtumi täpset vormingut (tühik enne `!important`; `sep` säilitab tühikud koolonil); kohanda implementatsiooni, mitte testi, kuni PASS. `--radius-sm: 6px` ei tohi muutuda: `DECL` eesliite tingimus `(^|[\s;{])` + omadusnimi ilma `--`-ita tagab selle (testi 3. juhtum).

`scripts/css-scale.mts`:

```ts
// scripts/css-scale.mts — viib CSS-faili kirjasuurused, nurgad ja vahed skaalale (src/tooling/cssScale.ts).
// Kasutus: npx tsx scripts/css-scale.mts src/index.css [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { rescaleCss } from '../src/tooling/cssScale.ts';

const [file, flag] = process.argv.slice(2);
if (!file) throw new Error('Anna CSS-faili tee');
const before = readFileSync(file, 'utf8');
const { css, manual } = rescaleCss(before);
if (flag !== '--dry') writeFileSync(file, css);
console.log(`${file}: ${before === css ? 'muutusi pole' : 'muudetud'}${flag === '--dry' ? ' (kuiv käivitus)' : ''}`);
if (manual.length) console.log(`Käsitsi (> 32px):\n  ${manual.join('\n  ')}`);
```

`uiAudit.ts` lõppu:

```ts
const FONT_SCALE = new Set(['11px', '12px', '13px', '14px', '16px', '20px']);
const SPACING_SCALE_ABS = new Set(['2px', '4px', '6px', '8px', '10px', '12px', '16px', '24px', '32px']);

/** Skaalavälised kirjasuurused ja vahed (spec: kirjasuurusi ≤ 6, vahed ainult skaalast). */
export function offScaleCss(css: string): { fontSizes: string[]; spacing: string[] } {
  const a = auditCss(css);
  return {
    fontSizes: uniqueSorted(a.fontSizes.filter((f) => !FONT_SCALE.has(f))),
    spacing: uniqueSorted(a.spacing.filter((s) => !SPACING_SCALE_ABS.has(s.replace(/^-/, '')))),
  };
}
```

`scripts/ui-audit.mts` — pärast olemasolevaid ridu (impordi `offScaleCss`):

```ts
const cssText = files.filter((f) => f.path.endsWith('.css')).map((f) => f.content).join('\n');
const off = offScaleCss(cssText);
row('Skaalaväliseid kirjasuurusi (CSS)', off.fontSizes.length, off.fontSizes);
row('Skaalaväliseid vahesid (CSS)', off.spacing.length, off.spacing);
```

Run testid → PASS.

- [ ] **Step 3: Käsitsi paigutuse mõõdud (enne skripti)**

Need väärtused on paigutuse mõõdud (kaardi juhtnuppude ruum, logo nihe), mitte vahed — viia reegli-sisesteks muutujateks (deklaratsioon `--x: …` ei ole vahe) või ümardada. HEAD read (otsi deklaratsiooni teksti järgi):

| Rida (HEAD) | Vana | Uus |
|---|---|---|
| 540 | `padding: 16px 16px 56px 40px;` | samas reeglis `--controls-bottom: 56px; --controls-left: 40px;` + `padding: 16px 16px var(--controls-bottom) var(--controls-left);` (kommentaar: „ruum Leafleti nuppudele“) |
| 887 | `padding: 16px 44px 56px 16px;` | `--controls-right: 44px; --controls-bottom: 56px;` + `padding: 16px var(--controls-right) var(--controls-bottom) 16px;` |
| 3103 | `padding: 40px 20px;` | `padding: 32px 16px;` |
| 4209 | `padding-left: 28px !important;` | `padding-left: 24px !important;` |
| 4337 | `margin-left: max(0px, calc(16.667vw - 190px - 16px));` | `--brand-offset: 190px;` + `margin-left: max(0px, calc(16.667vw - var(--brand-offset) - 16px));` |
| 4361 | `padding-right: 0.12em;` (`.login-brand-word`) | `padding-right: 4px;` |
| 4372 | `padding: 30px 28px;` | `padding: 32px 24px;` |
| 5370 | `padding-right: 30px !important;` (`.name-cell.has-corner-btn`) | `padding-right: 32px !important;` |
| 5795 | `padding: 28px;` | `padding: 24px;` |
| 6700 | `padding: 36px 16px;` | `padding: 32px 16px;` |
| 7306 | `padding-left: 46px;` | `--indent: 46px;` + `padding-left: var(--indent);` (kommentaar: millega joondub — loe reegli konteksti) |

Pärast käivita `npx tsx scripts/css-scale.mts src/index.css --dry` — „Käsitsi“ loetelu peab olema tühi. Kui pole, lahenda samal põhimõttel ja lisa raportisse.

- [ ] **Step 4: Käivita skript**

```bash
npx tsx scripts/css-scale.mts src/index.css
git diff --stat src/index.css
git diff src/index.css | grep -E '^[-+]\s*--' | head   # ainult Step 3 lisatud muutujad; --radius-*, --cc-h jt definitsioonid ei tohi muutuda
```

Kontrolli diffist: `@keyframes` sees `transform` ei muutu; `50%` nurgad ringidel → `9999px`. Mitte-ruudukujuline element `50%`-ga (ellips) muutuks pilliks: `git diff src/index.css | grep -B8 '9999px'` ja vaata, kas reeglil on `width` ≠ `height`; kui jah, taasta seal `border-radius: 50%;` ja lisa rea juurde `/* ellips: skaala erand */` (raportisse).

- [ ] **Step 5: README**

„Reeglid“: „Ka `index.css`-is ainult skaala: kirjasuurus 11/12/13/14/16/20px, nurk `var(--radius-sm|md|lg)` või `9999px`, vahe 2/4/6/8/10/12/16/24/32px (negatiivne samast skaalast). Paigutuse mõõt (> 32px) reegli-sisese muutujana. `npx tsx scripts/css-scale.mts <fail>` viib faili skaalale; `npm run ui-audit` read „Skaalaväliseid …“ peavad olema 0.“

- [ ] **Step 6: Kontrollid**

`npx vitest run src/tooling src/components/ui` → PASS (sh `contrast.test.ts` — teema plokid ei tohi olla muutunud); `tsc`; `npx oxlint src/tooling scripts/css-scale.mts scripts/ui-audit.mts`.

Oodatav ui-audit (spec'i edukriteeriumid): „Erinevaid kirjasuurusi (CSS)“ **≤ 6**; „Erinevaid nurgaraadiusi (CSS)“ **≤ 4**; „Skaalaväliseid kirjasuurusi (CSS)“ **0**; „Skaalaväliseid vahesid (CSS)“ **0**; „Erinevaid vahe-väärtusi (CSS)“ ≤ 18 (9 skaala + negatiivsed). `wc -l src/index.css` muutumata (+ ~6 muutujarida).

- [ ] **Step 7: Commit + release**

```bash
git add src/tooling/cssScale.ts src/tooling/cssScale.test.ts scripts/css-scale.mts src/tooling/uiAudit.ts src/tooling/uiAudit.test.ts scripts/ui-audit.mts src/index.css src/components/ui/README.md
git commit -m "refactor(css): kirjasuurused (6), nurgad (4) ja vahed skaalale; ui-audit valvab skaalaväliseid väärtusi" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

- [ ] **Step 8: Ekraanipildid — kõik põhivaated mõlemas teemas** (`--height 1600`; võrdle Task 6/7 piltidega)

Iga vaate kohta eraldi käsk: `--do 'click:.main-view-switch >> text=<Nimi>' --do 'wait:2000' /` nimedega Põllud, Kultuurid, Külvikord, Põllutööd, Laoarvestus, Tehnika, Taristu, Isikud, Ilm, Hooajad; lisaks `/` (Kaart: kihipaneel, legend, aasta vidin), `--anon /` (sisselogimine), `/ui --height 3000`. Kasutaja otsus 6 eraldi: mini-nupud (Tehnika → `--do 'click:text=Masinad'` „Vaheta“; Kaart → kihipaneel „Sim“) ja `soil-footnote` (põllu aken, Task 5 Step 10 käsk 1). Kitsad paneelid: tööde tahvli lahtrid ja kaardipaneelid ei tohi murduda ega kattuda.

---

### Task 9: Admin (admin.teris.ee) ühiskomponentidele; audit admin ja landing; vanad `.btn` klassid välja

**Nähtav mõju (admin):** nupud, tabelid ja väljad nagu rakenduses; navigatsiooni valitud nupp rohelise olekuga. Rakenduses: puudub.

**Files:**
- Modify: `src/admin/AdminApp.tsx` (21 `btn`), `AiInstructionsView.tsx` (4 btn, 1 väli), `AuditView.tsx` (1 tabel), `CatalogView.tsx` (44 btn, 3 tabelit, 17 välja), `DevicesView.tsx` (3 btn, 2 tabelit), `HelpView.tsx` (9 btn, 1 väli), `InterestView.tsx` (3 btn, 1 tabel, 3 välja), `LandingStatsView.tsx` (4 btn, 4 tabelit), `LoginView.tsx` (2 btn, 3 välja), `NewTenantForm.tsx` (4 btn, 6 välja), `RichTextEditor.tsx` (tööriist), `TenantDetail.tsx` (14 btn, 1 tabel, 1 väli), `TenantsView.tsx` (2 btn, 1 tabel), `WeatherAdminView.tsx` (3 btn, 1 tabel) — loendid on sõne `btn` esinemised (sh `btn-*`)
- Modify: `src/admin/admin.css` (`.form-input*`, `.btn*`, `.admin-table*`, `.admin-nav .btn.active`, `.admin-rte-tool*` välja; skaala)
- Modify: `src/index.css` (`.btn-full` → `.full-width`, `.btn-alert-action` → `.alert-action`, `.btn-pick-map-highlight` → `.pick-map-highlight`; kommentaar ~7737)
- Modify: `src/components/LayerControl.tsx:457`, `LoginPage.tsx:76`, `SetPasswordPage.tsx:62,84`, `MapYearSelector.tsx:178`, `PoiManagerModal.tsx:261`, `FieldManagerModal.tsx:431`
- Modify: `scripts/ui-audit.mts`, `src/tooling/uiAudit.ts` (vajadusel)
- Modify: `src/components/ui/README.md`

**Interfaces:**
- Consumes: `Button` (`aria-pressed`, `size="sm"`, `icon-sm`), `Table*` (`TableRow onClick` klaviatuuriga, Task 5), `Input`, `Textarea`, `Select` (`value`, `onValueChange`, `options: { value; label }[]`), `Field` (admin kasutab juba), `rescaleCss` skript (Task 8).

- [ ] **Step 1: Auditi laiendus (enne üleviimist — näitab tööd)**

`scripts/ui-audit.mts`: `const EXCLUDE = ['src/landing', 'src/admin', 'src/styles'];` → `const EXCLUDE = ['src/landing', 'src/styles'];` (admin on nüüd kõigis ridades). Kustuta eraldi `adminFiles` plokk ja arvuta „Vanu kaarte“ `files`-ist (`summarize(files).legacyCardFiles`, rea nimi „Vanu kaarte (tsx+css)“). Faili lõppu landing eraldi plokina:

```ts
// Landing (avalik leht, oma stiil — ülemineku ulatusest väljas): ainult vanad komponendid ja inline-stiilid.
const landing = summarize(walk('src/landing', []).map((path) => ({ path, content: readFileSync(path, 'utf8') })));
const total = (l: { count: number }[]) => l.reduce((s, f) => s + f.count, 0);
row('Landing: style={{…}} kohti', landing.inlineStyles);
row('Landing: vanu nupuklasse', total(landing.legacyButtonFiles), landing.legacyButtonFiles.map((f) => `${f.path}: ${f.count}`));
row('Landing: tooreid vormivälju', total(landing.legacyFormFieldFiles), landing.legacyFormFieldFiles.map((f) => `${f.path}: ${f.count}`));
```

Run `npm run ui-audit -- --details` — „Vanu nupuklasse (tsx)“ ≈ **47+** (admin), „Vanu tabeleid (tsx)“ ≫ 0, „Vanu vormivälju (tsx)“ ≈ 30+ — kirjuta algarvud raportisse.

- [ ] **Step 2: Nupud**

Igas admini failis (impordi `Button` `../components/ui` kaudu):

| Vana | Uus |
|---|---|
| `<button type="button" className="btn btn-primary">` | `<Button variant="primary">` |
| `className="btn btn-secondary"` | `<Button>` |
| `className="btn btn-danger"` | `<Button variant="danger">` |
| `+ btn-sm` | `size="sm"` |
| `type="submit" className="btn btn-primary …"` | `<Button type="submit" variant="primary" …>` |
| AdminApp nav: `` className={`btn btn-secondary ${view.kind === 'catalog' ? 'active' : ''}`} `` (9×) | `<Button size="sm" aria-pressed={view.kind === 'catalog'} onClick={…}>` (Ettevõtted: `aria-pressed={!['audit', 'catalog', 'devices', 'weather', 'help', 'landing', 'interest', 'ai'].includes(view.kind)}`) |
| AdminApp väljalogimine `btn btn-secondary btn-sm` | `<Button size="sm" onClick={() => void logout()}>` |
| `RichTextEditor.tsx:41` `<button type="button" className="admin-rte-tool" title aria-label onMouseDown onClick>` | `<Button variant="ghost" size="icon-sm" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={run(fn)}>` |
| `HelpView` `admin-help-item` valikurida (kui `<button>`) | `<Card asChild interactive selected={…}><button type="button">…</button></Card>`; kui see on juba `Card`, jäta ja kirjuta raportisse |

Muud atribuudid (`onClick`, `disabled`, `title`, `form`) jäävad. Kontroll: `grep -rn --include='*.tsx' -E -e '(^|["'"'"' {`])btn(-[a-z]+)?(["'"'"' }`]|$)' src/admin` → tühi; `grep -rn --include='*.tsx' -e '<button' src/admin` → tühi (v.a `asChild` lapsed `Card`/`Button` sees).

- [ ] **Step 3: Tabelid**

| Fail:rida (HEAD) | Vana | Uus |
|---|---|---|
| `AuditView:79`, `CatalogView:293,357,501`, `DevicesView:53,89`, `InterestView:59`, `LandingStatsView:105,118,125,134`, `TenantDetail:189`, `TenantsView:39`, `WeatherAdminView:55` | `<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>…` | `<Table><TableHeader><TableRow><TableHead>…` (ümbris-div kustub; `Table` kerib ise) |
| `<tbody>`, `<tr>`, `<td>` | | `TableBody`, `TableRow`, `TableCell` |
| `<td className="num">`, `<th className="num">` | | `TableCell numeric`, `TableHead numeric` |
| tühi rida `<tr><td colSpan={n}>…</td></tr>` | | `<TableEmpty colSpan={n}>…</TableEmpty>` |
| `TenantsView:54` `<tr key={t.id} className="clickable" onClick={() => onOpen(t.id)}>` | | `<TableRow key={t.id} onClick={() => onOpen(t.id)}>` (klaviatuur Task 5-st) |
| `CatalogView:367` `<td><span className="admin-swatch" style={{ background: c.color }} …/></td>` | | `<TableCell><span className="admin-swatch" style={{ background: c.color }} … /></TableCell>` (andmevärv jääb) |

Kontroll: `grep -rn --include='*.tsx' -E -e '<(table|thead|tbody|tr|th|td)[ >]' -e 'admin-table' src/admin` → tühi.

- [ ] **Step 4: Väljad**

| Vana | Uus |
|---|---|
| `<input className="form-input" type="text\|email\|password\|number" value onChange={(e) => set(e.target.value)} …>` | `<Input type=… value={…} onChange={(e) => set(e.target.value)} …>` |
| `<input type="color" className="form-input" …>` (CatalogView värv) | proovi `<Input type="color" …>` ja vaata pildilt; kui ui `Input` ei sobi värvivalijaks, jäta `<input type="color" …>` ilma `form-input` klassita ja lisa `uiAudit.ts` `LEGACY_FORM_FIELD` lubatud tüüpidesse `color` (`(?!\s+type="(?:file|range|color)")`) koos testiga `expect(auditTsx('<input type="color" />').legacyFormFields).toEqual([])` |
| `<textarea className="form-input" …>` | `<Textarea …>` |
| `CatalogView:124` `<select id="cc-group" className="form-input" value={d.group} onChange={(e) => set('group', e.target.value as CropGroup)}>{(Object.keys(CROP_GROUP_LABELS) as CropGroup[]).map((g) => <option key={g} value={g}>{CROP_GROUP_LABELS[g]}</option>)}</select>` | `<Select id="cc-group" value={d.group} onValueChange={(v) => set('group', v as CropGroup)} options={(Object.keys(CROP_GROUP_LABELS) as CropGroup[]).map((g) => ({ value: g, label: CROP_GROUP_LABELS[g] }))} />` |
| `CatalogView:442` `<select id="wt-phase" …>` | `<Select id="wt-phase" value={d.phase} onValueChange={(v) => set('phase', v as WorkPhase)} options={(Object.keys(PHASE_LABELS) as WorkPhase[]).map((p) => ({ value: p, label: PHASE_LABELS[p] }))} />` |
| muud `<select>` (kokku 4) | sama muster; tühi valik `{ value: '', label: '— vali —' }` |
| `.admin-filter-row .form-input` reegel | kui filtrireal on `Input`, mis peab olema kitsas: `className="admin-filter-input"` + `admin.css` `.admin-filter-input { width: auto; }` |

Kontroll: `grep -rn --include='*.tsx' -E -e '<(input|select|textarea)\b' -e 'form-input' src/admin | grep -v 'type="file"'` → tühi (või ainult `type="color"`, kui jäi erandiks).

- [ ] **Step 5: CSS**

`src/admin/admin.css` — kinnita iga klassi kasutuseta (`grep -rnw --include='*.tsx' --include='*.ts' -e <klass> src`) ja kustuta: `.form-input` kõik reeglid (sh `select.form-input`, `.form-input:read-only`, `[data-slot="filter-clear"] > select.form-input` jt, HEAD 16–78), `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.btn:disabled`, `.btn-danger` (79–145), `.admin-nav .btn.active` (152), `.admin-table-wrap`, `.admin-table*` (165–170, 265–266), `.admin-rte-tool`, `.admin-rte-tool:hover`, `.admin-filter-row .form-input, …` selektori `form-input` osa. Seejärel `npx tsx scripts/css-scale.mts src/admin/admin.css` ja lahenda „Käsitsi“ loetelu Task 8 põhimõttel; `.admin-brand-word { padding-right: 0.12em }` → `4px`.

`src/index.css` + vaated — vanade nimedega paigutusklassid:

| Vana | Uus | Kus |
|---|---|---|
| `.btn-full` | `.full-width` | `index.css:248`; `LayerControl.tsx:457`, `LoginPage.tsx:76`, `SetPasswordPage.tsx:62,84`, `MapYearSelector.tsx:178` |
| `.btn-alert-action` | `.alert-action` | `index.css:3573`; `FieldManagerModal.tsx:431` |
| `.btn-pick-map-highlight` (+ `:hover`) | `.pick-map-highlight` | `index.css:2473,2480`; `PoiManagerModal.tsx:261` |
| kommentaar `Väärtused kopeeritud vanast .btn + .btn-secondary + .btn-sm kujundusest.` (~7737) | `Väärtused kopeeritud vana teisese väikese nupu kujundusest.` | `index.css` |

README „Nupud: vana → uus“ rida `btn-full` → „jääb `className="full-width"` (ainult laius 100%)“.

- [ ] **Step 6: README**

Uus jaotis „Admin“: „Teenusepakkuja admin (`src/admin`) kasutab samu ui komponente. `admin.css` on kihistamata ja võidab utiliite — sinna ainult admini paigutus (päis, nav, vormi read), mitte nupu/tabeli/välja välimus. ui-audit mõõdab admini koos rakendusega; landing on eraldi read.“

- [ ] **Step 7: Kontrollid**

`npx vitest run src/tooling src/components/ui src/types/soilSample.test.ts src/lib` → PASS; `tsc`; `npm run build` → EXIT 0; `npx oxlint src/admin` + muudetud failid.

Oodatav ui-audit (admin sees): „Vanu komponendiklasse (CSS)“ **0**; „Vanu nupuklasse (tsx)“ **0**; „Vanu tabeleid (tsx)“ **0**; „Vanu vormivälju (tsx)“ **0**; „Vanu kaarte“ 0; „Kasutuseta klasse (CSS)“ 0; „Defineerimata CSS-muutujaid“ 0; „Erinevaid kirjasuurusi (CSS)“ ≤ 6; „Erinevaid nurgaraadiusi (CSS)“ ≤ 4; „Skaalaväliseid …“ 0. Landing read — kirjuta arvud (muutmata). `wc -l src/index.css` lõpparv raportisse (oodatav **6 950–7 050**; kasutaja eesmärk ~6 800 — kui jääd üle 6 900, loetle raportis 3 suurimat järelejäänud vaateplokki, mida järgmine etapp võiks vähendada).

- [ ] **Step 8: Commit + release**

```bash
git add src/admin/*.tsx src/admin/admin.css src/index.css src/components/LayerControl.tsx src/components/LoginPage.tsx src/components/SetPasswordPage.tsx src/components/MapYearSelector.tsx src/components/PoiManagerModal.tsx src/components/FieldManagerModal.tsx scripts/ui-audit.mts src/components/ui/README.md
git commit -m "refactor(admin): teenusepakkuja admin ui komponentidele; vanad btn/form-input/admin-table klassid välja; audit hõlmab admini ja landing'u" -m "Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

(Lisa `src/tooling/uiAudit.ts` ja `src/tooling/uiAudit.test.ts`, kui muutsid `type="color"` erandi tõttu.)

- [ ] **Step 9: Ekraanipildid**

Admin (`--platform '*'`, `--height 1600`):
1. `/` — ettevõtete tabel, nav (valitud „Ettevõtted“ roheline), väljalogimine.
2. `--do 'click:text=Algkataloog' --do 'wait:1500' /` — kolm tabelit, nupud.
3. `--do 'click:text=Algkataloog' --do 'wait:1500' --do 'click:[data-slot="table"] tbody tr >> nth=0' --do 'wait:800' /` — kultuuri vorm (Select, värvivalija, Textarea). Kui rida ei ava vormi, leia muutmisnupp `grep -n "Muuda" src/admin/CatalogView.tsx`.
4. `--do 'click:text=Juhendid' --do 'wait:1500' /` — RichTextEditor tööriistad 28px.
5. `--do 'click:text=Landing' --do 'wait:1500' /`, `--do 'click:text=Seadmed' --do 'wait:1500' /`, `--do 'click:text=Ilm' --do 'wait:1500' /`, `--do 'click:text=Logi' --do 'wait:1500' /`, `--do 'click:text=Huvilised' --do 'wait:1500' /`, `--do 'click:text=AI ühendus' --do 'wait:1500' /`.
6. Ettevõtte detail klaviatuurilt: `--do 'eval:document.querySelector("[data-slot=table] tbody tr")?.focus()' --do 'key:Enter' --do 'wait:1500' /`.
7. Admini sisselogimine: `--platform '*' --anon /`.

Rakendus (ümbernimetatud klassid): `--anon /` (sisselogimise nupp täislaiuses), `/` (aasta vidina täislaiuses nupp, `MapYearSelector`).

---

## Self-review

**1. Spec'i ja otsuste katvus**

| Nõue | Ülesanne |
|---|---|
| Otsus 1 — ikoonnupud 20/28/40, ühtne stiil | 4 (`icon-xs`/`icon-sm`/`icon-lg`, `icon` kustub, test „täpselt kolm“) |
| Otsus 2 — ~1000 rida, Tailwindi skaneerimist ei laiendata, ~2000 hilisemaks | 2 (surnud CSS ~520 + spec/README märge), 4 (~200), 5 (~45), 6 (±); lõpparv Task 9 Step 7 |
| Otsus 3 — tumedam roheline, valge tekst 4.5:1, kollane tume tekst tumedas, `text-subtle`, muud paarid, test | 3 (`contrast.ts` + test kõigist paaridest mõlemas teemas, `--emerald-600` valvur, faasi- ja mullatekst) |
| Otsus 4 — dialoogipäis roheliseks ühes kohas, ülejäänud `text-*` kustu, 7 muutujat, `link-button` | 1 (`dialogHeaderIconClass`, perl-asendus, muutujate tabel + auditi valvur, `variant="link"`) |
| Otsus 5 — admin viimasena, audit admin/landing, `.btn` kustub | 9 |
| Otsus 6 — 11px miinimum, ≤6 / ≤4 / skaala, mini-nupud ja `soil-footnote` pildilt | 8 (`cssScale` + auditi read), 5 (`soil-footnote` 11px), pildid Task 8 Step 8 |
| Otsus 7 — `TableRow`/`Card` klaviatuur pseudo-tabelitega; toored divid | 5 |
| Otsus 8 — FilterBar, EmptyState, staatilised klassideks; andmevärvid ühte faili | 6, 7 |
| Spec „Kontroll“: vanad nupu/dialoogi/tabeli klassid kustutatud; värvikoodid komponentides ainult andmevärvid | 9 (vanad klassid 0), 7 (värvikoodid ≤ 25, ainult Leaflet/legend/dekoratiivne) |
| Spec etapp 3: `style={{…}}` ja värvikoodid → skaala/nimed; kirjasuurused 6 peale | 6, 7, 8 |

Teadlikud välistused: inventuuri 1D (valitavad kaardid/kiibid), `fw-add` (tahvli tühi lahter) ja `login-forgot-link` (plaani koostaja otsused); `PriaLinesEditor`/`edit-cad-grid` on muudetavad vormiread, mitte pseudo-tabelid; Leaflet hüpikud ja MapView kihistiilid on spec'i järgi ulatusest väljas. Ridade eesmärk ~6 800: plaani hinnang on 6 950–7 050 (inventuuri 8B loetelu oli ~200 rea võrra ülehinnatud); Task 9 Step 7 nõuab lõpparvu ja järgmise etapi kandidaate raportis.

**2. Kohatäidete kontroll:** plaanis pole „TBD“, „sarnane ülesandele N“ ega koodita koodisamme; massmuudatustel on fail→vana→uus tabel ja kontroll-grep. Kohtades, kus otsus sõltub pildist või grep'ist (värvivalija `Input type="color"`, ellipsi `50%`, admini `admin-help-item`, dialoogi avamise selektor), on antud mõlemad variandid ja raporti nõue.

**3. Tüüpide ja nimede kooskõla:** `buttonVariantSizes` (4) ↔ test (4); `variant="link"`/`size="inline"` (1) ↔ kasutus (1, 4) ↔ `buttonVariantSizes.inline` (4); `text-success-text` jt (3) ↔ pressed-olek (4); `--tone-danger-text` (3) ↔ `.danger-icon` (6); `SoilLevel`, `SOIL_LEVEL_COLOR`, `getSoilMetricLevel` (3) ↔ Table (5) ↔ `dataColors.ts` re-eksport (7); `clickOnActivationKey` (5) ↔ admin `TableRow` (9); `undefinedCssVars` (1), `unusedCssClasses` (2), `offScaleCss` (8) ↔ `scripts/ui-audit.mts`; `rescaleCss` (8) ↔ admin.css (9); `FilterBar`/`FilterBarItem`/`EmptyState` (6) eksport `index.ts`-is.
