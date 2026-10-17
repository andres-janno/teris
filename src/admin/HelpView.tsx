// Juhendid: kõik koodis registreeritud juhendikohad (src/help/helpRegistry.ts) ala kaupa + redaktor.
// Andmebaasis olevad, kuid koodist eemaldatud kohad näidatakse eraldi, et neid saaks kustutada.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { platformApi, type HelpArticleRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { HELP_SPOTS, HELP_MAX_LENGTH, isHelpKey, type HelpSpot } from '../help/helpRegistry.ts';
import { sanitizeHelp } from '../help/sanitizeHelp.ts';
import { RichTextEditor } from './RichTextEditor.tsx';

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
    <div className="admin-help">
      <div className="glass-card admin-card admin-help-list">
        <div className="admin-card-head">
          <h2>Juhendid</h2>
          <span className="admin-muted">{filledCount}/{knownCount} täidetud</span>
        </div>
        <input className="form-input" type="search" placeholder="Otsi…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="admin-help-filters">
          {(['all', 'filled', 'empty'] as Filter[]).map((f) => (
            <button key={f} type="button" className={`btn btn-secondary btn-sm ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Kõik' : f === 'filled' ? 'Täidetud' : 'Tühjad'}
            </button>
          ))}
        </div>
        {!rows && !error && <div className="admin-muted">Laadin…</div>}
        {rows && groups.length === 0 && <div className="admin-muted">Ühtegi kohta ei leitud.</div>}
        {groups.map(([area, items]) => (
          <div key={area} className="admin-help-group">
            <div className="admin-field-label">{area}</div>
            {items.map((s) => {
              const filled = !!s.row && !isBlank(s.row.html);
              return (
                <button key={s.key} type="button" className={`admin-help-item ${s.key === selected ? 'is-selected' : ''}`} onClick={() => open(s)}>
                  <span className={`admin-help-dot ${s.orphan ? 'orphan' : filled ? 'filled' : ''}`} />
                  <span className="admin-help-item-text">
                    <span className="admin-help-item-label">{s.label}</span>
                    <span className="admin-help-item-where">{s.where}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="glass-card admin-card admin-help-editor">
        {error && <div className="alert-box error">{error}</div>}
        {notice && <div className="alert-box success">{notice}</div>}
        {!current ? (
          <p className="admin-hint">Vali vasakult koht, mille juhendit muuta. Tühja juhendiga kohas rakendus küsimärki ei näita.</p>
        ) : (
          <>
            <div className="admin-card-head">
              <div>
                <h2>{current.label}</h2>
                <div className="admin-hint">{current.area} · {current.where} · <code>{current.key}</code></div>
              </div>
              {current.row && (
                <span className="admin-muted admin-help-updated">
                  Muudetud {formatTallinn(current.row.updatedAt)}{current.row.updatedBy ? `, ${current.row.updatedBy}` : ''}
                </span>
              )}
            </div>
            {current.orphan ? (
              <>
                <p className="admin-hint">Seda juhendikohta koodis enam pole, seega rakendus seda ei näita. Sisu:</p>
                <div className="help-content admin-help-preview" dangerouslySetInnerHTML={{ __html: sanitizeHelp(savedHtml) }} />
                <div className="admin-card-foot">
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => window.confirm('Kustuta see juhend?') && void save('')}>
                    Kustuta
                  </button>
                </div>
              </>
            ) : (
              <>
                <RichTextEditor key={`${current.key}:${current.row?.updatedAt ?? 'uus'}`} initialHtml={savedHtml} onChange={setDraft} placeholder="Kirjuta juhend…" />
                <div className="admin-card-foot">
                  {dirty && <span className="admin-muted">Salvestamata muudatused</span>}
                  {current.row && (
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => window.confirm('Eemalda juhend? Küsimärki rakenduses enam ei näidata.') && void save('')}>
                      Eemalda juhend
                    </button>
                  )}
                  <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save(draft)}>
                    Salvesta
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
