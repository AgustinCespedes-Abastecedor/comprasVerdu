import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fetchProveedoresExternos } from '../lib/sqlserver.js';

const router = Router();

router.get('/', async (_, res) => {
  try {
    const externos = await fetchProveedoresExternos();
    for (const p of externos) {
      if (!p.nombre) continue;
      const codigoExterno = (p.id != null && String(p.id).trim() !== '') ? String(p.id).trim() : null;
      const idExterno = (p.pk != null && String(p.pk).trim() !== '') ? String(p.pk).trim() : null;
      if (!codigoExterno && !idExterno) continue;
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
    }
    const list = await prisma.proveedor.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar proveedores' });
  }
});

export const proveedoresRouter = router;
