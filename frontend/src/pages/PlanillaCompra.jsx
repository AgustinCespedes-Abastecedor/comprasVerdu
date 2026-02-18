import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { proveedores, productos, compras } from '../api/client';
import { useResponse } from '../context/ResponseContext';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import './PlanillaCompra.css';

const isApp = () => Capacitor.isNativePlatform();

const SEARCH_PAGE_SIZE = 25;
const DEBOUNCE_MS = 300;

function formatNum(n) {
  if (n == null || n === '') return '';
  const x = Number(n);
  return isNaN(x) ? '' : x.toLocaleString('es-AR');
}

function parseNum(str) {
  if (str === '' || str == null) return 0;
  if (typeof str === 'number' && !isNaN(str)) return str;
  const x = String(str).replace(/\./g, '').replace(',', '.');
  return isNaN(Number(x)) ? 0 : Number(x);
}

function productToFila(p, filaId) {
  return {
    filaId,
    orden: 0,
    productoId: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    stockSucursales: p.stockSucursales,
    stockCD: p.stockCD,
    ventasN1: p.ventasN1,
    ventasN2: p.ventasN2,
    ventas7dias: p.ventas7dias,
    costo: p.costo,
    precioVenta: p.precioVenta,
    margenPorc: p.margenPorc,
    bultos: '',
    precioPorBulto: '',
    pesoPorBulto: '',
    precioVentaCompra: '',
    precioPorKg: '',
    margenFinalPorc: '',
    total: '',
  };
}

export default function PlanillaCompra() {
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState(hoy);
  const [proveedorId, setProveedorId] = useState('');
  const [proveedoresList, setProveedoresList] = useState([]);
  const [filas, setFilas] = useState([]);
  const [totalesDia, setTotalesDia] = useState({ totalBultos: 0, totalMonto: 0 });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [busquedaArticulo, setBusquedaArticulo] = useState('');
  const [busquedaArticuloDebounced, setBusquedaArticuloDebounced] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { showSuccess, showError } = useResponse();
  const debounceArticuloRef = useRef(null);
  const searchInputRef = useRef(null);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const providerSearchInputRef = useRef(null);

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
    let cancelled = false;
    proveedores.list().then((prov) => {
      if (!cancelled) setProveedoresList(prov);
    }).catch((e) => {
      if (!cancelled) setMensaje({ tipo: 'error', text: e.message });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (debounceArticuloRef.current) clearTimeout(debounceArticuloRef.current);
    debounceArticuloRef.current = setTimeout(() => setBusquedaArticuloDebounced(busquedaArticulo), DEBOUNCE_MS);
    return () => { if (debounceArticuloRef.current) clearTimeout(debounceArticuloRef.current); };
  }, [busquedaArticulo]);

  useEffect(() => {
    if (!busquedaArticuloDebounced.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const params = {
      fecha,
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
      sortBy: 'descripcion',
      sortDir: 'asc',
      q: busquedaArticuloDebounced.trim(),
    };
    productos.list(params).then((res) => {
      if (!cancelled) {
        setSearchResults(res.items || []);
        setSearchLoading(false);
      }
    }).catch((e) => {
      if (!cancelled) {
        setMensaje({ tipo: 'error', text: e.message });
        setSearchResults([]);
        setSearchLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [busquedaArticuloDebounced, fecha]);

  const generarFilaId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const agregarArticulo = (producto) => {
    const nuevaFila = productToFila(producto, generarFilaId());
    nuevaFila.orden = filas.length;
    setFilas((prev) => [...prev, nuevaFila]);
    setBusquedaArticulo('');
    setBusquedaArticuloDebounced('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const quitarFila = (filaId) => {
    setFilas((prev) => prev.filter((f) => f.filaId !== filaId));
  };

  useEffect(() => {
    let cancelled = false;
    compras.totalesDia(fecha).then((r) => {
      if (!cancelled) setTotalesDia(r);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fecha]);

  const actualizarFila = (filaId, field, value) => {
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.filaId === filaId);
      if (idx < 0) return prev;
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      const bultos = parseNum(row.bultos);
      const precioBulto = parseNum(row.precioPorBulto);
      const pesoBulto = parseNum(row.pesoPorBulto);
      const precioVentaCompra = parseNum(row.precioVentaCompra);
      row.precioPorKg = pesoBulto > 0 ? precioBulto / pesoBulto : '';
      row.total = bultos > 0 && precioBulto >= 0 ? bultos * precioBulto : '';
      row.margenFinalPorc = precioBulto > 0 && precioVentaCompra >= 0
        ? ((precioVentaCompra - precioBulto) / precioBulto) * 100
        : '';
      next[idx] = row;
      return next;
    });
  };

  const duplicarFila = (filaId) => {
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.filaId === filaId);
      if (idx < 0) return prev;
      const original = prev[idx];
      const nuevaFila = {
        ...original,
        filaId: generarFilaId(),
        orden: (original.orden ?? idx) + 0.5,
        bultos: '',
        precioPorBulto: '',
        pesoPorBulto: '',
        precioVentaCompra: '',
        precioPorKg: '',
        margenFinalPorc: '',
        total: '',
      };
      return [...prev.slice(0, idx + 1), nuevaFila, ...prev.slice(idx + 1)];
    });
  };

  const totalesCompra = useMemo(() => {
    let bultos = 0;
    let monto = 0;
    filas.forEach((f) => {
      bultos += parseNum(f.bultos) || 0;
      monto += parseNum(f.total) || 0;
    });
    return { bultos, monto };
  }, [filas]);

  const totalDiaBultos = totalesDia.totalBultos + totalesCompra.bultos;
  const totalDiaMonto = (Number(totalesDia.totalMonto) || 0) + totalesCompra.monto;

  const handleGuardar = async () => {
    if (!proveedorId) {
      setMensaje({ tipo: 'error', text: 'Seleccioná un proveedor' });
      return;
    }
    const detalles = filas
      .filter((f) => parseNum(f.bultos) > 0)
      .map((f) => ({
        productoId: f.productoId,
        bultos: parseNum(f.bultos),
        precioPorBulto: parseNum(f.precioPorBulto),
        pesoPorBulto: parseNum(f.pesoPorBulto),
      }));
    if (detalles.length === 0) {
      setMensaje({ tipo: 'error', text: 'Completá al menos un ítem con cantidad de bultos' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      await compras.create({
        fecha,
        proveedorId,
        detalles,
      });
      showSuccess('Compra guardada correctamente. Podés consultarla en Ver Compras.');
      setTotalesDia((t) => ({
        ...t,
        totalBultos: t.totalBultos + totalesCompra.bultos,
        totalMonto: Number(t.totalMonto) + totalesCompra.monto,
      }));
      setFilas([]);
    } catch (e) {
      showError(e?.message || 'Error al guardar la compra');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="planilla-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="planilla-back" title="Volver al panel" aria-label="Volver al panel">
              <svg className="planilla-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <h1 className="planilla-header-title">Nueva Compra</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="planilla-main">
        <section className="planilla-section planilla-section-filters">
          <div className="planilla-filters">
            <div className="planilla-filter-group">
              <label className="planilla-filter-label">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="planilla-input planilla-input-date"
              />
            </div>
          </div>
        </section>

        {mensaje && (
          <div className={`planilla-alert planilla-alert-${mensaje.tipo}`} role="alert">
            {mensaje.text}
          </div>
        )}

        <section className="planilla-section planilla-section-table">
          <div className="planilla-table-legend">
            <span className="planilla-legend-item planilla-legend-bd">Datos del sistema</span>
            <span className="planilla-legend-item planilla-legend-manual">Datos a completar</span>
            <span className="planilla-legend-item planilla-legend-calculo">Calculado</span>
          </div>
          <div className={`planilla-add-article-wrap ${searchLoading ? 'planilla-add-article-wrap-busy' : ''}`}>
            <label htmlFor="planilla-buscar-articulo" className="planilla-search-label">Agregar artículo a la grilla</label>
            <div className="planilla-add-article-row">
              <input
                id="planilla-buscar-articulo"
                ref={searchInputRef}
                type="search"
                value={busquedaArticulo}
                onChange={(e) => {
                  setBusquedaArticulo(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Busca por nombre o código"
                className="planilla-input planilla-input-search"
                autoComplete="off"
                aria-label="Buscar artículo para agregar"
                aria-expanded={searchOpen && searchResults.length > 0}
                aria-describedby={busquedaArticulo.trim() ? 'planilla-busqueda-articulo-resultados' : undefined}
                aria-busy={searchLoading}
              />
              {searchLoading && (
                <span className="planilla-search-spinner" aria-hidden>
                  <span className="planilla-search-spinner-dot" />
                </span>
              )}
            </div>
            {busquedaArticulo.trim() && (
              <span id="planilla-busqueda-articulo-resultados" className="planilla-search-results" aria-live="polite">
                {searchLoading ? 'Buscando…' : `${searchResults.length} ${searchResults.length === 1 ? 'resultado' : 'resultados'}. Clic para agregar.`}
              </span>
            )}
            {searchOpen && busquedaArticulo.trim() && (
              <>
                <div className="planilla-search-backdrop" onClick={() => setSearchOpen(false)} role="presentation" aria-hidden />
                <ul className="planilla-search-results-list" role="listbox">
                  {searchLoading && searchResults.length === 0 ? (
                    <li className="planilla-search-result-item planilla-search-result-empty">Buscando…</li>
                  ) : searchResults.length === 0 ? (
                    <li className="planilla-search-result-item planilla-search-result-empty">Ningún artículo coincide.</li>
                  ) : (
                    searchResults.map((p) => (
                      <li
                        key={p.id}
                        role="option"
                        className="planilla-search-result-item"
                        onClick={() => agregarArticulo(p)}
                      >
                        <span className="planilla-search-result-codigo">{p.codigo}</span>
                        <span className="planilla-search-result-desc">{p.descripcion}</span>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>
          <p className="planilla-table-hint" aria-live="polite">
            Agregá artículos con el buscador de arriba. Deslizá la tabla para ver todas las columnas. Usá − para quitar y + para duplicar la fila.
          </p>
          <div className="planilla-table-wrap">
            <table className="planilla-table">
              <thead>
                <tr className="planilla-thead-row planilla-thead-row-group">
                  <th className="planilla-th planilla-th-accion" scope="col" aria-label="Duplicar fila" />
                  <th colSpan={2} className="planilla-th planilla-th-bd planilla-th-sticky-group">Datos del sistema</th>
                  <th colSpan={3} className="planilla-th planilla-th-bd">Stock en bultos</th>
                  <th colSpan={3} className="planilla-th planilla-th-bd">Ventas en unidades</th>
                  <th colSpan={3} className="planilla-th planilla-th-bd">$ unitarios vigentes</th>
                  <th colSpan={4} className="planilla-th planilla-th-manual">Compra</th>
                  <th colSpan={3} className="planilla-th planilla-th-calculo">Total</th>
                </tr>
                <tr className="planilla-thead-row">
                  <th className="planilla-th planilla-th-accion" scope="col">
                    <span className="planilla-col-accion-label">− / +</span>
                  </th>
                  <th className="planilla-th planilla-th-bd planilla-col-codigo">Código</th>
                  <th className="planilla-th planilla-th-bd planilla-col-desc">Descripción</th>
                  <th className="planilla-th planilla-th-bd">Sucursal</th>
                  <th className="planilla-th planilla-th-bd">CD</th>
                  <th className="planilla-th planilla-th-bd">Total</th>
                  <th className="planilla-th planilla-th-bd">N-1</th>
                  <th className="planilla-th planilla-th-bd">N-2</th>
                  <th className="planilla-th planilla-th-bd">7 días</th>
                  <th className="planilla-th planilla-th-bd planilla-col-costo">Costo</th>
                  <th className="planilla-th planilla-th-bd">Venta</th>
                  <th className="planilla-th planilla-th-bd">Margen %</th>
                  <th className="planilla-th planilla-th-manual">Bultos</th>
                  <th className="planilla-th planilla-th-manual">Precio/bulto</th>
                  <th className="planilla-th planilla-th-manual">Peso/bulto</th>
                  <th className="planilla-th planilla-th-manual">Precio Venta</th>
                  <th className="planilla-th planilla-th-calculo planilla-col-precio-kg">$/kg</th>
                  <th className="planilla-th planilla-th-calculo planilla-col-margen-final">Margen Final %</th>
                  <th className="planilla-th planilla-th-calculo planilla-col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.filaId} className="planilla-tbody-tr">
                    <td className="planilla-td planilla-td-accion">
                      <span className="planilla-accion-btns">
                        <button
                          type="button"
                          className="planilla-btn-quitar"
                          onClick={() => quitarFila(f.filaId)}
                          title="Quitar esta fila"
                          aria-label={`Quitar ${f.descripcion}`}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="planilla-btn-duplicar"
                          onClick={() => duplicarFila(f.filaId)}
                          title="Duplicar fila"
                          aria-label={`Duplicar ${f.descripcion}`}
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="planilla-td planilla-td-bd planilla-col-codigo"><input type="text" className="planilla-cell planilla-cell-bd planilla-cell-codigo" value={f.codigo} readOnly /></td>
                    <td className="planilla-td planilla-td-bd planilla-col-desc"><input type="text" className="planilla-cell planilla-cell-bd planilla-cell-desc" value={f.descripcion} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.stockSucursales)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.stockCD)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum((f.stockSucursales ?? 0) + (f.stockCD ?? 0))} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.ventasN1)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.ventasN2)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.ventas7dias)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd planilla-col-costo"><input type="text" className="planilla-cell planilla-cell-bd planilla-cell-costo" value={formatNum(f.costo)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.precioVenta)} readOnly /></td>
                    <td className="planilla-td planilla-td-bd"><input type="text" className="planilla-cell planilla-cell-bd" value={formatNum(f.margenPorc)} readOnly /></td>
                    <td className="planilla-td planilla-td-manual">
                      <input type="text" className="planilla-cell planilla-cell-manual" value={f.bultos} onChange={(e) => actualizarFila(f.filaId, 'bultos', e.target.value)} placeholder="—" inputMode="numeric" />
                    </td>
                    <td className="planilla-td planilla-td-manual">
                      <input type="text" className="planilla-cell planilla-cell-manual" value={f.precioPorBulto} onChange={(e) => actualizarFila(f.filaId, 'precioPorBulto', e.target.value)} placeholder="—" inputMode="numeric" />
                    </td>
                    <td className="planilla-td planilla-td-manual">
                      <input type="text" className="planilla-cell planilla-cell-manual" value={f.pesoPorBulto} onChange={(e) => actualizarFila(f.filaId, 'pesoPorBulto', e.target.value)} placeholder="—" inputMode="decimal" />
                    </td>
                    <td className="planilla-td planilla-td-manual">
                      <input type="text" className="planilla-cell planilla-cell-manual" value={f.precioVentaCompra} onChange={(e) => actualizarFila(f.filaId, 'precioVentaCompra', e.target.value)} placeholder="—" inputMode="numeric" />
                    </td>
                    <td className="planilla-td planilla-td-calculo planilla-col-precio-kg"><input type="text" className="planilla-cell planilla-cell-calculo planilla-cell-precio-kg" value={formatNum(f.precioPorKg)} readOnly /></td>
                    <td className="planilla-td planilla-td-calculo planilla-col-margen-final"><input type="text" className="planilla-cell planilla-cell-calculo planilla-cell-margen-final" value={formatNum(f.margenFinalPorc)} readOnly /></td>
                    <td className="planilla-td planilla-td-calculo planilla-col-total"><input type="text" className="planilla-cell planilla-cell-calculo planilla-cell-total" value={formatNum(f.total)} readOnly /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="planilla-tfoot-tr">
                  <td colSpan={13} className="planilla-tfoot-label">Total esta compra</td>
                  <td className="planilla-td planilla-td-manual planilla-tfoot-value">{formatNum(totalesCompra.bultos)}</td>
                  <td colSpan={3} className="planilla-td" />
                  <td className="planilla-td planilla-td-calculo" />
                  <td className="planilla-td planilla-td-calculo planilla-col-total planilla-tfoot-value">{formatNum(totalesCompra.monto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="planilla-section planilla-section-totals">
          <div className="planilla-totals-card">
            <div className="planilla-totals-header">
              <span className="planilla-totals-title">Resumen del día</span>
              <span className="planilla-totals-date">{new Date(fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <div className="planilla-totals-grid">
              <div className="planilla-totals-item">
                <span className="planilla-totals-label">Bultos totales</span>
                <span className="planilla-totals-number">{formatNum(totalDiaBultos)}</span>
              </div>
              <div className="planilla-totals-item">
                <span className="planilla-totals-label">Monto total</span>
                <span className="planilla-totals-number">$ {formatNum(totalDiaMonto)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="planilla-section planilla-section-proveedor">
          <div className="planilla-proveedor-asignar">
            <label className="planilla-proveedor-label">Proveedor de la compra</label>
            {isApp() ? (
              <>
                <button
                  type="button"
                  className="planilla-provider-picker-field planilla-provider-picker-field-bottom"
                  onClick={() => setProviderPickerOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={providerPickerOpen}
                  aria-label="Elegir proveedor. Buscar por nombre."
                  data-has-value={proveedorId ? 'true' : undefined}
                >
                  <span className="planilla-provider-picker-field-value">
                    {proveedorId
                      ? (proveedoresList.find((p) => p.id === proveedorId)?.nombre ?? 'Proveedor')
                      : 'Buscar proveedor para asignar a esta compra'}
                  </span>
                  <svg className="planilla-provider-picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {providerPickerOpen && (
                  <div
                    className="planilla-provider-picker-backdrop"
                    onClick={() => setProviderPickerOpen(false)}
                    role="presentation"
                  >
                    <div
                      className="planilla-provider-picker-sheet"
                      onClick={(e) => e.stopPropagation()}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Buscar proveedor"
                    >
                      <div className="planilla-provider-picker-sheet-header">
                        <h2 className="planilla-provider-picker-sheet-title">Elegir proveedor</h2>
                        <button
                          type="button"
                          className="planilla-provider-picker-close"
                          onClick={() => setProviderPickerOpen(false)}
                          aria-label="Cerrar"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="planilla-provider-picker-search-wrap">
                        <svg className="planilla-provider-picker-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                          ref={providerSearchInputRef}
                          type="search"
                          value={providerSearch}
                          onChange={(e) => setProviderSearch(e.target.value)}
                          placeholder="Buscar por nombre..."
                          className="planilla-provider-picker-search"
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          aria-label="Buscar proveedor"
                        />
                        {providerSearch && (
                          <button
                            type="button"
                            className="planilla-provider-picker-search-clear"
                            onClick={() => setProviderSearch('')}
                            aria-label="Borrar búsqueda"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="planilla-provider-picker-list-wrap">
                        <ul className="planilla-provider-picker-list" role="listbox">
                          {filteredProveedores.length === 0 ? (
                            <li className="planilla-provider-picker-empty">
                              {providerSearch.trim() ? 'Ningún proveedor coincide con la búsqueda.' : 'No hay proveedores cargados.'}
                            </li>
                          ) : (
                            filteredProveedores.map((p) => (
                              <li
                                key={p.id}
                                role="option"
                                aria-selected={proveedorId === p.id}
                                className={`planilla-provider-picker-item ${proveedorId === p.id ? 'planilla-provider-picker-item-selected' : ''}`}
                                onClick={() => {
                                  setProveedorId(p.id);
                                  setProviderPickerOpen(false);
                                  setProviderSearch('');
                                }}
                              >
                                <span className="planilla-provider-picker-item-name">{p.nombre}</span>
                                {proveedorId === p.id && (
                                  <span className="planilla-provider-picker-item-check" aria-hidden>✓</span>
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
              <div className="planilla-proveedor-search-wrap">
                <input
                  id="planilla-buscar-proveedor"
                  type="search"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  onFocus={() => setProviderPickerOpen(true)}
                  placeholder="Buscar proveedor por nombre..."
                  className="planilla-input planilla-input-search planilla-proveedor-search"
                  autoComplete="off"
                  aria-label="Buscar proveedor"
                  aria-expanded={providerPickerOpen}
                />
                {providerPickerOpen && (
                  <>
                    <div className="planilla-provider-picker-backdrop planilla-provider-picker-backdrop-inline" onClick={() => setProviderPickerOpen(false)} role="presentation" />
                    <ul className="planilla-proveedor-dropdown" role="listbox">
                      {filteredProveedores.length === 0 ? (
                        <li className="planilla-provider-picker-empty">
                          {providerSearch.trim() ? 'Ningún proveedor coincide.' : 'No hay proveedores.'}
                        </li>
                      ) : (
                        filteredProveedores.map((p) => (
                          <li
                            key={p.id}
                            role="option"
                            aria-selected={proveedorId === p.id}
                            className={`planilla-provider-picker-item ${proveedorId === p.id ? 'planilla-provider-picker-item-selected' : ''}`}
                            onClick={() => {
                              setProveedorId(p.id);
                              setProviderPickerOpen(false);
                              setProviderSearch(proveedoresList.find((x) => x.id === p.id)?.nombre ?? '');
                            }}
                          >
                            {p.nombre}
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                )}
                {proveedorId && (
                  <p className="planilla-proveedor-selected" aria-live="polite">
                    Proveedor asignado: <strong>{proveedoresList.find((p) => p.id === proveedorId)?.nombre}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="planilla-section planilla-section-actions">
          <button type="button" className="planilla-btn-primary" onClick={handleGuardar} disabled={guardando}>
            {guardando ? (
              <>
                <span className="planilla-btn-spinner" />
                Guardando...
              </>
            ) : (
              'Guardar compra'
            )}
          </button>
        </section>
      </main>
    </div>
  );
}
