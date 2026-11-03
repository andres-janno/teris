// src/components/WarehouseOptions.tsx — lao valiku read: tavalised laod ja põllu laod eraldi grupis
import React from 'react';
import type { Warehouse } from '../types/stock';

interface Props {
  warehouses: Warehouse[];
  inactiveSuffix?: boolean; // lisa mitteaktiivsele laole märge
}

export const WarehouseOptions: React.FC<Props> = ({ warehouses, inactiveSuffix }) => {
  const option = (w: Warehouse) => <option key={w.id} value={w.id}>{w.name}{inactiveSuffix && !w.isActive ? ' (mitteaktiivne)' : ''}</option>;
  const main = warehouses.filter((w) => !w.fieldId);
  const fields = warehouses.filter((w) => w.fieldId);
  if (!fields.length) return <>{main.map(option)}</>;
  return (
    <>
      <optgroup label="Laod">{main.map(option)}</optgroup>
      <optgroup label="Põllu laod">{fields.map(option)}</optgroup>
    </>
  );
};
