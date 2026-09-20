// src/components/VehicleTracker.tsx
import React, { useState } from 'react';
import {
  X,
  Tractor,
  Fuel,
  Battery,
  Gauge,
  User,
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
  Pencil
} from 'lucide-react';
import type {
  Vehicle,
  Implement,
  TeltonikaDevice,
  EnrichedVehicle,
  VehicleType,
  ImplementType,
  DeviceConnectivity
} from '../types/fleet';

interface VehicleTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  implementsList: Implement[];
  devices: TeltonikaDevice[];
  enrichedVehicles: EnrichedVehicle[];
  selectedVehicle: EnrichedVehicle | null;
  onSelectVehicle: (vehicle: EnrichedVehicle) => void;
  onFocusVehicle: (vehicle: EnrichedVehicle) => void;
  
  // Reassignment / Movement handlers
  onAssignDevice: (deviceId: string, vehicleId?: string, implementId?: string) => void;
  onAssignImplement: (implementId: string, vehicleId?: string) => void;
  
  // CRUD
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle: (id: string, v: Omit<Vehicle, 'id'>) => void;
  onDeleteVehicle: (id: string) => void;
  onAddImplement: (imp: Omit<Implement, 'id'>) => void;
  onUpdateImplement: (id: string, imp: Omit<Implement, 'id'>) => void;
  onDeleteImplement: (id: string) => void;
  onAddDevice: (dev: Omit<TeltonikaDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => void;
  onUpdateDevice: (id: string, dev: Omit<TeltonikaDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => void;
  onDeleteDevice: (id: string) => void;
}

type TabType = 'vehicles' | 'implements' | 'devices';

const IMPLEMENT_TYPE_LABELS: Record<ImplementType, string> = {
  seeder: 'Külvik',
  cultivator: 'Kultivaator / Randaal',
  disc_harrow: 'Ketasäke',
  plow: 'Ader',
  sprayer: 'Pritsipoom',
  header: 'Heeder',
  fertilizer_spreader: 'Väetiselaotur',
  trailer: 'Haagis',
  roller: 'Põllurull',
  mower: 'Niiduk',
  other: 'Muu seade'
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  tractor: 'Traktor',
  combine: 'Kombain',
  sprayer: 'Iseliikuv prits',
  truck: 'Viljaveok',
  spreader: 'Iseliikuv laotur',
  loader: 'Laadur',
  atv: 'ATV / Maastur'
};

export const VehicleTracker: React.FC<VehicleTrackerProps> = ({
  isOpen,
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
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onAddImplement,
  onUpdateImplement,
  onDeleteImplement,
  onAddDevice,
  onUpdateDevice,
  onDeleteDevice
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('vehicles');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Kui mõni neist on seatud, käitub aktiivse vahekaardi vorm muutmisrežiimis
  // (eeltäidetud väljad, "Salvesta muudatused") lisamise asemel.
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingImplementId, setEditingImplementId] = useState<string | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  // Forms states
  // 1. Vehicle Form
  const [vName, setVName] = useState('');
  const [vModel, setVModel] = useState('');
  const [vType, setVType] = useState<VehicleType>('tractor');
  const [vPlate, setVPlate] = useState('');
  const [vDriver, setVDriver] = useState('');
  const [vColor, setVColor] = useState('#22c55e');
  const [vSelectedDevId, setVSelectedDevId] = useState('');
  const [vSelectedImpId, setVSelectedImpId] = useState('');

  // 2. Implement Form
  const [impName, setImpName] = useState('');
  const [impManufacturer, setImpManufacturer] = useState('');
  const [impModel, setImpModel] = useState('');
  const [impType, setImpType] = useState<ImplementType>('cultivator');
  const [impWidth, setImpWidth] = useState(8.0);
  const [impSerial, setImpSerial] = useState('');
  const [impAssignedVehId, setImpAssignedVehId] = useState('');

  // 3. Teltonika Form
  const [devConnectivity, setDevConnectivity] = useState<DeviceConnectivity>('cellular');
  const [devModel, setDevModel] = useState('FMC650 4G LTE');
  const [devImei, setDevImei] = useState('');
  const [devSim, setDevSim] = useState('');
  const [devMac, setDevMac] = useState('');
  // Kombineeritud sihtmärgi valik: '' | `veh:<id>` | `imp:<id>` — mõlemat
  // tüüpi seadet saab paigaldada kas masinasse või haakeriista külge.
  const [devAssignedTarget, setDevAssignedTarget] = useState('');

  const handleConnectivityChange = (next: DeviceConnectivity) => {
    setDevConnectivity(next);
    setDevModel(next === 'eye_sensor' ? 'Teltonika EYE Sensor' : 'FMC650 4G LTE');
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

  if (!isOpen) return null;

  const closeForm = () => {
    setIsAddingNew(false);
    setEditingVehicleId(null);
    setEditingImplementId(null);
    setEditingDeviceId(null);
  };

  // Tühjendab vormi väljad, et üleminek muutmisrežiimist uue kirje
  // lisamisele (või vastupidi) ei jätaks eelmise kirje väärtusi alles.
  const resetVehicleForm = () => {
    setVName('');
    setVModel('');
    setVType('tractor');
    setVPlate('');
    setVDriver('');
    setVColor('#22c55e');
    setVSelectedDevId('');
    setVSelectedImpId('');
  };

  const resetImplementForm = () => {
    setImpName('');
    setImpManufacturer('');
    setImpModel('');
    setImpType('cultivator');
    setImpWidth(8.0);
    setImpSerial('');
    setImpAssignedVehId('');
  };

  const resetDeviceForm = () => {
    setDevConnectivity('cellular');
    setDevModel('FMC650 4G LTE');
    setDevImei('');
    setDevSim('');
    setDevMac('');
    setDevAssignedTarget('');
  };

  const openAddForm = () => {
    if (activeTab === 'vehicles') resetVehicleForm();
    else if (activeTab === 'implements') resetImplementForm();
    else resetDeviceForm();
    setIsAddingNew(true);
  };

  // Handle forms submits
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;
    const payload = {
      name: vName.trim(),
      model: vModel.trim() || 'Teadmata mudel',
      type: vType,
      registrationPlate: vPlate.trim() || undefined,
      driverName: vDriver.trim() || undefined,
      color: vColor,
      assignedDeviceId: vSelectedDevId || undefined,
      assignedImplementId: vSelectedImpId || undefined
    };
    if (editingVehicleId) {
      onUpdateVehicle(editingVehicleId, payload);
    } else {
      onAddVehicle(payload);
    }
    closeForm();
    setVName('');
    setVModel('');
    setVPlate('');
  };

  const handleCreateImplement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!impName.trim()) return;
    const payload = {
      name: impName.trim(),
      manufacturer: impManufacturer.trim() || 'Tootja',
      model: impModel.trim() || impName.trim(),
      type: impType,
      workingWidthM: Number(impWidth) || 6.0,
      serialNumber: impSerial.trim() || undefined,
      assignedVehicleId: impAssignedVehId || undefined,
      isActive: false
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
  };

  const handleCreateDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (devConnectivity === 'cellular' && !devImei.trim()) return;
    if (devConnectivity === 'eye_sensor' && !devMac.trim()) return;

    const [targetKind, targetId] = devAssignedTarget ? devAssignedTarget.split(':') : [undefined, undefined];

    const payload = {
      connectivityType: devConnectivity,
      model: devModel.trim() || (devConnectivity === 'eye_sensor' ? 'Teltonika EYE Sensor' : 'FMC650 4G LTE'),
      imei: devConnectivity === 'cellular' ? devImei.trim() : undefined,
      simNumber: devConnectivity === 'cellular' ? (devSim.trim() || '+372 5...') : undefined,
      macAddress: devConnectivity === 'eye_sensor' ? devMac.trim().toUpperCase() : undefined,
      assignedVehicleId: targetKind === 'veh' ? targetId : undefined,
      assignedImplementId: targetKind === 'imp' ? targetId : undefined,
      batteryVoltage: devConnectivity === 'eye_sensor' ? 3.0 : 27.5,
      fuelLevelPct: 100,
      ignition: false,
      hydraulicActive: false,
      satelliteCount: devConnectivity === 'eye_sensor' ? 0 : 16,
      hdop: devConnectivity === 'eye_sensor' ? 0 : 0.8
    };
    if (editingDeviceId) {
      onUpdateDevice(editingDeviceId, payload);
    } else {
      onAddDevice(payload);
    }
    closeForm();
    setDevImei('');
    setDevSim('');
    setDevMac('');
    setDevAssignedTarget('');
  };

  const startEditVehicle = (v: Vehicle) => {
    setVName(v.name);
    setVModel(v.model);
    setVType(v.type);
    setVPlate(v.registrationPlate || '');
    setVDriver(v.driverName || '');
    setVColor(v.color);
    setVSelectedDevId(v.assignedDeviceId || '');
    setVSelectedImpId(v.assignedImplementId || '');
    setEditingVehicleId(v.id);
    setIsAddingNew(true);
  };

  const startEditImplement = (imp: Implement) => {
    setImpName(imp.name);
    setImpManufacturer(imp.manufacturer);
    setImpModel(imp.model);
    setImpType(imp.type);
    setImpWidth(imp.workingWidthM);
    setImpSerial(imp.serialNumber || '');
    setImpAssignedVehId(imp.assignedVehicleId || '');
    setEditingImplementId(imp.id);
    setIsAddingNew(true);
  };

  const startEditDevice = (dev: TeltonikaDevice) => {
    setDevConnectivity(dev.connectivityType);
    setDevModel(dev.model);
    setDevImei(dev.imei || '');
    setDevSim(dev.simNumber || '');
    setDevMac(dev.macAddress || '');
    setDevAssignedTarget(dev.assignedVehicleId ? `veh:${dev.assignedVehicleId}` : (dev.assignedImplementId ? `imp:${dev.assignedImplementId}` : ''));
    setEditingDeviceId(dev.id);
    setIsAddingNew(true);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card vehicle-modal animate-scale-up">
        {/* Header with Title and Tabs */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Tractor className="text-emerald" size={24} />
            <div>
              <h3>Masinapargi ja Seadmete Haldus</h3>
              <p className="modal-subtitle">Eraldi registrid sõidukitele, haakeriistadele ja Teltonika GPS seadmetele</p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Main Navigation Tabs */}
          <div className="fleet-top-bar">
            <div className="category-filter-tabs">
              <button
                className={`filter-tab ${activeTab === 'vehicles' ? 'active' : ''}`}
                onClick={() => { setActiveTab('vehicles'); closeForm(); }}
              >
                <span>🚜 Sõidukid / Masinad</span>
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
                className={`filter-tab ${activeTab === 'devices' ? 'active' : ''}`}
                onClick={() => { setActiveTab('devices'); closeForm(); }}
              >
                <span>📡 Teltonika GPS Seadmed</span>
                <span className="count-pill">{devices.length}</span>
              </button>
            </div>

            {!isAddingNew && (
              <button
                className="btn btn-primary btn-sm"
                onClick={openAddForm}
              >
                <Plus size={14} />
                <span>
                  {activeTab === 'vehicles' ? 'Lisa uus masin' : (
                    activeTab === 'implements' ? 'Lisa uus haakeriist' : 'Registreeri Teltonika seade'
                  )}
                </span>
              </button>
            )}
          </div>

          {/* ADD FORMS */}
          {isAddingNew && activeTab === 'vehicles' && (
            <form onSubmit={handleCreateVehicle} className="poi-add-form glass-card animate-slide-in">
              <h4 className="form-title">
                <Tractor size={16} className="text-emerald" />
                <span>{editingVehicleId ? 'Sõiduki andmete muutmine' : 'Uue sõiduki registreerimine'}</span>
              </h4>
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
                  <label>Mudel / Mootorivõimsus</label>
                  <input 
                    type="text" 
                    placeholder="nt 8R 410 AutoPowr (410 hj)" 
                    value={vModel} 
                    onChange={(e) => setVModel(e.target.value)} 
                    className="form-input" 
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
                  <label>Paigalda Teltonika seade</label>
                  <select 
                    value={vSelectedDevId} 
                    onChange={(e) => setVSelectedDevId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Ilma seadmeta / Paigalda hiljem --</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.model} ({d.connectivityType === 'eye_sensor' ? `MAC: ${d.macAddress}` : `IMEI: ${d.imei}`}) {d.assignedVehicleId ? `[Hetkel masinas]` : `[Vaba laos]`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Haagi tööriist</label>
                  <select 
                    value={vSelectedImpId} 
                    onChange={(e) => setVSelectedImpId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Ilma haakeriistata --</option>
                    {implementsList.map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {imp.name} ({imp.workingWidthM}m) {imp.assignedVehicleId ? `[Haagitud]` : `[Vaba laos]`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingVehicleId ? 'Salvesta muudatused' : 'Salvesta masin'}</button>
              </div>
            </form>
          )}

          {isAddingNew && activeTab === 'implements' && (
            <form onSubmit={handleCreateImplement} className="poi-add-form glass-card animate-slide-in">
              <h4 className="form-title">
                <Wrench size={16} className="text-emerald" />
                <span>{editingImplementId ? 'Haakeriista andmete muutmine' : 'Uue haakeriista registreerimine'}</span>
              </h4>
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
                  <label>Haakeriista tüüp</label>
                  <select 
                    value={impType} 
                    onChange={(e) => setImpType(e.target.value as ImplementType)}
                    className="form-input"
                  >
                    {(Object.keys(IMPLEMENT_TYPE_LABELS) as ImplementType[]).map((t) => (
                      <option key={t} value={t}>{IMPLEMENT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Töölaius (meetrites) *</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    required 
                    value={impWidth} 
                    onChange={(e) => setImpWidth(Number(e.target.value))} 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Seerianumber</label>
                  <input 
                    type="text" 
                    placeholder="TPL16-88902" 
                    value={impSerial} 
                    onChange={(e) => setImpSerial(e.target.value)} 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Haagi kohe masina taha</label>
                  <select 
                    value={impAssignedVehId} 
                    onChange={(e) => setImpAssignedVehId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Jäta lattu / Vabaks --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.registrationPlate || 'nr puudub'})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingImplementId ? 'Salvesta muudatused' : 'Salvesta haakeriist'}</button>
              </div>
            </form>
          )}

          {isAddingNew && activeTab === 'devices' && (
            <form onSubmit={handleCreateDevice} className="poi-add-form glass-card animate-slide-in">
              <h4 className="form-title">
                <Radio size={16} className="text-emerald" />
                <span>{editingDeviceId ? 'Seadme andmete muutmine' : 'Uue Teltonika GPS seadme registreerimine'}</span>
              </h4>
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
                        className="form-input"
                      />
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
                        placeholder="Teltonika EYE Sensor"
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
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>Paigalda kohe</label>
                  <select
                    value={devAssignedTarget}
                    onChange={(e) => setDevAssignedTarget(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Jäta riiulisse / Vabaks --</option>
                    <optgroup label="🚜 Masinad">
                      {vehicles.map((v) => (
                        <option key={`veh:${v.id}`} value={`veh:${v.id}`}>{v.name} ({v.registrationPlate || 'nr puudub'})</option>
                      ))}
                    </optgroup>
                    <optgroup label="🔧 Haakeriistad">
                      {implementsList.map((imp) => (
                        <option key={`imp:${imp.id}`} value={`imp:${imp.id}`}>{imp.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingDeviceId ? 'Salvesta muudatused' : 'Registreeri seade'}</button>
              </div>
            </form>
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
                          <span className="v-model">{v.model} &bull; {v.registrationPlate || 'Reg. nr puudub'}</span>
                        </div>
                      </div>

                      <div className="card-header-right">
                        <span className={`status-badge status-${v.status}`}>
                          {v.status === 'working' ? 'Töötav' : (v.status === 'moving' ? 'Liikuv' : (v.status === 'idling' ? 'Tühikäik' : (v.status === 'stopped' ? 'Seisev' : 'Offline')))}
                        </span>
                        <div className="card-header-actions">
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
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Kas soovid kindlasti kustutada masina "${v.name}"?`)) {
                                onDeleteVehicle(v.id);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Driver */}
                    <div className="v-info-rows">
                      <div className="v-info-item">
                        <User size={14} className="text-muted" />
                        <span>Juht: <strong>{v.driverName || 'Määramata'}</strong></span>
                      </div>

                      {/* Equipment Assignment Badges with Swap Actions */}
                      <div className="v-equipment-badge-row">
                        {/* Device Badge */}
                        <div className="equipment-tag device-tag">
                          <Radio size={12} className="text-blue" />
                          <span className="tag-text">
                            {installedDevice ? `${installedDevice.model} (${installedDevice.connectivityType === 'eye_sensor' ? installedDevice.macAddress : installedDevice.imei?.slice(-4)})` : 'GPS puudub'}
                          </span>
                          <button 
                            className="mini-swap-btn"
                            title="Vaheta või eemalda Teltonika seade"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwapModal({ type: 'device', targetVehicleId: v.id, targetVehicleName: v.name });
                            }}
                          >
                            <RotateCcw size={11} />
                            <span>Vaheta</span>
                          </button>
                        </div>

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
                        <span>Teltonika GPS seade paigaldamata. Telemeetria puudub.</span>
                      </div>
                    )}

                    <div className="v-card-footer">
                      <div className="teltonika-id">
                        <span>🛰️ {installedDevice ? (installedDevice.connectivityType === 'eye_sensor' ? installedDevice.macAddress : installedDevice.simNumber) : 'SIM puudub'}</span>
                      </div>

                      <div className="card-actions-group">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusVehicle(v);
                            onClose();
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
                        <span className="imp-meta">{imp.manufacturer} &bull; {IMPLEMENT_TYPE_LABELS[imp.type]} &bull; {imp.workingWidthM}m</span>
                      </div>
                      <div className="card-header-actions">
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
                          onClick={() => {
                            if (confirm(`Kas soovid kindlasti kustutada haakeriista "${imp.name}"?`)) {
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
                        <span className="text-muted">Seerianumber:</span>
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

                    <div className="imp-card-footer">
                      <div className="imp-actions">
                        <select
                          className="form-input imp-assign-select"
                          value={assignedVehicle ? assignedVehicle.id : ''}
                          onChange={(e) => {
                            const newVehId = e.target.value || undefined;
                            onAssignImplement(imp.id, newVehId);
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

          {/* TAB 3: TELTONIKA GPS SEADMETE REGISTER */}
          {activeTab === 'devices' && (
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
                          onClick={() => {
                            if (confirm(`Kas soovid kindlasti kustutada seadme "${dev.model}"?`)) {
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
                          <span className="lbl">Aku pinge:</span>
                          <strong>{dev.batteryVoltage} V</strong>
                        </div>
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
                          if (!val) { onAssignDevice(dev.id, undefined, undefined); return; }
                          const [kind, targetId] = val.split(':');
                          if (kind === 'veh') onAssignDevice(dev.id, targetId, undefined);
                          else onAssignDevice(dev.id, undefined, targetId);
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
        </div>

        {/* Quick Swap Sub-Modal */}
        {swapModal && (
          <div className="modal-backdrop sub-modal">
            <div className="modal-content glass-card swap-modal-card animate-scale-up">
              <div className="modal-header">
                <h4>
                  {swapModal.type === 'device' ? '📡 Teltonika GPS Seadme Valik' : '🔧 Haakeriista Haakimine'}
                </h4>
                <button className="icon-btn-ghost" onClick={() => setSwapModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p className="swap-modal-desc">
                  Vali masinale <strong>{swapModal.targetVehicleName}</strong> sobiv {swapModal.type === 'device' ? 'Teltonika GPS seade' : 'haakeriist'}:
                </p>

                {swapModal.type === 'device' ? (
                  <div className="swap-options-list">
                    <div 
                      className="swap-option-item unassign-option"
                      onClick={() => {
                        // Unassign any device currently on this vehicle
                        const currentDev = devices.find(d => d.assignedVehicleId === swapModal.targetVehicleId);
                        if (currentDev) onAssignDevice(currentDev.id, undefined);
                        setSwapModal(null);
                      }}
                    >
                      <Unlink size={16} className="text-rose" />
                      <div>
                        <strong>Eemalda GPS seade</strong>
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
                            onAssignDevice(d.id, swapModal.targetVehicleId);
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
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Sulge</button>
        </div>
      </div>
    </div>
  );
};
