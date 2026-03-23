import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Retroalimentación háptica en APK (Capacitor). En navegador no hace nada.
 * Los errores de plugin se ignoran para no romper la UI.
 */

export async function hapticImpact(style = 'light') {
  if (!Capacitor.isNativePlatform()) return;
  const map = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };
  try {
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Light });
  } catch {
    // noop
  }
}

export async function hapticNotification(type) {
  if (!Capacitor.isNativePlatform()) return;
  const map = {
    success: NotificationType.Success,
    warning: NotificationType.Warning,
    error: NotificationType.Error,
  };
  try {
    await Haptics.notification({ type: map[type] ?? NotificationType.Success });
  } catch {
    // noop
  }
}

export async function hapticSelection() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    // noop
  }
}
