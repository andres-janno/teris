// src/components/WeatherSeasonSection.tsx — põllu hooaja ilmakokkuvõte külvist koristuseni (või tänaseni) saagikuse kõrval.
import React, { useEffect, useState } from 'react';
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
  return (
    <section className="weather-season">
      <h4>Ilm külvist {rep?.harvested && rep.summary?.dataUntil && rep.summary.dataUntil >= rep.summary.to ? 'koristuseni' : 'tänaseni'}</h4>
      {error && <p className="hint">{error}</p>}
      {rep?.reason === 'NO_SEEDING' && (
        <p className="hint">Ilmakokkuvõte vajab külvikuupäeva.{onEditSeeding && <> <button type="button" className="link-button" onClick={onEditSeeding}>Sisesta külvikuupäev</button></>}</p>
      )}
      {rep?.reason === 'NOT_STARTED' && <p className="hint">Külv on tulevikus — ilmaandmeid veel pole.</p>}
      {rep?.reason === 'INVALID_DATES' && <p className="hint">Koristuskuupäev on enne külvi — kontrolli kuupäevi.</p>}
      {rep?.reason === 'LOADING' && <p className="hint">Ilmaandmeid laetakse.</p>}
      {rep?.reason === 'NO_POINT' && <p className="hint">Põllul pole kuju, ilma ei saa siduda.</p>}
      {rep?.summary && (
        <>
          <dl>
            <dt>Periood</dt><dd>{formatDate(rep.summary.from)} – {formatDate(rep.summary.to)}</dd>
            <dt>Temperatuurisumma (baas {rep.gddBaseC} °C)</dt><dd className="num">{fmt0(rep.summary.gdd)} °C</dd>
            <dt>Sademed</dt><dd className="num">{fmt0(rep.summary.precipMm)} mm</dd>
            <dt>Veebilanss</dt><dd className="num">{fmt0(rep.summary.waterBalanceMm)} mm</dd>
            <dt>Pikim kuiv periood</dt><dd className="num">{rep.summary.longestDrySpell} p</dd>
            <dt>Öökülmi 60 päeva jooksul pärast külvi</dt><dd className="num">{rep.summary.frostDays}</dd>
            {actualYieldTonsHa != null && <><dt>Saak</dt><dd className="num">{fmt1(actualYieldTonsHa)} t/ha</dd></>}
          </dl>
          <p className="hint">{!rep.summary.complete && rep.summary.dataUntil && `Andmed kuni ${formatDate(rep.summary.dataUntil)}. `}{WEATHER_SOURCE}.</p>
        </>
      )}
    </section>
  );
};
