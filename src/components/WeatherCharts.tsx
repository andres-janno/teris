// src/components/WeatherCharts.tsx — ilmavaate SVG graafikud: kuude tulbad (aasta vs keskmine) ja kumulatiivsed jooned.
import React from 'react';
import type { WeatherMonth, WeatherCumulativeSeries } from '../types/weather';
import { MONTH_NAMES, fmt0 } from '../services/weatherFormat';

const W = 560, H = 220, M = { top: 12, right: 12, bottom: 28, left: 44 };
const niceTop = (max: number) => {
  if (max <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow;
};

export const MonthBars: React.FC<{ months: WeatherMonth[]; metric: 'precipMm' | 'gdd'; unit: string; year: number }> = ({ months, metric, unit, year }) => {
  const normalKey = metric === 'precipMm' ? 'normalPrecipMm' : 'normalGdd';
  const top = niceTop(Math.max(0, ...months.flatMap((m) => [m[metric] ?? 0, m[normalKey] ?? 0])));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const slot = iw / months.length, bw = slot * 0.32;
  const y = (v: number) => M.top + ih - (v / top) * ih;
  return (
    <svg className="weather-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric === 'precipMm' ? 'Sademed' : 'Temperatuurisumma'} kuude kaupa`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={M.left} x2={W - M.right} y1={y(top * f)} y2={y(top * f)} className="weather-grid" />
          <text x={M.left - 6} y={y(top * f) + 4} textAnchor="end" className="weather-axis">{fmt0(top * f)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = M.left + i * slot + slot / 2;
        const v = m[metric], n = m[normalKey];
        return (
          <g key={m.month}>
            {v != null && <rect x={x - bw - 1} y={y(v)} width={bw} height={y(0) - y(v)} className="weather-bar-year"><title>{`${MONTH_NAMES[m.month]} ${year}: ${fmt0(v)} ${unit}`}</title></rect>}
            {n != null && <rect x={x + 1} y={y(n)} width={bw} height={y(0) - y(n)} className="weather-bar-normal"><title>{`${MONTH_NAMES[m.month]} keskmine: ${fmt0(n)} ${unit}`}</title></rect>}
            <text x={x} y={H - 8} textAnchor="middle" className="weather-axis">{MONTH_NAMES[m.month]}</text>
          </g>
        );
      })}
    </svg>
  );
};

export const CumulativeLines: React.FC<{ series: WeatherCumulativeSeries[]; metric: 'gdd' | 'precipMm'; unit: string }> = ({ series, metric, unit }) => {
  const maxDay = 152; // 01.04–31.08
  const top = niceTop(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p[metric]))));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const x = (d: number) => M.left + (d / maxDay) * iw;
  const y = (v: number) => M.top + ih - (v / top) * ih;
  const ticks = [{ d: 0, l: '1. apr' }, { d: 30, l: '1. mai' }, { d: 61, l: '1. juuni' }, { d: 91, l: '1. juuli' }, { d: 122, l: '1. aug' }];
  return (
    <svg className="weather-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={metric === 'gdd' ? 'Temperatuurisumma kasv' : 'Sademete kasv'}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={M.left} x2={W - M.right} y1={y(top * f)} y2={y(top * f)} className="weather-grid" />
          <text x={M.left - 6} y={y(top * f) + 4} textAnchor="end" className="weather-axis">{fmt0(top * f)}</text>
        </g>
      ))}
      {ticks.map((t) => <text key={t.d} x={x(t.d)} y={H - 8} textAnchor="middle" className="weather-axis">{t.l}</text>)}
      {series.map((s, i) => (
        <polyline key={s.year} fill="none" className={`weather-line weather-line-${i % 6}`}
          points={s.points.map((p) => `${x(p.day)},${y(p[metric])}`).join(' ')}>
          <title>{`${s.year}: ${fmt0(s.points[s.points.length - 1]?.[metric] ?? 0)} ${unit}`}</title>
        </polyline>
      ))}
    </svg>
  );
};
