// src/components/WeatherPointMap.tsx — ilmavaate kaart: ERA5-Landi ruudud (0,1°) ja põllud ruudu värviga; klikk valib ilmapunkti.
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { WeatherMap, WeatherPointInfo, WeatherPointRef } from '../types/weather';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { pointColor } from '../services/weatherFormat';
const HALF = 0.05; // ruudu keskpunktist servani

interface Props {
  points: WeatherPointInfo[];
  fields: WeatherMap | null;
  selected: WeatherPointRef;
  onSelect: (p: WeatherPointRef) => void;
}

export const WeatherPointMap: React.FC<Props> = ({ points, fields, selected, onSelect }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!divRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    const base = BASE_MAPS['maaamet-pohikaart'];
    L.tileLayer(base.url, { tms: base.tms ?? false, attribution: base.attribution, maxZoom: base.maxZoom || 19, minZoom: base.minZoom || 5, subdomains: base.subdomains || [] }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(divRef.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; layerRef.current = null; fittedRef.current = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, group = layerRef.current;
    if (!map || !group || !points.length) return;
    group.clearLayers();
    const isSel = (id: number) => selected === 'all' || selected === id;
    // Uuesti klõps valitud punktil viib tagasi majandi keskmisele
    const pick = (id: number) => onSelectRef.current(selected === id ? 'all' : id);
    const bounds = L.latLngBounds([]);
    for (const p of points) {
      const c = pointColor(points, p.id);
      const cell = L.rectangle([[p.lat - HALF, p.lon - HALF], [p.lat + HALF, p.lon + HALF]], {
        color: c, weight: selected === p.id ? 3 : 1.5, dashArray: selected === p.id ? undefined : '4 4',
        fillColor: c, fillOpacity: isSel(p.id) ? 0.08 : 0.02, opacity: isSel(p.id) ? 1 : 0.4
      });
      cell.bindTooltip(`${p.lat.toFixed(1)}° N, ${p.lon.toFixed(1)}° E · ${p.fieldCount} põldu`, { sticky: true });
      cell.on('click', () => pick(p.id));
      cell.addTo(group);
      bounds.extend(cell.getBounds());
    }
    if (fields) {
      L.geoJSON(fields, {
        style: (f) => {
          const id = f?.properties.pointId as number;
          return { color: pointColor(points, id), weight: 1, fillColor: pointColor(points, id), fillOpacity: isSel(id) ? 0.55 : 0.12, opacity: isSel(id) ? 1 : 0.3 };
        },
        onEachFeature: (f, layer) => {
          const pr = f.properties;
          layer.bindTooltip(`${pr.num ? `Nr ${pr.num} ` : ''}${pr.name}${pr.crop ? ` · ${pr.crop}` : ''} (${pr.year})`, { sticky: true });
          layer.on('click', () => pick(pr.pointId));
        }
      }).addTo(group);
    }
    if (!fittedRef.current && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [12, 12] });
      fittedRef.current = true;
    }
  }, [points, fields, selected]);

  return <div ref={divRef} className="weather-point-map" />;
};
