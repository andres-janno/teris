// src/components/ui/Button.tsx — ühine nupp (asendab .btn-* ja vaatepõhised nupuklassid).
import React from 'react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { buttonVariants } from './variants';

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renderda laps (nt <a>) nupu välimusega. */
    asChild?: boolean;
  };

export const Button: React.FC<ButtonProps> = ({ className, variant, size, asChild = false, type, ...props }) => {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
};
