// src/components/ui/KeyValueRow.tsx — rida „silt … väärtus“: silt vasakul, väärtus paremal servas.
import React from 'react';
import { cn } from './cn';
import { keyValueRowClass } from './variants';

export const KeyValueRow: React.FC<{ label: React.ReactNode; className?: string; children: React.ReactNode }> = ({ label, className, children }) => (
  <div className={cn(keyValueRowClass, className)}>
    <span>{label}</span>
    <span className="text-right">{children}</span>
  </div>
);
