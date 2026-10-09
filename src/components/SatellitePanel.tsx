// src/components/SatellitePanel.tsx
// Satelliidipildi kihi juhtpaneel kaardil: toode (RGB / NRG / NDVI), periood, kuupäev ja pilvevaba filter.
// Kuupäevad tulevad Satiladust; pilvevaba filter kehtib parasjagu nähtava kaardivaate kohta.
import React, { useEffect, useState } from 'react';
import type L from 'leaflet';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { SATELLITE_PRODUCTS, NDVI_LEGEND_GRADIENT, type SatelliteProductId } from '../services/satelliteLayer';

const FIRST_YEAR = 2015;
const RECENT = 'recent';
// NDVI väärtused legendiribal (vt NDVI_LEGEND_GRADIENT: 0 … 0,9)
const NDVI_LEGEND_TICKS = [
  { label: '0', pos: 0 },
  { label: '0,1', pos: 11 },
  { label: '0,5', pos: 55 },
  { label: '0,9', pos: 100 }
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodRange(period: string): [string, string] {
  const today = new Date();
  if (period === RECENT) {
    const from = new Date(today);
    from.setFullYear(from.getFullYear() - 1);
    return [isoDate(from), isoDate(today)];
  }
  const to = `${period}-12-31`;
  return [`${period}-01-01`, to > isoDate(today) ? isoDate(today) : to];
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Kaardivaade Satiladu pilvevaba otsingu alaks: [lõuna, lääs, põhi, ida], piiratud Eestiga */
function viewBbox(map: L.Map): [number, number, number, number] {
  const b = map.getBounds();
  return [
    Math.max(b.getSouth(), 57.3),
    Math.max(b.getWest(), 21.5),
    Math.min(b.getNorth(), 59.9),
    Math.min(b.getEast(), 28.3)
  ];
}

interface SatellitePanelProps {
  map: L.Map | null;
  product: SatelliteProductId;
  onSelectProduct: (product: SatelliteProductId) => void;
  date: string | null;
  onSelectDate: (date: string | null) => void;
}

export const SatellitePanel: React.FC<SatellitePanelProps> = ({ map, product, onSelectProduct, date, onSelectDate }) => {
  const [period, setPeriod] = useState(RECENT);
  const [cloudFree, setCloudFree] = useState(true);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kaardivaate muutumisel (pilvevaba filter) loetakse loend uuesti
  const [viewKey, setViewKey] = useState(0);

  useEffect(() => {
    if (!map || !cloudFree) return;
    let timer: number;
    const onMove = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setViewKey((k) => k + 1), 600);
    };
    map.on('moveend', onMove);
    return () => {
      clearTimeout(timer);
      map.off('moveend', onMove);
    };
  }, [map, cloudFree]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const [from, to] = periodRange(period);
    const bbox = cloudFree ? viewBbox(map) : undefined;
    if (bbox && (bbox[0] >= bbox[2] || bbox[1] >= bbox[3])) {
      setDates([]);
      setError('Kaardivaade on väljaspool Eestit');
      return;
    }
    setLoading(true);
    api.getSatelliteDates(from, to, bbox)
      .then((list) => {
        if (cancelled) return;
        setDates(list);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setDates([]);
        setError(err instanceof Error ? err.message : 'Satelliidipiltide loend pole saadaval');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [map, period, cloudFree, viewKey]);

  // Valitud kuupäev jääb alles, kui see on uues loendis; muidu võetakse uusim
  useEffect(() => {
    if (loading) return;
    if (!dates.length) {
      if (!error) onSelectDate(null);
      return;
    }
    if (!date || !dates.includes(date)) onSelectDate(dates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, loading]);

  const idx = date ? dates.indexOf(date) : -1;
  const years: string[] = [];
  for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) years.push(String(y));

  return (
    <div className="satellite-panel glass-card">
      <div className="satellite-panel-title">
        Satelliidipilt
        <span className="satellite-panel-source">Sentinel-2 · Satiladu</span>
        {loading && <Loader2 size={12} className="layer-loading-spinner" aria-label="Laadimine" />}
      </div>

      <div className="satellite-product-row" role="radiogroup" aria-label="Toode">
        {(Object.keys(SATELLITE_PRODUCTS) as SatelliteProductId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={product === id}
            className={`basemap-btn ${product === id ? 'active' : ''}`}
            title={SATELLITE_PRODUCTS[id].title}
            onClick={() => onSelectProduct(id)}
          >
            {SATELLITE_PRODUCTS[id].label}
          </button>
        ))}
      </div>

      <div className="satellite-date-row">
        <button
          type="button"
          className="icon-btn-ghost"
          title="Eelmine pilt"
          disabled={idx < 0 || idx >= dates.length - 1}
          onClick={() => onSelectDate(dates[idx + 1])}
        >
          <ChevronLeft size={16} />
        </button>
        <select
          className="form-input satellite-date-select"
          value={date ?? ''}
          onChange={(e) => onSelectDate(e.target.value || null)}
          disabled={!dates.length}
          aria-label="Pildi kuupäev"
        >
          {!dates.length && <option value="">{loading ? 'Laadimine…' : 'Pilte pole'}</option>}
          {dates.map((d) => (
            <option key={d} value={d}>{formatDate(d)}</option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn-ghost"
          title="Järgmine pilt"
          disabled={idx <= 0}
          onClick={() => onSelectDate(dates[idx - 1])}
        >
          <ChevronRight size={16} />
        </button>
        <select
          className="form-input satellite-period-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Periood"
        >
          <option value={RECENT}>Viimased 12 kuud</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <label className="satellite-cloudfree">
        <input type="checkbox" checked={cloudFree} onChange={() => setCloudFree((v) => !v)} />
        <span>Ainult pilvevabad päevad kaardivaate alal</span>
      </label>

      {error ? (
        <div className="satellite-panel-note error">{error}</div>
      ) : !loading && !dates.length ? (
        <div className="satellite-panel-note">
          {cloudFree
            ? 'Selle perioodi jooksul polnud kogu kaardivaade ühelgi päeval pilvevaba — suumi lähemale või lülita filter välja.'
            : 'Selle perioodi kohta pilte pole.'}
        </div>
      ) : !cloudFree ? (
        <div className="satellite-panel-note">Pilves või lennuribast välja jäänud alad on pildil tühjad või valged.</div>
      ) : null}

      {product === 'ndvi' && (
        <div className="satellite-ndvi-legend">
          <div className="satellite-ndvi-bar" style={{ backgroundImage: NDVI_LEGEND_GRADIENT }} />
          <div className="satellite-ndvi-labels">
            {NDVI_LEGEND_TICKS.map((t) => (
              <span key={t.label} style={{ left: `${t.pos}%` }}>{t.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
