// src/components/StockDocumentDialog.tsx — laokande vorm: arvele võtmine, mahakandmine, ülekanne (päis + read)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { formatQty } from '../services/units';
import { isGoods } from '../services/articleRules';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import { todayTallinn } from '../services/dateFormat';
import type { Article } from '../types/fieldWork';
import type { RelatedParty } from '../types/party';
import type { StockDocument, StockDocumentKind, Warehouse, WriteOffReason, StockLevel } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';
import { warehouseOptions } from './WarehouseOptions';
import {
  Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  DateInput, Field, FormGrid, Input, NumberInput, Select
} from './ui';
import { tableMutedClass } from './ui/variants';

interface Row { articleId: string; quantity: number | null; amount: number | null }
const emptyRow: Row = { articleId: '', quantity: null, amount: null };
const fmtQty = formatQty;
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
interface Props {
  kind: StockDocumentKind;
  initial: StockDocument | null;
  warehouses: Warehouse[];
  articles: Article[];
  suppliers: RelatedParty[];
  onClose: () => void;
  onSaved: () => void;
}

export const StockDocumentDialog: React.FC<Props> = ({ kind, initial, warehouses, articles, suppliers, onClose, onSaved }) => {
  const defaultWh = warehouses.find((w) => w.isDefault)?.id ?? '';
  const [date, setDate] = useState(initial?.date ?? todayTallinn());
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? defaultWh);
  const [toWarehouseId, setToWarehouseId] = useState(initial?.toWarehouseId ?? '');
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [documentNo, setDocumentNo] = useState(initial?.documentNo ?? '');
  const [reason, setReason] = useState<WriteOffReason | ''>(initial?.writeOffReason ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rows, setRows] = useState<Row[]>(
    initial?.lines.map((l) => ({ articleId: l.articleId, quantity: l.quantity, amount: l.amount ?? null })) ?? [{ ...emptyRow }]
  );
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);

  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId || w.id === toWarehouseId);
  const options = useMemo(
    () => articles.filter((m) => (isGoods(m.category.group) && m.isActive) || rows.some((r) => r.articleId === m.id)).sort((a, b) => a.name.localeCompare(b.name, 'et')),
    [articles, rows]
  );
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  useEffect(() => {
    if (!warehouseId) return;
    api.getStockLevels(warehouseId)
      .then((ls: StockLevel[]) => setLevels(new Map(ls.map((l) => [l.articleId, l.qty]))))
      .catch(() => setLevels(new Map()));
  }, [warehouseId]);

  // Viimase rea viimaselt väljalt viib Tab "Lisa rida" nupule (Safari jätab nupud Tab-iga muidu vahele)
  const addRowRef = useRef<HTMLButtonElement>(null);
  const tabToAddRow = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || e.shiftKey || i !== rows.length - 1) return;
    e.preventDefault();
    addRowRef.current?.focus();
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api.saveStockDocument(
        {
          kind, date, warehouseId,
          toWarehouseId: kind === 'TRANSFER' ? toWarehouseId : null,
          supplierId: kind === 'RECEIPT' ? supplierId || null : null,
          documentNo: documentNo || null,
          writeOffReason: kind === 'WRITE_OFF' ? reason || null : null,
          notes: notes || null,
          lines: rows.filter((r) => r.articleId || r.quantity != null).map((r) => ({ articleId: r.articleId, quantity: r.quantity ?? '', amount: kind === 'RECEIPT' ? r.amount ?? '' : null }))
        },
        initial?.id
      );
      if (saved.inventoryNotice) await alertDialog(saved.inventoryNotice);
      onSaved();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Laokande salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg" className="stock-doc-modal" dismissible={!busy}>
        <DialogForm onSubmit={save}>
        <DialogHeader icon={<ArrowRightLeft size={20} />} title={`${initial ? 'Muuda: ' : ''}${STOCK_DOC_KIND_LABEL[kind]}`} />
        <DialogBody>
          <FormGrid>
            <Field label="Kuupäev *" htmlFor="sd-date">
              <DateInput id="sd-date" value={date} onChange={setDate} required />
            </Field>
            <Field label={kind === 'RECEIPT' ? 'Ladu *' : 'Lähteladu *'} htmlFor="sd-wh">
              <Select id="sd-wh" required placeholder="– vali –" value={warehouseId} onValueChange={setWarehouseId} options={warehouseOptions(activeWarehouses)} />
            </Field>
            {kind === 'TRANSFER' && (
              <Field label="Sihtladu *" htmlFor="sd-to">
                <Select id="sd-to" required placeholder="– vali –" value={toWarehouseId} onValueChange={setToWarehouseId}
                  options={warehouseOptions(activeWarehouses.filter((w) => w.id !== warehouseId))} />
              </Field>
            )}
            {kind === 'RECEIPT' && (
              <Field label="Tarnija" htmlFor="sd-sup">
                <Select id="sd-sup" value={supplierId} onValueChange={setSupplierId}
                  options={[{ value: '', label: '– vali –' }, ...suppliers.map((p) => ({ value: p.id, label: p.name }))]} />
              </Field>
            )}
            {kind === 'WRITE_OFF' && (
              <Field label="Põhjus *" htmlFor="sd-reason">
                <Select id="sd-reason" required placeholder="– vali –" value={reason} onValueChange={(v) => setReason(v as WriteOffReason)}
                  options={(Object.keys(WRITE_OFF_REASON_LABEL) as WriteOffReason[])
                    .filter((r) => r !== 'INVENTORY' || reason === 'INVENTORY')
                    .map((r) => ({ value: r, label: WRITE_OFF_REASON_LABEL[r] }))} />
              </Field>
            )}
            <Field label="Dokumendi nr" htmlFor="sd-no">
              <Input id="sd-no" placeholder={kind === 'RECEIPT' ? 'arve / saateleht' : ''} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </Field>
            <Field span="full" label="Märkus" htmlFor="sd-notes">
              <Input id="sd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </FormGrid>

          <Table scroll="none" className="stock-doc-lines">
            <TableHeader>
              <TableRow>
                <TableHead>Materjal</TableHead>
                <TableHead numeric>Laos</TableHead>
                <TableHead numeric>Kogus</TableHead>
                {kind === 'RECEIPT' && <TableHead numeric>Summa km-ta (€)</TableHead>}
                {kind === 'RECEIPT' && <TableHead numeric>Ühikuhind</TableHead>}
                {kind !== 'RECEIPT' && initial && <TableHead numeric>Maksumus</TableHead>}
                <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const m = articles.find((x) => x.id === r.articleId);
                const qty = r.quantity;
                const amount = r.amount;
                const saved = initial?.lines.find((l) => l.articleId === r.articleId);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Select size="sm" aria-label="Materjal" placeholder="– vali –" value={r.articleId} onValueChange={(v) => setRow(i, { articleId: v })}
                        options={[{ value: '', label: '– vali –' }, ...options.map((x) => ({ value: x.id, label: x.name }))]} />
                    </TableCell>
                    <TableCell numeric className={(levels.get(r.articleId) ?? 0) < 0 ? 'article-overuse' : ''}>
                      {m ? <>{fmtQty(levels.get(m.id) ?? 0)}<span className="stock-doc-unit">{m.unit}</span></> : '–'}
                    </TableCell>
                    <TableCell numeric>
                      {/* keydown tõuseb NumberInput-ilt siia: viimase rea Tab viib „Lisa rida“ nupule */}
                      <span onKeyDown={kind === 'RECEIPT' ? undefined : tabToAddRow(i)}>
                        <NumberInput size="sm" className="stock-doc-qty" aria-label="Kogus" end={m?.unit ?? ''} value={r.quantity} onChange={(n) => setRow(i, { quantity: n })} />
                      </span>
                    </TableCell>
                    {kind === 'RECEIPT' && (
                      <TableCell numeric>
                        <span onKeyDown={tabToAddRow(i)}>
                          <NumberInput size="sm" className="stock-doc-amount" aria-label="Summa" value={r.amount} onChange={(n) => setRow(i, { amount: n })} />
                        </span>
                      </TableCell>
                    )}
                    {kind === 'RECEIPT' && (
                      <TableCell numeric className="stock-doc-unit-price">{qty && amount != null ? `${fmtEur(amount / qty)}/${m?.unit ?? ''}` : '–'}</TableCell>
                    )}
                    {kind !== 'RECEIPT' && initial && (
                      <TableCell numeric>{saved?.fifoCost == null ? <span className={tableMutedClass}>hindamata</span> : fmtEur(saved.fifoCost)}</TableCell>
                    )}
                    <TableCell actions>
                      {/* Tab jätab kustutamisnupu vahele */}
                      <Button type="button" tabIndex={-1} variant="danger-ghost" size="icon-sm" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...emptyRow }])}>
                        <Trash2 size={15} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="stock-doc-footer-row">
            <Button type="button" ref={addRowRef} size="sm" onClick={() => setRows([...rows, { ...emptyRow }])}>
              <Plus size={14} /><span>Lisa rida</span>
            </Button>
            {kind === 'RECEIPT' && <span>Kokku: <strong>{fmtEur(total)}</strong></span>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Loobu</Button>
          <Button type="submit" variant="primary" disabled={busy}>Salvesta</Button>
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
};
