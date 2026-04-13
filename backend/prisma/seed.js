/**
 * Seed mínimo: solo roles en Postgres (permisos de la app).
 * Los usuarios y contraseñas vienen exclusivamente de ELABASTECEDOR (SQL Server) cuando EXTERNAL_AUTH_LOGIN=true.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES_DEFAULT = [
  {
    nombre: 'Administrador',
    descripcion: 'Acceso total. En ELABASTECEDOR: Nivel = EXTERNAL_NIVEL_ADMIN_SISTEMA (por defecto 100).',
    permisos: ['home', 'comprar', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos', 'gestion-usuarios', 'gestion-roles'],
  },
  {
    nombre: 'Comprador',
    descripcion: 'Cargar compras. Nivel entre EXTERNAL_NIVEL_COMP_MIN y EXTERNAL_NIVEL_COMP_MAX (por defecto 25–30).',
    permisos: ['home', 'comprar', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Recepcionista',
    descripcion: 'Recepción de compras. Nivel entre EXTERNAL_NIVEL_RECEP_MIN y EXTERNAL_NIVEL_RECEP_MAX (por defecto 0–20).',
    permisos: ['home', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Administrativo',
    descripcion: 'Consultas. Nivel entre EXTERNAL_NIVEL_ADMIN_MIN y EXTERNAL_NIVEL_ADMIN_MAX (por defecto 35–40).',
    permisos: ['home', 'ver-compras', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Visor',
    descripcion: 'Solo lectura (reservado; el acceso típico se define por Nivel en ELABASTECEDOR).',
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
