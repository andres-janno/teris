// src/components/MaterialFormDialog.tsx — kulumaterjali lisamine/muutmine (Materjalide leht ja Tööde register)
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { Material, MaterialCategory } from '../types/fieldWork';
import { MATERIAL_CATEGORY_LABEL } from '../types/fieldWork';

// Tekstiväli kasvab sisu järgi; field-sizing'ut mittetoetavas brauseris seatakse kõrgus käsitsi
const autoGrow = (el: HTMLTextAreaElement | null) => {
  if (!el || CSS.supports('field-sizing', 'content')) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, 320)}px`;
};

// Kordusteta (tõstutundetult) ja tähestiku järjekorras
const distinctValues = (values: (string | null | undefined)[]) => {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const v = raw?.trim();
    if (v && !byKey.has(v.toLowerCase())) byKey.set(v.toLowerCase(), v);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'et'));
};

interface MaterialFormDialogProps {
  initial: Partial<Material>;
  onClose: () => void;
  onSaved: () => void;
}

export const MaterialFormDialog: React.FC<MaterialFormDialogProps> = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState<Partial<Material>>(initial);
  const [busy, setBusy] = useState(false);
  // Tootja ja ühiku valikud: teistel materjalidel kasutatud väärtused; uus väärtus lisandub salvestamisel
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);

  useEffect(() => {
    api.getMaterials()
      .then((ms) => {
        setManufacturers(distinctValues(ms.map((m) => m.manufacturer)));
        setUnits(distinctValues(ms.map((m) => m.unit)));
      })
      .catch(() => {
        setManufacturers([]);
        setUnits([]);
      });
  }, []);

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
      try {
        await api.saveMaterial(form);
      } catch (err: any) {
        if (!err?.body?.needsConfirm) throw err;
        if (!(await confirmDialog(`${err.message} Kas muudan ühiku ikkagi?`))) return;
        await api.saveMaterial(form, true);
      }
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
            <div className="form-group full-width">
              <label htmlFor="mt-manufacturer">Tootja</label>
              <input id="mt-manufacturer" className="form-input" list="material-manufacturers" placeholder="vali olemasolev või sisesta uus" value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              <datalist id="material-manufacturers">{manufacturers.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="form-group">
              <label htmlFor="mt-cat">Liik *</label>
              <select id="mt-cat" className="form-input" required value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value as MaterialCategory })}>
                <option value="" disabled>– vali –</option>
                {(Object.keys(MATERIAL_CATEGORY_LABEL) as MaterialCategory[]).map((c) => <option key={c} value={c}>{MATERIAL_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="mt-unit">Ühik *</label>
              <input id="mt-unit" className="form-input" required list="material-units" placeholder="vali olemasolev või sisesta uus" value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <datalist id="material-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <div className="form-group full-width">
              <label htmlFor="mt-composition">Koostisosad</label>
              <textarea id="mt-composition" ref={autoGrow} rows={2} className="form-input auto-resize-textarea" placeholder="nt toimeained ja sisaldus, N-P-K" value={form.composition ?? ''} onChange={(e) => { autoGrow(e.target); setForm({ ...form, composition: e.target.value }); }} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="mt-notes">Märkus</label>
              <textarea id="mt-notes" ref={autoGrow} rows={2} className="form-input auto-resize-textarea" placeholder="nt ERP tootekood" value={form.notes ?? ''} onChange={(e) => { autoGrow(e.target); setForm({ ...form, notes: e.target.value }); }} />
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
