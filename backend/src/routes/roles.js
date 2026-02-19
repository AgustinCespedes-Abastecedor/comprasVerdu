import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { soloGestionRoles, soloGestionUsuariosOroles } from '../middleware/auth.js';
import { TODOS_LOS_PERMISOS } from '../lib/permisos.js';

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
    console.error(e);
    res.status(500).json({ error: 'Error al listar roles' });
  }
});

/** Crear rol. Body: { nombre, descripcion?, permisos: string[] } */
router.post('/', soloGestionRoles, async (req, res) => {
  try {
    const { nombre, descripcion, permisos } = req.body;
    const nombreTrim = typeof nombre === 'string' ? nombre.trim() : '';
    if (!nombreTrim) {
      return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
    }
    const existente = await prisma.role.findUnique({ where: { nombre: nombreTrim } });
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
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
    res.status(201).json({
      id: role.id,
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: Array.isArray(role.permisos) ? role.permisos : [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear el rol' });
  }
});

/** Actualizar rol. Body: { nombre?, descripcion?, permisos? } */
router.patch('/:id', soloGestionRoles, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, permisos } = req.body;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }
    const data = {};
    if (typeof nombre === 'string') {
      const nombreTrim = nombre.trim();
      if (!nombreTrim) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      const otro = await prisma.role.findFirst({ where: { nombre: nombreTrim, id: { not: id } } });
      if (otro) return res.status(400).json({ error: 'Ya existe otro rol con ese nombre' });
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
    res.json({
      id: updated.id,
      nombre: updated.nombre,
      descripcion: updated.descripcion,
      permisos: Array.isArray(updated.permisos) ? updated.permisos : [],
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar el rol' });
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
      return res.status(404).json({ error: 'Rol no encontrado' });
    }
    if (role._count.users > 0) {
      return res.status(400).json({
        error: `No se puede eliminar el rol porque tiene ${role._count.users} usuario(s) asignado(s). Reasigná otro rol a esos usuarios primero.`,
      });
    }
    await prisma.role.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar el rol' });
  }
});

export const rolesRouter = router;
