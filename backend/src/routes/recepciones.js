import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloRecepcion, soloVerRecepciones } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';
import { appendCompraAuditoriaDesdeActivityLog } from '../lib/compraAuditoria.js';
import { parseYmdToPrismaDateOnly, logWarnIfInvalidYmdQuery } from '../lib/dateOnly.js';
import {
  notifyAllActiveUsers,
  tituloRecepcionCompraProveedorBultos,
  formatMontoNotificacion,
} from '../lib/notifications.js';
import { parseOffsetPagination, wantsPagedEnvelope } from '../lib/listPagination.js';
import { RECEPCIONES_LIST_ORDER_BY } from '../lib/compraRecepcionListOrder.js';
import { costoPorUnidadDesdeBulto, recepcionUxBBrutoInvalidoVsCajon } from '../lib/uxbCosto.js';

const router = Router();

/** GET /recepciones - Listar recepciones. Requiere permiso ver-recepciones. */
router.get('/', soloVerRecepciones, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    logWarnIfInvalidYmdQuery('GET /recepciones', 'desde', desde);
    logWarnIfInvalidYmdQuery('GET /recepciones', 'hasta', hasta);
    const where = {};
    if (desde || hasta) {
      where.compra = {};
      if (desde) {
        const d = parseYmdToPrismaDateOnly(desde);
        if (d) where.compra.fecha = { ...where.compra.fecha, gte: d };
      }
      if (hasta) {
        const d = parseYmdToPrismaDateOnly(hasta);
        if (d) where.compra.fecha = { ...where.compra.fecha, lte: d };
      }
    }
    const include = {
      compra: {
        select: {
          id: true,
          numeroCompra: true,
          fecha: true,
          createdAt: true,
          proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
        },
      },
      user: { select: { id: true, nombre: true } },
      detalles: {
        include: {
          detalleCompra: {
            include: {
              producto: {
                select: {
                  id: true,
                  codigo: true,
                  descripcion: true,
                },
              },
            },
          },
        },
      },
    };
    const orderBy = RECEPCIONES_LIST_ORDER_BY;

    if (wantsPagedEnvelope(req.query)) {
      const { page, pageSize, skip } = parseOffsetPagination(req.query);
      const [total, items] = await Promise.all([
        prisma.recepcion.count({ where }),
        prisma.recepcion.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include,
        }),
      ]);
      return res.json({ items, total, page, pageSize });
    }

    const recepciones = await prisma.recepcion.findMany({
      where,
      orderBy,
      include,
    });
    res.json(recepciones);
  } catch (e) {
    sendError(res, 500, MSG.RECEP_LISTAR, 'RECEP_001', e);
  }
});

/**
 * POST /recepciones - Crear o actualizar recepción de una compra. Requiere permiso recepcion.
 * Nota: esta operación no actualiza inventario en ningún sistema. La conciliación recepción–stock
 * se realiza por otro canal (ver docs/RECEPCION_Y_STOCK.md).
 */
router.post('/', soloRecepcion, async (req, res) => {
  try {
    const { compraId, detalles } = req.body;
    if (!compraId) {
      return sendError(res, 400, MSG.RECEP_FALTA_COMPRA_ID, 'RECEP_002');
    }
    if (!Array.isArray(detalles)) {
      return sendError(res, 400, MSG.RECEP_DETALLES_ARRAY, 'RECEP_003');
    }

    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
      include: {
        proveedor: { select: { nombre: true } },
        detalles: { include: { producto: { select: { descripcion: true, codigo: true } } } },
      },
    });
    if (!compra) {
      return sendError(res, 404, MSG.RECEP_COMPRA_NO_ENCONTRADA, 'RECEP_004');
    }

    const detalleIds = new Set(compra.detalles.map((d) => d.id));
    const payload = detalles
      .filter((d) => d.detalleCompraId && detalleIds.has(d.detalleCompraId))
      .map((d) => ({
        detalleCompraId: d.detalleCompraId,
        cantidad: Math.max(0, Number(d.cantidad) || 0),
        uxb: Math.max(0, Number(d.uxb) || 0),
      }));

    for (const p of payload) {
      if (p.uxb <= 0) continue;
      const dc = compra.detalles.find((d) => d.id === p.detalleCompraId);
      const pesoCajon = dc?.pesoCajon != null ? Number(dc.pesoCajon) : 0;
      if (recepcionUxBBrutoInvalidoVsCajon(p.uxb, pesoCajon)) {
        return sendError(res, 400, MSG.RECEP_UXB_NO_CUBRE_CAJON, 'RECEP_009');
      }
    }

    let wasNew = false;
    const recepcion = await prisma.$transaction(async (tx) => {
      let rec = await tx.recepcion.findUnique({ where: { compraId } });
      if (rec) {
        await tx.detalleRecepcion.deleteMany({ where: { recepcionId: rec.id } });
      } else {
        wasNew = true;
        const { _max } = await tx.recepcion.aggregate({ _max: { numeroRecepcion: true } });
        const numeroRecepcion = (Number(_max?.numeroRecepcion) || 0) + 1;
        rec = await tx.recepcion.create({
          data: { compraId, userId: req.userId, numeroRecepcion },
        });
      }
      if (payload.length > 0) {
        await tx.detalleRecepcion.createMany({
          data: payload.map((p) => ({
            recepcionId: rec.id,
            detalleCompraId: p.detalleCompraId,
            cantidad: p.cantidad,
            uxb: p.uxb ?? 0,
          })),
        });
      }
      // Actualizar recepción para que updatedAt refleje el último guardado (Info Final agrupa por updatedAt).
      await tx.recepcion.update({
        where: { id: rec.id },
        data: { updatedAt: new Date() },
      });
      return tx.recepcion.findUnique({
        where: { id: rec.id },
        include: {
          detalles: true,
          user: { select: { id: true, nombre: true } },
          compra: {
            select: {
              id: true,
              numeroCompra: true,
              fecha: true,
              totalBultos: true,
              proveedor: { select: { nombre: true } },
            },
          },
        },
      });
    });

    if (req.userId) {
      const itemsRecepcion = payload.map((p) => {
        const dc = compra.detalles.find((d) => d.id === p.detalleCompraId);
        return {
          articulo: dc?.producto?.descripcion ?? dc?.producto?.codigo ?? '—',
          codigo: dc?.producto?.codigo ?? '—',
          cantidad: p.cantidad,
          uxb: p.uxb,
        };
      });
      const logDetails = {
        compraId: recepcion.compra?.id,
        numeroCompra: recepcion.compra?.numeroCompra,
        numeroRecepcion: recepcion.numeroRecepcion,
        items: itemsRecepcion,
      };
      const activityLogId = await createLog(prisma, {
        userId: req.userId,
        action: wasNew ? 'crear' : 'actualizar',
        entity: 'recepcion',
        entityId: recepcion.id,
        details: logDetails,
      });
      if (activityLogId && recepcion.compra?.id) {
        try {
          await appendCompraAuditoriaDesdeActivityLog(prisma, {
            activityLogId,
            userId: req.userId,
            occurredAt: new Date(),
            entity: 'recepcion',
            action: wasNew ? 'crear' : 'actualizar',
            entityId: recepcion.id,
            details: logDetails,
            compraId: recepcion.compra.id,
            recepcionId: recepcion.id,
            fuente: 'online',
            confianza: 'alta',
          });
        } catch (e) {
          console.error('[RECEP] Auditoría canónica (no bloquea):', e?.message || e);
        }
      }
    }
    if (wasNew && recepcion?.compra?.id) {
      const provNombre = recepcion.compra?.proveedor?.nombre || compra.proveedor?.nombre || 'Proveedor';
      const udsRecibidas = payload.reduce((a, p) => a + (Number(p.cantidad) || 0), 0);
      const recepcionista = (recepcion.user?.nombre || '').trim() || 'Usuario';
      const titulo = tituloRecepcionCompraProveedorBultos({
        numeroRecepcion: recepcion.numeroRecepcion,
        numeroCompra: recepcion.compra?.numeroCompra,
        proveedorNombre: provNombre,
        totalBultos: Number(recepcion.compra?.totalBultos) || Number(compra.totalBultos) || 0,
      });
      const mensaje = `Recepcionista: ${recepcionista} · Líneas cargadas: ${payload.length} · Uds. recepción: ${udsRecibidas}.`;
      void notifyAllActiveUsers(prisma, {
        type: 'recepcion_registrada',
        title: titulo,
        message: mensaje,
        compraId: recepcion.compra.id,
        recepcionId: recepcion.id,
        actorUserId: req.userId,
      }).catch((err) => console.error('[RECEP] Notificaciones (no bloquea):', err?.message || err));
    }

    res.status(201).json(recepcion);
  } catch (e) {
    sendError(res, 500, MSG.RECEP_GUARDAR, 'RECEP_005', e);
  }
});

/** DECIMAL(5,2) en margenPorc permite valores con valor absoluto < 10^3 (máx 999.99). */
const MARGEN_PORC_MAX = 999.99;
const MARGEN_PORC_MIN = -999.99;

function clampMargenPorc(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  return Math.max(MARGEN_PORC_MIN, Math.min(MARGEN_PORC_MAX, rounded));
}

/**
 * PATCH /recepciones/:id - Actualizar precio de venta (y margen) por detalle. Requiere permiso recepcion.
 * Body: { detalles: [{ id: detalleRecepcionId, precioVenta }] }.
 * Nota: solo registro interno; la carga de precios al sistema de ventas es manual u otro sistema (docs/PRECIOS_Y_VENTAS.md).
 */
router.patch('/:id', soloRecepcion, async (req, res) => {
  try {
    const recepcionId = req.params.id;
    const { detalles: detallesBody } = req.body;
    if (!Array.isArray(detallesBody) || detallesBody.length === 0) {
      return sendError(res, 400, MSG.RECEP_DETALLES_MINIMO, 'RECEP_006');
    }

    const recepcion = await prisma.recepcion.findUnique({
      where: { id: recepcionId },
      include: {
        compra: { select: { id: true, numeroCompra: true } },
        detalles: {
          include: {
            detalleCompra: { select: { id: true, precioPorBulto: true, pesoCajon: true } },
          },
        },
      },
    });
    if (!recepcion) {
      return sendError(res, 404, MSG.RECEP_NO_ENCONTRADA, 'RECEP_007');
    }
    const yaEstabaCompleta = recepcion.completa === true;

    const byId = new Map(recepcion.detalles.map((d) => [d.id, d]));
    const payloads = [];
    for (const item of detallesBody) {
      const detRec = byId.get(item.id);
      if (!detRec) continue;
      const precioVenta = Number(item.precioVenta);
      if (!Number.isFinite(precioVenta) || precioVenta < 0) continue;
      const uxb = Number(detRec.uxb) || 0;
      const rawPrecioPorBulto = detRec.detalleCompra?.precioPorBulto;
      const precioPorBulto = rawPrecioPorBulto != null ? Number(rawPrecioPorBulto) : 0;
      const pesoCajon = detRec.detalleCompra?.pesoCajon != null ? Number(detRec.detalleCompra.pesoCajon) : 0;
      const costo = costoPorUnidadDesdeBulto(precioPorBulto, uxb, pesoCajon);
      let margenPorc = null;
      if (costo > 0 && Number.isFinite(precioVenta)) {
        const m = ((precioVenta - costo) / costo) * 100;
        margenPorc = clampMargenPorc(m);
      }
      payloads.push({ id: detRec.id, precioVenta, margenPorc });
    }

    if (payloads.length === 0) {
      return sendError(res, 400, MSG.RECEP_NINGUN_DETALLE_VALIDO, 'RECEP_006B');
    }

    await prisma.$transaction(async (tx) => {
      for (const p of payloads) {
        const precioVentaVal = Math.round(p.precioVenta * 100) / 100;
        const margenPorcVal = clampMargenPorc(p.margenPorc);
        const data = {
          precioVenta: String(precioVentaVal),
          margenPorc: margenPorcVal != null ? String(margenPorcVal) : null,
        };
        await tx.detalleRecepcion.update({
          where: { id: p.id },
          data,
        });
      }
      await tx.recepcion.update({
        where: { id: recepcionId },
        data: { completa: true },
      });
    });

    const updated = await prisma.recepcion.findUnique({
      where: { id: recepcionId },
      include: {
        compra: {
          select: {
            id: true,
            numeroCompra: true,
            fecha: true,
            totalBultos: true,
            totalMonto: true,
            proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
          },
        },
        user: { select: { id: true, nombre: true } },
        detalles: {
          include: {
            detalleCompra: {
              include: {
                producto: { select: { id: true, codigo: true, descripcion: true } },
              },
            },
          },
        },
      },
    });
    if (!yaEstabaCompleta && updated?.completa && updated?.compra?.id) {
      const provNombre = updated.compra?.proveedor?.nombre || 'Proveedor';
      const cerrador = (updated.user?.nombre || '').trim() || 'Usuario';
      const titulo = tituloRecepcionCompraProveedorBultos({
        numeroRecepcion: updated.numeroRecepcion,
        numeroCompra: updated.compra?.numeroCompra,
        proveedorNombre: provNombre,
        totalBultos: Number(updated.compra?.totalBultos) || 0,
      });
      const montoStr = formatMontoNotificacion(updated.compra?.totalMonto);
      const lineasPrecio = (updated.detalles || []).filter(
        (d) => d.precioVenta != null && String(d.precioVenta).trim() !== ''
      ).length;
      const mensaje = `Cierre por: ${cerrador} · Total compra $ ${montoStr} · Precios cargados en ${lineasPrecio} líneas · Proceso cerrado.`;
      void notifyAllActiveUsers(prisma, {
        type: 'recepcion_completada',
        title: titulo,
        message: mensaje,
        compraId: updated.compra.id,
        recepcionId: recepcionId,
        actorUserId: req.userId,
      }).catch((err) => console.error('[RECEP_008] Notificaciones (no bloquea):', err?.message || err));
    }

    if (req.userId) {
      try {
        const items = (updated?.detalles || []).map((d) => ({
          articulo: d.detalleCompra?.producto?.descripcion ?? '—',
          codigo: d.detalleCompra?.producto?.codigo ?? '—',
          precioVenta: d.precioVenta != null ? Number(d.precioVenta) : null,
          margenPorc: d.margenPorc != null ? Number(d.margenPorc) : null,
        }));
        const logDetails = {
          compraId: updated?.compra?.id,
          numeroCompra: updated?.compra?.numeroCompra,
          numeroRecepcion: updated?.numeroRecepcion,
          preciosVenta: true,
          items,
        };
        const activityLogId = await createLog(prisma, {
          userId: req.userId,
          action: 'actualizar',
          entity: 'recepcion',
          entityId: recepcionId,
          details: logDetails,
        });
        if (activityLogId && updated?.compra?.id) {
          try {
            await appendCompraAuditoriaDesdeActivityLog(prisma, {
              activityLogId,
              userId: req.userId,
              occurredAt: new Date(),
              entity: 'recepcion',
              action: 'actualizar',
              entityId: recepcionId,
              details: logDetails,
              compraId: updated.compra.id,
              recepcionId: recepcionId,
              fuente: 'online',
              confianza: 'alta',
            });
          } catch (audErr) {
            console.error('[RECEP_008] Auditoría canónica (no bloquea):', audErr?.message ?? audErr);
          }
        }
      } catch (logErr) {
        console.error('[RECEP_008] Error al escribir log (no bloquea respuesta):', logErr?.message ?? logErr);
      }
    }
    res.json(updated);
  } catch (e) {
    console.error('[RECEP_008] PATCH precios falló:', e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    sendError(res, 500, MSG.RECEP_ACTUALIZAR_PRECIOS, 'RECEP_008', e);
  }
});

export const recepcionesRouter = router;
