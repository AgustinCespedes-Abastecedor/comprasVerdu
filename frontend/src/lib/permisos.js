/**
 * Pantallas del sistema y permisos por ruta.
 * Cada pantalla tiene un código que el admin asigna a los roles en el ABM.
 * Si el usuario no tiene el permiso, no ve el enlace y no puede acceder por URL.
 */

export const PANTALLAS = [
  { id: 'home', path: '/', label: 'Panel de control (Home)' },
  { id: 'comprar', path: '/comprar', label: 'Nueva compra' },
  { id: 'ver-compras', path: '/ver-compras', label: 'Ver compras' },
  { id: 'recepcion', path: '/recepcion', label: 'Recepción de compras' },
  { id: 'ver-recepciones', path: '/ver-recepciones', label: 'Ver recepciones' },
  { id: 'info-final-articulos', path: '/info-final-articulos', label: 'Info Final de Artículos' },
  { id: 'gestion-usuarios', path: '/gestion-usuarios', label: 'Gestión de usuarios' },
  { id: 'gestion-roles', path: '/gestion-usuarios', label: 'Gestión de roles (ABM roles)', samePathAs: 'gestion-usuarios' },
];

/** Códigos de permiso (para checklist en ABM roles). */
export const CODIGOS_PERMISOS = PANTALLAS.map((p) => p.id);

/**
 * Indica si el usuario puede acceder a la pantalla/ruta con el código dado.
 * @param {Object} user - user del AuthContext (debe tener user.role.permisos como array)
 * @param {string} codigo - ej. 'comprar', 'gestion-usuarios'
 */
export function puedeAcceder(user, codigo) {
  if (!user) return false;
  const permisos = user.role?.permisos;
  if (!Array.isArray(permisos)) return false;
  return permisos.includes(codigo);
}

/** Etiqueta del rol para mostrar en UI (nombre del rol desde el backend). */
export function rolEtiqueta(role) {
  if (!role) return '';
  return typeof role === 'string' ? role : role.nombre || '';
}
