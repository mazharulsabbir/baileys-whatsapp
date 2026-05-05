import { Prisma } from '@prisma/client';

import { sendTransactionalEmail } from '@/lib/email';
import { getEntitlement } from '@/lib/entitlement';
import { getPlan } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import { countMonthlyApiCalls, getUtcBillingMonth } from '@/lib/quota';
import { PRODUCT_NAME } from '@/lib/brand';

const THRESHOLDS = [75, 85, 95] as const;

function missingUsageAlertSchema(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === 'P2021') return true;
  if (e.code === 'P2010' && typeof e.message === 'string') {
    return e.message.includes('UsageQuotaAlertLog') || e.message.includes('usageQuotaAlertsEnabled');
  }
  return false;
}

/** Fire after a new ApiUsageEvent has been stored (counts include the latest call). */
export async function evaluateQuotaUsageAlerts(userId: string): Promise<void> {
  try {
    await runQuotaUsageAlerts(userId);
  } catch (e) {
    if (missingUsageAlertSchema(e)) {
      console.warn('[usage-alerts] DB column/table missing; run `npx prisma migrate deploy`. Skipping alert.');
      return;
    }
    throw e;
  }
}

async function runQuotaUsageAlerts(userId: string): Promise<void> {
  const { periodKey } = getUtcBillingMonth();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      usageQuotaAlertsEnabled: true,
      usageAlertAt75: true,
      usageAlertAt85: true,
      usageAlertAt95: true,
    },
  });
  if (!user?.usageQuotaAlertsEnabled) return;

  const ent = await getEntitlement(userId);
  if (!ent || ent.status !== 'active' || ent.validUntil <= new Date()) return;

  const plan = getPlan(ent.planSlug);
  const limit = plan?.monthlyApiQuota;
  if (limit == null) return;

  const used = await countMonthlyApiCalls(userId);

  const toggleForPct = (pct: number): boolean => {
    if (pct === 75) return user.usageAlertAt75;
    if (pct === 85) return user.usageAlertAt85;
    if (pct === 95) return user.usageAlertAt95;
    return false;
  };

  for (const pct of THRESHOLDS) {
    if (!toggleForPct(pct)) continue;
    const triggerAt = Math.ceil((limit * pct) / 100);
    if (used < triggerAt) continue;

    try {
      await prisma.usageQuotaAlertLog.create({
        data: {
          userId,
          periodKey,
          threshold: pct,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        continue;
      }
      throw e;
    }

    const appLabel = PRODUCT_NAME;
    const subject = `${appLabel}: ${pct}% of monthly API quota used (${periodKey} UTC)`;
    const text = [
      `Hi${user.name ? ` ${user.name}` : ''},`,
      ``,
      `Your integration API usage for ${periodKey} (UTC) has reached ${pct}% of the "${plan?.name ?? ent.planSlug}" plan limit.`,
      ``,
      `Usage: ${used.toLocaleString()} / ${limit.toLocaleString()} calls`,
      ``,
      `Upgrade your plan or wait until the next UTC month for quota reset.`,
      ``,
      `You can turn off these alerts under Dashboard → Account.`,
      ``,
      `— ${appLabel}`,
    ].join('\n');

    const html = `
<p>Hi${user.name ? ` ${escapeHtml(user.name)}` : ''},</p>
<p>Your integration API usage for <strong>${escapeHtml(periodKey)}</strong> (UTC) has reached
<strong>${pct}%</strong> of the <strong>${escapeHtml(plan?.name ?? ent.planSlug)}</strong> plan limit.</p>
<p>Usage: <strong>${used.toLocaleString()}</strong> / <strong>${limit.toLocaleString()}</strong> calls</p>
<p>Upgrade on the pricing page or wait until the next UTC month for a quota reset.</p>
<p style="color:#64748b;font-size:13px">Manage alerts under Dashboard → Account.</p>`;

    try {
      await sendTransactionalEmail({
        to: user.email,
        subject,
        text,
        html,
      });
    } catch (err) {
      console.error('[usage-alerts] email send failed', err);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
