// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { LayerControl } from './components/LayerControl';
import { CultivationControl } from './components/CultivationControl';
import { FieldDetailsDrawer } from './components/FieldDetailsDrawer';
import { FieldManagerModal } from './components/FieldManagerModal';
import { FieldUploadModal } from './components/FieldUploadModal';
import { VehicleTracker } from './components/VehicleTracker';
import { PoiManagerModal } from './components/PoiManagerModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { MapYearSelector } from './components/MapYearSelector';
import { SeasonManagerModal } from './components/SeasonManagerModal';
import { RelatedPartiesModal } from './components/RelatedPartiesModal';
import { CropRegisterModal } from './components/CropRegisterModal';

import type { LayerVisibility, BaseMapLayerId, VehicleDisplayFilter } from './types/map';
import type { FieldCollection, FieldFeature } from './types/field';
import type { MasterField, FieldYearlyRecord } from './types/fieldRegister';
import { generateFieldCollectionForYear, getFieldFeatureForYear } from './types/fieldRegister';
import type { Vehicle, Implement, TeltonikaDevice, EnrichedVehicle } from './types/fleet';
import type { CultivationPass } from './types/telemetry';
import type { PointOfInterest, PoiCategory } from './types/poi';
import type { FarmingSeason } from './types/season';
import type { RelatedParty } from './types/party';
import type { Crop } from './types/crop';

import { INITIAL_MASTER_FIELDS } from './data/sampleFieldRegister';
import { INITIAL_SEASONS } from './data/sampleSeasons';
import { 
  INITIAL_VEHICLES, 
  INITIAL_IMPLEMENTS, 
  INITIAL_TELTONIKA_DEVICES, 
  enrichVehicles 
} from './data/sampleFleet';
import { INITIAL_CULTIVATION_PASS } from './data/sampleTelemetry';
import { SAMPLE_POI_LIST } from './data/samplePoi';
import { INITIAL_PARTIES } from './data/sampleParties';
import { INITIAL_CROPS } from './data/sampleCrops';
import { TelemetrySimulator } from './services/telemetrySimulator';
import { calculateFieldWorkProgress, getBoundingBox } from './services/geometryEngine';
import { isVehicleRecentlyActive } from './components/MapMarkers';

export const App: React.FC = () => {
  // Layer visibility state - default shows fields, active working machinery (< 5 min), and cultivation
  const [visibility, setVisibility] = useState<LayerVisibility>({
    baseMap: 'maaamet-pohikaart',
    cadastre: false,
    fields: true,
    vehicles: true, // Vaikimisi aktiivne: näitab masinaid, mis parasjagu töötavad / liiguvad (< 5 min)
    cultivation: true,
    poi: false,
    fieldLabels: false,
    swathTrails: true
  });

  // Masinapargi kuvamise filter: 'active' (ainult töötavad < 5 min) või 'all' (kõik masinad)
  const [vehicleFilter, setVehicleFilter] = useState<VehicleDisplayFilter>('active');

  // Active Farming Season / Year
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // 0. Hooaegade register (elutsükkel: ettevalmistus, külv, koristus, suletud/lukus)
  const [seasons, setSeasons] = useState<FarmingSeason[]>(() => {
    const saved = localStorage.getItem('agrimap_seasons');
    let loaded: FarmingSeason[] = saved ? JSON.parse(saved) : INITIAL_SEASONS;

    // Dynamically ensure all seasons exist from activeYear + 3 down to activeYear - 3
    const activeYear = loaded.find((s) => s.status === 'active')?.year || 2026;
    const existingYears = new Set(loaded.map((s) => s.year));
    for (let y = activeYear + 3; y >= activeYear - 3; y--) {
      if (!existingYears.has(y)) {
        loaded.push({
          id: `season-${y}`,
          year: y,
          name: `Hooaeg ${y}`,
          status: y < activeYear ? 'closed' : y === activeYear ? 'active' : 'planning',
          isLocked: y < activeYear,
          totalAreaHa: 298.5,
          fieldsCount: 32,
          notes: y > activeYear ? `${y}. a külvikorra eelplaneerimine` : `${y}. a arhiveeritud hooaeg`
        } as FarmingSeason);
      }
    }
    return loaded.sort((a, b) => b.year - a.year);
  });

  const [isSeasonManagerOpen, setIsSeasonManagerOpen] = useState(false);

  // Active Season metadata
  const activeSeason = React.useMemo(() => {
    return seasons.find((s) => s.year === selectedYear) || {
      id: `season-${selectedYear}`,
      year: selectedYear,
      name: `Hooaeg ${selectedYear}`,
      status: selectedYear < 2026 ? 'closed' : 'active',
      isLocked: selectedYear < 2026
    } as FarmingSeason;
  }, [seasons, selectedYear]);

  // Persist seasons to localStorage
  useEffect(() => {
    localStorage.setItem('agrimap_seasons', JSON.stringify(seasons));
  }, [seasons]);

  // 1. Põldude ja külvikorra master-register (kasutab alati otse ts failide sisu)
  const [masterFields, setMasterFields] = useState<MasterField[]>(INITIAL_MASTER_FIELDS);

  // Dynamic available years list: activeYear + 3 to activeYear - 3
  const availableYears = React.useMemo(() => {
    const activeYear = seasons.find((s) => s.status === 'active')?.year || 2026;
    const yearSet = new Set<number>();
    for (let y = activeYear + 3; y >= activeYear - 3; y--) {
      yearSet.add(y);
    }
    seasons.forEach((s) => yearSet.add(s.year));
    masterFields.forEach((mf) => {
      mf.history.forEach((h) => yearSet.add(h.year));
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [seasons, masterFields]);

  // Derive FieldCollection for the active year (with that year's specific area and crop)
  const fields: FieldCollection = React.useMemo(() => {
    return generateFieldCollectionForYear(masterFields, selectedYear);
  }, [masterFields, selectedYear]);

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedCropFilter, setSelectedCropFilter] = useState<string | null>(null);

  // Derive active selectedField dynamically for the active year
  const selectedField = React.useMemo(() => {
    if (!selectedFieldId) return null;
    return fields.features.find((f) => String(f.properties.id) === selectedFieldId || String(f.id) === selectedFieldId) || null;
  }, [fields, selectedFieldId]);

  // Save master fields to localStorage
  useEffect(() => {
    localStorage.setItem('agrimap_master_fields', JSON.stringify(masterFields));
  }, [masterFields]);
  
  // 1. Sõidukite register
  const [rawVehicles, setRawVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('agrimap_vehicles');
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  // 2. Haakeriistade register
  const [implementsList, setImplementsList] = useState<Implement[]>(() => {
    const saved = localStorage.getItem('agrimap_implements');
    return saved ? JSON.parse(saved) : INITIAL_IMPLEMENTS;
  });

  // 3. Teltonika GPS seadmete register
  const [devices, setDevices] = useState<TeltonikaDevice[]>(() => {
    const saved = localStorage.getItem('agrimap_devices');
    return saved ? JSON.parse(saved) : INITIAL_TELTONIKA_DEVICES;
  });

  // Liitandmetega sõidukid kaardile ja vaadetesse
  const vehicles: EnrichedVehicle[] = enrichVehicles(rawVehicles, implementsList, devices);
  const [selectedVehicle, setSelectedVehicle] = useState<EnrichedVehicle | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('agrimap_vehicles', JSON.stringify(rawVehicles));
  }, [rawVehicles]);

  useEffect(() => {
    localStorage.setItem('agrimap_implements', JSON.stringify(implementsList));
  }, [implementsList]);

  useEffect(() => {
    localStorage.setItem('agrimap_devices', JSON.stringify(devices));
  }, [devices]);

  const [cultivationPass, setCultivationPass] = useState<CultivationPass>(INITIAL_CULTIVATION_PASS);
  const [pois, setPois] = useState<PointOfInterest[]>(SAMPLE_POI_LIST);
  const [selectedPoi, setSelectedPoi] = useState<PointOfInterest | null>(null);

  // Always keep master fields and POIs synced directly from ts sample files
  useEffect(() => {
    localStorage.removeItem('agrimap_master_fields');
    localStorage.removeItem('agrimap_pois');
    setMasterFields(INITIAL_MASTER_FIELDS);
    setPois(SAMPLE_POI_LIST);
  }, []);

  // Modals state
  const [isFieldsRegisterOpen, setIsFieldsRegisterOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVehiclesOpen, setIsVehiclesOpen] = useState(false);
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
  const [parties, setParties] = useState<RelatedParty[]>(() => {
    const saved = localStorage.getItem('agrimap_parties');
    return saved ? JSON.parse(saved) : INITIAL_PARTIES;
  });
  const [isPartiesModalOpen, setIsPartiesModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('agrimap_parties', JSON.stringify(parties));
  }, [parties]);

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
  };

  const handleDeleteParty = (partyId: string) => {
    setParties((prev) => prev.filter((p) => p.id !== partyId));
  };

  // Crops & Varieties Register state
  const [crops, setCrops] = useState<Crop[]>(() => {
    const saved = localStorage.getItem('agrimap_crops_register');
    return saved ? JSON.parse(saved) : INITIAL_CROPS;
  });
  const [isCropsModalOpen, setIsCropsModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('agrimap_crops_register', JSON.stringify(crops));
  }, [crops]);

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
  };

  const handleDeleteCrop = (cropId: string) => {
    setCrops((prev) => prev.filter((c) => c.id !== cropId));
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

  const simulatorRef = useRef<TelemetrySimulator | null>(null);

  // Initialize simulator
  useEffect(() => {
    const sim = new TelemetrySimulator(INITIAL_CULTIVATION_PASS);
    simulatorRef.current = sim;

    sim.setOnUpdate((updatedPass, activePos, heading, speed, isWorking) => {
      setCultivationPass(updatedPass);
      setProgressPct(sim.getProgress());

      // Update Teltonika device live position and heading for JD 8R
      setDevices((prevDevs) => 
        prevDevs.map((d) => {
          if (d.id === 'tel-01' || d.assignedVehicleId === 'veh-01') {
            return {
              ...d,
              position: activePos,
              heading,
              speedKmH: speed,
              status: isWorking ? 'working' : (speed > 0 ? 'moving' : 'stopped'),
              ignition: true,
              hydraulicActive: isWorking,
              fuelConsumptionLh: isWorking ? 24.5 : 12.0,
              lastUpdate: new Date().toISOString()
            };
          }
          return d;
        })
      );
    });

    return () => {
      sim.destroy();
    };
  }, []);

  // Recalculate Field-2 progress whenever cultivation pass changes
  useEffect(() => {
    if (!cultivationPass.swathPolygon) return;

    setMasterFields((prev) =>
      prev.map((f) => {
        if (f.id === 'field-pria-2') {
          const currentFeature = getFieldFeatureForYear(f, selectedYear);
          const { workedAreaHa, progressPct: calcProg } = calculateFieldWorkProgress(currentFeature, cultivationPass.swathPolygon || null);
          return {
            ...f,
            history: f.history.map((h) => {
              if (h.year === selectedYear) {
                return {
                  ...h,
                  workedAreaHa,
                  workProgress: calcProg,
                  status: calcProg >= 100 ? 'completed' : (calcProg > 0 ? 'in_progress' : 'not_started')
                };
              }
              return h;
            })
          };
        }
        return f;
      })
    );
  }, [cultivationPass, selectedYear]);

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
    simulatorRef.current.pause();
    simulatorRef.current.setProgress(0);
    setIsPlaying(false);
    setProgressPct(0);
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

  const handleWidthChange = (width: number) => {
    setWorkingWidthM(width);
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

  // Vehicle focus
  const handleFocusVehicle = (vehicle: EnrichedVehicle) => {
    setSelectedVehicle(vehicle);
    setFocusedTarget({ coords: vehicle.position, zoom: 16 });
  };

  // Reassignment handlers (Swapping devices and implements between machines)
  const handleAssignDevice = (deviceId: string, vehicleId?: string) => {
    setDevices((prevDevs) => {
      return prevDevs.map((d) => {
        if (d.id === deviceId) {
          return { ...d, assignedVehicleId: vehicleId };
        }
        // If this other device was assigned to the target vehicle, unassign it
        if (vehicleId && d.assignedVehicleId === vehicleId) {
          return { ...d, assignedVehicleId: undefined };
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
          return { ...v, assignedDeviceId: undefined };
        }
        return v;
      });
    });
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
  };

  const handleDeleteVehicle = (id: string) => {
    setRawVehicles((prev) => prev.filter((v) => v.id !== id));
    setDevices((prev) => prev.map((d) => d.assignedVehicleId === id ? { ...d, assignedVehicleId: undefined } : d));
    setImplementsList((prev) => prev.map((i) => i.assignedVehicleId === id ? { ...i, assignedVehicleId: undefined } : i));
    if (selectedVehicle && selectedVehicle.id === id) setSelectedVehicle(null);
  };

  const handleAddImplement = (newImp: Omit<Implement, 'id'>) => {
    const imp: Implement = { ...newImp, id: `imp-${Date.now()}` };
    setImplementsList((prev) => [...prev, imp]);
    if (newImp.assignedVehicleId) {
      handleAssignImplement(imp.id, newImp.assignedVehicleId);
    }
  };

  const handleDeleteImplement = (id: string) => {
    setImplementsList((prev) => prev.filter((i) => i.id !== id));
    setRawVehicles((prev) => prev.map((v) => v.assignedImplementId === id ? { ...v, assignedImplementId: undefined } : v));
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
    }
  };

  const handleDeleteDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setRawVehicles((prev) => prev.map((v) => v.assignedDeviceId === id ? { ...v, assignedDeviceId: undefined } : v));
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
      localStorage.setItem('agrimap_pois', JSON.stringify(updatedList));
      return updatedList;
    });
    setIsAddPoiMode(false);
    setNewPoiCoords(null);
    setPoiDraft(null);
    setVisibility((prev) => ({ ...prev, poi: true }));
    setFocusedTarget({ coords: newPoi.position, zoom: 15 });
  };

  const handleUpdatePoi = (id: string, updatedData: Partial<PointOfInterest>) => {
    setPois((prev) => {
      const updatedList = prev.map((p) => (p.id === id ? { ...p, ...updatedData } : p));
      localStorage.setItem('agrimap_pois', JSON.stringify(updatedList));
      return updatedList;
    });
    setPoiDraft(null);
    setIsAddPoiMode(false);
    setVisibility((prev) => ({ ...prev, poi: true }));
    if (updatedData.position) {
      setFocusedTarget({ coords: updatedData.position as [number, number], zoom: 15 });
    }
  };

  const handleDeletePoi = (id: string) => {
    setPois((prev) => {
      const updatedList = prev.filter((p) => p.id !== id);
      localStorage.setItem('agrimap_pois', JSON.stringify(updatedList));
      return updatedList;
    });
    if (selectedPoi && selectedPoi.id === id) {
      setSelectedPoi(null);
    }
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
    setIsAddPoiMode(true);
  };

  const handleMapClickAddPoi = (coords: [number, number]) => {
    if (poiDraft) {
      setPoiDraft({
        ...poiDraft,
        position: coords
      });
    } else {
      setNewPoiCoords(coords);
    }
    setIsPoiModalOpen(true);
    setIsAddPoiMode(false);
  };

  // Field Register Handlers
  const handleUpdateMasterField = (
    fieldId: number | string, 
    fieldData: Partial<MasterField>, 
    seasonData?: FieldYearlyRecord
  ) => {
    setMasterFields((prev) =>
      prev.map((f) => {
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
          return {
            ...f,
            ...fieldData,
            history: newHistory
          };
        }
        return f;
      })
    );
  };

  const handleAddNewSeasonToAll = (newYear: number) => {
    setMasterFields((prev) =>
      prev.map((f) => {
        if (f.history.some((h) => h.year === newYear)) return f;
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
  };

  // Season Management Handlers
  const handleUpdateSeason = (updated: FarmingSeason) => {
    setSeasons((prev) => prev.map((s) => s.year === updated.year ? updated : s));
  };

  const handleCloseSeason = (year: number) => {
    const today = new Date().toISOString().split('T')[0];
    setSeasons((prev) =>
      prev.map((s) => {
        if (s.year === year) {
          return {
            ...s,
            status: 'closed',
            isLocked: true,
            harvestEndDate: s.harvestEndDate || today,
            closedAt: today,
            closedBy: 'Rein Janno'
          };
        }
        return s;
      })
    );
  };

  const handleReopenSeason = (year: number) => {
    setSeasons((prev) =>
      prev.map((s) => {
        if (s.year === year) {
          return {
            ...s,
            status: 'active',
            isLocked: false
          };
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
  };

  // PRIA SHP import
  const handleFieldsImported = (importedCollection: FieldCollection, replace: boolean) => {
    const existingMaxId = replace ? 0 : Math.max(0, ...masterFields.map((f) => Number(f.id) || 0));
    let nextId = existingMaxId + 1;

    const newMasterFields: MasterField[] = importedCollection.features.map((feature, idx) => {
      const p = feature.properties;
      const area = p.areaHa || 5.0;
      const id = typeof p.id === 'number' && !isNaN(p.id) ? p.id : nextId++;
      const num = p.num ? String(p.num) : String(idx + 1);
      const fieldCode = p.fieldCode ? String(p.fieldCode) : `61044${1000 + Number(id)}`;
      const name = p.name || `Põld ${num}`;

      return {
        id,
        num,
        name,
        fieldCode,
        cadastralCode: p.cadastralCode || `89201:00${(idx % 9) + 1}:010${idx % 9}`,
        soilType: p.rawProperties?.soilType || 'Leostunud liivsavi (LP)',
        drainageSystem: p.rawProperties?.drainageSystem ?? true,
        landowner: p.rawProperties?.landowner || 'Oma maa',
        notes: p.notes || '',
        geometry: feature.geometry,
        history: [
          {
            year: selectedYear,
            areaHa: area,
            crop: p.crop || 'Talinisu (Skagen)',
            cropVariety: p.crop ? p.crop.split('(')[1]?.replace(')', '') || '' : 'Skagen',
            cropColor: p.cropColor || '#eab308',
            targetYieldTonsHa: 7.5,
            workedAreaHa: p.workedAreaHa || 0,
            workProgress: p.workProgress || 0,
            status: p.status || 'not_started',
            notes: p.notes
          }
        ]
      };
    });

    if (replace) {
      setMasterFields(newMasterFields);
    } else {
      setMasterFields((prev) => [...prev, ...newMasterFields]);
    }

    setIsUploadOpen(false);

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

  const handleResetToSample = () => {
    setMasterFields(INITIAL_MASTER_FIELDS);
    setIsUploadOpen(false);
  };

  // Totals for stats bar
  const totalAreaHa = fields.features.reduce((sum, f) => sum + (f.properties.areaHa || 0), 0);
  const workedAreaHa = fields.features.reduce((sum, f) => sum + (f.properties.workedAreaHa || 0), 0);
  const activeVehiclesCount = vehicles.filter((v) => isVehicleRecentlyActive(v, 5)).length;

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header 
        fieldsCount={fields.features.length}
        totalAreaHa={totalAreaHa}
        workedAreaHa={workedAreaHa}
        activeVehiclesCount={activeVehiclesCount}
        poiCount={pois.length}
        partiesCount={parties.length}
        cropsCount={crops.length}
        varietiesCount={crops.reduce((sum, c) => sum + (c.varieties?.length || 0), 0)}
        selectedYear={selectedYear}
        activeSeason={activeSeason}
        onOpenSeasonManager={() => setIsSeasonManagerOpen(true)}
        onOpenFieldsRegister={() => setIsFieldsRegisterOpen(true)}
        onOpenParties={() => setIsPartiesModalOpen(true)}
        onOpenCrops={() => setIsCropsModalOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenVehicles={() => setIsVehiclesOpen(true)}
        onOpenPoi={() => setIsPoiModalOpen(true)}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        isAddPoiMode={isAddPoiMode}
        onToggleAddPoiMode={() => setIsAddPoiMode(!isAddPoiMode)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Map View */}
      <div className="main-content">
        <MapView 
          visibility={visibility}
          fields={fields}
          selectedField={selectedField}
          onSelectField={handleSelectField}
          vehicles={vehicles}
          selectedVehicle={selectedVehicle}
          onSelectVehicle={setSelectedVehicle}
          cultivationPass={cultivationPass}
          pois={pois}
          selectedPoi={selectedPoi}
          onSelectPoi={setSelectedPoi}
          isAddPoiMode={isAddPoiMode}
          onMapClickAddPoi={handleMapClickAddPoi}
          focusedTarget={focusedTarget}
          fitBoundsTrigger={fitBoundsTrigger}
          selectedCropFilter={selectedCropFilter}
          vehicleFilter={vehicleFilter}
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
            onOpenSeasonManager={() => setIsSeasonManagerOpen(true)}
          />

          {/* Selected Field Details Box Directly Under Season Selector */}
          {selectedField && (
            <FieldDetailsDrawer 
              field={selectedField}
              onClose={() => setSelectedFieldId(null)}
              onFocusField={handleFocusField}
              isSeasonLocked={activeSeason?.isLocked ?? false}
            />
          )}
        </div>

        {/* Floating Layer Controller (Top Right) */}
        <LayerControl 
          visibility={visibility}
          onToggleLayer={handleToggleLayer}
          onSelectBaseMap={handleSelectBaseMap}
          onFitAll={handleFitAll}
          activeVehiclesCount={activeVehiclesCount}
          totalVehiclesCount={vehicles.length}
          vehicleFilter={vehicleFilter}
          onSelectVehicleFilter={setVehicleFilter}
        />

        {/* Bottom Floating Telemetry & Cultivation Scrubber Panel */}
        {visibility.cultivation && (
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
            onWidthChange={handleWidthChange}
            targetFieldName="Põld nr 2 (Talinisu)"
            fieldAreaHa={2.75}
          />
        )}
      </div>

      {/* Modals */}
      <SeasonManagerModal 
        isOpen={isSeasonManagerOpen}
        onClose={() => setIsSeasonManagerOpen(false)}
        seasons={seasons}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        onUpdateSeason={handleUpdateSeason}
        onCloseSeason={handleCloseSeason}
        onReopenSeason={handleReopenSeason}
        onCreateSeason={handleCreateSeason}
      />

      <FieldManagerModal 
        isOpen={isFieldsRegisterOpen}
        onClose={() => setIsFieldsRegisterOpen(false)}
        masterFields={masterFields}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        onFocusField={handleFocusField}
        onUpdateField={handleUpdateMasterField}
        onAddNewSeasonToAll={handleAddNewSeasonToAll}
        onDeleteField={handleDeleteMasterField}
        onOpenUpload={() => setIsUploadOpen(true)}
        seasons={seasons}
        onOpenSeasonManager={() => {
          setIsFieldsRegisterOpen(false);
          setIsSeasonManagerOpen(true);
        }}
        parties={parties}
        onOpenParties={() => {
          setIsPartiesModalOpen(true);
        }}
        crops={crops}
        onOpenCrops={() => {
          setIsFieldsRegisterOpen(false);
          setIsCropsModalOpen(true);
        }}
      />

      <FieldUploadModal 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onFieldsImported={handleFieldsImported}
        onResetToSample={handleResetToSample}
      />

      <VehicleTracker 
        isOpen={isVehiclesOpen}
        onClose={() => setIsVehiclesOpen(false)}
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
        onDeleteVehicle={handleDeleteVehicle}
        onAddImplement={handleAddImplement}
        onDeleteImplement={handleDeleteImplement}
        onAddDevice={handleAddDevice}
        onDeleteDevice={handleDeleteDevice}
      />

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

      <AnalyticsModal 
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        fields={fields}
        vehicles={vehicles}
        cultivationPass={cultivationPass}
      />

      <RelatedPartiesModal
        isOpen={isPartiesModalOpen}
        onClose={() => setIsPartiesModalOpen(false)}
        parties={parties}
        onSaveParty={handleSaveParty}
        onDeleteParty={handleDeleteParty}
        masterFields={masterFields}
        vehicles={vehicles}
        selectedYear={selectedYear}
      />

      <CropRegisterModal
        isOpen={isCropsModalOpen}
        onClose={() => setIsCropsModalOpen(false)}
        crops={crops}
        onSaveCrop={handleSaveCrop}
        onDeleteCrop={handleDeleteCrop}
        masterFields={masterFields}
        selectedYear={selectedYear}
      />
    </div>
  );
};
