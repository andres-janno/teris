// Lihtne HTML-redaktor juhendite jaoks (contentEditable + tööriistariba), ilma lisasõltuvuseta.
// Kleebitud ja salvestatav HTML puhastatakse sanitizeHelp'iga; lubatud on ainult juhendi sildid.
import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Underline, Heading3, Pilcrow, List, ListOrdered, Link, Unlink, RemoveFormatting } from 'lucide-react';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { Button } from '../components/ui';

type Props = { initialHtml: string; onChange: (html: string) => void; placeholder?: string };

// Tööriistariba on tavaline rida (nagu live'is); eraldaja on 8px vahe (vana laius/kõrgus ei rakendunud, sest <span> on rea-element).
const SEPARATOR = 'mx-1';

const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

export function RichTextEditor({ initialHtml, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Sisu pannakse üks kord; vanem vahetab redaktori võtmega (key), kui avatakse teine juhend.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHelp(initialHtml);
    exec('defaultParagraphSeparator', 'p');
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? '');

  const run = (fn: () => void) => () => {
    ref.current?.focus();
    fn();
    emit();
  };

  const addLink = () => {
    const url = window.prompt('Lingi aadress (https://…)', 'https://');
    if (!url || url === 'https://') return;
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(url.trim())) {
      window.alert('Lubatud on https://, http://, mailto: ja tel: lingid');
      return;
    }
    exec('createLink', url.trim());
  };

  const tool = (label: string, icon: ReactNode, fn: () => void) => (
    <Button
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // ära võta valikut redaktorist ära
      onClick={run(fn)}
    >
      {icon}
    </Button>
  );

  return (
    <div className="overflow-hidden rounded-md border border-border bg-field">
      <div role="toolbar" aria-label="Vormindus">
        {tool('Paks', <Bold size={15} />, () => exec('bold'))}
        {tool('Kaldkiri', <Italic size={15} />, () => exec('italic'))}
        {tool('Allajoonitud', <Underline size={15} />, () => exec('underline'))}
        <span className={SEPARATOR} />
        {tool('Alapealkiri', <Heading3 size={15} />, () => exec('formatBlock', '<h3>'))}
        {tool('Tavaline lõik', <Pilcrow size={15} />, () => exec('formatBlock', '<p>'))}
        <span className={SEPARATOR} />
        {tool('Täpploend', <List size={15} />, () => exec('insertUnorderedList'))}
        {tool('Numberloend', <ListOrdered size={15} />, () => exec('insertOrderedList'))}
        <span className={SEPARATOR} />
        {tool('Lisa link', <Link size={15} />, addLink)}
        {tool('Eemalda link', <Unlink size={15} />, () => exec('unlink'))}
        {tool('Eemalda vormindus', <RemoveFormatting size={15} />, () => {
          exec('removeFormat');
          exec('formatBlock', '<p>');
        })}
      </div>
      <div
        ref={ref}
        className="help-content max-h-[60vh] min-h-55 overflow-y-auto px-4 py-3 text-foreground outline-none focus:inset-ring-2 focus:inset-ring-primary/35 empty:before:pointer-events-none empty:before:text-subtle empty:before:content-[attr(data-placeholder)]"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          if (html) exec('insertHTML', sanitizeHelp(html));
          else exec('insertText', e.clipboardData.getData('text/plain'));
          emit();
        }}
      />
    </div>
  );
}
