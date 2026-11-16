// src/components/ui/Popover.tsx — hüpik (klõpsuga) ja vihje (hõljumisel).
import React from 'react';
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from './cn';
import { stopEscape, usePopupContainer } from './Dialog';
import { popoverContentClass, tooltipContentClass } from './variants';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverContent: React.FC<React.ComponentProps<typeof PopoverPrimitive.Content>> = ({
  className, sideOffset = 6, align = 'start', collisionPadding = 8, onEscapeKeyDown, ...props
}) => (
  <PopoverPrimitive.Portal container={usePopupContainer()}>
    <PopoverPrimitive.Content
      sideOffset={sideOffset}
      align={align}
      collisionPadding={collisionPadding}
      className={cn(popoverContentClass, 'max-h-(--radix-popover-content-available-height)', className)}
      onEscapeKeyDown={stopEscape(onEscapeKeyDown)}
      {...props}
    />
  </PopoverPrimitive.Portal>
);

/** Vihje-provider: üks rakenduse juures (main.tsx), et viivitus oleks kõigil ühine. */
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>
);

interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Üks element, mis saab ref-i vastu võtta (nupp, span). */
  children: React.ReactElement;
  /** Keelatud nupp ei püüa hõljumist: ümbritse laps span-iga, et vihje töötaks. */
  wrapDisabled?: boolean;
  /** Ümbris-span'i klass: asetus (absolute, margin-left:auto) peab olema ümbrisel, mitte nupul. */
  wrapperClassName?: string;
}

/** Vihje (ainult tekstita ikoonnuppudele). Vajab TooltipProvider'it rakenduse juures. */
export const Tooltip: React.FC<TooltipProps> = ({ content, side = 'top', children, wrapDisabled = false, wrapperClassName }) => (
  <TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>
      {wrapDisabled ? <span className={cn('inline-flex', wrapperClassName)} tabIndex={-1}>{children}</span> : children}
    </TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal container={usePopupContainer()}>
      <TooltipPrimitive.Content side={side} sideOffset={6} collisionPadding={8} className={tooltipContentClass} onEscapeKeyDown={(e) => e.stopPropagation()}>
        {content}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
