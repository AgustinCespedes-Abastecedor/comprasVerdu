import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendError, MSG } from '../lib/errors.js';
import { parseYmdToPrismaDateOnly, logWarnIfInvalidYmdQuery } from '../lib/dateOnly.js';
import { parseOffsetPagination, wantsPagedEnvelope } from '../lib/listPagination.js';
import { COMPRAS_LIST_ORDER_BY } from '../lib/compraRecepcionListOrder.js';

const router = Router();

export const trazabilidadRouter = router;

function tienePermiso(permisos, codigo) {
  return Array.isArray(permisos) && permisos.includes(codigo);
}

function auditoriaRowToEventoUi(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
  const legacy = payload?.legacy && typeof payload.legacy === 'object' ? payload.legacy : null;
  const legacyDet = legacy?.details && typeof legacy.details === 'object' ? legacy.details : null;

  const tipo = String(row.tipo || '');
  const accionLegacy = String(legacy?.action || row.accion || '');

  /** @type {{ entity: string, action: string, entityId: string | null, details: any }} */
  let mapped = { entity: 'auditoria', action: accionLegacy || 'evento', entityId: null, details: payload ?? null };

  if (legacy?.entity) {
    mapped = {
      entity: String(legacy.entity),
      action: String(legacy.action || row.accion || 'evento'),
      entityId: legacy.entityId != null ? String(legacy.entityId) : null,
      details: legacyDet ?? null,
    };
  } else if (tipo === 'info_final.uxb') {
    mapped = {
      entity: 'info-final-uxb',
      action: 'actualizar',
      entityId: null,
      details: {
        fecha: payload?.fecha,
        codigo: payload?.codigo,
        articulo: payload?.articulo,
        uxb: payload?.uxb,
        recepcionIds: payload?.recepcionIds,
        compraIds: payload?.compraIds,
      },
    };
  }

  return {
    id: String(row.id),
    createdAt: row.occurredAt,
    action: mapped.action,
    entity: mapped.entity,
    entityId: mapped.entityId,
    details: mapped.details,
    userId: row.userId,
    userName: row.userName ?? '',
    userEmail: row.userEmail ?? '',
    auditoria: {
      tipo,
      fuente: String(row.fuente || ''),
      confianza: String(row.confianza || ''),
      activityLogId: row.activityLogId ?? null,
    },
  };
}

const compraTrazSelect = {
  id: true,
  numeroCompra: true,
  fecha: true,
  totalBultos: true,
  totalMonto: true,
  createdAt: true,
  updatedAt: true,
  proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
  user: { select: { id: true, nombre: true, email: true } },
  recepcion: { select: { id: true, numeroRecepcion: true, createdAt: true, updatedAt: true, completa: true, userId: true } },
};

/** Enriquece compras con eventos de auditoría + ActivityLog (misma página de resultados). */
async function buildTrazabilidadComprasRows(compras) {
  if (compras.length === 0) return [];

    const compraIds = compras.map((c) => c.id);
    const recepcionIds = compras.map((c) => c.recepcion?.id).filter(Boolean);

    const audParams = [];
    const audPh = (ids) => {
      const out = [];
      for (const id of ids) {
        audParams.push(id);
        out.push(`$${audParams.length}`);
      }
      return out.join(', ');
    };

    const auditoriaRows = compraIds.length
      ? await prisma.$queryRawUnsafe(
          `SELECT ae.id, ae."compraId", ae."recepcionId", ae."userId", ae."occurredAt", ae.tipo, ae.accion,
                  ae.confianza, ae.fuente, ae."activityLogId", ae.payload,
                  u.nombre AS "userName", u.email AS "userEmail"
           FROM "CompraAuditoriaEvento" ae
           LEFT JOIN "User" u ON u.id = ae."userId"
           WHERE ae."compraId" IN (${audPh(compraIds)})
           ORDER BY ae."occurredAt" ASC`,
          ...audParams,
        )
      : [];

    const auditoriaByCompra = new Map();
    compras.forEach((c) => auditoriaByCompra.set(c.id, []));
    for (const row of Array.isArray(auditoriaRows) ? auditoriaRows : []) {
      const cid = row.compraId ? String(row.compraId) : '';
      if (!cid || !auditoriaByCompra.has(cid)) continue;
      auditoriaByCompra.get(cid).push(auditoriaRowToEventoUi(row));
    }

    const excludeActivityLogIds = Array.from(
      new Set(
        (Array.isArray(auditoriaRows) ? auditoriaRows : [])
          .map((r) => r.activityLogId)
          .filter(Boolean)
          .map((x) => String(x)),
      ),
    );

    const params = [];
    const parts = [];

    const placeholders = (ids) => {
      const out = [];
      for (const id of ids) {
        params.push(id);
        out.push(`$${params.length}`);
      }
      return out.join(', ');
    };

    // Logs directos de compra (entityId = compraId)
    parts.push(`(al."entity" = 'compra' AND al."entityId" IN (${placeholders(compraIds)}))`);

    // Logs de recepción asociados por entityId = recepcionId
    if (recepcionIds.length > 0) {
      parts.push(`(al."entity" = 'recepcion' AND al."entityId" IN (${placeholders(recepcionIds)}))`);
    }

    // Logs de recepción cuyo JSON trae compraId (compatibilidad)
    parts.push(`(al."entity" = 'recepcion' AND (al.details->>'compraId') IN (${placeholders(compraIds)}))`);

    // UXB desde Info Final: details.compraIds contiene afectados (nuevo formato)
    parts.push(`(al."entity" = 'info-final-uxb' AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(al.details->'compraIds','[]'::jsonb)) cid
      WHERE cid IN (${placeholders(compraIds)})
    ))`);

    let whereSql = `(${parts.join(' OR ')})`;
    if (excludeActivityLogIds.length > 0) {
      const exParts = [];
      for (const id of excludeActivityLogIds) {
        params.push(id);
        exParts.push(`$${params.length}`);
      }
      whereSql = `(${whereSql}) AND al.id NOT IN (${exParts.join(', ')})`;
    }

    const logs = await prisma.$queryRawUnsafe(
      `SELECT al.id, al."userId", al.action, al.entity, al."entityId", al.details, al."createdAt",
              u.nombre AS "userName", u.email AS "userEmail"
       FROM "ActivityLog" al
       LEFT JOIN "User" u ON u.id = al."userId"
       WHERE ${whereSql}
       ORDER BY al."createdAt" ASC`,
      ...params
    );

    const byCompraId = new Map();
    const seenByCompraId = new Map();
    compras.forEach((c) => {
      byCompraId.set(c.id, []);
      seenByCompraId.set(c.id, new Set());
    });

    const pushLog = (compraId, row) => {
      if (!compraId || !byCompraId.has(compraId)) return;
      const seen = seenByCompraId.get(compraId);
      if (seen?.has(row.id)) return;
      seen?.add(row.id);
      byCompraId.get(compraId).push(row);
    };

    for (const row of Array.isArray(logs) ? logs : []) {
      if (row.entity === 'compra' && row.entityId) {
        pushLog(row.entityId, row);
        continue;
      }
      if (row.entity === 'recepcion') {
        const det = row.details && typeof row.details === 'object' ? row.details : null;
        const compraIdFromJson = det?.compraId ? String(det.compraId) : '';
        if (compraIdFromJson && byCompraId.has(compraIdFromJson)) {
          pushLog(compraIdFromJson, row);
          continue;
        }
        if (row.entityId && recepcionIds.includes(String(row.entityId))) {
          const compra = compras.find((c) => c.recepcion?.id === row.entityId);
          if (compra) pushLog(compra.id, row);
        }
      }
      if (row.entity === 'info-final-uxb') {
        const det = row.details && typeof row.details === 'object' ? row.details : null;
        const ids = Array.isArray(det?.compraIds) ? det.compraIds.map((x) => String(x)) : [];
        for (const cid of ids) {
          if (byCompraId.has(cid)) pushLog(cid, row);
        }
      }
    }

    const mapLogRow = (e) => ({
      id: e.id,
      createdAt: e.createdAt,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      userId: e.userId,
      userName: e.userName ?? '',
      userEmail: e.userEmail ?? '',
      details: e.details,
      auditoria: null,
    });

    const mergeEventos = (audList, logList) => {
      const out = [];
      const seen = new Set();

      const keyOf = (ev) => {
        if (ev?.auditoria?.activityLogId) return `al:${ev.auditoria.activityLogId}`;
        return `id:${ev.id}`;
      };

      const pushEv = (ev) => {
        const k = keyOf(ev);
        if (seen.has(k)) return;
        seen.add(k);
        out.push(ev);
      };

      for (const ev of audList || []) pushEv(ev);
      for (const ev of logList || []) pushEv(mapLogRow(ev));

      out.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ta !== tb) return tb - ta;
        return String(b.id).localeCompare(String(a.id));
      });
      return out;
    };

    const out = compras.map((c) => ({
      ...c,
      eventos: mergeEventos(auditoriaByCompra.get(c.id) || [], byCompraId.get(c.id) || []),
    }));

    return out;
}

/** GET /trazabilidad/compras - Trazabilidad por compra (logs + usuario). Requiere ver-compras o trazabilidad-compras. */
router.get('/compras', async (req, res) => {
  try {
    if (!tienePermiso(req.permisos, 'ver-compras') && !tienePermiso(req.permisos, 'trazabilidad-compras')) {
      return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'TRAZ_001');
    }

    const { desde, hasta, proveedorId } = req.query;
    logWarnIfInvalidYmdQuery('GET /trazabilidad/compras', 'desde', desde);
    logWarnIfInvalidYmdQuery('GET /trazabilidad/compras', 'hasta', hasta);
    const where = {};
    if (desde) {
      const d = parseYmdToPrismaDateOnly(desde);
      if (d) where.fecha = { ...where.fecha, gte: d };
    }
    if (hasta) {
      const d = parseYmdToPrismaDateOnly(hasta);
      if (d) where.fecha = { ...where.fecha, lte: d };
    }
    if (proveedorId) where.proveedorId = proveedorId;

    if (wantsPagedEnvelope(req.query)) {
      const { page, pageSize, skip } = parseOffsetPagination(req.query);
      const [total, compras] = await Promise.all([
        prisma.compra.count({ where }),
        prisma.compra.findMany({
          where,
          orderBy: COMPRAS_LIST_ORDER_BY,
          skip,
          take: pageSize,
          select: compraTrazSelect,
        }),
      ]);
      const items = await buildTrazabilidadComprasRows(compras);
      return res.json({ items, total, page, pageSize });
    }

    const compras = await prisma.compra.findMany({
      where,
      orderBy: COMPRAS_LIST_ORDER_BY,
      select: compraTrazSelect,
    });

    if (compras.length === 0) {
      return res.json([]);
    }

    const out = await buildTrazabilidadComprasRows(compras);
    res.json(out);
  } catch (e) {
    sendError(res, 500, MSG.TRAZ_COMPRAS_LISTAR, 'TRAZ_002', e);
  }
});
