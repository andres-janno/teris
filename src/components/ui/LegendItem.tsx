// src/components/ui/LegendItem.tsx — legendi kirje: värvimärk (andmevärv), nimi, valikuline väärtus ja märkus.
import React from 'react';
import { cn } from './cn';
import { legendItemClass, legendMarkerClass, legendNoteClass, legendValueClass } from './variants';

export const LegendItem: React.FC<{
  color: string;
  value?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ color, value, note, className, children }) => (
  <span className={cn(legendItemClass, className)}>
    <span className={legendMarkerClass} style={{ backgroundColor: color }} aria-hidden="true" />
    <span>{children}</span>
    {value != null && <strong className={legendValueClass}>{value}</strong>}
    {note != null && <small className={legendNoteClass}>{note}</small>}
  </span>
);
