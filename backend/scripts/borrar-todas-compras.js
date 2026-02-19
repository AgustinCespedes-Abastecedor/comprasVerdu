/**
 * Borra todas las compras y datos relacionados (recepciones, detalles).
 * Orden: DetalleRecepcion → Recepcion → DetalleCompra → Compra.
 * Ejecutar desde la raíz del backend: node scripts/borrar-todas-compras.js
 *
 * Si el backend está corriendo, cerrarlo antes para evitar bloqueos.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Borrando todas las compras y datos relacionados...\n');

  if (typeof prisma.detalleRecepcion?.deleteMany !== 'function') {
    await borrarConSql();
    return;
  }

  try {
    const dr = await prisma.detalleRecepcion.deleteMany({});
    console.log(`  DetalleRecepcion: ${dr.count} filas eliminadas`);
    const r = await prisma.recepcion.deleteMany({});
    console.log(`  Recepcion: ${r.count} filas eliminadas`);
    const dc = await prisma.detalleCompra.deleteMany({});
    console.log(`  DetalleCompra: ${dc.count} filas eliminadas`);
    const c = await prisma.compra.deleteMany({});
    console.log(`  Compra: ${c.count} filas eliminadas`);
    console.log('\nListo. La base quedó sin compras.');
  } catch (e) {
    console.log('  Fallback a SQL directo...\n');
    await borrarConSql();
  }
}

/** Fallback con SQL. Borra solo las tablas que existan (DetalleRecepcion/Recepcion pueden no existir). */
async function borrarConSql() {
  console.log('  (usando SQL directo)\n');
  const run = async (sql, label) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ${label}: eliminadas`);
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) {
        console.log(`  ${label}: (tabla no existe, se omite)`);
      } else {
        throw e;
      }
    }
  };
  await run('DELETE FROM "DetalleRecepcion"', 'DetalleRecepcion');
  await run('DELETE FROM "Recepcion"', 'Recepcion');
  await run('DELETE FROM "DetalleCompra"', 'DetalleCompra');
  await run('DELETE FROM "Compra"', 'Compra');
  console.log('\nListo. La base quedó sin compras.');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
