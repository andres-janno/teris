// src/types/poi.ts
export type PoiCategory = 
  | 'dryer'         // Kuivati / viljahoidla
  | 'water_point'   // Veepunkt / pritsi täitmiskoht
  | 'workshop'      // Töökoda / masinakuur / garaaž
  | 'fuel_station'  // Kütusetankla / mahuti
  | 'warehouse'     // Väetise- ja kemikaaliladu
  | 'scale'         // Autokaal
  | 'other';        // Muu oluline punkt

export interface PointOfInterest {
  id: string;
  name: string;
  category: PoiCategory;
  position: [number, number]; // [lat, lng]
  description?: string;
  capacity?: string;          // nt "3000 t vilja" või "50 m³ vesi" või "10 000 L diisel"
  contactPerson?: string;
  phone?: string;
  accessNotes?: string;       // nt "Ligipääs ka 36m pritsiga"
  isActive: boolean;
  createdAt: string;
}
