// src/data/sampleFieldRegister.ts
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { FieldCadastralLink } from '../types/cadastre';
import { SAMPLE_FIELDS } from './sampleFields';
import { SAMPLE_FIELD_SEASONS } from './sampleFieldSeasons';
import { SAMPLE_CADASTRAL_PARCELS } from './sampleCadastre';
import { countGeometryVertices } from '../types/fieldRegister';
import { getGeometryPerimeterMeters } from '../services/geometryEngine';
import { extractCropAndVariety } from './sampleCrops';

/**
 * Kombineerib põldude püsivad andmed (sampleFields.ts), katastriüksuste andmed (sampleCadastre.ts)
 * ja aastapõhised andmed ning geomeetriad (sampleFieldSeasons.ts) ühtseks MasterField registriks.
 * Katastriüksuste koosseis, haritav pindala, omandivorm ja rendi/maamaksu summad on seotud konkreetse hooajaga.
 */
export const INITIAL_MASTER_FIELDS: MasterField[] = SAMPLE_FIELDS.map((field, idx) => {
  const rawHistory = SAMPLE_FIELD_SEASONS[field.id] || [];
  
  // Find primary cadastral parcel for this field
  const cadObj = SAMPLE_CADASTRAL_PARCELS.find(c => c.cadastralCode === field.cadastralCode) 
    || SAMPLE_CADASTRAL_PARCELS[idx % SAMPLE_CADASTRAL_PARCELS.length];
  
  // Enrich yearly history with perimeter, vertices count, seasonal cadastral parcels, and change reasons
  const history: FieldYearlyRecord[] = rawHistory.map((h, hIdx) => {
    const vCount = countGeometryVertices(h.geometry);
    const perimeterM = getGeometryPerimeterMeters(h.geometry);
    const yearArea = h.areaHa;
    
    // Seasonal cadastral parcels for this specific year
    const seasonalCadastralParcels: FieldCadastralLink[] = [];

    // In past seasons (e.g. 2024), tax/rent rates were slightly lower or ownership might have transitioned
    const rateMultiplier = h.year === 2026 ? 1.0 : (h.year === 2025 ? 0.95 : 0.90);
    const rentRateHa = Math.round(140 * rateMultiplier);
    const taxRateHa = Math.round(18 * rateMultiplier);

    if (idx % 4 === 0 && SAMPLE_CADASTRAL_PARCELS[(idx + 1) % SAMPLE_CADASTRAL_PARCELS.length]) {
      // 2-osaline massiiv (nt 65% ühest katastrist ja 35% teisest katastrist)
      const secondCad = SAMPLE_CADASTRAL_PARCELS[(idx + 1) % SAMPLE_CADASTRAL_PARCELS.length];
      const part1 = Math.round(yearArea * 0.65 * 100) / 100;
      const part2 = Math.round((yearArea - part1) * 100) / 100;

      seasonalCadastralParcels.push({
        cadastralCode: cadObj.cadastralCode,
        parcelName: cadObj.name || field.name,
        ownershipType: cadObj.ownershipType,
        ownerName: cadObj.ownerName,
        fieldAreaHa: part1,
        landTaxEurHa: cadObj.ownershipType === 'OWNED' ? taxRateHa : undefined,
        landTaxEurYear: cadObj.ownershipType === 'OWNED' ? Math.round(taxRateHa * part1 * 100) / 100 : undefined,
        rentFeeEurHa: cadObj.ownershipType === 'RENTED' ? rentRateHa : undefined,
        rentFeeEurYear: cadObj.ownershipType === 'RENTED' ? Math.round(rentRateHa * part1 * 100) / 100 : undefined,
        notes: `Põhjapoolne põlluosa (${part1} ha, ${h.year})`
      });

      seasonalCadastralParcels.push({
        cadastralCode: secondCad.cadastralCode,
        parcelName: secondCad.name || `Kinnistu ${secondCad.cadastralCode}`,
        ownershipType: secondCad.ownershipType,
        ownerName: secondCad.ownerName,
        fieldAreaHa: part2,
        landTaxEurHa: secondCad.ownershipType === 'OWNED' ? taxRateHa : undefined,
        landTaxEurYear: secondCad.ownershipType === 'OWNED' ? Math.round(taxRateHa * part2 * 100) / 100 : undefined,
        rentFeeEurHa: secondCad.ownershipType === 'RENTED' ? rentRateHa : undefined,
        rentFeeEurYear: secondCad.ownershipType === 'RENTED' ? Math.round(rentRateHa * part2 * 100) / 100 : undefined,
        notes: `Lõunapoolne põlluosa (${part2} ha, ${h.year}), metsaäär jääb välja`
      });
    } else {
      // 1 katastriüksus katab antud põllu
      seasonalCadastralParcels.push({
        cadastralCode: cadObj.cadastralCode,
        parcelName: cadObj.name || field.name,
        ownershipType: cadObj.ownershipType,
        ownerName: cadObj.ownerName,
        fieldAreaHa: yearArea,
        landTaxEurHa: cadObj.ownershipType === 'OWNED' ? taxRateHa : undefined,
        landTaxEurYear: cadObj.ownershipType === 'OWNED' ? Math.round(taxRateHa * yearArea * 100) / 100 : undefined,
        rentFeeEurHa: cadObj.ownershipType === 'RENTED' ? rentRateHa : undefined,
        rentFeeEurYear: cadObj.ownershipType === 'RENTED' ? Math.round(rentRateHa * yearArea * 100) / 100 : undefined,
        notes: cadObj.notes || `Haritav põlluosa (${yearArea} ha, ${h.year}. a)`
      });
    }

    // Sample area change reasons for seasons
    let areaChangeReason: string | undefined = undefined;
    if (hIdx > 0 && rawHistory[hIdx - 1]) {
      const diff = Math.round((h.areaHa - rawHistory[hIdx - 1].areaHa) * 100) / 100;
      if (diff > 0.05) {
        areaChangeReason = `Kraavihooldus ja põlluserva puhastus (+${diff} ha)`;
      } else if (diff < -0.05) {
        areaChangeReason = `Võsa pealekasv ja puhverriba laiendus (${diff} ha)`;
      }
    } else if (idx % 3 === 0) {
      areaChangeReason = 'Metsaääre võsastumine vähendas haritavat pinda';
    }

    const parsedCrop = extractCropAndVariety(h.crop);

    return {
      ...h,
      crop: parsedCrop.crop,
      cropVariety: h.cropVariety || (parsedCrop.variety || undefined),
      status: (h.status as any) || 'not_started',
      eligibleAreaHa: Math.round(h.areaHa * 0.98 * 100) / 100,
      areaChangeReason,
      boundaryPointsCount: vCount,
      perimeterM,
      cadastralParcels: seasonalCadastralParcels
    };
  });

  const latestGeom = history[0]?.geometry;
  const latestParcels = history[0]?.cadastralParcels || [];

  return {
    id: field.id,
    num: field.num ? String(field.num) : String(idx + 1),
    name: field.name,
    fieldCode: field.fieldCode,
    cadastralCode: cadObj.cadastralCode,
    cadastralParcels: latestParcels,
    soilType: field.soilType || 'Leostunud liivsavi (LP)',
    drainageSystem: field.drainageSystem ?? (idx % 2 === 0),
    notes: field.notes || '',
    geometry: latestGeom,
    history
  };
});


