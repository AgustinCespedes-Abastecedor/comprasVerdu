/**
 * Analiza Clave vs Sinergia2025 para el usuario cespedes (SQL Server).
 * Uso: cd backend && node scripts/analyze-cespedes-password.js
 */
import 'dotenv/config';
import crypto from 'crypto';
import sql from 'mssql';

const config = {
  server: process.env.EXTERNAL_DB_SERVER || '192.168.1.200',
  port: parseInt(process.env.EXTERNAL_DB_PORT || '1433', 10),
  database: process.env.EXTERNAL_DB_DATABASE || 'ELABASTECEDOR',
  user: process.env.EXTERNAL_DB_USER || 'shs',
  password: process.env.EXTERNAL_DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, connectTimeout: 15000 },
};

function latin1FromNvarchar(s) {
  return Buffer.from([...String(s)].map((ch) => ch.charCodeAt(0) & 0xff));
}

async function main() {
  const pool = await sql.connect(config);
  const row = (await pool.request().query(`
    SELECT Codigo, Usuario, EMail, Clave, Nivel, Habilitado, LEN(Clave) AS clen
    FROM Usuarios
    WHERE LOWER(LTRIM(RTRIM(EMail))) = 'a.cespedes@elabastecedor.com.ar'
       OR LTRIM(RTRIM(CAST(Usuario AS NVARCHAR(50)))) = N'2558'
  `)).recordset[0];
  if (!row) {
    console.log('Usuario no encontrado');
    await pool.close();
    return;
  }
  const stored = String(row.Clave ?? '');
  const sb = latin1FromNvarchar(stored);
  const pwd = 'Sinergia2025';
  console.log('Row:', { Codigo: row.Codigo, Usuario: row.Usuario, EMail: row.EMail, Nivel: row.Nivel, Habilitado: row.Habilitado, clen: row.clen });
  console.log('Clave (string):', JSON.stringify(stored));
  console.log('Clave latin1 bytes (hex):', sb.toString('hex'), 'len', sb.length);

  const r = await pool.request()
    .input('pwd', sql.NVarChar, pwd)
    .query(`
      SELECT
        CAST(PWDCOMPARE(@pwd, SUBSTRING(PWDENCRYPT(@pwd), 1, 12)) AS INT) AS pwdCompareTrunc,
        DATALENGTH(HASHBYTES('MD5', @pwd)) AS md5len,
        DATALENGTH(HASHBYTES('SHA1', @pwd)) AS sha1len,
        DATALENGTH(HASHBYTES('SHA2_256', @pwd)) AS sha256len
    `);
  console.log('SQL meta:', r.recordset[0]);

  const h = await pool.request().input('pwd', sql.NVarChar, pwd).query(`
    SELECT HASHBYTES('MD5', @pwd) AS md5, HASHBYTES('SHA1', @pwd) AS sha1, HASHBYTES('SHA2_256', @pwd) AS sha256
  `);
  const md5 = Buffer.from(h.recordset[0].md5);
  const sha1 = Buffer.from(h.recordset[0].sha1);
  const sha256 = Buffer.from(h.recordset[0].sha256);
  const n = sb.length;
  console.log('MD5 prefix match', n, md5.subarray(0, n).equals(sb));
  console.log('SHA1 prefix match', n, sha1.subarray(0, n).equals(sb));
  console.log('SHA256 prefix match', n, sha256.subarray(0, n).equals(sb));

  for (const enc of ['utf8', 'utf16le', 'latin1']) {
    const md5b = crypto.createHash('md5').update(pwd, enc).digest();
    const sha1b = crypto.createHash('sha1').update(pwd, enc).digest();
    console.log(`node md5/sha1 enc=${enc}`, md5b.subarray(0, n).equals(sb), sha1b.subarray(0, n).equals(sb));
  }

  const plainEq = stored === pwd || stored.trim().toLowerCase() === pwd.toLowerCase();
  console.log('plain equal:', plainEq);

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
