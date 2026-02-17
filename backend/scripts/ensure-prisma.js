/**
 * Ejecuta prisma generate. Si falla por EPERM (archivo bloqueado en Windows),
 * no falla el install; el usuario puede ejecutar "npm run db:generate" después
 * con el backend cerrado.
 */
import { execSync } from 'child_process';

try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (e) {
  const msg = (e.message || e.stderr?.toString() || String(e)).toLowerCase();
  if (e.code === 'EPERM' || msg.includes('eperm') || msg.includes('operation not permitted')) {
    console.warn('\n[backend] Prisma generate omitido (archivo en uso). Si el backend no arranca, ejecutá "npm run db:generate" con el servidor cerrado.\n');
    process.exit(0);
  }
  process.exit(e.status ?? 1);
}
