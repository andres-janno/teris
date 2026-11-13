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
