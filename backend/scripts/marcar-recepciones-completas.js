/**
 * Marca como completa=true las recepciones que ya tienen todos los detalles
 * con precioVenta y margenPorc (para que aparezcan en Info Final de Artículos).
 * Ejecutar una vez: node scripts/marcar-recepciones-completas.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const recepciones = await prisma.recepcion.findMany({
    where: { completa: false },
    include: { detalles: { select: { precioVenta: true, margenPorc: true, uxb: true } } },
  });
  let updated = 0;
  for (const r of recepciones) {
    if (!r.detalles?.length) continue;
    const todosCompletos = r.detalles.every(
      (d) =>
        d.precioVenta != null &&
        d.margenPorc != null &&
        Number(d.uxb) > 0
    );
    if (todosCompletos) {
      await prisma.recepcion.update({
        where: { id: r.id },
        data: { completa: true },
      });
      updated++;
      console.log(`Recepción ${r.numeroRecepcion ?? r.id} marcada como completa`);
    }
  }
  console.log(`Listo. ${updated} recepciones actualizadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
