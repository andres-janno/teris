// src/components/ui/FilterBar.tsx — registri filtririba: kaart, „Filtrid:“ silt, filtrid, paremal tegevused (tühjenda, värskenda).
import React from 'react';
import { Filter } from 'lucide-react';
import { Card } from './Card';
import { cn } from './cn';
import { filterBarActionsClass, filterBarClass, filterBarItemClass, filterBarLabelClass } from './variants';

export const FilterBar: React.FC<{ actions?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  actions, className, children,
}) => (
  <Card padding="sm" className={cn(filterBarClass, className)}>
    <span className={filterBarLabelClass}>
      <Filter size={15} className="text-subtle" aria-hidden="true" />
      Filtrid:
    </span>
    {children}
    {actions && <div className={filterBarActionsClass}>{actions}</div>}
  </Card>
);

/** Rippmenüü (FilterClear + FilterSelect) ümbris kindla miinimumlaiusega. */
export const FilterBarItem: React.FC<{ width?: 'sm' | 'md' | 'lg'; children: React.ReactNode }> = ({ width = 'md', children }) => (
  <div className={filterBarItemClass(width)}>{children}</div>
);
