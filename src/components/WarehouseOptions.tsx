// src/components/WarehouseOptions.tsx — lao valiku read: tavalised laod ja põllu laod eraldi grupis
import type { Warehouse } from '../types/stock';
import type { SelectOption } from './ui';

// Sama loend Select-i ja filtri rippmenüü (FilterSelect) jaoks; tühi valik ja „Kõik laod“ lisatakse väljaspool.
// Rühmad näidatakse ainult siis, kui põllu ladusid on.
export const warehouseOptions = (warehouses: Warehouse[], opts?: { inactiveSuffix?: boolean }): SelectOption[] => {
  const hasFieldWarehouses = warehouses.some((w) => w.fieldId);
  return warehouses.filter((w) => !w.fieldId).concat(warehouses.filter((w) => w.fieldId)).map((w) => ({
    value: w.id,
    label: `${w.name}${opts?.inactiveSuffix && !w.isActive ? ' (mitteaktiivne)' : ''}`,
    group: hasFieldWarehouses ? (w.fieldId ? 'Põllu laod' : 'Laod') : undefined
  }));
};

export const warehouseFilterOptions = (warehouses: Warehouse[], inactiveSuffix?: boolean) => warehouseOptions(warehouses, { inactiveSuffix });
