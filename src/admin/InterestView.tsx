// src/admin/InterestView.tsx — „Tunnen huvi“ päringud: staatus, märkmed, kustutamine (GDPR).
import { useCallback, useEffect, useState } from 'react';
import { platformApi, INTEREST_STATUS_LABELS, type InterestRow, type InterestStatus } from './platformApi.ts';
import { formatTallinn } from './format.ts';

const STATUSES = Object.keys(INTEREST_STATUS_LABELS) as InterestStatus[];

export function InterestView() {
  const [filter, setFilter] = useState<InterestStatus | ''>('');
  const [rows, setRows] = useState<InterestRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    platformApi
      .listInterest(filter || undefined)
      .then((r) => {
        setRows(r);
        setNotes(Object.fromEntries(r.map((x) => [x.id, x.notes ?? ''])));
      })
      .catch((err) => setError((err as Error).message));
  }, [filter]);
  useEffect(load, [load]);

  const patch = async (id: string, p: { status?: InterestStatus; notes?: string | null }) => {
    try {
      const row = await platformApi.updateInterest(id, p);
      setRows((list) => list?.map((r) => (r.id === id ? row : r)) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (row: InterestRow) => {
    if (!window.confirm(`Kustuta ${row.name} päring jäädavalt?`)) return;
    try {
      await platformApi.deleteInterest(row.id);
      setRows((list) => list?.filter((r) => r.id !== row.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="glass-card admin-card">
      <h2>Huvilised</h2>
      <div className="admin-filter-row">
        <label htmlFor="interest-filter">Staatus</label>
        <select id="interest-filter" className="form-input" value={filter} onChange={(e) => setFilter(e.target.value as InterestStatus | '')}>
          <option value="">Kõik</option>
          {STATUSES.map((s) => <option key={s} value={s}>{INTEREST_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Aeg</th><th>Kontakt</th><th>Ettevõte / pind</th><th>Sõnum</th><th>Allikas</th><th>Staatus</th><th>Märkmed</th><th /></tr></thead>
          <tbody>
            {rows?.length === 0 && <tr><td colSpan={8}>Päringuid pole</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id}>
                <td>{formatTallinn(r.createdAt)}</td>
                <td>
                  {r.name}<br />
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone && <><br /><a href={`tel:${r.phone}`}>{r.phone}</a></>}
                </td>
                <td>{r.company ?? '–'}{r.areaHa != null && <><br />{r.areaHa} ha</>}</td>
                <td className="admin-interest-message">{r.message ?? ''}</td>
                <td>{r.utmSource ?? r.referrerHost ?? 'otse'}</td>
                <td>
                  <select className="form-input" value={r.status} onChange={(e) => void patch(r.id, { status: e.target.value as InterestStatus })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{INTEREST_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    onBlur={() => (notes[r.id] ?? '') !== (r.notes ?? '') && void patch(r.id, { notes: notes[r.id] })}
                  />
                </td>
                <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => void remove(r)}>Kustuta</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
