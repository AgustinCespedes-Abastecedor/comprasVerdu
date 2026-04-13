import { useState, useEffect } from 'react';

/** True si la app corre en el contenedor Capacitor (clase `is-native` en el elemento raíz). */
export function useIsNativeApp() {
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(document.documentElement.classList.contains('is-native'));
  }, []);

  return native;
}
