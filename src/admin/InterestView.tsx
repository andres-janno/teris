// src/admin/InterestView.tsx — „Tunnen huvi“ päringud: staatus, märkmed, kustutamine (GDPR).
import { useCallback, useEffect, useState } from 'react';
import { platformApi, INTEREST_STATUS_LABELS, type InterestRow, type InterestStatus } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { FilterClear, Card, Button, Select, Textarea, TableEmpty, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui';

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
    <Card className="admin-card">
      <h2>Huvilised</h2>
      <div className="admin-filter-row">
        <label htmlFor="interest-filter">Staatus</label>
        <FilterClear active={filter !== ''} onClear={() => setFilter('')}>
          <Select
            id="interest-filter"
            value={filter}
            onValueChange={(v) => setFilter(v as InterestStatus | '')}
            options={[{ value: '', label: 'Kõik' }, ...STATUSES.map((s) => ({ value: s, label: INTEREST_STATUS_LABELS[s] }))]}
          />
        </FilterClear>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      <Table>
        <TableHeader><TableRow><TableHead>Aeg</TableHead><TableHead>Kontakt</TableHead><TableHead>Ettevõte / pind</TableHead><TableHead>Sõnum</TableHead><TableHead>Allikas</TableHead><TableHead>Staatus</TableHead><TableHead>Märkmed</TableHead><TableHead/></TableRow></TableHeader>
        <TableBody>
          {rows?.length === 0 && <TableEmpty colSpan={8}>Päringuid pole</TableEmpty>}
          {rows?.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatTallinn(r.createdAt)}</TableCell>
              <TableCell>
                {r.name}<br />
                <a href={`mailto:${r.email}`}>{r.email}</a>
                {r.phone && <><br /><a href={`tel:${r.phone}`}>{r.phone}</a></>}
              </TableCell>
              <TableCell>{r.company ?? '–'}{r.areaHa != null && <><br />{r.areaHa} ha</>}</TableCell>
              <TableCell className="admin-interest-message">{r.message ?? ''}</TableCell>
              <TableCell>{r.utmSource ?? r.referrerHost ?? 'otse'}</TableCell>
              <TableCell>
                <Select
                  size="sm"
                  aria-label="Staatus"
                  value={r.status}
                  onValueChange={(v) => void patch(r.id, { status: v as InterestStatus })}
                  options={STATUSES.map((s) => ({ value: s, label: INTEREST_STATUS_LABELS[s] }))}
                />
              </TableCell>
              <TableCell>
                <Textarea
                  rows={2}
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  onBlur={() => (notes[r.id] ?? '') !== (r.notes ?? '') && void patch(r.id, { notes: notes[r.id] })}
                />
              </TableCell>
              <TableCell><Button size="sm" onClick={() => void remove(r)}>Kustuta</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
