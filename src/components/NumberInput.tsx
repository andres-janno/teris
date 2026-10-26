import { useEffect, useRef, useState } from 'react';

/** Parsib kasutaja sisestatud teksti (koma või punkt kümnendmärgina). Tühi/vigane → null. */
export function parseNumberText(text: string, integer?: boolean): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || !/^-?\d*\.?\d*$/.test(t)) return null;
  if (!/\d/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.round(n) : n;
}

/** Vormindab arvu et-EE stiilis ilma tuhandete eraldajata, koma kümnendmärgiga. */
export function formatNumberText(n: number, decimals: number): string {
  const rounded = Number(n.toFixed(Math.max(0, decimals)));
  return String(rounded).replace('.', ',');
}

interface NumberInputProps {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  decimals?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  title?: string;
}

/** Numbrisisend, mille saab tühjaks teha (väärtus null) ja mis toetab koma. */
export function NumberInput({
  value, onChange, decimals = 2, min, max, integer, className, id, placeholder,
  disabled, required, title, ...rest
}: NumberInputProps) {
  const dec = integer ? 0 : decimals;
  const [text, setText] = useState(() => (value == null ? '' : formatNumberText(value, dec)));
  const textRef = useRef(text);
  textRef.current = text;

  // Sünkrooni väljastpoolt tulnud muutusega, aga ära kirjuta kasutaja sisestust üle.
  useEffect(() => {
    const parsed = parseNumberText(textRef.current, integer);
    const incoming = value ?? null;
    if (parsed !== incoming) setText(incoming == null ? '' : formatNumberText(incoming, dec));
  }, [value, integer, dec]);

  const handleChange = (raw: string) => {
    setText(raw);
    onChange(parseNumberText(raw, integer));
  };

  const handleBlur = () => {
    let n = parseNumberText(text, integer);
    if (n == null) { setText(''); return; }
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    setText(formatNumberText(n, dec));
    if (n !== parseNumberText(text, integer)) onChange(n);
  };

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      className={`form-input num ${className ?? ''}`}
      id={id}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      title={title}
      aria-label={rest['aria-label']}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
