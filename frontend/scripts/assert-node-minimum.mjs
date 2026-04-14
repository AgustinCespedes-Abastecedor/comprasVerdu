/**
 * Capacitor CLI 8 exige Node >= 22. Falla rápido antes de builds largos.
 * Omitir: SKIP_NODE_VERSION_CHECK=1 (no recomendado).
 */
const MIN_MAJOR = 22;

if (process.env.SKIP_NODE_VERSION_CHECK === '1') {
  console.warn('[node:check] SKIP_NODE_VERSION_CHECK=1 — comprobación omitida.');
  process.exit(0);
}

const major = Number.parseInt(process.version.slice(1).split('.')[0], 10);
if (Number.isNaN(major) || major < MIN_MAJOR) {
  console.error(
    `\n[node:check] Se requiere Node.js >= ${MIN_MAJOR}. Versión actual: ${process.version}.\n` +
      'Desde la raíz del repo: `bash scripts/install-node22-linux.sh` (instrucciones).\n' +
      'O `nvm install && nvm use` (.nvmrc = 22). APK sin actualizar Node: `npm run apk:docker` (Docker).\n',
  );
  process.exit(1);
}
