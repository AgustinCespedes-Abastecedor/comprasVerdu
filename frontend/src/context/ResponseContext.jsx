import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import './ResponseContext.css';

const ResponseContext = createContext(null);

const TOAST_DURATION_MS = 6000;

export function ResponseProvider({ children }) {
  const [toast, setToast] = useState(null);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const showSuccess = useCallback((message) => {
    setToast({ type: 'success', message });
  }, []);

  /** showError(message) o showError({ message, code }) — code se muestra como "Código para reportar: XXX" */
  const showError = useCallback((messageOrPayload, code) => {
    const message = typeof messageOrPayload === 'string'
      ? messageOrPayload
      : (messageOrPayload?.message ?? 'Ocurrió un error.');
    const errorCode = typeof messageOrPayload === 'object' && messageOrPayload?.code != null
      ? messageOrPayload.code
      : code;
    setToast({ type: 'error', message, code: errorCode });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <ResponseContext.Provider value={{ showSuccess, showError, clearToast }}>
      {children}
      {toast && (
        <div
          className={`response-toast response-toast-${toast.type}`}
          role="alert"
          aria-live="polite"
        >
          <span className="response-toast-content">
            <span className="response-toast-message">{toast.message}</span>
            {toast.code && (
              <span className="response-toast-code">Código para reportar: {toast.code}</span>
            )}
          </span>
          <button
            type="button"
            className="response-toast-close"
            onClick={clearToast}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}
    </ResponseContext.Provider>
  );
}

export function useResponse() {
  const ctx = useContext(ResponseContext);
  if (!ctx) throw new Error('useResponse debe usarse dentro de ResponseProvider');
  return ctx;
}
