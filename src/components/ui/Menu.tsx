// src/components/ui/Menu.tsx — rippmenüü (nupu all) ja kontekstimenüü (paremklõps), sama välimusega.
import React from 'react';
import { Check } from 'lucide-react';
import { ContextMenu as ContextMenuPrimitive, DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { cn } from './cn';
import { stopEscape, usePopupContainer } from './Dialog';
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from './variants';

type ItemExtra = { danger?: boolean };
const itemClass = (danger: boolean | undefined, className: string | undefined) =>
  cn(menuItemClass, danger && 'text-destructive', className);

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Content>> = ({
  className, sideOffset = 4, collisionPadding = 8, onEscapeKeyDown, ...props
}) => (
  <DropdownMenuPrimitive.Portal container={usePopupContainer()}>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(menuContentClass, 'max-h-(--radix-dropdown-menu-content-available-height)', className)}
      onEscapeKeyDown={stopEscape(onEscapeKeyDown)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);
export const DropdownMenuItem: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Item> & ItemExtra> = ({ className, danger, ...props }) => (
  <DropdownMenuPrimitive.Item className={itemClass(danger, className)} {...props} />
);
/** Märkeruudu kirje: linnuke vasakul. Valik ei sulge menüüd, kui kutsuja annab onSelect={(e) => e.preventDefault()}. */
export const DropdownMenuCheckboxItem: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>> = ({ className, children, ...props }) => (
  <DropdownMenuPrimitive.CheckboxItem className={cn(menuItemClass, className)} {...props}>
    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-field text-primary [&_svg]:size-3.5!">
      <DropdownMenuPrimitive.ItemIndicator className="flex">
        <Check strokeWidth={3} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
);
export const DropdownMenuSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <DropdownMenuPrimitive.Separator className={cn(menuSeparatorClass, className)} />
);
export const DropdownMenuLabel: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Label>> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Label className={cn(menuLabelClass, className)} {...props} />
);

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuContent: React.FC<React.ComponentProps<typeof ContextMenuPrimitive.Content>> = ({ className, collisionPadding = 8, onEscapeKeyDown, ...props }) => (
  <ContextMenuPrimitive.Portal container={usePopupContainer()}>
    <ContextMenuPrimitive.Content
      collisionPadding={collisionPadding}
      className={cn(menuContentClass, 'max-h-(--radix-context-menu-content-available-height)', className)}
      onEscapeKeyDown={stopEscape(onEscapeKeyDown)}
      {...props}
    />
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

/** Kahe rea kirje sisu (pealkiri + alamtekst); kirjele lisa className="items-start". */
export const MenuItemText: React.FC<{ title: React.ReactNode; description?: React.ReactNode }> = ({ title, description }) => (
  <span className="flex min-w-0 flex-col">
    <span>{title}</span>
    {description && <span className="text-2xs text-muted-foreground">{description}</span>}
  </span>
);
