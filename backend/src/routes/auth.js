import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { sendError, MSG } from '../lib/errors.js';
import { getPrismaConnectionFailureResponse } from '../lib/prismaConnection.js';
import { getJwtSecret } from '../lib/config.js';
import { validateEmail, validatePassword, validateNombre } from '../lib/validation.js';
import { isExternalAuthLoginEnabled } from '../lib/configAuthExterno.js';
import {
  fetchUsuarioExternoPorLogin,
  verifyUsuarioPassword,
  getExternalUsuariosPasswordMode,
} from '../lib/usuariosSqlServer.js';
import { mapNivelToRoleNombre } from '../lib/nivelRol.js';
import { ensurePrismaUserFromExterno } from '../lib/syncUsuarioExterno.js';
import { resolvePrismaEmailForExternoUser } from '../lib/resolveExternoLoginEmail.js';

const router = Router();
const TOKEN_EXPIRY = '7d';

export const authRouter = router;

/** Público: el front oculta registro si el login es solo por ELABASTECEDOR. */
router.get('/config', (_req, res) => {
  res.json({ externalAuthLogin: isExternalAuthLoginEnabled() });
});

router.post('/registro', async (req, res) => {
  try {
    if (isExternalAuthLoginEnabled()) {
      return sendError(res, 403, MSG.AUTH_REGISTRO_DESHABILITADO, 'AUTH_030');
    }
    const { email, password, nombre, roleId } = req.body;
    if (!email || !password || !nombre) {
      return sendError(res, 400, MSG.AUTH_FALTAN_DATOS, 'AUTH_001');
    }
    const emailStr = String(email).trim().toLowerCase();
    const nombreStr = String(nombre).trim();
    const emailVal = validateEmail(emailStr);
    if (!emailVal.ok) {
      if (emailVal.error === 'too_long') return sendError(res, 400, MSG.AUTH_EMAIL_LARGO, 'AUTH_024');
      return sendError(res, 400, MSG.AUTH_FALTAN_DATOS, 'AUTH_001');
    }
    const pwdVal = validatePassword(password);
    if (!pwdVal.ok) {
      if (pwdVal.error === 'too_short') return sendError(res, 400, MSG.AUTH_PASSWORD_CORTA, 'AUTH_025');
      if (pwdVal.error === 'too_long') return sendError(res, 400, MSG.AUTH_PASSWORD_LARGA, 'AUTH_026');
    }
    const nomVal = validateNombre(nombreStr);
    if (!nomVal.ok) {
      if (nomVal.error === 'too_long') return sendError(res, 400, MSG.AUTH_NOMBRE_LARGO, 'AUTH_027');
    }
    const existe = await prisma.user.findUnique({ where: { email: emailStr } });
    if (existe) return sendError(res, 400, MSG.AUTH_EMAIL_REGISTRADO, 'AUTH_002');
    // En registro público solo se permite rol Visor o Comprador (por roleId o por rol legado)
    let role = null;
    if (roleId && typeof roleId === 'string') {
      role = await prisma.role.findUnique({ where: { id: roleId } });
      const nombreRol = role?.nombre?.toLowerCase();
      if (nombreRol && nombreRol !== 'visor' && nombreRol !== 'comprador' && nombreRol !== 'recepcionista') {
        role = null; // no permitir Admin en registro público
      }
    }
    if (!role && req.body.rol === 'VISOR') {
      role = await prisma.role.findFirst({ where: { nombre: 'Visor' } });
    }
    if (!role && req.body.rol === 'RECEPCIONISTA') {
      role = await prisma.role.findFirst({ where: { nombre: 'Recepcionista' } });
    }
    if (!role) {
      role = await prisma.role.findFirst({ where: { nombre: 'Comprador' } });
      if (!role) role = await prisma.role.findFirst({ where: { nombre: 'Visor' } });
    }
    if (!role) return sendError(res, 400, MSG.AUTH_ROL_NO_DISPONIBLE, 'AUTH_003');
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailStr,
        password: hash,
        nombre: nombreStr,
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
      getJwtSecret(),
      { expiresIn: TOKEN_EXPIRY }
    );
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        externUserId: null,
        role: { id: user.role.id, nombre: user.role.nombre, permisos },
      },
      token,
    });
  } catch (e) {
    const conn = getPrismaConnectionFailureResponse(e);
    if (conn) {
      return sendError(res, conn.status, conn.message, conn.clientCode, e);
    }
    sendError(res, 500, MSG.ERROR_SERVIDOR, 'AUTH_004', e);
  }
});

router.post('/login', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return sendError(res, 400, MSG.AUTH_EMAIL_PASSWORD_REQUERIDOS, 'AUTH_005');
    }
    const emailVal = validateEmail(email);
    if (!emailVal.ok) {
      if (emailVal.error === 'too_long') return sendError(res, 400, MSG.AUTH_EMAIL_LARGO, 'AUTH_028');
      if (!isExternalAuthLoginEnabled() && emailVal.error === 'invalid') {
        return sendError(res, 400, MSG.AUTH_FALTAN_DATOS, 'AUTH_001');
      }
    }
    const pwdVal = validatePassword(password);
    if (!pwdVal.ok) {
      if (pwdVal.error === 'too_short') return sendError(res, 400, MSG.AUTH_EMAIL_PASSWORD_REQUERIDOS, 'AUTH_005');
      if (pwdVal.error === 'too_long') return sendError(res, 400, MSG.AUTH_PASSWORD_LARGA, 'AUTH_029');
    }

    if (isExternalAuthLoginEnabled()) {
      let row;
      try {
        row = await fetchUsuarioExternoPorLogin(email);
      } catch (e) {
        return sendError(res, 503, MSG.AUTH_SQL_NO_DISPONIBLE, 'AUTH_040', e);
      }
      if (!row) {
        return sendError(res, 401, MSG.AUTH_CREDENCIALES, 'AUTH_006');
      }
      const mode = getExternalUsuariosPasswordMode();
      const matchExt = await verifyUsuarioPassword(password, row.passwordStored, mode);
      if (!matchExt) {
        return sendError(res, 401, MSG.AUTH_CREDENCIALES, 'AUTH_009');
      }
      const roleNombre = mapNivelToRoleNombre(row.nivel);
      if (!roleNombre) {
        return sendError(res, 403, MSG.AUTH_NIVEL_SIN_ACCESO, 'AUTH_041');
      }
      const role = await prisma.role.findUnique({ where: { nombre: roleNombre } });
      if (!role) {
        return sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_042', { roleNombre });
      }
      let user;
      try {
        const prismaEmail = resolvePrismaEmailForExternoUser(email, row.loginMail);
        user = await ensurePrismaUserFromExterno({
          externUserId: row.externUserId,
          emailNorm: prismaEmail,
          nombre: row.nombre,
          roleId: role.id,
        });
      } catch (e) {
        if (e.code === 'SYNC_USER_EMAIL_USO_LOCAL') {
          return sendError(res, 409, MSG.AUTH_EMAIL_CONFLICTO_IDENTIDAD, 'AUTH_043', e);
        }
        return sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_044', e);
      }
      if (user.activo === false) {
        return sendError(res, 403, MSG.AUTH_CUENTA_SUSPENDIDA, 'AUTH_007');
      }
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: TOKEN_EXPIRY }
      );
      const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
      res.json({
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          externUserId: user.externUserId ?? null,
          role: { id: user.role.id, nombre: user.role.nombre, permisos },
        },
        token,
      });
      return;
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
    if (user.externUserId) {
      return sendError(res, 403, MSG.AUTH_CUENTA_SOLO_EXTERNA, 'AUTH_046');
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
      getJwtSecret(),
      { expiresIn: TOKEN_EXPIRY }
    );
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        externUserId: user.externUserId ?? null,
        role: { id: user.role.id, nombre: user.role.nombre, permisos },
      },
      token,
    });
  } catch (e) {
    const conn = getPrismaConnectionFailureResponse(e);
    if (conn) {
      return sendError(res, conn.status, conn.message, conn.clientCode, e);
    }
    sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_010', e);
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 401, MSG.AUTH_TOKEN_FALTA, 'AUTH_011');
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), getJwtSecret());
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        externUserId: true,
        role: { select: { id: true, nombre: true, permisos: true } },
      },
    });
    if (!user) return sendError(res, 401, MSG.AUTH_USUARIO_NO_EXISTE, 'AUTH_012');
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      externUserId: user.externUserId ?? null,
      role: user.role ? { id: user.role.id, nombre: user.role.nombre, permisos } : null,
    });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return sendError(res, 401, MSG.AUTH_TOKEN_INVALIDO, 'AUTH_013');
    }
    const conn = getPrismaConnectionFailureResponse(e);
    if (conn) {
      return sendError(res, conn.status, conn.message, conn.clientCode, e);
    }
    return sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_014', e);
  }
});
