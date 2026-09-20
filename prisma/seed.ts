// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { INITIAL_CROPS } from '../src/data/sampleCrops.ts';
import { INITIAL_PARTIES } from '../src/data/sampleParties.ts';
import { SAMPLE_CADASTRAL_PARCELS } from '../src/data/sampleCadastre.ts';
import { INITIAL_SEASONS } from '../src/data/sampleSeasons.ts';
import { SAMPLE_FIELDS } from '../src/data/sampleFields.ts';
import { SAMPLE_FIELD_SEASONS_ROWS } from '../src/data/sampleFieldSeasons.ts';
import { SAMPLE_POI_LIST } from '../src/data/samplePoi.ts';
import { INITIAL_VEHICLES, INITIAL_IMPLEMENTS, INITIAL_TELTONIKA_DEVICES } from '../src/data/sampleFleet.ts';

const prisma = new PrismaClient();

function mapSeasonStatus(status: string) {
  switch (status?.toLowerCase()) {
    case 'planning': return 'PLANNING';
    case 'active': return 'ACTIVE';
    case 'harvesting': return 'HARVESTING';
    case 'closed': return 'CLOSED';
    default: return 'PLANNING';
  }
}

function mapFieldStatus(status: string) {
  switch (status?.toLowerCase()) {
    case 'not_started': return 'NOT_STARTED';
    case 'in_progress': return 'IN_PROGRESS';
    case 'completed': return 'COMPLETED';
    default: return 'NOT_STARTED';
  }
}

function mapPoiCategory(category: string) {
  switch (category?.toLowerCase()) {
    case 'dryer': return 'DRYER';
    case 'water_source': return 'WATER_SOURCE';
    case 'workshop': return 'WORKSHOP';
    case 'fuel_station': return 'FUEL_STATION';
    case 'field_entrance': return 'FIELD_ENTRANCE';
    case 'storage': return 'STORAGE';
    default: return 'OTHER';
  }
}

function mapVehicleType(type: string) {
  switch (type?.toLowerCase()) {
    case 'tractor': return 'TRACTOR';
    case 'combine': return 'COMBINE';
    case 'sprayer': return 'SPRAYER';
    case 'spreader': return 'SPREADER';
    case 'truck': return 'TRUCK';
    case 'atv': return 'ATV';
    case 'loader': return 'LOADER';
    default: return 'TRACTOR';
  }
}

function mapImplementType(type: string) {
  switch (type?.toLowerCase()) {
    case 'seeder': return 'SEEDER';
    case 'cultivator': return 'CULTIVATOR';
    case 'sprayer': return 'SPRAYER';
    case 'header': return 'HEADER';
    case 'plow': return 'PLOW';
    case 'mower': return 'MOWER';
    case 'fertilizer_spreader': return 'FERTILIZER_SPREADER';
    case 'disc_harrow': return 'DISC_HARROW';
    case 'trailer': return 'TRAILER';
    case 'roller': return 'ROLLER';
    default: return 'OTHER';
  }
}

function mapDeviceStatus(status: string) {
  switch (status?.toLowerCase()) {
    case 'working': return 'WORKING';
    case 'moving': return 'MOVING';
    case 'stopped': return 'STOPPED';
    case 'idling': return 'IDLING';
    default: return 'OFFLINE';
  }
}

export async function main() {
  console.log('🌱 Starting database seed into agro_db...');

  // 1. Crops & Varieties
  console.log('1/8 Seeding crops and varieties...');
  for (const crop of INITIAL_CROPS) {
    await prisma.crop.upsert({
      where: { id: crop.id },
      update: {
        name: crop.name,
        scientificName: crop.scientificName,
        group: crop.group as any,
        color: crop.color,
        icon: crop.icon,
        priaCode: crop.priaCode,
        defaultSeedRateKgHa: crop.defaultSeedRateKgHa,
        defaultYieldTonsHa: crop.defaultYieldTonsHa,
        description: crop.description
      },
      create: {
        id: crop.id,
        name: crop.name,
        scientificName: crop.scientificName,
        group: crop.group as any,
        color: crop.color,
        icon: crop.icon,
        priaCode: crop.priaCode,
        defaultSeedRateKgHa: crop.defaultSeedRateKgHa,
        defaultYieldTonsHa: crop.defaultYieldTonsHa,
        description: crop.description
      }
    });

    if (crop.varieties && crop.varieties.length > 0) {
      for (const v of crop.varieties) {
        await prisma.cropVariety.upsert({
          where: { id: v.id },
          update: {
            cropId: crop.id,
            name: v.name,
            breeder: v.breeder,
            maturityDays: v.maturityDays,
            winterHardiness: v.winterHardiness,
            recommendedSeedRateKgHa: v.recommendedSeedRateKgHa,
            potentialYieldTonsHa: v.potentialYieldTonsHa,
            qualityClass: v.qualityClass,
            notes: v.notes
          },
          create: {
            id: v.id,
            cropId: crop.id,
            name: v.name,
            breeder: v.breeder,
            maturityDays: v.maturityDays,
            winterHardiness: v.winterHardiness,
            recommendedSeedRateKgHa: v.recommendedSeedRateKgHa,
            potentialYieldTonsHa: v.potentialYieldTonsHa,
            qualityClass: v.qualityClass,
            notes: v.notes
          }
        });
      }
    }
  }

  // 2. Related Parties
  console.log('2/8 Seeding related parties...');
  for (const party of INITIAL_PARTIES) {
    await prisma.relatedParty.upsert({
      where: { id: party.id },
      update: {
        name: party.name,
        type: party.type as any,
        code: party.code,
        vatNumber: party.vatNumber,
        roles: party.roles as any,
        phone: party.phone,
        email: party.email,
        address: party.address,
        bankAccount: party.bankAccount,
        notes: party.notes,
        isOwnCompany: party.isOwnCompany ?? false
      },
      create: {
        id: party.id,
        name: party.name,
        type: party.type as any,
        code: party.code,
        vatNumber: party.vatNumber,
        roles: party.roles as any,
        phone: party.phone,
        email: party.email,
        address: party.address,
        bankAccount: party.bankAccount,
        notes: party.notes,
        isOwnCompany: party.isOwnCompany ?? false
      }
    });
  }

  // 3. Cadastral Parcels
  console.log('3/8 Seeding cadastral parcels...');
  for (const cad of SAMPLE_CADASTRAL_PARCELS) {
    await prisma.cadastralParcel.upsert({
      where: { cadastralCode: cad.cadastralCode },
      update: {
        name: cad.name,
        notes: cad.notes
      },
      create: {
        cadastralCode: cad.cadastralCode,
        name: cad.name,
        notes: cad.notes
      }
    });
  }

  // 4. Seasons
  console.log('4/8 Seeding seasons...');
  for (const s of INITIAL_SEASONS) {
    await prisma.season.upsert({
      where: { year: s.year },
      update: {
        name: s.name,
        status: mapSeasonStatus(s.status) as any,
        isLocked: s.isLocked ?? false,
        preparationStartDate: s.preparationStartDate ? new Date(s.preparationStartDate) : null,
        seedingStartDate: s.seedingStartDate ? new Date(s.seedingStartDate) : null,
        harvestStartDate: s.harvestStartDate ? new Date(s.harvestStartDate) : null,
        harvestEndDate: s.harvestEndDate ? new Date(s.harvestEndDate) : null,
        closedAt: s.closedAt ? new Date(s.closedAt) : null,
        closedBy: s.closedBy,
        totalAreaHa: s.totalAreaHa,
        fieldsCount: s.fieldsCount,
        targetYieldTons: s.targetYieldTons,
        actualYieldTons: s.actualYieldTons,
        notes: s.notes
      },
      create: {
        year: s.year,
        name: s.name,
        status: mapSeasonStatus(s.status) as any,
        isLocked: s.isLocked ?? false,
        preparationStartDate: s.preparationStartDate ? new Date(s.preparationStartDate) : null,
        seedingStartDate: s.seedingStartDate ? new Date(s.seedingStartDate) : null,
        harvestStartDate: s.harvestStartDate ? new Date(s.harvestStartDate) : null,
        harvestEndDate: s.harvestEndDate ? new Date(s.harvestEndDate) : null,
        closedAt: s.closedAt ? new Date(s.closedAt) : null,
        closedBy: s.closedBy,
        totalAreaHa: s.totalAreaHa,
        fieldsCount: s.fieldsCount,
        targetYieldTons: s.targetYieldTons,
        actualYieldTons: s.actualYieldTons,
        notes: s.notes
      }
    });
  }

  // Map season years to season DB IDs
  const dbSeasons = await prisma.season.findMany();
  const seasonMap = new Map<number, number>();
  dbSeasons.forEach(s => seasonMap.set(s.year, s.id));

  // 5. Fields
  console.log('5/8 Seeding fields...');
  for (const f of SAMPLE_FIELDS) {
    await prisma.field.upsert({
      where: { fieldCode: f.fieldCode },
      update: {
        num: f.num || 'x',
        name: f.name,
        cadastralCode: f.cadastralCode,
        soilType: f.soilType,
        drainageSystem: f.drainageSystem ?? false,
        notes: f.notes
      },
      create: {
        id: f.id,
        num: f.num || 'x',
        name: f.name,
        fieldCode: f.fieldCode,
        cadastralCode: f.cadastralCode,
        soilType: f.soilType,
        drainageSystem: f.drainageSystem ?? false,
        notes: f.notes
      }
    });
  }

  // 6. Field Seasons
  console.log('6/8 Seeding field seasons (yearly records & polygons)...');
  for (const row of SAMPLE_FIELD_SEASONS_ROWS) {
    const sId = seasonMap.get(row.year) || row.seasonId || null;
    await prisma.fieldSeason.upsert({
      where: {
        fieldId_year: {
          fieldId: row.fieldId,
          year: row.year
        }
      },
      update: {
        seasonId: sId,
        areaHa: row.areaHa,
        eligibleAreaHa: (row as any).eligibleAreaHa ?? null,
        areaChangeReason: (row as any).areaChangeReason ?? null,
        crop: row.crop,
        cropVariety: row.cropVariety,
        cropColor: row.cropColor || '#eab308',
        targetYieldTonsHa: row.targetYieldTonsHa,
        actualYieldTonsHa: row.actualYieldTonsHa,
        workedAreaHa: row.workedAreaHa ?? 0,
        workProgress: row.workProgress ?? 0,
        status: mapFieldStatus(row.status) as any,
        seedingDate: row.seedingDate ? new Date(row.seedingDate) : null,
        harvestDate: row.harvestDate ? new Date(row.harvestDate) : null,
        notes: row.notes,
        geometry: row.geometry as any
      },
      create: {
        id: row.id,
        fieldId: row.fieldId,
        seasonId: sId,
        year: row.year,
        areaHa: row.areaHa,
        eligibleAreaHa: (row as any).eligibleAreaHa ?? null,
        areaChangeReason: (row as any).areaChangeReason ?? null,
        crop: row.crop,
        cropVariety: row.cropVariety,
        cropColor: row.cropColor || '#eab308',
        targetYieldTonsHa: row.targetYieldTonsHa,
        actualYieldTonsHa: row.actualYieldTonsHa,
        workedAreaHa: row.workedAreaHa ?? 0,
        workProgress: row.workProgress ?? 0,
        status: mapFieldStatus(row.status) as any,
        seedingDate: row.seedingDate ? new Date(row.seedingDate) : null,
        harvestDate: row.harvestDate ? new Date(row.harvestDate) : null,
        notes: row.notes,
        geometry: row.geometry as any
      }
    });
  }

  // 7. Points of Interest
  console.log('7/8 Seeding points of interest...');
  for (const poi of SAMPLE_POI_LIST) {
    await prisma.pointOfInterest.upsert({
      where: { id: poi.id },
      update: {
        name: poi.name,
        category: mapPoiCategory(poi.category) as any,
        latitude: poi.position[0],
        longitude: poi.position[1],
        description: poi.description,
        capacity: poi.capacity,
        contactPerson: poi.contactPerson,
        phone: poi.phone,
        accessNotes: poi.accessNotes
      },
      create: {
        id: poi.id,
        name: poi.name,
        category: mapPoiCategory(poi.category) as any,
        latitude: poi.position[0],
        longitude: poi.position[1],
        description: poi.description,
        capacity: poi.capacity,
        contactPerson: poi.contactPerson,
        phone: poi.phone,
        accessNotes: poi.accessNotes
      }
    });
  }

  // 8. Fleet (implements, devices, vehicles)
  console.log('8/8 Seeding fleet...');
  for (const impl of INITIAL_IMPLEMENTS) {
    await prisma.implement.upsert({
      where: { id: impl.id },
      update: {
        name: impl.name,
        type: mapImplementType(impl.type) as any,
        workingWidthM: impl.workingWidthM,
        manufacturer: impl.manufacturer,
        model: impl.model,
        year: impl.year,
        notes: impl.notes
      },
      create: {
        id: impl.id,
        name: impl.name,
        type: mapImplementType(impl.type) as any,
        workingWidthM: impl.workingWidthM,
        manufacturer: impl.manufacturer,
        model: impl.model,
        year: impl.year,
        notes: impl.notes
      }
    });
  }

  for (const dev of INITIAL_TELTONIKA_DEVICES) {
    await prisma.teltonikaDevice.upsert({
      where: { id: dev.id },
      update: {
        imei: dev.imei,
        model: dev.model,
        simNumber: dev.simNumber,
        firmware: (dev as any).firmwareVersion || (dev as any).firmware,
        status: mapDeviceStatus((dev as any).status) as any
      },
      create: {
        id: dev.id,
        imei: dev.imei,
        model: dev.model,
        simNumber: dev.simNumber,
        firmware: (dev as any).firmwareVersion || (dev as any).firmware,
        status: mapDeviceStatus((dev as any).status) as any
      }
    });
  }

  for (const v of INITIAL_VEHICLES) {
    const vData: any = {
      name: v.name,
      type: mapVehicleType(v.type) as any,
      model: v.model,
      regNumber: (v as any).registrationPlate || (v as any).regNumber,
      color: v.color || '#10b981',
      notes: v.notes
    };
    if (v.assignedDeviceId) {
      vData.assignedDevice = { connect: { id: v.assignedDeviceId } };
    }
    if (v.assignedImplementId) {
      vData.assignedImplement = { connect: { id: v.assignedImplementId } };
    }

    await prisma.vehicle.upsert({
      where: { id: v.id },
      update: vData,
      create: {
        id: v.id,
        ...vData
      }
    });
  }

  console.log('✅ agro_db database successfully seeded with initial data!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
