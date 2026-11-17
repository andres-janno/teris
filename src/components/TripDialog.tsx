// src/components/TripDialog.tsx — ühe sõidu aken: rada kaardil, läbitud kohad, mõõdikud ja märkus (ainus muudetav väli).
import { TRIP_MAP_COLOR } from '../lib/dataColors';
import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { Route } from 'lucide-react';
import type { Trip, TripStopInfo } from '../types/fleet';
import { api } from '../services/api';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { formatQty } from '../services/units';
import { formatDate } from '../services/dateFormat';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { Button, StatTile, LegendItem, Field, Textarea, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

interface TripDialogProps {
  trip: Trip;
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

export const TripDialog: React.FC<TripDialogProps> = ({ trip, onClose, onSaved, onOpenFieldWork, canDelete = false, onChanged }) => {
  // Kaardi element olekus: dialoogi sisu portaalitakse alles pärast esimest renderdust, siis pole ref veel olemas.
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const [notes, setNotes] = useState(trip.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

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
  }, [mapEl, trip.id, trip.start.lat, trip.start.lng, trip.end.lat, trip.end.lng]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.updateTripNotes(trip.id, notes.trim() || null));
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
    { key: 'moving', label: 'Liikumine', minutes: trip.movingMinutes },
    { key: 'idle', label: 'Seisuaeg süütega', minutes: trip.idleMinutes },
    { key: 'pause', label: trip.pauseCount ? `Pausid (${trip.pauseCount})` : 'Pausid', minutes: trip.pauseMinutes }
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
      <DialogContent size="lg" className="fleet-edit-modal trip-dialog" dismissible={!saving}>
        <DialogHeader icon={<Route size={20} />} title={`${who}${trip.implementName ? ` + ${trip.implementName}` : ''}`} />
        <DialogBody>
          {trip.deletedAt && <div className="auth-error-banner">Kustutatud {formatDateTime(trip.deletedAt)}</div>}
          <div ref={setMapEl} className="trip-dialog-map" />
          {trackError && <div className="auth-error-banner">{trackError}</div>}
          {/* Algus ja lõpp: täppide värv sama mis kaardi markeritel */}
          <div className="trip-stops">
            <div className="trip-stop">
              <span className="trip-stop-dot start" aria-hidden="true" />
              <span className="trip-stop-time">{formatDateTime(trip.startedAt)}</span>
              <span className="trip-stop-place">{placeText(trip.start)}</span>
            </div>
            <div className="trip-stop">
              <span className="trip-stop-dot end" aria-hidden="true" />
              <span className="trip-stop-time">{active ? 'käimas' : formatDateTime(trip.endedAt)}</span>
              <span className="trip-stop-place">{active ? '' : placeText(trip.end)}</span>
            </div>
          </div>

          <div className="trip-tiles">
            {tiles.map((t) => (
              <StatTile key={t.label} label={t.label} value={t.value} unit={t.unit} empty={t.empty} />
            ))}
          </div>

          {timeTotal > 0 && (
            <div className="trip-timesplit">
              <div className="trip-timesplit-label">Aja jaotus</div>
              <div className="trip-timesplit-bar" role="img"
                aria-label={timeParts.map((p) => `${p.label} ${minutesText(p.minutes)}`).join(', ')}>
                {timeParts.filter((p) => p.minutes > 0).map((p) => (
                  <span key={p.key} className={`trip-timesplit-part ${p.key}`}
                    style={{ flexGrow: p.minutes }} title={`${p.label}: ${minutesText(p.minutes)}`} />
                ))}
              </div>
              <div className="trip-timesplit-legend">
                {timeParts.map((p) => (
                  <LegendItem key={p.key} color={`var(--trip-${p.key})`} value={minutesText(p.minutes)}>{p.label}</LegendItem>
                ))}
              </div>
            </div>
          )}

          {details.length > 0 && (
            <dl className="trip-details">
              {details.map(([k, v]) => (
                <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>
              ))}
            </dl>
          )}
          {trip.fields.length > 0 && (
            <>
              <h4>Põllud</h4>
              <Table scroll="none" containerClassName="trip-dialog-fields-wrap" className="trip-dialog-fields">
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
                        <div className="cell-sub">
                          {f.implementName ? `${f.implementName}${f.widthM != null ? `, ${formatQty(f.widthM)} m` : ''}` : 'haakeriist puudub'}
                        </div>
                      </TableCell>
                      <TableCell numeric>
                        {f.fuelSharedL == null ? '—' : formatQty(f.fuelSharedL)}
                        {f.fuelFieldL != null && <div className="cell-sub">põllul {formatQty(f.fuelFieldL)}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="trip-dialog-entry-cell">
                          {f.entries.length === 0 ? (
                            <span className="muted">kanne puudub</span>
                          ) : (
                            f.entries.map((e) => (
                              <Button
                                key={e.id}
                                variant="text"
                                size="inline"
                                className="trip-dialog-entry"
                                title="Ava põllu töö"
                                disabled={!onOpenFieldWork}
                                onClick={() => onOpenFieldWork?.(e.fieldWorkId, f.year)}
                              >
                                <span>{e.workTypeName}</span>
                                <span className="cell-sub">{formatDate(e.date)}</span>
                              </Button>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {trip.visits.length > 0 && (
            <>
              <h4>Läbitud kohad</h4>
              <ul className="trip-dialog-visits">
                {trip.visits.map((v, i) => (
                  <li key={i}>{timeOnly(v.arrive)}–{timeOnly(v.leave)} · {v.place.label}</li>
                ))}
              </ul>
            </>
          )}
          <Field label="Märkus" htmlFor="trip-notes" span="full">
            <Textarea id="trip-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <div className="auth-error-banner">{error}</div>}
        </DialogBody>
        <DialogFooter>
          {canDelete && !trip.deletedAt && (
            <Button type="button" variant="danger" className="footer-start" onClick={remove} disabled={saving}>Kustuta sõit</Button>
          )}
          {canDelete && trip.deletedAt && (
            <Button type="button" className="footer-start" onClick={restore} disabled={saving}>Taasta</Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Sulge</Button>
          <Button type="button" variant="primary" onClick={save} disabled={saving || notes === (trip.notes ?? '')}>
            {saving ? 'Salvestan...' : 'Salvesta märkus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
