// src/components/ui/ToggleGroup.tsx — ühe valikuga nupurida (aasta valik, filtrid; kasutaja otsus 2026-11-14:
// üks hall raam, rida murdub). Sama välimus mis segmenteeritud sakkidel. Klõps aktiivsel ei tühista valikut.
// variant="pills": eraldi hallid nupud, valitu täisroheline — hooaasta valik.
import React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cn } from './cn';
import { tabsListVariants, tabsTriggerVariants } from './variants';

type ToggleGroupProps = Omit<
  Extract<React.ComponentProps<typeof ToggleGroupPrimitive.Root>, { type: 'single' }>,
  'type' | 'value' | 'defaultValue' | 'onValueChange'
> & { value: string; onValueChange: (value: string) => void; 'aria-label': string; variant?: ToggleGroupVariant };

type ToggleGroupVariant = 'segmented' | 'pills';
const ItemVariantContext = React.createContext<ToggleGroupVariant>('segmented');

export const ToggleGroup: React.FC<ToggleGroupProps> = ({ className, value, onValueChange, variant = 'segmented', ...props }) => (
  <ItemVariantContext.Provider value={variant}>
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next: string) => { if (next) onValueChange(next); }}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  </ItemVariantContext.Provider>
);

export const ToggleGroupItem: React.FC<React.ComponentProps<typeof ToggleGroupPrimitive.Item>> = ({ className, ...props }) => {
  const variant = React.useContext(ItemVariantContext);
  return <ToggleGroupPrimitive.Item className={cn(tabsTriggerVariants({ variant }), className)} {...props} />;
};
