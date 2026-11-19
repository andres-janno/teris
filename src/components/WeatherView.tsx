// src/components/WeatherView.tsx — majandi ilmavaade: aastate võrdlus (01.04–31.08), kuude jaotus ja kumulatiivne graafik.
import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, CalendarRange, Droplets, Thermometer } from 'lucide-react';
import { api } from '../services/api';
import type { WeatherMap, WeatherPeriod, WeatherPointInfo, WeatherYears, WeatherMonth, WeatherCumulative, WeatherPointRef } from '../types/weather';
import { deviation, fmt0, fmt1, pointColor, WEATHER_SOURCE, WEATHER_PERIOD_OPTIONS } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';
import { Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, FilterClear, Card, FilterSelect, Checkbox, SectionTitle, PageHeader } from './ui';
import { MonthBars, CumulativeLines } from './WeatherCharts';
import { WeatherPointMap } from './WeatherPointMap';

const BASES = [0, 5, 6, 8, 10];

export const WeatherView: React.FC = () => {
  const [points, setPoints] = useState<WeatherPointInfo[]>([]);
  const [mapFields, setMapFields] = useState<WeatherMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [point, setPoint] = useState<WeatherPointRef>('all');
  const [base, setBase] = useState(5);
  const [period, setPeriod] = useState<WeatherPeriod>('growing');
  const [data, setData] = useState<WeatherYears | null>(null);
  const [months, setMonths] = useState<WeatherMonth[]>([]);
  const [compare, setCompare] = useState<number[]>([]);
  const [cumulative, setCumulative] = useState<WeatherCumulative | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getWeatherPoints().then((r) => { setPoints(r.points); setLoading(r.loading); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { api.getWeatherMap().then(setMapFields).catch(() => setMapFields(null)); }, []);
  // Iga päring: viga puhastatakse alguses ja hilinenud vastus (vana valik) ignoreeritakse
  useEffect(() => {
    setError(null);
    let cancelled = false;
    api.getWeatherYears(point, base, period).then((r) => {
      if (cancelled) return;
      setData(r);
      setCompare((c) => (c.length ? c : r.years.slice(-3).map((x) => x.year)));
    }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [point, base, period]);
  // Võrreldavad aastad (linnukesed) lähevad nii kuude tulpadesse kui kasvujoontesse; keskmine on alati kõrval
  useEffect(() => {
    if (!compare.length) { setMonths([]); setCumulative(null); return; }
    setError(null);
    let cancelled = false;
    Promise.all([api.getWeatherMonths(compare, point, base, period), api.getWeatherCumulative(compare, point, base, period)])
      .then(([m, c]) => { if (!cancelled) { setMonths(m); setCumulative(c); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [compare, point, base, period]);

  const per = WEATHER_PERIOD_OPTIONS.find((p) => p.value === period)!;
  const rows = useMemo(() => [...(data?.years ?? [])].reverse(), [data]);
  const toggleCompare = (y: number) => setCompare((c) => (c.includes(y) ? c.filter((x) => x !== y) : [...c, y].sort()));

  return (
    <div className="fullpage-board-view">
      <main className="fullpage-board-main wide">
        <PageHeader
          icon={<CloudSun />}
          title="Ilm"
          subtitle={(
            <>
              <p>Aastate võrdlus ERA5-Landi ilmaandmete põhjal (2015-st)</p>
              <p className="weather-source">{WEATHER_SOURCE}.{data?.dataUntil && ` Andmed kuni ${formatDate(data.dataUntil)}.`}</p>
            </>
          )}
          actions={(
              <div className="weather-filters">
                <FilterClear active={period !== 'growing'} onClear={() => setPeriod('growing')}>
                  <FilterSelect ariaLabel="Periood" value={period} onChange={(v) => setPeriod(v as WeatherPeriod)}
                    options={WEATHER_PERIOD_OPTIONS.map((p) => ({ value: p.value, label: `${p.label} ${p.range}` }))} />
                </FilterClear>
                <FilterClear active={point !== 'all'} onClear={() => setPoint('all')}>
                  <FilterSelect ariaLabel="Ilmapunkt" value={String(point)} onChange={(v) => setPoint(v === 'all' ? 'all' : Number(v))}
                    options={[{ value: 'all', label: 'Majandi keskmine' }, ...points.map((p) => ({ value: String(p.id), label: `${p.lat.toFixed(1)}° N, ${p.lon.toFixed(1)}° E (${p.fieldCount} põldu)`, color: pointColor(points, p.id) }))]} />
                </FilterClear>
                <FilterClear active={base !== 5} onClear={() => setBase(5)}>
                  <FilterSelect ariaLabel="GDD baastemperatuur" value={String(base)} onChange={(v) => setBase(Number(v))}
                    options={BASES.map((b) => ({ value: String(b), label: `GDD baas ${b} °C` }))} />
                </FilterClear>
              </div>
          )}
        />

        <div className="fullpage-board-body">
          <div className="fullpage-board-content weather-body">
            {error && <Alert tone="error">{error}</Alert>}
            {loading && <Alert>Ilmaandmeid laetakse — esmalaadimine võtab kuni mõne tunni.</Alert>}

            <div className="detail-section">
              <SectionTitle><CalendarRange size={14} /><span>Aastad · {per.label.toLowerCase()} {per.range}</span></SectionTitle>
              <div className="weather-years-layout">
                <Table scroll="fill" bordered containerClassName="weather-years-wrap" className="weather-years">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aasta</TableHead>
                        <TableHead numeric>Sademed, mm</TableHead>
                        <TableHead numeric>GDD, °C</TableHead>
                        <TableHead numeric>Veebilanss, mm</TableHead>
                        <TableHead numeric>Pikim kuiv periood, p</TableHead>
                        <TableHead numeric>Kuumapäevi</TableHead>
                        <TableHead numeric>{per.frostLabel}</TableHead>
                        <TableHead>Võrdle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(({ year: y, summary: s }) => (
                        <TableRow key={y} onClick={() => toggleCompare(y)}>
                          <TableCell>{y}{!s.complete && <span className="weather-muted"> (kuni {formatDate(s.dataUntil)})</span>}</TableCell>
                          <TableCell numeric className={`weather-${deviation(s.precipMm, data?.normal.precipMm, data?.sd.precipMm, 'precip') ?? 'normal'}`}>{fmt0(s.precipMm)}</TableCell>
                          <TableCell numeric className={`weather-${deviation(s.gdd, data?.normal.gdd, data?.sd.gdd, 'gdd') ?? 'normal'}`}>{fmt0(s.gdd)}</TableCell>
                          <TableCell numeric className={`weather-${deviation(s.waterBalanceMm, data?.normal.waterBalanceMm, data?.sd.waterBalanceMm, 'precip') ?? 'normal'}`}>{fmt0(s.waterBalanceMm)}</TableCell>
                          <TableCell numeric>{s.longestDrySpell}</TableCell>
                          <TableCell numeric>{s.hotDays}</TableCell>
                          <TableCell numeric>{s.frostDays}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={compare.includes(y)} onCheckedChange={() => toggleCompare(y)} aria-label={`Võrdle ${y}`} /></TableCell>
                        </TableRow>
                      ))}
                      {data && data.normalYears.length > 0 && (
                        <TableRow tone="total">
                          <TableCell>Keskmine {data.normalYears[0]}–{data.normalYears[data.normalYears.length - 1]}</TableCell>
                          <TableCell numeric>{fmt0(data.normal.precipMm)}</TableCell>
                          <TableCell numeric>{fmt0(data.normal.gdd)}</TableCell>
                          <TableCell numeric>{fmt0(data.normal.waterBalanceMm)}</TableCell>
                          <TableCell numeric>{fmt1(data.normal.longestDrySpell)}</TableCell>
                          <TableCell numeric>{fmt1(data.normal.hotDays)}</TableCell>
                          <TableCell numeric>{fmt1(data.normal.frostDays)}</TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                <WeatherPointMap points={points} fields={mapFields} selected={point} onSelect={setPoint} />
              </div>
              <p className="notes-text weather-note">Värviga on märgitud aastad, mis erinevad keskmisest rohkem kui ühe standardhälbe võrra: sinine = märg, oranž = kuiv, punane = soe, helesinine = jahe. Rea klõps või linnuke lisab aasta allolevatele graafikutele. Kaardil on ilmaandmete ruudud (0,1°) ja põllud ruudu värviga — klõps ruudul või põllul valib selle ilmapunkti, uus klõps viib tagasi majandi keskmisele.</p>
            </div>

            {compare.length > 0 && cumulative && (
              <p className="notes-text weather-legend-row">
                {compare.map((y, i) => <span key={y}><span className={`legend weather-line-${i % 6}`} /> {y} </span>)}
                <span className="legend weather-bar-normal" /> keskmine{cumulative.normal && ` ${cumulative.normal.years[0]}–${cumulative.normal.years[cumulative.normal.years.length - 1]}`}
              </p>
            )}
            {compare.length > 0 && months.length > 0 && cumulative && ([
              { metric: 'precipMm' as const, title: 'Sademed', unit: 'mm', icon: <Droplets size={14} /> },
              { metric: 'gdd' as const, title: 'Temperatuurisumma', unit: '°C', icon: <Thermometer size={14} /> }
            ]).map((c) => (
              <div key={c.metric} className="detail-section">
                <SectionTitle>{c.icon}<span>{c.title}, {c.unit}</span></SectionTitle>
                <div className="weather-chart-grid">
                  <Card variant="tile" padding="none" className="weather-chart-card"><div className="weather-chart-title">Kuude kaupa</div><MonthBars months={months} years={compare} metric={c.metric} unit={c.unit} /></Card>
                  <Card variant="tile" padding="none" className="weather-chart-card"><div className="weather-chart-title">Kasv hooaja jooksul</div><CumulativeLines series={cumulative.series} normal={cumulative.normal?.points ?? null} metric={c.metric} unit={c.unit} firstMonth={per.firstMonth} lastMonth={per.lastMonth} /></Card>
                </div>
              </div>
            ))}

          </div>
        </div>
      </main>
    </div>
  );
};
