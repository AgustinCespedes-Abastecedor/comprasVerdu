import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import * as XLSX from 'xlsx';
import { compras, proveedores as apiProveedores } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useResponse } from '../context/ResponseContext';
import { esRolComprador } from '../lib/roles';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import ProveedorLabel from '../components/ProveedorLabel';
import { ChevronDown, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import { formatNum, formatDate, todayStr, formatProveedorText, getProveedorNombre, getProveedorCodigo, fechaCivilYmdKey } from '../lib/format';
import { fetchAllPagedItems } from '../lib/fetchPagedCollection';
import { costoPorUnidadRecepcion, uxbNetoParaCosto } from '../lib/costoRecepcion';
import ListPaginationBar from '../components/ListPaginationBar';
import './VerCompras.css';

const isApp = () => Capacitor.isNativePlatform();

function getNumeroCompra(c) {
  return c.numeroCompra != null ? c.numeroCompra : '—';
}

/** Costo por kg útil = precioPorBulto / (UxB − peso cajón de la compra). */
function costoPorUnidad(precioPorBulto, uxb, pesoCajon) {
  return costoPorUnidadRecepcion(precioPorBulto, uxb, pesoCajon);
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

/** Entero >= 0 para bultos; NaN si inválido. */
function parseBultosEntero(str) {
  if (str === '' || str == null) return NaN;
  const x = String(str).replace(/\./g, '').replace(',', '.');
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.trunc(n);
}

/** Bultos originales persistidos (null = nunca ajustado por comprador). */
function bultosOriginalRegistrado(detalle) {
  if (detalle?.bultosOriginal == null || detalle.bultosOriginal === '') return null;
  const o = Number(detalle.bultosOriginal);
  return Number.isFinite(o) ? o : null;
}

function totalesCompraDesdeDetalles(compra, draftById) {
  let totalBultos = 0;
  let totalMonto = 0;
  for (const d of compra.detalles || []) {
    let b = Number(d.bultos) || 0;
    if (draftById && Object.prototype.hasOwnProperty.call(draftById, d.id)) {
      const parsed = parseBultosEntero(draftById[d.id]);
      if (!Number.isNaN(parsed)) b = parsed;
    }
    const p = Number(d.precioPorBulto) || 0;
    totalBultos += b;
    totalMonto += b * p;
  }
  return { totalBultos, totalMonto };
}

const EXCEL_SHEET_NAME_MAX = 31;
const INVALID_SHEET_CHARS = /[:\\/?*[\]]/g;

/**
 * Una sola hoja: nombre = fecha de exportación (YYYY-MM-DD). Compras ordenadas por proveedor;
 * entre un proveedor y otro, filas en blanco. Cada compra conserva el mismo bloque que antes
 * (proveedor, total, encabezados, filas de ítems).
 */
function exportarPorProveedor(comprasList) {
  const encabezados = [
    'Código',
    'Descripción',
    'Bultos Comp.',
    '$/Bulto (compra)',
    'Peso cajón (kg)',
    'Subtotal (compra)',
    'Bultos Recib.',
    'Costo unidad (rec.)',
    'Costo total (rec.)',
    'UxB',
    'UxB final',
    'Precio Venta',
    'Margen %',
  ];
  const colCount = encabezados.length;
  const padRow = (row) => {
    const next = [...row];
    while (next.length < colCount) next.push('');
    return next;
  };

  const sorted = [...comprasList].sort((a, b) => {
    const provA = (getProveedorNombre(a.proveedor) || '').localeCompare(
      getProveedorNombre(b.proveedor) || '',
      'es',
      { sensitivity: 'base' },
    );
    if (provA !== 0) return provA;
    const nroA = Number(a.numeroCompra) || 0;
    const nroB = Number(b.numeroCompra) || 0;
    if (nroA !== nroB) return nroA - nroB;
    return String(a.fecha || '').localeCompare(String(b.fecha || ''));
  });

  const rows = [];
  let previousProveedorId;
  for (const c of sorted) {
    const provId = String(c.proveedor?.id ?? c.proveedorId ?? '');
    if (previousProveedorId !== undefined && provId !== previousProveedorId) {
      rows.push(padRow([]));
      rows.push(padRow([]));
    }
    previousProveedorId = provId;

    const proveedorNombre = getProveedorNombre(c.proveedor) ?? '—';
    const proveedorCodigo = getProveedorCodigo(c.proveedor) ?? '';
    const totalMontoRaw = c.totalMonto;
    const totalMontoNum = totalMontoRaw != null && typeof totalMontoRaw.toString === 'function'
      ? parseFloat(String(totalMontoRaw))
      : Number(totalMontoRaw);
    const totalMontoExcel = Number.isFinite(totalMontoNum) ? totalMontoNum : '';
    const filas = (c.detalles || []).map((d) => {
      const dr = getDetalleRecepcion(d.id, c.recepcion);
      const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb, d.pesoCajon) : null;
      const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0 ? (Number(dr.cantidad) * costoUnidad) : null;
      const uxbBruto = dr != null && dr.uxb != null ? Number(dr.uxb) : NaN;
      const uxbFin = Number.isFinite(uxbBruto) && uxbBruto > 0
        ? uxbNetoParaCosto(uxbBruto, d.pesoCajon)
        : 0;
      return [
        d.producto?.codigo ?? '',
        d.producto?.descripcion ?? '',
        d.bultos ?? 0,
        d.precioPorBulto != null ? Number(d.precioPorBulto) : '',
        d.pesoCajon != null ? Number(d.pesoCajon) : '',
        subtotalCompra(d),
        dr != null ? (dr.cantidad ?? '') : '',
        costoUnidad != null ? costoUnidad : '',
        costoTotal != null ? costoTotal : '',
        dr != null ? (dr.uxb ?? '') : '',
        uxbFin > 0 ? uxbFin : '',
        dr?.precioVenta != null ? dr.precioVenta : '',
        dr?.margenPorc != null ? dr.margenPorc : '',
      ];
    });
    rows.push(padRow(['Proveedor', proveedorNombre, 'Cód. proveedor', proveedorCodigo]));
    rows.push(padRow(['Total $ compra', totalMontoExcel]));
    rows.push(padRow([...encabezados]));
    filas.forEach((fila) => rows.push(padRow(fila)));
  }

  const wb = XLSX.utils.book_new();
  const fechaExport = todayStr();
  let nombreHoja = fechaExport.replace(INVALID_SHEET_CHARS, ' ').trim().slice(0, EXCEL_SHEET_NAME_MAX);
  if (!nombreHoja) nombreHoja = 'Export';
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, `compras-por-proveedor-${fechaExport}.xlsx`);
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
        const costoUnidad = costoPorUnidad(d.precioPorBulto, dr.uxb, d.pesoCajon);
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
  const { user } = useAuth();
  const { showSuccess, showError } = useResponse();
  const puedeEditarBultos = esRolComprador(user);

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedoresList, setProveedoresList] = useState([]);
  const [expandidoKey, setExpandidoKey] = useState(null);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const providerSearchInputRef = useRef(null);
  const [editingCompraId, setEditingCompraId] = useState(null);
  const [bultosDraft, setBultosDraft] = useState({});
  const [guardandoBultos, setGuardandoBultos] = useState(false);

  const toggleExpandir = (id) => {
    setExpandidoKey((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (editingCompraId && expandidoKey !== editingCompraId) {
      setEditingCompraId(null);
      setBultosDraft({});
    }
  }, [expandidoKey, editingCompraId]);

  const iniciarEdicionBultos = (compra) => {
    const draft = {};
    (compra.detalles || []).forEach((d) => {
      draft[d.id] = String(d.bultos ?? '');
    });
    setBultosDraft(draft);
    setEditingCompraId(compra.id);
  };

  const cancelarEdicionBultos = () => {
    setEditingCompraId(null);
    setBultosDraft({});
  };

  const actualizarBultoDraft = (detalleId, value) => {
    setBultosDraft((prev) => ({ ...prev, [detalleId]: value }));
  };

  const guardarBultosCompra = async (compra) => {
    const detalles = (compra.detalles || []).map((d) => {
      const raw = bultosDraft[d.id] ?? String(d.bultos ?? '');
      const b = parseBultosEntero(raw);
      return { id: d.id, bultos: b };
    });
    if (detalles.some(({ bultos }) => Number.isNaN(bultos))) {
      showError('Ingresá cantidades de bultos válidas (entero mayor o igual a cero).');
      return;
    }
    for (const d of compra.detalles || []) {
      const dr = getDetalleRecepcion(d.id, compra.recepcion);
      const b = detalles.find((x) => x.id === d.id)?.bultos ?? 0;
      const cantRec = dr != null ? Number(dr.cantidad) || 0 : 0;
      if (cantRec > b) {
        showError(
          'No podés dejar menos bultos comprados que los recepcionados. Revisá las cantidades.',
          'COMPRAS_019',
        );
        return;
      }
    }
    setGuardandoBultos(true);
    try {
      const actualizada = await compras.patchDetallesBultos(compra.id, { detalles });
      setList((prev) => prev.map((row) => (row.id === compra.id ? actualizada : row)));
      setEditingCompraId(null);
      setBultosDraft({});
      showSuccess('Cantidades actualizadas. Los totales se recalcularon con el nuevo valor.');
    } catch (e) {
      showError(e ?? { message: 'No se pudieron guardar los cambios.' });
    } finally {
      setGuardandoBultos(false);
    }
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

  const filtrosKey = `${filtroDesde}|${filtroHasta}|${proveedorId}`;
  useEffect(() => {
    setPage(1);
  }, [filtrosKey]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: String(page), pageSize: String(pageSize) };
      if (filtroDesde) params.desde = filtroDesde;
      if (filtroHasta) params.hasta = filtroHasta;
      if (proveedorId) params.proveedorId = proveedorId;
      const data = await compras.list(params);
      if (data && Array.isArray(data.items)) {
        setList(data.items);
        setTotal(typeof data.total === 'number' ? data.total : data.items.length);
      } else {
        setList(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
      }
    } catch (e) {
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filtroDesde, filtroHasta, proveedorId, page, pageSize]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const baseListParams = useMemo(() => {
    const params = {};
    if (filtroDesde) params.desde = filtroDesde;
    if (filtroHasta) params.hasta = filtroHasta;
    if (proveedorId) params.proveedorId = proveedorId;
    return params;
  }, [filtroDesde, filtroHasta, proveedorId]);

  const exportarTodo = async (fn) => {
    setExportando(true);
    try {
      const all = await fetchAllPagedItems(
        ({ page: p, pageSize: ps }) => compras.list({ ...baseListParams, page: String(p), pageSize: String(ps) }),
        { pageSize: 100 },
      );
      fn(all);
    } finally {
      setExportando(false);
    }
  };

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
      {!loading && total > 0 && (
        <div className="vercompras-export">
          <button
            type="button"
            className="vercompras-btn-export"
            disabled={exportando}
            onClick={() => exportarTodo(exportarPorProveedor)}
            aria-label="Exportar a Excel en una sola hoja (fecha de hoy), compras agrupadas por proveedor, con el filtro actual"
          >
            {exportando ? (
              <Loader2 className="vercompras-btn-export-icon vercompras-btn-export-icon--spin" aria-hidden strokeWidth={2} />
            ) : (
              <FileSpreadsheet className="vercompras-btn-export-icon" aria-hidden strokeWidth={2} />
            )}
            <span className="vercompras-btn-export-label">por proveedor</span>
          </button>
          <button
            type="button"
            className="vercompras-btn-export"
            disabled={exportando}
            onClick={() => exportarTodo(exportarPorArticulo)}
            aria-label="Exportar a Excel por artículo, con todo el filtro actual"
          >
            {exportando ? (
              <Loader2 className="vercompras-btn-export-icon vercompras-btn-export-icon--spin" aria-hidden strokeWidth={2} />
            ) : (
              <FileSpreadsheet className="vercompras-btn-export-icon" aria-hidden strokeWidth={2} />
            )}
            <span className="vercompras-btn-export-label">por artículo</span>
          </button>
        </div>
      )}
      {loading ? (
        <AppLoader message="Cargando compras..." />
      ) : list.length === 0 ? (
        <div className="vercompras-empty">No hay compras con los filtros elegidos.</div>
      ) : (
        <>
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
                    {puedeEditarBultos && c.detalles?.length > 0 && (
                      <div className="vercompras-bultos-toolbar">
                        {editingCompraId === c.id ? (
                          <>
                            <button
                              type="button"
                              className="vercompras-btn-bultos vercompras-btn-bultos-primary"
                              onClick={() => guardarBultosCompra(c)}
                              disabled={guardandoBultos}
                            >
                              {guardandoBultos ? 'Guardando…' : 'Guardar cantidades'}
                            </button>
                            <button
                              type="button"
                              className="vercompras-btn-bultos vercompras-btn-bultos-secondary"
                              onClick={cancelarEdicionBultos}
                              disabled={guardandoBultos}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="vercompras-btn-bultos vercompras-btn-bultos-secondary"
                            onClick={() => iniciarEdicionBultos(c)}
                          >
                            Editar cantidades (bultos)
                          </button>
                        )}
                      </div>
                    )}
                    <div className="vercompras-card-totales">
                      {(() => {
                        const enEdicion = editingCompraId === c.id;
                        const { totalBultos: tb, totalMonto: tm } = enEdicion
                          ? totalesCompraDesdeDetalles(c, bultosDraft)
                          : {
                              totalBultos: c.totalBultos,
                              totalMonto: c.totalMonto != null && typeof c.totalMonto.toString === 'function'
                                ? parseFloat(String(c.totalMonto))
                                : Number(c.totalMonto),
                            };
                        const montoFmt = Number.isFinite(tm) ? formatNum(tm) : formatNum(c.totalMonto);
                        return (
                          <>
                            <span className="vercompras-total-chip" aria-label={`Total bultos: ${formatNum(tb)} bultos`}>
                              {formatNum(tb)} bultos
                              {enEdicion && <span className="vercompras-total-preview-hint"> (vista previa)</span>}
                            </span>
                            <span className="vercompras-total-chip vercompras-total-chip--monto" aria-label={`Total compra: $ ${montoFmt}`}>
                              $ {montoFmt}
                            </span>
                          </>
                        );
                      })()}
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
                              <th className="vercompras-col-num">P. cajón (kg)</th>
                              <th className="vercompras-col-num">Subtotal compra</th>
                              <th className="vercompras-col-num">Bultos Recib.</th>
                              <th className="vercompras-col-num">Costo unidad (rec.)</th>
                              <th className="vercompras-col-num">Costo total (rec.)</th>
                              <th className="vercompras-col-num">UxB</th>
                              <th className="vercompras-col-num">UxB final</th>
                              <th className="vercompras-col-num">Precio Venta</th>
                              <th className="vercompras-col-num">Margen %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.detalles.map((d) => {
                              const dr = getDetalleRecepcion(d.id, c.recepcion);
                              const costoUnidad = dr ? costoPorUnidad(d.precioPorBulto, dr.uxb, d.pesoCajon) : null;
                              const costoTotal = costoUnidad != null && dr != null && (dr.cantidad ?? 0) > 0
                                ? (Number(dr.cantidad) * costoUnidad)
                                : null;
                              const enEdicionFila = editingCompraId === c.id;
                              let bultosParaSubtotal = Number(d.bultos) || 0;
                              if (enEdicionFila && bultosDraft[d.id] !== undefined) {
                                const pb = parseBultosEntero(bultosDraft[d.id]);
                                if (!Number.isNaN(pb)) bultosParaSubtotal = pb;
                              }
                              const subtotal = bultosParaSubtotal * (Number(d.precioPorBulto) || 0);
                              const uxbBruto = dr != null && dr.uxb != null ? Number(dr.uxb) : NaN;
                              const uxbFinalVal = Number.isFinite(uxbBruto) && uxbBruto > 0
                                ? uxbNetoParaCosto(uxbBruto, d.pesoCajon)
                                : 0;
                              const uxbFinalTxt = dr != null && uxbFinalVal > 0 ? formatNum(uxbFinalVal) : '—';
                              const origReg = bultosOriginalRegistrado(d);
                              return (
                                <tr key={d.id}>
                                  <td>{d.producto?.codigo}</td>
                                  <td className="vercompras-col-desc">{d.producto?.descripcion}</td>
                                  <td className="vercompras-col-num vercompras-col-bultos">
                                    {enEdicionFila ? (
                                      <div className="vercompras-bultos-stack">
                                        {origReg != null && (
                                          <span className="vercompras-bultos-orig" title="Cantidad original (registro)">
                                            {formatNum(origReg)}
                                          </span>
                                        )}
                                        <input
                                          type="text"
                                          className="vercompras-bultos-input"
                                          value={bultosDraft[d.id] ?? ''}
                                          onChange={(e) => actualizarBultoDraft(d.id, e.target.value)}
                                          inputMode="numeric"
                                          aria-label={`Bultos comprados para ${d.producto?.descripcion || d.producto?.codigo}`}
                                        />
                                      </div>
                                    ) : (
                                      <div className="vercompras-bultos-stack">
                                        {origReg != null && (
                                          <span className="vercompras-bultos-orig" title="Cantidad original al registrar la compra">
                                            {formatNum(origReg)}
                                          </span>
                                        )}
                                        <span
                                          className={origReg != null ? 'vercompras-bultos-new-val' : 'vercompras-bultos-solo'}
                                          title={origReg != null ? 'Cantidad vigente (tras ajuste)' : undefined}
                                        >
                                          {formatNum(d.bultos)}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="vercompras-col-num">{d.precioPorBulto != null ? formatNum(d.precioPorBulto) : '—'}</td>
                                  <td className="vercompras-col-num">{d.pesoCajon != null ? formatNum(d.pesoCajon) : '—'}</td>
                                  <td className="vercompras-col-num vercompras-col-subtotal">{formatNum(subtotal)}</td>
                                  <td className="vercompras-col-num">{dr != null ? formatNum(dr.cantidad) : '—'}</td>
                                  <td className="vercompras-col-num">{costoUnidad != null ? formatNum(costoUnidad) : '—'}</td>
                                  <td className="vercompras-col-num">{costoTotal != null ? formatNum(costoTotal) : '—'}</td>
                                  <td className="vercompras-col-num">{dr != null ? formatNum(dr.uxb) : '—'}</td>
                                  <td className="vercompras-col-num">{uxbFinalTxt}</td>
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
        <ListPaginationBar
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          disabled={loading}
          navLabel="Paginación de compras"
        />
        </>
      )}
    </div>
  );
}
