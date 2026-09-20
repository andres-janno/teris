// src/components/MapMarkers.ts
import L from 'leaflet';
import type { Vehicle } from '../types/vehicle';
import type { PointOfInterest, PoiCategory } from '../types/poi';

export function isVehicleRecentlyActive(vehicle: Vehicle, maxMinutes = 5): boolean {
  if (vehicle.status === 'working' || vehicle.status === 'moving' || (vehicle.speedKmH && vehicle.speedKmH > 0)) {
    return true;
  }
  if (vehicle.telemetry?.lastUpdate) {
    const diffMs = Date.now() - new Date(vehicle.telemetry.lastUpdate).getTime();
    if (diffMs <= maxMinutes * 60 * 1000 && (vehicle.telemetry.ignition || vehicle.speedKmH > 0)) {
      return true;
    }
  }
  return false;
}

export function createVehicleIcon(vehicle: Vehicle): L.DivIcon {
  const isWorking = vehicle.status === 'working';
  const isMoving = vehicle.status === 'moving';
  const isRecentlyActive = isVehicleRecentlyActive(vehicle, 5);
  const color = vehicle.color || '#22c55e';
  const heading = vehicle.heading || 0;

  let iconEmoji = '🚜';
  if (vehicle.type === 'combine') iconEmoji = '🌾';
  else if (vehicle.type === 'sprayer') iconEmoji = '🚿';
  else if (vehicle.type === 'truck') iconEmoji = '🚛';

  let statusClass = 'status-stopped';
  let statusText = 'Seisab';
  if (isWorking) {
    statusClass = 'status-working';
    statusText = 'Töötab';
  } else if (isMoving) {
    statusClass = 'status-moving';
    statusText = 'Liigub';
  }

  const html = `
    <div class="vehicle-marker-container ${statusClass} ${isRecentlyActive ? 'is-recently-active' : ''}">
      ${isRecentlyActive ? '<div class="live-active-radar-ring"></div>' : ''}
      <div class="heading-arrow" style="transform: rotate(${heading}deg);">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M18 2L24 14H12L18 2Z" fill="${color}" />
        </svg>
      </div>
      <div class="vehicle-marker-avatar" style="border-color: ${color};">
        <span class="vehicle-emoji">${iconEmoji}</span>
        ${isRecentlyActive ? '<span class="live-status-dot"></span>' : ''}
      </div>
      <div class="vehicle-marker-label">
        <span class="v-name">${vehicle.name.split(' ')[0]}</span>
        <span class="v-speed">${vehicle.speedKmH > 0 ? `${vehicle.speedKmH.toFixed(1)} km/h` : statusText}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-vehicle-div-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
}

const POI_ICONS: Record<PoiCategory, { emoji: string; bg: string; border: string }> = {
  dryer: { emoji: '🌾', bg: '#ca8a04', border: '#fef08a' },
  water_point: { emoji: '💧', bg: '#0284c7', border: '#bae6fd' },
  workshop: { emoji: '🔧', bg: '#64748b', border: '#cbd5e1' },
  fuel_station: { emoji: '⛽', bg: '#dc2626', border: '#fecaca' },
  warehouse: { emoji: '📦', bg: '#d97706', border: '#fed7aa' },
  scale: { emoji: '⚖️', bg: '#7c3aed', border: '#ddd6fe' },
  other: { emoji: '📍', bg: '#475569', border: '#cbd5e1' }
};

export function createPoiIcon(poi: PointOfInterest): L.DivIcon {
  const conf = POI_ICONS[poi.category] || POI_ICONS.other;

  const html = `
    <div class="poi-marker-container" style="background-color: ${conf.bg}; border-color: ${conf.border};">
      <span class="poi-emoji">${conf.emoji}</span>
      <div class="poi-label">${poi.name}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-poi-div-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}
