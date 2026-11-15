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
  Loader2
} from 'lucide-react';
import type { BaseMapLayerId, LayerVisibility } from '../types/map';
import type { SoilSampleMetricKey } from '../types/soilSample';
import type { EnrichedVehicle } from '../types/fleet';
import { SOIL_METRIC_CONFIG, getSoilMetricColor, AGE_MAX_YEARS } from '../types/soilSample';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { Button, CheckboxField, RadioGroup, RadioField } from './ui';

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

  // Litsentsi moodulid: puuduva mooduli kihi rida ei näidata
  modules?: { telemetry: boolean; satellite: boolean; weather: boolean };
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
  onToggleTrackVisibility,
  modules = { telemetry: true, satellite: true, weather: true }
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
        <Button variant="ghost" size="icon-sm" title={isOpen ? 'Ahenda' : 'Laienda'}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
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
            <CheckboxField
              className="layer-label basemap-cadastre-toggle"
              checked={visibility.cadastre}
              onCheckedChange={() => onToggleLayer('cadastre')}
              label={
                <span className="layer-label-content">
                  <span className="layer-color-indicator cadastre-color"></span>
                  <span className="layer-text">Katastripiirid</span>
                </span>
              }
            />
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
                  <CheckboxField
                    className="layer-label"
                    checked={visibility.fields}
                    onCheckedChange={() => onToggleLayer('fields')}
                    label={
                      <span className="layer-label-content">
                        <span className="layer-color-indicator fields-color"></span>
                        <span className="layer-text">Põllud</span>
                      </span>
                    }
                  />
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('fields')}
                    title={visibility.fields ? 'Peida' : 'Näita'}
                  >
                    {visibility.fields ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {visibility.fields && (
                  <div className="layer-sub-options">
                    <CheckboxField
                      className="soil-metric-radio-item"
                      checked={visibility.fieldLabels}
                      onCheckedChange={() => onToggleLayer('fieldLabels')}
                      label="Põllunumbrid"
                    />
                    <CheckboxField
                      className="soil-metric-radio-item"
                      checked={visibility.blockLabels}
                      onCheckedChange={() => onToggleLayer('blockLabels')}
                      label="Massiivi numbrid"
                    />
                  </div>
                )}
              </div>

              {/* Soil Samples — linnutamata lihtne rida, linnutatuna statistika ja näitaja valik */}
              <div className="layer-field-box">
                <div className="layer-item">
                  <CheckboxField
                    className="layer-label"
                    checked={visibility.soilSamples}
                    onCheckedChange={() => onToggleLayer('soilSamples')}
                    label={
                      <span className="layer-label-content">
                        <span className="layer-color-indicator soil-color"></span>
                        <span className="layer-text">Mullaproovid</span>
                      </span>
                    }
                  />
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('soilSamples')}
                    title={visibility.soilSamples ? 'Peida' : 'Näita'}
                  >
                    {visibility.soilSamples ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {visibility.soilSamples && onSelectSoilMetric && (
                  <div className="layer-sub-options">
                    <span className="layer-subtext">{soilSampleCount} punkti kokku, {soilFieldCount} massiivil</span>
                    <div className="vehicle-filter-subgroup">
                      <RadioGroup
                        className="soil-metric-radio-list"
                        orientation="vertical"
                        value={soilMetric}
                        onValueChange={(v) => onSelectSoilMetric(v as SoilSampleMetricKey)}
                        aria-label="Mullaproovi näitaja"
                      >
                        {(Object.keys(SOIL_METRIC_CONFIG) as SoilSampleMetricKey[]).map((key) => (
                          <RadioField key={key} value={key} label={SOIL_METRIC_CONFIG[key].label} />
                        ))}
                      </RadioGroup>

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
                  </div>
                )}
              </div>

              {/* Machinery / Vehicles — masinate viimased teadaolevad asukohad */}
              {modules.telemetry && (
              <div className="layer-field-box">
                <div className="layer-item">
                  <CheckboxField
                    className="layer-label"
                    checked={visibility.vehicles}
                    onCheckedChange={() => onToggleLayer('vehicles')}
                    label={
                      <span className="layer-label-content">
                        <span className="layer-color-indicator tech-color"></span>
                        <span className="layer-text">Masinapark</span>
                      </span>
                    }
                  />
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('vehicles')}
                    title={visibility.vehicles ? 'Peida' : 'Näita'}
                  >
                    {visibility.vehicles ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              </div>
              )}

              {/* Põllutööd — linnutatuna kõigi masinate rajad kaardil, masinate kaupa peitmine ja taasesitus */}
              {modules.telemetry && (
              <div className="layer-field-box">
                <div className="layer-item">
                  <CheckboxField
                    className="layer-label"
                    checked={visibility.cultivation}
                    onCheckedChange={() => onToggleLayer('cultivation')}
                    label={
                      <span className="layer-label-content">
                        <span className="layer-color-indicator cultivation-color"></span>
                        <span className="layer-text">Põllutööd</span>
                        {visibility.cultivation && isLoadingVehicleTracks && (
                          <Loader2 size={14} className="layer-loading-spinner" aria-label="Radade laadimine" />
                        )}
                      </span>
                    }
                  />
                  <button
                    className="icon-toggle"
                    onClick={() => onToggleLayer('cultivation')}
                    title={visibility.cultivation ? 'Peida' : 'Näita'}
                  >
                    {visibility.cultivation ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {visibility.cultivation && (
                  <div className="layer-sub-options">
                    {isLoadingVehicleTracks ? (
                      <div className="layer-loading" role="status">
                        <span className="layer-subtext">Masinate radade laadimine ja arvutamine…</span>
                        <div className="layer-loading-bar" />
                      </div>
                    ) : (
                      <span className="layer-subtext">{trackVehicleIds?.size ?? 0} masina rajad</span>
                    )}
                    {vehicles.length > 0 && (
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
                )}
              </div>
              )}

              {/* POI / Infrastructure */}
              <div className="layer-item">
                <CheckboxField
                  className="layer-label"
                  checked={visibility.poi}
                  onCheckedChange={() => onToggleLayer('poi')}
                  label={
                    <span className="layer-label-content">
                      <span className="layer-color-indicator poi-color"></span>
                      <span className="layer-text">Muud asukohad</span>
                    </span>
                  }
                />
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('poi')}
                  title={visibility.poi ? 'Peida' : 'Näita'}
                >
                  {visibility.poi ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>

              {/* Sajuradar — Keskkonnaagentuuri radarite koondpilt, uueneb iga 5 min */}
              {modules.weather && (
              <div className="layer-item">
                <CheckboxField
                  className="layer-label"
                  checked={visibility.weatherRadar}
                  onCheckedChange={() => onToggleLayer('weatherRadar')}
                  label={
                    <span className="layer-label-content">
                      <span className="layer-color-indicator weather-color"></span>
                      <span className="layer-text">Sajuradar</span>
                    </span>
                  }
                />
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('weatherRadar')}
                  title={visibility.weatherRadar ? 'Peida' : 'Näita'}
                >
                  {visibility.weatherRadar ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
              )}

              {/* Satelliidipilt — Maa- ja Ruumiameti Satiladu (Sentinel-2), kuupäeva valik kaardil */}
              {modules.satellite && (
              <div className="layer-item">
                <CheckboxField
                  className="layer-label"
                  checked={visibility.satellite}
                  onCheckedChange={() => onToggleLayer('satellite')}
                  label={
                    <span className="layer-label-content">
                      <span className="layer-color-indicator satellite-color"></span>
                      <span className="layer-text">Satelliidipilt</span>
                    </span>
                  }
                />
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('satellite')}
                  title={visibility.satellite ? 'Peida' : 'Näita'}
                >
                  {visibility.satellite ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
              )}
            </div>
          </div>

          {/* Quick Fit Action */}
          {onFitAll && (
            <div className="layer-fit-section">
              <Button
                size="sm"
                className="btn-full"
                onClick={onFitAll}
                title="Kohanda kaardi vaade kõigi aktiivsete kihtide elementide mahutamiseks"
              >
                <Maximize2 size={14} className="text-emerald" />
                <span>Mahuta valitud kihid ekraanile</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
