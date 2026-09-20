// src/data/sampleCadastre.ts
import type { CadastralParcel, CadastreFinancialSummary } from '../types/cadastre';

/**
 * Loisu piirkonna katastriüksuste register
 * - Oma maad: maksame maamaksu (€/aasta)
 * - Rendimaad: maksame renti (€/aasta)
 */
export const SAMPLE_CADASTRAL_PARCELS: CadastralParcel[] = [
  {
    id: 'cad-01',
    cadastralCode: '89201:004:0140',
    name: 'Toosi-Janno',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 18.50,
    notes: 'Kinnistu südames, heas korras kuivendusega'
  },
  {
    id: 'cad-02',
    cadastralCode: '89201:001:0110',
    name: 'Metsa-Talu',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 140.00,
    contractNumber: 'L-2023/14',
    contractEndDate: '2030-12-31',
    notes: '5-aastane rendileping, makse iga aasta detsembris'
  },
  {
    id: 'cad-03',
    cadastralCode: '89201:003:0130',
    name: 'Kasevälja',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Ants Kuusik)',
    rentFeeEurYear: 110.00,
    contractNumber: 'L-2021/08',
    contractEndDate: '2028-04-30',
    notes: 'Viljarent / rahaline ekvivalent'
  },
  {
    id: 'cad-04',
    cadastralCode: '89201:002:0120',
    name: 'Loisu Kodu',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 32.00,
    notes: 'Peatalu ümbruse maad'
  },
  {
    id: 'cad-05',
    cadastralCode: '89201:001:0100',
    name: 'Murikatsi',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 280.00,
    contractNumber: 'L-2022/03',
    contractEndDate: '2029-10-31',
    notes: 'Suur massiiv, osaliselt piirneb metsaga'
  },
  {
    id: 'cad-06',
    cadastralCode: '89201:002:0101',
    name: 'Loo Suurtalu',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Maret Paju)',
    rentFeeEurYear: 215.00,
    contractNumber: 'L-2024/02',
    contractEndDate: '2032-12-31'
  },
  {
    id: 'cad-07',
    cadastralCode: '89201:003:0102',
    name: 'Loo Väiketalu',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 24.50
  },
  {
    id: 'cad-08',
    cadastralCode: '89201:004:0103',
    name: 'Vändra-Põllu',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 160.00,
    contractNumber: 'L-2020/19',
    contractEndDate: '2027-11-30'
  },
  {
    id: 'cad-09',
    cadastralCode: '89201:005:0104',
    name: 'Kuldse-Liiva',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Jüri Kuldse)',
    rentFeeEurYear: 95.00,
    contractNumber: 'L-2021/44',
    contractEndDate: '2026-12-31'
  },
  {
    id: 'cad-10',
    cadastralCode: '89201:006:0105',
    name: 'Vabarna-Mäe',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 45.00
  },
  {
    id: 'cad-11',
    cadastralCode: '89201:007:0106',
    name: 'Piiri-Jallai',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 190.00,
    contractNumber: 'L-2023/50',
    contractEndDate: '2031-10-31'
  },
  {
    id: 'cad-12',
    cadastralCode: '89201:008:0107',
    name: 'Joka-Parem',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Rein Tamm)',
    rentFeeEurYear: 130.00,
    contractNumber: 'L-2022/11',
    contractEndDate: '2028-12-31'
  },
  {
    id: 'cad-13',
    cadastralCode: '89201:009:0108',
    name: 'Joka-Vasak',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 28.00
  },
  {
    id: 'cad-14',
    cadastralCode: '89201:001:0109',
    name: 'Paju-Uuetoa',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 155.00,
    contractNumber: 'L-2024/09',
    contractEndDate: '2034-12-31'
  },
  {
    id: 'cad-15',
    cadastralCode: '89201:002:0100',
    name: 'Kure-Soo',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Helgi Kure)',
    rentFeeEurYear: 175.00,
    contractNumber: 'L-2023/07',
    contractEndDate: '2029-09-30'
  },
  {
    id: 'cad-16',
    cadastralCode: '89201:003:0101',
    name: 'Erna Ormisson',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 52.00
  },
  {
    id: 'cad-17',
    cadastralCode: '89201:004:0102',
    name: 'Tootsi-Vana',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 210.00,
    contractNumber: 'L-2021/33',
    contractEndDate: '2027-10-31'
  },
  {
    id: 'cad-18',
    cadastralCode: '89201:005:0103',
    name: 'Tankla-Tagune',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Toivo Mets)',
    rentFeeEurYear: 125.00,
    contractNumber: 'L-2022/28',
    contractEndDate: '2030-05-31'
  },
  {
    id: 'cad-19',
    cadastralCode: '89201:006:0104',
    name: 'Erna-Väike',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 16.00
  },
  {
    id: 'cad-20',
    cadastralCode: '89201:007:0105',
    name: 'Tauli-Ees',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 180.00,
    contractNumber: 'L-2020/05',
    contractEndDate: '2026-11-30'
  },
  {
    id: 'cad-21',
    cadastralCode: '89201:008:0106',
    name: 'Malle-Põld',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Malle Kallas)',
    rentFeeEurYear: 145.00,
    contractNumber: 'L-2024/18',
    contractEndDate: '2031-12-31'
  },
  {
    id: 'cad-22',
    cadastralCode: '89201:009:0107',
    name: 'Kuldi-Mäe',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 38.00
  },
  {
    id: 'cad-23',
    cadastralCode: '89201:001:0108',
    name: 'Kassi-Nurga',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 165.00,
    contractNumber: 'L-2023/21',
    contractEndDate: '2028-10-31'
  },
  {
    id: 'cad-24',
    cadastralCode: '89201:002:0109',
    name: 'Arno-Väike',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Arno Liiv)',
    rentFeeEurYear: 90.00,
    contractNumber: 'L-2022/41',
    contractEndDate: '2029-06-30'
  },
  {
    id: 'cad-25',
    cadastralCode: '89201:003:0100',
    name: 'Laane-Põld',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 42.00
  },
  {
    id: 'cad-26',
    cadastralCode: '89201:004:0101',
    name: 'Toosi-Põhi',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 230.00,
    contractNumber: 'L-2021/15',
    contractEndDate: '2028-11-30'
  },
  {
    id: 'cad-27',
    cadastralCode: '89201:005:0102',
    name: 'Reti-Alune',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Peeter Reti)',
    rentFeeEurYear: 115.00,
    contractNumber: 'L-2020/38',
    contractEndDate: '2027-09-30'
  },
  {
    id: 'cad-28',
    cadastralCode: '89201:006:0103',
    name: 'Reti-Teeäärne',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 29.00
  },
  {
    id: 'cad-29',
    cadastralCode: '89201:007:0104',
    name: 'Kodu-Ümbruse',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 260.00,
    contractNumber: 'L-2024/01',
    contractEndDate: '2034-12-31'
  },
  {
    id: 'cad-30',
    cadastralCode: '89201:008:0105',
    name: 'Alumine-Sooäär',
    ownershipType: 'RENTED',
    ownerName: 'Eraomanik (Valter Soo)',
    rentFeeEurYear: 85.00,
    contractNumber: 'L-2021/04',
    contractEndDate: '2026-10-31'
  },
  {
    id: 'cad-31',
    cadastralCode: '89201:009:0106',
    name: 'Reti-Küla-Põld',
    ownershipType: 'OWNED',
    ownerName: 'Oma maa (Loisu Agro OÜ)',
    landTaxEurYear: 35.00
  },
  {
    id: 'cad-32',
    cadastralCode: '89201:001:0107',
    name: 'Reti-Tagune',
    ownershipType: 'RENTED',
    ownerName: 'Maaomanik OÜ',
    rentFeeEurYear: 195.00,
    contractNumber: 'L-2023/12',
    contractEndDate: '2030-11-30'
  }
];

/**
 * Arvutab põllumajandusettevõtte maade finantskokkuvõtte (Oma maa maamaks vs Rendimaade rent)
 */
export function calculateCadastreFinancialSummary(parcels: CadastralParcel[]): CadastreFinancialSummary {
  let totalOwnedHa = 0;
  let totalRentedHa = 0;
  let totalLandTaxEur = 0;
  let totalRentFeeEur = 0;
  let ownedParcelsCount = 0;
  let rentedParcelsCount = 0;

  parcels.forEach((p) => {
    if (p.ownershipType === 'OWNED') {
      ownedParcelsCount++;
      totalLandTaxEur += p.landTaxEurYear || 0;
    } else {
      rentedParcelsCount++;
      totalRentFeeEur += p.rentFeeEurYear || 0;
    }
  });

  return {
    totalOwnedHa,
    totalRentedHa,
    totalLandTaxEur,
    totalRentFeeEur,
    ownedParcelsCount,
    rentedParcelsCount
  };
}
