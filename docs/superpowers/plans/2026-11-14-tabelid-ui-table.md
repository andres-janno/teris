# Etapp 2.3 — tabelid ui/Table peale (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik 27 `<table>`-it (vt inventuur) kasutavad ühist `ui/Table`-it; ühtne päis, read, numbriveerud, tegevuste veerg, valitud rida; vanad tabelireeglid (`.register-table` jt) kaovad `index.css`-ist.

**Architecture:** `ui/Table` täiendatakse prop'idega, mida 27 tabelit päriselt vajavad (kerimine/ääris, kleepuv päis alati, tegevuste veerg, kinnitatud veerud, rea toonid, tühja rea abi, sorteeritav päis, tihe tabel, kleepuv jalus). Klassid tulevad `variants.ts`-i funktsioonidest (testitavad). `<table>` saab `data-slot="table"`, mille kaudu vanad sisuklasside reeglid (`.muted`, `.cell-sub`, `.name-cell` …) jäävad kehtima. Üleminek käib tabeliperede kaupa; iga ülesanne = commit + release.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest (node env — DOM-teste pole).

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md (3. osa, samm 2.3). Inventuur: docs/superpowers/plans/2026-11-14-tabelid-inventuur.md (numbrid #1–#27 viitavad sinna).

## Global Constraints

- Keskkond: kohalik kaust on sshfs-mount. Faile muuda mount'i kaudu; **git, npm, npx ainult serveris**: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`.
- Töö käib otse `master`-is. Iga ülesanne = commit(id) + release: `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?`, siis `systemctl is-active teris` → `active`.
- Kontrollid enne commit'i: `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run src/tooling src/components/ui`; `npx oxlint <muudetud failid>`; `npm run ui-audit -- --details`.
- Identifikaatorid inglise keeles; kommentaarid ja UI-tekst eesti keeles. Commit-sõnumid eesti keeles.
- Vaate failides (väljaspool `src/components/ui/`) **Tailwindi klasse ei kasutata** (Tailwind skaneerib ainult `ui/`-d). Ainult `ui/` komponendid + prop'id + vanad paigutus-/sisuklassid.
- `src/index.css` on kaskaadikihis `legacy` (enne `utilities`): ui utiliidid võidavad vana mitte-`!important` reegli.
- Numbrid paremale (`numeric`), kogused `formatQty` (2 komakohta) — kutsuja vormindab. Kuupäevad pp.kk.aaaa.
- Kasutaja otsused (2026-11-14): **valitud rida = hele roheline toon + roheline riba vasakus servas** (ka hooaegade „praegune“ ja sõitude „viimati avatud“). **Ulatus:** kõik 27 tabelit sh põldude tabelid; mullaproovide ja ilmahooaja pseudo-tabelid (inventuur P1/P2) jäävad järgmisse etappi.
- Kontrolleri otsused: lahter ei murdu vaikimisi (`wrap` lubab); vertikaaljoondus keskele (vanad registritabelid olid ülal); päis kleepub alati ja on läbipaistmatu; tabeli kiri 12px (`text-xs`), päis 11px.
- Ulatusest väljas: `src/admin/`, `src/landing/`, pseudo-tabelid P1–P8.

## ui/Table API (T1 loob, T2–T6 kasutavad)

| Komponent | Prop'id |
|---|---|
| `Table` | `scroll?: 'x' \| 'none' \| 'sm' \| 'md' \| 'fill'` (vaikimisi `x`); `bordered?: boolean`; `dense?: boolean`; `containerClassName?` (vana sisu-/paigutusklass ümbrisele); `className` (vaatepõhine klass `<table>`-ile) |
| `TableHeader`, `TableBody` | – |
| `TableFooter` | `sticky?: boolean` (jalus kleepub alla) |
| `TableRow` | `selected?: boolean`; `tone?: 'success' \| 'warning' \| 'muted' \| 'group' \| 'total'`; `onClick` → kursor automaatselt |
| `TableHead` | `numeric?`; `pin?: 'start' \| 'end'`; `actions?` (= tegevuste veerg); `sort?: 'asc' \| 'desc' \| 'none'` (sorteeritav päis + `aria-sort`; ikoon kutsuja) |
| `TableCell` | `numeric?`; `wrap?` (murdub); `pin?: 'start' \| 'end'`; `actions?` (kleepub paremale, kitsas, nupud keskel reas) |
| `TableEmpty` | `colSpan: number`, `children` (tühja tabeli tekst) |

Kerimine: `x` = ainult horisontaalne; `none` = ümbris ei keri (päis kleepub dialoogi sisu kerimisalas); `sm` = max 40vh; `md` = max 62vh; `fill` = täidab täislehe paneeli (min 220px).

## Üleminekuretsept (T2–T6)

```tsx
// enne
<div className="register-table-wrap">
  <table className="register-table work-register-table">
    <thead><tr><th>Nimi</th><th className="num">Põldudel</th><th className="actions-col">Tegevused</th></tr></thead>
    <tbody>
      {rows.length === 0 && <tr><td colSpan={3} className="muted">Kirjeid pole</td></tr>}
      {rows.map((w) => (
        <tr key={w.id} className={w.isActive ? '' : 'inactive'} onClick={() => open(w)} style={{ cursor: 'pointer' }}>
          <td className="name-cell">{w.name}</td>
          <td className="num">{w.count}</td>
          <td className="actions-col"><div className="row-actions"><Button …/><Button …/></div></td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

// pärast
<Table scroll="md" bordered className="work-register-table">
  <TableHeader><TableRow><TableHead>Nimi</TableHead><TableHead numeric>Põldudel</TableHead><TableHead actions>Tegevused</TableHead></TableRow></TableHeader>
  <TableBody>
    {rows.length === 0 && <TableEmpty colSpan={3}>Kirjeid pole</TableEmpty>}
    {rows.map((w) => (
      <TableRow key={w.id} tone={w.isActive ? undefined : 'muted'} onClick={() => open(w)}>
        <TableCell wrap className="name-cell">{w.name}</TableCell>
        <TableCell numeric>{w.count}</TableCell>
        <TableCell actions><Button …/><Button …/></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Reeglid:
1. **Ümbris:** `register-table-wrap` div → `Table bordered` + `scroll`: dialoogis vana 62vh → `md`; `.harvest-lot-section` (40vh) → `sm`; täislehe paneelis (`fullpage-board-body`, `fleet-board-body .implement-history-section`, vt index.css ~6906) → `fill`; wrapita tabel dialoogis → `scroll="none"`; muu → vaikimisi `x`. `glass-card` ja inline `overflowX` ümbriselt ära. Kui ümbrisel oli vaatepõhine klass (nt `weather-years-wrap`), anna see `containerClassName`-iga.
2. **Klassid `<table>`-il:** `register-table` ära. Vaatepõhine klass (`work-register-table`, `stock-doc-lines`, `seasons-table` …) jääb `className`-ina, kui sellel on veel sisureegleid; kui ainult struktuurireeglid (th/td polster, taust, kiri), jäta ära ja kirjuta raportisse.
3. **Lahtrid:** `num`/`num-col` → `numeric`; `actions-col` + `row-actions` div → `actions` (div kaob); murduvad lahtrid (`name-cell`, `wrap-cell`, `users-admin-wrap`) → `wrap` (sisuklass võib jääda, kui sellel on sisureegleid); tühi päis tegevuste kohal → `<TableHead actions />`.
4. **Read:** `clickable-row` ja inline `cursor` → ainult `onClick`. `inactive` → `tone="muted"`. Grupi-/vahepealkirja rida → `tone="group"`. Keskmise/kokku rida tbody-s → `tone="total"`. Valitud/praegune/viimati avatud → `selected`. Positiivne tint (aktiivne haakimine, saagirida) → `tone="success"`; hoiatusrida → `tone="warning"`. Andmevärvid (kultuuri värv, ilmatintid) jäävad vanade klasside/inline `--crop-color`-iga.
5. **Tühi rida** `<tr><td colSpan>` → `<TableEmpty colSpan={veergude arv}>` — kontrolli, et colSpan = tegelik veergude arv (inventuur: #14, #17 olid valed).
6. **`display:flex` lahtril** (`.trip-dialog-entry-cell`): mähi sisu `<div className="trip-dialog-entry-cell">`, lahter ise jääb tabelilahtriks.
7. **Vana reegel, mis peab utiliidist üle võitma** (polster, taust, joondus lahtril) → `!important` või eemalda, kui ui vaikimisi sobib. Laiusereeglid (`td:first-child { width:100% }`) töötavad edasi.
8. **Inline-stiilid tabeli sees:** staatilised (fondid, värvid, joondus, laiused) → ära (ui annab) või vaatepõhine klass; jäävad ainult dünaamilised (kultuuri värv, arvutatud nihe).
9. Vaate failis ei ole ühtegi toorest `<table|thead|tbody|tfoot|tr|th|td>`-elementi ega klassi `register-table(-wrap)|num-col|actions-col|row-actions|clickable-row` — ui-audit rida „Vanu tabeleid (tsx)“ selle faili jaoks 0.
10. `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableEmpty` imporditakse `./ui` (või `../ui`) kaudu.

---

### Task 1: ui/Table täiendus, tabelivärvid, mõõdik, näidised

**Files:**
- Modify: `src/components/ui/variants.ts` (lisa tabeli klassid), `src/components/ui/Table.tsx` (ümber kirjutatud), `src/components/ui/index.ts` (eksport `TableEmpty`), `src/styles/app.css` (`@theme inline` plokki 3 tokenit), `src/components/ui/UiGallery.tsx` (teine tabelinäide), `src/components/ui/README.md` (tabeli reeglid), `src/tooling/uiAudit.ts`, `scripts/ui-audit.mts`, `src/index.css` (`.register-table X` sisureeglid ka `[data-slot="table"] X`-le)
- Test: `src/components/ui/variants.test.ts`, `src/tooling/uiAudit.test.ts`

**Interfaces:**
- Produces: tabel „ui/Table API“ ülal; `variants.ts`: `TableScroll`, `TableRowTone`, `TablePin`, `tableContainerClass`, `tableClass`, `tableHeadClass`, `tableCellClass`, `tableRowClass`, `tableFooterClass`; `uiAudit.ts`: `auditTsx().legacyTables: string[]`, `AuditReport.legacyTableFiles: {path,count}[]`; CLI rida „Vanu tabeleid (tsx)“.

- [ ] **Step 1: Kirjuta testid** — `src/components/ui/variants.test.ts` lõppu:

```ts
describe('tabel', () => {
  it('päis kleepub ja on läbipaistmatu', () => {
    const c = v.tableHeadClass({});
    expect(c).toContain('sticky');
    expect(c).toContain('bg-table-head');
  });
  it('numbriveerg paremale', () => {
    expect(v.tableCellClass({ numeric: true })).toContain('text-right');
    expect(v.tableHeadClass({ numeric: true })).toContain('text-right');
  });
  it('lahter ei murdu vaikimisi, wrap murdub', () => {
    expect(v.tableCellClass({})).toContain('whitespace-nowrap');
    expect(v.tableCellClass({ wrap: true })).toContain('whitespace-normal');
    expect(v.tableCellClass({ wrap: true })).not.toContain('whitespace-nowrap');
  });
  it('tegevuste veerg kleepub paremale läbipaistmatu taustaga', () => {
    const c = v.tableCellClass({ pin: 'end' });
    expect(c).toContain('right-0');
    expect(c).toContain('bg-popover');
    expect(v.tableCellClass({})).not.toContain('bg-popover');
  });
  it('tihe tabel väiksema polstriga', () => {
    expect(v.tableCellClass({ dense: true })).toContain('py-1');
    expect(v.tableCellClass({ dense: true })).not.toContain('py-1.5');
  });
  it('kerimine: md piirab kõrguse, none ei keri, ääris eraldi', () => {
    expect(v.tableContainerClass({ scroll: 'md' })).toContain('max-h-[62vh]');
    expect(v.tableContainerClass({ scroll: 'none' })).not.toContain('overflow');
    expect(v.tableContainerClass({ bordered: true })).toContain('border-border');
  });
  it('rea toonid ja klõpsatav rida', () => {
    expect(v.tableRowClass({ tone: 'muted' })).toContain('text-subtle');
    expect(v.tableRowClass({ clickable: true })).toContain('cursor-pointer');
    expect(v.tableRowClass({})).not.toContain('cursor-pointer');
  });
});
```

Ja `allClassStrings()` massiivi lõppu (et ka tabeliklassid läbiksid „ainult skaala“ kontrolli):

```ts
  ...(['x', 'none', 'sm', 'md', 'fill'] as const).map((scroll) => v.tableContainerClass({ scroll, bordered: true })),
  v.tableClass({ bordered: true }),
  ...([undefined, 'start', 'end'] as const).flatMap((pin) => [
    v.tableHeadClass({ pin, numeric: true, sortable: true }), v.tableCellClass({ pin, numeric: true, dense: true }),
  ]),
  ...(['success', 'warning', 'muted', 'group', 'total'] as const).map((tone) => v.tableRowClass({ tone, clickable: true })),
  v.tableFooterClass({ sticky: true }),
```

`src/tooling/uiAudit.test.ts` lõppu:

```ts
describe('auditTsx: vanad tabelid', () => {
  it('loeb toored tabelielemendid ja vanad tabeliklassid', () => {
    const r = auditTsx(
      '<table className="register-table"><thead><tr><th className="num">A</th></tr></thead><tbody><tr className="clickable-row"><td className="actions-col"><div className="row-actions" /></td></tr></tbody></table>'
    );
    expect(r.legacyTables).toEqual([
      '<table>', 'register-table', '<thead>', '<tr>', '<th>', '<tbody>', '<tr>', 'clickable-row', '<td>', 'actions-col', 'row-actions',
    ]);
  });
  it('ei loe ui komponente', () => {
    expect(auditTsx('<Table><TableHeader><TableRow><TableHead numeric>A</TableHead></TableRow></TableHeader></Table>').legacyTables).toEqual([]);
  });
  it('summarize jätab ui kausta välja', () => {
    const r = summarize([
      { path: 'src/components/ui/Table.tsx', content: '<table>' },
      { path: 'src/components/X.tsx', content: '<td>' },
    ]);
    expect(r.legacyTableFiles).toEqual([{ path: 'src/components/X.tsx', count: 1 }]);
  });
});
```

- [ ] **Step 2: Käivita, peab kukkuma** — `npx vitest run src/tooling src/components/ui` → FAIL (`tableHeadClass is not a function`, `legacyTables` undefined).

- [ ] **Step 3: variants.ts** — faili lõppu (impordi `cn` failist `./cn`, kui veel pole):

```ts
// --- Tabel (etapp 2.3) ---
export type TableScroll = 'x' | 'none' | 'sm' | 'md' | 'fill';
export type TableRowTone = 'success' | 'warning' | 'muted' | 'group' | 'total';
export type TablePin = 'start' | 'end';

const TABLE_SCROLL: Record<TableScroll, string> = {
  x: 'overflow-x-auto',
  none: '',
  sm: 'max-h-[40vh] overflow-auto',
  md: 'max-h-[62vh] overflow-auto',
  fill: 'min-h-55 flex-1 overflow-auto',
};

export const tableContainerClass = ({ scroll = 'x', bordered = false }: { scroll?: TableScroll; bordered?: boolean }): string =>
  cn('w-full', TABLE_SCROLL[scroll], bordered && 'rounded-md border border-border');

// border-separate: kleepuva päise alumine joon püsib (border-collapse'iga kaoks kerides).
export const tableClass = ({ bordered = false }: { bordered?: boolean } = {}): string =>
  cn('w-full border-separate border-spacing-0 text-xs', bordered && '[&>tbody>tr:last-child>td]:border-b-0');

// Kinnitatud lahter vajab läbipaistmatut tausta, mis järgib rea hover'it ja valikut.
const PIN_BG = 'bg-popover group-hover:bg-table-hover group-data-[selected]:bg-table-selected';

export const tableHeadClass = ({
  numeric = false, pin, sortable = false, dense = false,
}: { numeric?: boolean; pin?: TablePin; sortable?: boolean; dense?: boolean }): string =>
  cn(
    'sticky top-0 z-[2] whitespace-nowrap border-b border-border bg-table-head text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground',
    dense ? 'px-1.5 py-1' : 'px-2.5 py-2',
    numeric && 'text-right',
    pin === 'start' && 'left-0 z-[3]',
    pin === 'end' && 'right-0 z-[3] w-px px-1.5 text-center',
    sortable && 'cursor-pointer select-none hover:text-foreground'
  );

export const tableCellClass = ({
  numeric = false, wrap = false, pin, dense = false,
}: { numeric?: boolean; wrap?: boolean; pin?: TablePin; dense?: boolean }): string =>
  cn(
    'border-b border-border align-middle',
    dense ? 'px-1.5 py-1' : 'px-2.5 py-1.5',
    wrap ? 'whitespace-normal' : 'whitespace-nowrap',
    numeric && 'text-right tabular-nums',
    pin && `sticky z-[1] ${PIN_BG}`,
    pin === 'start' && 'left-0',
    pin === 'end' && 'right-0 w-px px-1.5 text-center'
  );

const ROW_TONES: Record<TableRowTone, string> = {
  success: 'bg-primary/10',
  warning: 'bg-warning/10',
  muted: 'text-subtle',
  group: 'bg-muted font-semibold [&>td]:pt-4',
  total: 'font-semibold [&>td]:border-t-2',
};

// Valitud rida (kasutaja otsus 2026-11-14): hele roheline toon + roheline riba vasakus servas.
export const tableRowClass = ({ tone, clickable = false }: { tone?: TableRowTone; clickable?: boolean }): string =>
  cn(
    'group transition-colors hover:bg-table-hover data-[selected]:bg-table-selected data-[selected]:[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary)]',
    tone && ROW_TONES[tone],
    clickable && 'cursor-pointer'
  );

export const tableFooterClass = ({ sticky = false }: { sticky?: boolean } = {}): string =>
  cn('bg-muted font-semibold', sticky && '[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:z-[2] [&>tr>td]:bg-table-head');
```

- [ ] **Step 4: app.css** — `@theme inline { … }` ploki värvide juurde (pärast `--color-muted-hover`):

```css
  /* Tabel: läbipaistmatud toonid (kleepuv päis ja kinnitatud veerud ei lase ridu läbi paista) */
  --color-table-head: color-mix(in srgb, var(--text-primary) 4%, var(--bg-modal));
  --color-table-hover: color-mix(in srgb, var(--text-primary) 6%, var(--bg-modal));
  --color-table-selected: color-mix(in srgb, var(--emerald-500) 12%, var(--bg-modal));
```

- [ ] **Step 5: Table.tsx** — asenda kogu fail:

```tsx
// src/components/ui/Table.tsx — ühine tabel (etapp 2.3). Päis kleepub alati; numbriveerg paremale; kogused vormindab
// kutsuja (formatQty). <table> kannab data-slot="table" — vanad sisuklasside reeglid (.muted, .cell-sub …) leiavad selle.
import React, { createContext, useContext } from 'react';
import { cn } from './cn';
import {
  tableCellClass, tableClass, tableContainerClass, tableFooterClass, tableHeadClass, tableRowClass,
  type TablePin, type TableRowTone, type TableScroll,
} from './variants';

const TableDensity = createContext(false);

type TableProps = React.ComponentProps<'table'> & {
  scroll?: TableScroll;
  bordered?: boolean;
  dense?: boolean;
  containerClassName?: string;
};

export const Table: React.FC<TableProps> = ({ className, containerClassName, scroll = 'x', bordered = false, dense = false, ...props }) => (
  <TableDensity.Provider value={dense}>
    <div className={cn(tableContainerClass({ scroll, bordered }), containerClassName)}>
      <table data-slot="table" className={cn(tableClass({ bordered }), className)} {...props} />
    </div>
  </TableDensity.Provider>
);

// Päiserea hover on välja lülitatud (TableRow hover on mõeldud andmeridadele).
export const TableHeader: React.FC<React.ComponentProps<'thead'>> = ({ className, ...props }) => (
  <thead className={cn('[&_tr]:hover:bg-transparent', className)} {...props} />
);
export const TableBody: React.FC<React.ComponentProps<'tbody'>> = (props) => <tbody {...props} />;
export const TableFooter: React.FC<React.ComponentProps<'tfoot'> & { sticky?: boolean }> = ({ className, sticky, ...props }) => (
  <tfoot className={cn(tableFooterClass({ sticky }), className)} {...props} />
);

export const TableRow: React.FC<React.ComponentProps<'tr'> & { selected?: boolean; tone?: TableRowTone }> = ({
  className, selected, tone, onClick, ...props
}) => (
  <tr
    data-selected={selected || undefined}
    onClick={onClick}
    className={cn(tableRowClass({ tone, clickable: !!onClick }), className)}
    {...props}
  />
);

const ARIA_SORT = { asc: 'ascending', desc: 'descending', none: 'none' } as const;

export const TableHead: React.FC<
  React.ComponentProps<'th'> & { numeric?: boolean; pin?: TablePin; actions?: boolean; sort?: 'asc' | 'desc' | 'none' }
> = ({ className, numeric, pin, actions, sort, ...props }) => {
  const dense = useContext(TableDensity);
  return (
    <th
      aria-sort={sort ? ARIA_SORT[sort] : undefined}
      className={cn(tableHeadClass({ numeric, pin: actions ? 'end' : pin, sortable: !!sort, dense }), className)}
      {...props}
    />
  );
};

export const TableCell: React.FC<React.ComponentProps<'td'> & { numeric?: boolean; wrap?: boolean; pin?: TablePin; actions?: boolean }> = ({
  className, numeric, wrap, pin, actions, children, ...props
}) => {
  const dense = useContext(TableDensity);
  return (
    <td className={cn(tableCellClass({ numeric, wrap, pin: actions ? 'end' : pin, dense }), className)} {...props}>
      {actions ? <div className="flex items-center justify-center gap-0.5">{children}</div> : children}
    </td>
  );
};

/** Tühja tabeli rida: colSpan = veergude arv. */
export const TableEmpty: React.FC<{ colSpan: number; children: React.ReactNode }> = ({ colSpan, children }) => {
  const dense = useContext(TableDensity);
  return (
    <tr>
      <td colSpan={colSpan} className={cn(tableCellClass({ wrap: true, dense }), 'py-6 text-center text-subtle')}>{children}</td>
    </tr>
  );
};
```

`index.ts`: `export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableEmpty } from './Table';`

- [ ] **Step 6: uiAudit.ts** — `LEGACY_MODAL` järele:

```ts
// Toored tabelielemendid ja vanad tabeliklassid (etapp 2.3). ui/ kausta ei loeta (seal on ui/Table ise).
const LEGACY_TABLE =
  /<(table|thead|tbody|tfoot|tr|th|td)(?=[\s>])|(?<![\w-])(register-table-wrap|register-table|num-col|actions-col|row-actions|clickable-row)(?![\w-])/g;
```

`AuditReport`-i: `legacyTableFiles: { path: string; count: number }[];`. `auditTsx` tagastusse: `legacyTables: [...src.matchAll(LEGACY_TABLE)].map((m) => (m[1] ? \`<${m[1]}>\` : m[2])),`. `summarize`-i:

```ts
    legacyTableFiles: tsx
      .filter((t) => t.legacyTables.length > 0 && !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: t.legacyTables.length })),
```

`scripts/ui-audit.mts` — modaalirea järele:

```ts
row(
  'Vanu tabeleid (tsx)',
  r.legacyTableFiles.reduce((s, f) => s + f.count, 0),
  r.legacyTableFiles.map((f) => `${f.path}: ${f.count}`)
);
```

- [ ] **Step 7: Käivita testid** — `npx vitest run src/tooling src/components/ui` → PASS. `npm run ui-audit -- --details` → kirjuta raportisse „Vanu tabeleid (tsx)“ baas ja failid. Kui loendis on fail, mida inventuur ei nimeta (nt HTML-stringid Leafleti hüpikus), raporteeri see — ära muuda regexit.

- [ ] **Step 8: index.css sisureeglid** — iga `.register-table <järeltulija>` selektor, mis **ei ole** struktuurireegel (`th`, `td`, `tbody tr:hover td`, `.num`, `.num-col`, `.actions-col`, `.row-actions`, `tr.clickable-row`), saab kõrvale `[data-slot="table"] <järeltulija>` (selektorilist, nt `.register-table .muted, [data-slot="table"] .muted { … }`). Sama kehtib `.register-table .name-cell …`, `.sticky-name/.sticky-size`, `.mono`, `.cell-sub`, `.size-cell …`, `.year-…` reeglitele. Struktuurireegleid ära puutu (T7 kustutab). Kontroll: `grep -n "\.register-table " src/index.css` — iga sisureegli juures on `[data-slot="table"]` paariline.

- [ ] **Step 9: UiGallery** — olemasoleva tabeli järele teine näide (ääris, kerimine, tegevused, klõpsatav, mitteaktiivne, tühi, sorteeritav):

```tsx
<Table scroll="md" bordered>
  <TableHeader>
    <TableRow>
      <TableHead sort="asc">Nimi</TableHead><TableHead numeric>Kogus, t</TableHead><TableHead actions>Tegevused</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow onClick={() => undefined}><TableCell>Klõpsatav rida</TableCell><TableCell numeric>12,40</TableCell>
      <TableCell actions><Button variant="ghost" size="icon-sm" aria-label="Muuda"><Pencil size={15} /></Button></TableCell></TableRow>
    <TableRow selected><TableCell>Valitud rida</TableCell><TableCell numeric>8,05</TableCell><TableCell actions /></TableRow>
    <TableRow tone="muted"><TableCell>Mitteaktiivne</TableCell><TableCell numeric>0,00</TableCell><TableCell actions /></TableRow>
    <TableRow tone="group"><TableCell colSpan={3}>Grupi vahepealkiri</TableCell></TableRow>
  </TableBody>
</Table>
<Table bordered><TableBody><TableEmpty colSpan={3}>Kirjeid pole</TableEmpty></TableBody></Table>
```

(Impordi `Pencil` lucide-react'ist, kui veel pole; `TableEmpty` `./index`-ist.)

- [ ] **Step 10: README** — `src/components/ui/README.md` tabeli lõik: API tabel ülalt (lühidalt), „vaates ei ole toorest `<table>`-it“, valitud rida = `selected`, rea toonid, `scroll` väärtused, tegevuste veerg `actions`.

- [ ] **Step 11:** tsc, vitest, oxlint. Commit `feat(ui): Table kerimine, tegevuste veerg, rea toonid, tühi rida; ui-audit loeb vanu tabeleid`. Release. Raportisse: audit baas.

---

### Task 2: Dialoogide tabelid

**Files (Modify):** `src/components/UsersAdminModal.tsx` (#3), `src/components/WorkRegisterModal.tsx` (#12), `src/components/AiConnectionModal.tsx` (#27), `src/components/ArticleCategoriesDialog.tsx` (#8), `src/components/TripDialog.tsx` (#6), `src/components/FieldWorkPlanForm.tsx` (#4, #5), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept iga tabeli peal. Erijuhud:
  - #3 kasutajad: `users-admin-table-wrap` → `Table` (ääris jah, kerimine `x`); `users-admin-wrap` lahtrid → `wrap`; `users-admin-actions-cell` → `actions`; `tr.inactive` → `tone="muted"`.
  - #12: `scroll="md" bordered`; `work-register-table` klass ära, kui sel jäävad ainult struktuurireeglid.
  - #27 AI võtmed: `scroll="x"`, ääris ei; mobiilis peidetud 3. veerg — `ai-key-table` jääb `className`-ina koos `:nth-child(3)` reegliga (kontrolli, et reegel `display:none` toimib ka utiliitidega; vajadusel `!important`). Tühi päis → `<TableHead actions />`.
  - #8 kategooriad: `scroll="none"`; tabelil pole päist — jääb nii; `inactive` → `tone="muted"`; `.article-categories-group .register-table td:first-child` → `.article-categories-group [data-slot="table"] td:first-child`.
  - #6 sõidu põllud: `scroll="none"`; `trip-dialog-fields` jääb `className`-ina; `td.trip-dialog-entry-cell` sisu mähi div-i (retsept p 6); alamrida `text-muted` jääb.
  - #4, #5 plaani tabelid: `Table dense`; `fw-plan-table` struktuurireeglid jäävad surnuks (T7 kustutab).
- [ ] **Step 2:** Kontrollid, `npm run ui-audit -- --details` — nende failide tabeliloendur 0. Commit `refactor(ui): dialoogide tabelid ui/Table peale`. Release.

---

### Task 3: Laoseisu ja saagipartiide tabelid

**Files (Modify):** `src/components/StockDocumentsPanel.tsx` (#9), `src/components/InventoryDialog.tsx` (#11), `src/components/StockDocumentDialog.tsx` (#13), `src/components/ArticleStockCard.tsx` (#14), `src/components/HarvestLotDialog.tsx` (#15–#17), `src/components/HarvestLotsPanel.tsx` (#26), `src/components/WarehousesPanel.tsx` (#18), `src/components/ArticlesView.tsx` (#21), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - #11, #13 (`stock-doc-lines`): `scroll="none"`, `className="stock-doc-lines"` jääb (laiused, `input.num`); sisestusväljad lahtrites jäävad samaks (vormiväljade etapp hiljem); numbrisisendi lahter `numeric`.
  - #14 laokaart: `className="stock-card-table"` jääb (`td.stock-qty*` värvid; `td:nth-child(2)` murdub → kontrolli, et utiliit `whitespace-nowrap` ei võida: anna 2. veerule `wrap`, reegel siis üleliigne); TableEmpty colSpan = tegelik veergude arv (4–6, arvuta).
  - #15–#17: `scroll="sm" bordered` (vana `.harvest-lot-section .register-table-wrap` 40vh); #17 colSpan kontroll.
  - #18 ladude register: „Põllu laod“ vahepealkiri → `TableRow tone="group"` + `TableCell colSpan`.
  - #21 artiklid: `scroll="fill"` (täisleht/vahekaart — kontrolli konteinerit), klõpsatav rida `onClick`; nupud `stopPropagation` jäävad; `inactive` → `tone="muted"`; `articles-table` klass ära, kui ainult struktuurireeglid.
  - #26 saagipartiid: inline `cursor` ära, `onClick` jääb.
  - #9: kontrolli, kas vahekaardil on `fullpage-board-body` vanem — siis `scroll="fill"`, muidu `md`.
- [ ] **Step 2:** Kontrollid, audit — nende failide loendur 0. Commit `refactor(ui): laoseisu ja saagipartiide tabelid ui/Table peale`. Release.

---

### Task 4: Tehnika registrid

**Files (Modify):** `src/components/VehicleTracker.tsx` (#10, haakimised ~2017), `src/components/DeviceAssignmentRegister.tsx` (#23), `src/components/TripRegister.tsx` (#24), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - Kõik kolm: `register-table-wrap glass-card` + inline `overflowX` → `Table scroll="fill" bordered` (vanem `.fleet-board-body .implement-history-section`, index.css ~6906).
  - #10, #23: 20/21 inline-stiili — aktiivse rea inline `background` → `tone="success"`; tegevuste `textAlign:'right'` → `actions`; nuppude `width:26px` → `Button size="icon-sm"` (kui veel pole); ikoonikastide/fondide staatilised stiilid → vaatepõhine klass index.css-is (uued klassid lubatud ainult sisu jaoks: ikoonikast, alamtekst), dünaamilised (värv andmetest) jäävad inline. Raportisse inline-stiilide arv enne/pärast.
  - #24 sõidud: `trip-row-last-opened` → `selected`; kustutatud rida inline `opacity:.55` → `tone="muted"`; `trip-gap-row` → `tone="warning"`, `.reviewed` → `tone="muted"` (hoiatuse sisu, nupud jäävad); `clickable-row` → `onClick`.
- [ ] **Step 2:** Kontrollid, audit — loendur 0. Commit `refactor(ui): tehnika registrite tabelid ui/Table peale`. Release.

---

### Task 5: Finantsid, ilm, hooajad, kultuurid

**Files (Modify):** `src/components/FinanceModal.tsx` (#1, #2), `src/components/WeatherView.tsx` (#7), `src/components/SeasonManagerModal.tsx` (#22), `src/components/CropRegisterModal.tsx` (#25), `src/index.css` (vajadusel)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - #1 kulude read: `Table bordered`; `tr.harvest-row` → `tone="success"`; sisestusväli lahtris jääb.
  - #2 kasumlikkus: `Table bordered` (kerimine `x`); `th.sortable` → `TableHead sort={…}` (`'asc'|'desc'|'none'` olemasolevast sort-state'ist), `onClick` jääb, `ArrowUpDown` ikoon jääb `th-content` sisse; rea vasak riba `borderLeftColor` (kultuuri värv) jääb inline; tühi rida → `TableEmpty colSpan={13}`.
  - #7 ilm: `scroll="fill" bordered` + `containerClassName="weather-years-wrap"`, `className="weather-years"` (lahtri tindid `weather-${…}` on andmevärvid — td taust legacy-kihis, utiliit tausta ei pane, seega toimib; kontrolli); „Keskmine“ rida → `tone="total"` (`weather-normal-row` klass ära, kui ainult bold/border); checkbox lahtris `stopPropagation` jääb.
  - #22 hooajad: `seasons-table-wrap` → `Table scroll="fill" bordered`; `tr.current` → `selected` (kasutaja otsus: roheline täisrida kaob); `has-notes` klõps → `onClick`; märkuste laiendatav rida `season-notes-row` → `TableRow` + `TableCell colSpan={5} wrap`; `num mono` → `numeric` + `className="mono"`; `.seasons-table tr.current …` reeglid surnuks (T7).
  - #25 kultuurid: `scroll="fill" bordered` (täisleht) — dialoogi režiimis (`size="full"`) sama; `crop-register-table` jääb (värviriba `--crop-color`, sortide taane); `crop-row`/`variety-row` klassid jäävad `TableRow className`-ina.
- [ ] **Step 2:** Kontrollid, audit — loendur 0. Commit `refactor(ui): finantside, ilma, hooaegade ja kultuuride tabelid ui/Table peale`. Release.

---

### Task 6: Põldude tabelid (kinnitatud veerud)

**Files (Modify):** `src/components/FieldManagerModal.tsx` (#19), `src/components/FieldsTableView.tsx` (#20), `src/index.css`

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - Mõlemad `Table scroll="fill" bordered`. Põld ja suurus: `TableHead/TableCell pin="start"` + olemasolevad `sticky-name`/`sticky-size` klassid (laius 300/240px ja teise veeru `left` nihe tulevad T1-s `[data-slot="table"]`-ga laiendatud reeglitest; `left` utiliit `left-0` võidab legacy `left: 300px` — teisele veerule anna nihe inline `style={{ left: … }}` või `!important` reegel; vali üks ja kirjuta raportisse).
  - #20 jalus: `<TableFooter sticky>`; „Kokku: N põldu“ rida.
  - #20 tegevuste veerg → `actions` (kleepub paremale).
  - #19 aastaveerud: päise klõps (valib hooaja) ja lahtri klõps (muudab kultuuri) jäävad; `year-col`/`year-cell`/`editable`/`editing`/`selected` klassid jäävad (sisureeglid, T1-s `[data-slot="table"]`-ga laiendatud); muutmise `select`-id lahtris jäävad.
  - `--crop-color` inline jääb (andmevärv).
- [ ] **Step 2:** Kontrollid, audit — loendur 0 (kogu rakenduses). Commit `refactor(ui): põldude tabelid ui/Table peale`. Release.

---

### Task 7: Koristus — vanad tabelireeglid index.css-ist välja

**Files:** Modify `src/index.css`

- [ ] **Step 1:** `npm run ui-audit -- --details` — „Vanu tabeleid (tsx)“ = 0. Kui mitte, ära jätka; raporteeri.
- [ ] **Step 2: Kustuta struktuurireeglid:** `.register-table-wrap` (ja kontekstireeglid `.fullpage-board-body .register-table-wrap` jt, `.harvest-lot-section .register-table-wrap`, `crop-group-columns` ülekirjutused), `.register-table` / `th` / `td` / `tbody tr:hover td` / `.num` / `.num-col` / `.actions-col` / `.row-actions` / `tr.clickable-row` / `tr.register-group-row`; globaalne `th.num, td.num` (~10498), `.articles-table th.num/td.num` ja `tr.clickable-row`; vaatepõhiste tabeliklasside struktuurireeglid (th/td polster, taust, kirjasuurus, border, sticky) — `seasons-table`, `users-admin-table`, `work-register-table`, `fw-plan-table`, `finance-lines-table`, `finance-results-table`, `ai-key-table`, `stock-card-table` jt, kui nende klass on tsx-ist kadunud või reegel on nüüd utiliidi poolt üle kirjutatud. Iga kustutuse eel: `grep -rn "<klass>" src --include=*.tsx | grep -v src/admin`.
- [ ] **Step 3: Sisureeglite selektorid:** `.register-table X, [data-slot="table"] X` → ainult `[data-slot="table"] X`.
- [ ] **Step 4: Surnud CSS** inventuuri osast 5: `.varieties-table*`, `.variety-table-actions`, `.register-fields-list` (ja selle kontekstireeglid), `.trip-dialog-metrics`, `.work-entry-article-row`, `.field-info-btn`, `.crop-dot` (kõik 3), `.season-delta*` — iga eel grep tühi.
- [ ] **Step 5:** Release; `grep -c "register-table" dist/assets/main-*.css` → 0. `npm run ui-audit` uus baas raportisse (rida „Vanu komponendiklasse (CSS)“, index.css read enne/pärast). tsc, vitest. Commit `refactor(ui): vanad tabelireeglid välja index.css-ist`. Release.
- [ ] **Step 6: Kasutaja visuaalne kontroll** (mõlemas teemas): põldude tabel (kinnitatud veerud + jalus kerides), põllud × aastad (aasta valik, kultuuri muutmine), hooaegade register (valitud hooaeg, märkuste rida), sõitude register (viimati avatud, hoiatusrida), artiklid (klõps rida, mitteaktiivne), lao dokument (sisestusväljad), finantsid (sorteerimine), ilm (tindid, keskmine), kasutajate aken.
