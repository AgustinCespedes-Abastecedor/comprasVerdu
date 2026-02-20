import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { infoFinalArticulos } from '../api/client';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import { formatNum, formatMoneda, formatPct, formatEntero, todayStr } from '../lib/format';
import './VerCompras.css';

/** Redondea a 2 decimales para comparar números. */
const redondear = (v) => (v != null && !Number.isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);

/** Detecta diferencias entre Sistema Tecnolar y datos de recepción (por campo). */
function diferenciasTecnolarRecepcion(item) {
  const t = item.tecnolar || {};
  const uxbT = redondear(t.uxb) ?? null;
  const uxbR = item.uxb != null && !Number.isNaN(Number(item.uxb)) ? Number(item.uxb) : null;
  const costoT = redondear(t.precioCosto) ?? null;
  const costoR = redondear(item.costoSinIva) ?? null;
  const margenT = redondear(t.margen) ?? null;
  const margenR = item.margenPorc != null ? redondear(item.margenPorc) : (item.precioVenta != null && item.costoPromedioPonderado > 0 ? redondear(((item.precioVenta - item.costoPromedioPonderado) / item.costoPromedioPonderado) * 100) : null);
  const pvT = redondear(t.precioVenta) ?? null;
  const pvR = redondear(item.precioVenta) ?? null;
  const uxb = (uxbT != null || uxbR != null) && uxbT !== uxbR;
  const costo = (costoT != null || costoR != null) && costoT !== costoR;
  const margen = (margenT != null || margenR != null) && margenT !== margenR;
  const precioVenta = (pvT != null || pvR != null) && pvT !== pvR;
  return { uxb, costo, margen, precioVenta, alguna: uxb || costo || margen || precioVenta };
}

export default function InfoFinalArticulos() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(() => todayStr());
  const [expandidoKey, setExpandidoKey] = useState(null);
  const [uxbUsuario, setUxbUsuario] = useState({});
  const [guardandoKey, setGuardandoKey] = useState(null);
  /** Claves (codigo|uxb) ya guardadas en esta sesión; el campo queda bloqueado */
  const [guardadosKeys, setGuardadosKeys] = useState(() => new Set());
  const [errorGuardarKey, setErrorGuardarKey] = useState(null);
  const [errorGuardarMsg, setErrorGuardarMsg] = useState(null);

  const loadList = useCallback(() => {
    if (!fecha) return Promise.resolve();
    setLoading(true);
    return infoFinalArticulos
      .list(fecha)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [fecha]);

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

  const { registerRefresh } = usePullToRefresh();
  useEffect(() => {
    registerRefresh(loadList);
    return () => registerRefresh(null);
  }, [loadList, registerRefresh]);

  const itemKey = (item) => `${item.codigo}|${item.uxb}`;

  const toggleExpandir = (item) => {
    const key = itemKey(item);
    setExpandidoKey((prev) => (prev === key ? null : key));
    if (!uxbUsuario[key] && uxbUsuario[key] !== 0) {
      setUxbUsuario((prev) => ({ ...prev, [key]: item.uxb ?? '' }));
    }
  };

  const setUxbForItem = (item, value) => {
    const k = itemKey(item);
    setUxbUsuario((prev) => ({ ...prev, [k]: value }));
    setErrorGuardarKey((prev) => {
      if (prev === k) setErrorGuardarMsg(null);
      return prev === k ? null : prev;
    });
  };

  const guardarUxb = async (item) => {
    const key = itemKey(item);
    const valor = uxbUsuario[key] ?? item.uxb ?? '';
    const uxbNum = Math.max(0, parseInt(String(valor).trim(), 10));
    if (Number.isNaN(uxbNum) || uxbNum <= 0) {
      setErrorGuardarKey(key);
      setErrorGuardarMsg('Ingresá un número mayor a 0.');
      return;
    }
    setErrorGuardarKey(null);
    setErrorGuardarMsg(null);
    setGuardandoKey(key);
    try {
      await infoFinalArticulos.saveUxb({ fecha, codigo: item.codigo, uxb: uxbNum });
      const nuevaKey = `${item.codigo}|${uxbNum}`;
      setGuardadosKeys((prev) => new Set([...prev, key, nuevaKey]));
      setUxbUsuario((prev) => ({ ...prev, [key]: uxbNum, [nuevaKey]: uxbNum }));
      await loadList();
      setExpandidoKey((prev) => (prev === key ? nuevaKey : prev));
    } catch (e) {
      setErrorGuardarKey(key);
      setErrorGuardarMsg(e.message || 'Error al guardar.');
      if (e.status === 401) {
        localStorage.removeItem('compras_verdu_token');
        window.location.href = '/login';
        return;
      }
    } finally {
      setGuardandoKey(null);
    }
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
          No hay artículos recepcionados en esta fecha, o no hubo recepciones ese día.
        </div>
      ) : (
        <div className="vercompras-list info-final-list">
          {list.map((item) => {
            const key = itemKey(item);
            const expandido = expandidoKey === key;
            const uxbInput = uxbUsuario[key] ?? item.uxb ?? '';
            const t = item.tecnolar || {};
            const editableBackend = item.editable === true || (item.editable !== false && Number(item.uxb) === 0);
            const bloqueado = !editableBackend || guardadosKeys.has(key);
            const diff = diferenciasTecnolarRecepcion(item);
            return (
              <article key={key} className={`info-final-card ${expandido ? 'info-final-card--open' : ''}`}>
                <button
                  type="button"
                  className={`info-final-card-head ${diff.alguna ? 'info-final-card-head--con-diferencias' : ''}`}
                  onClick={() => toggleExpandir(item)}
                  aria-expanded={expandido}
                  aria-controls={`info-final-detalle-${key.replace(/\|/g, '-')}`}
                >
                  <span className="info-final-card-codigo">{item.codigo}</span>
                  <span className="info-final-card-desc">{item.descripcion}</span>
                  {(item.numeroRecepcion != null || item.numeroCompra != null) && (
                    <span className="info-final-card-rec-compra">
                      Rec. Nº {item.numeroRecepcion ?? '—'} / Compra Nº {item.numeroCompra ?? '—'}
                    </span>
                  )}
                  <span className="info-final-card-uxb">UxB {formatEntero(item.uxb)}</span>
                  <span className="info-final-card-chevron" aria-hidden>{expandido ? '▼' : '▶'}</span>
                </button>
                {expandido && (
                  <div id={`info-final-detalle-${key.replace(/\|/g, '-')}`} className="info-final-detalle">
                    <div className="info-final-block info-final-block--tecnolar">
                      <h3 className="info-final-block-title">Sistema Tecnolar</h3>
                      <div className="info-final-grid">
                        <div className={`info-final-row ${diff.uxb ? 'info-final-row--diferencia' : ''}`}>
                          <span className="info-final-label">UxB</span>
                          <span className="info-final-value info-final-value--num">{t.uxb != null ? formatEntero(t.uxb) : '—'}</span>
                        </div>
                        <div className={`info-final-row ${diff.costo ? 'info-final-row--diferencia' : ''}`}>
                          <span className="info-final-label">PrecioCosto</span>
                          <span className="info-final-value info-final-value--num">{t.precioCosto != null && t.precioCosto !== 0 ? formatMoneda(t.precioCosto) : '—'}</span>
                        </div>
                        <div className={`info-final-row ${diff.margen ? 'info-final-row--diferencia' : ''}`}>
                          <span className="info-final-label">Margen</span>
                          <span className="info-final-value info-final-value--num">{t.margen != null && t.margen !== 0 ? formatPct(t.margen) : '—'}</span>
                        </div>
                        <div className={`info-final-row ${diff.precioVenta ? 'info-final-row--diferencia' : ''}`}>
                          <span className="info-final-label">PrecioVenta</span>
                          <span className="info-final-value info-final-value--num">{t.precioVenta != null && t.precioVenta !== 0 ? formatMoneda(t.precioVenta) : '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="info-final-block info-final-block--recepcion">
                      <h3 className="info-final-block-title">
                        {item.numeroRecepcion != null || item.numeroCompra != null
                          ? `Datos recepción Nº ${item.numeroRecepcion ?? '—'} / Compra Nº ${item.numeroCompra ?? '—'}`
                          : 'Datos recepción (Ver Compras)'}
                      </h3>
                      <div className="info-final-grid">
                        <div className={`info-final-row info-final-row--uxb-guardar ${diff.uxb ? 'info-final-row--diferencia' : ''}`}>
                          <span className="info-final-label">UxB</span>
                          <span className="info-final-value info-final-value--num info-final-value--input">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={uxbInput}
                              onChange={(e) => !bloqueado && setUxbForItem(item, e.target.value)}
                              className={`info-final-input-uxb ${bloqueado ? 'info-final-input-uxb--guardado' : ''}`}
                              placeholder="—"
                              disabled={bloqueado}
                              readOnly={bloqueado}
                              aria-readonly={bloqueado}
                            />
                            <button
                              type="button"
                              className={`info-final-btn-guardar ${bloqueado ? 'info-final-btn-guardar--guardado' : ''}`}
                              onClick={() => !bloqueado && guardarUxb(item)}
                              disabled={bloqueado || guardandoKey === key}
                              title={bloqueado ? 'UXB ya guardado' : 'Guardar UXB y registrar en el historial'}
                            >
                              {guardandoKey === key ? 'Guardando…' : bloqueado ? 'Guardado' : 'Guardar'}
                            </button>
                            {errorGuardarKey === key && !bloqueado && (
                              <span className="info-final-uxb-error" role="alert">{errorGuardarMsg || 'Error al guardar. Revisá la conexión.'}</span>
                            )}
                          </span>
                        </div>
                        <div className="info-final-row">
                          <span className="info-final-label">Costo c/IVA</span>
                          <span className="info-final-value info-final-value--num">
                            {item.costoConIva != null && item.costoConIva !== '' ? formatMoneda(Number(item.costoConIva)) : '—'}
                          </span>
                        </div>
                        <div className={`info-final-row ${diff.costo ? 'info-final-row--diferencia' : ''}`}>
                          <span className="info-final-label">Costo s/IVA</span>
                          <span className="info-final-value info-final-value--num">
                            {item.costoSinIva != null && item.costoSinIva !== '' ? formatMoneda(Number(item.costoSinIva)) : '—'}
                          </span>
                        </div>
                        <div className={`info-final-row ${diff.margen ? 'info-final-row--diferencia' : ''}`}>
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
                        <div className={`info-final-row ${diff.precioVenta ? 'info-final-row--diferencia' : ''}`}>
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
