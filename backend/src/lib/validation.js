/**
 * Límites y validación de entradas para auth y usuarios.
 * Una sola fuente de verdad para longitudes y reglas.
 */

export const LIMITS = {
  EMAIL_MAX_LENGTH: 255,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NOMBRE_MAX_LENGTH: 200,
};

const EMAIL_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida email: no vacío, longitud máxima, formato básico.
 * @param {string} email
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateEmail(email) {
  const s = typeof email === 'string' ? email.trim() : '';
  if (!s) return { ok: false, error: 'empty' };
  if (s.length > LIMITS.EMAIL_MAX_LENGTH) return { ok: false, error: 'too_long' };
  if (!EMAIL_SIMPLE.test(s)) return { ok: false, error: 'invalid' };
  return { ok: true };
}

/**
 * Valida contraseña: longitud mínima y máxima.
 * @param {string} password
 * @returns {{ ok: boolean, error?: 'too_short'|'too_long' }}
 */
export function validatePassword(password) {
  const len = typeof password === 'string' ? password.length : 0;
  if (len < LIMITS.PASSWORD_MIN_LENGTH) return { ok: false, error: 'too_short' };
  if (len > LIMITS.PASSWORD_MAX_LENGTH) return { ok: false, error: 'too_long' };
  return { ok: true };
}

/**
 * Valida nombre: no vacío después de trim, longitud máxima.
 * @param {string} nombre
 * @returns {{ ok: boolean, error?: 'empty'|'too_long' }}
 */
export function validateNombre(nombre) {
  const s = typeof nombre === 'string' ? nombre.trim() : '';
  if (!s) return { ok: false, error: 'empty' };
  if (s.length > LIMITS.NOMBRE_MAX_LENGTH) return { ok: false, error: 'too_long' };
  return { ok: true };
}
