// src/components/FilterSelect.tsx — filtri rippmenüü, mille avatud loendi joonistab rakendus ise.
// Natiivne <select> näitab macOS-is valikuid paksu kirjaga; siin on välimus kõigil platvormidel sama.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

export interface FilterSelectOption {
  value: string;
  label: string;
  group?: string; // järjestikused sama grupiga valikud saavad väikese grupipäise
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  defaultValue?: string; // „Kõik …“ väärtus; sellest erinev valik näidatakse paksult
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

// Tähe järgi hüpe: leiab järgmise valiku (alates start+1, tsükliliselt), mille silt algab antud tähega
export const findTypeaheadIndex = (labels: string[], start: number, char: string): number => {
  const c = char.toLocaleLowerCase('et');
  for (let i = 1; i <= labels.length; i++) {
    const idx = (start + i) % labels.length;
    if (labels[idx].trim().toLocaleLowerCase('et').startsWith(c)) return idx;
  }
  return -1;
};

interface ListPos { left: number; top?: number; bottom?: number; minWidth: number; maxHeight: number }

export const FilterSelect: React.FC<FilterSelectProps> = ({
  value, onChange, options, defaultValue = '', className, style, title, disabled, ariaLabel
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<ListPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (idx: number) => {
    const o = options[idx];
    if (o && o.value !== value) onChange(o.value);
    close(true);
  };

  // Asukoht trigeri all (või kohal üleval, kui all pole ruumi)
  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    const flip = below < 200 && above > below;
    const maxHeight = Math.max(120, Math.min(320, flip ? above : below));
    setPos({
      left: r.left,
      minWidth: r.width,
      maxHeight,
      ...(flip ? { bottom: window.innerHeight - r.top + 2 } : { top: r.bottom + 2 })
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Esc sulgeb ainult loendi, mitte ümbritsevat akent (capture aknal jõuab enne dialoogi kuulajaid)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        close(true);
      }
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  // Aktiivne valik hoitakse nähtaval
  useEffect(() => {
    if (!open || !pos) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, pos]);

  // Ava loendi fookus: nooleklahvid töötavad triggeril, loend ise ei võta fookust
  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      }
      return;
    }
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') { setOpen(false); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const idx = findTypeaheadIndex(options.map((o) => o.label), active, e.key);
      if (idx >= 0) setActive(idx);
    }
  };

  const isDefault = value === defaultValue;
  const listId = React.useId();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`form-input filter-select-trigger${isDefault ? '' : ' is-set'}${className ? ` ${className}` : ''}`}
        style={style}
        title={title}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="filter-select-label">{selected?.label ?? ''}</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="filter-select-list"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth, maxHeight: pos.maxHeight }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => {
            const showGroup = !!o.group && (i === 0 || options[i - 1].group !== o.group);
            return (
              <React.Fragment key={`${o.value}:${i}`}>
                {showGroup && <div className="filter-select-group" role="presentation">{o.group}</div>}
                <div
                  role="option"
                  aria-selected={i === selectedIndex}
                  data-idx={i}
                  className={`filter-select-option${i === selectedIndex ? ' checked' : ''}${i === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className="filter-select-check">{i === selectedIndex && <Check size={14} strokeWidth={2.5} />}</span>
                  <span className="filter-select-option-label">{o.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};
