import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fetchArticulosExternos, fetchArticulosPorDepartamento, fetchIvaPorcentajePorCodigos, fetchPreciosDesdeArticulos, fetchStockPorCodigos, fetchVentasYCostoDesdeVTAARTICULOS, normalizarCodigoStock, normalizarProveedorParaArticulos } from '../lib/sqlserver.js';
import { soloComprarOVerCompras } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';

const DEPARTAMENTO_VERDULERIA = process.env.EXTERNAL_ARTICULOS_DEPARTAMENTO_ID ?? '6';

const router = Router();

export const productosRouter = router;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** GET /productos/iva?codigos=1,2,3 - Porcentaje IVA por código. Requiere comprar o ver-compras. */
router.get('/iva', soloComprarOVerCompras, async (req, res) => {
  try {
    const raw = typeof req.query.codigos === 'string' ? req.query.codigos.trim() : '';
    const codigos = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
    if (codigos.length === 0) return res.json({});
    const map = await fetchIvaPorcentajePorCodigos(codigos);
    return res.json(map);
  } catch (e) {
    sendError(res, 500, MSG.PROD_IVA, 'PROD_001', e);
  }
});

/** GET /productos - Lista/busca productos (con proveedor o por departamento). Requiere comprar o ver-compras. */
router.get('/', soloComprarOVerCompras, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
    let q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q === 'undefined' || q === 'null') q = '';
    const allowedSort = ['codigo', 'descripcion', 'stockSucursales', 'stockCD', 'ventasN1', 'ventasN2', 'ventas7dias', 'costo', 'precioVenta', 'margenPorc'];
    const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'descripcion';
    const sortDir = req.query.sortDir === 'desc' ? 'desc' : 'asc';

    const proveedorId = req.query.proveedorId?.trim();
    let where;

    if (proveedorId) {
      const proveedor = await prisma.proveedor.findUnique({
        where: { id: proveedorId },
        select: { codigoExterno: true, idExterno: true },
      });
      if (!proveedor) return res.json({ total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, items: [] });
      const codigoRaw = (proveedor.codigoExterno != null && String(proveedor.codigoExterno).trim() !== '')
        ? String(proveedor.codigoExterno).trim()
        : '';
      const idExternoRaw = (proveedor.idExterno != null && String(proveedor.idExterno).trim() !== '')
        ? String(proveedor.idExterno).trim()
        : '';
      const codigoNorm = normalizarProveedorParaArticulos(codigoRaw);
      const idExternoNorm = normalizarProveedorParaArticulos(idExternoRaw);
      if (!codigoNorm && !idExternoNorm) {
        return res.json({ total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, items: [] });
      }
      const articulos = await fetchArticulosExternos(codigoNorm || null, idExternoNorm || null);
      if (articulos.length === 0) {
        return res.json({ total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, items: [] });
      }
      const codigos = articulos.map((a) => a.codigo);

      // Sync en lote: un findMany + createMany para nuevos + transacción de updates
      const existing = await prisma.producto.findMany({
        where: { OR: [{ codigo: { in: codigos } }, { codigoExterno: { in: codigos } }] },
        select: { id: true, codigo: true, codigoExterno: true },
      });
      const existingByCodigo = new Map();
      for (const p of existing) {
        existingByCodigo.set(p.codigo, p);
        if (p.codigoExterno && p.codigoExterno !== p.codigo) existingByCodigo.set(p.codigoExterno, p);
      }
      const toCreate = articulos.filter((a) => !existingByCodigo.has(a.codigo));
      if (toCreate.length > 0) {
        await prisma.producto.createMany({
          data: toCreate.map((a) => ({
            codigo: a.codigo,
            codigoExterno: a.codigo,
            descripcion: a.descripcion,
          })),
          skipDuplicates: true,
        });
      }
      const toUpdate = articulos.filter((a) => existingByCodigo.has(a.codigo));
      if (toUpdate.length > 0) {
        const updates = toUpdate.map((a) => {
          const ex = existingByCodigo.get(a.codigo);
          return ex ? prisma.producto.update({
            where: { id: ex.id },
            data: { descripcion: a.descripcion, codigoExterno: a.codigo },
          }) : null;
        }).filter(Boolean);
        await prisma.$transaction(updates);
      }
      where = { codigo: { in: codigos } };
    } else {
      // Sin proveedor: lista desde ELABASTECEDOR por departamento verdulería (independiente de proveedores)
      const articulosVerduleria = await fetchArticulosPorDepartamento(DEPARTAMENTO_VERDULERIA);
      if (articulosVerduleria.length === 0) {
        return res.json({ total: 0, page: 1, pageSize, items: [] });
      }
      let listBase = articulosVerduleria;
      if (q.length > 0) {
        const qLower = q.toLowerCase();
        listBase = listBase.filter(
          (a) =>
            (a.descripcion && a.descripcion.toLowerCase().includes(qLower)) ||
            (a.codigo && String(a.codigo).toLowerCase().includes(qLower))
        );
      }
      const allCodigos = listBase.map((a) => a.codigo);
      const fechaPlanilla = typeof req.query.fecha === 'string' ? req.query.fecha.trim() : '';
      const [stockMap, preciosMap, ventasMap] = await Promise.all([
        fetchStockPorCodigos(allCodigos),
        fetchPreciosDesdeArticulos(allCodigos),
        fechaPlanilla ? fetchVentasYCostoDesdeVTAARTICULOS(allCodigos, fechaPlanilla) : Promise.resolve({}),
      ]);
      let listConStock = listBase.map((a) => {
        const codNorm = normalizarCodigoStock(a.codigo);
        const st = stockMap[codNorm];
        const stockSucursales = st != null ? st.stockSucursales : 0;
        const stockCD = st != null ? st.stockCD : 0;
        const precios = preciosMap[codNorm];
        const costo = precios != null ? precios.costo : 0;
        const precioVenta = precios != null ? precios.precioVenta : 0;
        const margenPorc = precios != null ? precios.margenPorc : 0;
        const ventas = ventasMap[codNorm];
        const ventasN1 = ventas != null ? ventas.ventasN1 : 0;
        const ventasN2 = ventas != null ? ventas.ventasN2 : 0;
        const ventas7dias = ventas != null ? ventas.ventas7dias : 0;
        return {
          id: a.codigo,
          codigo: a.codigo,
          codigoExterno: a.codigo,
          descripcion: a.descripcion,
          stockSucursales,
          stockCD,
          ventasN1,
          ventasN2,
          ventas7dias,
          costo,
          precioVenta,
          margenPorc,
        };
      });
      const mul = sortDir === 'asc' ? 1 : -1;
      listConStock.sort((a, b) => {
        let va = a[sortBy];
        let vb = b[sortBy];
        if (sortBy === 'stockSucursales' || sortBy === 'stockCD') {
          va = sortBy === 'stockSucursales' ? (a.stockSucursales ?? 0) : (a.stockCD ?? 0);
          vb = sortBy === 'stockSucursales' ? (b.stockSucursales ?? 0) : (b.stockCD ?? 0);
        } else {
          va = va ?? (typeof a[sortBy] === 'string' ? '' : 0);
          vb = vb ?? (typeof b[sortBy] === 'string' ? '' : 0);
        }
        if (typeof va === 'string') return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * mul;
        return va === vb ? 0 : (va < vb ? -mul : mul);
      });
      const total = listConStock.length;
      const list = listConStock.slice((page - 1) * pageSize, page * pageSize);
      return res.json({ total, page, pageSize, items: list });
    }

    if (q.length > 0) {
      const qCondition = {
        OR: [
          { descripcion: { contains: q, mode: 'insensitive' } },
          { codigo: { contains: q, mode: 'insensitive' } },
        ],
      };
      if (where && Object.keys(where).length > 0) {
        where = { AND: [where, qCondition] };
      } else {
        where = qCondition;
      }
    }

    const sortByStock = sortBy === 'stockSucursales' || sortBy === 'stockCD';

    let total;
    let list;

    if (sortByStock) {
      // Orden por stock: traer todos los que cumplen el filtro, enriquecer con stock real (SQL Server), ordenar en memoria y paginar
      const listAll = await prisma.producto.findMany({
        where,
        orderBy: { codigo: 'asc' },
        select: {
          id: true, codigo: true, codigoExterno: true, descripcion: true,
          ventasN1: true, ventasN2: true, ventas7dias: true,
          costo: true, precioVenta: true, margenPorc: true,
        },
      });
      total = listAll.length;
      if (listAll.length === 0) {
        return res.json({ total: 0, page, pageSize, items: [] });
      }
      const allCodigos = listAll.map((p) => p.codigo);
      const fechaPlanilla = typeof req.query.fecha === 'string' ? req.query.fecha.trim() : '';
      const [stockMap, preciosMap, ventasMap] = await Promise.all([
        fetchStockPorCodigos(allCodigos),
        fetchPreciosDesdeArticulos(allCodigos),
        fechaPlanilla ? fetchVentasYCostoDesdeVTAARTICULOS(allCodigos, fechaPlanilla) : Promise.resolve({}),
      ]);
      let listConStock = listAll.map((p) => {
        const codNorm = normalizarCodigoStock(p.codigo);
        const st = stockMap[codNorm];
        const stockSucursales = st != null ? st.stockSucursales : 0;
        const stockCD = st != null ? st.stockCD : 0;
        const precios = preciosMap[codNorm];
        const costo = precios != null ? precios.costo : (Number(p.costo) ?? 0);
        const precioVenta = precios != null ? precios.precioVenta : (Number(p.precioVenta) ?? 0);
        const margenPorc = precios != null ? precios.margenPorc : (Number(p.margenPorc) ?? 0);
        const ventas = ventasMap[codNorm];
        const ventasN1 = ventas != null ? ventas.ventasN1 : (p.ventasN1 ?? 0);
        const ventasN2 = ventas != null ? ventas.ventasN2 : (p.ventasN2 ?? 0);
        const ventas7dias = ventas != null ? ventas.ventas7dias : (p.ventas7dias ?? 0);
        return {
          ...p,
          stockSucursales,
          stockCD,
          ventasN1,
          ventasN2,
          ventas7dias,
          costo,
          precioVenta,
          margenPorc,
        };
      });
      const mul = sortDir === 'asc' ? 1 : -1;
      listConStock.sort((a, b) => {
        const va = sortBy === 'stockSucursales' ? (a.stockSucursales ?? 0) : (a.stockCD ?? 0);
        const vb = sortBy === 'stockSucursales' ? (b.stockSucursales ?? 0) : (b.stockCD ?? 0);
        return va === vb ? 0 : (va < vb ? -mul : mul);
      });
      list = listConStock.slice((page - 1) * pageSize, page * pageSize);
      return res.json({ total, page, pageSize, items: list });
    }

    const orderBy = { [sortBy]: sortDir };
    const [totalCount, listPaginated] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, codigo: true, codigoExterno: true, descripcion: true,
          ventasN1: true, ventasN2: true, ventas7dias: true,
          costo: true, precioVenta: true, margenPorc: true,
        },
      }),
    ]);
    total = totalCount;
    list = listPaginated;

    if (list.length === 0) {
      return res.json({ total, page, pageSize, items: [] });
    }

    const pageCodigos = list.map((p) => p.codigo);
    const fechaPlanilla = typeof req.query.fecha === 'string' ? req.query.fecha.trim() : '';
    const [stockMap, preciosMap, ventasMap] = await Promise.all([
      fetchStockPorCodigos(pageCodigos),
      fetchPreciosDesdeArticulos(pageCodigos),
      fechaPlanilla ? fetchVentasYCostoDesdeVTAARTICULOS(pageCodigos, fechaPlanilla) : Promise.resolve({}),
    ]);

    const listConStock = list.map((p) => {
      const codNorm = normalizarCodigoStock(p.codigo);
      const st = stockMap[codNorm];
      const stockSucursales = st != null ? st.stockSucursales : 0;
      const stockCD = st != null ? st.stockCD : 0;
      const precios = preciosMap[codNorm];
      const costo = precios != null ? precios.costo : (Number(p.costo) ?? 0);
      const precioVenta = precios != null ? precios.precioVenta : (Number(p.precioVenta) ?? 0);
      const margenPorc = precios != null ? precios.margenPorc : (Number(p.margenPorc) ?? 0);
      const ventas = ventasMap[codNorm];
      const ventasN1 = ventas != null ? ventas.ventasN1 : (p.ventasN1 ?? 0);
      const ventasN2 = ventas != null ? ventas.ventasN2 : (p.ventasN2 ?? 0);
      const ventas7dias = ventas != null ? ventas.ventas7dias : (p.ventas7dias ?? 0);
      return {
        ...p,
        stockSucursales,
        stockCD,
        ventasN1,
        ventasN2,
        ventas7dias,
        costo,
        precioVenta,
        margenPorc,
      };
    });
    res.json({ total, page, pageSize, items: listConStock });
  } catch (e) {
    sendError(res, 500, MSG.PROD_LISTAR, 'PROD_002', e);
  }
});
