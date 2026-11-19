// src/components/ArticleStockCard.tsx — materjali laokaart: liikumised kuupäeva järjekorras, jooksev seis, maksumus
import React, { useEffect, useState } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { formatQty } from '../services/units';
import { api } from '../services/api';
import { formatDate } from '../services/dateFormat';
import { warehouseFilterOptions } from './WarehouseOptions';
import type { Article } from '../types/fieldWork';
import type { ArticleMovements, StockMovement, Warehouse } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';
import { Alert, Dialog, DialogBody, DialogContent, DialogHeader, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, FilterClear, FilterSelect } from './ui';

const fmtQty = formatQty;
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });

const describe = (m: StockMovement) => {
  if (m.source === 'FIELD_WORK') return `${m.workTypeName} · ${m.fieldName}`;
  if (m.source === 'HARVEST_LOT') return `${m.lotMovement === 'WEIGHING' ? 'Kaalumine' : 'Kuivatuskulu'} · ${m.lotName}`;
  const kind = STOCK_DOC_KIND_LABEL[m.documentKind!];
  if (m.documentKind === 'RECEIPT') return [kind, m.supplierName, m.documentNo].filter(Boolean).join(' · ');
  if (m.documentKind === 'WRITE_OFF') return [kind, m.writeOffReason ? WRITE_OFF_REASON_LABEL[m.writeOffReason] : null, m.documentNo].filter(Boolean).join(' · ');
  if (m.documentKind === 'INVENTORY') return [kind, m.countedQty != null ? `loetud ${fmtQty(m.countedQty)}` : null, m.documentNo].filter(Boolean).join(' · ');
  return [kind, `${m.warehouseName} → ${m.toWarehouseName}`, m.documentNo].filter(Boolean).join(' · ');
};

interface Props {
  article: Article;
  warehouseId: string;
  warehouses: Warehouse[];
  canSeeMoney: boolean;
  onClose: () => void;
}

export const ArticleStockCard: React.FC<Props> = ({ article, warehouseId: initialWh, warehouses, canSeeMoney, onClose }) => {
  const [warehouseId, setWarehouseId] = useState(initialWh);
  const [data, setData] = useState<ArticleMovements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.getArticleMovements(article.id, warehouseId || undefined)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Laokaardi laadimine ebaõnnestus'));
    return () => { alive = false; };
  }, [article.id, warehouseId]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg" className="stock-card-modal">
        <DialogHeader icon={<Package size={20} />} title={`Laokaart: ${article.name}`} />
        <DialogBody>
          <div className="register-actions-bar">
            <FilterClear active={!!warehouseId} onClear={() => setWarehouseId('')}>
              <FilterSelect ariaLabel="Ladu" value={warehouseId} onChange={setWarehouseId}
                options={[{ value: '', label: 'Kõik laod' }, ...warehouseFilterOptions(warehouses)]} />
            </FilterClear>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          {data && data.issues.length > 0 && (
            <Alert>
              <AlertTriangle size={14} /> {data.issues.length} kannet on arvestusest väljas, sest nende ühikut ei saa laoühikusse ({data.unit}) teisendada:
              <ul>
                {data.issues.map((i) => <li key={i.entryId}>{formatDate(i.date)} · {i.workTypeName} · {i.fieldName} · {fmtQty(i.quantity)} {i.unit}</li>)}
              </ul>
            </Alert>
          )}
          <Table scroll="md" bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Kuupäev</TableHead>
                <TableHead>Liikumine</TableHead>
                {!warehouseId && <TableHead>Ladu</TableHead>}
                <TableHead numeric>Muutus ({data?.unit ?? article.unit})</TableHead>
                {warehouseId && <TableHead numeric>Seis</TableHead>}
                {canSeeMoney && <TableHead numeric>Maksumus</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.movements.length === 0 && (
                <TableEmpty colSpan={4 + (canSeeMoney ? 1 : 0)}>Liikumisi pole.</TableEmpty>
              )}
              {data?.movements.map((m) => (
                <TableRow key={m.ref}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell wrap>
                    {describe(m)}
                    {!!m.shortageQty && <span className="article-overuse"> · puudu {fmtQty(m.shortageQty)}</span>}
                  </TableCell>
                  {!warehouseId && <TableCell wrap>{m.kind === 'TRANSFER' ? `${m.warehouseName} → ${m.toWarehouseName}` : m.warehouseName}</TableCell>}
                  <TableCell numeric className={`stock-qty ${m.kind === 'TRANSFER' && !warehouseId ? '' : m.delta < 0 ? 'stock-qty-out' : m.delta > 0 ? 'stock-qty-in' : ''}`}>
                    {m.kind === 'TRANSFER' && !warehouseId ? fmtQty(m.quantity) : `${m.delta > 0 ? '+' : ''}${fmtQty(m.delta)}`}
                  </TableCell>
                  {warehouseId && <TableCell numeric className={m.balance < 0 ? 'article-overuse' : ''}>{fmtQty(m.balance)}</TableCell>}
                  {canSeeMoney && (
                    <TableCell numeric>{m.cost == null ? <span className="muted" title="Ootab arvele võtmist">hindamata</span> : fmtEur(m.cost)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
