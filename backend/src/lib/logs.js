/**
 * Registro de actividad para historial de logs.
 * Usa SQL directo para no depender del cliente Prisma generado (evita fallos silenciosos si prisma generate falló).
 */

import { randomUUID } from 'crypto';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ userId: string, action: string, entity: string, entityId?: string | null, details?: object | null }} data
 */
export async function createLog(prisma, { userId, action, entity, entityId = null, details = null }) {
  try {
    const id = randomUUID();
    const detailsJson = details != null ? JSON.stringify(details) : null;
    const entityIdVal = entityId ?? null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ActivityLog" (id, "userId", action, entity, "entityId", details, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      id,
      userId,
      action,
      entity,
      entityIdVal,
      detailsJson
    );
  } catch (e) {
    console.error('[ActivityLog] Error al guardar log:', e?.message || e);
  }
}
