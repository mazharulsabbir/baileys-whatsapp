-- AlterTable
ALTER TABLE "User" ADD COLUMN "usageQuotaAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "usageAlertAt75" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "usageAlertAt85" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "usageAlertAt95" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UsageQuotaAlertLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageQuotaAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageQuotaAlertLog_userId_periodKey_threshold_key" ON "UsageQuotaAlertLog"("userId", "periodKey", "threshold");

-- CreateIndex
CREATE INDEX "UsageQuotaAlertLog_userId_idx" ON "UsageQuotaAlertLog"("userId");

-- AddForeignKey
ALTER TABLE "UsageQuotaAlertLog" ADD CONSTRAINT "UsageQuotaAlertLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
