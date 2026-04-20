import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloComprador, soloVerCompras, soloRolCompradorOAdministrador } from '../middleware/auth.js';
import { sendError, MSG, apiError } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';
import { appendCompraAuditoriaDesdeActivityLog } from '../lib/compraAuditoria.js';
import { parseYmdToPrismaDateOnly, logWarnIfInvalidYmdQuery } from '../lib/dateOnly.js';
import { utcInstantToCalendarDayString } from '../lib/appCalendarDay.js';
import {
  notifyAllActiveUsers,
  tituloCompraProveedorBultos,
  formatMontoNotificacion,
} from '../lib/notifications.js';
import { parseOffsetPagination, wantsPagedEnvelope } from '../lib/listPagination.js';
import { normalizarPesoCajonKg } from '../lib/uxbCosto.js';

const router = Router();

export const comprasRouter = router;

/** GET compras: requiere permiso ver-compras */
router.get('/', soloVerCompras, async (req, res) => {
  try {
    const { desde, hasta, proveedorId, sinRecepcion } = req.query;
    logWarnIfInvalidYmdQuery('GET /compras', 'desde', desde);
    logWarnIfInvalidYmdQuery('GET /compras', 'hasta', hasta);
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
    // Para pantalla "Recepción de compras": solo compras que aún no tienen recepción guardada
    if (sinRecepcion === 'true' || sinRecepcion === '1') {
      where.recepcion = null;
    }
    const include = {
      proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
      user: { select: { id: true, nombre: true, email: true } },
      detalles: {
        include: {
          producto: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              stockSucursales: true,
              stockCD: true,
              ventasN1: true,
              ventasN2: true,
              ventas7dias: true,
              costo: true,
              precioVenta: true,
              margenPorc: true,
            },
          },
        },
      },
      recepcion: {
        include: {
          detalles: {
            select: {
              id: true,
              detalleCompraId: true,
              cantidad: true,
              uxb: true,
              precioVenta: true,
              margenPorc: true,
            },
          },
        },
      },
    };
    const orderBy = [{ numeroCompra: 'asc' }, { fecha: 'asc' }, { createdAt: 'asc' }];

    if (wantsPagedEnvelope(req.query)) {
      const { page, pageSize, skip } = parseOffsetPagination(req.query);
      const [total, items] = await Promise.all([
        prisma.compra.count({ where }),
        prisma.compra.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include,
        }),
      ]);
      return res.json({ items, total, page, pageSize });
    }

    const compras = await prisma.compra.findMany({
      where,
      orderBy,
      include,
    });
    res.json(compras);
  } catch (e) {
    sendError(res, 500, MSG.COMPRAS_LISTAR, 'COMPRAS_001', e);
  }
});

router.get('/totales-dia', soloVerCompras, async (req, res) => {
  try {
    const fechaStrRaw = req.query.fecha != null && String(req.query.fecha).trim()
      ? String(req.query.fecha).trim()
      : utcInstantToCalendarDayString(new Date());
    const fechaDay = parseYmdToPrismaDateOnly(fechaStrRaw);
    if (!fechaDay) {
      return sendError(res, 400, MSG.COMPRAS_FECHA_INVALIDA, 'COMPRAS_012');
    }
    const compras = await prisma.compra.findMany({
      where: { fecha: fechaDay },
      select: { totalBultos: true, totalMonto: true },
    });
    const totalBultos = compras.reduce((a, c) => a + (c.totalBultos ?? 0), 0);
    const totalMonto = compras.reduce((a, c) => {
      const m = c.totalMonto;
      const n = typeof m === 'number' && !Number.isNaN(m) ? m : (m != null && typeof m.toString === 'function' ? parseFloat(String(m)) : 0);
      return a + (Number.isFinite(n) ? n : 0);
    }, 0);
    res.json({ totalBultos, totalMonto, fecha: fechaDay.toISOString().slice(0, 10) });
  } catch (e) {
    sendError(res, 500, MSG.COMPRAS_TOTALES, 'COMPRAS_002', e);
  }
});

router.post('/', soloComprador, async (req, res) => {
  try {
    if (!req.userId) {
      return sendError(res, 401, MSG.COMPRAS_USUARIO_NO_IDENTIFICADO, 'COMPRAS_003');
    }
    const { fecha, proveedorId, proveedorNombreManual, detalles } = req.body;
    const proveedorManualLimpio = (proveedorNombreManual || '').toString().trim();
    if (!fecha || (!proveedorId && !proveedorManualLimpio) || !Array.isArray(detalles) || detalles.length === 0) {
      return sendError(res, 400, MSG.COMPRAS_FALTAN_DATOS, 'COMPRAS_004');
    }

    const resolverProveedorId = async () => {
      if (proveedorId) return proveedorId;
      const existente = await prisma.proveedor.findFirst({
        where: { nombre: { equals: proveedorManualLimpio, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existente) return existente.id;
      const creado = await prisma.proveedor.create({
        data: { nombre: proveedorManualLimpio },
        select: { id: true },
      });
      return creado.id;
    };
    // Resolver productoId: puede ser el id (cuid) de Prisma o el codigo (lista desde SQL Server)
    const resolverProductoId = async (d) => {
      const idOrCodigo = (d.productoId || d.codigo || '').toString().trim();
      if (!idOrCodigo) return null;
      let p = await prisma.producto.findUnique({ where: { id: idOrCodigo }, select: { id: true } });
      if (p) return p.id;
      p = await prisma.producto.findFirst({ where: { codigo: idOrCodigo }, select: { id: true } });
      if (p) return p.id;
      const descripcion = (d.descripcion || '').toString().trim() || idOrCodigo;
      const created = await prisma.producto.create({
        data: { codigo: idOrCodigo, codigoExterno: idOrCodigo, descripcion },
        select: { id: true },
      });
      return created.id;
    };
    let totalBultos = 0;
    let totalMonto = 0;
    const detallesConIds = await Promise.all(
      detalles
        .filter((d) => (d.productoId || d.codigo) && (d.bultos ?? 0) > 0)
        .map(async (d) => {
          const productoId = await resolverProductoId(d);
          if (!productoId) return null;
          const bultos = Number(d.bultos) || 0;
          const precioPorBulto = Number(d.precioPorBulto) || 0;
          const rawPesoCajon = d.pesoCajon;
          if (rawPesoCajon != null && rawPesoCajon !== '' && Number.isNaN(Number(rawPesoCajon))) {
            throw apiError(MSG.COMPRAS_PESO_CAJON_NO_NUMERICO, 'COMPRAS_013', 400);
          }
          const pesoCajon = normalizarPesoCajonKg(rawPesoCajon);
          const pesoPorBulto = Number(d.pesoPorBulto) || 0;
          const precioPorKg = pesoPorBulto > 0 ? precioPorBulto / pesoPorBulto : 0;
          const total = bultos * precioPorBulto;
          totalBultos += bultos;
          totalMonto += total;
          return {
            productoId,
            bultos,
            precioPorBulto,
            pesoCajon,
            pesoPorBulto,
            precioPorKg,
            total,
          };
        })
    );
    const detallesCrear = detallesConIds.filter(Boolean);
    if (detallesCrear.length === 0) {
      return sendError(res, 400, MSG.COMPRAS_AL_MENOS_UN_ITEM, 'COMPRAS_005');
    }
    const fechaCompra = parseYmdToPrismaDateOnly(fecha);
    if (!fechaCompra) {
      return sendError(res, 400, MSG.COMPRAS_FECHA_INVALIDA, 'COMPRAS_011');
    }

    const { _max } = await prisma.compra.aggregate({ _max: { numeroCompra: true } });
    const numeroCompra = (Number(_max?.numeroCompra) || 0) + 1;
    const proveedorIdFinal = await resolverProveedorId();
    const compra = await prisma.compra.create({
      data: {
        numeroCompra,
        fecha: fechaCompra,
        totalBultos,
        totalMonto,
        userId: req.userId,
        proveedorId: proveedorIdFinal,
        detalles: { create: detallesCrear },
      },
      include: {
        proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
        user: { select: { id: true, nombre: true } },
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                stockSucursales: true,
                stockCD: true,
                ventasN1: true,
                ventasN2: true,
                ventas7dias: true,
                costo: true,
                precioVenta: true,
                margenPorc: true,
              },
            },
          },
        },
      },
    });
    if (req.userId) {
      const logDetails = {
        numeroCompra: compra.numeroCompra,
        fecha: compra.fecha,
        proveedor: compra.proveedor?.nombre,
        totalBultos: compra.totalBultos,
        totalMonto: String(compra.totalMonto),
        items: (compra.detalles || []).map((d) => ({
          articulo: d.producto?.descripcion ?? d.producto?.codigo ?? '—',
          codigo: d.producto?.codigo ?? '—',
          bultos: d.bultos,
          precioPorBulto: Number(d.precioPorBulto),
          pesoCajon: Number(d.pesoCajon),
          total: Number(d.total),
        })),
      };
      const activityLogId = await createLog(prisma, {
        userId: req.userId,
        action: 'crear',
        entity: 'compra',
        entityId: compra.id,
        details: logDetails,
      });
      if (activityLogId) {
        try {
          await appendCompraAuditoriaDesdeActivityLog(prisma, {
            activityLogId,
            userId: req.userId,
            occurredAt: new Date(),
            entity: 'compra',
            action: 'crear',
            entityId: compra.id,
            details: logDetails,
            compraId: compra.id,
            recepcionId: null,
            fuente: 'online',
            confianza: 'alta',
          });
        } catch (e) {
          console.error('[COMPRAS] Auditoría canónica (no bloquea):', e?.message || e);
        }
      }
    }
    const compradorNombre = (compra.user?.nombre || '').trim() || 'Usuario';
    const proveedorNombre = compra.proveedor?.nombre || 'Proveedor';
    const titulo = tituloCompraProveedorBultos({
      numeroCompra: compra.numeroCompra,
      proveedorNombre,
      totalBultos,
    });
    const montoStr = formatMontoNotificacion(compra.totalMonto);
    const mensaje = `Comprador: ${compradorNombre} · Total compra $ ${montoStr} · Ítems: ${(compra.detalles || []).length}.`;
    void notifyAllActiveUsers(prisma, {
      type: 'nueva_compra',
      title: titulo,
      message: mensaje,
      compraId: compra.id,
      recepcionId: null,
      actorUserId: req.userId,
    }).catch((err) => console.error('[COMPRAS] Notificaciones (no bloquea):', err?.message || err));

    res.status(201).json(compra);
  } catch (e) {
    if (e && typeof e.status === 'number' && e.status < 500 && e.message && e.code) {
      return sendError(res, e.status, e.message, e.code);
    }
    sendError(res, 500, MSG.COMPRAS_GUARDAR, 'COMPRAS_006', e);
  }
});

/**
 * PATCH /compras/:id/detalles-bultos — Rol Comprador o Administrador (nivel sistema). Ajusta bultos por línea, recalcula total línea y totales de compra.
 * Body: { detalles: [{ id: detalleCompraId, bultos: number }] }
 */
router.patch('/:id/detalles-bultos', soloVerCompras, soloRolCompradorOAdministrador, async (req, res) => {
  try {
    if (!req.userId) {
      return sendError(res, 401, MSG.COMPRAS_USUARIO_NO_IDENTIFICADO, 'COMPRAS_003');
    }
    const compraId = req.params.id;
    const { detalles: bodyDetalles } = req.body;
    if (!Array.isArray(bodyDetalles) || bodyDetalles.length === 0) {
      return sendError(res, 400, MSG.COMPRAS_PATCH_BULTOS_SIN_DETALLES, 'COMPRAS_015');
    }

    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
      include: {
        detalles: {
          include: {
            producto: { select: { codigo: true, descripcion: true } },
          },
        },
        recepcion: {
          include: {
            detalles: { select: { detalleCompraId: true, cantidad: true } },
          },
        },
      },
    });
    if (!compra) {
      return sendError(res, 404, MSG.COMPRAS_NO_ENCONTRADA, 'COMPRAS_016');
    }

    const detalleById = new Map(compra.detalles.map((d) => [d.id, d]));
    const cantidadRecibidaPorDetalle = new Map();
    for (const dr of compra.recepcion?.detalles || []) {
      if (dr.detalleCompraId) {
        cantidadRecibidaPorDetalle.set(
          dr.detalleCompraId,
          Math.max(0, Number(dr.cantidad) || 0),
        );
      }
    }

    const updates = [];
    for (const row of bodyDetalles) {
      const detalleId = (row.id || row.detalleCompraId || '').toString().trim();
      if (!detalleId) {
        return sendError(res, 400, MSG.COMPRAS_DETALLE_NO_PERTENECE, 'COMPRAS_017');
      }
      const dc = detalleById.get(detalleId);
      if (!dc) {
        return sendError(res, 400, MSG.COMPRAS_DETALLE_NO_PERTENECE, 'COMPRAS_017');
      }
      const raw = row.bultos;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n !== Math.trunc(n)) {
        return sendError(res, 400, MSG.COMPRAS_BULTOS_DEBE_SER_ENTERO, 'COMPRAS_018');
      }
      const bultosNuevo = Math.trunc(n);
      const cantRec = cantidadRecibidaPorDetalle.get(detalleId) ?? 0;
      if (bultosNuevo < cantRec) {
        return sendError(res, 400, MSG.COMPRAS_BULTOS_MENOR_RECEPCION, 'COMPRAS_019');
      }
      const bultosAntes = Number(dc.bultos) || 0;
      if (bultosAntes === bultosNuevo) continue;
      const precioPorBulto = Number(dc.precioPorBulto) || 0;
      const pesoPorBulto = Number(dc.pesoPorBulto) || 0;
      const precioPorKg = pesoPorBulto > 0 ? precioPorBulto / pesoPorBulto : 0;
      const total = bultosNuevo * precioPorBulto;
      const setOriginal = dc.bultosOriginal == null;
      updates.push({
        id: detalleId,
        bultosAntes,
        bultosNuevo,
        precioPorBulto,
        precioPorKg,
        total,
        setOriginal,
        dc,
      });
    }

    if (updates.length === 0) {
      const sinCambios = await prisma.compra.findUnique({
        where: { id: compraId },
        include: {
          proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
          user: { select: { id: true, nombre: true, email: true } },
          detalles: { include: { producto: true } },
          recepcion: {
            include: {
              detalles: {
                select: {
                  id: true,
                  detalleCompraId: true,
                  cantidad: true,
                  uxb: true,
                  precioVenta: true,
                  margenPorc: true,
                },
              },
            },
          },
        },
      });
      return res.json(sinCambios);
    }

    const updatedCompra = await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        const data = {
          bultos: u.bultosNuevo,
          total: u.total,
          precioPorKg: u.precioPorKg,
        };
        if (u.setOriginal) {
          data.bultosOriginal = u.bultosAntes;
        }
        await tx.detalleCompra.update({
          where: { id: u.id },
          data,
        });
      }
      const detallesPost = await tx.detalleCompra.findMany({
        where: { compraId },
      });
      const totalBultos = detallesPost.reduce((a, d) => a + (Number(d.bultos) || 0), 0);
      const totalMonto = detallesPost.reduce((a, d) => {
        const t = d.total;
        const num = typeof t === 'number' && !Number.isNaN(t) ? t : parseFloat(String(t ?? 0));
        return a + (Number.isFinite(num) ? num : 0);
      }, 0);
      await tx.compra.update({
        where: { id: compraId },
        data: {
          totalBultos,
          totalMonto,
          updatedAt: new Date(),
        },
      });
      return tx.compra.findUnique({
        where: { id: compraId },
        include: {
          proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
          user: { select: { id: true, nombre: true, email: true } },
          detalles: { include: { producto: true } },
          recepcion: {
            include: {
              detalles: {
                select: {
                  id: true,
                  detalleCompraId: true,
                  cantidad: true,
                  uxb: true,
                  precioVenta: true,
                  margenPorc: true,
                },
              },
            },
          },
        },
      });
    });

    const logDetails = {
      numeroCompra: updatedCompra?.numeroCompra,
      ajusteBultos: true,
      items: updates.map((u) => ({
        codigo: u.dc.producto?.codigo ?? '—',
        articulo: u.dc.producto?.descripcion ?? '—',
        bultosAntes: u.bultosAntes,
        bultosDespues: u.bultosNuevo,
        bultosOriginalPersistido: u.setOriginal ? u.bultosAntes : (u.dc.bultosOriginal != null ? Number(u.dc.bultosOriginal) : null),
      })),
    };
    const activityLogId = await createLog(prisma, {
      userId: req.userId,
      action: 'actualizar',
      entity: 'compra',
      entityId: compraId,
      details: logDetails,
    });
    if (activityLogId && updatedCompra?.id) {
      try {
        await appendCompraAuditoriaDesdeActivityLog(prisma, {
          activityLogId,
          userId: req.userId,
          occurredAt: new Date(),
          entity: 'compra',
          action: 'actualizar',
          entityId: compraId,
          details: logDetails,
          compraId: updatedCompra.id,
          recepcionId: null,
          fuente: 'online',
          confianza: 'alta',
        });
      } catch (e) {
        console.error('[COMPRAS] Auditoría canónica bultos (no bloquea):', e?.message || e);
      }
    }

    res.json(updatedCompra);
  } catch (e) {
    sendError(res, 500, MSG.COMPRAS_GUARDAR, 'COMPRAS_020', e);
  }
});

router.get('/:id/recepcion', soloVerCompras, async (req, res) => {
  try {
    const compra = await prisma.compra.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!compra) return sendError(res, 404, MSG.COMPRAS_NO_ENCONTRADA, 'COMPRAS_007');
    const recepcion = await prisma.recepcion.findUnique({
      where: { compraId: req.params.id },
      include: {
        detalles: true,
        user: { select: { id: true, nombre: true } },
      },
    });
    res.json(recepcion);
  } catch (e) {
    sendError(res, 500, MSG.COMPRAS_RECEPCION, 'COMPRAS_008', e);
  }
});

router.get('/:id', soloVerCompras, async (req, res) => {
  try {
    const compra = await prisma.compra.findUnique({
      where: { id: req.params.id },
      include: {
        proveedor: { select: { id: true, nombre: true, codigoExterno: true } },
        user: { select: { id: true, nombre: true, email: true } },
        detalles: {
          include: {
            producto: true,
          },
        },
      },
    });
    if (!compra) return sendError(res, 404, MSG.COMPRAS_NO_ENCONTRADA, 'COMPRAS_009');
    res.json(compra);
  } catch (e) {
    sendError(res, 500, MSG.COMPRAS_OBTENER, 'COMPRAS_010', e);
  }
});
