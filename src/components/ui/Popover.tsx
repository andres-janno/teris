// src/components/ui/Popover.tsx — hüpik (klõpsuga) ja vihje (hõljumisel).
import React from 'react';
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from './cn';
import { popoverContentClass, tooltipContentClass } from './variants';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverContent: React.FC<React.ComponentProps<typeof PopoverPrimitive.Content>> = ({ className, sideOffset = 6, align = 'start', ...props }) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content sideOffset={sideOffset} align={align} className={cn(popoverContentClass, className)} {...props} />
  </PopoverPrimitive.Portal>
);

interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Üks element, mis saab ref-i vastu võtta (nupp, span). */
  children: React.ReactElement;
}

/** Iseseisev vihje — Provider on sees, et kasutamiseks poleks vaja rakenduse juurt muuta. */
export const Tooltip: React.FC<TooltipProps> = ({ content, side = 'top', children }) => (
  <TooltipPrimitive.Provider delayDuration={300}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className={tooltipContentClass}>
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);
