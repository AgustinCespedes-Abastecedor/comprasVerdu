import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { tienePermiso } from '../lib/permisos.js';
import { sendError, MSG } from '../lib/errors.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';

/**
 * Carga usuario con rol y permisos. Asigna req.userId, req.rol (objeto Role), req.permisos (array de códigos).
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 401, MSG.AUTH_TOKEN_FALTA, 'AUTH_015');
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.userId;
    if (!userId) {
      return sendError(res, 401, MSG.AUTH_TOKEN_INVALIDO, 'AUTH_016');
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: {
          select: {
            id: true,
            nombre: true,
            permisos: true,
          },
        },
      },
    });
    if (!user) {
      return sendError(res, 401, MSG.AUTH_USUARIO_NO_EXISTE, 'AUTH_017');
    }
    req.userId = user.id;
    req.rol = user.role;
    const raw = user.role?.permisos;
    req.permisos = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [] : []);
    next();
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return sendError(res, 401, MSG.AUTH_TOKEN_INVALIDO, 'AUTH_018');
    }
    return sendError(res, 500, MSG.AUTH_SESION_ERROR, 'AUTH_019', e);
  }
}

/** Exige que el usuario tenga el permiso indicado. Usar después de authMiddleware. */
export function requierePermiso(codigo) {
  return (req, res, next) => {
    if (!req.permisos || !tienePermiso(req.permisos, codigo)) {
      return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_020');
    }
    next();
  };
}

/** Solo quien tiene permiso "gestion-roles" (típicamente Administrador). */
export const soloGestionRoles = requierePermiso('gestion-roles');

/** Solo quien tiene permiso "gestion-usuarios". */
export const soloGestionUsuarios = requierePermiso('gestion-usuarios');

/** Quien tenga permiso "logs" o "gestion-usuarios" (para ver historial de actividad). */
export function soloLogsOGestionUsuarios(req, res, next) {
  if (!req.permisos) return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_020');
  if (tienePermiso(req.permisos, 'logs') || tienePermiso(req.permisos, 'gestion-usuarios')) return next();
  return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_020');
}

/** Listar roles: quien tenga gestion-usuarios o gestion-roles. */
export function soloGestionUsuariosOroles(req, res, next) {
  if (!req.permisos) return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_021');
  if (tienePermiso(req.permisos, 'gestion-usuarios') || tienePermiso(req.permisos, 'gestion-roles')) return next();
  return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_022');
}

/** Solo quien tiene permiso "comprar" (crear compras). */
export const soloComprador = requierePermiso('comprar');

/** Solo quien tiene permiso "ver-compras" (listar y ver compras). */
export const soloVerCompras = requierePermiso('ver-compras');

/** Quien tenga comprar o ver-compras (para listar proveedores/productos usados en compras). */
export function soloComprarOVerCompras(req, res, next) {
  if (!req.permisos) return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_020');
  if (tienePermiso(req.permisos, 'comprar') || tienePermiso(req.permisos, 'ver-compras')) return next();
  return sendError(res, 403, MSG.AUTH_SIN_PERMISO, 'AUTH_020');
}

/** Solo quien tiene permiso "recepcion" (crear/actualizar recepciones y precios). */
export const soloRecepcion = requierePermiso('recepcion');

/** Solo quien tiene permiso "ver-recepciones" (listar recepciones). */
export const soloVerRecepciones = requierePermiso('ver-recepciones');

/** Solo quien tiene permiso "info-final-articulos" (ver y guardar UXB en info final). */
export const soloInfoFinalArticulos = requierePermiso('info-final-articulos');

/** Solo administrador: quien tiene "gestion-roles" (acceso total). */
export function soloAdmin(req, res, next) {
  if (!req.permisos || !tienePermiso(req.permisos, 'gestion-roles')) {
    return sendError(res, 403, MSG.AUTH_SOLO_ADMIN, 'AUTH_023');
  }
  next();
}

export async function getUser(req) {
  return prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      role: {
        select: {
          id: true,
          nombre: true,
          permisos: true,
        },
      },
    },
  });
}
