// src/components/DateInput.tsx — kuupäeva väli eesti vormingus (pp.kk.aaaa).
// Brauseri <input type="date"> näitab kuupäeva brauseri keele järgi (nt mm/dd/yyyy),
// seepärast kirjutatakse kuupäev tekstiväljale; kalendri nupp avab brauseri valija.
import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDate, parseEtDate } from '../services/dateFormat';

interface DateInputProps {
  value: string;                      // ISO 'YYYY-MM-DD' või ''
  onChange: (iso: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const toText = (iso: string) => (iso ? formatDate(iso) : '');

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, className, disabled, required, id }) => {
  const [text, setText] = useState(toText(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(toText(value));
    setInvalid(false);
  }, [value]);

  const commit = (raw: string) => {
    const iso = parseEtDate(raw);
    if (iso === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (iso !== value) onChange(iso);
    else setText(toText(iso));
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div className={`date-input ${invalid ? 'invalid' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="pp.kk.aaaa"
        className={className}
        value={text}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        title={invalid ? 'Sisesta kuupäev kujul pp.kk.aaaa' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) setInvalid(parseEtDate(e.target.value) === null);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Enter kinnitab kuupäeva, vormi ei saadeta enne kui väärtus on uuendatud
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
      />
      <button
        type="button"
        className="date-input-btn"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Vali kalendrist"
        title="Vali kalendrist"
      >
        <CalendarDays size={15} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="date-input-picker"
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
