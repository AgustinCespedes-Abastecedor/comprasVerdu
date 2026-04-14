/**
 * Ejecuta gradlew / gradlew.bat en android/ (multiplataforma).
 * Uso: node scripts/run-gradle.mjs assembleDebug
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, constants, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const androidDir = path.join(__dirname, '..', 'android');
const isWin = process.platform === 'win32';
const gradle = isWin ? path.join(androidDir, 'gradlew.bat') : path.join(androidDir, 'gradlew');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Uso: node scripts/run-gradle.mjs <tarea> [...]  ej: assembleDebug');
  process.exit(1);
}

if (!isWin && existsSync(gradle)) {
  try {
    const st = statSync(gradle);
    if ((st.mode & constants.S_IXUSR) === 0) {
      chmodSync(gradle, 0o755);
      console.warn('[run-gradle] gradlew sin bit de ejecución: se aplicó chmod +x (solo este clone).');
    }
  } catch {
    /* ignorar */
  }
}

const result = spawnSync(gradle, args, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
});

process.exit(result.status === null ? 1 : result.status);
