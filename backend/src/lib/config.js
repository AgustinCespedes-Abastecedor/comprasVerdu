/**
 * Configuración centralizada y validación para entorno.
 * En producción exige JWT_SECRET y longitud mínima segura.
 */

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET_MIN_LENGTH = 32;

let cachedJwtSecret = null;

/**
 * Devuelve el secreto JWT. En producción exige que exista y tenga al menos 32 caracteres.
 * En desarrollo usa 'secret-dev' si no está definido.
 * @returns {string}
 * @throws {Error} En producción si JWT_SECRET falta o es demasiado corto.
 */
export function getJwtSecret() {
  if (cachedJwtSecret !== null) return cachedJwtSecret;
  const raw = process.env.JWT_SECRET;
  if (isProduction) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      throw new Error(
        'JWT_SECRET debe estar definido en producción. Configurá la variable de entorno (ej. en Render o .env) con un valor de al menos 32 caracteres. Generá uno con: openssl rand -base64 32'
      );
    }
    const secret = raw.trim();
    if (secret.length < JWT_SECRET_MIN_LENGTH) {
      throw new Error(
        `JWT_SECRET en producción debe tener al menos ${JWT_SECRET_MIN_LENGTH} caracteres. Actual: ${secret.length}. Generá uno con: openssl rand -base64 32`
      );
    }
    cachedJwtSecret = secret;
    return secret;
  }
  cachedJwtSecret = raw && typeof raw === 'string' && raw.trim().length >= JWT_SECRET_MIN_LENGTH ? raw.trim() : 'secret-dev';
  return cachedJwtSecret;
}
