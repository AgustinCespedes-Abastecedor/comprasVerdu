/**
 * Elimina `frontend/dist` antes de `vite build`.
 * Evita que queden chunks JS/CSS viejos mezclados con hashes nuevos
 * (síntoma típico en APK: UI/login desactualizado respecto al repo).
 */
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

if (!existsSync(distDir)) {
  console.log('[clean-dist] No hay carpeta dist; se omite.');
  process.exit(0);
}

rmSync(distDir, { recursive: true, force: true });
console.log('[clean-dist] Eliminado frontend/dist');
