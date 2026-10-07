import React, { useState } from 'react';
import {
  Layers,
  Map as MapIcon,
  Eye,
  EyeOff,
  Grid,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Play,
  Route
} from 'lucide-react';
import type { BaseMapLayerId, LayerVisibility, VehicleDisplayFilter } from '../types/map';
import type { SoilSampleMetricKey } from '../types/soilSample';
import type { EnrichedVehicle } from '../types/fleet';
import { SOIL_METRIC_CONFIG, getSoilMetricColor, AGE_MAX_YEARS } from '../types/soilSample';
import { BASE_MAPS } from '../services/maaAmetLayers';

interface LayerControlProps {
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onSelectBaseMap: (id: BaseMapLayerId) => void;
  onFitAll?: () => void;
  activeVehiclesCount?: number;
  totalVehiclesCount?: number;
  vehicleFilter?: VehicleDisplayFilter;
  onSelectVehicleFilter?: (filter: VehicleDisplayFilter) => void;
  soilSampleCount?: number;
  soilFieldCount?: number;
  soilMetric?: SoilSampleMetricKey;
  onSelectSoilMetric?: (metric: SoilSampleMetricKey) => void;

  // Sõidukite individuaalsed lülitid
  vehicles?: EnrichedVehicle[];
  hiddenVehicleMapIds?: Set<string>;
  onToggleVehicleMap?: (vehicleId: string) => void;
  simulatedVehicleId?: string | null;
  vehicleTrackMode?: 'sim' | 'full';
  onToggleVehicleSimulator?: (vehicleId: string) => void;
  onToggleVehicleFullTrack?: (vehicleId: string) => void;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  visibility,
  onToggleLayer,
  onSelectBaseMap,
  onFitAll,
  activeVehiclesCount = 0,
  totalVehiclesCount = 0,
  vehicleFilter = 'active',
  onSelectVehicleFilter,
  soilSampleCount = 0,
  soilFieldCount = 0,
  soilMetric = 'ph',
  onSelectSoilMetric,
  vehicles = [],
  hiddenVehicleMapIds,
  onToggleVehicleMap,
  simulatedVehicleId,
  vehicleTrackMode = 'sim',
  onToggleVehicleSimulator,
  onToggleVehicleFullTrack
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const isAgeMetric = soilMetric === 'age';

  const soilLegendItems = !isAgeMetric
    ? (SOIL_METRIC_CONFIG[soilMetric].thresholds || []).map((t, idx, arr) => {
        const prevMax = idx > 0 ? arr[idx - 1].max : null;
        const unit = SOIL_METRIC_CONFIG[soilMetric].unit;
        let label: string;
        if (t.max === Infinity) {
          label = `> ${prevMax}${unit ? ` ${unit}` : ''}`;
        } else if (prevMax === null) {
          label = `≤ ${t.max}${unit ? ` ${unit}` : ''}`;
        } else {
          label = `${prevMax} – ${t.max}${unit ? ` ${unit}` : ''}`;
        }
        return { color: t.color, label };
      })
    : [];

  const ageGradientCss = `linear-gradient(to right, ${Array.from(
    { length: AGE_MAX_YEARS + 2 },
    (_, i) => getSoilMetricColor('age', i)
  ).join(', ')})`;

  return (
    <div className={`layer-control-panel glass-card ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="layer-control-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="layer-header-title">
          <Layers size={18} className="text-emerald" />
          <span>Kaardikihid</span>
        </div>
        <button className="icon-btn-ghost" title={isOpen ? 'Ahenda' : 'Laienda'}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="layer-control-body">
          {/* Base Maps Selection */}
          <div className="layer-section">
            <div className="section-title">
              <MapIcon size={14} />
              <span>Aluskaart</span>
            </div>
            <div className="basemap-grid">
              {(Object.keys(BASE_MAPS) as BaseMapLayerId[]).map((id) => {
                const mapConfig = BASE_MAPS[id];
                const isActive = visibility.baseMap === id;
                return (
                  <button
                    key={id}
                    className={`basemap-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectBaseMap(id)}
                  >
                    <span className="basemap-name">{mapConfig.name}</span>
                    {isActive && <span className="active-dot"></span>}
                  </button>
                );
              })}
            </div>
            <label className="layer-label basemap-cadastre-toggle">
              <input
                type="checkbox"
                checked={visibility.cadastre}
                onChange={() => onToggleLayer('cadastre')}
              />
              <span className="layer-color-indicator cadastre-color"></span>
              <span className="layer-text">Katastripiirid</span>
            </label>
          </div>

          {/* Overlays / Thematic Layers */}
          <div className="layer-section">
            <div className="section-title">
              <Grid size={14} />
              <span>Teemakihid</span>
            </div>
            <div className="overlay-list">
              {/* Fields Layer */}
              <div className="layer-field-box">
                <div className="layer-item">
                  <label className="layer-label">
                    <input
                      type="checkbox"
                      checked={visibility.fields}
                      onChange={() => onToggleLayer('fields')}
                    />
                    <span className="layer-color-indicator fields-color"></span>
                    <span className="layer-text">PRIA Põllud</span>
                  </label>
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('fields')}
                    title={visibility.fields ? 'Peida' : 'Näita'}
                  >
                    {visibility.fields ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              </div>

              {/* Soil Samples */}
              <div className="layer-box-group">
                <div className="layer-item">
                  <label className="layer-label">
                    <input
                      type="checkbox"
                      checked={visibility.soilSamples}
                      onChange={() => onToggleLayer('soilSamples')}
                    />
                    <span className="layer-color-indicator soil-color"></span>
                    <span className="layer-text-wrap">
                      <span className="layer-text">METK Mullaproovid</span>
                      <span className="layer-subtext">{soilSampleCount} punkti kokku, {soilFieldCount} massiivil</span>
                    </span>
                  </label>
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('soilSamples')}
                    title={visibility.soilSamples ? 'Peida' : 'Näita'}
                  >
                    {visibility.soilSamples ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {visibility.soilSamples && onSelectSoilMetric && (
                  <div className="vehicle-filter-subgroup">
                    <div className="soil-metric-radio-list">
                      {(Object.keys(SOIL_METRIC_CONFIG) as SoilSampleMetricKey[]).map((key) => (
                        <label key={key} className="soil-metric-radio-item">
                          <input
                            type="radio"
                            name="soil-metric"
                            value={key}
                            checked={soilMetric === key}
                            onChange={() => onSelectSoilMetric(key)}
                          />
                          <span>{SOIL_METRIC_CONFIG[key].label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="soil-legend-list">
                      {isAgeMetric ? (
                        <div className="soil-legend-gradient">
                          <div className="soil-legend-gradient-bar" style={{ backgroundImage: ageGradientCss }}></div>
                          <div className="soil-legend-gradient-labels">
                            <span>0 a</span>
                            <span>&gt; {AGE_MAX_YEARS} a</span>
                          </div>
                        </div>
                      ) : (
                        soilLegendItems.map((item) => (
                          <div key={item.label} className="soil-legend-item">
                            <span className="soil-legend-swatch" style={{ backgroundColor: item.color }}></span>
                            <span className="soil-legend-label">{item.label}</span>
                          </div>
                        ))
                      )}
                      <div className="soil-legend-item">
                        <span className="soil-legend-swatch" style={{ backgroundColor: '#94a3b8' }}></span>
                        <span className="soil-legend-label">Andmed puuduvad</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cultivation / Teltonika Swaths */}
              <div className="layer-item">
                <label className="layer-label">
                  <input
                    type="checkbox"
                    checked={visibility.cultivation}
                    onChange={() => onToggleLayer('cultivation')}
                  />
                  <span className="layer-color-indicator cultivation-color"></span>
                  <span className="layer-text">Haritud ala</span>
                </label>
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('cultivation')}
                  title={visibility.cultivation ? 'Peida' : 'Näita'}
                >
                  {visibility.cultivation ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>

              {/* Machinery / Vehicles */}
              <div className="layer-box-group">
                <div className="layer-item">
                  <label className="layer-label">
                    <input
                      type="checkbox"
                      checked={visibility.vehicles}
                      onChange={() => onToggleLayer('vehicles')}
                    />
                    <span className="layer-color-indicator tech-color"></span>
                    <span className="layer-text-wrap">
                      <span className="layer-text">Masinapark</span>
                      <span className="layer-subtext">
                        {vehicleFilter === 'active' ? 'Ainult töötavad (< 5 min)' : 'Kõik masinad'}
                      </span>
                    </span>
                    {activeVehiclesCount > 0 && (
                      <span className="live-count-badge" title={`${activeVehiclesCount} masinat parasjagu töös või hiljuti liikunud`}>
                        <span className="live-dot-pulse"></span>
                        <span>{activeVehiclesCount}</span>
                      </span>
                    )}
                  </label>
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('vehicles')}
                    title={visibility.vehicles ? 'Peida' : 'Näita'}
                  >
                    {visibility.vehicles ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {/* Sub-selector for Vehicle Filter: Active vs All */}
                {visibility.vehicles && onSelectVehicleFilter && (
                  <div className="vehicle-filter-subgroup">
                    <button
                      type="button"
                      className={`v-filter-pill ${vehicleFilter === 'active' ? 'active' : ''}`}
                      onClick={() => onSelectVehicleFilter('active')}
                      title="Kuva ainult masinad, mis töötavad või on liikunud viimase 5 min jooksul"
                    >
                      <span className="dot-live"></span>
                      <span>Ainult töötavad ({activeVehiclesCount})</span>
                    </button>
                    <button
                      type="button"
                      className={`v-filter-pill ${vehicleFilter === 'all' ? 'active' : ''}`}
                      onClick={() => onSelectVehicleFilter('all')}
                      title="Kuva kogu masinapark (sh seisvad ja vabad masinad)"
                    >
                      <span>Kõik ({totalVehiclesCount || activeVehiclesCount})</span>
                    </button>
                  </div>
                )}

                {/* Sõidukite ja seadmete individuaalne juhtimine */}
                {visibility.vehicles && vehicles && vehicles.length > 0 && (
                  <div className="vehicle-individual-list">
                    {vehicles.map((v) => {
                      const isMapVisible = !hiddenVehicleMapIds?.has(v.id);
                      const isTrackActive = simulatedVehicleId === v.id;
                      const isSimActive = isTrackActive && vehicleTrackMode === 'sim';
                      const isFullTrackActive = isTrackActive && vehicleTrackMode === 'full';
                      const iconEmoji = v.type === 'combine' ? '🌾' : (v.type === 'sprayer' ? '🚿' : (v.type === 'truck' ? '🚛' : '🚜'));
                      const deviceLabel = v.telemetry?.deviceId && v.telemetry.deviceId !== 'PAIGALDAMATA'
                        ? v.telemetry.deviceId
                        : (v.id.includes('demo') || v.name.toLowerCase().includes('demo') ? 'Demorežiim' : 'Seade puudub');

                      return (
                        <div
                          key={v.id}
                          className={`v-indiv-row ${!isMapVisible ? 'is-hidden-map' : ''} ${isTrackActive ? 'is-sim-active' : ''}`}
                        >
                          <div className="v-indiv-info" title={`${v.name} (${deviceLabel})`}>
                            <span className="v-indiv-emoji">{iconEmoji}</span>
                            <div className="v-indiv-names">
                              <span className="v-indiv-title">{v.name}</span>
                              <span className="v-indiv-subtitle">{deviceLabel}</span>
                            </div>
                          </div>

                          <div className="v-indiv-actions">
                            {/* Simulaatori lüliti */}
                            {onToggleVehicleSimulator && (
                              <button
                                type="button"
                                className={`v-action-btn v-sim-btn ${isSimActive ? 'active' : ''}`}
                                title={isSimActive ? 'Lülita simulaator välja' : `Käivita simulaator (${v.name})`}
                                onClick={() => onToggleVehicleSimulator(v.id)}
                              >
                                <Play size={10} fill={isSimActive ? 'currentColor' : 'none'} />
                                <span>Sim</span>
                              </button>
                            )}

                            {/* Kogu sõidetud rada ja haritud ala korraga (ilma taasesituseta) */}
                            {onToggleVehicleFullTrack && (
                              <button
                                type="button"
                                className={`v-action-btn v-sim-btn ${isFullTrackActive ? 'active' : ''}`}
                                title={isFullTrackActive ? 'Peida sõidetud rada' : `Kuva kogu sõidetud rada ja haritud ala (${v.name})`}
                                onClick={() => onToggleVehicleFullTrack(v.id)}
                              >
                                <Route size={10} />
                                <span>Rada</span>
                              </button>
                            )}

                            {/* Kaardil kuvamise lüliti */}
                            {onToggleVehicleMap && (
                              <button
                                type="button"
                                className={`v-action-btn v-map-btn ${isMapVisible ? 'active' : ''}`}
                                title={isMapVisible ? `Peida ${v.name} kaardilt` : `Kuva ${v.name} kaardil`}
                                onClick={() => onToggleVehicleMap(v.id)}
                              >
                                {isMapVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* POI / Infrastructure */}
              <div className="layer-item">
                <label className="layer-label">
                  <input
                    type="checkbox"
                    checked={visibility.poi}
                    onChange={() => onToggleLayer('poi')}
                  />
                  <span className="layer-color-indicator poi-color"></span>
                  <span className="layer-text">Olulised asukohad</span>
                </label>
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('poi')}
                  title={visibility.poi ? 'Peida' : 'Näita'}
                >
                  {visibility.poi ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Fit Action */}
          {onFitAll && (
            <div className="layer-fit-section">
              <button
                className="btn btn-secondary btn-full btn-sm"
                onClick={onFitAll}
                title="Kohanda kaardi vaade kõigi aktiivsete kihtide elementide mahutamiseks"
              >
                <Maximize2 size={14} className="text-emerald" />
                <span>Mahuta valitud kihid ekraanile</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
