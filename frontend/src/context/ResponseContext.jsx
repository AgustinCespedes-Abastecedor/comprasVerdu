import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { formatForReport } from '../lib/errorReport';
import { hapticImpact, hapticNotification } from '../lib/haptics';
import './ResponseContext.css';

const ResponseContext = createContext(null);

const TOAST_DURATION_MS = 6000;
const TOAST_ERROR_DURATION_MS = 12000;

export function ResponseProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  const clearToast = useCallback(() => {
    setToast(null);
    setCopied(false);
  }, []);

  const showSuccess = useCallback((message) => {
    setToast({ type: 'success', message });
    void hapticNotification('success');
  }, []);

  /**
   * showError(message) | showError({ message, code, reportText }) | showError(message, code)
   * Muestra el error y permite copiar un texto listo para reportar (mensaje + código).
   */
  const showError = useCallback((messageOrPayload, code) => {
    const message = typeof messageOrPayload === 'string'
      ? messageOrPayload
      : (messageOrPayload?.message ?? 'Ocurrió un error.');
    const errorCode = typeof messageOrPayload === 'object' && messageOrPayload?.code != null
      ? messageOrPayload.code
      : (code ?? '');
    const reportText = typeof messageOrPayload === 'object' && messageOrPayload?.reportText
      ? messageOrPayload.reportText
      : formatForReport(message, errorCode);
    setToast({ type: 'error', message, code: errorCode, reportText });
    void hapticNotification('error');
  }, []);

  const copyReport = useCallback(() => {
    if (!toast?.reportText) return;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    navigator.clipboard.writeText(toast.reportText).then(() => {
      setCopied(true);
      void hapticImpact('light');
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [toast?.reportText]);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.type === 'error' ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS;
    const t = setTimeout(clearToast, duration);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <ResponseContext.Provider value={{ showSuccess, showError, clearToast, formatForReport }}>
      {children}
      {toast && (
        <div
          className={`response-toast response-toast-${toast.type}`}
          role="alert"
          aria-live="polite"
        >
          <span className="response-toast-content">
            <span className="response-toast-message">{toast.message}</span>
            {toast.type === 'error' && (
              <>
                {toast.code && (
                  <span className="response-toast-code">Código para reportar: {toast.code}</span>
                )}
                {toast.reportText && (
                  <button
                    type="button"
                    className="response-toast-copy"
                    onClick={copyReport}
                    aria-label="Copiar mensaje para reportar el error"
                  >
                    {copied ? 'Copiado' : 'Copiar para reportar'}
                  </button>
                )}
              </>
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
