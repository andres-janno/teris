// src/components/ui/variants.ts — kõigi ühiste komponentide variandiklassid ühes kohas (testitud: ainult skaala
// väärtused, mitte suvalisi). Väärtused järgivad praegust identiteeti (.btn, .form-input, .modal-content index.css-is).
import { cva } from 'class-variance-authority';
import { cn } from './cn';
import type { BadgeTone, BadgeVariant } from '../../types/badgeTone';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold transition-all cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-linear-135 from-primary-from to-primary-to text-white shadow-primary enabled:hover:from-primary-strong enabled:hover:to-primary-from enabled:hover:shadow-primary-hover enabled:hover:-translate-y-px',
        secondary: 'bg-secondary border-secondary-border text-foreground enabled:hover:bg-secondary-hover',
        ghost: 'border-transparent bg-transparent text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground',
        danger: 'border-transparent bg-danger-solid text-white enabled:hover:bg-danger-solid/90',
        // Läbipaistev ohunupp (vana .icon-btn-danger): punane ikoon, hõljudes kerge punane taust.
        'danger-ghost': 'border-transparent bg-transparent text-destructive enabled:hover:bg-destructive/15',
        // Päise operaatorivalija (vana .operator-selector-trigger): roheline pill, hõljudes heledam. Kasuta size="auto".
        filter:
          'rounded-full border-transparent bg-primary-strong text-white shadow-primary enabled:hover:bg-primary-hover enabled:hover:shadow-primary-hover',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-8 px-4 text-sm',
        // Ikoonnupud: 6px nurk nagu vanadel .icon-btn-* (tekstinupud 10px).
        'icon-xs': 'size-5 rounded-sm',
        'icon-sm': 'size-7 rounded-sm',
        icon: 'size-8 rounded-sm',
        // Kõrgus sisu järgi (kahe reaga nupp, nt filter-pill): vana .operator-selector-trigger 6px 12px.
        auto: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export type { BadgeTone, BadgeVariant };

// Märk: soft (hele toon, vaikimisi), solid (täisvärv — rõhutatud olek, kasutaja otsus 2026-11-14), outline (ääris).
export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold', {
  variants: {
    tone: { success: '', info: '', warning: '', danger: '', accent: '', neutral: '' } satisfies Record<BadgeTone, string>,
    variant: { soft: 'border-transparent', solid: 'border-transparent text-white', outline: 'bg-popover text-foreground' } satisfies Record<BadgeVariant, string>,
    size: { sm: 'px-2 py-0.5 text-2xs', md: 'px-2.5 py-1 text-xs' },
  },
  compoundVariants: [
    { variant: 'soft', tone: 'success', class: 'bg-primary/15 text-primary' },
    { variant: 'soft', tone: 'info', class: 'bg-info/15 text-info' },
    { variant: 'soft', tone: 'warning', class: 'bg-warning/15 text-warning' },
    { variant: 'soft', tone: 'danger', class: 'bg-destructive/15 text-destructive' },
    { variant: 'soft', tone: 'accent', class: 'bg-accent/15 text-accent' },
    { variant: 'soft', tone: 'neutral', class: 'bg-muted text-muted-foreground' },
    { variant: 'solid', tone: 'success', class: 'bg-primary-strong' },
    { variant: 'solid', tone: 'info', class: 'bg-info' },
    { variant: 'solid', tone: 'warning', class: 'bg-warning' },
    { variant: 'solid', tone: 'danger', class: 'bg-danger-solid' },
    { variant: 'solid', tone: 'accent', class: 'bg-accent' },
    { variant: 'solid', tone: 'neutral', class: 'bg-foreground text-background' },
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
      // Hooaasta valik: eraldi nupud ilma raamita (nagu enne ühtlustamist)
      pills: 'gap-1',
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
        line: '-mb-px border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground',
        segmented:
          'rounded-sm border-0 bg-transparent px-2.5 py-1 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm',
        // Hall nupp, valitu täisroheline valge kirjaga (kasutaja soov 2026-11-15: hooaja valik nagu enne)
        pills:
          'rounded-sm border border-border bg-muted px-2.5 py-1 text-xs text-foreground enabled:hover:bg-muted-hover data-[state=on]:border-primary-strong data-[state=on]:bg-primary-strong data-[state=on]:text-white data-[state=on]:shadow-primary enabled:data-[state=on]:hover:bg-primary-strong',
      },
    },
    defaultVariants: { variant: 'line' },
  }
);

/** Sisestusväljade (Input, Textarea, Select) ühine välimus; kõrguse/vahed lisab komponent. */
export const fieldControlClass =
  'w-full rounded-sm border border-input bg-field text-sm text-foreground placeholder:text-subtle transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30';

/** Vormivälja suurus: md 32px (vaikimisi, nagu nupp md), sm 28px tabeli ridades (kasutaja otsus 2026-11-15). */
export type FieldSize = 'sm' | 'md';
export const fieldSizeClass: Record<FieldSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-2.5 text-sm',
};
/** Eesliite/järelliitega välja ümbris: ääris ja fookus ümbrisel, sees äärisetu input. */
export const fieldShellClass =
  'flex w-full items-center gap-1.5 rounded-sm border border-input bg-field text-foreground transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input[aria-invalid=true]]:border-destructive';

/** Hüpikud on dialoogi (z 2000) kohal, et dialoogi sees avatud menüü oleks nähtav. */
export const menuContentClass =
  'z-2100 min-w-40 overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-dialog';
export const menuItemClass =
  'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-secondary-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';
export const menuSeparatorClass = 'my-1 h-px bg-border';
export const menuLabelClass = 'px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-subtle';

export const popoverContentClass =
  'z-2100 w-72 overflow-y-auto rounded-md border border-border bg-popover p-3 text-sm text-foreground shadow-dialog outline-none';
/** Abivihje (?) ikoonnupp: 24px, nupu sees (inline) 20px ja nupu teksti kõrval kitsamalt; hõljudes/avatuna roheline. */
export const helpHintTriggerClass =
  'inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 text-subtle transition-colors hover:bg-primary/15 hover:text-primary data-[state=open]:bg-primary/15 data-[state=open]:text-primary focus-visible:outline-none focus-visible:bg-primary/15 focus-visible:text-primary';
export const helpHintInlineClass = 'size-5 -my-0.5 -mr-1 ml-0.5';
/** Abivihje hüpik: 320px, kõrguse piir ja kerimine. */
export const helpHintContentClass = 'w-80 max-h-[min(24rem,var(--radix-popover-content-available-height))]';
export const helpHintTitleClass = 'mb-1.5 text-2xs font-bold uppercase tracking-wide text-muted-foreground';
export const tooltipContentClass = 'z-2100 max-w-72 rounded-sm bg-foreground px-2 py-1 text-xs text-background';

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
      // Nupu lähtestus (font, text-align, color) on app.css base-kihis (button[data-slot="card"]), et vaate klass (legacy) kirjasuuruse kaotamata võidaks.
      true: 'cursor-pointer transition-colors hover:bg-card-hover',
      false: '',
    },
    selected: { true: 'border-primary ring-1 ring-primary', false: '' },
  },
  // Hõljumisel hele roheline ääris ainult valimata kaardil: valitud kaardi täisäärist ei nõrgendata.
  compoundVariants: [{ interactive: true, selected: false, className: 'hover:border-primary/50' }],
  defaultVariants: { variant: 'surface', padding: 'md', interactive: false, selected: false },
});

/** Kaardi päis: pealkiri vasakul, tegevused paremal. */
export const cardHeaderClass = ({ align = 'center' }: { align?: 'center' | 'start' } = {}): string =>
  cn('flex justify-between gap-3', align === 'start' ? 'items-start' : 'items-center');
export const cardTitleClass = 'm-0 text-base font-semibold';
export const cardActionsClass = 'ml-auto flex shrink-0 items-center gap-1';

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
    'sticky top-0 z-[2] whitespace-nowrap border-b border-border bg-table-head text-2xs font-semibold uppercase tracking-wide text-muted-foreground',
    dense ? 'px-1.5 py-1' : 'px-2.5 py-2',
    numeric ? 'text-right' : 'text-left',
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
  cn(
    'bg-muted font-semibold [&_tr]:hover:bg-transparent',
    // Jaluse kinnitatud lahtrid jäävad hover'il päise toonis (PIN_BG group-hover muidu värviks need).
    sticky && '[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:z-[2] [&>tr>td]:bg-table-head [&>tr>td]:group-hover:bg-table-head'
  );
