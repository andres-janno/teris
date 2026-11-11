// src/components/WeatherCharts.tsx — ilmavaate SVG graafikud: kuude tulbad (võrreldavad aastad + keskmine) ja kumulatiivsed jooned (aastad + keskmine).
// Hiirega liikudes näitab punktiirjoon kursori asukoha väärtust mõlemal teljel.
import React, { useEffect, useRef, useState } from 'react';
import type { WeatherMonth, WeatherCumulativeSeries, WeatherCumulativePoint } from '../types/weather';
import { MONTH_NAMES, MONTH_SHORT, fmt0 } from '../services/weatherFormat';

const H = 240, M = { top: 12, right: 12, bottom: 28, left: 48 };

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

// Y-telje samm 1/2/2,5/5 × 10^k, umbes 5–8 jaotist
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 10, step: 2 };
  const raw = max / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw)!;
  return { top: Math.ceil(max / step) * step, step };
}

const Grid: React.FC<{ top: number; step: number; y: (v: number) => number; W: number }> = ({ top, step, y, W }) => {
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return (
    <>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} className="weather-grid" />
          <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="weather-axis">{fmt0(v)}</text>
        </g>
      ))}
      <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="weather-axis-line" />
    </>
  );
};

type Hover = { x: number; y: number } | null;
function useHover(W: number): [Hover, { onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void; onMouseLeave: () => void }] {
  const [hover, setHover] = useState<Hover>(null);
  return [hover, {
    onMouseMove: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      setHover(x >= M.left && x <= W - M.right && y >= M.top && y <= H - M.bottom ? { x, y } : null);
    },
    onMouseLeave: () => setHover(null)
  }];
}

// Punktiirjooned kursorist telgedele ja väärtussildid telgedel
const Crosshair: React.FC<{ hover: Hover; yLabel: string; xLabel: string; W: number }> = ({ hover, yLabel, xLabel, W }) => {
  if (!hover) return null;
  const bottom = H - M.bottom;
  const yw = Math.min(M.left - 3, yLabel.length * 6.6 + 10), xw = xLabel.length * 6.6 + 12;
  const xl = Math.min(Math.max(hover.x, M.left + xw / 2), W - M.right - xw / 2);
  return (
    <g className="weather-crosshair" pointerEvents="none">
      <line x1={M.left} x2={hover.x} y1={hover.y} y2={hover.y} />
      <line x1={hover.x} x2={hover.x} y1={hover.y} y2={bottom} />
      <rect x={Math.max(1, M.left - yw - 2)} y={hover.y - 9} width={yw} height={18} rx={3} className="weather-crosshair-label" />
      <text x={M.left - 7} y={hover.y + 4} textAnchor="end" className="weather-crosshair-text">{yLabel}</text>
      <rect x={xl - xw / 2} y={bottom + 4} width={xw} height={18} rx={3} className="weather-crosshair-label" />
      <text x={xl} y={bottom + 17} textAnchor="middle" className="weather-crosshair-text">{xLabel}</text>
    </g>
  );
};

// Värv = aasta järjekord võrdluses, sama tulpades ja joontes
export const MonthBars: React.FC<{ months: WeatherMonth[]; years: number[]; metric: 'precipMm' | 'gdd'; unit: string }> = ({ months, years, metric, unit }) => {
  const [ref, W] = useWidth();
  const [hover, handlers] = useHover(W);
  const normalKey = metric === 'precipMm' ? 'normalPrecipMm' : 'normalGdd';
  const { top, step } = niceScale(Math.max(0, ...months.flatMap((m) => [...m.years.map((y) => y[metric] ?? 0), m[normalKey] ?? 0])));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const slot = iw / months.length, n = years.length + 1;
  const bw = Math.max(2, Math.min(18, (slot * 0.8) / n - 1));
  const y = (v: number) => M.top + ih - (v / top) * ih;
  const hoverMonth = hover ? months[Math.min(months.length - 1, Math.floor((hover.x - M.left) / slot))] : null;
  return (
    <div ref={ref} className="weather-chart-box"><svg className="weather-chart" width={W} height={H} role="img" aria-label={`${metric === 'precipMm' ? 'Sademed' : 'Temperatuurisumma'} kuude kaupa`} {...handlers}>
      <Grid top={top} step={step} y={y} W={W} />
      {months.map((m, i) => (
        <line key={m.month} x1={M.left + i * slot} x2={M.left + i * slot} y1={y(0)} y2={y(0) + 6} className="weather-month-tick" />
      ))}
      <line x1={W - M.right} x2={W - M.right} y1={y(0)} y2={y(0) + 6} className="weather-month-tick" />
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
      <Crosshair hover={hover} W={W} yLabel={hover ? fmt0(((y(0) - hover.y) / ih) * top) : ''} xLabel={hoverMonth ? MONTH_NAMES[hoverMonth.month] : ''} />
    </svg></div>
  );
};

// Päevanumber perioodi algusest (mitteliigaasta järgi)
const dayOf = (month: number, firstMonth: number) => Math.round((Date.UTC(2025, month - 1, 1) - Date.UTC(2025, firstMonth - 1, 1)) / 86_400_000);
const dateOfDay = (d: number, firstMonth: number) => {
  const t = new Date(Date.UTC(2025, firstMonth - 1, 1 + d));
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const CumulativeLines: React.FC<{ series: WeatherCumulativeSeries[]; normal: WeatherCumulativePoint[] | null; metric: 'gdd' | 'precipMm'; unit: string; firstMonth: number; lastMonth: number }> = ({ series, normal, metric, unit, firstMonth, lastMonth }) => {
  const [ref, W] = useWidth();
  const [hover, handlers] = useHover(W);
  const maxDay = dayOf(lastMonth + 1, firstMonth) - 1;
  const { top, step } = niceScale(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p[metric])), ...(normal ?? []).map((p) => p[metric])));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const x = (d: number) => M.left + (d / maxDay) * iw;
  const y = (v: number) => M.top + ih - (v / top) * ih;
  // Kuu piirid (markerid) ja kuu nimi kuu keskel
  const bounds: number[] = [];
  for (let m = firstMonth; m <= lastMonth + 1; m++) bounds.push(Math.min(maxDay, dayOf(m, firstMonth)));
  const labels = bounds.slice(0, -1).map((d, i) => ({ d: (d + bounds[i + 1]) / 2, l: MONTH_SHORT[firstMonth + i] }));
  const path = (pts: WeatherCumulativePoint[]) => pts.map((p) => `${x(p.day)},${y(p[metric])}`).join(' ');
  const hoverDay = hover ? Math.round(((hover.x - M.left) / iw) * maxDay) : 0;
  return (
    <div ref={ref} className="weather-chart-box"><svg className="weather-chart" width={W} height={H} role="img" aria-label={metric === 'gdd' ? 'Temperatuurisumma kasv' : 'Sademete kasv'} {...handlers}>
      <Grid top={top} step={step} y={y} W={W} />
      {bounds.map((d) => <line key={d} x1={x(d)} x2={x(d)} y1={y(0)} y2={y(0) + 6} className="weather-month-tick" />)}
      {labels.map((t) => <text key={t.l} x={x(t.d)} y={H - 8} textAnchor="middle" className="weather-axis">{t.l}</text>)}
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
      <Crosshair hover={hover} W={W} yLabel={hover ? fmt0(((y(0) - hover.y) / ih) * top) : ''} xLabel={hover ? dateOfDay(hoverDay, firstMonth) : ''} />
    </svg></div>
  );
};
