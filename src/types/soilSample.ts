// src/types/soilSample.ts

export interface SoilSample {
  id: number;
  sampleNumber: string;
  fieldCode: string;
  year: number;
  lat: number;
  lng: number;
  ph?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  calcium?: number | null;
  magnesium?: number | null;
  copper?: number | null;
  manganese?: number | null;
  boron?: number | null;
  organicCarbon?: number | null;
  limeRequirement?: number | null;
}

export type SoilSampleMetricKey =
  | 'ph'
  | 'phosphorus'
  | 'potassium'
  | 'calcium'
  | 'magnesium'
  | 'organicCarbon'
  | 'limeRequirement'
  | 'age';

interface SoilMetricThreshold {
  max: number;
  color: string;
}

interface SoilMetricConfig {
  label: string;
  unit: string;
  /** Kasvavas järjekorras lävendid - esimene, mille "max" ületab väärtuse, määrab värvi.
   *  Puudub "vanus" näitajal, kus värv arvutatakse pidevalt (vt AGE_MAX_YEARS / getSoilMetricColor). */
  thresholds?: SoilMetricThreshold[];
}

// Proovi vanuse (aastates) juures, millest alates värv on täielikult punane.
export const AGE_MAX_YEARS = 5;

// Agronoomiliselt tavapärased lävendid (punane = probleemne/madal, roheline = hea).
// Lubjatarbe puhul on loogika ümber pööratud (kõrge väärtus = probleem).
export const SOIL_METRIC_CONFIG: Record<SoilSampleMetricKey, SoilMetricConfig> = {
  ph: {
    label: 'pH (mullareaktsioon)',
    unit: '',
    thresholds: [
      { max: 5.5, color: '#dc2626' },
      { max: 6.5, color: '#eab308' },
      { max: Infinity, color: '#16a34a' }
    ]
  },
  phosphorus: {
    label: 'Fosfor (P)',
    unit: 'mg/kg',
    thresholds: [
      { max: 40, color: '#dc2626' },
      { max: 80, color: '#eab308' },
      { max: Infinity, color: '#16a34a' }
    ]
  },
  potassium: {
    label: 'Kaalium (K)',
    unit: 'mg/kg',
    thresholds: [
      { max: 60, color: '#dc2626' },
      { max: 150, color: '#eab308' },
      { max: Infinity, color: '#16a34a' }
    ]
  },
  calcium: {
    label: 'Kaltsium (Ca)',
    unit: 'mg/kg',
    thresholds: [
      { max: 800, color: '#dc2626' },
      { max: 1600, color: '#eab308' },
      { max: Infinity, color: '#16a34a' }
    ]
  },
  magnesium: {
    label: 'Magneesium (Mg)',
    unit: 'mg/kg',
    thresholds: [
      { max: 60, color: '#dc2626' },
      { max: 120, color: '#eab308' },
      { max: Infinity, color: '#16a34a' }
    ]
  },
  organicCarbon: {
    label: 'Orgaaniline süsinik (Corg)',
    unit: '%',
    thresholds: [
      { max: 1, color: '#dc2626' },
      { max: 2, color: '#eab308' },
      { max: Infinity, color: '#16a34a' }
    ]
  },
  limeRequirement: {
    label: 'Lubjatarve',
    unit: 't/ha',
    thresholds: [
      { max: 1, color: '#16a34a' },
      { max: 4, color: '#eab308' },
      { max: Infinity, color: '#dc2626' }
    ]
  },
  age: {
    label: 'Vanus',
    unit: 'aastat'
    // pidev üleminek roheliselt punasele, vt getSoilMetricColor
  }
};

/**
 * Tagastab proovi vanuse (viimasest proovivõtust möödunud aastad) sujuva
 * rohelisest punaseks värviskaala: 0 aastat = roheline, > AGE_MAX_YEARS
 * aastat = punane, vahepeal lineaarne üleminek (läbi kollase-oranži HSL toonis).
 * Jagaja on AGE_MAX_YEARS + 1, et täielikult punane toon saabuks alles
 * järgmisel täisaastal pärast AGE_MAX_YEARS-i, mitte selle punktis endas.
 */
function ageToColor(age: number): string {
  const t = Math.max(0, Math.min(1, age / (AGE_MAX_YEARS + 1)));
  const hue = 142 - t * 142; // 142° roheline -> 0° punane
  const sat = 65;
  const light = 42;

  const c = (1 - Math.abs((2 * light) / 100 - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else { r = 0; g = c; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getSoilMetricColor(metric: SoilSampleMetricKey, value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return '#94a3b8';
  if (metric === 'age') return ageToColor(value);
  const config = SOIL_METRIC_CONFIG[metric];
  const threshold = (config.thresholds || []).find((t) => value <= t.max);
  return threshold ? threshold.color : '#94a3b8';
}

/** Loeb näitaja väärtuse proovilt - "vanus" on tuletatud (praegune aasta - proovi aasta), mitte otse salvestatud väli. */
export function getSoilMetricValue(sample: SoilSample, metric: SoilSampleMetricKey): number | null | undefined {
  if (metric === 'age') return new Date().getFullYear() - sample.year;
  return sample[metric];
}
