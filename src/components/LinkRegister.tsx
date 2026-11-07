// src/components/LinkRegister.tsx — „Seadmete seosed“ (Tehnika all): haakimised (haakeriist ↔ masin) ja
// telemeetriaseadmete paigaldused (seade ↔ masin/haakeriist) ühes tabelis. Andmed jäävad eraldi tabelitesse;
// haakimise vorm ja tegevused on VehicleTrackeris, seadme seose vorm siin.
// Seadmete seoste register on seadme ↔ masina/haakeriista seose ainus tõeallikas.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Filter, Link, Pencil, Radio, RotateCcw, Tractor, Trash2, Unlink, Wrench, X } from 'lucide-react';
import type { DeviceAssignment, Implement, ImplementAssignment, TelemetryDevice, Vehicle } from '../types/fleet';
import { api } from '../services/api';
import { DateInput } from './DateInput';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import { combineDateAndTimeToIso, formatDateTime, formatDuration, getTimeOptions, splitIsoToDateAndTime } from './fleetDateTime';
import { FilterClear } from './FilterClear';
import { FilterSelect } from './FilterSelect';

interface LinkRegisterProps {
  telemetryEnabled: boolean;
  preset?: { vehicleId?: string; implementId?: string; key: number } | null; // kaardilt avamisel eelfilter
  hitches: ImplementAssignment[];        // haakimised
  hitchLoading: boolean;
  onReloadHitches: () => void;
  onEditHitch: (a: ImplementAssignment) => void;
  onDeleteHitch: (id: string) => void;
  onDetachHitch: (implementId: string) => void;
  vehicles: Vehicle[];
  implementsList: Implement[];
  devices: TelemetryDevice[];
  assignments: DeviceAssignment[];
  loading: boolean;
  onReload: () => void;
  formOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onChanged: () => void;                 // registrit muudeti → värskenda kaartide seoseid ja nimekirja
  onDetach: (deviceId: string) => void;  // eemalda seade praeguselt masinalt/haakeriistalt
}

type StatusFilter = 'all' | 'active' | 'ended';
type KindFilter = 'all' | 'hitch' | 'device';
type LinkRow = { kind: 'hitch'; a: ImplementAssignment } | { kind: 'device'; a: DeviceAssignment };

export const deviceLabel = (d: { model?: string; imei?: string; macAddress?: string }) => {
  const ident = d.imei ?? d.macAddress;
  return ident ? `${d.model} (${ident.slice(-4)})` : (d.model ?? '');
};

const iconBox = (bg: string, color: string): React.CSSProperties => ({
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  background: bg,
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
});

export const LinkRegister: React.FC<LinkRegisterProps> = ({
  telemetryEnabled,
  preset,
  hitches,
  hitchLoading,
  onReloadHitches,
  onEditHitch,
  onDeleteHitch,
  onDetachHitch,
  vehicles,
  implementsList,
  devices,
  assignments,
  loading,
  onReload,
  formOpen,
  onOpenForm,
  onCloseForm,
  onChanged,
  onDetach
}) => {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [implementFilter, setImplementFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Masina/haakeriista kaardi ajaloo nupp: näita ainult selle seoseid
  useEffect(() => {
    if (!preset) return;
    setKindFilter('all');
    setDeviceFilter('all');
    setStatusFilter('all');
    setVehicleFilter(preset.vehicleId ?? 'all');
    setImplementFilter(preset.implementId ?? 'all');
  }, [preset]);

  // Vorm
  const editingIdRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDeviceId, setFormDeviceId] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Uue kirje vorm (lisamisnupp üleval ribal): tühjad väljad, algus praegu
  useEffect(() => {
    if (!formOpen) {
      editingIdRef.current = null;
      setEditingId(null);
      return;
    }
    if (editingIdRef.current) return;
    const now = splitIsoToDateAndTime(new Date().toISOString());
    setFormDeviceId(devices[0]?.id ?? '');
    setFormTarget(vehicles[0] ? `veh:${vehicles[0].id}` : '');
    setStartDate(now.date);
    setStartTime(now.time);
    setEndDate('');
    setEndTime('');
    setNotes('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  const startEdit = (a: DeviceAssignment) => {
    editingIdRef.current = a.id;
    setEditingId(a.id);
    setFormDeviceId(a.deviceId);
    setFormTarget(a.vehicleId ? `veh:${a.vehicleId}` : `imp:${a.implementId}`);
    const start = splitIsoToDateAndTime(a.startedAt);
    setStartDate(start.date);
    setStartTime(start.time || '08:00');
    const end = splitIsoToDateAndTime(a.endedAt);
    setEndDate(end.date);
    setEndTime(a.endedAt ? (end.time || '17:00') : '');
    setNotes(a.notes ?? '');
    setError(null);
    onOpenForm();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDeviceId || !formTarget || !startDate) {
      setError('Vali seade, masin või haakeriist ja seose alguskuupäev.');
      return;
    }
    const startedAt = combineDateAndTimeToIso(startDate, startTime);
    if (!startedAt) {
      setError('Vigane alguskuupäev või kellaaeg.');
      return;
    }
    // Tühi lõppkuupäev = seade on praegu paigaldatud
    let endedAt: string | null = null;
    if (endDate) {
      endedAt = combineDateAndTimeToIso(endDate, endTime);
      if (!endedAt) {
        setError('Vigane lõppkuupäev või kellaaeg.');
        return;
      }
      if (new Date(endedAt) < new Date(startedAt)) {
        setError('Lõppaeg ei saa olla varasem kui algusaeg.');
        return;
      }
    }
    const [kind, targetId] = formTarget.split(':');
    const payload = {
      deviceId: formDeviceId,
      vehicleId: kind === 'veh' ? targetId : undefined,
      implementId: kind === 'imp' ? targetId : undefined,
      startedAt,
      endedAt,
      notes: notes.trim() || undefined
    };

    setSubmitting(true);
    setError(null);
    try {
      if (editingId) await api.updateDeviceAssignment(editingId, payload);
      else await api.createDeviceAssignment(payload);
      onCloseForm();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvestamine ebaõnnestus');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog('Kas soovid kindlasti selle seose kirje registrist kustutada?')) return;
    try {
      await api.deleteDeviceAssignment(id);
      onChanged();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Seose kirje kustutamine ebaõnnestus');
    }
  };

  // Ühine tabel: haakimised ja seadmete seosed; uuemad eespool
  const rows = useMemo<LinkRow[]>(() => [
    ...hitches.map((a): LinkRow => ({ kind: 'hitch', a })),
    ...(telemetryEnabled ? assignments.map((a): LinkRow => ({ kind: 'device', a })) : [])
  ].sort((x, y) => new Date(y.a.startedAt).getTime() - new Date(x.a.startedAt).getTime()), [hitches, assignments, telemetryEnabled]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
    if (vehicleFilter !== 'all' && r.a.vehicleId !== vehicleFilter) return false;
    if (implementFilter !== 'all' && r.a.implementId !== implementFilter) return false;
    if (deviceFilter !== 'all' && (r.kind !== 'device' || r.a.deviceId !== deviceFilter)) return false;
    if (statusFilter === 'active' && r.a.endedAt) return false;
    if (statusFilter === 'ended' && !r.a.endedAt) return false;
    return true;
  }), [rows, kindFilter, vehicleFilter, implementFilter, deviceFilter, statusFilter]);

  const hasFilters = kindFilter !== 'all' || vehicleFilter !== 'all' || implementFilter !== 'all' || deviceFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => { setKindFilter('all'); setVehicleFilter('all'); setImplementFilter('all'); setDeviceFilter('all'); setStatusFilter('all'); };
  const isLoading = loading || hitchLoading;
  const reloadAll = () => { onReloadHitches(); if (telemetryEnabled) onReload(); };

  const targetOptions = (
    <>
      <optgroup label="🚜 Masinad">
        {vehicles.map((v) => <option key={`veh:${v.id}`} value={`veh:${v.id}`}>{v.name}</option>)}
      </optgroup>
      <optgroup label="🔧 Haakeriistad">
        {implementsList.map((imp) => <option key={`imp:${imp.id}`} value={`imp:${imp.id}`}>{imp.name}</option>)}
      </optgroup>
    </>
  );

  const activeBadge = (text: string) => (
    <span className="status-badge status-working" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
      {text}
    </span>
  );

  const nameCell = (icon: React.ReactNode, title: string, sub?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <div>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>{title}</div>
        {sub ? <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div> : null}
      </div>
    </div>
  );

  const vehicleIcon = <div style={iconBox('rgba(16, 185, 129, 0.15)', '#10b981')}><Tractor size={15} /></div>;
  const implementIcon = <div style={iconBox('rgba(234, 179, 8, 0.15)', '#eab308')}><Wrench size={15} /></div>;

  return (
    <div className="implement-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filtrid */}
      <div className="history-filter-bar glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} className="text-muted" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Filtrid:</span>
        </div>

        {telemetryEnabled && (
          <div style={{ minWidth: '160px' }}>
            <FilterClear active={kindFilter !== 'all'} onClear={() => setKindFilter('all')}>
              <FilterSelect
                value={kindFilter}
                defaultValue="all"
                onChange={(v) => setKindFilter(v as KindFilter)}
                style={{ fontSize: '13px', height: '34px' }}
                options={[{ value: 'all', label: 'Kõik seosed' }, { value: 'hitch', label: 'Haakimised' }, { value: 'device', label: 'Seadmed' }]}
              />
            </FilterClear>
          </div>
        )}

        <div style={{ minWidth: '180px' }}>
          <FilterClear active={vehicleFilter !== 'all'} onClear={() => setVehicleFilter('all')}>
            <FilterSelect
              value={vehicleFilter}
              defaultValue="all"
              onChange={setVehicleFilter}
              style={{ fontSize: '13px', height: '34px' }}
              options={[{ value: 'all', label: 'Kõik masinad' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]}
            />
          </FilterClear>
        </div>

        <div style={{ minWidth: '180px' }}>
          <FilterClear active={implementFilter !== 'all'} onClear={() => setImplementFilter('all')}>
            <FilterSelect
              value={implementFilter}
              defaultValue="all"
              onChange={setImplementFilter}
              style={{ fontSize: '13px', height: '34px' }}
              options={[{ value: 'all', label: 'Kõik haakeriistad' }, ...implementsList.map((imp) => ({ value: imp.id, label: imp.name }))]}
            />
          </FilterClear>
        </div>

        {telemetryEnabled && (
          <div style={{ minWidth: '180px' }}>
            <FilterClear active={deviceFilter !== 'all'} onClear={() => setDeviceFilter('all')}>
              <FilterSelect
                value={deviceFilter}
                defaultValue="all"
                onChange={setDeviceFilter}
                style={{ fontSize: '13px', height: '34px' }}
                options={[{ value: 'all', label: 'Kõik seadmed' }, ...devices.map((d) => ({ value: d.id, label: deviceLabel(d) }))]}
              />
            </FilterClear>
          </div>
        )}

        <div style={{ display: 'flex', gap: '4px' }}>
          <button className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('all')}>
            Kõik ({rows.length})
          </button>
          <button className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('active')}>
            Aktiivsed ({rows.filter((r) => !r.a.endedAt).length})
          </button>
          <button className={`btn btn-sm ${statusFilter === 'ended' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('ended')}>
            Ajalugu ({rows.filter((r) => !!r.a.endedAt).length})
          </button>
        </div>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: '12px', marginLeft: 'auto' }}>
            Tühjenda filtrid
          </button>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={reloadAll}
          title="Värskenda registrit"
          style={{ marginLeft: hasFilters ? undefined : 'auto' }}
        >
          <RotateCcw size={14} className={isLoading ? 'spin' : ''} />
          <span>Värskenda</span>
        </button>
      </div>

      {/* Tabel */}
      {isLoading && rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Laen seadmete seoseid...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Link size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Ühtegi seose kirjet ei leitud
          </div>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {hasFilters
              ? 'Valitud filtritega ei leitud ühtegi seost. Proovi filtreid muuta.'
              : 'Haakimised ja seadmete paigaldused salvestuvad siia, kui haakeriista või seadet kaardilt vahetatakse.'}
          </p>
        </div>
      ) : (
        <div className="register-table-wrap glass-card" style={{ overflowX: 'auto' }}>
          <table className="register-table">
            <thead>
              <tr>
                <th>Liik</th>
                <th>Mis</th>
                <th>Kuhu</th>
                <th>Algus</th>
                <th>Lõpp</th>
                <th>Kestus</th>
                <th>Märkused</th>
                <th style={{ textAlign: 'right' }}>Tegevused</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const a = r.a;
                const isActive = !a.endedAt;
                const isHitch = r.kind === 'hitch';
                const isEye = r.kind === 'device' && r.a.deviceConnectivity === 'eye_sensor';
                return (
                  <tr key={`${r.kind}:${a.id}`} style={{ background: isActive ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                    <td>
                      <span className={`link-kind-pill ${r.kind}`}>{isHitch ? 'Haakimine' : 'Seade'}</span>
                    </td>
                    <td>
                      {r.kind === 'hitch'
                        ? nameCell(implementIcon, r.a.implementName || r.a.implementId, r.a.implementCategory)
                        : nameCell(
                            <div style={iconBox('rgba(59, 130, 246, 0.15)', '#3b82f6')}>{isEye ? <Activity size={15} /> : <Radio size={15} />}</div>,
                            r.a.deviceModel || r.a.deviceId,
                            r.a.deviceIdentifier ? `${isEye ? 'MAC' : 'IMEI'}: ${r.a.deviceIdentifier}` : undefined
                          )}
                    </td>
                    <td>
                      {r.kind === 'hitch'
                        ? nameCell(vehicleIcon, r.a.vehicleName || r.a.vehicleId)
                        : r.a.vehicleId
                          ? nameCell(vehicleIcon, r.a.vehicleName || r.a.vehicleId)
                          : nameCell(implementIcon, r.a.implementName || r.a.implementId || '')}
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{formatDateTime(a.startedAt)}</div>
                    </td>
                    <td>
                      {isActive
                        ? activeBadge(isHitch ? 'Hetkel küljes' : 'Paigaldatud')
                        : <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(a.endedAt ?? undefined)}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                        {formatDuration(a.startedAt, a.endedAt ?? undefined)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: a.notes ? 'normal' : 'italic' }}>
                        {a.notes || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {isActive && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title={isHitch ? 'Haagi see riist masinalt lahti' : 'Seo seade masinast / haakeriistast lahti'}
                            onClick={() => (r.kind === 'hitch' ? onDetachHitch(r.a.implementId) : onDetach(r.a.deviceId))}
                            style={{ fontSize: '11px', padding: '4px 8px', height: '26px' }}
                          >
                            <Unlink size={12} />
                            <span>{isHitch ? 'Haagi lahti' : 'Seo lahti'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn-ghost"
                          title="Muuda kirjet"
                          onClick={() => (r.kind === 'hitch' ? onEditHitch(r.a) : startEdit(r.a))}
                          style={{ width: '26px', height: '26px' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-danger"
                          title="Kustuta kirje"
                          onClick={() => (r.kind === 'hitch' ? onDeleteHitch(r.a.id) : handleDelete(r.a.id))}
                          style={{ width: '26px', height: '26px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lisamise / muutmise vorm */}
      {formOpen && createPortal(
        <div className="modal-backdrop sub-modal">
          <form onSubmit={handleSave} className="modal-content fleet-edit-modal animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-group">
                <Link size={20} className="text-emerald" />
                <h3>{editingId ? 'Muuda seose kirjet' : 'Lisa seadme seose kanne'}</h3>
              </div>
              <button className="icon-btn-ghost" type="button" onClick={onCloseForm} title="Sulge (Esc)">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="auth-error-banner" style={{ marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Seade *</label>
                  <select required value={formDeviceId} onChange={(e) => setFormDeviceId(e.target.value)} className="form-input">
                    <option value="" disabled>Vali seade...</option>
                    {devices.map((d) => <option key={d.id} value={d.id}>{deviceLabel(d)}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Masin / haakeriist *</label>
                  <select required value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="form-input">
                    <option value="" disabled>Vali masin või haakeriist...</option>
                    {targetOptions}
                  </select>
                </div>

                <div className="form-group">
                  <label>Paigaldatud (algusaeg) *</label>
                  <div className="assign-datetime">
                    <DateInput value={startDate} onChange={setStartDate} className="form-input" required />
                    <select className="form-input time-select" value={startTime} onChange={(e) => setStartTime(e.target.value)} required>
                      {getTimeOptions(startTime || undefined).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Eemaldatud (lõppaeg)</label>
                  <div className="assign-datetime">
                    <DateInput
                      value={endDate}
                      onChange={(date) => {
                        setEndDate(date);
                        if (!date) setEndTime('');
                        else if (!endTime) setEndTime('17:00');
                      }}
                      className="form-input"
                    />
                    <select className="form-input time-select" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!endDate}>
                      {!endDate && <option value="">--:--</option>}
                      {getTimeOptions(endTime || undefined).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <span className="assign-hint">
                    {endDate ? (
                      <button type="button" className="assign-hint-link" onClick={() => { setEndDate(''); setEndTime(''); }}>
                        Tühjenda lõppaeg (seade on praegu paigaldatud)
                      </button>
                    ) : (
                      <span className="assign-hint-active">Lõppaeg tühi — seade on praegu paigaldatud</span>
                    )}
                  </span>
                </div>

                <div className="form-group full-width">
                  <label>Märkused</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Lisa märkused (nt paigalduskoht, antenn)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onCloseForm} disabled={submitting}>Loobu</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Salvestan...' : (editingId ? 'Salvesta muudatused' : 'Salvesta kanne')}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
};
