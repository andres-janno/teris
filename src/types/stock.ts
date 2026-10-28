// src/types/stock.ts — laoarvestus: laod, laokanded, laokaart
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER';
export type WriteOffReason = 'SPOILED' | 'INVENTORY' | 'OTHER';

export const STOCK_DOC_KIND_LABEL: Record<StockDocumentKind, string> = {
  RECEIPT: 'Arvele võtmine',
  WRITE_OFF: 'Mahakandmine',
  TRANSFER: 'Ülekanne'
};

export const WRITE_OFF_REASON_LABEL: Record<WriteOffReason, string> = {
  SPOILED: 'Riknenud',
  INVENTORY: 'Inventuuri vahe',
  OTHER: 'Muu'
};

export interface Warehouse {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  poiId: string | null;
  poiName: string | null;
  notes: string | null;
}

export interface StockDocumentLine {
  id: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  amount: number | null;
  fifoCost: number | null;
  shortageQty: number | null;
}

export interface StockDocument {
  id: string;
  kind: StockDocumentKind;
  date: string;
  warehouseId: string;
  warehouseName: string;
  toWarehouseId: string | null;
  toWarehouseName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  documentNo: string | null;
  writeOffReason: WriteOffReason | null;
  notes: string | null;
  total: number;
  hasUnpriced: boolean;
  lines: StockDocumentLine[];
}

export interface StockDocumentInput {
  kind: StockDocumentKind;
  date: string;
  warehouseId: string;
  toWarehouseId?: string | null;
  supplierId?: string | null;
  documentNo?: string | null;
  writeOffReason?: WriteOffReason | null;
  notes?: string | null;
  lines: { materialId: string; quantity: string | number; amount?: string | number | null }[];
}

export interface StockDocumentFilter {
  kind?: StockDocumentKind | '';
  warehouseId?: string;
  supplierId?: string;
  from?: string;
  to?: string;
}

export interface StockMovement {
  ref: string;
  date: string;
  kind: 'IN' | 'TRANSFER' | 'OUT';
  quantity: number;
  delta: number;
  balance: number;
  warehouseName: string;
  toWarehouseName: string | null;
  cost?: number | null; // ainult finantsõigusega
  source: 'DOCUMENT' | 'FIELD_WORK';
  documentId?: string;
  documentKind?: StockDocumentKind;
  documentNo?: string | null;
  supplierName?: string | null;
  writeOffReason?: WriteOffReason | null;
  shortageQty?: number | null;
  entryId?: string;
  fieldName?: string;
  workTypeName?: string;
}

export interface MaterialMovements {
  unit: string;
  movements: StockMovement[]; // uuemad eespool
  issues: { entryId: string; date: string; quantity: number; unit: string; fieldName: string; workTypeName: string }[];
}

export interface StockLevel {
  materialId: string;
  qty: number;
}
