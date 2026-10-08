// src/components/DateInput.tsx — kuupäeva väli eesti vormingus (pp.kk.aaaa) ja eestikeelse kalendrivalijaga.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, parseEtDate } from '../services/dateFormat';

interface DateInputProps {
  value: string; // ISO 'YYYY-MM-DD' või ''
  onChange: (iso: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  popupPlacement?: 'top' | 'bottom';
}

const MONTH_NAMES = [
  'Jaanuar', 'Veebruar', 'Märts', 'Aprill', 'Mai', 'Juuni',
  'Juuli', 'August', 'September', 'Oktoober', 'November', 'Detsember'
];

const WEEK_DAYS = ['E', 'T', 'K', 'N', 'R', 'L', 'P'];

const toText = (raw: string) => {
  if (!raw) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;
  return formatDate(raw);
};

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className,
  disabled,
  required,
  id,
  popupPlacement = 'bottom'
}) => {
  const [text, setText] = useState(toText(value));
  const [invalid, setInvalid] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Kalendri vaade (aasta ja kuu)
  const [viewDate, setViewDate] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    if (value && /^\d{2}\.\d{2}\.\d{4}/.test(value)) {
      const [, m, y] = value.split('.').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    setText(toText(value));
    setInvalid(false);
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewDate({ year: y, month: m - 1 });
    } else if (value && /^\d{2}\.\d{2}\.\d{4}/.test(value)) {
      const [, m, y] = value.split('.').map(Number);
      setViewDate({ year: y, month: m - 1 });
    }
  }, [value]);

  // Sulgemine klikkides väljapoole või Esc vajutusel
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleSelectDate = (iso: string) => {
    onChange(iso);
    setText(toText(iso));
    setInvalid(false);
    setIsOpen(false); // Sulgub automaatselt valimisel
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    handleSelectDate(iso);
  };

  // Kalendri päevade arvutus
  const calendarCells = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const startDayIndex = (firstDay.getDay() + 6) % 7; // Esmaspäev = 0

    const cells: Array<{
      day: number;
      isCurrentMonth: boolean;
      iso: string;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Eelmise kuu lõpupäevad
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const iso = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        isCurrentMonth: false,
        iso,
        isSelected: iso === value,
        isToday: iso === todayIso
      });
    }

    // Käesoleva kuu päevad
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        isCurrentMonth: true,
        iso,
        isSelected: iso === value,
        isToday: iso === todayIso
      });
    }

    // Järgmise kuu päevad kuni nädala lõpuni
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const targetLength = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < targetLength) {
      const iso = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      cells.push({
        day: nextDay,
        isCurrentMonth: false,
        iso,
        isSelected: iso === value,
        isToday: iso === todayIso
      });
      nextDay++;
    }

    return cells;
  }, [viewDate, value]);

  return (
    <div ref={containerRef} className={`date-input ${invalid ? 'invalid' : ''}`}>
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
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
      />
      <button
        type="button"
        className="date-input-btn"
        onClick={toggleOpen}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Vali kalendrist"
        title={isOpen ? 'Sulge kalender' : 'Vali kalendrist'}
      >
        <CalendarDays size={15} />
      </button>

      {isOpen && (
        <div
          className={`date-picker-popup animate-scale-up ${popupPlacement === 'top' ? 'date-picker-popup-top' : ''}`}
          role="dialog"
          aria-label="Kuupäeva valija"
        >
          <div className="date-picker-header">
            <span className="date-picker-title">
              {MONTH_NAMES[viewDate.month]} {viewDate.year}
            </span>
            <div className="date-picker-nav">
              <button
                type="button"
                className="date-picker-nav-btn"
                onClick={prevMonth}
                title="Eelmine kuu"
                aria-label="Eelmine kuu"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="date-picker-today-btn"
                onClick={handleToday}
                title="Vali tänane kuupäev"
              >
                Täna
              </button>
              <button
                type="button"
                className="date-picker-nav-btn"
                onClick={nextMonth}
                title="Järgmine kuu"
                aria-label="Järgmine kuu"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="date-picker-weekdays">
            {WEEK_DAYS.map((wd, idx) => (
              <span key={idx} className="date-picker-weekday">{wd}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {calendarCells.map((cell) => (
              <button
                key={cell.iso}
                type="button"
                className={`date-picker-day ${cell.isCurrentMonth ? 'current' : 'other'} ${cell.isSelected ? 'selected' : ''} ${cell.isToday ? 'today' : ''}`}
                onClick={() => handleSelectDate(cell.iso)}
              >
                {cell.day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
