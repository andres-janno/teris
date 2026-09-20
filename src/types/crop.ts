// src/types/crop.ts

export type CropGroup =
  | 'CEREAL'        // Teravili
  | 'OILSEED'       // Õlikultuur
  | 'LEGUME'        // Kaunvili
  | 'FORAGE_GRASS'  // Söödakultuur / Rohumaa
  | 'FALLOW'        // Kesa
  | 'OTHER';        // Muu

export interface CropVariety {
  id: string;
  cropId: string;
  name: string;                         // Sordinimi (nt 'Skagen', 'Planet', 'Mercedes')
  breeder?: string;                     // Aretaja / esindaja (nt Saaten-Union, KWS, RAGT)
  maturityDays?: string;                // Valmimisaeg / kasvuaeg (nt 'Varajane', 'Keskvalmiv', 'Hilissügisene')
  winterHardiness?: string;             // Talvekindlus (nt 'Väga hea', 'Hea', 'Rahuldav')
  recommendedSeedRateKgHa?: number;     // Soovituslik külvinorm kg/ha (nt 220)
  potentialYieldTonsHa?: number;        // Saagipotentsiaal t/ha (nt 9.5)
  qualityClass?: string;                // Kvaliteediklass (nt 'Toiduvili (E)', 'Toiduvili (I)', 'Söödavili', 'Õlisisaldus >48%')
  notes?: string;                       // Sordiomadused ja märkused
  isActive?: boolean;
}

export interface Crop {
  id: string;
  name: string;                         // Kultuuri nimi (nt 'Talinisu', 'Suvioder', 'Taliraps')
  scientificName?: string;              // Ladinakeelne nimetus (nt 'Triticum aestivum')
  group: CropGroup;                     // Kultuurigrupp
  color: string;                        // Värvikood kaardil (nt '#eab308')
  icon?: string;                        // Ikoon / emoji (nt '🌾', '🌱', '🌼')
  priaCode?: string;                    // PRIA kultuurikood (nt 'TNS', 'SOD', 'TRS')
  defaultSeedRateKgHa?: number;         // Vaikimisi soovituslik külvinorm kg/ha
  defaultYieldTonsHa?: number;          // Baas-saagiootus t/ha
  description?: string;                 // Agrotehniline kirjeldus või märkmed
  varieties: CropVariety[];             // Alamregister antud kultuuri sortidest
  createdAt?: string;
  updatedAt?: string;
}

export const CROP_GROUP_CONFIG: Record<
  CropGroup,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  CEREAL: {
    label: 'Teravili',
    icon: '🌾',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)'
  },
  OILSEED: {
    label: 'Õlikultuur',
    icon: '🌼',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)'
  },
  LEGUME: {
    label: 'Kaunvili',
    icon: '🌱',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.15)'
  },
  FORAGE_GRASS: {
    label: 'Rohumaa / Sööt',
    icon: '☘️',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)'
  },
  FALLOW: {
    label: 'Kesa',
    icon: '🍂',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.15)'
  },
  OTHER: {
    label: 'Muu kultuur',
    icon: '🪴',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.15)'
  }
};
