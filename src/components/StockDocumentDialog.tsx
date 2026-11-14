// src/components/StockDocumentDialog.tsx — laokande vorm: arvele võtmine, mahakandmine, ülekanne (päis + read)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { formatQty } from '../services/units';
import { isGoods } from '../services/articleRules';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { todayTallinn } from '../services/dateFormat';
import type { Article } from '../types/fieldWork';
import type { RelatedParty } from '../types/party';
import type { StockDocument, StockDocumentKind, Warehouse, WriteOffReason, StockLevel } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';
import { WarehouseOptions } from './WarehouseOptions';
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

interface Row { articleId: string; quantity: string; amount: string }
const emptyRow: Row = { articleId: '', quantity: '', amount: '' };
const fmtQty = formatQty;
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};
// Sisestusväljas 2 komakohta (ilma tuhandete eraldajata); mittearvuline tekst jääb alles
const fmtInput = (v: number | string | null | undefined) => {
  const n = typeof v === 'number' ? v : parseNum(v ?? '');
  return n == null ? (typeof v === 'string' ? v : '') : n.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
};

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
    initial?.lines.map((l) => ({ articleId: l.articleId, quantity: fmtInput(l.quantity), amount: fmtInput(l.amount) })) ?? [{ ...emptyRow }]
  );
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);

  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId || w.id === toWarehouseId);
  const options = useMemo(
    () => articles.filter((m) => (isGoods(m.category.group) && m.isActive) || rows.some((r) => r.articleId === m.id)).sort((a, b) => a.name.localeCompare(b.name, 'et')),
    [articles, rows]
  );
  const total = rows.reduce((s, r) => s + (parseNum(r.amount) ?? 0), 0);

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
          lines: rows.filter((r) => r.articleId || r.quantity).map((r) => ({ articleId: r.articleId, quantity: r.quantity, amount: kind === 'RECEIPT' ? r.amount : null }))
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
        <DialogHeader icon={<ArrowRightLeft size={20} className="text-emerald" />} title={`${initial ? 'Muuda: ' : ''}${STOCK_DOC_KIND_LABEL[kind]}`} />
        <DialogBody>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="sd-date">Kuupäev *</label>
              <DateInput id="sd-date" value={date} onChange={setDate} className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="sd-wh">{kind === 'RECEIPT' ? 'Ladu *' : 'Lähteladu *'}</label>
              <select id="sd-wh" className="form-input" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">– vali –</option>
                <WarehouseOptions warehouses={activeWarehouses} />
              </select>
            </div>
            {kind === 'TRANSFER' && (
              <div className="form-group">
                <label htmlFor="sd-to">Sihtladu *</label>
                <select id="sd-to" className="form-input" required value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                  <option value="">– vali –</option>
                  <WarehouseOptions warehouses={activeWarehouses.filter((w) => w.id !== warehouseId)} />
                </select>
              </div>
            )}
            {kind === 'RECEIPT' && (
              <div className="form-group">
                <label htmlFor="sd-sup">Tarnija</label>
                <select id="sd-sup" className="form-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">– vali –</option>
                  {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {kind === 'WRITE_OFF' && (
              <div className="form-group">
                <label htmlFor="sd-reason">Põhjus *</label>
                <select id="sd-reason" className="form-input" required value={reason} onChange={(e) => setReason(e.target.value as WriteOffReason)}>
                  <option value="">– vali –</option>
                  {(Object.keys(WRITE_OFF_REASON_LABEL) as WriteOffReason[]).filter((r) => r !== 'INVENTORY' || reason === 'INVENTORY').map((r) => <option key={r} value={r}>{WRITE_OFF_REASON_LABEL[r]}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="sd-no">Dokumendi nr</label>
              <input id="sd-no" className="form-input" placeholder={kind === 'RECEIPT' ? 'arve / saateleht' : ''} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="sd-notes">Märkus</label>
              <input id="sd-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

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
                const qty = parseNum(r.quantity);
                const amount = parseNum(r.amount);
                const saved = initial?.lines.find((l) => l.articleId === r.articleId);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <select className="form-input" aria-label="Materjal" value={r.articleId} onChange={(e) => setRow(i, { articleId: e.target.value })}>
                        <option value="">– vali –</option>
                        {options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell numeric className={(levels.get(r.articleId) ?? 0) < 0 ? 'article-overuse' : ''}>
                      {m ? <>{fmtQty(levels.get(m.id) ?? 0)}<span className="stock-doc-unit">{m.unit}</span></> : '–'}
                    </TableCell>
                    <TableCell numeric>
                      <span className="input-with-unit">
                        <input className="form-input num" inputMode="decimal" aria-label="Kogus" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} onBlur={() => setRow(i, { quantity: fmtInput(r.quantity) })} onKeyDown={kind === 'RECEIPT' ? undefined : tabToAddRow(i)} />
                        <span className="stock-doc-unit">{m?.unit ?? ''}</span>
                      </span>
                    </TableCell>
                    {kind === 'RECEIPT' && (
                      <TableCell numeric>
                        <input className="form-input num" inputMode="decimal" aria-label="Summa" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} onBlur={() => setRow(i, { amount: fmtInput(r.amount) })} onKeyDown={tabToAddRow(i)} />
                      </TableCell>
                    )}
                    {kind === 'RECEIPT' && (
                      <TableCell numeric className="stock-doc-unit-price">{qty && amount != null ? `${fmtEur(amount / qty)}/${m?.unit ?? ''}` : '–'}</TableCell>
                    )}
                    {kind !== 'RECEIPT' && initial && (
                      <TableCell numeric>{saved?.fifoCost == null ? <span className="muted">hindamata</span> : fmtEur(saved.fifoCost)}</TableCell>
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
