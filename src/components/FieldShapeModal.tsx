// src/components/FieldShapeModal.tsx — ühe põllu ühe aasta kuju väikesel kaardil (põldude registri peal).
import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { Map as MapIcon } from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { BaseMapLayerId } from '../types/map';
import { DEFAULT_CROP_COLOR } from '../lib/dataColors';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { Dialog, DialogContent, DialogHeader, DialogBody } from './ui';

interface FieldShapeModalProps {
  field: MasterField;
  record: FieldYearlyRecord;
  baseMap: BaseMapLayerId;
  onClose: () => void;
}

export const FieldShapeModal: React.FC<FieldShapeModalProps> = ({ field, record, baseMap, onClose }) => {
  // Dialoogi sisu mountub Radixi portaali kaudu alles pärast esimest efekti, seepärast hoiame kaardi elementi olekus.
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const geometry = record.geometry;

  useEffect(() => {
    if (!mapEl || !geometry) return;
    const map = L.map(mapEl, { zoomControl: true, attributionControl: true });
    const base = BASE_MAPS[baseMap] || BASE_MAPS['maaamet-pohikaart'];
    L.tileLayer(base.url, {
      tms: base.tms ?? false,
      attribution: base.attribution,
      maxZoom: base.maxZoom || 19,
      minZoom: base.minZoom || 5,
      subdomains: base.subdomains || []
    }).addTo(map);
    const shape = L.geoJSON(geometry as GeoJSON.GeoJsonObject, {
      style: { color: record.cropColor || DEFAULT_CROP_COLOR, weight: 3, fillOpacity: 0.3 }
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
  }, [mapEl, geometry, baseMap, record.cropColor]);

  const title = `${field.num ? `Nr ${field.num} ` : ''}${field.name} · ${record.year}`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader
          icon={<MapIcon size={20} />}
          title={title}
          description={`${record.areaHa.toFixed(2)} ha · ${record.crop}${record.cropVariety ? ` (${record.cropVariety})` : ''}`}
        />
        <DialogBody className="p-0">
          {geometry ? (
            <div ref={setMapEl} className="h-[min(60vh,520px)] w-full" />
          ) : (
            <div className="px-4 py-8 text-center text-muted-foreground">Selle aasta kirjel pole põllu kuju.</div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
