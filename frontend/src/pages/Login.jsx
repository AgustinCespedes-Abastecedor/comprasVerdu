import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api/client';
import { formatForReport } from '../lib/errorReport';
import { ROLES_REGISTRO, rolEtiqueta } from '../lib/roles';
import ThemeToggle from '../components/ThemeToggle';
import PasswordInput from '../components/PasswordInput';
import { hapticNotification } from '../lib/haptics';
import './Login.css';

const LOGIN_EMAIL_KEY = 'compras_verdu_login_email';

async function fetchExternalAuthFlagWithRetry(maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const cfg = await auth.getPublicConfig();
      return Boolean(cfg?.externalAuthLogin);
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => { setTimeout(r, 400 * attempt); });
      }
    }
  }
  throw lastErr;
}

export default function Login() {
  const { user, login, backendError, clearBackendError } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    rol: 'COMPRADOR',
  });
  const [rememberEmail, setRememberEmail] = useState(false);
  /**
   * null = aún no cargó o falló la red (no asumir “solo email”: evita type=email y el bloqueo del @).
   * true = login contra ELABASTECEDOR (sin registro público).
   * false = login solo cuentas locales (email real).
   */
  const [externalAuthLogin, setExternalAuthLogin] = useState(null);
  const [configStatus, setConfigStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    setConfigStatus('loading');
    fetchExternalAuthFlagWithRetry()
      .then((flag) => {
        if (!cancelled) {
          setExternalAuthLogin(flag);
          setConfigStatus('ok');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExternalAuthLogin(null);
          setConfigStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(LOGIN_EMAIL_KEY) || '';
      if (!savedEmail) return;
      setForm((prev) => ({ ...prev, email: savedEmail }));
      setRememberEmail(true);
    } catch {
      // Sin acceso a localStorage (modo privado/políticas del navegador).
    }
  }, []);

  useEffect(() => {
    if (externalAuthLogin) setModo('login');
  }, [externalAuthLogin]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
    setErrorCode('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setLoading(true);
    try {
      if (modo === 'login') {
        const loginId = form.email.trim();
        // El modo real lo define el backend (/auth/config solo ajusta UI). No bloquear acá con @:
        // si /config devolvió false por caché/env viejo, el usuario igual podría usar código SQL.
        const { user: u, token } = await auth.login(loginId, form.password);
        login(u, token);
        try {
          if (rememberEmail) {
            localStorage.setItem(LOGIN_EMAIL_KEY, loginId);
          } else {
            localStorage.removeItem(LOGIN_EMAIL_KEY);
          }
        } catch {
          // No bloquear login si falla persistencia local.
        }
      } else {
        const { user: u, token } = await auth.registro({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          rol: form.rol,
        });
        login(u, token);
      }
      void hapticNotification('success');
      navigate('/', { replace: true });
    } catch (err) {
      void hapticNotification('error');
      setError(err?.message || 'Error');
      setErrorCode(err?.code ?? '');
    } finally {
      setLoading(false);
    }
  };

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="login-page">
      <div className="login-theme-wrap">
        <ThemeToggle />
      </div>
      <div className="login-center">
        {backendError && (
          <div className="login-backend-error" role="alert">
            <p>{backendError}</p>
            <p className="login-backend-error-hint">Cuando el servidor esté listo, iniciá sesión de nuevo.</p>
            <button type="button" className="btn-link" onClick={clearBackendError} aria-label="Cerrar aviso">
              Cerrar
            </button>
          </div>
        )}
        <div className="login-card">
        <div className="login-logo" aria-hidden>
          <img src="/logo.png" alt="" width="56" height="56" />
        </div>
        <h1>Compras Verdu</h1>
        <p className="login-subtitle">
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </p>
        {externalAuthLogin === true && modo === 'login' && (
          <p className="login-hint-external" role="note">
            Usá el mismo usuario y contraseña que en El Abastecedor (SQL Server).
          </p>
        )}
        {configStatus === 'error' && modo === 'login' && (
          <p className="login-hint-external" role="status">
            No se pudo confirmar el modo de login con el servidor. Podés usar correo, usuario o código igualmente; si falla, recargá la página.
          </p>
        )}
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="login-error" role="alert">
              <p className="login-error-message">{error}</p>
              {errorCode && <p className="login-error-code">Código para reportar: {errorCode}</p>}
              <button
                type="button"
                className="login-error-copy"
                onClick={() => {
                  const text = formatForReport(error, errorCode);
                  navigator.clipboard.writeText(text).then(() => {
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 2000);
                  }).catch(() => {});
                }}
                aria-label="Copiar mensaje para reportar el error"
              >
                {copyFeedback ? 'Copiado' : 'Copiar para reportar'}
              </button>
            </div>
          )}
          {modo === 'registro' && (
            <>
              <label>Nombre</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                required
                placeholder="Tu nombre"
                autoComplete="name"
              />
              <label>Rol</label>
              <select name="rol" value={form.rol} onChange={handleChange}>
                {ROLES_REGISTRO.map((r) => (
                  <option key={r} value={r}>{rolEtiqueta(r)}</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="login-email-input">
            {externalAuthLogin === false ? 'Email' : 'Correo, usuario o código'}
          </label>
          <input
            id="login-email-input"
            type={modo === 'registro' ? 'email' : 'text'}
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder={
              externalAuthLogin === false
                ? 'correo@ejemplo.com'
                : 'Ej: 2558 o correo@elabastecedor.com.ar'
            }
            autoComplete={modo === 'registro' ? 'email' : 'username'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {modo === 'login' && (
            <label className="login-remember-email">
              <input
                type="checkbox"
                name="rememberEmail"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
              />
              <span>Recordar email en este dispositivo</span>
            </label>
          )}
          <label>Contraseña</label>
          <PasswordInput
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="••••••••"
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Espera...' : modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>
        {externalAuthLogin === false && (
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setModo((m) => (m === 'login' ? 'registro' : 'login'));
              setError('');
              setErrorCode('');
            }}
          >
            {modo === 'login' ? '¿No tenés cuenta? Registrarse' : 'Ya tengo cuenta. Iniciar sesión'}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
