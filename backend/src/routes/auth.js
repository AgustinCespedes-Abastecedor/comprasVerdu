import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';
const TOKEN_EXPIRY = '7d';

export const authRouter = router;

router.post('/registro', async (req, res) => {
  try {
    const { email, password, nombre, roleId } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Faltan email, password o nombre' });
    }
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });
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
    if (!role) return res.status(400).json({ error: 'No hay rol disponible para registro' });
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
    console.error(e);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: { select: { id: true, nombre: true, permisos: true } } },
    });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const passwordHash = user.password;
    if (!passwordHash || typeof passwordHash !== 'string') {
      console.error('Login: usuario sin password hasheado en BD', user.id);
      return res.status(500).json({ error: 'Error de configuración del usuario' });
    }
    const match = await bcrypt.compare(password, passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
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
    console.error('Error en POST /auth/login:', e);
    const isDev = process.env.NODE_ENV !== 'production';
    const message = isDev && e.message ? e.message : 'Error al iniciar sesión';
    res.status(500).json({ error: message });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
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
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    const permisos = Array.isArray(user.role?.permisos) ? user.role.permisos : [];
    res.json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role ? { id: user.role.id, nombre: user.role.nombre, permisos } : null,
    });
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
});
