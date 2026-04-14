import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { proveedores, productos, compras } from '../api/client';
import { todayStr, formatEntero } from '../lib/format';
import { useResponse } from '../context/ResponseContext';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';
import { ChevronDown, Pencil, Search, X } from 'lucide-react';
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

/** Bultos = unidades de stock / UxB (unidades por bulto). */
function textoBultosDesdeStock(unidades, uxb) {
  const u = Number(uxb);
  if (uxb == null || Number.isNaN(u) || u <= 0) return '—';
  const s = Number(unidades);
  if (Number.isNaN(s)) return '—';
  const bultos = s / u;
  return `${bultos.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} bultos`;
}

/** Solo caracteres seguros para nombre de archivo (evita path traversal). */
function codigoParaNombreArchivoArticulo(codigo) {
  const c = String(codigo ?? '').trim();
  if (!c) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(c)) return null;
  return c;
}

/**
 * Miniatura del artículo desde /img/articulos/{codigo}.jpg (solo navegador; en APK no se renderiza).
 */
function PlanillaArticuloRefImagenWeb({ codigo }) {
  const [ocultar, setOcultar] = useState(false);
  const safe = useMemo(() => codigoParaNombreArchivoArticulo(codigo), [codigo]);
  if (isApp() || ocultar || !safe) return null;
  const src = `/img/articulos/${encodeURIComponent(safe)}.jpg`;
  return (
    <div className="planilla-item-ref-thumb-wrap" aria-hidden="true">
      <img
        src={src}
        alt=""
        className="planilla-item-ref-thumb-img"
        loading="lazy"
        decoding="async"
        onError={() => setOcultar(true)}
      />
    </div>
  );
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
    uxb: p.uxb != null && !Number.isNaN(Number(p.uxb)) ? Number(p.uxb) : null,
    bultos: '',
    costoUnidad: '',
    costoTotal: '',
  };
}

export default function PlanillaCompra() {
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState(hoy);
  const [proveedorId, setProveedorId] = useState('');
  const [proveedoresList, setProveedoresList] = useState([]);
  const [filas, setFilas] = useState([]);
  const [, setTotalesDia] = useState({ totalBultos: 0, totalMonto: 0 });
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
  const [providerManualMode, setProviderManualMode] = useState(false);
  const [providerManualName, setProviderManualName] = useState('');
  const [providerMergeBusy, setProviderMergeBusy] = useState(false);
  const [providerReplaceModalOpen, setProviderReplaceModalOpen] = useState(false);
  const [providerReplaceCandidate, setProviderReplaceCandidate] = useState(null);
  const providerSearchInputRef = useRef(null);

  useEffect(() => {
    if (!isApp() || !providerPickerOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const writeInset = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--app-keyboard-inset', `${inset}px`);
    };

    writeInset();
    vv.addEventListener('resize', writeInset);
    vv.addEventListener('scroll', writeInset);
    return () => {
      vv.removeEventListener('resize', writeInset);
      vv.removeEventListener('scroll', writeInset);
      document.documentElement.style.setProperty('--app-keyboard-inset', '0px');
    };
  }, [providerPickerOpen]);

  const filteredProveedores = useMemo(() => {
    if (!providerSearch.trim()) return proveedoresList;
    const q = providerSearch.trim().toLowerCase();
    return proveedoresList.filter((p) => (p.nombre || '').toLowerCase().includes(q));
  }, [proveedoresList, providerSearch]);

  const providerManualSuggestion = useMemo(() => {
    const raw = providerManualName.trim();
    if (!raw) return null;
    const q = raw.toLowerCase();
    const exact = proveedoresList.find((p) => (p.nombre || '').trim().toLowerCase() === q);
    if (exact) return { type: 'exact', provider: exact };
    const partial = proveedoresList.find((p) => (p.nombre || '').toLowerCase().includes(q));
    if (partial) return { type: 'partial', provider: partial };
    return null;
  }, [providerManualName, proveedoresList]);

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
    if (!searchOpen) return;
    const onEscape = (e) => { if (e.key === 'Escape') setSearchOpen(false); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [searchOpen]);

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
      const costoUnidad = parseNum(row.costoUnidad);
      row.costoTotal = bultos > 0 && costoUnidad >= 0 ? bultos * costoUnidad : '';
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
        costoUnidad: '',
        costoTotal: '',
      };
      return [...prev.slice(0, idx + 1), nuevaFila, ...prev.slice(idx + 1)];
    });
  };

  const totalesCompra = useMemo(() => {
    let bultos = 0;
    let monto = 0;
    filas.forEach((f) => {
      bultos += parseNum(f.bultos) || 0;
      monto += parseNum(f.costoTotal) || 0;
    });
    return { bultos, monto };
  }, [filas]);

  const handleGuardar = async () => {
    const manualNombre = providerManualName.trim();
    if (!proveedorId && !manualNombre) {
      setMensaje({ tipo: 'error', text: 'Seleccioná un proveedor o ingresá uno manual' });
      return;
    }
    const detalles = filas
      .filter((f) => parseNum(f.bultos) > 0)
      .map((f) => {
        const bultos = parseNum(f.bultos);
        const costoUnidad = parseNum(f.costoUnidad);
        return {
          productoId: f.productoId,
          codigo: f.codigo,
          descripcion: f.descripcion,
          bultos,
          precioPorBulto: costoUnidad,
          pesoPorBulto: 1,
        };
      });
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
        proveedorNombreManual: manualNombre || undefined,
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
      showError(e ?? { message: 'Error al guardar la compra' });
    } finally {
      setGuardando(false);
    }
  };

  const handleUseExistingProvider = async (provider) => {
    const manualNombre = providerManualName.trim();
    const providerNombre = (provider?.nombre || '').trim();
    if (!provider?.id) return;

    const nombreManualLower = manualNombre.toLowerCase();
    const nombreDestinoLower = providerNombre.toLowerCase();
    const requiereConfirmacion = manualNombre && nombreManualLower !== nombreDestinoLower;

    if (requiereConfirmacion) {
      setProviderReplaceCandidate(provider);
      setProviderReplaceModalOpen(true);
      return;
    }

    try {
      if (manualNombre) {
        setProviderMergeBusy(true);
        const mergeRes = await proveedores.mergeManual({
          manualNombre,
          proveedorDestinoId: provider.id,
        });
        if (mergeRes?.merged) {
          setMensaje({
            tipo: 'ok',
            text: `Proveedor unificado: "${manualNombre}" ahora usa "${providerNombre}".`,
          });
        }
      }
      setProveedorId(provider.id);
      setProviderManualName('');
      setProviderManualMode(false);
      setProviderSearch(provider.nombre);
    } catch (e) {
      setMensaje({ tipo: 'error', text: e.message || 'No se pudo unificar el proveedor manual.' });
    } finally {
      setProviderMergeBusy(false);
    }
  };

  const confirmarReemplazoProveedor = async () => {
    if (!providerReplaceCandidate) {
      setProviderReplaceModalOpen(false);
      return;
    }
    setProviderReplaceModalOpen(false);
    await handleUseExistingProvider(providerReplaceCandidate);
    setProviderReplaceCandidate(null);
  };

  return (
    <div className="planilla-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="planilla-back" title="Volver al panel" aria-label="Volver al panel">
              <BackNavIcon className="planilla-back-icon" />
            </Link>
            <h1 className="planilla-header-title">Nueva Compra</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="planilla-main">
        <section className="planilla-top-bar">
          <div className="planilla-top-fecha">
            <label className="planilla-top-label" htmlFor="planilla-fecha">Fecha de la compra</label>
            <input
              id="planilla-fecha"
              type="date"
              value={fecha}
              max={todayStr()}
              onChange={(e) => setFecha(e.target.value)}
              className="planilla-input planilla-input-date"
              aria-label="Fecha de compra"
            />
          </div>
        </section>

        {mensaje && (
          <div className={`planilla-alert planilla-alert-${mensaje.tipo}`} role="alert">
            {mensaje.text}
          </div>
        )}

        <section className="planilla-section planilla-section-add">
          <div className={`planilla-add-article-wrap ${searchLoading ? 'planilla-add-article-wrap-busy' : ''}`}>
            <label htmlFor="planilla-buscar-articulo" className="planilla-search-label">Agregar artículo</label>
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
                placeholder="Buscar por nombre o código"
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
                {searchLoading ? 'Buscando…' : `${searchResults.length} ${searchResults.length === 1 ? 'resultado' : 'resultados'}. Tocá para agregar.`}
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
          <p className="planilla-hint" aria-live="polite">
            Agregá artículos con el buscador. En cada ítem podés editar bultos y precio, duplicar o quitar.
          </p>
        </section>

        <section className="planilla-section planilla-section-items">
          <ul className="planilla-items-list">
            {filas.map((f) => (
              <li key={f.filaId} className="planilla-item-card">
                <div className="planilla-item-head">
                  <span className="planilla-item-codigo">{f.codigo}</span>
                  <span className="planilla-item-desc" title={f.descripcion}>{f.descripcion}</span>
                  <div className="planilla-item-actions">
                    <button
                      type="button"
                      className="planilla-item-btn planilla-item-btn-dup"
                      onClick={() => duplicarFila(f.filaId)}
                      title="Duplicar"
                      aria-label={`Duplicar ${f.descripcion}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="planilla-item-btn planilla-item-btn-del"
                      onClick={() => quitarFila(f.filaId)}
                      title="Quitar"
                      aria-label={`Quitar ${f.descripcion}`}
                    >
                      −
                    </button>
                  </div>
                </div>
                <div className="planilla-item-ref-block" aria-label="Datos de referencia ELABASTECEDOR">
                  <p className="planilla-item-ref-title">Datos de referencia (ELABASTECEDOR)</p>
                  <div
                    className={
                      isApp()
                        ? 'planilla-item-ref-body'
                        : 'planilla-item-ref-body planilla-item-ref-body--with-thumb'
                    }
                  >
                    <div className="planilla-item-ref-grid">
                    <div className="planilla-item-ref-group planilla-item-ref-group--stock">
                      <span className="planilla-item-ref-label">Stock Suc.</span>
                      <div className="planilla-item-ref-stock-line">
                        <span className="planilla-item-ref-value">{formatNum(f.stockSucursales) || '—'}</span>
                        <span className="planilla-item-ref-bultos" aria-label={`Bultos equivalentes en sucursales: ${textoBultosDesdeStock(f.stockSucursales, f.uxb)}`}>
                          {textoBultosDesdeStock(f.stockSucursales, f.uxb)}
                        </span>
                      </div>
                    </div>
                    <div className="planilla-item-ref-group planilla-item-ref-group--stock">
                      <span className="planilla-item-ref-label">Stock CD</span>
                      <div className="planilla-item-ref-stock-line">
                        <span className="planilla-item-ref-value">{formatNum(f.stockCD) || '—'}</span>
                        <span className="planilla-item-ref-bultos" aria-label={`Bultos equivalentes en CD: ${textoBultosDesdeStock(f.stockCD, f.uxb)}`}>
                          {textoBultosDesdeStock(f.stockCD, f.uxb)}
                        </span>
                      </div>
                    </div>
                    <div className="planilla-item-ref-group planilla-item-ref-group--stock">
                      <span className="planilla-item-ref-label">Stock total</span>
                      <div className="planilla-item-ref-stock-line">
                        <span className="planilla-item-ref-value">{formatNum((f.stockSucursales ?? 0) + (f.stockCD ?? 0)) || '—'}</span>
                        <span className="planilla-item-ref-bultos" aria-label={`Bultos equivalentes totales: ${textoBultosDesdeStock((f.stockSucursales ?? 0) + (f.stockCD ?? 0), f.uxb)}`}>
                          {textoBultosDesdeStock((f.stockSucursales ?? 0) + (f.stockCD ?? 0), f.uxb)}
                        </span>
                      </div>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">UxB</span>
                      <span className="planilla-item-ref-value">{formatEntero(f.uxb)}</span>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">Ventas N-1</span>
                      <span className="planilla-item-ref-value">{formatNum(f.ventasN1) || '—'}</span>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">Ventas N-2</span>
                      <span className="planilla-item-ref-value">{formatNum(f.ventasN2) || '—'}</span>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">Ventas 7 días</span>
                      <span className="planilla-item-ref-value">{formatNum(f.ventas7dias) || '—'}</span>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">Costo</span>
                      <span className="planilla-item-ref-value">{formatNum(f.costo) || '—'}</span>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">Venta</span>
                      <span className="planilla-item-ref-value">{formatNum(f.precioVenta) || '—'}</span>
                    </div>
                    <div className="planilla-item-ref-group">
                      <span className="planilla-item-ref-label">Margen %</span>
                      <span className="planilla-item-ref-value">{formatNum(f.margenPorc) != null && formatNum(f.margenPorc) !== '' ? `${formatNum(f.margenPorc)} %` : '—'}</span>
                    </div>
                    </div>
                    <PlanillaArticuloRefImagenWeb codigo={f.codigo} />
                  </div>
                </div>
                <div className="planilla-item-compra-title">Datos a cargar (compra)</div>
                <div className="planilla-item-fields">
                  <div className="planilla-item-field">
                    <label className="planilla-item-field-label" htmlFor={`planilla-bultos-${f.filaId}`}>Bultos</label>
                    <input
                      id={`planilla-bultos-${f.filaId}`}
                      type="text"
                      className="planilla-item-input"
                      value={f.bultos}
                      onChange={(e) => actualizarFila(f.filaId, 'bultos', e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="planilla-item-field">
                    <label className="planilla-item-field-label" htmlFor={`planilla-costo-${f.filaId}`}>Precio por bulto</label>
                    <input
                      id={`planilla-costo-${f.filaId}`}
                      type="text"
                      className="planilla-item-input"
                      value={f.costoUnidad}
                      onChange={(e) => actualizarFila(f.filaId, 'costoUnidad', e.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="planilla-item-field planilla-item-field-total">
                    <span className="planilla-item-field-label">Total</span>
                    <span className="planilla-item-total" aria-label="Costo total calculado">{formatNum(f.costoTotal) || '—'}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {filas.length === 0 && (
            <p className="planilla-items-empty">Aún no hay artículos. Usá el buscador de arriba para agregar.</p>
          )}
        </section>

        {filas.length > 0 && (
          <section className="planilla-section planilla-section-totales">
            <div className="planilla-totales-bar">
              <span className="planilla-totales-bultos">{formatNum(totalesCompra.bultos)} bultos</span>
              <span className="planilla-totales-monto">$ {formatNum(totalesCompra.monto)}</span>
            </div>
          </section>
        )}

        <section className="planilla-section planilla-section-proveedor">
          <div className="planilla-proveedor-head">
            <label className="planilla-proveedor-label">Proveedor de la compra</label>
            <button
              type="button"
              className={`planilla-provider-manual-toggle ${providerManualMode ? 'planilla-provider-manual-toggle-active' : ''}`}
              onClick={() => {
                setProviderManualMode((prev) => {
                  const next = !prev;
                  if (next) {
                    setProviderPickerOpen(false);
                    setProveedorId('');
                    setProviderSearch('');
                  } else {
                    setProviderManualName('');
                  }
                  return next;
                });
              }}
              aria-pressed={providerManualMode}
              aria-label={providerManualMode ? 'Desactivar carga manual de proveedor' : 'Activar carga manual de proveedor'}
              title={providerManualMode ? 'Desactivar carga manual' : 'Cargar proveedor manual'}
            >
              <Pencil className="planilla-provider-manual-toggle-icon" aria-hidden strokeWidth={2} />
            </button>
          </div>
          {providerManualMode ? (
            <div className="planilla-proveedor-manual-wrap">
              <label className="planilla-proveedor-manual-label" htmlFor="planilla-proveedor-manual-input">
                Nombre del proveedor (manual)
              </label>
              <input
                id="planilla-proveedor-manual-input"
                type="text"
                value={providerManualName}
                onChange={(e) => setProviderManualName(e.target.value)}
                placeholder="Ej: Proveedor Nuevo S.A."
                className="planilla-input planilla-proveedor-manual-input"
                autoComplete="off"
                aria-label="Nombre manual del proveedor"
              />
              {providerManualSuggestion && (
                <div className="planilla-proveedor-manual-suggestion" role="status" aria-live="polite">
                  <span className="planilla-proveedor-manual-suggestion-text">
                    {providerManualSuggestion.type === 'exact'
                      ? `Ya existe: ${providerManualSuggestion.provider.nombre}`
                      : `Coincidencia encontrada: ${providerManualSuggestion.provider.nombre}`}
                  </span>
                  <button
                    type="button"
                    className="planilla-proveedor-manual-suggestion-btn"
                    onClick={() => handleUseExistingProvider(providerManualSuggestion.provider)}
                    aria-label={`Usar proveedor existente ${providerManualSuggestion.provider.nombre}`}
                    disabled={providerMergeBusy}
                  >
                    {providerMergeBusy ? 'Unificando...' : 'Usar existente'}
                  </button>
                </div>
              )}
            </div>
          ) : isApp() ? (
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
                    : 'Elegir proveedor'}
                </span>
                <ChevronDown className="planilla-provider-picker-chevron" aria-hidden strokeWidth={2} />
              </button>
              {providerPickerOpen && (
                <div
                  className="planilla-provider-picker-backdrop planilla-provider-picker-backdrop--top"
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
                        <X className="planilla-provider-picker-close-icon" aria-hidden strokeWidth={2} />
                      </button>
                    </div>
                    <div className="planilla-provider-picker-search-wrap">
                      <Search className="planilla-provider-picker-search-icon" aria-hidden strokeWidth={2} />
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
      <Modal
        open={providerReplaceModalOpen}
        onClose={() => {
          if (providerMergeBusy) return;
          setProviderReplaceModalOpen(false);
          setProviderReplaceCandidate(null);
        }}
        title="Confirmar reemplazo de proveedor"
        size="medium"
        preventClose={providerMergeBusy}
        subtitle={
          providerReplaceCandidate
            ? `Existe un proveedor en sistema "${providerReplaceCandidate.nombre}".`
            : ''
        }
      >
        <div className="planilla-provider-replace-modal-content">
          <p className="planilla-provider-replace-modal-text">
            {providerReplaceCandidate
              ? `¿Desea utilizar "${providerReplaceCandidate.nombre}"? Si confirma, se reemplazará "${providerManualName.trim()}" por "${providerReplaceCandidate.nombre}" y se unificarán las compras del proveedor manual.`
              : '¿Desea continuar con la unificación del proveedor?'}
          </p>
          <div className="planilla-provider-replace-modal-actions">
            <button
              type="button"
              className="planilla-provider-replace-btn-cancel"
              onClick={() => {
                setProviderReplaceModalOpen(false);
                setProviderReplaceCandidate(null);
              }}
              disabled={providerMergeBusy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="planilla-provider-replace-btn-confirm"
              onClick={confirmarReemplazoProveedor}
              disabled={providerMergeBusy}
            >
              {providerMergeBusy ? 'Unificando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
