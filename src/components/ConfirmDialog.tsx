// src/components/ConfirmDialog.tsx
// Rakendusesisene kinnitus- ja teatedialoog brauseri confirm()/alert() asemel.
// Kasutus: `if (!(await confirmDialog('Kas soovid kindlasti kustutada …?'))) return;`
//          `alertDialog('Hooaeg on lukus.');`
import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

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

const Dialog: React.FC<DialogProps> = ({ kind, message, options, onResult }) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = options.danger ?? (kind === 'confirm' && isDeleteText(message));
  const confirmLabel = options.confirmLabel
    ?? (kind === 'alert' ? 'Selge' : /kustut/i.test(message) ? 'Kustuta' : /eemald/i.test(message) ? 'Eemalda' : 'Jah');
  const title = options.title ?? (kind === 'alert' ? 'Teade' : danger ? 'Kinnita kustutamine' : 'Kinnita toiming');
  const Icon = kind === 'alert' ? Info : danger ? Trash2 : AlertTriangle;

  useEffect(() => {
    confirmRef.current?.focus();
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
    <div className="modal-backdrop confirm-dialog-backdrop" onClick={() => onResult(kind === 'alert')}>
      <div
        className="modal-content confirm-dialog animate-scale-up"
        role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-body">
          <span className={`confirm-dialog-icon ${danger ? 'danger' : kind === 'alert' ? 'info' : 'warning'}`}>
            <Icon size={20} />
          </span>
          <div>
            <h3 id="confirm-dialog-title">{title}</h3>
            <p id="confirm-dialog-message">{message}</p>
          </div>
        </div>
        <div className="modal-footer">
          {kind === 'confirm' && (
            <button type="button" className="btn btn-ghost" onClick={() => onResult(false)}>
              {options.cancelLabel ?? 'Loobu'}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onResult(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
          root?.render(null);
          previousFocus?.focus?.();
          resolve(ok);
        };
        root!.render(<Dialog kind={kind} message={message} options={options} onResult={finish} />);
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
