# Vormiväljad ui peale (etapp 2.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik rakenduse vormiväljad (tekst, arv, kuupäev, valik, tekstikast, märkeruut, raadionupp, otsing, filter) kasutavad `src/components/ui` komponente; vanad `.form-input`/`.form-group` jt reeglid kustutatakse.

**Architecture:** Etapis laiendatakse ui baaskomponente (suurus sm/md, eesliide/järelliide, numbrijoondus, tühi valik ja rühmad Selectis, sildiga märkeruut, vormi paigutus `FormGrid`/`FieldRow`). Omad komponendid DateInput, NumberInput, FilterSelect ja FilterClear kolivad `src/components/ui/` alla ja ehitatakse sama aluse peale; käitumine jääb samaks. Seejärel viiakse vaated üle failirühmade kaupa ja lõpuks kustutatakse vana CSS.

**Tech Stack:** React 19 + TS, Tailwind v4 (skaneerib AINULT `src/components/ui`), Radix (`radix-ui` pakett), class-variance-authority, vitest, oxlint.

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md · **Inventuur:** docs/superpowers/plans/2026-11-15-vormivaljad-inventuur.md (read-numbrid, klassid, kasutuskohad — loe oma ülesande failide kohta)

## Global Constraints

- Kasutaja otsused (2026-11-15): välja kõrgus **32px** (`size="md"`, vaikimisi) kõikjal, **tabeli ridades 28px** (`size="sm"`); tööriba 34px kaob. Rippmenüü = **ui `Select` (Radix, rakenduse oma loend)**, natiivset `<select>`-i ei jää. Märkeruudud **jäävad ruutudeks** (Switch'i ei kasutata).
- Tailwind skaneerib ainult `src/components/ui` → vaadetes (kõik väljaspool `ui/`) **ei kasutata Tailwindi klasse**. Vaate paigutus = ui komponendid või olemasolevad vaate-CSS klassid index.css-is.
- CSS kihid: index.css on kihis `legacy`, ui utiliidid võidavad. Vaate reegel, mis peab ui utiliidi üle võitma (laius, polster), vajab `!important`. Vaate reeglid, mis sihivad vana `.form-input`-i, kirjuta ümber `[data-slot="input"]` / `[data-slot="select"]` / `[data-slot="textarea"]` / `[data-slot="filter-select"]` peale.
- Kuupäevad pp.kk.aaaa Tallinna ajas, natiivset `type="date"`/`time`/`number` ei kasutata. Numbrid paremale (`numeric`), kogused 2 komakohaga (NumberInput vaikimisi `decimals=2`).
- Iga filter on `FilterClear` sees (X eemaldab tingimuse).
- Identifikaatorid (prop'id, data-slot, CSS klassid) inglise keeles; kommentaarid ja UI-tekst eesti keeles. UI nimed = koodinime tõlge.
- Toored `<input>` lubatud ainult `type="file"` ja `type="range"` jaoks ning **`type` peab olema esimene atribuut** (`<input type="file" …`), et ui-audit need vahele jätaks. Kõik muu läheb ui komponendile.
- Salvestatavad väärtused ei tohi muutuda: kui väli liigub tekstist `NumberInput`-ile, peab salvestatav arv jääma samaks (koma/punkt, tühi → `null`, mitte `0`, kui varem ei olnud `0`).
- Keskkond: kohalik kaust on sshfs-mount. Käsud **serveris**: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`. Failide muutmine võib käia kohaliku mount'i kaudu.
- Kontrollid iga ülesande lõpus (serveris):
  - `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`
  - `npx vitest run src/tooling src/components/ui` (ära toruta `tail`-i — loe kokkuvõtte rida)
  - `npx oxlint <muudetud failid>` (0 errorit)
  - `npm run ui-audit -- --details`
- Commit masteris enne release'i, ainult konkreetsed failid (`git add <failid>`, mitte `-A`). Commit-sõnum lõpeb `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Release: `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` ja `systemctl is-active teris` → `active`. Ebaõnnestunud release jätab vana versiooni live'i — paranda ja korda.
- `src/types` kompileerub ka serveri node16 all: sealt ei tohi importida `src/components/ui`-d; importides `.ts` laiend.

---

### Task 1: ui alus — suurused, eesliide/järelliide, Select laiendus, sildiga märkeruut, vormi paigutus, audit

**Files:**
- Modify: `src/components/ui/variants.ts` (fieldControlClass ümbrus)
- Modify: `src/components/ui/Input.tsx`
- Create: `src/components/ui/selectOptions.ts`, `src/components/ui/selectOptions.test.ts`
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Checkbox.tsx`, `src/components/ui/RadioGroup.tsx`
- Modify: `src/components/ui/Field.tsx`
- Modify: `src/components/ui/index.ts`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`
- Modify: `src/components/ui/variants.test.ts`
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts`

**Interfaces:**
- Produces (kasutavad kõik järgmised ülesanded):
  - `type FieldSize = 'sm' | 'md'`; `fieldSizeClass: Record<FieldSize,string>`; `fieldShellClass: string` (variants.ts)
  - `Input` props: `Omit<ComponentProps<'input'>,'size'> & { size?: FieldSize; numeric?: boolean; start?: ReactNode; end?: ReactNode }`; renderdab `<input data-slot="input">`; `start`/`end` korral ümbris `<div data-slot="input-group">`, `className` läheb ümbrisele
  - `Textarea` props: `ComponentProps<'textarea'> & { autosize?: boolean }`; `data-slot="textarea"`
  - `SelectOption { value: string; label: string; disabled?: boolean; group?: string }` — `value: ''` on lubatud (tühi valik)
  - `Select` props: `value, onValueChange, options, placeholder?, disabled?, className?, id?, size?: FieldSize, name?, required?, autoFocus?, 'aria-label'?, 'aria-invalid'?, 'aria-describedby'?`; trigger `data-slot="select"`
  - `CheckboxField { checked, onCheckedChange, label: ReactNode, hint?: ReactNode, disabled?, id?, name?, className? }`
  - `RadioField { value: string; label: ReactNode; disabled?: boolean; id?: string }` (kasutada `RadioGroup` sees); `RadioGroup` prop `orientation?: 'horizontal'|'vertical'`
  - `Field` props: `label?: ReactNode; htmlFor?; hint?; error?; span?: 'full'; className?; children`
  - `FormGrid { cols?: 2 | 3; span?: 'full'; className?; children }`, `FieldRow { className?; children }`
  - ui-audit rida „Vanu vormivälju (tsx)“

- [ ] **Step 1: Kirjuta testid** — `src/components/ui/selectOptions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_SELECT_VALUE, fromRadixValue, groupOptions, toRadixValue } from './selectOptions';

describe('select valikud', () => {
  const withEmpty = [{ value: '', label: '— vali —' }, { value: 'a', label: 'A' }];
  it('tühi väärtus tühja valikuga → sentinel, ilma → tühi (placeholder)', () => {
    expect(toRadixValue('', withEmpty)).toBe(EMPTY_SELECT_VALUE);
    expect(toRadixValue('', [{ value: 'a', label: 'A' }])).toBe('');
    expect(toRadixValue('a', withEmpty)).toBe('a');
  });
  it('sentinel tagasi tühjaks', () => {
    expect(fromRadixValue(EMPTY_SELECT_VALUE)).toBe('');
    expect(fromRadixValue('a')).toBe('a');
  });
  it('järjestikused sama rühmaga valikud ühte rühma, järjekord säilib', () => {
    const g = groupOptions([
      { value: '', label: 'Kõik' },
      { value: '1', label: 'Üks', group: 'Laod' },
      { value: '2', label: 'Kaks', group: 'Laod' },
      { value: '3', label: 'Kolm', group: 'Põllud' },
    ]);
    expect(g.map((x) => [x.group, x.options.map((o) => o.value)])).toEqual([
      [undefined, ['']],
      ['Laod', ['1', '2']],
      ['Põllud', ['3']],
    ]);
  });
});
```

Lisa `src/components/ui/variants.test.ts` lõppu:

```ts
describe('vormiväli', () => {
  it('suurused: sm 28px väike kiri, md 32px', () => {
    expect(v.fieldSizeClass.sm).toContain('h-7');
    expect(v.fieldSizeClass.sm).toContain('text-xs');
    expect(v.fieldSizeClass.md).toContain('h-8');
    expect(v.fieldSizeClass.md).toContain('text-sm');
  });
  it('ümbris (eesliide/järelliide) annab fookuse rõnga ümbrisele', () => {
    expect(v.fieldShellClass).toContain('focus-within:ring-2');
    expect(v.fieldShellClass).toContain('focus-within:border-primary');
  });
  it('ei kasuta keelatud suvalisi väärtusi', () => {
    for (const c of [v.fieldControlClass, v.fieldShellClass, ...Object.values(v.fieldSizeClass)]) {
      expect(c).not.toMatch(/(?:text|p[xytrblse]?|m[xytrblse]?|gap|rounded|bg|border)-\[/);
    }
  });
});
```

`src/tooling/uiAudit.test.ts`-i lisa (järgi faili olemasolevat stiili `auditTsx`/`summarize` testidele):

```ts
it('loeb tooreid vormielemente ja vanu vormiklasse, jätab file/range ja ui kausta vahele', () => {
  const src = '<input className="form-input" /><select>\n</select><textarea />' +
    '<input type="file" /><input type="range" /><div className="form-group"><div className="form-grid">';
  expect(auditTsx(src).legacyFormFields).toEqual(['<input>', '<select>', '<textarea>', 'form-input', 'form-group', 'form-grid']);
  const r = summarize([
    { path: 'src/components/A.tsx', content: src },
    { path: 'src/components/ui/Input.tsx', content: '<input className="x" />' },
  ]);
  expect(r.legacyFormFieldFiles).toEqual([{ path: 'src/components/A.tsx', count: 6 }]);
});
```

(Kui `summarize` saab teistsuguse sisendkuju või `legacy*Files` elemendid on teise kujuga, järgi faili olemasolevat `legacyBadgeTabFiles` testi täpselt.)

- [ ] **Step 2: Käivita testid, veendu et kukuvad** — `npx vitest run src/tooling src/components/ui` → FAIL (`selectOptions` puudub, `fieldSizeClass` puudub, `legacyFormFields` puudub).

- [ ] **Step 3: variants.ts** — `fieldControlClass` järele:

```ts
/** Vormivälja suurus: md 32px (vaikimisi, nagu nupp md), sm 28px tabeli ridades (kasutaja otsus 2026-11-15). */
export type FieldSize = 'sm' | 'md';
export const fieldSizeClass: Record<FieldSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-2.5 text-sm',
};
/** Eesliite/järelliitega välja ümbris: ääris ja fookus ümbrisel, sees äärisetu input. */
export const fieldShellClass =
  'flex w-full items-center gap-1.5 rounded-sm border border-input bg-field text-foreground transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input[aria-invalid=true]]:border-destructive';
```

Lisa `fieldControlClass` lõppu: ` aria-invalid:focus-visible:ring-destructive/30`.

- [ ] **Step 4: Input.tsx** (asenda kogu fail):

```tsx
// src/components/ui/Input.tsx — tekstiväli ja mitmerealine väli (asendab .form-input).
// Kuupäeva jaoks kasuta DateInput-i (pp.kk.aaaa), arvu jaoks NumberInput-i. start/end: ikoon, ühik (ha, €), nupp.
import React from 'react';
import { cn } from './cn';
import { fieldControlClass, fieldShellClass, fieldSizeClass, type FieldSize } from './variants';

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: FieldSize;
  numeric?: boolean; // arv paremale, ühelaiused numbrid
  start?: React.ReactNode;
  end?: React.ReactNode;
};

const readOnlyClass = 'read-only:cursor-default read-only:font-semibold';

export const Input: React.FC<InputProps> = ({ className, size = 'md', numeric, start, end, ...props }) => {
  const numericClass = numeric && 'text-right tabular-nums';
  if (start == null && end == null) {
    return (
      <input
        data-slot="input"
        className={cn(fieldControlClass, fieldSizeClass[size], readOnlyClass, 'read-only:bg-muted', numericClass, className)}
        {...props}
      />
    );
  }
  return (
    <div data-slot="input-group" className={cn(fieldShellClass, fieldSizeClass[size], 'has-[input:read-only]:bg-muted', className)}>
      {start != null && <span className="inline-flex shrink-0 items-center text-muted-foreground">{start}</span>}
      <input
        data-slot="input"
        className={cn('h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle', readOnlyClass, numericClass)}
        {...props}
      />
      {end != null && <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">{end}</span>}
    </div>
  );
};

export const Textarea: React.FC<React.ComponentProps<'textarea'> & { autosize?: boolean }> = ({ className, autosize, ...props }) => (
  <textarea
    data-slot="textarea"
    className={cn(fieldControlClass, 'min-h-16 px-2.5 py-1.5', autosize && 'field-sizing-content max-h-80 resize-none', className)}
    {...props}
  />
);
```

- [ ] **Step 5: selectOptions.ts**:

```ts
// src/components/ui/selectOptions.ts — Selecti valikute abifunktsioonid. Radix ei luba valikut väärtusega '',
// seega tühi valik („— vali —“, „Kõik“) kasutab sisemist sentinel-väärtust.
export interface SelectOption {
  value: string; // '' = tühi valik
  label: string;
  disabled?: boolean;
  group?: string; // järjestikused sama rühmaga valikud näidatakse rühmapealkirja all
}

export const EMPTY_SELECT_VALUE = '__empty__';

export function toRadixValue(value: string, options: SelectOption[]): string {
  return value === '' && options.some((o) => o.value === '') ? EMPTY_SELECT_VALUE : value;
}

export function fromRadixValue(value: string): string {
  return value === EMPTY_SELECT_VALUE ? '' : value;
}

export function groupOptions(options: SelectOption[]): { group?: string; options: SelectOption[] }[] {
  const out: { group?: string; options: SelectOption[] }[] = [];
  for (const o of options) {
    const last = out[out.length - 1];
    if (last && last.group === o.group) last.options.push(o);
    else out.push({ group: o.group, options: [o] });
  }
  return out;
}
```

- [ ] **Step 6: Select.tsx** (asenda kogu fail):

```tsx
// src/components/ui/Select.tsx — valikukast ilma otsinguta (rakenduse oma loend, kasutaja otsus 2026-11-15).
// Tühi valik (value '') ja rühmad (option.group) on toetatud. Otsinguga/värvitäpiga filter: FilterSelect.
import React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { fieldControlClass, fieldSizeClass, menuContentClass, menuItemClass, menuLabelClass, type FieldSize } from './variants';
import { fromRadixValue, groupOptions, toRadixValue, type SelectOption } from './selectOptions';

export type { SelectOption };

interface SelectProps {
  value: string; // '' = valimata (või tühi valik, kui options sisaldab value '')
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  size?: FieldSize;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export const Select: React.FC<SelectProps> = ({
  value, onValueChange, options, placeholder = 'Vali…', disabled, className, id, size = 'md', name, required, autoFocus, ...aria
}) => (
  <SelectPrimitive.Root
    value={toRadixValue(value, options)}
    onValueChange={(v) => onValueChange(fromRadixValue(v))}
    disabled={disabled}
    name={name}
    required={required}
  >
    <SelectPrimitive.Trigger
      data-slot="select"
      id={id}
      autoFocus={autoFocus}
      aria-label={aria['aria-label']}
      aria-invalid={aria['aria-invalid']}
      aria-describedby={aria['aria-describedby']}
      className={cn(fieldControlClass, fieldSizeClass[size], 'flex items-center justify-between gap-2 text-left data-[placeholder]:text-subtle', className)}
    >
      <span className="min-w-0 truncate"><SelectPrimitive.Value placeholder={placeholder} /></span>
      <SelectPrimitive.Icon>
        <ChevronDown size={14} className="text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={4} className={cn(menuContentClass, 'max-h-72 min-w-(--radix-select-trigger-width)')}>
        <SelectPrimitive.Viewport>
          {groupOptions(options).map((g, gi) => {
            const items = g.options.map((o) => (
              <SelectPrimitive.Item key={o.value || '__empty'} value={toRadixValue(o.value, options)} disabled={o.disabled} className={cn(menuItemClass, 'relative pr-8')}>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                  <Check size={14} className="text-primary" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ));
            return g.group ? (
              <SelectPrimitive.Group key={`g${gi}`}>
                <SelectPrimitive.Label className={menuLabelClass}>{g.group}</SelectPrimitive.Label>
                {items}
              </SelectPrimitive.Group>
            ) : (
              <React.Fragment key={`g${gi}`}>{items}</React.Fragment>
            );
          })}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
```

Märkus: `toRadixValue(o.value, options)` annab `''` valikule sentineli (sest options sisaldab `''`), muudele valikutele väärtuse ise.

- [ ] **Step 7: Checkbox.tsx** — faili lõppu lisa:

```tsx
interface CheckboxFieldProps extends CheckboxProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
}

// Märkeruut koos sildiga: kogu rida on klõpsatav (asendab users-admin-checkbox, checkbox-label jt).
export const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, hint, className, ...props }) => (
  <label className={cn('inline-flex cursor-pointer items-start gap-2 text-sm text-foreground has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-50', className)}>
    <Checkbox {...props} className="mt-0.5" />
    <span className="flex flex-col gap-0.5">
      <span>{label}</span>
      {hint != null && <span className="text-2xs text-subtle">{hint}</span>}
    </span>
  </label>
);
```

Lisa `CheckboxProps`-i `required?: boolean;`. (`className` jääb `CheckboxField` puhul ümbrisele.)

- [ ] **Step 8: RadioGroup.tsx** — `RadioGroup` klass: `cn('flex gap-3', props.orientation === 'vertical' && 'flex-col gap-2', className)` (Radix `orientation` prop on olemas, ära seda eemalda props'ist). Faili lõppu:

```tsx
// Raadionupp koos sildiga (kasuta RadioGroup sees).
export const RadioField: React.FC<RadioGroupItemProps & { label: React.ReactNode }> = ({ label, ...props }) => (
  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-50">
    <RadioGroupItem {...props} />
    <span>{label}</span>
  </label>
);
```

- [ ] **Step 9: Field.tsx** (asenda kogu fail):

```tsx
// src/components/ui/Field.tsx — välja silt + abitekst + veateade ning vormi paigutus (FormGrid, FieldRow).
// Asendab .form-group, .form-grid, .form-row-3, .input-split.
import React from 'react';
import { cn } from './cn';

interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  span?: 'full'; // FormGrid-is üle kogu rea (vana .form-group.full-width)
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, span, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1', span === 'full' && 'col-span-full', className)}>
    {label != null && (
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
    )}
    {children}
    {error ? (
      <p role="alert" className="text-2xs text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-subtle">{hint}</p>
    ) : null}
  </div>
);

// Vormi ruudustik: 2 veergu (vana .form-grid) või 3 veergu 2:1:1.5 (vana .form-row-3, mobiilis 1 veerg).
export const FormGrid: React.FC<{ cols?: 2 | 3; span?: 'full'; className?: string; children: React.ReactNode }> = ({ cols = 2, span, className, children }) => (
  <div className={cn('grid gap-2.5', cols === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr]', span === 'full' && 'col-span-full', className)}>
    {children}
  </div>
);

// Väljad ühes reas (vana .input-split): nt väli + värvivalija, väli + nupp.
export const FieldRow: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('flex min-w-0 items-center gap-2 *:min-w-0', className)}>{children}</div>
);
```

- [ ] **Step 10: index.ts** — muuda read:

```ts
export { Input, Textarea, type InputProps } from './Input';
export { Select, type SelectOption } from './Select';
export { Checkbox, CheckboxField } from './Checkbox';
export { RadioGroup, RadioGroupItem, RadioField } from './RadioGroup';
export { Field, FormGrid, FieldRow } from './Field';
export type { FieldSize } from './variants';
```

- [ ] **Step 11: ui-audit** — `src/tooling/uiAudit.ts`, `LEGACY_BADGE_TAB` järele:

```ts
// Toored vormielemendid ja vanad vormiklassid (etapp 2.5). ui/ kausta ei loeta (seal on ka DateInput, NumberInput,
// FilterSelect). Lubatud toored: <input type="file"> ja <input type="range"> (type esimese atribuudina).
// Jääb alles valvurina: peab olema 0.
const LEGACY_FORM_FIELD =
  /<(input|select|textarea)(?=[\s>/])(?!\s+type="(?:file|range)")|(?<![\w-])(form-input|form-group|form-grid|form-row-3|input-split|input-with-unit|search-input|search-box-wrap|auto-resize-textarea|auto-field-input|time-select|users-admin-checkbox|checkbox-label|filter-select-trigger|date-input-btn)(?![\w-])/g;
```

`auditTsx` tagastusse: `legacyFormFields: [...src.matchAll(LEGACY_FORM_FIELD)].map((m) => (m[1] ? `<${m[1]}>` : m[2])),`. `AuditReport`-i ja `summarize`-i lisa `legacyFormFieldFiles` täpselt nagu `legacyBadgeTabFiles` (sama `components/ui/` välistus). `scripts/ui-audit.mts`-i lisa `'Vanu märke/sakke (tsx)'` rea järele:

```ts
row(
  'Vanu vormivälju (tsx)',
  r.legacyFormFieldFiles.reduce((s, f) => s + f.count, 0),
  r.legacyFormFieldFiles.map((f) => `${f.path}: ${f.count}`)
);
```

- [ ] **Step 12: Testid läbi** — `npx vitest run src/tooling src/components/ui` → kõik PASS. `npm run ui-audit` → kirjuta raportisse „Vanu vormivälju (tsx)“ algtase (oodata ~700).

- [ ] **Step 13: UiGallery + README** — `UiGallery.tsx` vormide plokki lisa näited: `Input size="sm"`; `Input numeric end="ha"`; `Input start={<Search size={14} />}`; `Input readOnly value="12,50"`; `Textarea autosize`; `Select` tühja valikuga (`{value:'',label:'— vali —'}`) ja rühmadega (`group: 'Laod'`/`'Põllud'`); `Select size="sm"`; `CheckboxField label="Mitteaktiivne" hint="Ei näidata valikutes"`; `RadioGroup orientation="vertical"` kahe `RadioField`-iga; `FormGrid` kahe `Field`-i ja ühe `span="full"` väljaga. README vormide jaotisesse: suurused (md 32px vaikimisi, sm 28px tabelis), `numeric`, `start`/`end`, Select tühi valik ja rühmad, CheckboxField/RadioField, FormGrid/FieldRow, data-slot nimed (`input`, `input-group`, `textarea`, `select`), reegel „toored `<input>` ainult file/range, type esimesena“.

- [ ] **Step 14: Kontrollid, commit, release**

```bash
git add src/components/ui/variants.ts src/components/ui/Input.tsx src/components/ui/selectOptions.ts src/components/ui/selectOptions.test.ts src/components/ui/Select.tsx src/components/ui/Checkbox.tsx src/components/ui/RadioGroup.tsx src/components/ui/Field.tsx src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/ui/variants.test.ts src/tooling/uiAudit.ts src/tooling/uiAudit.test.ts scripts/ui-audit.mts
git commit -m "feat(ui): vormiväljade alus — suurused, eesliide/järelliide, Selecti tühi valik ja rühmad, CheckboxField, FormGrid"
```

Release ja `systemctl is-active teris`.

---

### Task 2: DateInput, NumberInput, FilterSelect, FilterClear ui alla ja uue aluse peale; SearchInput

**Files:**
- Move: `src/components/DateInput.tsx` → `src/components/ui/DateInput.tsx`; `NumberInput.tsx`, `FilterSelect.tsx`, `FilterClear.tsx` samuti (`git mv`). Kui neil on testifaile (`src/components/*.test.ts`), liiguta kaasa.
- Create: `src/components/ui/SearchInput.tsx`
- Modify: `src/components/ui/index.ts`, `UiGallery.tsx`, `README.md`
- Modify: kõik failid, mis neid importivad (≈ 40 faili; `grep -rln "DateInput'\|NumberInput'\|FilterSelect'\|FilterClear'" src`)
- Modify: `src/index.css` — kustuta `.date-input*`, `.date-picker-*` (v.a vaate ülekirjutus `.cultivation-panel .date-picker-popup`, mis tuleb ümber nimetada uue popup'i data-slot'ile), `.filter-select-*`, `.filter-clear*`, `.search-box-wrap*`, `.search-input` ülekirjutused (inventuur 3.1/3.2 read).
- Modify: otsingukastid ArticlesView.tsx:225, CropRegisterModal.tsx:405, FieldManagerModal.tsx:452, FieldWorksBoard.tsx:749, FieldsTableView.tsx:327, RelatedPartiesModal.tsx:469, FinanceModal.tsx:447,867 → `SearchInput`

**Interfaces:**
- Consumes: Task 1 `Input` (`size`, `numeric`, `start`, `end`), `fieldControlClass`, `fieldSizeClass`, `FieldSize`, `menuContentClass`, `menuItemClass`, `menuLabelClass`.
- Produces:
  - `DateInput` props: senised (`value`, `onChange`, `disabled`, `required`, `id`, `popupPlacement`, `className`) + `size?: FieldSize`; **ei vaja enam `className="form-input"`** (className = ainult paigutus). Juur `data-slot="input-group"`.
  - `NumberInput` props: senised + `size?: FieldSize`; renderdab `Input numeric`; `className="form-input num"` kaob komponendi seest. Lisa prop `end?: ReactNode` (ühik, nt `"€/t"`), mis läheb `Input end`-ile.
  - `FilterSelect` props: senised + `size?: FieldSize`; trigger `data-slot="filter-select"`; `style` prop jääb (laiuse jaoks), aga kõrgus/kirjasuurus tuleb `size`-ist.
  - `FilterClear` props: samad (`active`, `onClear`, `className`, `children`; modifikaatorid `filter-clear-fill` → prop `fill?: boolean`, `filter-clear-inline` → prop `inline?: boolean`).
  - `SearchInput { value: string; onChange: (v: string) => void; placeholder?: string; 'aria-label': string; size?: FieldSize; className?: string; autoFocus?: boolean }` — `FilterClear` + `Input start={<Search size={14} />}`; X tühjendab.
  - Kõik eksporditud `./ui` kaudu: `import { DateInput, NumberInput, FilterSelect, FilterClear, SearchInput } from './ui'`. `parseNumberText`/`formatNumberText` jäävad `ui/NumberInput.tsx` eksportideks (ekspordi ka index.ts-ist, kui neid kasutatakse väljaspool).

- [ ] **Step 1: Kolimine** — `git mv` neli faili `src/components/ui/` alla. Paranda nende sisemised impordid (`'./ui'` → `'./cn'`, `'./Dialog'` jne; `'../services/…'` → `'../../services/…'`). Lisa `index.ts`-i:

```ts
export { DateInput } from './DateInput';
export { NumberInput, parseNumberText, formatNumberText } from './NumberInput';
export { FilterSelect } from './FilterSelect';
export { FilterClear } from './FilterClear';
export { SearchInput } from './SearchInput';
```

Uuenda kõik kasutajad: `import { DateInput } from './DateInput'` → lisa `DateInput` olemasolevasse `from './ui'` importi (või uus import). Kontroll: `grep -rn "from '\.\{1,2\}/\(DateInput\|NumberInput\|FilterSelect\|FilterClear\)'" src` → 0.

- [ ] **Step 2: NumberInput** — sees asenda `<input className={`form-input num ...`} …/>` → `<Input numeric size={size} end={end} className={className} … />` (kõik senised atribuudid: `inputMode`, `value`, `onChange`, `onBlur`, `id`, `placeholder`, `disabled`, `required`, `aria-label`, `title`). Käitumine (parsimine, blur-vormindus, min/max, välise väärtuse sünk) **ei muutu**.

- [ ] **Step 3: DateInput** — tekstiväli → `<Input size={size} className={className} aria-invalid={invalid || undefined} end={<button type="button" tabIndex={-1} …><CalendarDays size={15} /></button>} …/>`. Kalendrinupp: `inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground disabled:opacity-50`. Kalendri hüpik: sama loogika (portaal `usePopupContainer()`, `position:fixed` arvutatud stiil jääb inline'iks), välimus Tailwindiga: konteiner `menuContentClass` alusel (`z-2100 rounded-md border border-border bg-popover p-2 shadow-dialog`), pealkiri `text-sm font-semibold`, nädalapäevad `text-2xs text-subtle`, päevad `size-8 rounded-sm text-sm hover:bg-muted`, teised kuud `text-subtle`, täna `font-bold text-primary`, valitud `bg-primary text-white`, „Täna“ nupp ui `Button size="sm" variant="ghost"`. Hex-värve ei jää. Popup-elemendile `data-slot="date-picker"`. Esc, klaviatuur, paigutus, Tallinna aeg, eesti nimed — **ei muutu**. `z-index: 4000` inline → eemalda (klass `z-2100`). Index.css-is `.cultivation-panel .date-picker-popup` (inventuur rida ~1667) → `.cultivation-panel [data-slot="date-picker"]` (vajadusel `!important`).
  Kõigilt kutsujatelt eemalda `className="form-input"` (17 kohta) ja `className="cc-input"`-i asemel `className="cc-input"` jääb ainult siis, kui see klass annab paigutust (kontrolli index.css-ist; kõrgus/font ülekirjutused kustuta, sest md = 32px).

- [ ] **Step 4: FilterSelect** — trigger: `<button type="button" data-slot="filter-select" className={cn(fieldControlClass, fieldSizeClass[size], 'inline-grid cursor-pointer items-center text-left', isSet && 'font-semibold', fill && 'w-full', className)}>`; laiuse sizer jääb (kõik valikud nähtamatult paksus kirjas samas ruudustiku lahtris: `col-start-1 row-start-1 invisible h-0 font-semibold`; nähtav väärtus samas lahtris `col-start-1 row-start-1 truncate`), chevron `ChevronDown size={14}` paremal (`absolute right-2` või ruudustiku teine veerg — vali üks, pr ruum `pr-7`). Loend: `cn(menuContentClass, 'fixed overflow-auto')` + senine arvutatud asukoht inline; valik `menuItemClass` (+ `data-[highlighted]` asemel senine aktiivse indeksi klass `bg-muted`), rühmapäis `menuLabelClass`, valitud linnuke `Check size={14} text-primary`, värvitäpp `size-2.5 rounded-full` + `style={{ background: color }}`. `z-index` 9000 → `z-2100`. Klaviatuur, tähe järgi hüpe, flip, sulgumine kerimisel — **ei muutu**. Eemalda kutsujatelt `style={{ fontSize: '13px', height: '34px' }}` (inventuur: TripRegister 154–172, WeatherView 71–79, DeviceAssignmentRegister 195/207, VehicleTracker 1901/1913); kui `style`-is on ka laius, jäta ainult laius. `.form-input.filter-select-trigger:read-only` lõks kaob koos CSS-iga.

- [ ] **Step 5: FilterClear** (asenda kogu fail):

```tsx
// src/components/ui/FilterClear.tsx — filtri ümbris: aktiivse filtri lõpus X-nupp, mis eemaldab tingimuse ühe klõpsuga.
// X on alati välja sees paremal; väli jätab talle ruumi ka siis, kui X-i pole (laius ei hüppa).
import React from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

interface FilterClearProps {
  active: boolean; // kas filtril on vaikeväärtusest erinev tingimus
  onClear: () => void;
  fill?: boolean; // täislaius (vana filter-clear-fill)
  inline?: boolean; // X välja kõrval, mitte sees (vana filter-clear-inline)
  className?: string;
  children: React.ReactNode;
}

export const FilterClear: React.FC<FilterClearProps> = ({ active, onClear, fill, inline, className, children }) => (
  <span
    data-slot="filter-clear"
    className={cn(
      'relative inline-flex max-w-full items-center',
      fill && 'flex w-full *:w-full',
      inline
        ? 'gap-1'
        : [
            '[&>[data-slot=input]]:pr-7 [&>[data-slot=input-group]]:pr-7',
            '[&>[data-slot=select]]:pr-12 [&>[data-slot=filter-select]]:pr-12',
            '[&:has(>[data-slot=select])>[data-slot=filter-clear-btn]]:right-7',
            '[&:has(>[data-slot=filter-select])>[data-slot=filter-clear-btn]]:right-7',
            '[&:has(>[data-slot=input-group])>[data-slot=filter-clear-btn]]:right-8',
          ],
      className
    )}
  >
    {children}
    {active && (
      <button
        type="button"
        data-slot="filter-clear-btn"
        title="Eemalda filter"
        aria-label="Eemalda filter"
        onClick={onClear}
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-full text-muted-foreground cursor-pointer hover:bg-destructive/15 hover:text-destructive',
          !inline && 'absolute right-1.5 top-1/2 -translate-y-1/2'
        )}
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    )}
  </span>
);
```

Kontrolli ehitatud CSS-ist, et `:has(` reeglid tekkisid: `grep -c "filter-clear-btn" dist/assets/*.css` pärast `npm run build` (release teeb build'i) — vähemalt 3. Kui `[&>[data-slot=input-group]]:pr-7` ei anna DateInputi tekstile ruumi (ümbrise polster ei liiguta kalendrinuppu), vali selle asemel `[&>[data-slot=input-group]]:pr-9` ja X `right-8` asemel `right-1.5` ning kalendrinupp jääb X-ist vasakule — kontrolli galeriis ja kirjelda raportis, kumb valik jäi.

Kutsujad: `className="filter-clear-fill"` → `fill`, `className="filter-clear-inline"` → `inline` (inventuur: 6 + 5 kohta); `.history-filter-bar > div > .filter-clear` CSS → `.history-filter-bar > div > [data-slot="filter-clear"]` (vajadusel `!important`).

- [ ] **Step 6: SearchInput.tsx**:

```tsx
// src/components/ui/SearchInput.tsx — otsinguväli: luubi ikoon, X tühjendab (asendab .search-box-wrap + .search-input).
import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './Input';
import { FilterClear } from './FilterClear';
import type { FieldSize } from './variants';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label': string;
  size?: FieldSize;
  className?: string;
  autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, className, size, ...props }) => (
  <FilterClear active={value !== ''} onClear={() => onChange('')} className={className}>
    <Input
      type="text"
      inputMode="search"
      enterKeyHint="search"
      size={size}
      start={<Search size={14} />}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  </FilterClear>
);
```

Asenda 6 `.search-box-wrap` kohta ja 2 FinanceModali `.finance-search-box` kohta (`SearchInput`; laius: kui vaade vajab 220–420px, anna vaate CSS-is olemasolevale konteinerile laius — mitte Tailwind klass). Vaate CSS `.fullpage-board-body .search-box-wrap*`, `.fw-main .search-box-wrap*`, `.finance-search-box*`, `.fw-search*` kustuta; tööriba `select.form-input` / `.filter-select-trigger` 34px ülekirjutused (5594–5596, 5706–5708) kustuta.

- [ ] **Step 7: Galerii ja README** — UiGallery: DateInput (md ja sm, vigane), NumberInput `end="ha"`, FilterSelect rühmadega `FilterClear` sees, FilterClear ümber `Select`-i, `Input`-i ja `DateInput`-i (X asukoht kõigil kolmel), SearchInput. README: neli komponenti on nüüd `ui/` all, kasuta `size`, ära anna `form-input` klassi.

- [ ] **Step 8: Kontrollid, commit, release** — tsc, vitest, oxlint (muudetud failid), ui-audit (`Vanu vormivälju` peab langema: date-input-btn, search-input, search-box-wrap, filter-select-trigger kaovad). Commit kõik muudetud failid nimeliselt (`git add` + `git status` peab näitama ainult sinu faile): `refactor(ui): DateInput, NumberInput, FilterSelect, FilterClear ui alla; SearchInput`. Release.

---

### Ülesannete 3–7 ühine teisendustabel (vaadete üleviimine)

Iga vaate-ülesanne teisendab oma failides KÕIK toored väljad ja vanad vormiklassid. Iga muster:

| Vana | Uus |
|---|---|
| `<div className="form-grid">` | `<FormGrid>` |
| `<div className="form-group">` + `<label>Silt</label>` + väli | `<Field label="Silt" htmlFor={id}>` väli `</Field>` (anna väljale `id`, kui seda pole: `useId()` või kirjeldav string) |
| `<div className="form-group full-width">` | `<Field span="full" …>` |
| `<div className="form-row-3">` (ja `field-auto-row`) | `<FormGrid cols={3} span="full">` |
| `<div className="input-split">` | `<FieldRow>` |
| `<input className="form-input" …>` (text/password/email/tel) | `<Input …>` — `onChange` jääb samaks (natiivne sündmus) |
| `<input type="color" className="form-input">` | `<Input type="color" className="…">` (laius vaate CSS-iga `[data-slot="input"][type="color"]`) |
| `<input className="form-input num" inputMode="decimal" …>` | `<NumberInput value={number \| null} onChange={(n) => …}>` — teisenda olek: kui olek on string, mida hiljem parsitakse, muuda olek `number \| null`-iks ja eemalda kutsuja parsimine; salvestatav väärtus peab jääma samaks (vt Global Constraints). `readonly` arvutatud summa → `<Input numeric readOnly value={formatQty(x)}>` |
| `<input className="form-input auto-field-input" readOnly>` | `<Input readOnly title=… >` (abiteksti kursori jaoks `className` vaate klassiga, kui vaja) |
| `<select className="form-input" value={v} onChange={(e) => f(e.target.value)}>` + `<option>` | `<Select value={v} onValueChange={f} options={[…]} />`; `<option value="">— vali —</option>` → `{ value: '', label: '— vali —' }`; `<optgroup label="X">` → valikutele `group: 'X'`; `disabled` → `disabled: true`; numbrilised väärtused `String(x)` ja tagasi `Number(v)`; `required` → `required` |
| `<textarea className="form-input">` | `<Textarea>`; `auto-resize-textarea` → `<Textarea autosize>` |
| märkeruut sildiga (`<label className="users-admin-checkbox"><input type="checkbox" checked onChange={(e) => f(e.target.checked)} />Tekst</label>`) | `<CheckboxField checked={…} onCheckedChange={f} label="Tekst" />` |
| märkeruut ilma sildita (tabelis, `aria-label`) | `<Checkbox checked onCheckedChange aria-label="…" />` |
| `<input type="radio">` rühm | `<RadioGroup value onValueChange orientation>` + `<RadioField value label>` |
| `<input type="file" style={{display:'none'}}>` | jääb toorelt, **`type="file"` esimese atribuudina** |
| väli tabeli reas / kiirreas (`.stock-doc-lines`, `.crop-inline-edit`, `.pria-grid`, `.finance-field-select`, `.imp-assign-select`, `.dev-assign-select`) | sama komponent `size="sm"` |
| vaate CSS `.x .form-input { width/min-width }` | `.x [data-slot="input"], .x [data-slot="select"]` … (`!important`, kui peab ui utiliidi üle võitma); font/kõrgus/polster ülekirjutused **kustuta** (suurus tuleb `size`-ist) |
| `datalist`-iga sisend | `<Input list="…">` (datalist jääb) |

Iga ülesande lõpus: `npm run ui-audit -- --details` — ülesande failide all **0** „Vanu vormivälju“ rida; index.css-ist kustutatud vaate-ülekirjutused, mis jäid ilma kasutajata (kontrolli `grep -rn "<klass>" src --include=*.tsx` → 0 enne kustutamist; dünaamiliste klassinimede puhul ole ettevaatlik).

Ühised sammud igas ülesandes 3–7:
- [ ] Step A: loe inventuurist oma failide read; tee teisendused tabeli järgi.
- [ ] Step B: tsc + vitest + oxlint (muudetud failid) + ui-audit (oma failid 0).
- [ ] Step C: kustuta index.css-ist vaate-ülekirjutused, mille ainsad kasutajad olid sinu failid (nimekiri raportisse).
- [ ] Step D: commit (nimeliselt), release, `systemctl is-active teris`.
- [ ] Step E: raportisse käsitsi kontrolli nimekiri (kus vaates mida vaadata) ja iga koht, kus salvestatava väärtuse käsitlus muutus (string → number).

### Task 3: Artiklid ja ladu

**Files:** ArticleFormDialog.tsx (datalist 3, optgroup, 2 autosize textarea, 3 num), ArticleCategoriesDialog.tsx, ArticleMergeDialog.tsx, WarehousesPanel.tsx, WarehouseOptions.tsx (optgroup → peab tagastama `SelectOption[]` `group`-iga, mitte `<optgroup>` elemente — muuda funktsiooni kuju ja kõik kasutajad), StockDocumentDialog.tsx (5 select, rea-sisesed `size="sm"`, 2 num), StockDocumentsPanel.tsx, InventoryDialog.tsx, HarvestLotDialog.tsx (3 num, 3 select), ArticlesView.tsx, ResourceCostFields.tsx (+2 select, 1 num). Vaate CSS: `.stock-doc-lines …`, `.input-with-unit`, `.harvest-lot-head/.harvest-lot-add .form-input`, `.article-form-modal .form-input`, `.article-categories-add .form-input:first-child`.

**Interfaces:** Consumes Task 1 ja Task 2 eksportid. `WarehouseOptions` uus kuju: `warehouseOptions(warehouses, opts): SelectOption[]` (kirjelda raportis täpne signatuur).

- [ ] Steps A–E (vt ühine osa). Commit: `refactor(ui): artiklite ja lao vormid ui väljade peale`.

### Task 4: Põllud, kultuurid, PRIA, mullaproovid, ilm

**Files:** FieldEditDialog.tsx (datalist 2, 7 NumberInput, 3 select), CropRegisterModal.tsx (19 input, `crop-winter-toggle`/`crop-auto-color-toggle` → CheckboxField, color → `Input type="color"`, `.crop-inline-edit` → `size="sm"`), FieldManagerModal.tsx (3 rea-select `size="sm"`, `checkbox-label`), FieldsTableView.tsx, PriaLinesEditor.tsx (9 `form-input num` → NumberInput `size` vastavalt reale, 3 input, 7 FilterSelect; `.pria-grid [data-slot=…]` CSS), SeasonManagerModal.tsx (`.season-form-fieldset:disabled .form-input` → `[data-slot=…]`), FieldUploadModal.tsx, FieldBookUploadModal.tsx, SoilSampleUploadModal.tsx (file → type esimeseks), WeatherView.tsx (checkbox), WeatherCredentialModal.tsx, AddFieldWorkDialog.tsx. Vaate CSS: `.edit-cad-grid .form-input`, `.crop-inline-edit .form-input`, `.pria-grid .form-input`, `.pria-line …` (surnud), `.weather-credential-form …`.

- [ ] Steps A–E. Commit: `refactor(ui): põldude, kultuuride ja PRIA vormid ui väljade peale`.

### Task 5: Tööd ja finantsid

**Files:** FieldWorkEntryDialog.tsx (3 num + 2 readonly, `work-entry-finish` → CheckboxField, `users-admin-checkbox`), FieldWorkPlanForm.tsx, FieldWorksBoard.tsx (`fw-filter checkbox` → CheckboxField; tööriba), WorkRegisterModal.tsx, FinanceModal.tsx (hinnasisend `finance-price-input` + `finance-unit-suffix` → `NumberInput end={`€/${unit}`}`; puuduv hind (`.missing`, amber) → `aria-invalid` EI sobi (punane); kasuta `className` vaate klassiga `.finance-price-missing [data-slot="input-group"]` amber ääris `!important` ja kirjelda; `finance-field-select` → `Select size="sm"`; `finance-notes-textarea` → `Textarea`). Vaate CSS: `.fw-filter*`, `.finance-price-input*`, `.finance-unit-suffix`, `.finance-field-select`, `.finance-notes-*`, `.work-entry-finish*`, `.time-select`.

- [ ] Steps A–E. Commit: `refactor(ui): tööde ja finantside vormid ui väljade peale`.

### Task 6: Tehnika, sõidud, osapooled, huvipunktid, kasutajad, sisselogimine

**Files:** VehicleTracker.tsx (18 input, 8 select k.a 2 optgroup, `AutoTextarea` 251 → `Textarea autosize`, datalist 144–153, `imp-assign-select`/`dev-assign-select` → `Select size="sm"`, color), TripRegister.tsx (checkbox-chipid 178–190 → CheckboxField), TripDialog.tsx, TripGapReviewDialog.tsx, DeviceAssignmentRegister.tsx (4 select, 1 textarea), RelatedPartiesModal.tsx (`party-role-checkbox` → CheckboxField), PoiManagerModal.tsx, UsersAdminModal.tsx (radio 2 → RadioGroup/RadioField, `users-admin-checkbox`), ChangePasswordModal.tsx, AiConnectionModal.tsx (`.ai-key-url` monospace → `[data-slot="input"]` vaate reegel), SetPasswordPage.tsx, LoginPage.tsx. Sisselogimise oma välimus jääb: `.login-page .login-card .form-input` (+`:focus`) → `.login-page .login-card [data-slot="input"]` reeglid `!important`-iga (värvid, polster, oranž fookus — fookusrõngas `box-shadow`), kontrolli et login näeb välja nagu enne. Vaate CSS: `.fleet-edit-modal …`, `.imp-assign-select, .dev-assign-select`, `.party-role-checkbox …`, `.login-*` `.form-input` reeglid, `.auto-resize-textarea` (kui kasutajaid ei jää).

- [ ] Steps A–E. Commit: `refactor(ui): tehnika, sõitude, osapoolte ja kasutajate vormid ui väljade peale`.

### Task 7: Kaardipaneelid

**Files:** LayerControl.tsx (10 checkbox `layer-label` → CheckboxField; `soil-metric-radio-item` radio → RadioGroup/RadioField; `basemap-cadastre-toggle`), CultivationControl.tsx (`cc-select` 2 + `.cc-time select` 2 → `Select` (md = 32px = `--cc-h`), `cc-input` → DateInput (juba T2), `cc-start-input` → `Input` vaate klassiga, range jääb toorelt `type="range"` esimesena), SatellitePanel.tsx (`satellite-date-select`, `satellite-period-select` → `Select size="sm"`; `satellite-cloudfree` → CheckboxField). Paneelide paigutus ja kõrgus ei tohi muutuda rohkem kui ±2px; `.cc-*` font 600 ja oma fookusrõngas kaovad (ui fookus). Vaate CSS: `.layer-label`, `.soil-metric-radio-item`, `.satellite-cloudfree`, `.satellite-date-row .form-input`, `.cc-select, .cultivation-panel .cc-input, .cc-time` ülekirjutused, mis enam ei kehti.

- [ ] Steps A–E. Commit: `refactor(ui): kaardipaneelide valikud ja märkeruudud ui peale`.

### Task 8: Vana vormi-CSS koristus

**Files:** `src/index.css`; vajadusel `src/components/ui/README.md`.

- [ ] **Step 1:** `npm run ui-audit -- --details` → „Vanu vormivälju (tsx)“ **0**. Kui mitte, vii ülejäänud kohad üle (teisendustabel) ja nimeta need raportis.
- [ ] **Step 2:** Kustuta index.css-ist: `.form-input` (+`:focus`, `::-webkit-calendar-picker-indicator`, `.num`, `.readonly`/`:read-only`, `select.form-input` (+`:read-only`), `.auto-field-input`), `input[type="number"], .form-input[type="number"], .text-right` (kontrolli, et `.text-right` tsx kasutus = 0), `.form-group` (+`label`, `.full-width`), `.form-grid`, `.form-row-3` (+mobiil, `.field-auto-row`), mõlemad `.input-split`, `.input-with-unit`, `.time-select`, `.users-admin-checkbox`, `.crop-winter-toggle`, `.layer-label`, `.soil-metric-radio-item`, `.satellite-cloudfree`, `.work-entry-finish`, `.fw-filter.checkbox`, `.auto-resize-textarea`, ning inventuuri jaotis 6 surnud reeglid (`.fw-search*`, `.pria-line .form-input*`, `.fw-panel-grid label`, `.form-card-header*`, `.date-picker-popup-top`). Enne iga kustutamist: `grep -rnw "<klass>" src --include=*.ts --include=*.tsx` (v.a `src/admin`, kus `admin.css` on oma) → 0 ja dünaamilised nimed puuduvad. Liitselektorites kustuta ainult surnud osa.
- [ ] **Step 3:** Kontrolli, et `src/admin` ei kasuta index.css-i `.form-input`-i (admin.css on eraldi); kui kasutab, jäta reegel admin.css-i või raporteeri.
- [ ] **Step 4:** Kontrollid (tsx, vitest, oxlint, ui-audit), sulgude tasakaal index.css-is (`node -e` loendur), release-logis CSS-hoiatusi pole. Commit `refactor(ui): vanad vormiväljade reeglid index.css-ist välja`, release.
- [ ] **Step 5: Kasutaja visuaalne kontroll** (mõlemas teemas): artikli vorm (ühikud, rühmadega laovalik, tühi valik), laodokumendi read (madalad väljad), põllu muutmise aken (numbrid paremal, komaga sisestus), kultuuride register (talivili, värvivalija, rea muutmine), PRIA read, tööde kanne ja plaan (kuupäev, kalender, lõpetatud), finantside hinnasisend (€/ühik, puuduv hind kollane), otsingukastid ja filtrid tööribadel (X asukoht, 32px kõrgus), tehnika vorm, sõitude filtrid, osapoolte rollid, kasutajate haldus (raadionupud), sisselogimine (oma välimus), kaardi kihid ja kultuurijuhtpaneel, satelliidi kuupäev.
