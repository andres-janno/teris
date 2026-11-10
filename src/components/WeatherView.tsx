// src/components/WeatherView.tsx — majandi ilmavaade: aastate võrdlus (01.04–31.08), kuude jaotus ja kumulatiivne graafik.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { WeatherPointInfo, WeatherYears, WeatherMonth, WeatherCumulativeSeries, WeatherPointRef } from '../types/weather';
import { deviation, fmt0, fmt1, WEATHER_SOURCE } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';
import { FilterClear } from './FilterClear';
import { FilterSelect } from './FilterSelect';
import { MonthBars, CumulativeLines } from './WeatherCharts';

const BASES = [0, 5, 6, 8, 10];

export const WeatherView: React.FC = () => {
  const [points, setPoints] = useState<WeatherPointInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [point, setPoint] = useState<WeatherPointRef>('all');
  const [base, setBase] = useState(5);
  const [data, setData] = useState<WeatherYears | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [months, setMonths] = useState<WeatherMonth[]>([]);
  const [compare, setCompare] = useState<number[]>([]);
  const [series, setSeries] = useState<WeatherCumulativeSeries[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getWeatherPoints().then((r) => { setPoints(r.points); setLoading(r.loading); }).catch((e) => setError(e.message)); }, []);
  // Iga päring: viga puhastatakse alguses ja hilinenud vastus (vana valik) ignoreeritakse
  useEffect(() => {
    setError(null);
    let cancelled = false;
    api.getWeatherYears(point, base).then((r) => {
      if (cancelled) return;
      setData(r);
      const last = r.years[r.years.length - 1]?.year ?? null;
      setYear((y) => y ?? last);
      setCompare((c) => (c.length ? c : r.years.slice(-3).map((x) => x.year)));
    }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [point, base]);
  useEffect(() => {
    if (!year) return;
    setError(null);
    let cancelled = false;
    api.getWeatherMonths(year, point, base).then((r) => { if (!cancelled) setMonths(r); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [year, point, base]);
  useEffect(() => {
    if (!compare.length) { setSeries([]); return; }
    setError(null);
    let cancelled = false;
    api.getWeatherCumulative(compare, point, base).then((r) => { if (!cancelled) setSeries(r); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [compare, point, base]);

  const rows = useMemo(() => [...(data?.years ?? [])].reverse(), [data]);
  const toggleCompare = (y: number) => setCompare((c) => (c.includes(y) ? c.filter((x) => x !== y) : [...c, y].sort()));

  return (
    <div className="weather-view">
      <div className="weather-toolbar">
        <h2>Ilm</h2>
        <FilterClear active={point !== 'all'} onClear={() => setPoint('all')}>
          <FilterSelect style={{ fontSize: '13px', height: '34px' }} ariaLabel="Ilmapunkt" value={String(point)} onChange={(v) => setPoint(v === 'all' ? 'all' : Number(v))}
            options={[{ value: 'all', label: 'Majandi keskmine' }, ...points.map((p) => ({ value: String(p.id), label: `${p.lat.toFixed(1)}° N, ${p.lon.toFixed(1)}° E (${p.fieldCount} põldu)` }))]} />
        </FilterClear>
        <FilterClear active={base !== 5} onClear={() => setBase(5)}>
          <FilterSelect style={{ fontSize: '13px', height: '34px' }} ariaLabel="GDD baastemperatuur" value={String(base)} onChange={(v) => setBase(Number(v))}
            options={BASES.map((b) => ({ value: String(b), label: `GDD baas ${b} °C` }))} />
        </FilterClear>
      </div>

      {error && <div className="alert-box error">{error}</div>}
      {loading && <div className="alert-box info">Ilmaandmeid laetakse — esmalaadimine võtab kuni mõne tunni.</div>}

      <section className="weather-section">
        <h3>Aastad (01.04–31.08)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table weather-years">
            <thead>
              <tr>
                <th>Aasta</th>
                <th className="num-col">Sademed, mm</th>
                <th className="num-col">GDD, °C</th>
                <th className="num-col">Veebilanss, mm</th>
                <th className="num-col">Pikim kuiv periood, p</th>
                <th className="num-col">Kuumapäevi</th>
                <th className="num-col">Öökülmi (apr–juuni)</th>
                <th>Võrdle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ year: y, summary: s }) => (
                <tr key={y} className={y === year ? 'selected' : ''} onClick={() => setYear(y)}>
                  <td>{y}{!s.complete && <span className="hint"> (kuni {formatDate(s.dataUntil)})</span>}</td>
                  <td className={`num weather-${deviation(s.precipMm, data?.normal.precipMm, data?.sd.precipMm, 'precip') ?? 'normal'}`}>{fmt0(s.precipMm)}</td>
                  <td className={`num weather-${deviation(s.gdd, data?.normal.gdd, data?.sd.gdd, 'gdd') ?? 'normal'}`}>{fmt0(s.gdd)}</td>
                  <td className={`num weather-${deviation(s.waterBalanceMm, data?.normal.waterBalanceMm, data?.sd.waterBalanceMm, 'precip') ?? 'normal'}`}>{fmt0(s.waterBalanceMm)}</td>
                  <td className="num">{s.longestDrySpell}</td>
                  <td className="num">{s.hotDays}</td>
                  <td className="num">{s.frostDays}</td>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={compare.includes(y)} onChange={() => toggleCompare(y)} aria-label={`Võrdle ${y}`} /></td>
                </tr>
              ))}
              {data && data.normalYears.length > 0 && (
                <tr className="weather-normal-row">
                  <td>Keskmine {data.normalYears[0]}–{data.normalYears[data.normalYears.length - 1]}</td>
                  <td className="num">{fmt0(data.normal.precipMm)}</td>
                  <td className="num">{fmt0(data.normal.gdd)}</td>
                  <td className="num">{fmt0(data.normal.waterBalanceMm)}</td>
                  <td className="num">{fmt1(data.normal.longestDrySpell)}</td>
                  <td className="num">{fmt1(data.normal.hotDays)}</td>
                  <td className="num">{fmt1(data.normal.frostDays)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">Värviga on märgitud aastad, mis erinevad keskmisest rohkem kui ühe standardhälbe võrra: sinine = märg, oranž = kuiv, punane = soe, helesinine = jahe.</p>
      </section>

      {year && months.length > 0 && (
        <section className="weather-section weather-charts">
          <h3>{year} kuude kaupa</h3>
          <div className="weather-chart-grid">
            <div><h4>Sademed, mm</h4><MonthBars months={months} metric="precipMm" unit="mm" year={year} /></div>
            <div><h4>Temperatuurisumma, °C</h4><MonthBars months={months} metric="gdd" unit="°C" year={year} /></div>
          </div>
          <p className="hint"><span className="legend weather-bar-year" /> {year} <span className="legend weather-bar-normal" /> keskmine</p>
        </section>
      )}

      {series.length > 0 && (
        <section className="weather-section weather-charts">
          <h3>Kasv hooaja jooksul</h3>
          <div className="weather-chart-grid">
            <div><h4>Temperatuurisumma, °C</h4><CumulativeLines series={series} metric="gdd" unit="°C" /></div>
            <div><h4>Sademed, mm</h4><CumulativeLines series={series} metric="precipMm" unit="mm" /></div>
          </div>
          <p className="hint">{series.map((s, i) => <span key={s.year}><span className={`legend weather-line-${i % 6}`} /> {s.year} </span>)}</p>
        </section>
      )}

      <footer className="weather-source">{WEATHER_SOURCE}.{data?.dataUntil && ` Andmed kuni ${formatDate(data.dataUntil)}.`}</footer>
    </div>
  );
};
