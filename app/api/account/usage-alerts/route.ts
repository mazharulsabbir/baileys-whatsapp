import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const patchSchema = z.object({
  usageQuotaAlertsEnabled: z.boolean().optional(),
  usageAlertAt75: z.boolean().optional(),
  usageAlertAt85: z.boolean().optional(),
  usageAlertAt95: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      usageQuotaAlertsEnabled: true,
      usageAlertAt75: true,
      usageAlertAt85: true,
      usageAlertAt95: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      usageQuotaAlertsEnabled: true,
      usageAlertAt75: true,
      usageAlertAt85: true,
      usageAlertAt95: true,
    },
  });
  return NextResponse.json(updated);
}
