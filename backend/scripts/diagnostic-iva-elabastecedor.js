/**
 * Diagnóstico de TablaIVA y relación con articulos.IVA en ELABASTECEDOR (SQL Server).
 * Ejecutar desde la raíz del backend: node scripts/diagnostic-iva-elabastecedor.js
 *
 * TablaIVA: Codigo, Porcentaje (ej. 21.000 = 21%, 10.5000 = 10.5%).
 * articulos.IVA contiene el Codigo que referencia TablaIVA.
 * El costo con IVA se calcula: costo * (1 + Porcentaje/100).
 */
import 'dotenv/config';
import { getSqlServerPool, closeSqlServer } from '../src/lib/sqlserver.js';

const TABLE_IVA = process.env.EXTERNAL_IVA_TABLE || 'TablaIVA';
const COL_IVA_CODIGO = process.env.EXTERNAL_IVA_CODIGO || 'Codigo';
const COL_IVA_PORCENTAJE = process.env.EXTERNAL_IVA_PORCENTAJE || 'Porcentaje';
const TABLE_ARTICULOS = process.env.EXTERNAL_ARTICULOS_TABLE || 'articulos';
const COL_ARTICULOS_IVA = process.env.EXTERNAL_ARTICULOS_IVA || 'IVA';
const COL_ARTICULOS_CODIGO = process.env.EXTERNAL_ARTICULOS_CODIGO || 'codigo';
const COL_ARTICULOS_PRECIO_COSTO = process.env.EXTERNAL_ARTICULOS_PRECIO_COSTO || 'PrecioCosto';

async function main() {
  console.log('=== Diagnóstico TablaIVA y articulos.IVA (ELABASTECEDOR) ===\n');
  console.log('Variables:', {
    TABLE_IVA,
    COL_IVA_CODIGO,
    COL_IVA_PORCENTAJE,
    COL_ARTICULOS_IVA,
  });
  console.log('');

  let pool;
  try {
    pool = await getSqlServerPool();
    const request = pool.request();

    // 1) Tablas que contienen IVA
    console.log('--- 1) Tablas con "IVA" en el nombre ---');
    const tablesResult = await request.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%IVA%' OR TABLE_NAME LIKE '%iva%'
      ORDER BY TABLE_NAME
    `);
    console.log(tablesResult.recordset || []);
    console.log('');

    // 2) Columnas de TablaIVA
    console.log('--- 2) Columnas de TablaIVA ---');
    try {
      const colsResult = await request.query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${TABLE_IVA}'
        ORDER BY ORDINAL_POSITION
      `);
      console.log(colsResult.recordset || []);
    } catch (e) {
      console.log('Error:', e.message, '(¿existe la tabla?)');
    }
    console.log('');

    // 3) Contenido de TablaIVA
    console.log('--- 3) Contenido de TablaIVA ---');
    try {
      const ivaResult = await request.query(`
        SELECT [${COL_IVA_CODIGO}] AS Codigo, [${COL_IVA_PORCENTAJE}] AS Porcentaje
        FROM [${TABLE_IVA}]
        ORDER BY [${COL_IVA_CODIGO}]
      `);
      const rows = ivaResult.recordset || [];
      rows.forEach((r) => {
        const pct = Number(r.Porcentaje);
        console.log(`  Codigo ${r.Codigo} → Porcentaje ${r.Porcentaje} (= ${pct}%)`);
      });
      if (rows.length === 0) console.log('  (sin filas)');
    } catch (e) {
      console.log('Error:', e.message);
    }
    console.log('');

    // 4) Columna IVA en articulos
    console.log('--- 4) Columna IVA en articulos ---');
    try {
      const artColResult = await request.query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${TABLE_ARTICULOS}' AND COLUMN_NAME = '${COL_ARTICULOS_IVA}'
      `);
      console.log(artColResult.recordset || []);
    } catch (e) {
      console.log('Error:', e.message);
    }
    console.log('');

    // 5) Muestra: articulos con costo + IVA aplicado (JOIN)
    console.log('--- 5) Ejemplo: 5 artículos con PrecioCosto e IVA (costo con IVA) ---');
    try {
      const sampleResult = await request.query(`
        SELECT
          REPLACE(REPLACE(LTRIM(RTRIM(CAST(a.[${COL_ARTICULOS_CODIGO}] AS VARCHAR(50)))), '.', ''), ',', '') AS codigo,
          ISNULL(TRY_CAST(a.[${COL_ARTICULOS_PRECIO_COSTO}] AS DECIMAL(18,2)), 0) AS costoBase,
          a.[${COL_ARTICULOS_IVA}] AS ivaCodigo,
          ISNULL(TRY_CAST(i.[${COL_IVA_PORCENTAJE}] AS DECIMAL(10,4)), 0) AS ivaPorcentaje,
          (ISNULL(TRY_CAST(a.[${COL_ARTICULOS_PRECIO_COSTO}] AS DECIMAL(18,2)), 0) * (1 + ISNULL(TRY_CAST(i.[${COL_IVA_PORCENTAJE}] AS DECIMAL(10,4)), 0) / 100)) AS costoConIva
        FROM [${TABLE_ARTICULOS}] a
        LEFT JOIN [${TABLE_IVA}] i ON i.[${COL_IVA_CODIGO}] = a.[${COL_ARTICULOS_IVA}]
        WHERE a.[${COL_ARTICULOS_PRECIO_COSTO}] IS NOT NULL AND ISNULL(TRY_CAST(a.[${COL_ARTICULOS_PRECIO_COSTO}] AS DECIMAL(18,2)), 0) > 0
        ORDER BY a.[${COL_ARTICULOS_CODIGO}]
        OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
      `);
      const rows = sampleResult.recordset || [];
      rows.forEach((r) => {
        console.log(`  ${r.codigo}: costo base ${r.costoBase}, IVA cod=${r.ivaCodigo} (${r.ivaPorcentaje}%) → costo con IVA ${Number(r.costoConIva).toFixed(2)}`);
      });
      if (rows.length === 0) console.log('  (sin filas con costo > 0)');
    } catch (e) {
      console.log('Error:', e.message);
    }

    console.log('\n=== Fin diagnóstico ===');
  } catch (e) {
    console.error('Error general:', e.message);
  } finally {
    await closeSqlServer();
  }
}

main();
