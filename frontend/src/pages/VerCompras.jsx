import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import * as XLSX from 'xlsx';
import { compras, proveedores as apiProveedores } from '../api/client';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import ProveedorLabel from '../components/ProveedorLabel';
import { ChevronDown, Search, X } from 'lucide-react';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import { formatNum, formatDate, todayStr, formatProveedorText, getProveedorNombre, getProveedorCodigo, fechaCivilYmdKey } from '../lib/format';
import './VerCompras.css';

const isApp = () => Capacitor.isNativePlatform();

function getNumeroCompra(c) {
  return c.numeroCompra != null ? c.numeroCompra : '—';
}

/** Costo por unidad = precioPorBulto / uxb cuando uxb > 0 (datos de recepción). */
function costoPorUnidad(precioPorBulto, uxb) {
  const u = Number(uxb) || 0;
  if (u <= 0) return null;
  const p = Number(precioPorBulto) || 0;
  return p / u;
}

/** Subtotal de compra por artículo = bultos * precioPorBulto (datos de compra). */
function subtotalCompra(detalle) {
  if (!detalle) return 0;
  const total = detalle.total;
  if (total != null && typeof total.toString === 'function') {
    const parsed = parseFloat(String(total));
    if (Number.isFinite(parsed)) return parsed;
  }
  const b = Number(detalle.bultos) || 0;
  const p = Number(detalle.precioPorBulto) || 0;
  return b * p;
}

/** Para cada detalle de compra, devuelve el detalle de recepción si existe. */
function getDetalleRecepcion(detalleCompraId, recepcion) {
  if (!recepcion?.detalles?.length) return null;
  return recepcion.detalles.find((dr) => dr.detalleCompraId === detalleCompraId) || null;
}

const EXCEL_SHEET_NAME_MAX = 31;
const INVALID_SHEET_CHARS = /[:\\/?*[\]]/g;

/** Devuelve un nombre de hoja único, válido para Excel (máx 31 caracteres, sin : \\ / ? * [ ]). */
function nombreHojaUnico(base, usados) {
  let nombre = base.replace(INVALID_SHEET_CHARS, ' ').slice(0, EXCEL_SHEET_NAME_MAX);
  if (!usados.has(nombre)) {
    usados.add(nombre);
    return nombre;
  }
  let n = 2;
  let candidato;
  do {
    const sufijo = ` (${n})`;
    candidato = (base.replace(INVALID_SHEET_CHARS, ' ').slice(0, EXCEL_SHEET_NAME_MAX - sufijo.length) + sufijo).slice(0, EXCEL_SHEET_NAME_MAX);
    n++;
  } while (usados.has(candidato));
  usados.add(candidato);
  return candidato;
}

/** Exporta un libro Excel con una hoja por compra (por proveedor). Incluye columnas de recepción si existen. */
function exportarPorProveedor(comprasList) {
  const wb = XLSX.utils.book_new();
  const nombresUsados = new Set();
  comprasList.forEach((c) => {
    const base = `Compra ${getNumeroCompra(c)}`;
    const nombreHoja = nombreHojaUnico(base, nombresUsados);
    const proveedorNombre = getProveedorNombre(c.proveedor) ?? '—';
    const proveedorCodigo = getProveedorCodigo(c.proveedor) ?? '';
    const encabezados = ['Código', 'Descripción', 'Bultos Comp.', '$/Bulto (compra)', 'Subtotal (compra)', 'Bultos Recib.', 'Costo unidad (rec.)', 'Costo total (rec.)', 'UxB', 'Precio Venta', 'Margen %'];
    const colCount = encabezados.length;
    const padRow = (row) => {
      const next = [...row];
      while (next.length < colCount) next.push('');
      return next;
    };
    const totalMontoRaw = c.totalMonto;
    const totalMontoNum = totalMontoRaw != null && typeof totalMontoRaw.toString === 'function'
      ? parseFloat(String(totalMontoRaw))
      : Number(totalMontoRaw);
    const totalMontoExcel = Number.isFinite(totalMontoNum) ? totalMontoNum : '';
    const filas = (c.detalles || []).map((d) => {
      const dr = getDetalleRecepcion(d.id, c.recepcion);
      const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb) : null;
      const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0 ? (Number(dr.cantidad) * costoUnidad) : null;
      return [
        d.producto?.codigo ?? '',
        d.producto?.descripcion ?? '',
        d.bultos ?? 0,
        d.precioPorBulto != null ? Number(d.precioPorBulto) : '',
        subtotalCompra(d),
        dr != null ? (dr.cantidad ?? '') : '',
        costoUnidad != null ? costoUnidad : '',
        costoTotal != null ? costoTotal : '',
        dr != null ? (dr.uxb ?? '') : '',
        dr?.precioVenta != null ? dr.precioVenta : '',
        dr?.margenPorc != null ? dr.margenPorc : '',
      ];
    });
    const filaProveedor = padRow(['Proveedor', proveedorNombre, 'Cód. proveedor', proveedorCodigo]);
    const filaTotalCompra = padRow(['Total $ compra', totalMontoExcel]);
    const ws = XLSX.utils.aoa_to_sheet([filaProveedor, filaTotalCompra, encabezados, ...filas]);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  });
  XLSX.writeFile(wb, 'compras-por-proveedor.xlsx');
}

/**
 * Exporta una sola hoja agregada por día de compra + código de artículo (todos los proveedores en una fila).
 * Los importes unitarios son promedios ponderados por cantidad (bultos o unidades recibidas), no promedios simples.
 */
function exportarPorArticulo(comprasList) {
  /**
   * @typedef {{
   *   fechaKey: string,
   *   fechaRef: string | Date,
   *   codigo: string,
   *   descripcion: string,
   *   sumBultos: number,
   *   sumSubtotal: number,
   *   sumCantidadRec: number,
   *   sumCostoTotalRec: number,
   *   sumUxbBultos: number,
   *   sumBultosUxb: number,
   *   sumPvCant: number,
   *   sumCantPv: number,
   *   sumCostoConPv: number,
   *   sumPvConCosto: number,
   * }} Agg
   */

  /** @type {Map<string, Map<string, Agg>>} */
  const porFechaCodigo = new Map();

  comprasList.forEach((c) => {
    const fechaKey = fechaCivilYmdKey(c.fecha);
    if (!fechaKey) return;
    (c.detalles || []).forEach((d) => {
      const codigoTrim = String(d.producto?.codigo ?? '').trim();
      const codigoKey = codigoTrim || `__sin_codigo_${d.productoId ?? d.producto?.id ?? d.id}`;
      let porCodigo = porFechaCodigo.get(fechaKey);
      if (!porCodigo) {
        porCodigo = new Map();
        porFechaCodigo.set(fechaKey, porCodigo);
      }
      let agg = porCodigo.get(codigoKey);
      if (!agg) {
        agg = {
          fechaKey,
          fechaRef: c.fecha,
          codigo: codigoTrim,
          descripcion: String(d.producto?.descripcion ?? '').trim(),
          sumBultos: 0,
          sumSubtotal: 0,
          sumCantidadRec: 0,
          sumCostoTotalRec: 0,
          sumUxbBultos: 0,
          sumBultosUxb: 0,
          sumPvCant: 0,
          sumCantPv: 0,
          sumCostoConPv: 0,
          sumPvConCosto: 0,
        };
        porCodigo.set(codigoKey, agg);
      }
      if (!agg.descripcion && d.producto?.descripcion) {
        agg.descripcion = String(d.producto.descripcion).trim();
      }

      const bultos = Number(d.bultos) || 0;
      agg.sumBultos += bultos;
      agg.sumSubtotal += subtotalCompra(d);

      const dr = getDetalleRecepcion(d.id, c.recepcion);
      const cantRaw = dr != null && dr.cantidad != null && dr.cantidad !== '' ? Number(dr.cantidad) : NaN;
      const cantRec = Number.isFinite(cantRaw) && cantRaw > 0 ? cantRaw : 0;

      if (dr && cantRec > 0) {
        const costoUnidad = costoPorUnidad(d.precioPorBulto, dr.uxb);
        const pv = dr.precioVenta != null ? Number(dr.precioVenta) : NaN;
        if (costoUnidad != null) {
          const costoLinea = cantRec * costoUnidad;
          agg.sumCostoTotalRec += costoLinea;
          agg.sumCantidadRec += cantRec;
          if (Number.isFinite(pv)) {
            agg.sumCostoConPv += costoLinea;
            agg.sumPvConCosto += pv * cantRec;
          }
        }
        if (Number.isFinite(pv)) {
          agg.sumPvCant += pv * cantRec;
          agg.sumCantPv += cantRec;
        }
      }

      if (dr && bultos > 0) {
        const uxbN = Number(dr.uxb);
        if (Number.isFinite(uxbN) && uxbN > 0) {
          agg.sumUxbBultos += uxbN * bultos;
          agg.sumBultosUxb += bultos;
        }
      }
    });
  });

  const pares = [];
  porFechaCodigo.forEach((porCodigo, fechaKey) => {
    porCodigo.forEach((agg) => {
      pares.push({ fechaKey, agg });
    });
  });
  pares.sort((a, b) => {
    if (a.fechaKey !== b.fechaKey) return a.fechaKey.localeCompare(b.fechaKey);
    return (a.agg.codigo || a.agg.descripcion).localeCompare(b.agg.codigo || b.agg.descripcion, 'es', { sensitivity: 'base' });
  });

  const encabezados = [
    'Fecha',
    'Cód. artículo',
    'Descripción',
    'Bultos Comp.',
    '$/Bulto (compra)',
    'Subtotal (compra)',
    'Bultos Recib.',
    'Costo unidad (rec.)',
    'Costo total (rec.)',
    'UxB',
    'Precio Venta',
    'Margen %',
  ];

  const filas = pares.map(({ agg }) => {
    const precioPorBultoPond = agg.sumBultos > 0 ? agg.sumSubtotal / agg.sumBultos : null;
    const costoUnidadPond = agg.sumCantidadRec > 0 ? agg.sumCostoTotalRec / agg.sumCantidadRec : null;
    const uxbPond = agg.sumBultosUxb > 0 ? agg.sumUxbBultos / agg.sumBultosUxb : null;
    const precioVentaPond = agg.sumCantPv > 0 ? agg.sumPvCant / agg.sumCantPv : null;
    const margenRecalculado = agg.sumCostoConPv > 0
      ? ((agg.sumPvConCosto - agg.sumCostoConPv) / agg.sumCostoConPv) * 100
      : null;

    return [
      formatDate(agg.fechaRef),
      agg.codigo,
      agg.descripcion,
      agg.sumBultos,
      precioPorBultoPond != null && Number.isFinite(precioPorBultoPond) ? precioPorBultoPond : '',
      agg.sumSubtotal,
      agg.sumCantidadRec > 0 ? agg.sumCantidadRec : '',
      costoUnidadPond != null && Number.isFinite(costoUnidadPond) ? costoUnidadPond : '',
      agg.sumCantidadRec > 0 ? agg.sumCostoTotalRec : '',
      uxbPond != null && Number.isFinite(uxbPond) ? uxbPond : '',
      precioVentaPond != null && Number.isFinite(precioVentaPond) ? precioVentaPond : '',
      margenRecalculado != null && Number.isFinite(margenRecalculado) ? margenRecalculado : '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Por artículo');
  XLSX.writeFile(wb, 'compras-por-articulo.xlsx');
}

export default function VerCompras() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedoresList, setProveedoresList] = useState([]);
  const [expandidoKey, setExpandidoKey] = useState(null);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const providerSearchInputRef = useRef(null);

  const toggleExpandir = (id) => {
    setExpandidoKey((prev) => (prev === id ? null : id));
  };

  const filteredProveedores = useMemo(() => {
    if (!providerSearch.trim()) return proveedoresList;
    const q = providerSearch.trim().toLowerCase();
    return proveedoresList.filter((p) => (p.nombre || '').toLowerCase().includes(q));
  }, [proveedoresList, providerSearch]);

  useEffect(() => {
    if (providerPickerOpen && providerSearchInputRef.current) {
      const t = setTimeout(() => providerSearchInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [providerPickerOpen]);

  useEffect(() => {
    if (!providerPickerOpen) return;
    const onEscape = (e) => { if (e.key === 'Escape') setProviderPickerOpen(false); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [providerPickerOpen]);

  useEffect(() => {
    apiProveedores.list().then(setProveedoresList).catch(() => setProveedoresList([]));
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroDesde) params.desde = filtroDesde;
      if (filtroHasta) params.hasta = filtroHasta;
      if (proveedorId) params.proveedorId = proveedorId;
      const data = await compras.list(params);
      setList(data);
    } catch (e) {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filtroDesde, filtroHasta, proveedorId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { registerRefresh } = usePullToRefresh();
  useEffect(() => {
    registerRefresh(cargar);
    return () => registerRefresh(null);
  }, [cargar, registerRefresh]);

  return (
    <div className="vercompras-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="vercompras-back" title="Volver al panel" aria-label="Volver al panel">
              <BackNavIcon className="vercompras-back-icon" />
            </Link>
            <h1 className="vercompras-header-title">Ver Compras</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />
      <div className="vercompras-filtros">
        <div className="vercompras-field">
          <label>Desde</label>
          <input
            type="date"
            value={filtroDesde}
            max={todayStr()}
            onChange={(e) => setFiltroDesde(e.target.value)}
            aria-label="Fecha desde"
          />
        </div>
        <div className="vercompras-field">
          <label>Hasta</label>
          <input
            type="date"
            value={filtroHasta}
            max={todayStr()}
            onChange={(e) => setFiltroHasta(e.target.value)}
            aria-label="Fecha hasta"
          />
        </div>
        <div className="vercompras-field">
          <label>Proveedor</label>
          {isApp() ? (
            <>
              <button
                type="button"
                className="vercompras-provider-picker-field"
                onClick={() => setProviderPickerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={providerPickerOpen}
                aria-label="Elegir proveedor. Buscar por nombre."
                data-has-value={proveedorId ? 'true' : undefined}
              >
                <span className="vercompras-provider-picker-field-value">
                  {proveedorId
                    ? (formatProveedorText(proveedoresList.find((p) => p.id === proveedorId)) ?? 'Proveedor')
                    : 'Todos'}
                </span>
                <ChevronDown className="vercompras-provider-picker-chevron" aria-hidden strokeWidth={2} />
              </button>
              {providerPickerOpen && (
                <div
                  className="vercompras-provider-picker-backdrop"
                  onClick={() => setProviderPickerOpen(false)}
                  role="presentation"
                >
                  <div
                    className="vercompras-provider-picker-sheet"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Buscar proveedor"
                  >
                    <div className="vercompras-provider-picker-sheet-header">
                      <h2 className="vercompras-provider-picker-sheet-title">Elegir proveedor</h2>
                      <button
                        type="button"
                        className="vercompras-provider-picker-close"
                        onClick={() => setProviderPickerOpen(false)}
                        aria-label="Cerrar"
                      >
                        <X className="vercompras-provider-picker-close-icon" aria-hidden strokeWidth={2} />
                      </button>
                    </div>
                    <div className="vercompras-provider-picker-search-wrap">
                      <Search className="vercompras-provider-picker-search-icon" aria-hidden strokeWidth={2} />
                      <input
                        ref={providerSearchInputRef}
                        type="search"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="vercompras-provider-picker-search"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        aria-label="Buscar proveedor"
                      />
                      {providerSearch && (
                        <button
                          type="button"
                          className="vercompras-provider-picker-search-clear"
                          onClick={() => setProviderSearch('')}
                          aria-label="Borrar búsqueda"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="vercompras-provider-picker-list-wrap">
                      <ul className="vercompras-provider-picker-list" role="listbox">
                        <li
                          role="option"
                          aria-selected={!proveedorId}
                          className={`vercompras-provider-picker-item ${!proveedorId ? 'vercompras-provider-picker-item-selected' : ''}`}
                          onClick={() => {
                            setProveedorId('');
                            setProviderPickerOpen(false);
                            setProviderSearch('');
                          }}
                        >
                          <span className="vercompras-provider-picker-item-name">Todos</span>
                          {!proveedorId && (
                            <span className="vercompras-provider-picker-item-check" aria-hidden>✓</span>
                          )}
                        </li>
                        {filteredProveedores.length === 0 ? (
                          providerSearch.trim() ? (
                            <li className="vercompras-provider-picker-empty">
                              Ningún proveedor coincide con la búsqueda.
                            </li>
                          ) : null
                        ) : (
                          filteredProveedores.map((p) => (
                            <li
                              key={p.id}
                              role="option"
                              aria-selected={proveedorId === p.id}
                              className={`vercompras-provider-picker-item ${proveedorId === p.id ? 'vercompras-provider-picker-item-selected' : ''}`}
                              onClick={() => {
                                setProveedorId(p.id);
                                setProviderPickerOpen(false);
                                setProviderSearch('');
                              }}
                            >
                              <span className="vercompras-provider-picker-item-name">{formatProveedorText(p)}</span>
                              {proveedorId === p.id && (
                                <span className="vercompras-provider-picker-item-check" aria-hidden>✓</span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
            >
              <option value="">Todos</option>
              {proveedoresList.map((p) => (
                <option key={p.id} value={p.id}>{formatProveedorText(p)}</option>
              ))}
            </select>
          )}
        </div>
        <p className="vercompras-filtros-ayuda" role="note">
          Filtro por <strong>fecha de compra</strong> cargada en la planilla (no por recepción).
        </p>
      </div>
      {!loading && list.length > 0 && (
        <div className="vercompras-export">
          <button type="button" className="vercompras-btn-export" onClick={() => exportarPorProveedor(list)}>
            Exportar por proveedor
          </button>
          <button type="button" className="vercompras-btn-export" onClick={() => exportarPorArticulo(list)}>
            Exportar por artículo
          </button>
        </div>
      )}
      {loading ? (
        <AppLoader message="Cargando compras..." />
      ) : list.length === 0 ? (
        <div className="vercompras-empty">No hay compras con los filtros elegidos.</div>
      ) : (
        <div className="vercompras-list">
          {list.map((c) => {
            const expandido = expandidoKey === c.id;
            return (
              <article key={c.id} className={`vercompras-card ${expandido ? 'vercompras-card--open' : ''}`}>
                <button
                  type="button"
                  className="vercompras-card-head vercompras-card-head--btn"
                  onClick={() => toggleExpandir(c.id)}
                  aria-expanded={expandido}
                  aria-controls={`vercomp-detalle-${c.id}`}
                >
                  <span className="vercompras-card-numero" title="Número de compra">Nº {getNumeroCompra(c)}</span>
                  <span className="vercompras-card-fecha">{formatDate(c.fecha)}</span>
                  <ProveedorLabel proveedor={c.proveedor} className="vercompras-card-proveedor" />
                  <span className="vercompras-card-user">{c.user?.nombre}</span>
                  <span className="vercompras-card-chevron" aria-hidden>{expandido ? '▼' : '▶'}</span>
                </button>
                {expandido && (
                  <div id={`vercomp-detalle-${c.id}`} className="vercompras-card-body">
                    <div className="vercompras-card-totales">
                      <span className="vercompras-total-chip" aria-label={`Total bultos: ${formatNum(c.totalBultos)} bultos`}>
                        {formatNum(c.totalBultos)} bultos
                      </span>
                      <span className="vercompras-total-chip vercompras-total-chip--monto" aria-label={`Total compra: $ ${formatNum(c.totalMonto)}`}>
                        $ {formatNum(c.totalMonto)}
                      </span>
                    </div>
                    {c.detalles?.length > 0 && (
                      <div className="vercompras-detalle-wrap">
                        <table className="vercompras-detalle">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Descripción</th>
                              <th className="vercompras-col-num">Bultos Comp.</th>
                              <th className="vercompras-col-num">$/Bulto</th>
                              <th className="vercompras-col-num">Subtotal compra</th>
                              <th className="vercompras-col-num">Bultos Recib.</th>
                              <th className="vercompras-col-num">Costo unidad (rec.)</th>
                              <th className="vercompras-col-num">Costo total (rec.)</th>
                              <th className="vercompras-col-num">UxB</th>
                              <th className="vercompras-col-num">Precio Venta</th>
                              <th className="vercompras-col-num">Margen %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.detalles.map((d) => {
                              const dr = getDetalleRecepcion(d.id, c.recepcion);
                              const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb) : null;
                              const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0
                                ? (Number(dr.cantidad) * costoUnidad)
                                : null;
                              const subtotal = subtotalCompra(d);
                              return (
                                <tr key={d.id}>
                                  <td>{d.producto?.codigo}</td>
                                  <td className="vercompras-col-desc">{d.producto?.descripcion}</td>
                                  <td className="vercompras-col-num">{formatNum(d.bultos)}</td>
                                  <td className="vercompras-col-num">{d.precioPorBulto != null ? formatNum(d.precioPorBulto) : '—'}</td>
                                  <td className="vercompras-col-num vercompras-col-subtotal">{formatNum(subtotal)}</td>
                                  <td className="vercompras-col-num">{dr != null ? formatNum(dr.cantidad) : '—'}</td>
                                  <td className="vercompras-col-num">{costoUnidad != null ? formatNum(costoUnidad) : '—'}</td>
                                  <td className="vercompras-col-num">{costoTotal != null ? formatNum(costoTotal) : '—'}</td>
                                  <td className="vercompras-col-num">{dr != null ? formatNum(dr.uxb) : '—'}</td>
                                  <td className="vercompras-col-num">{dr?.precioVenta != null ? formatNum(dr.precioVenta) : '—'}</td>
                                  <td className="vercompras-col-num">{dr?.margenPorc != null ? `${formatNum(dr.margenPorc)} %` : '—'}</td>
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
    </div>
  );
}
