// src/components/SatellitePanel.tsx
// Satelliidipildi kihi juhtpaneel (kaardikihtide kasti all): toode (RGB / NDVI / NRG / NDPI / DNP), periood, kuupäev ja pilvevaba filter.
// Kuupäevad tulevad Satiladust. Pilvevaba filter on oma pilvekontroll (server, vt satelliteClouds.ts)
// kaardil nähtavate põldude pikslitel; kui vaates põlde pole, siis kogu kaardivaate kohta.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import * as turf from '@turf/turf';
import { ChevronLeft, ChevronRight, Loader2, Pause, Play } from 'lucide-react';
import type { FieldCollection } from '../types/field';
import { api } from '../services/api';
import { NDVI_CLASSES } from '../services/ndvi';
import { SATELLITE_PRODUCTS, NDVI_LEGEND_GRADIENT, NDPI_LEGEND_GRADIENT, SATELLITE_COLOR_LEGENDS, type SatelliteProductId } from '../services/satelliteLayer';
import { Button, Card, CheckboxField, LegendItem, ProgressBar, Select, ToggleGroup, ToggleGroupItem, cn, type SelectOption } from './ui';
import { loadingSpinnerInlineClass } from './ui/variants';

const FIRST_YEAR = 2015;
const RECENT = 'recent';
// NDVI väärtused legendiribal (vt NDVI_LEGEND_GRADIENT: 0 … 0,9)
const NDVI_LEGEND_TICKS = [
  { label: '0', pos: 0 },
  { label: '0,25', pos: 27.8 },
  { label: '0,5', pos: 55.6 },
  { label: '0,9', pos: 100 }
];
// NDPI värvid pildil (mõõdetud Satiladu pildilt 13.08.2025, võrreldes sama koha RGB pildiga)
const NDPI_CLASSES = [
  { color: 'rgb(222,202,57)', label: 'Paljas haritud muld (künd, külvieelne põld)' },
  { color: 'rgb(160,146,96)', label: 'Kõrs, koristatud põld' },
  { color: 'rgb(89,81,141)', label: 'Taimkate (põllukultuur, rohumaa)' },
  { color: 'rgb(59,54,158)', label: 'Mets' },
  { color: 'rgb(0,0,133)', label: 'Vesi' }
];
// NDPI väärtused legendiribal (vt NDPI_LEGEND_GRADIENT: −1 … 0,5)
const NDPI_LEGEND_TICKS = [
  { label: '−1', pos: 0 },
  { label: '0', pos: 66.7 },
  { label: '0,5', pos: 100 }
];
// Sama mis serveris (satelliteClouds.ts): andmeid ≥ 90% põldudest, pilves ≤ 10%
const CLEAR_MIN_COVERAGE = 0.9;
const CLEAR_MAX_CLOUD = 0.1;

// Paneeli tekstid (vana .satellite-panel-note: 11px, rea kõrgus 1,35 ≈ 15px)
const NOTE = 'text-2xs leading-3.75';
// Alumine ja ülemine kuupäevarida (vana .satellite-date-row): nool · kuupäev · nool; esitus · periood
const DATE_ROW = 'grid items-center gap-1';
// Märkeruut paneeli 12px kirjas (vana .satellite-cloudfree: flex, 6px vahe, font-size inherit, nupp ilma ülavaheta);
// rea kõrgus jääb 18px (vana CheckboxField text-sm rida), mitte text-xs 16px
const CLOUDFREE = 'flex items-center gap-1.5 text-xs leading-4.5 [&>button]:mt-0';
// Legendi loend (NDPI ja värvilegend): read ühe rea kaupa, väike kiri
const LEGEND_LIST = 'flex flex-col gap-0.5 text-2xs';

// Legendiriba väärtused: esimene vasakus servas, viimane paremas, ülejäänud keskel
const LegendTicks: React.FC<{ ticks: { label: string; pos: number }[] }> = ({ ticks }) => (
  <div className="relative h-3 text-2xs leading-natural">
    {ticks.map((t, i) => (
      <span key={t.label} className={cn('absolute top-px', i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2')} style={{ left: `${t.pos}%` }}>
        {t.label}
      </span>
    ))}
  </div>
);

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

// Sentinel-2 lendab Eesti kohalt üle päikesega sünkroonsel orbiidil alati u 09:30–09:45 UTC
// (Copernicuse kataloogi järgi); täpset aega Satiladu ei anna, seega näidatakse vahemikku Eesti ajas.
const PASS_UTC_FROM: [number, number] = [9, 30];
const PASS_UTC_TO: [number, number] = [9, 45];
const tallinnTime = new Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit' });

function passTimeRange(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const at = ([h, min]: [number, number]) => tallinnTime.format(new Date(Date.UTC(y, m - 1, d, h, min)));
  return `${at(PASS_UTC_FROM)}–${at(PASS_UTC_TO)}`;
}

// Animatsioon: iga kaader püsib pärast laadimist nii kaua; uusim pilt kauem enne algusesse naasmist
const PLAY_FRAME_MS = 900;
const PLAY_LAST_FRAME_MS = 2500;

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
  /** Kas valitud kuupäeva pilt on kaardil täielikult laaditud */
  loaded?: boolean;
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
  host,
  loaded = false
}) => {
  const [period, setPeriod] = useState(RECENT);
  const [cloudFree, setCloudFree] = useState(true);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [cloudStats, setCloudStats] = useState<CloudStat[]>([]);
  const [progress, setProgress] = useState<{ checked: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [area, setArea] = useState<CheckArea | null>(null);
  const [playing, setPlaying] = useState(false);

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

  // Animatsioon vanimast uusimani (loend on uusim ees); järgmisele päevale liigutakse alles siis,
  // kui praegune pilt on laaditud. Pärast uusimat alustatakse uuesti vanimast.
  useEffect(() => {
    if (!playing) return;
    if (dates.length < 2) {
      setPlaying(false);
      return;
    }
    if (!loaded || idx < 0) return;
    const timer = window.setTimeout(
      () => onSelectDate(idx === 0 ? dates[dates.length - 1] : dates[idx - 1]),
      idx === 0 ? PLAY_LAST_FRAME_MS : PLAY_FRAME_MS
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loaded, date, datesKey]);

  const togglePlay = () => {
    // Uusimalt pildilt alustades minnakse kohe perioodi algusesse
    if (!playing && idx === 0 && dates.length > 1) onSelectDate(dates[dates.length - 1]);
    setPlaying((v) => !v);
  };
  const years: string[] = [];
  for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) years.push(String(y));
  const periodOptions: SelectOption[] = [
    { value: RECENT, label: 'Viimased 12 kuud' },
    ...years.map((y) => ({ value: y, label: y }))
  ];
  const dateOptions: SelectOption[] = [
    ...(!dates.length ? [{ value: '', label: loading ? 'Otsin…' : 'Pilte pole' }] : []),
    ...(date && dates.length > 0 && !dates.includes(date) ? [{ value: date, label: formatDate(date) }] : []),
    ...dates.map((d) => {
      const cloud = cloudByDate.get(d);
      return { value: d, label: `${formatDate(d)}${cloud !== undefined ? ` · pilves ${Math.round(cloud * 100)}%` : ''}` };
    })
  ];
  const fieldCount = area?.fieldCount ?? 0;
  const colorLegend = SATELLITE_COLOR_LEGENDS[product];

  const panel = (
    <Card variant="floating" padding="sm" className="flex w-full flex-col gap-1.5 text-xs leading-natural text-muted-foreground">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        Satelliidipilt
        <span className="font-medium text-muted-foreground">Sentinel-2 · Satiladu</span>
        {loading && <Loader2 size={12} className={loadingSpinnerInlineClass} aria-label="Laadimine" />}
      </div>

      <ToggleGroup
        className="flex w-full"
        aria-label="Satelliidi toode"
        value={product}
        onValueChange={(next) => onSelectProduct(next as SatelliteProductId)}
      >
        {(Object.keys(SATELLITE_PRODUCTS) as SatelliteProductId[]).map((id) => (
          <ToggleGroupItem key={id} value={id} className="min-w-0 flex-1 justify-center px-1" title={SATELLITE_PRODUCTS[id].title}>
            {SATELLITE_PRODUCTS[id].label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className={cn(DATE_ROW, 'grid-cols-[auto_minmax(0,1fr)_auto]')}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Eelmine pilt"
          disabled={idx < 0 || idx >= dates.length - 1}
          onClick={() => onSelectDate(dates[idx + 1])}
        >
          <ChevronLeft size={16} />
        </Button>
        <Select
          size="sm"
          className="min-w-0"
          value={dates.length ? (date ?? '') : ''}
          onValueChange={(v) => onSelectDate(v || null)}
          disabled={!dates.length}
          aria-label="Pildi kuupäev"
          options={dateOptions}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Järgmine pilt"
          disabled={idx <= 0}
          onClick={() => onSelectDate(dates[idx - 1])}
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className={cn(DATE_ROW, 'grid-cols-[auto_minmax(0,1fr)]')}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={playing ? 'Peata' : 'Mängi pildid läbi vanimast uusimani'}
          aria-pressed={playing}
          disabled={dates.length < 2}
          onClick={togglePlay}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span>{playing ? 'Peata' : 'Esita'}</span>
        </Button>
        <Select
          size="sm"
          className="min-w-0"
          value={period}
          onValueChange={setPeriod}
          aria-label="Periood"
          options={periodOptions}
        />
      </div>

      {date && (
        <div className={NOTE} title="Sentinel-2 lendab Eesti kohalt üle alati keskpäeva paiku; sama koha kohta tuleb pilt keskmiselt iga 2–3 päeva järel">
          Pildistatud {formatDate(date)} umbes kell {passTimeRange(date)}
        </div>
      )}

      <CheckboxField
        className={CLOUDFREE}
        checked={fieldsOnly}
        onCheckedChange={() => onToggleFieldsOnly()}
        label={<span title="Põldudest väljapoole jäävaid kaardiplaate ei laadita — kiirem ja selgem">Näita pilti ainult põldudel</span>}
      />

      <CheckboxField
        className={CLOUDFREE}
        checked={cloudFree}
        onCheckedChange={setCloudFree}
        label={`Ainult pilvevabad päevad ${fieldCount > 0 ? `nähtavatel põldudel (${fieldCount})` : 'kaardivaate alal'}`}
      />

      {cloudFree && progress && progress.checked < progress.total && (
        <div className="flex flex-col gap-0.5 text-2xs leading-natural" title="Esimesel korral laaditakse iga päeva pilt; edaspidi on tulemus kohe olemas">
          <ProgressBar className="h-1 [&>div]:transition-[width] [&>div]:duration-300" value={(progress.checked / Math.max(1, progress.total)) * 100} aria-label="Pilvisuse kontroll" />
          <span>Kontrollin pilvisust: {progress.checked} / {progress.total} päeva</span>
        </div>
      )}

      {error ? (
        <div className={cn(NOTE, 'text-destructive')}>{error}</div>
      ) : !loading && !dates.length ? (
        <div className={NOTE}>
          {cloudFree
            ? `Selle perioodi jooksul polnud ${fieldCount > 0 ? 'nähtavad põllud' : 'kaardivaade'} ühelgi päeval pilvevaba — suumi lähemale (vähem põlde korraga) või lülita filter välja.`
            : 'Selle perioodi kohta pilte pole.'}
        </div>
      ) : cloudFree ? (
        <div className={NOTE}>
          Pilvevaba = pildil on ≥ 90% {fieldCount > 0 ? 'põldudest' : 'alast'} ja sellest pilves või udus ≤ 10%.
        </div>
      ) : (
        <div className={NOTE}>Pilves või lennuribast välja jäänud alad on pildil tühjad või valged.</div>
      )}

      {product === 'ndvi' && (
        <div>
          <div className="h-2 rounded-sm" style={{ backgroundImage: NDVI_LEGEND_GRADIENT }} />
          <LegendTicks ticks={NDVI_LEGEND_TICKS} />
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-2xs">
            {NDVI_CLASSES.map((c, i) => (
              <LegendItem key={c.key} color={c.color} className="gap-1 text-2xs leading-natural" label={`${i === 0 ? '< 0,25' : i === 1 ? '0,25–0,5' : '> 0,5'} ${c.label.toLowerCase()}`} />
            ))}
          </div>
          <div className={NOTE}>
            Mida rohelisem, seda tihedam elus taimkate. Augustis–septembris on punane enamasti koristatud või
            haritud põld, kevadel hõre oras. Klõpsa põllul, et näha selle päeva keskmist NDVI-d.
          </div>
        </div>
      )}

      {product === 'ndpi' && (
        <div>
          <div className="h-2 rounded-sm" style={{ backgroundImage: NDPI_LEGEND_GRADIENT }} />
          <LegendTicks ticks={NDPI_LEGEND_TICKS} />
          <div className={LEGEND_LIST}>
            {NDPI_CLASSES.map((c) => (
              <LegendItem key={c.label} color={c.color} className="items-start text-2xs leading-natural" label={c.label} />
            ))}
          </div>
          <div className={NOTE}>
            Veekogude indeks: vesi on alla nulli (tumesinine), taimkate madal, paljas muld kõrge. Mida
            kollasem põld, seda vähem on sellel taimi — hea künni, külvieelse põllu ja tühjade laikude
            leidmiseks.
          </div>
        </div>
      )}

      {colorLegend && (
        <div>
          <div className={LEGEND_LIST}>
            {colorLegend.map((c) => (
              <LegendItem key={c.label} color={c.color} className="items-start text-2xs leading-natural" label={c.label} />
            ))}
          </div>
          <div className={NOTE}>
            {product === 'nrg'
              ? 'Lähi-infrapuna on punane kanal: taimed peegeldavad seda tugevalt, seega mida erksam punane, seda elujõulisem taimkate. Kahvatu või tumepunane põld kasvuajal viitab kehvemale kasvule.'
              : 'Punane kanal = NDVI (taimkate), roheline = lähi-infrapuna (biomass), sinine = NDPI (paljas muld). Kollasel põllul on nii taimkate kui biomass suured; lilla toon tähendab paljast mulda.'}
          </div>
        </div>
      )}
    </Card>
  );

  return host ? createPortal(panel, host) : panel;
};
