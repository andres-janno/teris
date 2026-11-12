// src/components/ui/Badge.tsx — olekumärk (asendab badge- ja pill-klassid).
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { badgeVariants } from './variants';

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export const Badge: React.FC<BadgeProps> = ({ className, tone, ...props }) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props} />
);
