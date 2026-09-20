// src/types/party.ts

export type PartyType = 'PERSON' | 'LEGAL_ENTITY';

export type PartyRole =
  | 'LANDOWNER'      // Maaomanik / Rendileandja
  | 'TENANT'         // Rentnik / Maaharija (meie ettevõte või partner)
  | 'DRIVER'         // Masinajuht / Töötaja
  | 'CONTACT_PERSON' // Objekti / taristu kontaktisik
  | 'SUPPLIER'       // Tarnija (väetised, seemned, tehnika)
  | 'BUYER'          // Ostja / Viljakaupleja
  | 'OTHER';         // Muu seotud osapool

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
  isOwnCompany?: boolean;         // Kas tegemist on meie oma ettevõttega (nt Loisu Agro OÜ)
  createdAt?: string;
  updatedAt?: string;

  // Virtuaalsed seosed statistika jaoks
  ownedParcelsCount?: number;     // Mitu katastriüksust temaga seotud
  totalAreaHa?: number;           // Hektareid kokku
  assignedVehiclesCount?: number; // Mitu masinat talle määratud
}

export const PARTY_ROLE_CONFIG: Record<PartyRole, { label: string; icon: string; color: string; bgColor: string }> = {
  LANDOWNER: {
    label: 'Maaomanik',
    icon: '🏛️',
    color: '#059669',
    bgColor: 'rgba(16, 185, 129, 0.12)'
  },
  TENANT: {
    label: 'Rentnik / Ettevõte',
    icon: '🚜',
    color: '#2563eb',
    bgColor: 'rgba(59, 130, 246, 0.12)'
  },
  DRIVER: {
    label: 'Masinajuht / Töötaja',
    icon: '👤',
    color: '#d97706',
    bgColor: 'rgba(245, 158, 11, 0.12)'
  },
  CONTACT_PERSON: {
    label: 'Taristu kontakt',
    icon: '📍',
    color: '#7c3aed',
    bgColor: 'rgba(139, 92, 246, 0.12)'
  },
  SUPPLIER: {
    label: 'Tarnija',
    icon: '📦',
    color: '#0891b2',
    bgColor: 'rgba(6, 182, 212, 0.12)'
  },
  BUYER: {
    label: 'Viljaostja',
    icon: '🌾',
    color: '#ca8a04',
    bgColor: 'rgba(234, 179, 8, 0.12)'
  },
  OTHER: {
    label: 'Muu seotud isik',
    icon: '🤝',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.12)'
  }
};
