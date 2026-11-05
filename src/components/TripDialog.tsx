// src/components/TripDialog.tsx — ühe sõidu aken: rada kaardil, läbitud kohad, mõõdikud ja märkus (ainus muudetav väli).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { Route, X } from 'lucide-react';
import type { Trip, TripStopInfo } from '../types/fleet';
import { api } from '../services/api';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { formatQty } from '../services/units';
import { formatDate } from '../services/dateFormat';

interface TripDialogProps {
  trip: Trip;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void; // kande link: avab põllu töö
}

export const placeText = (s: TripStopInfo): string => {
  if (s.place) return s.place.label;
  if (s.near) return `tundmatu (${s.near.label} ${Math.round(s.near.distanceM)} m)`;
  return 'tundmatu';
};

const timeOnly = (iso: string) => formatDateTime(iso).slice(11);
const minutesText = (m: number) => formatDuration(new Date(0).toISOString(), new Date(m * 60_000).toISOString());
const opt = (v: number | null, unit: string) => (v == null ? '—' : `${formatQty(v)} ${unit}`);

export const TripDialog: React.FC<TripDialogProps> = ({ trip, onClose, onSaved, onOpenFieldWork }) => {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState(trip.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (!mapDivRef.current) return;
    const map = L.map(mapDivRef.current, { zoomControl: true, attributionControl: true });
    const base = BASE_MAPS['maaamet-pohikaart'];
    L.tileLayer(base.url, {
      tms: base.tms ?? false, attribution: base.attribution,
      maxZoom: base.maxZoom || 19, minZoom: base.minZoom || 5, subdomains: base.subdomains || []
    }).addTo(map);
    const start = L.circleMarker([trip.start.lat, trip.start.lng], { radius: 7, color: '#10b981', fillOpacity: 1 }).addTo(map).bindTooltip('Algus');
    L.circleMarker([trip.end.lat, trip.end.lng], { radius: 7, color: '#ef4444', fillOpacity: 1 }).addTo(map).bindTooltip('Lõpp');
    map.setView(start.getLatLng(), 14);
    let cancelled = false;
    api.getTripTrack(trip.id).then((pts) => {
      if (cancelled || pts.length === 0) return;
      const line = L.polyline(pts, { color: '#3b82f6', weight: 3 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }).catch((e) => { if (!cancelled) setTrackError(e.message); });
    const t = window.setTimeout(() => map.invalidateSize(), 250);
    return () => { cancelled = true; window.clearTimeout(t); map.remove(); };
  }, [trip.id, trip.start.lat, trip.start.lng, trip.end.lat, trip.end.lng]);

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

  const who = trip.vehicleName ?? `${trip.deviceLabel} — seos puudub`;
  const rows: [string, string][] = [
    ['Algus', `${formatDateTime(trip.startedAt)} · ${placeText(trip.start)}`],
    ['Lõpp', trip.status === 'ACTIVE' ? 'käimas' : `${formatDateTime(trip.endedAt)} · ${placeText(trip.end)}`],
    ['Kestus', formatDuration(trip.startedAt, trip.endedAt)],
    ['Läbitud', `${formatQty(trip.distanceKm)} km`],
    ['Liikumisaeg', minutesText(trip.movingMinutes)],
    ['Seisuaeg süütega', minutesText(trip.idleMinutes)],
    ['Pausid', trip.pauseCount ? `${trip.pauseCount} · ${minutesText(trip.pauseMinutes)}` : '—'],
    ['Max kiirus', opt(trip.maxSpeedKmh, 'km/h')],
    ['Keskmine kiirus', opt(trip.avgSpeedKmh, 'km/h')],
    ['Kütus', opt(trip.fuelLiters, 'l')],
    ['Tehtud pindala', opt(trip.areaHa, 'ha')],
    ['Kütusetase', trip.fuelLevelStartPct == null ? '—' : `${formatQty(trip.fuelLevelStartPct)} % → ${formatQty(trip.fuelLevelEndPct ?? trip.fuelLevelStartPct)} %`],
    ['Mootoritunnid', trip.engineHoursStart == null ? '—' : `${formatQty(trip.engineHoursStart)} → ${formatQty(trip.engineHoursEnd ?? trip.engineHoursStart)} h`]
  ];

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content fleet-edit-modal animate-scale-up trip-dialog">
        <div className="modal-header">
          <div className="modal-title-group">
            <Route size={20} className="text-emerald" />
            <h3>{who}{trip.implementName ? ` + ${trip.implementName}` : ''}</h3>
          </div>
          <button className="icon-btn-ghost" type="button" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div ref={mapDivRef} className="trip-dialog-map" />
          {trackError && <div className="auth-error-banner">{trackError}</div>}
          <table className="trip-dialog-metrics">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><th>{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
          {trip.fields.length > 0 && (
            <>
              <h4>Põllud</h4>
              <table className="register-table trip-dialog-fields">
                <thead>
                  <tr>
                    <th>Põld</th>
                    <th>Põllul</th>
                    <th className="num">ha</th>
                    <th className="num">Kütus põllul l</th>
                    <th className="num">Koos teega l</th>
                    <th>Kanne</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.fields.map((f) => (
                    <tr key={f.fieldSeasonId}>
                      <td>{f.label}</td>
                      <td>{timeOnly(f.arriveAt)}–{timeOnly(f.leaveAt)} · {minutesText(f.activeMinutes)}</td>
                      <td className="num">
                        {f.areaHa == null ? '—' : formatQty(f.areaHa)}
                        <div className="text-muted">
                          {f.implementName ? `${f.implementName}${f.widthM != null ? `, ${formatQty(f.widthM)} m` : ''}` : 'haakeriist puudub'}
                        </div>
                      </td>
                      <td className="num">{f.fuelFieldL == null ? '—' : formatQty(f.fuelFieldL)}</td>
                      <td className="num">{f.fuelSharedL == null ? '—' : formatQty(f.fuelSharedL)}</td>
                      <td>
                        {f.entries.length === 0 ? (
                          <span className="text-muted">kanne puudub</span>
                        ) : (
                          f.entries.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Ava põllu töö"
                              disabled={!onOpenFieldWork}
                              onClick={() => onOpenFieldWork?.(e.fieldWorkId, f.year)}
                            >
                              {e.workTypeName} {formatDate(e.date)}
                            </button>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <div className="form-group full-width">
            <label>Märkus</label>
            <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <div className="auth-error-banner">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Sulge</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || notes === (trip.notes ?? '')}>
            {saving ? 'Salvestan...' : 'Salvesta märkus'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
