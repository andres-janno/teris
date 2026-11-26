// src/components/ui/Tabs.tsx — sakid: `line` (allajoonitud) ja `segmented` (nupurühm).
import React, { createContext, useContext } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from './cn';
import { tabsListVariants, tabsTriggerVariants } from './variants';

type TabsVariant = 'line' | 'segmented';
const VariantContext = createContext<TabsVariant>('line');

type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root> & { variant?: TabsVariant };

export const Tabs: React.FC<TabsProps> = ({ variant = 'line', ...props }) => (
  <VariantContext.Provider value={variant}>
    <TabsPrimitive.Root {...props} />
  </VariantContext.Provider>
);

export const TabsList: React.FC<React.ComponentProps<typeof TabsPrimitive.List>> = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn(tabsListVariants({ variant: useContext(VariantContext) }), className)} {...props} />
);

export const TabsTrigger: React.FC<React.ComponentProps<typeof TabsPrimitive.Trigger>> = ({ className, ...props }) => (
  <TabsPrimitive.Trigger className={cn(tabsTriggerVariants({ variant: useContext(VariantContext) }), className)} {...props} />
);
