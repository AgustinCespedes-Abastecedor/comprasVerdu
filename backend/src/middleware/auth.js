import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.rol = payload.rol;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

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
