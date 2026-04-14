/**
 * Día civil operativo para recepciones (Argentina, UTC−3 sin DST).
 * `recepcion.createdAt` se compara contra [gte, lt) en UTC.
 *
 * APP_CALENDAR_UTC_START_HOUR: hora UTC en que comienza el día civil local (0:00 ART = 03:00 UTC → default 3).
 */
const DEFAULT_LOCAL_MIDNIGHT_UTC_HOUR = 3;

function readStartUtcHour() {
  const raw = process.env.APP_CALENDAR_UTC_START_HOUR;
  if (raw === undefined || raw === '') return DEFAULT_LOCAL_MIDNIGHT_UTC_HOUR;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 23) return DEFAULT_LOCAL_MIDNIGHT_UTC_HOUR;
  return n;
}

/**
 * @param {string} fechaYYYYMMDD
 * @returns {{ gte: Date, lt: Date } | null}
 */
export function getCalendarDayBoundsUtc(fechaYYYYMMDD) {
  const parts = fechaYYYYMMDD.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const hour = readStartUtcHour();
  const gte = new Date(Date.UTC(y, m - 1, d, hour, 0, 0, 0));
  if (Number.isNaN(gte.getTime())) return null;
  if (gte.getUTCFullYear() !== y || gte.getUTCMonth() + 1 !== m || gte.getUTCDate() !== d) {
    return null;
  }
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

/**
 * Convierte un instante UTC (DB) al string YYYY-MM-DD del día civil operativo.
 * @param {Date} date
 * @returns {string}
 */
export function utcInstantToCalendarDayString(date) {
  const hour = readStartUtcHour();
  const shifted = new Date(date.getTime() - hour * 3600000);
  return shifted.toISOString().slice(0, 10);
}
