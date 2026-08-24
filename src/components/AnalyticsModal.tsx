// src/components/AnalyticsModal.tsx
import React from 'react';
import { 
  X, 
  BarChart3, 
  PieChart, 
  Layers, 
  Activity, 
  Fuel, 
  Tractor, 
  Download
} from 'lucide-react';
import type { FieldCollection } from '../types/field';
import type { Vehicle } from '../types/vehicle';
import type { CultivationPass } from '../types/telemetry';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: FieldCollection;
  vehicles: Vehicle[];
  cultivationPass: CultivationPass;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  fields,
  vehicles,
  cultivationPass
}) => {
  if (!isOpen) return null;

  const totalFieldsHa = fields.features.reduce((sum, f) => sum + (f.properties.areaHa || 0), 0);
  const totalWorkedHa = fields.features.reduce((sum, f) => sum + (f.properties.workedAreaHa || 0), 0) + (cultivationPass.workedAreaHa || 0);
  const totalWorkedHaClamped = Math.min(totalFieldsHa, Math.round(totalWorkedHa * 100) / 100);
  const overallProgressPct = totalFieldsHa > 0 ? Math.round((totalWorkedHaClamped / totalFieldsHa) * 100) : 0;

  // Crops breakdown
  const cropsMap: Record<string, { count: number; ha: number; color: string }> = {};
  fields.features.forEach((f) => {
    const cropName = f.properties.crop || 'Muu';
    if (!cropsMap[cropName]) {
      cropsMap[cropName] = { count: 0, ha: 0, color: f.properties.cropColor || '#3b82f6' };
    }
    cropsMap[cropName].count++;
    cropsMap[cropName].ha += f.properties.areaHa || 0;
  });

  const handleExportGeoJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fields, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'agrimap_polllud_export.geojson');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card analytics-modal animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <BarChart3 className="text-emerald" size={24} />
            <div>
              <h3>Põllumajanduse ja Agrotehnika Analüütika</h3>
              <p className="modal-subtitle">Põldude pindalad, kultuuride jaotus, Teltonika harimise progress ja masinapark</p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* High level KPI cards */}
          <div className="kpi-grid">
            <div className="kpi-card glass-card">
              <div className="kpi-icon-wrap bg-blue-subtle">
                <Layers className="text-blue" size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Põldude kogupindala</span>
                <div className="kpi-value">{totalFieldsHa.toFixed(1)} <span className="kpi-unit">ha</span></div>
                <span className="kpi-sub">{fields.features.length} põllumassiivi</span>
              </div>
            </div>

            <div className="kpi-card glass-card">
              <div className="kpi-icon-wrap bg-emerald-subtle">
                <Activity className="text-emerald" size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Haritud pindala</span>
                <div className="kpi-value text-emerald">{totalWorkedHaClamped.toFixed(1)} <span className="kpi-unit">ha</span></div>
                <span className="kpi-sub">{overallProgressPct}% hooaja mahust</span>
              </div>
            </div>

            <div className="kpi-card glass-card">
              <div className="kpi-icon-wrap bg-amber-subtle">
                <Tractor className="text-amber" size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Masinapark</span>
                <div className="kpi-value">{vehicles.length} <span className="kpi-unit">ühikut</span></div>
                <span className="kpi-sub">
                  {vehicles.filter(v => v.status === 'working' || v.status === 'moving').length} töös / aktiivne
                </span>
              </div>
            </div>

            <div className="kpi-card glass-card">
              <div className="kpi-icon-wrap bg-purple-subtle">
                <Fuel className="text-purple" size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Kütuse keskmine tase</span>
                <div className="kpi-value">
                  {Math.round(vehicles.reduce((sum, v) => sum + v.telemetry.fuelLevelPct, 0) / (vehicles.length || 1))}%
                </div>
                <span className="kpi-sub">Teltonika CAN andmetel</span>
              </div>
            </div>
          </div>

          {/* Crops breakdown */}
          <div className="analytics-section">
            <h4 className="section-heading">
              <PieChart size={16} className="text-emerald" />
              <span>Kultuuride jaotus (Pindalad ha)</span>
            </h4>

            <div className="crops-breakdown-list">
              {Object.entries(cropsMap).map(([cropName, data]) => {
                const pct = totalFieldsHa > 0 ? Math.round((data.ha / totalFieldsHa) * 100) : 0;
                return (
                  <div key={cropName} className="crop-bar-item">
                    <div className="crop-bar-header">
                      <div className="crop-name-wrap">
                        <span className="crop-dot" style={{ backgroundColor: data.color }}></span>
                        <strong>{cropName}</strong>
                        <span className="crop-count-badge">{data.count} põldu</span>
                      </div>
                      <div className="crop-ha-wrap">
                        <strong>{data.ha.toFixed(1)} ha</strong>
                        <span className="crop-pct">({pct}%)</span>
                      </div>
                    </div>
                    <div className="crop-bar-track">
                      <div 
                        className="crop-bar-fill" 
                        style={{ width: `${pct}%`, backgroundColor: data.color }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleExportGeoJson}>
            <Download size={16} />
            <span>Ekspordi põllud GeoJSONina</span>
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Sulge
          </button>
        </div>
      </div>
    </div>
  );
};
