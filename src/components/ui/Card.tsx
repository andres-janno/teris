// src/components/ui/Card.tsx — kaart (tahke), kaardi peal ujuv paneel, sisemine plaat; päis ja päisega paneel.
// Välimus tuleb siit; vaate klass (className) annab ainult asetuse (position, z-index, flex, gap, margin).
import React from 'react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { cardActionsClass, cardHeaderClass, cardTitleClass, cardVariants } from './variants';

export type CardProps = React.ComponentProps<'div'> &
  VariantProps<typeof cardVariants> & {
    /** Renderda laps (<button>, <form>, <section>) kaardi välimusega. */
    asChild?: boolean;
  };

export const Card: React.FC<CardProps> = ({ className, variant, padding, interactive, selected, asChild = false, ...props }) => {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      data-slot="card"
      data-selected={selected ? '' : undefined}
      className={cn(cardVariants({ variant, padding, interactive, selected }), className)}
      {...props}
    />
  );
};

export const CardHeader: React.FC<React.ComponentProps<'div'> & { align?: 'center' | 'start' }> = ({ className, align, ...props }) => (
  <div data-slot="card-header" className={cn(cardHeaderClass({ align }), className)} {...props} />
);

export const CardTitle: React.FC<React.ComponentProps<'h3'> & { as?: 'h2' | 'h3' | 'h4' }> = ({ as: Tag = 'h3', className, ...props }) => (
  <Tag data-slot="card-title" className={cn(cardTitleClass, className)} {...props} />
);

export const CardActions: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card-actions" className={cn(cardActionsClass, className)} {...props} />
);

interface PanelProps {
  title: React.ReactNode;
  /** Päise paremasse serva (nupud, filtrid). */
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, actions, className, bodyClassName, children }) => (
  <Card asChild padding="none" className={cn('flex flex-col', className)}>
    <section>
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle as="h2" className="text-lg">{title}</CardTitle>
        {actions && <CardActions className="gap-2">{actions}</CardActions>}
      </CardHeader>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  </Card>
);
