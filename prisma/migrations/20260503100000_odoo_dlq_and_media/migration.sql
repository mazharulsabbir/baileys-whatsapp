-- CreateTable
CREATE TABLE "OdooWebhookDeadLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdooWebhookDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaMediaArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaMediaArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OdooWebhookDeadLetter_userId_resolvedAt_idx" ON "OdooWebhookDeadLetter"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "OdooWebhookDeadLetter_createdAt_idx" ON "OdooWebhookDeadLetter"("createdAt");

-- CreateIndex
CREATE INDEX "WaMediaArtifact_userId_idx" ON "WaMediaArtifact"("userId");

-- CreateIndex
CREATE INDEX "WaMediaArtifact_expiresAt_idx" ON "WaMediaArtifact"("expiresAt");

-- AddForeignKey
ALTER TABLE "OdooWebhookDeadLetter" ADD CONSTRAINT "OdooWebhookDeadLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
