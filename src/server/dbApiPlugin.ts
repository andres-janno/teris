// src/server/dbApiPlugin.ts
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function json(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function dbApiPlugin(): Plugin {
  return {
    name: 'db-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        const method = req.method?.toUpperCase() || 'GET';

        try {
          // 1. Health check / status
          if (pathname === '/api/status' && method === 'GET') {
            const [seasonsCount, fieldsCount, fieldSeasonsCount, poisCount, vehiclesCount, cropsCount] =
              await Promise.all([
                prisma.season.count(),
                prisma.field.count(),
                prisma.fieldSeason.count(),
                prisma.pointOfInterest.count(),
                prisma.vehicle.count(),
                prisma.crop.count()
              ]);

            return json(res, {
              status: 'connected',
              database: 'agro_db',
              counts: {
                seasons: seasonsCount,
                fields: fieldsCount,
                fieldSeasons: fieldSeasonsCount,
                pois: poisCount,
                vehicles: vehiclesCount,
                crops: cropsCount
              }
            });
          }

          // 2. Seasons
          if (pathname === '/api/seasons' && method === 'GET') {
            const dbSeasons = await prisma.season.findMany({
              orderBy: { year: 'desc' }
            });
            const mapped = dbSeasons.map((s) => ({
              id: s.id,
              year: s.year,
              name: s.name,
              status: s.status.toLowerCase(),
              isLocked: s.isLocked,
              preparationStartDate: s.preparationStartDate?.toISOString().split('T')[0] ?? null,
              seedingStartDate: s.seedingStartDate?.toISOString().split('T')[0] ?? null,
              harvestStartDate: s.harvestStartDate?.toISOString().split('T')[0] ?? null,
              harvestEndDate: s.harvestEndDate?.toISOString().split('T')[0] ?? null,
              closedAt: s.closedAt?.toISOString().split('T')[0] ?? null,
              closedBy: s.closedBy,
              totalAreaHa: s.totalAreaHa,
              fieldsCount: s.fieldsCount,
              targetYieldTons: s.targetYieldTons,
              actualYieldTons: s.actualYieldTons,
              notes: s.notes
            }));
            return json(res, mapped);
          }

          if (pathname === '/api/seasons' && method === 'POST') {
            const body = await parseBody(req);
            const statusUpper = (body.status || 'planning').toUpperCase();
            const saved = await prisma.season.upsert({
              where: { year: Number(body.year) },
              update: {
                name: body.name,
                status: statusUpper as any,
                isLocked: Boolean(body.isLocked),
                preparationStartDate: body.preparationStartDate ? new Date(body.preparationStartDate) : null,
                seedingStartDate: body.seedingStartDate ? new Date(body.seedingStartDate) : null,
                harvestStartDate: body.harvestStartDate ? new Date(body.harvestStartDate) : null,
                harvestEndDate: body.harvestEndDate ? new Date(body.harvestEndDate) : null,
                closedAt: body.closedAt ? new Date(body.closedAt) : null,
                closedBy: body.closedBy ?? null,
                totalAreaHa: body.totalAreaHa != null ? Number(body.totalAreaHa) : null,
                fieldsCount: body.fieldsCount != null ? Number(body.fieldsCount) : null,
                targetYieldTons: body.targetYieldTons != null ? Number(body.targetYieldTons) : null,
                actualYieldTons: body.actualYieldTons != null ? Number(body.actualYieldTons) : null,
                notes: body.notes ?? null
              },
              create: {
                year: Number(body.year),
                name: body.name,
                status: statusUpper as any,
                isLocked: Boolean(body.isLocked),
                preparationStartDate: body.preparationStartDate ? new Date(body.preparationStartDate) : null,
                seedingStartDate: body.seedingStartDate ? new Date(body.seedingStartDate) : null,
                harvestStartDate: body.harvestStartDate ? new Date(body.harvestStartDate) : null,
                harvestEndDate: body.harvestEndDate ? new Date(body.harvestEndDate) : null,
                closedAt: body.closedAt ? new Date(body.closedAt) : null,
                closedBy: body.closedBy ?? null,
                totalAreaHa: body.totalAreaHa != null ? Number(body.totalAreaHa) : null,
                fieldsCount: body.fieldsCount != null ? Number(body.fieldsCount) : null,
                targetYieldTons: body.targetYieldTons != null ? Number(body.targetYieldTons) : null,
                actualYieldTons: body.actualYieldTons != null ? Number(body.actualYieldTons) : null,
                notes: body.notes ?? null
              }
            });
            return json(res, saved);
          }

          // 3. Master Fields (Fields + FieldSeasons)
          if (pathname === '/api/master-fields' && method === 'GET') {
            const dbFields = await prisma.field.findMany({
              include: {
                fieldSeasons: {
                  orderBy: { year: 'desc' }
                }
              },
              orderBy: { id: 'asc' }
            });

            const mapped = dbFields.map((f) => ({
              id: f.id,
              num: f.num,
              name: f.name,
              fieldCode: f.fieldCode,
              cadastralCode: f.cadastralCode,
              soilType: f.soilType,
              drainageSystem: f.drainageSystem,
              notes: f.notes,
              history: f.fieldSeasons.map((fs) => ({
                year: fs.year,
                areaHa: fs.areaHa,
                eligibleAreaHa: fs.eligibleAreaHa,
                areaChangeReason: fs.areaChangeReason,
                crop: fs.crop,
                cropVariety: fs.cropVariety,
                cropColor: fs.cropColor,
                targetYieldTonsHa: fs.targetYieldTonsHa,
                actualYieldTonsHa: fs.actualYieldTonsHa,
                workedAreaHa: fs.workedAreaHa,
                workProgress: fs.workProgress,
                status: fs.status.toLowerCase(),
                seedingDate: fs.seedingDate?.toISOString().split('T')[0] ?? null,
                harvestDate: fs.harvestDate?.toISOString().split('T')[0] ?? null,
                boundaryPointsCount: fs.boundaryPointsCount,
                perimeterM: fs.perimeterM,
                notes: fs.notes,
                geometry: fs.geometry
              }))
            }));

            return json(res, mapped);
          }

          if (pathname === '/api/master-fields' && method === 'POST') {
            const body = await parseBody(req);
            const items = Array.isArray(body) ? body : [body];
            const results = [];

            for (const item of items) {
              const upsertedField = await prisma.field.upsert({
                where: { fieldCode: String(item.fieldCode) },
                update: {
                  num: item.num || 'x',
                  name: item.name,
                  cadastralCode: item.cadastralCode ?? null,
                  soilType: item.soilType ?? null,
                  drainageSystem: Boolean(item.drainageSystem),
                  notes: item.notes ?? null
                },
                create: {
                  num: item.num || 'x',
                  name: item.name,
                  fieldCode: String(item.fieldCode),
                  cadastralCode: item.cadastralCode ?? null,
                  soilType: item.soilType ?? null,
                  drainageSystem: Boolean(item.drainageSystem),
                  notes: item.notes ?? null
                }
              });

              if (item.history && Array.isArray(item.history)) {
                for (const h of item.history) {
                  const statusUpper = (h.status || 'not_started').toUpperCase();
                  await prisma.fieldSeason.upsert({
                    where: {
                      fieldId_year: {
                        fieldId: upsertedField.id,
                        year: Number(h.year)
                      }
                    },
                    update: {
                      areaHa: Number(h.areaHa) || 0,
                      eligibleAreaHa: h.eligibleAreaHa != null ? Number(h.eligibleAreaHa) : null,
                      areaChangeReason: h.areaChangeReason ?? null,
                      crop: h.crop || 'Teadmata kultuur',
                      cropVariety: h.cropVariety ?? null,
                      cropColor: h.cropColor || '#eab308',
                      targetYieldTonsHa: h.targetYieldTonsHa != null ? Number(h.targetYieldTonsHa) : null,
                      actualYieldTonsHa: h.actualYieldTonsHa != null ? Number(h.actualYieldTonsHa) : null,
                      workedAreaHa: Number(h.workedAreaHa) || 0,
                      workProgress: Number(h.workProgress) || 0,
                      status: statusUpper as any,
                      seedingDate: h.seedingDate ? new Date(h.seedingDate) : null,
                      harvestDate: h.harvestDate ? new Date(h.harvestDate) : null,
                      notes: h.notes ?? null,
                      geometry: h.geometry || item.geometry || null
                    },
                    create: {
                      fieldId: upsertedField.id,
                      year: Number(h.year),
                      areaHa: Number(h.areaHa) || 0,
                      eligibleAreaHa: h.eligibleAreaHa != null ? Number(h.eligibleAreaHa) : null,
                      areaChangeReason: h.areaChangeReason ?? null,
                      crop: h.crop || 'Teadmata kultuur',
                      cropVariety: h.cropVariety ?? null,
                      cropColor: h.cropColor || '#eab308',
                      targetYieldTonsHa: h.targetYieldTonsHa != null ? Number(h.targetYieldTonsHa) : null,
                      actualYieldTonsHa: h.actualYieldTonsHa != null ? Number(h.actualYieldTonsHa) : null,
                      workedAreaHa: Number(h.workedAreaHa) || 0,
                      workProgress: Number(h.workProgress) || 0,
                      status: statusUpper as any,
                      seedingDate: h.seedingDate ? new Date(h.seedingDate) : null,
                      harvestDate: h.harvestDate ? new Date(h.harvestDate) : null,
                      notes: h.notes ?? null,
                      geometry: h.geometry || item.geometry || null
                    }
                  });
                }
              }

              results.push(upsertedField);
            }

            return json(res, { success: true, count: results.length });
          }

          if (pathname.startsWith('/api/master-fields/') && method === 'DELETE') {
            const idPart = pathname.replace('/api/master-fields/', '');
            const fieldId = Number(idPart);
            if (!isNaN(fieldId)) {
              await prisma.field.delete({ where: { id: fieldId } });
            } else {
              await prisma.field.delete({ where: { fieldCode: idPart } });
            }
            return json(res, { success: true, id: idPart });
          }

          // 4. Points of Interest (POI)
          if (pathname === '/api/poi' && method === 'GET') {
            const dbPois = await prisma.pointOfInterest.findMany({
              orderBy: { name: 'asc' }
            });
            const mapped = dbPois.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category.toLowerCase(),
              position: [p.latitude, p.longitude],
              description: p.description ?? undefined,
              capacity: p.capacity ?? undefined,
              contactPerson: p.contactPerson ?? undefined,
              phone: p.phone ?? undefined,
              accessNotes: p.accessNotes ?? undefined
            }));
            return json(res, mapped);
          }

          if (pathname === '/api/poi' && method === 'POST') {
            const body = await parseBody(req);
            const categoryUpper = (body.category || 'other').toUpperCase();
            const lat = Array.isArray(body.position) ? body.position[0] : body.latitude;
            const lng = Array.isArray(body.position) ? body.position[1] : body.longitude;

            const saved = await prisma.pointOfInterest.upsert({
              where: { id: body.id || `poi-${Date.now()}` },
              update: {
                name: body.name,
                category: categoryUpper as any,
                latitude: Number(lat),
                longitude: Number(lng),
                description: body.description ?? null,
                capacity: body.capacity ?? null,
                contactPerson: body.contactPerson ?? null,
                phone: body.phone ?? null,
                accessNotes: body.accessNotes ?? null
              },
              create: {
                id: body.id || `poi-${Date.now()}`,
                name: body.name,
                category: categoryUpper as any,
                latitude: Number(lat),
                longitude: Number(lng),
                description: body.description ?? null,
                capacity: body.capacity ?? null,
                contactPerson: body.contactPerson ?? null,
                phone: body.phone ?? null,
                accessNotes: body.accessNotes ?? null
              }
            });
            return json(res, saved);
          }

          if (pathname.startsWith('/api/poi/') && method === 'DELETE') {
            const id = pathname.replace('/api/poi/', '');
            await prisma.pointOfInterest.delete({ where: { id } });
            return json(res, { success: true, id });
          }

          // 5. Fleet (Vehicles, Implements, Devices)
          if (pathname === '/api/fleet' && method === 'GET') {
            const [rawVehicles, rawImplements, rawDevices] = await Promise.all([
              prisma.vehicle.findMany({
                include: { assignedDriver: true }
              }),
              prisma.implement.findMany(),
              prisma.teltonikaDevice.findMany()
            ]);

            const vehicles = rawVehicles.map((v) => ({
              id: v.id,
              name: v.name,
              type: v.type.toLowerCase(),
              model: v.model,
              registrationPlate: v.regNumber ?? undefined,
              color: v.color,
              driverName: v.assignedDriver?.name,
              assignedDeviceId: v.assignedDeviceId ?? undefined,
              assignedImplementId: v.assignedImplementId ?? undefined,
              notes: (v as any).notes ?? undefined
            }));

            const implementsList = rawImplements.map((i) => ({
              id: i.id,
              name: i.name,
              type: i.type.toLowerCase(),
              model: i.model ?? '',
              manufacturer: i.manufacturer ?? '',
              workingWidthM: i.workingWidthM,
              year: i.year ?? undefined,
              assignedDeviceId: i.assignedDeviceId ?? undefined,
              notes: i.notes ?? undefined
            }));

            const devices = rawDevices.map((d) => ({
              id: d.id,
              connectivityType: d.connectivityType.toLowerCase(),
              imei: d.imei ?? undefined,
              macAddress: d.macAddress ?? undefined,
              model: d.model,
              simNumber: d.simNumber ?? '',
              firmwareVersion: d.firmware ?? undefined,
              status: d.status.toLowerCase(),
              // Andmebaas hoiab ainult seadme registrikirjet; reaalajatelemeetria
              // (asukoht, kiirus jm) tuleb GPS-voost/simulaatorist, mitte DB-st.
              // Ilma vaikeväärtusteta jääksid need väljad undefined ja
              // vehicle.speedKmH.toFixed() jms kutsed UI-s viskaksid vea.
              batteryVoltage: 0,
              fuelLevelPct: 0,
              ignition: false,
              hydraulicActive: false,
              satelliteCount: 0,
              hdop: 9.9,
              position: [58.1385, 25.8835] as [number, number],
              heading: 0,
              speedKmH: 0,
              lastUpdate: new Date().toISOString()
            }));

            return json(res, { vehicles, implements: implementsList, devices });
          }

          if (pathname === '/api/fleet/vehicles' && method === 'POST') {
            const v = await parseBody(req);
            const vData: any = {
              name: v.name,
              type: (v.type || 'tractor').toUpperCase() as any,
              model: v.model,
              regNumber: v.registrationPlate || v.regNumber || null,
              color: v.color || '#10b981',
              notes: v.notes ?? null
            };
            if (v.assignedDeviceId) {
              vData.assignedDevice = { connect: { id: v.assignedDeviceId } };
            }
            if (v.assignedImplementId) {
              vData.assignedImplement = { connect: { id: v.assignedImplementId } };
            }

            const saved = await prisma.vehicle.upsert({
              where: { id: v.id || `veh-${Date.now()}` },
              update: vData,
              create: {
                id: v.id || `veh-${Date.now()}`,
                ...vData
              }
            });
            return json(res, saved);
          }

          if (pathname.startsWith('/api/fleet/vehicles/') && method === 'DELETE') {
            const id = pathname.replace('/api/fleet/vehicles/', '');
            await prisma.vehicle.delete({ where: { id } });
            return json(res, { success: true, id });
          }

          if (pathname === '/api/fleet/implements' && method === 'POST') {
            const i = await parseBody(req);
            const iData: any = {
              name: i.name,
              type: (i.type || 'other').toUpperCase() as any,
              workingWidthM: i.workingWidthM,
              manufacturer: i.manufacturer || null,
              model: i.model || null,
              year: i.year ?? null,
              assignedDeviceId: i.assignedDeviceId || null,
              notes: i.notes ?? null
            };

            const saved = await prisma.implement.upsert({
              where: { id: i.id || `imp-${Date.now()}` },
              update: iData,
              create: {
                id: i.id || `imp-${Date.now()}`,
                ...iData
              }
            });

            // assignedVehicleId is a virtual field derived from Vehicle.assignedImplementId
            if (i.assignedVehicleId) {
              await prisma.vehicle.update({
                where: { id: i.assignedVehicleId },
                data: { assignedImplementId: saved.id }
              });
            }
            return json(res, saved);
          }

          if (pathname.startsWith('/api/fleet/implements/') && method === 'DELETE') {
            const id = pathname.replace('/api/fleet/implements/', '');
            await prisma.vehicle.updateMany({
              where: { assignedImplementId: id },
              data: { assignedImplementId: null }
            });
            await prisma.implement.delete({ where: { id } });
            return json(res, { success: true, id });
          }

          if (pathname === '/api/fleet/devices' && method === 'POST') {
            const d = await parseBody(req);
            const dData: any = {
              connectivityType: (d.connectivityType || 'cellular').toUpperCase() as any,
              imei: d.imei || null,
              macAddress: d.macAddress || null,
              model: d.model,
              simNumber: d.simNumber || null,
              firmware: d.firmwareVersion || null,
              status: (d.status || 'offline').toUpperCase() as any
            };

            const saved = await prisma.teltonikaDevice.upsert({
              where: { id: d.id || `tel-${Date.now()}` },
              update: dData,
              create: {
                id: d.id || `tel-${Date.now()}`,
                ...dData
              }
            });

            // assignedVehicleId/assignedImplementId are virtual fields derived
            // from Vehicle.assignedDeviceId / Implement.assignedDeviceId
            if (d.assignedVehicleId) {
              await prisma.vehicle.update({
                where: { id: d.assignedVehicleId },
                data: { assignedDeviceId: saved.id }
              });
            }
            if (d.assignedImplementId) {
              await prisma.implement.update({
                where: { id: d.assignedImplementId },
                data: { assignedDeviceId: saved.id }
              });
            }
            return json(res, saved);
          }

          if (pathname.startsWith('/api/fleet/devices/') && method === 'DELETE') {
            const id = pathname.replace('/api/fleet/devices/', '');
            await prisma.vehicle.updateMany({
              where: { assignedDeviceId: id },
              data: { assignedDeviceId: null }
            });
            await prisma.implement.updateMany({
              where: { assignedDeviceId: id },
              data: { assignedDeviceId: null }
            });
            await prisma.teltonikaDevice.delete({ where: { id } });
            return json(res, { success: true, id });
          }

          // assignedImplementId/assignedDeviceId are @unique on Vehicle, so any
          // vehicle currently holding this implement/device must be cleared
          // before it can be attached to a different (or no) vehicle.
          if (pathname === '/api/fleet/implements/assign' && method === 'POST') {
            const { implementId, vehicleId } = await parseBody(req);
            await prisma.vehicle.updateMany({
              where: { assignedImplementId: implementId },
              data: { assignedImplementId: null }
            });
            if (vehicleId) {
              await prisma.vehicle.update({
                where: { id: vehicleId },
                data: { assignedImplementId: implementId }
              });
            }
            return json(res, { success: true });
          }

          if (pathname === '/api/fleet/devices/assign' && method === 'POST') {
            // A device attaches to at most one target (a vehicle OR an implement) at a time.
            const { deviceId, vehicleId, implementId } = await parseBody(req);
            await prisma.vehicle.updateMany({
              where: { assignedDeviceId: deviceId },
              data: { assignedDeviceId: null }
            });
            await prisma.implement.updateMany({
              where: { assignedDeviceId: deviceId },
              data: { assignedDeviceId: null }
            });
            if (vehicleId) {
              await prisma.vehicle.update({
                where: { id: vehicleId },
                data: { assignedDeviceId: deviceId }
              });
            } else if (implementId) {
              await prisma.implement.update({
                where: { id: implementId },
                data: { assignedDeviceId: deviceId }
              });
            }
            return json(res, { success: true });
          }

          // 6. Related Parties
          if (pathname === '/api/parties' && method === 'GET') {
            const dbParties = await prisma.relatedParty.findMany({
              orderBy: { name: 'asc' }
            });
            return json(res, dbParties);
          }

          if (pathname === '/api/parties' && method === 'POST') {
            const p = await parseBody(req);
            const saved = await prisma.relatedParty.upsert({
              where: { id: p.id || `party-${Date.now()}` },
              update: {
                name: p.name,
                type: (p.type || 'PERSON') as any,
                code: p.code ?? null,
                vatNumber: p.vatNumber ?? null,
                roles: p.roles as any,
                phone: p.phone ?? null,
                email: p.email ?? null,
                address: p.address ?? null,
                bankAccount: p.bankAccount ?? null,
                notes: p.notes ?? null,
                isOwnCompany: Boolean(p.isOwnCompany)
              },
              create: {
                id: p.id || `party-${Date.now()}`,
                name: p.name,
                type: (p.type || 'PERSON') as any,
                code: p.code ?? null,
                vatNumber: p.vatNumber ?? null,
                roles: p.roles as any,
                phone: p.phone ?? null,
                email: p.email ?? null,
                address: p.address ?? null,
                bankAccount: p.bankAccount ?? null,
                notes: p.notes ?? null,
                isOwnCompany: Boolean(p.isOwnCompany)
              }
            });
            return json(res, saved);
          }

          if (pathname.startsWith('/api/parties/') && method === 'DELETE') {
            const id = pathname.replace('/api/parties/', '');
            await prisma.relatedParty.delete({ where: { id } });
            return json(res, { success: true, id });
          }

          // 7. Crops
          if (pathname === '/api/crops' && method === 'GET') {
            const dbCrops = await prisma.crop.findMany({
              include: { varieties: true },
              orderBy: { name: 'asc' }
            });
            return json(res, dbCrops);
          }

          if (pathname === '/api/crops' && method === 'POST') {
            const crop = await parseBody(req);
            const saved = await prisma.crop.upsert({
              where: { id: crop.id || `crop-${Date.now()}` },
              update: {
                name: crop.name,
                scientificName: crop.scientificName ?? null,
                group: (crop.group || 'CEREAL') as any,
                color: crop.color || '#eab308',
                icon: crop.icon ?? null,
                priaCode: crop.priaCode ?? null,
                defaultSeedRateKgHa: crop.defaultSeedRateKgHa ? Number(crop.defaultSeedRateKgHa) : null,
                defaultYieldTonsHa: crop.defaultYieldTonsHa ? Number(crop.defaultYieldTonsHa) : null,
                description: crop.description ?? null
              },
              create: {
                id: crop.id || `crop-${Date.now()}`,
                name: crop.name,
                scientificName: crop.scientificName ?? null,
                group: (crop.group || 'CEREAL') as any,
                color: crop.color || '#eab308',
                icon: crop.icon ?? null,
                priaCode: crop.priaCode ?? null,
                defaultSeedRateKgHa: crop.defaultSeedRateKgHa ? Number(crop.defaultSeedRateKgHa) : null,
                defaultYieldTonsHa: crop.defaultYieldTonsHa ? Number(crop.defaultYieldTonsHa) : null,
                description: crop.description ?? null
              }
            });
            return json(res, saved);
          }

          if (pathname.startsWith('/api/crops/') && method === 'DELETE') {
            const id = pathname.replace('/api/crops/', '');
            await prisma.crop.delete({ where: { id } });
            return json(res, { success: true, id });
          }

          return json(res, { error: 'Not found' }, 404);
        } catch (err: any) {
          console.error('[API Error]:', err);
          return json(res, { error: err.message || 'Internal Server Error' }, 500);
        }
      });
    }
  };
}
