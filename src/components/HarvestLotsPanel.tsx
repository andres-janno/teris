// src/components/HarvestLotsPanel.tsx — saagipartiide register (finantsõigusega)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import { formatQty } from '../services/units';
import { alertDialog } from './ConfirmDialog';
import { FilterClear } from './FilterClear';
import { HarvestLotDialog } from './HarvestLotDialog';
import type { Article } from '../types/fieldWork';
import type { Warehouse } from '../types/stock';
import type { HarvestLotStatus, HarvestLotSummary } from '../types/harvestLot';
import { HARVEST_LOT_STATUS_LABEL } from '../types/harvestLot';

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
          <select className="form-input" aria-label="Hooaeg" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Kõik hooajad</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </FilterClear>
        <FilterClear active={!!status} onClear={() => setStatus('')}>
          <select className="form-input" aria-label="Staatus" value={status} onChange={(e) => setStatus(e.target.value as HarvestLotStatus | '')}>
            <option value="">Kõik staatused</option>
            {(Object.keys(HARVEST_LOT_STATUS_LABEL) as HarvestLotStatus[]).map((s) => <option key={s} value={s}>{HARVEST_LOT_STATUS_LABEL[s]}</option>)}
          </select>
        </FilterClear>
        <div className="register-io-buttons">
          <button className="btn btn-primary btn-sm" onClick={() => setDialog({ lotId: null })}><Plus size={14} /><span>Uus partii</span></button>
        </div>
      </div>

      <div className="register-table-wrap">
        <table className="register-table">
          <thead>
            <tr>
              <th>Nimi</th>
              <th>Kultuur</th>
              <th>Hooaeg</th>
              <th className="num">Punkreid</th>
              <th className="num">Kaalutud, t</th>
              <th className="num">Punkri kaal, t</th>
              <th>Staatus</th>
              <th className="num">Kandeid</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} className="muted">Saagipartiisid pole.</td></tr>}
            {shown.map((l) => (
              <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setDialog({ lotId: l.id })}>
                <td>{l.name}</td>
                <td>{l.cropName}</td>
                <td>{l.seasonYear}</td>
                <td className="num">{l.bunkers}</td>
                <td className="num">{formatQty(l.weighedTonnes)}</td>
                <td className="num">{l.bunkerTonnes == null ? '–' : formatQty(l.bunkerTonnes)}</td>
                <td>{HARVEST_LOT_STATUS_LABEL[l.status]}</td>
                <td className="num">{l.entryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
