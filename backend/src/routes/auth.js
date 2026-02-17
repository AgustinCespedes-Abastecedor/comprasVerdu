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
    const { email, password, nombre, rol } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Faltan email, password o nombre' });
    }
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        nombre,
        rol: rol === 'VISOR' ? 'VISOR' : 'COMPRADOR',
      },
      select: { id: true, email: true, nombre: true, rol: true },
    });
    const token = jwt.sign(
      { userId: user.id, rol: user.rol, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    res.status(201).json({ user, token });
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
    const user = await prisma.user.findUnique({ where: { email } });
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
      { userId: user.id, rol: user.rol, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    res.json({
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
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
      select: { id: true, email: true, nombre: true, rol: true },
    });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
});
