// src/components/VehicleTracker.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { NumberInput } from './NumberInput';
import {
  X,
  Tractor,
  Fuel,
  Battery,
  Gauge,
  Wrench,
  Crosshair,
  Radio,
  Plus,
  Trash2,
  RotateCcw,
  Link,
  Unlink,
  Info,
  Activity,
  Pencil,
  FileText,
  Filter,
  History
} from 'lucide-react';
import { api } from '../services/api';
import { DateInput } from './DateInput';
import { DeviceAssignmentRegister } from './DeviceAssignmentRegister';
import { formatDateTime, formatDuration, getTimeOptions, splitIsoToDateAndTime, combineDateAndTimeToIso } from './fleetDateTime';
import type {
  Vehicle,
  Implement,
  TelemetryDevice,
  DeviceAssignment,
  EnrichedVehicle,
  VehicleType,
  DepreciationMethod,
  DeviceConnectivity,
  ImplementAssignment
} from '../types/fleet';
import { confirmDialog, alertDialog } from './ConfirmDialog';

interface VehicleTrackerProps {
  isOpen?: boolean;
  isFullPage?: boolean;
  onClose?: () => void;
  vehicles: Vehicle[];
  implementsList: Implement[];
  devices: TelemetryDevice[];
  enrichedVehicles: EnrichedVehicle[];
  selectedVehicle: EnrichedVehicle | null;
  onSelectVehicle: (vehicle: EnrichedVehicle) => void;
  onFocusVehicle: (vehicle: EnrichedVehicle) => void;

  // Reassignment / Movement handlers
  onAssignDevice: (deviceId: string, vehicleId?: string, implementId?: string) => void;
  onAssignImplement: (implementId: string, vehicleId?: string) => void;
  onRegisterChanged: () => void;   // haakimise või seadmete seoste registrit muudeti → värskenda kaartide seoseid

  // CRUD
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle: (id: string, v: Omit<Vehicle, 'id'>) => void;
  onDeleteVehicle: (id: string) => void;
  onAddImplement: (imp: Omit<Implement, 'id'>) => void;
  onUpdateImplement: (id: string, imp: Omit<Implement, 'id'>) => void;
  onDeleteImplement: (id: string) => void;
  onAddDevice: (dev: Omit<TelemetryDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => Promise<boolean>;
  onUpdateDevice: (id: string, dev: Omit<TelemetryDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => Promise<boolean>;
  onDeleteDevice: (id: string) => void;
  telemetryEnabled?: boolean;      // false: telemeetria moodul pole litsentsis → seadmete tabid peidetud
}
type TabType = 'vehicles' | 'implements' | 'devices' | 'history' | 'deviceHistory';

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  tractor: 'Traktor',
  combine: 'Kombain',
  sprayer: 'Iseliikuv prits',
  truck: 'Viljaveok',
  spreader: 'Iseliikuv laotur',
  loader: 'Laadur',
  atv: 'ATV / Maastur'
};

// Andmebaasis juba olevad liigid (tõstutundetult unikaalsed, tähestiku järjekorras)
function distinctCategories(items: { category?: string }[]): string[] {
  const byKey = new Map<string, string>();
  for (const item of items) {
    const c = item.category?.trim();
    if (c && !byKey.has(c.toLocaleLowerCase('et'))) byKey.set(c.toLocaleLowerCase('et'), c);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'et'));
}

// Kui sisestatud liik kattub olemasolevaga (tõstutundetult), kasutatakse olemasoleva kirjapilti
function normalizeCategory(value: string, existing: string[]): string | undefined {
  const s = value.trim().replace(/\s+/g, ' ');
  if (!s) return undefined;
  return existing.find((c) => c.toLocaleLowerCase('et') === s.toLocaleLowerCase('et')) ?? s;
}

interface CategoryInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

// Isetäienev liigi väli: pakub olemasolevaid liike, aga lubab sisestada ka uue
const CategoryInput: React.FC<CategoryInputProps> = ({ id, value, onChange, options, placeholder }) => (
  <>
    <input
      type="text"
      list={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="form-input"
      autoComplete="off"
    />
    <datalist id={id}>
      {options.map((c) => <option key={c} value={c} />)}
    </datalist>
  </>
);

// Vormi numbriväli (koma lubatud) → positiivne arv või undefined
function parsePositive(value: string): number | undefined {
  const n = Number(value.replace(',', '.').trim());
  return value.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}

const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethod, string> = {
  linear: 'Lineaarne',
  declining: 'Degressiivne (jääkväärtusest)'
};

interface DepreciationFieldsProps {
  date: string;
  onDateChange: (value: string) => void;
  cost: string;
  onCostChange: (value: string) => void;
  rate: string;
  onRateChange: (value: string) => void;
  method: DepreciationMethod | '';
  onMethodChange: (value: DepreciationMethod | '') => void;
}

// Soetusmaksumus ja amortisatsioon — sama plokk masina ja haakeriista vormis
const DepreciationFields: React.FC<DepreciationFieldsProps> = ({ date, onDateChange, cost, onCostChange, rate, onRateChange, method, onMethodChange }) => (
  <>
    <div className="form-group">
      <label>Soetamise kuupäev</label>
      <DateInput value={date} onChange={onDateChange} className="form-input" />
    </div>
    <div className="form-group">
      <label>Soetusmaksumus (€)</label>
      <NumberInput
        min={0}
        placeholder="nt 185000"
        value={cost === '' ? null : Number(cost)}
        onChange={(v) => onCostChange(v == null ? '' : String(v))}
      />
    </div>
    <div className="form-group">
      <label>Amortisatsiooni meetod & määr (% aastas)</label>
      <div className="input-split">
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as DepreciationMethod | '')}
          className="form-input"
        >
          <option value="">-- Määramata --</option>
          {(Object.keys(DEPRECIATION_METHOD_LABELS) as DepreciationMethod[]).map((m) => (
            <option key={m} value={m}>{DEPRECIATION_METHOD_LABELS[m]}</option>
          ))}
        </select>
        <NumberInput
          min={0}
          max={100}
          placeholder="nt 20"
          value={rate === '' ? null : Number(rate)}
          onChange={(v) => onRateChange(v == null ? '' : String(v))}
        />
      </div>
    </div>
  </>
);

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  className = '',
  rows = 2,
  style,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const targetHeight = Math.max(scrollH, 62);
    el.style.height = `${targetHeight}px`;
    el.style.overflowY = scrollH > 320 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      rows={rows}
      className={`form-input auto-resize-textarea ${className}`}
      style={{
        resize: 'vertical',
        minHeight: '62px',
        maxHeight: '320px',
        lineHeight: 1.45,
        ...style
      }}
      {...props}
    />
  );
};

export const VehicleTracker: React.FC<VehicleTrackerProps> = ({
  isOpen = true,
  isFullPage = false,
  onClose,
  vehicles,
  implementsList,
  devices,
  enrichedVehicles,
  selectedVehicle,
  onSelectVehicle,
  onFocusVehicle,
  onAssignDevice,
  onAssignImplement,
  onRegisterChanged,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onAddImplement,
  onUpdateImplement,
  onDeleteImplement,
  onAddDevice,
  onUpdateDevice,
  onDeleteDevice,
  telemetryEnabled = true,
}) => {
  const [selectedTab, setActiveTab] = useState<TabType>('vehicles');
  // Ilma telemeetriamoodulita seadmete tabid puuduvad → langeb tagasi masinate tabile
  const activeTab: TabType = !telemetryEnabled && (selectedTab === 'devices' || selectedTab === 'deviceHistory') ? 'vehicles' : selectedTab;
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Kui mõni neist on seatud, käitub aktiivse vahekaardi vorm muutmisrežiimis
  // (eeltäidetud väljad, "Salvesta muudatused") lisamise asemel.
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingImplementId, setEditingImplementId] = useState<string | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  // Forms states
  // 1. Vehicle Form
  const [vName, setVName] = useState('');
  const [vManufacturer, setVManufacturer] = useState('');
  const [vModel, setVModel] = useState('');
  const [vType, setVType] = useState<VehicleType>('tractor');
  const [vCategory, setVCategory] = useState('');
  const [vPowerKw, setVPowerKw] = useState('');
  const [vCost, setVCost] = useState('');
  const [vAcqDate, setVAcqDate] = useState('');
  const [vDepRate, setVDepRate] = useState('');
  const [vDepMethod, setVDepMethod] = useState<DepreciationMethod | ''>('');
  const [vPlate, setVPlate] = useState('');
  const [vSerial, setVSerial] = useState('');
  const [vDriver, setVDriver] = useState('');
  const [vColor, setVColor] = useState('#22c55e');
  const [vNotes, setVNotes] = useState('');

  // 2. Implement Form
  const [impName, setImpName] = useState('');
  const [impManufacturer, setImpManufacturer] = useState('');
  const [impModel, setImpModel] = useState('');
  const [impCategory, setImpCategory] = useState('');
  const [impCost, setImpCost] = useState('');
  const [impAcqDate, setImpAcqDate] = useState('');
  const [impDepRate, setImpDepRate] = useState('');
  const [impDepMethod, setImpDepMethod] = useState<DepreciationMethod | ''>('');
  const [impWidth, setImpWidth] = useState<number | null>(8.0);
  const [impSerial, setImpSerial] = useState('');
  const [impNotes, setImpNotes] = useState('');

  // Masinate ja haakeriistade liigid on eraldi nimekirjad
  const vehicleCategories = useMemo(() => distinctCategories(vehicles), [vehicles]);
  const implementCategories = useMemo(() => distinctCategories(implementsList), [implementsList]);

  // 3. Telemeetriaseadme vorm
  const [devConnectivity, setDevConnectivity] = useState<DeviceConnectivity>('cellular');
  const [devModel, setDevModel] = useState('');
  const [devImei, setDevImei] = useState('');
  const [devSim, setDevSim] = useState('');
  const [devMac, setDevMac] = useState('');
  // Kombineeritud sihtmärgi valik: '' | `veh:<id>` | `imp:<id>` — mõlemat
  // tüüpi seadet saab paigaldada kas masinasse või haakeriista külge.
  const [devNotes, setDevNotes] = useState('');
  const [devSaving, setDevSaving] = useState(false);
  const [devAcqDate, setDevAcqDate] = useState('');

  const handleConnectivityChange = (next: DeviceConnectivity) => {
    setDevConnectivity(next);
    setDevModel('');
    setDevImei('');
    setDevSim('');
    setDevMac('');
  };

  // Quick swap modals state
  const [swapModal, setSwapModal] = useState<{
    type: 'device' | 'implement';
    targetVehicleId: string;
    targetVehicleName: string;
  } | null>(null);

  // 4. Implement Assignment History & Form State
  const [implementAssignments, setImplementAssignments] = useState<ImplementAssignment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState<string>('all');
  const [historyImplementFilter, setHistoryImplementFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'active' | 'ended'>('all');

  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignImplementId, setAssignImplementId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignStartTime, setAssignStartTime] = useState('08:00');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assignEndTime, setAssignEndTime] = useState('17:00');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const resetAssignmentForm = () => {
    setEditingAssignmentId(null);
    setAssignVehicleId(vehicles[0]?.id || '');
    setAssignImplementId(implementsList[0]?.id || '');
    const now = new Date();
    const { date, time } = splitIsoToDateAndTime(now.toISOString());
    setAssignStartDate(date);
    setAssignStartTime(time || '08:00');
    setAssignEndDate('');
    setAssignEndTime('');
    setAssignNotes('');
    setAssignmentError(null);
  };

  const handleStartEditAssignment = (assignment: ImplementAssignment) => {
    setEditingAssignmentId(assignment.id);
    setAssignVehicleId(assignment.vehicleId);
    setAssignImplementId(assignment.implementId);

    const start = splitIsoToDateAndTime(assignment.startedAt);
    setAssignStartDate(start.date);
    setAssignStartTime(start.time || '08:00');

    if (assignment.endedAt) {
      const end = splitIsoToDateAndTime(assignment.endedAt);
      setAssignEndDate(end.date);
      setAssignEndTime(end.time || '17:00');
    } else {
      setAssignEndDate('');
      setAssignEndTime('');
    }

    setAssignNotes(assignment.notes || '');
    setAssignmentError(null);
    setIsAddingNew(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignVehicleId || !assignImplementId || !assignStartDate) {
      setAssignmentError('Vali masin, haakeriist ja haakimise alguskuupäev.');
      return;
    }

    const startedAtIso = combineDateAndTimeToIso(assignStartDate, assignStartTime);
    if (!startedAtIso) {
      setAssignmentError('Vigane haakimise alguskuupäev või kellaaeg.');
      return;
    }

    // Tühi lõppkuupäev = haakeriist on praegu masina küljes
    let endedAtIso: string | null = null;
    if (assignEndDate) {
      endedAtIso = combineDateAndTimeToIso(assignEndDate, assignEndTime);
      if (!endedAtIso) {
        setAssignmentError('Vigane lahti haakimise kuupäev või kellaaeg.');
        return;
      }
      if (new Date(endedAtIso).getTime() < new Date(startedAtIso).getTime()) {
        setAssignmentError('Lahti haakimise aeg ei saa olla varasem kui haakimise algusaeg.');
        return;
      }
    }

    setAssignmentSubmitting(true);
    setAssignmentError(null);

    try {
      if (editingAssignmentId) {
        const updated = await api.updateImplementAssignment(editingAssignmentId, {
          vehicleId: assignVehicleId,
          implementId: assignImplementId,
          startedAt: startedAtIso,
          endedAt: endedAtIso,
          notes: assignNotes.trim() || undefined
        });

        setImplementAssignments((prev) =>
          prev.map((a) => (a.id === editingAssignmentId ? updated : a))
        );
      } else {
        const created = await api.createImplementAssignment({
          vehicleId: assignVehicleId,
          implementId: assignImplementId,
          startedAt: startedAtIso,
          endedAt: endedAtIso,
          notes: assignNotes.trim() || undefined
        });

        setImplementAssignments((prev) => [created, ...prev]);
      }

      onRegisterChanged();
      closeForm();
      loadImplementAssignments();
    } catch (err: any) {
      console.error('Failed to save implement assignment:', err);
      setAssignmentError(err.message || 'Salvestamine ebaõnnestus');
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  const loadImplementAssignments = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getImplementAssignments();
      setImplementAssignments(data);
    } catch (err) {
      console.error('Error fetching implement assignments:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen || isFullPage) {
      loadImplementAssignments();
    }
  }, [isOpen, isFullPage, loadImplementAssignments]);

  // Telemeetriaseadmete seoste register
  const [deviceAssignments, setDeviceAssignments] = useState<DeviceAssignment[]>([]);
  const [deviceHistoryLoading, setDeviceHistoryLoading] = useState(false);

  const loadDeviceAssignments = useCallback(async () => {
    if (!telemetryEnabled) return;
    setDeviceHistoryLoading(true);
    try {
      setDeviceAssignments(await api.getDeviceAssignments());
    } catch (err) {
      console.error('Error fetching device assignments:', err);
    } finally {
      setDeviceHistoryLoading(false);
    }
  }, [telemetryEnabled]);

  useEffect(() => {
    if (isOpen || isFullPage) {
      loadDeviceAssignments();
    }
  }, [isOpen, isFullPage, loadDeviceAssignments]);

  // Kaardilt seadme paigaldamine/vahetamine/eemaldamine → kirje seoste registrisse
  const assignDevice = (deviceId: string, vehicleId?: string, implementId?: string) => {
    if (!telemetryEnabled) return;
    onAssignDevice(deviceId, vehicleId, implementId);
    setTimeout(loadDeviceAssignments, 400);
  };

  const filteredAssignments = useMemo(() => {
    return implementAssignments.filter((a) => {
      if (historyVehicleFilter !== 'all' && a.vehicleId !== historyVehicleFilter) return false;
      if (historyImplementFilter !== 'all' && a.implementId !== historyImplementFilter) return false;
      if (historyStatusFilter === 'active' && a.endedAt) return false;
      if (historyStatusFilter === 'ended' && !a.endedAt) return false;
      return true;
    });
  }, [implementAssignments, historyVehicleFilter, historyImplementFilter, historyStatusFilter]);

  const handleDeleteAssignment = async (id: string) => {
    if (!await confirmDialog('Kas soovid kindlasti selle haakimise kirje ajaloost kustutada?')) return;
    try {
      await api.deleteImplementAssignment(id);
      setImplementAssignments((prev) => prev.filter((a) => a.id !== id));
      onRegisterChanged();
      loadImplementAssignments();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Haakimise kirje kustutamine ebaõnnestus');
    }
  };

  const handleDetachActiveAssignment = (implementId: string) => {
    onAssignImplement(implementId, undefined);
    setTimeout(() => {
      loadImplementAssignments();
    }, 400);
  };

  // Esc sulgeb ainult lisamis-/muutmisvormi (register jääb avatuks).
  useEffect(() => {
    if (!isAddingNew) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddingNew(false);
        setEditingVehicleId(null);
        setEditingImplementId(null);
        setEditingDeviceId(null);
        setEditingAssignmentId(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isAddingNew]);

  if (!isOpen && !isFullPage) return null;

  const closeForm = () => {
    setIsAddingNew(false);
    setEditingVehicleId(null);
    setEditingImplementId(null);
    setEditingDeviceId(null);
    setEditingAssignmentId(null);
    setAssignmentError(null);
  };

  // Tühjendab vormi väljad, et üleminek muutmisrežiimist uue kirje
  // lisamisele (või vastupidi) ei jätaks eelmise kirje väärtusi alles.
  const resetVehicleForm = () => {
    setVName('');
    setVManufacturer('');
    setVModel('');
    setVType('tractor');
    setVCategory('');
    setVPowerKw('');
    setVCost('');
    setVAcqDate('');
    setVDepRate('');
    setVDepMethod('');
    setVPlate('');
    setVSerial('');
    setVDriver('');
    setVColor('#22c55e');
    setVNotes('');
  };

  const resetImplementForm = () => {
    setImpName('');
    setImpManufacturer('');
    setImpModel('');
    setImpCategory('');
    setImpCost('');
    setImpAcqDate('');
    setImpDepRate('');
    setImpDepMethod('');
    setImpWidth(8.0);
    setImpSerial('');
    setImpNotes('');
  };

  const resetDeviceForm = () => {
    setDevConnectivity('cellular');
    setDevModel('');
    setDevImei('');
    setDevSim('');
    setDevMac('');
    setDevNotes('');
    setDevAcqDate('');
  };

  const openAddForm = () => {
    if (activeTab === 'vehicles') resetVehicleForm();
    else if (activeTab === 'implements') resetImplementForm();
    else if (activeTab === 'devices') resetDeviceForm();
    else if (activeTab === 'history') resetAssignmentForm();
    setIsAddingNew(true);
  };

  // Handle forms submits
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;
    const payload = {
      name: vName.trim(),
      manufacturer: vManufacturer.trim() || undefined,
      model: vModel.trim(),
      type: vType,
      category: normalizeCategory(vCategory, vehicleCategories),
      powerKw: parsePositive(vPowerKw),
      acquisitionCost: parsePositive(vCost),
      acquisitionDate: vAcqDate || undefined,
      depreciationRate: parsePositive(vDepRate),
      depreciationMethod: vDepMethod || undefined,
      registrationPlate: vPlate.trim() || undefined,
      serialNumber: vSerial.trim() || undefined,
      driverName: vDriver.trim() || undefined,
      color: vColor,
      notes: vNotes.trim() || undefined
    };
    if (editingVehicleId) {
      onUpdateVehicle(editingVehicleId, payload);
    } else {
      onAddVehicle(payload);
    }
    closeForm();
    setVName('');
    setVManufacturer('');
    setVModel('');
    setVPlate('');
    setVSerial('');
    setVNotes('');
  };

  const handleCreateImplement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!impName.trim()) return;
    const payload = {
      name: impName.trim(),
      manufacturer: impManufacturer.trim(),
      model: impModel.trim(),
      // Tüüpi vormis pole (asendab liik); olemasoleval kirjel jääb see muutmata
      type: implementsList.find((i) => i.id === editingImplementId)?.type ?? 'other',
      category: normalizeCategory(impCategory, implementCategories),
      acquisitionCost: parsePositive(impCost),
      acquisitionDate: impAcqDate || undefined,
      depreciationRate: parsePositive(impDepRate),
      depreciationMethod: impDepMethod || undefined,
      workingWidthM: impWidth || 6.0,
      serialNumber: impSerial.trim() || undefined,
      isActive: false,
      notes: impNotes.trim() || undefined
    };
    if (editingImplementId) {
      onUpdateImplement(editingImplementId, payload);
    } else {
      onAddImplement(payload);
    }
    closeForm();
    setImpName('');
    setImpManufacturer('');
    setImpModel('');
    setImpNotes('');
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (devConnectivity === 'cellular' && !devImei.trim()) return;
    if (devConnectivity === 'eye_sensor' && !devMac.trim()) return;

    const payload = {
      connectivityType: devConnectivity,
      model: devModel.trim() || (devConnectivity === 'eye_sensor' ? 'EYE sensor' : 'GPS-jälgur'),
      imei: devConnectivity === 'cellular' ? devImei.trim() : undefined,
      simNumber: devConnectivity === 'cellular' ? (devSim.trim() || '+372 5...') : undefined,
      macAddress: devConnectivity === 'eye_sensor' ? devMac.trim().toUpperCase() : undefined,
      batteryVoltage: devConnectivity === 'eye_sensor' ? 3.0 : 27.5,
      fuelLevelPct: 100,
      ignition: false,
      hydraulicActive: false,
      satelliteCount: devConnectivity === 'eye_sensor' ? 0 : 16,
      hdop: devConnectivity === 'eye_sensor' ? 0 : 0.8,
      acquisitionDate: devAcqDate || undefined,
      notes: devNotes.trim() || undefined
    };
    if (devSaving) return;
    setDevSaving(true);
    let saved = false;
    try {
      saved = editingDeviceId
        ? await onUpdateDevice(editingDeviceId, payload)
        : await onAddDevice(payload);
    } finally {
      setDevSaving(false);
    }
    if (!saved) return; // viga on kuvatud; vorm jääb avatuks parandamiseks
    closeForm();
    setDevImei('');
    setDevSim('');
    setDevMac('');
    setDevNotes('');
  };

  const startEditVehicle = (v: Vehicle) => {
    setVName(v.name);
    setVManufacturer(v.manufacturer || '');
    setVModel(v.model);
    setVType(v.type);
    setVCategory(v.category || '');
    setVPowerKw(v.powerKw != null ? String(v.powerKw) : '');
    setVCost(v.acquisitionCost != null ? String(v.acquisitionCost) : '');
    setVAcqDate(v.acquisitionDate || '');
    setVDepRate(v.depreciationRate != null ? String(v.depreciationRate) : '');
    setVDepMethod(v.depreciationMethod || '');
    setVPlate(v.registrationPlate || '');
    setVSerial(v.serialNumber || '');
    setVDriver(v.driverName || '');
    setVColor(v.color);
    setVNotes(v.notes || '');
    setEditingVehicleId(v.id);
    setIsAddingNew(true);
  };

  const startEditImplement = (imp: Implement) => {
    setImpName(imp.name);
    setImpManufacturer(imp.manufacturer);
    setImpModel(imp.model);
    setImpCategory(imp.category || '');
    setImpCost(imp.acquisitionCost != null ? String(imp.acquisitionCost) : '');
    setImpAcqDate(imp.acquisitionDate || '');
    setImpDepRate(imp.depreciationRate != null ? String(imp.depreciationRate) : '');
    setImpDepMethod(imp.depreciationMethod || '');
    setImpWidth(imp.workingWidthM);
    setImpSerial(imp.serialNumber || '');
    setImpNotes(imp.notes || '');
    setEditingImplementId(imp.id);
    setIsAddingNew(true);
  };

  const startEditDevice = (dev: TelemetryDevice) => {
    setDevConnectivity(dev.connectivityType);
    setDevModel(dev.model);
    setDevImei(dev.imei || '');
    setDevSim(dev.simNumber || '');
    setDevMac(dev.macAddress || '');
    setDevNotes(dev.notes || '');
    setDevAcqDate(dev.acquisitionDate || '');
    setEditingDeviceId(dev.id);
    setIsAddingNew(true);
  };

  const bodyContent = (
    <>
      {/* Main Navigation Tabs */}
      <div className="fleet-top-bar">
        <div className="category-filter-tabs">
          <button
            className={`filter-tab ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => { setActiveTab('vehicles'); closeForm(); }}
          >
            <span>🚜 Masinad</span>
            <span className="count-pill">{vehicles.length}</span>
          </button>

          <button
            className={`filter-tab ${activeTab === 'implements' ? 'active' : ''}`}
            onClick={() => { setActiveTab('implements'); closeForm(); }}
          >
            <span>🔧 Haakeriistad</span>
            <span className="count-pill">{implementsList.length}</span>
          </button>

          <button
            className={`filter-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); closeForm(); loadImplementAssignments(); }}
          >
            <span>📜 Haakimiste register</span>
            <span className="count-pill">{implementAssignments.length}</span>
          </button>

          {telemetryEnabled && (
          <button
            className={`filter-tab ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => { setActiveTab('devices'); closeForm(); }}
          >
            <span>📡 Telemeetria seadmed</span>
            <span className="count-pill">{devices.length}</span>
          </button>
          )}

          {telemetryEnabled && (
          <button
            className={`filter-tab ${activeTab === 'deviceHistory' ? 'active' : ''}`}
            onClick={() => { setActiveTab('deviceHistory'); closeForm(); loadDeviceAssignments(); }}
          >
            <span>🔗 Seadmete seosed</span>
            <span className="count-pill">{deviceAssignments.length}</span>
          </button>
          )}
        </div>

        {!isAddingNew && (
          <button
            className="btn btn-primary btn-sm"
            onClick={openAddForm}
          >
            <Plus size={14} />
            <span>
              {activeTab === 'vehicles' ? 'Lisa uus masin' : (
                activeTab === 'implements' ? 'Lisa uus haakeriist' : (
                  activeTab === 'devices' ? 'Registreeri telemeetriaseade' : (
                    activeTab === 'deviceHistory' ? 'Lisa seadme seose kanne' : 'Lisa haakimise kanne'
                  )
                )
              )}
            </span>
          </button>
        )}
      </div>

      {/* ADD FORMS eraldi aknas registri peal (portal: registri aken on glass-card,
              mille backdrop-filter piiraks muidu position: fixed tausta) */}
      {isAddingNew && activeTab === 'vehicles' && createPortal(
        <div className="modal-backdrop sub-modal">
          <form onSubmit={handleCreateVehicle} className="modal-content fleet-edit-modal animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-group">
                <Tractor size={20} className="text-emerald" />
                <h3>{editingVehicleId ? `Muuda masinat: ${vName}` : 'Lisa uus masin'}</h3>
              </div>
              <button className="icon-btn-ghost" type="button" onClick={closeForm} title="Sulge (Esc)">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">

              <div className="form-grid">
                <div className="form-group">
                  <label>Masina nimi *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt John Deere 8R 410"
                    value={vName}
                    onChange={(e) => setVName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Liik</label>
                  <CategoryInput
                    id="vehicle-category-options"
                    value={vCategory}
                    onChange={setVCategory}
                    options={vehicleCategories}
                    placeholder="Vali olemasolev või sisesta uus"
                  />
                </div>
                <div className="form-group">
                  <label>Tootja & Mudel</label>
                  <div className="input-split">
                    <input
                      type="text"
                      placeholder="John Deere"
                      value={vManufacturer}
                      onChange={(e) => setVManufacturer(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="8R 410"
                      value={vModel}
                      onChange={(e) => setVModel(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Võimsus (kW)</label>
                  <NumberInput
                    min={0}
                    placeholder="nt 302"
                    value={vPowerKw === '' ? null : Number(vPowerKw)}
                    onChange={(v) => setVPowerKw(v == null ? '' : String(v))}
                  />
                </div>
                <div className="form-group">
                  <label>Masina tüüp ja värv</label>
                  <div className="input-split">
                    <select
                      value={vType}
                      onChange={(e) => setVType(e.target.value as VehicleType)}
                      className="form-input"
                    >
                      {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((t) => (
                        <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <input
                      type="color"
                      value={vColor}
                      onChange={(e) => setVColor(e.target.value)}
                      className="form-input"
                      style={{ padding: '2px', height: '36px' }}
                      title="Kaardimarkeri värv"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Registrinumber & Juht</label>
                  <div className="input-split">
                    <input
                      type="text"
                      placeholder="4821 TH"
                      value={vPlate}
                      onChange={(e) => setVPlate(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Juhi nimi"
                      value={vDriver}
                      onChange={(e) => setVDriver(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>VIN / Seerianumber</label>
                  <input
                    type="text"
                    placeholder="nt 1RW8R410JKD012345"
                    value={vSerial}
                    onChange={(e) => setVSerial(e.target.value)}
                    className="form-input"
                  />
                </div>
                <DepreciationFields
                  date={vAcqDate}
                  onDateChange={setVAcqDate}
                  cost={vCost}
                  onCostChange={setVCost}
                  rate={vDepRate}
                  onRateChange={setVDepRate}
                  method={vDepMethod}
                  onMethodChange={setVDepMethod}
                />
                <div className="form-group full-width">
                  <label>Märkused</label>
                  <AutoResizeTextarea
                    placeholder="Märkused masina kohta (nt hooldusvajadus, eriseadistus jne)..."
                    value={vNotes}
                    onChange={(e) => setVNotes(e.target.value)}
                  />
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Loobu</button>
              <button type="submit" className="btn btn-primary">{editingVehicleId ? 'Salvesta muudatused' : 'Salvesta masin'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {isAddingNew && activeTab === 'implements' && createPortal(
        <div className="modal-backdrop sub-modal">
          <form onSubmit={handleCreateImplement} className="modal-content fleet-edit-modal animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-group">
                <Wrench size={20} className="text-emerald" />
                <h3>{editingImplementId ? `Muuda haakeriista: ${impName}` : 'Lisa uus haakeriist'}</h3>
              </div>
              <button className="icon-btn-ghost" type="button" onClick={closeForm} title="Sulge (Esc)">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">

              <div className="form-grid">
                <div className="form-group">
                  <label>Haakeriista nimi *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt Väderstad Tempo L 16"
                    value={impName}
                    onChange={(e) => setImpName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Liik</label>
                  <CategoryInput
                    id="implement-category-options"
                    value={impCategory}
                    onChange={setImpCategory}
                    options={implementCategories}
                    placeholder="Vali olemasolev või sisesta uus"
                  />
                </div>
                <div className="form-group">
                  <label>Tootja & Mudel</label>
                  <div className="input-split">
                    <input
                      type="text"
                      placeholder="Väderstad"
                      value={impManufacturer}
                      onChange={(e) => setImpManufacturer(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Tempo L 16"
                      value={impModel}
                      onChange={(e) => setImpModel(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Töölaius (m) *</label>
                  <NumberInput
                    required
                    decimals={1}
                    value={impWidth}
                    onChange={setImpWidth}
                  />
                </div>
                <div className="form-group">
                  <label>VIN / Seerianumber</label>
                  <input
                    type="text"
                    placeholder="nt TPL16-88902"
                    value={impSerial}
                    onChange={(e) => setImpSerial(e.target.value)}
                    className="form-input"
                  />
                </div>
                <DepreciationFields
                  date={impAcqDate}
                  onDateChange={setImpAcqDate}
                  cost={impCost}
                  onCostChange={setImpCost}
                  rate={impDepRate}
                  onRateChange={setImpDepRate}
                  method={impDepMethod}
                  onMethodChange={setImpDepMethod}
                />
                <div className="form-group full-width">
                  <label>Märkused</label>
                  <AutoResizeTextarea
                    placeholder="Märkused haakeriista kohta (nt kuluosad, asukoht jne)..."
                    value={impNotes}
                    onChange={(e) => setImpNotes(e.target.value)}
                  />
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Loobu</button>
              <button type="submit" className="btn btn-primary">{editingImplementId ? 'Salvesta muudatused' : 'Salvesta haakeriist'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {isAddingNew && activeTab === 'devices' && createPortal(
        <div className="modal-backdrop sub-modal">
          <form onSubmit={handleCreateDevice} className="modal-content fleet-edit-modal animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-group">
                <Radio size={20} className="text-emerald" />
                <h3>{editingDeviceId ? `Muuda seadet: ${devModel}` : 'Registreeri telemeetriaseade'}</h3>
              </div>
              <button className="icon-btn-ghost" type="button" onClick={closeForm} title="Sulge (Esc)">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">

              <div className="form-group connectivity-type-picker">
                <label>Seadme tüüp</label>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-option ${devConnectivity === 'cellular' ? 'active' : ''}`}
                    onClick={() => handleConnectivityChange('cellular')}
                  >
                    <Radio size={14} />
                    <span>Mobiilne GPS (IMEI/SIM)</span>
                  </button>
                  <button
                    type="button"
                    className={`segmented-option ${devConnectivity === 'eye_sensor' ? 'active' : ''}`}
                    onClick={() => handleConnectivityChange('eye_sensor')}
                  >
                    <Activity size={14} />
                    <span>Eye Sensor (MAC)</span>
                  </button>
                </div>
              </div>
              <div className="form-grid">
                {devConnectivity === 'cellular' ? (
                  <>
                    <div className="form-group">
                      <label>Seadme mudel</label>
                      <input
                        type="text"
                        placeholder="nt Teltonika FMC650 4G LTE"
                        value={devModel}
                        onChange={(e) => setDevModel(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>IMEI kood (15 numbrit) *</label>
                      <input
                        type="text"
                        required
                        placeholder="861234058812001"
                        value={devImei}
                        onChange={(e) => setDevImei(e.target.value)}
                        inputMode="numeric"
                        maxLength={15}
                        className="form-input"
                      />
                      <small style={{ color: 'var(--text-muted, #6b7280)' }}>15 numbrit</small>
                    </div>
                    <div className="form-group">
                      <label>SIM kaardi number</label>
                      <input
                        type="text"
                        placeholder="+372 5311 8812"
                        value={devSim}
                        onChange={(e) => setDevSim(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Seadme mudel</label>
                      <input
                        type="text"
                        placeholder="nt Teltonika EYE Sensor"
                        value={devModel}
                        onChange={(e) => setDevModel(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>MAC aadress *</label>
                      <input
                        type="text"
                        required
                        placeholder="AA:BB:CC:DD:EE:FF"
                        value={devMac}
                        onChange={(e) => setDevMac(e.target.value)}
                        className="form-input"
                      />
                      <small style={{ color: 'var(--text-muted, #6b7280)' }}>nt AA:BB:CC:DD:EE:FF</small>
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>Soetamise kuupäev</label>
                  <DateInput value={devAcqDate} onChange={setDevAcqDate} className="form-input" />
                </div>
                <div className="form-group full-width">
                  <label>Märkused</label>
                  <AutoResizeTextarea
                    placeholder="Märkused seadme kohta (nt paigalduskoht masinas, antenn jne)..."
                    value={devNotes}
                    onChange={(e) => setDevNotes(e.target.value)}
                  />
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Loobu</button>
              <button type="submit" className="btn btn-primary" disabled={devSaving}>{editingDeviceId ? 'Salvesta muudatused' : 'Registreeri seade'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {isAddingNew && activeTab === 'history' && createPortal(
        <div className="modal-backdrop sub-modal">
          <form onSubmit={handleSaveAssignment} className="modal-content fleet-edit-modal animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-group">
                <Link size={20} className="text-emerald" />
                <h3>{editingAssignmentId ? 'Muuda haakimise kirjet' : 'Lisa uus haakimise kanne'}</h3>
              </div>
              <button className="icon-btn-ghost" type="button" onClick={closeForm} title="Sulge (Esc)">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {assignmentError && (
                <div className="auth-error-banner" style={{ marginBottom: '16px' }}>
                  {assignmentError}
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Masin *</label>
                  <select
                    required
                    value={assignVehicleId}
                    onChange={(e) => setAssignVehicleId(e.target.value)}
                    className="form-input"
                  >
                    <option value="" disabled>Vali masin...</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({VEHICLE_TYPE_LABELS[v.type] || v.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Haakeriist *</label>
                  <select
                    required
                    value={assignImplementId}
                    onChange={(e) => setAssignImplementId(e.target.value)}
                    className="form-input"
                  >
                    <option value="" disabled>Vali haakeriist...</option>
                    {implementsList.map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {imp.name}{imp.category ? ` (${imp.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Haagitud (algusaeg) *</label>
                  <div className="assign-datetime">
                    <DateInput
                      value={assignStartDate}
                      onChange={setAssignStartDate}
                      className="form-input"
                      required
                    />
                    <select
                      className="form-input time-select"
                      value={assignStartTime}
                      onChange={(e) => setAssignStartTime(e.target.value)}
                      required
                    >
                      {getTimeOptions(assignStartTime).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Lahti haagitud (lõppaeg)</label>
                  <div className="assign-datetime">
                    <DateInput
                      value={assignEndDate}
                      onChange={(date) => {
                        setAssignEndDate(date);
                        if (!date) setAssignEndTime('');
                        else if (!assignEndTime) setAssignEndTime('17:00');
                      }}
                      className="form-input"
                    />
                    <select
                      className="form-input time-select"
                      value={assignEndTime}
                      onChange={(e) => setAssignEndTime(e.target.value)}
                      disabled={!assignEndDate}
                    >
                      {!assignEndDate && <option value="">--:--</option>}
                      {getTimeOptions(assignEndTime || undefined).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <span className="assign-hint">
                    {assignEndDate ? (
                      <button type="button" className="assign-hint-link" onClick={() => { setAssignEndDate(''); setAssignEndTime(''); }}>
                        Tühjenda lõppaeg (haakeriist on praegu küljes)
                      </button>
                    ) : (
                      <span className="assign-hint-active">Lõppaeg tühi — haakeriist on praegu masina küljes</span>
                    )}
                  </span>
                </div>

                <div className="form-group full-width">
                  <label>Märkused</label>
                  <AutoResizeTextarea
                    placeholder="Lisa märkused, tööülesanne või lisainfo..."
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="form-input"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeForm} disabled={assignmentSubmitting}>
                Loobu
              </button>
              <button type="submit" className="btn btn-primary" disabled={assignmentSubmitting}>
                {assignmentSubmitting ? 'Salvestan...' : (editingAssignmentId ? 'Salvesta muudatused' : 'Salvesta kanne')}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* TAB 1: SÕIDUKID / MASINAD */}
      {activeTab === 'vehicles' && (
        <div className="vehicle-grid">
          {enrichedVehicles.map((v) => {
            const isSelected = selectedVehicle && selectedVehicle.id === v.id;
            const installedDevice = devices.find((d) => d.id === v.assignedDeviceId || d.assignedVehicleId === v.id);
            const attachedImplement = implementsList.find((imp) => imp.id === v.assignedImplementId || imp.assignedVehicleId === v.id);

            return (
              <div
                key={v.id}
                className={`vehicle-card glass-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectVehicle(v)}
              >
                <div className="v-card-header">
                  <div className="v-title-wrap">
                    <div className="v-avatar" style={{ borderColor: v.color }}>
                      <Tractor size={20} style={{ color: v.color }} />
                    </div>
                    <div>
                      <h4 className="v-name">{v.name}</h4>
                      <span className="v-model">{[v.category, [v.manufacturer, v.model].filter(Boolean).join(' '), v.powerKw ? `${v.powerKw} kW` : null, v.registrationPlate || 'Reg. nr puudub'].filter(Boolean).join(' • ')}</span>
                    </div>
                  </div>

                  <div className="card-header-right">
                    <span className={`status-badge status-${v.status}`}>
                      {v.status === 'working' ? 'Töötav' : (v.status === 'moving' ? 'Liikuv' : (v.status === 'idling' ? 'Tühikäik' : (v.status === 'stopped' ? 'Seisev' : 'Offline')))}
                    </span>
                    <div className="card-header-actions">
                      <button
                        className="icon-btn-ghost"
                        title="Vaata selle masina haakimise ajalugu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryVehicleFilter(v.id);
                          setHistoryImplementFilter('all');
                          setHistoryStatusFilter('all');
                          setActiveTab('history');
                          loadImplementAssignments();
                        }}
                      >
                        <History size={14} />
                      </button>
                      <button
                        className="icon-btn-ghost"
                        title="Muuda masina andmeid"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditVehicle(v);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-btn-danger"
                        title="Kustuta masin"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await confirmDialog(`Kas soovid kindlasti kustutada masina "${v.name}"?`)) {
                            onDeleteVehicle(v.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="v-info-rows">
                  {/* Equipment Assignment Badges with Swap Actions */}
                  <div className="v-equipment-badge-row">
                    {/* Device Badge */}
                    {telemetryEnabled && (
                    <div className="equipment-tag device-tag">
                      <Radio size={12} className="text-blue" />
                      <span className="tag-text">
                        {installedDevice ? `${installedDevice.model} (${installedDevice.connectivityType === 'eye_sensor' ? installedDevice.macAddress : installedDevice.imei?.slice(-4)})` : 'GPS puudub'}
                      </span>
                      <button
                        className="mini-swap-btn"
                        title="Vaheta või eemalda telemeetriaseade"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapModal({ type: 'device', targetVehicleId: v.id, targetVehicleName: v.name });
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>Vaheta</span>
                      </button>
                    </div>
                    )}

                    {/* Implement Badge */}
                    <div className="equipment-tag implement-tag">
                      <Wrench size={12} className="text-emerald" />
                      <span className="tag-text">
                        {attachedImplement ? `${attachedImplement.name} (${attachedImplement.workingWidthM}m)` : 'Haakeriist puudub'}
                      </span>
                      <button
                        className="mini-swap-btn"
                        title="Haagi teine tööriist või eemalda"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapModal({ type: 'implement', targetVehicleId: v.id, targetVehicleName: v.name });
                        }}
                      >
                        <Link size={11} />
                        <span>Haagi</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Märkused */}
                {v.notes && (
                  <div
                    className="fleet-card-notes"
                    title="Kliki märkuse muutmiseks"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditVehicle(v);
                    }}
                  >
                    <FileText size={13} />
                    <span>{v.notes}</span>
                  </div>
                )}

                {/* Telemetry live gauges if device is installed */}
                {installedDevice ? (
                  <div className="v-gauges-grid">
                    <div className="gauge-item">
                      <Gauge size={14} className="text-blue" />
                      <div className="gauge-text">
                        <span className="gauge-lbl">Kiirus</span>
                        <strong>{v.speedKmH.toFixed(1)} km/h</strong>
                      </div>
                    </div>

                    <div className="gauge-item">
                      <Fuel size={14} className="text-amber" />
                      <div className="gauge-text">
                        <span className="gauge-lbl">Kütus</span>
                        <strong>{v.telemetry.fuelLevelPct}%</strong>
                      </div>
                    </div>

                    <div className="gauge-item">
                      <Battery size={14} className="text-emerald" />
                      <div className="gauge-text">
                        <span className="gauge-lbl">Aku</span>
                        <strong>{v.telemetry.batteryVoltage} V</strong>
                      </div>
                    </div>

                    <div className="gauge-item">
                      <Activity size={14} className="text-purple" />
                      <div className="gauge-text">
                        <span className="gauge-lbl">Pöörded</span>
                        <strong>{v.telemetry.engineRpm || 0} rpm</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="device-unassigned-notice">
                    <Info size={14} className="text-muted" />
                    <span>Telemeetriaseade paigaldamata. Telemeetria puudub.</span>
                  </div>
                )}

                <div className="v-card-footer">
                  <div className="telemetry-device-id">
                    <span>🛰️ {installedDevice ? (installedDevice.connectivityType === 'eye_sensor' ? installedDevice.macAddress : installedDevice.simNumber) : 'SIM puudub'}</span>
                  </div>

                  <div className="card-actions-group">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!v.position}
                      title={!v.position ? 'GPS asukoht puudub' : 'Näita kaardil'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (v.position) {
                          onFocusVehicle(v);
                          onClose?.();
                        }
                      }}
                    >
                      <Crosshair size={13} />
                      <span>Kaardile</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: HAAKERIISTADE REGISTER */}
      {activeTab === 'implements' && (
        <div className="implements-grid">
          {implementsList.map((imp) => {
            const assignedVehicle = vehicles.find((v) => v.assignedImplementId === imp.id || imp.assignedVehicleId === v.id);
            const attachedDevice = devices.find((d) => d.assignedImplementId === imp.id || imp.assignedDeviceId === d.id);

            return (
              <div key={imp.id} className="implement-card glass-card">
                <div className="imp-card-header">
                  <div className="imp-icon-wrap">
                    <span>🔧</span>
                  </div>
                  <div className="imp-title-wrap">
                    <h4 className="imp-name">{imp.name}</h4>
                    <span className="imp-meta">{[imp.category, imp.manufacturer, `${imp.workingWidthM}m`].filter(Boolean).join(' • ')}</span>
                  </div>
                  <div className="card-header-actions">
                    <button
                      className="icon-btn-ghost"
                      title="Vaata selle haakeriista haakimise ajalugu"
                      onClick={() => {
                        setHistoryImplementFilter(imp.id);
                        setHistoryVehicleFilter('all');
                        setHistoryStatusFilter('all');
                        setActiveTab('history');
                        loadImplementAssignments();
                      }}
                    >
                      <History size={14} />
                    </button>
                    <button
                      className="icon-btn-ghost"
                      title="Muuda haakeriista andmeid"
                      onClick={() => startEditImplement(imp)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn-danger"
                      title="Kustuta haakeriist"
                      onClick={async () => {
                        if (await confirmDialog(`Kas soovid kindlasti kustutada haakeriista "${imp.name}"?`)) {
                          onDeleteImplement(imp.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="imp-status-box">
                  {assignedVehicle ? (
                    <div className="attached-status attached">
                      <Tractor size={14} className="text-emerald" />
                      <span>Haagitud masinale: <strong>{assignedVehicle.name}</strong></span>
                    </div>
                  ) : (
                    <div className="attached-status warehouse">
                      <span className="dot-idle"></span>
                      <span>Vaba laos / Valmis haakimiseks</span>
                    </div>
                  )}
                </div>

                {imp.serialNumber && (
                  <div className="imp-serial-row">
                    <span className="text-muted">VIN / Seerianumber:</span>
                    <code>{imp.serialNumber}</code>
                  </div>
                )}

                <div className="imp-serial-row">
                  <span className="text-muted">Andur:</span>
                  {attachedDevice ? (
                    <span className="text-emerald" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Activity size={12} />
                      {attachedDevice.model} ({attachedDevice.connectivityType === 'eye_sensor' ? `MAC: ${attachedDevice.macAddress}` : `IMEI: ${attachedDevice.imei}`})
                    </span>
                  ) : (
                    <span className="text-muted">Andur puudub</span>
                  )}
                </div>

                {/* Märkused */}
                {imp.notes && (
                  <div
                    className="fleet-card-notes"
                    title="Kliki märkuse muutmiseks"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditImplement(imp);
                    }}
                  >
                    <FileText size={13} />
                    <span>{imp.notes}</span>
                  </div>
                )}

                <div className="imp-card-footer">
                  <div className="imp-actions">
                    <select
                      className="form-input imp-assign-select"
                      value={assignedVehicle ? assignedVehicle.id : ''}
                      onChange={(e) => {
                        const newVehId = e.target.value || undefined;
                        onAssignImplement(imp.id, newVehId);
                        setTimeout(loadImplementAssignments, 400);
                      }}
                    >
                      <option value="">-- Jäta lattu (vaba) --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          Haagi masinale: {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: TELEMEETRIASEADMETE REGISTER */}
      {telemetryEnabled && activeTab === 'devices' && (
        <div className="devices-grid">
          {devices.map((dev) => {
            const assignedVehicle = vehicles.find((v) => v.assignedDeviceId === dev.id || dev.assignedVehicleId === v.id);
            const assignedImplement = implementsList.find((imp) => imp.assignedDeviceId === dev.id || dev.assignedImplementId === imp.id);
            const isEyeSensor = dev.connectivityType === 'eye_sensor';
            const targetValue = assignedVehicle ? `veh:${assignedVehicle.id}` : (assignedImplement ? `imp:${assignedImplement.id}` : '');

            return (
              <div key={dev.id} className="device-card glass-card">
                <div className="dev-card-header">
                  <div className="dev-icon-wrap">
                    {isEyeSensor ? <Activity size={20} className="text-emerald" /> : <Radio size={20} className="text-blue" />}
                  </div>
                  <div className="dev-title-wrap">
                    <div className="dev-header-line">
                      <h4 className="dev-model">{dev.model}</h4>
                      <span className={`status-badge status-${dev.status}`}>
                        {(assignedVehicle || assignedImplement) ? 'Paigaldatud' : 'Riiulis'}
                      </span>
                    </div>
                    <span className="dev-imei">
                      {isEyeSensor ? `MAC: ${dev.macAddress}` : `IMEI: ${dev.imei} • SIM: ${dev.simNumber}`}
                    </span>
                  </div>
                  <div className="card-header-actions">
                    <button
                      className="icon-btn-ghost"
                      title="Muuda seadme andmeid"
                      onClick={() => startEditDevice(dev)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn-danger"
                      title="Kustuta seade"
                      onClick={async () => {
                        if (await confirmDialog(`Kas soovid kindlasti kustutada seadme "${dev.model}"?`)) {
                          onDeleteDevice(dev.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isEyeSensor ? (
                  <div className="dev-telemetry-summary">
                    <div className="dev-telemetry-item">
                      <span className="lbl">Aku tase:</span>
                      <strong>{dev.batteryVoltage}%</strong>
                    </div>
                    {dev.eyeTemperatureC != null && (
                      <div className="dev-telemetry-item">
                        <span className="lbl">Temperatuur:</span>
                        <strong>{dev.eyeTemperatureC}°C</strong>
                      </div>
                    )}
                    {dev.eyeHumidityPercent != null && (
                      <div className="dev-telemetry-item">
                        <span className="lbl">Niiskus:</span>
                        <strong>{dev.eyeHumidityPercent}%</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="dev-telemetry-summary">
                    <div className="dev-telemetry-item">
                      <span className="lbl">Aku pinge:</span>
                      <strong>{dev.batteryVoltage} V</strong>
                    </div>
                    <div className="dev-telemetry-item">
                      <span className="lbl">Satelliite:</span>
                      <strong>{dev.satelliteCount} SAT</strong>
                    </div>
                    <div className="dev-telemetry-item">
                      <span className="lbl">Süüde:</span>
                      <strong className={dev.ignition ? 'text-emerald' : 'text-muted'}>
                        {dev.ignition ? 'SEES' : 'VÄLJAS'}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="dev-assignment-box">
                  <label className="text-secondary" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                    Paigaldatud:
                  </label>
                  <select
                    className="form-input dev-assign-select"
                    value={targetValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) { assignDevice(dev.id, undefined, undefined); return; }
                      const [kind, targetId] = val.split(':');
                      if (kind === 'veh') assignDevice(dev.id, targetId, undefined);
                      else assignDevice(dev.id, undefined, targetId);
                    }}
                  >
                    <option value="">-- Riiulis / Paigaldamata --</option>
                    <optgroup label="🚜 Masinad">
                      {vehicles.map((v) => (
                        <option key={`veh:${v.id}`} value={`veh:${v.id}`}>
                          {v.name} ({v.registrationPlate || 'nr puudub'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🔧 Haakeriistad">
                      {implementsList.map((imp) => (
                        <option key={`imp:${imp.id}`} value={`imp:${imp.id}`}>
                          {imp.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Märkused */}
                {dev.notes && (
                  <div
                    className="fleet-card-notes"
                    title="Kliki märkuse muutmiseks"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditDevice(dev);
                    }}
                  >
                    <FileText size={13} />
                    <span>{dev.notes}</span>
                  </div>
                )}

                <div className="dev-card-footer">
                  <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {isEyeSensor ? 'Eye Sensor (BLE)' : `Firmware: ${dev.firmwareVersion || 'v03.28'}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 5: TELEMEETRIASEADMETE SEOSTE REGISTER */}
      {telemetryEnabled && activeTab === 'deviceHistory' && (
        <DeviceAssignmentRegister
          vehicles={vehicles}
          implementsList={implementsList}
          devices={devices}
          assignments={deviceAssignments}
          loading={deviceHistoryLoading}
          onReload={loadDeviceAssignments}
          formOpen={isAddingNew}
          onOpenForm={() => setIsAddingNew(true)}
          onCloseForm={closeForm}
          onChanged={() => { onRegisterChanged(); loadDeviceAssignments(); }}
          onDetach={(deviceId) => assignDevice(deviceId, undefined, undefined)}
        />
      )}

      {/* TAB 4: HAAKIMISE REGISTER (AJALUGU) */}
      {activeTab === 'history' && (
        <div className="implement-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter bar */}
          <div className="history-filter-bar glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} className="text-muted" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Filtrid:</span>
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                className="form-input"
                value={historyVehicleFilter}
                onChange={(e) => setHistoryVehicleFilter(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', height: '34px' }}
              >
                <option value="all">Kõik masinad</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                className="form-input"
                value={historyImplementFilter}
                onChange={(e) => setHistoryImplementFilter(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', height: '34px' }}
              >
                <option value="all">Kõik haakeriistad</option>
                {implementsList.map((imp) => (
                  <option key={imp.id} value={imp.id}>{imp.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`btn btn-sm ${historyStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setHistoryStatusFilter('all')}
              >
                Kõik ({implementAssignments.length})
              </button>
              <button
                className={`btn btn-sm ${historyStatusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setHistoryStatusFilter('active')}
              >
                Aktiivsed ({implementAssignments.filter(a => !a.endedAt).length})
              </button>
              <button
                className={`btn btn-sm ${historyStatusFilter === 'ended' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setHistoryStatusFilter('ended')}
              >
                Ajalugu ({implementAssignments.filter(a => !!a.endedAt).length})
              </button>
            </div>

            {(historyVehicleFilter !== 'all' || historyImplementFilter !== 'all' || historyStatusFilter !== 'all') && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setHistoryVehicleFilter('all');
                  setHistoryImplementFilter('all');
                  setHistoryStatusFilter('all');
                }}
                style={{ fontSize: '12px', marginLeft: 'auto' }}
              >
                Tühjenda filtrid
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadImplementAssignments}
              title="Värskenda registrit"
              style={{ marginLeft: (historyVehicleFilter === 'all' && historyImplementFilter === 'all' && historyStatusFilter === 'all') ? 'auto' : undefined }}
            >
              <RotateCcw size={14} className={historyLoading ? 'spin' : ''} />
              <span>Värskenda</span>
            </button>
          </div>

          {/* Data Table */}
          {historyLoading && implementAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Laen haakimise registri andmeid...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <Wrench size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Ühtegi haakimise kirjet ei leitud
              </div>
              <p style={{ fontSize: '13px', margin: 0 }}>
                {(historyVehicleFilter !== 'all' || historyImplementFilter !== 'all' || historyStatusFilter !== 'all')
                  ? 'Valitud filtritega ei leitud ühtegi seost. Proovi filtreid muuta.'
                  : 'Haakeriistade ja masinate sidumiste ajalugu salvestatakse siia automaatselt, kui masinapargis või töödes haakeriistu vahetatakse.'}
              </p>
            </div>
          ) : (
            <div className="register-table-wrap glass-card" style={{ overflowX: 'auto' }}>
              <table className="register-table">
                <thead>
                  <tr>
                    <th>Haakeriist</th>
                    <th>Masin</th>
                    <th>Haagitud (algus)</th>
                    <th>Lahti haagitud (lõpp)</th>
                    <th>Kestus</th>
                    <th>Märkused</th>
                    <th style={{ textAlign: 'right' }}>Tegevused</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a) => {
                    const isActive = !a.endedAt;
                    const duration = formatDuration(a.startedAt, a.endedAt);
                    return (
                      <tr key={a.id} style={{ background: isActive ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: 'rgba(234, 179, 8, 0.15)',
                              color: '#eab308',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px'
                            }}>
                              🔧
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>{a.implementName || a.implementId}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.implementCategory || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Tractor size={15} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{a.vehicleName || a.vehicleId}</div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>{formatDateTime(a.startedAt)}</div>
                        </td>
                        <td>
                          {isActive ? (
                            <span className="status-badge status-working" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                              Hetkel küljes (Aktiivne)
                            </span>
                          ) : (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(a.endedAt)}</div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                            {duration}
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
                                title="Haagi see riist masinalt lahti"
                                onClick={() => handleDetachActiveAssignment(a.implementId)}
                                style={{ fontSize: '11px', padding: '4px 8px', height: '26px' }}
                              >
                                <Unlink size={12} />
                                <span>Haagi lahti</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-btn-ghost"
                              title="Muuda haakimise kirjet"
                              onClick={() => handleStartEditAssignment(a)}
                              style={{ width: '26px', height: '26px' }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn-danger"
                              title="Kustuta logikirje"
                              onClick={() => handleDeleteAssignment(a.id)}
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
        </div>
      )}

      {/* Quick Swap Sub-Modal */}
      {swapModal && createPortal(
        <div className="modal-backdrop sub-modal">
          <div className="modal-content glass-card swap-modal-card animate-scale-up">
            <div className="modal-header">
              <h4>
                {swapModal.type === 'device' ? '📡 Telemeetriaseadme valik' : '🔧 Haakeriista Haakimine'}
              </h4>
              <button className="icon-btn-ghost" onClick={() => setSwapModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="swap-modal-desc">
                Vali masinale <strong>{swapModal.targetVehicleName}</strong> sobiv {swapModal.type === 'device' ? 'telemeetriaseade' : 'haakeriist'}:
              </p>

              {swapModal.type === 'device' ? (
                <div className="swap-options-list">
                  <div
                    className="swap-option-item unassign-option"
                    onClick={() => {
                      // Unassign any device currently on this vehicle
                      const currentDev = devices.find(d => d.assignedVehicleId === swapModal.targetVehicleId);
                      if (currentDev) assignDevice(currentDev.id, undefined);
                      setSwapModal(null);
                    }}
                  >
                    <Unlink size={16} className="text-rose" />
                    <div>
                      <strong>Eemalda telemeetriaseade</strong>
                      <p>Jäta masin ilma GPS telemeetriata</p>
                    </div>
                  </div>

                  {devices.map((d) => {
                    const isCurrent = d.assignedVehicleId === swapModal.targetVehicleId;
                    const otherVeh = vehicles.find(v => v.id === d.assignedVehicleId && v.id !== swapModal.targetVehicleId);

                    return (
                      <div
                        key={d.id}
                        className={`swap-option-item ${isCurrent ? 'current-active' : ''}`}
                        onClick={() => {
                          assignDevice(d.id, swapModal.targetVehicleId);
                          setSwapModal(null);
                        }}
                      >
                        {d.connectivityType === 'eye_sensor' ? <Activity size={16} className="text-emerald" /> : <Radio size={16} className="text-blue" />}
                        <div className="option-info">
                          <strong>{d.model} &bull; {d.connectivityType === 'eye_sensor' ? `MAC: ${d.macAddress}` : `IMEI: ${d.imei}`}</strong>
                          <p>
                            {isCurrent ? '🟢 Hetkel paigaldatud sellesse masinasse' : (
                              otherVeh ? `⚠️ Paigaldatud masinasse ${otherVeh.name} (Tõstetakse ringi)` : '🟢 Vaba laos / Riiulis'
                            )}
                          </p>
                        </div>
                        {isCurrent && <span className="active-pill">Aktiivne</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="swap-options-list">
                  <div
                    className="swap-option-item unassign-option"
                    onClick={() => {
                      const currentImp = implementsList.find(i => i.assignedVehicleId === swapModal.targetVehicleId);
                      if (currentImp) onAssignImplement(currentImp.id, undefined);
                      setSwapModal(null);
                      setTimeout(loadImplementAssignments, 400);
                    }}
                  >
                    <Unlink size={16} className="text-rose" />
                    <div>
                      <strong>Haagi lahti (Eemalda haakeriist)</strong>
                      <p>Masin sõidab ilma haakeriistata</p>
                    </div>
                  </div>

                  {implementsList.map((imp) => {
                    const isCurrent = imp.assignedVehicleId === swapModal.targetVehicleId;
                    const otherVeh = vehicles.find(v => v.id === imp.assignedVehicleId && v.id !== swapModal.targetVehicleId);

                    return (
                      <div
                        key={imp.id}
                        className={`swap-option-item ${isCurrent ? 'current-active' : ''}`}
                        onClick={() => {
                          onAssignImplement(imp.id, swapModal.targetVehicleId);
                          setSwapModal(null);
                          setTimeout(loadImplementAssignments, 400);
                        }}
                      >
                        <Wrench size={16} className="text-emerald" />
                        <div className="option-info">
                          <strong>{imp.name} ({imp.workingWidthM}m töölaius)</strong>
                          <p>
                            {isCurrent ? '🟢 Hetkel haagitud selle masina taha' : (
                              otherVeh ? `⚠️ Haagitud masina ${otherVeh.name} taha (Haagitakse ümber)` : '🟢 Vaba laos / Valmis haakimiseks'
                            )}
                          </p>
                        </div>
                        {isCurrent && <span className="active-pill">Haagitud</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        , document.body)}
    </>
  );

  if (isFullPage) {
    return (
      <div className="fleet-board-view">
        <main className="fleet-board-main">
          <div className="fleet-board-header">
            <div className="fleet-title-wrap">
              <Tractor className="text-emerald" size={26} />
              <div>
                <h2>Masinapark, haakeriistad ja muu tehnika</h2>
                <p className="fleet-subtitle">Sõidukite, haakeriistade, GPS seadmete ja haakimise registri haldus</p>
              </div>
            </div>
          </div>
          <div className="fleet-board-body">
            {bodyContent}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card vehicle-modal animate-scale-up">
        {/* Header with Title and Tabs */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Tractor className="text-emerald" size={24} />
            <div>
              <h3>Masinapargi ja Seadmete Haldus</h3>
              <p className="modal-subtitle">Eraldi registrid masinatele, haakeriistadele, haakimistele, telemeetria seadmetele ja seadmete seostele</p>
            </div>
          </div>
          {onClose && (
            <button className="icon-btn-ghost" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="modal-body">
          {bodyContent}
        </div>

        <div className="modal-footer">
          {onClose && <button className="btn btn-ghost" onClick={onClose}>Sulge</button>}
        </div>
      </div>
    </div>
  );
};

