// src/server/db.ts
// Prisma kliendid. `new PrismaClient()` laeb projekti .env-i, mistõttu
// TSDB_DATABASE_URL loetakse alles pärast põhikliendi loomist.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// telemetry_tsdb (TimescaleDB) hoiab Teltonika GPS + Eye sensori telemeetriat ühes
// laias mõõtmiste tabelis (mitte Prisma mudelina — $queryRaw teise ühendusega).
export const tsdb = process.env.TSDB_DATABASE_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.TSDB_DATABASE_URL } } })
  : null;
