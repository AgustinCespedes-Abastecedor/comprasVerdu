import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { soloAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', soloAdmin, async (req, res) => {
  try {
    const { q, rol } = req.query;
    const where = {};
    if (q && typeof q === 'string' && q.trim()) {
      const term = `%${q.trim().toLowerCase()}%`;
      where.OR = [
        { nombre: { contains: q.trim(), mode: 'insensitive' } },
        { email: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    if (rol && ['ADMIN', 'COMPRADOR', 'VISOR'].includes(rol)) {
      where.rol = rol;
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        createdAt: true,
        _count: { select: { compras: true } },
      },
    });
    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

router.post('/', soloAdmin, async (req, res) => {
  try {
    const { email, password, nombre, rol } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!emailNorm) return res.status(400).json({ error: 'Email inválido' });
    const existe = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existe) return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    const rolValido = ['ADMIN', 'COMPRADOR', 'VISOR'].includes(rol) ? rol : 'COMPRADOR';
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hash,
        nombre: String(nombre).trim(),
        rol: rolValido,
      },
      select: { id: true, email: true, nombre: true, rol: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.patch('/:id', soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, password } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (rol !== undefined && ['ADMIN', 'COMPRADOR', 'VISOR'].includes(rol)) data.rol = rol;
    if (password !== undefined && String(password).length > 0) {
      data.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(data).length === 0) {
      return res.json(user);
    }
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, nombre: true, rol: true, createdAt: true },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

export const usersRouter = router;
