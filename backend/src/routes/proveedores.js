import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  fetchProveedoresExternos,
  fetchCodigosProveedoresAgrupadosDetalle,
  resolveGrupoIdListadoProveedores,
} from '../lib/sqlserver.js';
import { soloComprarOVerCompras } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';

const router = Router();

/**
 * Códigos de proveedores permitidos (campo CODIGO en tabla proveedores).
 * Además, en GET / se unen los códigos devueltos por AgrupadosDetalle para el grupo resuelto (ver sqlserver.js).
 */
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

/** GET /proveedores - Lista proveedores (sincroniza con SQL Server). Requiere comprar o ver-compras. */
router.get('/', soloComprarOVerCompras, async (_, res) => {
  try {
    let codigosDesdeAgrupados = [];
    try {
      const grupoId = await resolveGrupoIdListadoProveedores();
      codigosDesdeAgrupados = await fetchCodigosProveedoresAgrupadosDetalle(grupoId);
    } catch (err) {
      console.warn('Proveedores: AgrupadosDetalle no disponible:', err?.message);
    }
    const permitidosSet = new Set([...CODIGOS_PROVEEDORES_PERMITIDOS, ...codigosDesdeAgrupados]);
    const todosCodigosPermitidos = [...permitidosSet];

    let externos = [];
    try {
      externos = await fetchProveedoresExternos();
    } catch (err) {
      console.warn('Proveedores: no se pudo sincronizar con SQL Server, se devuelve lista local:', err?.message);
    }
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
      where: { codigoExterno: { in: todosCodigosPermitidos } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
    res.json(list);
  } catch (e) {
    sendError(res, 500, MSG.PROV_LISTAR, 'PROV_001', e);
  }
});

/** POST /proveedores/merge-manual - Reemplaza proveedor manual por proveedor oficial en compras. */
router.post('/merge-manual', soloComprarOVerCompras, async (req, res) => {
  try {
    const manualNombre = (req.body?.manualNombre || '').toString().trim();
    const proveedorDestinoId = (req.body?.proveedorDestinoId || '').toString().trim();
    if (!manualNombre || !proveedorDestinoId) {
      return sendError(res, 400, MSG.COMPRAS_FALTAN_DATOS, 'PROV_002');
    }

    const proveedorDestino = await prisma.proveedor.findUnique({
      where: { id: proveedorDestinoId },
      select: { id: true, nombre: true },
    });
    if (!proveedorDestino) {
      return sendError(res, 404, 'Proveedor destino no encontrado.', 'PROV_003');
    }

    const proveedoresManuales = await prisma.proveedor.findMany({
      where: {
        id: { not: proveedorDestino.id },
        codigoExterno: null,
        idExterno: null,
        nombre: { equals: manualNombre, mode: 'insensitive' },
      },
      select: { id: true, nombre: true },
    });

    if (proveedoresManuales.length === 0) {
      return res.json({
        merged: false,
        mensaje: 'No se encontraron proveedores manuales para unificar.',
        proveedorDestino,
        comprasActualizadas: 0,
      });
    }

    const idsManuales = proveedoresManuales.map((p) => p.id);
    const resultado = await prisma.$transaction(async (tx) => {
      const comprasActualizadas = await tx.compra.updateMany({
        where: { proveedorId: { in: idsManuales } },
        data: { proveedorId: proveedorDestino.id },
      });
      await tx.proveedor.deleteMany({ where: { id: { in: idsManuales } } });
      return { comprasActualizadas: comprasActualizadas.count };
    });

    if (req.userId) {
      await createLog(prisma, {
        userId: req.userId,
        action: 'actualizar',
        entity: 'proveedor',
        entityId: proveedorDestino.id,
        details: {
          evento: 'merge_manual_proveedor',
          proveedorManualIngresado: manualNombre,
          proveedorDestino: {
            id: proveedorDestino.id,
            nombre: proveedorDestino.nombre,
          },
          proveedoresManualesEliminados: proveedoresManuales.map((p) => ({
            id: p.id,
            nombre: p.nombre,
          })),
          comprasActualizadas: resultado.comprasActualizadas,
        },
      });
    }

    return res.json({
      merged: true,
      proveedorDestino,
      manualesEliminados: proveedoresManuales.length,
      comprasActualizadas: resultado.comprasActualizadas,
    });
  } catch (e) {
    return sendError(res, 500, 'No se pudo unificar el proveedor manual.', 'PROV_004', e);
  }
});

export const proveedoresRouter = router;
