import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import * as XLSX from 'xlsx';
import { compras, proveedores as apiProveedores } from '../api/client';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import { formatNum, formatDate } from '../lib/format';
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
    const nombreProveedor = c.proveedor?.nombre ?? '—';
    const encabezados = ['Código', 'Descripción', 'Bultos Comp.', 'Bultos Recib.', 'Costo unidad', 'Costo total', 'UxB', 'Precio Venta', 'Margen %'];
    const filas = (c.detalles || []).map((d) => {
      const dr = getDetalleRecepcion(d.id, c.recepcion);
      const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb) : null;
      const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0 ? (Number(dr.cantidad) * costoUnidad) : null;
      return [
        d.producto?.codigo ?? '',
        d.producto?.descripcion ?? '',
        d.bultos ?? 0,
        dr != null ? (dr.cantidad ?? '') : '',
        costoUnidad != null ? costoUnidad : '',
        costoTotal != null ? costoTotal : '',
        dr != null ? (dr.uxb ?? '') : '',
        dr?.precioVenta != null ? dr.precioVenta : '',
        dr?.margenPorc != null ? dr.margenPorc : '',
      ];
    });
    const filaProveedor = ['Proveedor', nombreProveedor];
    const ws = XLSX.utils.aoa_to_sheet([filaProveedor, encabezados, ...filas]);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  });
  XLSX.writeFile(wb, 'compras-por-proveedor.xlsx');
}

/** Exporta una sola hoja con todas las líneas de todas las compras (por artículo). Incluye columnas de recepción si existen. */
function exportarPorArticulo(comprasList) {
  const encabezados = ['Nº Compra', 'Fecha', 'Código', 'Descripción', 'Bultos Comp.', 'Bultos Recib.', 'Costo unidad', 'Costo total', 'UxB', 'Precio Venta', 'Margen %'];
  const filas = [];
  comprasList.forEach((c) => {
    (c.detalles || []).forEach((d) => {
      const dr = getDetalleRecepcion(d.id, c.recepcion);
      const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb) : null;
      const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0 ? (Number(dr.cantidad) * costoUnidad) : null;
      filas.push([
        getNumeroCompra(c),
        formatDate(c.fecha),
        d.producto?.codigo ?? '',
        d.producto?.descripcion ?? '',
        d.bultos ?? 0,
        dr != null ? (dr.cantidad ?? '') : '',
        costoUnidad != null ? costoUnidad : '',
        costoTotal != null ? costoTotal : '',
        dr != null ? (dr.uxb ?? '') : '',
        dr?.precioVenta != null ? dr.precioVenta : '',
        dr?.margenPorc != null ? dr.margenPorc : '',
      ]);
    });
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

  const cargar = async () => {
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
  };

  useEffect(() => {
    cargar();
  }, [filtroDesde, filtroHasta, proveedorId]);

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
            onChange={(e) => setFiltroDesde(e.target.value)}
          />
        </div>
        <div className="vercompras-field">
          <label>Hasta</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
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
                    ? (proveedoresList.find((p) => p.id === proveedorId)?.nombre ?? 'Proveedor')
                    : 'Todos'}
                </span>
                <svg className="vercompras-provider-picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="vercompras-provider-picker-search-wrap">
                      <svg className="vercompras-provider-picker-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
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
                              <span className="vercompras-provider-picker-item-name">{p.nombre}</span>
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
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}
        </div>
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
                  <span className="vercompras-card-proveedor">{c.proveedor?.nombre}</span>
                  <span className="vercompras-card-user">{c.user?.nombre}</span>
                  <span className="vercompras-card-chevron" aria-hidden>{expandido ? '▼' : '▶'}</span>
                </button>
                {expandido && (
                  <div id={`vercomp-detalle-${c.id}`} className="vercompras-card-body">
                    <div className="vercompras-card-totales">
                      <span>{formatNum(c.totalBultos)} bultos</span>
                      <span>$ {formatNum(c.totalMonto)}</span>
                    </div>
                    {c.detalles?.length > 0 && (
                      <div className="vercompras-detalle-wrap">
                        <table className="vercompras-detalle">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Descripción</th>
                              <th>Bultos Comp.</th>
                              <th>Bultos Recib.</th>
                              <th>Costo unidad</th>
                              <th>Costo total</th>
                              <th>UxB</th>
                              <th>Precio Venta</th>
                              <th>Margen %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.detalles.map((d) => {
                              const dr = getDetalleRecepcion(d.id, c.recepcion);
                              const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb) : null;
                              const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0
                                ? (Number(dr.cantidad) * costoUnidad)
                                : null;
                              return (
                                <tr key={d.id}>
                                  <td>{d.producto?.codigo}</td>
                                  <td>{d.producto?.descripcion}</td>
                                  <td>{formatNum(d.bultos)}</td>
                                  <td>{dr != null ? formatNum(dr.cantidad) : '—'}</td>
                                  <td>{costoUnidad != null ? formatNum(costoUnidad) : '—'}</td>
                                  <td>{costoTotal != null ? formatNum(costoTotal) : '—'}</td>
                                  <td>{dr != null ? formatNum(dr.uxb) : '—'}</td>
                                  <td>{dr?.precioVenta != null ? formatNum(dr.precioVenta) : '—'}</td>
                                  <td>{dr?.margenPorc != null ? `${formatNum(dr.margenPorc)} %` : '—'}</td>
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
