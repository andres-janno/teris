// src/components/ui/Input.tsx — tekstiväli ja mitmerealine väli (asendab .form-input).
// Kuupäeva jaoks kasuta DateInput-i (pp.kk.aaaa), arvu jaoks NumberInput-i.
import React from 'react';
import { cn } from './cn';
import { fieldControlClass } from './variants';

export const Input: React.FC<React.ComponentProps<'input'>> = ({ className, ...props }) => (
  <input className={cn(fieldControlClass, 'h-8 px-2.5', className)} {...props} />
);

export const Textarea: React.FC<React.ComponentProps<'textarea'>> = ({ className, ...props }) => (
  <textarea className={cn(fieldControlClass, 'min-h-16 px-2.5 py-1.5', className)} {...props} />
);
