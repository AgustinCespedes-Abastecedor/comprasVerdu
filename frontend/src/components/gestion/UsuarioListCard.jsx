import { Hash, Mail, Package, CalendarClock } from 'lucide-react';
import { rolEtiqueta } from '../../lib/roles';
import { formatDateShort } from '../../lib/format';

const iconProps = { size: 14, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * Tarjeta de usuario para la pantalla de gestión (lista legible en móvil y escritorio).
 */
export default function UsuarioListCard({
  u,
  externalAuthLogin,
  authConfigReady,
  onEdit,
}) {
  const rowKey = u.id ?? `ext-${u.externUserId ?? u.email}`;
  const esCuentaLocal = !u.externUserId;
  const puedeAcciones = Boolean(u.id);
  const rolTexto = u.rol || rolEtiqueta(u);

  return (
    <article
      className={`gestion-user-card ${u.activo === false ? 'gestion-user-card--inactive' : ''}`}
      aria-labelledby={`gestion-user-name-${rowKey}`}
    >
      <div className="gestion-user-card__top">
        <div className="gestion-user-card__identity">
          <p id={`gestion-user-name-${rowKey}`} className="gestion-user-card__name">
            {u.nombre}
          </p>
          <div className="gestion-user-card__login-line">
            <Mail {...iconProps} className="gestion-user-card__login-icon" />
            <span className="gestion-user-card__email">{u.email || 'Sin correo'}</span>
            {authConfigReady && externalAuthLogin && typeof u.loginUsuario === 'string' && u.loginUsuario.trim() ? (
              <span className="gestion-user-card__usuario">
                <Hash {...iconProps} className="gestion-user-card__usuario-icon" aria-hidden />
                <span className="gestion-user-card__usuario-text">{u.loginUsuario.trim()}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="gestion-user-card__status-col" role="group" aria-label="Estado en la aplicación">
          {!puedeAcciones ? (
            <span className="gestion-user-card__pill gestion-user-card__pill--pending">Pendiente</span>
          ) : (
            <span
              className={`gestion-user-card__pill ${
                u.activo !== false ? 'gestion-user-card__pill--ok' : 'gestion-user-card__pill--off'
              }`}
            >
              {u.activo !== false ? 'Activo' : 'Suspendido'}
            </span>
          )}
        </div>
      </div>

      <div className="gestion-user-card__chips">
        <span className="gestion-user-card__rol">{rolTexto}</span>
        {u.sinAccesoApp ? (
          <span className="gestion-user-card__warn" title="Nivel fuera del rango permitido para esta app">
            Sin acceso
          </span>
        ) : null}
        <span className="gestion-user-card__stat">
          <Package {...iconProps} />
          {u._count?.compras ?? 0} compras
        </span>
        {u.createdAt ? (
          <span className="gestion-user-card__stat gestion-user-card__stat--muted">
            <CalendarClock {...iconProps} />
            {formatDateShort(u.createdAt)}
          </span>
        ) : null}
      </div>

      <div className="gestion-user-card__actions gestion-user-card__actions--single">
        <button
          type="button"
          className="gestion-user-card__btn gestion-user-card__btn--primary"
          onClick={() => onEdit(u)}
          title={esCuentaLocal ? 'Editar usuario' : 'Ver detalle'}
        >
          {esCuentaLocal ? 'Editar' : 'Detalle'}
        </button>
      </div>
    </article>
  );
}
