import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloGestionRoles, soloGestionUsuariosOroles } from '../middleware/auth.js';
import { TODOS_LOS_PERMISOS } from '../lib/permisos.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';

const router = Router();

/** Listar todos los roles con cantidad de usuarios. Quien tiene gestion-usuarios o gestion-roles puede listar. */
router.get('/', soloGestionUsuariosOroles, async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { users: true } },
      },
    });
    const list = roles.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: Array.isArray(r.permisos) ? r.permisos : [],
      usuariosCount: r._count.users,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    res.json(list);
  } catch (e) {
    sendError(res, 500, MSG.ROLES_LISTAR, 'ROLES_001', e);
  }
});

/** Crear rol. Body: { nombre, descripcion?, permisos: string[] } */
router.post('/', soloGestionRoles, async (req, res) => {
  try {
    const { nombre, descripcion, permisos } = req.body;
    const nombreTrim = typeof nombre === 'string' ? nombre.trim() : '';
    if (!nombreTrim) {
      return sendError(res, 400, MSG.ROLES_NOMBRE_OBLIGATORIO, 'ROLES_002');
    }
    const existente = await prisma.role.findUnique({ where: { nombre: nombreTrim } });
    if (existente) {
      return sendError(res, 400, MSG.ROLES_NOMBRE_DUPLICADO, 'ROLES_003');
    }
    const permisosValidos = Array.isArray(permisos)
      ? permisos.filter((p) => typeof p === 'string' && TODOS_LOS_PERMISOS.includes(p))
      : [];
    const role = await prisma.role.create({
      data: {
        nombre: nombreTrim,
        descripcion: typeof descripcion === 'string' ? descripcion.trim() || null : null,
        permisos: permisosValidos,
      },
    });
    if (req.userId) {
      await createLog(prisma, {
        userId: req.userId,
        action: 'crear',
        entity: 'rol',
        entityId: role.id,
        details: { nombre: role.nombre },
      });
    }
    res.status(201).json({
      id: role.id,
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: Array.isArray(role.permisos) ? role.permisos : [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  } catch (e) {
    sendError(res, 500, MSG.ROLES_CREAR, 'ROLES_004', e);
  }
});

/** Actualizar rol. Body: { nombre?, descripcion?, permisos? } */
router.patch('/:id', soloGestionRoles, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, permisos } = req.body;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return sendError(res, 404, MSG.ROLES_NO_ENCONTRADO, 'ROLES_005');
    }
    const data = {};
    if (typeof nombre === 'string') {
      const nombreTrim = nombre.trim();
      if (!nombreTrim) return sendError(res, 400, MSG.ROLES_NOMBRE_VACIO, 'ROLES_006');
      const otro = await prisma.role.findFirst({ where: { nombre: nombreTrim, id: { not: id } } });
      if (otro) return sendError(res, 400, MSG.ROLES_NOMBRE_DUPLICADO, 'ROLES_007');
      data.nombre = nombreTrim;
    }
    if (descripcion !== undefined) data.descripcion = typeof descripcion === 'string' ? descripcion.trim() || null : null;
    if (Array.isArray(permisos)) {
      data.permisos = permisos.filter((p) => typeof p === 'string' && TODOS_LOS_PERMISOS.includes(p));
    }
    if (Object.keys(data).length === 0) {
      return res.json({
        id: role.id,
        nombre: role.nombre,
        descripcion: role.descripcion,
        permisos: Array.isArray(role.permisos) ? role.permisos : [],
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      });
    }
    const updated = await prisma.role.update({
      where: { id },
      data,
    });
    if (req.userId) {
      await createLog(prisma, {
        userId: req.userId,
        action: 'actualizar',
        entity: 'rol',
        entityId: updated.id,
        details: { nombre: updated.nombre },
      });
    }
    res.json({
      id: updated.id,
      nombre: updated.nombre,
      descripcion: updated.descripcion,
      permisos: Array.isArray(updated.permisos) ? updated.permisos : [],
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    sendError(res, 500, MSG.ROLES_ACTUALIZAR, 'ROLES_008', e);
  }
});

/** Eliminar rol. No se puede si tiene usuarios asignados. */
router.delete('/:id', soloGestionRoles, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      return sendError(res, 404, MSG.ROLES_NO_ENCONTRADO, 'ROLES_009');
    }
    if (role._count.users > 0) {
      return sendError(res, 400, MSG.ROLES_TIENE_USUARIOS, 'ROLES_010');
    }
    await prisma.role.delete({ where: { id } });
    if (req.userId) {
      await createLog(prisma, {
        userId: req.userId,
        action: 'eliminar',
        entity: 'rol',
        entityId: id,
        details: { nombre: role.nombre },
      });
    }
    res.status(204).send();
  } catch (e) {
    sendError(res, 500, MSG.ROLES_ELIMINAR, 'ROLES_011', e);
  }
});

export const rolesRouter = router;
