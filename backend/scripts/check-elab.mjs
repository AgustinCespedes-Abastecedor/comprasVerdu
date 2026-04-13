/**
 * Verifica conectividad: PostgreSQL (Prisma) y SQL Server ELABASTECEDOR + tabla Usuarios.
 * Uso: cd backend && npm run check:elab
 * No modifica datos; solo lectura / SELECT 1.
 */
import 'dotenv/config';
import sql from 'mssql';
import { PrismaClient } from '@prisma/client';

const USUARIOS_TABLE = process.env.EXTERNAL_USUARIOS_TABLE || 'Usuarios';

/** Solo identificadores seguros para nombres de tabla dbo. */
function assertSafeTableName(name) {
  const s = String(name ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(`EXTERNAL_USUARIOS_TABLE inválido: ${name}`);
  }
  return s;
}

async function checkPostgres() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const roleCount = await prisma.role.count();
    const userCount = await prisma.user.count();
    console.log(`[PostgreSQL] OK — roles: ${roleCount}, usuarios sincronizados en app: ${userCount}`);
    return true;
  } catch (e) {
    console.error('[PostgreSQL] ERROR:', e?.message ?? e);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkSqlServer() {
  const table = assertSafeTableName(USUARIOS_TABLE);
  const config = {
    server: process.env.EXTERNAL_DB_SERVER || '192.168.1.200',
    port: parseInt(process.env.EXTERNAL_DB_PORT || '1433', 10),
    database: process.env.EXTERNAL_DB_DATABASE || 'ELABASTECEDOR',
    user: process.env.EXTERNAL_DB_USER || 'shs',
    password: process.env.EXTERNAL_DB_PASSWORD ?? '',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 15000,
      requestTimeout: 20000,
    },
  };

  let pool;
  try {
    pool = await sql.connect(config);
    const r = await pool.request()
      .input('t', sql.NVarChar(128), table)
      .query(`
        SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t
      `);
    if (!r.recordset?.length) {
      console.error(`[SQL Server] ERROR: no existe dbo.${table}`);
      return false;
    }

    const cnt = await pool.request().query(`SELECT COUNT_BIG(*) AS c FROM [dbo].[${table}]`);
    const total = cnt.recordset?.[0]?.c ?? '?';
    console.log(
      `[SQL Server] OK — ${config.server}:${config.port} / ${config.database} — dbo.${table}: ${total} filas`
    );
    return true;
  } catch (e) {
    console.error('[SQL Server] ERROR:', e?.message ?? e);
    return false;
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {
        /* noop */
      }
    }
  }
}

async function main() {
  console.log('=== Compras Verdu — check:elab ===\n');

  const ext = process.env.EXTERNAL_AUTH_LOGIN;
  const extOn = ext === 'true' || ext === '1' || ext === 'yes';
  console.log(`EXTERNAL_AUTH_LOGIN=${ext ?? '(vacío)'} → ${extOn ? 'login vía ELABASTECEDOR' : 'login local/registro (Postgres)'}\n`);

  const pgOk = await checkPostgres();
  const sqlOk = await checkSqlServer();

  if (extOn && !sqlOk) {
    console.error('\nCon EXTERNAL_AUTH_LOGIN activo, SQL Server debe ser accesible.');
  }
  if (!pgOk || !sqlOk) {
    process.exit(1);
  }
  console.log('\nListo: conexiones verificadas. Iniciá el API con npm run dev.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
