// prisma/seed.ts
import { SAMPLE_FIELDS } from '../src/data/sampleFields';
import { INITIAL_SEASONS } from '../src/data/sampleSeasons';
import { SAMPLE_FIELD_SEASONS_ROWS } from '../src/data/sampleFieldSeasons';
import { SAMPLE_POI_LIST } from '../src/data/samplePoi';
import { INITIAL_VEHICLES, INITIAL_IMPLEMENTS, INITIAL_TELTONIKA_DEVICES } from '../src/data/sampleFleet';

/**
 * Näidisskript mock-andmete laadimiseks Prisma kaudu andmebaasi:
 * npx prisma db seed
 */
export async function seedDatabase(prisma: any) {
  console.log('Seeding farming seasons...');
  for (const s of INITIAL_SEASONS) {
    await prisma.season.upsert({
      where: { year: s.year },
      update: s,
      create: s
    });
  }

  console.log('Seeding master fields...');
  for (const f of SAMPLE_FIELDS) {
    await prisma.field.upsert({
      where: { fieldCode: f.fieldCode },
      update: f,
      create: f
    });
  }

  console.log('Seeding field season records...');
  for (const row of SAMPLE_FIELD_SEASONS_ROWS) {
    await prisma.fieldSeason.upsert({
      where: {
        fieldId_year: {
          fieldId: row.fieldId,
          year: row.year
        }
      },
      update: row,
      create: row
    });
  }

  console.log('Seeding POIs...');
  for (const poi of SAMPLE_POI_LIST) {
    await prisma.pointOfInterest.upsert({
      where: { id: poi.id },
      update: {
        name: poi.name,
        category: poi.category.toUpperCase(),
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
        category: poi.category.toUpperCase(),
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

  console.log('Seeding implements, devices and fleet vehicles...');
  for (const impl of INITIAL_IMPLEMENTS) {
    await prisma.implement.upsert({
      where: { id: impl.id },
      update: impl,
      create: impl
    });
  }

  for (const dev of INITIAL_TELTONIKA_DEVICES) {
    await prisma.teltonikaDevice.upsert({
      where: { id: dev.id },
      update: dev,
      create: dev
    });
  }

  for (const v of INITIAL_VEHICLES) {
    await prisma.vehicle.upsert({
      where: { id: v.id },
      update: v,
      create: v
    });
  }

  console.log('Seeding completed successfully!');
}
