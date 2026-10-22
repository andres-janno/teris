import React, { useState, useEffect } from 'react';
import { X, Crosshair, Lock, CalendarDays } from 'lucide-react';
import type { FieldFeature } from '../types/field';
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import { getFieldFeatureForYear } from '../types/fieldRegister';
import { FieldOperationsSection } from './FieldOperationsSection';
import { FieldOverviewPanel } from './FieldOverviewPanel';
import type { SoilSample } from '../types/soilSample';

interface FieldDetailsDrawerProps {
  field: FieldFeature | null;       // põld kaardil kuvatava aasta andmetega
  masterField?: MasterField | null; // kõigi aastate andmed akna hooajavaliku jaoks
  seasons?: FarmingSeason[];
  soilSamples?: SoilSample[];
  /** Kaardil valitud satelliidipildi kuupäev (kui kiht on sees) — põllu NDVI selle päeva pildist */
  satelliteDate?: string | null;
  onClose: () => void;
  onFocusField: (field: FieldFeature) => void;
}

export const FieldDetailsDrawer: React.FC<FieldDetailsDrawerProps> = ({
  field,
  masterField = null,
  seasons = [],
  soilSamples = [],
  satelliteDate = null,
  onClose,
  onFocusField
}) => {
  const mapYear = field?.properties.year;
  // Akna hooaeg on kaardist sõltumatu; uue põllu avamisel alustatakse kaardi aastast.
  const [viewYear, setViewYear] = useState<number | undefined>(mapYear);

  useEffect(() => {
    setViewYear(mapYear);
  }, [field?.properties.id, mapYear]);

  useEffect(() => {
    if (!field) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [field, onClose]);

  if (!field) return null;

  const years = masterField
    ? [...new Set(masterField.history.map((h) => h.year))].sort((a, b) => a - b)
    : [];
  const shown =
    masterField && viewYear !== undefined && viewYear !== mapYear && years.includes(viewYear)
      ? getFieldFeatureForYear(masterField, viewYear)
      : field;

  const focusAndClose = () => {
    onFocusField(shown);
    onClose();
  };

  const props = shown.properties;
  const isSeasonLocked = seasons.find((s) => s.year === props.year)?.isLocked ?? false;
  return (
    <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-content field-detail-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header field-detail-header">
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
            onClick={focusAndClose}
            title="Keskenda kaardil"
          >
            <Crosshair size={18} />
          </button>
          <button className="icon-btn-ghost" onClick={onClose} title="Sulge">
            <X size={18} />
          </button>
        </div>
      </div>

      {years.length > 1 && (
        <div className="field-detail-seasons">
          <CalendarDays size={14} />
          <span className="field-detail-seasons-label">Hooaeg:</span>
          {years.map((y) => {
            const locked = seasons.find((s) => s.year === y)?.isLocked ?? false;
            return (
              <button
                key={y}
                type="button"
                className={`field-season-chip ${y === props.year ? 'active' : ''}`}
                onClick={() => setViewYear(y)}
                title={locked ? `Hooaeg ${y} on lukus` : `Näita hooaega ${y}`}
              >
                <span>{y}</span>
                {locked && <Lock size={11} />}
              </button>
            );
          })}
        </div>
      )}

      <div className="field-detail-columns">
      <div className="field-detail-col">
        {isSeasonLocked && (
          <div className="drawer-season-locked-alert">
            <Lock size={13} />
            <span>Hooaeg {props.year || 2026} on muudatusteks suletud (arhiiv).</span>
          </div>
        )}

        <FieldOverviewPanel shown={shown} soilSamples={soilSamples} satelliteDate={satelliteDate} />
      </div>

      <div className="field-detail-col field-detail-col-ops">
        {props.year ? (
          <FieldOperationsSection fieldId={props.id} year={props.year} fill />
        ) : (
          <p className="notes-text">Hooaeg puudub — põllutöid ei saa kuvada.</p>
        )}
      </div>
      </div>

      <div className="drawer-footer field-detail-footer">
        <button className="btn btn-primary" onClick={focusAndClose}>
          <Crosshair size={16} />
          <span>Fookusta põld kaardil</span>
        </button>
      </div>
    </div>
    </div>
  );
};

