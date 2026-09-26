// src/components/FieldShapeModal.tsx — ühe põllu ühe aasta kuju väikesel kaardil (põldude registri peal).
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { X, Map as MapIcon } from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { BaseMapLayerId } from '../types/map';
import { BASE_MAPS } from '../services/maaAmetLayers';

interface FieldShapeModalProps {
  field: MasterField;
  record: FieldYearlyRecord;
  baseMap: BaseMapLayerId;
  onClose: () => void;
  onOpenOnMap: () => void;
}

export const FieldShapeModal: React.FC<FieldShapeModalProps> = ({ field, record, baseMap, onClose, onOpenOnMap }) => {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const geometry = record.geometry;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (!mapDivRef.current || !geometry) return;
    const map = L.map(mapDivRef.current, { zoomControl: true, attributionControl: true });
    const base = BASE_MAPS[baseMap] || BASE_MAPS['maaamet-pohikaart'];
    L.tileLayer(base.url, {
      tms: base.tms ?? false,
      attribution: base.attribution,
      maxZoom: base.maxZoom || 19,
      minZoom: base.minZoom || 5,
      subdomains: base.subdomains || []
    }).addTo(map);
    const shape = L.geoJSON(geometry as GeoJSON.GeoJsonObject, {
      style: { color: record.cropColor || '#16a34a', weight: 3, fillOpacity: 0.3 }
    }).addTo(map);
    map.fitBounds(shape.getBounds(), { padding: [24, 24], maxZoom: 18 });
    // Akna avanemisanimatsiooni ajal on konteineri suurus veel muutumas.
    const t = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(shape.getBounds(), { padding: [24, 24], maxZoom: 18 });
    }, 250);
    return () => {
      window.clearTimeout(t);
      map.remove();
    };
  }, [geometry, baseMap, record.cropColor]);

  const title = `${field.num ? `Nr ${field.num} ` : ''}${field.name} · ${record.year}`;

  return createPortal(
    <div className="modal-backdrop sub-modal" onClick={onClose}>
      <div className="modal-content field-shape-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <MapIcon className="text-emerald" size={20} />
            <div>
              <h3>{title}</h3>
              <p className="modal-subtitle">
                {record.areaHa.toFixed(2)} ha · {record.crop}
                {record.cropVariety ? ` (${record.cropVariety})` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body field-shape-body">
          {geometry ? (
            <div ref={mapDivRef} className="field-shape-map" />
          ) : (
            <div className="field-shape-empty">Selle aasta kirjel pole põllu kuju.</div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Sulge</button>
          {geometry && (
            <button type="button" className="btn btn-secondary" onClick={onOpenOnMap}>
              <MapIcon size={16} />
              <span>Ava põhikaardil</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
