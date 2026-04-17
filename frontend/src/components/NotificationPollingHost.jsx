import { useNotificationsPolling } from '../hooks/useNotificationsPolling';

/** Activa el polling global de notificaciones cuando hay sesión. */
export default function NotificationPollingHost() {
  useNotificationsPolling();
  return null;
}
