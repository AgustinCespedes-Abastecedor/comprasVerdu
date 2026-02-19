import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fetchInfoTecnolarPorCodigos, normalizarCodigoStock } from '../lib/sqlserver.js';

const router = Router();

/**
 * GET /info-final-articulos?fecha=YYYY-MM-DD
 * Artículos de compras del día con recepción completa.
 * Lista por (codigo, uxb) pero el costo promedio ponderado es POR ARTÍCULO (codigo):
 * mismo artículo (ej. banana 3004) tiene un único costo = Σ(cantidad × precioPorBulto) / Σ(cantidad × uxb) en todo el día.
 */
router.get('/', async (req, res) => {
  try {
    const fechaStr = (req.query.fecha || '').toString().trim();
    if (!fechaStr) {
      return res.status(400).json({ error: 'Parámetro fecha es requerido (YYYY-MM-DD)' });
    }
    const fecha = new Date(fechaStr + 'T12:00:00');
    if (Number.isNaN(fecha.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    const inicio = new Date(fecha);
    inicio.setUTCHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setUTCHours(23, 59, 59, 999);

    const recepciones = await prisma.recepcion.findMany({
      where: {
        compra: {
          fecha: { gte: inicio, lte: fin },
        },
      },
      include: {
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

    const completas = recepciones.filter((r) => {
      if (!r.detalles?.length) return false;
      if (r.completa === true) return true;
      return r.detalles.every(
        (d) =>
          d.precioVenta != null &&
          d.margenPorc != null &&
          Number(d.uxb) > 0
      );
    });

    const groupKey = (codigo, uxb) => `${String(codigo).trim()}|${Number(uxb) || 0}`;
    const groups = new Map();
    /** Por artículo (codigo): suma de costos y unidades para un único costo promedio ponderado */
    const porCodigo = new Map();

    for (const rec of completas) {
      for (const d of rec.detalles || []) {
        const dc = d.detalleCompra;
        const prod = dc?.producto;
        if (!prod?.codigo) continue;
        const uxb = Number(d.uxb) || 0;
        if (uxb <= 0) continue;
        const precioPorBulto = Number(dc?.precioPorBulto) || 0;
        const cantidad = Number(d.cantidad) || 0;

        const codigo = String(prod.codigo).trim();
        if (!porCodigo.has(codigo)) {
          porCodigo.set(codigo, { sumaCostos: 0, unidadesTotales: 0 });
        }
        const pc = porCodigo.get(codigo);
        pc.sumaCostos += cantidad * precioPorBulto;
        pc.unidadesTotales += cantidad * uxb;

        const key = groupKey(prod.codigo, uxb);
        if (!groups.has(key)) {
          groups.set(key, {
            codigo: prod.codigo,
            descripcion: prod.descripcion || '',
            uxb,
            cantidadTotal: 0,
            precioVenta: d.precioVenta != null ? Number(d.precioVenta) : null,
            margenPorc: d.margenPorc != null ? Number(d.margenPorc) : null,
          });
        }
        const g = groups.get(key);
        g.cantidadTotal += cantidad;
        if (g.precioVenta == null && d.precioVenta != null) g.precioVenta = Number(d.precioVenta);
        if (g.margenPorc == null && d.margenPorc != null) g.margenPorc = Number(d.margenPorc);
      }
    }

    const costoPorCodigo = new Map();
    for (const [codigo, pc] of porCodigo) {
      const cpp = pc.unidadesTotales > 0 ? pc.sumaCostos / pc.unidadesTotales : null;
      costoPorCodigo.set(codigo, cpp != null ? Math.round(Number(cpp) * 100) / 100 : null);
    }

    const list = [];
    for (const g of groups.values()) {
      const codigo = String(g.codigo).trim();
      list.push({
        codigo: g.codigo,
        descripcion: g.descripcion,
        uxb: g.uxb,
        cantidadTotal: g.cantidadTotal,
        costoPromedioPonderado: costoPorCodigo.get(codigo) ?? null,
        precioVenta: g.precioVenta,
        margenPorc: g.margenPorc,
      });
    }

    const codigosUnicos = [...new Set(list.map((a) => a.codigo))];
    let tecnolarMap = {};
    try {
      tecnolarMap = await fetchInfoTecnolarPorCodigos(codigosUnicos);
    } catch (errTecnolar) {
      console.error('Info final: fetch Tecnolar (no crítico):', errTecnolar?.message || errTecnolar);
    }

    const listConTecnolar = list.map((item) => {
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
    console.error('GET /info-final-articulos:', e);
    res.status(500).json({ error: e?.message || 'Error al obtener info final de artículos' });
  }
});

export const infoFinalArticulosRouter = router;
