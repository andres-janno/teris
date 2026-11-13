# Etapp 2.2 — dialoogid ui/Dialog peale (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik 41 modaalakent (vt inventuur) kasutavad ühist Radix-põhist `ui/Dialog`-i; ühtne välimus, viis laiust, ühtne sulgemine; vanad `.modal-*` reeglid kaovad põhirakenduse CSS-ist.

**Architecture:** `ui/Dialog` täiendatakse: 6 suurust, kiht `alert` kinnitusakna jaoks, sisu paigutus ilma transformi/filtrita, `DialogForm`, päise ikoon, ja **hüpikute konteiner** (React context) — DateInput, FilterSelect ja HelpHint portaalivad dialoogi sees dialoogi sisuelementi (muidu teeks Radixi modaalne lukk need klõpsamatuks ja klõps neile sulgeks akna). Üleminek käib **perekondade kaupa**, et migreeritud ja vana modaal ei oleks kunagi üksteise peal. Iga ülesanne = commit + release.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Radix (`radix-ui` Dialog), Vitest (node env — DOM-teste pole).

**Spec:** docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md (3. osa, samm 2.2). Inventuur: docs/superpowers/plans/2026-11-13-dialoogid-inventuur.md (numbrid #1–#41 viitavad sinna).

## Global Constraints

- Keskkond: kohalik kaust on sshfs-mount. Faile muuda mount'i kaudu; **git, npm, npx ainult serveris**: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'`.
- Töö käib otse `master`-is. Iga ülesanne = commit(id) + release: `npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` (EXIT=134 → korda `NODE_OPTIONS=--max-old-space-size=1500 npm run release …`), siis `systemctl is-active teris` → `active`.
- Kontrollid enne commit'i: `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run src/tooling src/components/ui`; `npx oxlint <muudetud failid>`.
- Identifikaatorid inglise keeles; kommentaarid ja UI-tekst eesti keeles. Commit-sõnumid eesti keeles nagu repos.
- Vaate failides (väljaspool `src/components/ui/`) **Tailwindi klasse ei kasutata** (Tailwind skaneerib ainult `ui/`-d). Ainult `ui/` komponendid + nende prop'id + vanad paigutus-/sisuklassid.
- `src/index.css` on kaskaadikihis `legacy` (enne `utilities`): ui utiliidid võidavad vana mitte-`!important` reegli; vana `!important` võidab utiliidi.
- Kasutaja otsused (2026-11-13): **laiused 5 + sisu järgi**: `sm` 440, `md` 640, `lg` 840, `xl` 1240, `full` min(1600px, 96vw), `fit` (sisu järgi, ainult hooaegade register). **Sulgemine:** Esc sulgeb kõik aknad (v.a sundparooli vahetus ja kui salvestamine käib); taustaklõps ei sulge ühtegi vormiakent; kinnitus- ja teateaken sulguvad ka taustaklõpsuga.
- Ulatusest väljas: `src/admin/`, `src/landing/`; kaardi kontekstimenüü (FieldContextMenu) ja kaardi põllukast (FieldMapCard) — need pole modaalid.

## Üleminekuretsept (kõik ülesanded T4–T9)

Enne → pärast:

```tsx
// enne
if (!isOpen) return null;
return (
  <div className="modal-backdrop sub-modal" onClick={close}>
    <div className="modal-content animate-scale-up foo-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <div className="modal-title-group">
          <Pencil size={20} className="text-emerald" />
          <div><h3>Muuda</h3><p className="modal-subtitle">Kaasiku</p></div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={close}><X size={20} /></Button>
      </div>
      <div className="modal-body">…</div>
      <div className="modal-footer">…</div>
    </div>
  </div>
);

// pärast
if (!isOpen) return null;
return (
  <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent size="md" className="foo-modal">
      <DialogHeader icon={<Pencil size={20} className="text-emerald" />} title="Muuda" description="Kaasiku" />
      <DialogBody>…</DialogBody>
      <DialogFooter>…</DialogFooter>
    </DialogContent>
  </Dialog>
);
```

Reeglid:

1. **Suurus** — sisu lisaklassi järgi:

   | `size` | klassid (praegune laius) |
   |---|---|
   | `sm` | change-password-modal (420), confirm-dialog (440), swap-modal-card (520) |
   | `md` | work-form-modal (560), users-edit-modal (560), season-edit-modal (560), add-work-modal (600), vaikimisi `.modal-content` (640) |
   | `lg` | fleet-edit-modal, crop-edit-modal, poi-edit-modal, party-edit-modal, fw-work-modal (720), field-shape-modal (760), poi-modal (840), field-edit-modal (980) |
   | `xl` | users-admin-modal (1100), work-entry-modal (1180), work-register-modal (1240), finance-modal (1320) + `fillHeight` |
   | `full` | field-register-modal (registrite overlay: #11, #13) |

   Klass, mida tabelis pole (nt `trip-dialog`, `stock-doc-modal`, `weather-credential-modal`, `glass-card` üleslaadimised): `grep -nE "\.<klass>\b" src/index.css` → leia laius; kui laiust pole, kehtib vaikimisi 640 → `md`. Vali lähim suurus; võrdsel kaugusel suurem. Kirjuta raportisse.
2. **Sulgemine:** eemalda akna oma Esc-kuulaja, mis ainult sulgeb (Radix teeb seda; pesastatud akendest sulgeb Esc ainult pealmise). Kui kuulaja tegi muud ka, vt ülesande juhist. Salvestamise ajal: `dismissible={!busy}`. Taustaklõpsu loogika (`onClick={close}` taustal, `stopPropagation` sisul) kustuta — `DialogContent` ei sulgu taustaklõpsuga.
3. **Vorm sisu juurena** (`<form className="modal-content …" onSubmit>`): `<DialogContent …><DialogForm onSubmit={…}>päis, keha, jalus</DialogForm></DialogContent>`.
4. **Sisu lisaklassid** jäävad: akna lisaklass → `DialogContent className`, kehaklass (nt `finance-modal-body`) → `DialogBody className`. Vana `.foo-modal { width/max-height }` kaotab utiliidile (see on eesmärk). Kontrolli iga lisaklassi reeglit: kui see seadis midagi muud kui laius/kõrgus/taust/ääris/nurk/vari (nt `display:grid` sisule, `gap`), jääb see kehtima; kui sisu sõltus `.modal-body`/`.modal-header` omadusest, mida ui komponent ei anna, kirjuta raportisse.
5. **Pesastamine:** alamaken on oma `<Dialog>` (võib olla Reacti puus ema sees). Eemalda `createPortal` ümbrised, `sub-modal`, `stacked` klassid ja prop'id — Radix kihistab DOM-järjekorra järgi.
6. **Päis:** `modal-title-group` ikoon → `icon`, `h3` → `title`, `modal-subtitle` → `description`. Lisanupud päises (pealkirja ja sulgemisnupu vahel) → `DialogHeader` lapsed. Vana sulgemisnupp kustuta (DialogHeader lisab oma). Kui päis on keerulisem (sakid, otsing), pane `DialogHeader title=…` ja ülejäänu `DialogBody` algusesse; kirjuta raportisse.
7. **Vaikimisi tingimuslik renderdus jääb** (`if (!isOpen) return null` / `{open && <X/>}`), Dialog alati `open`. Väljumisanimatsiooni pole — see on lubatud.
8. **Leaflet kaart dialoogis** (#25, #28): kui kaart luuakse mount'il, kutsu pärast avamist `map.invalidateSize()` (nt `requestAnimationFrame`), kui seda juba pole; kontrolli, et kaardi konteineril on kõrgus.
9. **Vaates Tailwindi klasse ei lisata.** Kui sisu vajab paigutust, kasuta olemasolevat vana klassi või ui komponendi prop'i.
10. **Valmis**, kui `npm run ui-audit -- --details` rida „Vanu modaaliklasse (tsx)“ ei näita ülesande faile.

---

### Task 1: ui/Dialog täiendus, mõõdik vanadele modaaliklassidele, näidised

**Files:**
- Modify: `src/components/ui/variants.ts`, `src/components/ui/variants.test.ts`
- Modify: `src/components/ui/Dialog.tsx`, `src/components/ui/index.ts`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`
- Modify: `src/tooling/uiAudit.ts`, `src/tooling/uiAudit.test.ts`, `scripts/ui-audit.mts`

**Interfaces:**
- Produces: `dialogContentClass({ size, layer, fillHeight }): string`; `DialogContent` prop'id `size: 'sm'|'md'|'lg'|'xl'|'full'|'fit'` (vaikimisi `md`), `layer: 'default'|'alert'`, `fillHeight?: boolean`, `closeOnOutsideClick?: boolean` (vaikimisi false), `dismissible?: boolean` (vaikimisi true); `DialogHeader` prop'id `icon?`, `showClose?` (vaikimisi true); `DialogForm`; `DialogTitle`, `DialogDescription`; `usePopupContainer(): HTMLElement`; `auditTsx().legacyModals: string[]`, `AuditReport.legacyModalFiles`.

- [ ] **Step 1: Failivad testid** — `variants.test.ts` lõppu:

```ts
describe('dialogContentClass', () => {
  it('suurused annavad kokkulepitud laiused', () => {
    expect(v.dialogContentClass({ size: 'sm' })).toContain('w-[min(440px,94vw)]');
    expect(v.dialogContentClass({ size: 'md' })).toContain('w-[min(640px,94vw)]');
    expect(v.dialogContentClass({ size: 'lg' })).toContain('w-[min(840px,96vw)]');
    expect(v.dialogContentClass({ size: 'xl' })).toContain('w-[min(1240px,96vw)]');
    expect(v.dialogContentClass({ size: 'full' })).toContain('w-[min(1600px,96vw)]');
    expect(v.dialogContentClass({ size: 'fit' })).toContain('w-max');
    expect(v.dialogContentClass({})).toContain('w-[min(640px,94vw)]');
  });
  it('kõrgus: max 92vh, fillHeight annab fikseeritud kõrguse', () => {
    expect(v.dialogContentClass({})).toContain('max-h-[92vh]');
    expect(v.dialogContentClass({ fillHeight: true })).toContain('h-[min(880px,92vh)]');
    expect(v.dialogContentClass({})).not.toContain('h-[min(880px,92vh)]');
  });
  it('sisu ei kasuta transformi ega filtrit (fixed hüpikud sees peavad jääma akna suhtes paika)', () => {
    for (const size of ['sm', 'md', 'lg', 'xl', 'full', 'fit'] as const) {
      const c = v.dialogContentClass({ size });
      expect(c, size).not.toMatch(/(^|\s)-?translate-|(^|\s)(blur|backdrop-blur|scale-|rotate-)/);
    }
  });
  it('kiht: tavaline z-2000, kinnitus z-5000 (vanade modaalide ja menüüde kohal)', () => {
    expect(v.dialogLayerClass('default')).toBe('z-2000');
    expect(v.dialogLayerClass('alert')).toBe('z-5000');
  });
  it('ei kasuta keelatud suvalisi väärtusi', () => {
    for (const size of ['sm', 'md', 'lg', 'xl', 'full', 'fit'] as const)
      expect(auditTsx(`className="${v.dialogContentClass({ size, fillHeight: true })}"`).arbitrary).toEqual([]);
  });
});
```

`uiAudit.test.ts` lõppu:

```ts
describe('auditTsx: vanad modaaliklassid', () => {
  it('loeb vanad modaali osad', () => {
    const src = `<div className="modal-backdrop sub-modal"><div className="modal-content animate-scale-up x">
<div className="modal-header"><div className="modal-title-group"><p className="modal-subtitle" /></div></div>
<div className="modal-body" /><div className="modal-footer" /></div></div>
<div className="modal-backdrop confirm-dialog-backdrop" /><span className="modal-title-with-icon modal-icon-badge" />`;
    expect(auditTsx(src).legacyModals).toEqual([
      'modal-backdrop', 'sub-modal', 'modal-content', 'modal-header', 'modal-title-group', 'modal-subtitle',
      'modal-body', 'modal-footer', 'modal-backdrop', 'confirm-dialog-backdrop', 'modal-title-with-icon', 'modal-icon-badge',
    ]);
  });
  it('ei loe vaatepõhiseid klasse ega ui komponente', () => {
    const src = `<DialogContent className="finance-modal fleet-edit-modal" /><div className="finance-modal-body season-modal-body" />`;
    expect(auditTsx(src).legacyModals).toEqual([]);
  });
  it('summarize annab failid', () => {
    const r = summarize([
      { path: 'a.tsx', content: '<div className="modal-backdrop"><div className="modal-content" /></div>' },
      { path: 'b.tsx', content: '<DialogContent size="md" />' },
    ]);
    expect(r.legacyModalFiles).toEqual([{ path: 'a.tsx', count: 2 }]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/tooling src/components/ui` → FAIL (`dialogContentClass`, `dialogLayerClass`, `legacyModals` puuduvad).

- [ ] **Step 3: variants.ts** lõppu:

```ts
const DIALOG_SIZES = {
  sm: 'w-[min(440px,94vw)]',
  md: 'w-[min(640px,94vw)]',
  lg: 'w-[min(840px,96vw)]',
  xl: 'w-[min(1240px,96vw)]',
  full: 'w-[min(1600px,96vw)]',
  // Sisu järgi (hooaegade register): kitsamal ekraanil kerib.
  fit: 'w-max max-w-[98vw]',
} as const;
export type DialogSize = keyof typeof DIALOG_SIZES;

const DIALOG_LAYERS = { default: 'z-2000', alert: 'z-5000' } as const;
export type DialogLayer = keyof typeof DIALOG_LAYERS;

/** Dialoogi kiht: tavaline 2000 (Leafleti ≤1000 kohal), kinnitus/teade 5000 (kõigi vanade modaalide ja menüüde kohal). */
export const dialogLayerClass = (layer: DialogLayer): string => DIALOG_LAYERS[layer];

/** Dialoogi sisu: ilma transformi/filtrita, et position:fixed hüpikud sees jääksid akna suhtes paika. */
export const dialogContentClass = ({ size = 'md', fillHeight = false }: { size?: DialogSize; fillHeight?: boolean }): string =>
  [
    'pointer-events-auto flex max-h-[92vh] flex-col overflow-hidden rounded-lg border border-border bg-popover text-foreground shadow-dialog focus:outline-none',
    DIALOG_SIZES[size],
    fillHeight ? 'h-[min(880px,92vh)]' : '',
  ].filter(Boolean).join(' ');
```

**Dialog.tsx** — asenda kogu fail:

```tsx
// src/components/ui/Dialog.tsx — ühine dialoog (asendab .modal-backdrop/.modal-content ja vaatepõhised modaalid).
// Radix: fookuse lõks, Esc, taustakerimise lukk; pesastatud aknad kihistuvad DOM-järjekorra järgi.
// Sulgemine (kasutaja otsus 2026-11-13): Esc sulgeb; taustaklõps ainult siis, kui closeOnOutsideClick (kinnitus/teade).
import React, { createContext, useContext, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { dialogContentClass, dialogLayerClass, type DialogLayer, type DialogSize } from './variants';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// Hüpikud (kuupäev, otsinguga valik, vihje) portaalivad dialoogi sees dialoogi sisuelementi: Radixi modaalne lukk
// teeb muu lehe klõpsamatuks ja klõps väljaspool sisu loeks akna sulgemiseks.
const PopupContainerContext = createContext<HTMLElement | null>(null);
/** Kuhu hüpik portaalida: avatud dialoogi sisu või document.body. */
export const usePopupContainer = (): HTMLElement => useContext(PopupContainerContext) ?? document.body;

type DialogContentProps = Omit<React.ComponentProps<typeof DialogPrimitive.Content>, 'onInteractOutside'> & {
  size?: DialogSize;
  layer?: DialogLayer;
  /** Fikseeritud kõrgus min(880px, 92vh) (nt finantsid, kus sisu täidab akna). */
  fillHeight?: boolean;
  /** Taustaklõps sulgeb — ainult kinnitus- ja teateaken. */
  closeOnOutsideClick?: boolean;
  /** false: Esc ega taust ei sulge (sundparool, salvestamine käib). */
  dismissible?: boolean;
};

export const DialogContent: React.FC<DialogContentProps> = ({
  size = 'md', layer = 'default', fillHeight = false, closeOnOutsideClick = false, dismissible = true,
  className, children, onEscapeKeyDown, ...props
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn('fixed inset-0 bg-overlay backdrop-blur-sm', dialogLayerClass(layer))} />
      {/* Paigutus flexiga, mitte transformiga; ümbris ise klõpse ei püüa (klõps läheb taustale). */}
      <div className={cn('pointer-events-none fixed inset-0 flex items-center justify-center p-4', dialogLayerClass(layer))}>
        <DialogPrimitive.Content
          ref={setContainer}
          className={cn('animate-scale-up', dialogContentClass({ size, fillHeight }), className)}
          onInteractOutside={(e) => {
            if (!dismissible || !closeOnOutsideClick) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
            onEscapeKeyDown?.(e);
          }}
          {...props}
        >
          <PopupContainerContext.Provider value={container}>{children}</PopupContainerContext.Provider>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
};

interface DialogHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ikoon pealkirja ees (vana .modal-title-group). */
  icon?: React.ReactNode;
  /** false: sulgemisnuppu pole (nt sundparool). */
  showClose?: boolean;
  /** Lisanupud pealkirja ja sulgemisnupu vahel. */
  children?: React.ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ title, description, icon, showClose = true, children }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
    <div className="flex min-w-0 items-center gap-3">
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
        {description && <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">{description}</DialogPrimitive.Description>}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {children}
      {showClose && (
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Sulge" title="Sulge">
            <X size={16} />
          </Button>
        </DialogPrimitive.Close>
      )}
    </div>
  </div>
);

/** Vorm akna sisu juurena: päis, keha ja jalus vormi sees (submit Enteriga). */
export const DialogForm: React.FC<React.ComponentProps<'form'>> = ({ className, ...props }) => (
  <form className={cn('flex min-h-0 flex-1 flex-col', className)} {...props} />
);

export const DialogBody: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4', className)} {...props} />
);

export const DialogFooter: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-end gap-2.5 border-t border-border px-6 py-3', className)} {...props} />
);
```

Märkus: `animate-scale-up` on vana klass index.css-is (0,2 s, ilma fill-mode'ita — transform kaob animatsiooni lõpus). Seda ei kustutata koristuses.

**index.ts** dialoogi rida:

```ts
export {
  Dialog, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogContent, DialogHeader, DialogForm, DialogBody,
  DialogFooter, usePopupContainer,
} from './Dialog';
```

**uiAudit.ts**: lisa

```ts
// Vanad modaaliklassid (etapp 2.2). Vaatepõhised sisuklassid (finance-modal jne) ei loe.
const LEGACY_MODAL =
  /(?<![\w-])(modal-backdrop|sub-modal|confirm-dialog-backdrop|modal-content|modal-header|modal-title-group|modal-title-with-icon|modal-icon-badge|modal-subtitle|modal-body|modal-footer)(?![\w-])/g;
```

`auditTsx` tagastusse `legacyModals: [...src.matchAll(LEGACY_MODAL)].map((m) => m[1]),`; `AuditReport`-i `legacyModalFiles: { path: string; count: number }[];`; `summarize`-i `legacyModalFiles: tsx.filter((t) => t.legacyModals.length > 0).map((t) => ({ path: t.path, count: t.legacyModals.length })),`. `scripts/ui-audit.mts` lõppu rida `'Vanu modaaliklasse (tsx)'` samamoodi kui „Vanu nupuklasse (tsx)“.

- [ ] **Step 4:** testid → PASS.

- [ ] **Step 5: Näidised.** UiGallery dialoogi plokis asenda `DialogBody className="flex flex-col gap-3"` → `DialogBody` (gap tuleb komponendist) ja lisa kuupäev ja otsinguga valik dialoogi sisse käsitsi kontrolliks (T2 järel peavad need töötama):

```tsx
<Field label="Kuupäev" htmlFor="d-date"><DateInput id="d-date" value={date} onChange={setDate} /></Field>
```

(Impordi `DateInput` failist `'../DateInput'` ja vaata tema prop'id failist; lisa `const [date, setDate] = useState('')` või failis kasutatav väärtuse kuju.) Lisa teine nupp „Ava suur dialoog“, mis avab `size="xl"` dialoogi, ja kolmas „Kinnitus“, mis kutsub `confirmDialog('Kas soovid kindlasti kustutada?')` (`'../ConfirmDialog'`). README.md dialoogi jaotisse: suurused, `dismissible`, `closeOnOutsideClick`, `DialogForm`, `usePopupContainer` ja selle plaani üleminekuretsept lühidalt.

- [ ] **Step 6:** tsc, vitest, oxlint, `npm run ui-audit -- --details` (rida „Vanu modaaliklasse (tsx)“ baas raportisse). Commit `feat(ui): Dialog suurused, kinnituskiht, DialogForm, hüpikute konteiner; ui-audit loeb vanu modaaliklasse`. Release.

---

### Task 2: Hüpikvidinad dialoogi sees (DateInput, FilterSelect, HelpHint)

**Files:** Modify `src/components/DateInput.tsx`, `src/components/FilterSelect.tsx`, `src/components/HelpHint.tsx`

**Interfaces:** Consumes `usePopupContainer` (`./ui`).

- [ ] **Step 1: Portaal.** Igas failis: `const popupContainer = usePopupContainer();` komponendi kehas (hook, enne tingimuslikke return'e) ja `createPortal(…, document.body)` → `createPortal(…, popupContainer)`.
- [ ] **Step 2: Esc sulgeb ainult hüpiku.** Radixi Esc-kuulaja on `document` capture-faasis, seega hüpiku Esc peab olema `window` capture'is ja peatama sündmuse (nagu FilterSelect juba teeb):
  - DateInput (read ~82–92): asenda `handleKeyDown` + `document.addEventListener('keydown', handleKeyDown)` sellega:

```ts
    // Esc sulgeb ainult kalendri, mitte ümbritsevat akent (window capture jõuab enne dialoogi kuulajaid)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
```

  - HelpHint (read ~60–71): sama muster `onKey`-le (`window`, capture, `stopPropagation` + `preventDefault` + `close()`).
  - FilterSelect: Esc juba õige; muuda ainult portaal.
- [ ] **Step 3: Positsioneerimine.** Hüpikud kasutavad `position: fixed` + `getBoundingClientRect()` — dialoogi sisu ei kasuta transformi (T1), seega koordinaadid kehtivad. Kontrolli, et ükski vidin ei arvuta asukohta `document.body` või `offsetParent` suhtes; kui arvutab, raporteeri (ära muuda loogikat).
- [ ] **Step 4:** tsc, vitest, oxlint. Commit `fix(ui): kuupäeva-, valiku- ja vihjehüpikud portaalivad dialoogi sisse, Esc sulgeb ainult hüpiku`. Release.
- [ ] **Step 5: Kontroll /ui lehel** (kasutaja visuaalne kontroll koondatakse lõppu; raportisse kirjuta, mida kontrollida): dialoogis avaneb kalender, kuupäeva saab valida, Esc sulgeb esmalt kalendri ja teisel korral akna.

---

### Task 3: ConfirmDialog ui/Dialog peale

**Files:** Modify `src/components/ConfirmDialog.tsx`

- [ ] **Step 1:** Asenda `Dialog` komponendi tagastus (failis oma nimega `Dialog` — nimeta see ümber `ConfirmView`, et ei põrkuks `ui` `Dialog`-iga) ja impordi `import { Button, Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from './ui';`:

```tsx
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onResult(kind === 'alert'); }}>
      <DialogContent
        size="sm"
        layer="alert"
        closeOnOutsideClick
        className="confirm-dialog"
        role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="confirm-dialog-body">
          <span className={`confirm-dialog-icon ${danger ? 'danger' : kind === 'alert' ? 'info' : 'warning'}`}>
            <Icon size={20} />
          </span>
          <div>
            <DialogTitle asChild><h3>{title}</h3></DialogTitle>
            <DialogDescription asChild><p>{message}</p></DialogDescription>
          </div>
        </div>
        <DialogFooter>
          {kind === 'confirm' && (
            <Button type="button" variant="ghost" onClick={() => onResult(false)}>
              {options.cancelLabel ?? 'Loobu'}
            </Button>
          )}
          <Button ref={confirmRef} type="button" variant={danger ? 'danger' : 'primary'} onClick={() => onResult(true)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
```

- [ ] **Step 2:** `useEffect`-ist eemalda `confirmRef.current?.focus()` (teeb `onOpenAutoFocus`). **Jäta alles** window-capture Esc-kuulaja koos `stopImmediatePropagation`-iga: vanad modaalid kuulavad Esc-i `document`-il ja ilma selleta sulguks ka akna taga olev vana modaal. `show()`/`previousFocus` loogika jääb muutmata.
- [ ] **Step 3:** Kontrolli `.confirm-dialog`, `.confirm-dialog-body`, `.confirm-dialog-icon` reegleid index.css-is: laius kaotab `sm`-ile (440, ok); `padding` vms, mis sõltus `.modal-content`-ist, kirjuta raportisse.
- [ ] **Step 4:** tsc, vitest, oxlint. Commit `refactor(ui): kinnitus- ja teateaken ui/Dialog peale`. Release.

---

### Task 4: Üksikud aknad

**Files (Modify):** `src/components/WeatherCredentialModal.tsx` (#3), `src/components/ChangePasswordModal.tsx` (#4), `src/components/AiConnectionModal.tsx` (#5), `src/components/FieldUploadModal.tsx` (#8), `src/components/SoilSampleUploadModal.tsx` (#9), `src/components/FieldBookUploadModal.tsx` (#10)

- [ ] **Step 1:** Üleminekuretsept. Erijuhud:
  - ChangePasswordModal: sisu on `<form>` → `DialogForm`. `forced`: `dismissible={!forced}`, `DialogHeader showClose={!forced}`. `onOpenChange` kutsub `close` ainult siis, kui `!forced`.
  - Üleslaadimisaknad (#8–#10): kui üleslaadimine käib (busy/uploading olek failis), `dismissible={!busy}`; leia oleku nimi failist.
  - `glass-card` lisaklass: kontrolli, mida see seab (taust/äär/vari kaotavad utiliidile — ok); paigutusomadused jäävad.
- [ ] **Step 2:** Kontroll (retsepti reegel 10), tsc, vitest, oxlint. Commit `refactor(ui): üksikud aknad ui/Dialog peale (ilm, parool, AI, üleslaadimised)`. Release.

---

### Task 5: Kasutajad, tööde register, hooajad, asukohad (F3, F4, F7)

**Files (Modify):** `src/components/UsersAdminModal.tsx` (#1, #2), `src/components/WorkRegisterModal.tsx` (#6, #7), `src/components/SeasonManagerModal.tsx` (#17 + surnud haru), `src/components/PoiManagerModal.tsx` (#18 + surnud haru), `src/App.tsx` (ainult surnud harude prop'id)

- [ ] **Step 1:** Üleminekuretsept. Alamaken (#2, #7) on oma `Dialog` ema sees (reegel 5).
  - #2: Esc tegi `setMode('list')` (sulgeb ainult vormi) — see on nüüd alamakna `onOpenChange` → `setMode('list')`. Eemalda `stopPropagation` taustal.
  - #1 sulgus taustaklõpsuga — enam mitte (kasutaja otsus).
- [ ] **Step 2: Surnud overlay-harud.** SeasonManagerModal ja PoiManagerModal: App.tsx annab alati `isFullPage` (kontrolli `grep -n "SeasonManagerModal\|PoiManagerModal" src/App.tsx`). Kustuta komponendist mitte-täislehe haru (`modal-backdrop` …) ja `isFullPage` prop, kui see muutub mõttetuks; eemalda prop App.tsx-ist. Kui leiad mõne teise kasutuskoha, mis annab `isFullPage={false}` või ei anna seda, ära kustuta — raporteeri.
- [ ] **Step 3:** Kontroll (reegel 10), tsc, vitest, oxlint. Commit `refactor(ui): kasutajate, tööde registri, hooaegade ja asukohtade aknad ui/Dialog peale`. Release.

---

### Task 6: Masinapark (F5)

**Files (Modify):** `src/components/VehicleTracker.tsx` (#19–#23 + surnud haru ~2322), `src/components/DeviceAssignmentRegister.tsx` (#24), `src/components/TripDialog.tsx` (#25), `src/components/TripGapReviewDialog.tsx` (#26), `src/App.tsx` (ainult surnud haru prop)

- [ ] **Step 1:** Üleminekuretsept.
  - VehicleTracker vormid #19–#22 jagavad Esc-kuulajat (rida ~584), mis nullib kõik vormi olekud. Asenda: iga vormi `onOpenChange` kutsub sama tühistamisfunktsiooni, mida Esc-kuulaja kutsus; seejärel kustuta Esc-kuulaja, kui see ei tee midagi muud.
  - #23 swap: `size="sm"`.
  - #25 TripDialog: Leaflet (reegel 8). Oma document-capture Esc + `stopPropagation` (rida ~44) kustuta, kui see ainult sulges.
  - #26: sama Esc-kuulaja kustutamine.
- [ ] **Step 2:** VehicleTracker surnud haru (~2322): reegel nagu T5 Step 2.
- [ ] **Step 3:** Kontroll, tsc, vitest, oxlint. Commit `refactor(ui): masinapargi aknad ui/Dialog peale`. Release.

---

### Task 7: Laoseis (F6)

**Files (Modify):** `src/components/ArticleFormDialog.tsx` (#34), `src/components/ArticleMergeDialog.tsx` (#35), `src/components/ArticleCategoriesDialog.tsx` (#36), `src/components/ArticleStockCard.tsx` (#37), `src/components/StockDocumentDialog.tsx` (#38), `src/components/InventoryDialog.tsx` (#39), `src/components/HarvestLotDialog.tsx` (#40), `src/components/WarehousesPanel.tsx` (#41)

- [ ] **Step 1:** Üleminekuretsept. Kõigil on oma document-capture Esc + `stopPropagation` — kustuta (Radix). #39, #40: Esc ainult kui `!busy` → `dismissible={!busy}`. #41 sisu on `<form>` → `DialogForm`.
- [ ] **Step 2:** Kontroll, tsc, vitest, oxlint. Commit `refactor(ui): laoseisu aknad ui/Dialog peale`. Release.

---

### Task 8: Põld ja registrid (F1) + põllu kuju

**Files (Modify):** `src/components/FieldEditDialog.tsx` (#33), `src/components/RelatedPartiesModal.tsx` (#11, #12), `src/components/CropRegisterModal.tsx` (#13, #14, #15), `src/components/FieldShapeModal.tsx` (#28), `src/components/FieldManagerModal.tsx` (surnud haru ~702), `src/App.tsx`

- [ ] **Step 1:** Üleminekuretsept. Registrite overlay (#11, #13): `size="full"`; nende vormid (#12, #14, #15) on oma `Dialog`-id registri sees.
  - **`stacked` kaob:** eemalda prop RelatedPartiesModal ja CropRegisterModal komponentidest ning App.tsx-ist (read ~2058, ~2075). Radix paneb hiljem avatud akna peale (lahendab ka inventuuri „kontrollimata vea“ kaardilt avatud põllu puhul).
  - Registrite täislehe-režiim (kui komponent toetab nii täislehte kui overlay't): muuda ainult overlay-haru.
  - FieldEditDialog #33: sisu on `<form>` → `DialogForm`; oma Esc-kuulaja (document bubbling + stopPropagation, ~319–326) kustuta.
  - FieldShapeModal #28: Leaflet (reegel 8); sulgus ka taustaklõpsuga — enam mitte.
- [ ] **Step 2:** FieldManagerModal surnud haru: reegel nagu T5 Step 2.
- [ ] **Step 3: Pesastuse kontroll koodist:** FieldEditDialog → „Seotud isikud“/„Kultuurid“ avab registri; registri vormid avanevad registri peal. Kirjuta raportisse, kuidas renderdusjärjekord tagab, et register on FieldEditDialogi peal (hiljem avatud → hiljem portaalitud).
- [ ] **Step 4:** Kontroll, tsc, vitest, oxlint. Commit `refactor(ui): põllu, registrite ja põllu kuju aknad ui/Dialog peale`. Release.

---

### Task 9: Tööde tahvel (F2)

**Files (Modify):** `src/components/FieldWorksBoard.tsx` (#29, #30), `src/components/FinanceModal.tsx` (#27), `src/components/FieldWorkEntryDialog.tsx` (#31), `src/components/AddFieldWorkDialog.tsx` (#32)

- [ ] **Step 1:** Üleminekuretsept.
  - #29 töö paneel (`size="lg"`): praegu portaal + taustaklõps sulgeb → enam mitte (kasutaja otsus). FieldWorksBoardi window-Esc (~232–240) tegi: 1. Esc lõpetab plaani muutmise, 2. Esc sulgeb paneeli; välja lülitatud, kui kanne või finantsid on avatud. Uus loogika: **#30 „Muuda plaani“ saab oma pesastatud `Dialog`-i** (`size="xl"`, praegu inline #29 sees) — `onOpenChange` → `setEditingPlan(false)`; #29 `onOpenChange` → `setSelectedId(null)`. Radix sulgeb Esc-iga ainult pealmise, seega window-Esc-kuulaja kustuta, kui see ei tee midagi muud (kui teeb, raporteeri ja jäta see osa alles).
  - #27 FinanceModal: `size="xl" fillHeight`. Võib avaneda #29 peal — Radix kihistab.
  - #31 FieldWorkEntryDialog: avaneb ka App.tsx:1994 kaardilt (üksi) — sama komponent, ei vaja eraldi tööd. Oma Esc-kuulaja (~308–314) kustuta.
  - #32: oma Esc-kuulaja kustuta.
- [ ] **Step 2:** Kontroll, tsc, vitest, oxlint. Commit `refactor(ui): tööde tahvli aknad ui/Dialog peale`. Release.

---

### Task 10: Koristus — vanad modaalireeglid põhirakenduse CSS-ist välja

**Files:** Modify `src/index.css`, `src/admin/admin.css` (vajadusel)

- [ ] **Step 1:** `npm run ui-audit -- --details` — „Vanu modaaliklasse (tsx)“ = 0. Kui mitte, ära jätka; raporteeri jäänud failid.
- [ ] **Step 2: Admin.** `grep -rhoE "modal-[a-z-]+|sub-modal|confirm-dialog[a-z-]*" src/admin --include=*.tsx | sort | uniq -c`. Adminis kasutatavad reeglid (koos `:hover`, kombineeritud selektoritega) vii `src/admin/admin.css` algusesse kommentaariga `/* Vanad modaaliklassid — põhirakendus kasutab ui/Dialog (etapp 2.2), admin veel neid. */`.
- [ ] **Step 3: Kustuta index.css-ist** `.modal-backdrop` (+ `.sub-modal`, `.stacked`, `.sub-modal.stacked`, `.confirm-dialog-backdrop` variandid), `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-title-group`, `.modal-subtitle`, `.modal-title-with-icon`, `.modal-icon-badge` ja kõik kontekstireeglid, mis neid nimetavad (`grep -nE "modal-(backdrop|content|header|body|footer|title-group|subtitle|title-with-icon|icon-badge)|sub-modal|\.stacked" src/index.css`). Enne iga kustutamist: `grep -rn "<klass>" src --include=*.tsx --include=*.ts | grep -v src/admin` tühi (v.a uiAudit regex/test ja ui/README.md). **Jäta alles** `.animate-scale-up` ja `@keyframes scaleUp` (ui/Dialog kasutab) ning vaatepõhised sisuklassid, mida vaated veel kasutavad; nende laiuse/kõrguse read võib kustutada, kui klass on nüüd ainult `DialogContent`-il (utiliit võidab niikuinii) — kirjuta raportisse.
- [ ] **Step 4: Ehitatud CSS:** pärast release'i `grep -c "\.modal-backdrop{" dist/assets/main-*.css` → 0; adminis ≥1, kui admin kasutab.
- [ ] **Step 5:** `npm run ui-audit` → uus baas raportisse. tsc, vitest. Commit `refactor(ui): vanad modaalireeglid välja index.css-ist`. Release.
- [ ] **Step 6: Kasutaja visuaalne kontroll** (mõlemas teemas): kinnitusaken (kustutamine), parooli muutmine, tööde tahvel (töö paneel → muuda plaani → Esc kaks korda; finantsid paneeli pealt), põllu muutmine → kultuuride register → kultuuri vorm (kolm akent üksteise peal), masina vorm kuupäevaga (kalender aknas, Esc sulgeb enne kalendri), sõidu dialoog (kaart), laoseisu dokument (kuupäev), artikli laokaart (otsinguga valik), kasutajate aken.
