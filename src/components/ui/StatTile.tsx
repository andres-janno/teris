// src/components/ui/StatTile.tsx — näitaja plaat: silt, suur number (+ ühik), väike lisarida ja selgitus.
import React from 'react';
import { Card } from './Card';
import { cn } from './cn';
import {
  statTileClass, statTileLabelClass, statTileNoteClass, statTileSubClass, statTileUnitClass, statTileValueClass, type StatTone,
} from './variants';

export const StatTile: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  note?: React.ReactNode;
  tone?: StatTone;
  empty?: boolean;
  className?: string;
}> = ({ label, value, unit, sub, note, tone, empty, className }) => (
  <Card variant="tile" padding="sm" className={cn(statTileClass({ tone }), className)}>
    <span className={statTileLabelClass}>{label}</span>
    <div className={statTileValueClass({ tone, empty })}>
      {value}
      {unit != null && unit !== '' && <span className={statTileUnitClass}> {unit}</span>}
    </div>
    {sub != null && <div className={statTileSubClass}>{sub}</div>}
    {note != null && <p className={statTileNoteClass}>{note}</p>}
  </Card>
);
