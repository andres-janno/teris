// src/components/SatellitePanel.tsx
// Satelliidipildi kihi juhtpaneel kaardil: toode (RGB / NRG / NDVI), periood, kuupäev ja pilvevaba filter.
// Kuupäevad tulevad Satiladust. Pilvevaba filter (Satiladu hinnang, ligikaudne) kehtib kaardil nähtavate põldude ala kohta (nende ümbris,
// piiratud kaardivaatega); kui vaates põlde pole, siis kogu kaardivaate kohta.
import React, { useEffect, useMemo, useState } from 'react';
import type L from 'leaflet';
import * as turf from '@turf/turf';
import type { FieldCollection } from '../types/field';
import { NDVI_CLASSES } from '../services/ndvi';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { SATELLITE_PRODUCTS, NDVI_LEGEND_GRADIENT, type SatelliteProductId } from '../services/satelliteLayer';

const FIRST_YEAR = 2015;
const RECENT = 'recent';
// NDVI väärtused legendiribal (vt NDVI_LEGEND_GRADIENT: 0 … 0,9)
const NDVI_LEGEND_TICKS = [
  { label: '0', pos: 0 },
  { label: '0,25', pos: 27.8 },
  { label: '0,5', pos: 55.6 },
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

type Bbox = [number, number, number, number]; // [lõuna, lääs, põhi, ida]

/**
 * Satiladu pilvevaba otsingu ala: kaardivaates nähtavate põldude ümbris (kaardivaatega lõigatud),
 * kui vaates põlde pole, siis kaardivaade. Piiratud Eestiga.
 */
function cloudFreeArea(map: L.Map, fieldBoxes: Bbox[]): { bbox: Bbox; fieldCount: number } {
  const b = map.getBounds();
  const view: Bbox = [
    Math.max(b.getSouth(), 57.3),
    Math.max(b.getWest(), 21.5),
    Math.min(b.getNorth(), 59.9),
    Math.min(b.getEast(), 28.3)
  ];
  const visible = fieldBoxes.filter((f) => f[0] < view[2] && f[2] > view[0] && f[1] < view[3] && f[3] > view[1]);
  if (!visible.length) return { bbox: view, fieldCount: 0 };
  return {
    bbox: [
      Math.max(view[0], Math.min(...visible.map((f) => f[0]))),
      Math.max(view[1], Math.min(...visible.map((f) => f[1]))),
      Math.min(view[2], Math.max(...visible.map((f) => f[2]))),
      Math.min(view[3], Math.max(...visible.map((f) => f[3])))
    ],
    fieldCount: visible.length
  };
}

interface SatellitePanelProps {
  map: L.Map | null;
  fields: FieldCollection;
  product: SatelliteProductId;
  onSelectProduct: (product: SatelliteProductId) => void;
  date: string | null;
  onSelectDate: (date: string | null) => void;
}

export const SatellitePanel: React.FC<SatellitePanelProps> = ({ map, fields, product, onSelectProduct, date, onSelectDate }) => {
  const [period, setPeriod] = useState(RECENT);
  const [cloudFree, setCloudFree] = useState(true);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kaardivaate muutumisel (pilvevaba filter) loetakse loend uuesti
  const [viewKey, setViewKey] = useState(0);
  // Mitme põllu kohal pilvevaba otsing tehti (0 = kogu kaardivaade)
  const [areaFieldCount, setAreaFieldCount] = useState(0);

  const fieldBoxes = useMemo<Bbox[]>(
    () => fields.features.flatMap((f) => {
      try {
        const [w, s, e, n] = turf.bbox(f);
        return Number.isFinite(w) ? [[s, w, n, e] as Bbox] : [];
      } catch {
        return [];
      }
    }),
    [fields]
  );

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
    const area = cloudFree ? cloudFreeArea(map, fieldBoxes) : null;
    const bbox = area?.bbox;
    setAreaFieldCount(area?.fieldCount ?? 0);
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
  }, [map, period, cloudFree, viewKey, fieldBoxes]);

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
        <span>
          Ainult pilvevabad päevad{' '}
          {areaFieldCount > 0
            ? `nähtavate põldude kohal (${areaFieldCount})`
            : 'kaardivaate alal'}
          <span className="satellite-cloudfree-hint"> — Satiladu hinnang</span>
        </span>
      </label>

      {error ? (
        <div className="satellite-panel-note error">{error}</div>
      ) : !loading && !dates.length ? (
        <div className="satellite-panel-note">
          {cloudFree
            ? `Selle perioodi jooksul polnud ${areaFieldCount > 0 ? 'nähtavate põldude ala' : 'kaardivaade'} ühelgi päeval tervenisti pilvevaba — suumi lähemale (vähem põlde korraga) või lülita filter välja.`
            : 'Selle perioodi kohta pilte pole.'}
        </div>
      ) : !cloudFree ? (
        <div className="satellite-panel-note">Pilves või lennuribast välja jäänud alad on pildil tühjad või valged.</div>
      ) : (
        <div className="satellite-panel-note">
          Satiladu pilvevaba hinnang on ligikaudne — sinna jääb ka õhukese pilve või uduga päevi. Põllul klõpsates
          näed, kui suur osa põllust oli sel päeval tegelikult pilves.
        </div>
      )}

      {product === 'ndvi' && (
        <div className="satellite-ndvi-legend">
          <div className="satellite-ndvi-bar" style={{ backgroundImage: NDVI_LEGEND_GRADIENT }} />
          <div className="satellite-ndvi-labels">
            {NDVI_LEGEND_TICKS.map((t) => (
              <span key={t.label} style={{ left: `${t.pos}%` }}>{t.label}</span>
            ))}
          </div>
          <div className="satellite-ndvi-classes">
            {NDVI_CLASSES.map((c, i) => (
              <span key={c.key}>
                <i style={{ backgroundColor: c.color }} />
                {i === 0 ? '< 0,25' : i === 1 ? '0,25–0,5' : '> 0,5'} {c.label.toLowerCase()}
              </span>
            ))}
          </div>
          <div className="satellite-panel-note">
            Mida rohelisem, seda tihedam elus taimkate. Augustis–septembris on punane enamasti koristatud või
            haritud põld, kevadel hõre oras. Klõpsa põllul, et näha selle päeva keskmist NDVI-d.
          </div>
        </div>
      )}
    </div>
  );
};
