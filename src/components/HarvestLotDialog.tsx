// src/components/HarvestLotDialog.tsx — saagipartii vaade: kanded, kaalumised, kuivatuskulud, sulgemine
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wheat, X, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { formatQty } from '../services/units';
import { formatDate, todayTallinn } from '../services/dateFormat';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import type { Article } from '../types/fieldWork';
import type { Crop } from '../types/crop';
import type { Warehouse } from '../types/stock';
import type { HarvestLotDetail } from '../types/harvestLot';
import { HARVEST_LOT_STATUS_LABEL } from '../types/harvestLot';

const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  lotId: string | null; // null = uus partii
  defaultYear: number;
  warehouses: Warehouse[];
  articles: Article[];
  onClose: () => void;
  onSaved: (closeDialog: boolean) => void;
}

export const HarvestLotDialog: React.FC<Props> = ({ lotId, defaultYear, warehouses, articles, onClose, onSaved }) => {
  const [lot, setLot] = useState<HarvestLotDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [name, setName] = useState('');
  const [year, setYear] = useState(String(defaultYear));
  const [cropId, setCropId] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id ?? '');
  const [notes, setNotes] = useState('');
  const [wDate, setWDate] = useState(todayTallinn());
  const [wTonnes, setWTonnes] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [cDate, setCDate] = useState(todayTallinn());
  const [cArticle, setCArticle] = useState('');
  const [cQty, setCQty] = useState('');
  const [cNotes, setCNotes] = useState('');

  const load = useCallback(async (id: string) => {
    const l = await api.getHarvestLot(id);
    setLot(l);
    setName(l.name);
    setWarehouseId(l.warehouseId);
    setNotes(l.notes ?? '');
    return l;
  }, []);

  useEffect(() => {
    if (lotId) load(lotId).catch((e) => void alertDialog(errorText(e)));
    else api.getCrops().then(setCrops).catch(() => setCrops([]));
  }, [lotId, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); if (!busy) onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, busy]);

  // Tegevus: lukk (busy), vea korral dialoog, õnnestumisel uuesti laadimine
  const run = async (fn: () => Promise<void>, refresh = true) => {
    setBusy(true);
    try {
      await fn();
      if (lotId && refresh) await load(lotId);
      onSaved(false);
    } catch (err) {
      void alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (lotId) {
        await api.saveHarvestLot({ id: lotId, name, warehouseId, notes: notes || null });
        await load(lotId);
        onSaved(false);
      } else {
        await api.saveHarvestLot({ name, year: Number(year), cropId, warehouseId, notes: notes || null });
        onSaved(true);
      }
    } catch (err) {
      void alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const closed = lot?.status === 'CLOSED';
  const dryingTotal = (lot?.costs ?? []).reduce((s, c) => s + (c.total ?? 0), 0);
  const dryingArticles = articles
    .filter((a) => a.isActive && (a.category.group !== 'SERVICE' || a.category.systemKind === 'DRYING_TIME'))
    .sort((a, b) => a.name.localeCompare(b.name, 'et'));
  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId);

  const addWeighing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotId) return;
    void run(async () => {
      await api.addHarvestLotWeighing(lotId, { date: wDate, tonnes: wTonnes.replace(',', '.'), notes: wNotes || null });
      setWTonnes('');
      setWNotes('');
    });
  };
  const addCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotId) return;
    void run(async () => {
      await api.addHarvestLotCost(lotId, { date: cDate, articleId: cArticle, quantity: cQty.replace(',', '.'), notes: cNotes || null });
      setCQty('');
      setCNotes('');
    });
  };
  const closeLot = async () => {
    if (!lotId || !(await confirmDialog('Sulgen partii ja arvutan kannete tonnid punkri kaalu järgi?'))) return;
    void run(async () => { await api.closeHarvestLot(lotId); });
  };
  const removeLot = async () => {
    if (!lotId || !(await confirmDialog('Kas kustutan saagipartii?'))) return;
    setBusy(true);
    try {
      await api.deleteHarvestLot(lotId);
      onSaved(true);
    } catch (err) {
      void alertDialog(errorText(err));
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up stock-doc-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Wheat size={20} className="text-emerald" />
            <h3>{lot ? `Saagipartii: ${lot.name}` : 'Uus saagipartii'}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="hl-name">Nimi *</label>
                <input id="hl-name" className="form-input" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {lot ? (
                <>
                  <div className="form-group"><label>Kultuur</label><div>{lot.cropName}</div></div>
                  <div className="form-group"><label>Hooaeg</label><div>{lot.seasonYear}</div></div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="hl-crop">Kultuur *</label>
                    <select id="hl-crop" className="form-input" required value={cropId} onChange={(e) => setCropId(e.target.value)}>
                      <option value="">– vali –</option>
                      {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="hl-year">Hooaeg *</label>
                    <input id="hl-year" className="form-input num" required inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
                  </div>
                </>
              )}
              <div className="form-group">
                <label htmlFor="hl-wh">Ladu *</label>
                <select id="hl-wh" className="form-input" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">– vali –</option>
                  {activeWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              {lot && <div className="form-group"><label>Staatus</label><div>{HARVEST_LOT_STATUS_LABEL[lot.status]}</div></div>}
              <div className="form-group full-width">
                <label htmlFor="hl-notes">Märkus</label>
                <input id="hl-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Salvesta</button>
            </div>
          </form>

          {lot && (
            <>
              <h4 style={{ marginTop: 16 }}>Kokkuvõte</h4>
              <div className="register-table-wrap">
                <table className="register-table">
                  <tbody>
                    <tr><td>Punkreid</td><td className="num">{lot.bunkers}</td></tr>
                    <tr><td>Kaalutud, t</td><td className="num">{formatQty(lot.weighedTonnes)}</td></tr>
                    {closed && <tr><td>Punkri kaal, t</td><td className="num">{lot.bunkerTonnes == null ? '–' : formatQty(lot.bunkerTonnes)}</td></tr>}
                    <tr><td>Kuivatuskulu kokku</td><td className="num">{fmtEur(dryingTotal)}</td></tr>
                  </tbody>
                </table>
              </div>

              <h4 style={{ marginTop: 16 }}>Kanded</h4>
              <div className="register-table-wrap">
                <table className="register-table">
                  <thead>
                    <tr><th>Kuupäev</th><th>Põld</th><th className="num">Punkreid</th><th className="num">Tonnid</th><th>Finants</th></tr>
                  </thead>
                  <tbody>
                    {lot.entries.length === 0 && <tr><td colSpan={5} className="muted">Kandeid pole.</td></tr>}
                    {lot.entries.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDate(e.date)}</td>
                        <td>{e.fieldName}</td>
                        <td className="num">{e.bunkers ?? '–'}</td>
                        <td className="num">
                          {e.manual && <span className="muted" title="Tonnid sisestatud käsitsi"> käsitsi </span>}
                          {!e.manual && !(e.tonnes != null && e.tonnes > 0) ? <span className="muted">kaalumata</span> : formatQty(e.tonnes ?? 0)}
                        </td>
                        <td>{e.financeStatus ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{ marginTop: 16 }}>Kaalumised</h4>
              <div className="register-table-wrap">
                <table className="register-table">
                  <thead>
                    <tr><th>Kuupäev</th><th className="num">Tonnid</th><th>Märkus</th><th className="actions-col"><span className="sr-only">Tegevused</span></th></tr>
                  </thead>
                  <tbody>
                    {lot.weighings.length === 0 && <tr><td colSpan={4} className="muted">Kaalumisi pole.</td></tr>}
                    {lot.weighings.map((w) => (
                      <tr key={w.id}>
                        <td>{formatDate(w.date)}</td>
                        <td className="num">{formatQty(w.tonnes)}</td>
                        <td>{w.notes ?? ''}</td>
                        <td className="actions-col">
                          {!closed && (
                            <div className="row-actions">
                              <button type="button" className="icon-btn-danger" title="Kustuta" aria-label="Kustuta kaalumine" disabled={busy}
                                onClick={() => void run(async () => { await api.deleteHarvestLotWeighing(lot.id, w.id); })}><Trash2 size={15} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!closed && (
                <form className="register-actions-bar" onSubmit={addWeighing}>
                  <DateInput value={wDate} onChange={setWDate} className="form-input" required />
                  <input className="form-input num" aria-label="Tonnid" placeholder="t" inputMode="decimal" required value={wTonnes} onChange={(e) => setWTonnes(e.target.value)} />
                  <input className="form-input" aria-label="Märkus" placeholder="Märkus" value={wNotes} onChange={(e) => setWNotes(e.target.value)} />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>Lisa</button>
                </form>
              )}

              <h4 style={{ marginTop: 16 }}>Kuivatuskulud</h4>
              <div className="register-table-wrap">
                <table className="register-table">
                  <thead>
                    <tr>
                      <th>Kuupäev</th><th>Artikkel</th><th className="num">Kogus</th><th className="num">Ühikuhind</th><th className="num">Summa</th>
                      <th className="actions-col"><span className="sr-only">Tegevused</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.costs.length === 0 && <tr><td colSpan={6} className="muted">Kuivatuskulusid pole.</td></tr>}
                    {lot.costs.map((c) => (
                      <tr key={c.id}>
                        <td>{formatDate(c.date)}</td>
                        <td>{c.articleName}</td>
                        <td className="num">{formatQty(c.quantity)} {c.unit}</td>
                        <td className="num">{c.unitPrice == null ? <span className="muted">hindamata</span> : fmtEur(c.unitPrice)}</td>
                        <td className="num">{c.total == null ? <span className="muted">hindamata</span> : fmtEur(c.total)}</td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <button type="button" className="icon-btn-danger" title="Kustuta" aria-label="Kustuta kuivatuskulu" disabled={busy}
                              onClick={() => void run(async () => { await api.deleteHarvestLotCost(lot.id, c.id); })}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form className="register-actions-bar" onSubmit={addCost}>
                <DateInput value={cDate} onChange={setCDate} className="form-input" required />
                <select className="form-input" aria-label="Artikkel" required value={cArticle} onChange={(e) => setCArticle(e.target.value)}>
                  <option value="">– artikkel –</option>
                  {dryingArticles.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.unit})</option>)}
                </select>
                <input className="form-input num" aria-label="Kogus" placeholder="Kogus" inputMode="decimal" required value={cQty} onChange={(e) => setCQty(e.target.value)} />
                <input className="form-input" aria-label="Märkus" placeholder="Märkus" value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>Lisa</button>
              </form>

              <div className="modal-footer" style={{ padding: 0, marginTop: 16 }}>
                {lot.entries.length === 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void removeLot()}>Kustuta partii</button>
                )}
                {closed
                  ? <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(async () => { await api.reopenHarvestLot(lot.id); })}>Ava uuesti</button>
                  : <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void closeLot()}>Sulge partii</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
