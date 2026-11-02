// src/components/InventoryDialog.tsx — inventuur: lao kaubad arvestusliku seisuga, tegelik seis sisestusväljas.
// Tühi tegelik seis = rida ei salvestata; 0 = kogu seis maha. Vahe ja maksumuse arvutab server ümberarvutusel.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCheck, X } from 'lucide-react';
import { formatQty } from '../services/units';
import { isGoods } from '../services/articleRules';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { todayTallinn } from '../services/dateFormat';
import type { Article } from '../types/fieldWork';
import type { InventoryPreviewRow, StockDocument, Warehouse } from '../types/stock';

const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};
const fmtInput = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

interface Props {
  initial: StockDocument | null;
  warehouses: Warehouse[];
  articles: Article[];
  onClose: () => void;
  onSaved: () => void;
}

export const InventoryDialog: React.FC<Props> = ({ initial, warehouses, articles, onClose, onSaved }) => {
  const [date, setDate] = useState(initial?.date ?? todayTallinn());
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? warehouses.find((w) => w.isDefault)?.id ?? '');
  const [documentNo, setDocumentNo] = useState(initial?.documentNo ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [preview, setPreview] = useState<InventoryPreviewRow[]>([]);
  const [added, setAdded] = useState<string[]>([]); // käsitsi lisatud artiklid, mida nimekirjas polnud
  const [counted, setCounted] = useState<Record<string, string>>(
    () => Object.fromEntries((initial?.lines ?? []).map((l) => [l.articleId, fmtInput(l.countedQty)]))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!warehouseId || !date) return;
    let alive = true;
    api.getInventoryPreview(warehouseId, date, initial?.id)
      .then((rows) => { if (alive) setPreview(rows); })
      .catch((e) => { if (alive) void alertDialog(e instanceof Error ? e.message : 'Arvestusliku seisu laadimine ebaõnnestus'); });
    return () => { alive = false; };
  }, [warehouseId, date, initial?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const rows = useMemo(() => {
    const listed = new Set(preview.map((p) => p.articleId));
    const extra = added.filter((id) => !listed.has(id)).flatMap((id) => {
      const a = articles.find((x) => x.id === id);
      return a ? [{ articleId: a.id, articleName: a.name, unit: a.unit, bookQty: 0, unitPrice: null }] : [];
    });
    return [...preview, ...extra];
  }, [preview, added, articles]);

  const addable = articles
    .filter((a) => isGoods(a.category.group) && a.isActive && !rows.some((r) => r.articleId === a.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'et'));
  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId);

  // Vahe ja eeldatav väärtus (lao keskmise hinnaga; puudujäägi tegelik maksumus tuleb FIFO-st pärast salvestust)
  const calc = (r: InventoryPreviewRow) => {
    const c = parseNum(counted[r.articleId] ?? '');
    if (c === null) return null;
    const diff = Math.round((c - r.bookQty) * 1e6) / 1e6;
    return { diff, value: r.unitPrice == null ? null : Math.round(diff * r.unitPrice * 100) / 100 };
  };
  const results = rows.map(calc);
  const shortage = results.reduce((s, x) => s + (x && x.diff < 0 ? -(x.value ?? 0) : 0), 0);
  const surplus = results.reduce((s, x) => s + (x && x.diff > 0 ? x.value ?? 0 : 0), 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((r) => (counted[r.articleId] ?? '').trim());
    const bad = filled.find((r) => parseNum(counted[r.articleId]) === null);
    if (bad) return void alertDialog(`Tegelik seis peab olema arv: ${bad.articleName}`);
    if (!filled.length) return void alertDialog('Sisesta vähemalt ühe artikli tegelik seis');
    setBusy(true);
    try {
      const saved = await api.saveStockDocument(
        {
          kind: 'INVENTORY', date, warehouseId, documentNo: documentNo || null, notes: notes || null,
          lines: filled.map((r) => ({ articleId: r.articleId, countedQty: counted[r.articleId] }))
        },
        initial?.id
      );
      if (saved.inventoryNotice) await alertDialog(saved.inventoryNotice);
      onSaved();
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : 'Inventuuri salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up stock-doc-modal" onSubmit={save}>
        <div className="modal-header">
          <div className="modal-title-group">
            <ClipboardCheck size={20} className="text-emerald" />
            <h3>{initial ? 'Muuda: ' : ''}Inventuur</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="inv-date">Kuupäev *</label>
              <DateInput id="inv-date" value={date} onChange={setDate} className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="inv-wh">Ladu *</label>
              <select id="inv-wh" className="form-input" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">– vali –</option>
                {activeWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="inv-no">Dokumendi nr</label>
              <input id="inv-no" className="form-input" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="inv-notes">Märkus</label>
              <input id="inv-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <p className="muted">Tühi tegelik seis: rida ei arvestata. 0: kogu seis kantakse maha.</p>

          <table className="register-table stock-doc-lines">
            <thead>
              <tr>
                <th>Artikkel</th>
                <th className="num">Arvestuslik</th>
                <th className="num">Tegelik</th>
                <th className="num">Vahe</th>
                <th className="num">Eeldatav väärtus</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="muted">Selles laos pole kaupu. Lisa artikkel allpool.</td></tr>}
              {rows.map((r, i) => {
                const x = results[i];
                return (
                  <tr key={r.articleId}>
                    <td>{r.articleName}</td>
                    <td className={`num ${r.bookQty < 0 ? 'article-overuse' : ''}`}>{formatQty(r.bookQty)}<span className="stock-doc-unit">{r.unit}</span></td>
                    <td className="num">
                      <span className="input-with-unit">
                        <input
                          className="form-input num" inputMode="decimal" aria-label={`Tegelik seis: ${r.articleName}`}
                          value={counted[r.articleId] ?? ''}
                          onChange={(e) => setCounted({ ...counted, [r.articleId]: e.target.value })}
                          onBlur={() => { const n = parseNum(counted[r.articleId] ?? ''); if (n !== null) setCounted({ ...counted, [r.articleId]: fmtInput(n) }); }}
                        />
                        <span className="stock-doc-unit">{r.unit}</span>
                      </span>
                    </td>
                    <td className={`num ${x && x.diff < 0 ? 'stock-qty-out' : x && x.diff > 0 ? 'stock-qty-in' : ''}`}>
                      {x ? `${x.diff > 0 ? '+' : ''}${formatQty(x.diff)}` : '–'}
                    </td>
                    <td className="num">{!x || x.diff === 0 ? '–' : x.value == null ? <span className="muted">hindamata</span> : fmtEur(x.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="stock-doc-footer-row">
            <select className="form-input" aria-label="Lisa artikkel" value="" onChange={(e) => e.target.value && setAdded([...added, e.target.value])}>
              <option value="">+ Lisa artikkel, mida nimekirjas pole</option>
              {addable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span>Puudujääk: <strong>{fmtEur(shortage)}</strong> · Ülejääk: <strong>{fmtEur(surplus)}</strong></span>
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
