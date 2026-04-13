/**
 * Catálogo canónico de roles (Nivel ELAB alineado con nivelRol.js).
 * Usado por prisma/seed.js y por scripts de importación.
 */
export const ROLES_DEFAULT = [
  {
    nombre: 'Administrador',
    descripcion: 'Nivel ELAB: 100. Acceso total en la app, incluida gestión de usuarios y roles.',
    permisos: ['home', 'comprar', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos', 'gestion-usuarios', 'gestion-roles'],
  },
  {
    nombre: 'Comprador',
    descripcion: 'Nivel ELAB: 25–30. Compras, recepciones y consultas; sin gestión de usuarios.',
    permisos: ['home', 'comprar', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Recepcionista',
    descripcion: 'Nivel ELAB: 10–20. Recepción y consultas; no crea compras ni administra usuarios.',
    permisos: ['home', 'ver-compras', 'recepcion', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Administrativo',
    descripcion: 'Nivel ELAB: 35–40. Solo consultas (compras, recepciones, info de artículos).',
    permisos: ['home', 'ver-compras', 'ver-recepciones', 'info-final-articulos'],
  },
  {
    nombre: 'Visor',
    descripcion: 'No se asigna por Nivel en ELAB. Solo lectura en la app (p. ej. registro local).',
    permisos: ['home', 'ver-compras', 'ver-recepciones', 'info-final-articulos'],
  },
];
