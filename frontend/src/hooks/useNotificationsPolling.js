import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInAppNotifications } from '../context/InAppNotificationContext';
import { notifications } from '../api/client';
import { NOTIFICATIONS_POLL_REQUEST } from '../lib/notificationEvents';

/** Intervalo entre sondeos automáticos (~30s). */
const POLL_MS = 30 * 1000;
const EVENT_UPDATED = 'notifications-updated';

function createdAtMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Polling de notificaciones in-app (sin WebSocket).
 * - Primera tanda: solo silencia toasts de avisos **anteriores al inicio de esta sesión** (evita spam al entrar y corrige la carrera “primera respuesta después de guardar”).
 * - Incluye sondeo bajo demanda vía {@link NOTIFICATIONS_POLL_REQUEST} (tras guardar compra/recepción).
 */
export function useNotificationsPolling() {
  const { user } = useAuth();
  const { showFromServer } = useInAppNotifications();
  const seenIdsRef = useRef(new Set());
  const firstPollRef = useRef(true);
  const sessionStartMsRef = useRef(0);
  const pollFnRef = useRef(async () => {});

  const dispatchUpdated = useCallback(() => {
    window.dispatchEvent(new CustomEvent(EVENT_UPDATED));
  }, []);

  useEffect(() => {
    const run = () => {
      void pollFnRef.current();
    };
    window.addEventListener(NOTIFICATIONS_POLL_REQUEST, run);
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVis);
    const onFocus = () => run();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(NOTIFICATIONS_POLL_REQUEST, run);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    firstPollRef.current = true;
    seenIdsRef.current.clear();
    sessionStartMsRef.current = Date.now();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      seenIdsRef.current.clear();
      firstPollRef.current = true;
      return;
    }

    let cancelled = false;
    let intervalId = null;

    const tick = async () => {
      try {
        const res = await notifications.list({ limit: 25 });
        if (cancelled || !res?.notifications) return;
        const unread = res.notifications.filter((n) => !n.read);
        const sessionStart = sessionStartMsRef.current;

        if (firstPollRef.current) {
          firstPollRef.current = false;
          let mostróAlguno = false;
          for (const n of unread) {
            const id = String(n.id);
            const esPrevioALaSesión = createdAtMs(n.createdAt) < sessionStart;
            if (esPrevioALaSesión) {
              seenIdsRef.current.add(id);
              continue;
            }
            if (seenIdsRef.current.has(id)) continue;
            seenIdsRef.current.add(id);
            showFromServer({
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message || '',
            });
            mostróAlguno = true;
          }
          dispatchUpdated();
          if (mostróAlguno) return;
          return;
        }

        if (unread.length === 0) return;
        const fresh = unread.filter((n) => !seenIdsRef.current.has(String(n.id)));
        for (const n of fresh) {
          seenIdsRef.current.add(String(n.id));
          showFromServer({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message || '',
          });
        }
        if (fresh.length > 0) dispatchUpdated();
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[NOTIF] polling:', err?.message || err);
        }
      }
    };

    pollFnRef.current = tick;

    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, showFromServer, dispatchUpdated]);
}

export { EVENT_UPDATED as NOTIFICATIONS_UPDATED_EVENT };
