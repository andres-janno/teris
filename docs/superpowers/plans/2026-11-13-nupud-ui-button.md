# Etapp 2.1 — nupud ui/Button peale (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik üldised nupuklassid (`btn*`, `icon-btn*`) rakenduses asendatakse ühise `ui/Button` komponendiga; vanad nupureeglid kaovad põhirakenduse CSS-ist.

**Architecture:** `Button` (shadcn/cva) saab kaks kasutajaga kokkulepitud lisa: variandi `danger-ghost` ja suuruse `icon-xs`; ikoonnuppudel nurk 6px. Vaated kasutavad ainult `Button` prop'e (`variant`, `size`) ja vajadusel vana *paigutus*-klassi (`btn-full`, vaatepõhine modifikaator) — **vaate faile ei lisata Tailwindi `@source`-i**, seega vaadetes Tailwindi klasse ei kasutata. Mõõdik `ui-audit` loeb vanad nupuklassid failide kaupa; iga ülesanne viib oma failid nulli. Lõpus viiakse vanad `.btn*` reeglid `admin.css`-i (admin kasutab neid edasi, tal pole Tailwindi).

**Tech Stack:** React 19, TypeScript, Tailwind v4, class-variance-authority, Radix (Slot), Vitest (node env, DOM-teste pole).

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md (3. osa, samm 2.1 „nupud“). Komponentide reeglid: src/components/ui/README.md.

## Global Constraints

- Keskkond: kohalik kaust on sshfs-mount. Faile muuda mount'i kaudu; **git, npm, npx ainult serveris**: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`.
- Töö käib otse `master`-is. Iga ülesanne = commit(id) + release: `npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` (EXIT=134 → korda `NODE_OPTIONS=--max-old-space-size=1500 npm run release …`), siis `systemctl is-active teris` → `active`.
- Kontrollid enne commit'i: `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run src/tooling src/components/ui`; `npx oxlint <muudetud failid>`.
- Identifikaatorid (klassid, variandid, prop'id) inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- Ainult skaala väärtused; suvalisi Tailwindi väärtusi (`h-[34px]`) ei kasutata. Vaate failides (väljaspool `src/components/ui/`) **Tailwindi klasse ei kasutata üldse** (neid ei skaneerita — klass jääks vaikselt mõjuta).
- Kasutajaga kokku lepitud (2026-11-13): `icon-btn-danger` → uus variant `danger-ghost`; ~20px ikoonnupp → uus suurus `icon-xs`; `btn-xs` → `size="sm"` (uut `xs` suurust ei tule); sisselogimise lehe põhinupu oma roheline gradient jääb erandiks.
- Ulatusest väljas: `src/admin/`, `src/landing/` (eraldi lehed ilma Tailwindita); `DateInput`, `FilterClear` (etapp 2.5 vormiväljad), `HelpHint` (2.6); kaardi-/vidinapõhised erinupud `basemap-btn`, `year-widget-btn`, `year-shape-btn`, `v-action-btn`, `mini-swap-btn`, `cc-link-btn`, `cc-icon-btn`, `area-preset-btn`, `fw-field-shape-btn`, `has-corner-btn`, `date-*-btn`, `filter-clear-btn` (omad lülitid, mitte üldnupud). Neid ei puutu.

## Teisendustabel (kõik vaate-ülesanded T2–T6)

| Vana | Uus |
|---|---|
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
| `` `btn btn-secondary ${c ? 'active' : ''}` `` | `<Button>` — `active` klass jäetakse ära: üldnupul pole `.active` reeglit (kontrollitud: `grep -n "\.btn[a-z-]*\.active" src/index.css` tühi) |
| `btn-full` | jääb `className="btn-full"` (ainult `width:100%`; Button laiust ei sea, seega vana reegel kehtib) |

Reeglid igal teisendusel:

1. **`type`:** `Button` paneb vaikimisi `type="button"`. HTML-i `<button>` ilma `type`-ta on vormis **submit**. Kui vana `<button>` oli ilma `type`-ta ja asub `<form>`-i sees (kontrolli JSX-puu üles), kirjuta `type="submit"`. Kui vanal oli `type`, jäta see.
2. Kõik muud atribuudid (`onClick`, `disabled`, `title`, `aria-*`, `ref`, `style`, `key`, `form`) jäävad muutmata.
3. **Vaatepõhine modifikaator** (nt `fw-crop-delete-btn`, `finance-confirm-btn`, `add-cad-btn`, `fw-panel-clear-btn`, `support-banner-end`, `fw-add-entry`, `satellite-play-btn`, `fmc-close`, `save`, `btn-pick-map-highlight`, `btn-alert-action`): jäta klass alles (`className="fw-crop-delete-btn"`). Ava selle reegel `src/index.css`-is. Tailwindi utiliidid on hilisemas kihis ja võidavad vana reegli **mitte-`!important`** omadused, mida ka Button seab (padding, height, font-size, font-weight, color, background, border, border-radius, box-shadow, display, gap, align/justify, transform). Need kaovad — see on ühtlustamise eesmärk. Paigutusomadused (margin, width, flex, position, order) jäävad kehtima. Kui kaduv omadus kandis **tähendust** (oleku- või hoiatusvärv, esiletõst), mitte lihtsalt teist suurust: lisa reeglile `!important` (vana `!important` võidab utiliidi). Kirjuta raportisse iga modifikaatori kohta: mis kadus, mis jäi, kas lisasid `!important`.
4. Lisa faili algusesse `import { Button } from './ui';` (failist `src/AuthGate.tsx`: `'./components/ui'`). Ära impordi teisi `ui/` komponente selles etapis.
5. Kontekstireeglid (`.vanem .btn {…}`) — vt T7 nimekiri. Vaate ülesandes ära muuda `index.css`-i, v.a kui T7 nimekiri ütleb, et konkreetne reegel tuleb selle faili teisendamisel kohe ümber suunata (märgitud ülesande juures).

---

### Task 1: Button lisad, mõõdik vanadele nupuklassidele, näidised

**Files:**
- Modify: `src/components/ui/variants.ts` (buttonVariants)
- Modify: `src/components/ui/variants.test.ts`
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts`
- Modify: `src/components/ui/UiGallery.tsx` (nuppude rida)
- Modify: `src/components/ui/README.md` (teisendustabel)

**Interfaces:**
- Produces: `buttonVariants` variant `'danger-ghost'`, size `'icon-xs'`; `auditTsx(src).legacyButtons: string[]`; `AuditReport.legacyButtonFiles: { path: string; count: number }[]`; CLI rida „Vanu nupuklasse (tsx)“.

- [ ] **Step 1: Kirjuta failivad testid** — `src/components/ui/variants.test.ts`:

Muuda `allClassStrings` esimene plokk:

```ts
  ...(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost'] as const).flatMap((variant) =>
    (['sm', 'md', 'icon-xs', 'icon-sm', 'icon'] as const).map((size) => v.buttonVariants({ variant, size }))
  ),
```

Muuda testis „nupu äärevärv on täpselt üks variandis“ mõlemad massiivid sama moodi (`'danger-ghost'` variantidesse, `'icon-xs'` suurustesse) ning viimane tsükkel `['primary', 'ghost', 'danger', 'danger-ghost']`. Lisa testid faili `import { cn } from './cn';` ja:

```ts
  it('läbipaistev ohunupp: punane ikoon, hõljudes kerge punane taust', () => {
    const c = v.buttonVariants({ variant: 'danger-ghost', size: 'icon-sm' });
    expect(c).toContain('text-destructive');
    expect(c).toContain('bg-transparent');
    expect(c).toContain('hover:bg-destructive/15');
  });
  it('ikoonnupud on 6px nurgaga (nagu vanad icon-btn), tekstinupud 10px', () => {
    for (const size of ['icon-xs', 'icon-sm', 'icon'] as const) {
      const c = cn(v.buttonVariants({ size }));
      expect(c, size).toContain('rounded-sm');
      expect(c, size).not.toContain('rounded-md');
    }
    expect(cn(v.buttonVariants({ size: 'sm' }))).toContain('rounded-md');
    expect(v.buttonVariants({ size: 'icon-xs' })).toContain('size-5');
  });
```

`src/tooling/uiAudit.test.ts` lõppu:

```ts
describe('auditTsx: vanad nupuklassid', () => {
  it('loeb üldised nupuklassid klassistringides', () => {
    const src = `<button className="btn btn-primary btn-sm">a</button>
<button className={\`btn btn-sm \${x ? 'btn-primary' : 'btn-secondary'}\`}>b</button>
<button className="icon-btn-ghost">c</button><button className="icon-btn-danger" /><button className="icon-btn" />
<button className="icon-btn-ghost-sm" /><button className="btn btn-secondary btn-xs btn-icon-only" />`;
    expect(auditTsx(src).legacyButtons).toEqual([
      'btn', 'btn-primary', 'btn-sm', 'btn', 'btn-sm', 'btn-primary', 'btn-secondary',
      'icon-btn-ghost', 'icon-btn-danger', 'icon-btn', 'icon-btn-ghost-sm',
      'btn', 'btn-secondary', 'btn-xs', 'btn-icon-only',
    ]);
  });
  it('ei loe erinuppe, btn-full ega modifikaatoreid', () => {
    const src = `<button className="basemap-btn active" /><button className="btn-full fw-crop-delete-btn" />
<button className="year-widget-btn locked-btn" /><span className="has-corner-btn" />`;
    expect(auditTsx(src).legacyButtons).toEqual([]);
  });
  it('summarize annab failid, kus vanu nupuklasse on', () => {
    const r = summarize([
      { path: 'a.tsx', content: '<button className="btn btn-ghost" />' },
      { path: 'b.tsx', content: '<Button variant="ghost" />' },
    ]);
    expect(r.legacyButtonFiles).toEqual([{ path: 'a.tsx', count: 2 }]);
  });
});
```

- [ ] **Step 2: Käivita, peab kukkuma**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/tooling src/components/ui'`
Expected: FAIL — `danger-ghost`/`icon-xs` puudu, `legacyButtons` undefined.

- [ ] **Step 3: Implementeeri** — `src/components/ui/variants.ts`, buttonVariants:

```ts
      variant: {
        primary: …muutmata…,
        secondary: …muutmata…,
        ghost: …muutmata…,
        danger: …muutmata…,
        // Läbipaistev ohunupp (vana .icon-btn-danger): punane ikoon, hõljudes kerge punane taust.
        'danger-ghost': 'border-transparent bg-transparent text-destructive hover:bg-destructive/15',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-8 px-4 text-sm',
        // Ikoonnupud: 6px nurk nagu vanadel .icon-btn-* (tekstinupud 10px).
        'icon-xs': 'size-5 rounded-sm',
        'icon-sm': 'size-7 rounded-sm',
        icon: 'size-8 rounded-sm',
      },
```

`src/tooling/uiAudit.ts`: lisa konstant ja väli.

```ts
// Üldised vanad nupuklassid (etapp 2.1). Erinupud (basemap-btn jne) ja paigutusklass btn-full ei loe.
const LEGACY_BUTTON =
  /(?<![\w-])(btn|btn-primary|btn-secondary|btn-ghost|btn-danger|btn-sm|btn-xs|btn-icon-only|icon-btn|icon-btn-ghost|icon-btn-danger|icon-btn-ghost-sm)(?![\w-])/g;
```

`auditTsx` tagastusse: `legacyButtons: [...src.matchAll(LEGACY_BUTTON)].map((m) => m[1]),`
`AuditReport`-i: `legacyButtonFiles: { path: string; count: number }[];`
`summarize` tagastusse: `legacyButtonFiles: tsx.filter((t) => t.legacyButtons.length > 0).map((t) => ({ path: t.path, count: t.legacyButtons.length })),`

Märkus: regex otsib kogu faili tekstist, mitte ainult `className`-ist — `btn` sõna mujal (kommentaar, muutujanimi `btn`) loeb ka. Kui Step 6 baasis on selliseid valepositiivseid, kirjuta need raportisse (ei paranda — ülesanded T2–T6 lõpetavad, kui failis on ainult valepositiivsed ja need on raportis põhjendatud).

`scripts/ui-audit.mts` lõppu:

```ts
row(
  'Vanu nupuklasse (tsx)',
  r.legacyButtonFiles.reduce((s, f) => s + f.count, 0),
  r.legacyButtonFiles.map((f) => `${f.path}: ${f.count}`)
);
```

- [ ] **Step 4: Testid läbi**

Run: `npx vitest run src/tooling src/components/ui` → PASS.

- [ ] **Step 5: Näidised ja README**

`UiGallery.tsx` nuppude reale (pärast rida `<Button variant="ghost" size="icon-sm" aria-label="Kustuta">…`) lisa:

```tsx
          <Button variant="danger-ghost" size="icon-sm" aria-label="Kustuta"><Trash2 size={14} /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Muuda"><Pencil size={12} /></Button>
```

README.md-sse uus jaotis „Nupud: vana → uus“ — kopeeri selle plaani **Teisendustabel** ja reeglid 1–3 (eesti keeles, lühendatult).

- [ ] **Step 6: Baasmõõdik, kontrollid, commit, release**

Run: `npm run ui-audit -- --details` — kirjuta raportisse rida „Vanu nupuklasse (tsx)“ koos faililoendiga (oodatud ~540 kokku, ~50 faili).
tsc, vitest, oxlint (Global Constraints). Commit: `feat(ui): Button danger-ghost ja icon-xs, ikoonnupu nurk 6px; ui-audit loeb vanu nupuklasse`. Release.

---

### Task 2: Sõidukid ja sõidud

**Files (Modify):** `src/components/VehicleTracker.tsx`, `src/components/DeviceAssignmentRegister.tsx`, `src/components/TripRegister.tsx`, `src/components/TripDialog.tsx`, `src/components/TripGapReviewDialog.tsx`, `src/components/PoiManagerModal.tsx`

**Interfaces:** Consumes `Button` (`./ui`), variandid/suurused T1-st.

- [ ] **Step 1:** Iga faili iga üldnupp teisendustabeli ja reeglite 1–4 järgi. Näide (VehicleTracker filtrinupud):

```tsx
// enne
<button className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('active')}>Aktiivsed</button>
// pärast
<Button variant={statusFilter === 'active' ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter('active')}>Aktiivsed</Button>
```

- [ ] **Step 2: Kontekstireeglid selles grupis** (`src/index.css`):
  - `.fullpage-board-body .poi-top-actions .btn`, `.fleet-board-body .fleet-top-bar .btn` (`height: 34px`) — jäetakse (Button 32px võidab); kustutatakse T7-s.
  - `.trip-dialog-fields .btn-sm { padding: 0 6px; }` — jäetakse; kustutatakse T7-s.
- [ ] **Step 3: Kontroll** — `npm run ui-audit -- --details`: ükski selle ülesande fail ei ole „Vanu nupuklasse“ loendis (või ainult raportis põhjendatud valepositiivid). tsc, vitest, oxlint muudetud failidel.
- [ ] **Step 4:** Commit `refactor(ui): sõidukite ja sõitude nupud ui/Button peale`. Release.

---

### Task 3: Põllutööd ja saak

**Files (Modify):** `src/components/FieldWorksBoard.tsx`, `src/components/FieldWorkEntryDialog.tsx`, `src/components/AddFieldWorkDialog.tsx`, `src/components/FieldWorkPlanForm.tsx`, `src/components/WorkRegisterModal.tsx`, `src/components/PriaLinesEditor.tsx`, `src/components/HarvestLotDialog.tsx`, `src/components/HarvestLotsPanel.tsx`

- [ ] **Step 1:** Teisenda (teisendustabel, reeglid 1–4). `WorkRegisterModal` sulgemisnupp `className="icon-btn"` → `<Button variant="ghost" size="icon-sm" onClick={onClose} title="Sulge">`.
- [ ] **Step 2: Kontekstireegel kohe ümber:** `.fw-panel-foot .btn { flex: 1; justify-content: center; }` → muuda selektoriks `.fw-panel-foot > button` (kontrolli FieldWorksBoard-ist, et nupud on `.fw-panel-foot` otsesed lapsed; kui mitte, kasuta `.fw-panel-foot button`). `flex: 1` Button ei sea, seega kehtib.
- [ ] **Step 3:** Kontroll nagu T2 Step 3.
- [ ] **Step 4:** Commit `refactor(ui): põllutööde ja saagi nupud ui/Button peale`. Release.

---

### Task 4: Põllud, hooajad, kaart

**Files (Modify):** `src/components/CropRegisterModal.tsx`, `src/components/SeasonManagerModal.tsx`, `src/components/FieldsTableView.tsx`, `src/components/FieldManagerModal.tsx`, `src/components/FieldEditDialog.tsx`, `src/components/FieldMapCard.tsx`, `src/components/FieldUploadModal.tsx`, `src/components/FieldBookUploadModal.tsx`, `src/components/SoilSampleUploadModal.tsx`, `src/components/FieldShapeModal.tsx`, `src/components/MapView.tsx`, `src/components/MapYearSelector.tsx`, `src/components/LayerControl.tsx`, `src/components/SatellitePanel.tsx`

- [ ] **Step 1:** Teisenda ainult üldnupud. Neis failides on ka ulatusest väljas erinuppe (`basemap-btn`, `year-widget-btn`, `year-shape-btn`, `fw-field-shape-btn`, `has-corner-btn`, `cc-*`, `area-preset-btn`) — neid ära puutu. `MapYearSelector` `icon-btn-ghost-sm` → `<Button variant="ghost" size="icon-xs">`. `SeasonManagerModal` sulgemisnupp `icon-btn` → ghost `icon-sm`.
- [ ] **Step 2: Kontekstireeglid kohe ümber** (`src/index.css`):
  - Hooaegade tabeli valitud rida (read ~5459–5472): `.seasons-table tr.current .icon-btn-ghost, .seasons-table tr.current .icon-btn-danger { color: #ffffff; }` ja `:hover { background: rgba(255,255,255,0.2); }` — valge ikoon rohelisel real on loetavuse jaoks vajalik. Asenda need kaks selektorit selektoriga `.seasons-table tr.current td > button` ja lisa mõlemale omadusele `!important` (muidu võidab Buttoni `text-muted-foreground`/`text-destructive`). Kontrolli SeasonManagerModal-ist, et `tr.current` lahtrite otsesed `button`-lapsed on ainult need ikoonnupud; kui seal on muid nuppe, lisa ikoonnuppudele modifikaator `season-row-action` ja kasuta selektorit `.seasons-table tr.current .season-row-action`.
  - `.crop-group-block-header .icon-btn-ghost { padding: 4px; }` — jäetakse, kustutatakse T7-s. `.crop-group-block-header h4 + .icon-btn-ghost { margin-left: auto; }` → selektor `.crop-group-block-header h4 + button` (margin jääb kehtima).
  - `.fmc-actions .btn { flex: 1; justify-content: center; }` → `.fmc-actions > button`.
  - `.satellite-date-row .icon-btn-ghost:disabled { opacity: .35 }` — jäetakse (Button `disabled:opacity-50`), kustutatakse T7-s.
  - `.fullpage-board-body .register-actions-bar .btn { height: 34px }` — jäetakse, kustutatakse T7-s.
- [ ] **Step 3:** Kontroll nagu T2 Step 3.
- [ ] **Step 4:** Commit `refactor(ui): põldude, hooaegade ja kaardi nupud ui/Button peale`. Release.

---

### Task 5: Laod, artiklid, rahandus

**Files (Modify):** `src/components/ArticlesView.tsx`, `src/components/ArticleCategoriesDialog.tsx`, `src/components/ArticleMergeDialog.tsx`, `src/components/ArticleFormDialog.tsx`, `src/components/ArticleStockCard.tsx`, `src/components/InventoryDialog.tsx`, `src/components/StockDocumentsPanel.tsx`, `src/components/StockDocumentDialog.tsx`, `src/components/WarehousesPanel.tsx`, `src/components/FinanceModal.tsx`, `src/components/RelatedPartiesModal.tsx`

- [ ] **Step 1:** Teisenda. `FinanceModal` sulgemisnupp `icon-btn` → ghost `icon-sm`. `finance-confirm-btn` modifikaator: reegel 3 (raporti märge).
- [ ] **Step 2:** Kontroll nagu T2 Step 3.
- [ ] **Step 3:** Commit `refactor(ui): ladude, artiklite ja rahanduse nupud ui/Button peale`. Release.

---

### Task 6: Konto, seaded, sisselogimine, kinnitusdialoog

**Files (Modify):** `src/components/UsersAdminModal.tsx`, `src/components/AiConnectionModal.tsx`, `src/components/WeatherCredentialModal.tsx`, `src/components/ChangePasswordModal.tsx`, `src/components/SupportAccessPanel.tsx`, `src/components/SetPasswordPage.tsx`, `src/components/LoginPage.tsx`, `src/components/UserMenu.tsx`, `src/components/LicenseBanner.tsx`, `src/AuthGate.tsx`, `src/components/ConfirmDialog.tsx`, `src/index.css`

- [ ] **Step 1:** Teisenda. Sisselogimise vormide submit-nupud: reegel 1 (`type="submit"`).
- [ ] **Step 2: Sisselogimise erand** (kasutaja otsus): `LoginPage.tsx` põhinupule lisa `className="login-primary-btn"` (koos `variant="primary"`). `src/index.css` read ~6573–6581 asenda:

```css
/* Sisselogimise lehe põhinupp: lehe oma roheline (erand ühtsest nupust, kasutaja otsus 2026-11-13).
   !important, sest muidu võidab ui/Buttoni gradient (Tailwindi utiliidid on hilisemas kihis). */
.login-page .login-card .login-primary-btn {
  background: linear-gradient(135deg, #3f8a22, #5aa832) !important;
  box-shadow: 0 6px 18px rgba(76, 154, 42, 0.35) !important;
}

.login-page .login-card .login-primary-btn:hover {
  background: linear-gradient(135deg, #357a1c, #4c9a2a) !important;
}
```

Kui `SetPasswordPage.tsx` on sama `.login-page .login-card` kujundusega, lisa samale põhinupule sama klass.
- [ ] **Step 3:** Kontroll nagu T2 Step 3. Lisaks: `npm run ui-audit -- --details` rida „Vanu nupuklasse (tsx)“ on 0 (või ainult raportis põhjendatud valepositiivid).
- [ ] **Step 4:** Commit `refactor(ui): konto, seadete ja sisselogimise nupud ui/Button peale`. Release.

---

### Task 7: Koristus — vanad nupureeglid põhirakenduse CSS-ist välja

**Files:** Modify `src/index.css`, `src/admin/admin.css`

- [ ] **Step 1: Mis admin kasutab.** Run: `grep -rhoE "(btn|icon-btn)[a-z-]*" src/admin --include=*.tsx | sort | uniq -c`. Kirjuta raportisse.
- [ ] **Step 2: Vii adminile vajalikud reeglid `admin.css`-i.** `src/index.css`-ist lõika välja reeglid `.btn`, `.btn-primary(:hover)`, `.btn-secondary(:hover)`, `.btn-ghost(:hover)`, `.btn-sm`, `.btn-xs`, `.btn:disabled…`, `.btn-danger(:hover…)`, `.icon-btn-ghost(:hover)`, `.icon-btn-danger(:hover)`, `.icon-btn-ghost-sm(:hover)`, `.icon-btn-ghost-xs(:hover)`, `.btn-icon-only`, `.btn-disabled`. Neist need, mida Step 1 näitas adminis kasutatavat, kleebi `src/admin/admin.css` algusesse kommentaariga `/* Vanad nupuklassid — põhirakendus kasutab ui/Button (etapp 2.1), admin veel neid. */`. Ülejäänud kustuta.
  - **Jäta alles** `index.css`-i: `.btn-full`, `.btn-pick-map-highlight`, `.btn-alert-action` ja vaatepõhised modifikaatorid (kasutuses vaadete className-is).
  - Enne iga kustutamist: `grep -rn "<klass>" src --include=*.tsx --include=*.ts | grep -v src/admin` peab olema tühi (v.a `uiAudit` test/regex ja `ui/README.md`).
- [ ] **Step 3: Kontekstireeglid kustutada** (ei mõju enam): `.satellite-date-row .icon-btn-ghost:disabled`, `.crop-group-block-header .icon-btn-ghost { padding }`, `.fullpage-board-body .register-actions-bar .btn, .fullpage-board-body .poi-top-actions .btn, .fleet-board-body .fleet-top-bar .btn { height }`, `.trip-dialog-fields .btn-sm`. Kontrolli `grep -nE "\.(btn|icon-btn)[a-z-]*" src/index.css` — alles võivad jääda ainult Step 2 „jäta alles“ klassid ja `-btn` erinupud (`basemap-btn` jt).
- [ ] **Step 4: Ehitatud CSS-i kontroll.** Pärast `npm run build` (release teeb): `grep -c "\.btn-primary{" dist/assets/main-*.css` → 0; `grep -c "\.btn-primary" dist/assets/admin-*.css` → ≥1 (kui admin seda kasutab).
- [ ] **Step 5:** `npm run ui-audit` — raportisse uus baas (eriti „Vanu komponendiklasse (CSS)“ ja „Vanu nupuklasse (tsx)“ = 0). tsc, vitest. Commit `refactor(ui): vanad nupureeglid välja index.css-ist (admin.css-i see, mida admin kasutab)`. Release.
- [ ] **Step 6: Kasutaja visuaalne kontroll** (koondatud lõppu): mõlemas teemas — sõidukite tabel ja filtrid, põllutööde paneel, hooaegade tabel (valitud rea ikoonid valged), laod/artiklid, sisselogimise leht (oma roheline nupp), `/ui` näidised (uus läbipaistev punane ikoonnupp ja 20px ikoonnupp).
