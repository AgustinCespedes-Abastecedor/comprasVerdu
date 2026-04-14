import { formatDateOnly, formatDateTime } from '../lib/format';

/**
 * Fechas y contexto de compra vs recepción (locale es-AR).
 * @param {{
 *   compraFecha?: string | Date | null,
 *   compraCreadaEn?: string | Date | null,
 *   recepcionCreadaEn?: string | Date | null,
 *   recepcionUltimaModificacion?: string | Date | null,
 *   recepcionCompleta?: boolean,
 *   className?: string,
 * }} props
 */
export default function TrazabilidadRecepcion({
  compraFecha,
  compraCreadaEn,
  recepcionCreadaEn,
  recepcionUltimaModificacion,
  recepcionCompleta,
  className = '',
}) {
  return (
    <dl className={`trazabilidad-dl ${className}`.trim()}>
      <div className="trazabilidad-dl-row">
        <dt>Fecha de compra</dt>
        <dd>{compraFecha ? formatDateOnly(compraFecha) : '—'}</dd>
      </div>
      <div className="trazabilidad-dl-row">
        <dt>Compra cargada en el sistema</dt>
        <dd>{compraCreadaEn ? formatDateTime(compraCreadaEn) : '—'}</dd>
      </div>
      <div className="trazabilidad-dl-row">
        <dt>Recepción creada</dt>
        <dd>{recepcionCreadaEn ? formatDateTime(recepcionCreadaEn) : '—'}</dd>
      </div>
      <div className="trazabilidad-dl-row">
        <dt>Última modificación recepción</dt>
        <dd>{recepcionUltimaModificacion ? formatDateTime(recepcionUltimaModificacion) : '—'}</dd>
      </div>
      {recepcionCompleta !== undefined && (
        <div className="trazabilidad-dl-row">
          <dt>Precios de venta</dt>
          <dd>{recepcionCompleta ? 'Cargados (recepción completa)' : 'Pendientes o parcial'}</dd>
        </div>
      )}
    </dl>
  );
}
