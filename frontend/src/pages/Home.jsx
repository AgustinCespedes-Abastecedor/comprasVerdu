import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { puedeGestionarUsuarios, puedeAcceder, rolEtiqueta } from '../lib/roles';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import './Home.css';

const actions = [
  { to: '/comprar', permiso: 'comprar', title: 'Nueva compra', desc: 'Cargar compra a proveedores desde la planilla', cta: 'Ir a comprar', icon: 'cart', variant: 'compras' },
  { to: '/recepcion', permiso: 'recepcion', title: 'Recepción de compras', desc: 'Elegir compra por fecha y cargar cantidades recibidas', cta: 'Ir a recepción', icon: 'packageCheck', variant: 'recepcion' },
  { to: '/ver-compras', permiso: 'ver-compras', title: 'Ver compras', desc: 'Consultar y filtrar historial de compras', cta: 'Ver listado', icon: 'doc', variant: 'compras' },
  { to: '/ver-recepciones', permiso: 'ver-recepciones', title: 'Ver recepciones', desc: 'Consultar historial de recepciones', cta: 'Ver listado', icon: 'listRecepciones', variant: 'recepcion' },
  { to: '/info-final-articulos', permiso: 'info-final-articulos', title: 'Info Final de Artículos', desc: 'Artículos por fecha con Tecnolar y costo ponderado', cta: 'Ver info', icon: 'clipboard', variant: 'info' },
];

const icons = {
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  /** Recepción de compras: registrar cantidades recibidas (planilla con check) */
  packageCheck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  /** Ver recepciones: consultar listado/historial */
  listRecepciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="4" y1="6" x2="4.01" y2="6" />
      <line x1="4" y1="12" x2="4.01" y2="12" />
      <line x1="4" y1="18" x2="4.01" y2="18" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="16" y2="10" />
    </svg>
  ),
};

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const esAdmin = puedeGestionarUsuarios(user);
  const nombreCorto = user?.nombre?.split(' ')[0] || user?.nombre || '';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const visibleActions = actions.filter((a) => puedeAcceder(user, a.permiso));

  return (
    <div className="home">
      <AppHeader
        leftContent={
          <div className="home-header-brand">
            <span className="home-header-app">Compras Verdu</span>
            <span className="home-header-tagline">Gestión de compras</span>
          </div>
        }
        rightContent={
          <div className="home-header-actions">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="home-header-logout"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        }
      />

      <main className="home-main">
        <header className="home-welcome">
          <p className="home-welcome-greeting">
            Hola, <strong>{nombreCorto}</strong>
          </p>
          <span className="home-welcome-rol" title={`Rol: ${rolEtiqueta(user)}`}>
            {rolEtiqueta(user)}
          </span>
        </header>

        <nav className="home-nav" aria-label="Acciones principales">
          <ul className="home-nav-list">
            {visibleActions.map((action) => (
              <li key={action.to}>
                <Link to={action.to} className={`home-nav-card home-nav-card--${action.variant}`}>
                  <span className="home-nav-card-icon" aria-hidden>
                    {icons[action.icon]}
                  </span>
                  <span className="home-nav-card-content">
                    <span className="home-nav-card-title">{action.title}</span>
                    <span className="home-nav-card-desc">{action.desc}</span>
                  </span>
                  <span className="home-nav-card-cta">{action.cta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="home-config" aria-label="Ayuda y configuración">
          {puedeAcceder(user, 'manual-usuario') && (
            <Link to="/manual-usuario" className="home-config-card">
              <span className="home-config-icon" aria-hidden>{icons.book}</span>
              <span className="home-config-label">Manual de usuario</span>
              <span className="home-config-arrow" aria-hidden>→</span>
            </Link>
          )}
          {esAdmin && (
            <Link to="/gestion-usuarios" className="home-config-card">
              <span className="home-config-icon" aria-hidden>{icons.users}</span>
              <span className="home-config-label">Gestión de usuarios</span>
              <span className="home-config-arrow" aria-hidden>→</span>
            </Link>
          )}
          {(puedeAcceder(user, 'logs') || esAdmin) && (
            <Link to="/logs" className="home-config-card">
              <span className="home-config-icon" aria-hidden>{icons.logs}</span>
              <span className="home-config-label">Historial de actividad</span>
              <span className="home-config-arrow" aria-hidden>→</span>
            </Link>
          )}
        </section>

        <footer className="home-footer">
          <span className="home-footer-brand">El Abastecedor</span>
        </footer>
      </main>
    </div>
  );
}
