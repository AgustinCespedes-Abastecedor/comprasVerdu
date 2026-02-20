/**
 * Formateadores centralizados para el frontend (locale es-AR).
 * Uso: import { formatDateTime, formatMoneda } from '../lib/format';
 */

/** Fecha y hora (ej. "20 feb 2026, 12:17") */
export function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Solo fecha, sin hora (evita que medianoche UTC se vea como día anterior en zonas negativas). */
export function formatDateOnly(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha corta para inputs o listas (ej. "20/02/2026") */
export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR');
}

/** Fecha con día/mes corto/año (ej. "20 feb 2026") */
export function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha de hoy en YYYY-MM-DD para inputs type="date" */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Número entero con separador de miles (es-AR) */
export function formatNum(n) {
  if (n == null) return '—';
  const num = Number(n);
  return Number.isNaN(num) ? String(n) : num.toLocaleString('es-AR');
}

/** Número entero sin decimales (ej. bultos, UXB) */
export function formatEntero(n) {
  if (n == null) return '—';
  const num = Number(n);
  return Number.isNaN(num) ? String(n) : num.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

/** Monto con $ y 2 decimales (punto miles, coma decimal, es-AR) */
export function formatMoneda(value) {
  if (value === undefined || value === null) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Porcentaje con 2 decimales y " %" */
export function formatPct(n) {
  if (n == null) return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  const s = num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${s} %`;
}
