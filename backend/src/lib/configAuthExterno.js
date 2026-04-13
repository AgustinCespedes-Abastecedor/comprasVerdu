/**
 * Login contra tabla Usuarios de ELABASTECEDOR (SQL Server).
 * Activar con EXTERNAL_AUTH_LOGIN=true (además de EXTERNAL_DB_*).
 */

export function isExternalAuthLoginEnabled() {
  const v = process.env.EXTERNAL_AUTH_LOGIN;
  return v === 'true' || v === '1' || v === 'yes';
}
