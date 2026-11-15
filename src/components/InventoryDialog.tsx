// src/components/InventoryDialog.tsx — inventuur: lao kaubad arvestusliku seisuga, tegelik seis sisestusväljas.
// Tühi tegelik seis = rida ei salvestata; 0 = kogu seis maha. Vahe ja maksumuse arvutab server ümberarvutusel.
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { formatQty } from '../services/units';
import { isGoods } from '../services/articleRules';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import { todayTallinn } from '../services/dateFormat';
import type { Article } from '../types/fieldWork';
import type { InventoryPreviewRow, StockDocument, Warehouse } from '../types/stock';
import { WarehouseOptions } from './WarehouseOptions';
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, DateInput } from './ui';

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
  const [added, setAdded] = useState<string[]>(() => initial?.lines.map((l) => l.articleId) ?? []); // käsitsi lisatud ja dokumendi enda artiklid, mida eelvaates ei pruugi olla
  const [counted, setCounted] = useState<Record<string, string>>(
    () => Object.fromEntries((initial?.lines ?? []).map((l) => [l.articleId, fmtInput(l.countedQty)]))
  );
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warehouseId || !date) return;
    let alive = true;
    setPreview([]);
    setLoading(true);
    api.getInventoryPreview(warehouseId, date, initial?.id)
      .then((rows) => { if (alive) { setPreview(rows); setLoading(false); } })
      .catch((e) => { if (alive) { setLoading(false); void alertDialog(e instanceof Error ? e.message : 'Arvestusliku seisu laadimine ebaõnnestus'); } });
    return () => { alive = false; };
  }, [warehouseId, date, initial?.id]);

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

  const changeWarehouse = async (id: string) => {
    if (!initial) {
      if (Object.values(counted).some((v) => v.trim()) && !(await confirmDialog('Lao vahetus tühjendab sisestatud tegelikud seisud. Jätkan?'))) return;
      setCounted({});
      setAdded([]);
    }
    setWarehouseId(id);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((r) => (counted[r.articleId] ?? '').trim());
    const bad = filled.find((r) => parseNum(counted[r.articleId]) === null);
    if (bad) return void alertDialog(`Tegelik seis peab olema arv: ${bad.articleName}`);
    const neg = filled.find((r) => (parseNum(counted[r.articleId]) ?? 0) < 0);
    if (neg) return void alertDialog(`Tegelik seis ei tohi olla negatiivne: ${neg.articleName}`);
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg" className="stock-doc-modal" dismissible={!busy}>
        <DialogForm onSubmit={save}>
        <DialogHeader icon={<ClipboardCheck size={20} className="text-emerald" />} title={`${initial ? 'Muuda: ' : ''}Inventuur`} />
        <DialogBody>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="inv-date">Kuupäev *</label>
              <DateInput id="inv-date" value={date} onChange={setDate} required />
            </div>
            <div className="form-group">
              <label htmlFor="inv-wh">Ladu *</label>
              <select id="inv-wh" className="form-input" required value={warehouseId} onChange={(e) => void changeWarehouse(e.target.value)}>
                <option value="">– vali –</option>
                <WarehouseOptions warehouses={activeWarehouses} />
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

          <Table scroll="none" className="stock-doc-lines">
            <TableHeader>
              <TableRow>
                <TableHead>Artikkel</TableHead>
                <TableHead numeric>Arvestuslik</TableHead>
                <TableHead numeric>Tegelik</TableHead>
                <TableHead numeric>Vahe</TableHead>
                <TableHead numeric>Eeldatav väärtus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableEmpty colSpan={5}>{loading ? 'Laen…' : 'Selles laos pole kaupu. Lisa artikkel allpool.'}</TableEmpty>}
              {rows.map((r, i) => {
                const x = results[i];
                return (
                  <TableRow key={r.articleId}>
                    <TableCell wrap>{r.articleName}</TableCell>
                    <TableCell numeric className={r.bookQty < 0 ? 'article-overuse' : ''}>{formatQty(r.bookQty)}<span className="stock-doc-unit">{r.unit}</span></TableCell>
                    <TableCell numeric>
                      <span className="input-with-unit">
                        <input
                          className="form-input num" inputMode="decimal" aria-label={`Tegelik seis: ${r.articleName}`}
                          value={counted[r.articleId] ?? ''}
                          onChange={(e) => setCounted({ ...counted, [r.articleId]: e.target.value })}
                          onBlur={() => { const n = parseNum(counted[r.articleId] ?? ''); if (n !== null) setCounted({ ...counted, [r.articleId]: fmtInput(n) }); }}
                        />
                        <span className="stock-doc-unit">{r.unit}</span>
                      </span>
                    </TableCell>
                    <TableCell numeric className={x && x.diff < 0 ? 'stock-qty-out' : x && x.diff > 0 ? 'stock-qty-in' : ''}>
                      {x ? `${x.diff > 0 ? '+' : ''}${formatQty(x.diff)}` : '–'}
                    </TableCell>
                    <TableCell numeric>{!x || x.diff === 0 ? '–' : x.value == null ? <span className="muted">hindamata</span> : fmtEur(x.value)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="stock-doc-footer-row">
            <select className="form-input" aria-label="Lisa artikkel" value="" onChange={(e) => e.target.value && setAdded([...added, e.target.value])}>
              <option value="">+ Lisa artikkel, mida nimekirjas pole</option>
              {addable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span>Puudujääk: <strong>{fmtEur(shortage)}</strong> · Ülejääk: <strong>{fmtEur(surplus)}</strong></span>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Loobu</Button>
          <Button type="submit" variant="primary" disabled={busy || loading}>Salvesta</Button>
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
};
