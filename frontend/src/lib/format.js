/**
 * Formateadores centralizados para el frontend (locale es-AR).
 * Uso: import { formatDateTime, formatMoneda } from '../lib/format';
 */

/**
 * Partes año-mes-día para valores "solo fecha" (Postgres DATE / Prisma: medianoche UTC).
 * Así el día mostrado coincide con el cargado en planilla (YYYY-MM-DD), sin corrimiento ART/UTC.
 * @param {string | number | Date | null | undefined} value
 * @returns {{ y: number, mo: number, d: number } | null}
 */
function calendarYmdParts(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      y: value.getUTCFullYear(),
      mo: value.getUTCMonth() + 1,
      d: value.getUTCDate(),
    };
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
      y: date.getUTCFullYear(),
      mo: date.getUTCMonth() + 1,
      d: date.getUTCDate(),
    };
  }
  return null;
}

/**
 * Clave `YYYY-MM-DD` para agrupar por día civil (misma semántica que `formatDate` en listas de compra).
 * @param {string | number | Date | null | undefined} value
 * @returns {string} cadena vacía si no hay fecha válida
 */
export function fechaCivilYmdKey(value) {
  const parts = calendarYmdParts(value);
  if (!parts) return '';
  const { y, mo, d } = parts;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatWithUtcCalendarLocale(value, options) {
  const parts = calendarYmdParts(value);
  if (!parts) return null;
  const { y, mo, d } = parts;
  const utcAnchor = new Date(Date.UTC(y, mo - 1, d));
  return utcAnchor.toLocaleDateString('es-AR', { timeZone: 'UTC', ...options });
}

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

/** Solo fecha civil (DATE / YYYY-MM-DD), sin corrimiento por zona horaria local. */
export function formatDateOnly(d) {
  if (!d) return '—';
  const s = formatWithUtcCalendarLocale(d, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (s) return s;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha corta para listas (compra.fecha, filtros por día de compra): día civil guardado en BD. */
export function formatDate(d) {
  if (!d && d !== 0) return '';
  const s = formatWithUtcCalendarLocale(d, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (s) return s;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
}

/**
 * Fecha corta con mes abreviado (ej. "20 feb 2026").
 * Uso típico: timestamps reales (createdAt) → zona horaria local del dispositivo.
 */
export function formatDateShort(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha de hoy en YYYY-MM-DD para inputs type="date" (calendario local, no UTC). */
export function todayStr() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const day = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

/**
 * Proveedor: helpers para mostrar nombre + código (sin paréntesis).
 * Código viene de SQL Server y se guarda como `codigoExterno` (acepta `codigo` por compatibilidad).
 */
export function getProveedorNombre(proveedor) {
  const nombre = (proveedor?.nombre ?? '').toString().trim();
  return nombre || null;
}

export function getProveedorCodigo(proveedor) {
  const codigo = (proveedor?.codigoExterno ?? proveedor?.codigo ?? '').toString().trim();
  return codigo || null;
}

/** Texto plano (selects/inputs/Excel): "Nombre · Cod. 123" */
export function formatProveedorText(proveedor) {
  const nombre = getProveedorNombre(proveedor);
  const codigo = getProveedorCodigo(proveedor);
  if (!nombre && !codigo) return '—';
  if (nombre && !codigo) return nombre;
  if (!nombre && codigo) return `Cod. ${codigo}`;
  return `${nombre} · Cod. ${codigo}`;
}
