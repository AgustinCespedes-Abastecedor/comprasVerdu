import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

let placeholderHashCache = null;

function getPlaceholderPasswordHash() {
  if (!placeholderHashCache) {
    placeholderHashCache = bcrypt.hashSync('__EXT_AUTH_NO_PASSWORD__', 10);
  }
  return placeholderHashCache;
}

/**
 * Asegura fila User en Postgres para FK de compras/recepciones/logs.
 * No replica credenciales: password es marcador no usado en login externo.
 *
 * @param {{ externUserId: string, emailNorm: string, nombre: string, roleId: string }} p
 */
export async function ensurePrismaUserFromExterno(p) {
  const { externUserId, emailNorm, nombre, roleId } = p;
  const email = String(emailNorm).trim().toLowerCase();
  if (!email || !externUserId) {
    throw new Error('SYNC_USER_DATOS_INCOMPLETOS');
  }

  const byExt = await prisma.user.findUnique({ where: { externUserId } });
  const byEmail = await prisma.user.findUnique({ where: { email } });

  /**
   * Cuenta local previa (mismo email, sin externUserId): típico cuando se activó EXTERNAL_AUTH
   * después de un registro en la app. Se vincula al Codigo de SQL y se deja password en marcador
   * para que el login siga solo por El Abastecedor (no dos contraseñas distintas).
   */
  if (byEmail && !byEmail.externUserId) {
    const nombreFinal = String(nombre || '').trim() || email;
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        externUserId,
        nombre: nombreFinal,
        roleId,
        activo: true,
        password: getPlaceholderPasswordHash(),
      },
      include: { role: { select: { id: true, nombre: true, permisos: true } } },
    });
  }

  if (byEmail && byEmail.externUserId && byEmail.externUserId !== externUserId) {
    const err = new Error('SYNC_USER_EMAIL_CONFLICTO');
    err.code = 'SYNC_USER_EMAIL_CONFLICTO';
    throw err;
  }
  if (byExt && byEmail && byExt.id !== byEmail.id) {
    const err = new Error('SYNC_USER_IDENTIDAD_CONFLICTO');
    err.code = 'SYNC_USER_IDENTIDAD_CONFLICTO';
    throw err;
  }

  const existing = byExt || byEmail;
  const nombreFinal = String(nombre || '').trim() || email;

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        nombre: nombreFinal,
        roleId,
        externUserId,
        // No tocar activo: la suspensión en la app debe persistir entre logins.
      },
      include: { role: { select: { id: true, nombre: true, permisos: true } } },
    });
  }

  return prisma.user.create({
    data: {
      email,
      nombre: nombreFinal,
      roleId,
      externUserId,
      password: getPlaceholderPasswordHash(),
      activo: true,
    },
    include: { role: { select: { id: true, nombre: true, permisos: true } } },
  });
}
