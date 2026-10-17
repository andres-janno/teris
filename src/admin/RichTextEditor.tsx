// Lihtne HTML-redaktor juhendite jaoks (contentEditable + tööriistariba), ilma lisasõltuvuseta.
// Kleebitud ja salvestatav HTML puhastatakse sanitizeHelp'iga; lubatud on ainult juhendi sildid.
import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Underline, Heading3, Pilcrow, List, ListOrdered, Link, Unlink, RemoveFormatting } from 'lucide-react';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';

type Props = { initialHtml: string; onChange: (html: string) => void; placeholder?: string };

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
    <button
      type="button"
      className="admin-rte-tool"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // ära võta valikut redaktorist ära
      onClick={run(fn)}
    >
      {icon}
    </button>
  );

  return (
    <div className="admin-rte">
      <div className="admin-rte-toolbar" role="toolbar" aria-label="Vormindus">
        {tool('Paks', <Bold size={15} />, () => exec('bold'))}
        {tool('Kaldkiri', <Italic size={15} />, () => exec('italic'))}
        {tool('Allajoonitud', <Underline size={15} />, () => exec('underline'))}
        <span className="admin-rte-sep" />
        {tool('Alapealkiri', <Heading3 size={15} />, () => exec('formatBlock', '<h3>'))}
        {tool('Tavaline lõik', <Pilcrow size={15} />, () => exec('formatBlock', '<p>'))}
        <span className="admin-rte-sep" />
        {tool('Täpploend', <List size={15} />, () => exec('insertUnorderedList'))}
        {tool('Numberloend', <ListOrdered size={15} />, () => exec('insertOrderedList'))}
        <span className="admin-rte-sep" />
        {tool('Lisa link', <Link size={15} />, addLink)}
        {tool('Eemalda link', <Unlink size={15} />, () => exec('unlink'))}
        {tool('Eemalda vormindus', <RemoveFormatting size={15} />, () => {
          exec('removeFormat');
          exec('formatBlock', '<p>');
        })}
      </div>
      <div
        ref={ref}
        className="admin-rte-area help-content"
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
