// src/components/ui/Card.tsx — kaart (tahke), kaardi peal ujuv paneel, sisemine plaat; päis ja tegevused.
// Välimus tuleb siit; vaate klass (className) annab ainult asetuse (position, z-index, flex, gap, margin).
import React from 'react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { clickOnActivationKey } from './keyActivation';
import { cardActionsClass, cardHeaderClass, cardVariants } from './variants';

export type CardProps = React.ComponentProps<'div'> &
  VariantProps<typeof cardVariants> & {
    /** Renderda laps (<button>, <form>, <section>) kaardi välimusega. */
    asChild?: boolean;
  };

export const Card: React.FC<CardProps> = ({
  className, variant, padding, interactive, selected, asChild = false, onClick, onKeyDown, tabIndex, role, ...props
}) => {
  const Comp = asChild ? Slot.Root : 'div';
  // Klõpsatav div-kaart: nupu roll ja Enter/tühik (asChild <button> haldab seda ise).
  const keyboard = !!interactive && !!onClick && !asChild;
  return (
    <Comp
      data-slot="card"
      data-selected={selected ? '' : undefined}
      onClick={onClick}
      role={keyboard ? (role ?? 'button') : role}
      tabIndex={keyboard ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={keyboard ? (e: React.KeyboardEvent<HTMLDivElement>) => { onKeyDown?.(e); clickOnActivationKey(e); } : onKeyDown}
      className={cn(cardVariants({ variant, padding, interactive, selected }), className)}
      {...props}
    />
  );
};

export type CardButtonProps = React.ComponentProps<'button'> & Omit<VariantProps<typeof cardVariants>, 'interactive'>;

/** Valitav kaart nupuna (kogu kaart on klõpsatav): kaardi välimus, klaviatuur ja `type="button"` ühes. Valitud = `selected`. */
export const CardButton: React.FC<CardButtonProps> = ({ className, variant, padding, selected, type = 'button', ...props }) => (
  <button
    type={type}
    data-slot="card"
    data-selected={selected ? '' : undefined}
    // Valitav olek kuuldavaks; kutsuja enda aria-pressed (…props) võidab.
    aria-pressed={selected ?? undefined}
    className={cn(cardVariants({ variant, padding, interactive: true, selected }), className)}
    {...props}
  />
);

export const CardHeader: React.FC<React.ComponentProps<'div'> & { align?: 'center' | 'start' }> = ({ className, align, ...props }) => (
  <div data-slot="card-header" className={cn(cardHeaderClass({ align }), className)} {...props} />
);

export const CardActions: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card-actions" className={cn(cardActionsClass, className)} {...props} />
);
