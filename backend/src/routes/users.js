import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { soloGestionUsuarios } from '../middleware/auth.js';

const router = Router();

router.get('/', soloGestionUsuarios, async (req, res) => {
  try {
    const { q, roleId } = req.query;
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
    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: { nombre: 'asc' } }, { nombre: 'asc' }],
      select: {
        id: true,
        email: true,
        nombre: true,
        roleId: true,
        role: { select: { id: true, nombre: true } },
        createdAt: true,
        _count: { select: { compras: true } },
      },
    });
    const list = users.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      roleId: u.roleId,
      rol: u.role?.nombre ?? '',
      createdAt: u.createdAt,
      _count: u._count,
    }));
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

router.post('/', soloGestionUsuarios, async (req, res) => {
  try {
    const { email, password, nombre, roleId } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!emailNorm) return res.status(400).json({ error: 'Email inválido' });
    const existe = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existe) return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    if (!roleId || typeof roleId !== 'string') {
      return res.status(400).json({ error: 'Debe seleccionar un rol' });
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return res.status(400).json({ error: 'Rol no válido' });
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
    res.status(201).json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      roleId: user.roleId,
      rol: user.role?.nombre ?? '',
      createdAt: user.createdAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.patch('/:id', soloGestionUsuarios, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, roleId, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: { select: { id: true, nombre: true } } },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (roleId !== undefined && typeof roleId === 'string') {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) return res.status(400).json({ error: 'Rol no válido' });
      data.roleId = roleId;
    }
    if (password !== undefined && String(password).length > 0) {
      data.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(data).length === 0) {
      return res.json({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        roleId: user.roleId,
        rol: user.role?.nombre ?? '',
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
        role: { select: { id: true, nombre: true } },
        createdAt: true,
      },
    });
    res.json({
      id: updated.id,
      email: updated.email,
      nombre: updated.nombre,
      roleId: updated.roleId,
      rol: updated.role?.nombre ?? '',
      createdAt: updated.createdAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

export const usersRouter = router;
