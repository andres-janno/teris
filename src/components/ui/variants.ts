// src/components/ui/variants.ts — kõigi ühiste komponentide variandiklassid ühes kohas (testitud: ainult skaala
// väärtused, mitte suvalisi). Väärtused järgivad praegust identiteeti (.btn, .form-input, .modal-content index.css-is).
import { cva } from 'class-variance-authority';
import { cn } from './cn';
import type { BadgeTone, BadgeVariant } from '../../types/badgeTone';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

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
  // Tahvli tühja lahtri „lisa töö“-ruut (vana .fw-add): 30×40px, 6px nurk.
  'add-slot': 'min-h-10 w-7.5 rounded-sm p-0',
} as const;

export const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-all cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-linear-135 from-primary-from to-primary-to text-white shadow-primary enabled:hover:from-primary-strong enabled:hover:to-primary-from enabled:hover:shadow-primary-hover enabled:hover:-translate-y-px',
        secondary:
          'bg-secondary border-secondary-border text-foreground enabled:hover:bg-secondary-hover aria-pressed:border-primary/40 aria-pressed:bg-primary/15 aria-pressed:text-success-text',
        ghost:
          'border-transparent bg-transparent text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground aria-pressed:bg-primary/15 aria-pressed:text-success-text',
        danger: 'border-transparent bg-danger-solid text-white enabled:hover:bg-danger-solid/90',
        // Läbipaistev ohunupp (vana .icon-btn-danger): punane ikoon, hõljudes kerge punane taust.
        'danger-ghost': 'border-transparent bg-transparent text-destructive enabled:hover:bg-destructive/15',
        // Päise operaatorivalija (vana .operator-selector-trigger): roheline pill, hõljudes heledam. Kasuta size="auto".
        filter:
          'rounded-full border-transparent bg-primary-strong text-white shadow-primary enabled:hover:bg-primary-hover enabled:hover:shadow-primary-hover',
        // Tekstilink nupuna (vana .link-button, .assign-hint-link, .cc-link-btn): tavakaalus roheline tekst, alati allajoonitud, murdub reaga.
        link: 'border-transparent bg-transparent font-normal whitespace-normal text-primary underline underline-offset-2',
        // Katkendjoonega „lisa“-ruut: hõljudes täisroheline valge ikooniga (vana .fw-add). Kasuta size="add-slot".
        dashed:
          'border-dashed border-border bg-transparent font-normal text-subtle enabled:hover:border-solid enabled:hover:border-primary enabled:hover:bg-primary enabled:hover:text-white',
        // Nupp, mis ümbritseb muud ui elementi (klõpsatav märk): ise nähtamatu, hõljudes tõuseb ja tumeneb. Kasuta size="inline".
        bare:
          'rounded-full border-0 border-transparent bg-transparent font-normal enabled:hover:-translate-y-px enabled:hover:brightness-92 enabled:hover:shadow-sm',
        // Tekst nupuna: tavakaalus roheline tekst, ilma allajoonimiseta (hõljumise vihje on vaate asi). Kasuta size="inline".
        text: 'border-0 border-transparent bg-transparent font-normal whitespace-normal text-primary',
        // Kogu rea laiune nupp, mille välimuse (taust, polster, ääris, paigutus) annab vaate CSS: ainult nupu lähtestus
        // (kiri ja värv päritakse). Vana div role="button" asendus; kasuta size="inline". Vaate reegel, mis peab utiliidi üle võitma, vajab !important.
        plain: 'w-full rounded-none border-0 border-transparent bg-transparent text-left font-normal whitespace-normal text-inherit [line-height:inherit]',
      },
      size: buttonVariantSizes,
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export type { BadgeTone, BadgeVariant };

// Märk: soft (hele toon, vaikimisi), solid (täisvärv — rõhutatud olek, kasutaja otsus 2026-11-14), outline (ääris).
export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium', {
  variants: {
    tone: { success: '', info: '', warning: '', danger: '', accent: '', neutral: '' } satisfies Record<BadgeTone, string>,
    variant: { soft: 'border-transparent', solid: 'border-transparent text-white', outline: 'bg-popover text-foreground' } satisfies Record<BadgeVariant, string>,
    size: { sm: 'px-2 py-0.5 text-2xs', md: 'px-2.5 py-1 text-xs' },
  },
  compoundVariants: [
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
  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium text-muted-foreground transition-colors cursor-pointer enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`,
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
  'w-full rounded-sm border border-input bg-field text-sm text-foreground placeholder:text-subtle transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:bg-destructive/10 aria-invalid:focus-visible:ring-destructive/30';

/** Vormivälja suurus: md 32px (vaikimisi, nagu nupp md), sm 28px tabeli ridades (kasutaja otsus 2026-11-15). */
export type FieldSize = 'sm' | 'md';
export const fieldSizeClass: Record<FieldSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-2.5 text-sm',
};
/** Eesliite/järelliitega välja ümbris: ääris ja fookus ümbrisel, sees äärisetu input. */
export const fieldShellClass =
  'flex w-full items-center gap-1.5 rounded-sm border border-input bg-field text-foreground transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:bg-destructive/10';

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
export const helpHintTitleClass = 'mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground';
export const tooltipContentClass = 'z-2100 max-w-72 rounded-sm bg-foreground px-2 py-1 text-xs text-background';

// --- Kaart (etapp 2.7) ---
// Kasutaja otsused 2026-11-15: taust alati tahke (ilma klaasi ja backdrop-filter'ita, ka kaardi peal ujuvatel
// paneelidel); nurk kaart/paneel 16px, sisemine plaat 10px; üks kaardi vari, ujuv paneel ühe astme võrra
// tugevam, plaat varjuta. Kaart ei sea teksti värvi (pärib vanemalt); klõpsatav seab, sest <button> ei päri.
export type CardVariant = 'surface' | 'floating' | 'tile' | 'item' | 'option';
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
      // Valitav tahvlikaart (töökaart): 6px nurk, tahke taust nagu dialoog. Tegelik kuju (polster, laius) tuleb vaate CSS-ist.
      item: 'rounded-sm bg-popover',
      // Valitav rida/valik (lisatava töö valik, soovitus): 10px nurk, tahke taust.
      option: 'rounded-md bg-popover',
    },
    // none: klassi ei anta — vaate CSS-i oma polster (nt väike kaardinäit) jääb kehtima.
    padding: { none: '', sm: 'p-3', md: 'p-4' },
    interactive: {
      // Nupu lähtestus (font, text-align, color) on app.css base-kihis (button[data-slot="card"]), et vaate klass (legacy) kirjasuuruse kaotamata võidaks.
      true: 'cursor-pointer transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      false: '',
    },
    selected: { true: 'border-primary ring-1 ring-primary', false: '' },
  },
  // Hõljumisel hele roheline ääris ainult valimata kaardil: valitud kaardi täisäärist ei nõrgendata.
  compoundVariants: [
    { interactive: true, selected: false, className: 'hover:border-primary/50' },
    // item/option: hõljudes taust ei muutu (vanad kaardid ei muutnud); item'il täisroheline ääris nagu vana .fw-card:hover.
    { variant: ['item', 'option'], interactive: true, className: 'hover:bg-popover' },
    { variant: 'item', interactive: true, selected: false, className: 'hover:border-primary' },
  ],
  defaultVariants: { variant: 'surface', padding: 'md', interactive: false, selected: false },
});

/** Kaardi päis: pealkiri vasakul, tegevused paremal. */
export const cardHeaderClass = ({ align = 'center' }: { align?: 'center' | 'start' } = {}): string =>
  cn('flex justify-between gap-3', align === 'start' ? 'items-start' : 'items-center');
export const cardTitleClass = 'm-0 text-base font-semibold';
export const cardActionsClass = 'ml-auto flex shrink-0 items-center gap-1';

/** Dialoogi päise ikoon: alati põhivärv (kasutaja otsus 2026-11-16) — vaade annab ainult ikooni, mitte värvi. */
export const dialogHeaderIconClass = 'flex shrink-0 items-center text-primary';

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
    clickable && 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
  );

export const tableFooterClass = ({ sticky = false }: { sticky?: boolean } = {}): string =>
  cn(
    'bg-muted font-semibold [&_tr]:hover:bg-transparent',
    // Jaluse kinnitatud lahtrid jäävad hover'il päise toonis (PIN_BG group-hover muidu värviks need).
    sticky && '[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:z-[2] [&>tr>td]:bg-table-head [&>tr>td]:group-hover:bg-table-head'
  );

// --- Filtririba ja tühi olek (etapp 3) ---
export const filterBarClass = 'flex flex-wrap items-center gap-3';
export const filterBarLabelClass = 'inline-flex items-center gap-1.5 text-sm font-medium';
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

// --- Kiip (etapp 3b): valitav, andmevärviga. `chip-*` on @utility-d src/styles/app.css-is (taust ja riba tulevad
// CSS-muutujast --chip-accent; leading-natural hoiab kõrguse vana nupu (UA line-height: normal) sama, mida ChipButton seab). ---
export type ChipVariant = 'tint' | 'outline';
export const chipVariants = cva(
  `inline-flex shrink-0 cursor-pointer items-center gap-1.5 transition-colors disabled:cursor-default ${focusRing}`,
  {
    variants: {
      variant: {
        // Andmevärviga toonitud kiip (kultuur): taust ja vasak riba värvist, valituna ümber 2px rõngas.
        tint: 'chip-tint rounded-sm border-0 px-3 py-1 text-base leading-natural text-foreground',
        // Äärisega kiip (omandivorm): vasak serv 3px värvitud, valituna ümber 2px rõngas.
        outline: 'chip-outline rounded-md border border-l-3 border-border bg-field px-3 py-1.5 text-sm leading-natural text-foreground enabled:hover:border-subtle',
      },
      dimmed: { true: 'opacity-50 enabled:hover:opacity-85', false: '' },
    },
    defaultVariants: { variant: 'tint', dimmed: false },
  }
);

// --- Peamenüü (etapp 3b): navigatsioonirida, aktiivne = aria-current="page" (mitte Radix Tabs/ToggleGroup). ---
// Aktiivne on heledam roheline --selection-bg (kasutaja otsus 2026-11-16: jääb, kontrastist hoolimata).
export const navSwitchClass = 'flex shrink-0 gap-0.5 rounded-md border border-border bg-muted p-0.5';
export const navSwitchItemClass = `inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm border-0 bg-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors not-aria-[current=page]:enabled:hover:bg-muted-hover not-aria-[current=page]:enabled:hover:text-foreground aria-[current=page]:bg-selection aria-[current=page]:text-white leading-natural ${focusRing}`;

/** Jaotise pealkiri (etapp 4.1; vanad .form-sub-header, .form-section-title, .section-title, .section-subtitle):
    12px poolpaks suurtäht; ruled = joon all (vormi alajaotis), spaced = 16px ülavahe. */
export const sectionTitleLabelClass = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';
export const sectionTitleClass = ({ ruled = false, spaced = false }: { ruled?: boolean; spaced?: boolean } = {}): string =>
  cn('mb-2 flex items-center gap-1.5', sectionTitleLabelClass, ruled && 'border-b border-border pb-1', spaced && 'mt-4');

/** Näitaja plaat (etapp 4.1; vanad .finance-kpi-*, .trip-tile*, .admin-stat): silt + suur number + alt. */
export type StatTone = 'default' | 'cost' | 'revenue' | 'profit' | 'loss';
export const statTileClass = ({ tone = 'default' }: { tone?: StatTone } = {}): string =>
  cn('flex min-w-0 flex-col gap-1', tone === 'profit' && 'border-primary bg-primary/4', tone === 'loss' && 'border-destructive bg-destructive/4');
export const statTileLabelClass = sectionTitleLabelClass;
export const statTileValueClass = ({ tone = 'default', empty = false }: { tone?: StatTone; empty?: boolean } = {}): string =>
  cn(
    'text-xl font-semibold leading-6 tabular-nums whitespace-nowrap [&_strong]:font-semibold',
    tone === 'cost' && 'text-destructive',
    tone === 'revenue' && 'text-primary',
    tone === 'profit' && 'text-success-text dark:text-primary',
    tone === 'loss' && 'text-danger-text dark:text-destructive',
    empty && 'font-normal text-subtle'
  );
export const statTileUnitClass = 'text-sm font-normal text-muted-foreground';
export const statTileSubClass = 'text-xs text-muted-foreground [&_strong]:font-semibold';
export const statTileNoteClass = 'mt-1.5 text-xs leading-4 text-muted-foreground';

/** Legendi kirje (etapp 4.1; vanad .finance-cost-item, .soil-legend-item, .trip-timesplit-item): värvimärk + nimi [+ väärtus + märkus]. */
export const legendItemClass = 'inline-flex items-center gap-1.5 text-xs text-muted-foreground';
export const legendMarkerClass = 'size-2.5 shrink-0 rounded-full';
export const legendValueClass = 'font-semibold tabular-nums text-foreground';
export const legendNoteClass = 'text-2xs text-subtle';

/** Vaate päis (etapp 4.1; vanad .fullpage-board-header, .fleet-board-header jt): ikoon (20px), pealkiri, alapealkiri, tegevused paremal. */
export const pageHeaderClass = 'flex flex-wrap items-center gap-x-4 gap-y-2.5';
export const pageHeaderTitleWrapClass = 'flex min-w-0 items-center gap-2.5';
export const pageHeaderIconClass = 'flex shrink-0 items-center [&>svg]:size-5';
export const pageHeaderTitleClass = 'm-0 text-xl font-semibold leading-6 text-foreground';
export const pageHeaderSubtitleClass = 'mt-0.5 text-sm text-muted-foreground';
export const pageHeaderActionsClass = 'ml-auto flex flex-wrap items-center gap-2.5';

/** Rida „silt: väärtus“ (etapp 4.1; vanad .finance-summary-row, .fmc-row). */
export const keyValueRowClass = 'flex items-baseline justify-between gap-3 text-base leading-natural tabular-nums';
export const keyValueLabelClass = 'shrink-0';
export const keyValueValueClass = 'min-w-0 text-right';

/** Nurgas olev tegevusnupp (vana .fw-field-shape-corner): põllu kuju nupp lahtri paremas ülanurgas.
    Edastatakse `Button wrapperClassName`-ina; vanemal peab olema `relative` (või `sticky`). Kasutavad tahvel, Põldude tabel ja Külvikord. */
export const cornerActionClass = 'absolute top-1.5 right-1.5';

/** Edenemisriba (vana .work-progress-bar): 8px kõrge, täitub vasakult. Kasutavad tahvli töö paneel ja kande dialoog. */
export const progressTrackClass = 'h-2 overflow-hidden rounded-sm bg-muted';
export const progressFillClass = 'h-full rounded-sm bg-primary';

/** Tühja oleku kast (tahvli kanded ja töö plaani vorm): punktiirääris, vaikne tekst. */
export const emptyBoxClass = 'rounded-md border border-dashed border-border px-3 py-2.5 text-sm leading-natural text-subtle';
/** Alamrubriigi pealkiri (tahvli töö paneel ja töö plaani vorm). */
export const subheadingClass = 'text-xs font-semibold leading-natural text-muted-foreground';

// --- Tehnika ja sõidud (etapp 4c) ---
/** Ikoon või emoji ruudus. sm 28px (registri lahter, toon), md 36px (masina avatar; ääre värv tuleb andmest: style.borderColor), lg 40px (kaardi päis). */
export const iconBoxVariants = cva('flex shrink-0 items-center justify-center', {
  variants: {
    size: { sm: 'size-7 rounded-sm text-base', md: 'size-9 rounded-md border-2', lg: 'size-10 rounded-md text-xl' },
    tone: {
      neutral: 'bg-muted',
      info: 'bg-info/15 text-info',
      success: 'bg-primary/15 text-success-text',
      warning: 'bg-warning-solid/15 text-warning-solid',
    },
  },
  defaultVariants: { size: 'sm', tone: 'neutral' },
});

/** Kaartide ruudustik (masinad, haakeriistad, seadmed): automaatsed ≥ 360px veerud. */
export const cardGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3';
/** Tehnika registri sektsioon (filtririba, tabel, tühi olek): täidab lehe kõrguse, tabel kerib ise. Peab olema Tehnika vaate sisu (kerituv flex-veerg) otsene laps. */
export const registerSectionClass = 'flex min-h-0 flex-1 basis-0 flex-col gap-4';

// Haakimiste ja seadmete seoste registri lahtrid
export const fleetCellMainClass = 'flex items-center gap-2';
export const fleetCellTitleClass = 'text-sm font-medium leading-natural';
export const fleetCellDateClass = 'text-sm font-medium leading-natural';
export const fleetCellDateEndClass = 'text-sm leading-natural text-muted-foreground';
export const fleetDurationClass = ({ active = false }: { active?: boolean } = {}): string =>
  cn('text-xs font-medium leading-natural', active ? 'text-primary' : 'text-subtle');
export const fleetNotesClass = ({ empty = false }: { empty?: boolean } = {}): string =>
  cn('text-xs leading-natural text-subtle', empty && 'italic');
// Haakimise/seose vorm: kuupäev + kellaaeg ühel real, lõppaja vihje välja all
export const dateTimeRowClass = 'grid grid-cols-[minmax(0,1fr)_110px] gap-2';
export const dateTimeHintClass = 'min-h-4.5 text-xs leading-natural text-muted-foreground';

// --- Kaardi paneelid (etapp 4d) ---
/** Kaardi ujuvpaneeli pealkirjarida: ikoon + 14px poolpaks tekst (Kaardikihid, Hooaeg). Vahe on kutsuja asi (`gap-1.5` jne). */
export const mapPanelTitleClass = 'flex items-center gap-2 text-base font-semibold leading-natural text-foreground';
/** Laadimisikoon (Loader2): roheline, pöörleb; aeglustub, kui kasutaja on vähendatud liikumise valinud (vana `layerSpin` + `@media (prefers-reduced-motion)`). */
export const loadingSpinnerClass = 'shrink-0 animate-spin text-primary motion-reduce:[animation-duration:3s]';
/** Sama, kuid 6px vasak vahe teksti kõrval (kihtide paneeli rida, satelliidipaneeli pealkiri). */
export const loadingSpinnerInlineClass = cn(loadingSpinnerClass, 'ml-1.5');

// --- Dialoogid ja registrid (etapp 4e) ---
/** Teatekast. error: punane ääris + taust (vana .alert-box.error); success/info/warning: ainult taust ja toonitekst, ääris puudub (vana admin.css: border-width oli 0);
    neutral: ilma toonita (vana .alert-box ilma modifikaatorita). sm: kitsam polster (vana .is-compact). Veeris ja paigutus (`m-2`, `justify-between`, `flex-col`) tuleb kutsujalt. */
export const alertVariants = cva('flex items-center gap-2.5 rounded-sm text-sm leading-natural', {
  variants: {
    tone: {
      error: 'border border-destructive/35 bg-destructive/12 text-danger-text',
      success: 'bg-primary/15 text-success-text',
      info: 'bg-info/12 text-info-text',
      warning: 'bg-warning/15 text-warning-text',
      neutral: '',
    },
    size: { md: 'px-3 py-2.5', sm: 'px-3 py-2' },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

/** Tabelilahtri/kaardi alamrida (11px, hallim): sama ilme Tehnikas, Külvikorras, Kultuurides, sõidu dialoogis. */
export const cellSubClass = 'text-2xs text-subtle';
/** Alamrida teksti all tabelilahtris (vana `[data-slot="table"] .cell-sub`: 2px ülaveeris). */
export const cellSubStackedClass = cn(cellSubClass, 'mt-0.5');

/** Registrikaart (Isikud, Taristu): veerg gap 12px; päis: avatar + nimi + alamtekst; inforead 12px. Vana .vehicle-card / .v-* (v-name jääb MapMarkers HTML-stringi jaoks). */
export const infoCardClass = 'flex flex-col gap-3';
export const infoCardTitleWrapClass = 'flex items-center gap-2.5';
export const infoCardNameClass = 'm-0 text-base font-medium leading-natural text-foreground';
export const infoCardSubClass = 'text-xs leading-natural text-muted-foreground';
export const infoRowsClass = 'flex flex-col gap-1 text-xs leading-natural';
export const infoRowClass = 'flex items-center gap-1.5';

/** Tabeli nimelahter (Külvikord, Kultuurid): põllu/kultuuri nimi 14px/400; pealkirjarida; alamsildid; summutatud tekst (vana `.name-cell .field-name` jt, `.muted`). */
export const tableNameClass = 'm-0 text-base font-normal text-foreground';
export const tableTitleLineClass = 'flex flex-wrap items-center gap-2';
export const tableSubTagsClass = 'mt-1 flex flex-wrap items-center gap-1.5';
export const tableMutedClass = 'text-subtle';

/** Töö kande ja plaani vormi kere (Põllutööd: kande dialoog, plaani vorm, töö lisamine): veerg gap 12px, kerib. Vana `.work-entry-body`, `.add-work-body`. */
export const dialogStackBodyClass = 'flex flex-col gap-3 overflow-y-auto';
/** Töö vormi väljaruudustik (veerud tulevad vaatelt): gap 10px, väljad alla joondatud. Vana `.work-entry-grid`. */
export const workFormGridClass = 'grid items-end gap-2.5';
/** Töö vormi jaotis: pealkiri h4 14px/600 + sisu, gap 8px. Vana `.work-entry-section`. */
export const workFormSectionClass = 'flex flex-col gap-2 [&>h4]:m-0 [&>h4]:text-base [&>h4]:font-semibold [&>h4]:leading-natural [&>h4]:text-foreground';
/** Töö vormi vihje (12px, hall, ikooniga). Vana `.work-entry-hint`. */
export const workFormHintClass = 'm-0 flex items-start gap-1.5 text-xs leading-natural text-muted-foreground';

/** Mulla ja ilma tabeli väärtus (põllu muutmise aken): kaal 400, toon tuleb data-level atribuudist. Vana `.soil-value[data-level]`. */
export const soilValueClass = 'font-normal data-[level=bad]:text-danger-text data-[level=warn]:text-warning-text data-[level=good]:text-success-text data-[level=none]:text-subtle';
/** Mulla ja ilma tabeli joonealune märkus (11px). Vana `.soil-footnote`. */
export const soilFootnoteClass = 'mt-1 text-2xs text-muted-foreground';
/** Mulla ja ilma tabeli aasta lahter (chevron/aasta/vanus ühes reas). Vana `.soil-year-cell`. */
export const soilYearCellClass = 'inline-flex items-center gap-1 font-medium';
