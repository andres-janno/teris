// src/components/MaterialStockCard.tsx — materjali laokaart: liikumised kuupäeva järjekorras, jooksev seis, maksumus
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, AlertTriangle } from 'lucide-react';
import { formatQty } from '../services/units';
import { api } from '../services/api';
import { formatDate } from '../services/dateFormat';
import { FilterClear } from './FilterClear';
import type { Material } from '../types/fieldWork';
import type { MaterialMovements, StockMovement, Warehouse } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';

const fmtQty = formatQty;
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });

const describe = (m: StockMovement) => {
  if (m.source === 'FIELD_WORK') return `${m.workTypeName} · ${m.fieldName}`;
  const kind = STOCK_DOC_KIND_LABEL[m.documentKind!];
  if (m.documentKind === 'RECEIPT') return [kind, m.supplierName, m.documentNo].filter(Boolean).join(' · ');
  if (m.documentKind === 'WRITE_OFF') return [kind, m.writeOffReason ? WRITE_OFF_REASON_LABEL[m.writeOffReason] : null, m.documentNo].filter(Boolean).join(' · ');
  return [kind, `${m.warehouseName} → ${m.toWarehouseName}`, m.documentNo].filter(Boolean).join(' · ');
};

interface Props {
  material: Material;
  warehouseId: string;
  warehouses: Warehouse[];
  canSeeMoney: boolean;
  onClose: () => void;
}

export const MaterialStockCard: React.FC<Props> = ({ material, warehouseId: initialWh, warehouses, canSeeMoney, onClose }) => {
  const [warehouseId, setWarehouseId] = useState(initialWh);
  const [data, setData] = useState<MaterialMovements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.getMaterialMovements(material.id, warehouseId || undefined)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Laokaardi laadimine ebaõnnestus'));
    return () => { alive = false; };
  }, [material.id, warehouseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up stock-card-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Package size={20} className="text-emerald" />
            <h3>Laokaart: {material.name}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="register-actions-bar">
            <FilterClear active={!!warehouseId} onClear={() => setWarehouseId('')}>
              <select className="form-input" aria-label="Ladu" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Kõik laod</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </FilterClear>
          </div>
          {error && <div className="alert-box error">{error}</div>}
          {data && data.issues.length > 0 && (
            <div className="alert-box warning">
              <AlertTriangle size={14} /> {data.issues.length} kannet on arvestusest väljas, sest nende ühikut ei saa laoühikusse ({data.unit}) teisendada:
              <ul>
                {data.issues.map((i) => <li key={i.entryId}>{formatDate(i.date)} · {i.workTypeName} · {i.fieldName} · {fmtQty(i.quantity)} {i.unit}</li>)}
              </ul>
            </div>
          )}
          <div className="register-table-wrap">
            <table className="register-table stock-card-table">
              <thead>
                <tr>
                  <th>Kuupäev</th>
                  <th>Liikumine</th>
                  {!warehouseId && <th>Ladu</th>}
                  <th className="num">Muutus ({data?.unit ?? material.unit})</th>
                  {warehouseId && <th className="num">Seis</th>}
                  {canSeeMoney && <th className="num">Maksumus</th>}
                </tr>
              </thead>
              <tbody>
                {data && data.movements.length === 0 && (
                  <tr><td colSpan={5} className="muted">Liikumisi pole.</td></tr>
                )}
                {data?.movements.map((m) => (
                  <tr key={m.ref}>
                    <td>{formatDate(m.date)}</td>
                    <td>
                      {describe(m)}
                      {!!m.shortageQty && <span className="material-overuse"> · puudu {fmtQty(m.shortageQty)}</span>}
                    </td>
                    {!warehouseId && <td>{m.kind === 'TRANSFER' ? `${m.warehouseName} → ${m.toWarehouseName}` : m.warehouseName}</td>}
                    <td className={`num stock-qty ${m.kind === 'TRANSFER' && !warehouseId ? '' : m.delta < 0 ? 'stock-qty-out' : m.delta > 0 ? 'stock-qty-in' : ''}`}>
                      {m.kind === 'TRANSFER' && !warehouseId ? fmtQty(m.quantity) : `${m.delta > 0 ? '+' : ''}${fmtQty(m.delta)}`}
                    </td>
                    {warehouseId && <td className={`num ${m.balance < 0 ? 'material-overuse' : ''}`}>{fmtQty(m.balance)}</td>}
                    {canSeeMoney && (
                      <td className="num">{m.cost == null ? <span className="muted" title="Ootab arvele võtmist">hindamata</span> : fmtEur(m.cost)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
