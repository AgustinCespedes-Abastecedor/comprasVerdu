import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { compras, recepciones } from '../api/client';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import { useResponse } from '../context/ResponseContext';
import ProveedorLabel from '../components/ProveedorLabel';
import { formatNum, formatDate, todayStr } from '../lib/format';
import { costoPorUnidadRecepcion, recepcionUxBBrutoInvalidoVsCajon, uxbNetoParaCosto } from '../lib/costoRecepcion';
import { NOTIFICATIONS_POLL_REQUEST } from '../lib/notificationEvents';
import { esCompraNumeroTesteo } from '../lib/compraTesteo';
import ListPaginationBar from '../components/ListPaginationBar';
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [expandidoId, setExpandidoId] = useState(null);
  const [cantidades, setCantidades] = useState({});
  const [uxb, setUxb] = useState({});
  const [recepcionCargada, setRecepcionCargada] = useState({});
  const [guardando, setGuardando] = useState(false);
  const { showSuccess, showError } = useResponse();

  const params = useMemo(() => {
    const p = { sinRecepcion: true, page: String(page), pageSize: String(pageSize) };
    if (filtroDesde) p.desde = filtroDesde;
    if (filtroHasta) p.hasta = filtroHasta;
    return p;
  }, [filtroDesde, filtroHasta, page, pageSize]);

  const filtrosKey = `${filtroDesde}|${filtroHasta}`;
  useEffect(() => {
    setPage(1);
  }, [filtrosKey]);

  const applyListPayload = (data) => {
    if (data && Array.isArray(data.items)) {
      setList(data.items);
      setTotal(typeof data.total === 'number' ? data.total : data.items.length);
    } else {
      const arr = Array.isArray(data) ? data : [];
      setList(arr);
      setTotal(arr.length);
    }
  };

  const loadList = useCallback(() => {
    setLoading(true);
    return compras.list(params)
      .then((data) => applyListPayload(data))
      .catch(() => { setList([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    compras.list(params)
      .then((data) => { if (!cancelled) applyListPayload(data); })
      .catch(() => { if (!cancelled) { setList([]); setTotal(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params]);

  const { registerRefresh } = usePullToRefresh();
  useEffect(() => {
    registerRefresh(loadList);
    return () => registerRefresh(null);
  }, [loadList, registerRefresh]);

  const cargarRecepcion = async (compraId, _compra) => {
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

  /** Costo por kg útil: precioPorBulto / (UxB − peso cajón), con peso cajón cargado en la compra. */
  const calcularCosto = (d) => {
    const uxbVal = parseNum(uxb[d.id]);
    const pesoCajon = d.pesoCajon != null ? Number(d.pesoCajon) : 0;
    const c = costoPorUnidadRecepcion(d.precioPorBulto, uxbVal, pesoCajon);
    return c != null ? c : '';
  };

  const uxbFinalMostrado = (d) => {
    const bruto = parseNum(uxb[d.id]);
    if (bruto <= 0) return '';
    const pesoCajon = d.pesoCajon != null ? Number(d.pesoCajon) : 0;
    const neto = uxbNetoParaCosto(bruto, pesoCajon);
    return neto > 0 ? formatNum(neto) : '—';
  };

  const handleGuardarRecepcion = async (compra) => {
    const detalles = (compra.detalles || []).map((d) => ({
      detalleCompraId: d.id,
      cantidad: parseNum(cantidades[d.id]),
      uxb: parseNum(uxb[d.id]),
    }));
    const invalido = detalles.some((row) => {
      const dc = (compra.detalles || []).find((d) => d.id === row.detalleCompraId);
      const pesoCajon = dc?.pesoCajon != null ? Number(dc.pesoCajon) : 0;
      return recepcionUxBBrutoInvalidoVsCajon(row.uxb, pesoCajon);
    });
    if (invalido) {
      showError(
        'El UxB debe ser mayor al peso del cajón de la compra en todos los artículos donde cargaste UxB. Revisá UxB final en la grilla.',
        'RECEP_009',
      );
      return;
    }
    setGuardando(true);
    try {
      await recepciones.save({ compraId: compra.id, detalles });
      showSuccess('Recepción guardada correctamente.');
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_POLL_REQUEST));
      setExpandidoId(null);
      setRecepcionCargada((prev) => ({ ...prev, [compra.id]: true }));
      await loadList();
    } catch (e) {
      showError(e ?? { message: 'Error al guardar la recepción' });
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
              <BackNavIcon className="recepcion-listado-back-icon" />
            </Link>
            <h1 className="recepcion-listado-header-title">Recepción de compras</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="recepcion-listado-main">
        <div className="recepcion-listado-intro">
          <p>
            Elegí una compra para cargar la cantidad recibida en depósito por artículo. El peso del cajón cargado en
            la compra se descuenta del UxB para calcular el costo; la columna UxB final muestra ese
            valor (kg útiles por bulto).
          </p>
          <p className="recepcion-listado-intro-nota" role="note">
            Las fechas del filtro son la <strong>fecha de compra</strong> de la planilla. Al guardar, se
            actualiza la recepción y queda registrada la hora de <strong>última modificación</strong> de ese
            registro (visible en Ver recepciones e Info final de artículos).
          </p>
        </div>

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
          <>
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
                  <span className="recepcion-listado-card-head-left">
                    <span className="recepcion-listado-card-numero">Nº {getNumeroCompra(c)}</span>
                    {esCompraNumeroTesteo(c) && (
                      <span className="app-tag-testeo" title="Compra de pruebas del sistema (Nº 1–10)">
                        TESTEO
                      </span>
                    )}
                  </span>
                  <span className="recepcion-listado-card-fecha">{formatDate(c.fecha)}</span>
                  <ProveedorLabel proveedor={c.proveedor} className="recepcion-listado-card-proveedor" />
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
                          <th>Peso cajón (kg)</th>
                          <th>Bultos recibidos</th>
                          <th>UxB</th>
                          <th>UxB final</th>
                          <th>Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(c.detalles || []).map((d) => (
                          <tr key={d.id}>
                            <td>{d.producto?.codigo}</td>
                            <td>{d.producto?.descripcion}</td>
                            <td>{formatNum(d.bultos)}</td>
                            <td>{formatNum(d.pesoCajon != null ? Number(d.pesoCajon) : 0)}</td>
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
                                inputMode="decimal"
                                aria-label={`UxB en kilogramos (peso bruto por bulto) para ${d.producto?.descripcion || d.producto?.codigo}`}
                              />
                            </td>
                            <td>
                              <span className="recepcion-listado-uxb-final" aria-live="polite">
                                {uxbFinalMostrado(d)}
                              </span>
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
          <ListPaginationBar
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            disabled={loading}
            navLabel="Paginación de compras pendientes de recepción"
          />
          </>
        )}
      </main>
    </div>
  );
}
