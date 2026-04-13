/**
 * Login contra dbo.Usuarios (ELABASTECEDOR).
 * La columna Clave suele ser NVARCHAR con bytes 0–255 representados como caracteres (no es MD5 hex
 * ni texto plano legible). El modo `auto` prueba: texto plano, MD5 hex, bcrypt y PWDCOMPARE(@pwd,@bin)
 * reconstruyendo VARBINARY con el byte bajo de cada carácter (compatible con hashes del motor SQL).
 */
import crypto from 'crypto';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { getSqlServerPool } from './sqlserver.js';

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

/**
 * Modos:
 * - auto (recomendado): prueba plain, md5_hex, md5_hex_upper, bcrypt y PWDCOMPARE en SQL Server.
 * - plain | bcrypt | md5_hex | md5_hex_upper | sql_pwdccompare — un solo método.
 */
export function getExternalUsuariosPasswordMode() {
  const m = (process.env.EXTERNAL_USUARIOS_PASSWORD_MODE || 'auto').trim().toLowerCase();
  const allowed = ['auto', 'plain', 'bcrypt', 'md5_hex', 'md5_hex_upper', 'sql_pwdccompare'];
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

async function verifyPwdccompareInSql(plainPassword, storedNvarchar) {
  const buf = nvarcharClaveToLatin1Bytes(storedNvarchar);
  if (buf.length === 0) return false;
  try {
    const pool = await getSqlServerPool();
    const r = await pool.request()
      .input('pwd', sql.NVarChar, String(plainPassword))
      .input('h', sql.VarBinary, buf)
      .query('SELECT CAST(PWDCOMPARE(@pwd, @h) AS INT) AS ok');
    return Number(r.recordset?.[0]?.ok) === 1;
  } catch {
    return false;
  }
}

async function verifyUsuarioPasswordSingle(plain, stored, mode) {
  if (stored == null) return false;
  const s = typeof stored === 'string' ? stored.trim() : String(stored);
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
    return verifyPwdccompareInSql(plain, s);
  }
  return timingSafeEqualUtf8(String(plain), s);
}

/**
 * @param {string} plain
 * @param {unknown} stored
 * @param {string} mode
 */
export async function verifyUsuarioPassword(plain, stored, mode) {
  if (mode !== 'auto') {
    return verifyUsuarioPasswordSingle(plain, stored, mode);
  }
  const chain = ['plain', 'md5_hex', 'md5_hex_upper', 'bcrypt', 'sql_pwdccompare'];
  for (const m of chain) {
    if (await verifyUsuarioPasswordSingle(plain, stored, m)) return true;
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
 *   passwordStored: string
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

  const q = [
    'SELECT TOP 1',
    `  CAST(u.[${COL_ID}] AS NVARCHAR(64)) AS externUserId,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_EMAIL}] AS NVARCHAR(255)))) AS loginMail,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_USUARIO}] AS NVARCHAR(255)))) AS loginUsuario,`,
    `  LTRIM(RTRIM(CAST(u.[${COL_NOMBRE}] AS NVARCHAR(255)))) AS nombre,`,
    `  u.[${COL_NIVEL}] AS nivel,`,
    `  CAST(u.[${COL_PASSWORD}] AS NVARCHAR(4000)) AS passwordStored`,
    `FROM [${TABLE}] u`,
    `WHERE ${loginWhere}`,
    activoSql,
  ].join(' ');

  const result = await request.query(q);
  const row = result.recordset?.[0];
  if (!row || row.externUserId == null || String(row.externUserId).trim() === '') return null;

  const mail = String(row.loginMail ?? '').trim();
  const usr = String(row.loginUsuario ?? '').trim();
  const loginDisplay = mail || usr;

  return {
    externUserId: String(row.externUserId).trim(),
    loginMail: mail,
    loginUsuario: usr,
    login: loginDisplay,
    nombre: String(row.nombre ?? '').trim() || loginDisplay,
    nivel: row.nivel,
    passwordStored: row.passwordStored != null ? String(row.passwordStored) : '',
  };
}
