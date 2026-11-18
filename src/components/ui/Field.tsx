// src/components/ui/Field.tsx — välja silt + abitekst + veateade ning vormi paigutus (FormGrid, FieldRow).
// Asendab .form-group, .form-grid, .form-row-3, .input-split.
import React from 'react';
import { cn } from './cn';

interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  span?: 'full'; // FormGrid-is üle kogu rea (vana .form-group.full-width)
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, span, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1', span === 'full' && 'col-span-full', className)}>
    {label != null && (
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
    )}
    {children}
    {error ? (
      <p role="alert" className="text-2xs text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-subtle">{hint}</p>
    ) : null}
  </div>
);

// Vormi ruudustik: 2 veergu (vana .form-grid) või 3 veergu 2:1:1.5 (vana .form-row-3, mobiilis 1 veerg).
// collapse: kitsal ekraanil (≤ 560px) üks veerg; vana .fleet-form-grid
export const FormGrid: React.FC<{ cols?: 2 | 3; span?: 'full'; collapse?: boolean; className?: string; children: React.ReactNode }> = ({ cols = 2, span, collapse, className, children }) => (
  <div className={cn('grid gap-2.5', cols === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr]', collapse && 'max-[560px]:grid-cols-1', span === 'full' && 'col-span-full', className)}>
    {children}
  </div>
);

// Väljad ühes reas (vana .input-split): nt väli + värvivalija, väli + nupp.
export const FieldRow: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('flex min-w-0 items-center gap-2 *:min-w-0', className)}>{children}</div>
);
