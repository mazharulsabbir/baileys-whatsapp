-- CreateTable
CREATE TABLE "OdooGatewayCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectorUuid" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL DEFAULT '',
    "odooWebhookUrl" TEXT,
    "configSetInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdooGatewayCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OdooGatewayCredential_userId_key" ON "OdooGatewayCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OdooGatewayCredential_connectorUuid_key" ON "OdooGatewayCredential"("connectorUuid");

-- CreateIndex
CREATE INDEX "OdooGatewayCredential_userId_idx" ON "OdooGatewayCredential"("userId");

-- AddForeignKey
ALTER TABLE "OdooGatewayCredential" ADD CONSTRAINT "OdooGatewayCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
