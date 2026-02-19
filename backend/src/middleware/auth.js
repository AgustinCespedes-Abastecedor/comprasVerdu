import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';

/**
 * Roles: ADMIN (todo), COMPRADOR (comprar + ver), VISOR (solo ver compras).
 * Ver docs/ROLES.md para la matriz de permisos.
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
      select: { id: true, rol: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'Usuario ya no existe. Iniciá sesión de nuevo.' });
    }
    req.userId = user.id;
    req.rol = user.rol;
    next();
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Solo COMPRADOR y ADMIN pueden crear/editar compras. VISOR recibe 403. */
export function soloComprador(req, res, next) {
  if (req.rol !== 'COMPRADOR' && req.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo usuarios compradores o administradores pueden realizar esta acción' });
  }
  next();
}

export function soloAdmin(req, res, next) {
  if (req.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo administradores pueden acceder' });
  }
  next();
}

export async function getUser(req) {
  return prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, nombre: true, rol: true },
  });
}
