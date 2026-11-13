import { describe, expect, it } from 'vitest';
import { auditTsx } from '../../tooling/uiAudit';
import { cn } from './cn';
import * as v from './variants';

const allClassStrings = (): string[] => [
  ...(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost'] as const).flatMap((variant) =>
    (['sm', 'md', 'icon-xs', 'icon-sm', 'icon'] as const).map((size) => v.buttonVariants({ variant, size }))
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
  it('läbipaistev ohunupp: punane ikoon, hõljudes kerge punane taust', () => {
    const c = v.buttonVariants({ variant: 'danger-ghost', size: 'icon-sm' });
    expect(c).toContain('text-destructive');
    expect(c).toContain('bg-transparent');
    expect(c).toContain('hover:bg-destructive/15');
  });
  it('ikoonnupud on 6px nurgaga (nagu vanad icon-btn), tekstinupud 10px', () => {
    for (const size of ['icon-xs', 'icon-sm', 'icon'] as const) {
      const c = cn(v.buttonVariants({ size }));
      expect(c, size).toContain('rounded-sm');
      expect(c, size).not.toContain('rounded-md');
    }
    expect(cn(v.buttonVariants({ size: 'sm' }))).toContain('rounded-md');
    expect(v.buttonVariants({ size: 'icon-xs' })).toContain('size-5');
  });
  it('nupu äärevärv on täpselt üks variandis, baasis ei ole ühtegi', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost'] as const)
      for (const size of ['sm', 'md', 'icon-xs', 'icon-sm', 'icon'] as const) {
        const tokens = v.buttonVariants({ variant, size }).split(/\s+/);
        const colors = tokens.filter((t) => t === 'border-transparent' || t === 'border-secondary-border');
        expect(colors, `${variant}/${size}`).toHaveLength(1);
      }
    expect(v.buttonVariants({ variant: 'secondary' })).toContain('border-secondary-border');
    expect(v.buttonVariants({ variant: 'secondary' })).not.toContain('border-transparent');
    for (const variant of ['primary', 'ghost', 'danger', 'danger-ghost'] as const)
      expect(v.buttonVariants({ variant })).toContain('border-transparent');
  });
  it('keelatud nupp jääb hõljutatavaks ja hõljumisefekt ainult lubatud nupul', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost'] as const)
      for (const size of ['sm', 'md', 'icon-xs', 'icon-sm', 'icon'] as const) {
        const c = v.buttonVariants({ variant, size });
        const tokens = c.split(/\s+/);
        expect(c, `${variant}/${size}`).not.toContain('pointer-events-none');
        expect(tokens, `${variant}/${size}`).toContain('disabled:cursor-not-allowed');
        expect(tokens.filter((t) => t.startsWith('hover:')), `${variant}/${size}`).toEqual([]);
      }
  });
  it('kirjasuurused ainult skaalast', () => {
    const sizes = allClassStrings().flatMap((c) => c.match(/(?<![\w-])text-[a-z0-9-]+/g) ?? []);
    const allowed = /^text-(2xs|xs|sm|base|lg|xl|foreground|muted-foreground|subtle|white|primary|info|warning|destructive|accent|background)$/;
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
