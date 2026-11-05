// src/components/StockDocumentsPanel.tsx — laokannete register (finantsjuht ja admin)
import React, { useCallback, useEffect, useState } from 'react';
import { PackagePlus, PackageMinus, ArrowRightLeft, ClipboardCheck, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { formatDate } from '../services/dateFormat';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { FilterClear } from './FilterClear';
import { FilterSelect } from './FilterSelect';
import { warehouseFilterOptions } from './WarehouseOptions';
import { StockDocumentDialog } from './StockDocumentDialog';
import { InventoryDialog } from './InventoryDialog';
import type { Article } from '../types/fieldWork';
import type { RelatedParty } from '../types/party';
import type { StockDocument, StockDocumentFilter, StockDocumentKind, Warehouse } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';

const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  warehouses: Warehouse[];
  articles: Article[];
  onChanged: () => void;
}

export const StockDocumentsPanel: React.FC<Props> = ({ warehouses, articles, onChanged }) => {
  const [docs, setDocs] = useState<StockDocument[]>([]);
  const [filter, setFilter] = useState<StockDocumentFilter>({});
  const [suppliers, setSuppliers] = useState<RelatedParty[]>([]);
  const [form, setForm] = useState<{ kind: StockDocumentKind; initial: StockDocument | null } | null>(null);
  const canTransfer = warehouses.filter((w) => w.isActive).length >= 2;

  const reload = useCallback(async () => {
    try {
      setDocs(await api.getStockDocuments(filter));
    } catch (err) {
      alertDialog(errorText(err));
    }
  }, [filter]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    api.getParties().then((ps) => setSuppliers(ps.filter((p) => p.roles.includes('SUPPLIER')))).catch(() => setSuppliers([]));
  }, []);

  const remove = async (d: StockDocument) => {
    if (!(await confirmDialog(`Kas kustutan laokande (${STOCK_DOC_KIND_LABEL[d.kind]}, ${formatDate(d.date)})?`))) return;
    try {
      await api.deleteStockDocument(d.id);
      await reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  const party = (d: StockDocument) =>
    d.kind === 'RECEIPT' ? d.supplierName ?? '' : d.kind === 'WRITE_OFF' && d.writeOffReason ? WRITE_OFF_REASON_LABEL[d.writeOffReason] : '';

  return (
    <>
      <div className="register-actions-bar">
        <FilterClear active={!!filter.kind} onClear={() => setFilter({ ...filter, kind: '' })}>
          <FilterSelect ariaLabel="Liik" value={filter.kind ?? ''} onChange={(v) => setFilter({ ...filter, kind: v as StockDocumentKind | '' })}
            options={[{ value: '', label: 'Kõik liigid' }, ...(Object.keys(STOCK_DOC_KIND_LABEL) as StockDocumentKind[]).map((k) => ({ value: k, label: STOCK_DOC_KIND_LABEL[k] }))]} />
        </FilterClear>
        <FilterClear active={!!filter.warehouseId} onClear={() => setFilter({ ...filter, warehouseId: '' })}>
          <FilterSelect ariaLabel="Ladu" value={filter.warehouseId ?? ''} onChange={(v) => setFilter({ ...filter, warehouseId: v })}
            options={[{ value: '', label: 'Kõik laod' }, ...warehouseFilterOptions(warehouses)]} />
        </FilterClear>
        <FilterClear active={!!filter.supplierId} onClear={() => setFilter({ ...filter, supplierId: '' })}>
          <FilterSelect ariaLabel="Tarnija" value={filter.supplierId ?? ''} onChange={(v) => setFilter({ ...filter, supplierId: v })}
            options={[{ value: '', label: 'Kõik tarnijad' }, ...suppliers.map((p) => ({ value: p.id, label: p.name }))]} />
        </FilterClear>
        <FilterClear active={!!filter.from} onClear={() => setFilter({ ...filter, from: '' })}>
          <DateInput value={filter.from ?? ''} className="form-input" onChange={(v) => setFilter({ ...filter, from: v })} />
        </FilterClear>
        <span className="muted">–</span>
        <FilterClear active={!!filter.to} onClear={() => setFilter({ ...filter, to: '' })}>
          <DateInput value={filter.to ?? ''} className="form-input" onChange={(v) => setFilter({ ...filter, to: v })} />
        </FilterClear>
        <div className="register-io-buttons">
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ kind: 'RECEIPT', initial: null })}><PackagePlus size={14} /><span>Arvele võtmine</span></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setForm({ kind: 'WRITE_OFF', initial: null })}><PackageMinus size={14} /><span>Mahakandmine</span></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setForm({ kind: 'TRANSFER', initial: null })} disabled={!canTransfer} title={canTransfer ? undefined : 'Ülekandeks on vaja vähemalt kahte aktiivset ladu'}><ArrowRightLeft size={14} /><span>Ülekanne</span></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setForm({ kind: 'INVENTORY', initial: null })}><ClipboardCheck size={14} /><span>Inventuur</span></button>
        </div>
      </div>

      <div className="register-table-wrap">
        <table className="register-table">
          <thead>
            <tr>
              <th>Kuupäev</th>
              <th>Liik</th>
              <th>Ladu</th>
              <th>Tarnija / põhjus</th>
              <th>Dokument</th>
              <th className="num">Ridu</th>
              <th className="num">Summa</th>
              <th className="actions-col"><span className="sr-only">Tegevused</span></th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={8} className="muted">Laokandeid pole.</td></tr>}
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{formatDate(d.date)}</td>
                <td>{STOCK_DOC_KIND_LABEL[d.kind]}</td>
                <td>{d.kind === 'TRANSFER' ? `${d.warehouseName} → ${d.toWarehouseName}` : d.warehouseName}</td>
                <td>{party(d)}</td>
                <td>{d.documentNo ?? ''}</td>
                <td className="num">{d.lines.length}</td>
                <td className="num">
                  {d.hasShortage && <span className="stock-shortage-badge" title="Ülekandel on puudujääk: osa kogusest polnud lähtelaos hinnaga olemas, maksumus jääb tühjaks">puudujääk</span>}
                  {fmtEur(d.total)}{d.hasUnpriced && <span className="muted" title="Osa ridu on hindamata"> *</span>}
                </td>
                <td className="actions-col">
                  <div className="row-actions">
                    <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setForm({ kind: d.kind, initial: d })}><Edit2 size={15} /></button>
                    <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" onClick={() => remove(d)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && form.kind === 'INVENTORY' && (
        <InventoryDialog
          initial={form.initial}
          warehouses={warehouses}
          articles={articles}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); void reload(); onChanged(); }}
        />
      )}
      {form && form.kind !== 'INVENTORY' && (
        <StockDocumentDialog
          kind={form.kind}
          initial={form.initial}
          warehouses={warehouses}
          articles={articles}
          suppliers={suppliers}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); void reload(); onChanged(); }}
        />
      )}
    </>
  );
};
