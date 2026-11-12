// src/components/ui/Dialog.tsx — ühine dialoog (asendab .modal-backdrop/.modal-content ja vaatepõhised modaalid).
// Radix hoolitseb fookuse lõksu, Esc sulgemise ja taustakerimise lukustuse eest.
import React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const WIDTHS = {
  sm: 'w-[min(420px,94vw)]',
  md: 'w-[min(640px,94vw)]',
  lg: 'w-[min(960px,96vw)]',
} as const;

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & { size?: keyof typeof WIDTHS };

export const DialogContent: React.FC<DialogContentProps> = ({ size = 'md', className, children, ...props }) => (
  <DialogPrimitive.Portal>
    {/* z 2000 nagu praegune .modal-backdrop — Leafleti kihtidest (≤1000) kõrgemal */}
    <DialogPrimitive.Overlay className="fixed inset-0 z-2000 bg-overlay backdrop-blur-sm" />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-2000 flex max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-popover text-foreground shadow-dialog focus:outline-none',
        WIDTHS[size],
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

interface DialogHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Lisanupud pealkirja ja sulgemisnupu vahel. */
  children?: React.ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ title, description, children }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
    <div className="min-w-0">
      <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
      {description && <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">{description}</DialogPrimitive.Description>}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {children}
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Sulge" title="Sulge">
          <X size={16} />
        </Button>
      </DialogPrimitive.Close>
    </div>
  </div>
);

export const DialogBody: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-4', className)} {...props} />
);

export const DialogFooter: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-end gap-2.5 border-t border-border px-6 py-3', className)} {...props} />
);
