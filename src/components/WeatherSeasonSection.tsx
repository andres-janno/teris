// src/components/WeatherSeasonSection.tsx — põllu hooaja ilmakokkuvõte külvist koristuseni (või tänaseni) saagikuse kõrval,
// koos sama põllu eelmise viie aasta võrdlusega.
import React, { useEffect, useState } from 'react';
import { CloudSun } from 'lucide-react';
import { api } from '../services/api';
import type { WeatherSeasonReport, WeatherSeasonHistoryRow, WeatherSummary } from '../types/weather';
import { fmt0, fmt1, WEATHER_SOURCE } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

interface Props {
  fieldSeasonId: number | undefined;
  year?: number;
  crop?: string | null;
  actualYieldTonsHa?: number | null;
  onEditSeeding?: () => void;
}

const WeatherRow: React.FC<{ year: number; crop: string | null | undefined; sum: WeatherSummary; gddBaseC: number; yieldTonsHa: number | null | undefined; shifted?: boolean; current?: boolean }> = ({ year, crop, sum, gddBaseC, yieldTonsHa, shifted, current }) => (
  <TableRow tone={current ? undefined : 'muted'} className={current ? undefined : 'weather-season-past'}>
    <TableCell><span className="soil-year-cell">{year}{crop && <span className="weather-season-crop">{crop}</span>}</span></TableCell>
    <TableCell
      className={shifted ? 'weather-season-shifted' : undefined}
      title={shifted ? 'Selle aasta külvikuupäev puudub — kasutatud valitud hooaja kuupäevi' : undefined}
    >
      {formatDate(sum.from)} – {formatDate(sum.to)}
    </TableCell>
    <TableCell numeric className="soil-value" title={`Baas ${gddBaseC} °C`}>{fmt0(sum.gdd)}</TableCell>
    <TableCell numeric className="soil-value">{fmt0(sum.precipMm)}</TableCell>
    <TableCell numeric className="soil-value">{fmt0(sum.waterBalanceMm)}</TableCell>
    <TableCell numeric className="soil-value">{sum.longestDrySpell}</TableCell>
    <TableCell numeric className="soil-value">{sum.frostDays}</TableCell>
    <TableCell numeric className="soil-value">{yieldTonsHa != null ? fmt1(yieldTonsHa) : '—'}</TableCell>
  </TableRow>
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
        <>
          <Table dense bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Hooaeg</TableHead>
                <TableHead>Periood</TableHead>
                <TableHead numeric title="Temperatuurisumma kultuuri baastemperatuuriga">GDD</TableHead>
                <TableHead numeric>Sademed</TableHead>
                <TableHead numeric title="Sademed miinus potentsiaalne aurumine">Veebilanss</TableHead>
                <TableHead numeric title="Pikim järjestikuste kuivade päevade arv">Kuiv per.</TableHead>
                <TableHead numeric title="Öökülmapäevad 60 päeva jooksul pärast külvi">Öökülm</TableHead>
                <TableHead numeric>Saak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sum && year != null && rep && (
                <WeatherRow year={year} crop={crop} sum={sum} gddBaseC={rep.gddBaseC} yieldTonsHa={actualYieldTonsHa} current />
              )}
              {history.map((h) => (
                <WeatherRow key={h.year} year={h.year} crop={h.crop} sum={h.summary} gddBaseC={h.gddBaseC} yieldTonsHa={h.actualYieldTonsHa} shifted={!h.ownDates} />
              ))}
            </TableBody>
          </Table>
          <p className="soil-footnote">
            {sum && !sum.complete && sum.dataUntil && `Andmed kuni ${formatDate(sum.dataUntil)} · `}
            GDD °C kultuuri baastemperatuuriga · sademed ja veebilanss mm · kuiv periood ja öökülm päevi · saak t/ha
            {anyShifted && ' · kaldkirjas periood: selle aasta külvikuupäev puudub, kasutatud valitud hooaja kuupäevi'}
            {' · '}{WEATHER_SOURCE}
          </p>
        </>
      )}
    </div>
  );
};
