// src/components/ui/Checkbox.tsx — märkeruut.
import React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from './cn';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
  className?: string;
  'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, className, ...props }) => (
  <CheckboxPrimitive.Root
    checked={checked}
    onCheckedChange={(c) => onCheckedChange(c === true)}
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-field text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check size={12} strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
