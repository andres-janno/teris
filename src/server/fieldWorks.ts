// src/server/fieldWorks.ts — põllutööde register: tööd, materjalid, mallid, hooaja tööd, kanded, finantsid.
// PRIA põlluraamatust (field_operations) täiesti lahus.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction, tsdb, canDelete, DELETE_FORBIDDEN_MESSAGE } from './db.ts';
import { fetchFieldGpsPackets, type FieldGpsRow } from './telemetryAccess.ts';
import type { Prisma } from '@prisma/client';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import { licenseOf } from './licenseGate.ts';
import * as turf from '@turf/turf';
import {
  buildEntryLines,
  canConfirm,
  isUndeterminedCrop,
  isWinterCrop,
  matchCrop,
  mergeLines,
  summarizeLines,
  type FinanceStatus,
  type StoredLine
} from './fieldWorkRules.ts';

const PHASES = ['PREPARATION', 'SOWING', 'CARE', 'HARVEST'] as const;
const REPEAT_MODES = ['ONCE', 'UP_TO', 'INTERVAL'] as const;
const MATERIAL_CATEGORIES = ['SEED', 'FERTILIZER', 'PLANT_PROTECTION', 'OTHER'] as const;
const MAX_BODY_BYTES = 256 * 1024;

const text = (v: unknown, max = 500): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null =>
  list.includes(String(v) as T) ? (String(v) as T) : null;
const dateOnly = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().split('T')[0] : null);
const decimalToNumber = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

// Finantse näevad finantsjuht ja admin.
// Kustutada saab ainult kirje looja või admin. Tagastab true, kui keelduv vastus on saadetud.
const deleteDenied = (req: IncomingMessage, res: ServerResponse, createdBy: string | null): boolean => {
  if (canDelete(sessionUserOf(req), createdBy)) return false;
  json(res, { error: DELETE_FORBIDDEN_MESSAGE }, 403);
  return true;
};

// Massilisel eemaldamisel peavad kõik eemaldatavad tööd olema kasutaja enda loodud (admin võib kõiki)
const bulkDeleteDenied = async (req: IncomingMessage, res: ServerResponse, where: Prisma.FieldWorkWhereInput): Promise<boolean> => {
  const user = sessionUserOf(req);
  if (user?.isAdmin) return false;
  const others = await prisma.fieldWork.count({
    where: { AND: [where, { OR: [{ createdBy: null }, { createdBy: { not: user?.username ?? '' } }] }] }
  });
  if (others === 0) return false;
  json(res, { error: `${DELETE_FORBIDDEN_MESSAGE} Eemaldatavate seas on ${others} teise kasutaja loodud tööd.` }, 403);
  return true;
};

const canSeeFinance = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};
const FINANCE_FORBIDDEN = 'Finantsandmed on nähtavad ainult finantsjuhile ja adminile';

// ---------------------------------------------------------------------------
// Mall → hooaja põllu tööd (üldmall või kultuuri erimall)
// ---------------------------------------------------------------------------

// Rakendab malli jooksva koristusaasta kultuurile (fieldSeasonId).
// - Talivili: lisatakse AINULT CARE ja HARVEST (ettevalmistus ja külv tehti eelmisel sügisel).
// - Suvivili: lisatakse PREPARATION, SOWING, CARE, HARVEST.
export async function applyCropTemplate(fieldSeasonId: number): Promise<void> {
  const fs = await prisma.fieldSeason.findUnique({
    where: { id: fieldSeasonId },
    select: { id: true, fieldId: true, year: true, crop: true, season: { select: { isLocked: true } } }
  });
  if (!fs || fs.season?.isLocked) return;
  if (isUndeterminedCrop(fs.crop)) return;

  const crops = await prisma.crop.findMany({ select: { id: true, name: true, isWinterCrop: true } });
  const crop = matchCrop(fs.crop, crops);
  const isWinter = isWinterCrop(fs.crop, crops);

  const template =
    (crop
      ? await prisma.workTemplate.findFirst({ where: { cropId: crop.id }, include: { items: { include: { workType: true } } } })
      : null) ||
    (await prisma.workTemplate.findFirst({ where: { cropId: null, isWinter }, include: { items: { include: { workType: true } } } }));

  if (!template || !template.items.length) return;

  // Kanneteta tööd eemaldatakse enne uuesti lisamist:
  // Taliviljal eemaldatakse ainult CARE ja HARVEST, et mitte puutuda sügisel tehtud ettevalmistust/külvi
  if (isWinter) {
    await prisma.fieldWork.deleteMany({
      where: { fieldSeasonId, fromTemplate: true, phase: { in: ['CARE', 'HARVEST'] }, entries: { none: {} } }
    });
  } else {
    // Kui suviviljal oli sügisene ettevalmistus tehtud (nt sügiskünd), hoiame selle alles
    const hasAutumnPrep = await prisma.fieldWork.count({
      where: { fieldSeasonId, phase: 'PREPARATION', plannedText: { contains: 'ügis' } }
    });
    if (hasAutumnPrep > 0) {
      await prisma.fieldWork.deleteMany({
        where: { fieldSeasonId, fromTemplate: true, phase: { in: ['SOWING', 'CARE', 'HARVEST'] }, entries: { none: {} } }
      });
    } else {
      await prisma.fieldWork.deleteMany({
        where: { fieldSeasonId, fromTemplate: true, entries: { none: {} } }
      });
    }
  }

  const existing = new Set(
    (await prisma.fieldWork.findMany({ where: { fieldSeasonId }, select: { workTypeId: true } })).map((w) => w.workTypeId)
  );

  const items = [...template.items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of items) {
    const wt = item.workType;
    if (!wt || !wt.isActive || existing.has(wt.id)) continue;

    // Taliviljal käesoleval koristusaastal kevadist ettevalmistust ja külvi ei tehta!
    if (isWinter && (wt.phase === 'PREPARATION' || wt.phase === 'SOWING')) continue;

    await prisma.fieldWork.create({
      data: {
        fieldSeasonId,
        workTypeId: wt.id,
        phase: wt.phase,
        sortOrder: item.sortOrder,
        plannedText: item.typicalTiming,
        plannedCount: (item.plannedCount ?? (wt.repeatMode === 'UP_TO' ? wt.maxRepeats : 1)) ?? 1,
        fromTemplate: true
      }
    });
    existing.add(wt.id);
  }
}

// Sügistööde lisamine järgmise aasta hooajale (nextFieldSeasonId):
// - Taliviljal: lisatakse kogu talivilja elutsükkel: ettevalmistus ja külv sügisesse (näha sügistöödes),
//   hooldus ja koristus saagiaastasse (näha järgmise aasta hooldus- ja koristusveergudes).
// - Suviviljal: lisatakse sügisesse AINULT PREPARATION (sügisene ettevalmistus; külv, hooldus ja koristus on järgmise aasta töödes).
export async function applyAutumnTemplate(nextFieldSeasonId: number): Promise<void> {
  const nextFs = await prisma.fieldSeason.findUnique({
    where: { id: nextFieldSeasonId },
    select: { id: true, fieldId: true, year: true, crop: true, season: { select: { isLocked: true } } }
  });
  if (!nextFs || nextFs.season?.isLocked) return;
  if (isUndeterminedCrop(nextFs.crop)) return;

  const crops = await prisma.crop.findMany({ select: { id: true, name: true, isWinterCrop: true } });
  const crop = matchCrop(nextFs.crop, crops);
  const isWinter = isWinterCrop(nextFs.crop, crops);

  const template =
    (crop
      ? await prisma.workTemplate.findFirst({ where: { cropId: crop.id }, include: { items: { include: { workType: true } } } })
      : null) ||
    (await prisma.workTemplate.findFirst({ where: { cropId: null, isWinter }, include: { items: { include: { workType: true } } } }));

  if (!template || !template.items.length) return;

  // Eemaldatakse kanneteta tööd enne malli rakendamist:
  // Taliviljal kogu tsükkel, suviviljal ainult sügisene PREPARATION
  if (isWinter) {
    await prisma.fieldWork.deleteMany({
      where: {
        fieldSeasonId: nextFieldSeasonId,
        fromTemplate: true,
        entries: { none: {} }
      }
    });
  } else {
    await prisma.fieldWork.deleteMany({
      where: {
        fieldSeasonId: nextFieldSeasonId,
        fromTemplate: true,
        phase: 'PREPARATION',
        entries: { none: {} }
      }
    });
  }

  const existing = new Set(
    (await prisma.fieldWork.findMany({ where: { fieldSeasonId: nextFieldSeasonId }, select: { workTypeId: true } })).map((w) => w.workTypeId)
  );

  const items = [...template.items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of items) {
    const wt = item.workType;
    if (!wt || !wt.isActive || existing.has(wt.id)) continue;

    // Suviviljal lisatakse sügisesse AINULT PREPARATION tööd (külv, hooldus ja koristus on järgmise aasta töödes)
    if (!isWinter && wt.phase !== 'PREPARATION') continue;

    const isAutumnPhase = wt.phase === 'PREPARATION' || wt.phase === 'SOWING';
    await prisma.fieldWork.create({
      data: {
        fieldSeasonId: nextFieldSeasonId,
        workTypeId: wt.id,
        phase: wt.phase,
        sortOrder: item.sortOrder,
        plannedText: isAutumnPhase ? (item.typicalTiming ?? `Sügis ${nextFs.year - 1}`) : item.typicalTiming,
        plannedCount: (item.plannedCount ?? (wt.repeatMode === 'UP_TO' ? wt.maxRepeats : 1)) ?? 1,
        fromTemplate: true
      }
    });
    existing.add(wt.id);
  }
}

// ---------------------------------------------------------------------------
// Kanded
// ---------------------------------------------------------------------------

async function resolveEntryInput(body: any) {
  const workerId = text(body?.workerId, 64);
  const vehicleId = text(body?.vehicleId, 64);
  const implementId = text(body?.implementId, 64);
  const [worker, vehicle, implement] = await Promise.all([
    workerId ? prisma.relatedParty.findUnique({ where: { id: workerId }, select: { id: true, name: true } }) : null,
    vehicleId ? prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, name: true } }) : null,
    implementId ? prisma.implement.findUnique({ where: { id: implementId }, select: { id: true, name: true } }) : null
  ]);
  const materialsIn: { materialId?: unknown; quantity?: unknown }[] = Array.isArray(body?.materials) ? body.materials : [];
  const materialIds = materialsIn.map((m) => String(m.materialId ?? '')).filter(Boolean);
  const materialRows = materialIds.length
    ? await prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, name: true, unit: true } })
    : [];
  const byId = new Map(materialRows.map((m) => [m.id, m]));
  const materials = materialsIn
    .map((m) => {
      const row = byId.get(String(m.materialId ?? ''));
      const quantity = num(m.quantity);
      return row && quantity !== null ? { ...row, quantity } : null;
    })
    .filter((m): m is { id: string; name: string; unit: string; quantity: number } => m !== null);

  const equipmentHours = num(body?.equipmentHours);
  const fuelLiters = num(body?.fuelLiters);
  const laborHours = num(body?.laborHours);
  const startTime = text(body?.startTime, 10);
  const endTime = text(body?.endTime, 10);
  const harvestTonnes = num(body?.harvestTonnes);
  const drafts = buildEntryLines({
    laborHours,
    workerName: worker ? `Tööaeg · ${worker.name}` : null,
    vehicle,
    implement,
    equipmentHours,
    fuelLiters,
    materials,
    harvestTonnes
  });
  return {
    data: {
      date: dateOnly(body?.date),
      workerId: worker?.id ?? null,
      areaHa: num(body?.areaHa),
      telemetryAreaHa: num(body?.telemetryAreaHa),
      occurrenceNo: int(body?.occurrenceNo),
      vehicleId: vehicle?.id ?? null,
      implementId: implement?.id ?? null,
      equipmentHours,
      fuelLiters,
      laborHours,
      startTime,
      endTime,
      notes: text(body?.notes, 2000)
    },
    drafts
  };
}

// Töö olek kannete järgi (lõpetatud töö jääb lõpetatuks, kuni see avatakse).
// Lõpetamise kuupäev võetakse kande kuupäevast (mitte serveri süsteemi kellast).
// Kui 100% pindalast on tehtud, märgitakse töö automaatselt lõpetatuks.
async function syncFieldWorkStatus(fieldWorkId: string, finish: boolean, userId: string | null) {
  const work = await prisma.fieldWork.findUnique({
    where: { id: fieldWorkId },
    select: {
      status: true,
      fieldSeason: { select: { areaHa: true } },
      workType: { select: { repeatMode: true } },
      _count: { select: { entries: true } }
    }
  });
  if (!work) return;

  const agg = await prisma.workEntry.aggregate({
    where: { fieldWorkId },
    _sum: { areaHa: true }
  });
  const totalDoneArea = agg._sum.areaHa ?? 0;
  const fieldArea = work.fieldSeason?.areaHa ?? 0;
  const repeatMode = work.workType?.repeatMode;
  const is100Percent = repeatMode === 'ONCE' && fieldArea > 0 && totalDoneArea >= (fieldArea - 0.01);

  if (finish || is100Percent) {
    const latestEntry = await prisma.workEntry.findFirst({
      where: { fieldWorkId },
      orderBy: { date: 'desc' },
      select: { date: true }
    });
    await prisma.fieldWork.update({
      where: { id: fieldWorkId },
      data: {
        status: 'DONE',
        finishedAt: latestEntry?.date ?? new Date(),
        finishedById: userId
      }
    });
  } else {
    // Kui pindala on alla 100% ja finish pole märgitud, on töö pooleli (või planeeritud kui kandeid pole)
    const n = await prisma.workEntry.count({ where: { fieldWorkId } });
    await prisma.fieldWork.update({
      where: { id: fieldWorkId },
      data: {
        status: n > 0 ? 'IN_PROGRESS' : 'PLANNED',
        finishedAt: null,
        finishedById: null
      }
    });
  }
}

const ENTRY_INCLUDE = {
  worker: { select: { name: true } },
  vehicle: { select: { name: true } },
  implement: { select: { name: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } }
};

function entryDto(e: any, withFinance: boolean) {
  const lines = (e.lines ?? []) as any[];
  return {
    id: e.id,
    fieldWorkId: e.fieldWorkId,
    date: isoDate(e.date),
    workerId: e.workerId,
    workerName: e.worker?.name ?? null,
    areaHa: e.areaHa,
    telemetryAreaHa: e.telemetryAreaHa ?? null,
    occurrenceNo: e.occurrenceNo,
    vehicleId: e.vehicleId,
    vehicleName: e.vehicle?.name ?? null,
    implementId: e.implementId,
    implementName: e.implement?.name ?? null,
    equipmentHours: e.equipmentHours,
    fuelLiters: e.fuelLiters,
    laborHours: e.laborHours,
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    materials: lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ materialId: l.materialId, name: l.label, unit: l.unit, quantity: l.quantity })),
    harvestTonnes: lines.find((l) => l.kind === 'HARVEST')?.quantity ?? null,
    notes: e.notes,
    financeStatus: e.financeStatus,
    ...(withFinance
      ? {
          financeNotes: e.financeNotes,
          financeConfirmedAt: e.financeConfirmedAt?.toISOString() ?? null,
          lines: lines.map((l) => ({
            id: l.id,
            kind: l.kind,
            label: l.label,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: decimalToNumber(l.unitPrice),
            confirmedQuantity: l.confirmedQuantity
          }))
        }
      : {})
  };
}

const toStored = (l: any): StoredLine => ({
  kind: l.kind,
  vehicleId: l.vehicleId,
  implementId: l.implementId,
  materialId: l.materialId,
  label: l.label,
  quantity: l.quantity,
  unit: l.unit,
  sortOrder: l.sortOrder,
  unitPrice: decimalToNumber(l.unitPrice),
  confirmedQuantity: l.confirmedQuantity
});

export interface TelemetrySuggestion {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  workerId: string | null;
  workerName: string | null;
  startTime: string;
  endTime: string;
  durationHours: number;
  workedAreaHa: number | null;
  pointCount: number;
}

export async function getTelemetrySuggestionsForField(
  fieldSeasonId: number,
  dateStr: string,
  excludeEntryId?: string | null
): Promise<TelemetrySuggestion[]> {
  if (!tsdb) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];

  const fs = await prisma.fieldSeason.findUnique({
    where: { id: fieldSeasonId },
    select: { geometry: true }
  });
  if (!fs?.geometry) return [];

  const poly = fs.geometry as any;
  let bbox: [number, number, number, number];
  try {
    bbox = turf.bbox(poly) as [number, number, number, number];
  } catch {
    return [];
  }
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // UTC aken, mis katab tervet Europe/Tallinn kalendripäeva (20:00 eelmise päeva õhtust kuni 02:00 järgmise päeva öösel)
  const prevDay = new Date(dateStr + 'T00:00:00Z');
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const startUtc = new Date(Date.UTC(prevDay.getUTCFullYear(), prevDay.getUTCMonth(), prevDay.getUTCDate(), 20, 0, 0));
  const nextDay = new Date(dateStr + 'T00:00:00Z');
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endUtc = new Date(Date.UTC(nextDay.getUTCFullYear(), nextDay.getUTCMonth(), nextDay.getUTCDate(), 2, 0, 0));

  let rows: FieldGpsRow[] = [];
  try {
    rows = await fetchFieldGpsPackets(startUtc, endUtc);
  } catch (err) {
    console.error('telemetry suggestions query failed:', err);
    return [];
  }

  const tallinnDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });
  const pointsByDevice: Record<string, { time: Date; lat: number; lng: number }[]> = {};

  for (const r of rows) {
    if (tallinnDateFmt.format(r.time) !== dateStr) continue;
    const lat = r.fields?.latitude;
    const lng = r.fields?.longitude;
    if (lat == null || lng == null) continue;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      if (turf.booleanPointInPolygon(turf.point([lng, lat]), poly)) {
        if (!pointsByDevice[r.device]) pointsByDevice[r.device] = [];
        pointsByDevice[r.device].push({ time: r.time, lat, lng });
      }
    }
  }

  const GAP_MS = 20 * 60 * 1000; // 20 minutit vahet tähistab eraldi sessiooni
  const rawSessions: {
    device: string;
    startTime: Date;
    endTime: Date;
    points: { lat: number; lng: number }[];
    pointCount: number;
  }[] = [];

  for (const [device, pts] of Object.entries(pointsByDevice)) {
    if (pts.length < 3) continue;
    let curStart = pts[0].time;
    let curEnd = pts[0].time;
    let curPoints: { lat: number; lng: number }[] = [{ lat: pts[0].lat, lng: pts[0].lng }];

    for (let i = 1; i < pts.length; i++) {
      const diff = pts[i].time.getTime() - pts[i - 1].time.getTime();
      if (diff > GAP_MS) {
        if (curPoints.length >= 3 && (curEnd.getTime() - curStart.getTime()) >= 2 * 60 * 1000) {
          rawSessions.push({ device, startTime: curStart, endTime: curEnd, points: curPoints, pointCount: curPoints.length });
        }
        curStart = pts[i].time;
        curEnd = pts[i].time;
        curPoints = [{ lat: pts[i].lat, lng: pts[i].lng }];
      } else {
        curEnd = pts[i].time;
        curPoints.push({ lat: pts[i].lat, lng: pts[i].lng });
      }
    }
    if (curPoints.length >= 3 && (curEnd.getTime() - curStart.getTime()) >= 2 * 60 * 1000) {
      rawSessions.push({ device, startTime: curStart, endTime: curEnd, points: curPoints, pointCount: curPoints.length });
    }
  }

  if (rawSessions.length === 0) return [];

  // Kontrolli olemasolevaid kandeid sellel kuupäeval
  const existingEntries = await prisma.workEntry.findMany({
    where: {
      date: {
        gte: new Date(dateStr + 'T00:00:00.000Z'),
        lte: new Date(dateStr + 'T23:59:59.999Z')
      },
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {})
    },
    select: {
      id: true,
      vehicleId: true,
      startTime: true,
      endTime: true
    }
  });

  const parseMins = (t?: string | null): number | null => {
    if (!t) return null;
    const parts = t.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  const timeFmt = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const suggestions: TelemetrySuggestion[] = [];

  for (const s of rawSessions) {
    const asgn = await prisma.deviceAssignment.findFirst({
      where: {
        device: { imei: s.device },
        startedAt: { lte: s.endTime },
        OR: [{ endedAt: null }, { endedAt: { gte: s.startTime } }]
      },
      orderBy: { startedAt: 'desc' },
      include: {
        vehicle: { include: { assignedDriver: true } },
        implement: true
      }
    });

    // Seade ↔ masin/haakeriist tuleb ainult seadmete seoste registrist
    const vehicle = asgn?.vehicle ?? null;
    let implement = asgn?.implement ?? null;
    const worker = vehicle?.assignedDriver ?? null;

    // Kui telemeetria enda andmetest ei tule välja, milline haakeriist oli masina küljes,
    // siis leiame selle haakeriista masina ja haakeriista seose tabelist (ImplementAssignment),
    // mis kattub sama kuupäeva ja kellaajaga, mis telemeetrias tuli.
    if (!implement && vehicle) {
      const impAsgn = await prisma.implementAssignment.findFirst({
        where: {
          vehicleId: vehicle.id,
          startedAt: { lte: s.endTime },
          OR: [{ endedAt: null }, { endedAt: { gte: s.startTime } }]
        },
        orderBy: { startedAt: 'desc' },
        include: {
          implement: true
        }
      });
      if (impAsgn?.implement) {
        implement = impAsgn.implement;
      }
    }

    const startTimeStr = timeFmt.format(s.startTime);
    const endTimeStr = timeFmt.format(s.endTime);
    const sessionStartMins = parseMins(startTimeStr) ?? 0;
    const sessionEndMins = parseMins(endTimeStr) ?? 0;
    const durationHours = Math.round(((s.endTime.getTime() - s.startTime.getTime()) / (1000 * 60 * 60)) * 100) / 100;

    // Arvuta telemeetriast (GPS) tehtud pindala põllu piirides.
    // Hektari arvutuseks kasutame leitud haakeriista laiust.
    // Kui haakeriista ei leita, siis jätame hektarid 0-ks.
    let workedAreaHa: number = 0;
    const widthM = implement?.workingWidthM ?? null;

    if (widthM && widthM > 0 && s.points.length >= 2) {
      try {
        const line = turf.lineString(s.points.map((p) => [p.lng, p.lat]));
        const buffered = turf.buffer(line, (widthM / 2) / 1000, { units: 'kilometers', steps: 4 });
        if (buffered) {
          const fieldFeature = turf.feature(poly);
          const intersected = turf.intersect(turf.featureCollection([fieldFeature, buffered]));
          if (intersected) {
            workedAreaHa = Math.round((turf.area(intersected) / 10000) * 100) / 100;
          }
        }
      } catch (err) {
        console.warn('Could not calculate telemetry worked area:', err);
      }
    }

    let isBound = false;
    if (vehicle) {
      for (const entry of existingEntries) {
        if (entry.vehicleId === vehicle.id) {
          const eStartMins = parseMins(entry.startTime);
          const eEndMins = parseMins(entry.endTime);
          if (eStartMins !== null && eEndMins !== null) {
            if (Math.max(eStartMins, sessionStartMins) < Math.min(eEndMins, sessionEndMins)) {
              isBound = true;
              break;
            }
          } else {
            isBound = true;
            break;
          }
        }
      }
    }

    if (!isBound) {
      suggestions.push({
        id: `${s.device}_${startTimeStr.replace(':', '')}_${endTimeStr.replace(':', '')}`,
        vehicleId: vehicle?.id ?? null,
        vehicleName: vehicle?.name ?? null,
        implementId: implement?.id ?? null,
        implementName: implement?.name ?? null,
        workerId: worker?.id ?? null,
        workerName: worker?.name ?? null,
        startTime: startTimeStr,
        endTime: endTimeStr,
        durationHours,
        workedAreaHa,
        pointCount: s.pointCount
      });
    }
  }

  suggestions.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return suggestions;
}

// ---------------------------------------------------------------------------
// Päringute käsitleja
// ---------------------------------------------------------------------------

export async function handleFieldWorks(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  const idOf = (prefix: string) => decodeURIComponent(pathname.slice(prefix.length));
  const user = sessionUserOf(req);
  const userId = user?.id ?? null;

  // --- Tööde register ---
  if (pathname === '/api/work-types' && method === 'GET') {
    const rows = await prisma.workType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { templateItems: true, fieldWorks: true } } }
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...w }) => ({ ...w, templateCount: _count.templateItems, fieldWorkCount: _count.fieldWorks })));
    return true;
  }
  if (pathname === '/api/work-types' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const name = text(b?.name, 120);
    const phase = oneOf(b?.phase, PHASES);
    const repeatMode = oneOf(b?.repeatMode, REPEAT_MODES) ?? 'ONCE';
    if (!name || !phase) {
      json(res, { error: 'Töö nimi ja faas on kohustuslikud' }, 400);
      return true;
    }
    const data = {
      name,
      phase,
      repeatMode,
      maxRepeats: repeatMode === 'UP_TO' ? int(b?.maxRepeats) : null,
      intervalDays: repeatMode === 'INTERVAL' ? int(b?.intervalDays) : null,
      usesMaterials: b?.usesMaterials === true,
      sortOrder: int(b?.sortOrder) ?? 0,
      isActive: b?.isActive !== false
    };
    try {
      const id = text(b?.id, 64);
      const saved = id ? await prisma.workType.update({ where: { id }, data }) : await prisma.workType.create({ data });
      json(res, saved);
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'Sellise nimega töö on juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/work-types/') && method === 'DELETE') {
    const id = idOf('/api/work-types/');
    const w = await prisma.workType.findUnique({ where: { id }, include: { _count: { select: { templateItems: true, fieldWorks: true } } } });
    if (!w) {
      json(res, { error: 'Tööd ei leitud' }, 404);
      return true;
    }
    if (deleteDenied(req, res, w.createdBy)) return true;
    if (w._count.templateItems || w._count.fieldWorks) {
      json(res, { error: `Töö on kasutusel ${w._count.templateItems} mallis ja ${w._count.fieldWorks} põllul. Eemalda need seosed või märgi töö mitteaktiivseks.` }, 409);
      return true;
    }
    await prisma.workType.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Kulumaterjalid ---
  if (pathname === '/api/materials' && method === 'GET') {
    const rows = await prisma.material.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { entryLines: true } } }
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...m }) => ({ ...m, usageCount: _count.entryLines })));
    return true;
  }
  if (pathname === '/api/materials' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const name = text(b?.name, 160);
    const category = oneOf(b?.category, MATERIAL_CATEGORIES);
    const unit = text(b?.unit, 16);
    if (!name || !category || !unit) {
      json(res, { error: 'Materjali nimi, liik ja ühik on kohustuslikud' }, 400);
      return true;
    }
    const data = { name, category, unit, cropVarietyId: text(b?.cropVarietyId, 64), isActive: b?.isActive !== false, notes: text(b?.notes, 1000) };
    try {
      const id = text(b?.id, 64);
      const saved = id ? await prisma.material.update({ where: { id }, data }) : await prisma.material.create({ data });
      json(res, saved);
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'Selline materjal on juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/materials/') && method === 'DELETE') {
    const id = idOf('/api/materials/');
    const material = await prisma.material.findUnique({ where: { id }, select: { createdBy: true } });
    if (material && deleteDenied(req, res, material.createdBy)) return true;
    const used = await prisma.workEntryLine.count({ where: { materialId: id } });
    if (used) {
      json(res, { error: `Materjal on kasutusel ${used} kandes. Märgi see mitteaktiivseks.` }, 409);
      return true;
    }
    await prisma.material.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Mallid (üldmallid + kultuuride erimallid) ---
  if (pathname === '/api/work-templates' && method === 'GET') {
    const templates = await prisma.workTemplate.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });

    const result = templates.map((t) => ({
      id: t.id,
      cropId: t.cropId,
      isWinter: t.isWinter,
      name: t.cropId === null ? (t.isWinter ? 'Talivilja üldmall' : 'Suvivilja üldmall') : undefined,
      items: t.items.map((i) => ({
        id: i.id,
        workTypeId: i.workTypeId,
        sortOrder: i.sortOrder,
        typicalTiming: i.typicalTiming,
        plannedCount: i.plannedCount
      }))
    }));

    json(res, result);
    return true;
  }
  if (pathname === '/api/work-templates' && method === 'PUT') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const cropId = text(b?.cropId, 64);
    const isWinter = b?.isWinter === true;
    const items: any[] = Array.isArray(b?.items) ? b.items : [];

    const saved = await tenantTransaction(async (tx) => {
      const template =
        (await tx.workTemplate.findFirst({ where: { cropId, isWinter } })) ?? (await tx.workTemplate.create({ data: { cropId, isWinter } }));
      await tx.workTemplateItem.deleteMany({ where: { templateId: template.id } });
      const seen = new Set<string>();
      for (const [i, it] of items.entries()) {
        const workTypeId = text(it?.workTypeId, 64);
        if (!workTypeId || seen.has(workTypeId)) continue;
        seen.add(workTypeId);
        await tx.workTemplateItem.create({
          data: { templateId: template.id, workTypeId, sortOrder: i, typicalTiming: text(it?.typicalTiming, 80), plannedCount: int(it?.plannedCount) }
        });
      }
      return template;
    });
    json(res, { success: true, id: saved.id });
    return true;
  }
  if (pathname.startsWith('/api/work-templates/') && method === 'DELETE') {
    const id = idOf('/api/work-templates/');
    const t = await prisma.workTemplate.findUnique({ where: { id } });
    if (!t) {
      json(res, { error: 'Malli ei leitud' }, 404);
      return true;
    }
    if (deleteDenied(req, res, t.createdBy)) return true;
    if (t.cropId === null) {
      json(res, { error: 'Üldmalli ei saa kustutada' }, 409);
      return true;
    }
    await prisma.workTemplate.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Hooaja põllu tööd ---
  if (pathname === '/api/field-works' && method === 'GET') {
    const year = int(url.searchParams.get('year'));
    if (year === null) {
      json(res, { error: 'Hooaeg (year) on kohustuslik' }, 400);
      return true;
    }
    const finance = canSeeFinance(req);
    const crops = await prisma.crop.findMany({ select: { id: true, name: true, isWinterCrop: true } });
    const currentSeasons = await prisma.fieldSeason.findMany({
      where: { year },
      select: {
        id: true,
        fieldId: true,
        crop: true,
        cropColor: true,
        cropVariety: true,
        fieldWorks: { select: { id: true } }
      }
    });

    for (const fs of currentSeasons) {
      // Kui kultuur on määramata, aga eelmisel aastal oli talivili: päri kultuur eelmisest aastast
      if (isUndeterminedCrop(fs.crop)) {
        const prevSeason = await prisma.fieldSeason.findUnique({
          where: { fieldId_year: { fieldId: fs.fieldId, year: year - 1 } },
          select: { crop: true, cropColor: true, cropVariety: true }
        });
        if (prevSeason && isWinterCrop(prevSeason.crop, crops)) {
          // Aegunud litsentsiga ei kirjutata — vastuses näidatakse päritud kultuuri siiski
          if (!licenseOf(req)?.readOnly) {
            await prisma.fieldSeason.update({
              where: { id: fs.id },
              data: {
                crop: prevSeason.crop,
                cropColor: prevSeason.cropColor,
                cropVariety: prevSeason.cropVariety
              }
            });
          }
          fs.crop = prevSeason.crop;
        }
      }
    }

    const rows = await prisma.fieldWork.findMany({
      where: { fieldSeason: { year } },
      orderBy: [{ fieldSeasonId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        workType: true,
        fieldSeason: { select: { id: true, fieldId: true, crop: true, year: true } },
        entries: { orderBy: { date: 'desc' }, include: ENTRY_INCLUDE }
      }
    });

    // Järgmise aasta taliviljade ja suviviljade sügistööd (teostatakse selle aasta sügisel)
    const nextYearSeasons = await prisma.fieldSeason.findMany({
      where: { year: year + 1 },
      select: {
        id: true,
        fieldId: true,
        crop: true,
        year: true,
        fieldWorks: { select: { id: true } }
      }
    });

    const nextAutumnSeasonIds: number[] = [];
    for (const ns of nextYearSeasons) {
      if (!isUndeterminedCrop(ns.crop)) {
        nextAutumnSeasonIds.push(ns.id);
      }
    }

    const nextAutumnRows = nextAutumnSeasonIds.length > 0 ? await prisma.fieldWork.findMany({
      where: {
        fieldSeasonId: { in: nextAutumnSeasonIds }
      },
      orderBy: [{ fieldSeasonId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        workType: true,
        fieldSeason: { select: { id: true, fieldId: true, crop: true, year: true } },
        entries: { orderBy: { date: 'desc' }, include: ENTRY_INCLUDE }
      }
    }) : [];

    const worksDto: any[] = rows.map((w) => {
      const isWinter = isWinterCrop(w.fieldSeason.crop, crops);
      const isAutumnPhase = isWinter && (w.phase === 'PREPARATION' || w.phase === 'SOWING');
      return {
        id: w.id,
        fieldSeasonId: w.fieldSeasonId,
        workTypeId: w.workTypeId,
        workTypeName: w.workType.name,
        phase: w.phase,
        repeatMode: w.workType.repeatMode,
        intervalDays: w.workType.intervalDays,
        usesMaterials: w.workType.usesMaterials,
        sortOrder: w.sortOrder,
        plannedText: w.plannedText,
        plannedCount: w.plannedCount,
        status: w.status,
        finishedAt: isoDate(w.finishedAt),
        fromTemplate: w.fromTemplate,
        notes: w.notes,
        entries: w.entries.map((e) => entryDto(e, finance)),
        carriedOverFromYear: isAutumnPhase ? year - 1 : null,
        carriedOverToYear: null,
        seasonYear: year,
        isNextSeasonWinterSowing: false
      };
    });

    for (const w of nextAutumnRows) {
      const isWinter = isWinterCrop(w.fieldSeason.crop, crops);
      // Suviviljal kuulub sügisesse ainult ettevalmistus (külv, hooldus ja koristus on järgmisel aastal)
      if (!isWinter && w.phase !== 'PREPARATION') continue;
      const isAutumnPhase = w.phase === 'PREPARATION' || w.phase === 'SOWING';
      worksDto.push({
        id: w.id,
        fieldSeasonId: w.fieldSeasonId,
        workTypeId: w.workTypeId,
        workTypeName: w.workType.name,
        phase: w.phase,
        repeatMode: w.workType.repeatMode,
        intervalDays: w.workType.intervalDays,
        usesMaterials: w.workType.usesMaterials,
        sortOrder: w.sortOrder,
        plannedText: isAutumnPhase ? (w.plannedText ?? `Sügis ${year}`) : w.plannedText,
        plannedCount: w.plannedCount,
        status: w.status,
        finishedAt: isoDate(w.finishedAt),
        fromTemplate: w.fromTemplate,
        notes: w.notes,
        entries: w.entries.map((e) => entryDto(e, finance)),
        carriedOverFromYear: null,
        carriedOverToYear: year + 1,
        seasonYear: year + 1,
        isNextSeasonWinterSowing: isWinter && isAutumnPhase
      });
    }

    json(res, worksDto);
    return true;
  }
  if (pathname === '/api/field-works' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const fieldSeasonId = int(b?.fieldSeasonId);
    const workTypeId = text(b?.workTypeId, 64);
    const workType = workTypeId ? await prisma.workType.findUnique({ where: { id: workTypeId } }) : null;
    if (fieldSeasonId === null || !workType) {
      json(res, { error: 'Põld ja töö on kohustuslikud' }, 400);
      return true;
    }
    const preferredSortOrder = int(b?.sortOrder);
    const last = await prisma.fieldWork.findFirst({ where: { fieldSeasonId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    try {
      const saved = await prisma.fieldWork.create({
        data: {
          fieldSeasonId,
          workTypeId: workType.id,
          phase: workType.phase,
          sortOrder: preferredSortOrder !== null ? preferredSortOrder : (last?.sortOrder ?? -1) + 1,
          plannedText: text(b?.plannedText, 80),
          plannedCount: Math.max(1, int(b?.plannedCount) ?? workType.maxRepeats ?? 1)
        }
      });
      json(res, saved);
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'See töö on põllul juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname === '/api/field-works/apply-template' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const ids: number[] = (Array.isArray(b?.fieldSeasonIds) ? b.fieldSeasonIds : [b?.fieldSeasonId]).map(int).filter((n: number | null): n is number => n !== null);
    const mode = b?.mode === 'AUTUMN' ? 'AUTUMN' : 'CURRENT';
    for (const id of ids) {
      if (mode === 'AUTUMN') {
        await applyAutumnTemplate(id);
      } else {
        await applyCropTemplate(id);
      }
    }
    json(res, { success: true, count: ids.length, mode });
    return true;
  }
  if (pathname === '/api/field-works/clear' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const fieldSeasonId = int(b?.fieldSeasonId);
    if (!fieldSeasonId) {
      json(res, { error: 'Põlluhooaja ID on kohustuslik' }, 400);
      return true;
    }
    const fs = await prisma.fieldSeason.findUnique({
      where: { id: fieldSeasonId },
      select: { season: { select: { isLocked: true } } }
    });
    if (fs?.season?.isLocked) {
      json(res, { error: 'Lukus hooaja töid ei saa muuta' }, 403);
      return true;
    }
    const mode = b?.mode === 'AUTUMN' ? 'AUTUMN' : 'ALL';
    if (mode === 'AUTUMN') {
      const entriesCount = await prisma.workEntry.count({
        where: { fieldWork: { fieldSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } } }
      });
      if (entriesCount > 0) {
        json(res, { error: `Põllu sügistöödel on ${entriesCount} kannet. Töid ei saa eemaldada enne kannete kustutamist.` }, 409);
        return true;
      }
      if (await bulkDeleteDenied(req, res, { fieldSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } })) return true;
      const { count } = await prisma.fieldWork.deleteMany({
        where: { fieldSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } }
      });
      json(res, { success: true, count, mode });
      return true;
    }

    const entriesCount = await prisma.workEntry.count({
      where: { fieldWork: { fieldSeasonId } }
    });
    if (entriesCount > 0) {
      json(res, { error: `Põllu töödel on ${entriesCount} kannet. Töid ei saa eemaldada enne kannete kustutamist.` }, 409);
      return true;
    }
    if (await bulkDeleteDenied(req, res, { fieldSeasonId })) return true;
    let totalCount = 0;
    const { count } = await prisma.fieldWork.deleteMany({
      where: { fieldSeasonId }
    });
    totalCount += count;

    const nextSeasonId = int(b?.nextSeasonId);
    if (nextSeasonId) {
      const nextFs = await prisma.fieldSeason.findUnique({
        where: { id: nextSeasonId },
        select: { season: { select: { isLocked: true } } }
      });
      if (!nextFs?.season?.isLocked) {
        const nextEntries = await prisma.workEntry.count({
          where: { fieldWork: { fieldSeasonId: nextSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } } }
        });
        if (nextEntries === 0) {
          // Järgmise hooaja sügistöödest eemaldatakse mitte-adminil ainult enda loodud
          const user = sessionUserOf(req);
          const resNext = await prisma.fieldWork.deleteMany({
            where: {
              fieldSeasonId: nextSeasonId,
              phase: { in: ['PREPARATION', 'SOWING'] },
              ...(user?.isAdmin ? {} : { createdBy: user?.username ?? '' })
            }
          });
          totalCount += resNext.count;
        }
      }
    }

    json(res, { success: true, count: totalCount });
    return true;
  }
  if (pathname.startsWith('/api/field-works/') && method === 'PATCH') {
    const id = idOf('/api/field-works/');
    const b = await parseBody(req, MAX_BODY_BYTES);
    const data: Record<string, unknown> = {};
    if ('plannedText' in b) data.plannedText = text(b.plannedText, 80);
    if ('plannedCount' in b) data.plannedCount = Math.max(1, int(b.plannedCount) ?? 1);
    if ('notes' in b) data.notes = text(b.notes, 2000);
    if (b?.status === 'DONE') {
      const latestEntry = await prisma.workEntry.findFirst({
        where: { fieldWorkId: id },
        orderBy: { date: 'desc' },
        select: { date: true }
      });
      Object.assign(data, { status: 'DONE', finishedAt: latestEntry?.date ?? new Date(), finishedById: userId });
    }
    await prisma.fieldWork.update({ where: { id }, data });
    // Lõpetatud töö avamine: olek kannete järgi.
    if (b?.status === 'REOPEN') {
      const n = await prisma.workEntry.count({ where: { fieldWorkId: id } });
      await prisma.fieldWork.update({ where: { id }, data: { status: n > 0 ? 'IN_PROGRESS' : 'PLANNED', finishedAt: null, finishedById: null } });
    }
    json(res, { success: true, id });
    return true;
  }
  if (pathname.startsWith('/api/field-works/') && method === 'DELETE') {
    const id = idOf('/api/field-works/');
    const fw = await prisma.fieldWork.findUnique({ where: { id }, select: { createdBy: true } });
    if (fw && deleteDenied(req, res, fw.createdBy)) return true;
    const n = await prisma.workEntry.count({ where: { fieldWorkId: id } });
    if (n > 0) {
      json(res, { error: `Tööl on ${n} kannet. Kustuta enne kanded.` }, 409);
      return true;
    }
    await prisma.fieldWork.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Telemeetria soovitused kande lisamisel/muutmisel ---
  if (pathname === '/api/field-works/telemetry-suggestions' && method === 'GET') {
    const fieldSeasonId = int(url.searchParams.get('fieldSeasonId'));
    const fieldWorkId = text(url.searchParams.get('fieldWorkId'), 64);
    const dateStr = text(url.searchParams.get('date'), 10);
    const excludeEntryId = text(url.searchParams.get('excludeEntryId'), 64);

    let resolvedFieldSeasonId = fieldSeasonId;
    if (!resolvedFieldSeasonId && fieldWorkId) {
      const fw = await prisma.fieldWork.findUnique({
        where: { id: fieldWorkId },
        select: { fieldSeasonId: true }
      });
      resolvedFieldSeasonId = fw?.fieldSeasonId ?? null;
    }

    if (!resolvedFieldSeasonId || !dateStr) {
      json(res, []);
      return true;
    }

    const suggestions = await getTelemetrySuggestionsForField(resolvedFieldSeasonId, dateStr, excludeEntryId);
    json(res, suggestions);
    return true;
  }

  // --- Kanded (töötaja: ainult kogused) ---
  if (pathname === '/api/work-entries' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const fieldWorkId = text(b?.fieldWorkId, 64);
    const work = fieldWorkId ? await prisma.fieldWork.findUnique({ where: { id: fieldWorkId } }) : null;
    const { data, drafts } = await resolveEntryInput(b);
    if (!work || !data.date) {
      json(res, { error: 'Töö ja kuupäev on kohustuslikud' }, 400);
      return true;
    }
    const saved = await prisma.workEntry.create({
      data: { ...data, date: data.date, fieldWorkId: work.id, createdById: userId, lines: { create: drafts } },
      include: ENTRY_INCLUDE
    });
    await syncFieldWorkStatus(work.id, b?.finish === true, userId);
    json(res, entryDto(saved, canSeeFinance(req)));
    return true;
  }
  if (pathname.startsWith('/api/work-entries/') && method === 'PUT') {
    const id = idOf('/api/work-entries/');
    const b = await parseBody(req, MAX_BODY_BYTES);
    const old = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true } });
    const { data, drafts } = await resolveEntryInput(b);
    if (!old || !data.date) {
      json(res, { error: 'Kannet ei leitud või kuupäev puudub' }, 400);
      return true;
    }
    const merged = mergeLines(old.lines.map(toStored), drafts, old.financeStatus as FinanceStatus);
    const saved = await tenantTransaction(async (tx) => {
      await tx.workEntryLine.deleteMany({ where: { entryId: id } });
      return tx.workEntry.update({
        where: { id },
        data: {
          ...data,
          date: data.date!,
          financeStatus: merged.financeStatus,
          lines: { create: merged.lines.map((l) => ({ ...l, unitPrice: l.unitPrice })) }
        },
        include: ENTRY_INCLUDE
      });
    });
    await syncFieldWorkStatus(old.fieldWorkId, b?.finish === true, userId);
    json(res, entryDto(saved, canSeeFinance(req)));
    return true;
  }
  if (pathname.startsWith('/api/work-entries/') && method === 'DELETE') {
    const id = idOf('/api/work-entries/');
    const e = await prisma.workEntry.findUnique({ where: { id } });
    if (!e) {
      json(res, { error: 'Kannet ei leitud' }, 404);
      return true;
    }
    if (deleteDenied(req, res, e.createdBy)) return true;
    if (e.financeStatus !== 'PENDING' && !canSeeFinance(req)) {
      json(res, { error: 'Kinnitatud kannet saab kustutada ainult finantsjuht' }, 403);
      return true;
    }
    await prisma.workEntry.delete({ where: { id } });
    await syncFieldWorkStatus(e.fieldWorkId, false, userId);
    json(res, { success: true, id });
    return true;
  }

  // --- Finantsid (finantsjuht ja admin) ---
  if (pathname.startsWith('/api/finance/')) {
    if (!canSeeFinance(req)) {
      json(res, { error: FINANCE_FORBIDDEN }, 403);
      return true;
    }
    if (pathname === '/api/finance/entries' && method === 'GET') {
      const year = int(url.searchParams.get('year'));
      const status = oneOf(url.searchParams.get('status'), ['PENDING', 'CONFIRMED', 'CHANGED'] as const);

      let fieldWorkWhere: any = undefined;
      if (year !== null) {
        // Järgmise aasta hooajad, mille sügistööd (ettevalmistus ja külv) tehakse käesoleval aastal
        const nextYearSeasons = await prisma.fieldSeason.findMany({
          where: { year: year + 1 },
          select: { id: true, crop: true }
        });
        const nextAutumnSeasonIds: number[] = [];
        for (const ns of nextYearSeasons) {
          if (!isUndeterminedCrop(ns.crop)) {
            nextAutumnSeasonIds.push(ns.id);
          }
        }

        fieldWorkWhere = {
          OR: [
            { fieldSeason: { year } },
            ...(nextAutumnSeasonIds.length > 0
              ? [
                  {
                    fieldSeasonId: { in: nextAutumnSeasonIds },
                    phase: { in: ['PREPARATION', 'SOWING'] }
                  }
                ]
              : [])
          ]
        };
      }

      const rows = await prisma.workEntry.findMany({
        where: {
          ...(fieldWorkWhere ? { fieldWork: fieldWorkWhere } : {}),
          ...(status ? { financeStatus: status } : {})
        },
        orderBy: { date: 'desc' },
        include: {
          ...ENTRY_INCLUDE,
          fieldWork: {
            select: {
              workType: { select: { name: true } },
              fieldSeason: { select: { id: true, year: true, crop: true, areaHa: true, field: { select: { num: true, name: true } } } }
            }
          }
        }
      });
      json(res, rows.map((e) => ({
        ...entryDto(e, true),
        workTypeName: e.fieldWork.workType.name,
        fieldSeasonId: e.fieldWork.fieldSeason.id,
        year: e.fieldWork.fieldSeason.year,
        crop: e.fieldWork.fieldSeason.crop,
        fieldAreaHa: e.fieldWork.fieldSeason.areaHa,
        fieldNum: e.fieldWork.fieldSeason.field.num,
        fieldName: e.fieldWork.fieldSeason.field.name
      })));
      return true;
    }
    if (pathname.startsWith('/api/finance/entries/') && method === 'PATCH') {
      const id = idOf('/api/finance/entries/');
      const b = await parseBody(req, MAX_BODY_BYTES);
      const entry = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true } });
      if (!entry) {
        json(res, { error: 'Kannet ei leitud' }, 404);
        return true;
      }
      const prices: Record<string, unknown> = b?.prices && typeof b.prices === 'object' ? b.prices : {};
      const lines = entry.lines.map((l) => ({
        ...l,
        unitPrice: l.id in prices ? num(prices[l.id]) : decimalToNumber(l.unitPrice)
      }));
      if (b?.confirm === true && !canConfirm(lines)) {
        json(res, { error: 'Igal real peab olema ühiku kulu' }, 400);
        return true;
      }
      await tenantTransaction(async (tx) => {
        for (const l of lines) {
          await tx.workEntryLine.update({
            where: { id: l.id },
            data: { unitPrice: l.unitPrice, ...(b?.confirm === true ? { confirmedQuantity: l.quantity } : {}) }
          });
        }
        await tx.workEntry.update({
          where: { id },
          data: {
            financeNotes: 'financeNotes' in b ? text(b.financeNotes, 2000) : entry.financeNotes,
            ...(b?.confirm === true ? { financeStatus: 'CONFIRMED', financeConfirmedAt: new Date(), financeConfirmedById: userId } : {})
          }
        });
      });
      json(res, { success: true, id });
      return true;
    }
    if (pathname === '/api/finance/field-results' && method === 'GET') {
      const year = int(url.searchParams.get('year'));
      if (year === null) {
        json(res, { error: 'Hooaeg (year) on kohustuslik' }, 400);
        return true;
      }
      const crops = await prisma.crop.findMany({ select: { name: true, isWinterCrop: true } });
      const seasons = await prisma.fieldSeason.findMany({
        where: { year },
        select: {
          id: true,
          fieldId: true,
          crop: true,
          cropColor: true,
          areaHa: true,
          field: { select: { id: true, num: true, name: true } },
          fieldWorks: { select: { phase: true, entries: { select: { financeStatus: true, lines: { select: { kind: true, quantity: true, unitPrice: true } } } } } }
        }
      });
      const results = [];
      for (const s of seasons) {
        let entries = s.fieldWorks.flatMap((w) => w.entries);
        const isWinter = isWinterCrop(s.crop, crops);
        // Kui tegemist on taliviljaga, kaasame saagiaasta tulemusse ka eelmise sügise ettevalmistuse ja külvi kanded!
        if (isWinter) {
          const prevSeason = await prisma.fieldSeason.findUnique({
            where: { fieldId_year: { fieldId: s.fieldId, year: year - 1 } },
            select: {
              fieldWorks: {
                where: { phase: { in: ['PREPARATION', 'SOWING'] } },
                select: { entries: { select: { financeStatus: true, lines: { select: { kind: true, quantity: true, unitPrice: true } } } } }
              }
            }
          });
          if (prevSeason) {
            const prevEntries = prevSeason.fieldWorks.flatMap((w) => w.entries);
            entries = [...prevEntries, ...entries];
          }
        }
        const confirmed = entries.filter((e) => e.financeStatus === 'CONFIRMED');
        const resObj = summarizeLines(confirmed.flatMap((e) => e.lines.map((l) => ({ kind: l.kind, quantity: l.quantity, unitPrice: decimalToNumber(l.unitPrice) }))));
        results.push({
          fieldSeasonId: s.id,
          fieldId: s.field.id,
          fieldNum: s.field.num,
          fieldName: s.field.name,
          crop: s.crop,
          cropColor: s.cropColor,
          areaHa: s.areaHa,
          entriesTotal: entries.length,
          entriesConfirmed: confirmed.length,
          ...resObj
        });
      }
      json(res, results.filter((r) => r.entriesTotal > 0));
      return true;
    }
    json(res, { error: 'Tundmatu finantspäring' }, 404);
    return true;
  }

  return false;
}
