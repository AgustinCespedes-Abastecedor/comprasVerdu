/**
 * Login contra dbo.Usuarios (ELABASTECEDOR).
 * La columna Clave puede ser NVARCHAR, VARCHAR o VARBINARY: el driver puede devolver `string` o `Buffer`.
 * Texto plano ASCII/UTF-8 en VARBINARY se normaliza con {@link bufferClaveToComparableString}.
 * Hashes legacy (PWDENCRYPT, etc.) suelen leerse como NVARCHAR con bytes 0–255 por carácter; el modo
 * `auto` prueba: texto en SQL, cifrado legado ELAB (+15/-17 por bloques), plain, MD5, bcrypt y PWDCOMPARE.
 */
import crypto from 'crypto';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { getSqlServerPool } from './sqlserver.js';
import { verifyElabLegacyClave } from './elabLegacyPassword.js';

/**
 * Convierte VARBINARY/IMAGE (Buffer) a string para comparar con la contraseña tecleada.
 * - Si son bytes ASCII/UTF-8 de texto plano → utf8.
 * - Si es UTF-16LE (longitud par, texto legible) → utf16le.
 * - Si parece hash binario (PWDENCRYPT, etc.) → latin1 (un code point por byte bajo).
 * @param {Buffer} buf
 * @returns {string}
 */
function isAsciiPrintableText(s) {
  if (!s) return false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c >= 32 && c <= 126) continue;
    return false;
  }
  return true;
}

export function bufferClaveToComparableString(buf) {
  if (!buf || buf.length === 0) return '';
  const u8 = buf.toString('utf8');
  const looksUtf8Text = isAsciiPrintableText(u8);
  if (looksUtf8Text && u8.length > 0) return u8;
  if (buf.length % 2 === 0) {
    const u16 = buf.toString('utf16le').replace(/\0+$/g, '');
    if (u16.length > 0 && isAsciiPrintableText(u16)) {
      return u16;
    }
  }
  return buf.toString('latin1');
}

/**
 * El driver `mssql` puede devolver `Buffer`/`Uint8Array` si la columna es VARBINARY/IMAGE.
 * `String(buffer)` en Node no es el contenido: produce "[object Object]" o hex, no la clave real.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSqlPasswordColumnValue(value) {
  if (value == null) return '';
  if (Buffer.isBuffer(value)) {
    return bufferClaveToComparableString(value);
  }
  if (value instanceof Uint8Array) {
    return bufferClaveToComparableString(Buffer.from(value));
  }
  if (typeof value === 'string') return value;
  return String(value);
}

const TABLE = process.env.EXTERNAL_USUARIOS_TABLE || 'Usuarios';
const COL_ID = process.env.EXTERNAL_USUARIOS_COL_ID || 'Codigo';
/** Login por correo (columna real en ELABASTECEDOR). */
const COL_EMAIL = process.env.EXTERNAL_USUARIOS_COL_EMAIL || 'EMail';
/** Login alternativo (código de usuario legado). */
const COL_USUARIO = process.env.EXTERNAL_USUARIOS_COL_USUARIO || 'Usuario';
const COL_PASSWORD = process.env.EXTERNAL_USUARIOS_COL_PASSWORD || 'Clave';
const COL_NIVEL = process.env.EXTERNAL_USUARIOS_COL_NIVEL || 'Nivel';
const COL_NOMBRE = process.env.EXTERNAL_USUARIOS_COL_NOMBRE || 'NombreCompleto';
/** Columna bit de usuario habilitado (por defecto Habilitado). Ignorar con EXTERNAL_USUARIOS_IGNORE_ACTIVO=true. */
const COL_ACTIVO = process.env.EXTERNAL_USUARIOS_COL_ACTIVO || 'Habilitado';
const IGNORE_ACTIVO = process.env.EXTERNAL_USUARIOS_IGNORE_ACTIVO === 'true'
  || process.env.EXTERNAL_USUARIOS_IGNORE_ACTIVO === '1';

const COL_LEGAJO = process.env.EXTERNAL_USUARIOS_COL_LEGAJO || 'Legajo';
const COL_SUCURSAL = process.env.EXTERNAL_USUARIOS_COL_SUCURSAL || 'Sucursal';
const COL_SECTOR = process.env.EXTERNAL_USUARIOS_COL_SECTOR || 'Sector';
const COL_TELEFONO = process.env.EXTERNAL_USUARIOS_COL_TELEFONO || 'Telefono';
const COL_INTERNO = process.env.EXTERNAL_USUARIOS_COL_INTERNO || 'Interno';

/** Catálogo ELAB: código de sucursal → nombre (JOIN en detalle de usuario). */
const TABLE_SUCURSALES = process.env.EXTERNAL_SUCURSALES_TABLE || 'sucursales';
const COL_SUCURSALES_CODIGO = process.env.EXTERNAL_SUCURSALES_CODIGO || 'codigo';
const COL_SUCURSALES_DESCRIPCION = process.env.EXTERNAL_SUCURSALES_DESCRIPCION || 'Descripcion';

/**
 * @param {string} colName
 * @param {number} len
 */
function nvarcharTrimCast(colName, len) {
  return `LTRIM(RTRIM(CAST(u.[${colName}] AS NVARCHAR(${len}))))`;
}

/**
 * Detalle de un usuario (gestión) por código de `Codigo` / EXTERNAL_USUARIOS_COL_ID.
 * Sin contraseña; columnas configurables por env.
 *
 * @param {string} externUserId
 * @returns {Promise<{
 *   nombreCompleto: string | null,
 *   usuario: string | null,
 *   legajo: string | null,
 *   nivel: string | null,
 *   sucursal: string | null,
 *   sector: string | null,
 *   telefono: string | null,
 *   interno: string | null,
 *   email: string | null, codigo: string
 * } | null>}
 */
export async function fetchUsuarioExternoDetallePorCodigo(externUserId) {
  const cod = String(externUserId ?? '').trim();
  if (!cod) return null;

  const pool = await getSqlServerPool();
  const request = pool.request();
  request.input('cod', sql.NVarChar(64), cod);

  const sucursalNombreExpr = `NULLIF(LTRIM(RTRIM(CAST(sc.[${COL_SUCURSALES_DESCRIPCION}] AS NVARCHAR(255)))), '')`;
  const sucursalCodigoUsuarioExpr = nvarcharTrimCast(COL_SUCURSAL, 255);
  const sucursalDisplay = `COALESCE(${sucursalNombreExpr}, ${sucursalCodigoUsuarioExpr}) AS sucursal`;

  const joinSucursales = [
    `LEFT JOIN [${TABLE_SUCURSALES}] sc ON `,
    `LTRIM(RTRIM(CAST(sc.[${COL_SUCURSALES_CODIGO}] AS NVARCHAR(50)))) = `,
    `LTRIM(RTRIM(CAST(u.[${COL_SUCURSAL}] AS NVARCHAR(50))))`,
  ].join('');

  const q = [
    'SELECT TOP 1',
    `  ${nvarcharTrimCast(COL_NOMBRE, 500)} AS nombreCompleto,`,
    `  ${nvarcharTrimCast(COL_USUARIO, 255)} AS usuario,`,
    `  ${nvarcharTrimCast(COL_LEGAJO, 80)} AS legajo,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_NIVEL}] AS NVARCHAR(80)))) AS nivel,`,
    `  ${sucursalDisplay},`,
    `  ${nvarcharTrimCast(COL_SECTOR, 255)} AS sector,`,
    `  ${nvarcharTrimCast(COL_TELEFONO, 80)} AS telefono,`,
    `  ${nvarcharTrimCast(COL_INTERNO, 80)} AS interno,`,
    `  ${nvarcharTrimCast(COL_EMAIL, 255)} AS email,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_ID}] AS NVARCHAR(64)))) AS codigo`,
    `FROM [${TABLE}] u`,
    joinSucursales,
    `WHERE LTRIM(RTRIM(CAST(u.[${COL_ID}] AS NVARCHAR(64)))) = @cod`,
  ].join(' ');

  const result = await request.query(q);
  const row = result.recordset?.[0];
  if (!row) return null;

  const s = (v) => {
    if (v == null || v === '') return null;
    const t = String(v).trim();
    return t.length ? t : null;
  };

  return {
    nombreCompleto: s(row.nombreCompleto),
    usuario: s(row.usuario),
    legajo: s(row.legajo),
    nivel: s(row.nivel),
    sucursal: s(row.sucursal),
    sector: s(row.sector),
    telefono: s(row.telefono),
    interno: s(row.interno),
    email: s(row.email),
    codigo: s(row.codigo) ?? cod,
  };
}

/**
 * Modos:
 * - auto (recomendado): sql_plain_equal, elab_legacy, plain, md5, bcrypt, PWDCOMPARE…
 * - elab_legacy — cifrado por desplazamiento ASCII (+15/-17) usado en columnas Clave NVARCHAR legadas.
 * - plain | bcrypt | md5_hex | … — un solo método.
 */
export function getExternalUsuariosPasswordMode() {
  const m = (process.env.EXTERNAL_USUARIOS_PASSWORD_MODE || 'auto').trim().toLowerCase();
  const allowed = [
    'auto',
    'plain',
    'bcrypt',
    'md5_hex',
    'md5_hex_upper',
    'sql_pwdccompare',
    'sql_pwdccompare_convert',
    'sql_plain_equal',
    'elab_legacy',
  ];
  if (allowed.includes(m)) return m;
  return 'auto';
}

function timingSafeEqualUtf8(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * La columna Clave es NVARCHAR pero en muchas instalaciones legacy guarda bytes 0–255
 * representados como caracteres (efecto “ASCII + basura”). Reconstruye el VARBINARY que
 * espera PWDCOMPARE cuando el hash fue generado en el motor SQL (PWDENCRYPT u homólogo).
 * @param {unknown} stored
 */
export function nvarcharClaveToLatin1Bytes(stored) {
  if (stored == null) return Buffer.alloc(0);
  const s = typeof stored === 'string' ? stored : String(stored);
  return Buffer.from([...s].map((ch) => ch.charCodeAt(0) & 0xff));
}

/**
 * PWDCOMPARE cuando el hash llega como Buffer (columna VARBINARY / IMAGE sin perder bytes).
 */
async function verifyPwdccompareWithVarbinaryBuffer(plainPassword, buf) {
  if (!buf || buf.length === 0) return false;
  try {
    const pool = await getSqlServerPool();
    const r = await pool.request()
      .input('pwd', sql.NVarChar(4000), String(plainPassword))
      .input('h', sql.VarBinary, buf)
      .query('SELECT CAST(PWDCOMPARE(@pwd, @h) AS INT) AS ok');
    return Number(r.recordset?.[0]?.ok) === 1;
  } catch {
    return false;
  }
}

async function verifyPwdccompareInSql(plainPassword, storedNvarchar) {
  const raw = storedNvarchar == null ? '' : typeof storedNvarchar === 'string' ? storedNvarchar : String(storedNvarchar);
  const candidates = [...new Set([raw, raw.trim()].filter((c) => c.length > 0))];
  for (const c of candidates) {
    const buf = nvarcharClaveToLatin1Bytes(c);
    if (buf.length === 0) continue;
    try {
      const pool = await getSqlServerPool();
      const r = await pool.request()
        .input('pwd', sql.NVarChar(4000), String(plainPassword))
        .input('h', sql.VarBinary, buf)
        .query('SELECT CAST(PWDCOMPARE(@pwd, @h) AS INT) AS ok');
      if (Number(r.recordset?.[0]?.ok) === 1) return true;
    } catch {
      // siguiente candidato
    }
  }
  return false;
}

/**
 * PWDCOMPARE dejando que SQL Server convierta NVARCHAR→VARBINARY (a veces coincide cuando
 * la reconstrucción byte-a-byte en Node no alinea con el motor).
 */
async function verifyPwdccompareConvertInSql(plainPassword, storedNvarchar) {
  const raw = storedNvarchar == null ? '' : typeof storedNvarchar === 'string' ? storedNvarchar : String(storedNvarchar);
  const candidates = [...new Set([raw, raw.trim()].filter((c) => c.length > 0))];
  for (const c of candidates) {
    try {
      const pool = await getSqlServerPool();
      const r = await pool.request()
        .input('pwd', sql.NVarChar(4000), String(plainPassword))
        .input('h', sql.NVarChar(sql.MAX), c)
        .query('SELECT CAST(PWDCOMPARE(@pwd, CONVERT(VARBINARY(MAX), @h)) AS INT) AS ok');
      if (Number(r.recordset?.[0]?.ok) === 1) return true;
    } catch {
      // siguiente candidato
    }
  }
  return false;
}

/**
 * Igualdad de texto en el propio SQL Server (colación y espacios CHAR igual que en el ERP).
 */
async function verifyPlainEqualsInSql(plainPassword, storedRaw) {
  const stored = storedRaw == null ? '' : typeof storedRaw === 'string' ? storedRaw : String(storedRaw);
  if (stored === '' && String(plainPassword ?? '') === '') return false;
  try {
    const pool = await getSqlServerPool();
    const r = await pool.request()
      .input('pwd', sql.NVarChar(4000), String(plainPassword ?? ''))
      .input('stored', sql.NVarChar(sql.MAX), stored)
      .query(`
        SELECT CASE WHEN
          @pwd = @stored
          OR LTRIM(RTRIM(@pwd)) = LTRIM(RTRIM(@stored))
          OR @pwd = LTRIM(RTRIM(@stored))
          OR LTRIM(RTRIM(@pwd)) = @stored
          OR LOWER(LTRIM(RTRIM(@pwd))) = LOWER(LTRIM(RTRIM(@stored)))
        THEN 1 ELSE 0 END AS ok`);
    return Number(r.recordset?.[0]?.ok) === 1;
  } catch {
    return false;
  }
}

function plainMatchesInNode(plain, storedTrimmed) {
  const s = storedTrimmed;
  if (!s) return false;
  const p = String(plain ?? '');
  const variants = [...new Set([p, p.trimEnd(), p.trim()].filter((x) => x.length > 0))];
  for (const pv of variants) {
    if (timingSafeEqualUtf8(pv, s)) return true;
    if (pv.length === s.length && timingSafeEqualUtf8(pv.toLowerCase(), s.toLowerCase())) return true;
  }
  if (p.trim().toLowerCase() === s.toLowerCase()) return true;
  const pn = p.trim().normalize('NFC');
  const sn = s.trim().normalize('NFC');
  if (pn === sn || pn.toLowerCase() === sn.toLowerCase()) return true;
  return false;
}

async function verifyUsuarioPasswordSingle(plain, stored, mode) {
  if (stored == null) return false;
  const raw = typeof stored === 'string' ? stored : String(stored);
  const s = raw.trim();
  if (s === '') return false;

  if (mode === 'bcrypt') {
    try {
      return await bcrypt.compare(String(plain), s);
    } catch {
      return false;
    }
  }
  if (mode === 'md5_hex') {
    const h = crypto.createHash('md5').update(String(plain), 'utf8').digest('hex');
    return timingSafeEqualUtf8(h.toLowerCase(), s.toLowerCase());
  }
  if (mode === 'md5_hex_upper') {
    const h = crypto.createHash('md5').update(String(plain), 'utf8').digest('hex').toUpperCase();
    return timingSafeEqualUtf8(h, s.toUpperCase());
  }
  if (mode === 'sql_pwdccompare') {
    return verifyPwdccompareInSql(plain, raw);
  }
  if (mode === 'sql_pwdccompare_convert') {
    return verifyPwdccompareConvertInSql(plain, raw);
  }
  if (mode === 'sql_plain_equal') {
    return verifyPlainEqualsInSql(plain, raw);
  }
  if (mode === 'elab_legacy') {
    return verifyElabLegacyClave(plain, raw);
  }
  return plainMatchesInNode(plain, s);
}

/**
 * @param {string} plain
 * @param {unknown} stored — string normalizado o Buffer/Uint8Array tal cual el driver (VARBINARY)
 * @param {string} mode
 */
export async function verifyUsuarioPassword(plain, stored, mode) {
  const buf = Buffer.isBuffer(stored) || stored instanceof Uint8Array
    ? Buffer.from(stored)
    : null;

  if (mode === 'auto' && buf && buf.length > 0) {
    if (await verifyPwdccompareWithVarbinaryBuffer(plain, buf)) return true;
  }

  const storedNorm = buf ? normalizeSqlPasswordColumnValue(buf) : normalizeSqlPasswordColumnValue(stored);

  if (mode !== 'auto') {
    return verifyUsuarioPasswordSingle(plain, storedNorm, mode);
  }
  const chain = [
    'sql_plain_equal',
    'elab_legacy',
    'plain',
    'md5_hex',
    'md5_hex_upper',
    'bcrypt',
    'sql_pwdccompare',
    'sql_pwdccompare_convert',
  ];
  for (const m of chain) {
    if (await verifyUsuarioPasswordSingle(plain, storedNorm, m)) return true;
  }
  return false;
}

/**
 * @typedef {{
 *   externUserId: string,
 *   loginMail: string,
 *   loginUsuario: string,
 *   login: string,
 *   nombre: string,
 *   nivel: unknown,
 *   passwordStored: string|Buffer
 * }} UsuarioExternoRow
 */

/**
 * Busca un usuario por EMail o Usuario (minúsculas).
 * @param {string} loginNorm — trim + lower
 * @returns {Promise<UsuarioExternoRow|null>}
 */
export async function fetchUsuarioExternoPorLogin(loginNorm) {
  const login = String(loginNorm ?? '').trim().toLowerCase();
  if (!login) return null;

  const pool = await getSqlServerPool();
  const request = pool.request();
  request.input('login', sql.NVarChar(255), login);

  const emailExpr = `LOWER(LTRIM(RTRIM(CAST(u.[${COL_EMAIL}] AS NVARCHAR(255)))))`;
  const usuarioExpr = `LOWER(LTRIM(RTRIM(CAST(u.[${COL_USUARIO}] AS NVARCHAR(255)))))`;
  const codigoExpr = `LTRIM(RTRIM(CAST(u.[${COL_ID}] AS NVARCHAR(40))))`;

  const matchUsuario = process.env.EXTERNAL_USUARIOS_MATCH_USUARIO !== 'false'
    && process.env.EXTERNAL_USUARIOS_MATCH_USUARIO !== '0';
  const loginWhere = matchUsuario
    ? `(${emailExpr} = @login OR ${usuarioExpr} = @login OR ${codigoExpr} = @login)`
    : `${emailExpr} = @login`;

  /** Habilitado suele ser bit: no comparar con 'S' (rompe CAST a bit en SQL Server). */
  const activoSql = !IGNORE_ACTIVO && COL_ACTIVO && String(COL_ACTIVO).trim() !== ''
    ? ` AND (u.[${COL_ACTIVO}] = 1 OR TRY_CAST(u.[${COL_ACTIVO}] AS INT) = 1)`
    : '';

  const codigoMatch = `LTRIM(RTRIM(CAST(u.[${COL_ID}] AS NVARCHAR(40)))) = @login`;
  const orderBy = matchUsuario
    ? ` ORDER BY CASE WHEN ${codigoMatch} THEN 0 WHEN ${emailExpr} = @login THEN 1 WHEN ${usuarioExpr} = @login THEN 2 ELSE 9 END`
    : '';

  const q = [
    'SELECT TOP 1',
    `  CAST(u.[${COL_ID}] AS NVARCHAR(64)) AS externUserId,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_EMAIL}] AS NVARCHAR(255)))) AS loginMail,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_USUARIO}] AS NVARCHAR(255)))) AS loginUsuario,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_NOMBRE}] AS NVARCHAR(255)))) AS nombre,`,
    `  u.[${COL_NIVEL}] AS nivel,`,
    `  u.[${COL_PASSWORD}] AS passwordStored`,
    `FROM [${TABLE}] u`,
    `WHERE ${loginWhere}`,
    activoSql,
    orderBy,
  ].join(' ');

  const result = await request.query(q);
  const row = result.recordset?.[0];
  if (!row || row.externUserId == null || String(row.externUserId).trim() === '') return null;

  const mail = String(row.loginMail ?? '').trim();
  const usr = String(row.loginUsuario ?? '').trim();
  const loginDisplay = mail || usr;

  const rawClave = row.passwordStored;
  const passwordStored = Buffer.isBuffer(rawClave) || rawClave instanceof Uint8Array
    ? Buffer.from(rawClave)
    : normalizeSqlPasswordColumnValue(rawClave);

  return {
    externUserId: String(row.externUserId).trim(),
    loginMail: mail,
    loginUsuario: usr,
    login: loginDisplay,
    nombre: String(row.nombre ?? '').trim() || loginDisplay,
    nivel: row.nivel,
    passwordStored,
  };
}

/**
 * Lista filas de dbo.Usuarios sin exponer la columna de contraseña (para gestión / administración).
 * @param {{ q?: string, limit?: number }} opts
 * @returns {Promise<Array<{ externUserId: string, loginMail: string, loginUsuario: string, nombre: string, nivel: unknown, habilitadoEnErp: boolean | null }>>}
 */
export async function listUsuariosExternos(opts = {}) {
  const qRaw = typeof opts.q === 'string' ? opts.q.trim() : '';
  const envDefault = parseInt(process.env.EXTERNAL_USUARIOS_LIST_LIMIT || '2000', 10) || 2000;
  const lim = Math.min(Math.max(parseInt(String(opts.limit ?? envDefault), 10) || envDefault, 1), 8000);

  const pool = await getSqlServerPool();
  const request = pool.request();

  let whereSearch = '';
  if (qRaw) {
    request.input('q1', sql.NVarChar(255), `%${qRaw}%`);
    whereSearch = ` AND (
      LTRIM(RTRIM(CAST(u.[${COL_NOMBRE}] AS NVARCHAR(255)))) LIKE @q1
      OR LTRIM(RTRIM(CAST(u.[${COL_EMAIL}] AS NVARCHAR(255)))) LIKE @q1
      OR LTRIM(RTRIM(CAST(u.[${COL_USUARIO}] AS NVARCHAR(255)))) LIKE @q1
      OR LTRIM(RTRIM(CAST(u.[${COL_ID}] AS NVARCHAR(64)))) LIKE @q1
    )`;
  }

  const habilitadoExpr = IGNORE_ACTIVO || !String(COL_ACTIVO || '').trim()
    ? 'CAST(1 AS BIT)'
    : `(CASE WHEN u.[${COL_ACTIVO}] = 1 OR TRY_CAST(u.[${COL_ACTIVO}] AS INT) = 1 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END)`;

  const query = [
    `SELECT TOP (${lim})`,
    `  CAST(u.[${COL_ID}] AS NVARCHAR(64)) AS externUserId,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_EMAIL}] AS NVARCHAR(255)))) AS loginMail,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_USUARIO}] AS NVARCHAR(255)))) AS loginUsuario,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_NOMBRE}] AS NVARCHAR(255)))) AS nombre,`,
    `  u.[${COL_NIVEL}] AS nivel,`,
    `  ${habilitadoExpr} AS habilitadoEnErp`,
    `FROM [${TABLE}] u`,
    'WHERE 1=1',
    whereSearch,
    `ORDER BY LTRIM(RTRIM(CAST(u.[${COL_NOMBRE}] AS NVARCHAR(255))))`,
  ].join(' ');

  const result = await request.query(query);
  const rows = result.recordset || [];
  const mapped = rows
    .map((row) => {
      const externUserId = String(row.externUserId ?? '').trim();
      const loginMail = String(row.loginMail ?? '').trim();
      const loginUsuario = String(row.loginUsuario ?? '').trim();
      const nombre = String(row.nombre ?? '').trim() || loginMail || loginUsuario || externUserId;
      let habilitadoEnErp = null;
      if (!IGNORE_ACTIVO && COL_ACTIVO) {
        const v = row.habilitadoEnErp;
        habilitadoEnErp = v === true || v === 1 || v === '1';
      }
      return {
        externUserId,
        loginMail,
        loginUsuario,
        nombre,
        nivel: row.nivel,
        habilitadoEnErp,
      };
    })
    .filter((r) => r.externUserId.length > 0);
  return dedupeUsuariosExternosPorCodigo(mapped);
}

/**
 * Una fila por código de usuario (evita duplicados si la tabla devolviera el mismo Codigo más de una vez).
 * @template {{ externUserId: string }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function dedupeUsuariosExternosPorCodigo(rows) {
  const seen = new Map();
  for (const r of rows) {
    const id = String(r.externUserId ?? '').trim();
    if (!id) continue;
    if (!seen.has(id)) seen.set(id, r);
  }
  return [...seen.values()];
}
