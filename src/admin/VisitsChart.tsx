// src/admin/VisitsChart.tsx — landing'u külastajad tulpgraafikuna: üks tulp päevas (pika perioodi puhul nädalas),
// hiirega tulba kohal näeb külastajaid ja vaatamisi. Puuduvad päevad täidetakse nulliga.
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from './format.ts';

interface DayRow { day: string; visitors: number; views: number }
interface Bucket { key: string; label: string; title: string; visitors: number; views: number }

const HEIGHT = 220;
const M = { top: 12, right: 8, bottom: 26, left: 36 };
const WEEKLY_AFTER_DAYS = 92; // pikemal perioodil koondatakse nädala kaupa, et tulbad ei jääks liiga peeneks

const DAY_MS = 24 * 60 * 60 * 1000;
const parseDay = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayMonth = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;

// Telje ümar ülempiir ja jaotised (1, 2, 5 × 10^n)
const niceScale = (max: number): { top: number; step: number } => {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const s = Math.max(1, step);
  return { top: Math.ceil(max / s) * s, step: s };
};

const buildBuckets = (daily: DayRow[], from: string, to: string): Bucket[] => {
  const byDay = new Map(daily.map((d) => [d.day.slice(0, 10), d]));
  const start = parseDay(from);
  const end = parseDay(to);
  if (!(end >= start)) return [];
  const days: Bucket[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const day = isoDay(t);
    const d = byDay.get(day);
    days.push({ key: day, label: dayMonth(day), title: formatDate(day), visitors: d?.visitors ?? 0, views: d?.views ?? 0 });
  }
  if (days.length <= WEEKLY_AFTER_DAYS) return days;
  // Nädalad algavad esmaspäeval
  const weeks = new Map<string, Bucket & { last: string }>();
  for (const d of days) {
    const t = parseDay(d.key);
    const monday = isoDay(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS);
    const w = weeks.get(monday);
    if (w) {
      w.visitors += d.visitors;
      w.views += d.views;
      w.last = d.key;
    } else {
      weeks.set(monday, { ...d, key: monday, label: dayMonth(d.key), last: d.key });
    }
  }
  return [...weeks.values()].map((w) => ({ ...w, title: `Nädal ${formatDate(w.key < from ? from : w.key)} – ${formatDate(w.last)}` }));
};

export function VisitsChart({ daily, from, to }: { daily: DayRow[]; from: string; to: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const buckets = useMemo(() => buildBuckets(daily, from, to), [daily, from, to]);
  const weekly = buckets.length > 0 && buckets.length < (parseDay(to) - parseDay(from)) / DAY_MS + 1;
  const { top, step } = niceScale(Math.max(0, ...buckets.map((b) => b.visitors)));

  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;
  const band = buckets.length ? plotW / buckets.length : plotW;
  const gap = band > 6 ? 2 : 1; // tulpade vahel pinnavärviline vahe
  const barW = Math.max(1, band - gap);
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(44 / band)); // kuupäevasildid vähemalt ~44 px vahega
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  // Ümardatud ülaservaga tulp, alus jääb teljele kandiliseks
  const barPath = (x: number, v: number) => {
    const yTop = y(v);
    const h = M.top + plotH - yTop;
    const r = Math.min(4, barW / 2, h);
    return `M${x},${M.top + plotH}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + barW - r}Q${x + barW},${yTop} ${x + barW},${yTop + r}V${M.top + plotH}Z`;
  };

  const hovered = hover != null ? buckets[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(M.left + band * hover + band / 2, 70), width - 70) : 0;

  return (
    <div className="visits-chart" ref={wrapRef}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`Külastajad ${weekly ? 'nädalas' : 'päevas'}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="visits-grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
            <text className="visits-axis" x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = M.left + band * i + gap / 2;
          return (
            <g key={b.key}>
              {b.visitors > 0 && <path className={`visits-bar${hover === i ? ' active' : ''}`} d={barPath(x, b.visitors)} />}
              {i % labelEvery === 0 && (
                <text className="visits-axis" x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle">{b.label}</text>
              )}
              {/* Tabamisala on terve veeru kõrgune, et ka madalat tulpa oleks lihtne tabada */}
              <rect x={M.left + band * i} y={M.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="visits-tip" style={{ left: tipLeft }}>
          <strong>{hovered.title}</strong>
          <span>Külastajad: {hovered.visitors}</span>
          <span>Vaatamised: {hovered.views}</span>
        </div>
      )}
    </div>
  );
}
