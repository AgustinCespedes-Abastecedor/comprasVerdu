/**
 * Diagnóstico de la tabla VTAARTICULOS en ELABASTECEDOR (SQL Server).
 * Ejecutar desde la raíz del backend: node scripts/diagnostic-vtaarticulos.js
 * Requiere .env con EXTERNAL_DB_* (o usa defaults).
 *
 * Hace:
 * 1) Lista tablas que contienen "VTA" o "vta"
 * 2) Columnas de VTAARTICULOS (nombre, tipo)
 * 3) Muestra filas de ejemplo y rangos de FECHA
 * 4) Prueba agregado por código y fecha (N-1, N-2, 7 días) con sucursales de venta
 */
import 'dotenv/config';
import { getSqlServerPool } from '../src/lib/sqlserver.js';

const TABLE_VTA = process.env.EXTERNAL_VTA_TABLE || 'VTAARTICULOS';
const COL_VTA_FECHA = process.env.EXTERNAL_VTA_FECHA || 'FECHA';
const COL_VTA_SUCURSAL = process.env.EXTERNAL_VTA_SUCURSAL || 'SUCURSAL';
const COL_VTA_CODIGO = process.env.EXTERNAL_VTA_CODIGO || 'CODIGO';
const COL_VTA_CANTIDAD = process.env.EXTERNAL_VTA_CANTIDAD || 'CANTIDAD';
const COL_VTA_IMPORTE = process.env.EXTERNAL_VTA_IMPORTE || 'IMPORTE';
const COL_VTA_COSTO = process.env.EXTERNAL_VTA_COSTO || 'COSTO';
const SUCURSALES_VENTAS = [1, 28, 32, 34, 35, 36, 37, 38, 39, 41, 43];

async function main() {
  console.log('=== Diagnóstico VTAARTICULOS ELABASTECEDOR ===\n');
  console.log('Variables de entorno:', {
    TABLE_VTA,
    COL_VTA_FECHA,
    COL_VTA_SUCURSAL,
    COL_VTA_CODIGO,
    COL_VTA_CANTIDAD,
    COL_VTA_IMPORTE,
    COL_VTA_COSTO,
    SUCURSALES_VENTAS,
  });
  console.log('');

  let pool;
  try {
    pool = await getSqlServerPool();
    const request = pool.request();

    console.log('--- 1) Tablas con nombre como "VTA" ---');
    const tablesResult = await request.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%VTA%' OR TABLE_NAME LIKE '%vta%'
      ORDER BY TABLE_NAME
    `);
    console.log(tablesResult.recordset || []);
    console.log('');

    console.log('--- 2) Columnas de ' + TABLE_VTA + ' ---');
    const colsResult = await request.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${TABLE_VTA.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION
    `);
    console.log(colsResult.recordset || []);
    console.log('');

    console.log('--- 3) Ejemplo de filas (5) y rango de FECHA ---');
    const sampleResult = await request.query(`
      SELECT TOP 5 * FROM [${TABLE_VTA}]
      ORDER BY [${COL_VTA_FECHA}] DESC
    `);
    console.log('Últimas 5 filas:', sampleResult.recordset || []);

    const rangeResult = await request.query(`
      SELECT MIN(CAST([${COL_VTA_FECHA}] AS DATE)) AS minFecha, MAX(CAST([${COL_VTA_FECHA}] AS DATE)) AS maxFecha
      FROM [${TABLE_VTA}]
    `);
    console.log('Rango FECHA:', rangeResult.recordset?.[0] || {});
    console.log('');

    console.log('--- 4) Agregado por código y fecha (sucursales venta) - ejemplo 3 fechas ---');
    const fechaEjemplo = '2026-02-12';
    const sucClause = SUCURSALES_VENTAS.join(', ');
    const normCod = `REPLACE(REPLACE(LTRIM(RTRIM(CAST([${COL_VTA_CODIGO}] AS VARCHAR(50)))), '.', ''), ',', '')`;
    const aggResult = await request.query(`
      SELECT TOP 20
        ${normCod} AS codigo,
        CAST([${COL_VTA_FECHA}] AS DATE) AS fecha,
        SUM(ISNULL(TRY_CAST([${COL_VTA_CANTIDAD}] AS DECIMAL(18,2)), 0)) AS cantidad,
        SUM(ISNULL(TRY_CAST([${COL_VTA_COSTO}] AS DECIMAL(18,2)), 0)) AS costo_total,
        SUM(ISNULL(TRY_CAST([${COL_VTA_IMPORTE}] AS DECIMAL(18,2)), 0)) AS importe_total
      FROM [${TABLE_VTA}]
      WHERE CAST([${COL_VTA_FECHA}] AS DATE) = '${fechaEjemplo}'
        AND [${COL_VTA_SUCURSAL}] IN (${sucClause})
      GROUP BY ${normCod}, CAST([${COL_VTA_FECHA}] AS DATE)
      ORDER BY cantidad DESC
    `);
    console.log('Ejemplo fecha ' + fechaEjemplo + ' (top 20 códigos por cantidad):', aggResult.recordset || []);
    console.log('');
    console.log('Diagnóstico finalizado.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

main();
