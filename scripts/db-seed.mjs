/**
 * Punto único para poblar la base desde la raíz del monorepo.
 *
 * - Si el servicio `backend` del docker-compose de la raíz está en ejecución, ejecuta el seed
 *   **dentro del contenedor** (misma DB que la API; no hace falta publicar Postgres al host).
 * - Si no, delega en `backend` y usa `DATABASE_URL` de backend/.env (p. ej. tras `npm run dev:db`).
 */
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function isComposeBackendRunning() {
  try {
    const out = execSync('docker compose ps backend --status running --format {{.Name}}', {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

if (isComposeBackendRunning()) {
  execSync('docker compose exec -T backend npm run db:seed', {
    cwd: root,
    stdio: 'inherit',
  });
} else {
  console.log(
    '[db:seed] Backend Docker no detectado; ejecutando seed en el host según backend/.env (p. ej. Postgres de `npm run dev:db`).',
  );
  execSync('npm run db:seed', {
    cwd: join(root, 'backend'),
    stdio: 'inherit',
  });
}
