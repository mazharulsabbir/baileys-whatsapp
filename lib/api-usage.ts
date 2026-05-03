import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

function missingApiUsageTable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (e.code === 'P2021') {
    return true;
  }
  if (e.code === 'P2010' && typeof e.message === 'string') {
    return e.message.includes('ApiUsageEvent');
  }
  return false;
}

export type UsageRoute = 'messages' | 'status';

export async function recordApiUsage(userId: string, route: UsageRoute): Promise<void> {
  try {
    await prisma.apiUsageEvent.create({
      data: { userId, route },
    });
  } catch (e) {
    if (missingApiUsageTable(e)) {
      console.warn(
        '[api-usage] ApiUsageEvent table missing; run `npx prisma migrate deploy` (or db push) for this database.',
      );
      return;
    }
    throw e;
  }
}

export type UsageSummary = {
  totals: { last24h: number; last7d: number; last30d: number };
  /** ISO date (UTC midnight) -> counts */
  byDay: { day: string; messages: number; status: number }[];
};

function emptyUsageSummary(): UsageSummary {
  const chartFrom = new Date();
  chartFrom.setUTCDate(chartFrom.getUTCDate() - 13);
  chartFrom.setUTCHours(0, 0, 0, 0);
  const byDay: UsageSummary['byDay'] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(chartFrom);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    byDay.push({ day: key, messages: 0, status: 0 });
  }
  return {
    totals: { last24h: 0, last7d: 0, last30d: 0 },
    byDay,
  };
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  let last24h: number;
  let last7d: number;
  let last30d: number;
  try {
    [last24h, last7d, last30d] = await Promise.all([
      prisma.apiUsageEvent.count({
        where: { userId, createdAt: { gte: since24h } },
      }),
      prisma.apiUsageEvent.count({
        where: { userId, createdAt: { gte: since7d } },
      }),
      prisma.apiUsageEvent.count({
        where: { userId, createdAt: { gte: since30d } },
      }),
    ]);
  } catch (e) {
    if (missingApiUsageTable(e)) {
      return emptyUsageSummary();
    }
    throw e;
  }

  const chartFrom = new Date();
  chartFrom.setUTCDate(chartFrom.getUTCDate() - 13);
  chartFrom.setUTCHours(0, 0, 0, 0);

  type Row = { day: string; route: string; c: bigint };
  let rows: Row[];
  try {
    rows = await prisma.$queryRaw<Row[]>`
    SELECT
      to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      route,
      COUNT(*)::bigint AS c
    FROM "ApiUsageEvent"
    WHERE "userId" = ${userId}
      AND "createdAt" >= ${chartFrom}
    GROUP BY 1, route
    ORDER BY 1 ASC
  `;
  } catch (e) {
    if (missingApiUsageTable(e)) {
      return emptyUsageSummary();
    }
    throw e;
  }

  const dayMap = new Map<string, { messages: number; status: number }>();

  for (const row of rows) {
    const key = row.day;
    const prev = dayMap.get(key) ?? { messages: 0, status: 0 };
    const n = Number(row.c);
    if (row.route === 'messages') prev.messages += n;
    else if (row.route === 'status') prev.status += n;
    dayMap.set(key, prev);
  }

  const byDay: UsageSummary['byDay'] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(chartFrom);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const counts = dayMap.get(key) ?? { messages: 0, status: 0 };
    byDay.push({ day: key, ...counts });
  }

  return {
    totals: { last24h, last7d, last30d },
    byDay,
  };
}
