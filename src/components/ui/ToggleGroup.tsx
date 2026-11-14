// src/components/ui/ToggleGroup.tsx — ühe valikuga nupurida (aasta valik, filtrid; kasutaja otsus 2026-11-14:
// üks hall raam, rida murdub). Sama välimus mis segmenteeritud sakkidel. Klõps aktiivsel ei tühista valikut.
import React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cn } from './cn';
import { tabsListVariants, tabsTriggerVariants } from './variants';

type ToggleGroupProps = Omit<
  Extract<React.ComponentProps<typeof ToggleGroupPrimitive.Root>, { type: 'single' }>,
  'type' | 'value' | 'defaultValue' | 'onValueChange'
> & { value: string; onValueChange: (value: string) => void; 'aria-label': string };

export const ToggleGroup: React.FC<ToggleGroupProps> = ({ className, value, onValueChange, ...props }) => (
  <ToggleGroupPrimitive.Root
    type="single"
    value={value}
    onValueChange={(next: string) => { if (next) onValueChange(next); }}
    className={cn(tabsListVariants({ variant: 'segmented' }), className)}
    {...props}
  />
);

export const ToggleGroupItem: React.FC<React.ComponentProps<typeof ToggleGroupPrimitive.Item>> = ({ className, ...props }) => (
  <ToggleGroupPrimitive.Item className={cn(tabsTriggerVariants({ variant: 'segmented' }), className)} {...props} />
);
