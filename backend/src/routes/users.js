import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { soloGestionUsuarios } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';

const router = Router();

router.get('/', soloGestionUsuarios, async (req, res) => {
  try {
    const { q, roleId, activo } = req.query;
    const where = {};
    if (q && typeof q === 'string' && q.trim()) {
      where.OR = [
        { nombre: { contains: q.trim(), mode: 'insensitive' } },
        { email: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    if (roleId && typeof roleId === 'string' && roleId.trim()) {
      where.roleId = roleId.trim();
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: { nombre: 'asc' } }, { nombre: 'asc' }],
      select: {
        id: true,
        email: true,
        nombre: true,
        roleId: true,
        role: { select: { id: true, nombre: true } },
        createdAt: true,
        _count: { select: { compras: true } },
      },
    });
    let withActivo = users.map((u) => ({ ...u, activo: true }));
    try {
      const activoRows = await prisma.user.findMany({
        where: { id: { in: users.map((u) => u.id) } },
        select: { id: true, activo: true },
      });
      const activoMap = Object.fromEntries(activoRows.map((r) => [r.id, r.activo]));
      withActivo = users.map((u) => ({ ...u, activo: activoMap[u.id] !== false }));
    } catch (_) {
      /* columna activo puede no existir aún */
    }
    if (activo === 'true' || activo === '1') withActivo = withActivo.filter((u) => u.activo !== false);
    else if (activo === 'false' || activo === '0') withActivo = withActivo.filter((u) => u.activo === false);
    const list = withActivo.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      roleId: u.roleId,
      rol: u.role?.nombre ?? '',
      activo: u.activo !== false,
      createdAt: u.createdAt,
      _count: u._count,
    }));
    res.json(list);
  } catch (e) {
    sendError(res, 500, MSG.USERS_LISTAR, 'USERS_001', e);
  }
});

router.post('/', soloGestionUsuarios, async (req, res) => {
  try {
    const { email, password, nombre, roleId } = req.body;
    if (!email || !password || !nombre) {
      return sendError(res, 400, MSG.USERS_NOMBRE_EMAIL_PASSWORD, 'USERS_002');
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!emailNorm) return sendError(res, 400, MSG.USERS_EMAIL_INVALIDO, 'USERS_003');
    const existe = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existe) return sendError(res, 400, MSG.USERS_EMAIL_DUPLICADO, 'USERS_004');
    if (!roleId || typeof roleId !== 'string') {
      return sendError(res, 400, MSG.USERS_ROL_OBLIGATORIO, 'USERS_005');
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return sendError(res, 400, MSG.USERS_ROL_INVALIDO, 'USERS_006');
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hash,
        nombre: String(nombre).trim(),
        roleId: role.id,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        roleId: true,
        role: { select: { id: true, nombre: true } },
        createdAt: true,
      },
    });
    if (req.userId) {
      await createLog(prisma, {
        userId: req.userId,
        action: 'crear',
        entity: 'usuario',
        entityId: user.id,
        details: { nombre: user.nombre, email: user.email, rol: user.role?.nombre },
      });
    }
    res.status(201).json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      roleId: user.roleId,
      rol: user.role?.nombre ?? '',
      createdAt: user.createdAt,
    });
  } catch (e) {
    sendError(res, 500, MSG.USERS_CREAR, 'USERS_007', e);
  }
});

router.patch('/:id', soloGestionUsuarios, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, roleId, password, activo } = req.body;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: { select: { id: true, nombre: true } } },
    });
    if (!user) return sendError(res, 404, MSG.USERS_NO_ENCONTRADO, 'USERS_008');
    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (email !== undefined) {
      const emailNorm = String(email).trim().toLowerCase();
      if (!emailNorm) return sendError(res, 400, MSG.USERS_EMAIL_INVALIDO, 'USERS_009');
      if (emailNorm !== user.email) {
        const existe = await prisma.user.findUnique({ where: { email: emailNorm } });
        if (existe) return sendError(res, 400, MSG.USERS_EMAIL_DUPLICADO, 'USERS_010');
        data.email = emailNorm;
      }
    }
    if (activo !== undefined) data.activo = Boolean(activo);
    if (roleId !== undefined && typeof roleId === 'string') {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) return sendError(res, 400, MSG.USERS_ROL_INVALIDO, 'USERS_011');
      data.roleId = roleId;
    }
    if (password !== undefined && String(password).length > 0) {
      data.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(data).length === 0) {
      return res.json({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        roleId: user.roleId,
        rol: user.role?.nombre ?? '',
        activo: user.activo,
        createdAt: user.createdAt,
      });
    }
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        nombre: true,
        roleId: true,
        activo: true,
        role: { select: { id: true, nombre: true } },
        createdAt: true,
      },
    });
    if (req.userId) {
      await createLog(prisma, {
        userId: req.userId,
        action: 'actualizar',
        entity: 'usuario',
        entityId: updated.id,
        details: {
          nombre: updated.nombre,
          email: updated.email,
          rol: updated.role?.nombre,
          activo: updated.activo,
        },
      });
    }
    res.json({
      id: updated.id,
      email: updated.email,
      nombre: updated.nombre,
      roleId: updated.roleId,
      rol: updated.role?.nombre ?? '',
      activo: updated.activo,
      createdAt: updated.createdAt,
    });
  } catch (e) {
    sendError(res, 500, MSG.USERS_ACTUALIZAR, 'USERS_012', e);
  }
});

export const usersRouter = router;
