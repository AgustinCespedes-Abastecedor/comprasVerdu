import { useState, useEffect } from 'react';

/**
 * Devuelve un valor que solo se actualiza tras dejar de cambiar durante `delayMs`.
 * Útil para no disparar peticiones en cada tecla (búsquedas, filtros).
 *
 * @template T
 * @param {T} value
 * @param {number} delayMs
 * @returns {T}
 */
export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timerId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timerId);
  }, [value, delayMs]);

  return debounced;
}
