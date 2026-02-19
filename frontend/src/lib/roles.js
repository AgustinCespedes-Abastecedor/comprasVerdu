/**
 * Roles y permisos: basado en user.role.permisos (array de códigos desde el backend).
 * Si el usuario tiene role.permisos, se usan esas pantallas permitidas.
 * Ver también lib/permisos.js para PANTALLAS y puedeAcceder.
 */

import { puedeAcceder as tienePermisoPantalla } from './permisos.js';

/** Puede acceder a /comprar y guardar compras */
export function puedeComprar(user) {
  if (!user) return false;
  if (Array.isArray(user.role?.permisos)) return user.role.permisos.includes('comprar');
  return false;
}

/** Puede acceder a /gestion-usuarios (listar, crear, editar usuarios) */
export function puedeGestionarUsuarios(user) {
  if (!user) return false;
  if (Array.isArray(user.role?.permisos)) return user.role.permisos.includes('gestion-usuarios');
  return false;
}

/** Puede gestionar roles (ABM de roles). Típicamente solo Administrador. */
export function puedeGestionarRoles(user) {
  if (!user) return false;
  if (Array.isArray(user.role?.permisos)) return user.role.permisos.includes('gestion-roles');
  return false;
}

/** Puede ver el listado de compras (/ver-compras) */
export function puedeVerCompras(user) {
  return tienePermisoPantalla(user, 'ver-compras');
}

/** Valores permitidos en registro público (el backend mapea a roles por nombre). */
export const ROLES_REGISTRO = ['COMPRADOR', 'VISOR'];

/** Etiqueta legible del rol para la UI */
export function rolEtiqueta(roleOrUser) {
  if (roleOrUser == null) return '';
  const role = typeof roleOrUser === 'object' && roleOrUser.role ? roleOrUser.role : roleOrUser;
  if (typeof role === 'string') {
    if (role === 'COMPRADOR') return 'Comprador';
    if (role === 'VISOR') return 'Visor';
    if (role === 'ADMIN') return 'Administrador';
    return role;
  }
  return role?.nombre ?? '';
}

/** Re-exportar puedeAcceder desde permisos para rutas */
export { puedeAcceder } from './permisos.js';
