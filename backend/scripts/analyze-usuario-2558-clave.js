/**
 * Diagnóstico de tipo y formato de Clave para usuario 2558 (SQL Server ELABASTECEDOR).
 * Prueba Sinergia2025 contra: texto plano, LOWER, PWDCOMPARE (varias conversiones), HASHBYTES.
 *
 * Uso (desde backend, con .env con EXTERNAL_DB_*):
 *   cd backend && node scripts/analyze-usuario-2558-clave.js
 *
 * Opcional: CODIGO_USUARIO=2558 PASSWORD_PLAIN=Sinergia2025 node scripts/analyze-usuario-2558-clave.js
 */
import 'dotenv/config';
import crypto from 'crypto';
import sql from 'mssql';
import {
  normalizeSqlPasswordColumnValue,
  verifyUsuarioPassword,
} from '../src/lib/usuariosSqlServer.js';
import { encodeElabLegacyClave, verifyElabLegacyClave } from '../src/lib/elabLegacyPassword.js';

const CODIGO = String(process.env.CODIGO_USUARIO || '2558').trim();
const PLAIN = String(process.env.PASSWORD_PLAIN || 'Sinergia2025');

const config = {
  server: process.env.EXTERNAL_DB_SERVER || '192.168.1.200',
  port: parseInt(process.env.EXTERNAL_DB_PORT || '1433', 10),
  database: process.env.EXTERNAL_DB_DATABASE || 'ELABASTECEDOR',
  user: process.env.EXTERNAL_DB_USER || 'shs',
  password: process.env.EXTERNAL_DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, connectTimeout: 15000 },
};

const TABLE = process.env.EXTERNAL_USUARIOS_TABLE || 'Usuarios';
const COL_ID = process.env.EXTERNAL_USUARIOS_COL_ID || 'Codigo';
const COL_EMAIL = process.env.EXTERNAL_USUARIOS_COL_EMAIL || 'EMail';
const COL_USUARIO = process.env.EXTERNAL_USUARIOS_COL_USUARIO || 'Usuario';
const COL_PASSWORD = process.env.EXTERNAL_USUARIOS_COL_PASSWORD || 'Clave';

function latin1LowByteString(s) {
  return Buffer.from([...String(s)].map((ch) => ch.charCodeAt(0) & 0xff));
}

function charDump(s, max = 80) {
  const t = String(s ?? '');
  const slice = t.slice(0, max);
  const codes = [...slice].map((ch) => ch.charCodeAt(0));
  return { length: t.length, slicePreview: JSON.stringify(slice), firstCodes: codes.slice(0, 40) };
}

async function main() {
  const pool = await sql.connect(config);

  const meta = await pool.request().query(`
    SELECT
      c.DATA_TYPE,
      c.CHARACTER_MAXIMUM_LENGTH,
      c.COLLATION_NAME
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_NAME = N'${TABLE.replace(/'/g, "''")}'
      AND c.COLUMN_NAME = N'${COL_PASSWORD.replace(/'/g, "''")}'
  `);
  console.log('\n=== INFORMATION_SCHEMA.Clave ===');
  console.log(meta.recordset?.[0] ?? '(columna no encontrada en INFORMATION_SCHEMA)');

  const qUser = `
    SELECT TOP 1
      u.[${COL_ID}] AS Codigo,
      u.[${COL_USUARIO}] AS Usuario,
      u.[${COL_EMAIL}] AS EMail,
      u.[${COL_PASSWORD}] AS ClaveRaw,
      CAST(u.[${COL_PASSWORD}] AS NVARCHAR(MAX)) AS ClaveAsNvarchar,
      TRY_CAST(u.[${COL_PASSWORD}] AS VARBINARY(MAX)) AS ClaveAsVarbinaryTry,
      SQL_VARIANT_PROPERTY(u.[${COL_PASSWORD}], 'BaseType') AS ClaveBaseType,
      DATALENGTH(u.[${COL_PASSWORD}]) AS ClaveDataLengthBytes,
      LEN(CAST(u.[${COL_PASSWORD}] AS NVARCHAR(MAX))) AS ClaveLenNvarchar
    FROM [${TABLE}] u
    WHERE LTRIM(RTRIM(CAST(u.[${COL_ID}] AS NVARCHAR(40)))) = @codigo
       OR LOWER(LTRIM(RTRIM(CAST(u.[${COL_USUARIO}] AS NVARCHAR(255))))) = LOWER(LTRIM(RTRIM(@codigo)))
  `;
  const row = (await pool.request()
    .input('codigo', sql.NVarChar(40), CODIGO)
    .query(qUser)).recordset?.[0];

  if (!row) {
    console.log(`\nNo se encontró usuario con Codigo/Usuario = ${CODIGO}`);
    await pool.close();
    process.exit(1);
  }

  const claveRaw = row.ClaveRaw;
  const asNvarchar = row.ClaveAsNvarchar == null ? '' : String(row.ClaveAsNvarchar);

  console.log('\n=== Fila usuario ===');
  console.log({
    Codigo: row.Codigo,
    Usuario: row.Usuario,
    EMail: row.EMail,
    ClaveBaseType: row.ClaveBaseType,
    ClaveDataLengthBytes: row.ClaveDataLengthBytes,
    ClaveLenNvarchar: row.ClaveLenNvarchar,
  });
  console.log('ClaveRaw (tipo JS):', claveRaw?.constructor?.name ?? typeof claveRaw);
  console.log('charDump( CAST AS NVARCHAR ):', charDump(asNvarchar));

  if (Buffer.isBuffer(claveRaw)) {
    console.log('ClaveRaw hex (primeros 64):', claveRaw.subarray(0, 64).toString('hex'));
  }

  const pwdChecks = await pool.request()
    .input('pwd', sql.NVarChar(4000), PLAIN)
    .input('storedNv', sql.NVarChar(sql.MAX), asNvarchar)
    .query(`
      SELECT
        CASE WHEN @pwd = @storedNv THEN 1 ELSE 0 END AS eq_plain,
        CASE WHEN LOWER(@pwd) = LOWER(LTRIM(RTRIM(@storedNv))) THEN 1 ELSE 0 END AS eq_lower_trim,
        CASE WHEN @pwd = LTRIM(RTRIM(@storedNv)) THEN 1 ELSE 0 END AS eq_trim_pwd,
        CAST(PWDCOMPARE(@pwd, CONVERT(VARBINARY(MAX), @storedNv)) AS INT) AS pwdCompare_nvarchar_to_bin,
        CAST(PWDCOMPARE(@pwd, CAST(@storedNv AS VARBINARY(MAX))) AS INT) AS pwdCompare_cast_chain
    `);
  console.log('\n=== Comparaciones en SQL (contraseña de prueba en variable @pwd) ===');
  console.log(pwdChecks.recordset?.[0]);

  const buf = latin1LowByteString(asNvarchar);
  const pc = await pool.request()
    .input('pwd', sql.NVarChar(4000), PLAIN)
    .input('h', sql.VarBinary, buf.length ? buf : Buffer.alloc(1))
    .query('SELECT CAST(PWDCOMPARE(@pwd, @h) AS INT) AS pwdCompare_nodeLatin1Bytes');
  console.log('PWDCOMPARE(@pwd, latin1-low-byte desde Node):', pc.recordset?.[0]);

  const md5hex = crypto.createHash('md5').update(PLAIN, 'utf8').digest('hex');
  console.log('\n=== Node (sin SQL) ===');
  console.log('MD5(utf8) hex:', md5hex);
  console.log('plain === stored (trim):', PLAIN === asNvarchar.trim());
  console.log('plain lower === stored trim lower:', PLAIN.toLowerCase() === asNvarchar.trim().toLowerCase());

  const normalized = normalizeSqlPasswordColumnValue(claveRaw);
  console.log('\n=== normalizeSqlPasswordColumnValue(ClaveRaw) ===');
  console.log(charDump(normalized));
  const okAuto = await verifyUsuarioPassword(PLAIN, normalized, 'auto');
  console.log('verifyUsuarioPassword(PLAIN, normalized, auto):', okAuto);

  const encLegacy = encodeElabLegacyClave(PLAIN);
  console.log('\n=== Cifrado legado ELAB (+15/-17 por bloques letras; dígitos +15) ===');
  console.log('encodeElabLegacyClave(PLAIN):', JSON.stringify(encLegacy));
  console.log('coincide con CAST Clave AS NVARCHAR:', encLegacy === asNvarchar.trim());
  console.log('verifyElabLegacyClave:', verifyElabLegacyClave(PLAIN, claveRaw));

  console.log('\n=== Resumen ===');
  if (pwdChecks.recordset?.[0]?.eq_plain === 1 || pwdChecks.recordset?.[0]?.eq_lower_trim === 1) {
    console.log('La Clave coincide como texto (con o sin mayúsculas / trim). El login debería usar modo plain o sql_plain_equal.');
  } else if (pwdChecks.recordset?.[0]?.pwdCompare_nvarchar_to_bin === 1 || pc.recordset?.[0]?.pwdCompare_nodeLatin1Bytes === 1) {
    console.log('Coincide vía PWDCOMPARE (hash motor SQL).');
  } else if (verifyElabLegacyClave(PLAIN, claveRaw)) {
    console.log('Coincide con cifrado legado ELAB (columna Clave NVARCHAR). El modo auto ya incluye elab_legacy.');
  } else {
    console.log('No hubo coincidencia clara con', PLAIN, '— revisá el valor real en la BD o probá otro usuario.');
  }

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
