// src/components/MaterialMergeDialog.tsx — kulumaterjali asendamine teisega (nt PRIA kirjaviga "Stabilan 750SL" → "Stabilan 750 SL")
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitMerge, X } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import type { Material } from '../types/fieldWork';
import { MATERIAL_CATEGORY_LABEL } from '../types/fieldWork';

// Võrdlusvõti: tõstutundetu, tühikute ja kirjavahemärkideta ("Stabilan 750SL" = "Stabilan 750 SL")
const looseKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

interface Props {
  source: Material;
  materials: Material[];
  onClose: () => void;
  onMerged: () => void;
}

export const MaterialMergeDialog: React.FC<Props> = ({ source, materials, onClose, onMerged }) => {
  // Sama liigi materjalid; sarnase nimega eespool
  const options = useMemo(() => {
    const key = looseKey(source.name);
    const similar = (m: Material) => {
      const k = looseKey(m.name);
      return k === key || k.startsWith(key) || key.startsWith(k) ? 0 : 1;
    };
    return materials
      .filter((m) => m.id !== source.id && m.category === source.category)
      .sort((a, b) => similar(a) - similar(b) || a.name.localeCompare(b.name, 'et'));
  }, [materials, source]);
  const [targetId, setTargetId] = useState(() => {
    const first = options[0];
    return first && looseKey(first.name) === looseKey(source.name) ? first.id : '';
  });
  const [busy, setBusy] = useState(false);
  const target = options.find((m) => m.id === targetId);

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

  const merge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      const r = await api.mergeMaterial(source.id, target.id);
      await alertDialog(`Asendatud: ${r.plans} plaanirida, ${r.entries} kanderida, ${r.stockLines} laokande rida. "${source.name}" on kustutatud.`);
      onMerged();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Materjali asendamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up work-form-modal" onSubmit={merge}>
        <div className="modal-header">
          <div className="modal-title-group">
            <GitMerge size={20} className="text-emerald" />
            <h3>Asenda materjal: {source.name}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="mm-target">Asenda materjaliga *</label>
            <select id="mm-target" className="form-input" required autoFocus value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="" disabled>– vali {MATERIAL_CATEGORY_LABEL[source.category].toLowerCase()} –</option>
              {options.map((m) => <option key={m.id} value={m.id}>{m.name}{m.unit !== source.unit ? ` (${m.unit})` : ''}</option>)}
            </select>
          </div>
          <p className="muted material-merge-info">
            Kõigis töödes, kannetes ja laokannetes pannakse „{source.name}“ asemele {target ? `„${target.name}“` : 'valitud materjal'}.
            „{source.name}“ kustutatakse ja tema nimi jääb valitud materjalile varunimeks, et PRIA uuesti importimisel seotaks see kohe õige materjaliga.
            {target && target.unit !== source.unit && ` Ühikud erinevad (${source.unit} → ${target.unit}): laokannete kogused teisendatakse, kannete kogused jäävad oma ühikusse.`}
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !target}>Asenda</button>
        </div>
      </form>
    </div>,
    document.body
  );
};
