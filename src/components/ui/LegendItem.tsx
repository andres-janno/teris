// src/components/ui/LegendItem.tsx — legendi kirje: värvimärk (andmevärv), nimi (label), valikuline väärtus ja märkus.
import React from 'react';
import { cn } from './cn';
import { legendItemClass, legendMarkerClass, legendNoteClass, legendValueClass } from './variants';

export const LegendItem: React.FC<{
  color: string;
  label: React.ReactNode;
  value?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}> = ({ color, label, value, note, className }) => (
  <span className={cn(legendItemClass, className)}>
    <span className={legendMarkerClass} style={{ backgroundColor: color }} aria-hidden="true" />
    <span>{label}</span>
    {value != null && <strong className={legendValueClass}>{value}</strong>}
    {note != null && <small className={legendNoteClass}>{note}</small>}
  </span>
);
