import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { trazabilidad, proveedores as apiProveedores } from '../api/client';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import ProveedorLabel from '../components/ProveedorLabel';
import { ChevronDown, Search, X } from 'lucide-react';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import { formatDate, formatDateTime, formatNum, formatProveedorText, todayStr } from '../lib/format';
import './TrazabilidadCompras.css';

const isApp = () => Capacitor.isNativePlatform();

function getNumeroCompra(c) {
  return c.numeroCompra != null ? c.numeroCompra : '—';
}

function tituloEvento(ev) {
  const tipo = ev.auditoria && typeof ev.auditoria === 'object' ? String(ev.auditoria.tipo || '') : '';
  if (tipo === 'compra.creada') return 'Compra registrada';
  if (tipo === 'recepcion.precios_venta') return 'Precios de venta guardados';
  if (tipo === 'recepcion.creada') return 'Recepción creada / guardada';
  if (tipo === 'recepcion.actualizada') return 'Recepción actualizada';
  if (tipo === 'info_final.uxb') return 'UxB actualizado (Info Final)';

  if (ev.entity === 'compra' && ev.action === 'crear') return 'Compra registrada';
  if (ev.entity === 'recepcion') {
    const d = ev.details && typeof ev.details === 'object' ? ev.details : {};
    if (d.preciosVenta) return 'Precios de venta guardados';
    if (ev.action === 'crear') return 'Recepción creada / guardada';
    if (ev.action === 'actualizar') return 'Recepción actualizada';
    return 'Evento de recepción';
  }
  if (ev.entity === 'info-final-uxb') return 'UxB actualizado (Info Final)';
  if (ev.entity === 'compra') return `Compra (${ev.action})`;
  if (tipo) return `Evento (${tipo})`;
  return `${ev.entity} (${ev.action})`;
}

function detalleEvento(ev) {
  const d = ev.details && typeof ev.details === 'object' ? ev.details : {};
  if (ev.entity === 'compra' && ev.action === 'crear') {
    const prov = d.proveedor ? String(d.proveedor) : '';
    const tb = d.totalBultos != null ? d.totalBultos : '';
    const tm = d.totalMonto != null ? d.totalMonto : '';
    const parts = [];
    if (prov) parts.push(`Proveedor: ${prov}`);
    if (tb !== '') parts.push(`Bultos: ${tb}`);
    if (tm !== '') parts.push(`Total: ${tm}`);
    return parts.length ? parts.join(' · ') : '';
  }
  if (ev.entity === 'recepcion') {
    if (d.preciosVenta) return 'Se registraron precios de venta y márgenes por artículo.';
    const n = d.numeroRecepcion != null ? `Recepción Nº ${d.numeroRecepcion}` : 'Recepción';
    const nItems = Array.isArray(d.items) ? d.items.length : null;
    return nItems != null ? `${n} · ${nItems} ítems` : n;
  }
  if (ev.entity === 'info-final-uxb') {
    const codigo = d.codigo ? String(d.codigo) : '';
    const art = d.articulo ? String(d.articulo) : '';
    const uxb = d.uxb != null ? String(d.uxb) : '';
    const fecha = d.fecha ? String(d.fecha) : '';
    const parts = [];
    if (fecha) parts.push(`Día Info Final: ${fecha}`);
    if (codigo) parts.push(`Cód. ${codigo}`);
    if (art && art !== codigo) parts.push(art);
    if (uxb) parts.push(`UxB: ${uxb}`);
    return parts.join(' · ');
  }

  const conf = ev.auditoria && typeof ev.auditoria === 'object' ? String(ev.auditoria.confianza || '') : '';
  const fuente = ev.auditoria && typeof ev.auditoria === 'object' ? String(ev.auditoria.fuente || '') : '';
  if (conf && conf !== 'alta') {
    return `Confianza ${conf}${fuente ? ` · Fuente ${fuente}` : ''}`;
  }
  if (fuente === 'backfill') {
    return 'Fuente backfill (reconstrucción desde historial)';
  }
  return '';
}

export default function TrazabilidadCompras() {
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
      const data = await trazabilidad.compras(params);
      setList(Array.isArray(data) ? data : []);
    } catch {
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
    <div className="traz-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="traz-back" title="Volver al panel" aria-label="Volver al panel">
              <BackNavIcon className="traz-back-icon" />
            </Link>
            <h1 className="traz-header-title">Trazabilidad de compras</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <p className="traz-intro" role="note">
        Auditoría por compra: cada evento muestra <strong>quién</strong> lo hizo (usuario) y <strong>cuándo</strong> ocurrió,
        según el historial interno de la aplicación.
      </p>

      <div className="traz-filtros">
        <div className="traz-field">
          <label htmlFor="traz-desde">Desde</label>
          <input
            id="traz-desde"
            type="date"
            value={filtroDesde}
            max={todayStr()}
            onChange={(e) => setFiltroDesde(e.target.value)}
            aria-label="Fecha desde"
          />
        </div>
        <div className="traz-field">
          <label htmlFor="traz-hasta">Hasta</label>
          <input
            id="traz-hasta"
            type="date"
            value={filtroHasta}
            max={todayStr()}
            onChange={(e) => setFiltroHasta(e.target.value)}
            aria-label="Fecha hasta"
          />
        </div>
        <div className="traz-field">
          <label htmlFor="traz-prov">Proveedor</label>
          {isApp() ? (
            <>
              <button
                type="button"
                className="traz-provider-picker-field"
                onClick={() => setProviderPickerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={providerPickerOpen}
                aria-label="Elegir proveedor. Buscar por nombre."
                data-has-value={proveedorId ? 'true' : undefined}
              >
                <span className="traz-provider-picker-field-value">
                  {proveedorId
                    ? (formatProveedorText(proveedoresList.find((p) => p.id === proveedorId)) ?? 'Proveedor')
                    : 'Todos'}
                </span>
                <ChevronDown className="traz-provider-picker-chevron" aria-hidden strokeWidth={2} />
              </button>
              {providerPickerOpen && (
                <div
                  className="traz-provider-picker-backdrop"
                  onClick={() => setProviderPickerOpen(false)}
                  role="presentation"
                >
                  <div
                    className="traz-provider-picker-sheet"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Buscar proveedor"
                  >
                    <div className="traz-provider-picker-sheet-header">
                      <h2 className="traz-provider-picker-sheet-title">Elegir proveedor</h2>
                      <button
                        type="button"
                        className="traz-provider-picker-close"
                        onClick={() => setProviderPickerOpen(false)}
                        aria-label="Cerrar"
                      >
                        <X className="traz-provider-picker-close-icon" aria-hidden strokeWidth={2} />
                      </button>
                    </div>
                    <div className="traz-provider-picker-search-wrap">
                      <Search className="traz-provider-picker-search-icon" aria-hidden strokeWidth={2} />
                      <input
                        ref={providerSearchInputRef}
                        type="search"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="traz-provider-picker-search"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        aria-label="Buscar proveedor"
                      />
                      {providerSearch && (
                        <button
                          type="button"
                          className="traz-provider-picker-search-clear"
                          onClick={() => setProviderSearch('')}
                          aria-label="Borrar búsqueda"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="traz-provider-picker-list-wrap">
                      <ul className="traz-provider-picker-list" role="listbox">
                        <li
                          role="option"
                          aria-selected={!proveedorId}
                          className={`traz-provider-picker-item ${!proveedorId ? 'traz-provider-picker-item-selected' : ''}`}
                          onClick={() => {
                            setProveedorId('');
                            setProviderPickerOpen(false);
                            setProviderSearch('');
                          }}
                        >
                          <span className="traz-provider-picker-item-name">Todos</span>
                          {!proveedorId && (
                            <span className="traz-provider-picker-item-check" aria-hidden>✓</span>
                          )}
                        </li>
                        {filteredProveedores.length === 0 ? (
                          providerSearch.trim() ? (
                            <li className="traz-provider-picker-empty">
                              Ningún proveedor coincide con la búsqueda.
                            </li>
                          ) : null
                        ) : (
                          filteredProveedores.map((p) => (
                            <li
                              key={p.id}
                              role="option"
                              aria-selected={proveedorId === p.id}
                              className={`traz-provider-picker-item ${proveedorId === p.id ? 'traz-provider-picker-item-selected' : ''}`}
                              onClick={() => {
                                setProveedorId(p.id);
                                setProviderPickerOpen(false);
                                setProviderSearch('');
                              }}
                            >
                              <span className="traz-provider-picker-item-name">{formatProveedorText(p)}</span>
                              {proveedorId === p.id && (
                                <span className="traz-provider-picker-item-check" aria-hidden>✓</span>
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
              id="traz-prov"
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
        <p className="traz-filtros-ayuda" role="note">
          Filtro por <strong>fecha de compra</strong> cargada en la planilla (no por recepción).
        </p>
      </div>

      {loading ? (
        <AppLoader message="Cargando trazabilidad..." />
      ) : list.length === 0 ? (
        <div className="traz-empty">No hay compras con los filtros elegidos.</div>
      ) : (
        <div className="traz-list">
          {list.map((c) => {
            const expandido = expandidoKey === c.id;
            const totalMontoRaw = c.totalMonto;
            const totalMontoNum = totalMontoRaw != null && typeof totalMontoRaw.toString === 'function'
              ? parseFloat(String(totalMontoRaw))
              : Number(totalMontoRaw);
            const totalMontoTxt = Number.isFinite(totalMontoNum) ? formatNum(totalMontoNum) : '—';
            return (
              <article key={c.id} className={`traz-card ${expandido ? 'traz-card--open' : ''}`}>
                <button
                  type="button"
                  className="traz-card-head traz-card-head--btn"
                  onClick={() => toggleExpandir(c.id)}
                  aria-expanded={expandido}
                  aria-controls={`traz-detalle-${c.id}`}
                >
                  <span className="traz-card-numero" title="Número de compra">Nº {getNumeroCompra(c)}</span>
                  <span className="traz-card-fecha">{formatDate(c.fecha)}</span>
                  <span className="traz-card-proveedor">
                    <ProveedorLabel proveedor={c.proveedor} />
                  </span>
                  <span className="traz-card-total" aria-label={`Total compra ${totalMontoTxt} pesos`}>
                    $ {totalMontoTxt}
                  </span>
                  <span className="traz-card-chevron" aria-hidden>{expandido ? '▼' : '▶'}</span>
                </button>

                {expandido && (
                  <div id={`traz-detalle-${c.id}`} className="traz-card-body">
                    <div className="traz-meta">
                      <div className="traz-meta-row">
                        <span className="traz-meta-label">Comprador (alta)</span>
                        <span className="traz-meta-value">{c.user?.nombre || '—'}{c.user?.email ? ` · ${c.user.email}` : ''}</span>
                      </div>
                      <div className="traz-meta-row">
                        <span className="traz-meta-label">Registrada en sistema</span>
                        <span className="traz-meta-value">{c.createdAt ? formatDateTime(c.createdAt) : '—'}</span>
                      </div>
                      {c.recepcion && (
                        <div className="traz-meta-row">
                          <span className="traz-meta-label">Recepción</span>
                          <span className="traz-meta-value">
                            Nº {c.recepcion.numeroRecepcion ?? '—'} · última modificación{' '}
                            {c.recepcion.updatedAt ? formatDateTime(c.recepcion.updatedAt) : '—'}
                          </span>
                        </div>
                      )}
                    </div>

                    <section className="traz-events" aria-label="Historial de eventos">
                      <h2 className="traz-events-title">Historial</h2>
                      {!c.eventos?.length ? (
                        <p className="traz-events-empty">No hay eventos registrados para esta compra (solo se listan acciones guardadas en historial).</p>
                      ) : (
                        <ol className="traz-events-list">
                          {c.eventos.map((ev) => {
                            const sub = detalleEvento(ev);
                            const aud = ev.auditoria && typeof ev.auditoria === 'object' ? ev.auditoria : null;
                            return (
                              <li key={ev.id} className="traz-event">
                                <div className="traz-event-top">
                                  <div className="traz-event-head">
                                    <span className="traz-event-title">{tituloEvento(ev)}</span>
                                    {aud ? (
                                      <span className="traz-event-badges" aria-label="Metadatos de auditoría">
                                        {aud.fuente ? (
                                          <span className={`traz-chip traz-chip--fuente traz-chip--fuente-${String(aud.fuente)}`}>
                                            {String(aud.fuente)}
                                          </span>
                                        ) : null}
                                        {aud.confianza ? (
                                          <span className={`traz-chip traz-chip--conf traz-chip--conf-${String(aud.confianza)}`}>
                                            {String(aud.confianza)}
                                          </span>
                                        ) : null}
                                      </span>
                                    ) : null}
                                  </div>
                                  <time className="traz-event-time" dateTime={ev.createdAt ? new Date(ev.createdAt).toISOString() : undefined}>
                                    {ev.createdAt ? formatDateTime(ev.createdAt) : '—'}
                                  </time>
                                </div>
                                <div className="traz-event-user">
                                  <span className="traz-event-user-label">Usuario</span>
                                  <span className="traz-event-user-value">
                                    {ev.userName || '—'}{ev.userEmail ? ` · ${ev.userEmail}` : ''}
                                  </span>
                                </div>
                                {sub ? <p className="traz-event-sub">{sub}</p> : null}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </section>
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
