// src/components/FieldOperationsSection.tsx
import React, { useEffect, useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { FieldOperationsResponse, FieldOperationProductDto } from '../types/fieldOperation';
import { api } from '../services/api';

interface FieldOperationsSectionProps {
  fieldId: number | string;
  year: number;
  fill?: boolean; // ajatelg täidab vanema kõrguse (keskmine aken), mitte ei piirdu 320 px-ga
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

const productLine = (p: FieldOperationProductDto) => {
  const parts = [p.name, p.kind, p.spec].filter(Boolean) as string[];
  if (p.amount !== null) parts.push(`${fmtNum(p.amount)}${p.unit ? ` ${p.unit}` : ''}`);
  const npk = [p.nKgHa !== null ? `N ${fmtNum(p.nKgHa)}` : '', p.pKgHa !== null ? `P ${fmtNum(p.pKgHa)}` : '', p.kKgHa !== null ? `K ${fmtNum(p.kKgHa)}` : '']
    .filter(Boolean)
    .join(' ');
  if (npk) parts.push(npk);
  if (p.activeIngredient) parts.push(`toimeaine ${p.activeIngredient}`);
  return parts.join(' · ');
};

export const FieldOperationsSection: React.FC<FieldOperationsSectionProps> = ({ fieldId, year, fill = false }) => {
  const [data, setData] = useState<FieldOperationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    api
      .getFieldOperations(fieldId, year)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Laadimine ebaõnnestus'));
    return () => {
      active = false;
    };
  }, [fieldId, year]);

  const toggleNotes = (id: number) =>
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ops = data?.operations ?? [];
  const nTotal = ops.reduce((sum, o) => sum + o.products.reduce((s, p) => s + (p.nKgHa ?? 0), 0), 0);
  const summary = [
    `${ops.length} tegevust`,
    nTotal > 0 ? `N ${Math.round(nTotal)} kg/ha` : '',
    data?.actualYieldTonsHa != null || data?.targetYieldTonsHa != null
      ? `saak ${data?.actualYieldTonsHa != null ? fmtNum(data.actualYieldTonsHa) : '–'} / ${data?.targetYieldTonsHa != null ? fmtNum(data.targetYieldTonsHa) : '–'} t/ha`
      : ''
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`detail-section${fill ? ' field-ops-fill' : ''}`}>
      <div className="section-subtitle">
        <ClipboardList size={14} />
        <span>Põllutööd {year}</span>
      </div>

      {error && <p className="notes-text">{error}</p>}
      {!error && !data && <p className="notes-text">Laadin...</p>}
      {data && ops.length === 0 && <p className="notes-text">Selle hooaja põllutöid pole imporditud.</p>}

      {ops.length > 0 && (
        <>
          <div className="field-op-summary">{summary}</div>
          <ul className={`field-ops-list${fill ? ' field-ops-list-fill' : ''}`}>
            {ops.map((op) => (
              <li key={op.id} className="field-op-item">
                <div className="field-op-head">
                  <span className="field-op-date">{op.dateTo ? `${fmtDate(op.dateFrom)} – ${fmtDate(op.dateTo)}` : fmtDate(op.dateFrom)}</span>
                  <span className="field-op-type">{op.type}</span>
                </div>
                {(op.method || op.performerName) && (
                  <div className="field-op-meta">{[op.method, op.performerName].filter(Boolean).join(' · ')}</div>
                )}
                {op.products.map((p) => (
                  <div key={p.id} className="field-op-product">{productLine(p)}</div>
                ))}
                {op.notes && (
                  <button type="button" className="field-op-notes-toggle" onClick={() => toggleNotes(op.id)}>
                    {openNotes.has(op.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    <span>Märkused</span>
                  </button>
                )}
                {op.notes && openNotes.has(op.id) && <div className="field-op-notes">{op.notes}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
