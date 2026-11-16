// src/components/ui/FilterClear.tsx — filtri ümbris: aktiivse filtri lõpus X-nupp, mis eemaldab tingimuse ühe klõpsuga.
// X on alati välja sees paremal; väli jätab talle ruumi ka siis, kui X-i pole (laius ei hüppa).
// Väljal, millel on järelliide (kalendri nupp), jääb järelliide X-ist vasakule (väli pr-8, X paremas servas).
import React from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

interface FilterClearProps {
  active: boolean; // kas filtril on vaikeväärtusest erinev tingimus
  onClear: () => void;
  fill?: boolean; // täislaius
  inline?: boolean; // X välja kõrval, mitte sees
  className?: string;
  children: React.ReactNode;
}

export const FilterClear: React.FC<FilterClearProps> = ({ active, onClear, fill, inline, className, children }) => (
  <span
    data-slot="filter-clear"
    className={cn(
      'relative inline-flex max-w-full min-w-0 items-center',
      fill && 'flex w-full [&>:not([data-slot=filter-clear-btn])]:w-full',
      inline
        ? 'gap-1'
        : [
            '[&>[data-slot=input]]:pr-8 [&>[data-slot=input-group]]:pr-8',
            // Rippmenüül jääb X noolest vasakule: tekst lõpeb X-ist vasakul (mr-4), nool jääb serva.
            '[&>[data-slot=select]>span:first-child]:mr-4 [&>[data-slot=filter-select]]:pr-8 [&>[data-slot=filter-select]>span:first-child]:mr-4',
            '[&:has(>[data-slot=select])>[data-slot=filter-clear-btn]]:right-7',
            '[&:has(>[data-slot=filter-select])>[data-slot=filter-clear-btn]]:right-7',
          ],
      className
    )}
  >
    {children}
    {active && (
      <button
        type="button"
        data-slot="filter-clear-btn"
        title="Eemalda filter"
        aria-label="Eemalda filter"
        onClick={onClear}
        className={cn(
          'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-destructive/15 hover:text-destructive',
          !inline && 'absolute right-1.5 top-1/2 -translate-y-1/2'
        )}
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    )}
  </span>
);
