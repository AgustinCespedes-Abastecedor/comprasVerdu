/**
 * Ejecuta el CLI de Capacitor con el mismo intérprete Node que este script
 * (`process.execPath`). Evita fallos cuando `cap` en PATH resuelve a otro Node
 * distinto del que usa npm (p. ej. shebang + PATH inconsistente).
 *
 * Uso: node scripts/run-cap.mjs sync android
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, '..');
const capacitorCli = path.join(
  frontendRoot,
  'node_modules',
  '@capacitor',
  'cli',
  'bin',
  'capacitor',
);
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'Uso: node scripts/run-cap.mjs <subcomando> [...]  ej: sync android',
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [capacitorCli, ...args], {
  cwd: frontendRoot,
  stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
