import React, { useEffect, useRef, useState } from 'react';
import { Users, ChevronDown, Check } from 'lucide-react';
import type { RelatedParty } from '../types/party';

interface OperatorSelectorProps {
  parties: RelatedParty[];
  selected: string[]; // tühi = kõik operaatorid
  onChange: (ids: string[]) => void;
}

// Operaatori (harija) filter päises logo kõrval — valik kehtib kaardile, statistikale ja registritele.
export const OperatorSelector: React.FC<OperatorSelectorProps> = ({ parties, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Operaatori rolliga isikud + juba valitud (kui roll on vahepeal eemaldatud).
  const operators = parties.filter((p) => p.roles?.includes('OPERATOR') || selected.includes(p.id));
  const selectedNames = operators.filter((p) => selected.includes(p.id)).map((p) => p.name);
  const label =
    selected.length === 0
      ? 'Kõik operaatorid'
      : selected.length === 1
        ? selectedNames[0] ?? '1 operaator'
        : `${selected.length} operaatorit`;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="operator-selector" ref={rootRef}>
      <button
        type="button"
        className={`operator-selector-trigger ${selected.length ? 'filtered' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected.length ? selectedNames.join(', ') : 'Filtreeri kaarti ja statistikat operaatori (harija) järgi'}
      >
        <Users size={15} />
        <span className="operator-selector-text">
          <span className="operator-selector-caption">Operaator</span>
          <span className="operator-selector-value">{label}</span>
        </span>
        {selected.length > 0 && <span className="operator-selector-dot" />}
        <ChevronDown size={15} className="operator-selector-chevron" />
      </button>

      {open && (
        <div className="operator-selector-dropdown animate-scale-up" role="listbox" aria-multiselectable="true">
          <button
            type="button"
            className={`operator-selector-option ${selected.length === 0 ? 'checked' : ''}`}
            onClick={() => onChange([])}
          >
            <span className="operator-selector-check">{selected.length === 0 && <Check size={13} />}</span>
            <span>Kõik operaatorid</span>
          </button>
          <div className="operator-selector-divider" />
          {operators.length === 0 && <div className="operator-selector-empty">Operaatoreid pole (seotud isikute registris roll „Operaator“)</div>}
          {operators.map((p) => {
            const checked = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={checked}
                className={`operator-selector-option ${checked ? 'checked' : ''}`}
                onClick={() => toggle(p.id)}
              >
                <span className="operator-selector-check">{checked && <Check size={13} />}</span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
