// src/components/ui/HelpHint.tsx — küsimärgi ikoon, mis avab teenusepakkuja koostatud juhendi (admin.teris.ee „Juhendid“).
// Hiirega üle liikudes avaneb (150 ms), lahkudes sulgub (200 ms); klõps kinnitab lahti, uus klõps sulgeb;
// klaviatuuriga fookus avab, blur sulgeb (kui pole kinnitatud); Esc sulgeb ainult vihje. Tühja juhendi korral ikooni pole.
// Kui kohtjuhendil on seotud peatükk, on hüpiku all link „Loe juhendist →“.
// HelpHint võtab juhendi teenusest; HelpHintPopover on ainult esitus (galerii ja testid).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { HELP_SPOTS, type HelpKey } from '../../help/helpRegistry';
import { useGuideLink, useHelpArticle } from '../../help/helpStore';
import { sanitizeHelp } from '../../help/sanitizeHelp';
import { isValidGuideLink } from '../../help/guideLink.ts';
import { cn } from './cn';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { helpHintContentClass, helpHintInlineClass, helpHintLinkClass, helpHintTitleClass, helpHintTriggerClass } from './variants';

const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;

/** inline: ikoon on teise nupu sees (span rolliga button, klõps ei käivita välimist nuppu) */
export const HelpHint: React.FC<{ helpKey: HelpKey; inline?: boolean }> = ({ helpKey, inline = false }) => {
  const html = useHelpArticle(helpKey);
  const link = useGuideLink(helpKey);
  const safe = useMemo(() => (html ? sanitizeHelp(html) : ''), [html]);
  if (!safe) return null;
  return <HelpHintPopover label={HELP_SPOTS[helpKey].label} html={safe} inline={inline} guideHref={link && isValidGuideLink(link) ? `#${link}` : undefined} />;
};

/** Ikoon + hüpik valmis (puhastatud) sisuga; `html` peab olema läbinud `sanitizeHelp`. `guideHref` (`#guide.fields#import`) lisab lingi „Loe juhendist →“. */
export const HelpHintPopover: React.FC<{ label: string; html: string; inline?: boolean; guideHref?: string }> = ({ label, html, inline = false, guideHref }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
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

  const isMouse = (e: React.PointerEvent) => e.pointerType === 'mouse';

  const toggle = () => {
    window.clearTimeout(timer.current);
    if (pinned) close();
    else {
      setPinned(true);
      setOpen(true);
    }
  };

  const triggerProps = {
    className: cn(helpHintTriggerClass, inline && helpHintInlineClass),
    'aria-label': `Juhend: ${label}`,
    onPointerEnter: (e: React.PointerEvent) => isMouse(e) && !pinned && schedule(true, OPEN_DELAY),
    onPointerLeave: (e: React.PointerEvent) => isMouse(e) && !pinned && schedule(false, CLOSE_DELAY),
    // klaviatuuri fookus avab; hiirega klõpsu fookus mitte (klõps kinnitab ise)
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(':focus-visible')) {
        window.clearTimeout(timer.current);
        setOpen(true);
      }
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!pinned && !(next instanceof Element && next.closest('[data-help-hint-content]'))) schedule(false, 0);
    },
    onClick: (e: React.MouseEvent) => {
      // ära lase klõpsul jõuda välimise nupuni (inline) ega selle vanemateni; Radixi enda lülitus jääb ära
      e.stopPropagation();
      e.preventDefault();
      toggle();
    },
  };

  return (
    <Popover open={open} onOpenChange={(next) => !next && close()}>
      {inline ? (
        <PopoverTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            {...triggerProps}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
          >
            <CircleHelp size={15} />
          </span>
        </PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <button type="button" {...triggerProps}>
            <CircleHelp size={15} />
          </button>
        </PopoverTrigger>
      )}
      <PopoverContent
        data-help-hint-content=""
        className={helpHintContentClass}
        aria-label={label}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={(e) => isMouse(e) && window.clearTimeout(timer.current)}
        onPointerLeave={(e) => isMouse(e) && !pinned && schedule(false, CLOSE_DELAY)}
        // portaali sündmused jõuaksid React-puus välimise nuppuni
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={helpHintTitleClass}>{label}</div>
        <div className="help-content" dangerouslySetInnerHTML={{ __html: html }} />
        {guideHref && (
          <a href={guideHref} className={helpHintLinkClass} onClick={close}>
            Loe juhendist →
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
};
