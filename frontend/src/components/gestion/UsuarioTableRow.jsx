import { rolEtiqueta } from '../../lib/roles';
import { formatDateShort } from '../../lib/format';

/**
 * Fila de tabla densa (escritorio) para gestión de usuarios.
 */
export default function UsuarioTableRow({
  u,
  externalAuthLogin,
  authConfigReady,
  onEdit,
}) {
  const esCuentaLocal = !u.externUserId;
  const puedeAcciones = Boolean(u.id);
  const rolTexto = u.rol || rolEtiqueta(u);
  const usuarioSql = typeof u.loginUsuario === 'string' && u.loginUsuario.trim() ? u.loginUsuario.trim() : null;
  const mailLine =
    authConfigReady && externalAuthLogin && usuarioSql
      ? `${u.email || '—'} · ${usuarioSql}`
      : (u.email || '—');

  return (
    <tr className={u.activo === false ? 'gestion-usuarios-dense-tr--inactive' : undefined}>
      <td className="gestion-usuarios-col-nombre" title={u.nombre}>
        <span className="gestion-usuarios-dense-name">{u.nombre}</span>
      </td>
      <td className="gestion-usuarios-col-mail" title={mailLine}>
        <span className="gestion-usuarios-dense-mail-line">
          <span className="gestion-usuarios-dense-mail">{u.email || '—'}</span>
          {authConfigReady && externalAuthLogin && usuarioSql ? (
            <>
              <span className="gestion-usuarios-dense-mail-sep" aria-hidden> · </span>
              <span className="gestion-usuarios-dense-usuario-inline">{usuarioSql}</span>
            </>
          ) : null}
        </span>
      </td>
      <td
        className="gestion-usuarios-col-rol"
        title={u.sinAccesoApp ? `${rolTexto} — sin acceso (nivel)` : rolTexto}
      >
        <span className="gestion-usuarios-dense-rol">{rolTexto}</span>
        {u.sinAccesoApp ? (
          <span className="gestion-usuarios-dense-warn"> · sin acceso</span>
        ) : null}
      </td>
      <td className="gestion-usuarios-col-app">
        {!puedeAcciones ? (
          <span className="gestion-usuarios-dense-pend">Pendiente</span>
        ) : (
          <span
            className={
              u.activo !== false
                ? 'gestion-usuarios-dense-app gestion-usuarios-dense-app--ok'
                : 'gestion-usuarios-dense-app gestion-usuarios-dense-app--off'
            }
          >
            {u.activo !== false ? 'Activo' : 'Suspendido'}
          </span>
        )}
      </td>
      <td className="gestion-usuarios-col-n">{u._count?.compras ?? 0}</td>
      <td className="gestion-usuarios-col-fecha">{u.createdAt ? formatDateShort(u.createdAt) : '—'}</td>
      <td className="gestion-usuarios-col-actions">
        <div className="gestion-usuarios-cell-actions gestion-usuarios-cell-actions--single">
          <button
            type="button"
            className="gestion-usuarios-btn-edit"
            onClick={() => onEdit(u)}
            title={esCuentaLocal ? 'Editar usuario' : 'Ver detalle'}
          >
            {esCuentaLocal ? 'Editar' : 'Detalle'}
          </button>
        </div>
      </td>
    </tr>
  );
}
