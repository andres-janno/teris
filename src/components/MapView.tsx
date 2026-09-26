// src/components/MapView.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4';
import type { LayerVisibility, VehicleDisplayFilter } from '../types/map';
import type { FieldCollection, FieldFeature } from '../types/field';
import type { Vehicle } from '../types/vehicle';
import type { CultivationPass } from '../types/telemetry';
import type { PointOfInterest } from '../types/poi';
import type { SoilSample, SoilSampleMetricKey } from '../types/soilSample';
import { getSoilMetricColor, getSoilMetricValue, SOIL_METRIC_CONFIG } from '../types/soilSample';
import { BASE_MAPS, MAAAMET_CADASTRE_WMS } from '../services/maaAmetLayers';
import { createVehicleIcon, createPoiIcon, isVehicleRecentlyActive } from './MapMarkers';
import { getVisibleElementsBounds } from '../services/geometryEngine';
import { getCropColor } from '../services/shpParser';

interface MapViewProps {
  visibility: LayerVisibility;
  fields: FieldCollection;
  selectedField: FieldFeature | null;
  onSelectField: (field: FieldFeature | null) => void;
  vehicles: Vehicle[];
  selectedVehicle?: Vehicle | null;
  onSelectVehicle: (vehicle: Vehicle | null) => void;
  cultivationPass: CultivationPass;
  pois: PointOfInterest[];
  selectedPoi?: PointOfInterest | null;
  onSelectPoi: (poi: PointOfInterest | null) => void;
  isAddPoiMode: boolean;
  onMapClickAddPoi: (coords: [number, number]) => void;
  focusedTarget: {
    coords: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number
  } | null;
  fitBoundsTrigger?: number;
  selectedCropFilter?: string | null;
  vehicleFilter?: VehicleDisplayFilter;
  soilSamples?: SoilSample[];
  soilMetric?: SoilSampleMetricKey;
}

export const MapView: React.FC<MapViewProps> = ({
  visibility,
  fields,
  selectedField,
  onSelectField,
  vehicles,
  onSelectVehicle,
  cultivationPass,
  pois,
  onSelectPoi,
  isAddPoiMode,
  onMapClickAddPoi,
  focusedTarget,
  fitBoundsTrigger,
  selectedCropFilter,
  vehicleFilter = 'active',
  soilSamples = [],
  soilMetric = 'ph'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer refs
  const baseMapLayerRef = useRef<L.TileLayer | null>(null);
  const cadastreLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const fieldsLayerGroupRef = useRef<L.GeoJSON | null>(null);
  const vehiclesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const cultivationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const poiLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const soilSampleLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Mouse coords indicator
  const coordsDisplayRef = useRef<HTMLDivElement>(null);

  // Kõik mullaproovi punktid massiivi (fieldCode) uusimast proovivõtu aastast -
  // ühel massiivil võib olla mitu punkti (nt 5-10 GPS-koordinaati ruudustiku
  // järgi), mistõttu grupeerime massiivi + uusima aasta järgi, mitte üheks
  // punktiks. Kasutab nii põldude täitevärvi (keskmine) kui proovipunktide kihti.
  const latestByFieldCode = React.useMemo(() => {
    const latestYear = new Map<string, number>();
    for (const s of soilSamples) {
      const y = latestYear.get(s.fieldCode);
      if (y === undefined || s.year > y) latestYear.set(s.fieldCode, s.year);
    }
    const grouped = new Map<string, SoilSample[]>();
    for (const s of soilSamples) {
      if (latestYear.get(s.fieldCode) !== s.year) continue;
      const arr = grouped.get(s.fieldCode);
      if (arr) arr.push(s);
      else grouped.set(s.fieldCode, [s]);
    }
    return grouped;
  }, [soilSamples]);

  const getFieldMetricAverage = React.useCallback(
    (fieldCode: string, metric: SoilSampleMetricKey): number | null => {
      const list = latestByFieldCode.get(fieldCode);
      if (!list || list.length === 0) return null;
      const values = list
        .map((s) => getSoilMetricValue(s, metric))
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    },
    [latestByFieldCode]
  );

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on fields in Viljandimaa / Tarvastu
    const map = L.map(mapContainerRef.current, {
      center: [58.138, 25.882],
      zoom: 13,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

    // Mouse coordinates tracker
    map.on('mousemove', (e) => {
      if (coordsDisplayRef.current) {
        const lat = e.latlng.lat.toFixed(5);
        const lng = e.latlng.lng.toFixed(5);

        let lestCoords = '';
        try {
          const [lestX, lestY] = proj4('EPSG:4326', 'EPSG:3301', [e.latlng.lng, e.latlng.lat]);
          lestCoords = ` | L-EST97: X ${Math.round(lestX)} Y ${Math.round(lestY)}`;
        } catch (err) {
          // ignore
        }

        coordsDisplayRef.current.innerText = `WGS84: ${lat}, ${lng}${lestCoords}`;
      }
    });

    // Create layer groups
    vehiclesLayerGroupRef.current = L.layerGroup().addTo(map);
    cultivationLayerGroupRef.current = L.layerGroup().addTo(map);
    poiLayerGroupRef.current = L.layerGroup().addTo(map);
    soilSampleLayerGroupRef.current = L.layerGroup().addTo(map);

    // Auto-fit all elements on initial load
    const initialBounds = getVisibleElementsBounds({
      visibility,
      fields,
      vehicles,
      cultivationPass,
      pois
    });

    if (initialBounds) {
      map.fitBounds(initialBounds, { padding: [25, 25], maxZoom: 18, animate: false });
      // Also ensure fitBounds after container layout settles
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.fitBounds(initialBounds, { padding: [25, 25], maxZoom: 18, animate: false });
        }
      }, 50);
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dedicated click listener for adding POI
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isAddPoiMode) {
        onMapClickAddPoi([e.latlng.lat, e.latlng.lng]);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isAddPoiMode, onMapClickAddPoi]);

  // 2. Handle Base Map & Cadastre WMS
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old base layer
    if (baseMapLayerRef.current) {
      map.removeLayer(baseMapLayerRef.current);
    }

    const baseConfig = BASE_MAPS[visibility.baseMap] || BASE_MAPS['maaamet-pohikaart'];

    const newBaseLayer = L.tileLayer(baseConfig.url, {
      tms: baseConfig.tms ?? false,
      attribution: baseConfig.attribution,
      maxZoom: baseConfig.maxZoom || 19,
      minZoom: baseConfig.minZoom || 5,
      subdomains: baseConfig.subdomains || []
    });

    newBaseLayer.addTo(map);
    baseMapLayerRef.current = newBaseLayer;

    // Cadastre WMS Layer
    if (visibility.cadastre) {
      if (!cadastreLayerRef.current) {
        cadastreLayerRef.current = L.tileLayer.wms(MAAAMET_CADASTRE_WMS.url, {
          layers: MAAAMET_CADASTRE_WMS.layers,
          format: MAAAMET_CADASTRE_WMS.format,
          transparent: MAAAMET_CADASTRE_WMS.transparent,
          version: MAAAMET_CADASTRE_WMS.version,
          attribution: MAAAMET_CADASTRE_WMS.attribution,
          maxZoom: MAAAMET_CADASTRE_WMS.maxZoom,
          minZoom: MAAAMET_CADASTRE_WMS.minZoom,
          zIndex: 300,
          opacity: 0.95
        });
      }
      if (!map.hasLayer(cadastreLayerRef.current)) {
        cadastreLayerRef.current.addTo(map);
      }
      if (typeof (cadastreLayerRef.current as any).bringToFront === 'function') {
        (cadastreLayerRef.current as any).bringToFront();
      }
    } else {
      if (cadastreLayerRef.current && map.hasLayer(cadastreLayerRef.current)) {
        map.removeLayer(cadastreLayerRef.current);
      }
    }
  }, [visibility.baseMap, visibility.cadastre]);

  // 3. Render PRIA Fields Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (fieldsLayerGroupRef.current) {
      map.removeLayer(fieldsLayerGroupRef.current);
      fieldsLayerGroupRef.current = null;
    }

    if (!visibility.fields || !fields || !fields.features.length) return;

    const getFillColor = (feature: any): string => {
      if (visibility.soilSamples) {
        const avg = getFieldMetricAverage(feature.properties.fieldCode, soilMetric);
        return avg !== null ? getSoilMetricColor(soilMetric, avg) : '#94a3b8';
      }
      return feature.properties.cropColor || getCropColor(feature.properties.crop);
    };

    const geoJsonLayer = L.geoJSON(fields as any, {
      style: (feature: any) => {
        const isSelected = selectedField && selectedField.properties.id === feature.properties.id;
        const matchesFilter = !selectedCropFilter || feature.properties.crop === selectedCropFilter;

        return {
          color: isSelected ? '#ffffff' : (matchesFilter ? '#0f172a' : '#64748b'),
          weight: isSelected ? 3.5 : (matchesFilter ? 2.0 : 1.0),
          opacity: matchesFilter ? 0.95 : 0.35,
          fillColor: getFillColor(feature),
          fillOpacity: isSelected ? 0.8 : (matchesFilter ? 0.65 : 0.12)
        };
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        const props = feature.properties;
        const cropColor = getFillColor(feature);

        // Tooltip label on field: permanent only if fieldLabels layer is explicitly turned on
        layer.bindTooltip(`
          <div class="field-map-label">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${cropColor}; box-shadow: 0 0 4px ${cropColor};"></span>
              <strong>${props.name}</strong>
            </div>
            <div class="field-sub-label">${props.num ? `Nr ${props.num} &bull; ` : ''}${props.crop} &bull; ${props.areaHa} ha</div>
            ${visibility.soilSamples ? (() => {
              const list = latestByFieldCode.get(props.fieldCode);
              const config = SOIL_METRIC_CONFIG[soilMetric];
              const avg = getFieldMetricAverage(props.fieldCode, soilMetric);
              const avgLabel = avg !== null ? `${Math.round(avg * 100) / 100} ${config.unit}` : 'andmed puuduvad';
              const countNote = list && list.length > 1 ? ` (keskmine ${list.length} punktist)` : '';
              return `<div class="field-sub-label">${config.label}: <strong>${avgLabel}</strong>${countNote}</div>`;
            })() : ''}
          </div>
        `, {
          permanent: !!visibility.fieldLabels,
          sticky: !visibility.fieldLabels,
          direction: visibility.fieldLabels ? 'center' : 'auto',
          className: 'custom-field-tooltip'
        });

        layer.on({
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectField(feature);
          },
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({ fillOpacity: 0.85, weight: 3 });
          },
          mouseout: (e) => {
            const l = e.target;
            const isSelected = selectedField && selectedField.properties.id === feature.properties.id;
            const matchesFilter = !selectedCropFilter || feature.properties.crop === selectedCropFilter;
            l.setStyle({
              fillOpacity: isSelected ? 0.8 : (matchesFilter ? 0.65 : 0.12),
              weight: isSelected ? 3.5 : (matchesFilter ? 2.0 : 1.0)
            });
          }
        });
      }
    });

    geoJsonLayer.addTo(map);
    fieldsLayerGroupRef.current = geoJsonLayer;
  }, [fields, visibility.fields, visibility.fieldLabels, visibility.soilSamples, selectedField, selectedCropFilter, latestByFieldCode, getFieldMetricAverage, soilMetric]);

  // 4. Render Machinery / Vehicles Layer (Respects vehicleFilter: active vs all)
  const displayedVehicles = React.useMemo(() => {
    if (!visibility.vehicles) return [];
    if (vehicleFilter === 'active') {
      return vehicles.filter((v) => isVehicleRecentlyActive(v, 5));
    }
    return vehicles;
  }, [vehicles, visibility.vehicles, vehicleFilter]);

  useEffect(() => {
    const layerGroup = vehiclesLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();
    if (!visibility.vehicles) return;

    displayedVehicles.forEach((vehicle) => {
      const isWorking = vehicle.status === 'working';
      const isMoving = vehicle.status === 'moving';
      const lastUpdateMs = vehicle.telemetry?.lastUpdate ? Date.now() - new Date(vehicle.telemetry.lastUpdate).getTime() : 0;
      const minutesAgo = Math.max(0, Math.floor(lastUpdateMs / 60000));
      const activityLabel = minutesAgo < 1 ? 'Just nüüd (< 1 min)' : `${minutesAgo} min tagasi`;

      const icon = createVehicleIcon(vehicle);
      const marker = L.marker(vehicle.position, { icon, zIndexOffset: (isWorking || isMoving) ? 1200 : 900 });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectVehicle(vehicle);
      });

      marker.bindPopup(`
        <div class="vehicle-popup-content">
          <div class="popup-title-row">
            <h4>${vehicle.name}</h4>
            <span class="status-tag ${vehicle.status}">${isWorking ? 'TÖÖTAB' : (isMoving ? 'LIIKUB' : 'SEISAB')}</span>
          </div>
          <div class="popup-row"><span>Juht:</span> <strong>${vehicle.driverName || 'Määramata'}</strong></div>
          <div class="popup-row"><span>Kiirus:</span> <strong>${vehicle.speedKmH.toFixed(1)} km/h</strong></div>
          <div class="popup-row"><span>Viimane liikumine:</span> <strong>${activityLabel}</strong></div>
          <div class="popup-row"><span>Kütusetase:</span> <strong>${vehicle.telemetry.fuelLevelPct}%</strong></div>
          <div class="popup-row"><span>Haakeriist:</span> <strong>${vehicle.implement ? `${vehicle.implement.name}` : 'Pole'}</strong></div>
          <div class="popup-row"><span>Mootor:</span> <strong>${vehicle.telemetry.engineRpm || 0} RPM</strong></div>
        </div>
      `);

      marker.addTo(layerGroup);
    });
  }, [displayedVehicles, visibility.vehicles]);

  // 5. Render Cultivation (Haritud ala & Swaths) Layer
  useEffect(() => {
    const layerGroup = cultivationLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();
    if (!visibility.cultivation) return;

    // Draw swath polygon
    if (cultivationPass.swathPolygon) {
      const swathLayer = L.geoJSON(cultivationPass.swathPolygon as any, {
        style: {
          color: '#16a34a',
          weight: 1.5,
          opacity: 0.85,
          fillColor: '#22c55e',
          fillOpacity: 0.55
        }
      });
      swathLayer.addTo(layerGroup);
    }

    // Draw trajectory trail line
    if (cultivationPass.trailLine && visibility.swathTrails) {
      const trailLayer = L.geoJSON(cultivationPass.trailLine as any, {
        style: {
          color: '#38bdf8',
          weight: 2,
          opacity: 0.7,
          dashArray: '4, 4'
        }
      });
      trailLayer.addTo(layerGroup);
    }
  }, [cultivationPass, visibility.cultivation, visibility.swathTrails]);

  // 6. Render POI / Infrastructure Layer
  useEffect(() => {
    const layerGroup = poiLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();
    if (!visibility.poi) return;

    pois.forEach((poi) => {
      const icon = createPoiIcon(poi);
      const marker = L.marker(poi.position, { icon, zIndexOffset: 500 });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectPoi(poi);
      });

      marker.bindPopup(`
        <div class="poi-popup-content">
          <h4>${poi.name}</h4>
          <p class="poi-desc">${poi.description || ''}</p>
          ${poi.capacity ? `<div class="popup-row"><span>Mahutavus:</span> <strong>${poi.capacity}</strong></div>` : ''}
          ${poi.phone ? `<div class="popup-row"><span>Telefon:</span> <strong>${poi.phone}</strong></div>` : ''}
          ${poi.accessNotes ? `<div class="popup-note">${poi.accessNotes}</div>` : ''}
        </div>
      `);

      marker.addTo(layerGroup);
    });
  }, [pois, visibility.poi]);

  // 6b. Render Soil Sample Points Layer - kõik punktid massiivi uusimast
  // proovivõtu aastast (üks massiiv võib olla proovitud mitmest GPS-kohast).
  const latestSoilSamples = React.useMemo(
    () => Array.from(latestByFieldCode.values()).flat(),
    [latestByFieldCode]
  );

  useEffect(() => {
    const layerGroup = soilSampleLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();
    if (!visibility.soilSamples) return;

    const config = SOIL_METRIC_CONFIG[soilMetric];

    latestSoilSamples.forEach((sample) => {
      const value = getSoilMetricValue(sample, soilMetric);
      const color = getSoilMetricColor(soilMetric, value);
      const fieldMatch = fields.features.find((f) => f.properties.fieldCode === sample.fieldCode);
      const fieldName = fieldMatch ? fieldMatch.properties.name : `Massiiv ${sample.fieldCode}`;

      const siblingCount = (latestByFieldCode.get(sample.fieldCode)?.length || 1) - 1;
      const priorYears = Array.from(new Set(
        soilSamples
          .filter((s) => s.fieldCode === sample.fieldCode && s.year < sample.year)
          .map((s) => s.year)
      )).sort((a, b) => a - b);

      const marker = L.circleMarker([sample.lat, sample.lng], {
        radius: 8,
        weight: 2,
        color: '#ffffff',
        fillColor: color,
        fillOpacity: 0.9
      });

      marker.bindTooltip(`
        <div class="soil-popup-content">
          <h4>${fieldName}</h4>
          <p class="poi-desc">Proov ${sample.sampleNumber} &bull; ${sample.year}</p>
          <div class="popup-row"><span>${config.label}:</span> <strong>${value ?? '-'} ${config.unit}</strong></div>
          <div class="popup-row"><span>pH:</span> <strong>${sample.ph ?? '-'}</strong></div>
          <div class="popup-row"><span>P:</span> <strong>${sample.phosphorus ?? '-'} mg/kg</strong></div>
          <div class="popup-row"><span>K:</span> <strong>${sample.potassium ?? '-'} mg/kg</strong></div>
          <div class="popup-row"><span>Ca:</span> <strong>${sample.calcium ?? '-'} mg/kg</strong></div>
          <div class="popup-row"><span>Mg:</span> <strong>${sample.magnesium ?? '-'} mg/kg</strong></div>
          <div class="popup-row"><span>Corg:</span> <strong>${sample.organicCarbon ?? '-'} %</strong></div>
          <div class="popup-row"><span>Lubjatarve:</span> <strong>${sample.limeRequirement ?? '-'} t/ha</strong></div>
          ${siblingCount > 0 ? `<div class="popup-note">Sellel massiivil veel ${siblingCount} proovipunkti ${sample.year}. aastal</div>` : ''}
          ${priorYears.length > 0 ? `<div class="popup-note">Varasemad proovivõtu aastad: ${priorYears.join(', ')}</div>` : ''}
        </div>
      `, {
        sticky: true,
        direction: 'top',
        className: 'custom-field-tooltip'
      });

      marker.addTo(layerGroup);
    });
  }, [latestSoilSamples, latestByFieldCode, soilSamples, visibility.soilSamples, soilMetric, fields]);

  // 7. Handle Camera Pan/Zoom Focus
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusedTarget) return;

    if (focusedTarget.bounds) {
      map.fitBounds(focusedTarget.bounds, {
        padding: [35, 35],
        maxZoom: 18,
        animate: true,
        duration: 0.8
      });
    } else {
      map.flyTo(focusedTarget.coords, focusedTarget.zoom || 16, {
        animate: true,
        duration: 0.8
      });
    }
  }, [focusedTarget]);

  // 8. Fit all visible elements on screen
  const handleFitAllBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = getVisibleElementsBounds({
      visibility,
      fields,
      vehicles: displayedVehicles,
      cultivationPass,
      pois
    });

    if (bounds) {
      map.fitBounds(bounds, {
        padding: [25, 25],
        maxZoom: 18,
        animate: true,
        duration: 0.8
      });
    }
  }, [visibility, fields, displayedVehicles, cultivationPass, pois]);

  useEffect(() => {
    if (fitBoundsTrigger && fitBoundsTrigger > 0) {
      handleFitAllBounds();
    }
  }, [fitBoundsTrigger, handleFitAllBounds]);

  return (
    <div className="map-wrapper">
      <div
        ref={mapContainerRef}
        className={`leaflet-map-container ${isAddPoiMode ? 'cursor-crosshair' : ''}`}
      />

      {/* Floating coordinates bar */}
      <div ref={coordsDisplayRef} className="coords-tracker glass-card">
        WGS84: 58.13800, 25.88200 | L-EST97: X 532800 Y 6531200
      </div>

      {/* Add POI Banner */}
      {isAddPoiMode && (
        <div className="add-poi-banner glass-card animate-pulse">
          <span>📍 Klõpsa kaardile, et määrata uue kuivati, veepunkti või töökoja asukoht!</span>
        </div>
      )}
    </div>
  );
};
