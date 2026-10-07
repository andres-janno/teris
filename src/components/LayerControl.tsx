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
  Play
} from 'lucide-react';
import type { BaseMapLayerId, LayerVisibility } from '../types/map';
import type { SoilSampleMetricKey } from '../types/soilSample';
import type { EnrichedVehicle } from '../types/fleet';
import { SOIL_METRIC_CONFIG, getSoilMetricColor, AGE_MAX_YEARS } from '../types/soilSample';
import { BASE_MAPS } from '../services/maaAmetLayers';

interface LayerControlProps {
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onSelectBaseMap: (id: BaseMapLayerId) => void;
  onFitAll?: () => void;
  soilSampleCount?: number;
  soilFieldCount?: number;
  soilMetric?: SoilSampleMetricKey;
  onSelectSoilMetric?: (metric: SoilSampleMetricKey) => void;

  // Põllutööd: masinate rajad ja taasesitus
  vehicles?: EnrichedVehicle[];
  simulatedVehicleId?: string | null;
  onToggleVehicleSimulator?: (vehicleId: string) => void;
  trackVehicleIds?: Set<string>;
  isLoadingVehicleTracks?: boolean;
  hiddenTrackVehicleIds?: Set<string>;
  onToggleTrackVisibility?: (vehicleId: string) => void;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  visibility,
  onToggleLayer,
  onSelectBaseMap,
  onFitAll,
  soilSampleCount = 0,
  soilFieldCount = 0,
  soilMetric = 'ph',
  onSelectSoilMetric,
  vehicles = [],
  simulatedVehicleId,
  onToggleVehicleSimulator,
  trackVehicleIds,
  isLoadingVehicleTracks = false,
  hiddenTrackVehicleIds,
  onToggleTrackVisibility
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

              {/* Soil Samples — linnutamata lihtne rida, linnutatuna statistika ja näitaja valik */}
              <div className={visibility.soilSamples ? 'layer-box-group' : 'layer-field-box'}>
                <div className="layer-item">
                  <label className="layer-label">
                    <input
                      type="checkbox"
                      checked={visibility.soilSamples}
                      onChange={() => onToggleLayer('soilSamples')}
                    />
                    <span className="layer-color-indicator soil-color"></span>
                    {visibility.soilSamples ? (
                      <span className="layer-text-wrap">
                        <span className="layer-text">METK Mullaproovid</span>
                        <span className="layer-subtext">{soilSampleCount} punkti kokku, {soilFieldCount} massiivil</span>
                      </span>
                    ) : (
                      <span className="layer-text">METK Mullaproovid</span>
                    )}
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

              {/* Põllutööd — linnutatuna kõigi masinate rajad kaardil, masinate kaupa peitmine ja taasesitus */}
              <div className={visibility.cultivation ? 'layer-box-group' : 'layer-field-box'}>
                <div className="layer-item">
                  <label className="layer-label">
                    <input
                      type="checkbox"
                      checked={visibility.cultivation}
                      onChange={() => onToggleLayer('cultivation')}
                    />
                    <span className="layer-color-indicator cultivation-color"></span>
                    {visibility.cultivation ? (
                      <span className="layer-text-wrap">
                        <span className="layer-text">Põllutööd</span>
                        <span className="layer-subtext">
                          {isLoadingVehicleTracks ? 'Radade laadimine…' : `${trackVehicleIds?.size ?? 0} masina rajad`}
                        </span>
                      </span>
                    ) : (
                      <span className="layer-text">Põllutööd</span>
                    )}
                  </label>
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('cultivation')}
                    title={visibility.cultivation ? 'Peida' : 'Näita'}
                  >
                    {visibility.cultivation ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {visibility.cultivation && vehicles.length > 0 && (
                  <div className="vehicle-individual-list">
                    {vehicles.map((v) => {
                      const isSimActive = simulatedVehicleId === v.id;
                      const hasTrack = trackVehicleIds?.has(v.id) ?? false;
                      const isTrackVisible = hasTrack && !hiddenTrackVehicleIds?.has(v.id);
                      const iconEmoji = v.type === 'combine' ? '🌾' : (v.type === 'sprayer' ? '🚿' : (v.type === 'truck' ? '🚛' : '🚜'));
                      const deviceLabel = v.telemetry?.deviceId && v.telemetry.deviceId !== 'PAIGALDAMATA'
                        ? v.telemetry.deviceId
                        : (v.id.includes('demo') || v.name.toLowerCase().includes('demo') ? 'Demorežiim' : 'Seade puudub');

                      return (
                        <div
                          key={v.id}
                          className={`v-indiv-row ${hasTrack && !isTrackVisible ? 'is-hidden-map' : ''} ${isSimActive ? 'is-sim-active' : ''}`}
                        >
                          <div className="v-indiv-info" title={`${v.name} (${deviceLabel})`}>
                            <span className="v-indiv-emoji">{iconEmoji}</span>
                            <div className="v-indiv-names">
                              <span className="v-indiv-title">{v.name}</span>
                              <span className="v-indiv-subtitle">{deviceLabel}</span>
                            </div>
                          </div>

                          <div className="v-indiv-actions">
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

                            {onToggleTrackVisibility && (
                              <button
                                type="button"
                                className={`v-action-btn v-map-btn ${isTrackVisible ? 'active' : ''}`}
                                title={!hasTrack
                                  ? (isLoadingVehicleTracks ? 'Rada laaditakse…' : 'GPS-rada puudub')
                                  : (isTrackVisible ? `Peida ${v.name} rada` : `Kuva ${v.name} rada`)}
                                onClick={() => onToggleTrackVisibility(v.id)}
                                disabled={!hasTrack}
                              >
                                {isTrackVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Machinery / Vehicles — masinate viimased teadaolevad asukohad */}
              <div className="layer-field-box">
                <div className="layer-item">
                  <label className="layer-label">
                    <input
                      type="checkbox"
                      checked={visibility.vehicles}
                      onChange={() => onToggleLayer('vehicles')}
                    />
                    <span className="layer-color-indicator tech-color"></span>
                    <span className="layer-text">Masinapark</span>
                  </label>
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('vehicles')}
                    title={visibility.vehicles ? 'Peida' : 'Näita'}
                  >
                    {visibility.vehicles ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
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
