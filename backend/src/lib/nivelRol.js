/**
 * Mapea Nivel (tabla Usuarios en ELABASTECEDOR) al nombre de rol en Postgres (modelo Role).
 * Rangos por defecto (configurables por env):
 * - Recepcionista: 0–20
 * - Comprador: 25–30
 * - Administrativo: 35–40 (consulta / info final post-proceso; sin ABM de usuarios/roles)
 * - Administrador (sistema): valor exacto configurable (por defecto Nivel = 100)
 */

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isNaN(n) ? fallback : n;
}

export const NIVEL_RECEP_MIN = () => intEnv('EXTERNAL_NIVEL_RECEP_MIN', 0);
export const NIVEL_RECEP_MAX = () => intEnv('EXTERNAL_NIVEL_RECEP_MAX', 20);
export const NIVEL_COMP_MIN = () => intEnv('EXTERNAL_NIVEL_COMP_MIN', 25);
export const NIVEL_COMP_MAX = () => intEnv('EXTERNAL_NIVEL_COMP_MAX', 30);
export const NIVEL_ADMIN_MIN = () => intEnv('EXTERNAL_NIVEL_ADMIN_MIN', 35);
export const NIVEL_ADMIN_MAX = () => intEnv('EXTERNAL_NIVEL_ADMIN_MAX', 40);
/** Nivel que otorga rol Administrador (gestión total en la app). Por defecto 100. */
export const NIVEL_ADMIN_SISTEMA = () => intEnv('EXTERNAL_NIVEL_ADMIN_SISTEMA', 100);

/** Nombres de rol en tabla Role (único, coincide con seed). */
export const ROL_RECEPCIONISTA = 'Recepcionista';
export const ROL_COMPRADOR = 'Comprador';
export const ROL_ADMINISTRATIVO = 'Administrativo';
export const ROL_ADMINISTRADOR = 'Administrador';

/**
 * @param {unknown} nivelRaw — valor desde SQL (int, decimal, varchar)
 * @returns {string|null} nombre de rol en Prisma o null si el nivel no habilita acceso
 */
export function mapNivelToRoleNombre(nivelRaw) {
  const n = typeof nivelRaw === 'number' && !Number.isNaN(nivelRaw)
    ? nivelRaw
    : parseInt(String(nivelRaw ?? '').trim(), 10);
  if (Number.isNaN(n)) return null;

  if (n === NIVEL_ADMIN_SISTEMA()) return ROL_ADMINISTRADOR;

  const rMin = NIVEL_RECEP_MIN();
  const rMax = NIVEL_RECEP_MAX();
  const cMin = NIVEL_COMP_MIN();
  const cMax = NIVEL_COMP_MAX();
  const aMin = NIVEL_ADMIN_MIN();
  const aMax = NIVEL_ADMIN_MAX();

  if (n >= rMin && n <= rMax) return ROL_RECEPCIONISTA;
  if (n >= cMin && n <= cMax) return ROL_COMPRADOR;
  if (n >= aMin && n <= aMax) return ROL_ADMINISTRATIVO;
  return null;
}
