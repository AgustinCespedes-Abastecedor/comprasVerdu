/**
 * Fechas "solo día" (calendario) alineadas con Postgres `DATE` / Prisma `@db.Date`
 * y con inputs `YYYY-MM-DD` del frontend.
 *
 * Usar `Date.UTC` para el instante enviado a Prisma evita que el huso horario del
 * proceso Node desplace el día al comparar o persistir `fecha` de compra.
 */

/**
 * @param {unknown} input - string (YYYY-MM-DD o ISO con prefijo de fecha) u otro serializable
 * @returns {Date | null}
 */
export function parseYmdToPrismaDateOnly(input) {
  if (input == null || input === '') return null;
  const s = typeof input === 'string' ? input.trim() : String(input);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/**
 * Normaliza un valor típico de `req.query` (string o primer elemento si vino repetido).
 * @param {unknown} raw
 * @returns {string}
 */
function queryScalarTrimmed(raw) {
  if (raw == null) return '';
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  return String(raw).trim();
}

/**
 * Si el query trae texto no vacío pero no es una fecha YYYY-MM-DD válida, registra aviso.
 * No cambia la respuesta HTTP (el filtro se omite como hasta ahora).
 *
 * @param {string} routeLabel - ej. "GET /compras"
 * @param {string} paramName - ej. "desde"
 * @param {unknown} raw - valor de req.query[paramName]
 */
export function logWarnIfInvalidYmdQuery(routeLabel, paramName, raw) {
  const s = queryScalarTrimmed(raw);
  if (!s) return;
  if (parseYmdToPrismaDateOnly(s)) return;
  const preview = s.length > 64 ? `${s.slice(0, 64)}…` : s;
  console.warn(`[fecha-query] ${routeLabel} · "${paramName}" ignorado (inválido): ${preview}`);
}
