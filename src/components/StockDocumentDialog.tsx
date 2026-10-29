// src/components/StockDocumentDialog.tsx — laokande vorm: arvele võtmine, mahakandmine, ülekanne (päis + read)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, ArrowRightLeft } from 'lucide-react';
import { formatQty } from '../services/units';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { todayTallinn } from '../services/dateFormat';
import type { Material } from '../types/fieldWork';
import type { RelatedParty } from '../types/party';
import type { StockDocument, StockDocumentKind, Warehouse, WriteOffReason, StockLevel } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';

interface Row { materialId: string; quantity: string; amount: string }
const emptyRow: Row = { materialId: '', quantity: '', amount: '' };
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
  materials: Material[];
  suppliers: RelatedParty[];
  onClose: () => void;
  onSaved: () => void;
}

export const StockDocumentDialog: React.FC<Props> = ({ kind, initial, warehouses, materials, suppliers, onClose, onSaved }) => {
  const defaultWh = warehouses.find((w) => w.isDefault)?.id ?? '';
  const [date, setDate] = useState(initial?.date ?? todayTallinn());
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? defaultWh);
  const [toWarehouseId, setToWarehouseId] = useState(initial?.toWarehouseId ?? '');
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [documentNo, setDocumentNo] = useState(initial?.documentNo ?? '');
  const [reason, setReason] = useState<WriteOffReason | ''>(initial?.writeOffReason ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rows, setRows] = useState<Row[]>(
    initial?.lines.map((l) => ({ materialId: l.materialId, quantity: fmtInput(l.quantity), amount: fmtInput(l.amount) })) ?? [{ ...emptyRow }]
  );
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);

  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId || w.id === toWarehouseId);
  const options = useMemo(
    () => materials.filter((m) => m.isActive || rows.some((r) => r.materialId === m.id)).sort((a, b) => a.name.localeCompare(b.name, 'et')),
    [materials, rows]
  );
  const total = rows.reduce((s, r) => s + (parseNum(r.amount) ?? 0), 0);

  useEffect(() => {
    if (!warehouseId) return;
    api.getStockLevels(warehouseId)
      .then((ls: StockLevel[]) => setLevels(new Map(ls.map((l) => [l.materialId, l.qty]))))
      .catch(() => setLevels(new Map()));
  }, [warehouseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

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
      await api.saveStockDocument(
        {
          kind, date, warehouseId,
          toWarehouseId: kind === 'TRANSFER' ? toWarehouseId : null,
          supplierId: kind === 'RECEIPT' ? supplierId || null : null,
          documentNo: documentNo || null,
          writeOffReason: kind === 'WRITE_OFF' ? reason || null : null,
          notes: notes || null,
          lines: rows.filter((r) => r.materialId || r.quantity).map((r) => ({ materialId: r.materialId, quantity: r.quantity, amount: kind === 'RECEIPT' ? r.amount : null }))
        },
        initial?.id
      );
      onSaved();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Laokande salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up stock-doc-modal" onSubmit={save}>
        <div className="modal-header">
          <div className="modal-title-group">
            <ArrowRightLeft size={20} className="text-emerald" />
            <h3>{initial ? 'Muuda: ' : ''}{STOCK_DOC_KIND_LABEL[kind]}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="sd-date">Kuupäev *</label>
              <DateInput id="sd-date" value={date} onChange={setDate} className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="sd-wh">{kind === 'RECEIPT' ? 'Ladu *' : 'Lähteladu *'}</label>
              <select id="sd-wh" className="form-input" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">– vali –</option>
                {activeWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {kind === 'TRANSFER' && (
              <div className="form-group">
                <label htmlFor="sd-to">Sihtladu *</label>
                <select id="sd-to" className="form-input" required value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                  <option value="">– vali –</option>
                  {activeWarehouses.filter((w) => w.id !== warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                  {(Object.keys(WRITE_OFF_REASON_LABEL) as WriteOffReason[]).map((r) => <option key={r} value={r}>{WRITE_OFF_REASON_LABEL[r]}</option>)}
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

          <table className="register-table stock-doc-lines">
            <thead>
              <tr>
                <th>Materjal</th>
                <th className="num">Laos</th>
                <th className="num">Kogus</th>
                {kind === 'RECEIPT' && <th className="num">Summa km-ta (€)</th>}
                {kind === 'RECEIPT' && <th className="num">Ühikuhind</th>}
                {kind !== 'RECEIPT' && initial && <th className="num">Maksumus</th>}
                <th className="actions-col"><span className="sr-only">Tegevused</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const m = materials.find((x) => x.id === r.materialId);
                const qty = parseNum(r.quantity);
                const amount = parseNum(r.amount);
                const saved = initial?.lines.find((l) => l.materialId === r.materialId);
                return (
                  <tr key={i}>
                    <td>
                      <select className="form-input" aria-label="Materjal" value={r.materialId} onChange={(e) => setRow(i, { materialId: e.target.value })}>
                        <option value="">– vali –</option>
                        {options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                    <td className={`num ${(levels.get(r.materialId) ?? 0) < 0 ? 'material-overuse' : ''}`}>
                      {m ? <>{fmtQty(levels.get(m.id) ?? 0)}<span className="stock-doc-unit">{m.unit}</span></> : '–'}
                    </td>
                    <td className="num">
                      <span className="input-with-unit">
                        <input className="form-input num" inputMode="decimal" aria-label="Kogus" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} onBlur={() => setRow(i, { quantity: fmtInput(r.quantity) })} onKeyDown={kind === 'RECEIPT' ? undefined : tabToAddRow(i)} />
                        <span className="stock-doc-unit">{m?.unit ?? ''}</span>
                      </span>
                    </td>
                    {kind === 'RECEIPT' && (
                      <td className="num">
                        <input className="form-input num" inputMode="decimal" aria-label="Summa" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} onBlur={() => setRow(i, { amount: fmtInput(r.amount) })} onKeyDown={tabToAddRow(i)} />
                      </td>
                    )}
                    {kind === 'RECEIPT' && (
                      <td className="num stock-doc-unit-price">{qty && amount != null ? `${fmtEur(amount / qty)}/${m?.unit ?? ''}` : '–'}</td>
                    )}
                    {kind !== 'RECEIPT' && initial && (
                      <td className="num">{saved?.fifoCost == null ? <span className="muted">hindamata</span> : fmtEur(saved.fifoCost)}</td>
                    )}
                    <td className="actions-col">
                      {/* Tab jätab kustutamisnupu vahele */}
                      <button type="button" tabIndex={-1} className="icon-btn-danger" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...emptyRow }])}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="stock-doc-footer-row">
            <button type="button" ref={addRowRef} className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, { ...emptyRow }])}>
              <Plus size={14} /><span>Lisa rida</span>
            </button>
            {kind === 'RECEIPT' && <span>Kokku: <strong>{fmtEur(total)}</strong></span>}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
        </div>
      </form>
    </div>,
    document.body
  );
};
