#!/usr/bin/env node
/**
 * Exporta todos los roles de la BD apuntada por DATABASE_URL (JSON).
 * Uso (localhost):  npm run db:export-roles > roles-export.json
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({ orderBy: { nombre: 'asc' } });
  const out = roles.map((r) => ({
    nombre: r.nombre,
    descripcion: r.descripcion,
    permisos: Array.isArray(r.permisos) ? r.permisos : [],
  }));
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
