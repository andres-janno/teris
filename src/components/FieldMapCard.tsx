// src/components/FieldMapCard.tsx — kaardil valitud põllu väike infokast (nimi, pindala, kultuur, kiirlingid).
import { DEFAULT_VEHICLE_COLOR } from '../lib/dataColors';
import React, { useEffect } from 'react';
import { X, Pencil, ListChecks } from 'lucide-react';
import type { FieldFeature } from '../types/field';
import { formatQty } from '../services/units';
import { Badge, Card, Button, KeyValueRow } from './ui';

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
    <Card variant="floating" padding="sm" className="relative flex w-75 flex-col gap-2" role="region" aria-label={`Põld ${p.name}`}>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: p.cropColor || DEFAULT_VEHICLE_COLOR }} />
        {p.num && <Badge tone="success" variant="outline" size="md" className="num">Nr {p.num}</Badge>}
        <strong className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</strong>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Sulge (Esc)"><X size={16} /></Button>
      </div>
      <div className="flex flex-col gap-1 text-base">
        <KeyValueRow label={`Pindala ${p.year}`}><strong>{formatQty(p.areaHa || 0)}</strong> ha</KeyValueRow>
        <KeyValueRow label="Kultuur">{hasCrop ? p.crop : 'Määramata'}{hasCrop && p.cropVariety ? ` (${p.cropVariety})` : ''}</KeyValueRow>
      </div>
      <div className="flex gap-2 [&>button]:flex-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenWorks(field)}><ListChecks size={14} /> Ava põllutööd</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onEditField(Number(p.id))}><Pencil size={14} /> Muuda põldu</Button>
      </div>
    </Card>
  );
};
