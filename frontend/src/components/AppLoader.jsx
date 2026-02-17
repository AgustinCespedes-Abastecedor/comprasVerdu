import React from 'react';
import './AppLoader.css';

const ORBIT_ITEMS = [
  { emoji: '🍎', label: 'Manzana' },
  { emoji: '🍋', label: 'Limón' },
  { emoji: '🍊', label: 'Naranja' },
  { emoji: '🥕', label: 'Zanahoria' },
  { emoji: '🍅', label: 'Tomate' },
  { emoji: '🥬', label: 'Verdura' },
  { emoji: '🍇', label: 'Uva' },
  { emoji: '🥦', label: 'Brócoli' },
];

export default function AppLoader({ message }) {
  return (
    <div className="app-loader" role="status" aria-live="polite" aria-label={message || 'Cargando'}>
      <div className="app-loader-wrap">
        <div className="app-loader-orbit" aria-hidden>
          {ORBIT_ITEMS.map((item, i) => (
            <span
              key={i}
              className="app-loader-orbit-item"
              style={{ '--angle': `${(360 / ORBIT_ITEMS.length) * i}deg` }}
              title={item.label}
            >
              {item.emoji}
            </span>
          ))}
        </div>
        <div className="app-loader-center">
          <img src="/logo.png" alt="" className="app-loader-logo" width="80" height="80" />
        </div>
      </div>
      {message && <p className="app-loader-message">{message}</p>}
    </div>
  );
}
