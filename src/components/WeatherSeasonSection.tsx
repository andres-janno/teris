// src/components/WeatherSeasonSection.tsx — põllu hooaja ilmakokkuvõte külvist koristuseni (või tänaseni) saagikuse kõrval.
import React, { useEffect, useState } from 'react';
import { CloudSun } from 'lucide-react';
import { api } from '../services/api';
import type { WeatherSeasonReport } from '../types/weather';
import { fmt0, fmt1, WEATHER_SOURCE } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';

export const WeatherSeasonSection: React.FC<{ fieldSeasonId: number | undefined; actualYieldTonsHa?: number | null; onEditSeeding?: () => void }> = ({ fieldSeasonId, actualYieldTonsHa, onEditSeeding }) => {
  const [rep, setRep] = useState<WeatherSeasonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRep(null);
    setError(null);
    if (!fieldSeasonId) return;
    // Hooaja vahetusel ignoreeritakse eelmise päringu hilinenud vastus
    let cancelled = false;
    api.getWeatherSeason(fieldSeasonId)
      .then((r) => { if (!cancelled) setRep(r); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [fieldSeasonId]);
  if (!fieldSeasonId) return null;
  const sum = rep?.summary;
  const toHarvest = rep?.harvested && sum?.dataUntil && sum.dataUntil >= sum.to;
  const hint = error
    ?? (rep?.reason === 'NO_SEEDING' ? 'Ilmakokkuvõte vajab külvikuupäeva.'
      : rep?.reason === 'NOT_STARTED' ? 'Külvist alates ilmaandmeid veel pole — need jõuavad umbes nädalase viitega.'
      : rep?.reason === 'INVALID_DATES' ? 'Koristuskuupäev on enne külvi — kontrolli kuupäevi.'
      : rep?.reason === 'LOADING' ? 'Ilmaandmeid laetakse.'
      : rep?.reason === 'NO_POINT' ? 'Põllul pole kuju, ilma ei saa siduda.'
      : null);
  return (
    <div className="detail-section">
      <div className="section-subtitle">
        <CloudSun size={14} />
        <span>Ilm külvist {toHarvest ? 'koristuseni' : 'tänaseni'}</span>
      </div>
      {hint && (
        <p className="notes-text">
          {hint}
          {rep?.reason === 'NO_SEEDING' && onEditSeeding && <> <button type="button" className="link-button" onClick={onEditSeeding}>Sisesta külvikuupäev</button></>}
        </p>
      )}
      {sum && (
        <div className="soil-table">
          <div className="soil-row soil-row-head weather-season-row">
            <span>Periood</span>
            <span title={`Temperatuurisumma, baas ${rep?.gddBaseC} °C`}>GDD</span>
            <span>Sademed</span>
            <span title="Sademed miinus potentsiaalne aurumine">Veebilanss</span>
            <span title="Pikim järjestikuste kuivade päevade arv">Kuiv per.</span>
            <span title="Öökülmapäevad 60 päeva jooksul pärast külvi">Öökülm</span>
            {actualYieldTonsHa != null && <span>Saak</span>}
          </div>
          <div className="soil-row weather-season-row">
            <span>{formatDate(sum.from)} – {formatDate(sum.to)}</span>
            <span className="soil-value">{fmt0(sum.gdd)}</span>
            <span className="soil-value">{fmt0(sum.precipMm)}</span>
            <span className="soil-value">{fmt0(sum.waterBalanceMm)}</span>
            <span className="soil-value">{sum.longestDrySpell}</span>
            <span className="soil-value">{sum.frostDays}</span>
            {actualYieldTonsHa != null && <span className="soil-value">{fmt1(actualYieldTonsHa)}</span>}
          </div>
          <div className="soil-footnote">
            {!sum.complete && sum.dataUntil && `Andmed kuni ${formatDate(sum.dataUntil)} · `}
            GDD °C (baas {rep?.gddBaseC} °C) · sademed ja veebilanss mm · kuiv periood ja öökülm päevi{actualYieldTonsHa != null && ' · saak t/ha'} · {WEATHER_SOURCE}
          </div>
        </div>
      )}
    </div>
  );
};
