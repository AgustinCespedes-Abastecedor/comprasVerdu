import React from 'react';
import { Apple, Carrot, Cherry, Grape } from 'lucide-react';

const glyph = {
  strokeWidth: 1.85,
  className: 'home-header-brand-lockup__glyph',
  'aria-hidden': true,
};

/**
 * Marca compacta tipo “icono + texto” para el slot izquierdo del header en Home.
 */
export default function HomeHeaderBrand() {
  return (
    <div
      className="home-header-brand-lockup"
      aria-label="Compras Verdu, gestión de compras"
    >
      <span className="home-header-brand-lockup__visual" aria-hidden="true">
        <span className="home-header-brand-lockup__cluster home-header-brand-lockup__cluster--start">
          <Carrot {...glyph} />
          <Apple {...glyph} />
        </span>
        <span className="home-header-brand-lockup__wordmark">
          <span className="home-header-brand-lockup__segment">Compras</span>
          <span className="home-header-brand-lockup__segment home-header-brand-lockup__segment--accent">
            Verdu
          </span>
        </span>
        <span className="home-header-brand-lockup__cluster home-header-brand-lockup__cluster--end">
          <Cherry {...glyph} />
          <Grape {...glyph} />
        </span>
      </span>
    </div>
  );
}
