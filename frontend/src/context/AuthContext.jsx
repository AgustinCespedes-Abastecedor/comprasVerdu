import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'compras_verdu_token';
const USER_KEY = 'compras_verdu_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const saved = localStorage.getItem(USER_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    auth
      .me()
      .then((data) => {
        if (cancelled) return;
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
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const login = (userData, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
