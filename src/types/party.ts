// src/types/party.ts
import type { BadgeTone } from './badgeTone.ts';

export type PartyType = 'PERSON' | 'LEGAL_ENTITY';

export type PartyRole =
  | 'LANDOWNER'      // Maaomanik / Rendileandja
  | 'DRIVER'         // Töötaja (sh masinajuht)
  | 'OPERATOR'       // Põllu operaator / harija
  | 'SUPPLIER'       // Tarnija (laokannete arvele võtmine)
  | 'OTHER';         // Muu seotud isik (täpsustus märkustes)

export interface RelatedParty {
  id: string;
  name: string;                   // Ees- ja perekonnanimi või ärinimi (nt "Maret Paju" või "Loisu Agro OÜ")
  type: PartyType;                // 'PERSON' või 'LEGAL_ENTITY'
  code?: string;                  // Isikukood või registrikood
  vatNumber?: string;             // KMKR number (nt "EE102345678")
  roles: PartyRole[];             // Rollid süsteemis
  phone?: string;                 // Telefoninumber
  email?: string;                 // E-posti aadress
  address?: string;               // Postiaadress / asukoht
  bankAccount?: string;           // IBAN arveldusarve (nt EE12220000...)
  serviceArticleId?: string | null; // töötaja tööaja teenus (tühi = vaikimisi teenus)
  hourlyRate?: number | null;       // oma tunnihind € (ainult finantsõigusega)
  notes?: string;                 // Märkused / lepingulised eritingimused
  createdAt?: string;
  updatedAt?: string;

  // Virtuaalsed seosed statistika jaoks (serveri poolt arvutatud)
  ownedParcelsCount?: number;     // Mitu katastriüksust temaga seotud
  totalAreaHa?: number;           // Hektareid kokku
  operatorFieldsCount?: number;   // Mitu põldu operaatorina (harijana)
  usageCount?: number;            // Kõigi eelnevate loenduste summa — kui > 0, ei tohi kustutada
}

export const PARTY_ROLE_CONFIG: Record<PartyRole, { label: string; icon: string; color: string; tone: BadgeTone }> = {
  LANDOWNER: {
    label: 'Maaomanik',
    icon: '🏛️',
    color: '#059669',
    tone: 'success'
  },
  DRIVER: {
    label: 'Töötaja',
    icon: '👤',
    color: '#d97706',
    tone: 'warning'
  },
  OPERATOR: {
    label: 'Operaator',
    icon: '🧑‍🌾',
    color: '#15803d',
    tone: 'accent'
  },
  SUPPLIER: {
    label: 'Tarnija',
    icon: '🚚',
    color: '#2563eb',
    tone: 'info'
  },
  OTHER: {
    label: 'Muu seotud isik',
    icon: '🤝',
    color: '#64748b',
    tone: 'neutral'
  }
};
