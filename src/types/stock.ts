// src/types/stock.ts — laoarvestus: laod, laokanded, laokaart
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' | 'INVENTORY';
export type WriteOffReason = 'SPOILED' | 'INVENTORY' | 'SOLD' | 'OTHER';

export const STOCK_DOC_KIND_LABEL: Record<StockDocumentKind, string> = {
  RECEIPT: 'Arvele võtmine',
  WRITE_OFF: 'Mahakandmine',
  TRANSFER: 'Ülekanne',
  INVENTORY: 'Inventuur'
};

export const WRITE_OFF_REASON_LABEL: Record<WriteOffReason, string> = {
  SPOILED: 'Riknenud',
  INVENTORY: 'Inventuuri vahe',
  SOLD: 'Müük',
  OTHER: 'Muu'
};

export interface Warehouse {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  fieldId: number | null; // põllu ladu (koristatud punkrid); muul laol null
  poiId: string | null;
  poiName: string | null;
  notes: string | null;
}

export interface StockDocumentLine {
  id: string;
  articleId: string;
  articleName: string;
  unit: string;
  quantity: number;
  amount: number | null;
  fifoCost: number | null;
  shortageQty: number | null;
  countedQty: number | null; // inventuur: tegelik seis
  diffQty: number | null; // inventuur: vahe (+ juurde, − maha)
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
  hasShortage: boolean; // ülekanne, millel mõni rida võttis rohkem kui lähtelaos hinnaga oli
  lines: StockDocumentLine[];
  inventoryNotice?: string | null; // salvestuse vastuses: kanne muudab inventuuri vahet
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
  lines: { articleId: string; quantity?: string | number; amount?: string | number | null; countedQty?: string | number | null }[];
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
  kind: 'IN' | 'TRANSFER' | 'OUT' | 'COUNT';
  quantity: number;
  delta: number;
  balance: number;
  warehouseName: string;
  toWarehouseName: string | null;
  cost?: number | null; // ainult finantsõigusega
  source: 'DOCUMENT' | 'FIELD_WORK' | 'HARVEST_LOT';
  documentId?: string;
  documentKind?: StockDocumentKind;
  documentNo?: string | null;
  supplierName?: string | null;
  writeOffReason?: WriteOffReason | null;
  shortageQty?: number | null;
  countedQty?: number; // inventuur: tegelik seis
  entryId?: string;
  fieldName?: string;
  workTypeName?: string;
  lotId?: string;
  lotName?: string;
  lotMovement?: 'WEIGHING' | 'COST'; // kaalumine (hinnata) või kuivatuskulu
}

export interface ArticleMovements {
  unit: string;
  movements: StockMovement[]; // uuemad eespool
  issues: { entryId: string; date: string; quantity: number; unit: string; fieldName: string; workTypeName: string }[];
}

export interface StockLevel {
  articleId: string;
  qty: number;
}

/** Inventuuri vormi rida: arvestuslik seis kuupäeva lõpus ja ülejäägi eeldatav ühikuhind. */
export interface InventoryPreviewRow {
  articleId: string;
  articleName: string;
  unit: string;
  bookQty: number;
  unitPrice: number | null;
}
