// Ressursi (töötaja, masin, haakeriist) teenus, oma tunnihind ja masina vaikimisi kütus.
// Tunnihinda näeb ja muudab ainult finantsõigusega kasutaja.
import React from 'react';
import type { Article } from '../types/fieldWork';

interface ResourceCostFieldsProps {
  serviceKind: 'LABOR_TIME' | 'MACHINE_TIME' | 'IMPLEMENT_TIME';
  articles: Article[];
  serviceArticleId: string;
  onServiceChange: (id: string) => void;
  hourlyRate: string;
  onRateChange: (v: string) => void;
  canManageFinance: boolean;
  fuelArticleId?: string; // ainult masinal
  onFuelChange?: (id: string) => void;
}

export const ResourceCostFields: React.FC<ResourceCostFieldsProps> = ({
  serviceKind, articles, serviceArticleId, onServiceChange, hourlyRate, onRateChange, canManageFinance, fuelArticleId, onFuelChange
}) => {
  const services = articles.filter((a) => a.category.systemKind === serviceKind && (a.isActive || a.id === serviceArticleId));
  const defaultService = services.find((a) => a.isDefaultService);
  const fuels = articles.filter((a) => a.category.systemKind === 'FUEL' && (a.isActive || a.id === fuelArticleId));
  const activeFuels = fuels.filter((a) => a.isActive);
  const fuelFallback = activeFuels.length === 1 ? `Ainus kütus (${activeFuels[0].name})` : 'Määramata';
  return (
    <>
      <div className="form-group">
        <label htmlFor={`rc-service-${serviceKind}`}>Teenus</label>
        <select id={`rc-service-${serviceKind}`} className="form-input" value={serviceArticleId} onChange={(e) => onServiceChange(e.target.value)}>
          <option value="">{defaultService ? `Vaikimisi (${defaultService.name})` : 'Vaikimisi'}</option>
          {services.filter((a) => !a.isDefaultService).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {canManageFinance && (
        <div className="form-group">
          <label htmlFor={`rc-rate-${serviceKind}`} title="Tühi = teenuse hind">Oma tunnihind (€/h)</label>
          <input id={`rc-rate-${serviceKind}`} className="form-input num" inputMode="decimal" placeholder="teenuse hind" value={hourlyRate} onChange={(e) => onRateChange(e.target.value)} />
        </div>
      )}
      {onFuelChange && (
        <div className="form-group">
          <label htmlFor="rc-fuel">Vaikimisi kütus</label>
          <select id="rc-fuel" className="form-input" value={fuelArticleId ?? ''} onChange={(e) => onFuelChange(e.target.value)}>
            <option value="">{fuelFallback}</option>
            {fuels.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
    </>
  );
};

/** Tunnihinna tekst → number (tühi → null); koma lubatud. */
export const parseRate = (v: string): number | null => {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const rateText = (v: number | null | undefined): string => (v == null ? '' : String(v).replace('.', ','));
