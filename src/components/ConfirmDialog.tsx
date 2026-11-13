// src/components/ConfirmDialog.tsx
// Rakendusesisene kinnitus- ja teatedialoog brauseri confirm()/alert() asemel.
// Kasutus: `if (!(await confirmDialog('Kas soovid kindlasti kustutada …?'))) return;`
//          `alertDialog('Hooaeg on lukus.');`
import React, { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from './ui';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Punane kinnitusnupp (kustutamine, eemaldamine). Vaikimisi tuletatakse tekstist. */
  danger?: boolean;
}

interface DialogProps {
  kind: 'confirm' | 'alert';
  message: string;
  options: ConfirmOptions;
  onResult: (ok: boolean) => void;
}

const isDeleteText = (message: string) => /kustut|eemald/i.test(message);

const ConfirmView: React.FC<DialogProps> = ({ kind, message, options, onResult }) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = options.danger ?? (kind === 'confirm' && isDeleteText(message));
  const confirmLabel = options.confirmLabel
    ?? (kind === 'alert' ? 'Selge' : /kustut/i.test(message) ? 'Kustuta' : /eemald/i.test(message) ? 'Eemalda' : 'Jah');
  const title = options.title ?? (kind === 'alert' ? 'Teade' : danger ? 'Kinnita kustutamine' : 'Kinnita toiming');
  const Icon = kind === 'alert' ? Info : danger ? Trash2 : AlertTriangle;

  useEffect(() => {
    // window capture jõuab enne teiste akende document-taseme kuulajaid: Esc sulgeb ainult selle dialoogi
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onResult(kind === 'alert');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [kind, onResult]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onResult(kind === 'alert'); }}>
      <DialogContent
        size="sm"
        layer="alert"
        closeOnOutsideClick
        className="confirm-dialog"
        role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="confirm-dialog-body">
          <span className={`confirm-dialog-icon ${danger ? 'danger' : kind === 'alert' ? 'info' : 'warning'}`}>
            <Icon size={20} />
          </span>
          <div>
            <DialogTitle asChild><h3>{title}</h3></DialogTitle>
            <DialogDescription asChild><p>{message}</p></DialogDescription>
          </div>
        </div>
        <DialogFooter>
          {kind === 'confirm' && (
            <Button type="button" variant="ghost" onClick={() => onResult(false)}>
              {options.cancelLabel ?? 'Loobu'}
            </Button>
          )}
          <Button ref={confirmRef} type="button" variant={danger ? 'danger' : 'primary'} onClick={() => onResult(true)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
// Dialoogid näidatakse järjest (nt teade kohe pärast kinnitust)
let queue: Promise<unknown> = Promise.resolve();

function show(kind: DialogProps['kind'], message: string, options: ConfirmOptions): Promise<boolean> {
  const next = queue.then(
    () =>
      new Promise<boolean>((resolve) => {
        if (!container) {
          container = document.createElement('div');
          container.className = 'confirm-dialog-root';
          document.body.appendChild(container);
          root = createRoot(container);
        }
        const previousFocus = document.activeElement as HTMLElement | null;
        const finish = (ok: boolean) => {
          // flushSync: Radixi fookuslõks eemaldub enne fookuse tagastamist (muidu tõmbab lõks fookuse tagasi dialoogi)
          flushSync(() => root?.render(null));
          previousFocus?.focus?.();
          resolve(ok);
        };
        root!.render(<ConfirmView kind={kind} message={message} options={options} onResult={finish} />);
      })
  );
  queue = next.catch(() => undefined);
  return next;
}

/** Kinnitusdialoog: tagastab true, kui kasutaja kinnitas. */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return show('confirm', message, options);
}

/** Teatedialoog (brauseri alert() asemel). */
export function alertDialog(message: string, options: ConfirmOptions = {}): Promise<void> {
  return show('alert', message, options).then(() => undefined);
}
