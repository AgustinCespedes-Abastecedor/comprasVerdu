import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloComprador } from '../middleware/auth.js';

const router = Router();

export const comprasRouter = router;

// Solo compradores pueden crear/editar; visores solo listar
router.get('/', async (req, res) => {
  try {
    const { desde, hasta, proveedorId } = req.query;
    const where = {};
    if (desde) where.fecha = { ...where.fecha, gte: new Date(desde) };
    if (hasta) where.fecha = { ...where.fecha, lte: new Date(hasta) };
    if (proveedorId) where.proveedorId = proveedorId;
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
    const totalBultos = compras.reduce((a, c) => a + c.totalBultos, 0);
    const totalMonto = compras.reduce((a, c) => a + Number(c.totalMonto), 0);
    res.json({ totalBultos, totalMonto, fecha: inicio.toISOString().slice(0, 10) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al calcular totales' });
  }
});

router.post('/', soloComprador, async (req, res) => {
  try {
    const { fecha, proveedorId, detalles } = req.body;
    if (!fecha || !proveedorId || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ error: 'Faltan fecha, proveedor o detalles' });
    }
    let totalBultos = 0;
    let totalMonto = 0;
    const detallesCrear = detalles
      .filter((d) => d.productoId && (d.bultos ?? 0) > 0)
      .map((d) => {
        const bultos = Number(d.bultos) || 0;
        const precioPorBulto = Number(d.precioPorBulto) || 0;
        const pesoPorBulto = Number(d.pesoPorBulto) || 0;
        const precioPorKg = pesoPorBulto > 0 ? precioPorBulto / pesoPorBulto : 0;
        const total = bultos * precioPorBulto;
        totalBultos += bultos;
        totalMonto += total;
        return {
          productoId: d.productoId,
          bultos,
          precioPorBulto,
          pesoPorBulto,
          precioPorKg,
          total,
        };
      });
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
