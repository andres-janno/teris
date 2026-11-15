// Ressursi (töötaja, masin, haakeriist) teenus, oma tunnihind ja masina vaikimisi kütus.
// Tunnihinda näeb ja muudab ainult finantsõigusega kasutaja.
import React from 'react';
import type { Article } from '../types/fieldWork';
import { Field, NumberInput, Select } from './ui';

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
      <Field label="Teenus" htmlFor={`rc-service-${serviceKind}`}>
        <Select
          id={`rc-service-${serviceKind}`}
          value={serviceArticleId}
          onValueChange={onServiceChange}
          options={[
            { value: '', label: defaultService ? `Vaikimisi (${defaultService.name})` : 'Vaikimisi' },
            ...services.filter((a) => !a.isDefaultService || a.id === serviceArticleId).map((a) => ({ value: a.id, label: a.name }))
          ]}
        />
      </Field>
      {canManageFinance && (
        <Field label={<span title="Tühi = teenuse hind">Oma tunnihind (€/h)</span>} htmlFor={`rc-rate-${serviceKind}`}>
          {/* Kutsujad hoiavad hinda tekstina (parseRate/rateText), seega sild siin: arv ↔ tekst, salvestatav väärtus sama */}
          <NumberInput
            id={`rc-rate-${serviceKind}`}
            decimals={4}
            placeholder="teenuse hind"
            value={parseRate(hourlyRate)}
            onChange={(n) => onRateChange(rateText(n))}
          />
        </Field>
      )}
      {onFuelChange && (
        <Field label="Vaikimisi kütus" htmlFor="rc-fuel">
          <Select
            id="rc-fuel"
            value={fuelArticleId ?? ''}
            onValueChange={onFuelChange}
            options={[{ value: '', label: fuelFallback }, ...fuels.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </Field>
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

/** Tühi tekst on lubatud (= teenuse hind); muidu peab olema lõplik arv vahemikus 0 ≤ x < 1e8. */
export const isRateTextValid = (v: string): boolean => {
  if (!v.trim()) return true;
  const n = parseRate(v);
  return n != null && n >= 0 && n < 1e8;
};

export const rateText = (v: number | null | undefined): string => (v == null ? '' : String(v).replace('.', ','));
