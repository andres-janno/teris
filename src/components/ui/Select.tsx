// src/components/ui/Select.tsx — valikukast ilma otsinguta. Otsinguga valik: FilterSelect.
import React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { fieldControlClass, menuContentClass, menuItemClass } from './variants';

export interface SelectOption {
  value: string; // ei tohi olla '' (Radix kasutab tühja väärtust „valimata“ tähenduses)
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string; // '' = valimata
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, options, placeholder = 'Vali…', disabled, className, id, ...aria }) => (
  // '' jääb kontrollituks; Radix näitab '' korral placeholderit (shouldShowPlaceholder), undefined läheks üle kontrollimatuks.
  <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectPrimitive.Trigger
      id={id}
      aria-label={aria['aria-label']}
      className={cn(fieldControlClass, 'flex h-8 items-center justify-between gap-2 px-2.5 text-left data-[placeholder]:text-subtle', className)}
    >
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon>
        <ChevronDown size={14} className="text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={4} className={cn(menuContentClass, 'max-h-72 min-w-(--radix-select-trigger-width)')}>
        <SelectPrimitive.Viewport>
          {options.map((o) => (
            <SelectPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} className={cn(menuItemClass, 'pr-7 relative')}>
              <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                <Check size={14} className="text-primary" />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
