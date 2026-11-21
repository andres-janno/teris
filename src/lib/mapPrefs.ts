// src/lib/mapPrefs.ts — kaardi valikud, mis jäävad brauseris meelde: kihtide lülitid, mullaproovi näitaja
// ja paneelide ahendatud olek. Puhtad funktsioonid (testitavad) + try/catch-iga mälu lugemine/kirjutamine.
// Satelliidi kuupäeva ei salvestata: avamisel valitakse nagu varem.
import { useCallback, useState } from 'react';
import type { LayerVisibility } from '../types/map';
import type { SoilSampleMetricKey } from '../types/soilSample';

export const VISIBILITY_KEY = 'agrimap_visibility';
export const SOIL_METRIC_KEY = 'agrimap_soil_metric';
export const PANELS_COLLAPSED_KEY = 'agrimap_panels_collapsed';

/** Kihtide lülitid (kõik peale aluskaardi): mälust loetakse ainult tõeväärtused */
const TOGGLE_KEYS = [
  'cadastre', 'fields', 'vehicles', 'cultivation', 'poi', 'fieldLabels', 'blockLabels',
  'swathTrails', 'soilSamples', 'weatherRadar', 'satellite'
] as const satisfies readonly (keyof LayerVisibility)[];

/**
 * Taastab salvestatud kihtide valiku. Tundmatu, aegunud või vale tüübiga väärtus → vaikeväärtus;
 * puuduv või vigane salvestus → vaikevalik. `baseMapIds` on kehtivad aluskaardid (eemaldatud aluskaart → vaikimisi).
 */
export function restoreLayerVisibility(saved: string | null, defaults: LayerVisibility, baseMapIds: readonly string[]): LayerVisibility {
  if (!saved) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
  const obj = parsed as Record<string, unknown>;
  const result: LayerVisibility = { ...defaults };
  if (typeof obj.baseMap === 'string' && baseMapIds.includes(obj.baseMap)) result.baseMap = obj.baseMap as LayerVisibility['baseMap'];
  for (const key of TOGGLE_KEYS) {
    if (typeof obj[key] === 'boolean') result[key] = obj[key] as boolean;
  }
  return result;
}

/** Litsentsita moodulite kihid on alati väljas; salvestatud kujul jääb kasutaja valik alles. */
export function applyModuleLimits(raw: LayerVisibility, modules: { telemetry: boolean; satellite: boolean; weather: boolean }): LayerVisibility {
  return {
    ...raw,
    vehicles: raw.vehicles && modules.telemetry,
    cultivation: raw.cultivation && modules.telemetry,
    satellite: raw.satellite && modules.satellite,
    weatherRadar: raw.weatherRadar && modules.weather
  };
}

/** Salvestatud mullaproovi näitaja; tundmatu → vaikeväärtus. */
export function restoreSoilMetric(saved: string | null, valid: readonly string[], fallback: SoilSampleMetricKey): SoilSampleMetricKey {
  return saved && valid.includes(saved) ? (saved as SoilSampleMetricKey) : fallback;
}

export type MapPanelId = 'layers' | 'year';

/** Ahendatud paneelid: { layers: true } = kihtide paneel on ahendatud. Vigane salvestus → kõik lahti. */
export function parseCollapsedPanels(saved: string | null): Partial<Record<MapPanelId, boolean>> {
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Partial<Record<MapPanelId, boolean>> = {};
    for (const id of ['layers', 'year'] as const) {
      if (typeof parsed[id] === 'boolean') result[id] = parsed[id] as boolean;
    }
    return result;
  } catch {
    return {};
  }
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // privaatrežiim või keelatud mälu
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // mälu pole saadaval — valik kehtib ainult selle lehe avamise ajal
  }
}

/** Paneeli lahti/kinni olek (vaikimisi lahti), muudatus salvestatakse. Tagastab [lahti, määra]. */
export function usePanelOpen(panel: MapPanelId): [boolean, (open: boolean) => void] {
  const [isOpen, setIsOpenState] = useState(() => parseCollapsedPanels(readStorage(PANELS_COLLAPSED_KEY))[panel] !== true);
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    // Loe uuesti, et teise paneeli olek ei kirjutuks üle
    const current = parseCollapsedPanels(readStorage(PANELS_COLLAPSED_KEY));
    writeStorage(PANELS_COLLAPSED_KEY, JSON.stringify({ ...current, [panel]: !open }));
  }, [panel]);
  return [isOpen, setIsOpen];
}
