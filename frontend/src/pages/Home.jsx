import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { puedeComprar as permisoComprar, puedeGestionarUsuarios, rolEtiqueta } from '../lib/roles';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import './Home.css';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const puedeComprar = permisoComprar(user?.rol);
  const esAdmin = puedeGestionarUsuarios(user?.rol);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="home-page">
      <AppHeader
        leftContent={
          <div className="home-brand">
            <span className="home-brand-name">Compras Verdu</span>
            <span className="home-brand-meta">Gestión de compras</span>
          </div>
        }
        rightContent={
          <>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="home-btn-logout"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <svg className="home-btn-logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </>
        }
      />

      <main className="home-main">
        <section className="home-hero">
          <p className="home-hero-greeting">Bienvenido, {user?.nombre?.split(' ')[0] || user?.nombre}</p>
          <span className="home-hero-rol" title={`Rol: ${rolEtiqueta(user?.rol)}`}>
            {rolEtiqueta(user?.rol)}
          </span>
          <h1 className="home-hero-title">Panel de control</h1>
          <p className="home-hero-subtitle">
            Seleccioná una acción para continuar
          </p>
        </section>

        <section className="home-actions" aria-label="Acciones principales">
          {puedeComprar && (
            <Link to="/comprar" className="home-action-card home-action-primary">
              <div className="home-action-icon-wrap home-action-icon-primary">
                <svg className="home-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <div className="home-action-body">
                <h2 className="home-action-title">Nueva compra</h2>
                <p className="home-action-desc">Cargar una compra a proveedores desde la planilla</p>
              </div>
              <span className="home-action-cta">Ir a comprar</span>
            </Link>
          )}
          <Link to="/ver-compras" className="home-action-card">
            <div className="home-action-icon-wrap">
              <svg className="home-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="home-action-body">
              <h2 className="home-action-title">Ver compras</h2>
              <p className="home-action-desc">Consultar y filtrar el historial de compras guardadas</p>
            </div>
            <span className="home-action-cta">Ver listado</span>
          </Link>
        </section>

        {esAdmin && (
          <section className="home-config" aria-label="Configuración">
            <h2 className="home-config-title">Configuración</h2>
            <Link to="/gestion-usuarios" className="home-config-link">
              <svg className="home-config-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="home-config-link-text">Gestión de usuarios</span>
              <span className="home-config-link-chevron" aria-hidden>→</span>
            </Link>
          </section>
        )}

        <footer className="home-footer">
          <span className="home-footer-text">El Abastecedor</span>
        </footer>
      </main>
    </div>
  );
}
