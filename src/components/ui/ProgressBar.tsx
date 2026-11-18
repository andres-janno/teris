// src/components/ui/ProgressBar.tsx — edenemisriba (0–100%), täide roheline; laius on dünaamiline andmeväärtus.
import React from 'react';
import { cn } from './cn';
import { clampPercent } from './progress';
import { progressFillClass, progressTrackClass } from './variants';

export const ProgressBar: React.FC<{ value: number; className?: string; 'aria-label'?: string }> = ({ value, className, 'aria-label': ariaLabel }) => {
  const pct = clampPercent(value);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={ariaLabel} className={cn(progressTrackClass, className)}>
      <div className={progressFillClass} style={{ width: `${pct}%` }} />
    </div>
  );
};
