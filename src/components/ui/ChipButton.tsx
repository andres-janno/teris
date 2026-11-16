// src/components/ui/ChipButton.tsx — valitav kiip andmevärviga (kultuuri filter, omandivormi filter). Välimus: chipVariants;
// värv tuleb `accent` prop'ist. Valitud olek on `selected` (aria-pressed + data-selected), mitte `.active`.
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { chipVariants } from './variants';

export type ChipButtonProps = React.ComponentProps<'button'> &
  Pick<VariantProps<typeof chipVariants>, 'variant' | 'dimmed'> & {
    /** CSS värv (hex või `var(--emerald-500)`): toon, riba ja valitud rõngas. */
    accent?: string;
    selected?: boolean;
  };

export const ChipButton: React.FC<ChipButtonProps> = ({ className, variant, dimmed, accent, selected = false, type = 'button', style, ...props }) => (
  <button
    {...props}
    type={type}
    data-slot="chip"
    aria-pressed={selected}
    data-selected={selected ? '' : undefined}
    style={accent ? ({ '--chip-accent': accent, ...style } as React.CSSProperties) : style}
    className={cn(chipVariants({ variant, dimmed }), className)}
  />
);
