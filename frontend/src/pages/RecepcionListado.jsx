import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { compras, recepciones } from '../api/client';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import { useResponse } from '../context/ResponseContext';
import { formatNum, formatDate, todayStr } from '../lib/format';
import './RecepcionListado.css';

function getNumeroCompra(c) {
  return c.numeroCompra != null ? c.numeroCompra : '—';
}

function parseNum(str) {
  if (str === '' || str == null) return 0;
  if (typeof str === 'number' && !isNaN(str)) return str;
  const x = String(str).replace(/\./g, '').replace(',', '.');
  return isNaN(Number(x)) ? 0 : Number(x);
}


export default function RecepcionListado() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [expandidoId, setExpandidoId] = useState(null);
  const [cantidades, setCantidades] = useState({});
  const [uxb, setUxb] = useState({});
  const [recepcionCargada, setRecepcionCargada] = useState({});
  const [guardando, setGuardando] = useState(false);
  const { showSuccess, showError } = useResponse();

  const params = { sinRecepcion: true };
  if (filtroDesde) params.desde = filtroDesde;
  if (filtroHasta) params.hasta = filtroHasta;

  const loadList = useCallback(() => {
    setLoading(true);
    return compras.list(params)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [filtroDesde, filtroHasta]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    compras.list(params)
      .then((data) => { if (!cancelled) setList(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filtroDesde, filtroHasta]);

  const { registerRefresh } = usePullToRefresh();
  useEffect(() => {
    registerRefresh(loadList);
    return () => registerRefresh(null);
  }, [loadList, registerRefresh]);

  const cargarRecepcion = async (compraId, compra) => {
    if (recepcionCargada[compraId]) return;
    try {
      const rec = await compras.getRecepcion(compraId);
      if (rec?.detalles) {
        const cantMap = {};
        const uxbMap = {};
        rec.detalles.forEach((d) => {
          cantMap[d.detalleCompraId] = d.cantidad ?? 0;
          uxbMap[d.detalleCompraId] = d.uxb ?? '';
        });
        setCantidades((prev) => ({ ...prev, ...cantMap }));
        setUxb((prev) => ({ ...prev, ...uxbMap }));
      }
      setRecepcionCargada((prev) => ({ ...prev, [compraId]: true }));
    } catch {
      setRecepcionCargada((prev) => ({ ...prev, [compraId]: true }));
    }
  };

  const toggleExpandir = (compra) => {
    const id = compra.id;
    if (expandidoId === id) {
      setExpandidoId(null);
      return;
    }
    setExpandidoId(id);
    cargarRecepcion(id);
  };

  const actualizarCantidad = (detalleCompraId, value) => {
    setCantidades((prev) => ({ ...prev, [detalleCompraId]: value }));
  };

  const actualizarUxb = (detalleCompraId, value) => {
    setUxb((prev) => ({ ...prev, [detalleCompraId]: value }));
  };

  /** Costo por unidad. Solo cuando UxB > 0: precioPorBulto / UxB */
  const calcularCosto = (d) => {
    const uxbVal = parseNum(uxb[d.id]);
    if (uxbVal <= 0) return '';
    const costoPorBulto = Number(d.precioPorBulto) || 0;
    return costoPorBulto / uxbVal;
  };

  const handleGuardarRecepcion = async (compra) => {
    const detalles = (compra.detalles || []).map((d) => ({
      detalleCompraId: d.id,
      cantidad: parseNum(cantidades[d.id]),
      uxb: parseNum(uxb[d.id]),
    }));
    setGuardando(true);
    try {
      await recepciones.save({ compraId: compra.id, detalles });
      showSuccess('Recepción guardada correctamente.');
      setList((prev) => prev.filter((c) => c.id !== compra.id));
      setExpandidoId(null);
      setRecepcionCargada((prev) => ({ ...prev, [compra.id]: true }));
    } catch (e) {
      showError(e?.message || 'Error al guardar la recepción', e?.code);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="recepcion-listado-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="recepcion-listado-back" title="Volver al inicio" aria-label="Volver al inicio">
              <svg className="recepcion-listado-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <h1 className="recepcion-listado-header-title">Recepción de compras</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="recepcion-listado-main">
        <p className="recepcion-listado-intro">
          Elegí una compra para cargar la cantidad recibida en depósito por artículo.
        </p>

        <div className="recepcion-listado-filtros">
          <div className="recepcion-listado-field">
            <label htmlFor="rec-desde">Desde</label>
            <input
              id="rec-desde"
              type="date"
              value={filtroDesde}
              max={todayStr()}
              onChange={(e) => setFiltroDesde(e.target.value)}
              aria-label="Fecha desde"
            />
          </div>
          <div className="recepcion-listado-field">
            <label htmlFor="rec-hasta">Hasta</label>
            <input
              id="rec-hasta"
              type="date"
              value={filtroHasta}
              max={todayStr()}
              onChange={(e) => setFiltroHasta(e.target.value)}
              aria-label="Fecha hasta"
            />
          </div>
        </div>

        {loading ? (
          <AppLoader message="Cargando compras..." />
        ) : list.length === 0 ? (
          <div className="recepcion-listado-empty">No hay compras en el rango de fechas elegido.</div>
        ) : (
          <div className="recepcion-listado-list">
            {list.map((c) => (
              <article key={c.id} className="recepcion-listado-card">
                <button
                  type="button"
                  className="recepcion-listado-card-head"
                  onClick={() => toggleExpandir(c)}
                  aria-expanded={expandidoId === c.id}
                  aria-controls={`recepcion-detalle-${c.id}`}
                >
                  <span className="recepcion-listado-card-numero">Nº {getNumeroCompra(c)}</span>
                  <span className="recepcion-listado-card-fecha">{formatDate(c.fecha)}</span>
                  <span className="recepcion-listado-card-proveedor">{c.proveedor?.nombre}</span>
                  <span className="recepcion-listado-card-chevron" aria-hidden>
                    {expandidoId === c.id ? '▼' : '▶'}
                  </span>
                </button>

                {expandidoId === c.id && (
                  <div id={`recepcion-detalle-${c.id}`} className="recepcion-listado-detalle-wrap">
                    <table className="recepcion-listado-detalle">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Descripción</th>
                          <th>Bultos</th>
                          <th>Bultos Recibidos</th>
                          <th>UxB</th>
                          <th>Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(c.detalles || []).map((d) => (
                          <tr key={d.id}>
                            <td>{d.producto?.codigo}</td>
                            <td>{d.producto?.descripcion}</td>
                            <td>{formatNum(d.bultos)}</td>
                            <td>
                              <input
                                type="text"
                                className="recepcion-listado-input-cantidad"
                                value={cantidades[d.id] ?? ''}
                                onChange={(e) => actualizarCantidad(d.id, e.target.value)}
                                placeholder="0"
                                inputMode="numeric"
                                aria-label={`Bultos recibidos para ${d.producto?.descripcion || d.producto?.codigo}`}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="recepcion-listado-input-cantidad"
                                value={uxb[d.id] ?? ''}
                                onChange={(e) => actualizarUxb(d.id, e.target.value)}
                                placeholder="—"
                                inputMode="numeric"
                                aria-label={`Unidades por bulto para ${d.producto?.descripcion || d.producto?.codigo}`}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="recepcion-listado-input-costo"
                                value={formatNum(calcularCosto(d))}
                                readOnly
                                tabIndex={-1}
                                aria-label={`Costo con IVA para ${d.producto?.descripcion || d.producto?.codigo}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="recepcion-listado-actions">
                      <button
                        type="button"
                        className="recepcion-listado-btn-guardar"
                        onClick={() => handleGuardarRecepcion(c)}
                        disabled={guardando}
                      >
                        {guardando ? 'Guardando...' : 'Guardar recepción'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
