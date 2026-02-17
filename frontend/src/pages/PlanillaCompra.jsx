import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { proveedores, productos, compras } from '../api/client';
import { useResponse } from '../context/ResponseContext';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import './PlanillaCompra.css';

const PAGE_SIZE = 50;
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

function itemsToFilas(items) {
  if (!Array.isArray(items)) return [];
  return items.map((p, orden) => ({
    filaId: p.id,
    orden,
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
  }));
}

export default function PlanillaCompra() {
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState(hoy);
  const [proveedorId, setProveedorId] = useState('');
  const [proveedoresList, setProveedoresList] = useState([]);
  const [filas, setFilas] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [pageCache, setPageCache] = useState({});
  const [totalesDia, setTotalesDia] = useState({ totalBultos: 0, totalMonto: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [sortBy, setSortBy] = useState('descripcion');
  const [sortDir, setSortDir] = useState('asc');
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const { showSuccess, showError } = useResponse();
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    proveedores.list().then((prov) => {
      if (!cancelled) {
        setProveedoresList(prov);
        if (prov.length && !proveedorId) setProveedorId(prov[0].id);
      }
    }).catch((e) => {
      if (!cancelled) setMensaje({ tipo: 'error', text: e.message });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusquedaDebounced(busqueda), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [busqueda]);

  useEffect(() => {
    if (!proveedorId) {
      setFilas([]);
      setTotalProductos(0);
      setPageCache({});
      setPaginaActual(1);
      setLoading(false);
      return;
    }
    setPageCache({});
    setPaginaActual(1);
    setBusqueda('');
    setBusquedaDebounced('');
    setLoading(true);
    setMensaje(null);
    let cancelled = false;
    const params = { proveedorId, fecha, page: 1, pageSize: PAGE_SIZE, sortBy: 'descripcion', sortDir: 'asc' };
    productos.list(params).then((res) => {
      if (!cancelled) {
        const items = res.items || [];
        const total = res.total ?? 0;
        setTotalProductos(total);
        const newFilas = itemsToFilas(items);
        setFilas(newFilas);
        setPageCache({ 1: { filas: newFilas } });
        setLoading(false);
      }
    }).catch((e) => {
      if (!cancelled) {
        setMensaje({ tipo: 'error', text: e.message });
        setFilas([]);
        setTotalProductos(0);
        setPageCache({});
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [proveedorId, fecha]);

  useEffect(() => {
    if (!proveedorId || paginaActual <= 1) return;
    const cached = pageCache[paginaActual];
    if (cached?.filas) {
      setFilas(cached.filas);
      return;
    }
    let cancelled = false;
    setLoadingList(true);
    const params = { proveedorId, fecha, page: paginaActual, pageSize: PAGE_SIZE, sortBy: sortBy || 'descripcion', sortDir: sortDir || 'asc' };
    if (busquedaDebounced.trim()) params.q = busquedaDebounced.trim();
    productos.list(params).then((res) => {
      if (!cancelled) {
        const items = res.items || [];
        const newFilas = itemsToFilas(items);
        setFilas(newFilas);
        setPageCache((prev) => ({ ...prev, [paginaActual]: { filas: newFilas } }));
        setLoadingList(false);
      }
    }).catch((e) => {
      if (!cancelled) {
        setMensaje({ tipo: 'error', text: e.message });
        setLoadingList(false);
      }
    });
    return () => { cancelled = true; };
  }, [paginaActual, proveedorId, busquedaDebounced, sortBy, sortDir]);

  useEffect(() => {
    if (!proveedorId || totalProductos === 0) return;
    setPageCache({});
    setPaginaActual(1);
    let cancelled = false;
    setLoadingList(true);
    const params = { proveedorId, fecha, page: 1, pageSize: PAGE_SIZE, sortBy: sortBy || 'descripcion', sortDir: sortDir || 'asc' };
    if (busquedaDebounced.trim()) params.q = busquedaDebounced.trim();
    productos.list(params).then((res) => {
      if (!cancelled) {
        const items = res.items || [];
        const total = res.total ?? 0;
        setTotalProductos(total);
        const newFilas = itemsToFilas(items);
        setFilas(newFilas);
        setPageCache({ 1: { filas: newFilas } });
        setLoadingList(false);
      }
    }).catch((e) => {
      if (!cancelled) {
        setMensaje({ tipo: 'error', text: e.message });
        setLoadingList(false);
      }
    });
    return () => { cancelled = true; };
  }, [busquedaDebounced, sortBy, sortDir]);

  const generarFilaId = () => `dup-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  useEffect(() => {
    let cancelled = false;
    compras.totalesDia(fecha).then((r) => {
      if (!cancelled) setTotalesDia(r);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fecha]);

  const handleSort = (column) => {
    setSortBy(column);
    setSortDir((prevDir) => (sortBy === column ? (prevDir === 'asc' ? 'desc' : 'asc') : 'asc'));
  };

  const totalPaginas = Math.max(1, Math.ceil(totalProductos / PAGE_SIZE));

  const goToPage = (newPage) => {
    const n = Math.max(1, Math.min(totalPaginas, newPage));
    if (n === paginaActual) return;
    setPageCache((prev) => ({ ...prev, [paginaActual]: { filas } }));
    setPaginaActual(n);
  };

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

  const esFilaHija = (f) => typeof f.filaId === 'string' && f.filaId.startsWith('dup-');

  const eliminarFilaHija = (filaId) => {
    setFilas((prev) => {
      const next = prev.filter((f) => f.filaId !== filaId);
      setPageCache((cache) => ({ ...cache, [paginaActual]: { filas: next } }));
      return next;
    });
  };

  const todasLasFilasCargadas = useMemo(() => {
    const out = [...filas];
    Object.keys(pageCache).forEach((p) => {
      const num = Number(p);
      if (num !== paginaActual && pageCache[p]?.filas) out.push(...pageCache[p].filas);
    });
    return out;
  }, [filas, pageCache, paginaActual]);

  const totalesCompra = useMemo(() => {
    let bultos = 0;
    let monto = 0;
    todasLasFilasCargadas.forEach((f) => {
      bultos += parseNum(f.bultos) || 0;
      monto += parseNum(f.total) || 0;
    });
    return { bultos, monto };
  }, [todasLasFilasCargadas]);

  const totalDiaBultos = totalesDia.totalBultos + totalesCompra.bultos;
  const totalDiaMonto = (Number(totalesDia.totalMonto) || 0) + totalesCompra.monto;

  const handleGuardar = async () => {
    if (!proveedorId) {
      setMensaje({ tipo: 'error', text: 'Seleccioná un proveedor' });
      return;
    }
    const todasFilas = [...filas];
    Object.keys(pageCache).forEach((p) => {
      if (Number(p) !== paginaActual && pageCache[p]?.filas) todasFilas.push(...pageCache[p].filas);
    });
    const detalles = todasFilas
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
      const clearFila = (f) => ({
        ...f,
        bultos: '',
        precioPorBulto: '',
        pesoPorBulto: '',
        precioVentaCompra: '',
        precioPorKg: '',
        margenFinalPorc: '',
        total: '',
      });
      setFilas((prev) => prev.map(clearFila));
      setPageCache((prev) => {
        const next = {};
        Object.keys(prev).forEach((p) => {
          next[p] = { filas: prev[p].filas.map(clearFila) };
        });
        return next;
      });
    } catch (e) {
      showError(e?.message || 'Error al guardar la compra');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="planilla-page">
        <div className="planilla-loading">
          <div className="planilla-loading-spinner" />
          <p>Cargando planilla...</p>
        </div>
      </div>
    );
  }

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
            <div className="planilla-header-title-block">
              <h1 className="planilla-title">Nueva compra</h1>
              <p className="planilla-subtitle">Completá la planilla y guardá la compra al proveedor seleccionado</p>
            </div>
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
            <div className="planilla-filter-group">
              <label className="planilla-filter-label">Proveedor</label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="planilla-input planilla-input-select"
              >
                <option value="">Seleccionar proveedor</option>
                {proveedoresList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {mensaje && (
          <div className={`planilla-alert planilla-alert-${mensaje.tipo}`} role="alert">
            {mensaje.text}
          </div>
        )}

        <section className={`planilla-section planilla-section-table ${loadingList ? 'planilla-section-table-busy' : ''}`}>
          <div className="planilla-table-legend">
            <span className="planilla-legend-item planilla-legend-bd">Datos del sistema</span>
            <span className="planilla-legend-item planilla-legend-manual">Datos a completar</span>
            <span className="planilla-legend-item planilla-legend-calculo">Calculado</span>
          </div>
          {totalProductos > 0 && (
            <div className={`planilla-search-wrap ${loadingList ? 'planilla-search-wrap-busy' : ''}`}>
              <label htmlFor="planilla-buscar-articulo" className="planilla-search-label">Buscar artículo</label>
              <div className="planilla-search-input-row">
                <input
                  id="planilla-buscar-articulo"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Escribí nombre o parte del nombre (ej. limón, tomate)"
                  className="planilla-input planilla-input-search"
                  autoComplete="off"
                  aria-describedby={busqueda.trim() ? 'planilla-busqueda-resultados' : undefined}
                  aria-busy={loadingList}
                />
                {loadingList && (
                  <span className="planilla-search-spinner" aria-hidden>
                    <span className="planilla-search-spinner-dot" />
                  </span>
                )}
              </div>
              {busquedaDebounced.trim() && !loadingList && (
                <span id="planilla-busqueda-resultados" className="planilla-search-results" aria-live="polite">
                  {totalProductos} {totalProductos === 1 ? 'resultado' : 'resultados'}
                </span>
              )}
              {busquedaDebounced.trim() && loadingList && (
                <span id="planilla-busqueda-resultados" className="planilla-search-results planilla-search-results-busy" aria-live="polite">
                  Buscando…
                </span>
              )}
            </div>
          )}
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
                  <th className="planilla-th planilla-th-accion">
                    <span className="planilla-col-accion-label">+</span>
                  </th>
                  <th className="planilla-th planilla-th-bd planilla-col-codigo planilla-th-sortable">
                    <button type="button" className="planilla-th-sort-btn" onClick={() => handleSort('codigo')} aria-label={sortBy === 'codigo' ? `Ordenar por Código ${sortDir === 'asc' ? 'ascendente' : 'descendente'}` : 'Ordenar por Código'}>
                      <span>Código</span>
                      {sortBy === 'codigo' && <span className="planilla-sort-icon" aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className="planilla-th planilla-th-bd planilla-col-desc planilla-th-sortable">
                    <button type="button" className="planilla-th-sort-btn" onClick={() => handleSort('descripcion')} aria-label={sortBy === 'descripcion' ? `Ordenar por Descripción ${sortDir === 'asc' ? 'ascendente' : 'descendente'}` : 'Ordenar por Descripción'}>
                      <span>Descripción</span>
                      {sortBy === 'descripcion' && <span className="planilla-sort-icon" aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className="planilla-th planilla-th-bd planilla-th-sortable">
                    <button type="button" className="planilla-th-sort-btn" onClick={() => handleSort('stockSucursales')} aria-label={sortBy === 'stockSucursales' ? `Ordenar por Sucursal ${sortDir === 'asc' ? 'ascendente' : 'descendente'}` : 'Ordenar por Sucursal'}>
                      <span>Sucursal</span>
                      {sortBy === 'stockSucursales' && <span className="planilla-sort-icon" aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className="planilla-th planilla-th-bd planilla-th-sortable">
                    <button type="button" className="planilla-th-sort-btn" onClick={() => handleSort('stockCD')} aria-label={sortBy === 'stockCD' ? `Ordenar por CD ${sortDir === 'asc' ? 'ascendente' : 'descendente'}` : 'Ordenar por CD'}>
                      <span>CD</span>
                      {sortBy === 'stockCD' && <span className="planilla-sort-icon" aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
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
                      {esFilaHija(f) ? (
                        <button
                          type="button"
                          className="planilla-btn-quitar"
                          onClick={() => eliminarFilaHija(f.filaId)}
                          title="Quitar esta fila (acuerdo duplicado)"
                          aria-label={`Quitar fila de ${f.descripcion}`}
                        >
                          −
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="planilla-btn-duplicar"
                          onClick={() => duplicarFila(f.filaId)}
                          title="Duplicar artículo para cargar otro acuerdo"
                          aria-label={`Duplicar fila de ${f.descripcion}`}
                        >
                          +
                        </button>
                      )}
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
          {totalProductos > PAGE_SIZE && (
            <nav className="planilla-pagination" aria-label="Paginación de artículos">
              <span className="planilla-pagination-info">
                Mostrando {(paginaActual - 1) * PAGE_SIZE + 1}–{Math.min(paginaActual * PAGE_SIZE, totalProductos)} de {totalProductos} artículos
              </span>
              <div className="planilla-pagination-controls">
                <button
                  type="button"
                  className="planilla-pagination-btn"
                  onClick={() => goToPage(paginaActual - 1)}
                  disabled={paginaActual <= 1}
                  aria-label="Página anterior"
                >
                  Anterior
                </button>
                <span className="planilla-pagination-page" aria-live="polite">
                  Página {paginaActual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="planilla-pagination-btn"
                  onClick={() => goToPage(paginaActual + 1)}
                  disabled={paginaActual >= totalPaginas}
                  aria-label="Página siguiente"
                >
                  Siguiente
                </button>
              </div>
            </nav>
          )}
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
