import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

/** GET /recepciones - Listar recepciones con filtros opcionales (desde, hasta por fecha compra o createdAt) */
router.get('/', async (req, res) => {
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
    console.error('GET /recepciones:', e);
    res.status(500).json({ error: e?.message || 'Error al listar recepciones' });
  }
});

/** POST /recepciones - Crear o actualizar recepción de una compra */
router.post('/', async (req, res) => {
  try {
    const { compraId, detalles } = req.body;
    if (!compraId) {
      return res.status(400).json({ error: 'Falta compraId' });
    }
    if (!Array.isArray(detalles)) {
      return res.status(400).json({ error: 'detalles debe ser un array' });
    }

    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
      include: { detalles: { select: { id: true } } },
    });
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const detalleIds = new Set(compra.detalles.map((d) => d.id));
    const payload = detalles
      .filter((d) => d.detalleCompraId && detalleIds.has(d.detalleCompraId))
      .map((d) => ({
        detalleCompraId: d.detalleCompraId,
        cantidad: Math.max(0, Number(d.cantidad) || 0),
        uxb: Math.max(0, Number(d.uxb) || 0),
      }));

    const recepcion = await prisma.$transaction(async (tx) => {
      let rec = await tx.recepcion.findUnique({ where: { compraId } });
      if (rec) {
        await tx.detalleRecepcion.deleteMany({ where: { recepcionId: rec.id } });
      } else {
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

    res.status(201).json(recepcion);
  } catch (e) {
    console.error('POST /recepciones:', e);
    res.status(500).json({ error: e?.message || 'Error al guardar la recepción' });
  }
});

/** PATCH /recepciones/:id - Actualizar precio de venta (y margen) por detalle. Body: { detalles: [{ id: detalleRecepcionId, precioVenta }] } */
router.patch('/:id', async (req, res) => {
  try {
    const recepcionId = req.params.id;
    const { detalles: detallesBody } = req.body;
    if (!Array.isArray(detallesBody) || detallesBody.length === 0) {
      return res.status(400).json({ error: 'detalles debe ser un array con al menos un ítem' });
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
      return res.status(404).json({ error: 'Recepción no encontrada' });
    }

    const byId = new Map(recepcion.detalles.map((d) => [d.id, d]));
    const updates = [];
    for (const item of detallesBody) {
      const detRec = byId.get(item.id);
      if (!detRec) continue;
      const precioVenta = Number(item.precioVenta);
      if (!Number.isFinite(precioVenta) || precioVenta < 0) continue;
      const uxb = Number(detRec.uxb) || 0;
      const precioPorBulto = Number(detRec.detalleCompra?.precioPorBulto) || 0;
      const costo = uxb > 0 ? precioPorBulto / uxb : 0;
      const margenPorc = costo > 0 ? ((precioVenta - costo) / costo) * 100 : null;
      updates.push(
        prisma.detalleRecepcion.update({
          where: { id: detRec.id },
          data: {
            precioVenta: precioVenta,
            margenPorc: margenPorc != null ? Math.round(margenPorc * 100) / 100 : null,
          },
        })
      );
    }
    await prisma.$transaction(updates);

    await prisma.recepcion.update({
      where: { id: recepcionId },
      data: { completa: true },
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
    res.json(updated);
  } catch (e) {
    console.error('PATCH /recepciones/:id:', e);
    res.status(500).json({ error: e?.message || 'Error al actualizar precios' });
  }
});

export const recepcionesRouter = router;
