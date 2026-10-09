// src/components/DeviceAssignmentRegister.tsx — telemeetriaseadmete seoste register (Tehnika all).
// Register on seadme ↔ masina/haakeriista seose ainus tõeallikas: kaardid näitavad
// seost registri kehtiva kirje järgi ja kaardi „Vaheta“ teeb registrisse uue kirje.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Filter, Link, Pencil, Radio, RotateCcw, Tractor, Trash2, Unlink, Wrench, X } from 'lucide-react';
import type { DeviceAssignment, Implement, TelemetryDevice, Vehicle } from '../types/fleet';
import { api } from '../services/api';
import { DateInput } from './DateInput';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import { combineDateAndTimeToIso, formatDateTime, formatDuration, getTimeOptions, splitIsoToDateAndTime } from './fleetDateTime';

interface DeviceAssignmentRegisterProps {
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

export const DeviceAssignmentRegister: React.FC<DeviceAssignmentRegisterProps> = ({
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
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all'); // 'all' | 'veh:<id>' | 'imp:<id>'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  const filtered = useMemo(() => assignments.filter((a) => {
    if (deviceFilter !== 'all' && a.deviceId !== deviceFilter) return false;
    if (targetFilter !== 'all') {
      const [kind, id] = targetFilter.split(':');
      if (kind === 'veh' ? a.vehicleId !== id : a.implementId !== id) return false;
    }
    if (statusFilter === 'active' && a.endedAt) return false;
    if (statusFilter === 'ended' && !a.endedAt) return false;
    return true;
  }), [assignments, deviceFilter, targetFilter, statusFilter]);

  const hasFilters = deviceFilter !== 'all' || targetFilter !== 'all' || statusFilter !== 'all';

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

  return (
    <div className="implement-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filtrid */}
      <div className="history-filter-bar glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} className="text-muted" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Filtrid:</span>
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            className="form-input"
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '6px 10px', height: '34px' }}
          >
            <option value="all">Kõik seadmed</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{deviceLabel(d)}</option>)}
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            className="form-input"
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '6px 10px', height: '34px' }}
          >
            <option value="all">Kõik masinad ja haakeriistad</option>
            {targetOptions}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('all')}>
            Kõik ({assignments.length})
          </button>
          <button className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('active')}>
            Aktiivsed ({assignments.filter((a) => !a.endedAt).length})
          </button>
          <button className={`btn btn-sm ${statusFilter === 'ended' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('ended')}>
            Ajalugu ({assignments.filter((a) => !!a.endedAt).length})
          </button>
        </div>

        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setDeviceFilter('all'); setTargetFilter('all'); setStatusFilter('all'); }}
            style={{ fontSize: '12px', marginLeft: 'auto' }}
          >
            Tühjenda filtrid
          </button>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={onReload}
          title="Värskenda registrit"
          style={{ marginLeft: hasFilters ? undefined : 'auto' }}
        >
          <RotateCcw size={14} className={loading ? 'spin' : ''} />
          <span>Värskenda</span>
        </button>
      </div>

      {/* Tabel */}
      {loading && assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Laen seadmete seoste registrit...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Radio size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Ühtegi seose kirjet ei leitud
          </div>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {hasFilters
              ? 'Valitud filtritega ei leitud ühtegi seost. Proovi filtreid muuta.'
              : 'Seadmete paigaldused masinatele ja haakeriistadele salvestuvad siia, kui seade kaardilt paigaldatakse või vahetatakse.'}
          </p>
        </div>
      ) : (
        <div className="register-table-wrap glass-card" style={{ overflowX: 'auto' }}>
          <table className="register-table">
            <thead>
              <tr>
                <th>Seade</th>
                <th>Masin / haakeriist</th>
                <th>Paigaldatud (algus)</th>
                <th>Eemaldatud (lõpp)</th>
                <th>Kestus</th>
                <th>Märkused</th>
                <th style={{ textAlign: 'right' }}>Tegevused</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isActive = !a.endedAt;
                const isEye = a.deviceConnectivity === 'eye_sensor';
                return (
                  <tr key={a.id} style={{ background: isActive ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={iconBox('rgba(59, 130, 246, 0.15)', '#3b82f6')}>
                          {isEye ? <Activity size={15} /> : <Radio size={15} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{a.deviceModel || a.deviceId}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {a.deviceIdentifier ? `${isEye ? 'MAC' : 'IMEI'}: ${a.deviceIdentifier}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {a.vehicleId ? (
                          <div style={iconBox('rgba(16, 185, 129, 0.15)', '#10b981')}><Tractor size={15} /></div>
                        ) : (
                          <div style={iconBox('rgba(234, 179, 8, 0.15)', '#eab308')}><Wrench size={15} /></div>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>
                          {a.vehicleId ? (a.vehicleName || a.vehicleId) : (a.implementName || a.implementId)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{formatDateTime(a.startedAt)}</div>
                    </td>
                    <td>
                      {isActive ? (
                        <span className="status-badge status-working" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                          Paigaldatud (Aktiivne)
                        </span>
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(a.endedAt)}</div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                        {formatDuration(a.startedAt, a.endedAt)}
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
                            title="Eemalda seade masinalt / haakeriistalt"
                            onClick={() => onDetach(a.deviceId)}
                            style={{ fontSize: '11px', padding: '4px 8px', height: '26px' }}
                          >
                            <Unlink size={12} />
                            <span>Eemalda</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn-ghost"
                          title="Muuda seose kirjet"
                          onClick={() => startEdit(a)}
                          style={{ width: '26px', height: '26px' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-danger"
                          title="Kustuta seose kirje"
                          onClick={() => handleDelete(a.id)}
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
