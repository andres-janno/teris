// src/components/WeatherCharts.tsx — ilmavaate SVG graafikud: kuude tulbad (võrreldavad aastad + keskmine) ja kumulatiivsed jooned (aastad + keskmine).
import React, { useEffect, useRef, useState } from 'react';
import type { WeatherMonth, WeatherCumulativeSeries, WeatherCumulativePoint } from '../types/weather';
import { MONTH_NAMES, fmt0 } from '../services/weatherFormat';

const H = 220, M = { top: 12, right: 12, bottom: 28, left: 44 };

// Graafik joonistatakse tegeliku laiusega (mitte viewBox-skaleerimisega), et tekst jääks rakenduse fondisuurusesse
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
const niceTop = (max: number) => {
  if (max <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow;
};

const Grid: React.FC<{ top: number; y: (v: number) => number; W: number }> = ({ top, y, W }) => (
  <>
    {[0, 0.5, 1].map((f) => (
      <g key={f}>
        <line x1={M.left} x2={W - M.right} y1={y(top * f)} y2={y(top * f)} className="weather-grid" />
        <text x={M.left - 6} y={y(top * f) + 4} textAnchor="end" className="weather-axis">{fmt0(top * f)}</text>
      </g>
    ))}
  </>
);

// Värv = aasta järjekord võrdluses, sama tulpades ja joontes
export const MonthBars: React.FC<{ months: WeatherMonth[]; years: number[]; metric: 'precipMm' | 'gdd'; unit: string }> = ({ months, years, metric, unit }) => {
  const [ref, W] = useWidth();
  const normalKey = metric === 'precipMm' ? 'normalPrecipMm' : 'normalGdd';
  const top = niceTop(Math.max(0, ...months.flatMap((m) => [...m.years.map((y) => y[metric] ?? 0), m[normalKey] ?? 0])));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const slot = iw / months.length, n = years.length + 1;
  const bw = Math.max(2, Math.min(18, (slot * 0.8) / n - 1));
  const y = (v: number) => M.top + ih - (v / top) * ih;
  return (
    <div ref={ref} className="weather-chart-box"><svg className="weather-chart" width={W} height={H} role="img" aria-label={`${metric === 'precipMm' ? 'Sademed' : 'Temperatuurisumma'} kuude kaupa`}>
      <Grid top={top} y={y} W={W} />
      {months.map((m, i) => {
        const x0 = M.left + i * slot + slot / 2 - (n * (bw + 1)) / 2;
        const nv = m[normalKey];
        return (
          <g key={m.month}>
            {years.map((yr, j) => {
              const v = m.years.find((r) => r.year === yr)?.[metric];
              return v != null && (
                <rect key={yr} x={x0 + j * (bw + 1)} y={y(v)} width={bw} height={y(0) - y(v)} className={`weather-bar weather-line-${j % 6}`}>
                  <title>{`${MONTH_NAMES[m.month]} ${yr}: ${fmt0(v)} ${unit}`}</title>
                </rect>
              );
            })}
            {nv != null && <rect x={x0 + years.length * (bw + 1)} y={y(nv)} width={bw} height={y(0) - y(nv)} className="weather-bar weather-bar-normal"><title>{`${MONTH_NAMES[m.month]} keskmine: ${fmt0(nv)} ${unit}`}</title></rect>}
            <text x={M.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="weather-axis">{MONTH_NAMES[m.month]}</text>
          </g>
        );
      })}
    </svg></div>
  );
};

export const CumulativeLines: React.FC<{ series: WeatherCumulativeSeries[]; normal: WeatherCumulativePoint[] | null; metric: 'gdd' | 'precipMm'; unit: string }> = ({ series, normal, metric, unit }) => {
  const [ref, W] = useWidth();
  const maxDay = 152; // 01.04–31.08
  const top = niceTop(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p[metric])), ...(normal ?? []).map((p) => p[metric])));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const x = (d: number) => M.left + (d / maxDay) * iw;
  const y = (v: number) => M.top + ih - (v / top) * ih;
  const ticks = [{ d: 0, l: '1. apr' }, { d: 30, l: '1. mai' }, { d: 61, l: '1. juuni' }, { d: 91, l: '1. juuli' }, { d: 122, l: '1. aug' }];
  const path = (pts: WeatherCumulativePoint[]) => pts.map((p) => `${x(p.day)},${y(p[metric])}`).join(' ');
  return (
    <div ref={ref} className="weather-chart-box"><svg className="weather-chart" width={W} height={H} role="img" aria-label={metric === 'gdd' ? 'Temperatuurisumma kasv' : 'Sademete kasv'}>
      <Grid top={top} y={y} W={W} />
      {ticks.map((t) => <text key={t.d} x={x(t.d)} y={H - 8} textAnchor="middle" className="weather-axis">{t.l}</text>)}
      {normal && normal.length > 0 && (
        <polyline fill="none" className="weather-line weather-line-normal" points={path(normal)}>
          <title>{`Keskmine: ${fmt0(normal[normal.length - 1][metric])} ${unit}`}</title>
        </polyline>
      )}
      {series.map((s, i) => (
        <polyline key={s.year} fill="none" className={`weather-line weather-line-${i % 6}`} points={path(s.points)}>
          <title>{`${s.year}: ${fmt0(s.points[s.points.length - 1]?.[metric] ?? 0)} ${unit}`}</title>
        </polyline>
      ))}
    </svg></div>
  );
};
