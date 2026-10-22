import React, { useState, useEffect, useRef, useMemo, lazy, Suspense, startTransition } from 'react';
import confetti from 'canvas-confetti';
import { Header, MAIN_VIEWS, type MainView } from './components/Header';
import { MapView } from './components/MapView';
import { LayerControl } from './components/LayerControl';
import { CultivationControl } from './components/CultivationControl';
import { VehicleTracker } from './components/VehicleTracker';
import { MapYearSelector } from './components/MapYearSelector';
import { ChangePasswordModal } from './components/ChangePasswordModal';

import type { AuthUser } from './types/auth';
import type { LayerVisibility, BaseMapLayerId } from './types/map';
import type { SatelliteProductId } from './services/satelliteLayer';
import { BASE_MAPS } from './services/maaAmetLayers';
import type { FieldCollection, FieldFeature } from './types/field';
import type { MasterField, FieldYearlyRecord } from './types/fieldRegister';
import { generateFieldCollectionForYear, getFieldFeatureForYear } from './types/fieldRegister';
import type { Vehicle, Implement, TelemetryDevice, EnrichedVehicle } from './types/fleet';
import type { CultivationPass, TelemetryPoint } from './types/telemetry';
import type { PointOfInterest, PoiCategory } from './types/poi';
import type { FarmingSeason } from './types/season';
import type { RelatedParty } from './types/party';
import type { FieldWork, WorkEntry, WorkType, Material } from './types/fieldWork';
import type { Crop } from './types/crop';
import type { SoilSample, SoilSampleMetricKey } from './types/soilSample';

import { enrichVehicles } from './services/fleet';
import { hasModule } from './services/license';
import { TelemetrySimulator, buildCompletedPass } from './services/telemetrySimulator';
import { getBoundingBox } from './services/geometryEngine';
import { cleanTrack } from './services/trackCleaning';
import { api, setLicenseErrorHandler, isLicenseError } from './services/api';
import { LicenseBanner, SupportBanner } from './components/LicenseBanner';
import { parseEtDate } from './services/dateFormat';
import { DeferredMount } from './components/DeferredMount';
import { alertDialog } from './components/ConfirmDialog';
import { seasonSelectorYears, activeSeasonYear } from './types/season';

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
const FieldFullView = lazy(() => import('./components/FieldFullView').then((m) => ({ default: m.FieldFullView })));
const FieldWorkPlanDialog = lazy(() => import('./components/FieldWorkPlanDialog').then((m) => ({ default: m.FieldWorkPlanDialog })));
const FieldWorkEntryDialog = lazy(() => import('./components/FieldWorkEntryDialog').then((m) => ({ default: m.FieldWorkEntryDialog })));
const FieldEditDialog = lazy(() => import('./components/FieldEditDialog').then((m) => ({ default: m.FieldEditDialog })));
const FieldsTableView = lazy(() => import('./components/FieldsTableView').then((m) => ({ default: m.FieldsTableView })));
const FieldManagerModal = lazy(() => import('./components/FieldManagerModal').then((m) => ({ default: m.FieldManagerModal })));
const FieldUploadModal = lazy(() => import('./components/FieldUploadModal').then((m) => ({ default: m.FieldUploadModal })));
const SoilSampleUploadModal = lazy(() => import('./components/SoilSampleUploadModal').then((m) => ({ default: m.SoilSampleUploadModal })));
const FieldBookUploadModal = lazy(() => import('./components/FieldBookUploadModal').then((m) => ({ default: m.FieldBookUploadModal })));
const PoiManagerModal = lazy(() => import('./components/PoiManagerModal').then((m) => ({ default: m.PoiManagerModal })));
const SeasonManagerModal = lazy(() => import('./components/SeasonManagerModal').then((m) => ({ default: m.SeasonManagerModal })));
const RelatedPartiesModal = lazy(() => import('./components/RelatedPartiesModal').then((m) => ({ default: m.RelatedPartiesModal })));
const WorkRegisterModal = lazy(() => import('./components/WorkRegisterModal').then((m) => ({ default: m.WorkRegisterModal })));
const MaterialsView = lazy(() => import('./components/MaterialsView').then((m) => ({ default: m.MaterialsView })));
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
  // brauseri mälust taastatakse aluskaardi valik ning põllu- ja massiivinumbrite valik.
  const DEFAULT_VISIBILITY: LayerVisibility = {
    baseMap: 'maaamet-pohikaart',
    cadastre: false,
    fields: true,
    vehicles: false,
    cultivation: false,
    poi: false,
    fieldLabels: false,
    blockLabels: false,
    swathTrails: true,
    soilSamples: false,
    weatherRadar: false,
    satellite: false
  };
  const [rawVisibility, setVisibility] = useState<LayerVisibility>(() => {
    const saved = localStorage.getItem('agrimap_visibility');
    if (!saved) return DEFAULT_VISIBILITY;
    try {
      const parsed = JSON.parse(saved) as Partial<LayerVisibility>;
      const savedBaseMap = parsed.baseMap;
      return {
        ...DEFAULT_VISIBILITY,
        // Varem salvestatud, nüüdseks eemaldatud aluskaart (hübriid, hallkaart, OSM) → põhikaart.
        baseMap: savedBaseMap && savedBaseMap in BASE_MAPS ? savedBaseMap : DEFAULT_VISIBILITY.baseMap,
        fieldLabels: parsed.fieldLabels === true,
        blockLabels: parsed.blockLabels === true
      };
    } catch {
      return DEFAULT_VISIBILITY;
    }
  });

  // Asukoha valimisel kaardilt on näha ainult kiht „Muud asukohad“; eelmine kihtide valik
  // hoitakse siin ja taastatakse, kui valik on tehtud või katkestatud.
  const visibilityBeforePickRef = useRef<LayerVisibility | null>(null);

  useEffect(() => {
    if (visibilityBeforePickRef.current) return; // ajutist valikut ei salvestata
    localStorage.setItem('agrimap_visibility', JSON.stringify(rawVisibility));
  }, [rawVisibility]);

  // Litsentsita moodulite kihid on kaardil ja mujal alati väljas (kasutaja valik jääb salvestatud kujul alles)
  const modules = useMemo(() => ({
    telemetry: hasModule(user, 'TELEMETRY'),
    satellite: hasModule(user, 'SATELLITE'),
    weather: hasModule(user, 'WEATHER')
  }), [user]);
  const visibility = useMemo<LayerVisibility>(() => ({
    ...rawVisibility,
    vehicles: rawVisibility.vehicles && modules.telemetry,
    cultivation: rawVisibility.cultivation && modules.telemetry,
    satellite: rawVisibility.satellite && modules.satellite,
    weatherRadar: rawVisibility.weatherRadar && modules.weather
  }), [rawVisibility, modules]);

  // Masinapargi kuvamise filter: 'active' (ainult töötavad < 5 min) või 'all' (kõik masinad)

  // Active Farming Season / Year
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // 0. Hooaegade register (elutsükkel: ettevalmistus, külv, koristus, suletud/lukus)
  const [seasons, setSeasons] = useState<FarmingSeason[]>([]);

  const [isSeasonManagerOpen, setIsSeasonManagerOpen] = useState(false);

  // 1. Põldude ja külvikorra master-register (andmebaasist)
  const [masterFields, setMasterFields] = useState<MasterField[]>([]);

  // Hooaja valik: vaikimisi hooaeg −4 … +3, ainult hooaegade tabelis olevad aastad
  const availableYears = React.useMemo(() => seasonSelectorYears(seasons), [seasons]);

  // Serveri litsentsikeeld: üks teade korraga, mitte iga päringu kohta
  const licenseAlertOpenRef = useRef(false);
  useEffect(() => {
    setLicenseErrorHandler((message) => {
      if (licenseAlertOpenRef.current) return;
      licenseAlertOpenRef.current = true;
      alertDialog(message).finally(() => { licenseAlertOpenRef.current = false; });
    });
    return () => setLicenseErrorHandler(null);
  }, []);

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

  // 3. Telemeetriaseadmete register
  const [devices, setDevices] = useState<TelemetryDevice[]>([]);

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
  // Satelliidipilt (Satiladu): toode ja kuupäev; kuupäeva järgi arvutatakse ka põllu aknas NDVI
  const [satelliteProduct, setSatelliteProduct] = useState<SatelliteProductId>('rgb');
  const [satelliteDate, setSatelliteDate] = useState<string | null>(null);
  const [satellitePanelHost, setSatellitePanelHost] = useState<HTMLDivElement | null>(null);

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
          if (dbSeasons && dbSeasons.length > 0) {
            setSeasons(dbSeasons);
            setSelectedYear(activeSeasonYear(dbSeasons));
          }
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

  // Kustutamine kinnitatakse serveris (looja või admin); ekraanilt eemaldatakse alles pärast õnnestumist
  const deleteOnServer = async (request: () => Promise<unknown>, onDeleted: () => void) => {
    try {
      await request();
      onDeleted();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Kustutamine ebaõnnestus');
    }
  };

  const handleDeleteParty = (partyId: string) =>
    deleteOnServer(() => api.deleteParty(partyId), () => setParties((prev) => prev.filter((p) => p.id !== partyId)));

  // Crops & Varieties Register state
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isCropsModalOpen, setIsCropsModalOpen] = useState(false);
  const [isWorkRegisterOpen, setIsWorkRegisterOpen] = useState(false);

  // Põhivaade (ülamenüü valik): jäetakse meelde kasutaja kaupa (selles brauseris), et lehe
  // värskendamine avaks sama vaate. Logo klõps lähtestab valiku kaardile.
  const mainViewKey = `agrimap_main_view_${user.id}`;
  const [mainView, setMainView] = useState<MainView>(() => {
    try {
      const saved = localStorage.getItem(mainViewKey);
      return saved && (MAIN_VIEWS as readonly string[]).includes(saved) ? (saved as MainView) : 'map';
    } catch {
      return 'map';
    }
  });
  const changeMainView = (view: MainView) => {
    setMainView(view);
    try {
      localStorage.setItem(mainViewKey, view);
    } catch {
      // brauseri salvestus pole saadaval — valik kehtib ainult selle seansi ajal
    }
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

  const handleDeleteCrop = (cropId: string) =>
    deleteOnServer(() => api.deleteCrop(cropId), () => setCrops((prev) => prev.filter((c) => c.id !== cropId)));

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
  // Uus simulaator (nt raja uuesti laadimisel) võtab üle kasutaja valitud kiiruse
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const [progressPct, setProgressPct] = useState(75);
  const [workingWidthM, setWorkingWidthM] = useState(12);
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [telemetryHours, setTelemetryHours] = useState<number>(2);
  const [simTimeMode, setSimTimeMode] = useState<'rolling' | 'custom'>('rolling');
  // Suurendamisel loetakse taasesituse rada uuesti ("Viimased tunnid" aken lõpeb siis uuesti praegusel hetkel)
  const [simReloadKey, setSimReloadKey] = useState(0);
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
      sim.setPlaybackSpeed(playbackSpeedRef.current);

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
    workingWidthM,
    simReloadKey
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
    // Masinapargi sisselülitamisel loetakse seadmete viimased asukohad serverist uuesti
    if (key === 'vehicles' && !visibility.vehicles) {
      api.getFleet().then((fleet) => {
        if (fleet?.devices?.length) setDevices(fleet.devices);
      }).catch((err) => console.error('Error refreshing vehicle positions:', err));
    }
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
    if (simTimeMode === 'rolling') {
      setIsPlaying(false);
      setSimReloadKey((k) => k + 1);
      return;
    }
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

  // Põllu infoaken põldude registrist (registri valitud hooaja andmetega)
  const [registerDetailFieldId, setRegisterDetailFieldId] = useState<number | string | null>(null);
  const registerDetailMasterField = React.useMemo(
    () => (registerDetailFieldId === null ? null : masterFields.find((f) => String(f.id) === String(registerDetailFieldId)) ?? null),
    [masterFields, registerDetailFieldId]
  );
  const handleCloseRegisterFieldDetails = React.useCallback(() => setRegisterDetailFieldId(null), []);
  // Täisvaatest avatud põllu muutmise dialoog (Esc sulgeb ainult dialoogi, vt FieldEditDialog)
  const [editFieldId, setEditFieldId] = useState<number | null>(null);
  const editFieldMaster = React.useMemo(
    () => (editFieldId === null ? null : masterFields.find((f) => String(f.id) === String(editFieldId)) ?? null),
    [masterFields, editFieldId]
  );
  const closeEditField = React.useCallback(() => setEditFieldId(null), []);
  // Täisvaatest avatud töö (plaani) ja kande dialoogid; salvestamisel laeb täisvaade tööd uuesti
  const [planDialog, setPlanDialog] = useState<{ fieldSeasonId: number; fieldLabel: string; fieldAreaHa: number; work: FieldWork | null } | null>(null);
  const [entryDialog, setEntryDialog] = useState<{ fieldLabel: string; fieldAreaHa: number; work: FieldWork; entry: WorkEntry | null } | null>(null);
  const [fullViewReloadKey, setFullViewReloadKey] = useState(0);
  const [workRefs, setWorkRefs] = useState<{ workTypes: WorkType[]; materials: Material[] } | null>(null);
  const workRefsLoading = useRef(false);
  const ensureWorkRefs = React.useCallback(() => {
    if (workRefs || workRefsLoading.current) return;
    workRefsLoading.current = true;
    Promise.all([api.getWorkTypes(), api.getMaterials()])
      .then(([workTypes, materials]) => setWorkRefs({ workTypes, materials }))
      .catch((err) => {
        console.error('Tööliikide/kulumaterjalide laadimine ebaõnnestus:', err);
        setPlanDialog(null);
        setEntryDialog(null);
      })
      .finally(() => { workRefsLoading.current = false; });
  }, [workRefs]);
  const openPlanDialog = React.useCallback((ctx: NonNullable<typeof planDialog>) => { ensureWorkRefs(); setPlanDialog(ctx); }, [ensureWorkRefs]);
  const openEntryDialog = React.useCallback((ctx: NonNullable<typeof entryDialog>) => { ensureWorkRefs(); setEntryDialog(ctx); }, [ensureWorkRefs]);
  const closePlanDialog = React.useCallback(() => setPlanDialog(null), []);
  const closeEntryDialog = React.useCallback(() => setEntryDialog(null), []);
  const workDialogWorkers = React.useMemo(
    () => parties.filter((p) => p.roles.includes('DRIVER')).map((p) => ({ id: p.id, name: p.name })),
    [parties]
  );
  const handleFocusFieldFromRegister = (field: FieldFeature) => {
    setIsFieldsRegisterOpen(false);
    changeMainView('map');
    setSelectedFieldId(null);
    // kaart peab enne fookustamist nähtavaks saama (Leaflet arvutab suuruse uuesti)
    setTimeout(() => handleFocusField(field), 50);
  };

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

  // Haakimise ja seadmete seoste registrid on seoste ainus tõeallikas: pärast registri otsest
  // muutmist loetakse masinate, haakeriistade ja seadmete seosed serverist uuesti.
  const refreshLinks = () => {
    api.getFleet().then((fleet) => {
      if (!fleet) return;
      const vehById = new Map(fleet.vehicles?.map((v) => [v.id, v]));
      const impById = new Map(fleet.implements?.map((i) => [i.id, i]));
      const devById = new Map(fleet.devices?.map((d) => [d.id, d]));
      setRawVehicles((prev) => prev.map((v) => ({
        ...v,
        assignedImplementId: vehById.get(v.id)?.assignedImplementId,
        assignedDeviceId: vehById.get(v.id)?.assignedDeviceId
      })));
      setImplementsList((prev) => prev.map((i) => ({
        ...i,
        assignedVehicleId: impById.get(i.id)?.assignedVehicleId,
        assignedDeviceId: impById.get(i.id)?.assignedDeviceId
      })));
      setDevices((prev) => prev.map((d) => ({
        ...d,
        assignedVehicleId: devById.get(d.id)?.assignedVehicleId,
        assignedImplementId: devById.get(d.id)?.assignedImplementId
      })));
    }).catch((err) => console.error('Error refreshing links:', err));
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
    api.saveVehicle(v).catch((err) => console.error('Error saving vehicle to DB:', err));
  };

  const handleUpdateVehicle = (id: string, updates: Omit<Vehicle, 'id'>) => {
    setRawVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));

    api.saveVehicle({ ...updates, id }).catch((err) => console.error('Error updating vehicle in DB:', err));
  };

  const handleDeleteVehicle = (id: string) =>
    deleteOnServer(() => api.deleteVehicle(id), () => {
      setRawVehicles((prev) => prev.filter((v) => v.id !== id));
      setDevices((prev) => prev.map((d) => d.assignedVehicleId === id ? { ...d, assignedVehicleId: undefined } : d));
      setImplementsList((prev) => prev.map((i) => i.assignedVehicleId === id ? { ...i, assignedVehicleId: undefined } : i));
      setSelectedVehicle((cur) => (cur && cur.id === id ? null : cur));
    });

  const handleAddImplement = (newImp: Omit<Implement, 'id'>) => {
    const imp: Implement = { ...newImp, id: `imp-${Date.now()}` };
    setImplementsList((prev) => [...prev, imp]);
    api.saveImplement(imp).catch((err) => console.error('Error saving implement to DB:', err));
  };

  const handleUpdateImplement = (id: string, updates: Omit<Implement, 'id'>) => {
    setImplementsList((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    api.saveImplement({ ...updates, id }).catch((err) => console.error('Error updating implement in DB:', err));
  };

  const handleDeleteImplement = (id: string) =>
    deleteOnServer(() => api.deleteImplement(id), () => {
      setImplementsList((prev) => prev.filter((i) => i.id !== id));
      setRawVehicles((prev) => prev.map((v) => v.assignedImplementId === id ? { ...v, assignedImplementId: undefined } : v));
      setDevices((prev) => prev.map((d) => d.assignedImplementId === id ? { ...d, assignedImplementId: undefined } : d));
    });

  // Seade salvestatakse enne serveris; viga (IMEI/MAC 400, hõivatud seade 409) näidatakse kasutajale ja vorm jääb avatuks.
  const handleAddDevice = async (newDev: Omit<TelemetryDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>): Promise<boolean> => {
    const dev: TelemetryDevice = {
      ...newDev,
      id: `tel-${Date.now()}`,
      position: [58.1402, 25.8030],
      heading: 0,
      speedKmH: 0,
      status: 'offline',
      lastUpdate: new Date().toISOString()
    };
    try {
      await api.saveDevice(dev);
    } catch (err) {
      if (!isLicenseError(err)) alertDialog(err instanceof Error ? err.message : 'Seadme salvestamine ebaõnnestus');
      return false;
    }
    setDevices((prev) => [...prev, dev]);
    return true;
  };

  const handleUpdateDevice = async (id: string, updates: Omit<TelemetryDevice, 'id' | 'position' | 'heading' | 'speedKmH' | 'status' | 'lastUpdate'>): Promise<boolean> => {
    const current = devices.find((d) => d.id === id);
    if (current) {
      try {
        await api.saveDevice({ ...current, ...updates });
      } catch (err) {
        if (!isLicenseError(err)) alertDialog(err instanceof Error ? err.message : 'Seadme salvestamine ebaõnnestus');
        return false;
      }
    }
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    return true;
  };

  const handleDeleteDevice = (id: string) =>
    deleteOnServer(() => api.deleteDevice(id), () => {
      setDevices((prev) => prev.filter((d) => d.id !== id));
      setRawVehicles((prev) => prev.map((v) => v.assignedDeviceId === id ? { ...v, assignedDeviceId: undefined } : v));
      setImplementsList((prev) => prev.map((i) => i.assignedDeviceId === id ? { ...i, assignedDeviceId: undefined } : i));
    });

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
      alertDialog(`Asukoha "${newPoi.name}" salvestamine ebaõnnestus. Muudatus kaob lehe värskendamisel.`);
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
      alertDialog('Asukoha muudatuste salvestamine ebaõnnestus. Muudatus kaob lehe värskendamisel.');
    });
  };

  const handleDeletePoi = (id: string) =>
    deleteOnServer(() => api.deletePoi(id), () => {
      setPois((prev) => prev.filter((p) => p.id !== id));
      setSelectedPoi((cur) => (cur && cur.id === id ? null : cur));
    });

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
    // Taristu leht katab kaardi: asukoha valimiseks tuleb kaart nähtavaks teha.
    changeMainView('map');
    if (!visibilityBeforePickRef.current) {
      visibilityBeforePickRef.current = rawVisibility;
      setVisibility((prev) => ({
        ...prev,
        cadastre: false,
        fields: false,
        vehicles: false,
        cultivation: false,
        fieldLabels: false,
        blockLabels: false,
        swathTrails: false,
        soilSamples: false,
        weatherRadar: false,
        satellite: false,
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

  const handleDeleteMasterField = (fieldId: number | string) =>
    deleteOnServer(() => api.deleteMasterField(fieldId), () => {
      setMasterFields((prev) => prev.filter((f) => f.id !== fieldId && String(f.id) !== String(fieldId)));
      setSelectedFieldId((cur) => (cur === String(fieldId) ? null : cur));
    });

  // Season Management Handlers
  // Import võib luua puuduva hooaja; sulgemise aja ja sulgeja paneb server — laeme hooajad uuesti.
  const refreshSeasons = () =>
    api.getSeasons().then(setSeasons).catch((err) => console.error('Hooaegade laadimine ebaõnnestus:', err));

  const saveSeasonAndRefresh = (season: FarmingSeason) => {
    setSeasons((prev) => prev.map((s) => (s.year === season.year ? season : s)));
    api
      .saveSeason(season)
      .then(refreshSeasons)
      .catch((err) => console.error('Hooaja salvestamine ebaõnnestus:', err));
  };

  const handleUpdateSeason = (updated: FarmingSeason) => saveSeasonAndRefresh(updated);

  const handleCloseSeason = (year: number) => {
    const s = seasons.find((x) => x.year === year);
    if (s) saveSeasonAndRefresh({ ...s, isLocked: true });
  };

  const handleReopenSeason = (year: number) => {
    const s = seasons.find((x) => x.year === year);
    if (s) saveSeasonAndRefresh({ ...s, isLocked: false, closedAt: null, closedBy: null });
  };

  const handleCreateSeason = (newSeason: FarmingSeason) => {
    setSeasons((prev) => {
      const filtered = prev.filter((s) => s.year !== newSeason.year);
      return [newSeason, ...filtered].sort((a, b) => b.year - a.year);
    });
    handleAddNewSeasonToAll(newSeason.year);
    api.saveSeason(newSeason).then(refreshSeasons).catch((err) => console.error('Error creating season in DB:', err));
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

    void refreshSeasons();
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

    void refreshSeasons();
    setVisibility((prev) => ({ ...prev, soilSamples: true }));
    setIsSoilUploadOpen(false);
  };

  // Total area for map year selector
  const totalAreaHa = fields.features.reduce((sum, f) => sum + (f.properties.areaHa || 0), 0);

  return (
    <div className="app-container">
      <SupportBanner user={user} onLogout={onLogout} />
      <LicenseBanner user={user} />
      {/* Top Header */}
      <Header 
        parties={parties}
        operatorFilter={operatorFilter}
        onOperatorFilterChange={setOperatorFilter}
        mainView={mainView}
        onChangeMainView={changeMainView}
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
          <FieldsTableView
            masterFields={operatorMasterFields}
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            seasons={seasons}
            onOpenFieldDetails={setRegisterDetailFieldId}
            onUpdateField={handleUpdateMasterField}
            onDeleteField={handleDeleteMasterField}
            onOpenUpload={user.isAdmin ? () => setIsUploadOpen(true) : undefined}
            onOpenSoilUpload={user.isAdmin ? () => setIsSoilUploadOpen(true) : undefined}
            onOpenFieldBookUpload={user.isAdmin ? () => setIsFieldBookUploadOpen(true) : undefined}
            parties={parties}
            onOpenParties={() => setIsPartiesModalOpen(true)}
            crops={crops}
            onOpenCrops={() => setIsCropsModalOpen(true)}
          />
        </Suspense>
      )}

      {mainView === 'rotation' && (
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
            seasons={seasons}
            onOpenSeasonManager={() => changeMainView('seasons')}
            crops={crops}
            onOpenFieldDetails={setRegisterDetailFieldId}
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
            telemetryEnabled={modules.telemetry}
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
          onRegisterChanged={refreshLinks}
          onAddVehicle={handleAddVehicle}
          onUpdateVehicle={handleUpdateVehicle}
          onDeleteVehicle={handleDeleteVehicle}
          onAddImplement={handleAddImplement}
          onUpdateImplement={handleUpdateImplement}
          onDeleteImplement={handleDeleteImplement}
          onAddDevice={handleAddDevice}
          onUpdateDevice={handleUpdateDevice}
          onDeleteDevice={handleDeleteDevice}
          telemetryEnabled={modules.telemetry}
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

      {mainView === 'materials' && (
        <Suspense fallback={null}>
          <MaterialsView />
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
          satelliteProduct={satelliteProduct}
          onSelectSatelliteProduct={setSatelliteProduct}
          satelliteDate={satelliteDate}
          onSelectSatelliteDate={setSatelliteDate}
          satellitePanelHost={satellitePanelHost}
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
          <Suspense fallback={null}>
            <FieldFullView
              field={selectedField}
              masterField={masterFields.find((f) => String(f.id) === String(selectedField.properties.id)) ?? null}
              seasons={seasons}
              soilSamples={soilSamples}
              satelliteDate={visibility.satellite ? satelliteDate : null}
              canEdit={true}
              reloadKey={fullViewReloadKey}
              onClose={handleCloseFieldDetails}
              onFocusField={handleFocusField}
              onEditField={setEditFieldId}
              onEditWork={openPlanDialog}
              onEditEntry={openEntryDialog}
            />
          </Suspense>
        )}

        {/* Paremal üleval: kaardikihid ja nende all satelliidipildi paneel (MapView portaal) */}
        <div className="map-top-right-stack">
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
            modules={modules}
          />
          <div ref={setSatellitePanelHost} />
        </div>

        {/* Bottom Floating Telemetry & Cultivation Scrubber Panel */}
        {modules.telemetry && visibility.cultivation && simulatedVehicleId && (
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
          seasons={seasons}
          onOpenSeasonManager={() => {
            setIsFieldsRegisterOpen(false);
            changeMainView('seasons');
          }}
          crops={crops}
          onOpenFieldDetails={setRegisterDetailFieldId}
        />
      </DeferredMount>

      {/* Põllu infoaken registrist (registri peal) */}
      {registerDetailMasterField && (
        <Suspense fallback={null}>
          <FieldFullView
            field={getFieldFeatureForYear(registerDetailMasterField, selectedYear)}
            masterField={registerDetailMasterField}
            seasons={seasons}
            soilSamples={soilSamples}
            canEdit={true}
            reloadKey={fullViewReloadKey}
            elevated={isFieldsRegisterOpen}
            onClose={handleCloseRegisterFieldDetails}
            onFocusField={handleFocusFieldFromRegister}
            onEditField={setEditFieldId}
            onEditWork={openPlanDialog}
            onEditEntry={openEntryDialog}
          />
        </Suspense>
      )}

      {/* Põllu muutmine täisvaatest ("Muuda põldu") */}
      {editFieldMaster && (
        <Suspense fallback={null}>
          <FieldEditDialog
            field={editFieldMaster}
            selectedYear={selectedYear}
            seasons={seasons}
            parties={parties}
            onOpenParties={() => setIsPartiesModalOpen(true)}
            crops={crops}
            onOpenCrops={() => setIsCropsModalOpen(true)}
            onUpdateField={handleUpdateMasterField}
            onClose={closeEditField}
          />
        </Suspense>
      )}

      {/* Töö (plaani) lisamine/muutmine täisvaatest */}
      {planDialog && workRefs && (
        <Suspense fallback={null}>
          <FieldWorkPlanDialog
            fieldSeasonId={planDialog.fieldSeasonId}
            fieldLabel={planDialog.fieldLabel}
            fieldAreaHa={planDialog.fieldAreaHa}
            work={planDialog.work}
            workTypes={workRefs.workTypes}
            materials={workRefs.materials}
            workers={workDialogWorkers}
            onClose={closePlanDialog}
            onSaved={() => {
              setPlanDialog(null);
              setFullViewReloadKey((k) => k + 1);
            }}
          />
        </Suspense>
      )}

      {/* Kande lisamine/muutmine täisvaatest */}
      {entryDialog && workRefs && (
        <Suspense fallback={null}>
          <FieldWorkEntryDialog
            work={entryDialog.work}
            entry={entryDialog.entry}
            fieldLabel={entryDialog.fieldLabel}
            fieldAreaHa={entryDialog.fieldAreaHa}
            workers={workDialogWorkers}
            vehicles={rawVehicles.map((v) => ({ id: v.id, name: v.name }))}
            implementsList={implementsList.map((i) => ({ id: i.id, name: i.name }))}
            materials={workRefs.materials}
            telemetryEnabled={modules.telemetry}
            onClose={closeEntryDialog}
            onSaved={() => {
              setEntryDialog(null);
              setFullViewReloadKey((k) => k + 1);
            }}
          />
        </Suspense>
      )}

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
            void refreshSeasons();
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
        <UsersAdminModal isOpen={isUsersAdminOpen} onClose={() => setIsUsersAdminOpen(false)} currentUserId={user.id} readOnly={!!user.supportView} />
      </DeferredMount>
    </div>
  );
};
