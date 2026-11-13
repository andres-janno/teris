// src/components/ui/variants.ts — kõigi ühiste komponentide variandiklassid ühes kohas (testitud: ainult skaala
// väärtused, mitte suvalisi). Väärtused järgivad praegust identiteeti (.btn, .form-input, .modal-content index.css-is).
import { cva } from 'class-variance-authority';

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
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-8 px-4 text-sm',
        // Ikoonnupud: 6px nurk nagu vanadel .icon-btn-* (tekstinupud 10px).
        'icon-xs': 'size-5 rounded-sm',
        'icon-sm': 'size-7 rounded-sm',
        icon: 'size-8 rounded-sm',
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
