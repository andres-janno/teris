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
import { Badge, Button, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from './ui';

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
          <Button variant="primary" size="sm" onClick={() => setForm({ kind: 'RECEIPT', initial: null })}><PackagePlus size={14} /><span>Arvele võtmine</span></Button>
          <Button size="sm" onClick={() => setForm({ kind: 'WRITE_OFF', initial: null })}><PackageMinus size={14} /><span>Mahakandmine</span></Button>
          <Button size="sm" onClick={() => setForm({ kind: 'TRANSFER', initial: null })} disabled={!canTransfer} title={canTransfer ? undefined : 'Ülekandeks on vaja vähemalt kahte aktiivset ladu'}><ArrowRightLeft size={14} /><span>Ülekanne</span></Button>
          <Button size="sm" onClick={() => setForm({ kind: 'INVENTORY', initial: null })}><ClipboardCheck size={14} /><span>Inventuur</span></Button>
        </div>
      </div>

      <Table scroll="fill" bordered>
        <TableHeader>
          <TableRow>
            <TableHead>Kuupäev</TableHead>
            <TableHead>Liik</TableHead>
            <TableHead>Ladu</TableHead>
            <TableHead>Tarnija / põhjus</TableHead>
            <TableHead>Dokument</TableHead>
            <TableHead numeric>Ridu</TableHead>
            <TableHead numeric>Summa</TableHead>
            <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.length === 0 && <TableEmpty colSpan={8}>Laokandeid pole.</TableEmpty>}
          {docs.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{formatDate(d.date)}</TableCell>
              <TableCell>{STOCK_DOC_KIND_LABEL[d.kind]}</TableCell>
              <TableCell wrap>{d.kind === 'TRANSFER' ? `${d.warehouseName} → ${d.toWarehouseName}` : d.warehouseName}</TableCell>
              <TableCell wrap>{party(d)}</TableCell>
              <TableCell>{d.documentNo ?? ''}</TableCell>
              <TableCell numeric>{d.lines.length}</TableCell>
              <TableCell numeric>
                {d.hasShortage && <Badge tone="danger" variant="outline" className="cell-badge-lead" title="Ülekandel on puudujääk: osa kogusest polnud lähtelaos hinnaga olemas, maksumus jääb tühjaks">puudujääk</Badge>}
                {fmtEur(d.total)}{d.hasUnpriced && <span className="muted" title="Osa ridu on hindamata"> *</span>}
              </TableCell>
              <TableCell actions>
                <Button variant="ghost" size="icon-sm" title="Muuda" aria-label="Muuda" onClick={() => setForm({ kind: d.kind, initial: d })}><Edit2 size={15} /></Button>
                <Button variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta" onClick={() => remove(d)}><Trash2 size={15} /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
