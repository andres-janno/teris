// src/components/DeviceAssignmentRegister.tsx — telemeetriaseadmete seoste register (Tehnika all).
// Register on seadme ↔ masina/haakeriista seose ainus tõeallikas: kaardid näitavad
// seost registri kehtiva kirje järgi ja kaardi „Vaheta“ teeb registrisse uue kirje.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Filter, Link, Pencil, Radio, RotateCcw, Tractor, Trash2, Unlink, Wrench } from 'lucide-react';
import type { DeviceAssignment, Implement, TelemetryDevice, Vehicle } from '../types/fleet';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import { combineDateAndTimeToIso, formatDateTime, formatDuration, getTimeOptions, splitIsoToDateAndTime } from './fleetDateTime';
import { Badge, Card, Button, Dialog, DialogContent, DialogHeader, DialogForm, DialogBody, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ToggleGroup, ToggleGroupItem, DateInput, FilterClear, FilterSelect, Field, FormGrid, Select, Textarea, type SelectOption } from './ui';

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

  const targetOptions: SelectOption[] = [
    ...vehicles.map((v) => ({ value: `veh:${v.id}`, label: v.name, group: '🚜 Masinad' })),
    ...implementsList.map((imp) => ({ value: `imp:${imp.id}`, label: imp.name, group: '🔧 Haakeriistad' })),
  ];
  const timeSelectOptions = (cur: string): SelectOption[] => getTimeOptions(cur || undefined).map((t) => ({ value: t, label: t }));

  return (
    <div className="implement-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filtrid */}
      <Card padding="sm" className="history-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Filtrid:</span>
        </div>

        <div style={{ minWidth: '180px' }}>
          <FilterClear active={deviceFilter !== 'all'} onClear={() => setDeviceFilter('all')}>
            <FilterSelect
              value={deviceFilter}
              defaultValue="all"
              onChange={setDeviceFilter}
              options={[{ value: 'all', label: 'Kõik seadmed' }, ...devices.map((d) => ({ value: d.id, label: deviceLabel(d) }))]}
            />
          </FilterClear>
        </div>

        <div style={{ minWidth: '180px' }}>
          <FilterClear active={targetFilter !== 'all'} onClear={() => setTargetFilter('all')}>
            <FilterSelect
              value={targetFilter}
              defaultValue="all"
              onChange={setTargetFilter}
              options={[
                { value: 'all', label: 'Kõik masinad ja haakeriistad' },
                ...vehicles.map((v) => ({ value: `veh:${v.id}`, label: v.name, group: '🚜 Masinad' })),
                ...implementsList.map((imp) => ({ value: `imp:${imp.id}`, label: imp.name, group: '🔧 Haakeriistad' }))
              ]}
            />
          </FilterClear>
        </div>

        <ToggleGroup aria-label="Seoste filter" value={statusFilter} onValueChange={(next) => setStatusFilter(next as StatusFilter)}>
          <ToggleGroupItem value="all">Kõik ({assignments.length})</ToggleGroupItem>
          <ToggleGroupItem value="active">Aktiivsed ({assignments.filter((a) => !a.endedAt).length})</ToggleGroupItem>
          <ToggleGroupItem value="ended">Ajalugu ({assignments.filter((a) => !!a.endedAt).length})</ToggleGroupItem>
        </ToggleGroup>

        {hasFilters && (
          <Button variant="ghost" size="sm"
            onClick={() => { setDeviceFilter('all'); setTargetFilter('all'); setStatusFilter('all'); }}
            style={{ fontSize: '12px', marginLeft: 'auto' }}>
            Tühjenda filtrid
          </Button>
        )}

        <Button size="sm"
          onClick={onReload}
          title="Värskenda registrit"
          style={{ marginLeft: hasFilters ? undefined : 'auto' }}>
          <RotateCcw size={14} className={loading ? 'spin' : ''} />
          <span>Värskenda</span>
        </Button>
      </Card>

      {/* Tabel */}
      {loading && assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Laen seadmete seoste registrit...
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="none" className="empty-register-state is-muted">
          <Radio size={36} style={{ opacity: 0.4 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Ühtegi seose kirjet ei leitud
          </div>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {hasFilters
              ? 'Valitud filtritega ei leitud ühtegi seost. Proovi filtreid muuta.'
              : 'Seadmete paigaldused masinatele ja haakeriistadele salvestuvad siia, kui seade kaardilt paigaldatakse või vahetatakse.'}
          </p>
        </Card>
      ) : (
        <Table scroll="fill" bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Seade</TableHead>
                <TableHead>Masin / haakeriist</TableHead>
                <TableHead>Paigaldatud (algus)</TableHead>
                <TableHead>Eemaldatud (lõpp)</TableHead>
                <TableHead numeric>Kestus</TableHead>
                <TableHead>Märkused</TableHead>
                <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const isActive = !a.endedAt;
                const isEye = a.deviceConnectivity === 'eye_sensor';
                return (
                  <TableRow key={a.id} tone={isActive ? 'success' : undefined}>
                    <TableCell wrap>
                      <div className="fleet-cell-main">
                        <div className="fleet-icon-box is-info">
                          {isEye ? <Activity size={15} /> : <Radio size={15} />}
                        </div>
                        <div>
                          <div className="fleet-cell-title">{a.deviceModel || a.deviceId}</div>
                          <div className="fleet-cell-sub">
                            {a.deviceIdentifier ? `${isEye ? 'MAC' : 'IMEI'}: ${a.deviceIdentifier}` : ''}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell wrap>
                      <div className="fleet-cell-main">
                        {a.vehicleId ? (
                          <div className="fleet-icon-box is-success"><Tractor size={15} /></div>
                        ) : (
                          <div className="fleet-icon-box is-warning"><Wrench size={15} /></div>
                        )}
                        <div className="fleet-cell-title">
                          {a.vehicleId ? (a.vehicleName || a.vehicleId) : (a.implementName || a.implementId)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="fleet-cell-date">{formatDateTime(a.startedAt)}</div>
                    </TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge tone="success" dot>Paigaldatud (Aktiivne)</Badge>
                      ) : (
                        <div className="fleet-cell-date-end">{formatDateTime(a.endedAt)}</div>
                      )}
                    </TableCell>
                    <TableCell numeric>
                      <span className={`fleet-cell-duration${isActive ? ' is-active' : ''}`}>
                        {formatDuration(a.startedAt, a.endedAt)}
                      </span>
                    </TableCell>
                    <TableCell wrap>
                      <span className={`fleet-cell-notes${a.notes ? '' : ' is-empty'}`}>
                        {a.notes || '—'}
                      </span>
                    </TableCell>
                    <TableCell actions>
                      {isActive && (
                        <Button type="button"
                          size="sm"
                          title="Seo seade masinast / haakeriistast lahti"
                          onClick={() => onDetach(a.deviceId)}>
                          <Unlink size={12} />
                          <span>Seo lahti</span>
                        </Button>
                      )}
                      <Button type="button"
                        variant="ghost" size="icon-sm"
                        title="Muuda seose kirjet"
                        onClick={() => startEdit(a)}>
                        <Pencil size={14} />
                      </Button>
                      <Button type="button"
                        variant="danger-ghost" size="icon-sm"
                        title="Kustuta seose kirje"
                        onClick={() => handleDelete(a.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      )}

      {/* Lisamise / muutmise vorm */}
      {formOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) onCloseForm(); }}>
          <DialogContent size="lg" className="fleet-edit-modal" dismissible={!submitting}>
            <DialogForm onSubmit={handleSave}>
              <DialogHeader icon={<Link size={20} />} title={editingId ? 'Muuda seose kirjet' : 'Lisa seadme seose kanne'} />

              <DialogBody>
                {error && (
                  <div className="auth-error-banner" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <FormGrid className="fleet-form-grid">
                  <Field label="Seade *" htmlFor="assign-device">
                    <Select id="assign-device" required value={formDeviceId} onValueChange={setFormDeviceId} placeholder="Vali seade..."
                      options={devices.map((d) => ({ value: d.id, label: deviceLabel(d) }))} />
                  </Field>

                  <Field label="Masin / haakeriist *" htmlFor="assign-target">
                    <Select id="assign-target" required value={formTarget} onValueChange={setFormTarget} placeholder="Vali masin või haakeriist..."
                      options={targetOptions} />
                  </Field>

                  <Field label="Paigaldatud (algusaeg) *" htmlFor="assign-start-time">
                    <div className="assign-datetime">
                      <DateInput value={startDate} onChange={setStartDate} required />
                      <Select id="assign-start-time" required value={startTime} onValueChange={setStartTime} options={timeSelectOptions(startTime)} />
                    </div>
                  </Field>

                  <Field label="Eemaldatud (lõppaeg)" htmlFor="assign-end-time">
                    <div className="assign-datetime">
                      <DateInput
                        value={endDate}
                        onChange={(date) => {
                          setEndDate(date);
                          if (!date) setEndTime('');
                          else if (!endTime) setEndTime('17:00');
                        }}
                      />
                      <Select id="assign-end-time" value={endTime} onValueChange={setEndTime} disabled={!endDate}
                        options={endDate ? timeSelectOptions(endTime) : [{ value: '', label: '--:--' }]} />
                    </div>
                    <span className="assign-hint">
                      {endDate ? (
                        <Button variant="link" size="inline" onClick={() => { setEndDate(''); setEndTime(''); }}>
                          Tühjenda lõppaeg (seade on praegu paigaldatud)
                        </Button>
                      ) : (
                        <span className="assign-hint-active">Lõppaeg tühi — seade on praegu paigaldatud</span>
                      )}
                    </span>
                  </Field>

                  <Field label="Märkused" htmlFor="assign-notes" span="full">
                    <Textarea
                      id="assign-notes"
                      rows={2}
                      placeholder="Lisa märkused (nt paigalduskoht, antenn)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </FormGrid>
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCloseForm} disabled={submitting}>Loobu</Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Salvestan...' : (editingId ? 'Salvesta muudatused' : 'Salvesta kanne')}
                </Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
