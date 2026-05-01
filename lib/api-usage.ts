import { prisma } from '@/lib/prisma';

export type UsageRoute = 'messages' | 'status';

export async function recordApiUsage(userId: string, route: UsageRoute): Promise<void> {
  await prisma.apiUsageEvent.create({
    data: { userId, route },
  });
}

export type UsageSummary = {
  totals: { last24h: number; last7d: number; last30d: number };
  /** ISO date (UTC midnight) -> counts */
  byDay: { day: string; messages: number; status: number }[];
};

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [last24h, last7d, last30d] = await Promise.all([
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

  const chartFrom = new Date();
  chartFrom.setUTCDate(chartFrom.getUTCDate() - 13);
  chartFrom.setUTCHours(0, 0, 0, 0);

  type Row = { day: string; route: string; c: bigint };
  const rows = await prisma.$queryRaw<Row[]>`
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
