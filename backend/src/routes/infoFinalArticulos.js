import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fetchInfoTecnolarPorCodigos, fetchIvaPorcentajePorCodigos, normalizarCodigoStock } from '../lib/sqlserver.js';
import { soloInfoFinalArticulos } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';

const router = Router();

/**
 * GET /info-final-articulos?fecha=YYYY-MM-DD
 * Por día: un ítem por artículo (codigo) con la info de la ÚLTIMA recepción de ese artículo ese día.
 * Requiere permiso info-final-articulos.
 */
router.get('/', soloInfoFinalArticulos, async (req, res) => {
  try {
    const fechaStr = (req.query.fecha || '').toString().trim();
    if (!fechaStr) {
      return sendError(res, 400, MSG.INFO_FECHA_REQUERIDA, 'INFO_001');
    }
    const inicio = new Date(fechaStr + 'T00:00:00.000Z');
    const fin = new Date(fechaStr + 'T23:59:59.999Z');
    if (Number.isNaN(inicio.getTime())) {
      return sendError(res, 400, MSG.INFO_FECHA_INVALIDA, 'INFO_002');
    }

    const recepciones = await prisma.recepcion.findMany({
      where: {
        compra: {
          fecha: { gte: inicio, lte: fin },
        },
      },
      include: {
        compra: { select: { numeroCompra: true, fecha: true } },
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

    const conDetalle = recepciones.filter((r) => r.detalles?.length > 0);
    const porNumeroRecepcion = (a, b) => (b.numeroRecepcion ?? 0) - (a.numeroRecepcion ?? 0);
    const recepcionesDesc = [...conDetalle].sort(porNumeroRecepcion);

    /** Por codigo: datos de la última recepción que contiene ese artículo (rec, detalle, detalleCompra, producto) */
    const ultimaPorCodigo = new Map();
    for (const rec of recepcionesDesc) {
      for (const d of rec.detalles || []) {
        const prod = d.detalleCompra?.producto;
        if (!prod?.codigo) continue;
        const codigo = String(prod.codigo).trim();
        if (ultimaPorCodigo.has(codigo)) continue;
        ultimaPorCodigo.set(codigo, { rec, d, dc: d.detalleCompra, prod });
      }
    }

    const codigosEnLista = [...ultimaPorCodigo.keys()];
    let lastSaveByCodigo = new Map();
    if (codigosEnLista.length > 0) {
      try {
        const rows = await prisma.$queryRaw`
          SELECT details->>'codigo' AS codigo, MAX("createdAt") AS "lastSaveAt"
          FROM "ActivityLog"
          WHERE entity = 'info-final-uxb' AND details->>'fecha' = ${fechaStr}
          GROUP BY details->>'codigo'
        `;
        for (const row of rows) {
          if (row.codigo && row.lastSaveAt) lastSaveByCodigo.set(String(row.codigo).trim(), new Date(row.lastSaveAt));
        }
      } catch (e) {
        console.error('Info final: error al obtener último guardado UXB por código', e?.message || e);
      }
    }

    const list = [];
    for (const [codigo, { rec, d, dc, prod }] of ultimaPorCodigo) {
      const uxb = Number(d.uxb) || 0;
      const precioPorBulto = Number(dc?.precioPorBulto) || 0;
      const costoConIva = uxb > 0 && precioPorBulto > 0 ? Math.round((precioPorBulto / uxb) * 100) / 100 : null;
      const lastSaveAt = lastSaveByCodigo.get(codigo);
      const recCreated = rec.createdAt ? new Date(rec.createdAt) : null;
      // Habilitar si no hay UXB guardado o si la recepción es posterior al último guardado (nueva recepción para cargar)
      const editable = uxb === 0 || (recCreated && lastSaveAt && recCreated > lastSaveAt);
      list.push({
        codigo: prod.codigo,
        descripcion: prod.descripcion || '',
        uxb,
        cantidadTotal: Number(d.cantidad) || 0,
        costoPromedioPonderado: costoConIva,
        costoConIva,
        precioVenta: d.precioVenta != null ? Number(d.precioVenta) : null,
        margenPorc: d.margenPorc != null ? Number(d.margenPorc) : null,
        numeroRecepcion: rec.numeroRecepcion ?? null,
        numeroCompra: rec.compra?.numeroCompra ?? null,
        editable,
      });
    }

    const codigosUnicos = [...new Set(list.map((a) => a.codigo))];
    let ivaPorCodigo = {};
    try {
      ivaPorCodigo = await fetchIvaPorcentajePorCodigos(codigosUnicos);
    } catch (e) {
      console.error('Info final: IVA por código (no crítico):', e?.message || e);
    }

    const listConIva = list.map((item) => {
      const codNorm = normalizarCodigoStock(item.codigo);
      const ivaPct = ivaPorCodigo[codNorm] ?? 0;
      const costoConIva = item.costoConIva != null ? Number(item.costoConIva) : null;
      let costoSinIva = null;
      if (costoConIva != null && ivaPct > 0) {
        costoSinIva = Math.round((costoConIva / (1 + ivaPct / 100)) * 100) / 100;
      } else if (costoConIva != null) {
        costoSinIva = costoConIva;
      }
      return { ...item, costoConIva, costoSinIva, ivaPorcentaje: ivaPct > 0 ? ivaPct : null };
    });

    let tecnolarMap = {};
    try {
      tecnolarMap = await fetchInfoTecnolarPorCodigos(codigosUnicos);
    } catch (errTecnolar) {
      console.error('Info final: fetch Tecnolar (no crítico):', errTecnolar?.message || errTecnolar);
    }

    const listConTecnolar = listConIva.map((item) => {
      const norm = normalizarCodigoStock(item.codigo);
      const t = tecnolarMap[norm] || { uxb: null, precioCosto: 0, margen: 0, precioVenta: 0 };
      return {
        ...item,
        tecnolar: {
          uxb: t.uxb,
          precioCosto: t.precioCosto,
          margen: t.margen,
          precioVenta: t.precioVenta,
        },
      };
    });

    listConTecnolar.sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || '') || String(a.codigo).localeCompare(String(b.codigo)));

    res.json(listConTecnolar);
  } catch (e) {
    sendError(res, 500, MSG.INFO_OBTENER, 'INFO_003', e);
  }
});

/**
 * PATCH /info-final-articulos/uxb - Guardar UXB definido por el usuario para un artículo en una fecha.
 * Body: { fecha: 'YYYY-MM-DD', codigo: string, uxb: number }.
 * Actualiza todos los DetalleRecepcion de ese día y producto; registra en el historial.
 */
const handlerUxb = async (req, res) => {
  try {
    if (!req.userId) {
      return sendError(res, 401, 'Usuario no identificado', 'INFO_004');
    }
    const { fecha: fechaStr, codigo, uxb } = req.body;
    const codigoStr = (codigo ?? '').toString().trim();
    const uxbNum = Math.max(0, Number(uxb) || 0);
    if (!fechaStr || !codigoStr) {
      return sendError(res, 400, 'Faltan fecha o código de artículo', 'INFO_005');
    }
    const inicio = new Date(fechaStr + 'T00:00:00.000Z');
    const fin = new Date(fechaStr + 'T23:59:59.999Z');
    if (Number.isNaN(inicio.getTime())) {
      return sendError(res, 400, MSG.INFO_FECHA_INVALIDA, 'INFO_002');
    }

    const recepciones = await prisma.recepcion.findMany({
      where: {
        compra: { fecha: { gte: inicio, lte: fin } },
      },
      include: {
        detalles: {
          include: {
            detalleCompra: {
              include: { producto: { select: { id: true, codigo: true, descripcion: true } } },
            },
          },
        },
      },
    });

    // Solo actualizar detalles que aún tienen UXB en 0 (nuevo cargamento). No sobrescribir receptiones ya guardadas.
    const detalleIdsToUpdate = [];
    let descripcionArticulo = '';
    for (const rec of recepciones) {
      for (const d of rec.detalles || []) {
        const prod = d.detalleCompra?.producto;
        if (!prod || String(prod.codigo).trim() !== codigoStr) continue;
        const uxbActual = Number(d.uxb) || 0;
        if (uxbActual > 0) continue; // ya tiene UXB guardado (recepción anterior), no tocar
        detalleIdsToUpdate.push(d.id);
        if (!descripcionArticulo && prod.descripcion) descripcionArticulo = prod.descripcion;
      }
    }

    if (detalleIdsToUpdate.length === 0) {
      // Ya todo guardado (mismo valor u otro): aceptar igual y responder ok sin error
      return res.json({ ok: true, codigo: codigoStr, uxb: uxbNum, actualizados: 0 });
    }

    await prisma.detalleRecepcion.updateMany({
      where: { id: { in: detalleIdsToUpdate } },
      data: { uxb: uxbNum },
    });

    await createLog(prisma, {
      userId: req.userId,
      action: 'actualizar',
      entity: 'info-final-uxb',
      entityId: null,
      details: {
        fecha: fechaStr,
        codigo: codigoStr,
        articulo: descripcionArticulo || codigoStr,
        uxb: uxbNum,
        recepcionesAfectadas: detalleIdsToUpdate.length,
      },
    });

    res.json({ ok: true, codigo: codigoStr, uxb: uxbNum, actualizados: detalleIdsToUpdate.length });
  } catch (e) {
    sendError(res, 500, MSG.INFO_OBTENER, 'INFO_007', e);
  }
};
router.patch('/uxb', soloInfoFinalArticulos, handlerUxb);
router.patch('/uxb/', soloInfoFinalArticulos, handlerUxb);

export const infoFinalArticulosRouter = router;
