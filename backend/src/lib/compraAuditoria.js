import { randomUUID } from 'crypto';

/**
 * Deduce un tipo canónico a partir del formato legacy de ActivityLog.
 * @param {{ entity: string, action: string, details?: unknown }} log
 */
export function tipoCanonicoDesdeLegacyLog(log) {
  const entity = String(log.entity || '');
  const action = String(log.action || '');
  const det = log.details && typeof log.details === 'object' ? log.details : null;

  if (entity === 'compra' && action === 'crear') return 'compra.creada';
  if (entity === 'recepcion') {
    if (det?.preciosVenta) return 'recepcion.precios_venta';
    if (action === 'crear') return 'recepcion.creada';
    if (action === 'actualizar') return 'recepcion.actualizada';
    return `recepcion.${action || 'evento'}`;
  }
  if (entity === 'info-final-uxb') return 'info_final.uxb';
  return `${entity || 'desconocido'}.${action || 'evento'}`;
}

/**
 * Insert idempotente en CompraAuditoriaEvento (dedupe por dedupeKey; opcionalmente por activityLogId único).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   compraId: string,
 *   recepcionId?: string | null,
 *   userId?: string | null,
 *   occurredAt: Date,
 *   tipo: string,
 *   accion: string,
 *   confianza?: 'alta' | 'media' | 'baja',
 *   fuente?: 'online' | 'backfill',
 *   dedupeKey: string,
 *   payload?: object | null,
 *   activityLogId?: string | null,
 * }} input
 */
export async function appendCompraAuditoriaEvento(prisma, input) {
  const id = randomUUID();
  const compraId = String(input.compraId || '').trim();
  if (!compraId) return { ok: false, reason: 'sin_compraId' };

  const recepcionId = input.recepcionId ? String(input.recepcionId) : null;
  const userId = input.userId ? String(input.userId) : null;
  const occurredAt = input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt);
  const tipo = String(input.tipo || '').trim() || 'desconocido.evento';
  const accion = String(input.accion || '').trim() || 'evento';
  const confianza = input.confianza || 'alta';
  const fuente = input.fuente || 'online';
  const dedupeKey = String(input.dedupeKey || '').trim();
  if (!dedupeKey) return { ok: false, reason: 'sin_dedupeKey' };

  const payloadJson = input.payload != null ? JSON.stringify(input.payload) : null;
  const activityLogId = input.activityLogId ? String(input.activityLogId) : null;

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CompraAuditoriaEvento"
        (id, "compraId", "recepcionId", "userId", "occurredAt", tipo, accion, confianza, fuente, "dedupeKey", payload, "activityLogId", "createdAt")
       VALUES ($1::text, $2::text, $3::text, $4::text, $5::timestamp, $6::text, $7::text, $8::text, $9::text, $10::text, $11::jsonb, $12::text, NOW())
       ON CONFLICT ("dedupeKey") DO NOTHING`,
      id,
      compraId,
      recepcionId,
      userId,
      occurredAt,
      tipo,
      accion,
      confianza,
      fuente,
      dedupeKey,
      payloadJson,
      activityLogId,
    );
    return { ok: true };
  } catch (e) {
    console.error('[CompraAuditoria] Error al insertar evento:', e?.message || e);
    return { ok: false, reason: 'error' };
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   activityLogId: string | null,
 *   userId: string | null,
 *   occurredAt: Date,
 *   entity: string,
 *   action: string,
 *   entityId: string | null,
 *   details: unknown,
 *   compraId: string,
 *   recepcionId?: string | null,
 *   fuente?: 'online' | 'backfill',
 *   confianza?: 'alta' | 'media' | 'baja',
 * }} args
 */
export async function appendCompraAuditoriaDesdeActivityLog(prisma, args) {
  const activityLogId = args.activityLogId ? String(args.activityLogId) : null;
  const compraId = String(args.compraId || '').trim();
  if (!compraId) return;
  if (!activityLogId) return;

  const tipo = tipoCanonicoDesdeLegacyLog({
    entity: args.entity,
    action: args.action,
    details: args.details,
  });

  const dedupeKey = `activitylog:${activityLogId}:compra:${compraId}`;

  await appendCompraAuditoriaEvento(prisma, {
    compraId,
    recepcionId: args.recepcionId ?? null,
    userId: args.userId,
    occurredAt: args.occurredAt,
    tipo,
    accion: String(args.action || ''),
    confianza: args.confianza || 'alta',
    fuente: args.fuente || 'online',
    dedupeKey,
    payload: {
      legacy: {
        entity: args.entity,
        action: args.action,
        entityId: args.entityId,
        details: args.details ?? null,
      },
    },
    activityLogId,
  });
}
