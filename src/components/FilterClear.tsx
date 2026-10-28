// src/components/FilterClear.tsx — filtri (rippmenüü või otsinguvälja) ümbris: aktiivse filtri lõpus X-nupp,
// mis eemaldab tingimuse ühe klõpsuga. Kasutusel kogu rakenduses, et filtrite tühjendamine oleks ühtne.
import React from 'react';
import { X } from 'lucide-react';

interface FilterClearProps {
  active: boolean; // kas filtril on vaikeväärtusest erinev tingimus
  onClear: () => void;
  className?: string;
  children: React.ReactNode;
}

export const FilterClear: React.FC<FilterClearProps> = ({ active, onClear, className, children }) => (
  <span className={`filter-clear${active ? ' active' : ''}${className ? ` ${className}` : ''}`}>
    {children}
    {active && (
      <button type="button" className="filter-clear-btn" title="Eemalda filter" aria-label="Eemalda filter" onClick={onClear}>
        <X size={14} strokeWidth={2.5} />
      </button>
    )}
  </span>
);
