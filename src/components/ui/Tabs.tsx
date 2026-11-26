// src/components/ui/Tabs.tsx — allajoonitud sakid (`line`). Segmenteeritud valikurida on ToggleGroup.
import React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from './cn';
import { tabsListVariants, tabsTriggerVariants } from './variants';

export const Tabs = TabsPrimitive.Root;

export const TabsList: React.FC<React.ComponentProps<typeof TabsPrimitive.List>> = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn(tabsListVariants({ variant: 'line' }), className)} {...props} />
);

export const TabsTrigger: React.FC<React.ComponentProps<typeof TabsPrimitive.Trigger>> = ({ className, ...props }) => (
  <TabsPrimitive.Trigger className={cn(tabsTriggerVariants({ variant: 'line' }), className)} {...props} />
);
