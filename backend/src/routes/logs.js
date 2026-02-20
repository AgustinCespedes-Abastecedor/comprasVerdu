import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloGestionUsuarios } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Inicio y fin del día en UTC para una fecha YYYY-MM-DD */
function dayBounds(dateStr) {
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T23:59:59.999Z');
  return { start, end };
}

/** GET /logs - Listar historial de actividad paginado (solo quien tiene gestión de usuarios).
 *  Query: userId?, entity?, desde?, hasta?, page?, pageSize?
 *  - Sin filtros de fecha ni usuario: por defecto solo registros del día actual (UTC).
 *  - Con userId: historial completo de ese usuario (sin acotar por fecha salvo que se envíe desde/hasta).
 *  Respuesta: { items, total, page, pageSize }
 */
router.get('/', soloGestionUsuarios, async (req, res) => {
  try {
    const { userId, entity, desde, hasta, page: pageParam, pageSize: pageSizeParam } = req.query;

    const hasUserFilter = userId && typeof userId === 'string' && userId.trim();
    const hasDateFilter = (desde && String(desde).trim()) || (hasta && String(hasta).trim());

    let desdeDate = desde && String(desde).trim() ? new Date(desde) : null;
    let hastaDate = hasta && String(hasta).trim() ? null : null;
    if (hasta && String(hasta).trim()) {
      hastaDate = new Date(hasta);
      hastaDate.setUTCHours(23, 59, 59, 999);
    }

    // Por defecto: solo día actual si no hay filtro de usuario ni de fecha
    if (!hasUserFilter && !hasDateFilter) {
      const today = new Date().toISOString().slice(0, 10);
      const { start, end } = dayBounds(today);
      desdeDate = start;
      hastaDate = end;
    } else if (!hasDateFilter && hasUserFilter) {
      // Filtro por usuario sin fechas: historial completo del usuario (desde/hasta no se aplican)
      desdeDate = null;
      hastaDate = null;
    }

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeParam, 10) || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const countParams = [];
    const selectParams = [];
    let paramIndex = 1;

    function addParam(value) {
      const idx = paramIndex++;
      countParams.push(value);
      selectParams.push(value);
      return idx;
    }

    if (hasUserFilter) {
      conditions.push(`al."userId" = $${paramIndex}`);
      addParam(userId.trim());
    }
    if (entity && typeof entity === 'string' && entity.trim()) {
      conditions.push(`al."entity" = $${paramIndex}`);
      addParam(entity.trim());
    }
    if (desdeDate) {
      conditions.push(`al."createdAt" >= $${paramIndex}`);
      addParam(desdeDate);
    }
    if (hastaDate) {
      conditions.push(`al."createdAt" <= $${paramIndex}`);
      addParam(hastaDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM "ActivityLog" al ${whereClause}`,
      ...countParams
    );

    selectParams.push(pageSize, offset);
    const logsQuery = prisma.$queryRawUnsafe(
      `SELECT al.id, al."userId", al.action, al.entity, al."entityId", al.details, al."createdAt",
              u.nombre AS "userName", u.email AS "userEmail"
       FROM "ActivityLog" al
       LEFT JOIN "User" u ON u.id = al."userId"
       ${whereClause}
       ORDER BY al."createdAt" DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...selectParams
    );

    const [countResult, logs] = await Promise.all([countQuery, logsQuery]);
    const total = (Array.isArray(countResult) && countResult[0]?.total != null) ? Number(countResult[0].total) : 0;

    const items = (Array.isArray(logs) ? logs : []).map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName ?? '',
      userEmail: log.userEmail ?? '',
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details,
      createdAt: log.createdAt,
    }));

    res.json({ items, total, page, pageSize });
  } catch (e) {
    console.error('[GET /api/logs]', e?.message || e);
    sendError(res, 500, MSG.LOGS_LISTAR, 'LOGS_001', e);
  }
});

export const logsRouter = router;
