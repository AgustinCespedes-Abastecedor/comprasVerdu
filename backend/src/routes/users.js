import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { soloGestionUsuarios } from '../middleware/auth.js';
import { sendError, MSG } from '../lib/errors.js';
import { createLog } from '../lib/logs.js';
import { validateEmail, validatePassword, validateNombre } from '../lib/validation.js';
import { isExternalAuthLoginEnabled } from '../lib/configAuthExterno.js';
import { getMergedUsersForGestion } from '../lib/usuariosListMerged.js';
import { fetchUsuarioExternoDetallePorCodigo } from '../lib/usuariosSqlServer.js';
import { parseOffsetPagination, wantsPagedEnvelope } from '../lib/listPagination.js';

const router = Router();

/** Detalle de usuario en ELABASTECEDOR (debe ir antes de rutas /:id si se agregan GET por id). */
router.get('/extern/:externUserId/elab', soloGestionUsuarios, async (req, res) => {
  try {
    if (!isExternalAuthLoginEnabled()) {
      return sendError(res, 404, MSG.USERS_NO_ENCONTRADO, 'USERS_027');
    }
    const externUserId = String(req.params.externUserId ?? '').trim();
    if (!externUserId) {
      return sendError(res, 400, MSG.USERS_NO_ENCONTRADO, 'USERS_008');
    }
    const row = await fetchUsuarioExternoDetallePorCodigo(externUserId);
    if (!row) {
      return sendError(res, 404, MSG.USERS_NO_ENCONTRADO, 'USERS_008');
    }
    return res.json(row);
  } catch (e) {
    return sendError(res, 503, MSG.USERS_SQL_DETALLE, 'USERS_026', e);
  }
});

router.get('/', soloGestionUsuarios, async (req, res) => {
  try {
    const { q, roleId, activo } = req.query;

    if (isExternalAuthLoginEnabled()) {
      try {
        const list = await getMergedUsersForGestion({ q, roleId, activo });
        if (!wantsPagedEnvelope(req.query)) {
          return res.json(list);
        }
        const { page, pageSize, skip } = parseOffsetPagination(req.query);
        const total = list.length;
        const items = list.slice(skip, skip + pageSize);
        return res.json({ items, total, page, pageSize });
      } catch (e) {
        return sendError(res, 503, MSG.USERS_SQL_LISTAR, 'USERS_024', e);
      }
    }

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
    if (activo === 'true' || activo === '1') where.activo = true;
    else if (activo === 'false' || activo === '0') where.activo = false;

    const orderBy = [{ role: { nombre: 'asc' } }, { nombre: 'asc' }];
    const select = {
      id: true,
      email: true,
      nombre: true,
      externUserId: true,
      roleId: true,
      activo: true,
      role: { select: { id: true, nombre: true } },
      createdAt: true,
      _count: { select: { compras: true } },
    };

    const mapUserRow = (u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      externUserId: u.externUserId ?? null,
      roleId: u.roleId,
      rol: u.role?.nombre ?? '',
      activo: u.activo !== false,
      createdAt: u.createdAt,
      _count: u._count,
    });

    if (wantsPagedEnvelope(req.query)) {
      const { page, pageSize, skip } = parseOffsetPagination(req.query);
      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          select,
        }),
      ]);
      const items = users.map(mapUserRow);
      return res.json({ items, total, page, pageSize });
    }

    const users = await prisma.user.findMany({
      where,
      orderBy,
      select,
    });
    res.json(users.map(mapUserRow));
  } catch (e) {
    sendError(res, 500, MSG.USERS_LISTAR, 'USERS_001', e);
  }
});

/**
 * GET /users/:id/resumen — Nombre y email para selectores (p. ej. Historial de actividad).
 * Debe declararse antes de PATCH /:id.
 */
router.get('/:id/resumen', soloGestionUsuarios, async (req, res) => {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      return sendError(res, 400, MSG.USERS_RESUMEN, 'USERS_028');
    }
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, nombre: true, email: true },
    });
    if (!user) {
      return sendError(res, 404, MSG.USERS_NO_ENCONTRADO, 'USERS_008');
    }
    return res.json(user);
  } catch (e) {
    return sendError(res, 500, MSG.USERS_RESUMEN, 'USERS_029', e);
  }
});

router.post('/', soloGestionUsuarios, async (req, res) => {
  try {
    if (isExternalAuthLoginEnabled()) {
      return sendError(res, 403, MSG.USERS_EXTERNO_NO_CREAR, 'USERS_021');
    }
    const { email, password, nombre, roleId } = req.body;
    if (!email || !password || !nombre) {
      return sendError(res, 400, MSG.USERS_NOMBRE_EMAIL_PASSWORD, 'USERS_002');
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!emailNorm) return sendError(res, 400, MSG.USERS_EMAIL_INVALIDO, 'USERS_003');
    const emailVal = validateEmail(emailNorm);
    if (!emailVal.ok) {
      if (emailVal.error === 'too_long') return sendError(res, 400, MSG.USERS_EMAIL_LARGO, 'USERS_012');
      return sendError(res, 400, MSG.USERS_EMAIL_INVALIDO, 'USERS_003');
    }
    const pwdVal = validatePassword(password);
    if (!pwdVal.ok) {
      if (pwdVal.error === 'too_short') return sendError(res, 400, MSG.USERS_PASSWORD_CORTA, 'USERS_013');
      if (pwdVal.error === 'too_long') return sendError(res, 400, MSG.USERS_PASSWORD_LARGA, 'USERS_014');
    }
    const nomVal = validateNombre(String(nombre).trim());
    if (!nomVal.ok) {
      if (nomVal.error === 'too_long') return sendError(res, 400, MSG.USERS_NOMBRE_LARGO, 'USERS_015');
    }
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
    if (isExternalAuthLoginEnabled() && activo !== undefined) {
      return sendError(res, 403, MSG.USERS_ACTIVO_SOLO_ERP, 'USERS_023');
    }
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: { select: { id: true, nombre: true } } },
    });
    if (!user) return sendError(res, 404, MSG.USERS_NO_ENCONTRADO, 'USERS_008');
    if (user.externUserId) {
      const pwdStr = password !== undefined ? String(password) : '';
      const triesEditIdentity =
        nombre !== undefined
        || email !== undefined
        || roleId !== undefined
        || pwdStr.length > 0;
      if (triesEditIdentity) {
        return sendError(res, 403, MSG.USERS_EXTERNO_NO_EDITAR, 'USERS_022');
      }
    }
    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (nombre !== undefined) {
      const nomVal = validateNombre(String(nombre).trim());
      if (!nomVal.ok) {
        if (nomVal.error === 'too_long') return sendError(res, 400, MSG.USERS_NOMBRE_LARGO, 'USERS_017');
      }
    }
    if (email !== undefined) {
      const emailNorm = String(email).trim().toLowerCase();
      if (!emailNorm) return sendError(res, 400, MSG.USERS_EMAIL_INVALIDO, 'USERS_009');
      const emailVal = validateEmail(emailNorm);
      if (!emailVal.ok) {
        if (emailVal.error === 'too_long') return sendError(res, 400, MSG.USERS_EMAIL_LARGO, 'USERS_016');
        return sendError(res, 400, MSG.USERS_EMAIL_INVALIDO, 'USERS_009');
      }
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
      const pwdVal = validatePassword(password);
      if (!pwdVal.ok) {
        if (pwdVal.error === 'too_short') return sendError(res, 400, MSG.USERS_PASSWORD_CORTA, 'USERS_018');
        if (pwdVal.error === 'too_long') return sendError(res, 400, MSG.USERS_PASSWORD_LARGA, 'USERS_019');
      }
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
    sendError(res, 500, MSG.USERS_ACTUALIZAR, 'USERS_020', e);
  }
});

export const usersRouter = router;
