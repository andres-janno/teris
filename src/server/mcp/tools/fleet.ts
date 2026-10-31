// src/server/mcp/tools/fleet.ts — masinad ja haakeriistad; masina tegevus (kanded + telemeetria süüte järgi).
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { fetchDevicePackets, type DevicePacket } from '../../telemetryAccess.ts';
import { buildRoute, DEFAULT_ROUTE_OPTIONS } from '../../tripRoute.ts';
import { loadPlaces } from '../../tripPlaces.ts';
import { defineTool, canSeeFinance, hasTelemetry } from '../context.ts';
import { parseDateInput, dayAfter, fieldLabel, fmtDate, fmtDateTime, round2, ToolInputError } from '../format.ts';
import { resolveVehicleId } from './works.ts';
import { ignitionHoursByDay, tallinnMidnightUtc } from '../ignitionHours.ts';

const MAX_DAYS = 31;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });

const financeOut = (r: { acquisitionCost: number | null; acquisitionDate: Date | null; depreciationRate: number | null; depreciationMethod: string | null }) => ({
  acquisitionCost: r.acquisitionCost, acquired: fmtDate(r.acquisitionDate), depreciationRatePct: r.depreciationRate, depreciationMethod: r.depreciationMethod
});

export const fleetTools = [
  defineTool({
    name: 'list_vehicles',
    title: 'Masinad ja haakeriistad',
    description: 'Masinad (liik, mudel, reg nr, laius, juht, praegu haagitud haakeriist, viimane aktiivsus) ja haakeriistad. Telemeetria mooduliga ka viimane asukoht; finantsõigusega soetusmaksumus ja amortisatsioon.',
    input: {},
    run: async (_a, ctx) => {
      const finance = canSeeFinance(ctx);
      const telemetry = hasTelemetry(ctx);
      const now = new Date();
      const [vehicles, implementRows, hitches] = await Promise.all([
        prisma.vehicle.findMany({ orderBy: { name: 'asc' }, include: { assignedDriver: { select: { name: true } } } }),
        prisma.implement.findMany({ orderBy: { name: 'asc' } }),
        prisma.implementAssignment.findMany({
          where: { startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gt: now } }] },
          orderBy: { startedAt: 'desc' }, select: { vehicleId: true, implement: { select: { name: true } } }
        })
      ]);
      const hitchOf = new Map<string, string>();
      for (const h of hitches) if (!hitchOf.has(h.vehicleId)) hitchOf.set(h.vehicleId, h.implement.name);
      return {
        vehicles: vehicles.map((v) => ({
          name: v.name, type: v.type, category: v.category, manufacturer: v.manufacturer, model: v.model, regNumber: v.regNumber,
          powerKw: v.powerKw, workingWidthM: v.workingWidthM, driver: v.assignedDriver?.name ?? null, implement: hitchOf.get(v.id) ?? null,
          ...(telemetry ? { lastActive: fmtDateTime(v.lastActiveAt) } : {}),
          ...(telemetry && v.lastLatitude != null && v.lastLongitude != null ? { lastPosition: { lat: v.lastLatitude, lng: v.lastLongitude } } : {}),
          ...(finance ? financeOut(v) : {})
        })),
        implements: implementRows.map((i) => ({
          name: i.name, type: i.type, category: i.category, manufacturer: i.manufacturer, model: i.model, year: i.year, workingWidthM: i.workingWidthM,
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
  })
];
