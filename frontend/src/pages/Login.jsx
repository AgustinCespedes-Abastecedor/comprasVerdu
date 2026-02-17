import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api/client';
import { ROLES_REGISTRO, rolEtiqueta } from '../lib/roles';
import ThemeToggle from '../components/ThemeToggle';
import './Login.css';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    rol: 'COMPRADOR',
  });

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (modo === 'login') {
        const { user: u, token } = await auth.login(form.email, form.password);
        login(u, token);
      } else {
        const { user: u, token } = await auth.registro({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          rol: form.rol,
        });
        login(u, token);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Error');
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
      <div className="login-card">
        <div className="login-logo" aria-hidden>
          <img src="/logo.png" alt="" width="56" height="56" />
        </div>
        <h1>Compras Verdu</h1>
        <p className="login-subtitle">
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </p>
        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
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
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="correo@ejemplo.com"
            autoComplete="email"
          />
          <label>Contraseña</label>
          <input
            type="password"
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
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setModo((m) => (m === 'login' ? 'registro' : 'login'));
            setError('');
          }}
        >
          {modo === 'login' ? '¿No tenés cuenta? Registrarse' : 'Ya tengo cuenta. Iniciar sesión'}
        </button>
      </div>
    </div>
  );
}
