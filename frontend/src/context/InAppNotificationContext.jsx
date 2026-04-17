import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { hapticNotification } from '../lib/haptics';
import './InAppNotificationContext.css';

const InAppNotificationContext = createContext(null);

const TOAST_MS = 8200;

/**
 * Toasts breves para alertas del servidor (polling), separados del toast de errores de ResponseContext.
 */
export function InAppNotificationProvider({ children }) {
  const [toasts, setToasts] = useState(() => []);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((key) => {
    const t = timersRef.current.get(key);
    if (t) clearTimeout(t);
    timersRef.current.delete(key);
    setToasts((prev) => prev.filter((x) => x.key !== key));
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  }, []);

  const showFromServer = useCallback(
    (payload) => {
      const key = `n-${payload.id}`;
      setToasts((prev) => {
        if (prev.some((x) => x.key === key)) return prev;
        const next = [...prev, { key, ...payload }].slice(-4);
        return next;
      });
      const haptic =
        payload.type === 'nueva_compra'
          ? 'success'
          : payload.type === 'recepcion_completada'
            ? 'success'
            : 'warning';
      void hapticNotification(haptic);
      const tid = setTimeout(() => removeToast(key), TOAST_MS);
      timersRef.current.set(key, tid);
    },
    [removeToast]
  );

  const value = { showFromServer };

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
      <div className="inapp-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div
            key={t.key}
            className={`inapp-toast inapp-toast--${t.type || 'info'}`}
            role="status"
          >
            <div className="inapp-toast-inner">
              <p className="inapp-toast-title">{t.title}</p>
              {t.message ? <p className="inapp-toast-message">{t.message}</p> : null}
            </div>
            <button
              type="button"
              className="inapp-toast-close"
              onClick={() => removeToast(t.key)}
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications() {
  const ctx = useContext(InAppNotificationContext);
  if (!ctx) {
    throw new Error('useInAppNotifications debe usarse dentro de InAppNotificationProvider');
  }
  return ctx;
}
