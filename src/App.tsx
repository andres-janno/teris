import React, { useState, useEffect, useRef, useMemo, lazy, Suspense, startTransition } from 'react';
import confetti from 'canvas-confetti';
import { Header, type MainView } from './components/Header';
import { MapView } from './components/MapView';
import { LayerControl } from './components/LayerControl';
import { CultivationControl } from './components/CultivationControl';
import { FieldDetailsDrawer } from './components/FieldDetailsDrawer';
import { VehicleTracker } from './components/VehicleTracker';
import { MapYearSelector } from './components/MapYearSelector';
import { ChangePasswordModal } from './components/ChangePasswordModal';

import type { AuthUser } from './types/auth';
import type { LayerVisibility, BaseMapLayerId } from './types/map';
import { BASE_MAPS } from './services/maaAmetLayers';
import type { FieldCollection, FieldFeature } from './types/field';
import type { MasterField, FieldYearlyRecord } from './types/fieldRegister';
import { generateFieldCollectionForYear } from './types/fieldRegister';
import type { Vehicle, Implement, TeltonikaDevice, EnrichedVehicle } from './types/fleet';
import type { CultivationPass, TelemetryPoint } from './types/telemetry';
import type { PointOfInterest, PoiCategory } from './types/poi';
import type { FarmingSeason } from './types/season';
import type { RelatedParty } from './types/party';
import type { Crop } from './types/crop';
import type { SoilSample, SoilSampleMetricKey } from './types/soilSample';

import { enrichVehicles } from './services/fleet';
import { TelemetrySimulator, buildCompletedPass } from './services/telemetrySimulator';
import { getBoundingBox } from './services/geometryEngine';
import { cleanTrack } from './services/trackCleaning';
import { api } from './services/api';
import { parseEtDate } from './services/dateFormat';
import { DeferredMount } from './components/DeferredMount';

function parseLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  let isoDate = dateStr.trim();
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(isoDate)) {
    const parsed = parseEtDate(isoDate);
    if (parsed) isoDate = parsed;
  }
  const parts = isoDate.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const [hhStr, mmStr] = (timeStr || '00:00').split(':');
  const hh = Number(hhStr) || 0;
  const mm = Number(mmStr) || 0;
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m - 1, d, hh, mm, 0);
  return isNaN(date.getTime()) ? null : date;
}

// Modaalid ja tööde vaade laaditakse eraldi tükkidena alles vajadusel (nt xlsx/shpjs/jszip ei ole esilehe kimbus).
const FieldManagerModal = lazy(() => import('./components/FieldManagerModal').then((m) => ({ default: m.FieldManagerModal })));
const FieldUploadModal = lazy(() => import('./components/FieldUploadModal').then((m) => ({ default: m.FieldUploadModal })));
const SoilSampleUploadModal = lazy(() => import('./components/SoilSampleUploadModal').then((m) => ({ default: m.SoilSampleUploadModal })));
const FieldBookUploadModal = lazy(() => import('./components/FieldBookUploadModal').then((m) => ({ default: m.FieldBookUploadModal })));
const PoiManagerModal = lazy(() => import('./components/PoiManagerModal').then((m) => ({ default: m.PoiManagerModal })));
const AnalyticsModal = lazy(() => import('./components/AnalyticsModal').then((m) => ({ default: m.AnalyticsModal })));
const SeasonManagerModal = lazy(() => import('./components/SeasonManagerModal').then((m) => ({ default: m.SeasonManagerModal })));
const RelatedPartiesModal = lazy(() => import('./components/RelatedPartiesModal').then((m) => ({ default: m.RelatedPartiesModal })));
const WorkRegisterModal = lazy(() => import('./components/WorkRegisterModal').then((m) => ({ default: m.WorkRegisterModal })));
const FieldWorksBoard = lazy(() => import('./components/FieldWorksBoard').then((m) => ({ default: m.FieldWorksBoard })));
const CropRegisterModal = lazy(() => import('./components/CropRegisterModal').then((m) => ({ default: m.CropRegisterModal })));
const UsersAdminModal = lazy(() => import('./components/UsersAdminModal').then((m) => ({ default: m.UsersAdminModal })));

// Kiirusvahemik, mille põhjal loeme haakeriista "tööasendis" olevaks
// (telemetry_tsdb-s puudub otsene hüdraulika/rippriist signaal).
const WORKING_SPEED_MIN_KMH = 0.5;
const WORKING_SPEED_MAX_KMH = 15;

type HistoryPoint = Awaited<ReturnType<typeof api.getTelemetryHistory>>['points'][number];

// GPS-ajalugu harimise läbisõiduks: tööolek kiiruse järgi, seismise müra ja lühikesed töölõigud välja
function historyToPass(history: HistoryPoint[], vehicleId: string, vehicleName: string, workingWidthM: number): CultivationPass {
  const points: TelemetryPoint[] = cleanTrack(history.map((p) => ({
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng,
    altitude: p.altitude,
    speedKmH: p.speedKmH,
    heading: p.heading,
    isWorking: p.speedKmH >= WORKING_SPEED_MIN_KMH && p.speedKmH <= WORKING_SPEED_MAX_KMH,
    workingWidthM
  })));
  return {
    id: `pass-${vehicleId}`,
    vehicleId,
    vehicleName,
    operationType: 'Harimine',
    startTime: points[0].timestamp,
    endTime: points[points.length - 1].timestamp,
    workingWidthM,
    points,
    workedAreaHa: 0,
    distanceKm: 0,
    avgSpeedKmH: points.reduce((sum, p) => sum + p.speedKmH, 0) / points.length
  };
}

// Tühi harimise taasesitus, kui jälgitava seadme GPS-ajalugu puudub.
const EMPTY_CULTIVATION_PASS: CultivationPass = {
  id: '',
  vehicleId: '',
  vehicleName: '',
  operationType: '',
  startTime: '',
  workingWidthM: 12,
  points: [],
  workedAreaHa: 0,
  distanceKm: 0,
  avgSpeedKmH: 0
};

// Varasemad versioonid hoidsid andmebaasi andmeid (sh seotud isikute
// isikuandmeid) brauseri localStorage'is — need kustutatakse.
const LEGACY_DATA_CACHE_KEYS = [
  'agrimap_seasons',
  'agrimap_master_fields',
  'agrimap_vehicles',
  'agrimap_implements',
  'agrimap_devices',
  'agrimap_parties',
  'agrimap_crops_register',
  'agrimap_pois'
];

interface AppProps {
  user: AuthUser;
  onLogout: () => void;
}

export const App: React.FC<AppProps> = ({ user, onLogout }) => {
  // Database connection status
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [dbError, setDbError] = useState<boolean>(false);

  useEffect(() => {
    try {
      LEGACY_DATA_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // localStorage pole saadaval (nt privaatrežiim) — pole midagi kustutada
    }
  }, []);

  // Kihtide nähtavus. Lehe avamisel on alati sees ainult Põllud (kaart mahutatakse neile);
  // brauseri mälust taastatakse ainult aluskaardi valik.
  const DEFAULT_VISIBILITY: LayerVisibility = {
    baseMap: 'maaamet-pohikaart',
    cadastre: false,
    fields: true,
    vehicles: false,
    cultivation: false,
    poi: false,
    fieldLabels: false,
    swathTrails: true,
    soilSamples: false,
    weatherRadar: false
  };
  const [visibility, setVisibility] = useState<LayerVisibility>(() => {
    const saved = localStorage.getItem('agrimap_visibility');
    if (!saved) return DEFAULT_VISIBILITY;
    try {
      const savedBaseMap = (JSON.parse(saved) as Partial<LayerVisibility>).baseMap;
      // Varem salvestatud, nüüdseks eemaldatud aluskaart (hübriid, hallkaart, OSM) → põhikaart.
      return savedBaseMap && savedBaseMap in BASE_MAPS ? { ...DEFAULT_VISIBILITY, baseMap: savedBaseMap } : DEFAULT_VISIBILITY;
    } catch {
      return DEFAULT_VISIBILITY;
    }
  });

  // Asukoha valimisel kaardilt on näha ainult kiht „Muud asukohad“; eelmine kihtide valik
  // hoitakse siin ja taastatakse, kui valik on tehtud või katkestatud.
  const visibilityBeforePickRef = useRef<LayerVisibility | null>(null);

  useEffect(() => {
    if (visibilityBeforePickRef.current) return; // ajutist valikut ei salvestata
    localStorage.setItem('agrimap_visibility', JSON.stringify(visibility));
  }, [visibility]);

  // Masinapargi kuvamise filter: 'active' (ainult töötavad < 5 min) või 'all' (kõik masinad)

  // Active Farming Season / Year
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // 0. Hooaegade register (elutsükkel: ettevalmistus, külv, koristus, suletud/lukus)
  const [seasons, setSeasons] = useState<FarmingSeason[]>([]);

  const [isSeasonManagerOpen, setIsSeasonManagerOpen] = useState(false);

  // 1. Põldude ja külvikorra master-register (andmebaasist)
  const [masterFields, setMasterFields] = useState<MasterField[]>([]);

  // Dynamic available years list: activeYear + 3 to activeYear - 4
  const availableYears = React.useMemo(() => {
    const activeYear = seasons.find((s) => s.status === 'active')?.year || 2026;
    const maxYear = activeYear + 3;
    const minYear = activeYear - 4;
    const yearSet = new Set<number>();
    for (let y = maxYear; y >= minYear; y--) {
      yearSet.add(y);
    }
    seasons.forEach((s) => { if (s.year <= maxYear && s.year >= minYear) yearSet.add(s.year); });
    masterFields.forEach((mf) => {
      mf.history.forEach((h) => { if (h.year <= maxYear && h.year >= minYear) yearSet.add(h.year); });
    });
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [seasons, masterFields]);

  // Operaatori (harija) filter — kui valitud, näidatakse kaardil,
  // päisestatistikas, põldude ja kultuuride registris ainult nende
  // operaatoritega põlde. Tühi = kõik. Viimane valik jäetakse meelde kasutaja kaupa (selles brauseris).
  const operatorFilterKey = `agrimap_operator_filter_${user.id}`;
  const [operatorFilter, setOperatorFilter] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(operatorFilterKey) || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(operatorFilterKey, JSON.stringify(operatorFilter));
    } catch {
      // brauseri salvestus pole saadaval — valik kehtib ainult selle seansi ajal
    }
  }, [operatorFilterKey, operatorFilter]);

  const operatorMasterFields = React.useMemo(
    () =>
      operatorFilter.length
        ? masterFields.filter((f) => !!f.operatorId && operatorFilter.includes(f.operatorId))
        : masterFields,
    [masterFields, operatorFilter]
  );

  // Derive FieldCollection for the active year (with that year's specific area and crop)
  const fields: FieldCollection = React.useMemo(
    () => generateFieldCollectionForYear(operatorMasterFields, selectedYear),
    [operatorMasterFields, selectedYear]
  );

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedCropFilter, setSelectedCropFilter] = useState<string | null>(null);

  // Derive active selectedField dynamically for the active year
  const selectedField = React.useMemo(() => {
    if (!selectedFieldId) return null;
    return fields.features.find((f) => String(f.properties.id) === selectedFieldId || String(f.id) === selectedFieldId) || null;
  }, [fields, selectedFieldId]);

  
  // 1. Sõidukite register
  const [rawVehicles, setRawVehicles] = useState<Vehicle[]>([]);

  // 2. Haakeriistade register
  const [implementsList, setImplementsList] = useState<Implement[]>([]);

  // 3. Teltonika GPS seadmete register
  const [devices, setDevices] = useState<TeltonikaDevice[]>([]);

  // Simulaatoris aktiivne sõiduki ID (kui on sisse lülitatud)
  const [simulatedVehicleId, setSimulatedVehicleId] = useState<string | null>(null);

  // Põllutööde kiht: kõigi GPS-ajalooga masinate valmis rajad ja kasutaja peidetud rajad
  const [vehicleTracks, setVehicleTracks] = useState<CultivationPass[]>([]);
  const [isLoadingVehicleTracks, setIsLoadingVehicleTracks] = useState(false);
  const [hiddenTrackVehicleIds, setHiddenTrackVehicleIds] = useState<Set<string>>(() => new Set());

  // Simulaatori dünaamiline hetkeolek (asukoht, kiirus, olek)
  const [simulatedVehicleState, setSimulatedVehicleState] = useState<{
    vehicleId: string;
    position: [number, number];
    heading: number;
    speedKmH: number;
    isWorking: boolean;
  } | null>(null);

  // Liitandmetega sõidukid kaardile ja vaadetesse
  const vehicles: EnrichedVehicle[] = useMemo(() => {
    return enrichVehicles(rawVehicles, implementsList, devices).map((v) => {
      if (simulatedVehicleState && simulatedVehicleState.vehicleId === v.id) {
        return {
          ...v,
          position: simulatedVehicleState.position,
          heading: simulatedVehicleState.heading,
          speedKmH: simulatedVehicleState.speedKmH,
          status: (simulatedVehicleState.isWorking ? 'working' : (simulatedVehicleState.speedKmH > 0 ? 'moving' : 'stopped')) as any,
          telemetry: {
            ...v.telemetry,
            lastUpdate: new Date().toISOString()
          }
        };
      }
      return v;
    });
  }, [rawVehicles, implementsList, devices, simulatedVehicleState]);

  const handleToggleVehicleSimulator = (vehicleId: string) => {
    if (simulatedVehicleId === vehicleId) {
      setSimulatedVehicleId(null);
      return;
    }
    setSimulatedVehicleId(vehicleId);
    setVisibility((v) => ({ ...v, cultivation: true }));
  };

  const handleToggleTrackVisibility = (vehicleId: string) => {
    setHiddenTrackVehicleIds((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  const [selectedVehicle, setSelectedVehicle] = useState<EnrichedVehicle | null>(null);

  const [cultivationPass, setCultivationPass] = useState<CultivationPass>(EMPTY_CULTIVATION_PASS);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [selectedPoi, setSelectedPoi] = useState<PointOfInterest | null>(null);

  // Mullaproovid (soil samples)
  const [soilSamples, setSoilSamples] = useState<SoilSample[]>([]);
  const [soilMetric, setSoilMetric] = useState<SoilSampleMetricKey>('ph');

  // Laadi andmed otse PostgreSQL teris_db andmebaasist
  useEffect(() => {
    let isMounted = true;
    api.getStatus()
      .then(async (status) => {
        if (!isMounted) return;
        if (status.status === 'connected') {
          setDbConnected(true);

          const [dbFields, dbSeasons, dbFleet, dbPois, dbParties, dbCrops, dbSoilSamples] = await Promise.all([
            api.getMasterFields().catch(() => null),
            api.getSeasons().catch(() => null),
            api.getFleet().catch(() => null),
            api.getPois().catch(() => null),
            api.getParties().catch(() => null),
            api.getCrops().catch(() => null),
            api.getSoilSamples().catch(() => null)
          ]);

          if (!isMounted) return;
          if (dbFields && dbFields.length > 0) setMasterFields(dbFields);
          if (dbSeasons && dbSeasons.length > 0) setSeasons(dbSeasons);
          if (dbFleet) {
            if (dbFleet.vehicles?.length) setRawVehicles(dbFleet.vehicles);
            if (dbFleet.implements?.length) setImplementsList(dbFleet.implements);
            if (dbFleet.devices?.length) setDevices(dbFleet.devices);
          }
          if (dbPois && dbPois.length > 0) setPois(dbPois);
          if (dbParties && dbParties.length > 0) setParties(dbParties);
          if (dbCrops && dbCrops.length > 0) setCrops(dbCrops);
          if (dbSoilSamples) setSoilSamples(dbSoilSamples);
          // Kaart loodi enne andmete saabumist — mahuta laaditud põllud ekraanile.
          setFitBoundsTrigger((prev) => prev + 1);
        } else {
          setDbError(true);
        }
      })
      .catch((err) => {
        console.warn('teris_db API pole saadaval:', err);
        setDbError(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Modals state
  const [isFieldsRegisterOpen, setIsFieldsRegisterOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSoilUploadOpen, setIsSoilUploadOpen] = useState(false);
  const [isFieldBookUploadOpen, setIsFieldBookUploadOpen] = useState(false);
  const [isPoiModalOpen, setIsPoiModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  
  // POI adding/picking mode
  const [isAddPoiMode, setIsAddPoiMode] = useState(false);
  const [newPoiCoords, setNewPoiCoords] = useState<[number, number] | null>(null);
  const [poiDraft, setPoiDraft] = useState<{
    id?: string;
    name: string;
    category: PoiCategory;
    position: [number, number];
    description?: string;
    capacity?: string;
    contactPerson?: string;
    phone?: string;
    accessNotes?: string;
  } | null>(null);

  // 6. Seotud isikute register (maaomanikud, rentnikud, masinajuhid, partnerid)
  const [parties, setParties] = useState<RelatedParty[]>([]);

  // Meeldejäetud valikust eemaldatakse operaatorid, keda registris enam pole.
  useEffect(() => {
    if (parties.length === 0) return;
    setOperatorFilter((prev) => {
      const next = prev.filter((id) => parties.some((p) => p.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [parties]);
  const [isPartiesModalOpen, setIsPartiesModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isUsersAdminOpen, setIsUsersAdminOpen] = useState(false);

  const handleSaveParty = (partyToSave: RelatedParty) => {
    setParties((prev) => {
      const idx = prev.findIndex((p) => p.id === partyToSave.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = partyToSave;
        return copy;
      }
      return [partyToSave, ...prev];
    });
    api.saveParty(partyToSave).catch((err) => console.error('Error saving party to DB:', err));
  };

  const handleDeleteParty = (partyId: string) => {
    setParties((prev) => prev.filter((p) => p.id !== partyId));
    api.deleteParty(partyId).catch((err) => console.error('Error deleting party from DB:', err));
  };

  // Crops & Varieties Register state
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isCropsModalOpen, setIsCropsModalOpen] = useState(false);
  const [isWorkRegisterOpen, setIsWorkRegisterOpen] = useState(false);

  // Põhivaade: hooajad, kaart, põllud, kultuurid, põllutööd, tehnika või taristu. Lehe avamisel alati kaart.
  const [mainView, setMainView] = useState<MainView>('map');
  const changeMainView = (view: MainView) => {
    setMainView(view);
    // Leaflet peab peidetud konteineri suuruse uuesti arvutama
    if (view === 'map') setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  };

  const handleSaveCrop = (cropToSave: Crop) => {
    setCrops((prev) => {
      const idx = prev.findIndex((c) => c.id === cropToSave.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = cropToSave;
        return copy;
      }
      return [...prev, cropToSave];
    });
    api.saveCrop(cropToSave).catch((err) => console.error('Error saving crop to DB:', err));
  };

  const handleDeleteCrop = (cropId: string) => {
    setCrops((prev) => prev.filter((c) => c.id !== cropId));
    api.deleteCrop(cropId).catch((err) => console.error('Error deleting crop from DB:', err));
  };

  // Theme state: light by default
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('agrimap_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agrimap_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Map camera focus & fit all
  const [focusedTarget, setFocusedTarget] = useState<{ 
    coords: [number, number]; 
    bounds?: [[number, number], [number, number]]; 
    zoom?: number 
  } | null>(null);
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState<number>(0);

  const handleFitAll = () => {
    setFitBoundsTrigger((prev) => prev + 1);
  };

  // Telemetry Simulator
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(2);
  const [progressPct, setProgressPct] = useState(75);
  const [workingWidthM, setWorkingWidthM] = useState(12);
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [telemetryHours, setTelemetryHours] = useState<number>(2);
  const [simTimeMode, setSimTimeMode] = useState<'rolling' | 'custom'>('rolling');
  const [simCustomDate, setSimCustomDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [simCustomTime, setSimCustomTime] = useState<string>(() => {
    const d = new Date();
    const hh = Math.max(0, d.getHours() - 2);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hh)}:00`;
  });
  const [simDurationHours, setSimDurationHours] = useState<number>(2);
  // Taasesituse raja laadimine ja laaditud punktide arv (taasesituse seisust sõltumata)
  const [isLoadingSimTrack, setIsLoadingSimTrack] = useState(false);
  const [simTrackPointCount, setSimTrackPointCount] = useState(0);
  const [detectedImplement, setDetectedImplement] = useState<{ id: string; name: string; workingWidthM: number; type?: string } | null>(null);

  const simulatorRef = useRef<TelemetrySimulator | null>(null);

  // Demoraja genereerimine juhuks, kui masinal puudub reaalne GPS-seade (nt Demotraktor)
  const createDemoCultivationPass = (vehicleId: string, vehicleName: string, widthM: number): CultivationPass => {
    const baseLat = 58.1376;
    const baseLng = 25.8805;
    const points: TelemetryPoint[] = [];
    const now = Date.now();
    let time = now - 3600 * 1000;

    const rows = 6;
    const rowLen = 14;
    for (let r = 0; r < rows; r++) {
      const latOffset = r * 0.00035;
      const isForward = r % 2 === 0;
      const heading = isForward ? 45 : 225;

      for (let i = 0; i < rowLen; i++) {
        const step = isForward ? i : (rowLen - 1 - i);
        const lat = baseLat + latOffset + (step * 0.00015);
        const lng = baseLng + (step * 0.00028);
        time += 4000;
        points.push({
          timestamp: new Date(time).toISOString(),
          lat,
          lng,
          altitude: 68,
          speedKmH: 7.8 + (i % 3) * 0.4,
          heading,
          isWorking: true,
          workingWidthM: widthM
        });
      }
    }

    // Harimisala ja vahemaa arvutab TelemetrySimulator taasesituse käigus järk-järgult
    return {
      id: `demo-pass-${vehicleId}`,
      vehicleId,
      vehicleName,
      operationType: 'Harimine (Demo)',
      startTime: points[0].timestamp,
      endTime: points[points.length - 1].timestamp,
      workingWidthM: widthM,
      points,
      workedAreaHa: 0,
      distanceKm: 0,
      avgSpeedKmH: 8.0
    };
  };

  // Harimise taasesitus jälgib kasutaja poolt sisse lülitatud masinat
  const trackedTarget = useMemo(() => {
    if (!simulatedVehicleId) return null;
    const v = rawVehicles.find((veh) => veh.id === simulatedVehicleId);
    if (!v) return null;
    const device = devices.find((d) => d.id === v.assignedDeviceId || d.assignedVehicleId === v.id);
    return {
      vehicleId: v.id,
      vehicleName: v.name,
      imei: (device?.connectivityType === 'cellular' && device.imei) ? device.imei : null,
      device
    };
  }, [simulatedVehicleId, rawVehicles, devices]);

  const activeSimVehicle = useMemo(() => {
    if (!simulatedVehicleId) return null;
    return rawVehicles.find((veh) => veh.id === simulatedVehicleId) ?? null;
  }, [simulatedVehicleId, rawVehicles]);

  const handleJumpToLastActive = () => {
    const lastActive = activeSimVehicle?.lastActiveAt || trackedTarget?.device?.lastUpdate;
    if (!lastActive) return;
    const d = new Date(lastActive);
    if (isNaN(d.getTime())) return;
    // Aken: 2 h enne viimast sõitu kuni 1 h pärast, algus ümardatud alla 5 minutile (minutivalik on 5 min sammuga)
    const start = new Date(d.getTime() - 2 * 3600 * 1000);
    start.setMinutes(Math.floor(start.getMinutes() / 5) * 5, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setSimCustomDate(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
    setSimCustomTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    setSimDurationHours(3);
    setSimTimeMode('custom');
  };

  // Laeb valitud masina GPS-ajaloo (või demoraja) ja taasesitab seda
  useEffect(() => {
    if (!trackedTarget) {
      if (simulatorRef.current) {
        simulatorRef.current.destroy();
        simulatorRef.current = null;
      }
      setSimulatedVehicleState(null);
      setCultivationPass(EMPTY_CULTIVATION_PASS);
      setIsPlaying(false);
      setProgressPct(0);
      setDetectedImplement(null);
      setSimTrackPointCount(0);
      setIsLoadingSimTrack(false);
      return;
    }

    let isMounted = true;
    let sim: TelemetrySimulator | null = null;
    const currentImei = trackedTarget.imei;
    const currentVehicleId = trackedTarget.vehicleId;
    const currentVehicleName = trackedTarget.vehicleName;

    const attachSimulator = (pass: CultivationPass) => {
      if (!isMounted) return;
      sim = new TelemetrySimulator(pass);
      simulatorRef.current = sim;

      sim.setOnUpdate((updatedPass, activePos, heading, speed, isWorking) => {
        const progress = sim!.getProgress();
        // Taasesituse uuendused on madala prioriteediga, et kasutaja klikid
        // (nt kaardikihtide lülitamine) ei jääks simulaatori sammude järjekorda ootama.
        startTransition(() => {
          setCultivationPass(updatedPass);
          setProgressPct(progress);

          // Uuenda simuleeritud masina reaalaja andmeid kaardil
          setSimulatedVehicleState({
            vehicleId: currentVehicleId,
            position: activePos,
            heading,
            speedKmH: speed,
            isWorking
          });
        });
      });

      setSimTrackPointCount(pass.points.length);
      setIsLoadingSimTrack(false);
      if (pass.points.length < 2) {
        // Andmeid pole: paneel peab nägema tühja läbisõitu, mitte eelmise masina/vahemiku oma
        setCultivationPass(pass);
        setSimulatedVehicleState(null);
        return;
      }
      if (selectedStartTime) {
        // Kui kasutaja on määranud kohandatud alguskellaaja, rakenda see
        sim.setPlaybackStartTime(selectedStartTime);
        setProgressPct(sim.getProgress());
      } else {
        // Näita kohe taasesituse algseisu (rada, pindala, vahemaa), mitte alles pärast Play vajutust
        sim.emitCurrentState();
      }
    };

    // Tuleta haakeriist masina küljest esmalt (vaikimisi laiuseks)
    const attachedToVeh = implementsList.find(
      (i) => i.id === activeSimVehicle?.assignedImplementId || i.assignedVehicleId === currentVehicleId
    );
    if (attachedToVeh && attachedToVeh.workingWidthM > 0) {
      setWorkingWidthM(attachedToVeh.workingWidthM);
      setDetectedImplement({
        id: attachedToVeh.id,
        name: attachedToVeh.name,
        workingWidthM: attachedToVeh.workingWidthM,
        type: attachedToVeh.type
      });
    }

    setIsLoadingSimTrack(true);
    let queryParams: { imei?: string; vehicleId?: string; hours?: number; from?: string; to?: string };
    if (simTimeMode === 'custom') {
      const localStart = parseLocalDateTime(simCustomDate, simCustomTime);
      if (!localStart) {
        setIsLoadingSimTrack(false);
        return;
      }
      const localEnd = new Date(localStart.getTime() + simDurationHours * 3600 * 1000);
      queryParams = {
        imei: currentImei ?? undefined,
        vehicleId: currentVehicleId,
        from: localStart.toISOString(),
        to: localEnd.toISOString()
      };
    } else {
      queryParams = {
        imei: currentImei ?? undefined,
        vehicleId: currentVehicleId,
        hours: telemetryHours
      };
    }

    api.getTelemetryHistory(queryParams)
      .then((res) => {
        if (!isMounted) return;
        let effectiveWidth = workingWidthM;
        if (res.implement && res.implement.workingWidthM > 0) {
          effectiveWidth = res.implement.workingWidthM;
          setWorkingWidthM(effectiveWidth);
          setDetectedImplement(res.implement);
        } else if (attachedToVeh && attachedToVeh.workingWidthM > 0) {
          effectiveWidth = attachedToVeh.workingWidthM;
          setWorkingWidthM(effectiveWidth);
          setDetectedImplement({
            id: attachedToVeh.id,
            name: attachedToVeh.name,
            workingWidthM: attachedToVeh.workingWidthM,
            type: attachedToVeh.type
          });
        }

        if (res.points.length >= 2) {
          attachSimulator(historyToPass(res.points, currentVehicleId, currentVehicleName, effectiveWidth));
          return;
        }

        // Kui ajalugu oli tühi
        if (!currentImei) {
          attachSimulator(createDemoCultivationPass(currentVehicleId, currentVehicleName, effectiveWidth));
        } else {
          attachSimulator({
            id: `pass-${currentVehicleId}`,
            vehicleId: currentVehicleId,
            vehicleName: currentVehicleName,
            operationType: 'Harimine',
            startTime: '',
            endTime: '',
            workingWidthM: effectiveWidth,
            points: [],
            workedAreaHa: 0,
            distanceKm: 0,
            avgSpeedKmH: 0
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        if (!currentImei) {
          attachSimulator(createDemoCultivationPass(currentVehicleId, currentVehicleName, workingWidthM));
        } else {
          attachSimulator({
            id: `pass-${currentVehicleId}`,
            vehicleId: currentVehicleId,
            vehicleName: currentVehicleName,
            operationType: 'Harimine',
            startTime: '',
            endTime: '',
            workingWidthM,
            points: [],
            workedAreaHa: 0,
            distanceKm: 0,
            avgSpeedKmH: 0
          });
        }
      });

    return () => {
      isMounted = false;
      sim?.destroy();
      simulatorRef.current = null;
    };
  }, [
    trackedTarget,
    activeSimVehicle,
    implementsList,
    simTimeMode,
    telemetryHours,
    simCustomDate,
    simCustomTime,
    simDurationHours,
    workingWidthM
  ]);

  // Põllutööde kiht: laeb kõigi masinate GPS-ajaloo ja arvutab valmis rajad.
  // Demorada siia ei lähe — ilma päris andmeteta masinal rada ei kuvata.
  const vehicleIdsKey = rawVehicles.map((v) => `${v.id}:${v.name}`).join('|');
  useEffect(() => {
    if (!visibility.cultivation) {
      setVehicleTracks([]);
      setIsLoadingVehicleTracks(false);
      return;
    }
    let isMounted = true;
    const timers: number[] = [];
    const targets = rawVehicles.map((v) => ({ id: v.id, name: v.name }));
    setIsLoadingVehicleTracks(true);

    Promise.all(targets.map((t) =>
      api.getTelemetryHistory({ vehicleId: t.id, hours: Math.max(telemetryHours, 48) })
        .then((res) => (res.points.length >= 2 ? { ...t, points: res.points } : null))
        .catch(() => null)
    )).then((results) => {
      if (!isMounted) return;
      const loaded = results.filter((r): r is NonNullable<typeof r> => r !== null);
      const built: CultivationPass[] = [];
      // Iga masina rada arvutatakse eraldi taskis, et brauser jõuaks vahepeal sisendit töödelda
      const buildNext = (i: number) => {
        if (!isMounted) return;
        if (i >= loaded.length) {
          startTransition(() => {
            setVehicleTracks(built);
            setIsLoadingVehicleTracks(false);
          });
          return;
        }
        const r = loaded[i];
        built.push(buildCompletedPass(historyToPass(r.points, r.id, r.name, workingWidthM)));
        timers.push(window.setTimeout(() => buildNext(i + 1), 0));
      };
      buildNext(0);
    });

    return () => {
      isMounted = false;
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility.cultivation, vehicleIdsKey, telemetryHours, workingWidthM]);

  // Kaardil kuvatavad rajad: kasutaja peidetud ja parasjagu simuleeritav masin välja
  const visibleVehicleTracks = useMemo(
    () => vehicleTracks.filter((t) => !hiddenTrackVehicleIds.has(t.vehicleId) && t.vehicleId !== simulatedVehicleId),
    [vehicleTracks, hiddenTrackVehicleIds, simulatedVehicleId]
  );
  const trackVehicleIds = useMemo(() => new Set(vehicleTracks.map((t) => t.vehicleId)), [vehicleTracks]);

  // Layer toggling
  const handleToggleLayer = (key: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectBaseMap = (id: BaseMapLayerId) => {
    setVisibility((prev) => ({ ...prev, baseMap: id }));
  };

  // Playback control actions
  const handleTogglePlay = () => {
    if (!simulatorRef.current) return;
    simulatorRef.current.togglePlay();
    setIsPlaying(simulatorRef.current.getIsPlaying());
  };

  const handleReset = () => {
    if (!simulatorRef.current) return;
    simulatorRef.current.reset();
    setIsPlaying(false);
    setProgressPct(simulatorRef.current.getProgress());
  };

  const handleStartTimeChange = (timeStr: string) => {
    setSelectedStartTime(timeStr);
    if (!simulatorRef.current) return;
    simulatorRef.current.setPlaybackStartTime(timeStr);
    setProgressPct(simulatorRef.current.getProgress());
  };

  const handleSeek = (pct: number) => {
    if (!simulatorRef.current) return;
    simulatorRef.current.setProgress(pct);
    setProgressPct(pct);
  };

  const handleSpeedChange = (speed: number) => {
    if (!simulatorRef.current) return;
    simulatorRef.current.setPlaybackSpeed(speed);
    setPlaybackSpeed(speed);
  };

  // Field selection & focus
  const handleSelectField = (field: FieldFeature | null) => {
    setSelectedFieldId(field ? String(field.properties.id || field.id) : null);
  };

  const handleFocusField = (field: FieldFeature) => {
    const bbox = getBoundingBox(field);
    const centerLat = (bbox[1] + bbox[3]) / 2;
    const centerLng = (bbox[0] + bbox[2]) / 2;
    setFocusedTarget({ 
      coords: [centerLat, centerLng], 
      bounds: [[bbox[1], bbox[0]], [bbox[3], bbox[2]]],
      zoom: 17 
    });
  };

  const handleCloseFieldDetails = React.useCallback(() => setSelectedFieldId(null), []);

  // Vehicle focus
  const handleFocusVehicle = (vehicle: EnrichedVehicle) => {
    setSelectedVehicle(vehicle);
    if (vehicle.position) {
      setFocusedTarget({ coords: vehicle.position, zoom: 16 });
    }
  };

  // Reassignment handlers (Swapping devices and implements between machines)
  // A device attaches to at most one target at a time: either a vehicle
  // (cellular trackers) or an implement (eye sensors on attachments).
  const handleAssignDevice = (deviceId: string, vehicleId?: string, implementId?: string) => {
    setDevices((prevDevs) => {
      return prevDevs.map((d) => {
        if (d.id === deviceId) {
          return { ...d, assignedVehicleId: vehicleId, assignedImplementId: implementId };
        }
        // If this other device was assigned to the target vehicle/implement, unassign it
        if (vehicleId && d.assignedVehicleId === vehicleId) {
          return { ...d, assignedVehicleId: undefined };
        }
        if (implementId && d.assignedImplementId === implementId) {
          return { ...d, assignedImplementId: undefined };
        }
        return d;
      });
    });

    setRawVehicles((prevVehs) => {
      return prevVehs.map((v) => {
        if (v.id === vehicleId) {
          return { ...v, assignedDeviceId: deviceId };
        }
        if (v.assignedDeviceId === deviceId) {
          const dev = devices.find((d) => d.id === deviceId);
          return {
            ...v,
            assignedDeviceId: undefined,
            lastKnownPosition: dev?.position ?? v.lastKnownPosition
          };
        }
        return v;
      });
    });

    setImplementsList((prevImps) => {
      return prevImps.map((imp) => {
        if (imp.id === implementId) {
          return { ...imp, assignedDeviceId: deviceId };
        }
        if (imp.assignedDeviceId === deviceId) {
          return { ...imp, assignedDeviceId: undefined };
        }
        return imp;
      });
    });

    api.assignDevice(deviceId, vehicleId, implementId).catch((err) => console.error('Error assigning device in DB:', err));
  };

  const handleAssignImplement = (implementId: string, vehicleId?: string) => {
    setImplementsList((prevImps) => {
      return prevImps.map((imp) => {
        if (imp.id === implementId) {
          return { ...imp, assignedVehicleId: vehicleId };
        }
        if (vehicleId && imp.assignedVehicleId === vehicleId) {
          return { ...imp, assignedVehicleId: undefined };
        }
        return imp;
      });
    });

    setRawVehicles((prevVehs) => {
      return prevVehs.map((v) => {
        if (v.id === vehicleId) {
          return { ...v, assignedImplementId: implementId };
        }
        if (v.assignedImplementId === implementId) {
          return { ...v, assignedImplementId: undefined };
        }
        return v;
      });
    });

    api.assignImplement(implementId, vehicleId).catch((err) => console.error('Error assigning implement in DB:', err));
  };

  // CRUD handlers
  const handleAddVehicle = (newV: Omit<Vehicle, 'id'>) => {
    const v: Vehicle = { ...newV, id: `veh-${Date.now()}` };
    setRawVehicles((prev) => [...prev, v]);
    if (newV.assignedDeviceId) {
      handleAssignDevice(newV.assignedDeviceId, v.id);
    }
    if (newV.assignedImplementId) {
      handleAssignImplement(newV.assignedImplementId, v.id);
    }
    api.saveVehicle(v).catch((err) => console.error('Error saving vehicle to DB:', err));
  };

  const handleUpdateVehicle = (id: string, updates: Omit<Vehicle, 'id'>) => {
    setRawVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));

    if (updates.assignedDeviceId) {
      handleAssignDevice(updates.assignedDeviceId, id);
    } else {
      const currentDeviceId = devices.find((d) => d.assignedVehicleId === id)?.id;
      if (currentDeviceId) handleAssignDevice(currentDeviceId, undefined);
    }

    if (updates.assignedImplementId) {
      handleAssignImplement(updates.assignedImplementId, id);
    } else {
      const currentImplementId = implementsList.find((i) => i.assignedVehicleId === id)?.id;
      if (currentImplementId) handleAssignImplement(currentImplementId, undefined);
    }

    api.saveVehicle({ ...updates, id }).catch((err) => console.error('Error updating vehicle in DB:', err));
  };

  const handleDeleteVehicle = (id: string) => {
    setRawVehicles((prev) => prev.filter((v) => v.id !== id));
    setDevices((prev) => prev.map((d) => d.assignedVehicleId === id ? { ...d, assignedVehicleId: undefined } : d));
    setImplementsList((prev) => prev.map((i) => i.assignedVehicleId === id ? { ...i, assignedVehicleId: undefined } : i));
    if (selectedVehicle && selectedVehicle.id === id) setSelectedVehicle(null);
    api.deleteVehicle(id).catch((err) => console.error('Error deleting vehicle from DB:', err));
  };

  const handleAddImplement = (newImp: Omit<Implement, 'id'>) => {
    const imp: Implement = { ...newImp, id: `imp-${Date.now()}` };
    setImplementsList((prev) => [...prev, imp]);
    if (newImp.assignedVehicleId) {
      handleAssignImplement(imp.id, newImp.assignedVehicleId);
    }
    api.saveImplement(imp).catch((err) => console.error('Error saving implement to DB:', err));
  };

  const handleUpdateImplement = (id: string, updates: Omit<Implement, 'id'>) => {
    setImplementsList((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    handleAssignImplement(id, updates.assignedVehicleId || undefined);
    api.saveImplement({ ...updates, id }).catch((err) => console.error('Error updating implement in DB:', err));
  };

  const handleDeleteImplement = (id: string) => {
    setImplementsList((prev) => prev.filter((i) => i.id !== id));
    setRawVehicles((prev) => prev.map((v) => v.assignedImplementId === id ? { ...v, assignedImplementId: undefined } : v));
    setDevices((prev) => prev.map((d) => d.assignedImplementId === id ? { ...d, assignedImplementId: undefined } : d));
    api.deleteImplement(id).catch((err) => console.error('Error deleting implement from DB:', err));
  };

  const handleAddDevice = (newDev: Omit<TeltonikaDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => {
    const dev: TeltonikaDevice = {
      ...newDev,
      id: `tel-${Date.now()}`,
      position: [58.1402, 25.8030],
      heading: 0,
      speedKmH: 0,
      status: 'offline',
      lastUpdate: new Date().toISOString()
    };
    setDevices((prev) => [...prev, dev]);
    if (newDev.assignedVehicleId) {
      handleAssignDevice(dev.id, newDev.assignedVehicleId);
    } else if (newDev.assignedImplementId) {
      handleAssignDevice(dev.id, undefined, newDev.assignedImplementId);
    }
    api.saveDevice(dev).catch((err) => console.error('Error saving device to DB:', err));
  };

  const handleUpdateDevice = (id: string, updates: Omit<TeltonikaDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    handleAssignDevice(id, updates.assignedVehicleId || undefined, updates.assignedImplementId || undefined);
    const current = devices.find((d) => d.id === id);
    if (current) {
      api.saveDevice({ ...current, ...updates }).catch((err) => console.error('Error updating device in DB:', err));
    }
  };

  const handleDeleteDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setRawVehicles((prev) => prev.map((v) => v.assignedDeviceId === id ? { ...v, assignedDeviceId: undefined } : v));
    setImplementsList((prev) => prev.map((i) => i.assignedDeviceId === id ? { ...i, assignedDeviceId: undefined } : i));
    api.deleteDevice(id).catch((err) => console.error('Error deleting device from DB:', err));
  };

  // POI actions
  const handleAddPoi = (newPoiData: Omit<PointOfInterest, 'id' | 'createdAt'>) => {
    const newPoi: PointOfInterest = {
      ...newPoiData,
      id: `poi-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setPois((prev) => {
      const updatedList = [newPoi, ...prev];
      return updatedList;
    });
    setIsAddPoiMode(false);
    setNewPoiCoords(null);
    setPoiDraft(null);
    setVisibility((prev) => ({ ...prev, poi: true }));
    setFocusedTarget({ coords: newPoi.position, zoom: 15 });
    api.savePoi(newPoi).catch((err) => {
      console.error('Error saving POI to DB:', err);
      alert(`Asukoha "${newPoi.name}" salvestamine ebaõnnestus. Muudatus kaob lehe värskendamisel.`);
    });
  };

  const handleUpdatePoi = (id: string, updatedData: Partial<PointOfInterest>) => {
    setPois((prev) => {
      const updatedList = prev.map((p) => (p.id === id ? { ...p, ...updatedData } : p));
      return updatedList;
    });
    setPoiDraft(null);
    setIsAddPoiMode(false);
    setVisibility((prev) => ({ ...prev, poi: true }));
    if (updatedData.position) {
      setFocusedTarget({ coords: updatedData.position as [number, number], zoom: 15 });
    }
    api.savePoi({ id, ...updatedData }).catch((err) => {
      console.error('Error updating POI in DB:', err);
      alert('Asukoha muudatuste salvestamine ebaõnnestus. Muudatus kaob lehe värskendamisel.');
    });
  };

  const handleDeletePoi = (id: string) => {
    setPois((prev) => {
      const updatedList = prev.filter((p) => p.id !== id);
      return updatedList;
    });
    if (selectedPoi && selectedPoi.id === id) {
      setSelectedPoi(null);
    }
    api.deletePoi(id).catch((err) => console.error('Error deleting POI from DB:', err));
  };

  const handleFocusPoi = (poi: PointOfInterest) => {
    setSelectedPoi(poi);
    setVisibility((prev) => ({ ...prev, poi: true }));
    setFocusedTarget({ coords: poi.position, zoom: 16 });
  };

  const handleStartPickLocation = (currentDraft: {
    id?: string;
    name: string;
    category: PoiCategory;
    position: [number, number];
    description?: string;
    capacity?: string;
    contactPerson?: string;
    phone?: string;
    accessNotes?: string;
  }) => {
    setPoiDraft(currentDraft);
    setIsPoiModalOpen(false);
    if (!visibilityBeforePickRef.current) {
      visibilityBeforePickRef.current = visibility;
      setVisibility((prev) => ({
        ...prev,
        cadastre: false,
        fields: false,
        vehicles: false,
        cultivation: false,
        fieldLabels: false,
        swathTrails: false,
        soilSamples: false,
        weatherRadar: false,
        poi: true
      }));
    }
    setIsAddPoiMode(true);
  };

  // Asukoha valimise lõpp (tehtud või katkestatud): taasta teemakihid, aluskaart jääb praeguseks.
  useEffect(() => {
    if (isAddPoiMode || !visibilityBeforePickRef.current) return;
    const saved = visibilityBeforePickRef.current;
    visibilityBeforePickRef.current = null;
    setVisibility((prev) => ({ ...saved, baseMap: prev.baseMap }));
  }, [isAddPoiMode]);

  const handleCancelPickLocation = () => {
    setIsAddPoiMode(false);
    if (poiDraft) {
      changeMainView('infrastructure');
    }
  };

  useEffect(() => {
    if (!isAddPoiMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelPickLocation();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const handleMapClickAddPoi = (coords: [number, number]) => {
    if (poiDraft) {
      setPoiDraft({
        ...poiDraft,
        position: coords
      });
    } else {
      setNewPoiCoords(coords);
    }
    changeMainView('infrastructure');
    setIsAddPoiMode(false);
  };

  // Field Register Handlers
  const handleUpdateMasterField = (
    fieldId: number | string, 
    fieldData: Partial<MasterField>, 
    seasonData?: FieldYearlyRecord
  ) => {
    setMasterFields((prev) => {
      const next = prev.map((f) => {
        if (f.id === fieldId || String(f.id) === String(fieldId)) {
          let newHistory = [...f.history];
          if (seasonData) {
            const existingIdx = f.history.findIndex((h) => h.year === seasonData.year);
            if (existingIdx >= 0) {
              newHistory[existingIdx] = { ...newHistory[existingIdx], ...seasonData };
            } else {
              newHistory = [seasonData, ...newHistory];
            }
          }
          const updated: MasterField = {
            ...f,
            ...fieldData,
            history: newHistory
          };
          api.saveMasterFields(updated).catch((err) => console.error('Error saving master field to DB:', err));
          return updated;
        }
        return f;
      });
      return next;
    });
  };

  const handleAddNewSeasonToAll = (newYear: number) => {
    setMasterFields((prev) =>
      prev.map((f) => {
        if (f.history.some((h) => h.year === newYear)) return f;
        if (operatorFilter.length && !(f.operatorId && operatorFilter.includes(f.operatorId))) return f;
        const latestRec = f.history[0] || {
          year: 2026,
          areaHa: 5.0,
          crop: 'Talinisu (Skagen)',
          cropColor: '#eab308'
        };
        const newRec: FieldYearlyRecord = {
          year: newYear,
          areaHa: latestRec.areaHa,
          eligibleAreaHa: latestRec.eligibleAreaHa,
          crop: latestRec.crop,
          cropVariety: latestRec.cropVariety,
          cropColor: latestRec.cropColor,
          targetYieldTonsHa: latestRec.targetYieldTonsHa,
          workedAreaHa: 0,
          workProgress: 0,
          status: 'not_started',
          geometry: latestRec.geometry || f.geometry,
          boundaryPointsCount: latestRec.boundaryPointsCount,
          perimeterM: latestRec.perimeterM,
          cadastralParcels: latestRec.cadastralParcels ? [...latestRec.cadastralParcels] : (f.cadastralParcels ? [...f.cadastralParcels] : [])
        };
        return {
          ...f,
          history: [newRec, ...f.history]
        };
      })
    );
    setSelectedYear(newYear);
  };

  const handleDeleteMasterField = (fieldId: number | string) => {
    setMasterFields((prev) => prev.filter((f) => f.id !== fieldId && String(f.id) !== String(fieldId)));
    if (selectedFieldId === String(fieldId)) {
      setSelectedFieldId(null);
    }
    api.deleteMasterField(fieldId).catch((err) => console.error('Error deleting field from DB:', err));
  };

  // Season Management Handlers
  const handleUpdateSeason = (updated: FarmingSeason) => {
    setSeasons((prev) => prev.map((s) => s.year === updated.year ? updated : s));
    api.saveSeason(updated).catch((err) => console.error('Error updating season in DB:', err));
  };

  const handleCloseSeason = (year: number) => {
    const today = new Date().toISOString().split('T')[0];
    setSeasons((prev) =>
      prev.map((s) => {
        if (s.year === year) {
          const updated: FarmingSeason = {
            ...s,
            status: 'closed',
            isLocked: true,
            harvestEndDate: s.harvestEndDate || today,
            closedAt: today,
            closedBy: 'Rein Janno'
          };
          api.saveSeason(updated).catch((err) => console.error('Error closing season in DB:', err));
          return updated;
        }
        return s;
      })
    );
  };

  const handleReopenSeason = (year: number) => {
    setSeasons((prev) =>
      prev.map((s) => {
        if (s.year === year) {
          const updated: FarmingSeason = {
            ...s,
            status: 'active',
            isLocked: false
          };
          api.saveSeason(updated).catch((err) => console.error('Error reopening season in DB:', err));
          return updated;
        }
        return s;
      })
    );
  };

  const handleCreateSeason = (newSeason: FarmingSeason) => {
    setSeasons((prev) => {
      const filtered = prev.filter((s) => s.year !== newSeason.year);
      return [newSeason, ...filtered].sort((a, b) => b.year - a.year);
    });
    handleAddNewSeasonToAll(newSeason.year);
    api.saveSeason(newSeason).catch((err) => console.error('Error creating season in DB:', err));
  };

  // Kultuuri värv peab olema läbiv üle aastate — kasutame alati Kultuuride
  // Registri värvi (kui kultuur sinna sobitub), mitte shpParser'i enda
  // registrist lahutatud, PRIA teksti põhjal ära arvatud värvi. Sobitus
  // sama loogikaga, mis CropRegisterModal'is (nimi teksti seest/algusest).
  const resolveCropColor = (cropText: string | undefined, fallback?: string): string => {
    if (cropText) {
      const cropName = cropText.toLowerCase().trim();
      const match = crops.find((c) => {
        const name = c.name.toLowerCase();
        return name === cropName || cropName.includes(name) || name.startsWith(cropName);
      });
      if (match) return match.color;
    }
    return fallback || '#eab308';
  };

  // PRIA SHP import
  const handleFieldsImported = async (importedCollection: FieldCollection, replace: boolean, importOperatorId?: string, importYear: number = selectedYear) => {
    const existingMaxId = Math.max(0, ...masterFields.map((f) => Number(f.id) || 0));
    let nextId = existingMaxId + 1;

    const newMasterFields: MasterField[] = importedCollection.features.map((feature, idx) => {
      const p = feature.properties;
      const area = p.areaHa || 5.0;
      const num = p.num ? String(p.num) : String(idx + 1);
      const fieldCode = p.fieldCode ? String(p.fieldCode) : `61044${1000 + existingMaxId + idx + 1}`;

      // Kui see massiiv+põllunumber juba registris on, säilitame olemasoleva
      // põhiregistri (nimi, mullastik, kataster, märkused) — import ei tohi
      // neid PRIA faili üldiste/puuduvate väärtustega üle kirjutada, vaid
      // ainult värskendab geomeetriat ja valitud aasta kultuuri.
      // Operaatori valimisel on vasteks sama operaatori põld või operaatorita
      // põld; teise operaatori sama massiivi+numbriga põld on eraldi põld
      // (jagatud massiiv) ja seda ei puututa.
      const sameCodeNum = masterFields.filter((f) => f.fieldCode === fieldCode && (f.num || '') === num);
      const existing = importOperatorId
        ? sameCodeNum.find((f) => f.operatorId === importOperatorId) || sameCodeNum.find((f) => !f.operatorId)
        : sameCodeNum[0];

      const id = existing ? existing.id : nextId++;
      const name = existing?.name || p.name || `Põld ${num}`;
      const cadastralCode = existing?.cadastralCode || p.cadastralCode || undefined;
      const soilType = existing?.soilType || p.rawProperties?.soilType || undefined;
      // Drenaaži PRIA fail ei sisalda: uuel põllul jääb see määramata (varem vaikimisi true).
      const drainageSystem = existing ? existing.drainageSystem : (p.rawProperties?.drainageSystem ?? false);
      const notes = existing?.notes || p.notes || '';
      const operatorId = importOperatorId || existing?.operatorId;
      const otherYearsHistory = existing?.history.filter((h) => h.year !== importYear) || [];

      return {
        id,
        num,
        name,
        fieldCode,
        cadastralCode,
        soilType,
        drainageSystem,
        operatorId,
        notes,
        geometry: feature.geometry,
        history: [
          {
            year: importYear,
            areaHa: area,
            crop: p.crop || 'Määramata',
            // PRIA sulgudes täpsustus ("vähemalt 80% ristikut…") on osa kultuuri
            // nimest, mitte sort — sorti PRIA fail ei sisalda.
            cropVariety: existing?.history.find((h) => h.year === importYear)?.cropVariety,
            cropColor: resolveCropColor(p.crop, p.cropColor),
            targetYieldTonsHa: 7.5,
            workedAreaHa: p.workedAreaHa || 0,
            workProgress: p.workProgress || 0,
            status: p.status || 'not_started',
            notes: p.notes
          },
          ...otherYearsHistory
        ]
      };
    });

    // Serverisse saadame ainult imporditud (valitud) aasta kirje —
    // teisi aastaid backend ei puuduta, kuna upsert käib history massiivis
    // toodud aastate kaupa. Kohalikku kuvatavat seisu muudame alles pärast
    // kinnitust, et ebaõnnestunud/korduvad katsed ei jätaks duplikaate.
    const importedYearOnly = newMasterFields.map((f) => ({ ...f, history: f.history.slice(0, 1) }));
    try {
      await api.saveMasterFields(importedYearOnly);
    } catch (err) {
      console.error('Error saving imported fields to DB:', err);
      return;
    }

    // Uued põllud said kliendis ajutise ID, andmebaas annab oma ID — laeme
    // registri uuesti, et järgmised salvestused ei sihiks vale ID-ga rida.
    const freshFields = replace ? null : await api.getMasterFields().catch(() => null);

    if (replace) {
      setMasterFields(newMasterFields);
    } else if (freshFields) {
      setMasterFields(freshFields);
    } else {
      setMasterFields((prev) => {
        const byId = new Map(newMasterFields.map((f) => [String(f.id), f]));
        const merged = prev.map((f) => {
          const updated = byId.get(String(f.id));
          if (updated) {
            byId.delete(String(f.id));
            return updated;
          }
          return f;
        });
        return [...merged, ...byId.values()];
      });
    }

    setIsUploadOpen(false);
    setSelectedYear(importYear);

    if (importedCollection.features.length > 0) {
      const firstField = importedCollection.features[0];
      handleFocusField(firstField);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.2 }
      });
    }
  };

  // Mullaproovide SHP import
  const handleSoilSamplesImported = async (samples: SoilSample[]) => {
    try {
      await api.importSoilSamples(samples);
    } catch (err) {
      console.error('Error saving imported soil samples to DB:', err);
      return;
    }

    setSoilSamples((prev) => {
      const byKey = new Map(prev.map((s) => [s.sampleNumber, s]));
      samples.forEach((s) => byKey.set(s.sampleNumber, s));
      return Array.from(byKey.values());
    });

    setVisibility((prev) => ({ ...prev, soilSamples: true }));
    setIsSoilUploadOpen(false);
  };

  // Total area for map year selector
  const totalAreaHa = fields.features.reduce((sum, f) => sum + (f.properties.areaHa || 0), 0);

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header 
        parties={parties}
        operatorFilter={operatorFilter}
        onOperatorFilterChange={setOperatorFilter}
        mainView={mainView}
        onChangeMainView={changeMainView}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        dbConnected={dbConnected}
        currentUser={user}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenUsers={user.isAdmin ? () => setIsUsersAdminOpen(true) : undefined}
        onLogout={onLogout}
      />

      {mainView === 'seasons' && (
        <Suspense fallback={null}>
          <SeasonManagerModal
            isOpen={true}
            isFullPage={true}
            onClose={() => changeMainView('map')}
            seasons={seasons}
            masterFields={masterFields}
            selectedYear={selectedYear}
            onUpdateSeason={handleUpdateSeason}
            onCloseSeason={handleCloseSeason}
            onReopenSeason={handleReopenSeason}
            onCreateSeason={handleCreateSeason}
          />
        </Suspense>
      )}

      {mainView === 'fields' && (
        <Suspense fallback={null}>
          <FieldManagerModal
            isOpen={true}
            isFullPage={true}
            onClose={() => changeMainView('map')}
            masterFields={operatorMasterFields}
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            baseMap={visibility.baseMap}
            onUpdateField={handleUpdateMasterField}
            onDeleteField={handleDeleteMasterField}
            onOpenUpload={user.isAdmin ? () => setIsUploadOpen(true) : undefined}
            onOpenSoilUpload={user.isAdmin ? () => setIsSoilUploadOpen(true) : undefined}
            onOpenFieldBookUpload={user.isAdmin ? () => setIsFieldBookUploadOpen(true) : undefined}
            seasons={seasons}
            onOpenSeasonManager={() => changeMainView('seasons')}
            parties={parties}
            onOpenParties={() => setIsPartiesModalOpen(true)}
            crops={crops}
            onOpenCrops={() => setIsCropsModalOpen(true)}
          />
        </Suspense>
      )}

      {mainView === 'crops' && (
        <Suspense fallback={null}>
          <CropRegisterModal
            isOpen={true}
            isFullPage={true}
            onClose={() => changeMainView('map')}
            crops={crops}
            onSaveCrop={handleSaveCrop}
            onDeleteCrop={handleDeleteCrop}
            masterFields={operatorMasterFields}
            selectedYear={selectedYear}
            seasons={seasons}
            onSelectYear={setSelectedYear}
          />
        </Suspense>
      )}

      {mainView === 'works' && (
        <Suspense fallback={null}>
          <FieldWorksBoard
            year={selectedYear}
            onSelectYear={setSelectedYear}
            availableYears={availableYears}
            seasons={seasons}
            masterFields={operatorMasterFields}
            crops={crops}
            parties={parties}
            vehicles={rawVehicles.map((v) => ({ id: v.id, name: v.name }))}
            implementsList={implementsList.map((i) => ({ id: i.id, name: i.name }))}
            onOpenWorkRegister={() => setIsWorkRegisterOpen(true)}
            canManageFinance={user.isAdmin || user.isFinanceManager}
          />
        </Suspense>
      )}

      {mainView === 'fleet' && (
        <VehicleTracker
          isOpen={true}
          isFullPage={true}
          vehicles={rawVehicles}
          implementsList={implementsList}
          devices={devices}
          enrichedVehicles={vehicles}
          selectedVehicle={selectedVehicle}
          onSelectVehicle={setSelectedVehicle}
          onFocusVehicle={handleFocusVehicle}
          onAssignDevice={handleAssignDevice}
          onAssignImplement={handleAssignImplement}
          onAddVehicle={handleAddVehicle}
          onUpdateVehicle={handleUpdateVehicle}
          onDeleteVehicle={handleDeleteVehicle}
          onAddImplement={handleAddImplement}
          onUpdateImplement={handleUpdateImplement}
          onDeleteImplement={handleDeleteImplement}
          onAddDevice={handleAddDevice}
          onUpdateDevice={handleUpdateDevice}
          onDeleteDevice={handleDeleteDevice}
        />
      )}

      {mainView === 'infrastructure' && (
        <Suspense fallback={null}>
          <PoiManagerModal
            isOpen={true}
            isFullPage={true}
            onClose={() => changeMainView('map')}
            pois={pois}
            onAddPoi={handleAddPoi}
            onUpdatePoi={handleUpdatePoi}
            onDeletePoi={handleDeletePoi}
            onFocusPoi={(poi) => {
              handleFocusPoi(poi);
              changeMainView('map');
            }}
            onStartPickLocation={(draft) => {
              handleStartPickLocation(draft);
            }}
            initialDraft={poiDraft}
            initialCoords={newPoiCoords}
          />
        </Suspense>
      )}

      {mainView === 'parties' && (
        <Suspense fallback={null}>
          <RelatedPartiesModal
            isOpen={true}
            isFullPage={true}
            onClose={() => changeMainView('map')}
            parties={parties}
            onSaveParty={handleSaveParty}
            onDeleteParty={handleDeleteParty}
            masterFields={masterFields}
            vehicles={vehicles}
            selectedYear={selectedYear}
          />
        </Suspense>
      )}

      {/* Main Map View (peidetud, mitte eemaldatud, et kaardi seis säiliks) */}
      <div className="main-content" style={mainView !== 'map' ? { display: 'none' } : undefined}>
        {dbError && (
          <div className="db-error-banner alert-box error" role="alert">
            Andmebaasiga ei saa ühendust — andmeid ei kuvata. Värskenda lehte või proovi hiljem uuesti.
          </div>
        )}
        <MapView 
          visibility={visibility}
          fields={fields}
          selectedField={selectedField}
          onSelectField={handleSelectField}
          vehicles={vehicles}
          selectedVehicle={selectedVehicle}
          onSelectVehicle={setSelectedVehicle}
          cultivationPass={cultivationPass}
          vehicleTracks={visibleVehicleTracks}
          pois={pois}
          selectedPoi={selectedPoi}
          onSelectPoi={setSelectedPoi}
          isAddPoiMode={isAddPoiMode}
          onMapClickAddPoi={handleMapClickAddPoi}
          onCancelAddPoi={handleCancelPickLocation}
          focusedTarget={focusedTarget}
          fitBoundsTrigger={fitBoundsTrigger}
          selectedCropFilter={selectedCropFilter}
          vehicleFilter="all"
          soilSamples={soilSamples}
          soilMetric={soilMetric}
        />

        {/* Top-Left Stack: Season / Year Switcher (with integrated Crop Legend) and Field Details below it */}
        <div className="map-top-left-stack">
          <MapYearSelector 
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            availableYears={availableYears}
            fields={fields}
            totalAreaHa={totalAreaHa}
            selectedCropFilter={selectedCropFilter}
            onSelectCropFilter={setSelectedCropFilter}
            seasons={seasons}
          />

        </div>

        {/* Valitud põllu info keskmises aknas */}
        {selectedField && (
          <FieldDetailsDrawer
            field={selectedField}
            masterField={masterFields.find((f) => String(f.id) === String(selectedField.properties.id)) ?? null}
            seasons={seasons}
            soilSamples={soilSamples}
            onClose={handleCloseFieldDetails}
            onFocusField={handleFocusField}
          />
        )}

        {/* Floating Layer Controller (Top Right) */}
        <LayerControl 
          visibility={visibility}
          onToggleLayer={handleToggleLayer}
          onSelectBaseMap={handleSelectBaseMap}
          onFitAll={handleFitAll}
          soilSampleCount={soilSamples.length}
          soilFieldCount={new Set(soilSamples.map((s) => s.fieldCode)).size}
          soilMetric={soilMetric}
          onSelectSoilMetric={setSoilMetric}
          vehicles={vehicles}
          simulatedVehicleId={simulatedVehicleId}
          onToggleVehicleSimulator={handleToggleVehicleSimulator}
          trackVehicleIds={trackVehicleIds}
          isLoadingVehicleTracks={isLoadingVehicleTracks}
          hiddenTrackVehicleIds={hiddenTrackVehicleIds}
          onToggleTrackVisibility={handleToggleTrackVisibility}
        />

        {/* Bottom Floating Telemetry & Cultivation Scrubber Panel */}
        {visibility.cultivation && simulatedVehicleId && (
          <CultivationControl 
            pass={cultivationPass}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            progressPct={progressPct}
            onSeek={handleSeek}
            playbackSpeed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
            workingWidthM={workingWidthM}
            selectedStartTime={selectedStartTime}
            onStartTimeChange={handleStartTimeChange}
            telemetryHours={telemetryHours}
            onHoursChange={setTelemetryHours}
            loadedPointCount={simTrackPointCount}
            isLoading={isLoadingSimTrack}
            simTimeMode={simTimeMode}
            onSimTimeModeChange={setSimTimeMode}
            customDate={simCustomDate}
            onCustomDateChange={setSimCustomDate}
            customTime={simCustomTime}
            onCustomTimeChange={setSimCustomTime}
            durationHours={simDurationHours}
            onDurationHoursChange={setSimDurationHours}
            currentImplement={detectedImplement}
            lastActiveAt={activeSimVehicle?.lastActiveAt || trackedTarget?.device?.lastUpdate}
            onJumpToLastActive={handleJumpToLastActive}
          />
        )}
      </div>

      {/* Modals */}
      <DeferredMount when={isSeasonManagerOpen}>
        <SeasonManagerModal
          isOpen={isSeasonManagerOpen}
          onClose={() => setIsSeasonManagerOpen(false)}
          seasons={seasons}
          masterFields={masterFields}
          selectedYear={selectedYear}
          onUpdateSeason={handleUpdateSeason}
          onCloseSeason={handleCloseSeason}
          onReopenSeason={handleReopenSeason}
          onCreateSeason={handleCreateSeason}
        />
      </DeferredMount>

      <DeferredMount when={isFieldsRegisterOpen}>
        <FieldManagerModal
          isOpen={isFieldsRegisterOpen}
          onClose={() => setIsFieldsRegisterOpen(false)}
          masterFields={operatorMasterFields}
          selectedYear={selectedYear}
          onSelectYear={setSelectedYear}
          baseMap={visibility.baseMap}
          onUpdateField={handleUpdateMasterField}
          onDeleteField={handleDeleteMasterField}
          onOpenUpload={user.isAdmin ? () => setIsUploadOpen(true) : undefined}
          onOpenSoilUpload={user.isAdmin ? () => setIsSoilUploadOpen(true) : undefined}
          onOpenFieldBookUpload={user.isAdmin ? () => setIsFieldBookUploadOpen(true) : undefined}
          seasons={seasons}
          onOpenSeasonManager={() => {
            setIsFieldsRegisterOpen(false);
            changeMainView('seasons');
          }}
          parties={parties}
          onOpenParties={() => {
            setIsPartiesModalOpen(true);
          }}
          crops={crops}
          onOpenCrops={() => {
            // Register jääb avatuks (pooleli muudatused säilivad); kultuuride register avaneb peale.
            setIsCropsModalOpen(true);
          }}
        />
      </DeferredMount>

      <DeferredMount when={isUploadOpen}>
        <FieldUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onFieldsImported={handleFieldsImported}
          parties={parties}
          availableYears={availableYears}
          defaultYear={selectedYear}
        />
      </DeferredMount>

      <DeferredMount when={isSoilUploadOpen}>
        <SoilSampleUploadModal
          isOpen={isSoilUploadOpen}
          onClose={() => setIsSoilUploadOpen(false)}
          onSamplesImported={handleSoilSamplesImported}
        />
      </DeferredMount>

      <DeferredMount when={isFieldBookUploadOpen}>
        <FieldBookUploadModal
          isOpen={isFieldBookUploadOpen}
          onClose={() => setIsFieldBookUploadOpen(false)}
          onImported={() => {
            api.getMasterFields().then(setMasterFields).catch((err) => console.error('Põldude uuendamine ebaõnnestus:', err));
          }}
          masterFields={masterFields}
          parties={parties}
          seasons={seasons}
        />
      </DeferredMount>


      <DeferredMount when={isPoiModalOpen}>
        <PoiManagerModal
          isOpen={isPoiModalOpen}
          onClose={() => {
            setIsPoiModalOpen(false);
            setNewPoiCoords(null);
            setPoiDraft(null);
          }}
          pois={pois}
          onAddPoi={handleAddPoi}
          onUpdatePoi={handleUpdatePoi}
          onDeletePoi={handleDeletePoi}
          onFocusPoi={handleFocusPoi}
          onStartPickLocation={handleStartPickLocation}
          initialDraft={poiDraft}
          initialCoords={newPoiCoords}
        />
      </DeferredMount>

      <DeferredMount when={isAnalyticsOpen}>
        <AnalyticsModal
          isOpen={isAnalyticsOpen}
          onClose={() => setIsAnalyticsOpen(false)}
          fields={fields}
          vehicles={vehicles}
          cultivationPass={cultivationPass}
        />
      </DeferredMount>

      <DeferredMount when={isPartiesModalOpen}>
        <RelatedPartiesModal
          isOpen={isPartiesModalOpen}
          onClose={() => setIsPartiesModalOpen(false)}
          parties={parties}
          onSaveParty={handleSaveParty}
          onDeleteParty={handleDeleteParty}
          masterFields={masterFields}
          vehicles={vehicles}
          selectedYear={selectedYear}
          stacked={isFieldsRegisterOpen || mainView === 'fields'}
        />
      </DeferredMount>

      <DeferredMount when={isWorkRegisterOpen}>
        <WorkRegisterModal isOpen={isWorkRegisterOpen} onClose={() => setIsWorkRegisterOpen(false)} crops={crops} />
      </DeferredMount>

      <DeferredMount when={isCropsModalOpen}>
        <CropRegisterModal
          isOpen={isCropsModalOpen}
          onClose={() => setIsCropsModalOpen(false)}
          crops={crops}
          onSaveCrop={handleSaveCrop}
          onDeleteCrop={handleDeleteCrop}
          masterFields={operatorMasterFields}
          selectedYear={selectedYear}
          stacked={isFieldsRegisterOpen || mainView === 'fields'}
        />
      </DeferredMount>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      <DeferredMount when={isUsersAdminOpen}>
        <UsersAdminModal isOpen={isUsersAdminOpen} onClose={() => setIsUsersAdminOpen(false)} currentUserId={user.id} />
      </DeferredMount>
    </div>
  );
};
