// src/components/HarvestLotsPanel.tsx — saagipartiide register (finantsõigusega)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import { formatQty } from '../services/units';
import { alertDialog } from './ConfirmDialog';
import { FilterClear } from './FilterClear';
import { FilterSelect } from './FilterSelect';
import { HarvestLotDialog } from './HarvestLotDialog';
import type { Article } from '../types/fieldWork';
import type { Warehouse } from '../types/stock';
import type { HarvestLotStatus, HarvestLotSummary } from '../types/harvestLot';
import { HARVEST_LOT_STATUS_LABEL } from '../types/harvestLot';
import { Button, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from './ui';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  warehouses: Warehouse[];
  articles: Article[];
  onChanged: () => void;
}

export const HarvestLotsPanel: React.FC<Props> = ({ warehouses, articles, onChanged }) => {
  const [lots, setLots] = useState<HarvestLotSummary[]>([]);
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<HarvestLotStatus | ''>('');
  const [knownYears, setKnownYears] = useState<number[]>([]);
  const [dialog, setDialog] = useState<{ lotId: string | null } | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await api.getHarvestLots(year ? Number(year) : undefined);
      setLots(rows);
      setKnownYears((prev) => Array.from(new Set([...prev, ...rows.map((r) => r.seasonYear)])));
    } catch (err) {
      alertDialog(errorText(err));
    }
  }, [year]);

  useEffect(() => { void reload(); }, [reload]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const set = new Set<number>(knownYears);
    for (let y = now; y > now - 6; y--) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, [knownYears]);

  const shown = lots.filter((l) => !status || l.status === status);

  return (
    <>
      <div className="register-actions-bar">
        <FilterClear active={!!year} onClear={() => setYear('')}>
          <FilterSelect ariaLabel="Hooaeg" value={year} onChange={setYear}
            options={[{ value: '', label: 'Kõik hooajad' }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} />
        </FilterClear>
        <FilterClear active={!!status} onClear={() => setStatus('')}>
          <FilterSelect ariaLabel="Staatus" value={status} onChange={(v) => setStatus(v as HarvestLotStatus | '')}
            options={[{ value: '', label: 'Kõik staatused' }, ...(Object.keys(HARVEST_LOT_STATUS_LABEL) as HarvestLotStatus[]).map((s) => ({ value: s, label: HARVEST_LOT_STATUS_LABEL[s] }))]} />
        </FilterClear>
        <div className="register-io-buttons">
          <Button variant="primary" size="sm" onClick={() => setDialog({ lotId: null })}><Plus size={14} /><span>Uus partii</span></Button>
        </div>
      </div>

      <Table scroll="fill" bordered>
        <TableHeader>
          <TableRow>
            <TableHead>Nimi</TableHead>
            <TableHead>Kultuur</TableHead>
            <TableHead>Hooaeg</TableHead>
            <TableHead numeric>Punkreid</TableHead>
            <TableHead numeric>Kaalutud, t</TableHead>
            <TableHead numeric>Punkri kaal, t</TableHead>
            <TableHead>Staatus</TableHead>
            <TableHead numeric>Kandeid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 && <TableEmpty colSpan={8}>Saagipartiisid pole.</TableEmpty>}
          {shown.map((l) => (
            <TableRow key={l.id} onClick={() => setDialog({ lotId: l.id })}>
              <TableCell wrap>{l.name}</TableCell>
              <TableCell>{l.cropName}</TableCell>
              <TableCell>{l.seasonYear}</TableCell>
              <TableCell numeric>{l.bunkers}</TableCell>
              <TableCell numeric>{formatQty(l.weighedTonnes)}</TableCell>
              <TableCell numeric>{l.bunkerTonnes == null ? '–' : formatQty(l.bunkerTonnes)}</TableCell>
              <TableCell>{HARVEST_LOT_STATUS_LABEL[l.status]}</TableCell>
              <TableCell numeric>{l.entryCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialog && (
        <HarvestLotDialog
          lotId={dialog.lotId}
          defaultYear={year ? Number(year) : new Date().getFullYear()}
          warehouses={warehouses}
          articles={articles}
          onClose={() => setDialog(null)}
          onSaved={(closeDialog) => { if (closeDialog) setDialog(null); void reload(); onChanged(); }}
        />
      )}
    </>
  );
};
