# Kaardid ja paneelid ui peale (etapp 2.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik kaardid, ujuvpaneelid, KPI-plaadid ja sektsioonikastid (rakendus + teenusepakkuja admin) saavad välimuse `src/components/ui/Card.tsx`-ist: tahke taust, kaks nurka (16/10), üks kaardi vari ja ujuvpaneeli tugevam vari, polster skaalal 12/16; `.glass-card` ja 26 surnud klassi kustutatakse.

**Architecture:** Esmalt `Card` saab variandid (`surface | floating | tile`), polstri (`none | sm | md`), oleku (`interactive`, `selected`), `asChild` (button/form/section) ning päise osad (`CardHeader`, `CardTitle`, `CardActions`); `Panel` ehitatakse nende peale; uus taustatoken `--bg-surface` teeb kaardid tahkeks; ui-audit saab rea „Vanu kaarte“. Seejärel viiakse vaated perekondade kaupa üle: välimus läheb `Card` prop'idesse, asetus (position, z-index, flex, gap, margin, kirjasuurus) jääb vaate klassi. Viimane ülesanne kustutab `.glass-card`-i ja surnud klassid ning viib auditi nulli.

**Tech Stack:** React 19 + TS, Tailwind v4 (skaneerib AINULT `src/components/ui`), Radix (`radix-ui` — `Slot`), class-variance-authority, tailwind-merge (`cn`), vitest, oxlint, Playwright (`scripts/shot.mts`).

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md · **Inventuur:** docs/superpowers/plans/2026-11-15-kaardid-inventuur.md (perekonnad A–E, read, riskid — loe oma ülesande osa; reanumbrid võivad olla nihkunud, otsi klassinime järgi)

## Global Constraints

- **Kasutaja otsused (2026-11-15), siduvad:**
  1. Taust on **tahke kõikjal** — ühelgi kaardil ega paneelil pole klaasi ega `backdrop-filter`-it, ka kaardi (Leaflet) peal ujuvatel paneelidel. (Kõrvalkasu: `backdrop-filter` ei loo enam `position:fixed` hüpikutele containing block'i.)
  2. Nurk: **kaks astet** — kaardid ja paneelid 16px (`rounded-lg`), sisemised plaadid/kastid nende sees 10px (`rounded-md`).
  3. Vari: **üks kaardi vari** kõigile kaartidele (`shadow-card`); kaardi peal ujuvad paneelid (sh `field-map-card`) **ühe astme võrra tugevam** (`shadow-dialog`); sisemised plaadid **varjuta**.
- **Kontrollija otsused:** `login-card` (rakenduse sisselogimine, kreemjas gradient fotol) jääb legacy erijuhtumiks oma välimusega; `admin-login` ja `admin-card` lähevad `Card`-ile. `--card-bg` puudub (finantsi plaadid tumedas valged) — parandus = plaadid `Card`-ile. Polster ainult 12 (`sm`) või 16 (`md`). Inventuuri 26 surnud klassi kustutatakse. Kaardiklass, mis kannab asetust (position, z-index, flex, gap, margin), jääb vaate CSS-i ainult asetusega; välimus (taust, ääris, nurk, vari, polster, backdrop) tuleb `Card`-ist.
- **Card API (Task 1, ära muuda teistes ülesannetes):** `Card` prop'id `variant` (`surface` vaikimisi | `floating` | `tile`), `padding` (`md` vaikimisi = 16px | `sm` = 12px | `none` = klassi ei anta, vaate CSS-i polster kehtib), `interactive` (kursor, hover, `text-left`, värv; vajalik ka `<button>`-il), `selected` (roheline ääris + rõngas), `asChild` (laps `<button>`/`<form>`/`<section>` saab kaardi välimuse). `Card` **ei sea teksti värvi** (pärib), v.a `interactive`. `CardHeader align="center|start"`, `CardTitle as="h2|h3|h4"`, `CardActions`.
- Välimuse jaotus perekonniti: register-/lehekaart = `surface`; kaardi peal ujuv paneel = `floating`; kaardi/dialoogi sees olev plaat, KPI, sektsioonikast, loendikirje dialoogis = `tile`.
- **Väljaspool ulatust (jäävad legacy, ei loeta auditis):** `login-card`; `fw-card` (tahvli tihe kiip olekuääristega); toonitud teatekastid `telemetry-suggestions-card`, `fleet-card-notes` (Alert-teema); tühja oleku kastid `fw-panel-empty`, `crop-group-empty`; `party-role-checkbox` (vormielement); `reg-stat-pill`, `register-crop-stat`, `cc-stat` (märk/valik, mitte kaart); `detail-section`, `section-title`, `admin-subpanel`, `admin-card-head`, `admin-card-foot` (ainult asetus); Leafleti hüpikud ja vihjed; `.app-header`.
- `transform` (`cultivation-panel`, `add-poi-banner`) jääb — praegu ühtegi portaalita `fixed` hüpikut seal pole (Select/Popover portaalivad). Ära muuda paigutust.
- **Preflight'i pole**: `<button>` kaardina vajab `interactive` (annab `text-left`, `[font:inherit]`, värvi); Radix `Trigger` alati `asChild`. Kirjatüüp pärineb base-kihist (`app.css`).
- Tailwind skaneerib ainult `src/components/ui` → vaadetes **ei kasutata Tailwindi klasse**; vaade annab ainult `Card` prop'id ja oma vaateklassi. `index.css` on kihis `legacy` (enne `utilities`) → vaate reegel, mis peab `Card` utiliidi üle võitma (olekuääris, toonitud taust, erandnurk), vajab `!important`. `src/admin/admin.css` on **kihistamata** → selle reeglid võidavad utiliite ise; seepärast kustuta sealt `Card`-iga dubleeruvad polstrid/äärised, muidu need jäävad peale.
- Identifikaatorid inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- Keskkond: kohalik kaust on sshfs-mount; käsud serveris `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`.
- Kontrollid iga ülesande lõpus: `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run src/tooling src/components/ui`; `npx oxlint <muudetud failid>`; `npm run ui-audit -- --details` (rida „Vanu kaarte“ — oodatav väärtus on igas ülesandes kirjas; kui erineb, kirjelda raportis miks).
- **Visuaalne kontroll iga ülesande lõpus (kohustuslik):** pärast release'i `npx tsx scripts/shot.mts --user andresj --height 2400 [--do click:<css> …] <tee>` (light + dark), kopeeri `scp -q -o BatchMode=yes 'debian@uvn-243-120.tll07.zonevs.eu:/tmp/shots/*.png' <kohalik kaust>`, vaata pilte Read-tööriistaga, lõika vajadusel `sips -c H W --cropOffset Y X`. Enne pildistamist tühjenda `/tmp/shots` (`rm -f /tmp/shots/*.png`). Peavaated avad päise nupust: `--do 'click:.main-view-switch >> text=Tehnika'` (Kaart, Põllud, Kultuurid, Külvikord, Põllutööd, Laoarvestus, Tehnika, Taristu, Isikud, Ilm, Hooajad). Dialoogi avamise selektori leia `grep`-iga (nupu `title`/tekst) ja kirjuta raportisse. Raportisse: millised pildid vaatasid ja mida nägid — **viga** on: läbipaistev/udune kaart, valge kaart tumedas teemas, hall brauseri nupp kaardi asemel, nähtamatu tekst, kadunud olekuääris (valitud, staatus), muutunud paigutus.
- Commit masteris enne release'i, failid nimeliselt (`git add <failid>`); sõnum lõpeb sinu sessiooni attribution-meeldetuletuse `Co-Authored-By:` reaga. Release: `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` ja `systemctl is-active teris` → `active`.

---

## Failid

| Fail | Vastutus | Ülesanded |
|---|---|---|
| `src/components/ui/variants.ts` | `cardVariants`, `cardHeaderClass`, `cardTitleClass`, `cardActionsClass` (asendab `cardClass`) | 1 |
| `src/components/ui/Card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardActions`, `Panel` | 1 |
| `src/components/ui/index.ts`, `UiGallery.tsx`, `README.md`, `variants.test.ts` | eksport, näidised, reeglid, testid | 1, 7 |
| `src/styles/app.css` | `--color-card` → `--bg-surface` | 1 |
| `src/index.css` | `--bg-surface` token; vaateklassidest välimus välja; `.glass-card` ja surnud klassid välja | 1–7 |
| `src/tooling/uiAudit.ts`, `uiAudit.test.ts`, `scripts/ui-audit.mts` | rida „Vanu kaarte (tsx+css, sh admin)“ | 1 |
| `scripts/shot.mts` | `--anon`, `--platform` (admin-pildid) | 6 |
| vaated | `<Card …>` | 2–6 |

---

### Task 1: ui Card alus, tahke taust, audit, galerii

**Files:**
- Modify: `src/components/ui/variants.ts` (rida ~137–138 `cardClass`)
- Modify: `src/components/ui/Card.tsx` (kogu fail)
- Modify: `src/components/ui/index.ts:5`
- Modify: `src/components/ui/variants.test.ts` (`allClassStrings` + uus `describe('kaart')`)
- Modify: `src/components/ui/UiGallery.tsx` (import, uus `Section` „Kaardid“, rida ~306 `Card`)
- Modify: `src/components/ui/README.md` (uus jaotis „Kaart“, tabelirida `--bg-card`)
- Modify: `src/styles/app.css` (`--color-card`)
- Modify: `src/index.css` (`:root` ja `:root[data-theme="dark"]` tokenid; `.glass-card` ~128)
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts`

**Interfaces:**
- Consumes: `cn` (`./cn`), `Slot` (`radix-ui`), `cva`/`VariantProps`.
- Produces (kõik ülesanded 2–7 kasutavad):
  - `Card: React.FC<CardProps>`; `CardProps = React.ComponentProps<'div'> & { variant?: 'surface' | 'floating' | 'tile'; padding?: 'none' | 'sm' | 'md'; interactive?: boolean; selected?: boolean; asChild?: boolean }`. Renderdab `data-slot="card"`, `data-selected` kui valitud.
  - `CardHeader: React.FC<React.ComponentProps<'div'> & { align?: 'center' | 'start' }>` (vaikimisi `center`), `data-slot="card-header"`.
  - `CardTitle: React.FC<React.ComponentProps<'h3'> & { as?: 'h2' | 'h3' | 'h4' }>` (vaikimisi `h3`), `data-slot="card-title"`.
  - `CardActions: React.FC<React.ComponentProps<'div'>>`, `data-slot="card-actions"`.
  - `Panel` (sama liides nagu enne: `title`, `actions?`, `className?`, `bodyClassName?`, `children`).
  - `cardVariants(opts)`, `cardHeaderClass({ align })`, `cardTitleClass`, `cardActionsClass`, tüübid `CardVariant`, `CardPadding` (`variants.ts`).
  - `legacyCardRules(css: string): string[]`, `LEGACY_CARD_CLASSES: ReadonlySet<string>`, `AuditReport.legacyCardFiles: { path: string; count: number }[]` (`uiAudit.ts`).
  - CSS token `--bg-surface` (hele `#ffffff`, tume `#0f172a`); Tailwindi `bg-card` = `var(--bg-surface)`.

- [ ] **Step 1: Kirjuta failivad testid — variandid**

Asenda `variants.test.ts`-is `allClassStrings` reas `v.popoverContentClass, v.tooltipContentClass, v.cardClass,` → `v.popoverContentClass, v.tooltipContentClass,` ja lisa massiivi lõppu (enne `];`):

```ts
  ...(['surface', 'floating', 'tile'] as const).flatMap((variant) =>
    (['none', 'sm', 'md'] as const).flatMap((padding) =>
      [true, false].map((interactive) => v.cardVariants({ variant, padding, interactive, selected: interactive }))
    )
  ),
  v.cardHeaderClass({ align: 'center' }), v.cardHeaderClass({ align: 'start' }), v.cardTitleClass, v.cardActionsClass,
```

Lisa faili lõppu:

```ts
describe('kaart', () => {
  const variants = ['surface', 'floating', 'tile'] as const;
  it('kõik variandid on tahked: ilma backdrop-filterita ja läbipaistva taustata', () => {
    for (const variant of variants) {
      const c = v.cardVariants({ variant });
      expect(c, variant).not.toMatch(/backdrop-|(^|\s)blur/);
      expect(c, variant).not.toMatch(/bg-transparent|bg-[a-z-]+\/\d+/);
    }
  });
  it('kaart ja ujuv paneel 16px, sisemine plaat 10px', () => {
    expect(v.cardVariants({ variant: 'surface' })).toContain('rounded-lg');
    expect(v.cardVariants({ variant: 'floating' })).toContain('rounded-lg');
    expect(v.cardVariants({ variant: 'tile' })).toContain('rounded-md');
    expect(v.cardVariants({ variant: 'tile' })).not.toContain('rounded-lg');
  });
  it('vari: kaart shadow-card, ujuv paneel shadow-dialog, plaat varjuta', () => {
    expect(v.cardVariants({ variant: 'surface' })).toContain('shadow-card');
    expect(v.cardVariants({ variant: 'floating' })).toContain('shadow-dialog');
    expect(v.cardVariants({ variant: 'tile' })).not.toMatch(/(^|\s)shadow-/);
  });
  it('taust: kaart ja ujuv bg-card, plaat bg-muted', () => {
    expect(v.cardVariants({ variant: 'surface' })).toContain('bg-card');
    expect(v.cardVariants({ variant: 'floating' })).toContain('bg-card');
    expect(v.cardVariants({ variant: 'tile' })).toContain('bg-muted');
  });
  it('polster: vaikimisi md 16px, sm 12px, none ei anna polstriklassi', () => {
    expect(v.cardVariants({})).toContain('p-4');
    expect(v.cardVariants({ padding: 'sm' })).toContain('p-3');
    expect(v.cardVariants({ padding: 'none' })).not.toMatch(/(^|\s)p[xytrbl]?-/);
  });
  it('kaart ei sea teksti värvi, klõpsatav seab (button ei päri värvi)', () => {
    expect(v.cardVariants({})).not.toMatch(/(^|\s)text-/);
    const c = v.cardVariants({ interactive: true });
    expect(c).toContain('text-foreground');
    expect(c).toContain('text-left');
    expect(c).toContain('cursor-pointer');
    expect(c).toContain('hover:bg-card-hover');
  });
  it('valitud: roheline ääris võidab tavaäärise (cn), lisaks rõngas', () => {
    const c = cn(v.cardVariants({ selected: true }));
    expect(c).toContain('border-primary');
    expect(c).not.toMatch(/(^|\s)border-border(\s|$)/);
    expect(c).toContain('ring-primary');
  });
  it('päis: joondus keskele või üles', () => {
    expect(v.cardHeaderClass({ align: 'center' })).toContain('items-center');
    expect(v.cardHeaderClass({ align: 'start' })).toContain('items-start');
    expect(v.cardActionsClass).toContain('ml-auto');
  });
});
```

- [ ] **Step 2: Kirjuta failivad testid — audit**

Lisa `src/tooling/uiAudit.test.ts` importi `legacyCardRules` (`import { auditCss, auditTsx, legacyCardRules, summarize } from './uiAudit';` — kohanda olemasolevat imporditrida) ja faili lõppu:

```ts
describe('vanad kaardid', () => {
  it('loeb tsx-is glass-card klassi, ei loe sarnaseid nimesid', () => {
    const src = '<div className="vehicle-card glass-card"><div className="glass-cards x-glass-card" />';
    expect(auditTsx(src).legacyCards).toEqual(['glass-card']);
  });
  it('loeb CSS-is kaardiklassi reegli, mis seab välimuse; ei loe olekuid, !important-i, asetust ega teisi klasse', () => {
    const css = `/* .glass-card kommentaaris */
.vehicle-card { padding: 14px; display: flex; }
.implement-card,
.device-card { background: var(--bg-card); border: 1px solid var(--border-card); }
.vehicle-card.selected { border-color: green; box-shadow: 0 0 1px red; }
.coords-tracker { position: absolute; border-radius: var(--radius-md) !important; }
.add-poi-banner { border-color: pink !important; }
.glass-card { -webkit-backdrop-filter: blur(16px); }
.other-card { background: red; }
@media (max-width: 600px) { .trip-tile { border-radius: 10px; } }`;
    expect(legacyCardRules(css)).toEqual(['.implement-card', '.device-card', '.glass-card', '.trip-tile']);
  });
  it('summarize annab tsx ja css failid, ui kaust välja', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="glass-card" />' },
      { path: 'src/components/ui/Gallery.tsx', content: '<div className="glass-card" />' },
      { path: 'src/index.css', content: '.glass-card { background: red; }' },
    ]);
    expect(r.legacyCardFiles).toEqual([
      { path: 'src/components/A.tsx', count: 1 },
      { path: 'src/index.css', count: 1 },
    ]);
  });
});
```

- [ ] **Step 3: Käivita testid, veendu et kukuvad**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/tooling src/components/ui'`
Expected: FAIL — `v.cardVariants is not a function`, `legacyCardRules` puudub, `legacyCards` undefined.

- [ ] **Step 4: Kirjuta variandid**

`variants.ts`: asenda read

```ts
/** Klaasikaart (praegune .glass-card). */
export const cardClass = 'rounded-lg border border-border bg-card text-foreground shadow-card backdrop-blur-lg';
```

järgnevaga:

```ts
// --- Kaart (etapp 2.7) ---
// Kasutaja otsused 2026-11-15: taust alati tahke (ilma klaasi ja backdrop-filter'ita, ka kaardi peal ujuvatel
// paneelidel); nurk kaart/paneel 16px, sisemine plaat 10px; üks kaardi vari, ujuv paneel ühe astme võrra
// tugevam, plaat varjuta. Kaart ei sea teksti värvi (pärib vanemalt); klõpsatav seab, sest <button> ei päri.
export type CardVariant = 'surface' | 'floating' | 'tile';
export type CardPadding = 'none' | 'sm' | 'md';

export const cardVariants = cva('border border-border', {
  variants: {
    variant: {
      // Lehe- ja registrikaart.
      surface: 'rounded-lg bg-card shadow-card',
      // Kaardi (Leaflet) peal ujuv paneel: sama taust, tugevam vari.
      floating: 'rounded-lg bg-card shadow-dialog',
      // Sisemine plaat kaardi/dialoogi sees (KPI, sektsioon, loendikirje): vaikne taust, varjuta.
      tile: 'rounded-md bg-muted',
    },
    // none: klassi ei anta — vaate CSS-i oma polster (nt väike kaardinäit) jääb kehtima.
    padding: { none: '', sm: 'p-3', md: 'p-4' },
    interactive: {
      true: 'cursor-pointer text-left text-foreground [font:inherit] transition-colors hover:border-primary/50 hover:bg-card-hover',
      false: '',
    },
    selected: { true: 'border-primary ring-1 ring-primary', false: '' },
  },
  defaultVariants: { variant: 'surface', padding: 'md', interactive: false, selected: false },
});

/** Kaardi päis: pealkiri vasakul, tegevused paremal. */
export const cardHeaderClass = ({ align = 'center' }: { align?: 'center' | 'start' } = {}): string =>
  cn('flex justify-between gap-3', align === 'start' ? 'items-start' : 'items-center');
export const cardTitleClass = 'm-0 text-base font-semibold';
export const cardActionsClass = 'ml-auto flex shrink-0 items-center gap-1';
```

- [ ] **Step 5: Kirjuta komponendid**

`Card.tsx` (kogu fail):

```tsx
// src/components/ui/Card.tsx — kaart (tahke), kaardi peal ujuv paneel, sisemine plaat; päis ja päisega paneel.
// Välimus tuleb siit; vaate klass (className) annab ainult asetuse (position, z-index, flex, gap, margin).
import React from 'react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { cardActionsClass, cardHeaderClass, cardTitleClass, cardVariants } from './variants';

export type CardProps = React.ComponentProps<'div'> &
  VariantProps<typeof cardVariants> & {
    /** Renderda laps (<button>, <form>, <section>) kaardi välimusega. */
    asChild?: boolean;
  };

export const Card: React.FC<CardProps> = ({ className, variant, padding, interactive, selected, asChild = false, ...props }) => {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      data-slot="card"
      data-selected={selected ? '' : undefined}
      className={cn(cardVariants({ variant, padding, interactive, selected }), className)}
      {...props}
    />
  );
};

export const CardHeader: React.FC<React.ComponentProps<'div'> & { align?: 'center' | 'start' }> = ({ className, align, ...props }) => (
  <div data-slot="card-header" className={cn(cardHeaderClass({ align }), className)} {...props} />
);

export const CardTitle: React.FC<React.ComponentProps<'h3'> & { as?: 'h2' | 'h3' | 'h4' }> = ({ as: Tag = 'h3', className, ...props }) => (
  <Tag data-slot="card-title" className={cn(cardTitleClass, className)} {...props} />
);

export const CardActions: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card-actions" className={cn(cardActionsClass, className)} {...props} />
);

interface PanelProps {
  title: React.ReactNode;
  /** Päise paremasse serva (nupud, filtrid). */
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, actions, className, bodyClassName, children }) => (
  <Card asChild padding="none" className={cn('flex flex-col', className)}>
    <section>
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle as="h2" className="text-lg">{title}</CardTitle>
        {actions && <CardActions className="gap-2">{actions}</CardActions>}
      </CardHeader>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  </Card>
);
```

`index.ts` rida 5 → `export { Card, CardHeader, CardTitle, CardActions, Panel, type CardProps } from './Card';` ja lisa `export type { CardVariant, CardPadding } from './variants';` (`FieldSize` ekspordi kõrvale).

- [ ] **Step 6: Kirjuta audit**

`uiAudit.ts`:
1. `AuditReport`-i lisa `legacyCardFiles: { path: string; count: number }[];`
2. `LEGACY_MENU_POPUP` järele:

```ts
// Kaardid (etapp 2.7): tsx-is vana klaasikaardi klass; CSS-is nende klasside lihtreegel (ainult klass, ilma oleku
// või järglaseta), mis seab ise välimuse — välimus peab tulema ui/Card-ist, vaate klassis jääb ainult asetus.
// `!important` välimus on teadlik erand (olekuääris, erandnurk) ega loe. Jääb alles valvurina: peab olema 0.
const LEGACY_CARD_TSX = /(?<![\w-])glass-card(?![\w-])/g;
export const LEGACY_CARD_CLASSES: ReadonlySet<string> = new Set([
  'glass-card',
  // ujuvpaneelid kaardi peal
  'layer-control-panel', 'satellite-panel', 'map-year-floating-widget', 'cultivation-panel', 'add-poi-banner',
  'coords-tracker', 'radar-legend', 'field-map-card', 'layer-field-box',
  // register- ja loendikaardid
  'vehicle-card', 'implement-card', 'device-card', 'finance-entry-card', 'edit-cad-item', 'history-filter-bar',
  'empty-register-state',
  // KPI ja statistika plaadid
  'finance-kpi-card', 'finance-summary-card', 'finance-results-status-bar', 'trip-tile', 'register-crop-summary',
  'dev-telemetry-summary', 'imp-status-box',
  // sektsioonikastid
  'support-panel', 'fw-plan-section', 'parsed-preview-box', 'weather-chart-card',
  // teenusepakkuja admin
  'admin-card', 'admin-login', 'admin-subform', 'admin-stat',
]);
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;
const CARD_LOOK_DECL = /(?:^|[;\s])(background(?:-color)?|border|border-radius|box-shadow|(?:-webkit-)?backdrop-filter)\s*:\s*([^;}]*)/g;

export function legacyCardRules(css: string): string[] {
  const out: string[] = [];
  for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(CSS_RULE)) {
    const bare = selector
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\.[\w-]+$/.test(s) && LEGACY_CARD_CLASSES.has(s.slice(1)));
    if (bare.length > 0 && [...body.matchAll(CARD_LOOK_DECL)].some((d) => !d[2].includes('!important'))) out.push(...bare);
  }
  return out;
}
```

3. `auditCss` tagastusse lisa `cardRules: legacyCardRules(css),`.
4. `auditTsx` tagastusse lisa `legacyCards: src.match(LEGACY_CARD_TSX) ?? [],`.
5. `summarize`: muuda esimene rida `const css = files.filter((f) => f.path.endsWith('.css')).map((f) => ({ path: f.path, ...auditCss(f.content) }));` ja lisa tagastusse:

```ts
    legacyCardFiles: [
      ...tsx
        .filter((t) => t.legacyCards.length > 0 && !t.path.includes('components/ui/'))
        .map((t) => ({ path: t.path, count: t.legacyCards.length })),
      ...css.filter((c) => c.cardRules.length > 0).map((c) => ({ path: c.path, count: c.cardRules.length })),
    ],
```

`scripts/ui-audit.mts`: `walk` saab välistuse parameetri ja kaardirida hõlmab ka admini:

```ts
function walk(dir: string, exclude: string[] = EXCLUDE): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (exclude.some((e) => p.startsWith(e)) || name.startsWith('._')) return [];
    return statSync(p).isDirectory() ? walk(p, exclude) : /\.(css|tsx)$/.test(name) ? [p] : [];
  });
}
```

ja faili lõppu:

```ts
// Kaardid (etapp 2.7) hõlmavad ka teenusepakkuja admini (admin-card jt lähevad samuti ui/Card-ile).
const adminFiles = walk('src/admin', []).map((path) => ({ path, content: readFileSync(path, 'utf8') }));
const cards = summarize([...files, ...adminFiles]).legacyCardFiles;
row('Vanu kaarte (tsx+css, sh admin)', cards.reduce((s, f) => s + f.count, 0), cards.map((f) => `${f.path}: ${f.count}`));
```

- [ ] **Step 7: Käivita testid, veendu et läbivad**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/tooling src/components/ui'`
Expected: PASS (kõik, sh vanad `allClassStrings` testid — `[font:inherit]` ei ole keelatud suvaline väärtus, `text-left`/`text-foreground` on lubatud nimekirjas).

- [ ] **Step 8: Tahke taust (token) ja .glass-card**

`src/index.css` heledas plokis (`:root, :root[data-theme="light"]`) `--bg-card` rea järele:

```css
  /* Kaardi tahke taust (etapp 2.7, kasutaja otsus: ilma klaasita). Tailwindi bg-card loeb seda. */
  --bg-surface: #ffffff;
```

tumedas plokis (`:root[data-theme="dark"]`) `--bg-card` rea järele:

```css
  --bg-surface: #0f172a;
```

`.glass-card` reegel (üleminekuks, kustutatakse Task 7-s) — asenda `background: var(--bg-card);` → `background: var(--bg-surface);` ja kustuta read `backdrop-filter: blur(16px);` ja `-webkit-backdrop-filter: blur(16px);`. Kommentaar `/* Glass Card Utility */` → `/* Vana kaart (üleminek ui/Card-ile, etapp 2.7): tahke, ilma klaasita */`. `.login-page .login-card.glass-card` EI muutu (oma välimus).

`src/styles/app.css`: `--color-card: var(--bg-card);` → `--color-card: var(--bg-surface);`.

- [ ] **Step 9: Galerii**

`UiGallery.tsx`: importi lisa `CardActions, CardHeader, CardTitle`. Komponendi state'ide juurde: `const [pickedCard, setPickedCard] = useState('a');`. Rida `<Card className="px-4 py-3 text-sm">Paremklõps siin</Card>` → `<Card padding="sm" className="text-sm">Paremklõps siin</Card>`. Lisa `Section` „Dialoog, menüüd, hüpikud“ järele (enne `</div>` sulgemist):

```tsx
        <Section title="Kaardid">
          <Card className="w-72">
            <CardHeader align="start">
              <CardTitle>Kaart (surface)</CardTitle>
              <CardActions>
                <Button variant="ghost" size="icon-sm" title="Muuda"><Pencil size={16} /></Button>
                <Button variant="danger-ghost" size="icon-sm" title="Kustuta"><Trash2 size={16} /></Button>
              </CardActions>
            </CardHeader>
            <p className="mt-2 text-sm text-muted-foreground">Tahke taust, 16px nurk, kaardi vari, polster md (16px).</p>
          </Card>
          <div className="w-80 rounded-md bg-muted p-4">
            <Card variant="floating" padding="sm" className="text-sm">
              Ujuv paneel (floating): kaardi peal, tugevam vari, polster sm (12px).
            </Card>
          </div>
          <Card className="w-96">
            <CardTitle>Plaadid kaardi sees (tile)</CardTitle>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[['Põlde', '42'], ['Pindala', '312,40 ha'], ['Kulud', '18 240 €']].map(([label, value]) => (
                <Card key={label} variant="tile" padding="sm">
                  <div className="text-2xs uppercase text-muted-foreground">{label}</div>
                  <div className="num text-base font-semibold">{value}</div>
                </Card>
              ))}
            </div>
          </Card>
          <div className="flex w-72 flex-col gap-2">
            {['a', 'b'].map((id) => (
              <Card key={id} padding="sm" interactive selected={pickedCard === id} onClick={() => setPickedCard(id)}>
                Klõpsatav kaart {id.toUpperCase()} {pickedCard === id ? '(valitud)' : ''}
              </Card>
            ))}
            <Card asChild variant="tile" padding="sm" interactive selected={pickedCard === 'c'}>
              <button type="button" onClick={() => setPickedCard('c')}>Plaat nupuna (asChild + button)</button>
            </Card>
          </div>
          <Panel title="Paneel" actions={<Button size="sm">Tegevus</Button>} className="w-72">Päisega paneel (Panel).</Panel>
        </Section>
```

(`Pencil`, `Trash2` on juba imporditud. Galerii on `ui/` kaustas — Tailwindi klassid on seal lubatud.)

- [ ] **Step 10: README**

`README.md` tabelis rida `| `--bg-card` | `bg-card` | kaart |` → `| `--bg-surface` | `bg-card` | kaart (tahke; vana `--bg-card` on läbipaistev ja ainult legacy jaoks) |`. Lisa jaotis „Menüüd, hüpikud, vihjed“ ette:

```md
## Kaart

- `<Card>` — tahke kaart (kasutaja otsus 2026-11-15: klaasi ja `backdrop-filter`-it ei kasutata kusagil).
  - `variant`: `surface` (vaikimisi; lehe- ja registrikaart, 16px, `shadow-card`), `floating` (kaardi peal ujuv paneel,
    16px, tugevam vari `shadow-dialog`), `tile` (sisemine plaat kaardi/dialoogi sees: KPI, sektsioon, loendikirje; 10px,
    `bg-muted`, varjuta).
  - `padding`: `md` 16px (vaikimisi), `sm` 12px, `none` (klassi ei anta — vaate CSS-i polster kehtib, nt väike kaardinäit).
  - `interactive` (kursor, hover, `text-left`, teksti värv) ja `selected` (roheline ääris + rõngas).
  - `asChild`: `<Card asChild interactive><button type="button">…</button></Card>`, samuti `<form>`, `<section>`.
- Kaart ei sea teksti värvi (pärib), v.a `interactive`.
- Päis: `CardHeader` (`align="center|start"`), `CardTitle` (`as="h2|h3|h4"`, vaikimisi h3), `CardActions` (paremale).
  `Panel` = kaart + päis äärisega + sisu.
- Vaate klass kaardil annab **ainult asetuse** (position, z-index, flex, gap, margin, kirjasuurus). Välimuse
  (taust, ääris, nurk, vari, polster) annab `Card`. Vaate olekureegel, mis peab `Card`-i üle võitma (staatuse
  ääris, toonitud taust, erandnurk), vajab `!important` (`index.css` on `legacy` kihis). `admin.css` on kihistamata
  ja võidab ise — sealt kustuta kaardiga dubleeruvad polstrid ja äärised.
- `npm run ui-audit` rida „Vanu kaarte“ peab olema 0.
- Erandid (jäävad oma CSS-iga): `login-card`, `fw-card`, `telemetry-suggestions-card`, `fleet-card-notes`,
  `fw-panel-empty`, `crop-group-empty`, `party-role-checkbox`.
```

- [ ] **Step 11: Kontrollid**

Run (serveris): `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/tooling src/components/ui && npx oxlint src/components/ui src/tooling scripts/ui-audit.mts && npm run ui-audit -- --details`
Expected: tsc 0 viga, testid PASS, oxlint 0 viga; „Vanu kaarte (tsx+css, sh admin)“ **≈ 66** (41 `glass-card` tsx-is + 25 CSS-reeglit). Kirjuta täpne algtase raportisse.

- [ ] **Step 12: Commit + release**

```bash
git add src/components/ui/variants.ts src/components/ui/variants.test.ts src/components/ui/Card.tsx src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/styles/app.css src/index.css src/tooling/uiAudit.ts src/tooling/uiAudit.test.ts scripts/ui-audit.mts
git commit -m "feat(ui): kaardi alus — tahke taust, variandid surface/floating/tile, polster, päis; audit vanadele kaartidele"
```

Release (Global Constraints).

- [ ] **Step 13: Ekraanipildid**

`npx tsx scripts/shot.mts --user andresj --height 4000 /ui` — vaata jaotist „Kaardid“ (5 näidist) ja et kõik `Section` paneelid näevad välja nagu enne (pealkiri 16px, ääris all). Heledas ja tumedas: kaart tahke, tume kaart tumesinine (mitte valge).
`npx tsx scripts/shot.mts --user andresj --height 1200 /` — kaardivaade: kihtide paneel, aasta vidin paremal üleval on tahked (taust ei paista läbi).
`npx tsx scripts/shot.mts --user andresj --height 2400 --do 'click:.main-view-switch >> text=Tehnika' /` — sõidukikaardid tahked.
Raport: algtase, mida nägid.

---

### Task 2: Kaardi peal ujuvad paneelid

**Files:**
- Modify: `src/components/LayerControl.tsx` (~88 `layer-control-panel`; ~144, 185, 252, 278 `layer-field-box`)
- Modify: `src/components/CultivationControl.tsx` (~143)
- Modify: `src/components/MapYearSelector.tsx` (~79)
- Modify: `src/components/SatellitePanel.tsx` (~290)
- Modify: `src/components/MapView.tsx` (~1064 `coords-tracker`, ~1070 `radar-legend`, ~1124 `add-poi-banner`)
- Modify: `src/components/FieldMapCard.tsx` (~27)
- Modify: `src/index.css` (reeglid `.coords-tracker`, `.radar-legend`, `.satellite-panel`, `.add-poi-banner`, `.layer-control-panel`, `.layer-field-box`, `.map-year-floating-widget`, `.cultivation-panel`, `.field-map-card`)

**Interfaces:**
- Consumes: `Card` (Task 1): `variant`, `padding`, `className`; import `import { Card } from './ui';` (või olemasolevasse `./ui` importi).
- Produces: mitte midagi uut.

- [ ] **Step 1: JSX** — iga element asenda `<Card>`-iga (sulgev `</div>` → `</Card>`; muud atribuudid, `ref`, `key`, `role`, `aria-*` jäävad):

| Fail | Enne | Pärast |
|---|---|---|
| LayerControl | `<div className={`layer-control-panel glass-card ${isOpen ? 'open' : 'collapsed'}`}>` | `<Card variant="floating" className={`layer-control-panel ${isOpen ? 'open' : 'collapsed'}`}>` (polster md) |
| LayerControl ×4 | `<div className="layer-field-box">` | `<Card variant="tile" padding="none" className="layer-field-box">` |
| CultivationControl | `<div className="cultivation-panel glass-card">` | `<Card variant="floating" className="cultivation-panel">` |
| MapYearSelector | `<div className="map-year-floating-widget glass-card">` | `<Card variant="floating" padding="sm" className="map-year-floating-widget">` |
| SatellitePanel | `<div className="satellite-panel glass-card">` | `<Card variant="floating" padding="sm" className="satellite-panel">` |
| MapView | `<div ref={coordsDisplayRef} className="coords-tracker glass-card">` | `<Card ref={coordsDisplayRef} variant="floating" padding="none" className="coords-tracker">` |
| MapView | `<div className="radar-legend glass-card">` | `<Card variant="floating" padding="none" className="radar-legend">` |
| MapView | `<div className="add-poi-banner glass-card animate-pulse">` | `<Card variant="floating" padding="sm" className="add-poi-banner animate-pulse">` |
| FieldMapCard | `<div className="field-map-card" role="region" aria-label={…}>` | `<Card variant="floating" padding="sm" className="field-map-card" role="region" aria-label={…}>` |

`coordsDisplayRef` tüüp on `useRef<HTMLDivElement>` — `Card` edastab `ref`-i (React 19 ref prop); kui tsc kurdab, kontrolli tüüpi, ära lisa `forwardRef`-i.

- [ ] **Step 2: CSS** — asenda reeglid (`index.css`, otsi klassinime järgi):

```css
.coords-tracker {
  position: absolute;
  bottom: 24px;
  left: 80px;
  padding: 6px 12px;
  font-size: 0.72rem;
  font-family: monospace;
  color: var(--text-secondary);
  z-index: 800;
  /* Väike näit kaardil: plaadi nurk 10px, mitte paneeli 16px (16px teeks ühe rea kõrgusest pilli) */
  border-radius: var(--radius-md) !important;
  pointer-events: none;
}

.radar-legend {
  position: absolute;
  bottom: 60px;
  left: 80px;
  padding: 8px 10px;
  z-index: 800;
  /* Väike legend kaardil: plaadi nurk 10px */
  border-radius: var(--radius-md) !important;
  font-size: 0.7rem;
  color: var(--text-secondary);
  pointer-events: none;
}

.satellite-panel {
  width: 100%;
  z-index: 800;
  font-size: 0.72rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-poi-banner {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  color: #db2777;
  font-weight: 600;
  font-size: 0.88rem;
  /* Lisamise režiim: roosa ääris peab Card-i äärise üle võitma */
  border-color: rgba(219, 39, 119, 0.4) !important;
  display: flex;
  align-items: center;
  gap: 14px;
}

.layer-control-panel {
  width: 100%;
  flex: 0 0 auto;
}

.layer-field-box {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-year-floating-widget {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: fadeIn 0.2s ease-out;
}
```

`.cultivation-panel`: kustuta ainult rida `padding: 14px 16px;` (ülejäänud asetus jääb). `.field-map-card` →
`.field-map-card { position: relative; width: 300px; display: flex; flex-direction: column; gap: 8px; }`.
Muud järglasreeglid (`.layer-field-box .layer-item`, `.satellite-panel-title`, `.fmc-header` …) ei muutu.

- [ ] **Step 3: Kontrollid** (Global Constraints). Oodatav „Vanu kaarte“ ≈ **52** (−7 tsx, −7 css).
- [ ] **Step 4: Commit + release** — `git add` ülal loetletud failid; `git commit -m "refactor(ui): kaardi peal ujuvad paneelid ui Card-ile (tahke, tugevam vari)"`.
- [ ] **Step 5: Ekraanipildid** (mõlemad teemad, `--height 1200`):
  - `/` — kihtide paneel (lahti, `layer-field-box` plaadid sees), aasta vidin, koordinaadid all vasakul (liiguta hiirt `--do hover-at:700,500`), raadari legend (kui ilmakiht sees).
  - Põllu kaart: esimesest pildist vali põllu keskpunkt, `--do click-at:<x>,<y>` → `field-map-card`.
  - Satelliidi paneel ja harimise paneel: leia avamise nupud `grep -n "setShowSatellite\|setShowCultivation\|Cultivation" src/components/MapView.tsx src/App.tsx` → `--do click:<selektor>`.
  - POI lisamise riba: leia nupp `grep -n "add-poi\|isAddingPoi" src/components/MapView.tsx src/App.tsx` → `--do click:<selektor>`.
  - Kontrolli: kõik tahked, 16px nurk (koordinaadid/legend 10px), roosa ääris POI ribal alles, `pointer-events` (koordinaadid ei sega kaardi lohistamist — `--do hover-at` järel kaart ei muutu).

---

### Task 3: Register- ja loendikaardid

**Files:**
- Modify: `src/components/VehicleTracker.tsx` (~1300 `vehicle-card`, ~1303 `v-card-header`, `card-header-actions` ~1318/~1499/~1633, ~1490 `implement-card`, ~1620 `device-card`, ~1789 filtririba, ~1859 tühi olek)
- Modify: `src/components/PoiManagerModal.tsx` (~392–401)
- Modify: `src/components/RelatedPartiesModal.tsx` (~488–506, ~593)
- Modify: `src/components/DeviceAssignmentRegister.tsx` (~179, ~240)
- Modify: `src/components/TripRegister.tsx` (~137, ~197)
- Modify: `src/components/FinanceModal.tsx` (~486–494 `finance-entry-card`)
- Modify: `src/components/FieldEditDialog.tsx` (~642 `edit-cad-item`)
- Modify: `src/index.css` (`.vehicle-card*`, `.v-card-header`, `.card-header-actions`, `.implement-card, .device-card`, `.history-filter-bar`, `.empty-register-state`, `.finance-entry-card*`, `.edit-cad-item`)

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardActions` (Task 1).
- Produces: vaateklass `.empty-register-state.is-muted` (summutatud tekst tühjale olekule).

- [ ] **Step 1: Sõiduki-, POI- ja isikukaardid**

VehicleTracker:
```tsx
<Card
  key={v.id}
  padding="sm"
  interactive
  selected={isSelected}
  className="vehicle-card"
  onClick={() => onSelectVehicle(v)}
>
  <CardHeader align="start">
    …(v-title-wrap sisu muutmata)…
    <div className="card-header-right">
      …Badge…
      <CardActions>…nupud muutmata…</CardActions>
    </div>
  </CardHeader>
  …
</Card>
```
PoiManagerModal ja RelatedPartiesModal: `<div key={…} className="vehicle-card glass-card" onClick={…}>` → `<Card key={…} padding="sm" interactive className="vehicle-card" onClick={…}>`; nende `v-card-header` → `CardHeader align="start"`, `card-header-actions` → `CardActions`.
Implement/device: `<div key={imp.id} className="implement-card glass-card">` → `<Card key={imp.id} padding="sm" className="implement-card">`; `<div key={dev.id} className={`device-card glass-card ${fresh.cls}`}>` → `<Card key={dev.id} padding="sm" className={`device-card ${fresh.cls}`}>`; nende `card-header-actions` → `CardActions`. `dev-card-header`, `imp-card-header`, `card-header-right` jäävad (oma asetus).
Kõik `card-header-actions` kasutused peavad kaduma: `grep -rn "card-header-actions\|v-card-header" src` → 0.

- [ ] **Step 2: Filtririba ja tühjad olekud** (VehicleTracker, DeviceAssignmentRegister, TripRegister, RelatedPartiesModal)

```tsx
<Card padding="sm" className="history-filter-bar">
```
(inline `style` kustutatakse kolmes kohas.)
```tsx
<Card padding="none" className="empty-register-state is-muted">
```
(kolm `style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}` kohta). RelatedPartiesModal: `<div className="empty-register-state glass-card" style={{ padding: '32px', textAlign: 'center' }}>` → `<Card padding="none" className="empty-register-state">`.

- [ ] **Step 3: Finantskanne (nupp) ja kinnistu rida**

FinanceModal:
```tsx
<Card key={e.id} asChild variant="tile" padding="sm" interactive selected={isSelected}>
  <button
    type="button"
    className={`finance-entry-card ${e.financeStatus.toLowerCase()}`}
    onClick={() => setSelectedEntryId(e.id)}
  >
    …sisu muutmata…
  </button>
</Card>
```
FieldEditDialog: `<div key={pIdx} className="edit-cad-item glass-card">` → `<Card key={pIdx} variant="tile" padding="sm" className="edit-cad-item">` (klass jääb, kui `grep -n "edit-cad-item" src/index.css` näitab järglasreegleid; muidu eemalda className ja reegel).

- [ ] **Step 4: CSS** — asenda/kustuta:

```css
.vehicle-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.implement-card,
.device-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Registrite filtririba (Tehnika, seadmete register, sõidud) */
.history-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.empty-register-state.is-muted {
  color: var(--text-muted);
}

.finance-entry-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

/* Staatuse riba vasakul peab Card-i äärise üle võitma */
.finance-entry-card.pending {
  border-left: 3px solid #f59e0b !important;
}

.finance-entry-card.changed {
  border-left: 3px solid #3b82f6 !important;
}

.finance-entry-card.confirmed {
  border-left: 3px solid #16a34a !important;
}
```
Kustuta: `.vehicle-card:hover`, `.vehicle-card.selected`, `.v-card-header`, `.card-header-actions`, `.finance-entry-card:hover`, `.finance-entry-card.selected`, `.edit-cad-item` lihtreegel (või ainult selle välimus, kui klass jääb). `.history-filter-bar > div > [data-slot="filter-clear"]` reeglid jäävad. Kui `.finance-entry-card`-il on teisi staatuseid (`grep -n "finance-entry-card\." src/index.css`), lisa ka neile `!important`.

- [ ] **Step 5: Kontrollid**. `grep -rn "glass-card" src/components` → ainult `LoginPage.tsx`, `SetPasswordPage.tsx`. Oodatav „Vanu kaarte“ ≈ **35** (−13 tsx, −4 css).
- [ ] **Step 6: Commit + release** — `git commit -m "refactor(ui): register- ja loendikaardid ui Card-ile (klõpsatav, valitud, päis)"`.
- [ ] **Step 7: Ekraanipildid** (mõlemad teemad, `--height 2400`):
  - Tehnika: `--do 'click:.main-view-switch >> text=Tehnika'` — sõidukid (vali üks: `--do 'click:.vehicle-card'` → roheline ääris), haakeriistad, seadmed, haakimiste register (filtririba), sõidud (filtririba, tühi olek filtriga, mis ei leia midagi). Saki selektorid leia `grep -n "activeTab ===" src/components/VehicleTracker.tsx`.
  - Taristu (POI kaardid), Isikud (kaardid; tühi olek otsinguga, nt `--do 'click:<otsinguväli>' --do 'key:…'`).
  - Põllutööd → finantsi aken → kannete loend (vali kanne → valitud ääris; staatuse riba vasakul alles).
  - Põllud → põllu muutmise dialoog (kinnistute read).
  - Kontrolli: nupp-kaart ei ole hall brauserinupp, tekst vasakul, tumedas teemas finantsi kanded ei ole valged.

---

### Task 4: KPI- ja statistikaplaadid

**Files:**
- Modify: `src/components/FinanceModal.tsx` (~687 `finance-summary-card`, ~747–777 `finance-kpi-card` ×4, ~789 `finance-results-status-bar`)
- Modify: `src/components/HarvestLotDialog.tsx` (~136 `finance-kpi-card`)
- Modify: `src/components/TripDialog.tsx` (~165 `trip-tile`)
- Modify: `src/components/FieldManagerModal.tsx` (~441 `register-crop-summary`)
- Modify: `src/components/VehicleTracker.tsx` (~1528 `imp-status-box`, ~1652/~1675 `dev-telemetry-summary`)
- Modify: `src/index.css` (`.finance-kpi-card*`, `.finance-summary-card`, `.finance-results-status-bar`, `.trip-tile`, `.register-crop-summary`, `.dev-telemetry-summary`, `.imp-status-box`)

**Interfaces:**
- Consumes: `Card` (Task 1).
- Produces: mitte midagi uut. (Eraldi `StatTile` komponenti ei tehta — sildi/väärtuse klassid jäävad vaatesse.)

- [ ] **Step 1: JSX** — kõik `variant="tile" padding="sm"`, vaateklass jääb:

| Enne | Pärast |
|---|---|
| `<div className="finance-kpi-card">` (×3 + HarvestLotDialog) | `<Card variant="tile" padding="sm" className="finance-kpi-card">` |
| `<div className={`finance-kpi-card result ${… ? 'profit' : 'loss'}`}>` | `<Card variant="tile" padding="sm" className={`finance-kpi-card result ${… ? 'profit' : 'loss'}`}>` |
| `<div className="finance-summary-card">` | `<Card variant="tile" padding="sm" className="finance-summary-card">` |
| `<div className="finance-results-status-bar">` | `<Card variant="tile" padding="sm" className="finance-results-status-bar">` |
| `<div key={t.label} className="trip-tile">` | `<Card key={t.label} variant="tile" padding="sm" className="trip-tile">` |
| `<div className="register-crop-summary">` | `<Card variant="tile" padding="sm" className="register-crop-summary">` |
| `<div className="imp-status-box">` | `<Card variant="tile" padding="sm" className="imp-status-box">` |
| `<div className="dev-telemetry-summary">` ×2 | `<Card variant="tile" padding="sm" className="dev-telemetry-summary">` |

Kui element pole `div` (nt `section`), kasuta `<Card asChild …><section className="…">`.

- [ ] **Step 2: CSS**

```css
.finance-kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Tulemuse toon peab Card-i plaadi äärise ja tausta üle võitma */
.finance-kpi-card.result.profit {
  border-color: #10b981 !important;
  background: rgba(16, 185, 129, 0.04) !important;
}

.finance-kpi-card.result.loss {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.04) !important;
}

.finance-summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.finance-results-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.78rem;
}

.trip-tile { min-width: 0; }

.register-crop-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 16px;
  flex-shrink: 0;
  max-height: 30vh;
  overflow-y: auto;
  margin-bottom: 14px;
}

.dev-telemetry-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  font-size: 0.72rem;
}

.imp-status-box {
  font-size: 0.76rem;
}
```
Järglasreeglid (`.finance-kpi-card.result.profit .finance-kpi-value`, `.finance-summary-card .profit-pos`, `.register-crop-summary .muted` …) ja `@media` reeglid nende klasside kohta, mis seavad välimust, kontrolli: `grep -n "finance-kpi-card\|trip-tile\|register-crop-summary" src/index.css`; meedia-reeglist kustuta ainult taust/ääris/nurk/polster.

- [ ] **Step 3: Kontrollid**. `grep -n "\-\-card-bg" src/index.css` → 0. Oodatav „Vanu kaarte“ ≈ **28** (−7 css).
- [ ] **Step 4: Commit + release** — `git commit -m "refactor(ui): KPI- ja statistikaplaadid ui Card tile peale (parandab valged plaadid tumedas)"`.
- [ ] **Step 5: Ekraanipildid** (mõlemad teemad):
  - Põllutööd → finantsi aken → tulemuste sakk (4 KPI plaati, kasumi/kahjumi toon, kokkuvõte, olekuriba). **Tumedas: plaadid tumedad, mitte valged.**
  - Saagipartii dialoog (`grep -n "<HarvestLotDialog\|HarvestLotsPanel" src/components` → avamise koht), plaadid.
  - Tehnika → sõidud → ava sõit (`TripDialog`, plaadid 4→2 veergu).
  - Põllukultuuride registri kokkuvõte (`grep -n "<FieldManagerModal" src` → avamise koht).
  - Tehnika → haakeriistad (`imp-status-box`), seadmed (`dev-telemetry-summary`).

---

### Task 5: Sektsioonikastid

**Files:**
- Modify: `src/components/SupportAccessPanel.tsx` (~49)
- Modify: `src/components/FieldWorksBoard.tsx` (~1194 `fw-plan-section`)
- Modify: `src/components/FieldBookUploadModal.tsx` (~159), `FieldUploadModal.tsx` (~237), `SoilSampleUploadModal.tsx` (~148) — `parsed-preview-box`
- Modify: `src/components/WeatherView.tsx` (~149–150 `weather-chart-card`)
- Modify: `src/index.css` (`.support-panel`, `.fw-plan-section`, `.parsed-preview-box`, `.weather-chart-card`)

**Interfaces:**
- Consumes: `Card` (Task 1).

- [ ] **Step 1: JSX**

```tsx
<Card asChild variant="tile" className="support-panel"><section>…</section></Card>
<Card asChild variant="tile" padding="sm" className="fw-plan-section"><section>…</section></Card>
<Card variant="tile" padding="sm" className="parsed-preview-box">…</Card>          {/* ×3 */}
<Card variant="tile" padding="none" className="weather-chart-card">…</Card>        {/* ×2 */}
```
(`support-panel` polster md 16px.)

- [ ] **Step 2: CSS**

```css
.support-panel {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fw-plan-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.parsed-preview-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Graafiku kast: oma polster (graafik vajab all vähem ruumi), välimus Card tile-ist */
.weather-chart-card { padding: 8px 10px 4px; min-width: 0; }
```
`.parsed-preview-box .operator-field` ja `.support-panel-*` alamreeglid jäävad.

- [ ] **Step 3: Kontrollid**. Oodatav „Vanu kaarte“ ≈ **24** (−4 css; ülejäänud: 19 admin tsx + 2 login tsx + 2 admin.css + `.glass-card`).
- [ ] **Step 4: Commit + release** — `git commit -m "refactor(ui): sektsioonikastid ui Card tile peale"`.
- [ ] **Step 5: Ekraanipildid** (mõlemad teemad):
  - Kasutajamenüü → kasutajate haldus (`grep -n "<UsersAdminModal" src` → avamine) → tugiligipääsu paneel.
  - Põllutööd → plaani sektsioon (`fw-plan-section` — ava töö, mille paneelis see on; `grep -n "fw-plan-section" -B20 src/components/FieldWorksBoard.tsx` näitab tingimuse).
  - Üleslaadimise dialoog (põllud / põlluraamat / mullaproovid) eelvaatega — kui faili pole võimalik ette anda, kirjuta raportisse, et eelvaade jäi pildistamata.
  - Ilm: `--do 'click:.main-view-switch >> text=Ilm'` — graafikukastid.

---

### Task 6: Admin ja sisselogimine

**Files:**
- Modify: `src/admin/AdminApp.tsx` (~95), `AiInstructionsView.tsx` (~36, ~40), `CatalogView.tsx` (~113, ~220, ~434 `admin-subform`; ~547), `DevicesView.tsx` (~45), `HelpView.tsx` (~101, ~137), `InterestView.tsx` (~46), `LandingStatsView.tsx` (~51; ~76–92 `admin-stat`), `LoginView.tsx` (~27), `NewTenantForm.tsx` (~60), `TenantsView.tsx` (~26), `TenantDetail.tsx` (~122, 139, 166, 186, 224, 229), `WeatherAdminView.tsx` (~45)
- Modify: `src/admin/admin.css` (`.admin-card`, `.admin-login`, `.admin-subform`, `.admin-stat`)
- Modify: `src/components/LoginPage.tsx` (~43), `src/components/SetPasswordPage.tsx` (~51), `src/index.css` (`.login-page .login-card.glass-card`)
- Modify: `scripts/shot.mts` (`--anon`, `--platform`)

**Interfaces:**
- Consumes: `Card` (Task 1); import adminis `import { Card } from '../components/ui';`.
- Produces: `shot.mts --anon` (ilma sessioonita, nt sisselogimisleht) ja `shot.mts --platform <kasutajanimi|*>` (teenusepakkuja sessioon, aadress `https://admin.teris.ee`).

- [ ] **Step 1: shot.mts laiendus**

Argumentide juurde (enne `steps`):

```ts
const platformArg = opt('platform');
const anonIdx = args.indexOf('--anon');
const anon = anonIdx !== -1;
if (anon) args.splice(anonIdx, 1);
```
`base` asenda:
```ts
// --platform: teenusepakkuja admin (admin.teris.ee) — server tunneb selle ära Host-päise järgi, seega avalik aadress.
const base = platformArg
  ? `https://${process.env.PLATFORM_HOST ?? 'admin.teris.ee'}`
  : `http://127.0.0.1:${process.env.PORT ?? '8820'}`;
```
Kontroll `if (!userArg)` → `if (!userArg && !platformArg && !anon)` (sõnum: `Puudub --user <e-post|kasutajanimi>, --platform <kasutajanimi|*> või --anon`).
Sessiooni loomine (asendab praeguse `user`/`session` ploki):
```ts
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
let cookieName = 'teris_session';
let removeSession = async () => {};
if (platformArg && !anon) {
  const pu = await db.platformUser.findFirst({
    where: { isActive: true, ...(platformArg === '*' ? {} : { username: platformArg.toLowerCase() }) },
  });
  if (!pu) {
    console.error(`Aktiivset teenusepakkuja kasutajat ${platformArg} ei leitud`);
    await db.$disconnect();
    process.exit(1);
  }
  const ps = await db.platformSession.create({
    data: { platformUserId: pu.id, tokenHash, expiresAt, userAgent: 'teris-shot (visuaalne kontroll)' },
  });
  cookieName = '__Host-teris_platform_session';
  removeSession = async () => { await db.platformSession.delete({ where: { id: ps.id } }).catch(() => {}); };
} else if (!anon) {
  const user = await db.user.findFirst({ where: { OR: [{ email: userArg }, { username: userArg }], isActive: true } });
  if (!user) {
    console.error(`Aktiivset kasutajat ${userArg} ei leitud`);
    await db.$disconnect();
    process.exit(1);
  }
  const session = await db.session.create({
    data: { userId: user.id, tokenHash, expiresAt, userAgent: 'teris-shot (visuaalne kontroll)' },
  });
  removeSession = async () => { await db.session.delete({ where: { id: session.id } }).catch(() => {}); };
}
```
Küpsis: `await ctx.addCookies([{ name: 'teris_session', value: token, url: base }]);` → `if (!anon) await ctx.addCookies([{ name: cookieName, value: token, url: base, secure: base.startsWith('https') }]);`. `finally` plokis `await db.session.delete(…)` → `await removeSession();`. Päise kommentaari kasutusrida täienda (`[--anon | --platform <kasutajanimi|*>]`).
Kontrolli, et `hashToken` (`src/server/auth.ts`) on sha256 hex (sama mis praegu); kui ei, kasuta seda funktsiooni. Kui serverist `https://admin.teris.ee` ei vasta, lisa `chromium.launch({ args: ['--host-resolver-rules=MAP admin.teris.ee 127.0.0.1'] })` ainult `--platform` korral ja kirjelda raportis.

- [ ] **Step 2: Admin JSX**

| Enne | Pärast |
|---|---|
| `<div className="glass-card admin-card">` (ja `admin-card admin-help-list`, `admin-help-editor`) | `<Card className="admin-card">` (lisaklassid jäävad) |
| `<div className="glass-card admin-card admin-danger-card">` | `<Card className="admin-card admin-danger-card">` |
| `<form className="glass-card admin-card admin-form" onSubmit={submit}>` (NewTenantForm) | `<Card asChild className="admin-card"><form className="admin-form" onSubmit={submit}>…</form></Card>` |
| `<form className="glass-card admin-card" onSubmit={…}>` (TenantDetail ~166) | `<Card asChild className="admin-card"><form onSubmit={…}>…</form></Card>` |
| `<form className="glass-card admin-login admin-form" onSubmit={submit}>` (LoginView) | `<Card asChild className="admin-login"><form className="admin-form" onSubmit={submit}>…</form></Card>` |
| `<form className="admin-form admin-subform" onSubmit={submit}>` (×3) | `<Card asChild variant="tile" padding="sm" className="admin-subform"><form className="admin-form" onSubmit={submit}>…</form></Card>` |
| `<div className="admin-stat">` (×4) | `<Card variant="tile" padding="sm" className="admin-stat">` |
| `AiInstructionsView` ~36 `return <div className="glass-card admin-card">{error \|\| 'Laen…'}</div>;` | `return <Card className="admin-card">{error \|\| 'Laen…'}</Card>;` |

`admin-card-head`, `admin-card-foot`, `admin-card h2/h3` jäävad (admin-pealkirjad ja jalus on asetus).

- [ ] **Step 3: admin.css** (kihistamata — võidab utiliite, seepärast eemalda dubleeruv):

```css
.admin-card { margin-bottom: 16px; }
.admin-login { max-width: 380px; margin: 12vh auto 0; }
.admin-subform { margin-bottom: 12px; }
.admin-stat { display: flex; flex-direction: column; gap: 2px; }
```
`.admin-danger-card { border-color: … }` jääb (kihistamata võidab ilma `!important`-ita).

- [ ] **Step 4: Rakenduse sisselogimine (legacy erijuhtum)**

`LoginPage.tsx` ja `SetPasswordPage.tsx`: `className="login-card glass-card"` → `className="login-card"`.
`index.css`: selektor `.login-page .login-card.glass-card` → `.login-page .login-card` ja lisa reeglisse `border-radius: var(--radius-lg);` (varem tuli `.glass-card`-ist). Kommentaar reegli kohale: `/* Sisselogimise kaart: oma välimus fotol (etapp 2.7 erand, ei kasuta ui Card-i) */`. Välimus (gradient, blur, ääris, vari) ei muutu.

- [ ] **Step 5: Kontrollid**. `grep -rn "glass-card" src --include='*.tsx'` → 0 (zsh: `grep -rn glass-card src | grep tsx`). Oodatav „Vanu kaarte“ = **1** (ainult `.glass-card` reegel `index.css`-is).
- [ ] **Step 6: Commit + release** — `git commit -m "refactor(ui): admin kaardid ui Card-ile; sisselogimise kaart ilma glass-card klassita; shot.mts --anon ja --platform"`.
- [ ] **Step 7: Ekraanipildid** (mõlemad teemad):
  - `npx tsx scripts/shot.mts --anon /login` — sisselogimise kaart nagu enne (kreemjas, ümar 16px).
  - `npx tsx scripts/shot.mts --platform '*' --height 2400 /` — ettevõtete loend; `--do 'click:.admin-nav button:nth-child(2)'` (kataloog: `admin-subform` plaadid), `nth-child(7)` (Landing: `admin-stat` plaadid), esimene ettevõte (`--do 'click:<tabelirida>'` → `TenantDetail`, sh punane ohukaart).
  - Admini sisselogimisvaade (`LoginView`, `admin-login`): `npx tsx scripts/shot.mts --platform '*' --anon /` — `--platform` valib aadressi `https://admin.teris.ee`, `--anon` jätab sessiooni ja küpsise loomata, seega avaneb sisselogimisvaade. (`--anon` üksi läheb localhosti, mis pole platvormi host — sobib ainult rakenduse `/login`-ile.)
  - Kontrolli: admin-kaardid tahked, 16px, ühtlane vari; plaadid 10px `bg-muted`; tumedas teemas loetavad.

---

### Task 7: Koristus, README, audit 0

**Files:**
- Modify: `src/index.css` (`.glass-card` reegel; 26 surnud klassi + 3 variatsiooni)
- Modify: `src/components/ui/README.md`

**Interfaces:**
- Consumes: kõik eelnev. Produces: lõppseis.

- [ ] **Step 1: Kustuta `.glass-card`** reegel `index.css`-ist (koos kommentaariga). `grep -rn "glass-card" src scripts index.html admin.html` → ainult `uiAudit.ts`/test/README.
- [ ] **Step 2: Kustuta surnud klassid** (inventuur jaotis 4). Enne iga kustutamist kontrolli kasutust: `grep -rnw "<klass>" src scripts index.html admin.html landing.html | grep -v "index.css"` → 0, ja mallstringid `grep -rn '\${' src | grep "<klassi eesliide>"`. Kustutatavad reeglid (ka nende järglas-, hover- ja meediareeglid):
  `dev-card-footer`, `drawer-title-group`, `edit-card-header`, `field-card-actions`, `field-card-main-row`, `field-edit-season-card`, `field-op-summary`, `fw-group-action-btn`, `fw-group-kind-label`, `fw-group-meta`, `header-button-group`, `header-stats`, `kpi-card`, `kpi-label`, `kpi-value`, `kpi-sub`, `layer-box-group`, `layer-text-wrap`, `legend-title-group`, `master-field-card`, `season-form-card`, `stat-icon` (+ `.stat-icon.work-icon`, `.stat-icon.tech-icon`, `.stat-icon.poi-icon`), `stat-label-with-year`, `stat-progress-bar`, `status-idling`, `year-widget-footer`.
  Kui mõni neist osutub kasutatuks, jäta alles ja kirjelda raportis.
  Pärast: CSS-i sulgude tasakaal — `node -e "const s=require('fs').readFileSync('src/index.css','utf8');console.log((s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"` → võrdsed.
- [ ] **Step 3: README** — jaotises „Kaart“ lisa rida: `- Vana `.glass-card` on kustutatud (etapp 2.7); uut klaasikaarti ei tehta.` ja kontrolli, et erandite loetelu vastab tegelikkusele (Task 2–6 raportid).
- [ ] **Step 4: Kontrollid** — `npm run ui-audit -- --details`: „Vanu kaarte (tsx+css, sh admin)“ = **0**; teised read („Vanu menüüsid/hüpikuid“ jt) ei tõusnud. `npx vitest run src/tooling src/components/ui` PASS, tsc 0.
- [ ] **Step 5: Commit + release** — `git commit -m "refactor(ui): vana glass-card ja surnud kaardiklassid välja; kaartide audit 0"`.
- [ ] **Step 6: Ekraanipildid — kokkuvõtlik ring** (mõlemad teemad): `/ui` (`--height 4000`), `/` (kaart, ujuvpaneelid), Tehnika, Põllutööd (+ finantsi tulemused), Ilm, Isikud; admin `--platform '*'` ettevõtete loend ja Landing. Raporti lõppu **kasutaja visuaalse kontrolli nimekiri**: kaardivaade (paneelid tahked — kas kaart paistab piisavalt), finantsi KPI tumedas, sõidukikaardi valik, admin.

---

## Self-review

- **Spec / otsused:** tahke taust (Task 1 token + `.glass-card` kohe tahkeks, Task 2 ujuvpaneelid, Task 7 kustutus) ✔; nurgad 16/10 (`cardVariants` + test) ✔; vari card/dialog/none (test) ✔; login-card legacy (Task 6 Step 4) ✔; admin-login/admin-card → Card (Task 6) ✔; `--card-bg` (Task 4, `grep` kontroll) ✔; polster 12/16 (`padding` sm/md; `none` ainult väikeste kaardinäitude ja graafikukasti jaoks oma polstriga) ✔; 26 surnud klassi (Task 7) ✔; asetus jääb vaateklassi (iga CSS samm) ✔; audit rida + algtase + 0 (Task 1, 7) ✔; galerii (Task 1) ✔; ekraanipildid igas ülesandes ✔.
- **Tüübid:** `Card` prop'id (`variant`, `padding`, `interactive`, `selected`, `asChild`), `CardHeader align`, `CardTitle as`, `CardActions`, `legacyCardRules`, `legacyCardFiles`, `LEGACY_CARD_CLASSES` — sama nimi kõigis ülesannetes.
- **Auditi arvutus:** 41 tsx (`glass-card`: rakendus 22, admin 19) + 25 CSS-reeglit (index.css 23, admin.css 2) = 66 → T2 52 → T3 35 → T4 28 → T5 24 → T6 1 → T7 0.
