import { describe, expect, it } from 'vitest';
import { auditTsx } from '../../tooling/uiAudit';
import { cn } from './cn';
import * as v from './variants';

const allClassStrings = (): string[] => [
  ...(['default', 'cost', 'revenue', 'profit', 'loss'] as const).flatMap((tone) => [v.statTileClass({ tone }), v.statTileValueClass({ tone }), v.statTileValueClass({ tone, empty: true })]),
  v.statTileLabelClass, v.statTileUnitClass, v.statTileSubClass, v.statTileNoteClass,
  v.legendItemClass, v.legendMarkerClass, v.legendValueClass, v.legendNoteClass,
  v.dialogStackBodyClass, v.workFormGridClass, v.workFormSectionClass, v.workFormHintClass, v.soilValueClass, v.soilFootnoteClass, v.soilYearCellClass, v.infoNoticeClass, v.statChipLabelClass, v.statChipNumClass, v.statChipSubClass, v.registerIconBoxClass,
  v.keyValueRowClass, v.keyValueLabelClass, v.keyValueValueClass, v.cornerActionClass,
  v.progressTrackClass, v.progressFillClass, v.emptyBoxClass, v.subheadingClass,
  v.pageHeaderClass, v.pageHeaderTitleWrapClass, v.pageHeaderIconClass, v.pageHeaderTitleClass, v.pageHeaderSubtitleClass, v.pageHeaderActionsClass,
  v.mapPanelTitleClass, v.loadingSpinnerClass, v.loadingSpinnerInlineClass,
  v.infoCardClass, v.infoCardTitleWrapClass, v.infoCardNameClass, v.infoCardSubClass, v.infoRowsClass, v.infoRowClass,
  v.tableNameClass, v.tableTitleLineClass, v.tableSubTagsClass, v.tableMutedClass,
  v.boardViewClass, v.boardMainClass, v.boardBodyClass, v.boardContentClass, v.boardFooterClass,
  v.registerActionsBarClass, v.registerHeaderControlsClass, v.registerIoButtonsClass, v.searchFieldClass, v.yearSelectorGroupClass, v.yearLabelClass, v.dialogHeaderControlsClass, v.dialogActionsBarClass,
  ...(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'filter', 'link', 'dashed', 'bare', 'text', 'plain'] as const).flatMap((variant) =>
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
  v.headerTriggerClass, v.headerNarrowHiddenClass, v.headerChevronClass,
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
  v.sectionTitleLabelClass, v.sectionTitleClass(), v.sectionTitleClass({ ruled: true, spaced: true }),
  ...(['sm', 'md', 'lg'] as const).flatMap((size) => (['neutral', 'info', 'success', 'warning'] as const).map((tone) => v.iconBoxVariants({ size, tone }))),
  v.cardGridClass, v.registerSectionClass, v.fleetCellMainClass, v.fleetCellTitleClass, v.cellSubClass, v.cellSubStackedClass, v.fleetCellDateClass, v.fleetCellDateEndClass,
  v.fleetDurationClass({ active: true }), v.fleetDurationClass({}), v.fleetNotesClass({ empty: true }), v.fleetNotesClass({}), v.dateTimeRowClass, v.dateTimeHintClass,
  ...(['error', 'success', 'info', 'warning', 'neutral'] as const).flatMap((tone) => (['md', 'sm'] as const).map((size) => v.alertVariants({ tone, size }))),
  v.dropzoneClass({}), v.dropzoneClass({ dragging: true }), v.dropzoneClass({ hasFile: true }), v.dropzoneStateClass, v.dropzoneIconClass,
  v.hintTextClass, v.hintTextBlockClass, v.fileReuploadHintClass, v.uploadFormatListClass,
  v.previewBoxClass, v.previewHeaderClass, v.previewFieldsScrollClass, v.previewFieldRowClass, v.previewFieldClass, v.previewCropClass, v.previewValueClass,
  v.detailSectionClass, v.notesTextClass,
  v.stockQtyClass({ sign: 'in' }), v.stockQtyClass({ sign: 'out' }), v.stockQtyClass({}), v.overuseClass, v.cellBadgeClass, v.cellBadgeLeadClass,
  v.stockDocUnitClass, v.stockDocQtyClass, v.stockDocAmountClass, v.stockDocFooterRowClass,
  v.collapsedPanelButtonClass, v.phaseLabelClass,
  v.belowHeaderHeightClass, v.loginPageClass, v.loginColumnClass, v.loginCardClass, v.loginLogoClass, v.loginPrimaryButtonClass, v.loginCopyrightClass, v.loginNoticeClass,
];

describe('variants', () => {
  it('nupu vaikimisi on teisene, tavasuurus', () => {
    const c = v.buttonVariants();
    expect(c).toContain('bg-secondary');
    expect(c).toContain('h-8');
  });
  it('plain nupp lähtestab ääre ja tausta ning pärib kirja', () => {
    const c = v.buttonVariants({ variant: 'plain', size: 'inline' });
    expect(c).toContain('border-0');
    expect(c).toContain('bg-transparent');
    expect(c).toContain('w-full');
    expect(c).toContain('text-inherit');
    expect(c).toContain('p-0');
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
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'link', 'dashed', 'bare', 'text', 'plain'] as const)
      for (const size of ['xs', 'sm', 'md', 'inline', 'icon-xs', 'icon-sm', 'icon-lg', 'auto', 'add-slot'] as const) {
        const tokens = v.buttonVariants({ variant, size }).split(/\s+/);
        const colors = tokens.filter((t) => t === 'border-transparent' || t === 'border-secondary-border' || t === 'border-border');
        expect(colors, `${variant}/${size}`).toHaveLength(1);
      }
    expect(v.buttonVariants({ variant: 'secondary' })).toContain('border-secondary-border');
    expect(v.buttonVariants({ variant: 'secondary' })).not.toContain('border-transparent');
    for (const variant of ['primary', 'ghost', 'danger', 'danger-ghost', 'bare', 'text', 'plain'] as const)
      expect(v.buttonVariants({ variant })).toContain('border-transparent');
    expect(v.buttonVariants({ variant: 'dashed' })).toContain('border-border');
  });
  it('keelatud nupp jääb hõljutatavaks ja hõljumisefekt ainult lubatud nupul', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost', 'link', 'dashed', 'bare', 'text', 'plain'] as const)
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
    const allowed = /^text-(2xs|xs|sm|base|lg|xl|foreground|muted-foreground|subtle|white|primary|info|warning|destructive|accent|success-text|info-text|warning-text|warning-solid|danger-text|danger-solid|accent-text|on-warning|background|left|right|center|inherit)$/;
    for (const s of sizes) expect(s).toMatch(allowed);
  });
});

describe('4f lõppparandused', () => {
  it('tahvli jalus on sama mis vihjetekst, tahvli kest kasutab päise kõrgust', () => {
    expect(v.boardFooterClass).toBe(v.hintTextClass);
    expect(v.boardViewClass.split(' ')).toContain(v.belowHeaderHeightClass);
    expect(v.belowHeaderHeightClass).toBe('h-[calc(100vh-64px)]');
  });
  it('sisselogimise lehe kitsa ekraani piir on vana 760 + 1', () => {
    expect(v.loginPageClass).toContain('max-[761px]:justify-center');
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
  it('nupu lähtestus (font, text-align, color) ei ole utiliit — see on src/styles/base.css-is ja vaate klass võidab', () => {
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
  it('kirje: 13px keskmine paksus, 6/12px polster, 6px nurk', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    for (const c of ['text-sm', 'font-medium', 'px-3', 'py-1.5', 'rounded-sm', 'gap-1.5', 'leading-natural']) expect(t).toContain(c);
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

describe('SectionTitle (etapp 4.1)', () => {
  it('põhi: 12px poolpaks suurtäht, hall, 8px alla', () => {
    const c = v.sectionTitleClass();
    for (const t of ['text-xs', 'font-semibold', 'uppercase', 'text-muted-foreground', 'mb-2', 'flex']) expect(c).toContain(t);
    expect(c).not.toContain('border-b');
    expect(c).not.toContain('mt-4');
  });
  it('ruled lisab alumise joone ja 4px polstri, spaced 16px ülavahe', () => {
    const c = v.sectionTitleClass({ ruled: true, spaced: true });
    expect(c).toContain('border-b');
    expect(c).toContain('pb-1');
    expect(c).toContain('mt-4');
  });
});

describe('StatTile (etapp 4.1)', () => {
  it('silt on jaotise pealkirja kiri, väärtus 20px poolpaks tabelnumbritega', () => {
    expect(v.statTileLabelClass).toBe(v.sectionTitleLabelClass);
    const c = v.statTileValueClass({});
    for (const t of ['text-xl', 'font-semibold', 'tabular-nums', 'whitespace-nowrap']) expect(c).toContain(t);
  });
  it('toonid: kulu punane, tulu roheline, tulemus teemapõhine', () => {
    expect(v.statTileValueClass({ tone: 'cost' })).toContain('text-destructive');
    expect(v.statTileValueClass({ tone: 'revenue' })).toContain('text-primary');
    expect(v.statTileValueClass({ tone: 'profit' })).toContain('text-success-text');
    expect(v.statTileValueClass({ tone: 'profit' })).toContain('dark:text-primary');
    expect(v.statTileValueClass({ tone: 'loss' })).toContain('text-danger-text');
    expect(v.statTileValueClass({ tone: 'loss' })).toContain('dark:text-destructive');
  });
  it('plaat: kasum/kahjum toonib äärise ja tausta, tavaplaat mitte', () => {
    expect(v.statTileClass({ tone: 'profit' })).toContain('border-primary');
    expect(v.statTileClass({ tone: 'loss' })).toContain('border-destructive');
    expect(v.statTileClass({})).not.toContain('border-primary');
  });
  it('tühi väärtus: hall ja tavakaal', () => {
    const c = v.statTileValueClass({ empty: true });
    expect(c).toContain('text-subtle');
    expect(c).toContain('font-normal');
  });
});

describe('LegendItem (etapp 4.1)', () => {
  it('kirje: 12px hall rida, märk 10px ring, väärtus poolpaks', () => {
    expect(v.legendItemClass).toContain('text-xs');
    expect(v.legendItemClass).toContain('inline-flex');
    expect(v.legendMarkerClass).toContain('size-2.5');
    expect(v.legendMarkerClass).toContain('rounded-full');
    expect(v.legendValueClass).toContain('font-semibold');
    expect(v.legendValueClass).toContain('tabular-nums');
  });
});

describe('PageHeader (etapp 4.1)', () => {
  it('päis murdub reaks, pealkiri 20px poolpaks, alapealkiri 13px hall, tegevused paremal', () => {
    expect(v.pageHeaderClass).toContain('flex-wrap');
    expect(v.pageHeaderClass).toContain('gap-x-4');
    expect(v.pageHeaderTitleClass).toContain('text-xl');
    expect(v.pageHeaderTitleClass).toContain('font-semibold');
    expect(v.pageHeaderSubtitleClass).toContain('text-sm');
    expect(v.pageHeaderSubtitleClass).toContain('text-muted-foreground');
    expect(v.pageHeaderActionsClass).toContain('ml-auto');
    expect(v.pageHeaderIconClass).toContain('[&>svg]:size-5');
  });
});

describe('KeyValueRow (etapp 4.1)', () => {
  it('silt vasakul, väärtus paremal, 14px tabelnumbritega', () => {
    for (const t of ['flex', 'justify-between', 'gap-3', 'text-base', 'tabular-nums']) expect(v.keyValueRowClass).toContain(t);
  });
  it('silt ja väärtus joonduvad baasjoonele; silt ei kahane, pikk väärtus murdub', () => {
    expect(v.keyValueRowClass).toContain('items-baseline');
    expect(v.keyValueRowClass).not.toContain('items-center');
    expect(v.keyValueLabelClass).toContain('shrink-0');
    for (const t of ['min-w-0', 'text-right']) expect(v.keyValueValueClass).toContain(t);
  });
});

describe('kirjapaksuse tokenid (etapp 4a)', () => {
  it('iga font-* token on tuntud paksus või -family (püüab kirjavead nagu font-memibold)', () => {
    const allowed = new Set(['font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-sans', 'font-mono', 'font-serif']);
    const bad = new Set<string>();
    for (const str of allClassStrings()) {
      for (const tok of str.split(/\s+/)) {
        const m = /(?:^|:)(font-[a-z]+)$/.exec(tok);
        if (m && !allowed.has(m[1])) bad.add(tok);
      }
    }
    expect([...bad]).toEqual([]);
  });
  it('badge on keskmise paksusega', () => {
    expect(v.badgeVariants({ tone: 'neutral', variant: 'soft', size: 'sm' })).toContain('font-medium');
  });
  it('StatTile sub ja value teevad paljad <strong> poolpaksuks', () => {
    expect(v.statTileSubClass).toContain('[&_strong]:font-semibold');
    expect(v.statTileValueClass({})).toContain('[&_strong]:font-semibold');
  });
});

describe('cornerActionClass (etapp 4b)', () => {
  it('paneb nupu kinnise vanema paremasse ülanurka 6px kaugusele', () => {
    for (const x of ['absolute', 'top-1.5', 'right-1.5']) expect(v.cornerActionClass).toContain(x);
  });
});

describe('ProgressBar (etapp 4b)', () => {
  it('riba: 8px kõrge, ümar, vaikne taust; täide roheline', () => {
    for (const t of ['h-2', 'overflow-hidden', 'rounded-sm', 'bg-muted']) expect(v.progressTrackClass).toContain(t);
    for (const t of ['h-full', 'bg-primary', 'rounded-sm']) expect(v.progressFillClass).toContain(t);
  });
});

describe('emptyBoxClass ja subheadingClass (etapp 4b, lõppparandus)', () => {
  it('tühja oleku kast: punktiirääris, 10px täide, vaikne tekst', () => {
    for (const t of ['rounded-md', 'border-dashed', 'border-border', 'px-3', 'py-2.5', 'text-subtle']) expect(v.emptyBoxClass).toContain(t);
  });
  it('alamrubriik: poolpaks, normaalne rea kõrgus, vaikne tekst', () => {
    for (const t of ['text-xs', 'font-semibold', 'leading-natural', 'text-muted-foreground']) expect(v.subheadingClass).toContain(t);
  });
});

describe('Tehnika ühised klassid (etapp 4c)', () => {
  it('iconBoxVariants: sm 28px nurk 6, md 36px äärisega, lg 40px', () => {
    expect(v.iconBoxVariants({ size: 'sm', tone: 'info' })).toEqual(expect.stringContaining('size-7'));
    expect(v.iconBoxVariants({ size: 'sm', tone: 'info' })).toEqual(expect.stringContaining('bg-info/15'));
    expect(v.iconBoxVariants({ size: 'md' })).toEqual(expect.stringContaining('border-2'));
    expect(v.iconBoxVariants({ size: 'lg' })).toEqual(expect.stringContaining('size-10'));
  });
  it('cardGridClass: automaatsed 360px veerud, vahe 12px', () => {
    for (const t of ['grid', 'grid-cols-[repeat(auto-fill,minmax(360px,1fr))]', 'gap-3']) expect(v.cardGridClass).toContain(t);
  });
  it('registerSectionClass täidab lehe kõrguse ja kerib tabeli ise (flex-1 basis-0 min-h-0)', () => {
    for (const t of ['flex-1', 'basis-0', 'min-h-0', 'flex-col', 'gap-4']) expect(v.registerSectionClass).toContain(t);
  });
  it('registri lahtrid: pealkiri 13/500, alamrida 11 vaikne, kestus aktiivselt roheline, märkus tühjana kaldkirjas', () => {
    expect(v.fleetCellTitleClass).toContain('font-medium');
    expect(v.cellSubClass).toContain('text-2xs');
    expect(v.cellSubClass).not.toContain('leading-natural'); // vana alamrida päris lahtri 16px rea kõrguse, text-2xs annab sama
    expect(v.fleetDurationClass({ active: true })).toContain('text-primary');
    expect(v.fleetDurationClass({})).toContain('text-subtle');
    expect(v.fleetNotesClass({ empty: true })).toContain('italic');
    expect(v.fleetNotesClass({})).not.toContain('italic');
  });
  it('kuupäev + kellaaeg rida: 110px kellaajaveerg; vihje min kõrgus 18px', () => {
    expect(v.dateTimeRowClass).toContain('grid-cols-[minmax(0,1fr)_110px]');
    expect(v.dateTimeHintClass).toContain('min-h-4.5');
  });
});

describe('kaardi paneelide ühised klassid (etapp 4d)', () => {
  it('mapPanelTitleClass: ikoon + tekst reas, 14px poolpaks, rea kõrgus normal', () => {
    for (const t of ['flex', 'items-center', 'text-base', 'font-semibold', 'leading-natural']) expect(v.mapPanelTitleClass).toContain(t);
  });
  it('loadingSpinnerClass pöörleb ja on roheline, aeglustub vähendatud liikumise korral; inline-variandil vasak vahe 6px', () => {
    for (const t of ['animate-spin', 'text-primary', 'shrink-0', 'motion-reduce:[animation-duration:3s]']) expect(v.loadingSpinnerClass).toContain(t);
    expect(v.loadingSpinnerClass).not.toContain('ml-1.5');
    expect(v.loadingSpinnerInlineClass).toContain('ml-1.5');
  });
});

describe('Alert ja alamrida (etapp 4e)', () => {
  it('alertVariants: veateade on punane ääris + taust + roosa tekst; neutral ilma toonita; sm on väiksema polstriga', () => {
    const err = v.alertVariants({ tone: 'error' });
    for (const t of ['border', 'border-destructive/35', 'bg-destructive/12', 'text-danger-text', 'px-3', 'py-2.5', 'text-sm', 'leading-natural', 'rounded-sm']) expect(err).toContain(t);
    expect(v.alertVariants({ tone: 'success' })).toContain('text-success-text');
    expect(v.alertVariants({ tone: 'info' })).toContain('text-info-text');
    expect(v.alertVariants({ tone: 'warning' })).toContain('text-warning-text');
    const neutral = v.alertVariants({});
    expect(neutral).not.toMatch(/bg-(destructive|primary|info|warning)/);
    expect(v.alertVariants({ size: 'sm' })).toContain('py-2');
    expect(v.alertVariants({ size: 'sm' })).not.toContain('py-2.5');
  });
  it('alamrida: üks kirjasuurus ja toon kõigis registrites; virnastatud variant lisab ainult ülaveeru', () => {
    expect(v.cellSubClass).toBe('text-2xs text-subtle');
    expect(v.cellSubStackedClass).toContain('mt-0.5');
    expect(v.cellSubStackedClass).toContain('text-2xs');
    expect(v).not.toHaveProperty('fleetCellSubClass');
  });
});

describe('registrikaardi mustrid (etapp 4e)', () => {
  it('nimi 14px/500, alamtekst 12px, inforead 12px gap 4px ja read gap 6px (vana v-name, v-model, v-info-rows, v-info-item)', () => {
    for (const t of ['text-base', 'font-medium', 'leading-natural']) expect(v.infoCardNameClass).toContain(t);
    expect(v.infoCardSubClass).toContain('text-xs');
    expect(v.infoRowsClass).toContain('gap-1');
    expect(v.infoRowsClass).toContain('flex-col');
    expect(v.infoRowClass).toContain('gap-1.5');
    expect(v.infoCardClass).toContain('gap-3');
  });
});

describe('tabeli sisu konstandid (etapp 4e)', () => {
  it('nimi 14px/400, alamsildid gap 6px ülaveeris 4px, summutatud tekst', () => {
    for (const t of ['text-base', 'font-normal']) expect(v.tableNameClass).toContain(t);
    expect(v.tableTitleLineClass).toContain('gap-2');
    for (const t of ['mt-1', 'gap-1.5', 'flex-wrap']) expect(v.tableSubTagsClass).toContain(t);
    expect(v.tableMutedClass).toBe('text-subtle');
  });
});

describe('töö vormi konstandid (etapp 4e)', () => {
  it('kere veerg gap 12px ja kerib; ruudustik gap 10px, väljad alla joondatud; jaotis gap 8px koos h4 14px/600; vihje 12px', () => {
    for (const t of ['flex-col', 'gap-3', 'overflow-y-auto']) expect(v.dialogStackBodyClass).toContain(t);
    for (const t of ['grid', 'items-end', 'gap-2.5']) expect(v.workFormGridClass).toContain(t);
    for (const t of ['gap-2', '[&>h4]:text-base', '[&>h4]:font-semibold']) expect(v.workFormSectionClass).toContain(t);
    expect(v.workFormHintClass).toContain('text-xs');
  });
});

describe('mulla/ilma lõigu konstandid (etapp 4e)', () => {
  it('väärtuse toon tuleb data-level atribuudist (ohtlik/hoiatus/hea/puudub), kaal 400; joonealune märkus 11px', () => {
    for (const t of ['font-normal', 'data-[level=bad]:text-danger-text', 'data-[level=warn]:text-warning-text', 'data-[level=good]:text-success-text', 'data-[level=none]:text-subtle']) expect(v.soilValueClass).toContain(t);
    expect(v.soilFootnoteClass).toContain('text-2xs');
    expect(v.soilFootnoteClass).toContain('leading-natural');
    expect(v.soilYearCellClass).toContain('font-medium');
  });
});

describe('infoNoticeClass (etapp 4e)', () => {
  it('sinine teatetaust ilma äärisetoonita, tavaline tekst, ümardus md (kande dialoog, PRIA read)', () => {
    for (const t of ['gap-2', 'rounded-md', 'bg-info/10', 'text-foreground']) expect(v.infoNoticeClass).toContain(t);
  });
});

describe('registrikaartide korduvad klassid (etapp 4e, lõpp)', () => {
  it('statistikakiibi silt, number ja alamväärtus: vaikne silt, poolpaks number, 11px alamväärtus', () => {
    expect(v.statChipLabelClass).toContain('text-muted-foreground');
    for (const t of ['font-medium', 'text-foreground']) expect(v.statChipNumClass).toContain(t);
    for (const t of ['ml-1', 'text-2xs']) expect(v.statChipSubClass).toContain(t);
  });
  it('registri ikooniruut: ääris, 16px emoji ja joonekõrgus normal', () => {
    for (const t of ['border-border', 'text-base', 'leading-none']) expect(v.registerIconBoxClass).toContain(t);
  });
});

describe('dropzoneClass', () => {
  it('vaikimisi katkendjoonega kast, hõljumisel ja valitud failiga roheline', () => {
    expect(v.dropzoneClass({})).toContain('border-dashed');
    expect(v.dropzoneClass({ dragging: true })).toContain('border-primary');
    expect(v.dropzoneClass({ hasFile: true })).toContain('border-primary');
    expect(v.dropzoneClass({})).toContain('cursor-pointer');
  });
  it('ääris on kõigil külgedel 2px nagu vanas reeglis', () => {
    expect(v.dropzoneClass({})).toContain('border-2');
  });
  it('heledas teemas nähtav raam (≥ 3:1), tumedas teemas endine nõrk valge', () => {
    expect(v.dropzoneClass({})).toContain('border-subtle/80');
    expect(v.dropzoneClass({})).toContain('dark:border-white/15');
    expect(v.dropzoneClass({})).toContain('dark:bg-white/2');
    expect(v.dropzoneClass({})).toContain('hover:border-primary');
    expect(v.dropzoneClass({ hasFile: true })).toContain('border-primary');
  });
});
describe('hintText', () => {
  it('vihje on 13px hall, blokk-variant lisab ülaveerise', () => {
    expect(v.hintTextClass).toContain('text-sm');
    expect(v.hintTextClass).toContain('text-muted-foreground');
    expect(v.hintTextBlockClass).toContain('mt-1');
    expect(v.hintTextBlockClass).toContain('block');
  });
});

describe('päise nupud kitsal ekraanil', () => {
  it('nupp muutub 28px ikooninupuks ainult alla 1656px, ilma polstri ja vaheta', () => {
    for (const c of ['max-[1656px]:size-7', 'max-[1656px]:p-0', 'max-[1656px]:gap-0', 'max-[1656px]:relative', 'group']) expect(v.headerTriggerClass.split(' ')).toContain(c);
    expect(v.headerNarrowHiddenClass).toBe('max-[1656px]:hidden');
  });
  it('nool peidetakse kitsal ekraanil ja pöörab avatud menüüs', () => {
    expect(v.headerChevronClass).toContain('max-[1656px]:hidden');
    expect(v.headerChevronClass).toContain('group-data-[state=open]:rotate-180');
  });
});

describe('täislehe kest ja registririba (etapp 4f)', () => {
  it('vaade täidab akna päise all, põhi kerib ise, sisu ja põhi on veerud gap 12px', () => {
    for (const t of ['flex', 'min-h-0', 'flex-1', 'overflow-hidden', 'bg-background', 'h-[calc(100vh-64px)]']) expect(v.boardViewClass.split(' ')).toContain(t);
    for (const t of ['flex-col', 'gap-3', 'min-w-0', 'min-h-0', 'w-full', 'px-4', 'py-3']) expect(v.boardMainClass.split(' ')).toContain(t);
    for (const t of ['flex-col', 'gap-3', 'min-h-0', 'overflow-auto']) expect(v.boardBodyClass.split(' ')).toContain(t);
    for (const t of ['flex-col', 'gap-3', 'p-0', 'overflow-visible', 'flex-auto']) expect(v.boardContentClass.split(' ')).toContain(t);
    for (const t of ['text-sm', 'text-muted-foreground']) expect(v.boardFooterClass.split(' ')).toContain(t);
  });
  it('tööriistaribad murduvad, vahe 10px (kest) ja aasta rida võtab kogu laiuse', () => {
    for (const t of ['flex-wrap', 'justify-between', 'gap-2.5']) expect(v.registerHeaderControlsClass.split(' ')).toContain(t);
    for (const t of ['flex-wrap', 'gap-2.5']) expect(v.registerActionsBarClass.split(' ')).toContain(t);
    for (const t of ['flex-wrap', 'gap-2', 'ml-auto']) expect(v.registerIoButtonsClass.split(' ')).toContain(t);
    for (const t of ['flex-wrap', 'gap-2.5', 'flex-auto', 'basis-full']) expect(v.yearSelectorGroupClass.split(' ')).toContain(t);
    for (const t of ['gap-1.5', 'text-base', 'font-medium', 'text-foreground']) expect(v.yearLabelClass.split(' ')).toContain(t);
  });
  it('dialoogis on riba kaart (polster 12/16, ääris, ümardus 16px) ja ribade all ruumi 12px', () => {
    for (const t of ['px-4', 'py-3', 'border', 'rounded-lg', 'mb-3', 'bg-card', 'gap-4']) expect(v.dialogHeaderControlsClass.split(' ')).toContain(t);
    for (const t of ['mb-3', 'gap-3', 'flex-wrap']) expect(v.dialogActionsBarClass.split(' ')).toContain(t);
  });
  it('otsinguväli kasvab 220px-st 420px-ni', () => {
    for (const t of ['grow', 'shrink', 'basis-55', 'max-w-105']) expect(v.searchFieldClass.split(' ')).toContain(t);
  });
});

describe('stockQtyClass', () => {
  it('sisse roheline, välja punane', () => {
    expect(v.stockQtyClass({ sign: 'in' })).toContain('text-primary');
    expect(v.stockQtyClass({ sign: 'out' })).toContain('text-danger-solid');
    expect(v.stockQtyClass({})).not.toContain('text-primary');
  });
});

describe('collapsedPanelButtonClass (kaardi paneeli ahendatud nupp)', () => {
  it('40px ruut, tsentreeritud ikoon, ei sisalda self-* (paigutuse annab pakk)', () => {
    expect(v.collapsedPanelButtonClass).toContain('size-10');
    expect(v.collapsedPanelButtonClass).toContain('items-center justify-center');
    expect(v.collapsedPanelButtonClass).not.toMatch(/(?:^|\s)self-/);
    expect(v.collapsedPanelButtonClass).toContain('hover:text-primary');
  });
});

describe('phaseLabelClass (töö faasi silt)', () => {
  it('toon tekstina data-tone järgi, nelja tooniga', () => {
    for (const t of ['info', 'success', 'accent', 'warning']) {
      expect(v.phaseLabelClass).toContain(`data-[tone=${t}]:text-${t}-text`);
    }
    expect(v.phaseLabelClass).toContain('text-2xs');
    expect(v.phaseLabelClass).toContain('leading-natural');
  });
});
