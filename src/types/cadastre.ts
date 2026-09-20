// src/types/cadastre.ts

export type LandTenureType = 'OWNED' | 'RENTED';

/**
 * Katastriüksuse põhiandmed
 */
export interface CadastralParcel {
  id: string | number;
  cadastralCode: string;          // Katastritunnus (nt "89201:001:0100")
  name?: string;                  // Lähiaadress või katastri nimi (nt "Toosi", "Murikatsi")
  ownershipType: LandTenureType;  // 'OWNED' = Oma maa, 'RENTED' = Rent
  ownerName: string;              // Maaomaniku nimi
  landTaxEurHa?: number;          // Maamaks hektari kohta (€/ha) - oma maa puhul
  landTaxEurYear?: number;        // Maamaks aastas (€) - oma maa puhul
  rentFeeEurHa?: number;          // Renditasu hektari kohta (€/ha) - rendimaa puhul
  rentFeeEurYear?: number;        // Renditasu aastas (€ või kogusumma) - rendimaa puhul
  contractNumber?: string;        // Rendilepingu nr
  contractEndDate?: string;       // Rendilepingu lõppkuupäev
  notes?: string;                 // Märkused
}

/**
 * Põllumassiivi ja katastriüksuse seos:
 * salvestab konkreetselt need hektarid, mis sellest katastriüksusest antud põllu koosseisu kuuluvad.
 */
export interface FieldCadastralLink {
  cadastralCode: string;          // Katastritunnus
  parcelName?: string;            // Katastri nimi / aadress
  ownershipType: LandTenureType;  // 'OWNED' (Oma maa) | 'RENTED' (Rent)
  ownerName: string;              // Omanik
  fieldAreaHa: number;            // Hektarid, mis sellest katastriüksusest põldu kuuluvad (nt 4.25 ha)
  landTaxEurHa?: number;          // Maamaks hektari kohta antud põlluosal (€/ha)
  landTaxEurYear?: number;        // Maamaks kokku (€/aasta)
  rentFeeEurHa?: number;          // Renditasu hektari kohta (€/ha)
  rentFeeEurYear?: number;        // Renditasu kokku (€/aasta)
  notes?: string;                 // Täpsustused (nt "Põllu idapoolne osa, mets jääb välja")
}

/**
 * Katastrite finantskokkuvõte (Oma maa vs Rent)
 */
export interface CadastreFinancialSummary {
  totalOwnedHa: number;
  totalRentedHa: number;
  totalLandTaxEur: number;
  totalRentFeeEur: number;
  ownedParcelsCount: number;
  rentedParcelsCount: number;
}
