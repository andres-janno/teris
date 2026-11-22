// src/server/mcp/tools/fleet.ts — masinad ja haakeriistad; masina tegevus (kanded + telemeetria süüte järgi).
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { fetchDevicePackets, type DevicePacket } from '../../telemetryAccess.ts';
import { buildRoute, DEFAULT_ROUTE_OPTIONS } from '../../tripRoute.ts';
import { loadPlaces } from '../../tripPlaces.ts';
import { defineTool, canSeeFinance, hasTelemetry } from '../context.ts';
import { parseDateInput, dayAfter, fieldLabel, fmtDate, fmtDateTime, round2, limitRows, ToolInputError } from '../format.ts';
import { resolveVehicleId } from './works.ts';
import { loadAssignmentResolver } from '../../tripAssignments.ts';
import { GAP_LIMITS } from '../../../services/tripGapLimits.ts';
import { ignitionHoursByDay, tallinnMidnightUtc } from '../ignitionHours.ts';

const MAX_DAYS = 31;
const GAP_MAX_DAYS = 92;
const GAP_LIMIT = 200;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });

const financeOut = (r: { acquisitionCost: number | null; acquisitionDate: Date | null; depreciationRate: number | null; depreciationMethod: string | null; hourlyRate: unknown }) => ({
  acquisitionCost: r.acquisitionCost, acquired: fmtDate(r.acquisitionDate), depreciationRatePct: r.depreciationRate, depreciationMethod: r.depreciationMethod,
  hourlyRate: r.hourlyRate === null || r.hourlyRate === undefined ? null : round2(Number(r.hourlyRate))
});

export const fleetTools = [
  defineTool({
    name: 'list_vehicles',
    title: 'Masinad ja haakeriistad',
    description: 'Masinad (liik, mudel, reg nr, VIN, aasta, paak, laius, praegu haagitud haakeriist, viimane aktiivsus) ja haakeriistad. Telemeetria mooduliga ka viimane asukoht; finantsõigusega soetusmaksumus, amortisatsioon ja tunnihind.',
    input: { type: z.string().optional().describe('Masina või haakeriista liik (nt TRACTOR, COMBINE, SEEDER)') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const telemetry = hasTelemetry(ctx);
      const now = new Date();
      const typeFilter = a.type?.trim().toUpperCase();
      const [vehicles, implementRows, hitches] = await Promise.all([
        prisma.vehicle.findMany({
          orderBy: { name: 'asc' },
          include: { fuelArticle: { select: { name: true } }, serviceArticle: { select: { name: true } } }
        }),
        prisma.implement.findMany({
          orderBy: { name: 'asc' },
          include: { serviceArticle: { select: { name: true } } }
        }),
        prisma.implementAssignment.findMany({
          where: { startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gt: now } }] },
          orderBy: { startedAt: 'desc' }, select: { vehicleId: true, implement: { select: { name: true } } }
        })
      ]);
      const hitchOf = new Map<string, string>();
      for (const h of hitches) if (!hitchOf.has(h.vehicleId)) hitchOf.set(h.vehicleId, h.implement.name);
      const vOut = typeFilter ? vehicles.filter((v) => v.type === typeFilter || v.category?.toUpperCase() === typeFilter) : vehicles;
      const iOut = typeFilter ? implementRows.filter((i) => i.type === typeFilter || i.category?.toUpperCase() === typeFilter) : implementRows;
      return {
        vehicles: vOut.map((v) => ({
          name: v.name, type: v.type, category: v.category, manufacturer: v.manufacturer, model: v.model, regNumber: v.regNumber,
          serialNumber: v.serialNumber, year: v.year, powerKw: v.powerKw, workingWidthM: v.workingWidthM, fuelCapacityL: v.fuelCapacityL,
          fuelArticle: v.fuelArticle?.name ?? null, serviceArticle: v.serviceArticle?.name ?? null,
          implement: hitchOf.get(v.id) ?? null, notes: v.notes,
          ...(telemetry ? { lastActive: fmtDateTime(v.lastActiveAt) } : {}),
          ...(telemetry && v.lastLatitude != null && v.lastLongitude != null ? { lastPosition: { lat: v.lastLatitude, lng: v.lastLongitude } } : {}),
          ...(finance ? financeOut(v) : {})
        })),
        implements: iOut.map((i) => ({
          name: i.name, type: i.type, category: i.category, manufacturer: i.manufacturer, model: i.model, regNumber: i.regNumber,
          serialNumber: i.serialNumber, year: i.year, workingWidthM: i.workingWidthM,
          serviceArticle: i.serviceArticle?.name ?? null, notes: i.notes,
          ...(finance ? financeOut(i) : {})
        }))
      };
    }
  }),
  defineTool({
    name: 'get_vehicle_activity',
    title: 'Masina tegevus',
    description: `Masina tegevus ajavahemikus (kuni ${MAX_DAYS} päeva): selle masinaga tehtud kanded; telemeetria mooduliga lisaks süüte järgi töötunnid päevade kaupa ja põllud, kus masin käis.`,
    input: { vehicle: z.string().min(1).describe('Masina nimi või reg nr'), from: z.string().describe('Alates (pp.kk.aaaa)'), to: z.string().describe('Kuni, kaasa arvatud (pp.kk.aaaa)') },
    run: async (a, ctx) => {
      const from = parseDateInput(a.from, 'from')!;
      const to = parseDateInput(a.to, 'to')!;
      if (from > to) throw new ToolInputError('Algus on hilisem kui lõpp');
      const end = dayAfter(to);
      if ((end.getTime() - from.getTime()) / 86_400_000 > MAX_DAYS) throw new ToolInputError(`Vahemik võib olla kuni ${MAX_DAYS} päeva`);
      const vehicleId = await resolveVehicleId(a.vehicle);
      const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { name: true, regNumber: true } });
      const entries = await prisma.workEntry.findMany({
        where: { vehicleId, date: { gte: from, lt: end } },
        orderBy: { date: 'asc' },
        include: {
          implement: { select: { name: true } },
          fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } }
        }
      });
      const result: Record<string, unknown> = {
        vehicle: vehicle.name, regNumber: vehicle.regNumber, from: fmtDate(from), to: fmtDate(to),
        entries: entries.map((e) => ({
          date: fmtDate(e.date), field: fieldLabel(e.fieldWork.fieldSeason.field), work: workTypeDisplayName(e.fieldWork.workType),
          implement: e.implement?.name ?? null, areaHa: round2(e.areaHa), equipmentHours: round2(e.equipmentHours), fuelLiters: round2(e.fuelLiters)
        }))
      };
      if (!hasTelemetry(ctx)) return result;

      // Seadmed, mis olid vahemikus selle masina küljes (seoste register), ja nende GPS-paketid seose piires
      const fromDay = from.toISOString().slice(0, 10);
      const toDay = to.toISOString().slice(0, 10);
      const winFrom = tallinnMidnightUtc(fromDay);
      const winEnd = tallinnMidnightUtc(end.toISOString().slice(0, 10));
      const links = await prisma.deviceAssignment.findMany({
        where: { vehicleId, startedAt: { lt: winEnd }, OR: [{ endedAt: null }, { endedAt: { gt: winFrom } }] },
        select: { startedAt: true, endedAt: true, device: { select: { imei: true } } }
      });
      const packets: DevicePacket[] = [];
      for (const l of links) {
        if (!l.device.imei) continue;
        const s = l.startedAt > winFrom ? l.startedAt : winFrom;
        const t = l.endedAt && l.endedAt < winEnd ? l.endedAt : winEnd;
        packets.push(...(await fetchDevicePackets(l.device.imei, s, t)));
      }
      packets.sort((p, q) => p.time.getTime() - q.time.getTime());
      const byDay = new Map<string, DevicePacket[]>();
      for (const p of packets) {
        const day = dayFmt.format(p.time);
        const arr = byDay.get(day);
        if (arr) arr.push(p);
        else byDay.set(day, [p]);
      }
      const placesByYear = new Map<number, Awaited<ReturnType<typeof loadPlaces>>>();
      const days = [];
      for (const { day, hours } of ignitionHoursByDay(packets)) {
        if (day < fromDay || day > toDay) continue;
        const pts = (byDay.get(day) ?? []).filter((p) => p.ignition !== false);
        const y = Number(day.slice(0, 4));
        if (!placesByYear.has(y)) placesByYear.set(y, await loadPlaces(y));
        const visits = pts.length ? buildRoute(pts, placesByYear.get(y)!, DEFAULT_ROUTE_OPTIONS).visits.filter((v) => v.place.kind === 'FIELD') : [];
        days.push({
          date: fmtDate(new Date(`${day}T12:00:00Z`)), engineHours: hours,
          fields: visits.map((v) => ({ field: v.place.label, arrive: fmtDateTime(new Date(v.arrive)), leave: fmtDateTime(new Date(v.leave)) }))
        });
      }
      result.telemetry = { devices: links.filter((l) => l.device.imei).length, totalEngineHours: round2(days.reduce((s, d) => s + d.engineHours, 0)), days };
      return result;
    }
  }),
  defineTool({
    name: 'list_trip_gaps',
    title: 'Sõitude vahed (jälgimata töö märgid)',
    description: `Kahe järjestikuse sõidu vahelised hoiatused (kuni ${GAP_MAX_DAYS} päeva): toide kadus (seade lahti ühendatud), seade vaikis, paagitase langes, asukoht hüppas, masina CAN mootoritunnid kasvasid. Need on kaudsed märgid, et masin võis töötada ilma telemeetriata — mitte tõend. Vaikimisi ainult kontrollimata; kontrollitul on kasutaja selgitus.`,
    input: {
      vehicle: z.string().optional().describe('Masina nimi või reg nr (tühi = kõik)'),
      from: z.string().describe('Alates (pp.kk.aaaa)'),
      to: z.string().describe('Kuni, kaasa arvatud (pp.kk.aaaa)'),
      unreviewedOnly: z.boolean().optional().describe('Ainult kontrollimata (vaikimisi true)')
    },
    when: hasTelemetry,
    run: async (a) => {
      const from = parseDateInput(a.from, 'from')!;
      const to = parseDateInput(a.to, 'to')!;
      if (from > to) throw new ToolInputError('Algus on hilisem kui lõpp');
      const end = dayAfter(to);
      if ((end.getTime() - from.getTime()) / 86_400_000 > GAP_MAX_DAYS) throw new ToolInputError(`Vahemik võib olla kuni ${GAP_MAX_DAYS} päeva`);
      const unreviewedOnly = a.unreviewedOnly ?? true;
      const vehicleId = a.vehicle ? await resolveVehicleId(a.vehicle) : null;
      const rows = await prisma.vehicleTripGap.findMany({
        where: { endedAt: { gte: from, lt: end }, ...(unreviewedOnly ? { reviewedAt: null } : {}), nextTrip: { deletedAt: null } },
        orderBy: { startedAt: 'asc' }
      });
      const resolve = await loadAssignmentResolver(rows.map((g) => g.deviceId));
      const all = rows
        .map((g) => ({ g, target: resolve(g.deviceId, g.endedAt) }))
        .filter((x) => !vehicleId || x.target.vehicleId === vehicleId);
      return {
        from: fmtDate(from), to: fmtDate(to), unreviewedOnly, total: all.length, shown: Math.min(all.length, GAP_LIMIT),
        note: `Kaudsed märgid, mitte tõend. Hoiatus on märk, mis ületab piiri: toide kadus ≥ ${GAP_LIMITS.powerLostMinutes} min, seade vaikis ≥ ${GAP_LIMITS.silentMinutes} min, kütus langes ≥ ${GAP_LIMITS.fuelDropPct} protsendipunkti, asukoht ≥ ${GAP_LIMITS.jumpM} m, mootoritunnid ≥ ${GAP_LIMITS.engineHoursGrowth} h; väiksemad väärtused on taustaks. silentMinutes = pikim paus, mil seade midagi ei saatnud; engineHoursGrowth on täistundides (+1 h võib olla ümardus).`,
        gaps: all.slice(0, GAP_LIMIT).map(({ g, target }) => ({
          vehicle: target.vehicleName, from: fmtDateTime(g.startedAt), to: fmtDateTime(g.endedAt),
          hours: round2((g.endedAt.getTime() - g.startedAt.getTime()) / 3_600_000),
          signs: {
            powerLostMinutes: g.powerLostMinutes, silentMinutes: g.silentMinutes, fuelDropPct: g.fuelDropPct,
            jumpM: g.jumpM, engineHoursGrowth: g.engineHoursGrowth
          },
          reviewed: !!g.reviewedAt, reviewedAt: fmtDateTime(g.reviewedAt), reviewedBy: g.reviewedBy, reviewNote: g.reviewNote
        }))
      };
    }
  }),
  defineTool({
    name: 'list_trips',
    title: 'Sõitude register',
    description: `Telemeetriast tuletatud sõidud (kuni ${GAP_MAX_DAYS} päeva): algus, lõpp, masin, teekond km, liikumis- ja tühikäiguaeg, kiirused, kütus, mootoritunnid, kaetud pindala ha ja põllul käigud (põld, saabumine, lahkumine, põllul oldud aeg, pindala, kütus).`,
    input: {
      vehicle: z.string().optional().describe('Masina nimi või reg nr (tühi = kõik)'),
      from: z.string().describe('Alates (pp.kk.aaaa)'),
      to: z.string().describe('Kuni, kaasa arvatud (pp.kk.aaaa)'),
      limit: z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)')
    },
    when: hasTelemetry,
    run: async (a) => {
      const from = parseDateInput(a.from, 'from')!;
      const to = parseDateInput(a.to, 'to')!;
      if (from > to) throw new ToolInputError('Algus on hilisem kui lõpp');
      const end = dayAfter(to);
      if ((end.getTime() - from.getTime()) / 86_400_000 > GAP_MAX_DAYS) throw new ToolInputError(`Vahemik võib olla kuni ${GAP_MAX_DAYS} päeva`);
      const vehicleId = a.vehicle ? await resolveVehicleId(a.vehicle) : null;
      const rows = await prisma.vehicleTrip.findMany({
        where: { deletedAt: null, startedAt: { gte: from, lt: end } },
        orderBy: { startedAt: 'desc' },
        include: {
          fields: {
            orderBy: { arriveAt: 'asc' },
            include: { fieldSeason: { select: { num: true, field: { select: { num: true, name: true } } } } }
          },
          _count: { select: { workEntries: true } }
        }
      });
      const resolve = await loadAssignmentResolver(rows.map((t) => t.deviceId));
      const matched = rows
        .map((t) => ({ t, target: resolve(t.deviceId, t.startedAt) }))
        .filter((x) => !vehicleId || x.target.vehicleId === vehicleId);
      const out = limitRows(matched, a.limit);
      return {
        from: fmtDate(from), to: fmtDate(to), total: out.total, shown: out.shown,
        rows: out.rows.map(({ t, target }) => ({
          id: t.id, vehicle: target.vehicleName, startedAt: fmtDateTime(t.startedAt), endedAt: fmtDateTime(t.endedAt), status: t.status,
          distanceKm: round2(t.distanceKm), movingMinutes: round2(t.movingMinutes), idleMinutes: round2(t.idleMinutes),
          pauseCount: t.pauseCount, pauseMinutes: round2(t.pauseMinutes),
          maxSpeedKmh: round2(t.maxSpeedKmh), avgSpeedKmh: round2(t.avgSpeedKmh),
          fuelLiters: round2(t.fuelLiters), fuelLevelStartPct: round2(t.fuelLevelStartPct), fuelLevelEndPct: round2(t.fuelLevelEndPct),
          engineHoursStart: round2(t.engineHoursStart), engineHoursEnd: round2(t.engineHoursEnd),
          areaHa: round2(t.areaHa), workEntries: t._count.workEntries, notes: t.notes,
          fields: t.fields.map((f) => ({
            field: fieldLabel({ num: f.fieldSeason.num ?? f.fieldSeason.field.num, name: f.fieldSeason.field.name }),
            arriveAt: fmtDateTime(f.arriveAt), leaveAt: fmtDateTime(f.leaveAt),
            activeMinutes: round2(f.activeMinutes), areaHa: round2(f.areaHa),
            fuelFieldL: round2(f.fuelFieldL), fuelSharedL: round2(f.fuelSharedL)
          }))
        }))
      };
    }
  }),
  defineTool({
    name: 'list_telemetry_devices',
    title: 'Telemeetriaseadmed',
    description: 'Ettevõtte telemeetriaseadmed (IMEI/MAC, mudel, staatus, püsivara) ja nende praegune ning ajalooline seos masina või haakeriistaga.',
    input: {},
    when: hasTelemetry,
    run: async () => {
      const devices = await prisma.telemetryDevice.findMany({
        orderBy: { model: 'asc' },
        include: {
          assignments: {
            orderBy: { startedAt: 'desc' },
            include: { vehicle: { select: { name: true } }, implement: { select: { name: true } } }
          }
        }
      });
      return {
        total: devices.length,
        rows: devices.map((d) => ({
          connectivityType: d.connectivityType, imei: d.imei, macAddress: d.macAddress,
          model: d.model, simNumber: d.simNumber, firmware: d.firmware,
          acquired: fmtDate(d.acquisitionDate), status: d.status, reportsWhenParked: d.reportsWhenParked, notes: d.notes,
          assignments: d.assignments.map((a) => ({
            vehicle: a.vehicle?.name ?? null, implement: a.implement?.name ?? null,
            startedAt: fmtDateTime(a.startedAt), endedAt: fmtDateTime(a.endedAt), notes: a.notes
          }))
        }))
      };
    }
  })
];
