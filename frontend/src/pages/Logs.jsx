import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { logs as logsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import AppLoader from '../components/AppLoader';
import ThemeToggle from '../components/ThemeToggle';
import { Eye } from 'lucide-react';
import Modal from '../components/Modal';
import LogsUserFilter from '../components/logs/LogsUserFilter';
import ListPaginationBar from '../components/ListPaginationBar';
import { formatDateTime, formatDateOnly, formatMoneda, formatNum, formatPct, todayStr } from '../lib/format';
import './Logs.css';

const ACCIONES_LABEL = {
  crear: 'Creó',
  actualizar: 'Modificó',
  eliminar: 'Eliminó',
  activar: 'Activó',
  suspender: 'Suspendió',
};

const ENTIDADES_LABEL = {
  usuario: 'Usuario',
  rol: 'Rol',
  compra: 'Compra',
  recepcion: 'Recepción',
  'info-final-uxb': 'UXB Info Final',
};

/** Etiquetas en español para cada campo (trazabilidad). Orden de aparición en el modal. */
const DETAIL_LABELS = {
  nombre: 'Nombre',
  email: 'Email',
  rol: 'Rol',
  activo: 'Estado',
  numeroCompra: 'Nº compra',
  numeroRecepcion: 'Nº recepción',
  fecha: 'Fecha',
  proveedor: 'Proveedor',
  totalBultos: 'Total bultos',
  totalMonto: 'Total monto',
  compraId: 'ID compra',
  preciosVenta: 'Precios de venta actualizados',
  codigo: 'Código artículo',
  articulo: 'Artículo',
  uxb: 'UxB guardado',
  recepcionesAfectadas: 'Recepciones actualizadas',
};
/** Orden preferido de campos en el modal de detalle (auditoría). */
const DETAIL_ORDER = ['nombre', 'email', 'rol', 'activo', 'numeroCompra', 'numeroRecepcion', 'fecha', 'proveedor', 'totalBultos', 'totalMonto', 'compraId', 'preciosVenta', 'codigo', 'articulo', 'uxb', 'recepcionesAfectadas'];

function formatDetailValue(key, value) {
  if (value === undefined || value === null) return '—';
  if (key === 'activo') return value ? 'Activo' : 'Inactivo';
  if (key === 'fecha' && (typeof value === 'string' || value instanceof Date)) return formatDateOnly(value);
  if (key === 'totalMonto' || key === 'precioVenta' || key === 'margenPorc') {
    if (typeof value === 'number') return key === 'margenPorc' ? formatPct(value) : formatMoneda(value);
    return String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Entradas del detalle ordenadas para auditoría (campo → valor cargado). Excluye 'items' (se muestra en tabla aparte). Si hay items con precioVenta, no mostramos 'preciosVenta' en la grilla: el dato real está en la tabla. */
function getDetailEntries(details) {
  if (!details || typeof details !== 'object') return [];
  let keys = Object.keys(details).filter((k) => k !== 'items');
  const hasItemsConPrecios = Array.isArray(details.items) && details.items.length > 0 && 'precioVenta' in (details.items[0] || {});
  if (hasItemsConPrecios) keys = keys.filter((k) => k !== 'preciosVenta');
  const ordered = [...DETAIL_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !DETAIL_ORDER.includes(k))];
  return ordered.map((key) => ({ key, label: DETAIL_LABELS[key] ?? key, value: details[key] }));
}

export default function Logs() {
  useAuth();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [desde, setDesde] = useState(() => todayStr());
  const [hasta, setHasta] = useState(() => todayStr());
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    try {
      const params = { page, pageSize };
      if (filtroUsuario) params.userId = filtroUsuario;
      if (filtroEntidad) params.entity = filtroEntidad;
      if (filtroUsuario) {
        // Con usuario seleccionado: no enviar fechas para obtener todo el historial del usuario (mejor performance y UX)
      } else {
        // Sin usuario: por defecto solo día actual
        params.desde = desde || todayStr();
        params.hasta = hasta || todayStr();
      }
      const data = await logsApi.list(params);
      setList(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setList([]);
      setTotal(0);
    }
  }, [filtroUsuario, filtroEntidad, desde, hasta, page, pageSize]);

  useEffect(() => {
    setLoading(true);
    loadLogs().finally(() => setLoading(false));
  }, [loadLogs]);

  const onFilterChange = () => setPage(1);

  const { registerRefresh } = usePullToRefresh();
  useEffect(() => {
    registerRefresh(loadLogs);
    return () => registerRefresh(null);
  }, [loadLogs, registerRefresh]);

  return (
    <div className="logs-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="logs-back" title="Volver al panel" aria-label="Volver al panel">
              <BackNavIcon className="logs-back-icon" />
            </Link>
            <h1 className="logs-header-title">Historial de actividad</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="logs-main">
        <p className="logs-desc">
          Acciones realizadas por cada usuario: quién modificó qué y cuándo.
        </p>

        <div className="logs-filters">
          <div className="logs-filters-user-wrap">
            <LogsUserFilter
              value={filtroUsuario}
              disabled={loading}
              onChange={(userId) => {
                setFiltroUsuario(userId);
                if (userId) {
                  setDesde('');
                  setHasta('');
                } else {
                  setDesde(todayStr());
                  setHasta(todayStr());
                }
                onFilterChange();
              }}
            />
          </div>
          <select
            value={filtroEntidad}
            onChange={(e) => { setFiltroEntidad(e.target.value); onFilterChange(); }}
            className="logs-select"
            aria-label="Filtrar por tipo"
          >
            <option value="">Todas las entidades</option>
            <option value="usuario">Usuarios</option>
            <option value="rol">Roles</option>
            <option value="compra">Compras</option>
            <option value="recepcion">Recepciones</option>
            <option value="info-final-uxb">UXB Info Final</option>
          </select>
          <input
            type="date"
            value={desde}
            max={todayStr()}
            onChange={(e) => { setDesde(e.target.value); onFilterChange(); }}
            className="logs-input-date"
            aria-label="Desde fecha"
          />
          <input
            type="date"
            value={hasta}
            max={todayStr()}
            onChange={(e) => { setHasta(e.target.value); onFilterChange(); }}
            className="logs-input-date"
            aria-label="Hasta fecha"
          />
          <span className="logs-filter-hint">
            {filtroUsuario ? 'Historial del usuario seleccionado' : 'Solo día seleccionado'}
          </span>
          <button type="button" className="logs-btn-refresh" onClick={() => loadLogs()}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <AppLoader message="Cargando historial..." />
        ) : (
          <>
            <div className="logs-table-wrap">
              {list.length === 0 ? (
                <div className="logs-empty">
                  <p>No hay registros con los filtros aplicados.</p>
                </div>
              ) : (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Fecha y hora</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Entidad</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((log) => (
                      <tr key={log.id}>
                        <td className="logs-cell-datetime">{formatDateTime(log.createdAt)}</td>
                        <td>
                          <span className="logs-user-name">{log.userName || log.userEmail || log.userId}</span>
                          {log.userEmail && <span className="logs-user-email">{log.userEmail}</span>}
                        </td>
                        <td><span className="logs-badge logs-badge-action">{ACCIONES_LABEL[log.action] ?? log.action}</span></td>
                        <td><span className="logs-badge logs-badge-entity">{ENTIDADES_LABEL[log.entity] ?? log.entity}</span></td>
                        <td className="logs-cell-detail">
                          <button
                            type="button"
                            className="logs-btn-ver"
                            onClick={() => setSelectedLog(log)}
                            title="Ver detalle completo de la acción"
                            aria-label="Ver detalle"
                          >
                            <Eye className="logs-btn-ver-icon" aria-hidden strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {total > 0 && (
              <ListPaginationBar
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                disabled={loading}
                navLabel="Paginación del historial"
                pageSizeOptions={[25, 50, 100]}
              />
            )}
          </>
        )}
      </main>

      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Auditoría de la acción"
        titleId="logs-modal-title"
        size="large"
        subtitle={selectedLog ? `${formatDateTime(selectedLog.createdAt)} · ${selectedLog.userName || selectedLog.userEmail || 'Usuario'}` : ''}
        headerExtra={selectedLog && (
          <div className="logs-modal-badges">
            <span className="logs-modal-badge logs-modal-badge-action">{ACCIONES_LABEL[selectedLog.action] ?? selectedLog.action}</span>
            <span className="logs-modal-badge logs-modal-badge-entity">{ENTIDADES_LABEL[selectedLog.entity] ?? selectedLog.entity}</span>
          </div>
        )}
      >
        {selectedLog && (
          <div className="logs-modal-body-inner">
              <section className="logs-modal-section logs-modal-section--contexto">
                <h3 className="logs-modal-section-title">Contexto</h3>
                <div className="logs-modal-grid">
                  <div className="logs-modal-grid-item">
                    <span className="logs-modal-grid-label">Quién</span>
                    <span className="logs-modal-grid-value">
                      {selectedLog.userName && <strong>{selectedLog.userName}</strong>}
                      {selectedLog.userEmail && <span className="logs-modal-email">{selectedLog.userEmail}</span>}
                      {!selectedLog.userName && !selectedLog.userEmail && selectedLog.userId}
                    </span>
                  </div>
                  <div className="logs-modal-grid-item">
                    <span className="logs-modal-grid-label">Cuándo</span>
                    <span className="logs-modal-grid-value">{formatDateTime(selectedLog.createdAt)}</span>
                  </div>
                  {selectedLog.entityId && (
                    <div className="logs-modal-grid-item">
                      <span className="logs-modal-grid-label">ID del recurso</span>
                      <code className="logs-modal-grid-value logs-modal-id">{selectedLog.entityId}</code>
                    </div>
                  )}
                </div>
              </section>

              {Array.isArray(selectedLog.details?.items) && selectedLog.details.items.length > 0 && (() => {
                const first = selectedLog.details.items[0] || {};
                const isCompraAjusteBultos = Boolean(selectedLog.details?.ajusteBultos);
                const isCompraCreacion = !isCompraAjusteBultos && 'precioPorBulto' in first;
                const isCompra = isCompraCreacion || isCompraAjusteBultos;
                const isRecepcionPrecios = 'precioVenta' in first && !isCompra;
                return (
                  <section className="logs-modal-section logs-modal-section--items">
                    <h3 className="logs-modal-section-title">Detalle por ítem</h3>
                    <p className="logs-modal-section-desc">
                      {isRecepcionPrecios
                        ? 'Valores de precio y margen establecidos por el usuario.'
                        : isCompraAjusteBultos
                          ? 'Ajuste de bultos comprados por un comprador; se conserva la cantidad original en el sistema.'
                          : 'Foto de lo cargado: cada artículo con sus cantidades y montos.'}
                    </p>
                    <div className="logs-modal-items-wrap">
                      <table className="logs-modal-items-table">
                        <thead>
                          <tr>
                            <th>Artículo</th>
                            <th>Código</th>
                            {isCompraCreacion && (
                              <>
                                <th className="logs-modal-items-num">Bultos</th>
                                <th className="logs-modal-items-num">Precio/bulto</th>
                                <th className="logs-modal-items-num">Peso cajón (kg)</th>
                                <th className="logs-modal-items-num">Total</th>
                              </>
                            )}
                            {isCompraAjusteBultos && (
                              <>
                                <th className="logs-modal-items-num">Antes</th>
                                <th className="logs-modal-items-num">Después</th>
                                <th className="logs-modal-items-num">Ref. original</th>
                              </>
                            )}
                            {!isCompra && isRecepcionPrecios && (
                              <>
                                <th className="logs-modal-items-num">Precio venta</th>
                                <th className="logs-modal-items-num">Margen %</th>
                              </>
                            )}
                            {!isCompra && !isRecepcionPrecios && (
                              <>
                                <th className="logs-modal-items-num">Cantidad</th>
                                <th className="logs-modal-items-num">UXB</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLog.details.items.map((row, idx) => (
                            <tr key={idx}>
                              <td>{row.articulo ?? '—'}</td>
                              <td>{row.codigo ?? '—'}</td>
                              {isCompraCreacion && (
                                <>
                                  <td className="logs-modal-items-num">{row.bultos ?? '—'}</td>
                                  <td className="logs-modal-items-num">{row.precioPorBulto != null ? formatMoneda(row.precioPorBulto) : '—'}</td>
                                  <td className="logs-modal-items-num">
                                    {row.pesoCajon != null && row.pesoCajon !== '' ? formatNum(row.pesoCajon) : '—'}
                                  </td>
                                  <td className="logs-modal-items-num">{row.total != null ? formatMoneda(row.total) : '—'}</td>
                                </>
                              )}
                              {isCompraAjusteBultos && (
                                <>
                                  <td className="logs-modal-items-num">{row.bultosAntes ?? '—'}</td>
                                  <td className="logs-modal-items-num">{row.bultosDespues ?? '—'}</td>
                                  <td className="logs-modal-items-num">
                                    {row.bultosOriginalPersistido != null ? row.bultosOriginalPersistido : '—'}
                                  </td>
                                </>
                              )}
                              {!isCompra && isRecepcionPrecios && (
                                <>
                                  <td className="logs-modal-items-num">{row.precioVenta != null ? formatMoneda(row.precioVenta) : '—'}</td>
                                  <td className="logs-modal-items-num">{row.margenPorc != null ? formatPct(row.margenPorc) : '—'}</td>
                                </>
                              )}
                              {!isCompra && !isRecepcionPrecios && (
                                <>
                                  <td className="logs-modal-items-num">{row.cantidad ?? '—'}</td>
                                  <td className="logs-modal-items-num">{row.uxb ?? '—'}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })()}

              {getDetailEntries(selectedLog.details).length > 0 && (
                <section className="logs-modal-section logs-modal-section--datos">
                  <h3 className="logs-modal-section-title">Información cargada en esta acción</h3>
                  <p className="logs-modal-section-desc">Valores registrados por el usuario en cada campo.</p>
                  <div className="logs-modal-datatable">
                    <div className="logs-modal-datatable-header">
                      <span className="logs-modal-datatable-th">Campo</span>
                      <span className="logs-modal-datatable-th">Valor cargado</span>
                    </div>
                    {getDetailEntries(selectedLog.details).map(({ key, label, value }) => (
                      <div key={key} className="logs-modal-datatable-row">
                        <span className="logs-modal-datatable-cell logs-modal-datatable-cell--label">{label}</span>
                        <span className="logs-modal-datatable-cell logs-modal-datatable-cell--value">{formatDetailValue(key, value)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(!selectedLog.details || (getDetailEntries(selectedLog.details).length === 0 && !(Array.isArray(selectedLog.details?.items) && selectedLog.details.items.length > 0))) && (
                <p className="logs-modal-empty-detail">No hay datos adicionales registrados para esta acción.</p>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}
