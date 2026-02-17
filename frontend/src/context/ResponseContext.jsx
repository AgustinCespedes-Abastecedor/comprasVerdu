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

  const showError = useCallback((message) => {
    setToast({ type: 'error', message });
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
          <span className="response-toast-message">{toast.message}</span>
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
