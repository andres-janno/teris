// src/components/TripRegister.tsx — sõitude register (Tehnika all): taustaimpordi sõidud süüte sisse → välja.
// Ainult vaatamine ja märkus; sõite ei lisata käsitsi.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Route } from 'lucide-react';
import type { Implement, Trip, TripGap, TripImportStatus, Vehicle } from '../types/fleet';
import { api } from '../services/api';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { formatQty } from '../services/units';
import { TripDialog, placeText } from './TripDialog';
import { TripGapReviewDialog } from './TripGapReviewDialog';
import { gapParts } from './tripGapText';
import { registerSectionClass } from './ui/variants';
import { Badge, Button, FilterBar, FilterBarItem, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, DateInput, FilterClear, FilterSelect, CheckboxField } from './ui';

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
  const [gapsFilter, setGapsFilter] = useState<'' | 'all' | 'unreviewed'>('');
  const [reviewing, setReviewing] = useState<TripGap | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [importStatus, setImportStatus] = useState<TripImportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Trip | null>(null);
  // Viimati avatud sõit jääb esile ka pärast akna sulgemist (järje hoidmiseks)
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const openTrip = (t: Trip) => { setLastOpenedId(t.id); setOpen(t); };
  // Kustutatud (või taastatud) sõit kaob nimekirjast: järg liigub ajaliselt eelnevale sõidule
  // (uuemad ees → järgmine rida allpool), selle puudumisel ülemisele naabrile
  const removedFromList = async (t: Trip) => {
    const idx = trips.findIndex((x) => x.id === t.id);
    const neighbour = idx >= 0 ? trips[idx + 1] ?? trips[idx - 1] ?? null : null;
    setLastOpenedId(neighbour?.id ?? null);
    setOpen(null);
    await load();
    if (neighbour) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`tr[data-trip-id="${neighbour.id}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    }
  };
  const closeTrip = () => {
    setOpen(null);
    // Rida nähtavale, kui see on kerimisalast väljas
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`tr[data-trip-id="${lastOpenedId}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  };

  const load = useCallback(async () => {
    if (!fromDay || !toDay) return;
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        api.getTrips({
          from: dayStartIso(fromDay), to: nextDayStartIso(toDay),
          vehicleId: vehicleId || undefined, implementId: implementId || undefined,
          status: status || undefined, unknownPlace, unlinkedOnly, deleted: showDeleted, gaps: gapsFilter || undefined
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
  }, [fromDay, toDay, vehicleId, implementId, status, unknownPlace, unlinkedOnly, showDeleted, gapsFilter]);

  useEffect(() => { load(); }, [load]);

  const periodActive = fromDay !== defaultFrom() || toDay !== defaultTo();
  const hasFilters = periodActive || !!vehicleId || !!implementId || !!status || unknownPlace || unlinkedOnly || showDeleted || !!gapsFilter;
  const unreviewedGaps = trips.filter((t) => t.gapBefore && !t.gapBefore.reviewedAt).length;
  // Vahe kontrolli märke muutus: uuenda sõidu gapBefore nimekirjas
  const gapSaved = (g: TripGap) => {
    setTrips((list) => list.map((t) => (t.gapBefore?.id === g.id ? { ...t, gapBefore: g } : t)));
    setReviewing(null);
  };
  const reopenGap = async (g: TripGap) => {
    try {
      gapSaved(await api.reviewTripGap(g.id, false));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const failing = importStatus?.devices.filter((d) => d.lastError) ?? [];

  return (
    <div className={registerSectionClass}>
      <div className="flex items-center gap-2 text-xs leading-natural text-subtle">
        <span>Viimane import: {importStatus?.lastRunAt ? formatDateTime(importStatus.lastRunAt) : '—'}</span>
      </div>
      {failing.map((d) => (
        <div key={d.deviceId} className="alert-box error">
          <AlertTriangle size={14} /> {d.deviceLabel}: {d.lastError} ({formatDateTime(d.lastErrorAt ?? undefined)})
        </div>
      ))}

      <FilterBar
        actions={(
          <Button size="sm" type="button" title="Värskenda" onClick={load} disabled={loading}>
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
          </Button>
        )}
      >
        <FilterClear inline active={periodActive} onClear={() => { setFromDay(defaultFrom()); setToDay(defaultTo()); }}>
          <span className="inline-flex items-center gap-1.5">
            <DateInput value={fromDay} onChange={setFromDay} />
            <span>–</span>
            <DateInput value={toDay} onChange={setToDay} />
          </span>
        </FilterClear>
        <FilterBarItem>
          <FilterClear active={!!vehicleId} onClear={() => setVehicleId('')}>
            <FilterSelect value={vehicleId} onChange={setVehicleId}
              options={[{ value: '', label: 'Kõik masinad' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]} />
          </FilterClear>
        </FilterBarItem>
        <FilterBarItem>
          <FilterClear active={!!implementId} onClear={() => setImplementId('')}>
            <FilterSelect value={implementId} onChange={setImplementId}
              options={[{ value: '', label: 'Kõik haakeriistad' }, ...implementsList.map((i) => ({ value: i.id, label: i.name }))]} />
          </FilterClear>
        </FilterBarItem>
        <FilterBarItem width="sm">
          <FilterClear active={!!status} onClear={() => setStatus('')}>
            <FilterSelect value={status} onChange={(v) => setStatus(v as '' | 'ACTIVE' | 'CLOSED')}
              options={[{ value: '', label: 'Kõik olekud' }, { value: 'ACTIVE', label: 'Käimas' }, { value: 'CLOSED', label: 'Lõppenud' }]} />
          </FilterClear>
        </FilterBarItem>
        <FilterBarItem width="lg">
          <FilterClear active={!!gapsFilter} onClear={() => setGapsFilter('')}>
            <FilterSelect value={gapsFilter} onChange={(v) => setGapsFilter(v as '' | 'all' | 'unreviewed')}
              options={[{ value: '', label: 'Kõik sõidud' }, { value: 'all', label: 'Hoiatustega' }, { value: 'unreviewed', label: 'Kontrollimata hoiatused' }]} />
          </FilterClear>
        </FilterBarItem>
        <FilterClear inline active={unknownPlace} onClear={() => setUnknownPlace(false)}>
          <CheckboxField checked={unknownPlace} onCheckedChange={setUnknownPlace} label="Ainult tundmatu algus või lõpp" />
        </FilterClear>
        <FilterClear inline active={unlinkedOnly} onClear={() => setUnlinkedOnly(false)}>
          <CheckboxField checked={unlinkedOnly} onCheckedChange={setUnlinkedOnly} label="Ainult kandeta põllusõidud" />
        </FilterClear>
        <FilterClear inline active={showDeleted} onClear={() => setShowDeleted(false)}>
          <CheckboxField checked={showDeleted} onCheckedChange={setShowDeleted} label="Näita kustutatud sõite" />
        </FilterClear>
        {unreviewedGaps > 0 && (
          <span className="inline-flex items-center gap-1 text-sm leading-natural text-warning" title="Kontrollimata hoiatusi valitud perioodis">
            <AlertTriangle size={14} /> {unreviewedGaps} kontrollimata
          </span>
        )}
      </FilterBar>

      {error && <div className="alert-box error">{error}</div>}

      {loading && trips.length === 0 ? (
        <EmptyState description="Laen sõite..." />
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<Route size={36} />}
          title="Sõite ei leitud"
          description={hasFilters ? 'Valitud filtritega sõite pole. Proovi filtreid muuta.' : 'Sõidud tekivad automaatselt telemeetriaandmetest.'}
        />
      ) : (
        <Table scroll="fill" bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Kuupäev</TableHead>
                <TableHead>Masin</TableHead>
                <TableHead>Haakeriist</TableHead>
                <TableHead>Algus–lõpp</TableHead>
                <TableHead numeric>Kestus</TableHead>
                <TableHead>Kust → kuhu</TableHead>
                <TableHead numeric>km</TableHead>
                <TableHead numeric>ha</TableHead>
                <TableHead numeric>Kütus l</TableHead>
                <TableHead numeric title="Mootoritundide loenduri näit sõidu alguses">Mootoritunnid algus</TableHead>
                <TableHead numeric title="Sõidu jooksul töötatud mootoritunnid">Mootoritunnid</TableHead>
                <TableHead title="✓ = vähemalt ühel põllul on kanne; — = põllusõit on kirja panemata">Kanne</TableHead>
                <TableHead>Olek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((t) => {
                const active = t.status === 'ACTIVE';
                const engine = t.engineHoursStart != null && t.engineHoursEnd != null ? t.engineHoursEnd - t.engineHoursStart : null;
                const g = t.gapBefore;
                return (
                  <React.Fragment key={t.id}>
                    <TableRow data-trip-id={t.id} selected={t.id === lastOpenedId} tone={t.deletedAt ? 'muted' : undefined} onClick={() => openTrip(t)}>
                      <TableCell>{formatDateTime(t.startedAt).slice(0, 10)}</TableCell>
                      <TableCell wrap>
                        {t.vehicleName ?? <span className="muted">{t.deviceLabel} — seos puudub</span>}
                      </TableCell>
                      <TableCell wrap>{t.implementName ?? <span className="muted">—</span>}</TableCell>
                      <TableCell>{formatDateTime(t.startedAt).slice(11)}–{active ? 'käimas' : endText(t.startedAt, t.endedAt)}</TableCell>
                      <TableCell numeric>{formatDuration(t.startedAt, t.endedAt)}</TableCell>
                      <TableCell wrap>{placeText(t.start)} → {active ? '…' : placeText(t.end)}</TableCell>
                      <TableCell numeric>{formatQty(t.distanceKm)}</TableCell>
                      <TableCell numeric>{t.areaHa == null ? '—' : formatQty(t.areaHa)}</TableCell>
                      <TableCell numeric>{t.fuelLiters == null ? '—' : formatQty(t.fuelLiters)}</TableCell>
                      <TableCell numeric>{t.engineHoursStart == null ? '—' : formatQty(t.engineHoursStart)}</TableCell>
                      <TableCell numeric>{engine == null ? '—' : formatQty(engine)}</TableCell>
                      <TableCell>{t.fields.length === 0 ? '' : t.fields.some((f) => f.entries.length > 0) ? '✓' : '—'}</TableCell>
                      <TableCell>{active ? <Badge tone="success">käimas</Badge> : 'lõppenud'}</TableCell>
                    </TableRow>
                    {g && (
                      <TableRow tone={g.reviewedAt ? 'muted' : 'warning'}>
                        <TableCell wrap colSpan={13} className="[&>*+*]:ml-3">
                          <span className="inline-flex items-center gap-1.5">
                            <AlertTriangle size={14} className={g.reviewedAt ? 'text-subtle' : 'text-warning'} />
                            Sõitude vahel {formatDuration(g.startedAt, g.endedAt)}: {gapParts(g).join(' · ') || 'märke pole'}
                          </span>
                          {g.reviewedAt ? (
                            <>
                              <span>Kontrollitud {formatDateTime(g.reviewedAt)}{g.reviewedBy ? `, ${g.reviewedBy}` : ''}: {g.reviewNote}</span>
                              <Button type="button" size="sm" onClick={() => reopenGap(g)}>Ava uuesti</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" onClick={() => setReviewing(g)}>Märgi kontrollituks</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
      )}

      {open && (
        <TripDialog
          trip={open}
          canDelete={canDelete}
          onOpenFieldWork={onOpenFieldWork}
          onClose={closeTrip}
          onChanged={() => { if (open) void removedFromList(open); }}
          onSaved={(saved) => { setTrips((list) => list.map((x) => (x.id === saved.id ? saved : x))); setOpen(saved); }}
        />
      )}
      {reviewing && <TripGapReviewDialog gap={reviewing} onClose={() => setReviewing(null)} onSaved={gapSaved} />}
    </div>
  );
};
