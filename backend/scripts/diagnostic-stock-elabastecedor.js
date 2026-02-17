/**
 * Diagnóstico de la tabla Stock en ELABASTECEDOR (SQL Server).
 * Ejecutar desde la raíz del backend: node scripts/diagnostic-stock-elabastecedor.js
 * Requiere .env con EXTERNAL_DB_* (o usa defaults).
 *
 * Hace:
 * 1) Lista tablas que contienen "Stock" o "stock"
 * 2) Columnas de la tabla Stock (nombre, tipo)
 * 3) Muestra 15 filas de ejemplo
 * 4) Prueba la consulta de stock para un código de ejemplo (3065)
 */
import 'dotenv/config';
import { getSqlServerPool } from '../src/lib/sqlserver.js';

const TABLE_STOCK = process.env.EXTERNAL_STOCK_TABLE || 'Stock';
const COL_STOCK_SUCURSAL = process.env.EXTERNAL_STOCK_SUCURSAL || 'sucursal';
const COL_STOCK_CODIGO = process.env.EXTERNAL_STOCK_CODIGO || 'codigo';
const COL_STOCK_STOCK = process.env.EXTERNAL_STOCK_STOCK || 'stock';

async function main() {
  console.log('=== Diagnóstico Stock ELABASTECEDOR ===\n');
  console.log('Variables de entorno:', {
    TABLE_STOCK,
    COL_STOCK_SUCURSAL,
    COL_STOCK_CODIGO,
    COL_STOCK_STOCK,
  });
  console.log('');

  let pool;
  try {
    pool = await getSqlServerPool();
    const request = pool.request();

    // 1) Tablas que contienen Stock
    console.log('--- 1) Tablas con nombre como "Stock" ---');
    const tablesResult = await request.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Stock%' OR TABLE_NAME LIKE '%stock%'
      ORDER BY TABLE_NAME
    `);
    console.log(tablesResult.recordset || []);
    if (!(tablesResult.recordset?.length)) {
      console.log('(No se encontraron tablas con "Stock" en el nombre)\n');
    } else {
      console.log('');
    }

    // 2) Columnas de la tabla Stock
    console.log('--- 2) Columnas de la tabla [' + TABLE_STOCK + '] ---');
    const colsResult = await request.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${TABLE_STOCK.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION
    `);
    const cols = colsResult.recordset || [];
    if (cols.length === 0) {
      console.log('(La tabla no existe o no tiene columnas listadas. Revisá EXTERNAL_STOCK_TABLE.)');
    } else {
      cols.forEach((c) => console.log(`  ${c.COLUMN_NAME}: ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH != null ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ''} nullable=${c.IS_NULLABLE}`));
    }
    console.log('');

    // 3) 15 filas de ejemplo (todas las columnas)
    console.log('--- 3) 15 filas de ejemplo de [' + TABLE_STOCK + '] ---');
    try {
      const sampleResult = await request.query(`SELECT TOP 15 * FROM [${TABLE_STOCK}]`);
      const rows = sampleResult.recordset || [];
      console.log('Filas:', rows.length);
      if (rows.length > 0) {
        console.log('Columnas:', Object.keys(rows[0]).join(', '));
        rows.forEach((r, i) => console.log(`  ${i + 1}:`, JSON.stringify(r)));
      }
    } catch (e) {
      console.log('Error al leer tabla:', e.message);
    }
    console.log('');

    // 4) Filas de Stock para un código de ejemplo (ej. 3065)
    const codigoEjemplo = process.argv[2] || '3065';
    console.log('--- 4) Filas de [' + TABLE_STOCK + '] para código:', codigoEjemplo, '---');
    const normalizedCodigo = `REPLACE(REPLACE(LTRIM(RTRIM(CAST(s.[${COL_STOCK_CODIGO}] AS VARCHAR(50)))), '.', ''), ',', '')`;
    const sqlDetail = [
      `SELECT s.[${COL_STOCK_SUCURSAL}] AS sucursal, s.[${COL_STOCK_CODIGO}] AS codigo, s.[${COL_STOCK_STOCK}] AS stock`,
      `FROM [${TABLE_STOCK}] s`,
      `WHERE ${normalizedCodigo} = '${String(codigoEjemplo).replace(/'/g, "''")}'`,
    ].join(' ');
    try {
      const stockDetailResult = await request.query(sqlDetail);
      const detailRows = stockDetailResult.recordset || [];
      console.log('Filas por sucursal:', detailRows.length);
      detailRows.forEach((r, i) => console.log(`  ${i + 1}:`, r));
      if (detailRows.length === 0) {
        console.log('  (No hay filas. Revisá: EXTERNAL_STOCK_TABLE, EXTERNAL_STOCK_CODIGO, o que el código exista en Stock.)');
      }
    } catch (e) {
      console.log('Error:', e.message);
    }

    // 5) Misma consulta que la API (SUM por sucursales y CD)
    console.log('--- 5) Resultado agregado (como lo usa la API) para código:', codigoEjemplo, '---');
    const SUCURSALES_LISTA = [1, 28, 32, 34, 35, 36, 37, 38, 39, 41, 43];
    const sucursalesInClause = SUCURSALES_LISTA.join(', ');
    const SUCURSAL_CD = 2;
    const stockExpr = `ISNULL(TRY_CAST(s.[${COL_STOCK_STOCK}] AS DECIMAL(18,2)), 0)`;
    const sqlSum = [
      `SELECT`,
      `  ${normalizedCodigo} AS codigo,`,
      `  SUM(CASE WHEN s.[${COL_STOCK_SUCURSAL}] IN (${sucursalesInClause}) THEN ${stockExpr} ELSE 0 END) AS stockSucursales,`,
      `  SUM(CASE WHEN s.[${COL_STOCK_SUCURSAL}] = ${SUCURSAL_CD} THEN ${stockExpr} ELSE 0 END) AS stockCD`,
      `FROM [${TABLE_STOCK}] s`,
      `WHERE ${normalizedCodigo} = '${String(codigoEjemplo).replace(/'/g, "''")}'`,
      `GROUP BY ${normalizedCodigo}`,
    ].join(' ');
    try {
      const sumResult = await request.query(sqlSum);
      const sumRows = sumResult.recordset || [];
      console.log(sumRows.length ? sumRows[0] : '(sin filas)');
    } catch (e) {
      console.log('Error:', e.message);
    }
  } finally {
    if (pool) await pool.close();
  }
  console.log('\n=== Fin diagnóstico ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
