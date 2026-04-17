import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notifications } from '../api/client';
import { puedeAcceder, puedeComprar } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
import { NOTIFICATIONS_UPDATED_EVENT } from '../hooks/useNotificationsPolling';
import { hapticImpact } from '../lib/haptics';
import './NotificationBell.css';

function etiquetaTipo(type) {
  if (type === 'nueva_compra') return 'Compra';
  if (type === 'recepcion_registrada') return 'Recepción';
  if (type === 'recepcion_completada') return 'Recepción lista';
  return 'Aviso';
}

function claseTipo(type) {
  if (type === 'nueva_compra') return 'notification-bell__badge-label--compra';
  if (type === 'recepcion_registrada') return 'notification-bell__badge-label--recepcion';
  if (type === 'recepcion_completada') return 'notification-bell__badge-label--recepcion-ok';
  return 'notification-bell__badge-label--default';
}

function formatTiempo(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString();
}

function rutaParaNotificacion(n, nav) {
  const {
    puedeVerCompras,
    puedeTrazabilidad,
    puedeVerRecepciones,
    puedeRecepcion,
    puedeInfoFinal,
  } = nav;
  if (n.type === 'nueva_compra') {
    if (puedeVerCompras) return '/ver-compras';
    if (puedeTrazabilidad) return '/trazabilidad-compras';
    if (nav.puedeComprar) return '/comprar';
  }
  if (n.type === 'recepcion_registrada' || n.type === 'recepcion_completada') {
    if (puedeVerRecepciones) return '/ver-recepciones';
    if (puedeRecepcion) return '/recepcion';
    if (puedeInfoFinal) return '/info-final-articulos';
  }
  if (puedeVerRecepciones) return '/ver-recepciones';
  if (puedeVerCompras) return '/ver-compras';
  if (puedeRecepcion) return '/recepcion';
  if (puedeInfoFinal) return '/info-final-articulos';
  return '/';
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const puedeVerCompras = puedeAcceder(user, 'ver-compras');
  const puedeTrazabilidad = puedeAcceder(user, 'trazabilidad-compras');
  const puedeVerRecepciones = puedeAcceder(user, 'ver-recepciones');
  const puedeRecepcion = puedeAcceder(user, 'recepcion');
  const puedeInfoFinal = puedeAcceder(user, 'info-final-articulos');
  const puedeComprarFlag = puedeComprar(user);
  /** Todos los usuarios logueados reciben notificaciones; la campana siempre visible con sesión. */
  const mostrarCampana = Boolean(user);

  const fetchList = useCallback(
    async (soloContador) => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const res = await notifications.list({ limit: soloContador ? 1 : 35 });
        setUnreadCount(res.unreadCount ?? 0);
        if (!soloContador) setItems(res.notifications ?? []);
      } catch {
        setUnreadCount(0);
        if (!soloContador) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;
    void fetchList(true);
  }, [user?.id, fetchList]);

  useEffect(() => {
    if (!user?.id) return;
    const onUpdated = () => void fetchList(true);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
  }, [user?.id, fetchList]);

  useEffect(() => {
    if (open) void fetchList(false);
  }, [open, fetchList]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const marcarLeida = async (id) => {
    try {
      await notifications.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const marcarTodas = async () => {
    try {
      await notifications.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const alClickItem = (n) => {
    void hapticImpact('light');
    if (!n.read) void marcarLeida(n.id);
    setOpen(false);
    navigate(
      rutaParaNotificacion(n, {
        puedeVerCompras,
        puedeTrazabilidad,
        puedeComprar: puedeComprarFlag,
        puedeVerRecepciones,
        puedeRecepcion,
        puedeInfoFinal,
      })
    );
  };

  if (!mostrarCampana) return null;

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-bell__trigger${open ? ' notification-bell__trigger--open' : ''}`}
        onClick={() => {
          void hapticImpact('light');
          setOpen((o) => !o);
        }}
        title="Notificaciones"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} notificaciones sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="notification-bell__icon" strokeWidth={2} aria-hidden />
        {unreadCount > 0 ? (
          <span className="notification-bell__count" aria-hidden>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="notification-bell__dropdown"
          role="dialog"
          aria-label="Lista de notificaciones"
        >
          <div className="notification-bell__head">
            <span className="notification-bell__head-title">Notificaciones</span>
            {unreadCount > 0 ? (
              <button type="button" className="notification-bell__mark-all" onClick={marcarTodas}>
                Marcar todas leídas
              </button>
            ) : null}
          </div>
          <div className="notification-bell__scroll">
            {loading && items.length === 0 ? (
              <p className="notification-bell__empty">Cargando…</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="notification-bell__empty">No hay notificaciones</p>
            ) : null}
            <ul className="notification-bell__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notification-bell__item${n.read ? '' : ' notification-bell__item--unread'}`}
                    onClick={() => alClickItem(n)}
                  >
                    <span
                      className={`notification-bell__badge-label ${claseTipo(n.type)}`}
                    >
                      {etiquetaTipo(n.type)}
                    </span>
                    <span className="notification-bell__item-title">{n.title}</span>
                    {n.message ? (
                      <span className="notification-bell__item-msg">{n.message}</span>
                    ) : null}
                    <span className="notification-bell__item-time">{formatTiempo(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
