import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { recepciones } from '../api/client';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import { useResponse } from '../context/ResponseContext';
import './VerCompras.css';

function formatNum(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('es-AR');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR');
}

function getNumeroRecepcion(r) {
  return r.numeroRecepcion != null ? r.numeroRecepcion : '—';
}

function getNumeroCompra(c) {
  return c?.numeroCompra != null ? c.numeroCompra : '—';
}

/** Costo por unidad = precioPorBulto / uxb cuando uxb > 0 */
function costoPorUnidad(precioPorBulto, uxb) {
  const u = Number(uxb) || 0;
  if (u <= 0) return '';
  const p = Number(precioPorBulto) || 0;
  return p / u;
}

/** Margen % (MarkUP) = (precioVenta - costo) / costo * 100 */
function margenPorc(precioVenta, costo) {
  const pv = Number(precioVenta) || 0;
  const c = Number(costo) || 0;
  if (c <= 0 || pv <= 0) return null;
  return ((pv - c) / c) * 100;
}

export default function VerRecepciones() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [expandidoKey, setExpandidoKey] = useState(null);
  const [modalRecepcion, setModalRecepcion] = useState(null);
  const [preciosEdit, setPreciosEdit] = useState({});
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);
  const { showSuccess, showError } = useResponse();

  const toggleExpandir = (id) => {
    setExpandidoKey((prev) => (prev === id ? null : id));
  };

  const params = {};
  if (filtroDesde) params.desde = filtroDesde;
  if (filtroHasta) params.hasta = filtroHasta;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    recepciones.list(params)
      .then((data) => { if (!cancelled) setList(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filtroDesde, filtroHasta]);

  const abrirModalPrecios = (r) => {
    const initial = {};
    (r.detalles || []).forEach((d) => {
      const v = d.precioVenta;
      initial[d.id] = v != null && v !== '' ? String(v) : '';
    });
    setPreciosEdit(initial);
    setModalRecepcion(r);
  };

  const setPrecioDetalle = (detalleId, value) => {
    setPreciosEdit((prev) => ({ ...prev, [detalleId]: value }));
  };

  const guardarPreciosVenta = async () => {
    if (!modalRecepcion) return;
    const detalles = (modalRecepcion.detalles || [])
      .filter((d) => {
        const v = preciosEdit[d.id];
        return v !== '' && v != null && Number(v) >= 0;
      })
      .map((d) => ({ id: d.id, precioVenta: Number(preciosEdit[d.id]) || 0 }));
    if (detalles.length === 0) {
      showError('Ingresá al menos un precio de venta.');
      return;
    }
    setGuardandoPrecios(true);
    try {
      const actualizada = await recepciones.updatePrecios(modalRecepcion.id, { detalles });
      setList((prev) => prev.map((rec) => (rec.id === actualizada.id ? actualizada : rec)));
      setModalRecepcion(null);
      showSuccess('Precios de venta y márgenes actualizados.');
    } catch (e) {
      showError(e?.message || 'Error al guardar precios');
    } finally {
      setGuardandoPrecios(false);
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
            <h1 className="vercompras-header-title">Ver Recepciones</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />
      <div className="vercompras-filtros">
        <div className="vercompras-field">
          <label htmlFor="verrec-desde">Desde</label>
          <input
            id="verrec-desde"
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
          />
        </div>
        <div className="vercompras-field">
          <label htmlFor="verrec-hasta">Hasta</label>
          <input
            id="verrec-hasta"
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <AppLoader message="Cargando recepciones..." />
      ) : list.length === 0 ? (
        <div className="vercompras-empty">No hay recepciones en el rango de fechas elegido.</div>
      ) : (
        <div className="vercompras-list">
          {list.map((r) => {
            const expandido = expandidoKey === r.id;
            return (
              <article key={r.id} className={`vercompras-card ${expandido ? 'vercompras-card--open' : ''}`}>
                <button
                  type="button"
                  className="vercompras-card-head vercompras-card-head--btn"
                  onClick={() => toggleExpandir(r.id)}
                  aria-expanded={expandido}
                  aria-controls={`verrec-detalle-${r.id}`}
                >
                  <span className="vercompras-card-numero" title="Número de recepción">Nº {getNumeroRecepcion(r)}</span>
                  <span className="vercompras-card-fecha">{formatDate(r.compra?.fecha)}</span>
                  <span className="verrecepciones-proveedor-cell">
                    <span className="vercompras-card-proveedor">{r.compra?.proveedor?.nombre}</span>
                    {(!r.detalles?.length || r.detalles.some((d) => d.precioVenta == null || d.precioVenta === '')) && (
                      <button
                        type="button"
                        className="verrecepciones-btn-precio"
                        onClick={(e) => { e.stopPropagation(); abrirModalPrecios(r); }}
                        title="Agregar precio de venta y ver margen (MarkUP)"
                      >
                        Agregar Prec.Venta
                      </button>
                    )}
                  </span>
                  <span className="vercompras-card-user">{r.user?.nombre}</span>
                  <span className="vercompras-card-chevron" aria-hidden>{expandido ? '▼' : '▶'}</span>
                </button>
                {expandido && (
                  <div id={`verrec-detalle-${r.id}`} className="vercompras-card-body">
                    <div className="vercompras-card-totales">
                      <span>Compra Nº {getNumeroCompra(r.compra)}</span>
                    </div>
                    {r.detalles?.length > 0 && (
                      <div className="vercompras-detalle-wrap">
                        <table className="vercompras-detalle">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Descripción</th>
                              <th>Bultos</th>
                              <th>Bultos Recibidos</th>
                              <th>UxB</th>
                              <th>Costo</th>
                              <th>Precio Venta</th>
                              <th>Margen %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.detalles.map((d) => {
                              const dc = d.detalleCompra;
                              const costo = costoPorUnidad(dc?.precioPorBulto, d.uxb);
                              const costoNum = costo !== '' ? Number(costo) : 0;
                              const pv = d.precioVenta != null ? Number(d.precioVenta) : null;
                              const margen = d.margenPorc != null ? Number(d.margenPorc) : (pv != null && costoNum > 0 ? margenPorc(pv, costoNum) : null);
                              return (
                                <tr key={d.id}>
                                  <td>{dc?.producto?.codigo}</td>
                                  <td>{dc?.producto?.descripcion}</td>
                                  <td>{formatNum(dc?.bultos)}</td>
                                  <td>{formatNum(d.cantidad)}</td>
                                  <td>{formatNum(d.uxb)}</td>
                                  <td>{costo !== '' ? formatNum(costo) : '—'}</td>
                                  <td>{pv != null ? formatNum(pv) : '—'}</td>
                                  <td>{margen != null ? `${formatNum(margen)} %` : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modalRecepcion && (
        <div className="verrecepciones-modal-backdrop" onClick={() => setModalRecepcion(null)} role="presentation">
          <div className="verrecepciones-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verrecepciones-modal-head">
              <h2 className="verrecepciones-modal-title">Agregar Precio de Venta</h2>
              <button type="button" className="verrecepciones-modal-close" onClick={() => setModalRecepcion(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <p className="verrecepciones-modal-intro">Recepción Nº {getNumeroRecepcion(modalRecepcion)} — {modalRecepcion.compra?.proveedor?.nombre}. Con costo y precio de venta se calcula el Margen % (MarkUP).</p>
            <div className="verrecepciones-modal-scroll">
              <table className="vercompras-detalle verrecepciones-modal-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Costo</th>
                    <th>Precio Venta</th>
                    <th>Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {(modalRecepcion.detalles || []).map((d) => {
                    const dc = d.detalleCompra;
                    const costo = costoPorUnidad(dc?.precioPorBulto, d.uxb);
                    const costoNum = costo !== '' ? Number(costo) : 0;
                    const pvInput = preciosEdit[d.id] ?? (d.precioVenta != null ? String(d.precioVenta) : '');
                    const pvNum = pvInput !== '' ? Number(pvInput) : null;
                    const margen = pvNum != null && costoNum > 0 ? margenPorc(pvNum, costoNum) : null;
                    return (
                      <tr key={d.id}>
                        <td>{dc?.producto?.codigo}</td>
                        <td>{dc?.producto?.descripcion}</td>
                        <td>{costo !== '' ? formatNum(costo) : '—'}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pvInput}
                            onChange={(e) => setPrecioDetalle(d.id, e.target.value)}
                            className="verrecepciones-input-precio"
                            placeholder="0"
                          />
                        </td>
                        <td>{margen != null ? `${formatNum(margen)} %` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="verrecepciones-modal-actions">
              <button type="button" className="verrecepciones-modal-btn-cancel" onClick={() => setModalRecepcion(null)}>
                Cancelar
              </button>
              <button type="button" className="verrecepciones-modal-btn-save" onClick={guardarPreciosVenta} disabled={guardandoPrecios}>
                {guardandoPrecios ? 'Guardando…' : 'Guardar precios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
