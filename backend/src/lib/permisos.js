/**
 * Códigos de permisos por pantalla/ruta.
 * Deben coincidir con el frontend (frontend/src/lib/permisos.js o similar).
 */
export const PERMISOS = {
  HOME: 'home',
  COMPRAR: 'comprar',
  VER_COMPRAS: 'ver-compras',
  RECEPCION: 'recepcion',
  VER_RECEPCIONES: 'ver-recepciones',
  INFO_FINAL_ARTICULOS: 'info-final-articulos',
  GESTION_USUARIOS: 'gestion-usuarios',
  GESTION_ROLES: 'gestion-roles',
  LOGS: 'logs',
  MANUAL_USUARIO: 'manual-usuario',
};

/** Lista de todos los códigos (para validar en ABM de roles). */
export const TODOS_LOS_PERMISOS = Object.values(PERMISOS);

/** Rutas API que requieren un permiso concreto (además de estar logueado). */
export const RUTA_A_PERMISO = {
  'POST:/api/compras': PERMISOS.COMPRAR,
  'GET:/api/users': PERMISOS.GESTION_USUARIOS,
  'POST:/api/users': PERMISOS.GESTION_USUARIOS,
  'PATCH:/api/users': PERMISOS.GESTION_USUARIOS,
  'GET:/api/roles': PERMISOS.GESTION_ROLES,
  'POST:/api/roles': PERMISOS.GESTION_ROLES,
  'PATCH:/api/roles': PERMISOS.GESTION_ROLES,
  'DELETE:/api/roles': PERMISOS.GESTION_ROLES,
  'GET:/api/logs': PERMISOS.LOGS,
};

export function tienePermiso(permisos, codigo) {
  if (!Array.isArray(permisos)) return false;
  return permisos.includes(codigo);
}
