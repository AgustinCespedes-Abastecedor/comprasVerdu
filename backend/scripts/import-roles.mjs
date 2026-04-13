#!/usr/bin/env node
/**
 * Importa/actualiza roles por nombre único (upsert). No borra roles que no estén en el JSON.
 * Uso: DATABASE_URL=... node scripts/import-roles.mjs roles-export.json
 *       npm run db:import-roles -- roles-export.json
 */
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { TODOS_LOS_PERMISOS } from '../src/lib/permisos.js';

const prisma = new PrismaClient();

/** Lee UTF-8 o UTF-16 LE (p. ej. redirección PowerShell en Windows). */
function readTextFile(abs) {
  const buf = fs.readFileSync(abs);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString('utf16le');
  }
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function filterPermisos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => typeof p === 'string' && TODOS_LOS_PERMISOS.includes(p));
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Uso: node scripts/import-roles.mjs <archivo.json>');
    console.error('Ejemplo: npm run db:import-roles -- ./roles-export.json');
    process.exit(1);
  }
  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const text = readTextFile(abs);
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    console.error('El JSON debe ser un array de { nombre, descripcion?, permisos? }');
    process.exit(1);
  }

  let n = 0;
  for (const r of data) {
    const nombre = typeof r.nombre === 'string' ? r.nombre.trim() : '';
    if (!nombre) {
      console.warn('Omitido: entrada sin nombre válido');
      continue;
    }
    const descripcion = typeof r.descripcion === 'string' ? r.descripcion.trim() || null : null;
    const permisos = filterPermisos(r.permisos);

    await prisma.role.upsert({
      where: { nombre },
      update: { descripcion, permisos },
      create: { nombre, descripcion, permisos },
    });
    n += 1;
  }

  console.log(`Roles importados/actualizados: ${n} (según nombre único).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
