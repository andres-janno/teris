// Kuupäevaväli Eesti formaadis (pp.kk.aaaa) — brauseri <input type="date"> järgib brauseri keelt, mitte lehe keelt.
import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

/** 'aaaa-kk-pp' → 'pp.kk.aaaa' */
export function isoToEt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** 'p.k.aaaa' / 'pp.kk.aaaa' → 'aaaa-kk-pp'; vigane või olematu kuupäev → null */
export function etToIso(text: string): string | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function EtDateInput({ id, value, onChange, required }: { id: string; value: string; onChange: (iso: string) => void; required?: boolean }) {
  const [text, setText] = useState(() => isoToEt(value));
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Väline muutus (laadimine, kalendrist valik) — näita Eesti formaadis.
    if (value && etToIso(text) !== value) setText(isoToEt(value));
  }, [value]);

  const update = (next: string) => {
    setText(next);
    const iso = etToIso(next);
    textRef.current?.setCustomValidity(next.trim() === '' || iso ? '' : 'Sisesta kuupäev kujul pp.kk.aaaa');
    onChange(iso ?? '');
  };

  const openPicker = () => {
    const p = pickerRef.current;
    if (!p) return;
    try {
      p.showPicker();
    } catch {
      p.click();
    }
  };

  return (
    <div className="admin-date">
      <input
        id={id}
        ref={textRef}
        className="form-input"
        type="text"
        inputMode="numeric"
        placeholder="pp.kk.aaaa"
        value={text}
        onChange={(e) => update(e.target.value)}
        required={required}
        autoComplete="off"
      />
      <button type="button" className="admin-date-btn" onClick={openPicker} aria-label="Vali kalendrist">
        <Calendar size={16} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="admin-date-picker"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => update(isoToEt(e.target.value))}
      />
    </div>
  );
}
