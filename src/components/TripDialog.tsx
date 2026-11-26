// src/components/TripDialog.tsx — ühe sõidu aken: rada kaardil, läbitud kohad, mõõdikud, haakeriist/laius ja märkus.
import { TRIP_MAP_COLOR } from '../lib/dataColors';
import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { ChevronDown, ChevronRight, Route } from 'lucide-react';
import type { Implement, Trip, TripStopInfo } from '../types/fleet';
import { api } from '../services/api';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { formatQty } from '../services/units';
import { formatDate } from '../services/dateFormat';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { cellSubClass, cellSubStackedClass, tableMutedClass } from './ui/variants';
import { Alert, Button, StatTile, LegendItem, Field, NumberInput, Select, Textarea, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from './ui';

// Aja jaotuse riba osad; värvid on tokenid (teemapõhised muutujad --trip-*). Täielikud nimed, et Tailwind need näeks.
const TIME_PART_CLASS = { moving: 'bg-trip-moving', idle: 'bg-trip-idle', pause: 'bg-trip-pause' } as const;
// Algus/lõpu täpi värv sama mis kaardi markeritel
const STOP_DOT_COLOR = { start: TRIP_MAP_COLOR.start, end: TRIP_MAP_COLOR.end } as const;
const STOP_ROW = 'relative flex items-baseline gap-2.5 text-sm leading-natural';
const STOP_DOT = 'size-2.5 shrink-0 self-center rounded-full ring-2 ring-popover';
const STOP_TIME = 'whitespace-nowrap tabular-nums text-foreground';

interface TripDialogProps {
  trip: Trip;
  implementsList?: Implement[];
  onClose: () => void;
  onSaved: (trip: Trip) => void;
  canDelete?: boolean; // admin: kustutamine ja taastamine
  onChanged?: () => void; // sõit kustutati või taastati: sulge aken ja lae loend uuesti
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void; // kande link: avab põllu töö
}

export const placeText = (s: TripStopInfo): string => {
  if (s.place) return s.place.label;
  if (s.near) return `tundmatu (${s.near.label} ${Math.round(s.near.distanceM)} m)`;
  return 'tundmatu';
};

const timeOnly = (iso: string) => formatDateTime(iso).slice(11);
const minutesText = (m: number) => formatDuration(new Date(0).toISOString(), new Date(m * 60_000).toISOString());

export const TripDialog: React.FC<TripDialogProps> = ({ trip, implementsList = [], onClose, onSaved, onOpenFieldWork, canDelete = false, onChanged }) => {
  // Kaardi element olekus: dialoogi sisu portaalitakse alles pärast esimest renderdust, siis pole ref veel olemas.
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const [implementId, setImplementId] = useState(trip.implementId ?? '');
  const [widthM, setWidthM] = useState<number | null>(trip.widthM ?? null);
  const [notes, setNotes] = useState(trip.notes ?? '');
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    setImplementId(trip.implementId ?? '');
    setWidthM(trip.widthM ?? null);
    setNotes(trip.notes ?? '');
  }, [trip.id, trip.implementId, trip.widthM, trip.notes, trip.manualImplement]);

  const implementOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Puudub' }, ...implementsList.map((i) => ({
      value: i.id,
      label: i.workingWidthM != null ? `${i.name} (${formatQty(i.workingWidthM)} m)` : i.name
    }))];
    if (implementId && !implementsList.some((i) => i.id === implementId)) {
      opts.push({ value: implementId, label: trip.implementName ?? 'Kustutatud haakeriist' });
    }
    return opts;
  }, [implementsList, implementId, trip.implementName]);

  const swathKey = trip.fields.map((f) => `${f.fieldSeasonId}:${f.widthM ?? ''}`).join(',');

  useEffect(() => {
    if (!mapEl) return;
    const map = L.map(mapEl, { zoomControl: true, attributionControl: true });
    const base = BASE_MAPS['maaamet-pohikaart'];
    L.tileLayer(base.url, {
      tms: base.tms ?? false, attribution: base.attribution,
      maxZoom: base.maxZoom || 19, minZoom: base.minZoom || 5, subdomains: base.subdomains || []
    }).addTo(map);
    const start = L.circleMarker([trip.start.lat, trip.start.lng], { radius: 7, color: TRIP_MAP_COLOR.start, fillOpacity: 1 }).addTo(map).bindTooltip('Algus');
    L.circleMarker([trip.end.lat, trip.end.lng], { radius: 7, color: TRIP_MAP_COLOR.end, fillOpacity: 1 }).addTo(map).bindTooltip('Lõpp');
    map.setView(start.getLatLng(), 14);
    let cancelled = false;
    let onZoom: (() => void) | null = null;
    api.getTripTrack(trip.id).then(({ points: pts, swaths }) => {
      if (cancelled || pts.length === 0) return;
      // Põllulõigud haakeriista laiusega: laius pikslites sõltub suumist, seega uuendame suumimisel
      const swathLines = swaths.flatMap((sw) => sw.lines.map((ln) => ({
        widthM: sw.widthM,
        layer: L.polyline(ln, { color: TRIP_MAP_COLOR.swath, opacity: 0.35, weight: 1, lineCap: 'butt', lineJoin: 'round', interactive: false }).addTo(map)
      })));
      if (swathLines.length) {
        onZoom = () => {
          const mPerPx = (40075016.686 * Math.cos((map.getCenter().lat * Math.PI) / 180)) / 2 ** (map.getZoom() + 8);
          for (const s of swathLines) s.layer.setStyle({ weight: Math.max(1, s.widthM / mPerPx) });
        };
        map.on('zoomend', onZoom);
      }
      const line = L.polyline(pts, { color: TRIP_MAP_COLOR.track, weight: 3 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24], maxZoom: 17 });
      onZoom?.(); // fitBounds ei pruugi suumi muuta
    }).catch((e) => { if (!cancelled) setTrackError(e.message); });
    const t = window.setTimeout(() => map.invalidateSize(), 250);
    return () => { cancelled = true; window.clearTimeout(t); if (onZoom) map.off('zoomend', onZoom); map.remove(); };
  }, [mapEl, trip.id, trip.start.lat, trip.start.lng, trip.end.lat, trip.end.lng, swathKey]);

  const implDirty = implementId !== (trip.implementId ?? '') || widthM !== (trip.widthM ?? null);
  const notesDirty = notes !== (trip.notes ?? '');
  const dirty = implDirty || notesDirty;

  const handleImplementChange = (nextId: string) => {
    setImplementId(nextId);
    if (nextId) {
      const impl = implementsList.find((i) => i.id === nextId);
      setWidthM(impl?.workingWidthM ?? null);
    } else if (implementId) {
      setWidthM(null);
    }
  };

  const save = async () => {
    if (implDirty && widthM != null && !(widthM > 0)) {
      setError('Töölaius peab olema suurem kui 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch: Parameters<typeof api.updateTrip>[1] = {};
      if (notesDirty) patch.notes = notes.trim() || null;
      if (implDirty) {
        patch.manualImplement = true;
        patch.implementId = implementId || null;
        patch.widthM = widthM;
      }
      onSaved(await api.updateTrip(trip.id, patch));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetImplement = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.updateTrip(trip.id, { manualImplement: false }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog('Kustuta sõit? Sõit kaob registrist ja kande soovitustest. Telemeetria toorandmed jäävad alles; sõidu saab hiljem taastada.'))) return;
    setSaving(true);
    try {
      await api.deleteTrip(trip.id);
      (onChanged ?? onClose)();
    } catch (e) {
      alertDialog((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    setSaving(true);
    try {
      await api.restoreTrip(trip.id);
      (onChanged ?? onClose)();
    } catch (e) {
      alertDialog((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const who = trip.vehicleName ?? `${trip.deviceLabel} — seos puudub`;
  const active = trip.status === 'ACTIVE';
  // Põhinumbrid: alati neli kasti (andmete puudumisel „—“), et paigutus ei hüppaks sõidult sõidule
  const duration = formatDuration(trip.startedAt, trip.endedAt);
  const tiles: { label: string; value: string; unit?: string; empty: boolean }[] = [
    { label: 'Kestus', value: duration, empty: duration === '—' },
    { label: 'Läbitud', value: formatQty(trip.distanceKm), unit: 'km', empty: false },
    { label: 'Tehtud pindala', value: trip.areaHa == null ? '—' : formatQty(trip.areaHa), unit: trip.areaHa == null ? undefined : 'ha', empty: trip.areaHa == null },
    { label: 'Kütus', value: trip.fuelLiters == null ? '—' : formatQty(trip.fuelLiters), unit: trip.fuelLiters == null ? undefined : 'l', empty: trip.fuelLiters == null }
  ];
  // Aja jaotus: liikumine / seisuaeg süütega / pausid (osad proportsionaalsed, null osa ei joonistu)
  const timeParts = [
    { key: 'moving' as const, label: 'Liikumine', minutes: trip.movingMinutes },
    { key: 'idle' as const, label: 'Seisuaeg süütega', minutes: trip.idleMinutes },
    { key: 'pause' as const, label: trip.pauseCount ? `Pausid (${trip.pauseCount})` : 'Pausid', minutes: trip.pauseMinutes }
  ];
  const timeTotal = timeParts.reduce((s, p) => s + p.minutes, 0);
  // Lisanäitajad: ainult need, mille kohta seade andmeid saadab
  const details: [string, string][] = [];
  if (trip.maxSpeedKmh != null || trip.avgSpeedKmh != null) {
    details.push(['Kiirus', [trip.maxSpeedKmh != null ? `max ${formatQty(trip.maxSpeedKmh)} km/h` : null,
      trip.avgSpeedKmh != null ? `keskmine ${formatQty(trip.avgSpeedKmh)} km/h` : null].filter(Boolean).join(' · ')]);
  }
  if (trip.fuelLevelStartPct != null) {
    details.push(['Kütusetase', `${formatQty(trip.fuelLevelStartPct)} % → ${formatQty(trip.fuelLevelEndPct ?? trip.fuelLevelStartPct)} %`]);
  }
  if (trip.engineHoursStart != null) {
    details.push(['Mootoritunnid', `${formatQty(trip.engineHoursStart)} → ${formatQty(trip.engineHoursEnd ?? trip.engineHoursStart)} h`]);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg" dismissible={!saving}>
        <DialogHeader icon={<Route size={20} />} title={`${who}${trip.implementName ? ` + ${trip.implementName}` : ''}`} />
        <DialogBody>
          {trip.deletedAt && <Alert tone="error">Kustutatud {formatDateTime(trip.deletedAt)}</Alert>}
          {/* shrink-0: dialoogi sisu on flex-veerg, ilma selleta kahaneb kaart 0 kõrguseks */}
          <div ref={setMapEl} className="mb-3 h-64 shrink-0 rounded-md" />
          {trackError && <Alert tone="error">{trackError}</Alert>}
          {/* Algus ja lõpp: täppide värv sama mis kaardi markeritel */}
          <div className="relative mb-3 flex flex-col gap-2 pl-0.5 before:absolute before:top-3 before:bottom-3 before:left-1.5 before:w-0.5 before:bg-border before:content-['']">
            <div className={STOP_ROW}>
              <span className={STOP_DOT} style={{ backgroundColor: STOP_DOT_COLOR.start }} aria-hidden="true" />
              <span className={STOP_TIME}>{formatDateTime(trip.startedAt)}</span>
              <span className="text-muted-foreground">{placeText(trip.start)}</span>
            </div>
            <div className={STOP_ROW}>
              <span className={STOP_DOT} style={{ backgroundColor: STOP_DOT_COLOR.end }} aria-hidden="true" />
              <span className={STOP_TIME}>{active ? 'käimas' : formatDateTime(trip.endedAt)}</span>
              <span className="text-muted-foreground">{active ? '' : placeText(trip.end)}</span>
            </div>
          </div>

          <div className="mb-4 rounded-md border border-border bg-muted p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <Field label="Haakeriist" htmlFor="trip-implement">
                  <Select
                    id="trip-implement"
                    value={implementId}
                    onValueChange={handleImplementChange}
                    options={implementOptions}
                    disabled={saving}
                  />
                </Field>
              </div>
              <div className="w-32 shrink-0">
                <Field label="Töölaius" htmlFor="trip-width">
                  <NumberInput
                    id="trip-width"
                    value={widthM}
                    onChange={setWidthM}
                    min={0.1}
                    decimals={2}
                    end="m"
                    placeholder="nt 6"
                    disabled={saving}
                  />
                </Field>
              </div>
            </div>
            {trip.manualImplement && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs leading-natural text-muted-foreground">
                <span>Haakeriist/laius on määratud sellel sõidul.</span>
                <Button type="button" variant="link" size="inline" onClick={resetImplement} disabled={saving}>
                  Taasta registri järgi
                </Button>
              </div>
            )}
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2.5 max-[641px]:grid-cols-2">
            {tiles.map((t) => (
              <StatTile key={t.label} label={t.label} value={t.value} unit={t.unit} empty={t.empty} />
            ))}
          </div>

          {trip.fields.length > 0 && (
            <div className="mb-4">
              <h4>Põllud</h4>
              <Table scroll="none">
                <TableHeader>
                  <TableRow>
                    <TableHead>Põld</TableHead>
                    <TableHead>Põllul</TableHead>
                    <TableHead numeric>ha</TableHead>
                    <TableHead numeric title="Põllu kütus koos osaga teel kulunud kütusest; all põllul kulunud kütus">Kütus l</TableHead>
                    <TableHead>Kanne</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.fields.map((f) => (
                    <TableRow key={f.fieldSeasonId}>
                      <TableCell wrap>{f.label}</TableCell>
                      <TableCell>{timeOnly(f.arriveAt)}–{timeOnly(f.leaveAt)} · {minutesText(f.activeMinutes)}</TableCell>
                      <TableCell numeric wrap>
                        {f.areaHa == null ? '—' : formatQty(f.areaHa)}
                        <div className={cellSubStackedClass}>
                          {f.implementName
                            ? `${f.implementName}${f.widthM != null ? `, ${formatQty(f.widthM)} m` : ''}`
                            : f.widthM != null
                              ? `${formatQty(f.widthM)} m`
                              : 'haakeriist puudub'}
                        </div>
                      </TableCell>
                      <TableCell numeric>
                        {f.fuelSharedL == null ? '—' : formatQty(f.fuelSharedL)}
                        {f.fuelFieldL != null && <div className={cellSubStackedClass}>põllul {formatQty(f.fuelFieldL)}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {f.entries.length === 0 ? (
                            <span className={tableMutedClass}>kanne puudub</span>
                          ) : (
                            f.entries.map((e) => (
                              <Button
                                key={e.id}
                                variant="link"
                                size="inline"
                                className="flex flex-col items-start justify-start gap-0 text-left no-underline enabled:hover:[&>span:first-child]:underline disabled:cursor-default disabled:text-inherit disabled:opacity-100"
                                title="Ava põllu töö"
                                disabled={!onOpenFieldWork}
                                onClick={() => onOpenFieldWork?.(e.fieldWorkId, f.year)}
                              >
                                <span>{e.workTypeName}</span>
                                <span className={cellSubClass}>{formatDate(e.date)}</span>
                              </Button>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {(timeTotal > 0 || details.length > 0) && (
            <div className="mb-3 rounded-md border border-border bg-card p-3">
              {timeTotal > 0 && (
                <div className={details.length > 0 ? 'mb-3' : undefined}>
                  <div className="mb-1.5 text-xs leading-natural text-muted-foreground">Aja jaotus</div>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-sm" role="img"
                    aria-label={timeParts.map((p) => `${p.label} ${minutesText(p.minutes)}`).join(', ')}>
                    {timeParts.filter((p) => p.minutes > 0).map((p) => (
                      <span key={p.key} className={cn('min-w-0.5 basis-0', TIME_PART_CLASS[p.key])}
                        style={{ flexGrow: p.minutes }} title={`${p.label}: ${minutesText(p.minutes)}`} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                    {timeParts.map((p) => (
                      <LegendItem key={p.key} color={`var(--trip-${p.key})`} label={p.label} value={minutesText(p.minutes)} />
                    ))}
                  </div>
                </div>
              )}
              {details.length > 0 && (
                <dl className={cn(
                  'grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm leading-natural',
                  timeTotal > 0 && 'border-t border-border pt-2.5'
                )}>
                  {details.map(([k, v]) => (
                    <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="text-foreground">{v}</dd></React.Fragment>
                  ))}
                </dl>
              )}
            </div>
          )}

          {trip.visits.length > 0 && (
            <div className="mb-3">
              <Button
                type="button"
                variant="link"
                size="inline"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground no-underline"
                aria-expanded={visitsOpen}
                onClick={() => setVisitsOpen((v) => !v)}
              >
                {visitsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Läbitud kohad ({trip.visits.length})
              </Button>
              {visitsOpen && (
                <ul className="mt-1.5 ml-4 text-sm leading-natural">
                  {trip.visits.map((v, i) => (
                    <li key={i}>{timeOnly(v.arrive)}–{timeOnly(v.leave)} · {v.place.label}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Field label="Märkus" htmlFor="trip-notes" span="full">
            <Textarea id="trip-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
        </DialogBody>
        <DialogFooter>
          {canDelete && !trip.deletedAt && (
            <Button type="button" variant="danger" className="mr-auto" onClick={remove} disabled={saving}>Kustuta sõit</Button>
          )}
          {canDelete && trip.deletedAt && (
            <Button type="button" className="mr-auto" onClick={restore} disabled={saving}>Taasta</Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Sulge</Button>
          <Button type="button" variant="primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Salvestan...' : 'Salvesta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
