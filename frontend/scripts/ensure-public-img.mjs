/**
 * Antes de `vite build` para APK: si existe la carpeta `img/` en la raíz del monorepo
 * (gitignored en muchos entornos), la copia a `frontend/public/img/` para que las
 * miniaturas `/img/articulos/...` queden empaquetadas en `dist/`.
 *
 * Si no hay `img/` en la raíz, no hace nada (CI / clones sin assets locales).
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');
const destDir = join(frontendRoot, 'public', 'img');
const srcDir = join(frontendRoot, '..', 'img');

if (!existsSync(srcDir)) {
  console.log('[ensure-public-img] Sin carpeta raíz img/; se omite la copia.');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
cpSync(srcDir, destDir, { recursive: true });
console.log('[ensure-public-img] Copiado repo img/ → frontend/public/img/');
