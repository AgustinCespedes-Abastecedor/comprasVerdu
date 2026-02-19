import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { tienePermiso } from '../lib/permisos.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';

/**
 * Carga usuario con rol y permisos. Asigna req.userId, req.rol (objeto Role), req.permisos (array de códigos).
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Token inválido' });
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
      return res.status(401).json({ error: 'Usuario ya no existe. Iniciá sesión de nuevo.' });
    }
    req.userId = user.id;
    req.rol = user.role;
    const raw = user.role?.permisos;
    req.permisos = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [] : []);
    next();
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Exige que el usuario tenga el permiso indicado. Usar después de authMiddleware. */
export function requierePermiso(codigo) {
  return (req, res, next) => {
    if (!req.permisos || !tienePermiso(req.permisos, codigo)) {
      return res.status(403).json({ error: 'No tenés permiso para acceder a esta función' });
    }
    next();
  };
}

/** Solo quien tiene permiso "gestion-roles" (típicamente Administrador). */
export const soloGestionRoles = requierePermiso('gestion-roles');

/** Solo quien tiene permiso "gestion-usuarios". */
export const soloGestionUsuarios = requierePermiso('gestion-usuarios');

/** Listar roles: quien tenga gestion-usuarios o gestion-roles. */
export function soloGestionUsuariosOroles(req, res, next) {
  if (!req.permisos) return res.status(403).json({ error: 'No tenés permiso para acceder' });
  if (tienePermiso(req.permisos, 'gestion-usuarios') || tienePermiso(req.permisos, 'gestion-roles')) return next();
  return res.status(403).json({ error: 'No tenés permiso para acceder' });
}

/** Solo quien tiene permiso "comprar" (crear compras). */
export const soloComprador = requierePermiso('comprar');

/** Solo administrador: quien tiene "gestion-roles" (acceso total). */
export function soloAdmin(req, res, next) {
  if (!req.permisos || !tienePermiso(req.permisos, 'gestion-roles')) {
    return res.status(403).json({ error: 'Solo administradores pueden acceder' });
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
