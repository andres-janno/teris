// src/components/ui/Badge.tsx — olekumärk (asendab badge-, pill- ja tag-klassid). dot = olekupunkt;
// string-väärtus = punkti värv andmetest (nt kultuuri värv).
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { badgeVariants } from './variants';

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean | string };

export const Badge: React.FC<BadgeProps> = ({ className, tone, variant, size, dot, children, ...props }) => (
  <span className={cn(badgeVariants({ tone, variant, size }), className)} {...props}>
    {dot && (
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', typeof dot === 'string' ? undefined : 'bg-current')}
        style={typeof dot === 'string' ? { background: dot } : undefined}
      />
    )}
    {children}
  </span>
);
