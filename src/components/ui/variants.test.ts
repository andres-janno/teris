import { describe, expect, it } from 'vitest';
import { auditTsx } from '../../tooling/uiAudit';
import { cn } from './cn';
import * as v from './variants';

const allClassStrings = (): string[] => [
  ...(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'filter', 'link', 'dashed', 'bare', 'text'] as const).flatMap((variant) =>
    (['xs', 'sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon-lg', 'auto', 'add-slot'] as const).map((size) => v.buttonVariants({ variant, size }))
  ),
  ...(['success', 'info', 'warning', 'danger', 'accent', 'neutral'] as const).flatMap((tone) =>
    (['soft', 'solid', 'outline'] as const).flatMap((variant) =>
      (['sm', 'md'] as const).map((size) => v.badgeVariants({ tone, variant, size }))
    )
  ),
  ...(['line', 'segmented'] as const).flatMap((variant) => [v.tabsListVariants({ variant }), v.tabsTriggerVariants({ variant })]),
  v.fieldControlClass, v.menuContentClass, v.menuItemClass, v.menuSeparatorClass, v.menuLabelClass,
  v.popoverContentClass, v.tooltipContentClass,
  v.helpHintTriggerClass, v.helpHintInlineClass, v.helpHintContentClass, v.helpHintTitleClass,
  ...(['x', 'none', 'sm', 'md', 'fill'] as const).map((scroll) => v.tableContainerClass({ scroll, bordered: true })),
  v.tableClass({ bordered: true }),
  ...([undefined, 'start', 'end'] as const).flatMap((pin) => [
    v.tableHeadClass({ pin, numeric: true, sortable: true }), v.tableCellClass({ pin, numeric: true, dense: true }),
  ]),
  ...(['success', 'warning', 'muted', 'group', 'total'] as const).map((tone) => v.tableRowClass({ tone, clickable: true })),
  v.tableFooterClass({ sticky: true }),
  ...(['surface', 'floating', 'tile', 'item', 'option'] as const).flatMap((variant) =>
    (['none', 'sm', 'md'] as const).flatMap((padding) =>
      [true, false].map((interactive) => v.cardVariants({ variant, padding, interactive, selected: interactive }))
    )
  ),
  v.cardHeaderClass({ align: 'center' }), v.cardHeaderClass({ align: 'start' }), v.cardTitleClass, v.cardActionsClass,
  v.filterBarClass, v.filterBarLabelClass, v.filterBarActionsClass, v.filterBarItemClass('sm'), v.filterBarItemClass('md'), v.filterBarItemClass('lg'),
  v.emptyStateClass, v.emptyStateIconClass, v.emptyStateTitleClass, v.emptyStateDescriptionClass,
  v.dialogHeaderIconClass,
  v.chipVariants({ variant: 'tint', dimmed: true }), v.chipVariants({ variant: 'outline' }),
  v.navSwitchClass, v.navSwitchItemClass,
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
    expect(v.badgeVariants({ tone: 'warning' })).toContain('text-warning-text');
    expect(v.badgeVariants()).toContain('text-muted-foreground');
  });
  it('jaluse kinnitatud lahter jääb hover\'il päise toonis', () => {
    expect(v.tableFooterClass({ sticky: true })).toContain('group-hover:bg-table-head');
    expect(v.tableFooterClass()).toContain('[&_tr]:hover:bg-transparent');
  });
  it('ükski variant ei kasuta keelatud suvalisi väärtusi', () => {
    for (const cls of allClassStrings()) expect(auditTsx(`className="${cls}"`).arbitrary).toEqual([]);
  });
  it('läbipaistev ohunupp: punane ikoon, hõljudes kerge punane taust', () => {
    const c = v.buttonVariants({ variant: 'danger-ghost', size: 'icon-sm' });
    expect(c).toContain('text-destructive');
    expect(c).toContain('bg-transparent');
    expect(c).toContain('hover:bg-destructive/15');
  });
  it('ikoonnupud: 20px ja 28px 6px nurgaga, 40px ümmargune; tekstinupud 10px', () => {
    for (const size of ['icon-xs', 'icon-sm'] as const) {
      const c = cn(v.buttonVariants({ size }));
      expect(c, size).toContain('rounded-sm');
      expect(c, size).not.toContain('rounded-md');
    }
    expect(v.buttonVariants({ size: 'icon-xs' })).toContain('size-5');
    expect(v.buttonVariants({ size: 'icon-sm' })).toContain('size-7');
    const lg = cn(v.buttonVariants({ variant: 'primary', size: 'icon-lg' }));
    expect(lg).toContain('size-10');
    expect(lg).toContain('rounded-full');
    expect(cn(v.buttonVariants({ size: 'sm' }))).toContain('rounded-md');
  });
  it('ikoonnupu suurusi on täpselt kolm (kasutaja otsus 2026-11-16)', () => {
    const sizes = Object.keys(v.buttonVariantSizes).filter((s) => s.startsWith('icon'));
    expect(sizes.sort()).toEqual(['icon-lg', 'icon-sm', 'icon-xs']);
  });
  it('mini-nupp xs: 20px, 11px kiri, 6px nurk', () => {
    const c = cn(v.buttonVariants({ size: 'xs' }));
    expect(c).toContain('h-5');
    expect(c).toContain('text-2xs');
    expect(c).toContain('rounded-sm');
  });
  it('valitud olek (aria-pressed): roheline toon ghost ja secondary nupul', () => {
    for (const variant of ['ghost', 'secondary'] as const) {
      const c = v.buttonVariants({ variant });
      expect(c, variant).toContain('aria-pressed:bg-primary/15');
      expect(c, variant).toContain('aria-pressed:text-success-text');
    }
  });
  it('nupu äärevärv on täpselt üks variandis, baasis ei ole ühtegi', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'link', 'dashed', 'bare', 'text'] as const)
      for (const size of ['xs', 'sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon-lg', 'auto', 'add-slot'] as const) {
        const tokens = v.buttonVariants({ variant, size }).split(/\s+/);
        const colors = tokens.filter((t) => t === 'border-transparent' || t === 'border-secondary-border' || t === 'border-border');
        expect(colors, `${variant}/${size}`).toHaveLength(1);
      }
    expect(v.buttonVariants({ variant: 'secondary' })).toContain('border-secondary-border');
    expect(v.buttonVariants({ variant: 'secondary' })).not.toContain('border-transparent');
    for (const variant of ['primary', 'ghost', 'danger', 'danger-ghost', 'bare', 'text'] as const)
      expect(v.buttonVariants({ variant })).toContain('border-transparent');
    expect(v.buttonVariants({ variant: 'dashed' })).toContain('border-border');
  });
  it('keelatud nupp jääb hõljutatavaks ja hõljumisefekt ainult lubatud nupul', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'link', 'dashed', 'bare', 'text'] as const)
      for (const size of ['xs', 'sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon-lg', 'auto', 'add-slot'] as const) {
        const c = v.buttonVariants({ variant, size });
        const tokens = c.split(/\s+/);
        expect(c, `${variant}/${size}`).not.toContain('pointer-events-none');
        expect(tokens, `${variant}/${size}`).toContain('disabled:cursor-not-allowed');
        expect(tokens.filter((t) => t.startsWith('hover:')), `${variant}/${size}`).toEqual([]);
      }
  });
  it('kirjasuurused ainult skaalast', () => {
    const sizes = allClassStrings().flatMap((c) => c.match(/(?<![\w-])text-[a-z0-9-]+/g) ?? []);
    const allowed = /^text-(2xs|xs|sm|base|lg|xl|foreground|muted-foreground|subtle|white|primary|info|warning|destructive|accent|success-text|info-text|warning-text|danger-text|accent-text|on-warning|background|left|right|center)$/;
    for (const s of sizes) expect(s).toMatch(allowed);
  });
});

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

describe('märk', () => {
  it('soft on vaikimisi, solid on täisvärv valge tekstiga', () => {
    expect(v.badgeVariants({ tone: 'success' })).toContain('bg-primary/15');
    const solid = v.badgeVariants({ tone: 'success', variant: 'solid' });
    expect(solid).toContain('bg-primary-strong');
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

  it('menüükirje: ikoonid 16px ega kahane', () => {
    expect(v.menuItemClass).toContain('[&_svg]:size-4');
    expect(v.menuItemClass).toContain('[&_svg]:shrink-0');
    // esiletõst peab olema nähtav (4% bg-muted oli ~1.08:1 — klaviatuuriga kasutaja ei näinud valikut)
    expect(v.menuItemClass).toContain('data-[highlighted]:bg-secondary-hover');
  });
  it('filter-nupp: roheline pill', () => {
    const c = v.buttonVariants({ variant: 'filter' });
    expect(c).toContain('bg-primary-strong');
    expect(c).toContain('rounded-full');
    expect(c).toContain('enabled:hover:bg-primary-hover');
  });
});

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
  it('kaart ei sea teksti värvi; klõpsatav annab kursori ja hoveri', () => {
    expect(v.cardVariants({})).not.toMatch(/(^|\s)text-/);
    const c = v.cardVariants({ interactive: true });
    expect(c).toContain('cursor-pointer');
    expect(c).toContain('hover:bg-card-hover');
  });
  it('nupu lähtestus (font, text-align, color) ei ole utiliit — see on app.css base-kihis ja vaate klass võidab', () => {
    const c = v.cardVariants({ interactive: true });
    expect(c).not.toMatch(/\[font:|(^|\s)text-(left|foreground)(\s|$)/);
  });
  it('hover: valitud kaardi ääris ei nõrgene, valimata kaardil hele roheline', () => {
    expect(v.cardVariants({ interactive: true, selected: true })).not.toContain('hover:border-primary');
    expect(v.cardVariants({ interactive: true, selected: false })).toContain('hover:border-primary/50');
  });
  it('valitud: roheline ääris võidab tavaäärise (cn), lisaks rõngas', () => {
    const c = cn(v.cardVariants({ selected: true }));
    expect(c).toContain('border-primary');
    expect(c).not.toMatch(/(^|\s)border-border(\s|$)/);
    expect(c).toContain('ring-primary');
  });
  it('item: 6px nurk (vana fw-card), option: 10px; mõlemad bg-popover, ei muuda hõljudes tausta', () => {
    const item = cn(v.cardVariants({ variant: 'item', padding: 'none', interactive: true }));
    const option = cn(v.cardVariants({ variant: 'option', padding: 'none', interactive: true }));
    expect(item.split(/\s+/)).toContain('rounded-sm');
    expect(option.split(/\s+/)).toContain('rounded-md');
    for (const c of [item, option]) {
      expect(c.split(/\s+/)).toContain('bg-popover');
      expect(c.split(/\s+/)).toContain('hover:bg-popover');
      expect(c).not.toContain('hover:bg-card-hover');
    }
  });
  it('item hõljudes täisroheline ääris (vana .fw-card:hover), option õrn', () => {
    const item = cn(v.cardVariants({ variant: 'item', interactive: true }));
    const option = cn(v.cardVariants({ variant: 'option', interactive: true }));
    expect(item).toContain('hover:border-primary');
    expect(item).not.toContain('hover:border-primary/50');
    expect(option).toContain('hover:border-primary/50');
  });
  it('item/option padding none ei anna polstriklassi (vaate CSS-i polster kehtib)', () => {
    expect(v.cardVariants({ variant: 'item', padding: 'none' })).not.toMatch(/(^|\s)p-\d/);
  });
  it('päis: joondus keskele või üles', () => {
    expect(v.cardHeaderClass({ align: 'center' })).toContain('items-center');
    expect(v.cardHeaderClass({ align: 'start' })).toContain('items-start');
    expect(v.cardActionsClass).toContain('ml-auto');
  });
});

describe('link-nupp ja dialoogi päis', () => {
  it('link: roheline tavakaalus tekst, alati allajoonitud, murdub reaga, ilma tausta ja äärisvärvita', () => {
    const c = cn(v.buttonVariants({ variant: 'link', size: 'inline' }));
    expect(c).toContain('text-primary');
    expect(c).toContain('bg-transparent');
    expect(c).toContain('border-transparent');
    expect(c.split(/\s+/)).toContain('underline');
    expect(c).toContain('underline-offset-2');
    expect(c).toContain('font-normal');
    expect(c).not.toContain('font-semibold');
    expect(c).not.toContain('whitespace-nowrap');
  });
  it('inline: kõrgus ja polster puuduvad, kirjasuurus pärib ümbritsevast tekstist', () => {
    const c = cn(v.buttonVariants({ variant: 'link', size: 'inline' }));
    expect(c).toContain('h-auto');
    expect(c).toContain('p-0');
    expect(c).toContain('[font-size:inherit]');
  });
  it('dialoogi päise ikoon on roheline (üks koht kõigile dialoogidele)', () => {
    expect(v.dialogHeaderIconClass).toContain('text-primary');
    expect(v.dialogHeaderIconClass).toContain('shrink-0');
  });
});

describe('märkide kontrast', () => {
  it('soft märk kasutab toonitekst-tokenit, mitte põhitooni', () => {
    for (const tone of ['success', 'info', 'warning', 'danger', 'accent'] as const) {
      const c = v.badgeVariants({ tone, variant: 'soft' });
      expect(c, tone).toMatch(/text-(success|info|warning|danger|accent)-text/);
    }
  });
  it('solid hoiatus: tekst on-warning võidab valge (cn)', () => {
    const c = cn(v.badgeVariants({ tone: 'warning', variant: 'solid' }));
    expect(c).toContain('text-on-warning');
    expect(c).not.toMatch(/(^|\s)text-white(\s|$)/);
  });
  it('solid info ja accent kasutavad tumedamat täisvärvi', () => {
    expect(v.badgeVariants({ tone: 'info', variant: 'solid' })).toContain('bg-info-solid');
    expect(v.badgeVariants({ tone: 'accent', variant: 'solid' })).toContain('bg-accent-solid');
  });
});

describe('klaviatuuri fookus', () => {
  it('klõpsatav tabelirida ja kaart näitavad fookust', () => {
    expect(v.tableRowClass({ clickable: true })).toContain('focus-visible:outline-primary');
    expect(v.tableRowClass({})).not.toContain('focus-visible:outline-primary');
    expect(v.cardVariants({ interactive: true })).toContain('focus-visible:ring-2');
    expect(v.cardVariants({})).not.toContain('focus-visible:ring-2');
  });
});

describe('filtririba ja tühi olek', () => {
  it('filtririba murdub, vahe 12px, tegevused paremale', () => {
    expect(v.filterBarClass).toContain('flex-wrap');
    expect(v.filterBarClass).toContain('gap-3');
    expect(v.filterBarActionsClass).toContain('ml-auto');
  });
  it('filtri ümbris: miinimumlaius ja rippmenüü täidab ümbrise', () => {
    expect(v.filterBarItemClass('md')).toContain('min-w-45');
    expect(v.filterBarItemClass('sm')).toContain('min-w-38');
    expect(v.filterBarItemClass('lg')).toContain('min-w-50');
    expect(v.filterBarItemClass('md')).toContain('[&>[data-slot=filter-clear]]:w-full');
  });
  it('tühi olek: keskel, 32px polster, pealkiri 16px, kirjeldus 13px, ikoon summutatud', () => {
    expect(v.emptyStateClass).toContain('p-8');
    expect(v.emptyStateClass).toContain('text-center');
    expect(v.emptyStateTitleClass).toContain('text-lg');
    expect(v.emptyStateDescriptionClass).toContain('text-sm');
    expect(v.emptyStateIconClass).toContain('opacity-40');
  });
});

describe('vigane väli', () => {
  it('aria-invalid annab äärise, punase teksti ja tooni tausta', () => {
    for (const c of ['aria-invalid:border-destructive', 'aria-invalid:text-destructive', 'aria-invalid:bg-destructive/10']) {
      expect(v.fieldControlClass).toContain(c);
    }
    expect(v.fieldShellClass).toContain('has-[input[aria-invalid=true]]:bg-destructive/10');
  });
});

describe('abi-ikoon', () => {
  it('päästik: 24px ümmargune, abi-kursor; inline kitsam (20px)', () => {
    expect(v.helpHintTriggerClass).toContain('size-6');
    expect(v.helpHintTriggerClass).toContain('cursor-help');
    expect(v.helpHintTriggerClass).toContain('rounded-full');
    expect(v.helpHintInlineClass).toContain('size-5');
  });
  it('hüpik on 320px laiune ja kõrguse piiriga', () => {
    expect(v.helpHintContentClass).toContain('w-80');
    expect(v.helpHintContentClass).toContain('max-h-');
  });
});

describe('nupuvariandid etapp 3b', () => {
  it('dashed: katkendjoon, hõljudes täisroheline valge ikooniga (vana .fw-add)', () => {
    const t = v.buttonVariants({ variant: 'dashed', size: 'add-slot' }).split(/\s+/);
    expect(t).toContain('border-dashed');
    expect(t).toContain('enabled:hover:border-solid');
    expect(t).toContain('enabled:hover:bg-primary');
    expect(t).toContain('enabled:hover:text-white');
    expect(t).toContain('text-subtle');
  });
  it('add-slot: 30×40px, 6px nurk, polstrita', () => {
    const t = v.buttonVariants({ variant: 'dashed', size: 'add-slot' }).split(/\s+/);
    expect(t).toContain('w-7.5');
    expect(t).toContain('min-h-10');
    expect(t).toContain('rounded-sm');
    expect(t).not.toContain('h-8');
  });
  it('bare: nähtamatu nupp märgi ümber, hõljudes tõuseb ja tumeneb', () => {
    const t = v.buttonVariants({ variant: 'bare', size: 'inline' }).split(/\s+/);
    expect(t).toContain('bg-transparent');
    expect(t).toContain('rounded-full');
    expect(t).toContain('border-0');
    expect(t).toContain('enabled:hover:-translate-y-px');
    expect(t).toContain('enabled:hover:brightness-92');
  });
  it('text: roheline tavakaalus tekst ilma allajoonimiseta', () => {
    const t = v.buttonVariants({ variant: 'text', size: 'inline' }).split(/\s+/);
    expect(t).toContain('text-primary');
    expect(t).toContain('border-0');
    expect(t).toContain('font-normal');
    expect(t).not.toContain('underline');
  });
});

describe('kiip (ChipButton)', () => {
  it('tint: andmevärviga toon, 6px nurk, 14px kiri', () => {
    const t = v.chipVariants({ variant: 'tint' }).split(/\s+/);
    expect(t).toContain('chip-tint');
    expect(t).toContain('rounded-sm');
    expect(t).toContain('text-base');
  });
  it('outline: ääris ja vasak riba, 10px nurk, 13px kiri', () => {
    const t = v.chipVariants({ variant: 'outline' }).split(/\s+/);
    expect(t).toContain('chip-outline');
    expect(t).toContain('border-l-3');
    expect(t).toContain('rounded-md');
    expect(t).toContain('text-sm');
  });
  it('dimmed: poolläbipaistev, hõljudes heledam', () => {
    expect(v.chipVariants({ variant: 'tint', dimmed: true })).toContain('opacity-50');
    expect(v.chipVariants({ variant: 'tint', dimmed: false })).not.toContain('opacity-50');
  });
  it('ei kasuta keelatud suvalisi väärtusi', () => {
    for (const variant of ['tint', 'outline'] as const)
      for (const dimmed of [true, false]) expect(auditTsx(`className="${v.chipVariants({ variant, dimmed })}"`).arbitrary).toEqual([]);
  });
});

describe('peamenüü (NavSwitch)', () => {
  it('riba: hall raam, 10px nurk, 2px vahe ja polster', () => {
    const t = v.navSwitchClass.split(/\s+/);
    for (const c of ['flex', 'shrink-0', 'gap-0.5', 'p-0.5', 'rounded-md', 'border', 'border-border', 'bg-muted']) expect(t).toContain(c);
  });
  it('kirje: 13px poolpaks, 6/12px polster, 6px nurk', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    for (const c of ['text-sm', 'font-semibold', 'px-3', 'py-1.5', 'rounded-sm', 'gap-1.5']) expect(t).toContain(c);
  });
  it('aktiivne (aria-current=page): heledam roheline --selection-bg, valge tekst', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    expect(t).toContain('aria-[current=page]:bg-selection');
    expect(t).toContain('aria-[current=page]:text-white');
  });
  it('hõljumine ainult aktiivsele mitte: aktiivne jääb rohelisena', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    expect(t).toContain('not-aria-[current=page]:enabled:hover:bg-muted-hover');
    expect(t).toContain('not-aria-[current=page]:enabled:hover:text-foreground');
  });
  it('ei kasuta keelatud suvalisi väärtusi', () => {
    expect(auditTsx(`className="${v.navSwitchClass} ${v.navSwitchItemClass}"`).arbitrary).toEqual([]);
  });
});
