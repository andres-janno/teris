// src/components/WeatherView.tsx — majandi ilmavaade: aastate võrdlus (01.04–31.08), kuude jaotus ja kumulatiivne graafik.
import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, CalendarRange, Droplets, Thermometer } from 'lucide-react';
import { api } from '../services/api';
import type { WeatherMap, WeatherPeriod, WeatherPointInfo, WeatherYears, WeatherMonth, WeatherCumulative, WeatherPointRef } from '../types/weather';
import { deviation, type Deviation, fmt0, fmt1, pointColor, WEATHER_SOURCE, WEATHER_PERIOD_OPTIONS } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';
import { WEATHER_DEVIATION_COLOR, weatherSeriesColor, WEATHER_NORMAL_BAR_COLOR } from '../lib/dataColors';
import { Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, FilterClear, Card, FilterSelect, Checkbox, SectionTitle, PageHeader, cn } from './ui';
import { boardViewClass, boardMainClass, boardBodyClass, boardContentClass, notesTextClass } from './ui/variants';
import { MonthBars, CumulativeLines } from './WeatherCharts';
import { WeatherPointMap } from './WeatherPointMap';

const BASES = [0, 5, 6, 8, 10];

// Aastate tabel ja kaart kõrvuti; kitsal ekraanil kaart tabeli alla
const yearsLayoutClass = 'grid grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] items-stretch gap-3 max-[1101px]:grid-cols-1';
// Graafiku kast: polster väiksem all (graafik vajab vähem ruumi); pealkiri 11px suurtähtedes
const chartCardClass = 'min-w-0 px-2.5 pt-2 pb-1';
const chartTitleClass = 'mb-1 text-2xs font-semibold uppercase leading-natural tracking-wide text-muted-foreground';
// Legendi värvimärk teksti vahel
// Märkus tabeli ja legendi all
const noteClass = cn(notesTextClass, 'mt-1.5');
const legendSwatchClass = 'ml-1.5 inline-block size-2.5 rounded-sm align-middle';
// Lahtri taust, kui näitaja erineb keskmisest üle ühe standardhälbe
const deviationStyle = (d: Deviation): React.CSSProperties | undefined => (d ? { backgroundColor: WEATHER_DEVIATION_COLOR[d] } : undefined);

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
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader
          icon={<CloudSun />}
          title="Ilm"
          subtitle={(
            <>
              <p>Aastate võrdlus ERA5-Landi ilmaandmete põhjal (2015-st)</p>
              <p className="mt-0.5 text-xs leading-natural">{WEATHER_SOURCE}.{data?.dataUntil && ` Andmed kuni ${formatDate(data.dataUntil)}.`}</p>
            </>
          )}
          actions={(
              <div className="flex flex-wrap items-center gap-2.5">
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

        <div className={boardBodyClass}>
          <div className={boardContentClass}>
            {error && <Alert tone="error">{error}</Alert>}
            {loading && <Alert>Ilmaandmeid laetakse — esmalaadimine võtab kuni mõne tunni.</Alert>}

            <div>
              <SectionTitle><CalendarRange size={14} /><span>Aastad · {per.label.toLowerCase()} {per.range}</span></SectionTitle>
              <div className={yearsLayoutClass}>
                <Table scroll="fill" bordered>
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
                          <TableCell>{y}{!s.complete && <span className="text-xs text-muted-foreground"> (kuni {formatDate(s.dataUntil)})</span>}</TableCell>
                          <TableCell numeric style={deviationStyle(deviation(s.precipMm, data?.normal.precipMm, data?.sd.precipMm, 'precip'))}>{fmt0(s.precipMm)}</TableCell>
                          <TableCell numeric style={deviationStyle(deviation(s.gdd, data?.normal.gdd, data?.sd.gdd, 'gdd'))}>{fmt0(s.gdd)}</TableCell>
                          <TableCell numeric style={deviationStyle(deviation(s.waterBalanceMm, data?.normal.waterBalanceMm, data?.sd.waterBalanceMm, 'precip'))}>{fmt0(s.waterBalanceMm)}</TableCell>
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
              <p className={noteClass}>Värviga on märgitud aastad, mis erinevad keskmisest rohkem kui ühe standardhälbe võrra: sinine = märg, oranž = kuiv, punane = soe, helesinine = jahe. Rea klõps või linnuke lisab aasta allolevatele graafikutele. Kaardil on ilmaandmete ruudud (0,1°) ja põllud ruudu värviga — klõps ruudul või põllul valib selle ilmapunkti, uus klõps viib tagasi majandi keskmisele.</p>
            </div>

            {compare.length > 0 && cumulative && (
              <p className={noteClass}>
                {compare.map((y, i) => <span key={y}><span className={legendSwatchClass} style={{ backgroundColor: weatherSeriesColor(i) }} /> {y} </span>)}
                <span className={legendSwatchClass} style={{ backgroundColor: WEATHER_NORMAL_BAR_COLOR }} /> keskmine{cumulative.normal && ` ${cumulative.normal.years[0]}–${cumulative.normal.years[cumulative.normal.years.length - 1]}`}
              </p>
            )}
            {compare.length > 0 && months.length > 0 && cumulative && ([
              { metric: 'precipMm' as const, title: 'Sademed', unit: 'mm', icon: <Droplets size={14} /> },
              { metric: 'gdd' as const, title: 'Temperatuurisumma', unit: '°C', icon: <Thermometer size={14} /> }
            ]).map((c) => (
              <div key={c.metric}>
                <SectionTitle>{c.icon}<span>{c.title}, {c.unit}</span></SectionTitle>
                <div className="grid grid-cols-2 gap-3 max-[761px]:grid-cols-1">
                  <Card variant="tile" padding="none" className={chartCardClass}><div className={chartTitleClass}>Kuude kaupa</div><MonthBars months={months} years={compare} metric={c.metric} unit={c.unit} /></Card>
                  <Card variant="tile" padding="none" className={chartCardClass}><div className={chartTitleClass}>Kasv hooaja jooksul</div><CumulativeLines series={cumulative.series} normal={cumulative.normal?.points ?? null} metric={c.metric} unit={c.unit} firstMonth={per.firstMonth} lastMonth={per.lastMonth} /></Card>
                </div>
              </div>
            ))}

          </div>
        </div>
      </main>
    </div>
  );
};
