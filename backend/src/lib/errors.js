/**
 * Errores con códigos para mesa de ayuda.
 * - message: texto claro para el usuario.
 * - code: identificador para reportar (ej. AUTH_001).
 * - status: HTTP status.
 * - logDetail: se escribe en consola del servidor (no se envía al cliente en producción).
 */

const isDev = process.env.NODE_ENV !== 'production';

/** Envía respuesta JSON de error y opcionalmente registra en consola para soporte */
export function sendError(res, status, message, code, logDetail) {
  const payload = { error: message };
  if (code) payload.code = code;
  if (isDev && logDetail) payload.detail = typeof logDetail === 'string' ? logDetail : (logDetail?.message ?? String(logDetail));
  if (code || logDetail) {
    console.error(`[${code || 'ERR'}]`, message, logDetail != null ? logDetail : '');
  }
  res.status(status).json(payload);
}

/** Lanza un error con código para usar con sendError en catch */
export function apiError(message, code, status = 500) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  return e;
}

/** Códigos y mensajes usuario (una sola fuente para consistencia) */
export const MSG = {
  // Auth
  AUTH_TOKEN_FALTA: 'No se envió el token de sesión. Volvé a iniciar sesión.',
  AUTH_TOKEN_INVALIDO: 'La sesión expiró o es inválida. Iniciá sesión de nuevo.',
  AUTH_USUARIO_NO_EXISTE: 'Usuario no encontrado. Iniciá sesión de nuevo.',
  AUTH_SESION_ERROR: 'No se pudo verificar la sesión. Intentá de nuevo.',
  AUTH_CREDENCIALES: 'Email o contraseña incorrectos.',
  AUTH_CUENTA_SUSPENDIDA: 'Tu cuenta está suspendida. Contactá al administrador.',
  AUTH_EMAIL_REGISTRADO: 'Ese correo ya está registrado.',
  AUTH_FALTAN_DATOS: 'Completá email, contraseña y nombre.',
  AUTH_EMAIL_PASSWORD_REQUERIDOS: 'Ingresá email y contraseña.',
  AUTH_SIN_PERMISO: 'No tenés permiso para esta acción.',
  AUTH_SOLO_ADMIN: 'Solo administradores pueden acceder.',
  AUTH_ROL_NO_DISPONIBLE: 'No hay rol disponible para el registro.',
  AUTH_PASSWORD_CORTA: 'La contraseña debe tener al menos 8 caracteres.',
  AUTH_PASSWORD_LARGA: 'La contraseña no puede superar 128 caracteres.',
  AUTH_EMAIL_LARGO: 'El email no puede superar 255 caracteres.',
  AUTH_NOMBRE_LARGO: 'El nombre no puede superar 200 caracteres.',
  AUTH_REGISTRO_DESHABILITADO: 'El registro público está deshabilitado. Usá el usuario de El Abastecedor.',
  AUTH_NIVEL_SIN_ACCESO: 'Tu usuario no tiene un nivel habilitado para esta aplicación. Contactá a sistemas.',
  AUTH_SQL_NO_DISPONIBLE: 'No se pudo validar el usuario contra el servidor de datos. Intentá más tarde.',
  AUTH_EMAIL_CONFLICTO_IDENTIDAD: 'Existe un conflicto de cuenta con ese correo. Contactá al administrador.',
  AUTH_CUENTA_SOLO_EXTERNA: 'Este usuario se valida en El Abastecedor. Activá EXTERNAL_AUTH_LOGIN en el servidor o usá una cuenta local de prueba.',
  AUTH_DB_NO_DISPONIBLE:
    'No se pudo conectar a la base de datos. En desarrollo local: ejecutá «npm run dev:db» en la raíz del proyecto (PostgreSQL en el puerto 5433 por defecto) y revisá que DATABASE_URL en backend/.env use el mismo usuario, contraseña y puerto que ese contenedor.',

  // Usuarios
  USERS_LISTAR: 'No se pudo cargar la lista de usuarios.',
  USERS_CREAR: 'No se pudo crear el usuario.',
  USERS_ACTUALIZAR: 'No se pudo actualizar el usuario.',
  USERS_EMAIL_OBLIGATORIO: 'El email es obligatorio.',
  USERS_EMAIL_INVALIDO: 'El email no es válido.',
  USERS_EMAIL_DUPLICADO: 'Ya existe un usuario con ese email.',
  USERS_NOMBRE_EMAIL_PASSWORD: 'Nombre, email y contraseña son obligatorios.',
  USERS_ROL_OBLIGATORIO: 'Debe seleccionar un rol.',
  USERS_ROL_INVALIDO: 'El rol seleccionado no es válido.',
  USERS_NO_ENCONTRADO: 'Usuario no encontrado.',
  USERS_RESUMEN: 'No se pudo obtener los datos del usuario.',
  USERS_DEBE_HABER_ROL: 'Debe seleccionar un rol.',
  USERS_PASSWORD_CORTA: 'La contraseña debe tener al menos 8 caracteres.',
  USERS_PASSWORD_LARGA: 'La contraseña no puede superar 128 caracteres.',
  USERS_EMAIL_LARGO: 'El email no puede superar 255 caracteres.',
  USERS_NOMBRE_LARGO: 'El nombre no puede superar 200 caracteres.',
  USERS_EXTERNO_NO_CREAR: 'Los usuarios se administran en El Abastecedor. No se pueden crear cuentas desde esta pantalla.',
  USERS_EXTERNO_NO_EDITAR: 'Este usuario se sincroniza desde El Abastecedor: no podés editar datos desde esta aplicación.',
  USERS_ACTIVO_SOLO_ERP:
    'El estado habilitado/deshabilitado se define en El Abastecedor (SQL Server), no desde esta aplicación.',
  USERS_SQL_LISTAR: 'No se pudo obtener el listado de usuarios desde El Abastecedor. Revisá la conexión a SQL Server o intentá más tarde.',
  USERS_SQL_DETALLE:
    'No se pudo cargar el detalle del usuario desde El Abastecedor. Revisá la conexión a SQL Server o que exista la fila en la tabla de usuarios.',

  // Roles
  ROLES_LISTAR: 'No se pudo cargar la lista de roles.',
  ROLES_CREAR: 'No se pudo crear el rol.',
  ROLES_ACTUALIZAR: 'No se pudo actualizar el rol.',
  ROLES_ELIMINAR: 'No se pudo eliminar el rol.',
  ROLES_NOMBRE_OBLIGATORIO: 'El nombre del rol es obligatorio.',
  ROLES_NOMBRE_VACIO: 'El nombre no puede estar vacío.',
  ROLES_NOMBRE_DUPLICADO: 'Ya existe un rol con ese nombre.',
  ROLES_NO_ENCONTRADO: 'Rol no encontrado.',
  ROLES_TIENE_USUARIOS: 'No se puede eliminar el rol porque tiene usuarios asignados. Reasigná otro rol primero.',

  // Compras
  COMPRAS_LISTAR: 'No se pudo cargar el listado de compras.',
  COMPRAS_GUARDAR: 'No se pudo guardar la compra.',
  COMPRAS_TOTALES: 'No se pudieron calcular los totales.',
  COMPRAS_OBTENER: 'No se pudo obtener la compra.',
  COMPRAS_RECEPCION: 'No se pudo obtener la recepción.',
  COMPRAS_USUARIO_NO_IDENTIFICADO: 'No se pudo identificar al usuario. Iniciá sesión de nuevo.',
  COMPRAS_FALTAN_DATOS: 'Faltan fecha, proveedor o ítems de la compra.',
  COMPRAS_FECHA_INVALIDA: 'La fecha de compra no es válida. Usá el formato YYYY-MM-DD.',
  COMPRAS_AL_MENOS_UN_ITEM: 'Debe haber al menos un ítem con bultos mayor a cero.',
  COMPRAS_NO_ENCONTRADA: 'Compra no encontrada.',

  // Recepciones
  RECEP_LISTAR: 'No se pudo cargar el listado de recepciones.',
  RECEP_GUARDAR: 'No se pudo guardar la recepción.',
  RECEP_ACTUALIZAR_PRECIOS: 'No se pudieron actualizar los precios de venta.',
  RECEP_FALTA_COMPRA_ID: 'Falta el identificador de la compra.',
  RECEP_DETALLES_ARRAY: 'Los detalles deben ser una lista.',
  RECEP_COMPRA_NO_ENCONTRADA: 'Compra no encontrada.',
  RECEP_DETALLES_MINIMO: 'Debe haber al menos un ítem en los detalles.',
  RECEP_NO_ENCONTRADA: 'Recepción no encontrada.',
  RECEP_PRECIO_MINIMO: 'Ingresá al menos un precio de venta.',
  RECEP_NINGUN_DETALLE_VALIDO: 'Ningún detalle válido con precio de venta.',

  // Productos / Proveedores
  PROD_LISTAR: 'No se pudo cargar el listado de productos.',
  PROD_IVA: 'No se pudo obtener la información de IVA.',
  PROV_LISTAR: 'No se pudo cargar el listado de proveedores.',

  // Info final artículos
  INFO_FECHA_REQUERIDA: 'Debe indicarse la fecha (formato YYYY-MM-DD).',
  INFO_FECHA_INVALIDA: 'La fecha no es válida.',
  INFO_OBTENER: 'No se pudo cargar la información de artículos.',
  INFO_USUARIO_NO_IDENTIFICADO: 'No se pudo identificar al usuario. Iniciá sesión de nuevo.',
  INFO_FALTAN_FECHA_CODIGO: 'Faltan fecha o código de artículo.',

  // Logs
  LOGS_LISTAR: 'No se pudo cargar el historial de actividad.',

  // Trazabilidad de compras
  TRAZ_COMPRAS_LISTAR: 'No se pudo cargar la trazabilidad de compras.',

  // Genéricos
  SERVIDOR_NO_DISPONIBLE: 'El servidor no está disponible. Revisá la conexión o intentá más tarde.',
  JSON_INVALIDO: 'Los datos enviados no son válidos.',
  ERROR_SERVIDOR: 'Ocurrió un error en el servidor. Si persiste, reportá el código a mesa de ayuda.',
};
