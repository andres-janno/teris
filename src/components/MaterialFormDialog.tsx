// src/components/MaterialFormDialog.tsx — kulumaterjali lisamine/muutmine (Materjalide leht ja Tööde register)
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import type { Material, MaterialCategory } from '../types/fieldWork';
import { MATERIAL_CATEGORY_LABEL } from '../types/fieldWork';

interface MaterialFormDialogProps {
  initial: Partial<Material>;
  onClose: () => void;
  onSaved: () => void;
}

export const MaterialFormDialog: React.FC<MaterialFormDialogProps> = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState<Partial<Material>>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveMaterial(form);
      onSaved();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Materjali salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up work-form-modal" onSubmit={save}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Edit2 size={20} className="text-emerald" />
            <h3>{form.id ? `Muuda materjali: ${initial.name}` : 'Lisa materjal'}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="mt-name">Nimi *</label>
              <input id="mt-name" className="form-input" required placeholder="nt YaraMila 16-27-7" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="mt-cat">Liik</label>
              <select id="mt-cat" className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MaterialCategory })}>
                {(Object.keys(MATERIAL_CATEGORY_LABEL) as MaterialCategory[]).map((c) => <option key={c} value={c}>{MATERIAL_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="mt-unit">Ühik *</label>
              <input id="mt-unit" className="form-input" required list="material-units" value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <datalist id="material-units"><option value="kg" /><option value="l" /><option value="t" /><option value="tk" /></datalist>
            </div>
            <div className="form-group full-width">
              <label htmlFor="mt-notes">Märkus</label>
              <input id="mt-notes" className="form-input" placeholder="nt ERP tootekood" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <label className="users-admin-checkbox full-width">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>Aktiivne (kannetes valitav)</span>
            </label>
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
