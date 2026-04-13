/**
 * Mapea Nivel (tabla Usuarios en ELABASTECEDOR) al nombre de rol en Postgres (modelo Role).
 * Rangos por defecto (configurables por env):
 * - Recepcionista: 10–20
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

export const NIVEL_RECEP_MIN = () => intEnv('EXTERNAL_NIVEL_RECEP_MIN', 10);
export const NIVEL_RECEP_MAX = () => intEnv('EXTERNAL_NIVEL_RECEP_MAX', 20);
/**
 * Mínimo de Nivel ELAB para permitir login externo (además de Habilitado en SQL).
 * Por defecto 10: alineado con Recepcionista 10–20 y con niveles superiores (Comprador, etc.).
 */
export const NIVEL_LOGIN_MIN = () => intEnv('EXTERNAL_NIVEL_LOGIN_MIN', 10);
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
 * Roles cuyo criterio en esta app es el campo Nivel en ELABASTECEDOR.
 * No se suman al contador del badge las cuentas solo-Postgres (`externUserId` null) con ese `roleId`,
 * para que coincida con un SELECT por Nivel en `Usuarios` sin inflar por registros locales.
 */
export const ROLES_ASIGNADOS_SOLO_POR_NIVEL = new Set([
  ROL_RECEPCIONISTA,
  ROL_COMPRADOR,
  ROL_ADMINISTRATIVO,
  ROL_ADMINISTRADOR,
]);

/**
 * @param {unknown} nivelRaw — valor desde SQL (int, decimal, varchar)
 * @returns {number} entero truncado o NaN
 */
export function parseNivelEntero(nivelRaw) {
  if (typeof nivelRaw === 'number' && !Number.isNaN(nivelRaw)) {
    return Math.trunc(nivelRaw);
  }
  return parseInt(String(nivelRaw ?? '').trim(), 10);
}

/**
 * Regla de login externo: Nivel ≥ mínimo configurado. El filtro Habilitado aplica en SQL (`fetchUsuarioExternoPorLogin`).
 * @param {unknown} nivelRaw
 * @returns {boolean}
 */
export function isNivelPermitidoLoginExterno(nivelRaw) {
  const n = parseNivelEntero(nivelRaw);
  if (Number.isNaN(n)) return false;
  return n >= NIVEL_LOGIN_MIN();
}

/**
 * @param {unknown} nivelRaw — valor desde SQL (int, decimal, varchar)
 * @returns {string|null} nombre de rol en Prisma o null si el nivel no habilita acceso
 */
export function mapNivelToRoleNombre(nivelRaw) {
  const n = parseNivelEntero(nivelRaw);
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
