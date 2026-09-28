// src/types/party.ts

export type PartyType = 'PERSON' | 'LEGAL_ENTITY';

export type PartyRole =
  | 'LANDOWNER'      // Maaomanik / Rendileandja
  | 'DRIVER'         // Töötaja (sh masinajuht)
  | 'OPERATOR'       // Põllu operaator / harija
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
  notes?: string;                 // Märkused / lepingulised eritingimused
  createdAt?: string;
  updatedAt?: string;

  // Virtuaalsed seosed statistika jaoks (serveri poolt arvutatud)
  ownedParcelsCount?: number;     // Mitu katastriüksust temaga seotud
  totalAreaHa?: number;           // Hektareid kokku
  assignedVehiclesCount?: number; // Mitu masinat talle määratud
  poiContactsCount?: number;      // Mitu POI-punkti kontaktisikuna
  operatorFieldsCount?: number;   // Mitu põldu operaatorina (harijana)
  performedOperationsCount?: number; // Mitu põllutööd teostajana (põlluraamatust)
  usageCount?: number;            // Kõigi eelnevate loenduste summa — kui > 0, ei tohi kustutada
}

export const PARTY_ROLE_CONFIG: Record<PartyRole, { label: string; icon: string; color: string; bgColor: string }> = {
  LANDOWNER: {
    label: 'Maaomanik',
    icon: '🏛️',
    color: '#059669',
    bgColor: 'rgba(16, 185, 129, 0.12)'
  },
  DRIVER: {
    label: 'Töötaja',
    icon: '👤',
    color: '#d97706',
    bgColor: 'rgba(245, 158, 11, 0.12)'
  },
  OPERATOR: {
    label: 'Operaator',
    icon: '🧑‍🌾',
    color: '#15803d',
    bgColor: 'rgba(34, 197, 94, 0.12)'
  },
  OTHER: {
    label: 'Muu seotud isik',
    icon: '🤝',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.12)'
  }
};
