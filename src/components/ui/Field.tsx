// src/components/ui/Field.tsx — välja silt + abitekst + veateade (ühtne vormide ladumine).
import React from 'react';
import { cn } from './cn';

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, className, children }) => (
  <div className={cn('flex flex-col gap-1', className)}>
    <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
      {label}
    </label>
    {children}
    {error ? (
      <p role="alert" className="text-2xs text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-subtle">{hint}</p>
    ) : null}
  </div>
);
