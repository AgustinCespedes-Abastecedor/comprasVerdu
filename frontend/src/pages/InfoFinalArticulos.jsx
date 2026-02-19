import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { infoFinalArticulos } from '../api/client';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import './VerCompras.css';

const formatNum = (n) => {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-AR');
};

const formatMoneda = (n) => {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPct = (n) => {
  if (n == null) return '—';
  const s = Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${s} %`;
};

const formatEntero = (n) => {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
};

export default function InfoFinalArticulos() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandidoKey, setExpandidoKey] = useState(null);
  const [uxbUsuario, setUxbUsuario] = useState({});

  useEffect(() => {
    if (!fecha) return;
    let cancelled = false;
    setLoading(true);
    infoFinalArticulos
      .list(fecha)
      .then((data) => { if (!cancelled) setList(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fecha]);

  const itemKey = (item) => `${item.codigo}|${item.uxb}`;

  const toggleExpandir = (item) => {
    const key = itemKey(item);
    setExpandidoKey((prev) => (prev === key ? null : key));
    if (!uxbUsuario[key] && uxbUsuario[key] !== 0) {
      setUxbUsuario((prev) => ({ ...prev, [key]: item.uxb ?? '' }));
    }
  };

  const setUxbForItem = (item, value) => {
    setUxbUsuario((prev) => ({ ...prev, [itemKey(item)]: value }));
  };

  return (
    <div className="vercompras-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="vercompras-back" title="Volver al panel" aria-label="Volver al panel">
              <svg className="vercompras-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <h1 className="vercompras-header-title">Info Final de Artículos</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />
      <div className="vercompras-filtros">
        <div className="vercompras-field">
          <label htmlFor="info-final-fecha">Fecha de la compra</label>
          <input
            id="info-final-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <AppLoader message="Cargando artículos..." />
      ) : list.length === 0 ? (
        <div className="vercompras-empty">
          No hay artículos recepcionados en esta fecha con información completa, o no hubo recepciones ese día.
        </div>
      ) : (
        <div className="vercompras-list info-final-list">
          {list.map((item) => {
            const key = itemKey(item);
            const expandido = expandidoKey === key;
            const uxbInput = uxbUsuario[key] ?? item.uxb ?? '';
            const t = item.tecnolar || {};
            return (
              <article key={key} className={`info-final-card ${expandido ? 'info-final-card--open' : ''}`}>
                <button
                  type="button"
                  className="info-final-card-head"
                  onClick={() => toggleExpandir(item)}
                  aria-expanded={expandido}
                  aria-controls={`info-final-detalle-${key.replace(/\|/g, '-')}`}
                >
                  <span className="info-final-card-codigo">{item.codigo}</span>
                  <span className="info-final-card-desc">{item.descripcion}</span>
                  <span className="info-final-card-uxb">UxB {formatEntero(item.uxb)}</span>
                  <span className="info-final-card-chevron" aria-hidden>{expandido ? '▼' : '▶'}</span>
                </button>
                {expandido && (
                  <div id={`info-final-detalle-${key.replace(/\|/g, '-')}`} className="info-final-detalle">
                    <div className="info-final-block info-final-block--tecnolar">
                      <h3 className="info-final-block-title">Sistema Tecnolar</h3>
                      <div className="info-final-grid">
                        <div className="info-final-row">
                          <span className="info-final-label">UxB</span>
                          <span className="info-final-value info-final-value--num">{t.uxb != null ? formatEntero(t.uxb) : '—'}</span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">PrecioCosto</span>
                          <span className="info-final-value info-final-value--num">{t.precioCosto != null && t.precioCosto !== 0 ? formatMoneda(t.precioCosto) : '—'}</span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">Margen</span>
                          <span className="info-final-value info-final-value--num">{t.margen != null && t.margen !== 0 ? formatPct(t.margen) : '—'}</span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">PrecioVenta</span>
                          <span className="info-final-value info-final-value--num">{t.precioVenta != null && t.precioVenta !== 0 ? formatMoneda(t.precioVenta) : '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="info-final-block info-final-block--recepcion">
                      <h3 className="info-final-block-title">Datos recepción (Ver Compras)</h3>
                      <div className="info-final-grid">
                        <div className="info-final-row">
                          <span className="info-final-label">UxB</span>
                          <span className="info-final-value info-final-value--num info-final-value--input">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={uxbInput}
                              onChange={(e) => setUxbForItem(item, e.target.value)}
                              className="info-final-input-uxb"
                              placeholder="—"
                            />
                          </span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">Costo</span>
                          <span className="info-final-value info-final-value--num">
                            {item.costoPromedioPonderado != null && item.costoPromedioPonderado !== '' ? formatMoneda(Number(item.costoPromedioPonderado)) : '—'}
                          </span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">Margen</span>
                          <span className="info-final-value info-final-value--num">
                            {(() => {
                              const costo = Number(item.costoPromedioPonderado);
                              const pv = Number(item.precioVenta);
                              if (costo > 0 && pv != null && !Number.isNaN(pv)) {
                                const margen = ((pv - costo) / costo) * 100;
                                return formatPct(Math.round(margen * 100) / 100);
                              }
                              return '—';
                            })()}
                          </span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">PrecioVenta</span>
                          <span className="info-final-value info-final-value--num">{item.precioVenta != null ? formatMoneda(item.precioVenta) : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
