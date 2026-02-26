import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'compras_verdu_token';
const USER_KEY = 'compras_verdu_user';

const MAX_AUTH_ME_RETRIES = 3;
const RETRY_DELAYS_MS = [0, 1000, 2000];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  return err?.status === 503 || err?.code === 'NETWORK_ERROR' || err?.code === 'NOROUTETOHOST';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const saved = localStorage.getItem(USER_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const applySession = (data) => {
      if (data?.id) {
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      } else if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.role?.permisos) setUser(parsed);
          else setUser(null);
        } catch {
          setUser(null);
        }
      } else setUser(null);
    };

    const attemptAuthMe = (attemptIndex) => {
      if (cancelled) return Promise.resolve();
      return delay(RETRY_DELAYS_MS[attemptIndex])
        .then(() => (cancelled ? null : auth.me()))
        .then((data) => {
          if (cancelled) return;
          applySession(data);
        })
        .catch((err) => {
          if (cancelled) return Promise.resolve();
          const canRetry = isRetryableError(err) && attemptIndex < MAX_AUTH_ME_RETRIES - 1;
          if (canRetry) return attemptAuthMe(attemptIndex + 1);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
          if (isRetryableError(err)) {
            setBackendError(err?.message || 'Servidor no disponible.');
          }
        });
    };

    attemptAuthMe(0).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const login = (userData, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    setBackendError(null);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setBackendError(null);
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const clearBackendError = () => setBackendError(null);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken, backendError, clearBackendError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
