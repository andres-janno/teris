// src/components/HelpHint.tsx — küsimärgi ikoon, mis avab teenusepakkuja koostatud juhendi (admin.teris.ee „Juhendid“).
// Hiirega üle liikudes avaneb, klõps kinnitab lahti; Esc või kõrvale klõps sulgeb. Tühja juhendi korral ikooni pole.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { HELP_SPOTS, type HelpKey } from '../help/helpRegistry';
import { useHelpArticle } from '../help/helpStore';
import { sanitizeHelp } from '../help/sanitizeHelp';

const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;
const POPUP_WIDTH = 320;
const MARGIN = 8;

/** inline: ikoon on teise nupu sees (span rolliga button, klõps ei käivita välimist nuppu) */
export const HelpHint: React.FC<{ helpKey: HelpKey; inline?: boolean }> = ({ helpKey, inline = false }) => {
  const html = useHelpArticle(helpKey);
  const safe = useMemo(() => (html ? sanitizeHelp(html) : ''), [html]);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const btnRef = useRef<HTMLElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const schedule = useCallback((next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  }, []);

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const width = Math.min(POPUP_WIDTH, window.innerWidth - 2 * MARGIN);
      const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - width / 2), window.innerWidth - width - MARGIN);
      const popH = popRef.current?.offsetHeight ?? 0;
      const below = r.bottom + 6;
      const top = below + popH > window.innerHeight - MARGIN && r.top - 6 - popH > MARGIN ? r.top - 6 - popH : below;
      setStyle({ position: 'fixed', top, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, safe]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  if (!safe) return null;
  const hoverOpen = (e: React.PointerEvent) => e.pointerType === 'mouse' && !pinned && schedule(true, OPEN_DELAY);
  const hoverClose = (e: React.PointerEvent) => e.pointerType === 'mouse' && !pinned && schedule(false, CLOSE_DELAY);

  const toggle = () => {
    window.clearTimeout(timer.current);
    if (pinned) close();
    else {
      setPinned(true);
      setOpen(true);
    }
  };
  const triggerProps = {
    className: `help-hint-btn${open ? ' is-open' : ''}`,
    'aria-label': `Juhend: ${HELP_SPOTS[helpKey].label}`,
    'aria-expanded': open,
    onPointerEnter: hoverOpen,
    onPointerLeave: hoverClose,
    onClick: (e: React.MouseEvent) => {
      // ära lase klõpsul jõuda välimise nupuni (inline) ega selle vanemateni
      e.stopPropagation();
      e.preventDefault();
      toggle();
    }
  };

  return (
    <>
      {inline ? (
        <span
          ref={btnRef as React.RefObject<HTMLSpanElement>}
          role="button"
          tabIndex={0}
          {...triggerProps}
          className={`${triggerProps.className} help-hint-inline`}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
        >
          <CircleHelp size={15} />
        </span>
      ) : (
        <button ref={btnRef as React.RefObject<HTMLButtonElement>} type="button" {...triggerProps}>
          <CircleHelp size={15} />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="help-hint-popup"
            role="dialog"
            aria-label={HELP_SPOTS[helpKey].label}
            style={style}
            onPointerEnter={(e) => e.pointerType === 'mouse' && window.clearTimeout(timer.current)}
            onPointerLeave={hoverClose}
          >
            <div className="help-hint-title">{HELP_SPOTS[helpKey].label}</div>
            <div className="help-content" dangerouslySetInnerHTML={{ __html: safe }} />
          </div>,
          document.body
        )}
    </>
  );
};
