// src/components/FieldMapCard.tsx — kaardil valitud põllu väike infokast (nimi, pindala, kultuur, kiirlingid).
import React, { useEffect } from 'react';
import { X, Pencil, ListChecks } from 'lucide-react';
import type { FieldFeature } from '../types/field';
import { formatQty } from '../services/units';

interface FieldMapCardProps {
  field: FieldFeature;
  onClose: () => void;
  onOpenWorks: (field: FieldFeature) => void;
  onEditField: (fieldId: number) => void;
}

export const FieldMapCard: React.FC<FieldMapCardProps> = ({ field, onClose, onOpenWorks, onEditField }) => {
  // Esc sulgeb kasti; avatud dialoogid peatavad Esc-i document'is, nii et siia see ei jõua
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = field.properties;
  const hasCrop = !!p.crop && p.crop !== 'Määramata';

  return (
    <div className="field-map-card" role="region" aria-label={`Põld ${p.name}`}>
      <div className="fmc-header">
        <span className="crop-indicator-dot" style={{ backgroundColor: p.cropColor || '#22c55e' }} />
        {p.num && <span className="field-num-badge">Nr {p.num}</span>}
        <strong className="fmc-name" title={p.name}>{p.name}</strong>
        <button type="button" className="icon-btn-ghost fmc-close" onClick={onClose} title="Sulge (Esc)"><X size={16} /></button>
      </div>
      <div className="fmc-rows">
        <div className="fmc-row">
          <span className="muted">Pindala {p.year}</span>
          <span className="num"><strong>{formatQty(p.areaHa || 0)}</strong> ha</span>
        </div>
        <div className="fmc-row">
          <span className="muted">Kultuur</span>
          <span className="fmc-crop">
            {hasCrop ? p.crop : 'Määramata'}
            {hasCrop && p.cropVariety ? ` (${p.cropVariety})` : ''}
          </span>
        </div>
      </div>
      <div className="fmc-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenWorks(field)}><ListChecks size={14} /> Ava põllutööd</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditField(Number(p.id))}><Pencil size={14} /> Muuda põldu</button>
      </div>
    </div>
  );
};
