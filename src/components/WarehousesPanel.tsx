// src/components/WarehousesPanel.tsx — ladude register (finantsjuht ja admin): nimi, põhiladu, aktiivsus, asukoht kaardil
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import type { PointOfInterest } from '../types/poi';
import type { Warehouse } from '../types/stock';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  warehouses: Warehouse[];
  onChanged: () => void;
}

export const WarehousesPanel: React.FC<Props> = ({ warehouses, onChanged }) => {
  const [form, setForm] = useState<Partial<Warehouse> | null>(null);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getPois().then(setPois).catch(() => setPois([]));
  }, []);

  useEffect(() => {
    if (!form) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setForm(null); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [form]);

  // Laohooned eespool; juba teise laoga seotud huvipunktid välja
  const takenPoi = new Set(warehouses.filter((w) => w.id !== form?.id && w.poiId).map((w) => w.poiId));
  const poiOptions = pois
    .filter((p) => !takenPoi.has(p.id))
    .sort((a, b) => Number(b.category === 'warehouse') - Number(a.category === 'warehouse') || a.name.localeCompare(b.name, 'et'));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await api.saveWarehouse(form);
      setForm(null);
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (w: Warehouse) => {
    if (!(await confirmDialog(`Kas kustutan lao "${w.name}"?`))) return;
    try {
      await api.deleteWarehouse(w.id);
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  return (
    <>
      <div className="register-actions-bar">
        <div className="register-io-buttons">
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ isActive: true, isDefault: false })}><Plus size={14} /><span>Lisa ladu</span></button>
        </div>
      </div>
      <div className="register-table-wrap">
        <table className="register-table">
          <thead>
            <tr>
              <th>Ladu</th>
              <th>Asukoht</th>
              <th>Märkus</th>
              <th className="actions-col"><span className="sr-only">Tegevused</span></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className={w.isActive ? '' : 'inactive'}>
                <td className="name-cell">
                  <span className="field-name">{w.name}</span>
                  {w.isDefault && <span className="users-admin-badge">Põhiladu</span>}
                  {!w.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                </td>
                <td>{w.poiName ? <><MapPin size={13} /> {w.poiName}</> : <span className="muted">–</span>}</td>
                <td className="muted">{w.notes ?? ''}</td>
                <td className="actions-col">
                  <div className="row-actions">
                    <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setForm(w)}><Edit2 size={15} /></button>
                    {!w.isDefault && <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" onClick={() => remove(w)}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && createPortal(
        <div className="modal-backdrop sub-modal">
          <form className="modal-content animate-scale-up work-form-modal" onSubmit={save}>
            <div className="modal-header">
              <div className="modal-title-group">
                <WarehouseIcon size={20} className="text-emerald" />
                <h3>{form.id ? `Muuda ladu: ${form.name}` : 'Lisa ladu'}</h3>
              </div>
              <button type="button" className="icon-btn-ghost" onClick={() => setForm(null)} title="Sulge (Esc)"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="wh-name">Nimi *</label>
                  <input id="wh-name" className="form-input" required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="wh-poi">Asukoht kaardil (huvipunkt)</label>
                  <select id="wh-poi" className="form-input" value={form.poiId ?? ''} onChange={(e) => setForm({ ...form, poiId: e.target.value || null })}>
                    <option value="">– pole –</option>
                    {poiOptions.map((p) => <option key={p.id} value={p.id}>{p.name}{p.category === 'warehouse' ? ' (laohoone)' : ''}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="wh-notes">Märkus</label>
                  <input id="wh-notes" className="form-input" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={form.isDefault ?? false} disabled={!!warehouses.find((w) => w.id === form.id)?.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked, isActive: e.target.checked ? true : form.isActive })} />
                  <span>Põhiladu (põllutöö kannete vaikimisi ladu)</span>
                </label>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={form.isActive ?? true} disabled={form.isDefault} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <span>Aktiivne (kannetes valitav)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Loobu</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
};
