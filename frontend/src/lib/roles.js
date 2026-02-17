/**
 * Definición de roles y permisos del sistema.
 * Fuente única de verdad para qué puede hacer cada rol en el frontend.
 *
 * Matriz de acciones:
 * - ADMIN: todo (comprar, ver compras, gestión de usuarios).
 * - COMPRADOR: nueva compra y ver compras (no gestión de usuarios).
 * - VISOR: solo ver compras (lectura); no puede cargar compras ni gestionar usuarios.
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  COMPRADOR: 'COMPRADOR',
  VISOR: 'VISOR',
};

/** Puede acceder a /comprar y guardar compras */
export function puedeComprar(rol) {
  return rol === ROLES.ADMIN || rol === ROLES.COMPRADOR;
}

/** Puede acceder a /gestion-usuarios (listar, crear, editar usuarios) */
export function puedeGestionarUsuarios(rol) {
  return rol === ROLES.ADMIN;
}

/** Puede ver el listado de compras (/ver-compras). Todos los roles autenticados. */
export function puedeVerCompras(rol) {
  return !!rol;
}

/** Etiqueta legible del rol para la UI */
export function rolEtiqueta(rol) {
  switch (rol) {
    case ROLES.ADMIN:
      return 'Administrador';
    case ROLES.COMPRADOR:
      return 'Comprador';
    case ROLES.VISOR:
      return 'Visor';
    default:
      return rol || '';
  }
}

/** Roles que se pueden elegir en el registro público (no incluye ADMIN) */
export const ROLES_REGISTRO = [ROLES.COMPRADOR, ROLES.VISOR];
