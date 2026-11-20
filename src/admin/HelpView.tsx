// Juhendid: kõik koodis registreeritud juhendikohad (src/help/helpRegistry.ts) ala kaupa + redaktor.
// Andmebaasis olevad, kuid koodist eemaldatud kohad näidatakse eraldi, et neid saaks kustutada.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { platformApi, type HelpArticleRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { HELP_SPOTS, HELP_MAX_LENGTH, isHelpKey, type HelpSpot } from '../help/helpRegistry.ts';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { RichTextEditor } from './RichTextEditor.tsx';
import { Alert, FilterClear, Card, CardButton, Button, Input } from '../components/ui';
import { cn } from '../components/ui/cn';
import { adminCardClass, adminCardFootClass, adminCardHeadClass, adminFieldLabelClass, adminH2FlushClass, adminHintClass, adminMutedClass } from './adminUi.ts';

type Filter = 'all' | 'filled' | 'empty';
type Spot = HelpSpot & { key: string; row?: HelpArticleRow; orphan: boolean };

const ORPHAN_AREA = 'Koodist eemaldatud';
const isBlank = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

export function HelpView() {
  const [rows, setRows] = useState<HelpArticleRow[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await platformApi.listHelp());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const spots = useMemo<Spot[]>(() => {
    const byKey = new Map((rows ?? []).map((r) => [r.key, r]));
    const known: Spot[] = Object.entries(HELP_SPOTS).map(([key, s]) => ({ key, ...s, row: byKey.get(key), orphan: false }));
    const orphans: Spot[] = (rows ?? [])
      .filter((r) => !isHelpKey(r.key))
      .map((r) => ({ key: r.key, area: ORPHAN_AREA, label: r.key, where: 'Seda kohta koodis enam pole', row: r, orphan: true }));
    return [...known, ...orphans];
  }, [rows]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = spots.filter((s) => {
      const filled = !!s.row && !isBlank(s.row.html);
      if (filter === 'filled' && !filled) return false;
      if (filter === 'empty' && filled) return false;
      return !q || `${s.area} ${s.label} ${s.where} ${s.key}`.toLowerCase().includes(q);
    });
    const map = new Map<string, Spot[]>();
    for (const s of visible) map.set(s.area, [...(map.get(s.area) ?? []), s]);
    return [...map.entries()].sort(([a], [b]) => (a === ORPHAN_AREA ? 1 : b === ORPHAN_AREA ? -1 : a.localeCompare(b, 'et')));
  }, [spots, filter, query]);

  const current = spots.find((s) => s.key === selected) ?? null;
  const savedHtml = current?.row?.html ?? '';
  const dirty = current !== null && sanitizeHelp(draft) !== sanitizeHelp(savedHtml);

  const open = (s: Spot) => {
    if (dirty && !window.confirm('Salvestamata muudatused lähevad kaduma. Jätkata?')) return;
    setSelected(s.key);
    setDraft(s.row?.html ?? '');
    setNotice('');
    setError('');
  };

  const save = async (html: string) => {
    if (!current) return;
    const clean = sanitizeHelp(html);
    if (clean.length > HELP_MAX_LENGTH) {
      setError(`Juhend on liiga pikk (kuni ${HELP_MAX_LENGTH} märki)`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await platformApi.saveHelp(current.key, isBlank(clean) ? '' : clean);
      setNotice(r.deleted ? 'Juhend eemaldatud — ikooni rakenduses ei näidata.' : 'Juhend salvestatud.');
      await load();
      if (r.deleted && current.orphan) setSelected(null);
      setDraft(isBlank(clean) ? '' : clean);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filledCount = spots.filter((s) => !s.orphan && s.row && !isBlank(s.row.html)).length;
  const knownCount = spots.filter((s) => !s.orphan).length;

  return (
    <div className="grid grid-cols-[minmax(260px,340px)_1fr] items-start gap-4 max-[861px]:grid-cols-1">
      <Card className={cn(adminCardClass, 'sticky top-4 flex max-h-[calc(100vh-32px)] flex-col gap-2.5 overflow-y-auto')}>
        <div className={adminCardHeadClass}>
          <h2 className={adminH2FlushClass}>Juhendid</h2>
          <span className={adminMutedClass}>{filledCount}/{knownCount} täidetud</span>
        </div>
        <FilterClear active={!!query} onClear={() => setQuery('')}>
          <Input type="search" placeholder="Otsi…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </FilterClear>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'filled', 'empty'] as Filter[]).map((f) => (
            <Button key={f} size="sm" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Kõik' : f === 'filled' ? 'Täidetud' : 'Tühjad'}
            </Button>
          ))}
        </div>
        {!rows && !error && <div className={adminMutedClass}>Laadin…</div>}
        {rows && groups.length === 0 && <div className={adminMutedClass}>Ühtegi kohta ei leitud.</div>}
        {groups.map(([area, items]) => (
          <div key={area} className="mt-1.5 flex flex-col gap-0.5">
            <div className={cn(adminFieldLabelClass, 'mb-1')}>{area}</div>
            {items.map((s) => {
              const filled = !!s.row && !isBlank(s.row.html);
              return (
                <CardButton key={s.key} variant="tile" padding="none" selected={s.key === selected} className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left" onClick={() => open(s)}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full border border-subtle', s.orphan && 'border-warning-solid bg-warning-solid', !s.orphan && filled && 'border-primary bg-primary')} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-base font-medium leading-natural">{s.label}</span>
                    <span className="text-xs leading-natural text-subtle">{s.where}</span>
                  </span>
                </CardButton>
              );
            })}
          </div>
        ))}
      </Card>

      <Card className={adminCardClass}>
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        {!current ? (
          <p className={adminHintClass}>Vali vasakult koht, mille juhendit muuta. Tühja juhendiga kohas rakendus küsimärki ei näita.</p>
        ) : (
          <>
            <div className={adminCardHeadClass}>
              <div>
                <h2 className={cn(adminH2FlushClass, 'mb-0.5')}>{current.label}</h2>
                <div className={adminHintClass}>{current.area} · {current.where} · <code>{current.key}</code></div>
              </div>
              {current.row && (
                <span className={cn(adminMutedClass, 'text-xs leading-natural')}>
                  Muudetud {formatTallinn(current.row.updatedAt)}{current.row.updatedBy ? `, ${current.row.updatedBy}` : ''}
                </span>
              )}
            </div>
            {current.orphan ? (
              <>
                <p className={adminHintClass}>Seda juhendikohta koodis enam pole, seega rakendus seda ei näita. Sisu:</p>
                <div className="help-content rounded-md border border-dashed border-border p-3" dangerouslySetInnerHTML={{ __html: sanitizeHelp(savedHtml) }} />
                <div className={adminCardFootClass}>
                  <Button disabled={busy} onClick={() => window.confirm('Kustuta see juhend?') && void save('')}>
                    Kustuta
                  </Button>
                </div>
              </>
            ) : (
              <>
                <RichTextEditor key={`${current.key}:${current.row?.updatedAt ?? 'uus'}`} initialHtml={savedHtml} onChange={setDraft} placeholder="Kirjuta juhend…" />
                <div className={cn(adminCardFootClass, 'items-center')}>
                  {dirty && <span className={cn(adminMutedClass, 'mr-auto text-sm leading-natural')}>Salvestamata muudatused</span>}
                  {current.row && (
                    <Button disabled={busy} onClick={() => window.confirm('Eemalda juhend? Küsimärki rakenduses enam ei näidata.') && void save('')}>
                      Eemalda juhend
                    </Button>
                  )}
                  <Button variant="primary" disabled={busy || !dirty} onClick={() => void save(draft)}>
                    Salvesta
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
