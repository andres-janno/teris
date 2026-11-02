// src/types/harvestLot.ts — saagipartiid: punkri kaalumine, kuivatuskulud, kandete tonnid
export type HarvestLotStatus = 'OPEN' | 'CLOSED';

export const HARVEST_LOT_STATUS_LABEL: Record<HarvestLotStatus, string> = { OPEN: 'Lahtine', CLOSED: 'Suletud' };

export interface HarvestLotSummary {
  id: string;
  name: string;
  seasonYear: number;
  cropId: string;
  cropName: string;
  articleId: string;
  articleName: string;
  warehouseId: string;
  warehouseName: string;
  status: HarvestLotStatus;
  bunkerTonnes: number | null;
  bunkers: number;
  weighedTonnes: number;
  entryCount: number;
  closedAt: string | null;
}

export interface HarvestLotEntry {
  id: string;
  date: string;
  fieldName: string;
  bunkers: number | null;
  manual: boolean;
  tonnes: number | null;
  financeStatus: string | null;
}

export interface HarvestLotWeighing {
  id: string;
  date: string;
  tonnes: number;
  notes: string | null;
}

export interface HarvestLotCost {
  id: string;
  date: string;
  articleId: string;
  articleName: string;
  unit: string;
  isService: boolean;
  quantity: number;
  notes: string | null;
  unitPrice: number | null;
  total: number | null;
}

export interface HarvestLotDetail extends HarvestLotSummary {
  notes: string | null;
  entries: HarvestLotEntry[];
  weighings: HarvestLotWeighing[];
  costs: HarvestLotCost[];
}

export interface HarvestLotInput {
  id?: string;
  name: string;
  year?: number; // ainult loomisel
  cropId?: string; // ainult loomisel
  warehouseId: string;
  notes?: string | null;
}
