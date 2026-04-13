/**
 * Gestión de usuarios con EXTERNAL_AUTH_LOGIN: la fuente de verdad es dbo.Usuarios en ELABASTECEDOR.
 * El rol mostrado y usado para filtros sale siempre del campo Nivel (vía mapNivelToRoleNombre).
 * Postgres aporta id interno, estado suspendido en la app y conteos (tras login / sync).
 */
import { prisma } from './prisma.js';
import { listUsuariosExternos } from './usuariosSqlServer.js';
import { mapNivelToRoleNombre } from './nivelRol.js';

/**
 * @param {{ q?: string, roleId?: string, activo?: string }} query
 */
export async function getMergedUsersForGestion(query) {
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const roleIdFilter = typeof query.roleId === 'string' ? query.roleId.trim() : '';
  const activoFilter = typeof query.activo === 'string' ? query.activo.trim() : '';

  const listLimit = Math.min(
    Math.max(parseInt(process.env.EXTERNAL_USUARIOS_LIST_LIMIT || '2000', 10) || 2000, 1),
    8000
  );

  const [sqlRows, prismaByExtern, roles] = await Promise.all([
    listUsuariosExternos({ q, limit: listLimit }),
    prisma.user.findMany({
      where: { externUserId: { not: null } },
      select: {
        id: true,
        email: true,
        nombre: true,
        externUserId: true,
        roleId: true,
        activo: true,
        createdAt: true,
        role: { select: { id: true, nombre: true } },
        _count: { select: { compras: true } },
      },
    }),
    prisma.role.findMany({ select: { id: true, nombre: true } }),
  ]);

  const roleIdByNombre = new Map(roles.map((r) => [r.nombre, r.id]));

  const byExternId = new Map();
  for (const u of prismaByExtern) {
    if (u.externUserId) byExternId.set(u.externUserId, u);
  }

  /** @type {Array<Record<string, unknown>>} */
  const merged = [];

  for (const row of sqlRows) {
    const p = byExternId.get(row.externUserId);
    const nivelRolNombre = mapNivelToRoleNombre(row.nivel);
    const roleIdFromNivel = nivelRolNombre ? roleIdByNombre.get(nivelRolNombre) ?? null : null;

    const email = p?.email?.trim().toLowerCase()
      || row.loginMail?.trim().toLowerCase()
      || (row.loginUsuario ? String(row.loginUsuario).trim() : '')
      || '';

    merged.push({
      id: p?.id ?? null,
      email,
      nombre: p?.nombre ?? row.nombre,
      externUserId: row.externUserId,
      /** Columna `Usuario` en ELABASTECEDOR (login corto / código legado distinto de `Codigo`). */
      loginUsuario: String(row.loginUsuario ?? '').trim() || null,
      rol: nivelRolNombre ?? '—',
      roleId: roleIdFromNivel,
      nivel: row.nivel,
      nivelRolEsperado: nivelRolNombre,
      sinAccesoApp: nivelRolNombre == null,
      activo: p ? p.activo !== false : true,
      habilitadoEnErp: row.habilitadoEnErp,
      source: 'elabastecedor',
      synced: Boolean(p),
      createdAt: p?.createdAt ?? null,
      _count: p?._count ?? { compras: 0 },
    });
  }

  let out = merged;
  if (roleIdFilter) {
    out = out.filter((row) => row.roleId === roleIdFilter);
  }
  if (activoFilter === 'true' || activoFilter === '1') {
    out = out.filter((row) => row.activo !== false);
  } else if (activoFilter === 'false' || activoFilter === '0') {
    out = out.filter((row) => row.activo === false);
  }

  out.sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es', { sensitivity: 'base' }));

  return out;
}
