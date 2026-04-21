/**
 * Orden por defecto de listados de compras y recepciones (API paginada y exports).
 * Criterio: más reciente primero — la página 1 debe mostrar lo último cargado en operación diaria.
 *
 * Compras: fecha de planilla (día de compra), desempate por alta en sistema y Nº secuencial.
 * Recepciones: misma vigencia vía la compra 1:1 (fecha/createdAt/Nº de la compra asociada).
 */

export const COMPRAS_LIST_ORDER_BY = [
  { fecha: 'desc' },
  { createdAt: 'desc' },
  { numeroCompra: 'desc' },
];

export const RECEPCIONES_LIST_ORDER_BY = [
  { compra: { fecha: 'desc' } },
  { compra: { createdAt: 'desc' } },
  { compra: { numeroCompra: 'desc' } },
];

/** @param {unknown} d */
function timeMs(d) {
  if (d == null) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Mismo criterio que {@link RECEPCIONES_LIST_ORDER_BY} para ordenar en memoria (p. ej. tras filtros).
 * Desempates: Nº recepción, última modificación de recepción, id (estable).
 *
 * @param {{ id?: string, compra?: { fecha?: unknown, createdAt?: unknown, numeroCompra?: number|null }, numeroRecepcion?: number|null, updatedAt?: unknown }} a
 * @param {{ id?: string, compra?: { fecha?: unknown, createdAt?: unknown, numeroCompra?: number|null }, numeroRecepcion?: number|null, updatedAt?: unknown }} b
 * @returns {number}
 */
export function compareRecepcionesNewestFirst(a, b) {
  const fa = timeMs(a.compra?.fecha);
  const fb = timeMs(b.compra?.fecha);
  if (fa !== fb) return fb - fa;
  const ca = timeMs(a.compra?.createdAt);
  const cb = timeMs(b.compra?.createdAt);
  if (ca !== cb) return cb - ca;
  const na = Number(a.compra?.numeroCompra) || 0;
  const nb = Number(b.compra?.numeroCompra) || 0;
  if (na !== nb) return nb - na;
  const ra = Number(a.numeroRecepcion) || 0;
  const rb = Number(b.numeroRecepcion) || 0;
  if (ra !== rb) return rb - ra;
  const ua = timeMs(a.updatedAt);
  const ub = timeMs(b.updatedAt);
  if (ua !== ub) return ub - ua;
  return String(b.id ?? '').localeCompare(String(a.id ?? ''));
}
