// src/components/TripRegister.tsx — sõitude register (Tehnika all): taustaimpordi sõidud süüte sisse → välja.
// Ainult vaatamine ja märkus; sõite ei lisata käsitsi.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Filter, RotateCcw, Route } from 'lucide-react';
import type { Implement, Trip, TripImportStatus, Vehicle } from '../types/fleet';
import { api } from '../services/api';
import { DateInput } from './DateInput';
import { FilterClear } from './FilterClear';
import { FilterSelect } from './FilterSelect';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { formatQty } from '../services/units';
import { TripDialog, placeText } from './TripDialog';

interface TripRegisterProps {
  vehicles: Vehicle[];
  implementsList: Implement[];
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void;
  canDelete?: boolean; // admin: sõidu kustutamine ja taastamine
}

const DEFAULT_DAYS = 31;
const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
// Lõpp näidatakse koos kuupäevaga (pp.kk HH:MM), kui sõit lõpeb teisel kohalikul päeval kui algas
const endText = (startIso: string, endIso: string) => {
  const s = formatDateTime(startIso);
  const e = formatDateTime(endIso);
  return s.slice(0, 10) === e.slice(0, 10) ? e.slice(11) : `${e.slice(0, 5)} ${e.slice(11)}`;
};
const defaultFrom = () => isoDay(new Date(Date.now() - DEFAULT_DAYS * 86_400_000));
const defaultTo = () => isoDay(new Date());
// Kohalik (Tallinna) päev → ISO ajavahemik [alates päeva algusest, kuni järgmise päeva alguseni)
const dayStartIso = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const nextDayStartIso = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

export const TripRegister: React.FC<TripRegisterProps> = ({ vehicles, implementsList, onOpenFieldWork, canDelete = false }) => {
  const [fromDay, setFromDay] = useState(defaultFrom);
  const [toDay, setToDay] = useState(defaultTo);
  const [vehicleId, setVehicleId] = useState('');
  const [implementId, setImplementId] = useState('');
  const [status, setStatus] = useState<'' | 'ACTIVE' | 'CLOSED'>('');
  const [unknownPlace, setUnknownPlace] = useState(false);
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [importStatus, setImportStatus] = useState<TripImportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Trip | null>(null);

  const load = useCallback(async () => {
    if (!fromDay || !toDay) return;
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        api.getTrips({
          from: dayStartIso(fromDay), to: nextDayStartIso(toDay),
          vehicleId: vehicleId || undefined, implementId: implementId || undefined,
          status: status || undefined, unknownPlace, unlinkedOnly, deleted: showDeleted
        }),
        api.getTripImportStatus()
      ]);
      setTrips(list);
      setImportStatus(st);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fromDay, toDay, vehicleId, implementId, status, unknownPlace, unlinkedOnly, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const periodActive = fromDay !== defaultFrom() || toDay !== defaultTo();
  const hasFilters = periodActive || !!vehicleId || !!implementId || !!status || unknownPlace || unlinkedOnly || showDeleted;
  const failing = importStatus?.devices.filter((d) => d.lastError) ?? [];

  return (
    <div className="implement-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="trip-import-status">
        <span>Viimane import: {importStatus?.lastRunAt ? formatDateTime(importStatus.lastRunAt) : '—'}</span>
      </div>
      {failing.map((d) => (
        <div key={d.deviceId} className="auth-error-banner">
          <AlertTriangle size={14} /> {d.deviceLabel}: {d.lastError} ({formatDateTime(d.lastErrorAt ?? undefined)})
        </div>
      ))}

      <div className="history-filter-bar glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} className="text-muted" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Filtrid:</span>
        </div>
        <FilterClear className="filter-clear-inline" active={periodActive} onClear={() => { setFromDay(defaultFrom()); setToDay(defaultTo()); }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <DateInput value={fromDay} onChange={setFromDay} className="form-input" />
            <span>–</span>
            <DateInput value={toDay} onChange={setToDay} className="form-input" />
          </span>
        </FilterClear>
        <div style={{ minWidth: '180px' }}>
          <FilterClear active={!!vehicleId} onClear={() => setVehicleId('')}>
            <FilterSelect style={{ fontSize: '13px', height: '34px' }} value={vehicleId} onChange={setVehicleId}
              options={[{ value: '', label: 'Kõik masinad' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]} />
          </FilterClear>
        </div>
        <div style={{ minWidth: '180px' }}>
          <FilterClear active={!!implementId} onClear={() => setImplementId('')}>
            <FilterSelect style={{ fontSize: '13px', height: '34px' }} value={implementId} onChange={setImplementId}
              options={[{ value: '', label: 'Kõik haakeriistad' }, ...implementsList.map((i) => ({ value: i.id, label: i.name }))]} />
          </FilterClear>
        </div>
        <div style={{ minWidth: '150px' }}>
          <FilterClear active={!!status} onClear={() => setStatus('')}>
            <FilterSelect style={{ fontSize: '13px', height: '34px' }} value={status} onChange={(v) => setStatus(v as '' | 'ACTIVE' | 'CLOSED')}
              options={[{ value: '', label: 'Kõik olekud' }, { value: 'ACTIVE', label: 'Käimas' }, { value: 'CLOSED', label: 'Lõppenud' }]} />
          </FilterClear>
        </div>
        <FilterClear className="filter-clear-inline" active={unknownPlace} onClear={() => setUnknownPlace(false)}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input type="checkbox" checked={unknownPlace} onChange={(e) => setUnknownPlace(e.target.checked)} />
            Ainult tundmatu algus või lõpp
          </label>
        </FilterClear>
        <FilterClear className="filter-clear-inline" active={unlinkedOnly} onClear={() => setUnlinkedOnly(false)}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input type="checkbox" checked={unlinkedOnly} onChange={(e) => setUnlinkedOnly(e.target.checked)} />
            Ainult kandeta põllusõidud
          </label>
        </FilterClear>
        <FilterClear className="filter-clear-inline" active={showDeleted} onClear={() => setShowDeleted(false)}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Näita kustutatud sõite
          </label>
        </FilterClear>
        <button className="btn btn-secondary btn-sm" type="button" title="Värskenda" onClick={load} disabled={loading} style={{ marginLeft: 'auto' }}>
          <RotateCcw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error && <div className="auth-error-banner">{error}</div>}

      {loading && trips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Laen sõite...</div>
      ) : trips.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Route size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Sõite ei leitud
          </div>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {hasFilters ? 'Valitud filtritega sõite pole. Proovi filtreid muuta.' : 'Sõidud tekivad automaatselt telemeetriaandmetest.'}
          </p>
        </div>
      ) : (
        <div className="register-table-wrap glass-card" style={{ overflowX: 'auto' }}>
          <table className="register-table">
            <thead>
              <tr>
                <th>Kuupäev</th>
                <th>Masin</th>
                <th>Haakeriist</th>
                <th>Algus–lõpp</th>
                <th className="num">Kestus</th>
                <th>Kust → kuhu</th>
                <th className="num">km</th>
                <th className="num">ha</th>
                <th className="num">Kütus l</th>
                <th className="num">Mootoritunnid</th>
                <th title="✓ = vähemalt ühel põllul on kanne; — = põllusõit on kirja panemata">Kanne</th>
                <th>Olek</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const active = t.status === 'ACTIVE';
                const engine = t.engineHoursStart != null && t.engineHoursEnd != null ? t.engineHoursEnd - t.engineHoursStart : null;
                return (
                  <tr key={t.id} className="clickable-row" style={t.deletedAt ? { opacity: 0.55 } : undefined} onClick={() => setOpen(t)}>
                    <td>{formatDateTime(t.startedAt).slice(0, 10)}</td>
                    <td>
                      {t.vehicleName ?? <span className="text-muted">{t.deviceLabel} — seos puudub</span>}
                    </td>
                    <td>{t.implementName ?? <span className="text-muted">—</span>}</td>
                    <td>{formatDateTime(t.startedAt).slice(11)}–{active ? 'käimas' : endText(t.startedAt, t.endedAt)}</td>
                    <td className="num">{formatDuration(t.startedAt, t.endedAt)}</td>
                    <td>{placeText(t.start)} → {active ? '…' : placeText(t.end)}</td>
                    <td className="num">{formatQty(t.distanceKm)}</td>
                    <td className="num">{t.areaHa == null ? '—' : formatQty(t.areaHa)}</td>
                    <td className="num">{t.fuelLiters == null ? '—' : formatQty(t.fuelLiters)}</td>
                    <td className="num">{engine == null ? '—' : formatQty(engine)}</td>
                    <td>{t.fields.length === 0 ? '' : t.fields.some((f) => f.entries.length > 0) ? '✓' : '—'}</td>
                    <td>{active ? <span className="status-badge status-working">käimas</span> : 'lõppenud'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <TripDialog
          trip={open}
          canDelete={canDelete}
          onOpenFieldWork={onOpenFieldWork}
          onClose={() => setOpen(null)}
          onChanged={() => { setOpen(null); void load(); }}
          onSaved={(saved) => { setTrips((list) => list.map((x) => (x.id === saved.id ? saved : x))); setOpen(saved); }}
        />
      )}
    </div>
  );
};
