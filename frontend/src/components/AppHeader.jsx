import React from 'react';
import './AppHeader.css';

/**
 * Barra superior común: izquierda (back/brand), logo centrado, derecha (theme/logout).
 * El logo queda siempre en el mismo lugar (centro del eje X) en todas las pantallas.
 */
export default function AppHeader({ leftContent, rightContent }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        {leftContent}
      </div>
      <div className="app-header-logo">
        <img src="/logo.png" alt="Compras Verdu" className="app-logo-img" />
      </div>
      <div className="app-header-right">
        {rightContent}
      </div>
    </header>
  );
}
