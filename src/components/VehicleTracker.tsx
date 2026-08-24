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
  Activity
} from 'lucide-react';
import type { 
  Vehicle, 
  Implement, 
  TeltonikaDevice, 
  EnrichedVehicle, 
  VehicleType, 
  ImplementType 
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
  onAssignDevice: (deviceId: string, vehicleId?: string) => void;
  onAssignImplement: (implementId: string, vehicleId?: string) => void;
  
  // CRUD
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onDeleteVehicle: (id: string) => void;
  onAddImplement: (imp: Omit<Implement, 'id'>) => void;
  onDeleteImplement: (id: string) => void;
  onAddDevice: (dev: Omit<TeltonikaDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => void;
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
  onDeleteVehicle,
  onAddImplement,
  onDeleteImplement,
  onAddDevice,
  onDeleteDevice
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('vehicles');
  const [isAddingNew, setIsAddingNew] = useState(false);

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
  const [devModel, setDevModel] = useState('FMC650 4G LTE');
  const [devImei, setDevImei] = useState('');
  const [devSim, setDevSim] = useState('');
  const [devAssignedVehId, setDevAssignedVehId] = useState('');

  // Quick swap modals state
  const [swapModal, setSwapModal] = useState<{
    type: 'device' | 'implement';
    targetVehicleId: string;
    targetVehicleName: string;
  } | null>(null);

  if (!isOpen) return null;

  // Handle forms submits
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;
    onAddVehicle({
      name: vName.trim(),
      model: vModel.trim() || 'Teadmata mudel',
      type: vType,
      registrationPlate: vPlate.trim() || undefined,
      driverName: vDriver.trim() || undefined,
      color: vColor,
      assignedDeviceId: vSelectedDevId || undefined,
      assignedImplementId: vSelectedImpId || undefined
    });
    setIsAddingNew(false);
    setVName('');
    setVModel('');
    setVPlate('');
  };

  const handleCreateImplement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!impName.trim()) return;
    onAddImplement({
      name: impName.trim(),
      manufacturer: impManufacturer.trim() || 'Tootja',
      model: impModel.trim() || impName.trim(),
      type: impType,
      workingWidthM: Number(impWidth) || 6.0,
      serialNumber: impSerial.trim() || undefined,
      assignedVehicleId: impAssignedVehId || undefined,
      isActive: false
    });
    setIsAddingNew(false);
    setImpName('');
    setImpManufacturer('');
    setImpModel('');
  };

  const handleCreateDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!devImei.trim()) return;
    onAddDevice({
      model: devModel,
      imei: devImei.trim(),
      simNumber: devSim.trim() || '+372 5...',
      assignedVehicleId: devAssignedVehId || undefined,
      batteryVoltage: 27.5,
      fuelLevelPct: 100,
      ignition: false,
      hydraulicActive: false,
      satelliteCount: 16,
      hdop: 0.8
    });
    setIsAddingNew(false);
    setDevImei('');
    setDevSim('');
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
                onClick={() => { setActiveTab('vehicles'); setIsAddingNew(false); }}
              >
                <span>🚜 Sõidukid / Masinad</span>
                <span className="count-pill">{vehicles.length}</span>
              </button>

              <button 
                className={`filter-tab ${activeTab === 'implements' ? 'active' : ''}`}
                onClick={() => { setActiveTab('implements'); setIsAddingNew(false); }}
              >
                <span>🔧 Haakeriistad</span>
                <span className="count-pill">{implementsList.length}</span>
              </button>

              <button 
                className={`filter-tab ${activeTab === 'devices' ? 'active' : ''}`}
                onClick={() => { setActiveTab('devices'); setIsAddingNew(false); }}
              >
                <span>📡 Teltonika GPS Seadmed</span>
                <span className="count-pill">{devices.length}</span>
              </button>
            </div>

            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddingNew(!isAddingNew)}
            >
              {isAddingNew ? <X size={14} /> : <Plus size={14} />}
              <span>
                {isAddingNew ? 'Sulge ankeet' : (
                  activeTab === 'vehicles' ? 'Lisa uus masin' : (
                    activeTab === 'implements' ? 'Lisa uus haakeriist' : 'Registreeri Teltonika seade'
                  )
                )}
              </span>
            </button>
          </div>

          {/* ADD FORMS */}
          {isAddingNew && activeTab === 'vehicles' && (
            <form onSubmit={handleCreateVehicle} className="poi-add-form glass-card animate-slide-in">
              <h4 className="form-title">
                <Tractor size={16} className="text-emerald" />
                <span>Uue sõiduki registreerimine</span>
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
                        {d.model} (IMEI: {d.imei}) {d.assignedVehicleId ? `[Hetkel masinas]` : `[Vaba laos]`}
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
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsAddingNew(false)}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">Salvesta masin</button>
              </div>
            </form>
          )}

          {isAddingNew && activeTab === 'implements' && (
            <form onSubmit={handleCreateImplement} className="poi-add-form glass-card animate-slide-in">
              <h4 className="form-title">
                <Wrench size={16} className="text-emerald" />
                <span>Uue haakeriista registreerimine</span>
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
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsAddingNew(false)}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">Salvesta haakeriist</button>
              </div>
            </form>
          )}

          {isAddingNew && activeTab === 'devices' && (
            <form onSubmit={handleCreateDevice} className="poi-add-form glass-card animate-slide-in">
              <h4 className="form-title">
                <Radio size={16} className="text-emerald" />
                <span>Uue Teltonika GPS seadme registreerimine</span>
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Seadme mudel</label>
                  <select 
                    value={devModel} 
                    onChange={(e) => setDevModel(e.target.value)}
                    className="form-input"
                  >
                    <option value="FMB640 PRO">Teltonika FMB640 PRO (Heavy CAN)</option>
                    <option value="FMC650 4G LTE">Teltonika FMC650 4G LTE (Agri CAN)</option>
                    <option value="FMB920 Compact">Teltonika FMB920 Compact (Basic GPS)</option>
                    <option value="FMM640 CAT-M1">Teltonika FMM640 CAT-M1 (Telemetry)</option>
                    <option value="FMB140 CAN/BLE">Teltonika FMB140 CAN/BLE</option>
                  </select>
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
                <div className="form-group">
                  <label>Paigalda kohe masinasse</label>
                  <select 
                    value={devAssignedVehId} 
                    onChange={(e) => setDevAssignedVehId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Jäta riiulisse / Vabaks --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.registrationPlate || 'nr puudub'})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsAddingNew(false)}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">Registreeri seade</button>
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
                      
                      <span className={`status-badge status-${v.status}`}>
                        {v.status === 'working' ? 'Töötav' : (v.status === 'moving' ? 'Liikuv' : (v.status === 'idling' ? 'Tühikäik' : (v.status === 'stopped' ? 'Seisev' : 'Offline')))}
                      </span>
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
                            {installedDevice ? `${installedDevice.model} (${installedDevice.imei.slice(-4)})` : 'GPS puudub'}
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
                        <span>🛰️ {installedDevice ? installedDevice.simNumber : 'SIM puudub'}</span>
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
                        <button 
                          className="icon-btn-danger"
                          title="Kustuta masin"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteVehicle(v.id);
                          }}
                        >
                          <Trash2 size={14} />
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

                        <button 
                          className="icon-btn-danger"
                          title="Kustuta haakeriist"
                          onClick={() => onDeleteImplement(imp.id)}
                        >
                          <Trash2 size={14} />
                        </button>
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

                return (
                  <div key={dev.id} className="device-card glass-card">
                    <div className="dev-card-header">
                      <div className="dev-icon-wrap">
                        <Radio size={20} className="text-blue" />
                      </div>
                      <div className="dev-title-wrap">
                        <div className="dev-header-line">
                          <h4 className="dev-model">{dev.model}</h4>
                          <span className={`status-badge status-${dev.status}`}>
                            {assignedVehicle ? 'Paigaldatud' : 'Riiulis'}
                          </span>
                        </div>
                        <span className="dev-imei">IMEI: {dev.imei} &bull; SIM: {dev.simNumber}</span>
                      </div>
                    </div>

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

                    <div className="dev-assignment-box">
                      <label className="text-secondary" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                        Paigaldatud masinasse:
                      </label>
                      <select 
                        className="form-input dev-assign-select"
                        value={assignedVehicle ? assignedVehicle.id : ''}
                        onChange={(e) => {
                          const newVehId = e.target.value || undefined;
                          onAssignDevice(dev.id, newVehId);
                        }}
                      >
                        <option value="">-- Riiulis / Paigaldamata --</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            🚜 {v.name} ({v.registrationPlate || 'nr puudub'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="dev-card-footer">
                      <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                        Firmware: {dev.firmwareVersion || 'v03.28'}
                      </span>
                      <button 
                        className="icon-btn-danger"
                        title="Kustuta seade"
                        onClick={() => onDeleteDevice(dev.id)}
                      >
                        <Trash2 size={14} />
                      </button>
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
                          <Radio size={16} className="text-blue" />
                          <div className="option-info">
                            <strong>{d.model} &bull; IMEI: {d.imei}</strong>
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
