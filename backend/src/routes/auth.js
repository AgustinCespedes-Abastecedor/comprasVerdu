import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { sendError, MSG } from '../lib/errors.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';
const TOKEN_EXPIRY = '7d';

export const authRouter = router;

router.post('/registro', async (req, res) => {
  try {
    const { email, password, nombre, roleId } = req.body;
    if (!email || !password || !nombre) {
      return sendError(res, 400, MSG.AUTH_FALTAN_DATOS, 'AUTH_001');
    }
    const existe = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (existe) return sendError(res, 400, MSG.AUTH_EMAIL_REGISTRADO, 'AUTH_002');
    // En registro público solo se permite rol Visor o Comprador (por roleId o por rol legado)
    let role = null;
    if (roleId && typeof roleId === 'string') {
      role = await prisma.role.findUnique({ where: { id: roleId } });
      const nombreRol = role?.nombre?.toLowerCase();
      if (nombreRol && nombreRol !== 'visor' && nombreRol !== 'comprador') {
        role = null; // no permitir Admin en registro público
      }
    }
    if (!role && req.body.rol === 'VISOR') {
      role = await prisma.role.findFirst({ where: { nombre: 'Visor' } });
    }
    if (!role) {
      role = await prisma.role.findFirst({ where: { nombre: 'Comprador' } });
      if (!role) role = await prisma.role.findFirst({ where: { nombre: 'Visor' } });
    }
    if (!role) return sendError(res, 400, MSG.AUTH_ROL_NO_DISPONIBLE, 'AUTH_003');
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        nombre,
        roleId: role.id,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        role: { select: { id: true, nombre: true, permisos: true } },
      },
    });
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: { id: user.role.id, nombre: user.role.nombre, permisos },
      },
      token,
    });
  } catch (e) {
    sendError(res, 500, MSG.ERROR_SERVIDOR, 'AUTH_004', e);
  }
});

router.post('/login', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return sendError(res, 400, MSG.AUTH_EMAIL_PASSWORD_REQUERIDOS, 'AUTH_005');
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: { select: { id: true, nombre: true, permisos: true } } },
    });
    if (!user) {
      return sendError(res, 401, MSG.AUTH_CREDENCIALES, 'AUTH_006');
    }
    if (user.activo === false) {
      return sendError(res, 403, MSG.AUTH_CUENTA_SUSPENDIDA, 'AUTH_007');
    }
    const passwordHash = user.password;
    if (!passwordHash || typeof passwordHash !== 'string') {
      return sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_008', { userId: user.id });
    }
    const match = await bcrypt.compare(password, passwordHash);
    if (!match) {
      return sendError(res, 401, MSG.AUTH_CREDENCIALES, 'AUTH_009');
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: { id: user.role.id, nombre: user.role.nombre, permisos },
      },
      token,
    });
  } catch (e) {
    sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_010', e);
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 401, MSG.AUTH_TOKEN_FALTA, 'AUTH_011');
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        role: { select: { id: true, nombre: true, permisos: true } },
      },
    });
    if (!user) return sendError(res, 401, MSG.AUTH_USUARIO_NO_EXISTE, 'AUTH_012');
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role ? { id: user.role.id, nombre: user.role.nombre, permisos } : null,
    });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return sendError(res, 401, MSG.AUTH_TOKEN_INVALIDO, 'AUTH_013');
    }
    return sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_014', e);
  }
});
