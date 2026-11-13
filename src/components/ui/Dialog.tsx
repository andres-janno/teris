// src/components/ui/Dialog.tsx — ühine dialoog (asendab vanad modaaliklassid ja vaatepõhised modaalid).
// Radix: fookuse lõks, Esc, taustakerimise lukk; pesastatud aknad kihistuvad DOM-järjekorra järgi.
// Sulgemine (kasutaja otsus 2026-11-13): Esc sulgeb; taustaklõps ainult siis, kui closeOnOutsideClick (kinnitus/teade).
import React, { createContext, useContext, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { dialogContentClass, dialogLayerClass, type DialogLayer, type DialogSize } from './variants';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// Hüpikud (kuupäev, otsinguga valik, vihje) portaalivad dialoogi sees dialoogi sisuelementi: Radixi modaalne lukk
// teeb muu lehe klõpsamatuks ja klõps väljaspool sisu loeks akna sulgemiseks.
const PopupContainerContext = createContext<HTMLElement | null>(null);
/** Kuhu hüpik portaalida: avatud dialoogi sisu või document.body. */
export const usePopupContainer = (): HTMLElement => useContext(PopupContainerContext) ?? document.body;

type DialogContentProps = Omit<React.ComponentProps<typeof DialogPrimitive.Content>, 'onInteractOutside'> & {
  size?: DialogSize;
  layer?: DialogLayer;
  /** Fikseeritud kõrgus min(880px, 92vh) (nt finantsid, kus sisu täidab akna). */
  fillHeight?: boolean;
  /** Taustaklõps sulgeb — ainult kinnitus- ja teateaken. */
  closeOnOutsideClick?: boolean;
  /** false: Esc ega taust ei sulge (sundparool, salvestamine käib). */
  dismissible?: boolean;
};

export const DialogContent: React.FC<DialogContentProps> = ({
  size = 'md', layer = 'default', fillHeight = false, closeOnOutsideClick = false, dismissible = true,
  className, children, onEscapeKeyDown, ...props
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn('fixed inset-0 bg-overlay backdrop-blur-sm', dialogLayerClass(layer))} />
      {/* Paigutus flexiga, mitte transformiga; ümbris ise klõpse ei püüa (klõps läheb taustale). */}
      <div className={cn('pointer-events-none fixed inset-0 flex items-center justify-center p-4', dialogLayerClass(layer))}>
        <DialogPrimitive.Content
          ref={setContainer}
          className={cn('animate-scale-up', dialogContentClass({ size, fillHeight }), className)}
          onInteractOutside={(e) => {
            if (!dismissible || !closeOnOutsideClick) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
            onEscapeKeyDown?.(e);
          }}
          {...props}
        >
          <PopupContainerContext.Provider value={container}>{children}</PopupContainerContext.Provider>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
};

interface DialogHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ikoon pealkirja ees (vana pealkirjagrupp). */
  icon?: React.ReactNode;
  /** false: sulgemisnuppu pole (nt sundparool). */
  showClose?: boolean;
  /** Lisanupud pealkirja ja sulgemisnupu vahel. */
  children?: React.ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ title, description, icon, showClose = true, children }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
    <div className="flex min-w-0 items-center gap-3">
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
        {description && <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">{description}</DialogPrimitive.Description>}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {children}
      {showClose && (
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Sulge" title="Sulge">
            <X size={16} />
          </Button>
        </DialogPrimitive.Close>
      )}
    </div>
  </div>
);

/** Vorm akna sisu juurena: päis, keha ja jalus vormi sees (submit Enteriga). */
export const DialogForm: React.FC<React.ComponentProps<'form'>> = ({ className, ...props }) => (
  <form className={cn('flex min-h-0 flex-1 flex-col', className)} {...props} />
);

export const DialogBody: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4', className)} {...props} />
);

export const DialogFooter: React.FC<React.ComponentProps<'div'>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-end gap-2.5 border-t border-border px-6 py-3', className)} {...props} />
);
