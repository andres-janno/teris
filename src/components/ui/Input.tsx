// src/components/ui/Input.tsx — tekstiväli ja mitmerealine väli (asendab .form-input).
// Kuupäeva jaoks kasuta DateInput-i (pp.kk.aaaa), arvu jaoks NumberInput-i. start/end: ikoon, ühik (ha, €), nupp.
import React from 'react';
import { cn } from './cn';
import { fieldControlClass, fieldShellClass, fieldSizeClass, type FieldSize } from './variants';

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: FieldSize;
  numeric?: boolean; // arv paremale, ühelaiused numbrid
  start?: React.ReactNode;
  end?: React.ReactNode;
};

const readOnlyClass = 'read-only:enabled:cursor-default read-only:enabled:font-semibold';

export const Input: React.FC<InputProps> = ({ className, size = 'md', numeric, start, end, ...props }) => {
  const numericClass = numeric && 'text-right tabular-nums';
  if (start == null && end == null) {
    return (
      <input
        data-slot="input"
        className={cn(fieldControlClass, fieldSizeClass[size], readOnlyClass, 'read-only:enabled:bg-muted', numericClass, className)}
        {...props}
      />
    );
  }
  return (
    <div data-slot="input-group" className={cn(fieldShellClass, fieldSizeClass[size], 'has-[input:read-only:enabled]:bg-muted', className)}>
      {start != null && <span className="inline-flex shrink-0 items-center text-muted-foreground">{start}</span>}
      <input
        data-slot="input"
        className={cn('h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle', readOnlyClass, numericClass)}
        {...props}
      />
      {end != null && <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">{end}</span>}
    </div>
  );
};

export const Textarea: React.FC<React.ComponentProps<'textarea'> & { autosize?: boolean }> = ({ className, autosize, ...props }) => (
  <textarea
    data-slot="textarea"
    className={cn(fieldControlClass, 'min-h-16 px-2.5 py-1.5', autosize && 'field-sizing-content max-h-80 resize-none', className)}
    {...props}
  />
);
