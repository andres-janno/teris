// src/components/WeatherSeasonSection.tsx — põllu hooaja ilmakokkuvõte külvist koristuseni (või tänaseni) saagikuse kõrval,
// koos sama põllu eelmise viie aasta võrdlusega.
import React, { useEffect, useState } from 'react';
import { CloudSun } from 'lucide-react';
import { api } from '../services/api';
import type { WeatherSeasonReport, WeatherSeasonHistoryRow, WeatherSummary } from '../types/weather';
import { fmt0, fmt1, WEATHER_SOURCE } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';
import { Button } from './ui';

interface Props {
  fieldSeasonId: number | undefined;
  year?: number;
  crop?: string | null;
  actualYieldTonsHa?: number | null;
  onEditSeeding?: () => void;
}

const WeatherRow: React.FC<{ year: number; crop: string | null | undefined; sum: WeatherSummary; gddBaseC: number; yieldTonsHa: number | null | undefined; shifted?: boolean; current?: boolean }> = ({ year, crop, sum, gddBaseC, yieldTonsHa, shifted, current }) => (
  <div className={`soil-row weather-season-row${current ? '' : ' weather-season-past'}`}>
    <span className="soil-year-cell">{year}{crop && <span className="weather-season-crop">{crop}</span>}</span>
    <span
      className={`weather-season-period${shifted ? ' weather-season-shifted' : ''}`}
      title={shifted ? 'Selle aasta külvikuupäev puudub — kasutatud valitud hooaja kuupäevi' : undefined}
    >
      {formatDate(sum.from)} – {formatDate(sum.to)}
    </span>
    <span className="soil-value" title={`Baas ${gddBaseC} °C`}>{fmt0(sum.gdd)}</span>
    <span className="soil-value">{fmt0(sum.precipMm)}</span>
    <span className="soil-value">{fmt0(sum.waterBalanceMm)}</span>
    <span className="soil-value">{sum.longestDrySpell}</span>
    <span className="soil-value">{sum.frostDays}</span>
    <span className="soil-value">{yieldTonsHa != null ? fmt1(yieldTonsHa) : '—'}</span>
  </div>
);

export const WeatherSeasonSection: React.FC<Props> = ({ fieldSeasonId, year, crop, actualYieldTonsHa, onEditSeeding }) => {
  const [rep, setRep] = useState<WeatherSeasonReport | null>(null);
  const [history, setHistory] = useState<WeatherSeasonHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRep(null);
    setHistory([]);
    setError(null);
    if (!fieldSeasonId) return;
    // Hooaja vahetusel ignoreeritakse eelmise päringu hilinenud vastus
    let cancelled = false;
    api.getWeatherSeason(fieldSeasonId)
      .then((r) => { if (!cancelled) setRep(r); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Ilmakokkuvõte pole saadaval'); });
    api.getWeatherSeasonHistory(fieldSeasonId)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [fieldSeasonId]);
  if (!fieldSeasonId) return null;
  const sum = rep?.summary;
  const toHarvest = rep?.harvested && sum?.dataUntil && sum.dataUntil >= sum.to;
  const hint = error
    ?? (rep?.reason === 'NO_SEEDING' ? 'Selle hooaja ilmakokkuvõte vajab külvikuupäeva.'
      : rep?.reason === 'NOT_STARTED' ? 'Külvist alates ilmaandmeid veel pole — need jõuavad umbes nädalase viitega.'
      : rep?.reason === 'INVALID_DATES' ? 'Koristuskuupäev on enne külvi — kontrolli kuupäevi.'
      : rep?.reason === 'LOADING' ? 'Ilmaandmeid laetakse.'
      : rep?.reason === 'NO_POINT' ? 'Põllul pole kuju, ilma ei saa siduda.'
      : null);
  const anyShifted = history.some((h) => !h.ownDates);
  return (
    <div className="detail-section">
      <div className="section-subtitle">
        <CloudSun size={14} />
        <span>Ilm külvist {toHarvest ? 'koristuseni' : 'tänaseni'}</span>
      </div>
      {hint && (
        <p className="notes-text">
          {hint}
          {rep?.reason === 'NO_SEEDING' && onEditSeeding && <> <Button variant="link" size="inline" onClick={onEditSeeding}>Sisesta külvikuupäev</Button></>}
        </p>
      )}
      {(sum || history.length > 0) && (
        <div className="soil-table">
          <div className="soil-row soil-row-head weather-season-row">
            <span>Hooaeg</span>
            <span className="weather-season-period">Periood</span>
            <span title="Temperatuurisumma kultuuri baastemperatuuriga">GDD</span>
            <span>Sademed</span>
            <span title="Sademed miinus potentsiaalne aurumine">Veebilanss</span>
            <span title="Pikim järjestikuste kuivade päevade arv">Kuiv per.</span>
            <span title="Öökülmapäevad 60 päeva jooksul pärast külvi">Öökülm</span>
            <span>Saak</span>
          </div>
          {sum && year != null && rep && (
            <WeatherRow year={year} crop={crop} sum={sum} gddBaseC={rep.gddBaseC} yieldTonsHa={actualYieldTonsHa} current />
          )}
          {history.map((h) => (
            <WeatherRow key={h.year} year={h.year} crop={h.crop} sum={h.summary} gddBaseC={h.gddBaseC} yieldTonsHa={h.actualYieldTonsHa} shifted={!h.ownDates} />
          ))}
          <div className="soil-footnote">
            {sum && !sum.complete && sum.dataUntil && `Andmed kuni ${formatDate(sum.dataUntil)} · `}
            GDD °C kultuuri baastemperatuuriga · sademed ja veebilanss mm · kuiv periood ja öökülm päevi · saak t/ha
            {anyShifted && ' · kaldkirjas periood: selle aasta külvikuupäev puudub, kasutatud valitud hooaja kuupäevi'}
            {' · '}{WEATHER_SOURCE}
          </div>
        </div>
      )}
    </div>
  );
};
