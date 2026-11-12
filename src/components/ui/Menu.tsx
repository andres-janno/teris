// src/components/ui/Menu.tsx — rippmenüü (nupu all) ja kontekstimenüü (paremklõps), sama välimusega.
import React from 'react';
import { ContextMenu as ContextMenuPrimitive, DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { cn } from './cn';
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from './variants';

type ItemExtra = { danger?: boolean };
const itemClass = (danger: boolean | undefined, className: string | undefined) =>
  cn(menuItemClass, danger && 'text-destructive', className);

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Content>> = ({ className, sideOffset = 4, ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content sideOffset={sideOffset} className={cn(menuContentClass, className)} {...props} />
  </DropdownMenuPrimitive.Portal>
);
export const DropdownMenuItem: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Item> & ItemExtra> = ({ className, danger, ...props }) => (
  <DropdownMenuPrimitive.Item className={itemClass(danger, className)} {...props} />
);
export const DropdownMenuSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <DropdownMenuPrimitive.Separator className={cn(menuSeparatorClass, className)} />
);
export const DropdownMenuLabel: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Label>> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Label className={cn(menuLabelClass, className)} {...props} />
);

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuContent: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Content>> = ({ className, ...props }) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content className={cn(menuContentClass, className)} {...props} />
  </ContextMenuPrimitive.Portal>
);
export const ContextMenuItem: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Item> & ItemExtra> = ({ className, danger, ...props }) => (
  <ContextMenuPrimitive.Item className={itemClass(danger, className)} {...props} />
);
export const ContextMenuSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <ContextMenuPrimitive.Separator className={cn(menuSeparatorClass, className)} />
);
export const ContextMenuLabel: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Label>> = ({ className, ...props }) => (
  <ContextMenuPrimitive.Label className={cn(menuLabelClass, className)} {...props} />
);
