// src/components/LayerControl.tsx
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
  Calendar
} from 'lucide-react';
import type { BaseMapLayerId, LayerVisibility } from '../types/map';
import { BASE_MAPS } from '../services/maaAmetLayers';

interface LayerControlProps {
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onSelectBaseMap: (id: BaseMapLayerId) => void;
  onFitAll?: () => void;
  selectedYear?: number;
  onSelectYear?: (year: number) => void;
  availableYears?: number[];
}

export const LayerControl: React.FC<LayerControlProps> = ({
  visibility,
  onToggleLayer,
  onSelectBaseMap,
  onFitAll,
  selectedYear,
  onSelectYear,
  availableYears = [2026, 2025, 2024, 2023]
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={`layer-control-panel glass-card ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="layer-control-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="layer-header-title">
          <Layers size={18} className="text-emerald" />
          <span>Kaardikihid & Aluskaart</span>
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
              <span>Maa-ameti aluskaart</span>
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

                {/* Year Selector Under PRIA Fields */}
                {visibility.fields && selectedYear && onSelectYear && (
                  <div className="layer-year-selector">
                    <div className="year-selector-title">
                      <Calendar size={11} className="text-emerald" />
                      <span>Hooaeg / Aasta:</span>
                    </div>
                    <div className="layer-year-pills">
                      {availableYears.map((yr) => (
                        <button
                          key={yr}
                          className={`layer-year-pill ${selectedYear === yr ? 'active' : ''}`}
                          onClick={() => onSelectYear(yr)}
                          title={`Kuva põldude andmed ja külvikord ${yr}. aasta seisuga`}
                        >
                          {yr}
                        </button>
                      ))}
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
                  <span className="layer-text">Haritud ala (Teltonika)</span>
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
              <div className="layer-item">
                <label className="layer-label">
                  <input
                    type="checkbox"
                    checked={visibility.vehicles}
                    onChange={() => onToggleLayer('vehicles')}
                  />
                  <span className="layer-color-indicator tech-color"></span>
                  <span className="layer-text">Masinapark (GPS)</span>
                </label>
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('vehicles')}
                  title={visibility.vehicles ? 'Peida' : 'Näita'}
                >
                  {visibility.vehicles ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
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
                  <span className="layer-text">Olulised asukohad (POI)</span>
                </label>
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('poi')}
                  title={visibility.poi ? 'Peida' : 'Näita'}
                >
                  {visibility.poi ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>

              {/* Cadastre WMS */}
              <div className="layer-item">
                <label className="layer-label">
                  <input
                    type="checkbox"
                    checked={visibility.cadastre}
                    onChange={() => onToggleLayer('cadastre')}
                  />
                  <span className="layer-color-indicator cadastre-color"></span>
                  <span className="layer-text">Maa-amet Katastripiirid</span>
                </label>
                <button
                  className="icon-toggle"
                  onClick={() => onToggleLayer('cadastre')}
                  title={visibility.cadastre ? 'Peida' : 'Näita'}
                >
                  {visibility.cadastre ? <Eye size={15} /> : <EyeOff size={15} />}
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
