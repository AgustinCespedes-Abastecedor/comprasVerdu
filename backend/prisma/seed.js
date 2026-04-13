/**
 * Seed mínimo: solo roles en Postgres (permisos de la app).
 * Los usuarios y contraseñas vienen exclusivamente de ELABASTECEDOR (SQL Server) cuando EXTERNAL_AUTH_LOGIN=true.
 */
import { PrismaClient } from '@prisma/client';
import { ROLES_DEFAULT } from './rolesCatalog.js';

const prisma = new PrismaClient();

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
