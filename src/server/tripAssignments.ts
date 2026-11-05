// src/server/tripAssignments.ts — seadme masin ja haakeriist antud hetkel seoste registrist.
// Seadme seos (DeviceAssignment) annab masina või haakeriista; puuduva poole leiame haakimise registrist (ImplementAssignment).
// Kasutavad sõitude import (haakeriista laius põllule jõudmise ajal), sõitude API ja kande soovitused.
import { prisma } from './db.ts';

export type ResolvedTarget = {
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  widthM: number | null; // haakeriista töölaius (m)
};

export type AssignmentResolver = (deviceId: string, at: Date) => ResolvedTarget;

const covers = (a: { startedAt: Date; endedAt: Date | null }, t: Date) => a.startedAt <= t && (!a.endedAt || a.endedAt >= t);

export async function loadAssignmentResolver(deviceIds: string[]): Promise<AssignmentResolver> {
  const ids = [...new Set(deviceIds)];
  const assignments = ids.length
    ? await prisma.deviceAssignment.findMany({
        where: { deviceId: { in: ids } },
        include: {
          vehicle: { select: { id: true, name: true } },
          implement: { select: { id: true, name: true, workingWidthM: true } }
        },
        orderBy: { startedAt: 'desc' }
      })
    : [];
  const vehicleIds = [...new Set(assignments.map((a) => a.vehicleId).filter((x): x is string => !!x))];
  const implementIds = [...new Set(assignments.filter((a) => !a.vehicleId).map((a) => a.implementId).filter((x): x is string => !!x))];
  // Seadme seos võib olla haakeriistaga (ilma masinata); siis leiame masina haakimise registrist.
  const implAssignments = vehicleIds.length || implementIds.length
    ? await prisma.implementAssignment.findMany({
        where: { OR: [
          ...(vehicleIds.length ? [{ vehicleId: { in: vehicleIds } }] : []),
          ...(implementIds.length ? [{ implementId: { in: implementIds } }] : [])
        ] },
        include: {
          implement: { select: { id: true, name: true, workingWidthM: true } },
          vehicle: { select: { id: true, name: true } }
        },
        orderBy: { startedAt: 'desc' }
      })
    : [];
  return (deviceId, at) => {
    const a = assignments.find((x) => x.deviceId === deviceId && covers(x, at));
    let implement = a?.implement ?? null;
    let vehicle = a?.vehicle ?? null;
    if (!implement && a?.vehicleId) {
      implement = implAssignments.find((x) => x.vehicleId === a.vehicleId && covers(x, at))?.implement ?? null;
    }
    if (!vehicle && a?.implementId) {
      vehicle = implAssignments.find((x) => x.implementId === a.implementId && covers(x, at))?.vehicle ?? null;
    }
    return {
      vehicleId: vehicle?.id ?? null,
      vehicleName: vehicle?.name ?? null,
      implementId: implement?.id ?? null,
      implementName: implement?.name ?? null,
      widthM: implement?.workingWidthM ?? null
    };
  };
}
