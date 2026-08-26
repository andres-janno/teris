// src/components/FieldDetailsDrawer.tsx
import React from 'react';
import {
  X,
  FileText,
  ExternalLink,
  Activity,
  Crosshair
} from 'lucide-react';
import type { FieldFeature } from '../types/field';

interface FieldDetailsDrawerProps {
  field: FieldFeature | null;
  onClose: () => void;
  onFocusField: (field: FieldFeature) => void;
}

export const FieldDetailsDrawer: React.FC<FieldDetailsDrawerProps> = ({
  field,
  onClose,
  onFocusField
}) => {
  if (!field) return null;

  const props = field.properties;
  const progress = props.workProgress || 0;

  return (
    <div className="field-drawer glass-card animate-slide-in">
      <div className="drawer-header">
        <div className="drawer-title-group">
          <div className="crop-indicator-dot" style={{ backgroundColor: props.cropColor || '#22c55e' }}></div>
          <div>
            <h3 className="field-title">{props.name}</h3>
            <div className="field-code-row">
              <span className="field-id-badge" title="Sisemine ID">#{props.id}</span>
              {props.num && (
                <span className="field-num-badge" title="Põllu number">Nr {props.num}</span>
              )}
              <span className="field-code" title="PRIA massiivi number">{props.fieldCode || 'puudub'}</span>
            </div>
          </div>
        </div>
        <div className="header-button-group">
          <button
            className="icon-btn-ghost"
            onClick={() => onFocusField(field)}
            title="Keskenda kaardil"
          >
            <Crosshair size={18} />
          </button>
          <button className="icon-btn-ghost" onClick={onClose} title="Sulge">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="drawer-body">
        {/* Main stats card */}
        <div className="field-stats-grid">
          <div className="field-stat-item">
            <span className="stat-label">Pindala</span><br></br>
            <strong className="stat-value">{props.areaHa} ha</strong>
          </div>
          <div className="field-stat-item">
            <span className="stat-label">Kultuur</span><br></br>
            <strong className="stat-value">{props.crop || 'Määramata'}</strong>
          </div>
          <div className="field-stat-item">
            <span className="stat-label">Haritud</span><br></br>
            <strong className="stat-value text-emerald">{(props.workedAreaHa || 0).toFixed(2)} ha</strong>
          </div>
          <div className="field-stat-item">
            <span className="stat-label">Staatus</span>
            <strong className="stat-value">
              {progress >= 100 ? '✅ Valmis' : (progress > 0 ? '🔄 Töös' : '⏳ Alustamata')}
            </strong>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="field-progress-container">
          <div className="progress-labels">
            <span>Põllu harimise progress</span>
            <strong>{progress}%</strong>
          </div>
          <div className="drawer-progress-track">
            <div
              className="drawer-progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Cadastral information */}
        {props.cadastralCode && (
          <div className="detail-section">
            <div className="section-subtitle">
              <FileText size={14} />
              <span>Maa-ameti katastriinfo</span>
            </div>
            <div className="cadastre-box">
              <div className="cadastre-row">
                <span>Katastritunnus:</span>
                <code>{props.cadastralCode}</code>
              </div>
              <a
                href={`https://xgis.maaamet.ee/ky/FindKYByTunnus.aspx?ky=${props.cadastralCode}`}
                target="_blank"
                rel="noreferrer"
                className="cadastre-link"
              >
                <span>Ava Maa-ameti X-GIS kaardil</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        {props.notes && (
          <div className="detail-section">
            <div className="section-subtitle">
              <Activity size={14} />
              <span>Märkmed ja agrotehnika</span>
            </div>
            <p className="notes-text">{props.notes}</p>
          </div>
        )}
      </div>

      <div className="drawer-footer">
        <button className="btn btn-primary btn-full" onClick={() => onFocusField(field)}>
          <Crosshair size={16} />
          <span>Fookusta põld kaardil</span>
        </button>
      </div>
    </div>
  );
};
