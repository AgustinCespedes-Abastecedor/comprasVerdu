/**
 * Fallos de infraestructura Prisma (conexión, credenciales, URL).
 * https://www.prisma.io/docs/orm/reference/error-reference
 */
import { MSG } from './errors.js';

const PRISMA_CONNECTION_CODES = new Set([
  'P1000', // Authentication failed against the database server
  'P1001', // Can't reach database server
  'P1002', // The database server was reached but timed out
  'P1003', // Database does not exist
  'P1013', // The provided database string is invalid
  'P1017', // Server has closed the connection
]);

/**
 * @param {unknown} error
 * @returns {{ status: number, message: string, clientCode: string } | null}
 */
export function getPrismaConnectionFailureResponse(error) {
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (!PRISMA_CONNECTION_CODES.has(code)) return null;
  return {
    status: 503,
    message: MSG.AUTH_DB_NO_DISPONIBLE,
    clientCode: 'AUTH_050',
  };
}
