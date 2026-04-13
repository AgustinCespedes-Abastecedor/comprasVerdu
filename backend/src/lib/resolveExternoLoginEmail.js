import { validateEmail } from './validation.js';

/**
 * Email guardado en Postgres para usuarios externos: si el usuario ingresa el código (Usuario),
 * usamos el EMail de SQL cuando sea un correo válido para evitar duplicados y cumplir validación.
 *
 * @param {string} typedLoginNorm — lo que escribió el usuario (minúsculas, trim)
 * @param {string} loginMailFromSql — columna EMail
 * @returns {string}
 */
export function resolvePrismaEmailForExternoUser(typedLoginNorm, loginMailFromSql) {
  const typed = String(typedLoginNorm ?? '').trim().toLowerCase();
  const mail = String(loginMailFromSql ?? '').trim().toLowerCase();
  if (validateEmail(typed).ok) return typed;
  if (validateEmail(mail).ok) return mail;
  return typed.length > 0 ? typed : mail;
}
