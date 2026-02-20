import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloRecepcion, soloVerRecepciones } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';

const router = Router();

/** GET /recepciones - Listar recepciones. Requiere permiso ver-recepciones. */
router.get('/', soloVerRecepciones, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const where = {};
    if (desde || hasta) {
      where.compra = {};
      if (desde) where.compra.fecha = { ...where.compra.fecha, gte: new Date(desde) };
      if (hasta) where.compra.fecha = { ...where.compra.fecha, lte: new Date(hasta) };
    }
    const recepciones = await prisma.recepcion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        compra: {
          select: {
            id: true,
            numeroCompra: true,
            fecha: true,
            proveedor: { select: { id: true, nombre: true } },
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
      },
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
      return tx.recepcion.findUnique({
        where: { id: rec.id },
        include: {
          detalles: true,
          user: { select: { id: true, nombre: true } },
          compra: { select: { id: true, numeroCompra: true, fecha: true } },
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
      await createLog(prisma, {
        userId: req.userId,
        action: wasNew ? 'crear' : 'actualizar',
        entity: 'recepcion',
        entityId: recepcion.id,
        details: {
          compraId: recepcion.compra?.id,
          numeroCompra: recepcion.compra?.numeroCompra,
          numeroRecepcion: recepcion.numeroRecepcion,
          items: itemsRecepcion,
        },
      });
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
        detalles: {
          include: {
            detalleCompra: { select: { id: true, precioPorBulto: true } },
          },
        },
      },
    });
    if (!recepcion) {
      return sendError(res, 404, MSG.RECEP_NO_ENCONTRADA, 'RECEP_007');
    }

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
      const costo = uxb > 0 && precioPorBulto > 0 ? precioPorBulto / uxb : 0;
      let margenPorc = null;
      if (costo > 0 && Number.isFinite(precioVenta)) {
        const m = ((precioVenta - costo) / costo) * 100;
        margenPorc = clampMargenPorc(m);
      }
      payloads.push({ id: detRec.id, precioVenta, margenPorc });
    }

    if (payloads.length === 0) {
      return sendError(res, 400, 'Ningún detalle válido con precio de venta', 'RECEP_006B');
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
            proveedor: { select: { id: true, nombre: true } },
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
    if (req.userId) {
      try {
        const items = (updated?.detalles || []).map((d) => ({
          articulo: d.detalleCompra?.producto?.descripcion ?? '—',
          codigo: d.detalleCompra?.producto?.codigo ?? '—',
          precioVenta: d.precioVenta != null ? Number(d.precioVenta) : null,
          margenPorc: d.margenPorc != null ? Number(d.margenPorc) : null,
        }));
        await createLog(prisma, {
          userId: req.userId,
          action: 'actualizar',
          entity: 'recepcion',
          entityId: recepcionId,
          details: {
            numeroCompra: updated?.compra?.numeroCompra,
            numeroRecepcion: updated?.numeroRecepcion,
            preciosVenta: true,
            items,
          },
        });
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
