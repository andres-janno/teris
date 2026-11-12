// src/components/ui/Card.tsx — klaasikaart ja päisega paneel.
import React from 'react';
import { cn } from './cn';
import { cardClass } from './variants';

export const Card: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn(cardClass, className)} {...props} />
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
  <section className={cn(cardClass, 'flex flex-col', className)}>
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
    <div className={cn('p-4', bodyClassName)}>{children}</div>
  </section>
);
