// Juhendi ajalugu: versioonide loend (uusim ees), eelvaade ja „Taasta see versioon“ (= uus salvestus vana sisuga).
import { useCallback, useEffect, useState } from 'react';
import { platformApi, type HelpVersionDetail, type HelpVersionRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { Alert, Button, CardButton } from '../components/ui';
import { cn } from '../components/ui/cn';
import { adminCardFootClass, adminFieldLabelClass, adminHintClass, adminMutedClass, adminSubpanelClass } from './adminUi.ts';

type Props = { helpKey: string; onRestored: () => Promise<void> };

export function HelpHistory({ helpKey, onRestored }: Props) {
  const [versions, setVersions] = useState<HelpVersionRow[] | null>(null);
  const [selected, setSelected] = useState<HelpVersionDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await platformApi.listHelpVersions(helpKey));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [helpKey]);

  useEffect(() => {
    setSelected(null);
    void load();
  }, [load]);

  const preview = async (id: number) => {
    try {
      setSelected(await platformApi.getHelpVersion(helpKey, id));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const restore = async () => {
    if (!selected || !window.confirm('Taasta see versioon? Praegune tekst jääb ajalukku.')) return;
    setBusy(true);
    try {
      await platformApi.restoreHelpVersion(helpKey, selected.id);
      await onRestored();
      setSelected(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const blank = selected !== null && selected.html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

  return (
    <div className={cn(adminSubpanelClass, 'flex flex-col gap-2.5')}>
      <div className={adminFieldLabelClass}>Ajalugu</div>
      <div className={adminHintClass}>Iga salvestus, eemaldamine ja taastamine jätab versiooni; alles on 50 viimast.</div>
      {error && <Alert tone="error">{error}</Alert>}
      {!versions && !error && <div className={adminMutedClass}>Laadin…</div>}
      {versions && versions.length === 0 && <div className={adminMutedClass}>Selle koha kohta pole veel versioone.</div>}
      {versions && versions.length > 0 && (
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {versions.map((v) => (
            <CardButton key={v.id} variant="tile" padding="none" selected={selected?.id === v.id} className="flex w-full items-baseline gap-2.5 px-2.5 py-1.5 text-left" onClick={() => void preview(v.id)}>
              <span className="text-base font-medium leading-natural">{formatTallinn(v.createdAt)}</span>
              <span className="text-xs leading-natural text-subtle">{v.createdBy ?? '–'}</span>
              {v.guideLink && <span className="text-xs leading-natural text-subtle">→ {v.guideLink}</span>}
            </CardButton>
          ))}
        </div>
      )}
      {selected && (
        <>
          {blank ? (
            <p className={adminHintClass}>See versioon on tühi (juhend eemaldati). Taastamine eemaldab praeguse teksti.</p>
          ) : (
            <div className="help-content max-h-80 overflow-y-auto rounded-md border border-dashed border-border p-3" dangerouslySetInnerHTML={{ __html: sanitizeHelp(selected.html) }} />
          )}
          <div className={adminCardFootClass}>
            <Button disabled={busy} onClick={() => setSelected(null)}>
              Sulge eelvaade
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void restore()}>
              Taasta see versioon
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
