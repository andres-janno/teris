// src/components/VehicleTracker.tsx
import { DEFAULT_VEHICLE_COLOR } from '../lib/dataColors';
import React, { useState, useEffect, useId, useCallback, useMemo } from 'react';
import {
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
  History
} from 'lucide-react';
import { api } from '../services/api';
import { DeviceAssignmentRegister } from './DeviceAssignmentRegister';
import { TripRegister } from './TripRegister';
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
  ImplementAssignment,
  VehicleStatus
} from '../types/fleet';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { ResourceCostFields, isRateValid } from './ResourceCostFields';
import type { Article } from '../types/fieldWork';
import { Badge, Button, Card, CardHeader, CardActions, Dialog, DialogContent, DialogHeader, DialogForm, DialogBody, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Tabs, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem, FilterBar, FilterBarItem, EmptyState, NumberInput, DateInput, FilterClear, FilterSelect, Field, FormGrid, FieldRow, IconBox, Input, Select, Textarea, CheckboxField, type SelectOption, clickOnActivationKey, PageHeader } from './ui';
import { cardGridClass, registerSectionClass, fleetCellMainClass, fleetCellTitleClass, fleetCellSubClass, fleetCellDateClass, fleetCellDateEndClass, fleetDurationClass, fleetNotesClass, dateTimeRowClass, dateTimeHintClass } from './ui/variants';
import type { BadgeTone } from './ui';

// Masina oleku märgi toon
const VEHICLE_STATUS_TONE: Record<VehicleStatus, BadgeTone> = {
  working: 'success', moving: 'info', idling: 'warning', stopped: 'neutral', offline: 'neutral'
};

// Seadme viimaste andmete värskus: värv kaardi serval ja ajatempli täpil
const FRESHNESS_LEGEND = [
  { cls: 'fresh-live', label: 'alla 1 h' },
  { cls: 'fresh-day', label: 'alla 24 h' },
  { cls: 'fresh-week', label: 'alla 7 päeva' },
  { cls: 'fresh-old', label: 'vanem' },
  { cls: 'fresh-none', label: 'andmeid pole' }
];

const deviceFreshness = (iso?: string | null): { cls: string; text: string } => {
  if (!iso) return { cls: 'fresh-none', text: '' };
  const min = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  const text = min < 60 ? `${Math.max(1, Math.round(min))} min tagasi`
    : min < 48 * 60 ? `${Math.round(min / 60)} h tagasi`
    : `${Math.round(min / 1440)} päeva tagasi`;
  const cls = min < 60 ? 'fresh-live' : min < 24 * 60 ? 'fresh-day' : min < 7 * 1440 ? 'fresh-week' : 'fresh-old';
  return { cls, text };
};

// Märkuse kast kaardil (masin, haakeriist, seade): oranž vihje, klõps avab muutmise. Vana .fleet-card-notes (!important).
// leading-4.5 (18px) on vana 1.45 lähim skaalaväärtus (12px × 1.45 = 17.4px).
const NOTES_BOX =
  'flex cursor-pointer items-start justify-start gap-1.5 whitespace-pre-wrap break-words rounded-sm border border-warning-solid/22 bg-warning-solid/8 px-2 py-1.5 text-xs leading-4.5 text-muted-foreground transition-all hover:border-warning-solid/38 hover:bg-warning-solid/14 hover:text-foreground [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:text-warning';

// Telemeetria mõõdik masinakaardil: ikoon, silt ja väärtus
const GaugeItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-1.5">
    {icon}
    <div className="flex flex-col">
      <span className="text-2xs leading-natural text-muted-foreground">{label}</span>
      <strong className="text-sm font-semibold leading-natural text-foreground">{value}</strong>
    </div>
  </div>
);

interface VehicleTrackerProps {
  isOpen?: boolean;
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
  isAdmin?: boolean;               // admin võib sõite kustutada ja taastada
  canManageFinance?: boolean;      // tunnihinda näeb ja muudab ainult finantsõigusega kasutaja
  telemetryEnabled?: boolean;      // false: telemeetria moodul pole litsentsis → seadmete tabid peidetud
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void; // sõidu põllurea kanne → põllutööde vaade
}
type TabType = 'vehicles' | 'implements' | 'devices' | 'history' | 'deviceHistory' | 'trips';

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
  id: string; // datalist id
  inputId?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

// Isetäienev liigi väli: pakub olemasolevaid liike, aga lubab sisestada ka uue
const CategoryInput: React.FC<CategoryInputProps> = ({ id, inputId, value, onChange, options, placeholder }) => (
  <>
    <Input
      id={inputId}
      type="text"
      list={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
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
const DepreciationFields: React.FC<DepreciationFieldsProps> = ({ date, onDateChange, cost, onCostChange, rate, onRateChange, method, onMethodChange }) => {
  const uid = useId();
  return (
    <>
      <Field label="Soetamise kuupäev" htmlFor={`${uid}-date`}>
        <DateInput id={`${uid}-date`} value={date} onChange={onDateChange} />
      </Field>
      <Field label="Soetusmaksumus (€)" htmlFor={`${uid}-cost`}>
        <NumberInput
          id={`${uid}-cost`}
          min={0}
          placeholder="nt 185000"
          value={cost === '' ? null : Number(cost)}
          onChange={(v) => onCostChange(v == null ? '' : String(v))}
        />
      </Field>
      <Field label="Amortisatsiooni meetod & määr (% aastas)" htmlFor={`${uid}-method`}>
        <FieldRow>
          <Select
            id={`${uid}-method`}
            value={method}
            onValueChange={(v) => onMethodChange(v as DepreciationMethod | '')}
            options={[
              { value: '', label: '-- Määramata --' },
              ...(Object.keys(DEPRECIATION_METHOD_LABELS) as DepreciationMethod[]).map((m) => ({ value: m, label: DEPRECIATION_METHOD_LABELS[m] }))
            ]}
          />
          <NumberInput
            min={0}
            max={100}
            placeholder="nt 20"
            value={rate === '' ? null : Number(rate)}
            onChange={(v) => onRateChange(v == null ? '' : String(v))}
          />
        </FieldRow>
      </Field>
    </>
  );
};

export const VehicleTracker: React.FC<VehicleTrackerProps> = ({
  isOpen = true,
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
  canManageFinance = false,
  isAdmin = false,
  telemetryEnabled = true,
  onOpenFieldWork,
}) => {
  // Vaikimisi sõidud; ilma telemeetriamoodulita langeb activeTab masinatele
  const [selectedTab, setActiveTab] = useState<TabType>('trips');
  // Ilma telemeetriamoodulita seadmete tabid puuduvad → langeb tagasi masinate tabile
  const activeTab: TabType = !telemetryEnabled && (selectedTab === 'devices' || selectedTab === 'deviceHistory' || selectedTab === 'trips') ? 'vehicles' : selectedTab;
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
  const [costArticles, setCostArticles] = useState<Article[]>([]);
  // Teenuste ja kütuste valik ressursi vormidel
  useEffect(() => {
    api.getArticles().then(setCostArticles).catch(() => setCostArticles([]));
  }, []);
  const [vServiceId, setVServiceId] = useState('');
  const [vRate, setVRate] = useState<number | null>(null);
  const [vFuelId, setVFuelId] = useState('');
  const [vTankL, setVTankL] = useState(''); // paagi maht, l
  const [vYear, setVYear] = useState<number | null>(null); // väljalaskeaasta
  const [impServiceId, setImpServiceId] = useState('');
  const [impRate, setImpRate] = useState<number | null>(null);
  const [vAcqDate, setVAcqDate] = useState('');
  const [vDepRate, setVDepRate] = useState('');
  const [vDepMethod, setVDepMethod] = useState<DepreciationMethod | ''>('');
  const [vPlate, setVPlate] = useState('');
  const [vSerial, setVSerial] = useState('');
  const [vColor, setVColor] = useState(DEFAULT_VEHICLE_COLOR);
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
  const [impWidth, setImpWidth] = useState<number | null>(null);
  const [impSerial, setImpSerial] = useState('');
  const [impPlate, setImpPlate] = useState(''); // registrinumber
  const [impYear, setImpYear] = useState<number | null>(null); // valmistamisaasta
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
  const [devReportsWhenParked, setDevReportsWhenParked] = useState(false);

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
    if (isOpen) {
      loadImplementAssignments();
    }
  }, [isOpen, loadImplementAssignments]);

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
    if (isOpen) {
      loadDeviceAssignments();
    }
  }, [isOpen, loadDeviceAssignments]);

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

  if (!isOpen) return null;

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
    setVServiceId('');
    setVRate(null);
    setVFuelId('');
    setVTankL('');
    setVYear(null);
    setVAcqDate('');
    setVDepRate('');
    setVDepMethod('');
    setVPlate('');
    setVSerial('');
    setVColor(DEFAULT_VEHICLE_COLOR);
    setVNotes('');
  };

  const resetImplementForm = () => {
    setImpName('');
    setImpManufacturer('');
    setImpModel('');
    setImpCategory('');
    setImpCost('');
    setImpServiceId('');
    setImpRate(null);
    setImpAcqDate('');
    setImpDepRate('');
    setImpDepMethod('');
    setImpWidth(8.0);
    setImpSerial('');
    setImpPlate('');
    setImpYear(null);
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
    setDevReportsWhenParked(false);
  };

  const timeOpts = (cur: string | undefined): SelectOption[] => getTimeOptions(cur).map((t) => ({ value: t, label: t }));

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
    if (canManageFinance && !isRateValid(vRate)) { alertDialog('Hind peab olema 0 või suurem'); return; }
    const payload = {
      name: vName.trim(),
      manufacturer: vManufacturer.trim() || undefined,
      model: vModel.trim(),
      type: vType,
      category: normalizeCategory(vCategory, vehicleCategories),
      powerKw: parsePositive(vPowerKw),
      acquisitionCost: parsePositive(vCost),
      serviceArticleId: vServiceId || null,
      fuelArticleId: vFuelId || null,
      fuelCapacityL: parsePositive(vTankL) ?? null,
      year: vYear ?? undefined, // tühi → server salvestab tühjana
      ...(canManageFinance ? { hourlyRate: vRate } : {}),
      acquisitionDate: vAcqDate || undefined,
      depreciationRate: parsePositive(vDepRate),
      depreciationMethod: vDepMethod || undefined,
      registrationPlate: vPlate.trim() || undefined,
      serialNumber: vSerial.trim() || undefined,
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
    if (canManageFinance && !isRateValid(impRate)) { alertDialog('Hind peab olema 0 või suurem'); return; }
    const payload = {
      name: impName.trim(),
      manufacturer: impManufacturer.trim(),
      model: impModel.trim(),
      // Tüüpi vormis pole (asendab liik); olemasoleval kirjel jääb see muutmata
      type: implementsList.find((i) => i.id === editingImplementId)?.type ?? 'other',
      category: normalizeCategory(impCategory, implementCategories),
      acquisitionCost: parsePositive(impCost),
      serviceArticleId: impServiceId || null,
      ...(canManageFinance ? { hourlyRate: impRate } : {}),
      acquisitionDate: impAcqDate || undefined,
      depreciationRate: parsePositive(impDepRate),
      depreciationMethod: impDepMethod || undefined,
      workingWidthM: impWidth && impWidth > 0 ? impWidth : null,
      serialNumber: impSerial.trim() || undefined,
      registrationPlate: impPlate.trim() || undefined,
      year: impYear ?? undefined,
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
      reportsWhenParked: devConnectivity === 'cellular' ? devReportsWhenParked : false,
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
    setVServiceId(v.serviceArticleId ?? '');
    setVRate(v.hourlyRate ?? null);
    setVFuelId(v.fuelArticleId ?? '');
    setVTankL(v.fuelCapacityL != null ? String(v.fuelCapacityL) : '');
    setVYear(v.year ?? null);
    setVAcqDate(v.acquisitionDate || '');
    setVDepRate(v.depreciationRate != null ? String(v.depreciationRate) : '');
    setVDepMethod(v.depreciationMethod || '');
    setVPlate(v.registrationPlate || '');
    setVSerial(v.serialNumber || '');
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
    setImpServiceId(imp.serviceArticleId ?? '');
    setImpRate(imp.hourlyRate ?? null);
    setImpAcqDate(imp.acquisitionDate || '');
    setImpDepRate(imp.depreciationRate != null ? String(imp.depreciationRate) : '');
    setImpDepMethod(imp.depreciationMethod || '');
    setImpWidth(imp.workingWidthM);
    setImpSerial(imp.serialNumber || '');
    setImpPlate(imp.registrationPlate || '');
    setImpYear(imp.year ?? null);
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
    setDevReportsWhenParked(dev.reportsWhenParked === true);
    setEditingDeviceId(dev.id);
    setIsAddingNew(true);
  };

  const bodyContent = (
    <>
      {/* Main Navigation Tabs */}
      <div className="fleet-top-bar">
        <Tabs activationMode="manual"
          value={activeTab}
          onValueChange={(next) => {
            setActiveTab(next as typeof activeTab);
            closeForm();
            if (next === 'history') loadImplementAssignments();
            if (next === 'deviceHistory') loadDeviceAssignments();
          }}
        >
          <TabsList>
            {telemetryEnabled && <TabsTrigger value="trips">🛣️ Sõidud</TabsTrigger>}
            <TabsTrigger value="vehicles">🚜 Masinad <Badge>{vehicles.length}</Badge></TabsTrigger>
            <TabsTrigger value="implements">🔧 Haakeriistad <Badge>{implementsList.length}</Badge></TabsTrigger>
            <TabsTrigger value="history">📜 Haakimiste register <Badge>{implementAssignments.length}</Badge></TabsTrigger>
            {telemetryEnabled && <TabsTrigger value="devices">📡 Telemeetria seadmed <Badge>{devices.length}</Badge></TabsTrigger>}
            {telemetryEnabled && <TabsTrigger value="deviceHistory">🔗 Seadmete seosed <Badge>{deviceAssignments.length}</Badge></TabsTrigger>}
          </TabsList>
        </Tabs>

        {!isAddingNew && activeTab !== 'trips' && (
          <Button variant="primary" size="sm"
            onClick={openAddForm}>
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
          </Button>
        )}
      </div>

      {/* ADD FORMS eraldi aknas registri peal */}
      {isAddingNew && activeTab === 'vehicles' && (
        <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent size="lg" className="fleet-edit-modal">
            <DialogForm onSubmit={handleCreateVehicle}>
              <DialogHeader icon={<Tractor size={20} />} title={editingVehicleId ? `Muuda masinat: ${vName}` : 'Lisa uus masin'} />

              <DialogBody>

                <FormGrid className="fleet-form-grid">
                  <Field label="Masina nimi *" htmlFor="v-name">
                    <Input
                      id="v-name"
                      type="text"
                      required
                      placeholder="nt John Deere 8R 410"
                      value={vName}
                      onChange={(e) => setVName(e.target.value)}
                    />
                  </Field>
                  <Field label="Liik" htmlFor="v-category">
                    <CategoryInput
                      id="vehicle-category-options"
                      inputId="v-category"
                      value={vCategory}
                      onChange={setVCategory}
                      options={vehicleCategories}
                      placeholder="Vali olemasolev või sisesta uus"
                    />
                  </Field>
                  <Field label="Tootja & Mudel" htmlFor="v-manufacturer">
                    <FieldRow>
                      <Input
                        id="v-manufacturer"
                        type="text"
                        placeholder="John Deere"
                        value={vManufacturer}
                        onChange={(e) => setVManufacturer(e.target.value)}
                      />
                      <Input
                        type="text"
                        aria-label="Mudel"
                        placeholder="8R 410"
                        value={vModel}
                        onChange={(e) => setVModel(e.target.value)}
                      />
                    </FieldRow>
                  </Field>
                  <Field label="Võimsus (kW)" htmlFor="v-power">
                    <NumberInput
                      id="v-power"
                      min={0}
                      placeholder="nt 302"
                      value={vPowerKw === '' ? null : Number(vPowerKw)}
                      onChange={(v) => setVPowerKw(v == null ? '' : String(v))}
                    />
                  </Field>
                  <Field label="Masina tüüp ja värv" htmlFor="v-type">
                    <FieldRow>
                      <Select
                        id="v-type"
                        value={vType}
                        onValueChange={(v) => setVType(v as VehicleType)}
                        options={(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((t) => ({ value: t, label: VEHICLE_TYPE_LABELS[t] }))}
                      />
                      <Input
                        type="color"
                        value={vColor}
                        onChange={(e) => setVColor(e.target.value)}
                        title="Kaardimarkeri värv"
                        aria-label="Kaardimarkeri värv"
                      />
                    </FieldRow>
                  </Field>
                  <Field label="Registrinumber" htmlFor="v-plate">
                    <Input
                      id="v-plate"
                      type="text"
                      placeholder="4821 TH"
                      value={vPlate}
                      onChange={(e) => setVPlate(e.target.value)}
                    />
                  </Field>
                  <Field label="VIN / Seerianumber" htmlFor="v-serial">
                    <Input
                      id="v-serial"
                      type="text"
                      placeholder="nt 1RW8R410JKD012345"
                      value={vSerial}
                      onChange={(e) => setVSerial(e.target.value)}
                    />
                  </Field>
                  <Field label="Väljalaskeaasta" htmlFor="v-year">
                    <NumberInput id="v-year" integer min={1900} max={2100} placeholder="nt 2012" value={vYear} onChange={setVYear} />
                  </Field>
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
                  <ResourceCostFields
                    serviceKind="MACHINE_TIME" articles={costArticles}
                    serviceArticleId={vServiceId} onServiceChange={setVServiceId}
                    hourlyRate={vRate} onRateChange={setVRate} canManageFinance={canManageFinance}
                    fuelArticleId={vFuelId} onFuelChange={setVFuelId}
                  />
                  <Field label="Paagi maht (l)" htmlFor="v-tank">
                    <NumberInput
                      id="v-tank"
                      min={0}
                      placeholder="nt 600"
                      value={vTankL === '' ? null : Number(vTankL)}
                      onChange={(v) => setVTankL(v == null ? '' : String(v))}
                    />
                  </Field>
                  <Field label="Märkused" htmlFor="v-notes" span="full">
                    <Textarea
                      id="v-notes"
                      autosize
                      rows={2}
                      placeholder="Märkused masina kohta (nt hooldusvajadus, eriseadistus jne)..."
                      value={vNotes}
                      onChange={(e) => setVNotes(e.target.value)}
                    />
                  </Field>
                </FormGrid>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeForm}>Loobu</Button>
                <Button type="submit" variant="primary">{editingVehicleId ? 'Salvesta muudatused' : 'Salvesta masin'}</Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}

      {isAddingNew && activeTab === 'implements' && (
        <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent size="lg" className="fleet-edit-modal">
            <DialogForm onSubmit={handleCreateImplement}>
              <DialogHeader icon={<Wrench size={20} />} title={editingImplementId ? `Muuda haakeriista: ${impName}` : 'Lisa uus haakeriist'} />

              <DialogBody>

                <FormGrid className="fleet-form-grid">
                  <Field label="Haakeriista nimi *" htmlFor="imp-name">
                    <Input
                      id="imp-name"
                      type="text"
                      required
                      placeholder="nt Väderstad Tempo L 16"
                      value={impName}
                      onChange={(e) => setImpName(e.target.value)}
                    />
                  </Field>
                  <Field label="Liik" htmlFor="imp-category">
                    <CategoryInput
                      id="implement-category-options"
                      inputId="imp-category"
                      value={impCategory}
                      onChange={setImpCategory}
                      options={implementCategories}
                      placeholder="Vali olemasolev või sisesta uus"
                    />
                  </Field>
                  <Field label="Tootja & Mudel" htmlFor="imp-manufacturer">
                    <FieldRow>
                      <Input
                        id="imp-manufacturer"
                        type="text"
                        placeholder="Väderstad"
                        value={impManufacturer}
                        onChange={(e) => setImpManufacturer(e.target.value)}
                      />
                      <Input
                        type="text"
                        aria-label="Mudel"
                        placeholder="Tempo L 16"
                        value={impModel}
                        onChange={(e) => setImpModel(e.target.value)}
                      />
                    </FieldRow>
                  </Field>
                  <Field label="Töölaius (m)" htmlFor="imp-width">
                    <NumberInput
                      id="imp-width"
                      decimals={1}
                      min={0}
                      value={impWidth}
                      onChange={setImpWidth}
                    />
                  </Field>
                  <Field label="VIN / Seerianumber" htmlFor="imp-serial">
                    <Input
                      id="imp-serial"
                      type="text"
                      placeholder="nt TPL16-88902"
                      value={impSerial}
                      onChange={(e) => setImpSerial(e.target.value)}
                    />
                  </Field>
                  <Field label="Registrinumber" htmlFor="imp-plate">
                    <Input id="imp-plate" type="text" placeholder="nt 123 XYZ" value={impPlate} onChange={(e) => setImpPlate(e.target.value)} />
                  </Field>
                  <Field label="Väljalaskeaasta" htmlFor="imp-year">
                    <NumberInput id="imp-year" integer min={1900} max={2100} placeholder="nt 2018" value={impYear} onChange={setImpYear} />
                  </Field>
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
                  <ResourceCostFields
                    serviceKind="IMPLEMENT_TIME" articles={costArticles}
                    serviceArticleId={impServiceId} onServiceChange={setImpServiceId}
                    hourlyRate={impRate} onRateChange={setImpRate} canManageFinance={canManageFinance}
                  />
                  <Field label="Märkused" htmlFor="imp-notes" span="full">
                    <Textarea
                      id="imp-notes"
                      autosize
                      rows={2}
                      placeholder="Märkused haakeriista kohta (nt kuluosad, asukoht jne)..."
                      value={impNotes}
                      onChange={(e) => setImpNotes(e.target.value)}
                    />
                  </Field>
                </FormGrid>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeForm}>Loobu</Button>
                <Button type="submit" variant="primary">{editingImplementId ? 'Salvesta muudatused' : 'Salvesta haakeriist'}</Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}

      {isAddingNew && activeTab === 'devices' && (
        <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent size="lg" className="fleet-edit-modal" dismissible={!devSaving}>
            <DialogForm onSubmit={handleCreateDevice}>
              <DialogHeader icon={<Radio size={20} />} title={editingDeviceId ? `Muuda seadet: ${devModel}` : 'Registreeri telemeetriaseade'} />

              <DialogBody>

                <Field label="Seadme tüüp" className="connectivity-type-picker">
                  <ToggleGroup
                    aria-label="Seadme tüüp"
                    value={devConnectivity}
                    onValueChange={(next) => handleConnectivityChange(next as typeof devConnectivity)}
                  >
                    <ToggleGroupItem value="cellular"><Radio size={14} />Mobiilne GPS (IMEI/SIM)</ToggleGroupItem>
                    <ToggleGroupItem value="eye_sensor"><Activity size={14} />Eye Sensor (MAC)</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <FormGrid className="fleet-form-grid">
                  {devConnectivity === 'cellular' ? (
                    <>
                      <Field label="Seadme mudel" htmlFor="dev-model">
                        <Input
                          id="dev-model"
                          type="text"
                          placeholder="nt Teltonika FMC650 4G LTE"
                          value={devModel}
                          onChange={(e) => setDevModel(e.target.value)}
                        />
                      </Field>
                      <Field label="IMEI kood (15 numbrit) *" htmlFor="dev-imei" hint="15 numbrit">
                        <Input
                          id="dev-imei"
                          type="text"
                          required
                          placeholder="861234058812001"
                          value={devImei}
                          onChange={(e) => setDevImei(e.target.value)}
                          inputMode="numeric"
                          maxLength={15}
                        />
                      </Field>
                      <Field label="SIM kaardi number" htmlFor="dev-sim">
                        <Input
                          id="dev-sim"
                          type="text"
                          placeholder="+372 5311 8812"
                          value={devSim}
                          onChange={(e) => setDevSim(e.target.value)}
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Seadme mudel" htmlFor="dev-model">
                        <Input
                          id="dev-model"
                          type="text"
                          placeholder="nt Teltonika EYE Sensor"
                          value={devModel}
                          onChange={(e) => setDevModel(e.target.value)}
                        />
                      </Field>
                      <Field label="MAC aadress *" htmlFor="dev-mac" hint="nt AA:BB:CC:DD:EE:FF">
                        <Input
                          id="dev-mac"
                          type="text"
                          required
                          placeholder="AA:BB:CC:DD:EE:FF"
                          value={devMac}
                          onChange={(e) => setDevMac(e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Soetamise kuupäev" htmlFor="dev-acq-date">
                    <DateInput id="dev-acq-date" value={devAcqDate} onChange={setDevAcqDate} />
                  </Field>
                  {devConnectivity === 'cellular' && (
                    <Field span="full">
                      <CheckboxField
                        checked={devReportsWhenParked}
                        onCheckedChange={setDevReportsWhenParked}
                        label="Saadab andmeid ka seisu ajal (pidev toide)"
                        hint="Siis kontrollitakse sõitude vahel ka toitekatkestust ja seadme vaikimist. Ära märgi, kui seade seisu ajal ei saada või on süütega toitel."
                      />
                    </Field>
                  )}
                  <Field label="Märkused" htmlFor="dev-notes" span="full">
                    <Textarea
                      id="dev-notes"
                      autosize
                      rows={2}
                      placeholder="Märkused seadme kohta (nt paigalduskoht masinas, antenn jne)..."
                      value={devNotes}
                      onChange={(e) => setDevNotes(e.target.value)}
                    />
                  </Field>
                </FormGrid>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeForm}>Loobu</Button>
                <Button type="submit" variant="primary" disabled={devSaving}>{editingDeviceId ? 'Salvesta muudatused' : 'Registreeri seade'}</Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}

      {isAddingNew && activeTab === 'history' && (
        <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent size="lg" dismissible={!assignmentSubmitting}>
            <DialogForm onSubmit={handleSaveAssignment}>
              <DialogHeader icon={<Link size={20} />} title={editingAssignmentId ? 'Muuda haakimise kirjet' : 'Lisa uus haakimise kanne'} />

              <DialogBody>
                {assignmentError && (
                  <div className="auth-error-banner mb-4">
                    {assignmentError}
                  </div>
                )}

                <FormGrid stackNarrow>
                  <Field label="Masin *" htmlFor="assign-vehicle">
                    <Select
                      id="assign-vehicle"
                      required
                      value={assignVehicleId}
                      onValueChange={setAssignVehicleId}
                      placeholder="Vali masin..."
                      options={vehicles.map((v) => ({ value: v.id, label: `${v.name} (${VEHICLE_TYPE_LABELS[v.type] || v.type})` }))}
                    />
                  </Field>

                  <Field label="Haakeriist *" htmlFor="assign-implement">
                    <Select
                      id="assign-implement"
                      required
                      value={assignImplementId}
                      onValueChange={setAssignImplementId}
                      placeholder="Vali haakeriist..."
                      options={implementsList.map((imp) => ({ value: imp.id, label: `${imp.name}${imp.category ? ` (${imp.category})` : ''}` }))}
                    />
                  </Field>

                  <Field label="Haagitud (algusaeg) *" htmlFor="assign-start-time">
                    <div className={dateTimeRowClass}>
                      <DateInput
                        value={assignStartDate}
                        onChange={setAssignStartDate}
                        required
                      />
                      <Select
                        id="assign-start-time"
                        value={assignStartTime}
                        onValueChange={setAssignStartTime}
                        required
                        options={timeOpts(assignStartTime)}
                      />
                    </div>
                  </Field>

                  <Field label="Lahti haagitud (lõppaeg)" htmlFor="assign-end-time">
                    <div className={dateTimeRowClass}>
                      <DateInput
                        value={assignEndDate}
                        onChange={(date) => {
                          setAssignEndDate(date);
                          if (!date) setAssignEndTime('');
                          else if (!assignEndTime) setAssignEndTime('17:00');
                        }}
                      />
                      <Select
                        id="assign-end-time"
                        value={assignEndTime}
                        onValueChange={setAssignEndTime}
                        disabled={!assignEndDate}
                        options={assignEndDate ? timeOpts(assignEndTime || undefined) : [{ value: '', label: '--:--' }]}
                      />
                    </div>
                    <span className={dateTimeHintClass}>
                      {assignEndDate ? (
                        <Button variant="link" size="inline" onClick={() => { setAssignEndDate(''); setAssignEndTime(''); }}>
                          Tühjenda lõppaeg (haakeriist on praegu küljes)
                        </Button>
                      ) : (
                        <span className="text-primary">Lõppaeg tühi — haakeriist on praegu masina küljes</span>
                      )}
                    </span>
                  </Field>

                  <Field label="Märkused" htmlFor="assign-notes" span="full">
                    <Textarea
                      id="assign-notes"
                      autosize
                      placeholder="Lisa märkused, tööülesanne või lisainfo..."
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      rows={2}
                    />
                  </Field>
                </FormGrid>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeForm} disabled={assignmentSubmitting}>
                  Loobu
                </Button>
                <Button type="submit" variant="primary" disabled={assignmentSubmitting}>
                  {assignmentSubmitting ? 'Salvestan...' : (editingAssignmentId ? 'Salvesta muudatused' : 'Salvesta kanne')}
                </Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}

      {/* TAB 1: SÕIDUKID / MASINAD */}
      {activeTab === 'vehicles' && (
        <div className={cardGridClass}>
          {enrichedVehicles.map((v) => {
            const isSelected = selectedVehicle && selectedVehicle.id === v.id;
            const installedDevice = devices.find((d) => d.id === v.assignedDeviceId || d.assignedVehicleId === v.id);
            const attachedImplement = implementsList.find((imp) => imp.id === v.assignedImplementId || imp.assignedVehicleId === v.id);

            return (
              <Card
                key={v.id}
                padding="sm"
                interactive
                selected={isSelected}
                className="flex flex-col gap-3"
                onClick={() => onSelectVehicle(v)}
              >
                <CardHeader align="start">
                  <div className="flex items-center gap-2.5">
                    <IconBox size="md" style={{ borderColor: v.color }}>
                      <Tractor size={20} style={{ color: v.color }} />
                    </IconBox>
                    <div>
                      <h4 className="text-base font-medium leading-natural text-foreground">{v.name}</h4>
                      <span className="text-xs leading-natural text-muted-foreground">{[v.category, [v.manufacturer, v.model].filter(Boolean).join(' '), v.powerKw ? `${v.powerKw} kW` : null, v.registrationPlate || 'Reg. nr puudub'].filter(Boolean).join(' • ')}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={VEHICLE_STATUS_TONE[v.status]}>
                      {v.status === 'working' ? 'Töötav' : (v.status === 'moving' ? 'Liikuv' : (v.status === 'idling' ? 'Tühikäik' : (v.status === 'stopped' ? 'Seisev' : 'Offline')))}
                    </Badge>
                    <CardActions>
                      <Button variant="ghost" size="icon-sm"
                        title="Vaata selle masina haakimise ajalugu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryVehicleFilter(v.id);
                          setHistoryImplementFilter('all');
                          setHistoryStatusFilter('all');
                          setActiveTab('history');
                          loadImplementAssignments();
                        }}>
                        <History size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm"
                        title="Muuda masina andmeid"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditVehicle(v);
                        }}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="danger-ghost" size="icon-sm"
                        title="Kustuta masin"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await confirmDialog(`Kas soovid kindlasti kustutada masina "${v.name}"?`)) {
                            onDeleteVehicle(v.id);
                          }
                        }}>
                        <Trash2 size={14} />
                      </Button>
                    </CardActions>
                  </div>
                </CardHeader>

                <div className="flex flex-col gap-1 text-xs">
                  {/* Equipment Assignment Badges with Swap Actions */}
                  <div className="mt-1 flex flex-col gap-1.5">
                    {/* Device Badge */}
                    {telemetryEnabled && (
                    <Badge size="md" className="w-full min-w-0 justify-between">
                      <Radio size={12} />
                      <span className="min-w-0 flex-1 truncate">
                        {installedDevice ? `${installedDevice.model} (${installedDevice.connectivityType === 'eye_sensor' ? installedDevice.macAddress : installedDevice.imei?.slice(-4)})` : 'GPS puudub'}
                      </span>
                      <Button size="xs"
                        title="Vaheta või eemalda telemeetriaseade"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapModal({ type: 'device', targetVehicleId: v.id, targetVehicleName: v.name });
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>Vaheta</span>
                      </Button>
                    </Badge>
                    )}

                    {/* Implement Badge */}
                    <Badge size="md" className="w-full min-w-0 justify-between">
                      <Wrench size={12} />
                      <span className="min-w-0 flex-1 truncate">
                        {attachedImplement ? `${attachedImplement.name}${attachedImplement.workingWidthM ? ` (${attachedImplement.workingWidthM}m)` : ''}` : 'Haakeriist puudub'}
                      </span>
                      <Button size="xs"
                        title="Haagi teine tööriist või eemalda"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapModal({ type: 'implement', targetVehicleId: v.id, targetVehicleName: v.name });
                        }}
                      >
                        <Link size={11} />
                        <span>Haagi</span>
                      </Button>
                    </Badge>
                  </div>
                </div>

                {/* Märkused */}
                {v.notes && (
                  <div
                    className={NOTES_BOX}
                    role="button"
                    tabIndex={0}
                    onKeyDown={clickOnActivationKey}
                    title="Kliki märkuse muutmiseks"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditVehicle(v);
                    }}
                  >
                    <FileText size={13} />
                    <span className="flex-1 whitespace-pre-wrap">{v.notes}</span>
                  </div>
                )}

                {/* Telemetry live gauges if device is installed */}
                {installedDevice ? (
                  <div className="grid grid-cols-4 gap-1.5 rounded-sm bg-muted p-2">
                    <GaugeItem icon={<Gauge size={14} />} label="Kiirus" value={`${v.speedKmH.toFixed(1)} km/h`} />
                    <GaugeItem icon={<Fuel size={14} />} label="Kütus" value={`${v.telemetry.fuelLevelPct}%`} />
                    <GaugeItem icon={<Battery size={14} />} label="Aku" value={`${v.telemetry.batteryVoltage} V`} />
                    <GaugeItem icon={<Activity size={14} />} label="Pöörded" value={`${v.telemetry.engineRpm || 0} rpm`} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-sm border border-dashed border-warning-solid/30 bg-warning-solid/8 px-3 py-2 text-xs leading-natural text-warning">
                    <Info size={14} />
                    <span>Telemeetriaseade paigaldamata. Telemeetria puudub.</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <div className="flex items-center gap-1 font-mono text-2xs leading-natural text-subtle">
                    <span>🛰️ {installedDevice ? (installedDevice.connectivityType === 'eye_sensor' ? installedDevice.macAddress : installedDevice.simNumber) : 'SIM puudub'}</span>
                  </div>

                  <div>
                    <Button size="sm"
                      disabled={!v.position}
                      title={!v.position ? 'GPS asukoht puudub' : 'Näita kaardil'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (v.position) {
                          onFocusVehicle(v);
                          onClose?.();
                        }
                      }}>
                      <Crosshair size={13} />
                      <span>Kaardile</span>
                    </Button>
                  </div>
                </div>
              </Card>
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
              <Card key={imp.id} padding="sm" className="implement-card">
                <div className="imp-card-header">
                  <div className="imp-icon-wrap">
                    <span>🔧</span>
                  </div>
                  <div className="imp-title-wrap">
                    <h4 className="imp-name">{imp.name}</h4>
                    <span className="imp-meta">{[imp.category, imp.manufacturer, imp.workingWidthM ? `${imp.workingWidthM}m` : null].filter(Boolean).join(' • ')}</span>
                  </div>
                  <CardActions>
                    <Button variant="ghost" size="icon-sm"
                      title="Vaata selle haakeriista haakimise ajalugu"
                      onClick={() => {
                        setHistoryImplementFilter(imp.id);
                        setHistoryVehicleFilter('all');
                        setHistoryStatusFilter('all');
                        setActiveTab('history');
                        loadImplementAssignments();
                      }}>
                      <History size={14} />
                    </Button>
                    <Button variant="ghost" size="icon-sm"
                      title="Muuda haakeriista andmeid"
                      onClick={() => startEditImplement(imp)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="danger-ghost" size="icon-sm"
                      title="Kustuta haakeriist"
                      onClick={async () => {
                        if (await confirmDialog(`Kas soovid kindlasti kustutada haakeriista "${imp.name}"?`)) {
                          onDeleteImplement(imp.id);
                        }
                      }}>
                      <Trash2 size={14} />
                    </Button>
                  </CardActions>
                </div>

                <Card variant="tile" padding="sm" className="imp-status-box">
                  {assignedVehicle ? (
                    <div className="attached-status attached">
                      <Tractor size={14} />
                      <span>Haagitud masinale: <strong>{assignedVehicle.name}</strong></span>
                    </div>
                  ) : (
                    <div className="attached-status warehouse">
                      <span className="dot-idle"></span>
                      <span>Vaba laos / Valmis haakimiseks</span>
                    </div>
                  )}
                </Card>

                {imp.registrationPlate && (
                  <div className="imp-serial-row">
                    <span>Registrinumber:</span>
                    <code>{imp.registrationPlate}</code>
                  </div>
                )}

                {imp.serialNumber && (
                  <div className="imp-serial-row">
                    <span>VIN / Seerianumber:</span>
                    <code>{imp.serialNumber}</code>
                  </div>
                )}

                <div className="imp-serial-row">
                  <span>Andur:</span>
                  {attachedDevice ? (
                    <span className="inline-icon-text">
                      <Activity size={12} />
                      {attachedDevice.model} ({attachedDevice.connectivityType === 'eye_sensor' ? `MAC: ${attachedDevice.macAddress}` : `IMEI: ${attachedDevice.imei}`})
                    </span>
                  ) : (
                    <span>Andur puudub</span>
                  )}
                </div>

                {/* Märkused */}
                {imp.notes && (
                  <Button
                    variant="plain"
                    size="inline"
                    className="fleet-card-notes"
                    title="Kliki märkuse muutmiseks"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditImplement(imp);
                    }}
                  >
                    <FileText size={13} />
                    <span>{imp.notes}</span>
                  </Button>
                )}

                <div className="imp-card-footer">
                  <div className="imp-actions">
                    <Select
                      size="sm"
                      className="imp-assign-select"
                      aria-label="Haagi masinale"
                      value={assignedVehicle ? assignedVehicle.id : ''}
                      onValueChange={(v) => {
                        const newVehId = v || undefined;
                        onAssignImplement(imp.id, newVehId);
                        setTimeout(loadImplementAssignments, 400);
                      }}
                      options={[
                        { value: '', label: '-- Jäta lattu (vaba) --' },
                        ...vehicles.map((v) => ({ value: v.id, label: `Haagi masinale: ${v.name}` })),
                      ]}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 3: TELEMEETRIASEADMETE REGISTER */}
      {telemetryEnabled && activeTab === 'devices' && (
        <div className="devices-sections">
          {(() => {
            const renderDevice = (dev: TelemetryDevice) => {
            const assignedVehicle = vehicles.find((v) => v.assignedDeviceId === dev.id || dev.assignedVehicleId === v.id);
            const assignedImplement = implementsList.find((imp) => imp.assignedDeviceId === dev.id || dev.assignedImplementId === imp.id);
            const isEyeSensor = dev.connectivityType === 'eye_sensor';
            const fresh = deviceFreshness(dev.lastReceivedAt);
            const targetValue = assignedVehicle ? `veh:${assignedVehicle.id}` : (assignedImplement ? `imp:${assignedImplement.id}` : '');

            return (
              <Card key={dev.id} padding="sm" className={`device-card ${fresh.cls}`}>
                <div className="dev-card-header">
                  <div className="dev-icon-wrap">
                    {isEyeSensor ? <Activity size={20} /> : <Radio size={20} />}
                  </div>
                  <div className="dev-title-wrap">
                    <div className="dev-header-line">
                      <h4 className="dev-model">{dev.model}</h4>
                    </div>
                    <span className="dev-imei">
                      {isEyeSensor ? `MAC: ${dev.macAddress}` : `IMEI: ${dev.imei} • SIM: ${dev.simNumber}`}
                    </span>
                  </div>
                  <CardActions>
                    <Button variant="ghost" size="icon-sm"
                      title="Muuda seadme andmeid"
                      onClick={() => startEditDevice(dev)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="danger-ghost" size="icon-sm"
                      title="Kustuta seade"
                      onClick={async () => {
                        if (await confirmDialog(`Kas soovid kindlasti kustutada seadme "${dev.model}"?`)) {
                          onDeleteDevice(dev.id);
                        }
                      }}>
                      <Trash2 size={14} />
                    </Button>
                  </CardActions>
                </div>

                {isEyeSensor ? (
                  <Card variant="tile" padding="sm" className="dev-telemetry-summary">
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
                    <div className="dev-telemetry-time" title="Viimane seadmelt saadud andmepakett">
                      <span className="dev-fresh-dot" aria-hidden="true" />
                      {dev.lastReceivedAt ? <>Andmed seisuga {formatDateTime(dev.lastReceivedAt)} · <strong>{fresh.text}</strong></> : 'Andmeid pole'}
                    </div>
                  </Card>
                ) : (
                  <Card variant="tile" padding="sm" className="dev-telemetry-summary">
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
                      <strong>
                        {dev.ignition ? 'SEES' : 'VÄLJAS'}
                      </strong>
                    </div>
                    <div className="dev-telemetry-time" title="Viimane seadmelt saadud andmepakett">
                      <span className="dev-fresh-dot" aria-hidden="true" />
                      {dev.lastReceivedAt ? <>Andmed seisuga {formatDateTime(dev.lastReceivedAt)} · <strong>{fresh.text}</strong></> : 'Andmeid pole'}
                    </div>
                  </Card>
                )}

                <div className="dev-assignment-box">
                  <label htmlFor={`dev-assign-${dev.id}`} className="device-assign-label">
                    Paigaldatud:
                  </label>
                  <Select
                    size="sm"
                    id={`dev-assign-${dev.id}`}
                    className="dev-assign-select"
                    value={targetValue}
                    onValueChange={(val) => {
                      if (!val) { assignDevice(dev.id, undefined, undefined); return; }
                      const [kind, targetId] = val.split(':');
                      if (kind === 'veh') assignDevice(dev.id, targetId, undefined);
                      else assignDevice(dev.id, undefined, targetId);
                    }}
                    options={[
                      { value: '', label: '-- Riiulis / Paigaldamata --' },
                      ...vehicles.map((v) => ({ value: `veh:${v.id}`, label: `${v.name} (${v.registrationPlate || 'nr puudub'})`, group: '🚜 Masinad' })),
                      ...implementsList.map((imp) => ({ value: `imp:${imp.id}`, label: imp.name, group: '🔧 Haakeriistad' })),
                    ]}
                  />
                </div>

                {/* Märkused */}
                {dev.notes && (
                  <Button
                    variant="plain"
                    size="inline"
                    className="fleet-card-notes"
                    title="Kliki märkuse muutmiseks"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditDevice(dev);
                    }}
                  >
                    <FileText size={13} />
                    <span>{dev.notes}</span>
                  </Button>
                )}

              </Card>
            );
            };
            // Värskeimad andmed eespool; andmeteta seadmed lõpus
            const lastMs = (d: TelemetryDevice) => (d.lastReceivedAt ? new Date(d.lastReceivedAt).getTime() : -Infinity);
            const byFresh = (a: TelemetryDevice, b: TelemetryDevice) => lastMs(b) - lastMs(a);
            const groups = [
              { key: 'gps', title: 'GPS-seadmed', list: devices.filter((d) => d.connectivityType !== 'eye_sensor').sort(byFresh) },
              { key: 'sensors', title: 'Sensorid', list: devices.filter((d) => d.connectivityType === 'eye_sensor').sort(byFresh) }
            ];
            return (
              <>
                <div className="dev-fresh-legend">
                  <span>Viimased andmed:</span>
                  {FRESHNESS_LEGEND.map((l) => (
                    <span key={l.cls} className={`dev-fresh-legend-item ${l.cls}`}><span className="dev-fresh-dot" aria-hidden="true" />{l.label}</span>
                  ))}
                </div>
                {groups.filter((g) => g.list.length > 0).map((g) => (
                  <section key={g.key} className="devices-section">
                    <h3 className="devices-section-title">{g.title} <span>{g.list.length}</span></h3>
                    <div className="devices-grid">{g.list.map(renderDevice)}</div>
                  </section>
                ))}
              </>
            );
          })()}
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

      {/* TAB 6: SÕITUDE REGISTER */}
      {telemetryEnabled && activeTab === 'trips' && <TripRegister canDelete={isAdmin} vehicles={vehicles} implementsList={implementsList} onOpenFieldWork={onOpenFieldWork} />}

      {/* TAB 4: HAAKIMISE REGISTER (AJALUGU) */}
      {activeTab === 'history' && (
        <div className={registerSectionClass}>
          {/* Filter bar */}
          <FilterBar
            actions={(
              <>
                {(historyVehicleFilter !== 'all' || historyImplementFilter !== 'all' || historyStatusFilter !== 'all') && (
                  <Button variant="ghost" size="sm"
                    onClick={() => {
                      setHistoryVehicleFilter('all');
                      setHistoryImplementFilter('all');
                      setHistoryStatusFilter('all');
                    }}>
                    Tühjenda filtrid
                  </Button>
                )}
                <Button size="sm"
                  onClick={loadImplementAssignments}
                  title="Värskenda registrit">
                  <RotateCcw size={14} className={historyLoading ? 'spin' : ''} />
                  <span>Värskenda</span>
                </Button>
              </>
            )}
          >
            <FilterBarItem>
              <FilterClear active={historyVehicleFilter !== 'all'} onClear={() => setHistoryVehicleFilter('all')}>
                <FilterSelect
                  value={historyVehicleFilter}
                  defaultValue="all"
                  onChange={setHistoryVehicleFilter}
                  options={[{ value: 'all', label: 'Kõik masinad' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]}
                />
              </FilterClear>
            </FilterBarItem>

            <FilterBarItem>
              <FilterClear active={historyImplementFilter !== 'all'} onClear={() => setHistoryImplementFilter('all')}>
                <FilterSelect
                  value={historyImplementFilter}
                  defaultValue="all"
                  onChange={setHistoryImplementFilter}
                  options={[{ value: 'all', label: 'Kõik haakeriistad' }, ...implementsList.map((imp) => ({ value: imp.id, label: imp.name }))]}
                />
              </FilterClear>
            </FilterBarItem>

            <ToggleGroup aria-label="Haakimiste filter" value={historyStatusFilter} onValueChange={(next) => setHistoryStatusFilter(next as typeof historyStatusFilter)}>
              <ToggleGroupItem value="all">Kõik ({implementAssignments.length})</ToggleGroupItem>
              <ToggleGroupItem value="active">Aktiivsed ({implementAssignments.filter((a) => !a.endedAt).length})</ToggleGroupItem>
              <ToggleGroupItem value="ended">Ajalugu ({implementAssignments.filter((a) => !!a.endedAt).length})</ToggleGroupItem>
            </ToggleGroup>
          </FilterBar>

          {/* Data Table */}
          {historyLoading && implementAssignments.length === 0 ? (
            <EmptyState description="Laen haakimise registri andmeid..." />
          ) : filteredAssignments.length === 0 ? (
            <EmptyState
              icon={<Wrench size={36} />}
              title="Ühtegi haakimise kirjet ei leitud"
              description={(historyVehicleFilter !== 'all' || historyImplementFilter !== 'all' || historyStatusFilter !== 'all')
                ? 'Valitud filtritega ei leitud ühtegi seost. Proovi filtreid muuta.'
                : 'Haakeriistade ja masinate sidumiste ajalugu salvestatakse siia automaatselt, kui masinapargis või töödes haakeriistu vahetatakse.'}
            />
          ) : (
            <Table scroll="fill" bordered>
                <TableHeader>
                  <TableRow>
                    <TableHead>Haakeriist</TableHead>
                    <TableHead>Masin</TableHead>
                    <TableHead>Haagitud (algus)</TableHead>
                    <TableHead>Lahti haagitud (lõpp)</TableHead>
                    <TableHead numeric>Kestus</TableHead>
                    <TableHead>Märkused</TableHead>
                    <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((a) => {
                    const isActive = !a.endedAt;
                    const duration = formatDuration(a.startedAt, a.endedAt);
                    return (
                      <TableRow key={a.id} tone={isActive ? 'success' : undefined}>
                        <TableCell wrap>
                          <div className={fleetCellMainClass}>
                            <IconBox tone="warning">
                              🔧
                            </IconBox>
                            <div>
                              <div className={fleetCellTitleClass}>{a.implementName || a.implementId}</div>
                              <div className={fleetCellSubClass}>{a.implementCategory || ''}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell wrap>
                          <div className={fleetCellMainClass}>
                            <IconBox tone="success">
                              <Tractor size={15} />
                            </IconBox>
                            <div className={fleetCellTitleClass}>{a.vehicleName || a.vehicleId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={fleetCellDateClass}>{formatDateTime(a.startedAt)}</div>
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge tone="success" dot>Hetkel küljes (Aktiivne)</Badge>
                          ) : (
                            <div className={fleetCellDateEndClass}>{formatDateTime(a.endedAt)}</div>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          <span className={fleetDurationClass({ active: isActive })}>
                            {duration}
                          </span>
                        </TableCell>
                        <TableCell wrap>
                          <span className={fleetNotesClass({ empty: !a.notes })}>
                            {a.notes || '—'}
                          </span>
                        </TableCell>
                        <TableCell actions>
                          {isActive && (
                            <Button type="button"
                              size="sm"
                              title="Haagi see riist masinalt lahti"
                              onClick={() => handleDetachActiveAssignment(a.implementId)}>
                              <Unlink size={12} />
                              <span>Haagi lahti</span>
                            </Button>
                          )}
                          <Button type="button"
                            variant="ghost" size="icon-sm"
                            title="Muuda haakimise kirjet"
                            onClick={() => handleStartEditAssignment(a)}>
                            <Pencil size={14} />
                          </Button>
                          <Button type="button"
                            variant="danger-ghost" size="icon-sm"
                            title="Kustuta logikirje"
                            onClick={() => handleDeleteAssignment(a.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          )}
        </div>
      )}

      {/* Quick Swap Sub-Modal */}
      {swapModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setSwapModal(null); }}>
          <DialogContent size="sm" className="swap-modal-card">
            <DialogHeader title={swapModal.type === 'device' ? '📡 Telemeetriaseadme valik' : '🔧 Haakeriista Haakimine'} />

            <DialogBody>
              <p className="swap-modal-desc">
                Vali masinale <strong>{swapModal.targetVehicleName}</strong> sobiv {swapModal.type === 'device' ? 'telemeetriaseade' : 'haakeriist'}:
              </p>

              {swapModal.type === 'device' ? (
                <div className="swap-options-list">
                  <Button variant="plain" size="inline"
                    className="swap-option-item unassign-option"
                    onClick={() => {
                      // Unassign any device currently on this vehicle
                      const currentDev = devices.find(d => d.assignedVehicleId === swapModal.targetVehicleId);
                      if (currentDev) assignDevice(currentDev.id, undefined);
                      setSwapModal(null);
                    }}
                  >
                    <Unlink size={16} />
                    <span>
                      <strong>Eemalda telemeetriaseade</strong>
                      <span className="swap-option-line">Jäta masin ilma GPS telemeetriata</span>
                    </span>
                  </Button>

                  {devices.map((d) => {
                    const isCurrent = d.assignedVehicleId === swapModal.targetVehicleId;
                    const otherVeh = vehicles.find(v => v.id === d.assignedVehicleId && v.id !== swapModal.targetVehicleId);

                    return (
                      <Button variant="plain" size="inline"
                        key={d.id}
                        className={`swap-option-item ${isCurrent ? 'current-active' : ''}`}
                        onClick={() => {
                          assignDevice(d.id, swapModal.targetVehicleId);
                          setSwapModal(null);
                        }}
                      >
                        {d.connectivityType === 'eye_sensor' ? <Activity size={16} /> : <Radio size={16} />}
                        <span className="option-info">
                          <strong>{d.model} &bull; {d.connectivityType === 'eye_sensor' ? `MAC: ${d.macAddress}` : `IMEI: ${d.imei}`}</strong>
                          <span className="swap-option-line">
                            {isCurrent ? '🟢 Hetkel paigaldatud sellesse masinasse' : (
                              otherVeh ? `⚠️ Paigaldatud masinasse ${otherVeh.name} (Tõstetakse ringi)` : '🟢 Vaba laos / Riiulis'
                            )}
                          </span>
                        </span>
                        {isCurrent && <Badge tone="success" variant="solid">Aktiivne</Badge>}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="swap-options-list">
                  <Button variant="plain" size="inline"
                    className="swap-option-item unassign-option"
                    onClick={() => {
                      const currentImp = implementsList.find(i => i.assignedVehicleId === swapModal.targetVehicleId);
                      if (currentImp) onAssignImplement(currentImp.id, undefined);
                      setSwapModal(null);
                      setTimeout(loadImplementAssignments, 400);
                    }}
                  >
                    <Unlink size={16} />
                    <span>
                      <strong>Haagi lahti (Eemalda haakeriist)</strong>
                      <span className="swap-option-line">Masin sõidab ilma haakeriistata</span>
                    </span>
                  </Button>

                  {implementsList.map((imp) => {
                    const isCurrent = imp.assignedVehicleId === swapModal.targetVehicleId;
                    const otherVeh = vehicles.find(v => v.id === imp.assignedVehicleId && v.id !== swapModal.targetVehicleId);

                    return (
                      <Button variant="plain" size="inline"
                        key={imp.id}
                        className={`swap-option-item ${isCurrent ? 'current-active' : ''}`}
                        onClick={() => {
                          onAssignImplement(imp.id, swapModal.targetVehicleId);
                          setSwapModal(null);
                          setTimeout(loadImplementAssignments, 400);
                        }}
                      >
                        <Wrench size={16} />
                        <span className="option-info">
                          <strong>{imp.name}{imp.workingWidthM ? ` (${imp.workingWidthM}m töölaius)` : ''}</strong>
                          <span className="swap-option-line">
                            {isCurrent ? '🟢 Hetkel haagitud selle masina taha' : (
                              otherVeh ? `⚠️ Haagitud masina ${otherVeh.name} taha (Haagitakse ümber)` : '🟢 Vaba laos / Valmis haakimiseks'
                            )}
                          </span>
                        </span>
                        {isCurrent && <Badge tone="success" variant="solid">Haagitud</Badge>}
                      </Button>
                    );
                  })}
                </div>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );

  return (
    <div className="fleet-board-view">
      <main className="fleet-board-main">
        <PageHeader icon={<Tractor />} title="Masinapark, haakeriistad ja muu tehnika" subtitle="Sõidukite, haakeriistade, GPS seadmete ja haakimise registri haldus" />
        <div className="fleet-board-body">
          {bodyContent}
        </div>
      </main>
    </div>
  );
};

