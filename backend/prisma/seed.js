/**
 * Seed mínimo: solo roles en Postgres (permisos de la app).
 * Los usuarios y contraseñas vienen exclusivamente de ELABASTECEDOR (SQL Server) cuando EXTERNAL_AUTH_LOGIN=true.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Textos breves: Nivel ELAB (ver nivelRol.js) + qué permite en la app. */
const ROLES_DEFAULT = [
  {
    nombre: 'Administrador',
    descripcion: 'Nivel ELAB: 100. Acceso total en la app, incluida gestión de usuarios y roles.',
    permisos: ['home', 'comprar', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos', 'gestion-usuarios', 'gestion-roles'],
  },
  {
    nombre: 'Comprador',
    descripcion: 'Nivel ELAB: 25–30. Compras, recepciones y consultas; sin gestión de usuarios.',
    permisos: ['home', 'comprar', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Recepcionista',
    descripcion: 'Nivel ELAB: 10–20. Recepción y consultas; no crea compras ni administra usuarios.',
    permisos: ['home', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Administrativo',
    descripcion: 'Nivel ELAB: 35–40. Solo consultas (compras, recepciones, info de artículos).',
    permisos: ['home', 'ver-compras', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Visor',
    descripcion: 'No se asigna por Nivel en ELAB. Solo lectura en la app (p. ej. registro local).',
    permisos: ['home', 'ver-compras', 'ver-recepciones', 'info-final-articulos'],
  },
];

async function main() {
  for (const r of ROLES_DEFAULT) {
    await prisma.role.upsert({
      where: { nombre: r.nombre },
      update: { descripcion: r.descripcion, permisos: r.permisos },
      create: { nombre: r.nombre, descripcion: r.descripcion, permisos: r.permisos },
    });
  }
  console.log('Seed de roles ejecutado correctamente (sin usuarios demo).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
