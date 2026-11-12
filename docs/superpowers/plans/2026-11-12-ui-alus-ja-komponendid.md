# UI ühtlustamine, etapp 1: alus ja komponendid — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tuua projekti Tailwind v4 + Radix + shadcn-stiilis `ui/` komponendid, mõõtmisskript ja näidiste leht nii, et olemasolev rakendus ei muutu visuaalselt.

**Architecture:** `src/styles/app.css` asendab `index.css`-i otseimpordi: see paneb Leafleti CSS-i kihti `vendor`, `index.css`-i kihti `legacy` ja Tailwindi utiliidid kihti `utilities` (preflight jääb välja). Tailwindi teema (`@theme inline`) seob skaalad ja tähenduspõhised värvinimed praeguste CSS-muutujatega, nii et hele/tume teema töötab ilma `dark:` klassideta. Komponendid on `src/components/ui/`, kõik variandiklassid ühes testitud failis `variants.ts`.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, Vitest (node keskkond).

**Spec:** `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md`

## Global Constraints

- Kirjasuurused ainult: `text-2xs` 11px, `text-xs` 12px, `text-sm` 13px, `text-base` 14px, `text-lg` 16px, `text-xl` 20px.
- Vahed ainult: 2, 4, 6, 8, 10, 12, 16, 24, 32 px (`0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8`).
- Nurgad ainult: `rounded-sm` 6px, `rounded-md` 10px, `rounded-lg` 16px, `rounded-full`.
- Suvalised väärtused (`text-[…]`, `p-[…]`, `m-[…]`, `gap-[…]`, `rounded-[…]`, `bg-[…]`, `border-[…]`) keelatud; suuruste (`w-[…]`, `max-h-[…]`) ja olekuvariantide (`data-[state=open]:`) jaoks lubatud.
- Identiteet säilib: roheline põhivärv, klaasikaardid, hele + tume teema (`:root[data-theme="dark"]`).
- Identifikaatorid (failid, klassid, propid) inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- Kuupäevad UI-s pp.kk.aaaa; numbrid paremale joondatud.
- Kõik `git`/`npm`/`npx` käsud serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'` (kohalik kaust on sshfs-mount). Allpool tähistatud `SRV '…'`.
- Iga ülesanne lõpeb commit + release'iga. Release: `SRV 'npm run release > /tmp/rel.log 2>&1; echo EXIT=$?'`; kui `EXIT=134`, korda `NODE_OPTIONS=--max-old-space-size=1500 npm run release …`; seejärel `SRV 'systemctl is-active teris && tail -5 /tmp/rel.log'`.
- Commit-sõnumi lõpus: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/styles/app.css` (uus) | kihtide järjekord, Tailwindi import, teema (skaalad + värvinimed) |
| `src/main.tsx` | impordib `./styles/app.css` (mitte `./index.css`) |
| `src/components/MapView.tsx` | eemaldab `leaflet.css` impordi (läheb `app.css`-i kihti `vendor`) |
| `vite.config.ts` | `tailwindcss()` plugin |
| `src/tooling/uiAudit.ts` (+ `.test.ts`) | mõõtmise puhtad funktsioonid |
| `scripts/ui-audit.mts` | CLI: loeb failid, prindib aruande |
| `src/components/ui/cn.ts` (+ `.test.ts`) | klasside liitmine, `text-2xs` tunnustatud |
| `src/components/ui/variants.ts` (+ `.test.ts`) | kõik variandiklassid (nupp, märk, sakid, väli, menüü, hüpik) |
| `src/components/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Table.tsx` | baaskomponendid |
| `src/components/ui/Input.tsx`, `Select.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`, `Field.tsx` | vormiväljad |
| `src/components/ui/Dialog.tsx`, `Tabs.tsx`, `Menu.tsx`, `Popover.tsx` | Radixi peal kihid |
| `src/components/ui/index.ts` | ühine eksport |
| `src/components/ui/UiGallery.tsx` | näidiste leht `/ui` (ainult admin) |
| `src/components/ui/README.md` | kasutusreeglid |
| `src/AuthGate.tsx` | `/ui` marsruut adminile |

---

### Task 1: Tailwindi alus ilma nähtava muutuseta

**Files:**
- Create: `src/styles/app.css`
- Modify: `src/main.tsx:3`, `src/components/MapView.tsx:4`, `vite.config.ts`, `package.json` (npm install)

**Interfaces:**
- Produces: Tailwindi utiliidid nimedega `bg-background`, `bg-card`, `bg-card-hover`, `bg-popover`, `bg-muted`, `bg-muted-hover`, `bg-field`, `bg-secondary`, `bg-secondary-hover`, `bg-overlay`, `text-foreground`, `text-muted-foreground`, `text-subtle`, `border-border`, `border-input`, `border-secondary-border`, `primary`, `primary-strong`, `primary-from`, `primary-to`, `info`, `warning`, `destructive`, `danger-solid`, `accent`, `white`, `black`; `shadow-card`, `shadow-dialog`, `shadow-primary`, `shadow-primary-hover`; skaalad Global Constraints'ist; variant `dark:`.

- [ ] **Step 1: Paigalda paketid**

Run: `SRV 'npm install tailwindcss @tailwindcss/vite radix-ui class-variance-authority clsx tailwind-merge'`
Expected: lõpeb vigadeta, `package.json` `dependencies` all 6 uut kirjet.

- [ ] **Step 2: Loo `src/styles/app.css`**

```css
/* src/styles/app.css — rakenduse stiilide sisenemispunkt.
   Kihid: kihistamata CSS võidaks alati kihis olevat, seega vana index.css on kihis `legacy`
   (enne `utilities`-t), muidu ei mõjuks ükski Tailwindi vahe (index.css: `* { margin: 0; padding: 0 }`).
   Leaflet on `legacy` ees, et index.css-i Leafleti ülekirjutused jääksid kehtima.
   Preflight (Tailwindi vaikestiilid) jäetakse teadlikult välja. */
@layer theme, base, vendor, legacy, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'leaflet/dist/leaflet.css' layer(vendor);
@import '../index.css' layer(legacy);
@import 'tailwindcss/utilities.css' layer(utilities);

/* Tume teema: <html data-theme="dark"> (App.tsx). Tavaliselt pole vaja — värvinimed vahetuvad ise. */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* Skaalad (spec 1. osa). Vaikeskaalad nullitakse, et suvalist suurust/värvi ei saaks kasutada. */
@theme {
  --text-*: initial;
  --text-2xs: 11px;
  --text-2xs--line-height: 16px;
  --text-xs: 12px;
  --text-xs--line-height: 16px;
  --text-sm: 13px;
  --text-sm--line-height: 18px;
  --text-base: 14px;
  --text-base--line-height: 20px;
  --text-lg: 16px;
  --text-lg--line-height: 22px;
  --text-xl: 20px;
  --text-xl--line-height: 28px;

  --radius-*: initial;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  --shadow-primary: 0 4px 14px rgba(34, 197, 94, 0.35);
  --shadow-primary-hover: 0 6px 20px rgba(34, 197, 94, 0.5);
}

/* Tähenduspõhised värvid — viitavad index.css-i muutujatele, seega järgivad heledat/tumedat teemat.
   `inline`: utiliit kasutab otse var(--…) väärtust (teema vahetus töötab). Nimed ei tohi kattuda
   index.css-i muutujatega (nt --shadow-glass), muidu tekiks tsükkel. */
@theme inline {
  --color-*: initial;
  --color-white: #ffffff;
  --color-black: #000000;

  --color-background: var(--bg-dark);
  --color-foreground: var(--text-primary);
  --color-card: var(--bg-card);
  --color-card-hover: var(--bg-card-hover);
  --color-popover: var(--bg-modal);
  --color-muted: var(--stat-bg);
  --color-muted-hover: var(--stat-bg-hover);
  --color-muted-foreground: var(--text-secondary);
  --color-subtle: var(--text-muted);
  --color-border: var(--border-card);
  --color-input: var(--input-border);
  --color-field: var(--input-bg);
  --color-secondary: var(--btn-sec-bg);
  --color-secondary-hover: var(--btn-sec-hover);
  --color-secondary-border: var(--btn-sec-border);
  --color-overlay: rgba(5, 8, 15, 0.6);

  --color-primary: var(--emerald-500);
  --color-primary-strong: var(--emerald-600);
  /* Põhinupu gradient on mõlemas teemas sama (nagu praegune .btn-primary) */
  --color-primary-from: #16a34a;
  --color-primary-to: #22c55e;
  --color-info: var(--blue-500);
  --color-warning: var(--amber-500);
  --color-destructive: var(--rose-500);
  --color-danger-solid: #dc2626;
  --color-accent: var(--purple-500);

  --shadow-card: var(--shadow-glass);
  --shadow-dialog: var(--shadow-modal);
}
```

- [ ] **Step 3: Vaheta impordid ja lisa plugin**

`src/main.tsx` rida 3: `import './index.css'` → `import './styles/app.css'`

`src/components/MapView.tsx` rida 4: kustuta `import 'leaflet/dist/leaflet.css';` (nüüd `app.css`-is).

`vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite';
// …
  plugins: [react(), tailwindcss(), dbApiPlugin(), landingHtmlPlugin()],
```

`src/admin/main.tsx` ei muutu (admin ei kasuta Tailwindi; impordib `../index.css` otse nagu enne).

- [ ] **Step 4: Ehita ja kontrolli kihte**

Run: `SRV 'npx tsc --noEmit -p tsconfig.app.json && npx vite build 2>&1 | tail -5 && F=$(grep -l "@layer legacy" dist/assets/*.css) && echo "$F" && grep -o "@layer [a-z, ]*" $F | sort | uniq -c && grep -c "leaflet-container" $F'`
Expected: build õnnestub; leitakse täpselt üks CSS-fail; väljundis on `@layer theme, base, vendor, legacy, components, utilities` ning `@layer legacy` ja `@layer vendor` plokid; `leaflet-container` loendus ≥ 1 (Leafleti CSS on endiselt kimbus).

- [ ] **Step 5: Commit + release**

```bash
SRV 'git add package.json package-lock.json vite.config.ts src/styles/app.css src/main.tsx src/components/MapView.tsx && git commit -m "feat(ui): Tailwind v4 alus kihtidega (vendor/legacy/utilities), teema seotud praeguste muutujatega

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release (vt Global Constraints).

- [ ] **Step 6: Visuaalne kontroll kasutajaga**

Palu kasutajal live'is üle vaadata mõlemas teemas: kaart (põllud, hüpik, kihtide nupud), mõni dialoog (nt põllu muutmine), tööde tabel, sisselogimisleht. Oodatav: muutust pole. Kui midagi nihkus, on põhjus peaaegu kindlasti kihtide järjekord (kihistamata CSS — nt mõne komponendi oma `<style>` — võidab nüüd `legacy`-t); leia reegel ja paranda enne järgmist ülesannet.

---

### Task 2: Mõõtmisskript `ui-audit`

**Files:**
- Create: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts`
- Modify: `package.json` (`scripts.ui-audit`)

**Interfaces:**
- Produces:
  - `auditCss(css: string): { fontSizes: string[]; radii: string[]; spacing: string[]; colors: string[] }`
  - `auditTsx(src: string): { inlineStyles: number; colors: number; arbitrary: string[] }`
  - `summarize(files: { path: string; content: string }[]): AuditReport`
  - `interface AuditReport { fontSizes: string[]; radii: string[]; spacing: string[]; cssColors: string[]; inlineStyles: number; tsxColors: number; arbitrary: { path: string; cls: string }[] }`
  - käsk `npm run ui-audit` (lisaks `-- --details`)

- [ ] **Step 1: Kirjuta testid**

`src/tooling/uiAudit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { auditCss, auditTsx, summarize } from './uiAudit';

describe('auditCss', () => {
  it('kogub kirjasuurused, nurgad, vahed ja värvid', () => {
    const r = auditCss('.a{font-size:12px;padding:8px 10px;border-radius:6px;color:#fff}');
    expect(r.fontSizes).toEqual(['12px']);
    expect(r.spacing).toEqual(['8px', '10px']);
    expect(r.radii).toEqual(['6px']);
    expect(r.colors).toEqual(['#fff']);
  });
  it('vahedes ignoreerib 0, auto ja muutujaid', () => {
    expect(auditCss('.a{margin:0 auto;gap:var(--x);padding-left:0}').spacing).toEqual([]);
  });
  it('loeb ka margin-top ja column-gap', () => {
    expect(auditCss('.a{margin-top:-4px;column-gap:0.5rem}').spacing).toEqual(['-4px', '0.5rem']);
  });
});

describe('auditTsx', () => {
  it('loeb inline-stiilid, värvikoodid ja keelatud suvalised klassid', () => {
    const r = auditTsx(
      '<div style={{ a: 1 }} className="text-[13px] p-2 bg-[#fff] w-[min(640px,94vw)] data-[state=open]:bg-muted" color="#123456" />'
    );
    expect(r.inlineStyles).toBe(1);
    expect(r.arbitrary).toEqual(['text-[13px]', 'bg-[#fff]']);
    expect(r.colors).toBe(2);
  });
  it('loeb rgba ja rgb', () => {
    expect(auditTsx("const c = 'rgba(0,0,0,.5)'; const d = 'rgb(1,2,3)';").colors).toBe(2);
  });
});

describe('summarize', () => {
  it('ühendab failid ja eemaldab korduvad väärtused', () => {
    const r = summarize([
      { path: 'a.css', content: '.a{font-size:12px}' },
      { path: 'b.css', content: '.b{font-size:12px;font-size:13px}' },
      { path: 'c.tsx', content: '<p style={{}} className="m-[3px]" />' },
    ]);
    expect(r.fontSizes).toEqual(['12px', '13px']);
    expect(r.inlineStyles).toBe(1);
    expect(r.arbitrary).toEqual([{ path: 'c.tsx', cls: 'm-[3px]' }]);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `SRV 'npx vitest run src/tooling/uiAudit.test.ts'`
Expected: FAIL, `Failed to resolve import "./uiAudit"`.

- [ ] **Step 3: Kirjuta `src/tooling/uiAudit.ts`**

```ts
// src/tooling/uiAudit.ts — UI ühtlustamise mõõdik: mitu erinevat kirjasuurust, nurka, vahet ja värvikoodi on
// stiilides ning kui palju inline-stiile ja keelatud suvalisi Tailwindi väärtusi komponentides.
// Puhtad funktsioonid; failide lugemine on scripts/ui-audit.mts-is.

export interface AuditReport {
  fontSizes: string[];
  radii: string[];
  spacing: string[];
  cssColors: string[];
  inlineStyles: number;
  tsxColors: number;
  arbitrary: { path: string; cls: string }[];
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const SPACING_DECL =
  /(?:^|[\s;{])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)/g;
// Keelatud ainult skaalaga seotud suvalised väärtused; suurused (w-[…]) ja olekuvariandid (data-[…]:) on lubatud.
const ARBITRARY = /(?<![\w-])(?:text|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|rounded(?:-[a-z]{1,2})?|bg|border)-\[[^\]\s]*\]/g;

const values = (css: string, re: RegExp) => [...css.matchAll(re)].map((m) => m[1].trim());
const uniqueSorted = (list: string[]) => [...new Set(list)].sort();

export function auditCss(css: string) {
  const spacing = values(css, SPACING_DECL)
    .flatMap((v) => v.replace(/!important/, '').trim().split(/\s+/))
    .filter((t) => /^-?\d*\.?\d+(px|rem|em)$/.test(t) && parseFloat(t) !== 0);
  return {
    fontSizes: values(css, /font-size\s*:\s*([^;}]+)/g),
    radii: values(css, /border-radius\s*:\s*([^;}]+)/g),
    spacing,
    colors: css.match(HEX) ?? [],
  };
}

export function auditTsx(src: string) {
  return {
    inlineStyles: (src.match(/style=\{\{/g) ?? []).length,
    colors: (src.match(HEX) ?? []).length + (src.match(/rgba?\(/g) ?? []).length,
    arbitrary: src.match(ARBITRARY) ?? [],
  };
}

export function summarize(files: { path: string; content: string }[]): AuditReport {
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => auditCss(f.content));
  const tsx = files.filter((f) => f.path.endsWith('.tsx')).map((f) => ({ path: f.path, ...auditTsx(f.content) }));
  return {
    fontSizes: uniqueSorted(css.flatMap((c) => c.fontSizes)),
    radii: uniqueSorted(css.flatMap((c) => c.radii)),
    spacing: uniqueSorted(css.flatMap((c) => c.spacing)),
    cssColors: uniqueSorted(css.flatMap((c) => c.colors.map((x) => x.toLowerCase()))),
    inlineStyles: tsx.reduce((s, t) => s + t.inlineStyles, 0),
    tsxColors: tsx.reduce((s, t) => s + t.colors, 0),
    arbitrary: tsx.flatMap((t) => t.arbitrary.map((cls) => ({ path: t.path, cls }))),
  };
}
```

- [ ] **Step 4: Käivita testid — peavad läbima**

Run: `SRV 'npx vitest run src/tooling/uiAudit.test.ts'`
Expected: PASS (6 testi).

- [ ] **Step 5: CLI `scripts/ui-audit.mts`**

```ts
// scripts/ui-audit.mts — UI ühtlustamise mõõdik (spec: docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md).
// Käivitus: npm run ui-audit  (väärtuste loetelu: npm run ui-audit -- --details)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { summarize } from '../src/tooling/uiAudit.ts';

// Landing ja teenusepakkuja admin on eraldi lehed (ülemineku ulatusest väljas); styles/ on teema allikas.
const EXCLUDE = ['src/landing', 'src/admin', 'src/styles'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (EXCLUDE.some((e) => p.startsWith(e)) || name.startsWith('._')) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(css|tsx)$/.test(name) ? [p] : [];
  });
}

const files = walk('src').map((path) => ({ path, content: readFileSync(path, 'utf8') }));
const r = summarize(files);
const details = process.argv.includes('--details');
const row = (label: string, n: number, list?: string[]) =>
  console.log(`${label.padEnd(34)}${String(n).padStart(6)}${details && list ? `   ${list.join('  ')}` : ''}`);

row('Erinevaid kirjasuurusi (CSS)', r.fontSizes.length, r.fontSizes);
row('Erinevaid nurgaraadiusi (CSS)', r.radii.length, r.radii);
row('Erinevaid vahe-väärtusi (CSS)', r.spacing.length, r.spacing);
row('Erinevaid värvikoode (CSS)', r.cssColors.length, r.cssColors);
row('style={{…}} kohti (tsx)', r.inlineStyles);
row('Värvikoode/rgba (tsx)', r.tsxColors);
row('Keelatud suvalisi klasse (tsx)', r.arbitrary.length, r.arbitrary.map((a) => `${a.path}: ${a.cls}`));
```

`package.json` `scripts`: lisa `"ui-audit": "npx tsx scripts/ui-audit.mts",`

- [ ] **Step 6: Algnäit**

Run: `SRV 'npm run ui-audit'`
Expected: ligikaudu spec'i lähteseis (kirjasuurusi ~40, nurki ~22, värvikoode CSS ~90, `style={{` ~226, keelatud klasse 0). Kopeeri väljund commit-sõnumisse algnäiduks.

- [ ] **Step 7: Commit + release**

```bash
SRV 'git add src/tooling scripts/ui-audit.mts package.json && git commit -m "feat(ui): ui-audit mõõdik (kirjasuurused, nurgad, vahed, värvid, inline-stiilid)

Algnäit:
<kleebi Step 6 väljund>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release.

---

### Task 3: `cn()` ja variandiklassid

**Files:**
- Create: `src/components/ui/cn.ts`, `src/components/ui/cn.test.ts`, `src/components/ui/variants.ts`, `src/components/ui/variants.test.ts`

**Interfaces:**
- Consumes: Task 1 värvi- ja skaalanimed; Task 2 `auditTsx`.
- Produces:
  - `cn(...inputs: ClassValue[]): string`
  - `buttonVariants({ variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'|'icon-sm'|'icon' }): string` (vaikimisi `secondary`, `md`)
  - `badgeVariants({ tone?: 'success'|'info'|'warning'|'danger'|'accent'|'neutral' }): string` (vaikimisi `neutral`)
  - `tabsListVariants({ variant?: 'line'|'segmented' })`, `tabsTriggerVariants({ variant?: 'line'|'segmented' })`
  - konstandid `fieldControlClass`, `menuContentClass`, `menuItemClass`, `menuSeparatorClass`, `menuLabelClass`, `popoverContentClass`, `tooltipContentClass`, `cardClass`

- [ ] **Step 1: Testid**

`src/components/ui/cn.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('hilisem vahe asendab varasema', () => {
    expect(cn('px-2', 'px-3')).toBe('px-3');
  });
  it('text-2xs on kirjasuurus, mitte värv — ei kustu värviga koos', () => {
    expect(cn('text-2xs', 'text-foreground')).toBe('text-2xs text-foreground');
  });
  it('text-2xs asendab teise kirjasuuruse', () => {
    expect(cn('text-xs', 'text-2xs')).toBe('text-2xs');
  });
  it('jätab välja tühjad tingimused', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
```

`src/components/ui/variants.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { auditTsx } from '../../tooling/uiAudit';
import * as v from './variants';

const allClassStrings = (): string[] => [
  ...(['primary', 'secondary', 'ghost', 'danger'] as const).flatMap((variant) =>
    (['sm', 'md', 'icon-sm', 'icon'] as const).map((size) => v.buttonVariants({ variant, size }))
  ),
  ...(['success', 'info', 'warning', 'danger', 'accent', 'neutral'] as const).map((tone) => v.badgeVariants({ tone })),
  ...(['line', 'segmented'] as const).flatMap((variant) => [v.tabsListVariants({ variant }), v.tabsTriggerVariants({ variant })]),
  v.fieldControlClass, v.menuContentClass, v.menuItemClass, v.menuSeparatorClass, v.menuLabelClass,
  v.popoverContentClass, v.tooltipContentClass, v.cardClass,
];

describe('variants', () => {
  it('nupu vaikimisi on teisene, tavasuurus', () => {
    const c = v.buttonVariants();
    expect(c).toContain('bg-secondary');
    expect(c).toContain('h-8');
  });
  it('ohunupp väike', () => {
    const c = v.buttonVariants({ variant: 'danger', size: 'sm' });
    expect(c).toContain('bg-danger-solid');
    expect(c).toContain('h-7');
  });
  it('märgi toon määrab värvi', () => {
    expect(v.badgeVariants({ tone: 'warning' })).toContain('text-warning');
    expect(v.badgeVariants()).toContain('text-muted-foreground');
  });
  it('ükski variant ei kasuta keelatud suvalisi väärtusi', () => {
    for (const cls of allClassStrings()) expect(auditTsx(`className="${cls}"`).arbitrary).toEqual([]);
  });
  it('kirjasuurused ainult skaalast', () => {
    const sizes = allClassStrings().flatMap((c) => c.match(/(?<![\w-])text-[a-z0-9-]+/g) ?? []);
    const allowed = /^text-(2xs|xs|sm|base|lg|xl|foreground|muted-foreground|subtle|white|primary|info|warning|destructive|accent|background)$/;
    for (const s of sizes) expect(s).toMatch(allowed);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `SRV 'npx vitest run src/components/ui'`
Expected: FAIL, `Failed to resolve import "./cn"` / `"./variants"`.

- [ ] **Step 3: `src/components/ui/cn.ts`**

```ts
// src/components/ui/cn.ts — klasside liitmine: tingimuslikud klassid (clsx) + Tailwindi konfliktide lahendus.
// Meie kirjasuurus `text-2xs` pole Tailwindi vaikeskaalas — ilma laienduseta peaks tailwind-merge seda
// värviks ja kustutaks `text-foreground`-i kõrvalt.
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['2xs'] }] } },
});

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
```

- [ ] **Step 4: `src/components/ui/variants.ts`**

```ts
// src/components/ui/variants.ts — kõigi ühiste komponentide variandiklassid ühes kohas (testitud: ainult skaala
// väärtused, mitte suvalisi). Väärtused järgivad praegust identiteeti (.btn, .form-input, .modal-content index.css-is).
import { cva } from 'class-variance-authority';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold transition-all cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        primary:
          'bg-linear-135 from-primary-from to-primary-to text-white shadow-primary hover:from-primary-strong hover:to-primary-from hover:shadow-primary-hover hover:-translate-y-px',
        secondary: 'bg-secondary border-secondary-border text-foreground hover:bg-secondary-hover',
        ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
        danger: 'bg-danger-solid text-white hover:bg-danger-solid/90',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-8 px-4 text-sm',
        'icon-sm': 'size-7',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold',
  {
    variants: {
      tone: {
        success: 'bg-primary/15 text-primary',
        info: 'bg-info/15 text-info',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-destructive/15 text-destructive',
        accent: 'bg-accent/15 text-accent',
        neutral: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export const tabsListVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      line: 'gap-1 border-b border-border',
      segmented: 'gap-0.5 rounded-md bg-muted p-0.5',
    },
  },
  defaultVariants: { variant: 'line' },
});

export const tabsTriggerVariants = cva(
  `inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-muted-foreground transition-colors cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        line: '-mb-px border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground',
        segmented: 'rounded-sm px-2.5 py-1 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      },
    },
    defaultVariants: { variant: 'line' },
  }
);

/** Sisestusväljade (Input, Textarea, Select) ühine välimus; kõrguse/vahed lisab komponent. */
export const fieldControlClass =
  'w-full rounded-sm border border-input bg-field text-sm text-foreground placeholder:text-subtle transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';

/** Hüpikud on dialoogi (z 2000) kohal, et dialoogi sees avatud menüü oleks nähtav. */
export const menuContentClass =
  'z-2100 min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-dialog';
export const menuItemClass =
  'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
export const menuSeparatorClass = 'my-1 h-px bg-border';
export const menuLabelClass = 'px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-subtle';

export const popoverContentClass =
  'z-2100 w-72 rounded-md border border-border bg-popover p-3 text-sm text-foreground shadow-dialog outline-none';
export const tooltipContentClass = 'z-2100 max-w-72 rounded-sm bg-foreground px-2 py-1 text-xs text-background';

/** Klaasikaart (praegune .glass-card). */
export const cardClass = 'rounded-lg border border-border bg-card text-foreground shadow-card backdrop-blur-lg';
```

- [ ] **Step 5: Testid peavad läbima**

Run: `SRV 'npx vitest run src/components/ui && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS (9 testi), tsc vigadeta.

- [ ] **Step 6: Commit + release**

```bash
SRV 'git add src/components/ui && git commit -m "feat(ui): cn() ja ühiste komponentide variandiklassid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release.

---

### Task 4: Button, Badge, Card/Panel, Table

**Files:**
- Create: `src/components/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Table.tsx`, `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `cn`, `buttonVariants`, `badgeVariants`, `cardClass` (Task 3).
- Produces:
  - `Button(props: ComponentProps<'button'> & { variant?, size?, asChild?: boolean })` — `type` vaikimisi `"button"`
  - `Badge(props: ComponentProps<'span'> & { tone? })`
  - `Card(props: ComponentProps<'div'>)`, `Panel(props: { title: ReactNode; actions?: ReactNode; className?: string; bodyClassName?: string; children: ReactNode })`
  - `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow` (`selected?: boolean`), `TableHead` (`numeric?: boolean`), `TableCell` (`numeric?: boolean`)

Komponentidel DOM-teste pole (Vitest jookseb node-keskkonnas, `jsdom`/testing-library pole projektis); välimus kontrollitakse Task 7 näidiste lehel. Variandiloogika on Task 3-s testitud.

- [ ] **Step 1: `Button.tsx`**

```tsx
// src/components/ui/Button.tsx — ühine nupp (asendab .btn-* ja vaatepõhised nupuklassid).
import React from 'react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { buttonVariants } from './variants';

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renderda laps (nt <a>) nupu välimusega. */
    asChild?: boolean;
  };

export const Button: React.FC<ButtonProps> = ({ className, variant, size, asChild = false, type, ...props }) => {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
};
```

- [ ] **Step 2: `Badge.tsx`**

```tsx
// src/components/ui/Badge.tsx — olekumärk (asendab badge- ja pill-klassid).
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { badgeVariants } from './variants';

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export const Badge: React.FC<BadgeProps> = ({ className, tone, ...props }) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props} />
);
```

- [ ] **Step 3: `Card.tsx`**

```tsx
// src/components/ui/Card.tsx — klaasikaart ja päisega paneel.
import React from 'react';
import { cn } from './cn';
import { cardClass } from './variants';

export const Card: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn(cardClass, className)} {...props} />
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
  <section className={cn(cardClass, 'flex flex-col', className)}>
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
    <div className={cn('p-4', bodyClassName)}>{children}</div>
  </section>
);
```

- [ ] **Step 4: `Table.tsx`**

```tsx
// src/components/ui/Table.tsx — ühine tabel. Numbriveerg (numeric) joondub paremale; koguste vormindus
// (formatQty, 2 komakohta) jääb kutsuja teha.
import React from 'react';
import { cn } from './cn';

export const Table: React.FC<React.ComponentProps<'table'>> = ({ className, ...props }) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full border-collapse text-xs', className)} {...props} />
  </div>
);

export const TableHeader: React.FC<React.ComponentProps<'thead'>> = (props) => <thead {...props} />;
export const TableBody: React.FC<React.ComponentProps<'tbody'>> = (props) => <tbody {...props} />;
export const TableFooter: React.FC<React.ComponentProps<'tfoot'>> = ({ className, ...props }) => (
  <tfoot className={cn('bg-muted font-semibold', className)} {...props} />
);

export const TableRow: React.FC<React.ComponentProps<'tr'> & { selected?: boolean }> = ({ className, selected, ...props }) => (
  <tr
    data-selected={selected || undefined}
    className={cn('border-b border-border transition-colors hover:bg-muted data-[selected]:bg-primary/10', className)}
    {...props}
  />
);

export const TableHead: React.FC<React.ComponentProps<'th'> & { numeric?: boolean }> = ({ className, numeric, ...props }) => (
  <th
    className={cn(
      'whitespace-nowrap px-2.5 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground',
      numeric && 'text-right',
      className
    )}
    {...props}
  />
);

export const TableCell: React.FC<React.ComponentProps<'td'> & { numeric?: boolean }> = ({ className, numeric, ...props }) => (
  <td className={cn('px-2.5 py-1.5 align-middle', numeric && 'text-right tabular-nums', className)} {...props} />
);
```

- [ ] **Step 5: `index.ts`**

```ts
// src/components/ui/index.ts — ühiste komponentide eksport.
export { cn } from './cn';
export { Button, type ButtonProps } from './Button';
export { Badge, type BadgeProps } from './Badge';
export { Card, Panel } from './Card';
export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from './Table';
```

- [ ] **Step 6: Kontroll**

Run: `SRV 'npx tsc --noEmit -p tsconfig.app.json && npx oxlint src/components/ui && npm run ui-audit | tail -1'`
Expected: vigadeta; viimane rida `Keelatud suvalisi klasse (tsx)      0`.

- [ ] **Step 7: Commit + release**

```bash
SRV 'git add src/components/ui && git commit -m "feat(ui): Button, Badge, Card/Panel, Table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release.

---

### Task 5: Vormiväljad

**Files:**
- Create: `src/components/ui/Input.tsx`, `Select.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`, `Field.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `cn`, `fieldControlClass`, `menuContentClass`, `menuItemClass` (Task 3).
- Produces:
  - `Input(ComponentProps<'input'>)`, `Textarea(ComponentProps<'textarea'>)`
  - `interface SelectOption { value: string; label: string; disabled?: boolean }`
  - `Select(props: { value: string; onValueChange: (value: string) => void; options: SelectOption[]; placeholder?: string; disabled?: boolean; className?: string; id?: string; 'aria-label'?: string })` — `value === ''` tähendab „valimata“ (näitab placeholderit); valikute `value` ei tohi olla `''` (Radixi piirang)
  - `Checkbox(props: { checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean; id?: string; className?: string; 'aria-label'?: string })`
  - `RadioGroup(props: ComponentProps<typeof RadioGroupPrimitive.Root>)`, `RadioGroupItem(props: { value: string; id?: string; disabled?: boolean; className?: string })`
  - `Switch(props: { checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean; id?: string; className?: string; 'aria-label'?: string })`
  - `Field(props: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: ReactNode; className?: string; children: ReactNode })`

- [ ] **Step 1: `Input.tsx`**

```tsx
// src/components/ui/Input.tsx — tekstiväli ja mitmerealine väli (asendab .form-input).
// Kuupäeva jaoks kasuta DateInput-i (pp.kk.aaaa), arvu jaoks NumberInput-i.
import React from 'react';
import { cn } from './cn';
import { fieldControlClass } from './variants';

export const Input: React.FC<React.ComponentProps<'input'>> = ({ className, ...props }) => (
  <input className={cn(fieldControlClass, 'h-8 px-2.5', className)} {...props} />
);

export const Textarea: React.FC<React.ComponentProps<'textarea'>> = ({ className, ...props }) => (
  <textarea className={cn(fieldControlClass, 'min-h-16 px-2.5 py-1.5', className)} {...props} />
);
```

- [ ] **Step 2: `Select.tsx`**

```tsx
// src/components/ui/Select.tsx — valikukast ilma otsinguta. Otsinguga valik: FilterSelect.
import React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { fieldControlClass, menuContentClass, menuItemClass } from './variants';

export interface SelectOption {
  value: string; // ei tohi olla '' (Radix kasutab tühja väärtust „valimata“ tähenduses)
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string; // '' = valimata
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, options, placeholder = 'Vali…', disabled, className, id, ...aria }) => (
  <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
    <SelectPrimitive.Trigger
      id={id}
      aria-label={aria['aria-label']}
      className={cn(fieldControlClass, 'flex h-8 items-center justify-between gap-2 px-2.5 text-left data-[placeholder]:text-subtle', className)}
    >
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon>
        <ChevronDown size={14} className="text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={4} className={cn(menuContentClass, 'max-h-72 min-w-(--radix-select-trigger-width)')}>
        <SelectPrimitive.Viewport>
          {options.map((o) => (
            <SelectPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} className={cn(menuItemClass, 'pr-7 relative')}>
              <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                <Check size={14} className="text-primary" />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
```

- [ ] **Step 3: `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`**

```tsx
// src/components/ui/Checkbox.tsx — märkeruut.
import React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from './cn';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, className, ...props }) => (
  <CheckboxPrimitive.Root
    checked={checked}
    onCheckedChange={(c) => onCheckedChange(c === true)}
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-field text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check size={12} strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
```

```tsx
// src/components/ui/RadioGroup.tsx — raadionuppude rühm.
import React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from './cn';

export const RadioGroup: React.FC<React.ComponentProps<typeof RadioGroupPrimitive.Root>> = ({ className, ...props }) => (
  <RadioGroupPrimitive.Root className={cn('flex gap-3', className)} {...props} />
);

interface RadioGroupItemProps {
  value: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export const RadioGroupItem: React.FC<RadioGroupItemProps> = ({ className, ...props }) => (
  <RadioGroupPrimitive.Item
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-field cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary',
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="block size-2 rounded-full bg-primary" />
  </RadioGroupPrimitive.Item>
);
```

```tsx
// src/components/ui/Switch.tsx — lüliti (sees/väljas seaded).
import React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from './cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export const Switch: React.FC<SwitchProps> = ({ className, ...props }) => (
  <SwitchPrimitive.Root
    className={cn(
      'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" />
  </SwitchPrimitive.Root>
);
```

- [ ] **Step 4: `Field.tsx`**

```tsx
// src/components/ui/Field.tsx — välja silt + abitekst + veateade (ühtne vormide ladumine).
import React from 'react';
import { cn } from './cn';

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, className, children }) => (
  <div className={cn('flex flex-col gap-1', className)}>
    <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
      {label}
    </label>
    {children}
    {error ? (
      <p role="alert" className="text-2xs text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-subtle">{hint}</p>
    ) : null}
  </div>
);
```

- [ ] **Step 5: Lisa `index.ts`-i**

```ts
export { Input, Textarea } from './Input';
export { Select, type SelectOption } from './Select';
export { Checkbox } from './Checkbox';
export { RadioGroup, RadioGroupItem } from './RadioGroup';
export { Switch } from './Switch';
export { Field } from './Field';
```

- [ ] **Step 6: Kontroll**

Run: `SRV 'npx tsc --noEmit -p tsconfig.app.json && npx oxlint src/components/ui && npm run ui-audit | tail -1'`
Expected: vigadeta; keelatud klasse 0. (`min-w-(--radix-select-trigger-width)` on CSS-muutuja süntaks, mitte `-[`, ja on lubatud.)

- [ ] **Step 7: Commit + release**

```bash
SRV 'git add src/components/ui && git commit -m "feat(ui): vormiväljad (Input, Textarea, Select, Checkbox, RadioGroup, Switch, Field)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release.

---

### Task 6: Dialog, Tabs, menüüd, Popover, Tooltip

**Files:**
- Create: `src/components/ui/Dialog.tsx`, `Tabs.tsx`, `Menu.tsx`, `Popover.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `Button` (Task 4); `cn`, `tabsListVariants`, `tabsTriggerVariants`, `menu*Class`, `popoverContentClass`, `tooltipContentClass` (Task 3).
- Produces:
  - `Dialog` (= Radix Root: `open`, `onOpenChange`), `DialogTrigger`, `DialogClose`, `DialogContent({ size?: 'sm'|'md'|'lg', className, children })`, `DialogHeader({ title: ReactNode; description?: ReactNode; children?: ReactNode })`, `DialogBody`, `DialogFooter`
  - `Tabs` (Root, + `variant?: 'line'|'segmented'`), `TabsList`, `TabsTrigger`, `TabsContent`
  - `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem({ danger?: boolean })`, `DropdownMenuSeparator`, `DropdownMenuLabel`; samad `ContextMenu*` nimedega
  - `Popover`, `PopoverTrigger`, `PopoverContent`; `Tooltip({ content: ReactNode; side?: 'top'|'right'|'bottom'|'left'; children: ReactElement })`

Märkus: olemasolev imperatiivne `confirmDialog()` / `alertDialog()` (`src/components/ConfirmDialog.tsx`) jääb selles etapis puutumata; see viiakse `ui/Dialog` peale üleminekusammus „dialoogid“.

- [ ] **Step 1: `Dialog.tsx`**

```tsx
// src/components/ui/Dialog.tsx — ühine dialoog (asendab .modal-backdrop/.modal-content ja vaatepõhised modaalid).
// Radix hoolitseb fookuse lõksu, Esc sulgemise ja taustakerimise lukustuse eest.
import React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const WIDTHS = {
  sm: 'w-[min(420px,94vw)]',
  md: 'w-[min(640px,94vw)]',
  lg: 'w-[min(960px,96vw)]',
} as const;

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & { size?: keyof typeof WIDTHS };

export const DialogContent: React.FC<DialogContentProps> = ({ size = 'md', className, children, ...props }) => (
  <DialogPrimitive.Portal>
    {/* z 2000 nagu praegune .modal-backdrop — Leafleti kihtidest (≤1000) kõrgemal */}
    <DialogPrimitive.Overlay className="fixed inset-0 z-2000 bg-overlay backdrop-blur-sm" />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-2000 flex max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-popover text-foreground shadow-dialog focus:outline-none',
        WIDTHS[size],
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

interface DialogHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Lisanupud pealkirja ja sulgemisnupu vahel. */
  children?: React.ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ title, description, children }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
    <div className="min-w-0">
      <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
      {description && <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">{description}</DialogPrimitive.Description>}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {children}
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Sulge" title="Sulge">
          <X size={16} />
        </Button>
      </DialogPrimitive.Close>
    </div>
  </div>
);

export const DialogBody: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-4', className)} {...props} />
);

export const DialogFooter: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-end gap-2.5 border-t border-border px-6 py-3', className)} {...props} />
);
```

- [ ] **Step 2: `Tabs.tsx`**

```tsx
// src/components/ui/Tabs.tsx — sakid: `line` (allajoonitud) ja `segmented` (nupurühm).
import React, { createContext, useContext } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from './cn';
import { tabsListVariants, tabsTriggerVariants } from './variants';

type TabsVariant = 'line' | 'segmented';
const VariantContext = createContext<TabsVariant>('line');

type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root> & { variant?: TabsVariant };

export const Tabs: React.FC<TabsProps> = ({ variant = 'line', ...props }) => (
  <VariantContext.Provider value={variant}>
    <TabsPrimitive.Root {...props} />
  </VariantContext.Provider>
);

export const TabsList: React.FC<React.ComponentProps<typeof TabsPrimitive.List>> = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn(tabsListVariants({ variant: useContext(VariantContext) }), className)} {...props} />
);

export const TabsTrigger: React.FC<React.ComponentProps<typeof TabsPrimitive.Trigger>> = ({ className, ...props }) => (
  <TabsPrimitive.Trigger className={cn(tabsTriggerVariants({ variant: useContext(VariantContext) }), className)} {...props} />
);

export const TabsContent: React.FC<React.ComponentProps<typeof TabsPrimitive.Content>> = ({ className, ...props }) => (
  <TabsPrimitive.Content className={cn('focus-visible:outline-none', className)} {...props} />
);
```

- [ ] **Step 3: `Menu.tsx`**

```tsx
// src/components/ui/Menu.tsx — rippmenüü (nupu all) ja kontekstimenüü (paremklõps), sama välimusega.
import React from 'react';
import { ContextMenu as ContextMenuPrimitive, DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { cn } from './cn';
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from './variants';

type ItemExtra = { danger?: boolean };
const itemClass = (danger: boolean | undefined, className: string | undefined) =>
  cn(menuItemClass, danger && 'text-destructive', className);

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Content>> = ({ className, sideOffset = 4, ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content sideOffset={sideOffset} className={cn(menuContentClass, className)} {...props} />
  </DropdownMenuPrimitive.Portal>
);
export const DropdownMenuItem: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Item> & ItemExtra> = ({ className, danger, ...props }) => (
  <DropdownMenuPrimitive.Item className={itemClass(danger, className)} {...props} />
);
export const DropdownMenuSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <DropdownMenuPrimitive.Separator className={cn(menuSeparatorClass, className)} />
);
export const DropdownMenuLabel: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Label>> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Label className={cn(menuLabelClass, className)} {...props} />
);

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuContent: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Content>> = ({ className, ...props }) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content className={cn(menuContentClass, className)} {...props} />
  </ContextMenuPrimitive.Portal>
);
export const ContextMenuItem: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Item> & ItemExtra> = ({ className, danger, ...props }) => (
  <ContextMenuPrimitive.Item className={itemClass(danger, className)} {...props} />
);
export const ContextMenuSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <ContextMenuPrimitive.Separator className={cn(menuSeparatorClass, className)} />
);
export const ContextMenuLabel: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Label>> = ({ className, ...props }) => (
  <ContextMenuPrimitive.Label className={cn(menuLabelClass, className)} {...props} />
);
```

- [ ] **Step 4: `Popover.tsx`**

```tsx
// src/components/ui/Popover.tsx — hüpik (klõpsuga) ja vihje (hõljumisel).
import React from 'react';
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from './cn';
import { popoverContentClass, tooltipContentClass } from './variants';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverContent: React.FC<React.ComponentProps<typeof PopoverPrimitive.Content>> = ({ className, sideOffset = 6, align = 'start', ...props }) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content sideOffset={sideOffset} align={align} className={cn(popoverContentClass, className)} {...props} />
  </PopoverPrimitive.Portal>
);

interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Üks element, mis saab ref-i vastu võtta (nupp, span). */
  children: React.ReactElement;
}

/** Iseseisev vihje — Provider on sees, et kasutamiseks poleks vaja rakenduse juurt muuta. */
export const Tooltip: React.FC<TooltipProps> = ({ content, side = 'top', children }) => (
  <TooltipPrimitive.Provider delayDuration={300}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className={tooltipContentClass}>
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);
```

- [ ] **Step 5: Lisa `index.ts`-i**

```ts
export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogBody, DialogFooter } from './Dialog';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from './Menu';
export { Popover, PopoverTrigger, PopoverContent, Tooltip } from './Popover';
```

- [ ] **Step 6: Kontroll**

Run: `SRV 'npx tsc --noEmit -p tsconfig.app.json && npx oxlint src/components/ui && npm run ui-audit | tail -1'`
Expected: vigadeta; keelatud klasse 0 (`max-h-[88vh]`, `w-[min(…)]` on suurused — lubatud).

- [ ] **Step 7: Commit + release**

```bash
SRV 'git add src/components/ui && git commit -m "feat(ui): Dialog, Tabs, rippmenüü/kontekstimenüü, Popover, Tooltip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release.

---

### Task 7: Näidiste leht `/ui`, reeglid

**Files:**
- Create: `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`
- Modify: `src/AuthGate.tsx` (lõpu `return (` ees)
- Memory: `/Users/andresj/.claude/projects/-Users-andresj-Progemine-teris/memory/ui-komponendid.md` + rida `MEMORY.md`-s

**Interfaces:**
- Consumes: kõik `./index` ekspordid (Task 4–6), `DateInput` (`src/components/DateInput.tsx`, käitumine muutmata).
- Produces: aadress `/ui` (ainult `user.isAdmin`), `export const UiGallery: React.FC`.

- [ ] **Step 1: `UiGallery.tsx`**

```tsx
// src/components/ui/UiGallery.tsx — kõigi ühiste komponentide näidised (aadress /ui, ainult admin).
// Uue vaate tegemisel vali siit; kui vajalikku pole, lisa ui/ komponent või variant, mitte vaate-klass.
import React, { useEffect, useState } from 'react';
import { Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, Checkbox, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTrigger, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Field, Input, Panel, Popover,
  PopoverContent, PopoverTrigger, RadioGroup, RadioGroupItem, Select, Switch, Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, Tooltip,
} from './index';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Panel title={title} bodyClassName="flex flex-wrap items-start gap-3">{children}</Panel>
);

export const UiGallery: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );
  useEffect(() => document.documentElement.setAttribute('data-theme', theme), [theme]);
  const [crop, setCrop] = useState('');
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Ühised komponendid</h1>
          <Button size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Hele teema' : 'Tume teema'}
          </Button>
        </div>

        <Section title="Nupud">
          <Button variant="primary"><Plus size={14} />Lisa töö</Button>
          <Button>Tühista</Button>
          <Button variant="ghost">Rohkem</Button>
          <Button variant="danger"><Trash2 size={14} />Kustuta</Button>
          <Button variant="primary" size="sm">Väike</Button>
          <Button size="sm">Väike</Button>
          <Button size="icon" aria-label="Muuda"><Pencil size={16} /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Kustuta"><Trash2 size={14} /></Button>
          <Button variant="primary" disabled>Keelatud</Button>
        </Section>

        <Section title="Märgid">
          <Badge tone="success">Tehtud</Badge>
          <Badge tone="info">Plaanis</Badge>
          <Badge tone="warning">Kontrolli</Badge>
          <Badge tone="danger">Viga</Badge>
          <Badge tone="accent">PRIA</Badge>
          <Badge>Mustand</Badge>
        </Section>

        <Section title="Sakid">
          <Tabs defaultValue="a">
            <TabsList><TabsTrigger value="a">Ülevaade</TabsTrigger><TabsTrigger value="b">Tööd</TabsTrigger><TabsTrigger value="c">Kulud</TabsTrigger></TabsList>
            <TabsContent value="a" className="pt-3 text-sm">Ülevaate sisu</TabsContent>
            <TabsContent value="b" className="pt-3 text-sm">Tööde sisu</TabsContent>
            <TabsContent value="c" className="pt-3 text-sm">Kulude sisu</TabsContent>
          </Tabs>
          <Tabs defaultValue="ha" variant="segmented">
            <TabsList><TabsTrigger value="ha">ha</TabsTrigger><TabsTrigger value="t">t</TabsTrigger><TabsTrigger value="eur">€</TabsTrigger></TabsList>
          </Tabs>
        </Section>

        <Section title="Vormiväljad">
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Nimi" htmlFor="g-name" hint="Põllu nimi registris"><Input id="g-name" placeholder="Nt Kaasiku" /></Field>
            <Field label="Kultuur" htmlFor="g-crop">
              <Select id="g-crop" value={crop} onValueChange={setCrop} options={[{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }, { value: 'barley', label: 'Suvioder' }]} />
            </Field>
            <Field label="Pindala" htmlFor="g-area" error="Pindala peab olema positiivne"><Input id="g-area" aria-invalid defaultValue="-2" className="text-right" /></Field>
            <Field label="Märkus" htmlFor="g-note" className="md:col-span-3"><Textarea id="g-note" /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={setChecked} />Arvesta PRIA-sse</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={on} onCheckedChange={setOn} />Saadab ka seisu ajal</label>
            <RadioGroup defaultValue="plan">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="plan" />Plaan</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="actual" />Tegelik</label>
            </RadioGroup>
          </div>
        </Section>

        <Section title="Tabel">
          <Table>
            <TableHeader><TableRow><TableHead>Põld</TableHead><TableHead>Kultuur</TableHead><TableHead numeric>Pindala, ha</TableHead><TableHead>Olek</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>Kaasiku</TableCell><TableCell>Talinisu</TableCell><TableCell numeric>12,40</TableCell><TableCell><Badge tone="success">Külvatud</Badge></TableCell></TableRow>
              <TableRow selected><TableCell>Männiku</TableCell><TableCell>Taliraps</TableCell><TableCell numeric>8,05</TableCell><TableCell><Badge tone="info">Plaanis</Badge></TableCell></TableRow>
              <TableRow><TableCell>Oja</TableCell><TableCell>Suvioder</TableCell><TableCell numeric>21,70</TableCell><TableCell><Badge tone="warning">Kontrolli</Badge></TableCell></TableRow>
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={2}>Kokku</TableCell><TableCell numeric>42,15</TableCell><TableCell /></TableRow></TableFooter>
          </Table>
        </Section>

        <Section title="Dialoog, menüüd, hüpikud">
          <Dialog>
            <DialogTrigger asChild><Button variant="primary">Ava dialoog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader title="Muuda põldu" description="Kaasiku · 12,40 ha" />
              <DialogBody className="flex flex-col gap-3">
                <Field label="Nimi" htmlFor="d-name"><Input id="d-name" defaultValue="Kaasiku" /></Field>
                <Field label="Kultuur" htmlFor="d-crop"><Select id="d-crop" value={crop} onValueChange={setCrop} options={[{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }]} /></Field>
              </DialogBody>
              <DialogFooter><Button>Tühista</Button><Button variant="primary">Salvesta</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button>Rippmenüü</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Põld</DropdownMenuLabel>
              <DropdownMenuItem><Pencil size={14} />Muuda</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger><Trash2 size={14} />Kustuta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <Card className="px-4 py-3 text-sm">Paremklõps siin</Card>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Ava põld</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem danger>Eemalda</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <Popover>
            <PopoverTrigger asChild><Button>Hüpik</Button></PopoverTrigger>
            <PopoverContent>Hüpiku sisu: filtrid, lisainfo või väike vorm.</PopoverContent>
          </Popover>
          <Tooltip content="Vihje tekst"><Button variant="ghost">Hõlju siin</Button></Tooltip>
        </Section>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: `/ui` marsruut `src/AuthGate.tsx`-is**

Faili ülaossa importide järele:
```tsx
// Ühiste komponentide näidiste leht (/ui, ainult admin) — eraldi tükk, tavakasutaja seda ei lae.
const UiGallery = React.lazy(() => import('./components/ui/UiGallery').then((m) => ({ default: m.UiGallery })));
```

Viimase `return (` ette (pärast kõiki hook'e ja varasemaid `return`-e, kus `user` on juba olemas):
```tsx
  if (user.isAdmin && window.location.pathname === '/ui') {
    return (
      <React.Suspense fallback={null}>
        <UiGallery />
      </React.Suspense>
    );
  }
```

Server serveerib `/ui` jaoks `index.html` (SPA fallback, `src/server/prod.ts:42`) — serveri muudatust pole vaja.

- [ ] **Step 3: `src/components/ui/README.md`**

```markdown
# Ühised komponendid (`src/components/ui/`)

Spec: `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md`. Näidised: `/ui` (admin).

## Reeglid

- Nupud, dialoogid, tabelid, märgid, sakid, väljad, menüüd, hüpikud — ainult siit. Vaates ei looda neile uusi CSS-klasse.
- Kui vajalikku pole: lisa variant `variants.ts`-i (ja test) või uus komponent siia — mitte vaate-klass.
- Skaalad: kirjasuurus `text-2xs|xs|sm|base|lg|xl` (11/12/13/14/16/20 px); vahed 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8;
  nurgad `rounded-sm|md|lg|full`.
- Suvalised väärtused `text-[…]`, `p-[…]`, `m-[…]`, `gap-[…]`, `rounded-[…]`, `bg-[…]`, `border-[…]` on keelatud
  (`npm run ui-audit` näitab). Suurused (`w-[…]`, `max-h-[…]`) on lubatud.
- Värvid ainult nimedega (`bg-card`, `text-muted-foreground`, `text-warning` …) — need järgivad heledat/tumedat teemat
  ise, `dark:` pole tavaliselt vaja. Erand: andmevärvid (kultuur, kaardikiht) `style={{ … }}` kaudu.
- `style={{ … }}` ainult dünaamiliste väärtuste jaoks.
- Kuupäev: `DateInput` (pp.kk.aaaa); arv: `NumberInput`; otsinguga valik: `FilterSelect`; filtri X: `FilterClear`.
- Numbriveerg tabelis: `numeric` (paremale joondus); kogused `formatQty`.
- Klassid liida `cn()`-ga (mitte template-stringiga) — see lahendab Tailwindi konfliktid.
```

- [ ] **Step 4: Kontroll**

Run: `SRV 'npx tsc --noEmit -p tsconfig.app.json && npx oxlint src/components/ui src/AuthGate.tsx && npm test 2>&1 | tail -3 && npm run ui-audit | tail -1'`
Expected: vigadeta; testid PASS; keelatud klasse 0.

- [ ] **Step 5: Commit + release**

```bash
SRV 'git add src/components/ui src/AuthGate.tsx && git commit -m "feat(ui): näidiste leht /ui (admin) ja ühiste komponentide reeglid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Release.

- [ ] **Step 6: Visuaalne kontroll**

Palu kasutajal avada live'is `/ui` (admin) ja vaadata läbi mõlemas teemas: nuppude gradient ja varjud, dialoogi avanemine/sulgemine (Esc, X, taust), Select ja menüüd dialoogi sees nähtavad, Tooltip, tabeli numbriveerg paremal. Paranda leitud kõrvalekalded `variants.ts`-is (+ test) enne lõpetamist. Kinnita ka, et tavaline rakendus (`/`) on endiselt muutumatu.

- [ ] **Step 7: Mälu**

Kirjuta `/Users/andresj/.claude/projects/-Users-andresj-Progemine-teris/memory/ui-komponendid.md`:
```markdown
---
name: ui-komponendid
description: UI ühtlustamine — ühised komponendid src/components/ui (shadcn+Tailwind v4), skaalad, ui-audit, /ui näidised; etapp 1 live, üleminek tüüpide kaupa ees
metadata:
  type: project
---

Etapp 1 (alus + komponendid) live 2026-11-<pp>. Spec docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md,
reeglid src/components/ui/README.md, näidised /ui (admin), mõõdik `npm run ui-audit`.

**Why:** UI oli ebaühtlane (40 kirjasuurust, 55 modaaliklassi); kasutaja valis shadcn/ui + Tailwind, identiteet säilib.

**How to apply:** uus UI ainult ui/ komponentidest ja skaaladest; index.css on kihis `legacy` (Tailwindi utiliidid
võidavad). Järgmised etapid eraldi plaanidena: nupud → dialoogid (sh confirmDialog) → tabelid → märgid/sakid →
vormiväljad → menüüd/hüpikud → kaardid; pärast iga sammu kustuta index.css-ist kasutuseta klassid. Vt [[filter-clear-x]],
[[numbers-right-aligned]], [[estonian-date-format]].
```
Lisa `MEMORY.md`-sse rida:
`- [UI komponendid](ui-komponendid.md) — shadcn+Tailwind ui/, skaalad, ui-audit, /ui; üleminek tüüpide kaupa ees`

---

## Järgmised etapid (eraldi plaanid)

Spec 3. osa samm 2.1–2.7 ja 3 — iga komponenditüüp oma plaaniga, kui see etapp on live ja kinnitatud.
