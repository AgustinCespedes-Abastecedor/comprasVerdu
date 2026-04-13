/**
 * Desarrollo local: crea backend/.env desde .env.example si no existe.
 * No sobrescribe un .env ya presente. No afecta producción (Compose usa su propio env).
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, 'backend', '.env');
const examplePath = join(root, 'backend', '.env.example');

if (!existsSync(envPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, envPath);
  console.log('[setup] Creado backend/.env desde backend/.env.example (revisá DATABASE_URL si hace falta).');
}
