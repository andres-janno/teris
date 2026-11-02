// src/server/fieldWorks.ts — põllutööde register: tööd, materjalid, hooaja tööd, kanded, finantsid.
// Põllutööd on PRIA e-põlluraamatu allikas: töö = plaan, kanne = tegelik; PRIA import loob/seob töid.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction, tsdb, canDelete, DELETE_FORBIDDEN_MESSAGE } from './db.ts';
import { fetchFieldGpsPackets, fetchDevicePackets, type FieldGpsRow, type DevicePacket } from './telemetryAccess.ts';
import { coverageAreaHa, type CoveragePoint } from './coverageArea.ts';
import { segmentTrip, buildRoute, DEFAULT_ROUTE_OPTIONS, type Place, type TripRoute } from './tripRoute.ts';
import { loadPlaces } from './tripPlaces.ts';
import type { Prisma } from '@prisma/client';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import * as turf from '@turf/turf';
import {
  buildEntryLines,
  confirmBlockReason,
  isUndeterminedCrop,
  isWinterCrop,
  mergeLines,
  summarizeLines,
  type FinanceStatus,
  type StoredLine
} from './fieldWorkRules.ts';
import { articleSeasonTotals } from './articleUsage.ts';
import { getDefaultWarehouseId, inventoryNotice, entryStockTouches, recomputeArticleStock, articleStockSummary, resolveEntryWarehouseId, StockValidationError } from './stock.ts';
import { articleStockFields } from './stockRules.ts';
import { convertQty } from '../services/units.ts';
import { applyEntryHarvest, assertEntryLotOpen, HarvestLotError } from './harvestLots.ts';
import { syncFieldWorkStatus } from './fieldWorkStatus.ts';
import { changeArticleUnit, lotUnitBlocked, LOT_UNIT_ERROR } from './articleUnitChange.ts';
import { articleFieldRules, sanitizeArticleFields, SERVICE_TIME_KINDS } from '../services/articleRules.ts';
import { articleLineError, loadEntryArticles, ensureDefaultServices } from './entryArticles.ts';
import { type PriaAttrs, nameKey } from '../services/pria.ts';
import { workTypeDisplayName } from '../services/workTypeName.ts';
import { boardWorkDate, isExactAutumnText } from '../services/fieldWorksBoardColumns.ts';

const PHASES = ['PREPARATION', 'SOWING', 'CARE', 'HARVEST'] as const;
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
const priaAttrsIn = (p: any): PriaAttrs => ({
  priaRegister: text(p?.priaRegister, 120), priaKind: text(p?.priaKind, 120), priaSpec: text(p?.priaSpec, 120),
  activeIngredient: text(p?.activeIngredient, 200), nKgHa: num(p?.nKgHa), pKgHa: num(p?.pKgHa), kKgHa: num(p?.kKgHa)
});

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
  const articlesIn: { articleId?: unknown; quantity?: unknown; ratePerHa?: unknown; pria?: any }[] = Array.isArray(body?.articles) ? body.articles : [];
  const articleIds = articlesIn.map((m) => String(m.articleId ?? '')).filter(Boolean);
  const articleRows = articleIds.length
    ? await prisma.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, name: true, unit: true } })
    : [];
  const byId = new Map(articleRows.map((m) => [m.id, m]));
  const articleError = await articleLineError(articleRows.map((m) => ({ kind: 'MATERIAL' as const, articleId: m.id })));
  const articles = articlesIn
    .map((m) => {
      const row = byId.get(String(m.articleId ?? ''));
      const quantity = num(m.quantity);
      return row && quantity !== null
        ? { ...row, quantity, ratePerHa: num(m.ratePerHa), pria: priaAttrsIn(m.pria) }
        : null;
    })
    .filter((m): m is { id: string; name: string; unit: string; quantity: number; ratePerHa: number | null; pria: PriaAttrs } => m !== null);

  const equipmentHours = num(body?.equipmentHours);
  const fuelLiters = num(body?.fuelLiters);
  const laborHours = num(body?.laborHours);
  const startTime = text(body?.startTime, 10);
  const endTime = text(body?.endTime, 10);
  const harvestTonnes = num(body?.harvestTonnes);
  const h = body?.harvest;
  const harvestBunkers = num(body?.harvestBunkers);
  const harvest = h || harvestBunkers !== null
    ? { tonnes: num(h?.tonnes), ratePerHa: num(h?.ratePerHa), priaKind: text(h?.priaKind, 80), priaSpec: text(h?.priaSpec, 80), withBunkers: harvestBunkers !== null }
    : null;
  const observations = (Array.isArray(body?.observations) ? body.observations : [])
    .map((o: any) => ({ label: text(o?.label, 200) ?? '', quantity: num(o?.quantity) ?? 0, unit: text(o?.unit, 40) ?? '', priaRegister: text(o?.priaRegister, 80) }))
    .filter((o: { label: string }) => o.label);
  // Tööaja ridade teenused ja pakutud hinnad, kande kütuseartikkel
  const entryArticles = await tenantTransaction((tx) => loadEntryArticles(tx, { workerId: worker?.id ?? null, vehicleId: vehicle?.id ?? null, implementId: implement?.id ?? null }));
  const drafts = buildEntryLines({
    ...entryArticles,
    laborHours,
    workerName: worker ? `Tööaeg · ${worker.name}` : null,
    vehicle,
    implement,
    equipmentHours,
    fuelLiters,
    articles,
    harvestTonnes,
    harvest,
    observations
  });
  return {
    data: {
      date: dateOnly(body?.date),
      dateTo: dateOnly(body?.dateTo),
      method: text(body?.method, 80),
      harvestBunkers,
      workerId: worker?.id ?? null,
      areaHa: num(body?.areaHa),
      telemetryAreaHa: num(body?.telemetryAreaHa),
      vehicleId: vehicle?.id ?? null,
      implementId: implement?.id ?? null,
      equipmentHours,
      fuelLiters,
      laborHours,
      startTime,
      endTime,
      notes: text(body?.notes, 2000)
    },
    drafts,
    articleError,
    harvestLotId: text(body?.harvestLotId, 64),
    // Puuduv väärtus pole „false“: vorm ei saada seda; lahendatakse POST/PUT-is
    harvestTonnesManualIn: typeof body?.harvestTonnesManual === 'boolean' ? (body.harvestTonnesManual as boolean) : null,
    // Ladu lahendatakse tehingus (resolveEntryWarehouseId): valimata → põhiladu, mitteaktiivne ainult senisena
    warehouseId: text(body?.warehouseId, 64)
  };
}

const ENTRY_INCLUDE = {
  worker: { select: { name: true } },
  vehicle: { select: { name: true } },
  implement: { select: { name: true } },
  harvestLot: { select: { name: true, status: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } }
};

// Laoarvestusega kanderead: kulumaterjal ja kütus
const articleIdsOf = (lines: { kind?: string; articleId: string | null }[]) =>
  lines.filter((l) => ['MATERIAL', 'FUEL'].includes(l.kind ?? 'MATERIAL') && l.articleId).map((l) => l.articleId as string);

function entryDto(e: any, withFinance: boolean) {
  const lines = (e.lines ?? []) as any[];
  return {
    id: e.id,
    fieldWorkId: e.fieldWorkId,
    date: isoDate(e.date),
    dateTo: isoDate(e.dateTo),
    method: e.method ?? null,
    source: e.source,
    workerId: e.workerId,
    workerName: e.worker?.name ?? null,
    areaHa: e.areaHa,
    telemetryAreaHa: e.telemetryAreaHa ?? null,
    occurrenceNo: e.occurrenceNo,
    vehicleId: e.vehicleId,
    vehicleName: e.vehicle?.name ?? null,
    implementId: e.implementId,
    implementName: e.implement?.name ?? null,
    warehouseId: e.warehouseId ?? null,
    equipmentHours: e.equipmentHours,
    fuelLiters: e.fuelLiters,
    laborHours: e.laborHours,
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    articles: lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({
      articleId: l.articleId, name: l.label, unit: l.unit, quantity: l.quantity, ratePerHa: l.ratePerHa,
      priaRegister: l.priaRegister, priaKind: l.priaKind, priaSpec: l.priaSpec, activeIngredient: l.activeIngredient,
      nKgHa: l.nKgHa, pKgHa: l.pKgHa, kKgHa: l.kKgHa
    })),
    // Koguseta saagirida (ainult saagi/kultuuri tüüp) → kogus puudub
    harvestTonnes: lines.find((l) => l.kind === 'HARVEST')?.quantity || null,
    harvestBunkers: e.harvestBunkers ?? null,
    harvestLotId: e.harvestLotId ?? null,
    harvestLotName: e.harvestLot?.name ?? null,
    harvestLotStatus: e.harvestLot?.status ?? null,
    harvestTonnesManual: e.harvestTonnesManual ?? false,
    harvest: (() => { const l = lines.find((x) => x.kind === 'HARVEST'); return l ? { tonnes: l.quantity || null, ratePerHa: l.ratePerHa, priaKind: l.priaKind, priaSpec: l.priaSpec } : null; })(),
    observations: lines.filter((l) => l.kind === 'OBSERVATION').map((l) => ({ label: l.label, quantity: l.quantity, unit: l.unit, priaRegister: l.priaRegister })),
    notes: e.notes,
    financeStatus: e.financeStatus,
    ...(withFinance
      ? {
          financeNotes: e.financeNotes,
          financeConfirmedAt: e.financeConfirmedAt?.toISOString() ?? null,
          lines: lines.filter((l) => l.kind !== 'OBSERVATION').map((l) => ({
            id: l.id,
            kind: l.kind,
            articleId: l.articleId,
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

// Töö plaani sisend (POST ja PATCH). Read asendatakse tervikuna, kui `lines` on kehas.
async function planInput(b: any) {
  const data: Record<string, unknown> = {};
  if ('plannedText' in b) data.plannedText = text(b.plannedText, 80);
  if ('plannedDateFrom' in b) data.plannedDateFrom = dateOnly(b.plannedDateFrom);
  if ('plannedDateTo' in b) data.plannedDateTo = dateOnly(b.plannedDateTo);
  if ('plannedAreaHa' in b) data.plannedAreaHa = num(b.plannedAreaHa);
  if ('method' in b) data.method = text(b.method, 80);
  if ('plannedWorkerId' in b) data.plannedWorkerId = text(b.plannedWorkerId, 64);
  if ('notes' in b) data.notes = text(b.notes, 2000);
  const lines = Array.isArray(b?.lines)
    ? b.lines.map((l: any, i: number) => ({
        kind: l?.kind === 'HARVEST' ? 'HARVEST' : 'MATERIAL',
        articleId: text(l?.articleId, 64),
        label: text(l?.label, 200) ?? '',
        unit: text(l?.unit, 20) ?? '',
        ratePerHa: num(l?.ratePerHa),
        ...priaAttrsIn(l),
        sortOrder: i
      })).filter((l: { label: string }) => l.label)
    : null;
  const articleError = lines ? await articleLineError(lines) : null;
  return { data, lines, articleError };
}

const FIELD_WORK_INCLUDE = {
  workType: true,
  plannedWorker: { select: { name: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  entries: { orderBy: { date: 'desc' as const }, include: ENTRY_INCLUDE }
};

export function fieldWorkDto(w: any, withFinance: boolean) {
  return {
    id: w.id,
    fieldSeasonId: w.fieldSeasonId,
    workTypeId: w.workTypeId,
    workTypeName: workTypeDisplayName(w.workType),
    priaName: w.workType.name,
    priaCode: w.workType.priaCode ?? null,
    phase: w.phase,
    repeatMode: 'ONCE' as const,
    intervalDays: null,
    usesMaterials: w.workType.usesMaterials,
    sortOrder: w.sortOrder,
    plannedText: w.plannedText,
    plannedCount: 1,
    plannedDateFrom: isoDate(w.plannedDateFrom),
    plannedDateTo: isoDate(w.plannedDateTo),
    plannedAreaHa: w.plannedAreaHa ?? null,
    method: w.method ?? null,
    plannedWorkerId: w.plannedWorkerId ?? null,
    plannedWorkerName: w.plannedWorker?.name ?? null,
    source: w.source,
    lines: (w.lines ?? []).map(({ fieldWorkId: _f, tenantId: _t, sortOrder: _s, ...l }: any) => l),
    status: w.status,
    finishedAt: isoDate(w.finishedAt),
    fromTemplate: w.fromTemplate,
    notes: w.notes,
    entries: (w.entries ?? []).map((e: any) => entryDto(e, withFinance))
  };
}

const toStored = (l: any): StoredLine => ({
  kind: l.kind,
  vehicleId: l.vehicleId,
  implementId: l.implementId,
  articleId: l.articleId,
  label: l.label,
  quantity: l.quantity,
  unit: l.unit,
  sortOrder: l.sortOrder,
  ratePerHa: l.ratePerHa ?? null,
  priaRegister: l.priaRegister ?? null,
  priaKind: l.priaKind ?? null,
  priaSpec: l.priaSpec ?? null,
  activeIngredient: l.activeIngredient ?? null,
  nKgHa: l.nKgHa ?? null,
  pKgHa: l.pKgHa ?? null,
  kKgHa: l.kKgHa ?? null,
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
  startTime: string; // süüde sisse (sõidu algus); sõidu puudumisel põllule jõudmine
  endTime: string; // süüde välja (sõidu lõpp); sõidu puudumisel põllult lahkumine
  fieldStartTime: string; // põllu piiridesse jõudmine
  fieldEndTime: string; // põllu piiridest lahkumine
  durationHours: number; // põllu piirides süüde sees oldud aeg
  workedAreaHa: number | null;
  pointCount: number;
  route?: TripRoute; // sõidu teekond (algus, läbitud kohad, lõpp); puudub, kui ei õnnestunud arvutada
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
    select: { geometry: true, year: true }
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
    rows = await fetchFieldGpsPackets(startUtc, endUtc, bbox);
  } catch (err) {
    console.error('telemetry suggestions query failed:', err);
    return [];
  }

  const tallinnDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });
  const pointsByDevice: Record<string, { time: Date; lat: number; lng: number; brk: boolean }[]> = {};
  // Seade käis vahepeal põllu piiridest väljas → järgmine põllupunkt alustab uut joont (maanteesõit ei lähe pindalasse)
  const leftField: Record<string, boolean> = {};

  for (const r of rows) {
    if (tallinnDateFmt.format(r.time) !== dateStr) continue;
    const lat = r.fields?.latitude;
    const lng = r.fields?.longitude;
    if (lat == null || lng == null) continue;
    // Arvesse lähevad ainult punktid, kus süüde on sees (süüteta seadmel puudub väli → punkt jääb)
    if (r.fields?.ignition === 0) continue;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng && turf.booleanPointInPolygon(turf.point([lng, lat]), poly)) {
      if (!pointsByDevice[r.device]) pointsByDevice[r.device] = [];
      pointsByDevice[r.device].push({ time: r.time, lat, lng, brk: !!leftField[r.device] });
      leftField[r.device] = false;
    } else {
      leftField[r.device] = true;
    }
  }

  const GAP_MS = 20 * 60 * 1000; // 20 minutit vahet tähistab eraldi sessiooni
  const rawSessions: {
    device: string;
    startTime: Date;
    endTime: Date;
    points: CoveragePoint[];
    pointCount: number;
    activeMs: number; // süüte sees oldud aeg (punktide vahed kuni ACTIVE_STEP_MS)
  }[] = [];
  const ACTIVE_STEP_MS = 5 * 60 * 1000; // pikem vahe süüte sees punktide vahel = paus, ei loeta tööajaks

  for (const [device, pts] of Object.entries(pointsByDevice)) {
    if (pts.length < 3) continue;
    let curStart = pts[0].time;
    let curEnd = pts[0].time;
    let curPoints: CoveragePoint[] = [{ lat: pts[0].lat, lng: pts[0].lng }];
    let curActive = 0;

    for (let i = 1; i < pts.length; i++) {
      const diff = pts[i].time.getTime() - pts[i - 1].time.getTime();
      if (diff > GAP_MS) {
        if (curPoints.length >= 3 && (curEnd.getTime() - curStart.getTime()) >= 2 * 60 * 1000) {
          rawSessions.push({ device, startTime: curStart, endTime: curEnd, points: curPoints, pointCount: curPoints.length, activeMs: curActive });
        }
        curStart = pts[i].time;
        curEnd = pts[i].time;
        curPoints = [{ lat: pts[i].lat, lng: pts[i].lng }];
        curActive = 0;
      } else {
        curEnd = pts[i].time;
        // Joon katkeb, kui seade käis vahepeal põllult väljas või punktide vahel oli pikk paus
        curPoints.push({ lat: pts[i].lat, lng: pts[i].lng, brk: pts[i].brk || diff > ACTIVE_STEP_MS });
        if (diff <= ACTIVE_STEP_MS) curActive += diff;
      }
    }
    if (curPoints.length >= 3 && (curEnd.getTime() - curStart.getTime()) >= 2 * 60 * 1000) {
      rawSessions.push({ device, startTime: curStart, endTime: curEnd, points: curPoints, pointCount: curPoints.length, activeMs: curActive });
    }
  }

  if (rawSessions.length === 0) return [];

  // Kontrolli olemasolevaid kandeid sellel kuupäeval ja SELLEL põllul — teise põllu kanne
  // (eriti ilma kellaaegadeta) ei tohi sama masina siinseid sõite peita.
  const existingEntries = await prisma.workEntry.findMany({
    where: {
      fieldWork: { fieldSeasonId },
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
  const sessionOf = new Map<TelemetrySuggestion, { device: string; startTime: Date; endTime: Date }>();

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
    // Tööaeg = süüte sees oldud aeg põllul (pausid süütega väljas või pikad katkestused jäävad välja)
    const durationHours = Math.round((s.activeMs / (1000 * 60 * 60)) * 100) / 100;

    // Arvuta telemeetriast (GPS) tehtud pindala põllu piirides.
    // Hektari arvutuseks kasutame leitud haakeriista laiust.
    // Kui haakeriista ei leita, siis jätame hektarid 0-ks.
    let workedAreaHa: number = 0;
    const widthM = implement?.workingWidthM ?? null;

    if (widthM && widthM > 0 && s.points.length >= 2) {
      try {
        workedAreaHa = coverageAreaHa(s.points, poly, widthM);
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
      const suggestion: TelemetrySuggestion = {
        id: `${s.device}_${startTimeStr.replace(':', '')}_${endTimeStr.replace(':', '')}`,
        vehicleId: vehicle?.id ?? null,
        vehicleName: vehicle?.name ?? null,
        implementId: implement?.id ?? null,
        implementName: implement?.name ?? null,
        workerId: worker?.id ?? null,
        workerName: worker?.name ?? null,
        startTime: startTimeStr,
        endTime: endTimeStr,
        fieldStartTime: startTimeStr,
        fieldEndTime: endTimeStr,
        durationHours,
        workedAreaHa,
        pointCount: s.pointCount
      };
      suggestions.push(suggestion);
      sessionOf.set(suggestion, { device: s.device, startTime: s.startTime, endTime: s.endTime });
    }
  }

  // Sõit (süüde sisse → välja) ja selle teekond: seadme kogu päeva paketid (üks päring seadme kohta).
  // Kande algus ja lõpp tulevad süütest; kui sama sõit käis enne või pärast ka teistel põldudel,
  // jagatakse aeg põllu piiril, et töötaja aega ei loetaks kahele kandele.
  // Viga siin ei tohi soovitusi katki teha — siis jääb põllul oldud aeg ja route puudu.
  if (suggestions.length > 0) {
    let places: Place[] | null = null;
    try {
      places = await loadPlaces(fs.year);
    } catch (err) {
      console.warn('trip route places failed:', err);
    }
    const packetsByDevice = new Map<string, DevicePacket[] | null>();
    for (const sug of suggestions) {
      const sess = sessionOf.get(sug);
      if (!sess) continue;
      try {
        if (!packetsByDevice.has(sess.device)) {
          let pk: DevicePacket[] | null = null;
          try {
            pk = (await fetchDevicePackets(sess.device, startUtc, endUtc)).filter((p) => tallinnDateFmt.format(p.time) === dateStr);
          } catch (err) {
            console.warn('trip route packets failed:', err);
          }
          packetsByDevice.set(sess.device, pk);
        }
        const pk = packetsByDevice.get(sess.device);
        if (!pk || pk.length === 0) continue;
        const trip = segmentTrip(pk, sess.startTime, sess.endTime);
        if (!trip) continue;
        if (places) sug.route = buildRoute(trip.points, places, { ...DEFAULT_ROUTE_OPTIONS, preferPlaceId: String(fieldSeasonId) });
        const otherFields = (sug.route?.visits ?? []).filter((v) => v.place.kind === 'FIELD' && v.place.id !== String(fieldSeasonId));
        const fieldBefore = otherFields.some((v) => new Date(v.arrive).getTime() < sess.startTime.getTime());
        const fieldAfter = otherFields.some((v) => new Date(v.leave).getTime() > sess.endTime.getTime());
        if (!fieldBefore) sug.startTime = timeFmt.format(trip.start);
        if (!fieldAfter) sug.endTime = timeFmt.format(trip.end);
      } catch (err) {
        console.warn('trip route failed:', err);
      }
    }
  }

  suggestions.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return suggestions;
}

// ---------------------------------------------------------------------------
// Päringute käsitleja
// ---------------------------------------------------------------------------

const DONE_WORK_ERROR = 'Töö on lõpetatud. Muutmiseks ava töö uuesti.';

export async function handleFieldWorks(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  const idOf = (prefix: string) => decodeURIComponent(pathname.slice(prefix.length));
  const user = sessionUserOf(req);
  const userId = user?.id ?? null;

  // --- Tööde register ---
  if (pathname === '/api/work-types' && method === 'GET') {
    const rows = await prisma.workType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { fieldWorks: true } } }
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...w }) => ({ ...w, fieldWorkCount: _count.fieldWorks })));
    return true;
  }
  if (pathname === '/api/work-types' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const name = text(b?.name, 120);
    const phase = oneOf(b?.phase, PHASES);
    if (!name || !phase) {
      json(res, { error: 'Töö nimi ja faas on kohustuslikud' }, 400);
      return true;
    }
    const data = {
      name,
      shortName: text(b?.shortName, 60) || null,
      phase,
      // iga töö on üks kord; sama tegevust võib põllul olla mitu tööd
      repeatMode: 'ONCE' as const,
      maxRepeats: null,
      intervalDays: null,
      // priaCode jääb muutmisel samaks (kehast seda ei võeta)
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
    const w = await prisma.workType.findUnique({ where: { id }, include: { _count: { select: { fieldWorks: true } } } });
    if (!w) {
      json(res, { error: 'Tööd ei leitud' }, 404);
      return true;
    }
    if (deleteDenied(req, res, w.createdBy)) return true;
    if (w._count.fieldWorks) {
      json(res, { error: `Töö on kasutusel ${w._count.fieldWorks} põllul. Eemalda need seosed või märgi töö mitteaktiivseks.` }, 409);
      return true;
    }
    // Mallid on eemaldatud funktsioon; vanad mallirida (Restrict FK) ei tohi tööliigi kustutamist takistada
    await tenantTransaction(async (tx) => {
      await tx.workTemplateItem.deleteMany({ where: { workTypeId: id } });
      await tx.workType.delete({ where: { id } });
    });
    json(res, { success: true, id });
    return true;
  }

  // --- Kulumaterjalid ---
  if (pathname === '/api/articles' && method === 'GET') {
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const stock = await tenantTransaction(async (tx) => {
      await ensureDefaultServices(tx);
      return articleStockSummary(tx, warehouseId);
    });
    const finance = canSeeFinance(req);
    const rows = await prisma.article.findMany({
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
      include: { _count: { select: { entryLines: true } }, category: { select: { id: true, name: true, group: true, systemKind: true } } }
    });
    const year = int(url.searchParams.get('year'));
    let totals: ReturnType<typeof articleSeasonTotals> | null = null;
    if (year) {
      // Hooaja kogused: plaaniread (kõik hooaja tööd, ka tehtud) ja kanderead
      const [planRows, entryRows] = await Promise.all([
        prisma.fieldWorkLine.findMany({
          where: { kind: 'MATERIAL', articleId: { not: null }, fieldWork: { fieldSeason: { year } } },
          select: { articleId: true, ratePerHa: true, fieldWork: { select: { plannedAreaHa: true, fieldSeason: { select: { areaHa: true } } } } }
        }),
        prisma.workEntryLine.findMany({
          where: { kind: { in: ['MATERIAL', 'FUEL'] }, articleId: { not: null }, entry: { fieldWork: { fieldSeason: { year } } } },
          select: { articleId: true, quantity: true }
        })
      ]);
      totals = articleSeasonTotals(
        planRows.map((l) => ({ articleId: l.articleId, ratePerHa: l.ratePerHa, areaHa: l.fieldWork.plannedAreaHa ?? l.fieldWork.fieldSeason.areaHa })),
        entryRows
      );
    }
    json(
      res,
      rows.map(({ _count, createdAt, updatedAt, ...m }) => ({
        ...m,
        // teenuse hinda näeb ainult finantsõigusega
        price: m.price === null ? null : (finance ? Number(m.price) : null),
        // valitud hooaja korral kannete arv selle hooaja kohta, muidu kõik kanded
        usageCount: totals ? (totals.get(m.id)?.entryCount ?? 0) : _count.entryLines,
        ...(totals ? { plannedQty: totals.get(m.id)?.plannedQty ?? 0, usedQty: totals.get(m.id)?.usedQty ?? 0 } : {}),
        ...articleStockFields(finance, stock.get(m.id)),
        stockIssueCount: m.stockIssueCount
      }))
    );
    return true;
  }
  if (pathname === '/api/articles' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const name = text(b?.name, 160);
    const categoryId = text(b?.categoryId, 64);
    const unit = text(b?.unit, 16);
    const category = categoryId ? await prisma.articleCategory.findUnique({ where: { id: categoryId }, select: { group: true, systemKind: true } }) : null;
    if (!name || !category || !unit) {
      json(res, { error: 'Artikli nimi, liik ja ühik on kohustuslikud' }, 400);
      return true;
    }
    const finance = canSeeFinance(req);
    const priceIn = finance ? num(b?.price) : null;
    // Hind on Decimal(12,4): lõplik, mitte negatiivne ja alla 10^8
    if (priceIn !== null && !(Number.isFinite(priceIn) && priceIn >= 0 && priceIn < 100000000)) {
      json(res, { error: 'Hind peab olema 0 või suurem' }, 400);
      return true;
    }
    const rules = articleFieldRules(category.group, category.systemKind);
    const optional = sanitizeArticleFields({
      price: priceIn, cropId: text(b?.cropId, 64), defaultWarehouseId: text(b?.defaultWarehouseId, 64),
      cropVarietyId: text(b?.cropVarietyId, 64), priaRegister: text(b?.priaRegister, 120), priaKind: text(b?.priaKind, 120),
      priaSpec: text(b?.priaSpec, 20), activeIngredient: text(b?.activeIngredient, 500), nPct: num(b?.nPct), pPct: num(b?.pPct), kPct: num(b?.kPct)
    }, rules);
    const data = { name, categoryId: categoryId!, unit, manufacturer: text(b?.manufacturer, 160), isActive: b?.isActive !== false,
      composition: text(b?.composition, 4000), notes: text(b?.notes, 4000), isDefaultService: false, ...optional };
    // aliases muutub ainult asendamisel
    const id = text(b?.id, 64);
    const old = id ? await prisma.article.findUnique({ where: { id }, select: { unit: true, name: true, defaultWarehouseId: true, isDefaultService: true, categoryId: true, isActive: true, aliases: true, category: { select: { group: true } } } }) : null;
    if (id && !old) {
      json(res, { error: 'Artiklit ei leitud' }, 404);
      return true;
    }
    // Tööaja liigi vaikimisi teenus: liigi kohta üks; märge liigub ainult teise teenuse märkimisega
    const timeService = category.group === 'SERVICE' && !!category.systemKind && SERVICE_TIME_KINDS.includes(category.systemKind as any);
    if (old?.isDefaultService && (old.categoryId !== categoryId || data.isActive === false)) {
      json(res, { error: 'Vaikimisi teenust ei saa teise liiki viia ega mitteaktiivseks muuta' }, 400);
      return true;
    }
    const isDefaultService: boolean = timeService && (old?.isDefaultService === true || b?.isDefaultService === true);
    data.isDefaultService = isDefaultService;
    // Ilma finantsõiguseta muutmisel jääb teenuse vana hind alles (kaubal hinda pole, see tühjendatakse)
    if (id && !finance && rules.price) delete (data as Partial<typeof data>).price;
    // Teenuse üle laoarvestust ei peeta: laokannetega kaupa ei saa teenuseks muuta
    if (old && old.category.group !== 'SERVICE' && category.group === 'SERVICE') {
      const [docLines, entryLines, planLines] = await Promise.all([
        prisma.stockDocumentLine.count({ where: { articleId: id! } }),
        prisma.workEntryLine.count({ where: { articleId: id!, kind: { in: ['MATERIAL', 'FUEL'] } } }),
        prisma.fieldWorkLine.count({ where: { articleId: id!, kind: 'MATERIAL' } })
      ]);
      if (docLines > 0) {
        json(res, { error: 'Artiklil on laokandeid, seda ei saa teenuseks muuta' }, 409);
        return true;
      }
      if (entryLines + planLines > 0) {
        json(res, { error: 'Artikkel on kasutusel kulumaterjalina, seda ei saa teenuseks muuta' }, 409);
        return true;
      }
    }
    // Tööaja ridadel kasutatavat teenust ei saa kaubaks muuta
    if (old && old.category.group === 'SERVICE' && category.group !== 'SERVICE'
      && (await prisma.workEntryLine.count({ where: { articleId: id!, kind: { in: ['LABOR', 'MACHINE', 'IMPLEMENT'] } } })) > 0) {
      json(res, { error: 'Teenus on kasutusel tööaja ridadel, seda ei saa kaubaks muuta' }, 409);
      return true;
    }
    const unitChanged = !!old && old.unit.trim().toLowerCase() !== unit.trim().toLowerCase();
    // Teisendustegur (1 vana ühik = tegur uut ühikut): kasutaja antud või kaaluühikute korral automaatne
    const unitFactor = unitChanged ? (num(b?.unitFactor) ?? convertQty(1, old!.unit, unit)) : null;
    if (unitChanged && lotUnitBlocked(await prisma.harvestLot.count({ where: { articleId: id! } }), unit)) {
      json(res, { error: LOT_UNIT_ERROR }, 409);
      return true;
    }
    if (unitChanged && !(unitFactor && unitFactor > 0)) {
      const docLines = await prisma.stockDocumentLine.count({ where: { articleId: id! } });
      const goodsLotCosts = await prisma.harvestLotCost.count({ where: { articleId: id!, article: { category: { group: { not: 'SERVICE' } } } } });
      if (docLines || goodsLotCosts) {
        const what = [docLines ? `${docLines} laokande rida` : null, goodsLotCosts ? `${goodsLotCosts} kuivatuskulu rida` : null].filter(Boolean).join(' ja ');
        json(res, { error: `Artiklil on ${what}. Sisesta teisendustegur: mitu ${unit} on üks ${old!.unit}.`, needsFactor: true }, 409);
        return true;
      }
      const lines = await prisma.workEntryLine.findMany({ where: { articleId: id!, kind: { in: ['MATERIAL', 'FUEL'] } }, select: { unit: true } });
      const bad = lines.filter((l) => convertQty(1, l.unit, unit) === null).length;
      if (bad && b?.confirmUnitChange !== true) {
        json(res, { error: `${bad} kannet ei saa ühikusse "${unit}" teisendada ja need jäävad laoarvestusest välja.`, needsConfirm: true }, 409);
        return true;
      }
    }
    try {
      const saved = await tenantTransaction(async (tx) => {
        if (isDefaultService && !old?.isDefaultService) {
          await tx.article.updateMany({ where: { categoryId: categoryId!, isDefaultService: true, ...(id ? { NOT: { id } } : {}) }, data: { isDefaultService: false } });
        }
        let s = id ? await tx.article.update({ where: { id }, data: unitFactor ? { ...data, unit: old!.unit } : data }) : await tx.article.create({ data });
        if (unitFactor) {
          await changeArticleUnit(tx, s.id, old!.unit, unit, unitFactor);
          s = await tx.article.findUniqueOrThrow({ where: { id: s.id } });
        } else if (unitChanged) await recomputeArticleStock(tx, [s.id]);
        // Kütus kantakse maha artikli vaikimisi laost: lao vahetus liigutab kütuse kanderead teise lattu
        else if (old && old.defaultWarehouseId !== s.defaultWarehouseId) await recomputeArticleStock(tx, [s.id]);
        // Ümbernimetamine: plaani- ja kanderead saavad uue nime; vana nimi jääb varunimeks (PRIA import seob selle materjaliga)
        if (old && old.name !== name) {
          // Tööaja ridade nimi tuleb töötajast/masinast, mitte artiklist: nimi muutub ainult materjali- ja kütuseridadel
          await tx.fieldWorkLine.updateMany({ where: { articleId: s.id, kind: 'MATERIAL' }, data: { label: name } });
          await tx.workEntryLine.updateMany({ where: { articleId: s.id, kind: { in: ['MATERIAL', 'FUEL'] } }, data: { label: name } });
          const aliases = [...new Set([...old.aliases, nameKey(old.name)])].filter((a) => a !== nameKey(name));
          return tx.article.update({ where: { id: s.id }, data: { aliases } });
        }
        return s;
      }, { timeout: 60000 }); // ühiku teisendus uuendab iga kande-, plaani- ja laokande rea eraldi
      json(res, { ...saved, price: saved.price === null || !finance ? null : Number(saved.price) });
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'Selles liigis on sellise nimega artikkel juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  // Materjali asendamine teisega (nt PRIA kirjaviga): plaanid, kanded ja laokanded viiakse sihtmaterjalile,
  // asendatav kustutatakse ja tema nimi jääb sihtmaterjalile varunimeks (PRIA import seob selle edaspidi sihtmaterjaliga)
  if (pathname.startsWith('/api/articles/') && pathname.endsWith('/merge') && method === 'POST') {
    const id = decodeURIComponent(pathname.slice('/api/articles/'.length, -'/merge'.length));
    const b = await parseBody(req, MAX_BODY_BYTES);
    const targetId = text(b?.targetId, 64);
    const [source, target] = await Promise.all([
      prisma.article.findUnique({ where: { id } }),
      targetId ? prisma.article.findUnique({ where: { id: targetId } }) : null
    ]);
    if (!source || !target || source.id === target.id) {
      json(res, { error: 'Vali artikkel, millega asendada' }, 400);
      return true;
    }
    if (deleteDenied(req, res, source.createdBy)) return true;
    if (source.categoryId !== target.categoryId) {
      json(res, { error: 'Asendada saab ainult sama liigi artikliga' }, 400);
      return true;
    }
    // Laokande read on laoühikus: eri ühiku korral teisendatakse; teisendamatu ühikuga laokandeid ei saa üle viia
    const docLines = await prisma.stockDocumentLine.findMany({ where: { articleId: source.id }, select: { id: true, quantity: true, countedQty: true, documentId: true } });
    // Teenuse kuivatuskulu kogus on tunnid: seda ei teisendata ega loeta ühikute kontrolli
    const isGoods = source.categoryId ? (await prisma.articleCategory.findUnique({ where: { id: source.categoryId }, select: { group: true } }))?.group !== 'SERVICE' : true;
    const lotCostLines = await prisma.harvestLotCost.findMany({ where: { articleId: source.id }, select: { id: true, quantity: true } });
    const convertibleLotCosts = isGoods ? lotCostLines.length : 0;
    if ((docLines.length || convertibleLotCosts) && convertQty(1, source.unit, target.unit) === null) {
      const what = [docLines.length ? `${docLines.length} laokande rida` : null, convertibleLotCosts ? `${convertibleLotCosts} kuivatuskulu rida` : null].filter(Boolean).join(' ja ');
      json(res, { error: `Artiklil on ${what} ühikus "${source.unit}", mida ei saa ühikusse "${target.unit}" teisendada.` }, 409);
      return true;
    }
    if (lotUnitBlocked(await prisma.harvestLot.count({ where: { articleId: source.id } }), target.unit)) {
      json(res, { error: LOT_UNIT_ERROR }, 409);
      return true;
    }
    const counts = await tenantTransaction(async (tx) => {
      // Nimi muutub ainult materjali- ja kütuseridadel (tööaja ridade nimi tuleb töötajast/masinast)
      await tx.fieldWorkLine.updateMany({ where: { articleId: source.id, kind: 'MATERIAL' }, data: { label: target.name } });
      await tx.workEntryLine.updateMany({ where: { articleId: source.id, kind: { in: ['MATERIAL', 'FUEL'] } }, data: { label: target.name } });
      const plans = await tx.fieldWorkLine.updateMany({ where: { articleId: source.id }, data: { articleId: target.id } });
      const entries = await tx.workEntryLine.updateMany({ where: { articleId: source.id }, data: { articleId: target.id } });
      for (const l of docLines) {
        const counted = l.countedQty === null ? null : convertQty(l.countedQty, source.unit, target.unit)!;
        // Sama inventuuri sihtartikli rida: tegelikud seisud liidetakse (artikkel on inventuuris üks kord)
        const twin = counted === null ? null : await tx.stockDocumentLine.findFirst({ where: { documentId: l.documentId, articleId: target.id }, select: { id: true, countedQty: true } });
        if (twin) {
          await tx.stockDocumentLine.update({ where: { id: twin.id }, data: { countedQty: (twin.countedQty ?? 0) + counted! } });
          await tx.stockDocumentLine.delete({ where: { id: l.id } });
          continue;
        }
        await tx.stockDocumentLine.update({ where: { id: l.id }, data: { articleId: target.id, quantity: convertQty(l.quantity, source.unit, target.unit)!, countedQty: counted } });
      }
      // Saagipartii kuivatuskulud: kogus artikli ühikus; partii põhiartikkel liigub sihtartiklile
      for (const l of lotCostLines) {
        await tx.harvestLotCost.update({ where: { id: l.id }, data: { articleId: target.id, ...(isGoods ? { quantity: convertQty(l.quantity, source.unit, target.unit)! } : {}) } });
      }
      await tx.harvestLot.updateMany({ where: { articleId: source.id }, data: { articleId: target.id } });
      const aliases = [...new Set([...target.aliases, ...source.aliases, nameKey(source.name)])].filter((a) => a !== nameKey(target.name));
      // Sihtmaterjali tühjad PRIA väljad täidetakse asendatava omadest
      await tx.article.update({
        where: { id: target.id },
        data: {
          aliases,
          isDefaultService: target.isDefaultService || source.isDefaultService,
          manufacturer: target.manufacturer ?? source.manufacturer,
          composition: target.composition ?? source.composition,
          price: target.price ?? source.price,
          cropId: target.cropId ?? source.cropId,
          defaultWarehouseId: target.defaultWarehouseId ?? source.defaultWarehouseId,
          priaRegister: target.priaRegister ?? source.priaRegister,
          priaKind: target.priaKind ?? source.priaKind,
          priaSpec: target.priaSpec ?? source.priaSpec,
          activeIngredient: target.activeIngredient ?? source.activeIngredient,
          nPct: target.nPct ?? source.nPct,
          pPct: target.pPct ?? source.pPct,
          kPct: target.kPct ?? source.kPct
        }
      });
      // Ressursside teenus ja kütus ning vaikimisi teenuse märge liiguvad sihtartiklile
      await tx.vehicle.updateMany({ where: { serviceArticleId: source.id }, data: { serviceArticleId: target.id } });
      await tx.vehicle.updateMany({ where: { fuelArticleId: source.id }, data: { fuelArticleId: target.id } });
      await tx.implement.updateMany({ where: { serviceArticleId: source.id }, data: { serviceArticleId: target.id } });
      await tx.relatedParty.updateMany({ where: { serviceArticleId: source.id }, data: { serviceArticleId: target.id } });
      await tx.article.delete({ where: { id: source.id } });
      await recomputeArticleStock(tx, [target.id]);
      return { plans: plans.count, entries: entries.count, stockLines: docLines.length };
    });
    json(res, { success: true, ...counts });
    return true;
  }
  if (pathname.startsWith('/api/articles/') && method === 'DELETE') {
    const id = idOf('/api/articles/');
    const article = await prisma.article.findUnique({ where: { id }, select: { createdBy: true, isDefaultService: true } });
    if (article && deleteDenied(req, res, article.createdBy)) return true;
    if (article?.isDefaultService) {
      json(res, { error: 'Vaikimisi teenust ei saa kustutada' }, 409);
      return true;
    }
    // Materjal võib olla kasutusel nii kannetes kui ka tööde plaanides (mõlemad keelavad kustutamise)
    const [usedInEntries, usedInPlans, usedInStock, usedInLots, usedInLotCosts] = await Promise.all([
      prisma.workEntryLine.count({ where: { articleId: id } }),
      prisma.fieldWorkLine.count({ where: { articleId: id } }),
      prisma.stockDocumentLine.count({ where: { articleId: id } }),
      prisma.harvestLot.count({ where: { articleId: id } }),
      prisma.harvestLotCost.count({ where: { articleId: id } })
    ]);
    if (usedInEntries || usedInPlans || usedInStock || usedInLots || usedInLotCosts) {
      const where = [
        usedInEntries ? `${usedInEntries} kandes` : null,
        usedInPlans ? `${usedInPlans} töö plaanis` : null,
        usedInStock ? `${usedInStock} laokandes` : null,
        usedInLots ? `${usedInLots} saagipartiis` : null,
        usedInLotCosts ? `${usedInLotCosts} partii kuivatuskulus` : null
      ].filter(Boolean).join(' ja ');
      json(res, { error: `Artikkel on kasutusel ${where}. Märgi see mitteaktiivseks.` }, 409);
      return true;
    }
    await prisma.article.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // Ühe põllu ühe hooaja tööd (põllu täisvaade)
  if (pathname === '/api/field-season-works' && method === 'GET') {
    const fieldId = int(url.searchParams.get('fieldId'));
    const year = int(url.searchParams.get('year'));
    if (!fieldId || !year) {
      json(res, { error: 'fieldId ja year on kohustuslikud' }, 400);
      return true;
    }
    const fs = await prisma.fieldSeason.findUnique({ where: { fieldId_year: { fieldId, year } } });
    if (!fs) {
      json(res, { fieldSeasonId: null, areaHa: 0, targetYieldTonsHa: null, actualYieldTonsHa: null, works: [] });
      return true;
    }
    const works = await prisma.fieldWork.findMany({
      where: { fieldSeasonId: fs.id },
      orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
      include: FIELD_WORK_INCLUDE
    });
    const finance = canSeeFinance(req);
    json(res, {
      fieldSeasonId: fs.id,
      areaHa: fs.areaHa,
      targetYieldTonsHa: fs.targetYieldTonsHa,
      actualYieldTonsHa: fs.actualYieldTonsHa,
      works: works.map((w) => fieldWorkDto(w, finance))
    });
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
    // Päring ainult loeb: kultuuri ei pärita eelmisest aastast (talivili kuulub koristusaasta hooaega)
    const rows = await prisma.fieldWork.findMany({
      where: { fieldSeason: { year } },
      orderBy: [{ fieldSeasonId: 'asc' }, { sortOrder: 'asc' }],
      include: { ...FIELD_WORK_INCLUDE, fieldSeason: { select: { id: true, fieldId: true, crop: true, year: true } } }
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
      include: { ...FIELD_WORK_INCLUDE, fieldSeason: { select: { id: true, fieldId: true, crop: true, year: true } } }
    }) : [];

    const worksDto: any[] = rows.map((w) => {
      const isWinter = isWinterCrop(w.fieldSeason.crop, crops);
      const isAutumnPhase = isWinter && (w.phase === 'PREPARATION' || w.phase === 'SOWING');
      return {
        ...fieldWorkDto(w, finance),
        carriedOverFromYear: isAutumnPhase ? year - 1 : null,
        carriedOverToYear: null,
        seasonYear: year,
        isNextSeasonWinterSowing: false
      };
    });

    for (const w of nextAutumnRows) {
      const isWinter = isWinterCrop(w.fieldSeason.crop, crops);
      const dto = fieldWorkDto(w, finance);
      // Dateeritud töö (varaseim kanne, muidu plaani algus) kuulub sügisesse, kui see on aastal Y (iga faas,
      // nt järgmise kultuuri sügishooldus). Kuupäevata: talivili ettevalmistus+külv, suvivili ettevalmistus,
      // hooldus ainult "Sügis …" plaaniga.
      const date = boardWorkDate(dto);
      if (date) {
        if (w.phase === 'HARVEST' || Number(date.slice(0, 4)) > year) continue;
      } else {
        // hooldus ainult täpselt "Sügis YYYY" plaaniga; "sügis … / kevad …" plaan kuulub järgmise hooaja hooldusse
        const undatedAutumn = w.phase === 'PREPARATION' || (isWinter && w.phase === 'SOWING') || (w.phase === 'CARE' && isExactAutumnText(w.plannedText));
        if (!undatedAutumn) continue;
      }
      const isAutumnPhase = w.phase === 'PREPARATION' || w.phase === 'SOWING';
      worksDto.push({
        ...dto,
        plannedText: isAutumnPhase ? (w.plannedText ?? `Sügis ${year}`) : w.plannedText,
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
    const { data: plan, lines, articleError } = await planInput(b);
    if (articleError) {
      json(res, { error: articleError }, 400);
      return true;
    }
    const saved = await prisma.fieldWork.create({
      data: {
        ...(plan as object),
        fieldSeasonId,
        workTypeId: workType.id,
        phase: workType.phase,
        sortOrder: preferredSortOrder !== null ? preferredSortOrder : (last?.sortOrder ?? -1) + 1,
        plannedCount: 1,
        ...(lines ? { lines: { create: lines } } : {})
      } as Prisma.FieldWorkUncheckedCreateInput,
      include: FIELD_WORK_INCLUDE
    });
    json(res, fieldWorkDto(saved, canSeeFinance(req)));
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
    // Kindlad tööd (nt järgmise kultuuri sügisplokis kuvatud tööd, sh sügishooldus)
    if (Array.isArray(b?.workIds)) {
      const ids = (b.workIds as unknown[]).map((v) => text(v, 64)).filter((v): v is string => !!v);
      const where: Prisma.FieldWorkWhereInput = { fieldSeasonId, id: { in: ids } };
      const entriesCount = await prisma.workEntry.count({ where: { fieldWork: where } });
      if (entriesCount > 0) {
        json(res, { error: `Valitud töödel on ${entriesCount} kannet. Kandeid omavaid töid ei saa eemaldada.` }, 409);
        return true;
      }
      if (await bulkDeleteDenied(req, res, where)) return true;
      const { count } = await prisma.fieldWork.deleteMany({ where });
      json(res, { success: true, count, mode: 'IDS' });
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
    const { data: plan, lines, articleError } = await planInput(b);
    if (articleError) {
      json(res, { error: articleError }, 400);
      return true;
    }
    Object.assign(data, plan);
    const before = await prisma.fieldWork.findUnique({ where: { id }, select: { status: true, plannedAreaHa: true } });
    // Lõpetatud tööd saab ainult uuesti avada
    if (before?.status === 'DONE' && b?.status !== 'REOPEN') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    if (b?.status === 'DONE') {
      const latestEntry = await prisma.workEntry.findFirst({
        where: { fieldWorkId: id },
        orderBy: { date: 'desc' },
        select: { date: true }
      });
      Object.assign(data, { status: 'DONE', finishedAt: latestEntry?.date ?? new Date(), finishedById: userId });
    }
    // Plaaniridade asendus ja töö uuendus ühes tehingus: ebaõnnestunud lisamine ei kustuta vanu ridu
    await tenantTransaction(async (tx) => {
      if (lines) {
        await tx.fieldWorkLine.deleteMany({ where: { fieldWorkId: id } });
        if (lines.length) await tx.fieldWorkLine.createMany({ data: lines.map((l: object) => ({ ...l, fieldWorkId: id })) });
      }
      await tx.fieldWork.update({ where: { id }, data });
    });
    // Plaanitud pindala tegelik muutus võib töö lõpetada; lõpetatud tööd ei avata automaatselt (ainult REOPEN)
    const areaChanged = 'plannedAreaHa' in data && (data.plannedAreaHa ?? null) !== (before?.plannedAreaHa ?? null);
    if (areaChanged && !b?.status && before?.status !== 'DONE') await syncFieldWorkStatus(id, false, userId, prisma);
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
    const fw = await prisma.fieldWork.findUnique({ where: { id }, select: { createdBy: true, status: true } });
    if (fw && deleteDenied(req, res, fw.createdBy)) return true;
    if (fw?.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
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
    const { data, drafts, warehouseId, articleError, harvestLotId: harvestLotIdIn, harvestTonnesManualIn } = await resolveEntryInput(b);
    if (articleError) {
      json(res, { error: articleError }, 400);
      return true;
    }
    if (!work || !data.date) {
      json(res, { error: 'Töö ja kuupäev on kohustuslikud' }, 400);
      return true;
    }
    if (work.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    let saved;
    try {
      saved = await tenantTransaction(async (tx) => {
        // Lukustus: antud väärtus, muidu käsitsi sisestatud tonnid
        const harvestTonnesManual = harvestTonnesManualIn ?? (drafts.find((l) => l.kind === 'HARVEST')?.quantity ?? 0) > 0;
        let harvestLotId: string | null = null;
        if (drafts.some((l) => l.kind === 'HARVEST')) {
          const fs = await tx.fieldWork.findUniqueOrThrow({ where: { id: work.id }, select: { fieldSeason: { select: { id: true, areaHa: true } } } });
          harvestLotId = await applyEntryHarvest(tx, drafts, {
            fieldSeasonId: fs.fieldSeason.id, areaHa: data.areaHa, fieldAreaHa: fs.fieldSeason.areaHa,
            bunkers: data.harvestBunkers, manual: harvestTonnesManual, requestedLotId: harvestLotIdIn, old: null
          });
        }
        const created = await tx.workEntry.create({
          data: {
            ...data, harvestLotId, harvestTonnesManual, date: data.date!, warehouseId: await resolveEntryWarehouseId(tx, warehouseId, null),
            fieldWorkId: work.id, createdById: userId, lines: { create: drafts }
          }
        });
        await recomputeArticleStock(tx, articleIdsOf(drafts));
        return tx.workEntry.findUniqueOrThrow({ where: { id: created.id }, include: ENTRY_INCLUDE });
      });
    } catch (err) {
      if (err instanceof StockValidationError || err instanceof HarvestLotError) {
        json(res, { error: err.message }, 400);
        return true;
      }
      throw err;
    }
    await syncFieldWorkStatus(work.id, b?.finish === true, userId, prisma);
    const finance = canSeeFinance(req);
    // Finantsjuhile hoiatus, kui kanne jääb inventuuri ette (muudab selle vahet)
    const notice = finance && saved.warehouseId
      ? await tenantTransaction(async (tx) => inventoryNotice(tx, await entryStockTouches(tx, saved.lines, saved.warehouseId!), saved.date, null))
          .catch((err) => { console.error('Inventuuri hoiatuse arvutus ebaõnnestus', err); return null; })
      : null;
    json(res, { ...entryDto(saved, finance), ...(finance ? { inventoryNotice: notice } : {}) });
    return true;
  }
  if (pathname.startsWith('/api/work-entries/') && method === 'PUT') {
    const id = idOf('/api/work-entries/');
    const b = await parseBody(req, MAX_BODY_BYTES);
    const old = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true, fieldWork: { select: { status: true } } } });
    const { data, drafts, warehouseId, articleError, harvestLotId: harvestLotIdIn, harvestTonnesManualIn } = await resolveEntryInput(b);
    if (articleError) {
      json(res, { error: articleError }, 400);
      return true;
    }
    if (!old || !data.date) {
      json(res, { error: 'Kannet ei leitud või kuupäev puudub' }, 400);
      return true;
    }
    if (old.fieldWork.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    let saved;
    try {
      saved = await tenantTransaction(async (tx) => {
        const entryWarehouseId = await resolveEntryWarehouseId(tx, warehouseId, old.warehouseId);
        const oldHarvest = old.lines.find((l) => l.kind === 'HARVEST');
        const typed = (drafts.find((l) => l.kind === 'HARVEST')?.quantity ?? 0) > 0;
        // Puuduv lukustus jääb endiseks; saagireata kandele uus käsitsi sisestatud saak lukustab
        const harvestTonnesManual = harvestTonnesManualIn ?? (oldHarvest ? old.harvestTonnesManual : typed);
        let harvestLotId: string | null = null;
        if (drafts.some((l) => l.kind === 'HARVEST') || old.harvestLotId) {
          const fs = await tx.fieldWork.findUniqueOrThrow({ where: { id: old.fieldWorkId }, select: { fieldSeason: { select: { id: true, areaHa: true } } } });
          harvestLotId = await applyEntryHarvest(tx, drafts, {
            fieldSeasonId: fs.fieldSeason.id, areaHa: data.areaHa, fieldAreaHa: fs.fieldSeason.areaHa,
            bunkers: data.harvestBunkers, manual: harvestTonnesManual, requestedLotId: harvestLotIdIn,
            old: { harvestLotId: old.harvestLotId, harvestBunkers: old.harvestBunkers, harvestTonnesManual: old.harvestTonnesManual, harvestTonnes: oldHarvest?.quantity ?? 0 }
          });
        }
        const merged = mergeLines(old.lines.map(toStored), drafts, old.financeStatus as FinanceStatus);
        await tx.workEntryLine.deleteMany({ where: { entryId: id } });
        const updated = await tx.workEntry.update({
          where: { id },
          data: {
            ...data,
            harvestLotId,
            harvestTonnesManual,
            date: data.date!,
            warehouseId: entryWarehouseId,
            financeStatus: merged.financeStatus,
            lines: { create: merged.lines.map((l) => ({ ...l, unitPrice: l.unitPrice })) }
          }
        });
        await recomputeArticleStock(tx, [...articleIdsOf(old.lines), ...articleIdsOf(merged.lines)]);
        return tx.workEntry.findUniqueOrThrow({ where: { id: updated.id }, include: ENTRY_INCLUDE });
      });
    } catch (err) {
      if (err instanceof StockValidationError || err instanceof HarvestLotError) {
        json(res, { error: err.message }, 400);
        return true;
      }
      throw err;
    }
    await syncFieldWorkStatus(old.fieldWorkId, b?.finish === true, userId, prisma);
    const finance = canSeeFinance(req);
    const notice = finance && saved.warehouseId
      ? await tenantTransaction(async (tx) => inventoryNotice(tx, [
          ...(await entryStockTouches(tx, old.lines, old.warehouseId ?? await getDefaultWarehouseId(tx))),
          ...(await entryStockTouches(tx, saved.lines, saved.warehouseId!))
        ], old.date < saved.date ? old.date : saved.date, null))
          .catch((err) => { console.error('Inventuuri hoiatuse arvutus ebaõnnestus', err); return null; })
      : null;
    json(res, { ...entryDto(saved, finance), ...(finance ? { inventoryNotice: notice } : {}) });
    return true;
  }
  if (pathname.startsWith('/api/work-entries/') && method === 'DELETE') {
    const id = idOf('/api/work-entries/');
    const e = await prisma.workEntry.findUnique({ where: { id }, include: { lines: { select: { kind: true, articleId: true } }, fieldWork: { select: { status: true } } } });
    if (!e) {
      json(res, { error: 'Kannet ei leitud' }, 404);
      return true;
    }
    if (e.fieldWork.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    if (deleteDenied(req, res, e.createdBy)) return true;
    if (e.financeStatus !== 'PENDING' && !canSeeFinance(req)) {
      json(res, { error: 'Kinnitatud kannet saab kustutada ainult finantsjuht' }, 403);
      return true;
    }
    try {
      await tenantTransaction(async (tx) => {
        await assertEntryLotOpen(tx, e.harvestLotId);
        await tx.workEntry.delete({ where: { id } });
        await recomputeArticleStock(tx, articleIdsOf(e.lines));
      });
    } catch (err) {
      if (err instanceof HarvestLotError) {
        json(res, { error: err.message }, 409);
        return true;
      }
      throw err;
    }
    await syncFieldWorkStatus(e.fieldWorkId, false, userId, prisma);
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
              workType: { select: { name: true, shortName: true } },
              fieldSeason: { select: { id: true, year: true, crop: true, areaHa: true, field: { select: { num: true, name: true } } } }
            }
          }
        }
      });
      json(res, rows.map((e) => ({
        ...entryDto(e, true),
        workTypeName: workTypeDisplayName(e.fieldWork.workType),
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
      // Kulumaterjali ja kütuse hind tuleb laost (FIFO), käsitsi seda ei muudeta
      const fromStock = (kind: string) => kind === 'MATERIAL' || kind === 'FUEL';
      const lines = entry.lines.map((l) => ({
        ...l,
        unitPrice: !fromStock(l.kind) && l.id in prices ? num(prices[l.id]) : decimalToNumber(l.unitPrice)
      }));
      const blocked = b?.confirm === true ? confirmBlockReason(lines) : null;
      if (blocked) {
        json(res, { error: blocked }, 400);
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
