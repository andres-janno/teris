// src/server/fieldWorkStatus.ts — töö olek kannete järgi. Ei impordi db.ts-i ega HTTP käsitlejat,
// et seda saaks kasutada ka eraldiseisev skript (andmebaasi klient antakse kaasa).
import type { Prisma } from '@prisma/client';

// Iga klient (ka laiendatud `prisma` või skripti oma), millel on vajalikud mudelid.
// Laiendatud kliendi delegaadid ei ühildu TransactionClient tüübiga, seepärast struktuurne tüüp.
export interface PrismaClientLike {
  fieldWork: { findUnique(args: any): Promise<unknown>; update(args: any): Promise<unknown> };
  workEntry: { aggregate(args: any): Promise<unknown>; findFirst(args: any): Promise<unknown>; count(args: any): Promise<unknown> };
}

// Töö olek kannete järgi (lõpetatud töö jääb lõpetatuks, kuni see avatakse).
// Lõpetamise kuupäev võetakse kande kuupäevast (mitte serveri süsteemi kellast).
// Kui 100% töö plaanitud pindalast (vaikimisi põllu pindala) on tehtud, märgitakse töö automaatselt lõpetatuks.
export async function syncFieldWorkStatus(
  fieldWorkId: string,
  finish: boolean,
  userId: string | null,
  client: Prisma.TransactionClient | PrismaClientLike
): Promise<void> {
  // Käitusajal samad päringud; tüübid TransactionClient'i järgi
  const db = client as Prisma.TransactionClient;
  const work = await db.fieldWork.findUnique({
    where: { id: fieldWorkId },
    select: { status: true, plannedAreaHa: true, fieldSeason: { select: { areaHa: true } }, _count: { select: { entries: true } } }
  });
  if (!work) return;

  const agg = await db.workEntry.aggregate({
    where: { fieldWorkId },
    _sum: { areaHa: true }
  });
  const totalDoneArea = agg._sum.areaHa ?? 0;
  const fieldArea = work.plannedAreaHa ?? work.fieldSeason?.areaHa ?? 0;
  const is100Percent = fieldArea > 0 && totalDoneArea >= fieldArea - 0.01;

  if (finish || is100Percent) {
    const latestEntry = await db.workEntry.findFirst({
      where: { fieldWorkId },
      orderBy: { date: 'desc' },
      select: { date: true }
    });
    await db.fieldWork.update({
      where: { id: fieldWorkId },
      data: {
        status: 'DONE',
        finishedAt: latestEntry?.date ?? new Date(),
        finishedById: userId
      }
    });
  } else {
    // Kui pindala on alla 100% ja finish pole märgitud, on töö pooleli (või planeeritud kui kandeid pole)
    const n = await db.workEntry.count({ where: { fieldWorkId } });
    await db.fieldWork.update({
      where: { id: fieldWorkId },
      data: {
        status: n > 0 ? 'IN_PROGRESS' : 'PLANNED',
        finishedAt: null,
        finishedById: null
      }
    });
  }
}
