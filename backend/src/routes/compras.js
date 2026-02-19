import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloComprador } from '../middleware/auth.js';

const router = Router();

export const comprasRouter = router;

// Solo compradores pueden crear/editar; visores solo listar
router.get('/', async (req, res) => {
  try {
    const { desde, hasta, proveedorId, sinRecepcion } = req.query;
    const where = {};
    if (desde) where.fecha = { ...where.fecha, gte: new Date(desde) };
    if (hasta) where.fecha = { ...where.fecha, lte: new Date(hasta) };
    if (proveedorId) where.proveedorId = proveedorId;
    // Para pantalla "Recepción de compras": solo compras que aún no tienen recepción guardada
    if (sinRecepcion === 'true' || sinRecepcion === '1') {
      where.recepcion = null;
    }
    const compras = await prisma.compra.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        proveedor: { select: { id: true, nombre: true } },
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
      },
    });
    res.json(compras);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar compras' });
  }
});

router.get('/totales-dia', async (req, res) => {
  try {
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();
    const inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setHours(23, 59, 59, 999);
    const compras = await prisma.compra.findMany({
      where: { fecha: { gte: inicio, lte: fin } },
      select: { totalBultos: true, totalMonto: true },
    });
    const totalBultos = compras.reduce((a, c) => a + (c.totalBultos ?? 0), 0);
    const totalMonto = compras.reduce((a, c) => {
      const m = c.totalMonto;
      const n = typeof m === 'number' && !Number.isNaN(m) ? m : (m != null && typeof m.toString === 'function' ? parseFloat(String(m)) : 0);
      return a + (Number.isFinite(n) ? n : 0);
    }, 0);
    res.json({ totalBultos, totalMonto, fecha: inicio.toISOString().slice(0, 10) });
  } catch (e) {
    console.error('GET /compras/totales-dia:', e);
    const message = e?.message ?? String(e);
    res.status(500).json({ error: 'Error al calcular totales', detail: message });
  }
});

router.post('/', soloComprador, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'No se identificó al usuario. Iniciá sesión de nuevo.' });
    }
    const { fecha, proveedorId, detalles } = req.body;
    if (!fecha || !proveedorId || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ error: 'Faltan fecha, proveedor o detalles' });
    }
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
          const pesoPorBulto = Number(d.pesoPorBulto) || 0;
          const precioPorKg = pesoPorBulto > 0 ? precioPorBulto / pesoPorBulto : 0;
          const total = bultos * precioPorBulto;
          totalBultos += bultos;
          totalMonto += total;
          return {
            productoId,
            bultos,
            precioPorBulto,
            pesoPorBulto,
            precioPorKg,
            total,
          };
        })
    );
    const detallesCrear = detallesConIds.filter(Boolean);
    if (detallesCrear.length === 0) {
      return res.status(400).json({ error: 'Debe haber al menos un ítem con bultos > 0' });
    }
    const { _max } = await prisma.compra.aggregate({ _max: { numeroCompra: true } });
    const numeroCompra = (Number(_max?.numeroCompra) || 0) + 1;
    const compra = await prisma.compra.create({
      data: {
        numeroCompra,
        fecha: new Date(fecha),
        totalBultos,
        totalMonto,
        userId: req.userId,
        proveedorId,
        detalles: { create: detallesCrear },
      },
      include: {
        proveedor: { select: { id: true, nombre: true } },
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
    res.status(201).json(compra);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar la compra' });
  }
});

router.get('/:id/recepcion', async (req, res) => {
  try {
    const compra = await prisma.compra.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
    const recepcion = await prisma.recepcion.findUnique({
      where: { compraId: req.params.id },
      include: {
        detalles: true,
        user: { select: { id: true, nombre: true } },
      },
    });
    res.json(recepcion);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener recepción' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const compra = await prisma.compra.findUnique({
      where: { id: req.params.id },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        user: { select: { id: true, nombre: true, email: true } },
        detalles: {
          include: {
            producto: true,
          },
        },
      },
    });
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
    res.json(compra);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener compra' });
  }
});
