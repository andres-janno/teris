// src/components/SatellitePanel.tsx
// Satelliidipildi kihi juhtpaneel (kaardikihtide kasti all): toode (RGB / NDVI / NRG / DNP), periood, kuupäev ja pilvevaba filter.
// Kuupäevad tulevad Satiladust. Pilvevaba filter on oma pilvekontroll (server, vt satelliteClouds.ts)
// kaardil nähtavate põldude pikslitel; kui vaates põlde pole, siis kogu kaardivaate kohta.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import * as turf from '@turf/turf';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { FieldCollection } from '../types/field';
import { api } from '../services/api';
import { NDVI_CLASSES } from '../services/ndvi';
import { SATELLITE_PRODUCTS, NDVI_LEGEND_GRADIENT, SATELLITE_COLOR_LEGENDS, type SatelliteProductId } from '../services/satelliteLayer';

const FIRST_YEAR = 2015;
const RECENT = 'recent';
// NDVI väärtused legendiribal (vt NDVI_LEGEND_GRADIENT: 0 … 0,9)
const NDVI_LEGEND_TICKS = [
  { label: '0', pos: 0 },
  { label: '0,25', pos: 27.8 },
  { label: '0,5', pos: 55.6 },
  { label: '0,9', pos: 100 }
];
// Sama mis serveris (satelliteClouds.ts): andmeid ≥ 90% põldudest, pilves ≤ 10%
const CLEAR_MIN_COVERAGE = 0.9;
const CLEAR_MAX_CLOUD = 0.1;

type CloudStat = { date: string; coverage: number; cloud: number };
type Polygons = number[][][][];
type CheckArea = { key: string; polygons: Polygons; fieldCount: number };

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

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Pilvekontrolli ala: kaardivaates nähtavad põllud (hulknurgad); kui neid pole, siis kaardivaate
 * ristkülik (Eestiga piiratud). key muutub ainult siis, kui ala sisu muutub.
 */
function cloudCheckArea(map: L.Map, fields: FieldCollection): CheckArea | null {
  const b = map.getBounds();
  const s = Math.max(b.getSouth(), 57.3), w = Math.max(b.getWest(), 21.5);
  const n = Math.min(b.getNorth(), 59.9), e = Math.min(b.getEast(), 28.3);
  if (s >= n || w >= e) return null;
  const visible = fields.features.filter((f) => {
    try {
      const [fw, fs, fe, fn] = turf.bbox(f);
      return fs < n && fn > s && fw < e && fe > w;
    } catch {
      return false;
    }
  });
  if (visible.length) {
    const polygons = visible.flatMap((f) =>
      (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
        .map((poly) => poly.map((ring) => ring.map((p) => [round6(p[0]), round6(p[1])])))
    );
    const ids = visible.map((f) => String(f.properties.id)).sort().join(',');
    return { key: `fields:${ids}`, polygons, fieldCount: visible.length };
  }
  const ring = [[w, s], [e, s], [e, n], [w, n], [w, s]].map((p) => [round6(p[0]), round6(p[1])]);
  return { key: `view:${[s, w, n, e].map((v) => v.toFixed(2)).join(',')}`, polygons: [[ring]], fieldCount: 0 };
}

interface SatellitePanelProps {
  map: L.Map | null;
  fields: FieldCollection;
  product: SatelliteProductId;
  onSelectProduct: (product: SatelliteProductId) => void;
  date: string | null;
  onSelectDate: (date: string | null) => void;
  fieldsOnly: boolean;
  onToggleFieldsOnly: () => void;
  /** Kuhu paneel joonistatakse (kaardikihtide kasti alla); kui puudub, siis kaardi peale */
  host?: HTMLElement | null;
}

export const SatellitePanel: React.FC<SatellitePanelProps> = ({
  map,
  fields,
  product,
  onSelectProduct,
  date,
  onSelectDate,
  fieldsOnly,
  onToggleFieldsOnly,
  host
}) => {
  const [period, setPeriod] = useState(RECENT);
  const [cloudFree, setCloudFree] = useState(true);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [cloudStats, setCloudStats] = useState<CloudStat[]>([]);
  const [progress, setProgress] = useState<{ checked: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [area, setArea] = useState<CheckArea | null>(null);

  // Pilvekontrolli ala: arvutatakse kaardi liigutamisel ja põldude muutumisel; sama sisuga ala ei käivita uut päringut
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const next = cloudCheckArea(map, fields);
      setArea((prev) => (prev?.key === next?.key ? prev : next));
    };
    update();
    let timer: number;
    const onMove = () => {
      clearTimeout(timer);
      timer = window.setTimeout(update, 600);
    };
    map.on('moveend', onMove);
    return () => {
      clearTimeout(timer);
      map.off('moveend', onMove);
    };
  }, [map, fields]);

  // Kõik perioodi pildipäevad (filtrita)
  useEffect(() => {
    if (cloudFree) return;
    let cancelled = false;
    const [from, to] = periodRange(period);
    setLoading(true);
    setError(null);
    api.getSatelliteDates(from, to)
      .then((list) => {
        if (!cancelled) setAllDates(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setAllDates([]);
        setError(err instanceof Error ? err.message : 'Satelliidipiltide loend pole saadaval');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, cloudFree]);

  // Pilvevabad päevad: server kontrollib päevi järjest (uusim ees); korratakse, kuni kõik on kontrollitud
  useEffect(() => {
    if (!cloudFree) return;
    setCloudStats([]);
    setProgress(null);
    if (!area) {
      setLoading(false);
      setError('Kaardivaade on väljaspool Eestit');
      return;
    }
    let cancelled = false;
    const [from, to] = periodRange(period);
    setError(null);
    setLoading(true);
    const run = async () => {
      try {
        for (;;) {
          const res = await api.checkSatelliteClouds(from, to, area.polygons);
          if (cancelled) return;
          setCloudStats(res.stats);
          setProgress({ checked: res.stats.length, total: res.total });
          if (res.stats.length >= res.total) break;
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled) return;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Pilvisuse kontroll ebaõnnestus');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [period, cloudFree, area]);

  const clearStats = cloudStats.filter((s) => s.coverage >= CLEAR_MIN_COVERAGE && s.cloud <= CLEAR_MAX_CLOUD);
  const cloudByDate = new Map(clearStats.map((s) => [s.date, s.cloud]));
  const dates = cloudFree ? clearStats.map((s) => s.date) : allDates;
  const datesKey = dates.join(',');

  // Valitud kuupäev jääb alles, kui see on loendis; muidu võetakse uusim. Kontrolli ajal valitakse
  // esimene leitud päev, kuid kasutaja valikut ei muudeta enne, kui kontroll on lõppenud.
  useEffect(() => {
    if (!dates.length) {
      if (!loading && !error) onSelectDate(null);
      return;
    }
    if (!date || (!loading && !dates.includes(date))) onSelectDate(dates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey, loading]);

  const idx = date ? dates.indexOf(date) : -1;
  const years: string[] = [];
  for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) years.push(String(y));
  const fieldCount = area?.fieldCount ?? 0;
  const colorLegend = SATELLITE_COLOR_LEGENDS[product];

  const panel = (
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
          {!dates.length && <option value="">{loading ? 'Otsin…' : 'Pilte pole'}</option>}
          {date && dates.length > 0 && !dates.includes(date) && <option value={date}>{formatDate(date)}</option>}
          {dates.map((d) => {
            const cloud = cloudByDate.get(d);
            return (
              <option key={d} value={d}>
                {formatDate(d)}{cloud !== undefined ? ` · pilves ${Math.round(cloud * 100)}%` : ''}
              </option>
            );
          })}
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

      <label className="satellite-cloudfree" title="Põldudest väljapoole jäävaid kaardiplaate ei laadita — kiirem ja selgem">
        <input type="checkbox" checked={fieldsOnly} onChange={onToggleFieldsOnly} />
        <span>Näita pilti ainult põldudel</span>
      </label>

      <label className="satellite-cloudfree">
        <input type="checkbox" checked={cloudFree} onChange={() => setCloudFree((v) => !v)} />
        <span>
          Ainult pilvevabad päevad{' '}
          {fieldCount > 0 ? `nähtavatel põldudel (${fieldCount})` : 'kaardivaate alal'}
        </span>
      </label>

      {cloudFree && progress && progress.checked < progress.total && (
        <div className="satellite-progress" title="Esimesel korral laaditakse iga päeva pilt; edaspidi on tulemus kohe olemas">
          <div className="satellite-progress-bar">
            <div style={{ width: `${(progress.checked / Math.max(1, progress.total)) * 100}%` }} />
          </div>
          <span>Kontrollin pilvisust: {progress.checked} / {progress.total} päeva</span>
        </div>
      )}

      {error ? (
        <div className="satellite-panel-note error">{error}</div>
      ) : !loading && !dates.length ? (
        <div className="satellite-panel-note">
          {cloudFree
            ? `Selle perioodi jooksul polnud ${fieldCount > 0 ? 'nähtavad põllud' : 'kaardivaade'} ühelgi päeval pilvevaba — suumi lähemale (vähem põlde korraga) või lülita filter välja.`
            : 'Selle perioodi kohta pilte pole.'}
        </div>
      ) : cloudFree ? (
        <div className="satellite-panel-note">
          Pilvevaba = pildil on ≥ 90% {fieldCount > 0 ? 'põldudest' : 'alast'} ja sellest pilves või udus ≤ 10%.
        </div>
      ) : (
        <div className="satellite-panel-note">Pilves või lennuribast välja jäänud alad on pildil tühjad või valged.</div>
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

      {colorLegend && (
        <div className="satellite-ndvi-legend">
          <div className="satellite-color-legend">
            {colorLegend.map((c) => (
              <span key={c.label}>
                <i style={{ backgroundColor: c.color }} />
                {c.label}
              </span>
            ))}
          </div>
          <div className="satellite-panel-note">
            {product === 'nrg'
              ? 'Lähi-infrapuna on punane kanal: taimed peegeldavad seda tugevalt, seega mida erksam punane, seda elujõulisem taimkate. Kahvatu või tumepunane põld kasvuajal viitab kehvemale kasvule.'
              : 'Punane kanal = NDVI (taimkate), roheline = lähi-infrapuna (biomass), sinine = NDPI (niiskus). Kollasel põllul on nii taimkate kui biomass suured; lilla toon tähendab niisket mulda ja vähest taimkatet.'}
          </div>
        </div>
      )}
    </div>
  );

  return host ? createPortal(panel, host) : panel;
};
