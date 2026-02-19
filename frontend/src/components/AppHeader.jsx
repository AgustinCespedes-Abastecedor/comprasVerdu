import React from 'react';
import { Link } from 'react-router-dom';
import './AppHeader.css';

/**
 * Barra superior común: izquierda (back/brand), logo centrado, derecha (theme/logout).
 * El logo lleva siempre a la página de inicio.
 */
export default function AppHeader({ leftContent, rightContent }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        {leftContent}
      </div>
      <div className="app-header-logo">
        <Link to="/" className="app-header-logo-link" title="Ir al inicio" aria-label="Ir al inicio">
          <img src="/logo.png" alt="Compras Verdu" className="app-logo-img" />
        </Link>
      </div>
      <div className="app-header-right">
        {rightContent}
      </div>
    </header>
  );
}
