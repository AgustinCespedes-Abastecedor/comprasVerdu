import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LogOut,
  PackageCheck,
  PackageSearch,
  Search,
  Salad,
  ScrollText,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { puedeGestionarUsuarios, puedeAcceder, rolEtiqueta } from '../lib/roles';
import AppHeader from '../components/AppHeader';
import HomeHeaderBrand from '../components/HomeHeaderBrand';
import ThemeToggle from '../components/ThemeToggle';
import { hapticImpact } from '../lib/haptics';
import './Home.css';

const actions = [
  { to: '/comprar', permiso: 'comprar', title: 'Nueva compra', cta: 'Ir a comprar', icon: 'cart', variant: 'compras', tileLabel: 'Nueva compra' },
  { to: '/recepcion', permiso: 'recepcion', title: 'Recepción de compras', cta: 'Ir a recepción', icon: 'recepcion', variant: 'recepcion', tileLabel: 'Recepción' },
  { to: '/ver-compras', permiso: 'ver-compras', title: 'Ver compras', cta: 'Ver listado', icon: 'verCompras', variant: 'compras', tileLabel: 'Ver compras' },
  { to: '/ver-recepciones', permiso: 'ver-recepciones', title: 'Ver recepciones', cta: 'Ver listado', icon: 'listRecepciones', variant: 'recepcion', tileLabel: 'Recepciones' },
  { to: '/info-final-articulos', permiso: 'info-final-articulos', title: 'Info Final de Artículos', cta: 'Ver info', icon: 'infoArticulos', variant: 'info', tileLabel: 'Info artículos' },
];

const ni = { strokeWidth: 1.65, 'aria-hidden': true };

const icons = {
  cart: <ShoppingCart {...ni} />,
  recepcion: <PackageCheck {...ni} />,
  listRecepciones: <PackageSearch {...ni} strokeWidth={1.55} />,
  verCompras: (
    <span className="home-cart-search-icon" aria-hidden>
      <ShoppingCart className="home-cart-search-icon__cart" aria-hidden strokeWidth={1.65} />
      <Search className="home-cart-search-icon__search" aria-hidden strokeWidth={2.35} />
    </span>
  ),
  infoArticulos: <Salad {...ni} strokeWidth={1.55} />,
  users: <Users {...ni} />,
  logs: <ScrollText {...ni} />,
  book: <BookOpen {...ni} />,
};

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const configPanelId = useId();
  const configToggleBtnId = useId();
  const [configAbierto, setConfigAbierto] = useState(false);
  const [viewportEsAncho, setViewportEsAncho] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
  );
  const esAdmin = puedeGestionarUsuarios(user);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const actualizar = () => setViewportEsAncho(mq.matches);
    actualizar();
    mq.addEventListener('change', actualizar);
    return () => mq.removeEventListener('change', actualizar);
  }, []);
  const nombreCorto = user?.nombre?.split(' ')[0] || user?.nombre || '';

  const handleLogout = () => {
    void hapticImpact('medium');
    logout();
    navigate('/login', { replace: true });
  };

  const visibleActions = actions.filter((a) => puedeAcceder(user, a.permiso));

  const enlacesConfig = [];
  enlacesConfig.push({
    key: 'manual',
    to: '/manual-usuario',
    label: 'Manual de usuario',
    icon: 'book',
  });
  if (esAdmin) {
    enlacesConfig.push({
      key: 'usuarios',
      to: '/gestion-usuarios',
      label: 'Gestión de usuarios',
      icon: 'users',
    });
  }
  if (puedeAcceder(user, 'logs') || esAdmin) {
    enlacesConfig.push({
      key: 'logs',
      to: '/logs',
      label: 'Historial de actividad',
      icon: 'logs',
    });
  }

  return (
    <div className="home">
      <AppHeader
        leftContent={
          <div className="home-header-brand">
            <HomeHeaderBrand />
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
              <LogOut aria-hidden strokeWidth={2} className="home-header-logout-icon" />
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
            {visibleActions.map((action) => {
              const etiquetaTile = viewportEsAncho ? action.title : (action.tileLabel ?? action.title);
              return (
                <li key={action.to}>
                  <Link
                    to={action.to}
                    className={`home-nav-card home-nav-card--${action.variant}`}
                    aria-label={`${action.title}, ${action.cta}`}
                    onClick={() => {
                      void hapticImpact('light');
                    }}
                  >
                    <span
                      className={`home-nav-card-icon home-nav-card-icon--halo${action.icon === 'recepcion' ? ' home-nav-card-icon--package-check' : ''}`}
                      aria-hidden
                    >
                      {icons[action.icon]}
                    </span>
                    <span className="home-nav-card-content">
                      <span className="home-nav-card-title">{etiquetaTile}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {enlacesConfig.length > 0 && (
          <section
            className={`home-config${configAbierto ? ' home-config--abierto' : ''}`}
            aria-label="Ayuda y administración"
          >
            <button
              type="button"
              id={configToggleBtnId}
              className="home-config-toggle"
              aria-expanded={viewportEsAncho || configAbierto}
              aria-controls={configPanelId}
              onClick={() => setConfigAbierto((v) => !v)}
            >
              <span className="home-config-toggle-leading" aria-hidden>
                <LayoutGrid className="home-config-toggle-icon-svg" aria-hidden strokeWidth={1.75} />
              </span>
              <span className="home-config-toggle-label">Ayuda y administración</span>
              <span className={`home-config-chevron${configAbierto ? ' home-config-chevron--arriba' : ''}`} aria-hidden>
                <ChevronDown className="home-config-chevron-svg" aria-hidden strokeWidth={2} />
              </span>
            </button>
            <div id={configPanelId} className="home-config-panel">
              <div
                className="home-config-panel-inner"
                aria-hidden={!viewportEsAncho && !configAbierto}
              >
                {enlacesConfig.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className="home-config-card"
                    onClick={() => {
                      void hapticImpact('light');
                    }}
                  >
                    <span className="home-config-icon" aria-hidden>
                      {icons[item.icon]}
                    </span>
                    <span className="home-config-label">{item.label}</span>
                    <span className="home-config-arrow" aria-hidden>
                      <ChevronRight className="home-config-arrow-svg" aria-hidden strokeWidth={2} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <footer className="home-footer">
          <span className="home-footer-brand">El Abastecedor</span>
        </footer>
      </main>
    </div>
  );
}
