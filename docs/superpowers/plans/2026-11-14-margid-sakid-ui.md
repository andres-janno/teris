# Etapp 2.4 — märgid ja sakid ui/Badge, ui/Tabs ja ui/ToggleGroup peale (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik 73 märki ja 19 saki-/valikurida (vt inventuur) kasutavad ühist `ui/Badge`, `ui/Tabs` või uut `ui/ToggleGroup`-i; vanad märgi-, pilli-, saki- ja segmendiklassid kaovad `index.css`-ist.

**Architecture:** `ui/Badge` saab kuju (`variant`: soft/solid/outline), suuruse (`size`: sm/md) ja olekupunkti (`dot`, ka andmevärviga). `ui/Tabs` parandatakse (keelatud sakk jääb hõljutatavaks, rida murdub). Uus `ui/ToggleGroup` (Radix ToggleGroup, ühe valikuga) on aasta valiku ja filtrinuppude jaoks — samad klassid mis segmenteeritud sakkidel. Üleminek käib failiperede kaupa; iga ülesanne = commit + release.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Radix (`radix-ui`: Tabs, ToggleGroup), cva, Vitest (node env).

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md (3. osa, samm 2.4). Inventuur: docs/superpowers/plans/2026-11-14-margid-sakid-inventuur.md (märgid M#1–73 = jaotis 2, sakid S#1–21 = jaotis 3).

## Global Constraints

- Keskkond: kohalik kaust on sshfs-mount. Faile muuda mount'i kaudu; **git, npm, npx ainult serveris**: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`.
- Töö käib otse `master`-is. Iga ülesanne = commit(id) + release: `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?`, siis `systemctl is-active teris` → `active`.
- Kontrollid enne commit'i: `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run src/tooling src/components/ui`; `npx oxlint <muudetud failid>`; `npm run ui-audit -- --details`.
- Identifikaatorid inglise keeles; kommentaarid ja UI-tekst eesti keeles. Commit-sõnumid eesti keeles.
- Vaate failides (väljaspool `src/components/ui/`) **Tailwindi klasse ei kasutata** (Tailwind skaneerib ainult `ui/`-d) — ka mitte `text-emerald-600` jms; need ei tööta.
- `src/index.css` on kaskaadikihis `legacy` (enne `utilities`): ui utiliidid võidavad vana mitte-`!important` reegli.
- Kasutaja otsused (2026-11-14): **päris sakid** (paneeli vahetavad: tehnika leht, artiklite leht, finantsid) = **allajoonitud** (`Tabs variant="line"`). **Aasta valik ja filtrinupud** = **üks nupurida halli raamiga, murdub** (`ToggleGroup`). **Täisvärv jääb** rõhutatud olekutele (lõpetatud, kinnitatud, aktiivne, haagitud, ootel kannete arv) = `variant="solid"`. **Finantside kandeliigid** = neutraalne märk + liigi ikoon (7 omavärvi kaovad).
- Kontrolleri otsused (vastuolud inventuuris): renditud = `info` mõlemas kohas (`tenure-badge` ja `cad-tenure-tag`); „Põhiladu“ = `info`; „Mitteaktiivne“ = `neutral`; kasutaja „Parool vahetamata“ (praegu oranž) = `warning`; masina `idling` = `warning`, `offline` ja `stopped` = `neutral`.
- Ulatusest väljas: `src/admin/`, `src/landing/`; inventuuri jaotis 4 (legendid, punktid, KPI-nupud `reg-stat-pill`/`register-crop-stat`, kaardi HTML-stringid `status-tag`/MapMarkers, Header navigatsioon, `basemap-btn` LayerControl'is).

## ui API (T1 loob, T2–T5 kasutavad)

| Komponent | Prop'id |
|---|---|
| `Badge` | `tone?: 'success' \| 'info' \| 'warning' \| 'danger' \| 'accent' \| 'neutral'` (vaikimisi neutral); `variant?: 'soft' \| 'solid' \| 'outline'` (vaikimisi soft); `size?: 'sm' \| 'md'` (vaikimisi sm = 11px; md = 12px, kõrgem); `dot?: boolean \| string` (olekupunkt ees; string = punkti värv andmetest, nt kultuuri värv); lapsed (ikoon + tekst) |
| `Tabs` (`variant="line"`) | Radix: `value`, `onValueChange`; `TabsList`, `TabsTrigger value disabled` (lapsed: tekst, ikoon, `<Badge>` loendur); `TabsContent` **valikuline** — kui paneeli paigutus sõltub otsesest flex-lapsest (täislehe `scroll="fill"` tabelid), jäta paneelide tingimuslik renderdus alles ja kasuta ainult `TabsList`-i |
| `ToggleGroup` | `value: string`, `onValueChange: (value: string) => void` (tühjaks ei lähe — klõps aktiivsel ei tühista), `aria-label` (kohustuslik), `disabled?`; `ToggleGroupItem value disabled title` (lapsed: tekst, ikoon, `<Lock size={10}/>`, `<Badge>`) |

Toonide kaart (vanad klassid → `Badge`):

| Vana | Uus |
|---|---|
| `status-badge status-working` / `-moving` / `-idling` / `-stopped` / `-offline` | `tone` success / info / warning / neutral / neutral |
| `fleet-active-badge` (+ punkt) | `tone="success" dot` |
| `active-pill` | `tone="success" variant="solid"` |
| `user-status-pill status-active/-invited/-pending/-inactive` (+ punkt) | `dot`, tone success / warning / warning / danger |
| `fw-status-pill` planned / in_progress / done / unplanned | neutral / success / success `solid` / warning |
| `fw-finance-chip` pending / confirmed / changed | warning / success `solid` / info (klõpsatav variant: `Badge` `<button>`-i sees, vt T3) |
| `support-panel-status[.is-active]` | neutral / success |
| `stock-shortage-badge` | `tone="danger" variant="outline"` |
| `users-admin-badge` („Põhiladu“ / „Mitteaktiivne“) | info / neutral |
| `article-default-badge`, `mini-badge`, `finance-year-badge`, `crop-group-count`, `count-pill`, `usage-count-badge`, `year-widget-stat`, `sub-tag` | neutral |
| `sub-tag winter-tag` | info |
| `tenure-badge` / `cad-tenure-tag` owned / rented / mixed / unknown | success / info / warning / neutral |
| `finance-count-badge[.all-done]` | neutral / success |
| `finance-tab-badge` | `tone="warning" variant="solid"` |
| `field-num-badge`, `finance-field-badge` | `tone="success" variant="outline" size="md"` |
| `field-code-badge` | info |
| `equipment-tag` (+ ikoon) | neutral `size="md"` |
| `weather-credential-ok/-missing` | success / warning |
| `season-status-badge` (`SEASON_PHASE_META`), `work-phase-badge` (`WORK_PHASE_META`), rolli `sub-tag` (`PARTY_ROLE_CONFIG`) | meta-objektile lisatakse väli `tone`; `color`/`bg` jäävad, kui neid kasutatakse mujal (kaart, värvitekst) |
| `finance-kind-badge` (`LINE_KIND_INFO`) | neutral + liigi ikoon (kasutaja otsus) |
| `finance-crop-pill` | neutral + `dot={kultuuri värv}` |
| `telemetry-pill-impl` / `-time` / `-action` (valitud) / „(haakeriist puudub)“ | info / success (+ Clock) / success (valitud `solid`) / danger |

## Üleminekuretsept (T2–T5)

```tsx
// enne
<span className={`status-badge status-${v.status}`}>{label}</span>
<span className="users-admin-badge">Mitteaktiivne</span>
<div className="category-filter-tabs">
  {tabs.map((t) => (
    <button key={t.id} className={`filter-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
      {t.label} <span className="count-pill">{t.count}</span>
    </button>
  ))}
</div>
<div className="year-tabs">
  {years.map((y) => (
    <button key={y} className={`year-tab ${y === year ? 'active' : ''} ${locked(y) ? 'locked' : ''}`} onClick={() => setYear(y)}>
      {y}{locked(y) && <Lock size={10} className="tab-lock-icon" />}
    </button>
  ))}
</div>

// pärast
<Badge tone={STATUS_TONE[v.status]}>{label}</Badge>
<Badge>Mitteaktiivne</Badge>
<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
  <TabsList>
    {tabs.map((t) => (
      <TabsTrigger key={t.id} value={t.id}>{t.label} <Badge>{t.count}</Badge></TabsTrigger>
    ))}
  </TabsList>
</Tabs>
<ToggleGroup aria-label="Hooaasta" value={String(year)} onValueChange={(v) => setYear(Number(v))}>
  {years.map((y) => (
    <ToggleGroupItem key={y} value={String(y)} title={locked(y) ? 'Hooaeg on lukus' : undefined}>
      {y}{locked(y) && <Lock size={10} />}
    </ToggleGroupItem>
  ))}
</ToggleGroup>
```

Reeglid:
1. **Märk:** toon toonide kaardist; olekuklassi koostamine andmest (`status-${…}`) → väike kaardistus-objekt `Record<…, BadgeTone>` faili ülaosas (või meta-objekti `tone` väli). Punkti/ikooni span'id (`user-status-dot`, `fleet-active-dot`) kaovad → `dot`. Lucide-ikoon jääb lapseks (`size={12}`).
2. **Klõpsatav märk** (`fw-finance-chip.clickable`): `<button>` jääb (vaate oma klass paigutuseks/hover'iks), sees `<Badge>`; nupu stiilid ainult paigutus (taust/ääris ära, ühtib märgiga). Või `ui/Button variant="ghost" size="sm"` + Badge — vali see, mis säilitab tabeli rea kõrguse, ja kirjuta raportisse.
3. **Päris sakk** (paneel vahetub): `Tabs variant="line"` (vaikimisi) + `TabsList` + `TabsTrigger`; loendur = `<Badge>{n}</Badge>` (ootel = `tone="warning" variant="solid"`); emoji siltides võib jääda. `role="tablist"` käsitsi ära (Radix annab). Paneelide tingimuslik renderdus jääb (vt API: `TabsContent` valikuline).
4. **Aasta valik / filter / valik** (paneel ei vahetu): `ToggleGroup` + `ToggleGroupItem`; väärtused stringina (`String(year)`, `Number(v)` tagasi); `aria-label` eesti keeles; keelatud valik `disabled`; loendur tekstis `(n)` jääb või `<Badge>`; lukk `<Lock size={10} />` lapseks (`tab-lock-icon`/`pill-lock-icon` klass ära).
5. **Meta-objektid** (`WORK_PHASE_META`, `SEASON_PHASE_META`, `PARTY_ROLE_CONFIG`): lisa iga kirje juurde `tone: BadgeTone` (tüüp `import type { BadgeTone } from '../components/ui'`); `color`/`bg` jäävad alles, kui grep näitab muud kasutust (nt `FieldWorksBoard.tsx:1170`, `AddFieldWorkDialog.tsx:104` kasutavad `WORK_PHASE_META.color`); muidu kustuta.
6. Vaate failis ei ole ühtegi vana märgi-/saki-/segmendiklassi — ui-audit rida „Vanu märke/sakke (tsx)“ selle faili jaoks 0.
7. Komponendid imporditakse `./ui` (või `../ui`) kaudu.

---

### Task 1: ui/Badge kujud, ui/Tabs parandus, ui/ToggleGroup, mõõdik, näidised

**Files:**
- Modify: `src/components/ui/variants.ts` (`badgeVariants`, `tabsListVariants`, `tabsTriggerVariants`), `src/components/ui/Badge.tsx`, `src/components/ui/index.ts`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`, `src/tooling/uiAudit.ts`, `scripts/ui-audit.mts`
- Create: `src/components/ui/ToggleGroup.tsx`
- Test: `src/components/ui/variants.test.ts`, `src/tooling/uiAudit.test.ts`

**Interfaces:**
- Produces: API tabel ülal; `variants.ts`: `badgeVariants({ tone, variant, size })`, `BadgeTone` tüüp; `ToggleGroup`, `ToggleGroupItem`; `uiAudit.ts`: `auditTsx().legacyBadgeTabs: string[]`, `AuditReport.legacyBadgeTabFiles`; CLI rida „Vanu märke/sakke (tsx)“.

- [ ] **Step 1: Kirjuta testid** — `src/components/ui/variants.test.ts` lõppu:

```ts
describe('märk', () => {
  it('soft on vaikimisi, solid on täisvärv valge tekstiga', () => {
    expect(v.badgeVariants({ tone: 'success' })).toContain('bg-primary/15');
    const solid = v.badgeVariants({ tone: 'success', variant: 'solid' });
    expect(solid).toContain('bg-primary');
    expect(solid).toContain('text-white');
    expect(solid).not.toContain('bg-primary/15');
  });
  it('outline: ääris toonivärviga, taust popover', () => {
    const c = v.badgeVariants({ tone: 'success', variant: 'outline' });
    expect(c).toContain('border-primary');
    expect(c).toContain('bg-popover');
  });
  it('suurus md on suurem kiri', () => {
    expect(v.badgeVariants({})).toContain('text-2xs');
    expect(v.badgeVariants({ size: 'md' })).toContain('text-xs');
    expect(v.badgeVariants({ size: 'md' })).not.toContain('text-2xs');
  });
});

describe('sakk ja valikurida', () => {
  it('keelatud sakk jääb hõljutatavaks, hover ainult lubatul', () => {
    const c = v.tabsTriggerVariants();
    expect(c).toContain('enabled:hover:text-foreground');
    expect(c).not.toContain('disabled:pointer-events-none');
    expect(c).toContain('disabled:cursor-not-allowed');
    expect(c).toContain('shrink-0');
  });
  it('segmenteeritud: aktiivne nii saki (active) kui valiku (on) olekus, rida murdub', () => {
    const c = v.tabsTriggerVariants({ variant: 'segmented' });
    expect(c).toContain('data-[state=active]:bg-card');
    expect(c).toContain('data-[state=on]:bg-card');
    expect(v.tabsListVariants({ variant: 'segmented' })).toContain('flex-wrap');
    expect(v.tabsListVariants({ variant: 'line' })).toContain('flex-wrap');
  });
});
```

`allClassStrings()`-is asenda märgirida:

```ts
  ...(['success', 'info', 'warning', 'danger', 'accent', 'neutral'] as const).flatMap((tone) =>
    (['soft', 'solid', 'outline'] as const).flatMap((variant) =>
      (['sm', 'md'] as const).map((size) => v.badgeVariants({ tone, variant, size }))
    )
  ),
```

`src/tooling/uiAudit.test.ts` lõppu:

```ts
describe('auditTsx: vanad märgid ja sakid', () => {
  it('loeb vanad märgi-, saki- ja segmendiklassid', () => {
    const r = auditTsx(
      '<div className="category-filter-tabs"><button className="filter-tab active">A <span className="count-pill">2</span></button></div><span className="status-badge status-working" /><div className="year-tabs"><button className="year-tab" /></div>'
    );
    expect(r.legacyBadgeTabs).toEqual(['category-filter-tabs', 'filter-tab', 'count-pill', 'status-badge', 'year-tabs', 'year-tab']);
  });
  it('ei loe ui komponente ega sarnaseid nimesid', () => {
    expect(auditTsx('<Badge tone="success" /><TabsTrigger value="a" /><span className="fw-status-dot" />').legacyBadgeTabs).toEqual([]);
  });
  it('summarize jätab ui kausta välja', () => {
    const r = summarize([
      { path: 'src/components/ui/UiGallery.tsx', content: 'className="mini-badge"' },
      { path: 'src/components/X.tsx', content: 'className="mini-badge"' },
    ]);
    expect(r.legacyBadgeTabFiles).toEqual([{ path: 'src/components/X.tsx', count: 1 }]);
  });
});
```

- [ ] **Step 2: Käivita, peab kukkuma** — `npx vitest run src/tooling src/components/ui` → FAIL.

- [ ] **Step 3: variants.ts** — asenda `badgeVariants`, `tabsListVariants`, `tabsTriggerVariants`:

```ts
export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'accent' | 'neutral';

// Märk: soft (hele toon, vaikimisi), solid (täisvärv — rõhutatud olek, kasutaja otsus 2026-11-14), outline (ääris).
export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold', {
  variants: {
    tone: { success: '', info: '', warning: '', danger: '', accent: '', neutral: '' },
    variant: { soft: 'border-transparent', solid: 'border-transparent text-white', outline: 'bg-popover text-foreground' },
    size: { sm: 'px-2 py-0.5 text-2xs', md: 'px-2.5 py-1 text-xs' },
  },
  compoundVariants: [
    { variant: 'soft', tone: 'success', class: 'bg-primary/15 text-primary' },
    { variant: 'soft', tone: 'info', class: 'bg-info/15 text-info' },
    { variant: 'soft', tone: 'warning', class: 'bg-warning/15 text-warning' },
    { variant: 'soft', tone: 'danger', class: 'bg-destructive/15 text-destructive' },
    { variant: 'soft', tone: 'accent', class: 'bg-accent/15 text-accent' },
    { variant: 'soft', tone: 'neutral', class: 'bg-muted text-muted-foreground' },
    { variant: 'solid', tone: 'success', class: 'bg-primary' },
    { variant: 'solid', tone: 'info', class: 'bg-info' },
    { variant: 'solid', tone: 'warning', class: 'bg-warning' },
    { variant: 'solid', tone: 'danger', class: 'bg-danger-solid' },
    { variant: 'solid', tone: 'accent', class: 'bg-accent' },
    { variant: 'solid', tone: 'neutral', class: 'bg-muted-foreground' },
    { variant: 'outline', tone: 'success', class: 'border-primary' },
    { variant: 'outline', tone: 'info', class: 'border-info' },
    { variant: 'outline', tone: 'warning', class: 'border-warning' },
    { variant: 'outline', tone: 'danger', class: 'border-destructive text-destructive' },
    { variant: 'outline', tone: 'accent', class: 'border-accent' },
    { variant: 'outline', tone: 'neutral', class: 'border-border' },
  ],
  defaultVariants: { tone: 'neutral', variant: 'soft', size: 'sm' },
});

// Rida murdub (aastaid ja gruppe võib olla palju). Segmenteeritud = ka ToggleGroup'i raam.
export const tabsListVariants = cva('inline-flex max-w-full flex-wrap items-center', {
  variants: {
    variant: {
      line: 'gap-1 border-b border-border',
      segmented: 'gap-0.5 rounded-md bg-muted p-0.5',
    },
  },
  defaultVariants: { variant: 'line' },
});

// Keelatud sakk/valik jääb hõljutatavaks (vihjetekst) — enabled:hover, mitte disabled:pointer-events-none.
// Aktiivne: Radix Tabs data-state=active, Radix ToggleGroup data-state=on.
export const tabsTriggerVariants = cva(
  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-muted-foreground transition-colors cursor-pointer enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        line: '-mb-px border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground',
        segmented:
          'rounded-sm px-2.5 py-1 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm',
      },
    },
    defaultVariants: { variant: 'line' },
  }
);
```

- [ ] **Step 4: Badge.tsx** — asenda:

```tsx
// src/components/ui/Badge.tsx — olekumärk (asendab badge-, pill- ja tag-klassid). dot = olekupunkt;
// string-väärtus = punkti värv andmetest (nt kultuuri värv).
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { badgeVariants } from './variants';

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean | string };

export const Badge: React.FC<BadgeProps> = ({ className, tone, variant, size, dot, children, ...props }) => (
  <span className={cn(badgeVariants({ tone, variant, size }), className)} {...props}>
    {dot && (
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', typeof dot === 'string' ? undefined : 'bg-current')}
        style={typeof dot === 'string' ? { background: dot } : undefined}
      />
    )}
    {children}
  </span>
);
```

- [ ] **Step 5: ToggleGroup.tsx** — loo:

```tsx
// src/components/ui/ToggleGroup.tsx — ühe valikuga nupurida (aasta valik, filtrid; kasutaja otsus 2026-11-14:
// üks hall raam, rida murdub). Sama välimus mis segmenteeritud sakkidel. Klõps aktiivsel ei tühista valikut.
import React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cn } from './cn';
import { tabsListVariants, tabsTriggerVariants } from './variants';

type ToggleGroupProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive.Root>,
  'type' | 'value' | 'defaultValue' | 'onValueChange'
> & { value: string; onValueChange: (value: string) => void; 'aria-label': string };

export const ToggleGroup: React.FC<ToggleGroupProps> = ({ className, value, onValueChange, ...props }) => (
  <ToggleGroupPrimitive.Root
    type="single"
    value={value}
    onValueChange={(next: string) => { if (next) onValueChange(next); }}
    className={cn(tabsListVariants({ variant: 'segmented' }), className)}
    {...props}
  />
);

export const ToggleGroupItem: React.FC<React.ComponentProps<typeof ToggleGroupPrimitive.Item>> = ({ className, ...props }) => (
  <ToggleGroupPrimitive.Item className={cn(tabsTriggerVariants({ variant: 'segmented' }), className)} {...props} />
);
```

`index.ts`: `export { ToggleGroup, ToggleGroupItem } from './ToggleGroup';` ja `export type { BadgeTone } from './variants';` (kui `variants` tüüpe veel ei ekspordita).

- [ ] **Step 6: uiAudit.ts** — `LEGACY_TABLE` järele:

```ts
// Vanad märgi-, saki- ja segmendiklassid (etapp 2.4). ui/ kausta ei loeta.
const LEGACY_BADGE_TAB =
  /(?<![\w-])(status-badge|fleet-active-badge|active-pill|user-status-pill|user-status-dot|fw-status-pill|fw-finance-chip|season-status-badge|work-phase-badge|support-panel-status|stock-shortage-badge|users-admin-badge|article-default-badge|tenure-badge|cad-tenure-tag|weather-credential-ok|weather-credential-missing|count-pill|finance-count-badge|finance-tab-badge|crop-group-count|usage-count-badge|finance-year-badge|mini-badge|badge-list|sub-tag|winter-tag|field-num-badge|finance-field-badge|field-code-badge|equipment-tag|finance-kind-badge|finance-crop-pill|year-widget-stat|telemetry-pill-impl|telemetry-pill-time|telemetry-pill-action|category-filter-tabs|filter-tab|year-tabs|year-tab|work-register-tabs|finance-filter-chips|finance-filter-chip|segmented-control|segmented-option|cc-segmented|year-widget-pills|year-widget-btn|area-preset-btn|tab-lock-icon|pill-lock-icon)(?![\w-])/g;
```

`AuditReport`: `legacyBadgeTabFiles: { path: string; count: number }[];`. `auditTsx`: `legacyBadgeTabs: [...src.matchAll(LEGACY_BADGE_TAB)].map((m) => m[1]),`. `summarize`:

```ts
    legacyBadgeTabFiles: tsx
      .filter((t) => t.legacyBadgeTabs.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyBadgeTabs.length })),
```

`scripts/ui-audit.mts` tabelirea järele:

```ts
row(
  'Vanu märke/sakke (tsx)',
  r.legacyBadgeTabFiles.reduce((s, f) => s + f.count, 0),
  r.legacyBadgeTabFiles.map((f) => `${f.path}: ${f.count}`)
);
```

- [ ] **Step 7: Testid** → PASS. `npm run ui-audit -- --details` → raportisse „Vanu märke/sakke (tsx)“ baas failide kaupa. Kui `satellite-product-row`/`basemap-btn` (SatellitePanel S#17) ei ole loenduris — õige (basemap-btn on ka LayerControl'is, mis jääb); T2 viib SatellitePanel'i siiski üle.

- [ ] **Step 8: UiGallery** — märgid: iga toon × soft/solid/outline (üks rida toonide kaupa), `size="md"`, `dot`, `dot="#e11d48"`, ikooniga (`<Clock size={12} />`); sakid: `Tabs` line kolme sakiga, üks loenduriga (`<Badge tone="warning" variant="solid">3</Badge>`), üks `disabled`; `ToggleGroup` aastatega (üks lukuga `<Lock size={10} />`, üks `disabled`) ja `aria-label="Hooaasta"`. Kasuta lokaalset `useState`.

- [ ] **Step 9: README** — Badge (tone/variant/size/dot, toonide kaart lühidalt, „andmevärv ainult punktina“), Tabs (ainult paneeli vahetavad sakid, `TabsContent` valikuline), ToggleGroup (aasta valik, filtrid, vormi valik; `aria-label` kohustuslik).

- [ ] **Step 10:** tsc, vitest, oxlint. Commit `feat(ui): Badge kujud ja suurused, ToggleGroup, sakkide hover/keelatud parandus; ui-audit loeb vanu märke ja sakke`. Release.

---

### Task 2: Tehnika

**Files (Modify):** `src/components/VehicleTracker.tsx` (M#1, 2, 5, 6, 31–35, 65, 66; S#1, S#14), `src/components/DeviceAssignmentRegister.tsx` (M#3; S#18), `src/components/TripRegister.tsx` (M#4), `src/components/CultivationControl.tsx` (S#15, S#16), `src/components/SatellitePanel.tsx` (S#17), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - S#1 peasakid: `Tabs` line; loendurid `<Badge>`; nähtavus `telemetryEnabled` järgi jääb; `activeTab` muutus käivitab praegu `closeForm()` + laadimise — tee seda `onValueChange`-is.
  - S#14 seadme tüüp (vormiväli): `ToggleGroup` `aria-label="Seadme tüüp"`, ikoonid lastena.
  - S#15/16 `cc-segmented` (kaardi juhtpaneel, oma kõrgus `--cc-h`): `ToggleGroup`; kui juhtpaneeli kõrgus peab jääma, anna vaate klass `className`-iga **ainult kõrguse jaoks** (`.cc-toggle { height: var(--cc-h) }` + `!important`, kui utiliit võidab) — kirjuta raportisse.
  - S#17 satelliidi toode: `ToggleGroup` (`aria-label="Satelliidi toode"`); `basemap-btn` LayerControl'is jääb puutumata.
  - S#18 seoste filter (`ui/Button`-id): `ToggleGroup`.
  - M#65/66 `equipment-tag`: `Badge size="md"` + ikoon; teksti ellips (`tag-text`) — kui pikk nimi peab lõikuma, jäta `tag-text` span lapseks (sisuklass), raportisse.
- [ ] **Step 2:** Kontrollid, audit — nende failide loendur 0. Commit `refactor(ui): tehnika märgid, sakid ja valikud ui peale`. Release.

---

### Task 3: Tööd ja finantsid

**Files (Modify):** `src/components/FieldWorksBoard.tsx` (M#11–14, 38, 52; S#7), `src/components/FinanceModal.tsx` (M#15, 16, 28, 37, 41, 54, 55, 67, 68; S#3, S#13), `src/components/WorkRegisterModal.tsx` (M#18 PhaseBadge, 23, 64), `src/types/fieldWork.ts` (`WORK_PHASE_META` + `tone`), `src/components/SeasonManagerModal.tsx` (M#17), `src/types/season.ts` (`SEASON_PHASE_META` + `tone`), `src/components/FieldWorkEntryDialog.tsx` (M#70–73; S#21), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - `WORK_PHASE_META`: PREPARATION info, SOWING success, CARE accent, HARVEST warning. `PhaseBadge` = `<Badge tone={WORK_PHASE_META[phase].tone}>`. `color` jääb (FieldWorksBoard:1170, AddFieldWorkDialog:104 kasutavad).
  - `SEASON_PHASE_META`: vali tooni tähenduse järgi (avamata neutral, …); `title` selgitus jääb; raportisse kaart.
  - S#3 finantsid: `Tabs` line kahe sakiga; ootel loendur `<Badge tone="warning" variant="solid">`; käsitsi `role`/`aria-selected` ära.
  - S#13 Ootab/Kõik/Kinnitatud: `ToggleGroup aria-label="Kannete olek"`.
  - S#7 tööde tahvli aasta valik: `ToggleGroup` (täislehe `fw-toolbar` kontekstireeglid `year-tabs` jaoks muutuvad surnuks — T6).
  - M#13 klõpsatav `fw-finance-chip`: retsept p 2.
  - M#67 kandeliik: `<Badge><Icon size={12} />{info.label}</Badge>` neutral; `LINE_KIND_INFO` värvid ära, kui muud kasutust pole.
  - M#68 kultuur: `<Badge dot={r.cropColor}>{r.cropName}</Badge>`.
  - M#38 `finance-tab-badge` `ui/Button` sees: `<Badge tone="warning" variant="solid">`.
  - M#71 „(haakeriist puudub)“: inline `#ef4444` ära → `tone="danger"`.
  - S#21 pindala presetid (`area-preset-btn`, `disabled={isExceeded}`): `ToggleGroup aria-label="Pindala osa"`; kui eelseadistus pole püsiv valik (klõps täidab välja, aktiivne = väärtus võrdub), arvuta `value` välja väärtusest ja kirjuta raportisse.
- [ ] **Step 2:** Kontrollid, audit — loendur 0. Commit `refactor(ui): tööde ja finantside märgid, sakid ja valikud ui peale`. Release.

---

### Task 4: Põllud, registrid, kaart

**Files (Modify):** `src/components/FieldManagerModal.tsx` (M#50, 56, 61, 62; S#6), `src/components/FieldsTableView.tsx` (M#26, 53, 57; S#8, S#11), `src/components/FieldMapCard.tsx` (M#51), `src/components/FieldEditDialog.tsx` (M#27), `src/components/CropRegisterModal.tsx` (M#39, 58–60; S#5), `src/components/RelatedPartiesModal.tsx` (M#40, 63), `src/types/party.ts` (`PARTY_ROLE_CONFIG` + `tone`), `src/components/MapYearSelector.tsx` (M#69; S#9), `src/components/PoiManagerModal.tsx` (M#36; S#12), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - `field-num-badge` (M#50–53): `tone="success" variant="outline" size="md"`; `FieldMapCard` on kaardi kaardi sees (Leaflet) — kontrolli, et komponent on React (mitte HTML-string).
  - `tenure-badge`/`cad-tenure-tag`: kontrolleri otsus rented = info.
  - `PARTY_ROLE_CONFIG`: lisa `tone`; `color` jääb, kui `RelatedPartiesModal.tsx:520` (`accent`) seda kasutab.
  - S#9 kaardi aastavidin (`year-widget-pills` grid): `ToggleGroup` (kasutaja otsus: üks murduv rida) — vidina laius piirab rida, murdub.
  - S#11 omandifilter, S#12 POI kategooria: `ToggleGroup`; keelatud valik `disabled`.
  - `sub-tag` lisaklassid `owner-tag`/`soil-tag`/`spring-tag` (CSS-ita) kaovad.
  - `reg-stat-pill`/`register-crop-stat` (S#19, S#20) **jäävad** (ulatusest väljas).
- [ ] **Step 2:** Kontrollid, audit — loendur 0. Commit `refactor(ui): põldude ja registrite märgid ning aasta valikud ui peale`. Release.

---

### Task 5: Laoseis, kasutajad, üleslaadimised

**Files (Modify):** `src/components/ArticlesView.tsx` (M#24, 25; S#2, S#4, S#10), `src/components/StockDocumentsPanel.tsx` (M#20), `src/components/WarehousesPanel.tsx` (M#21, 22), `src/components/UsersAdminModal.tsx` (M#7–10), `src/components/SupportAccessPanel.tsx` (M#19), `src/components/WeatherCredentialModal.tsx` (M#29), `src/components/FieldUploadModal.tsx` (M#42–45), `src/components/SoilSampleUploadModal.tsx` (M#46–49), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - S#2 artiklite peasakid: `Tabs` line; „Saagipartiid“ ainult `canManageFinance` korral.
  - S#4 aasta valik, S#10 grupi filter (keelatud kui 0): `ToggleGroup`.
  - `user-status-pill` (+ punkt): `Badge dot` toonidega toonide kaardist.
  - `users-admin-badge`: „Põhiladu“ info, „Mitteaktiivne“ neutral (kontrolleri otsus).
  - `mini-badge` + `badge-list`: `Badge` neutral; `badge-list` konteiner → vaate paigutusklass (flex gap), kui vaja.
  - `weather-credential-ok/-missing` (praegu ainult tekstivärv): `Badge` success / warning.
- [ ] **Step 2:** Kontrollid, audit — „Vanu märke/sakke (tsx)“ = 0 kogu rakenduses. Commit `refactor(ui): laoseisu, kasutajate ja üleslaadimiste märgid ning sakid ui peale`. Release.

---

### Task 6: Koristus — vanad märgi- ja sakireeglid index.css-ist välja

**Files:** Modify `src/index.css`

- [ ] **Step 1:** `npm run ui-audit -- --details` — „Vanu märke/sakke (tsx)“ = 0. Kui mitte, ära jätka; raporteeri.
- [ ] **Step 2: Kustuta** kõik `LEGACY_BADGE_TAB` regexi klasside reeglid (sh `:hover`, `.active`, `[data-theme=dark]`, kontekstireeglid nagu `.fullpage-board-body .year-tabs`, `.fw-toolbar .year-tabs`, `.filter-tab.active .count-pill`, `.status-working/-moving/…` **ainult** `status-badge` kontekstis — MapMarkers kasutab `.status-working` jt markeritel, need jäävad!). Iga kustutuse eel `grep -rn "<klass>" src --include=*.tsx --include=*.ts | grep -v src/admin | grep -v tooling` tühi. Kustuta ka `.user-status-dot`, `.fleet-active-dot`, `.tab-lock-icon`, `.pill-lock-icon`, `.year-active-tag`.
- [ ] **Step 3: Surnud CSS** inventuuri jaotisest 6 (iga eel grep tühi).
- [ ] **Step 4:** Release; `npm run ui-audit` uus baas raportisse (sh „Vanu komponendiklasse (CSS)“, index.css read enne/pärast). tsc, vitest. Commit `refactor(ui): vanad märgi- ja sakireeglid välja index.css-ist`. Release.
- [ ] **Step 5: Kasutaja visuaalne kontroll** (mõlemas teemas): tehnika lehe sakid ja loendurid, masina olek, seadme „Aktiivne“; artiklite sakid ja grupi filter; finantside sakid, ootel loendur, kandeliigid ikoonidega, kultuuri punkt; tööde tahvli olekud (Lõpetatud täisroheline), finantsmärgi klõps; hooaasta valik 5 vaates (lukk, murdumine); kaardi aastavidin; kasutajate olekud; põllu nr märk; kaardi juhtpaneeli režiim ja kiirus; satelliidi toode.
