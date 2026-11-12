// src/components/ui/RadioGroup.tsx — raadionuppude rühm.
import React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from './cn';

export const RadioGroup: React.FC<React.ComponentProps<typeof RadioGroupPrimitive.Root>> = ({ className, ...props }) => (
  <RadioGroupPrimitive.Root className={cn('flex gap-3', className)} {...props} />
);

interface RadioGroupItemProps {
  value: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export const RadioGroupItem: React.FC<RadioGroupItemProps> = ({ className, ...props }) => (
  <RadioGroupPrimitive.Item
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-field cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary',
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="block size-2 rounded-full bg-primary" />
  </RadioGroupPrimitive.Item>
);
