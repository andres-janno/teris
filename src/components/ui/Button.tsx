// src/components/ui/Button.tsx — ühine nupp (asendab .btn-* ja vaatepõhised nupuklassid).
import React from 'react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { iconTooltip } from './iconTooltip';
import { Tooltip } from './Popover';
import { buttonVariants } from './variants';

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renderda laps (nt <a>) nupu välimusega. */
    asChild?: boolean;
  };

/** Tekstita ikoonnupp (size icon*) + title → rakenduse stiilis vihje natiivse asemel; tekstinupul jääb natiivne title. */
export const Button: React.FC<ButtonProps> = ({ className, variant, size, asChild = false, type, title, ...props }) => {
  const Comp = asChild ? Slot.Root : 'button';
  const tip = iconTooltip(size, title, props['aria-label']);
  const button = (
    <Comp
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
      title={tip.nativeTitle}
      aria-label={tip.ariaLabel}
    />
  );
  return tip.tooltip ? (
    <Tooltip content={tip.tooltip} wrapDisabled={props.disabled}>{button}</Tooltip>
  ) : button;
};
