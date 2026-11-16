// src/components/ui/EmptyState.tsx — tühja registri / laadimise olek kaardina: ikoon, pealkiri, selgitus.
import React from 'react';
import { Card } from './Card';
import { cn } from './cn';
import { emptyStateClass, emptyStateDescriptionClass, emptyStateIconClass, emptyStateTitleClass } from './variants';

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}> = ({ icon, title, description, className, children }) => (
  <Card padding="none" className={cn(emptyStateClass, className)}>
    {icon && <span className={emptyStateIconClass} aria-hidden="true">{icon}</span>}
    {title && <div className={emptyStateTitleClass}>{title}</div>}
    {description && <p className={emptyStateDescriptionClass}>{description}</p>}
    {children}
  </Card>
);
