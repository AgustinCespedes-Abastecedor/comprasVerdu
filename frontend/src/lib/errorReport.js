/**
 * Texto unificado para que el usuario pueda reportar exactamente qué pasó.
 * Usado en toasts y en pantallas con error inline (Login, Gestión de usuarios, etc.).
 */

/**
 * Devuelve el mensaje y código de un error (catch de api/client o Error genérico).
 * @param {Error & { code?: string, status?: number }} err
 * @returns {{ message: string, code: string }}
 */
export function getErrorDisplay(err) {
  const message = err?.message && typeof err.message === 'string'
    ? err.message.trim()
    : 'Ocurrió un error. Intentá de nuevo.';
  const code = err?.code && typeof err.code === 'string'
    ? err.code.trim()
    : '';
  return { message, code };
}

/**
 * Texto listo para copiar y pegar al reportar el problema (soporte, ticket, etc.).
 * @param {string} message
 * @param {string} [code]
 * @returns {string}
 */
export function formatForReport(message, code) {
  const msg = (message || 'Error sin mensaje').trim();
  if (code && code.trim()) {
    return `Lo que pasó: ${msg}. Código para reportar: ${code.trim()}.`;
  }
  return `Lo que pasó: ${msg}.`;
}

/**
 * Dado un error capturado, devuelve { message, code, reportText } para mostrar y copiar.
 * @param {Error & { code?: string }} err
 * @returns {{ message: string, code: string, reportText: string }}
 */
export function buildErrorReport(err) {
  const { message, code } = getErrorDisplay(err);
  return {
    message,
    code,
    reportText: formatForReport(message, code),
  };
}
