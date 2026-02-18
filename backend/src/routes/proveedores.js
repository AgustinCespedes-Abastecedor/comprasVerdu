import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fetchProveedoresExternos } from '../lib/sqlserver.js';

const router = Router();

/** Códigos de proveedores permitidos (campo CODIGO en tabla proveedores). Solo se listan estos. */
const CODIGOS_PROVEEDORES_PERMITIDOS = [
  '20', '30', '5019', '5033', '5034', '5035', '5044', '5079', '5081', '5086', '5087', '5088', '5089',
  '5091', '5092', '5093', '5102', '5107', '5133', '5158', '5159', '5163', '5167', '7015', '7075',
  '9063', '9110', '9134', '9135', '9190', '9203', '9212', '9222', '9247', '9307', '9442', '9489',
  '9504', '9527', '9541', '9667', '9691', '9710', '9774', '9783', '9796', '9808', '9871', '9903',
  '9905', '9927', '9980', '10000', '10057', '10059', '10100', '10105', '10138', '10182', '10212',
  '10217', '10219', '10229', '10251', '10266', '10267', '10279', '10356', '10406', '10455', '10503',
  '10519', '10528', '10541', '10545', '10558', '10575', '10658', '10664', '10668', '10687', '10720',
  '10740', '10798', '10801',
];

router.get('/', async (_, res) => {
  try {
    let externos = [];
    try {
      externos = await fetchProveedoresExternos();
    } catch (err) {
      console.warn('Proveedores: no se pudo sincronizar con SQL Server, se devuelve lista local:', err?.message);
    }
    const permitidosSet = new Set(CODIGOS_PROVEEDORES_PERMITIDOS);
    for (const p of externos) {
      if (!p.nombre) continue;
      const codigoExterno = (p.id != null && String(p.id).trim() !== '') ? String(p.id).trim() : null;
      const idExterno = (p.pk != null && String(p.pk).trim() !== '') ? String(p.pk).trim() : null;
      if (codigoExterno != null && !permitidosSet.has(codigoExterno)) continue;
      if (!codigoExterno && !idExterno) continue;
      try {
        const existingByPk = idExterno ? await prisma.proveedor.findFirst({ where: { idExterno } }) : null;
        const existingByCodigo = codigoExterno ? await prisma.proveedor.findFirst({ where: { codigoExterno } }) : null;
        const existing = existingByPk || existingByCodigo;
        if (existing) {
          await prisma.proveedor.update({
            where: { id: existing.id },
            data: {
              nombre: p.nombre,
              ...(codigoExterno != null && { codigoExterno }),
              ...(idExterno != null && { idExterno }),
            },
          });
        } else {
          await prisma.proveedor.create({
            data: {
              nombre: p.nombre,
              codigoExterno: codigoExterno ?? undefined,
              idExterno: idExterno ?? undefined,
            },
          });
        }
      } catch (err) {
        console.warn('Proveedores: error al sincronizar uno:', err?.message);
      }
    }
    const list = await prisma.proveedor.findMany({
      where: { codigoExterno: { in: CODIGOS_PROVEEDORES_PERMITIDOS } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
    res.json(list);
  } catch (e) {
    console.error('GET /proveedores:', e);
    res.status(500).json({ error: 'Error al listar proveedores', detail: e?.message ?? String(e) });
  }
});

export const proveedoresRouter = router;
