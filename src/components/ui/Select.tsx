// src/components/ui/Select.tsx — valikukast ilma otsinguta (rakenduse oma loend, kasutaja otsus 2026-11-15).
// Tühi valik (value '') ja rühmad (option.group) on toetatud. Otsinguga/värvitäpiga filter: FilterSelect.
import React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { fieldControlClass, fieldSizeClass, menuContentClass, menuItemClass, menuLabelClass, type FieldSize } from './variants';
import { fromRadixValue, groupOptions, toRadixValue, type SelectOption } from './selectOptions';

export type { SelectOption };

interface SelectProps {
  value: string; // '' = valimata (või tühi valik, kui options sisaldab value '')
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  size?: FieldSize;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export const Select: React.FC<SelectProps> = ({
  value, onValueChange, options, placeholder = 'Vali…', disabled, className, id, size = 'md', name, required, autoFocus, ...aria
}) => (
  <SelectPrimitive.Root
    value={toRadixValue(value, options)}
    onValueChange={(v) => onValueChange(fromRadixValue(v))}
    disabled={disabled}
    name={name}
    required={required}
  >
    <SelectPrimitive.Trigger
      data-slot="select"
      id={id}
      autoFocus={autoFocus}
      aria-label={aria['aria-label']}
      aria-invalid={aria['aria-invalid']}
      aria-describedby={aria['aria-describedby']}
      className={cn(fieldControlClass, fieldSizeClass[size], 'flex items-center justify-between gap-2 text-left data-[placeholder]:text-subtle', className)}
    >
      <span className="min-w-0 truncate"><SelectPrimitive.Value placeholder={placeholder} /></span>
      <SelectPrimitive.Icon>
        <ChevronDown size={14} className="text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(menuContentClass, 'max-h-72 min-w-(--radix-select-trigger-width)')}
        // Esc sulgeb ainult loendi: Radix ei peata levi ja muidu sulgeks see ka taga oleva paneeli/kaardi/rea
        // (window/document kuulajad), nagu natiivne <select> seda ei teinud. Sama mis Dialog.tsx-is.
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <SelectPrimitive.Viewport>
          {groupOptions(options).map((g, gi) => {
            const items = g.options.map((o) => (
              <SelectPrimitive.Item key={o.value || '__empty'} value={toRadixValue(o.value, options)} disabled={o.disabled} className={cn(menuItemClass, 'relative pr-8')}>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                  <Check size={14} className="text-primary" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ));
            return g.group ? (
              <SelectPrimitive.Group key={`g${gi}`}>
                <SelectPrimitive.Label className={menuLabelClass}>{g.group}</SelectPrimitive.Label>
                {items}
              </SelectPrimitive.Group>
            ) : (
              <React.Fragment key={`g${gi}`}>{items}</React.Fragment>
            );
          })}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
