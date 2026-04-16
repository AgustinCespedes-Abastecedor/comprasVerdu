-- Eventos normalizados de auditoría por compra (reconstruibles y deduplicables)

CREATE TABLE "CompraAuditoriaEvento" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "recepcionId" TEXT,
    "userId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "confianza" TEXT NOT NULL DEFAULT 'alta',
    "fuente" TEXT NOT NULL DEFAULT 'online',
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB,
    "activityLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompraAuditoriaEvento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompraAuditoriaEvento_dedupeKey_key" ON "CompraAuditoriaEvento"("dedupeKey");
CREATE UNIQUE INDEX "CompraAuditoriaEvento_activityLogId_key" ON "CompraAuditoriaEvento"("activityLogId");

CREATE INDEX "CompraAuditoriaEvento_compraId_occurredAt_idx" ON "CompraAuditoriaEvento"("compraId", "occurredAt");
CREATE INDEX "CompraAuditoriaEvento_recepcionId_idx" ON "CompraAuditoriaEvento"("recepcionId");
CREATE INDEX "CompraAuditoriaEvento_userId_idx" ON "CompraAuditoriaEvento"("userId");

ALTER TABLE "CompraAuditoriaEvento"
  ADD CONSTRAINT "CompraAuditoriaEvento_compraId_fkey"
  FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompraAuditoriaEvento"
  ADD CONSTRAINT "CompraAuditoriaEvento_recepcionId_fkey"
  FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompraAuditoriaEvento"
  ADD CONSTRAINT "CompraAuditoriaEvento_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
