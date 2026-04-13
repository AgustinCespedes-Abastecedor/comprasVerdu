/**
 * Cantidad de usuarios por rol alineada con la gestión de usuarios:
 * - Con EXTERNAL_AUTH_LOGIN: usuarios ELAB se cuentan por Nivel → rol (mapNivelToRoleNombre);
 *   usuarios solo en Postgres (sin externUserId) se suman por roleId.
 * - Sin login externo: mismo criterio que antes (_count de User por roleId).
 *
 * Evita que un rol no mapeado por Nivel (p. ej. Visor) muestre usuarios solo por roleId
 * desactualizado en Postgres en cuentas sincronizadas con ELAB.
 */
import { prisma } from './prisma.js';
import { listUsuariosExternos } from './usuariosSqlServer.js';
import { mapNivelToRoleNombre, ROLES_ASIGNADOS_SOLO_POR_NIVEL } from './nivelRol.js';
import { isExternalAuthLoginEnabled } from './configAuthExterno.js';

/**
 * Corrige `User.roleId` en Postgres para poder eliminar el rol Visor y mostrar conteos reales:
 * - Login ELAB: alinea externos con Nivel; quien siga en Visor pasa a su rol por Nivel o a un rol por defecto.
 * - Solo app: cuentas locales con Visor → Comprador (o Recepcionista si no hay Comprador).
 */
export async function synchronizeUserRolesWithElab() {
  if (!isExternalAuthLoginEnabled()) {
    await migrateLocalUsersOffVisor();
    return;
  }
  await realignExternUserRoleIdsFromSql();
  await reassignRemainingVisorUsers();
}

/**
 * Cuentas solo en Postgres (sin ELAB) que siguen con Visor → Comprador / Recepcionista.
 */
async function migrateLocalUsersOffVisor() {
  const roles = await prisma.role.findMany({ select: { id: true, nombre: true } });
  const roleIdByNombre = new Map(roles.map((r) => [r.nombre, r.id]));
  const visorId = roleIdByNombre.get('Visor');
  const compId = roleIdByNombre.get('Comprador');
  const recepId = roleIdByNombre.get('Recepcionista');
  if (!visorId) return;
  const fallback = compId || recepId;
  if (!fallback) return;
  await prisma.user.updateMany({
    where: { externUserId: null, roleId: visorId },
    data: { roleId: fallback },
  });
}

/**
 * Usuarios que siguen con rol Visor tras realinear: locales o ELAB sin nivel mapeable /
 * fila no encontrada en listado → se reasigna para no bloquear borrado del rol.
 */
async function reassignRemainingVisorUsers() {
  const roles = await prisma.role.findMany({ select: { id: true, nombre: true } });
  const roleIdByNombre = new Map(roles.map((r) => [r.nombre, r.id]));
  const visorId = roleIdByNombre.get('Visor');
  const recepId = roleIdByNombre.get('Recepcionista');
  const compId = roleIdByNombre.get('Comprador');
  if (!visorId) return;
  const fallbackExtern = recepId || compId;
  const fallbackLocal = compId || recepId;
  if (!fallbackExtern || !fallbackLocal) return;

  const envLimit = parseInt(process.env.EXTERNAL_USUARIOS_LIST_LIMIT || '2000', 10) || 2000;
  const listLimit = Math.min(Math.max(envLimit, 1), 8000);
  const sqlRows = await listUsuariosExternos({ q: '', limit: listLimit });
  const byExt = new Map(
    sqlRows.map((r) => [String(r.externUserId ?? '').trim(), r]),
  );

  const visorUsers = await prisma.user.findMany({
    where: { roleId: visorId },
    select: { id: true, externUserId: true },
  });

  for (const u of visorUsers) {
    if (!u.externUserId) {
      await prisma.user.update({
        where: { id: u.id },
        data: { roleId: fallbackLocal },
      });
      continue;
    }
    const row = byExt.get(String(u.externUserId).trim());
    if (!row) {
      await prisma.user.update({
        where: { id: u.id },
        data: { roleId: fallbackExtern },
      });
      continue;
    }
    const mapped = mapNivelToRoleNombre(row.nivel);
    const targetId = (mapped && roleIdByNombre.get(mapped)) || fallbackExtern;
    if (targetId && targetId !== visorId) {
      await prisma.user.update({
        where: { id: u.id },
        data: { roleId: targetId },
      });
    }
  }
}

/**
 * @returns {Promise<Map<string, number>>} roleId → cantidad
 */
export async function getUsuarioCountsByRoleEffective() {
  await synchronizeUserRolesWithElab();

  const roles = await prisma.role.findMany({ select: { id: true, nombre: true } });
  const roleIdByNombre = new Map(roles.map((r) => [r.nombre, r.id]));
  const nombreByRoleId = new Map(roles.map((r) => [r.id, r.nombre]));
  /** @type {Map<string, number>} */
  const counts = new Map(roles.map((r) => [r.id, 0]));

  if (!isExternalAuthLoginEnabled()) {
    const withCounts = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
    });
    for (const r of withCounts) {
      counts.set(r.id, r._count.users);
    }
    return counts;
  }

  const envLimit = parseInt(process.env.EXTERNAL_USUARIOS_LIST_LIMIT || '2000', 10) || 2000;
  const listLimit = Math.min(Math.max(envLimit, 1), 8000);
  const sqlRows = await listUsuariosExternos({ q: '', limit: listLimit });
  for (const row of sqlRows) {
    const nivelRolNombre = mapNivelToRoleNombre(row.nivel);
    if (!nivelRolNombre) continue;
    const rid = roleIdByNombre.get(nivelRolNombre);
    if (!rid) continue;
    counts.set(rid, (counts.get(rid) ?? 0) + 1);
  }

  const locals = await prisma.user.findMany({
    where: { externUserId: null },
    select: { roleId: true },
  });
  for (const u of locals) {
    if (!u.roleId) continue;
    const nombreRol = nombreByRoleId.get(u.roleId);
    if (nombreRol && ROLES_ASIGNADOS_SOLO_POR_NIVEL.has(nombreRol)) {
      continue;
    }
    counts.set(u.roleId, (counts.get(u.roleId) ?? 0) + 1);
  }

  return counts;
}

/**
 * Actualiza `User.roleId` en Postgres para usuarios con `externUserId` según el Nivel actual en ELAB.
 * Evita conteos/eliminar rol bloqueados por un roleId viejo (p. ej. Visor) cuando el Nivel ya mapea a otro rol.
 */
export async function realignExternUserRoleIdsFromSql() {
  if (!isExternalAuthLoginEnabled()) return;

  const envLimit = parseInt(process.env.EXTERNAL_USUARIOS_LIST_LIMIT || '2000', 10) || 2000;
  const listLimit = Math.min(Math.max(envLimit, 1), 8000);
  const [sqlRows, roles] = await Promise.all([
    listUsuariosExternos({ q: '', limit: listLimit }),
    prisma.role.findMany({ select: { id: true, nombre: true } }),
  ]);
  const roleIdByNombre = new Map(roles.map((r) => [r.nombre, r.id]));
  const prismaExtern = await prisma.user.findMany({
    where: { externUserId: { not: null } },
    select: { id: true, externUserId: true, roleId: true },
  });
  const byExt = new Map(prismaExtern.map((u) => [u.externUserId, u]));

  for (const row of sqlRows) {
    const p = byExt.get(row.externUserId);
    if (!p) continue;
    const nivelRolNombre = mapNivelToRoleNombre(row.nivel);
    if (!nivelRolNombre) continue;
    const expectedId = roleIdByNombre.get(nivelRolNombre);
    if (!expectedId || p.roleId === expectedId) continue;
    await prisma.user.update({
      where: { id: p.id },
      data: { roleId: expectedId },
    });
  }
}
