import sql from 'mssql';

const config = {
  server: process.env.EXTERNAL_DB_SERVER || '192.168.1.200',
  port: parseInt(process.env.EXTERNAL_DB_PORT || '1433', 10),
  database: process.env.EXTERNAL_DB_DATABASE || 'ELABASTECEDOR',
  user: process.env.EXTERNAL_DB_USER || 'shs',
  password: process.env.EXTERNAL_DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 10000,
    requestTimeout: 15000,
  },
};

const TABLE = process.env.EXTERNAL_PROVEEDORES_TABLE || 'proveedores';
const COL_PROVEEDORES_PK = process.env.EXTERNAL_PROVEEDORES_PK || 'Id'; // PK en SQL Server (por si articulos.proveedor lo usa)
const COL_ID = process.env.EXTERNAL_PROVEEDORES_ID || 'codigo';
const COL_NOMBRE = process.env.EXTERNAL_PROVEEDORES_NOMBRE || 'Nombre';

const TABLE_ARTICULOS = process.env.EXTERNAL_ARTICULOS_TABLE || 'articulos';
const COL_ARTICULOS_CODIGO = process.env.EXTERNAL_ARTICULOS_CODIGO || 'codigo';
const COL_ARTICULOS_DESCRIPCION = process.env.EXTERNAL_ARTICULOS_DESCRIPCION || 'descripcion';
const COL_ARTICULOS_HABILCAJAS = process.env.EXTERNAL_ARTICULOS_HABILCAJAS || 'habilcajas';
const COL_ARTICULOS_DEPARTAMENTO = process.env.EXTERNAL_ARTICULOS_DEPARTAMENTO || 'departamento';
const COL_ARTICULOS_PROVEEDOR = process.env.EXTERNAL_ARTICULOS_PROVEEDOR || 'proveedor';
const COL_ARTICULOS_PRECIO_COSTO = process.env.EXTERNAL_ARTICULOS_PRECIO_COSTO || 'PrecioCosto';
const COL_ARTICULOS_PRECIO_VENTA = process.env.EXTERNAL_ARTICULOS_PRECIO_VENTA || 'PrecioVenta';
const COL_ARTICULOS_MARGEN = process.env.EXTERNAL_ARTICULOS_MARGEN || 'Margen';
const COL_ARTICULOS_IVA = process.env.EXTERNAL_ARTICULOS_IVA || 'IVA';
const ARTICULOS_DEPARTAMENTO_ID = process.env.EXTERNAL_ARTICULOS_DEPARTAMENTO_ID ?? '6';

/** Tabla IVA en ELABASTECEDOR: Codigo (ej. 1, 2), Porcentaje (ej. 21.000 = 21%, 10.5000 = 10.5%) */
const TABLE_IVA = process.env.EXTERNAL_IVA_TABLE || 'TablaIVA';
const COL_IVA_CODIGO = process.env.EXTERNAL_IVA_CODIGO || 'Codigo';
const COL_IVA_PORCENTAJE = process.env.EXTERNAL_IVA_PORCENTAJE || 'Porcentaje';

const TABLE_STOCK = process.env.EXTERNAL_STOCK_TABLE || 'Stock';
const COL_STOCK_SUCURSAL = process.env.EXTERNAL_STOCK_SUCURSAL || 'sucursal';
const COL_STOCK_CODIGO = process.env.EXTERNAL_STOCK_CODIGO || 'codigo';
const COL_STOCK_STOCK = process.env.EXTERNAL_STOCK_STOCK || 'stock';
/** Sucursales que suman para la columna "Sucursal": 1 Fragio, 28, 32, 34, 35, 36, 37, 38, 39, 41, 43 (excl. 30 Alem) */
const SUCURSALES_LISTA = [1, 28, 32, 34, 35, 36, 37, 38, 39, 41, 43];
/** Sucursal que representa CD: 2 (no se suman ventas de CD) */
const SUCURSAL_CD = 2;

/** Tabla de ventas por artículo: FECHA, SUCURSAL, CODIGO, CANTIDAD, IMPORTE (venta), COSTO */
const TABLE_VTA = process.env.EXTERNAL_VTA_TABLE || 'VTAARTICULOS';
const COL_VTA_FECHA = process.env.EXTERNAL_VTA_FECHA || 'FECHA';
const COL_VTA_SUCURSAL = process.env.EXTERNAL_VTA_SUCURSAL || 'SUCURSAL';
const COL_VTA_CODIGO = process.env.EXTERNAL_VTA_CODIGO || 'CODIGO';
const COL_VTA_CANTIDAD = process.env.EXTERNAL_VTA_CANTIDAD || 'CANTIDAD';
const COL_VTA_IMPORTE = process.env.EXTERNAL_VTA_IMPORTE || 'IMPORTE';
const COL_VTA_COSTO = process.env.EXTERNAL_VTA_COSTO || 'COSTO';
/** Sucursales para sumar ventas = mismas que stock (excl. CD): 1, 28, 32, 34, 35, 36, 37, 38, 39, 41, 43 */
const SUCURSALES_VENTAS = SUCURSALES_LISTA;

let pool = null;

export async function getSqlServerPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

export async function closeSqlServer() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

/**
 * Obtiene la lista de proveedores desde la base SQL Server externa.
 * Retorna [] si falla la conexión o la tabla/columnas no existen.
 */
export async function fetchProveedoresExternos() {
  try {
    const pool = await getSqlServerPool();
    const request = pool.request();
    const result = await request.query(
      `SELECT [${COL_PROVEEDORES_PK}] AS pk, [${COL_ID}] AS id, [${COL_NOMBRE}] AS nombre FROM [${TABLE}] WHERE [${COL_NOMBRE}] IS NOT NULL ORDER BY [${COL_NOMBRE}]`
    );
    return (result.recordset || []).map((row) => ({
      pk: row.pk != null ? String(row.pk) : '',
      id: String(row.id ?? '').trim(),
      nombre: String(row.nombre ?? '').trim(),
    })).filter((p) => p.nombre.length > 0 && (p.id !== '' || p.pk !== ''));
  } catch (e) {
    console.error('SQL Server (proveedores):', e.message);
    return [];
  }
}

/**
 * Normaliza código para comparación: quita puntos, comas y ceros a la izquierda (ej: "5.053" -> "5053", "005053" -> "5053").
 * En ELABASTECEDOR los números pueden aparecer con formato de miles y con ceros a la izquierda.
 * Exportada para usar al enviar códigos desde la API de productos.
 */
export function normalizarProveedorParaArticulos(val) {
  if (val == null) return '';
  const s = String(val).replace(/[.,]/g, '').trim();
  const sinCeros = s.replace(/^0+/, '') || '0';
  return sinCeros;
}

/**
 * Obtiene la lista de artículos anexados al proveedor desde la base SQL Server externa.
 * Filtro: HabilCajas = 1. En ELABASTECEDOR articulos.proveedor puede ser el codigo del proveedor
 * (ej. "5.053") o el Id del proveedor; por eso se aceptan codigo e idExterno (ambos normalizados).
 * La comparación normaliza puntos y comas para que "5.053", 5053 y "5053" coincidan.
 * @param {string|null} codigoNormalizado - Código del proveedor ya normalizado (sin puntos/comas).
 * @param {string|null} idExternoNormalizado - Id del proveedor ya normalizado (por si articulos usa Id).
 * @returns {Promise<Array<{codigo:string, descripcion:string}>>}
 */
export async function fetchArticulosExternos(codigoNormalizado, idExternoNormalizado) {
  const codNorm = codigoNormalizado != null ? normalizarProveedorParaArticulos(codigoNormalizado) : '';
  const idNorm = idExternoNormalizado != null ? normalizarProveedorParaArticulos(idExternoNormalizado) : '';
  if (codNorm === '' && idNorm === '') return [];
  try {
    const pool = await getSqlServerPool();
    const request = pool.request();
    const rawCol = `LTRIM(RTRIM(CAST(a.[${COL_ARTICULOS_PROVEEDOR}] AS VARCHAR(20))))`;
    const normalizedCol = `REPLACE(REPLACE(${rawCol}, '.', ''), ',', '')`;
    const conditions = [];
    if (codNorm !== '') {
      request.input('codigoNorm', sql.VarChar(20), codNorm);
      conditions.push(`(${normalizedCol} = @codigoNorm OR (TRY_CAST(${normalizedCol} AS BIGINT) = TRY_CAST(@codigoNorm AS BIGINT) AND TRY_CAST(@codigoNorm AS BIGINT) IS NOT NULL))`);
    }
    if (idNorm !== '' && idNorm !== codNorm) {
      request.input('idExternoNorm', sql.VarChar(20), idNorm);
      conditions.push(`(${normalizedCol} = @idExternoNorm OR (TRY_CAST(${normalizedCol} AS BIGINT) = TRY_CAST(@idExternoNorm AS BIGINT) AND TRY_CAST(@idExternoNorm AS BIGINT) IS NOT NULL))`);
    }
    const whereProveedor = conditions.length ? `AND (${conditions.join(' OR ')})` : '';

    const sqlQuery = [
      `SELECT a.[${COL_ARTICULOS_CODIGO}] AS codigo, a.[${COL_ARTICULOS_DESCRIPCION}] AS descripcion`,
      `FROM [${TABLE_ARTICULOS}] a`,
      `WHERE a.[${COL_ARTICULOS_HABILCAJAS}] = 1`,
      `AND a.[${COL_ARTICULOS_DESCRIPCION}] IS NOT NULL`,
      whereProveedor,
      `ORDER BY a.[${COL_ARTICULOS_DESCRIPCION}]`,
    ].join(' ');

    const result = await request.query(sqlQuery);
    const list = (result.recordset || []).map((row) => ({
      codigo: String(row.codigo ?? '').trim(),
      descripcion: String(row.descripcion ?? '').trim(),
    })).filter((a) => a.codigo.length > 0);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[articulos] codigoNorm=${codNorm} idExternoNorm=${idNorm} → ${list.length} artículos`);
    }
    return list;
  } catch (e) {
    console.error('SQL Server (articulos):', e.message);
    return [];
  }
}

/**
 * Normaliza código de artículo en SQL para comparación (quitar puntos/comas y trim).
 */
function sqlNormalizarCodigoArticulos(alias = 'a') {
  const col = `[${COL_ARTICULOS_CODIGO}]`;
  return `REPLACE(REPLACE(LTRIM(RTRIM(CAST(${alias}.${col} AS VARCHAR(50)))), '.', ''), ',', '')`;
}

/**
 * Obtiene PrecioCosto (con IVA sumado), PrecioVenta y Margen desde articulos por código.
 * El costo se calcula como: costo_base * (1 + IVA%/100), usando TablaIVA (Codigo, Porcentaje)
 * y articulos.IVA como FK a TablaIVA.Codigo. Porcentaje en TablaIVA: 21.000 = 21%, 10.5000 = 10.5%.
 * @param {string[]} codigos - Códigos de artículo (se normalizan internamente).
 * @returns {Promise<Object.<string, { costo: number, precioVenta: number, margenPorc: number }>>}
 */
export async function fetchPreciosDesdeArticulos(codigos) {
  if (!Array.isArray(codigos) || codigos.length === 0) return {};
  const unicos = [...new Set(codigos.map((c) => normalizarCodigoStock(c)).filter(Boolean))];
  if (unicos.length === 0) return {};
  const map = {};
  for (const cod of unicos) map[cod] = { costo: 0, precioVenta: 0, margenPorc: 0 };
  try {
    const pool = await getSqlServerPool();
    const normCod = sqlNormalizarCodigoArticulos('a');
    const costoExpr = `ISNULL(TRY_CAST(a.[${COL_ARTICULOS_PRECIO_COSTO}] AS DECIMAL(18,2)), 0)`;
    const ventaExpr = `ISNULL(TRY_CAST(a.[${COL_ARTICULOS_PRECIO_VENTA}] AS DECIMAL(18,2)), 0)`;
    const margenExpr = `ISNULL(TRY_CAST(a.[${COL_ARTICULOS_MARGEN}] AS DECIMAL(18,2)), 0)`;
    const ivaPctExpr = `ISNULL(TRY_CAST(i.[${COL_IVA_PORCENTAJE}] AS DECIMAL(10,4)), 0)`;
    for (let i = 0; i < unicos.length; i += STOCK_BATCH_SIZE) {
      const batch = unicos.slice(i, i + STOCK_BATCH_SIZE);
      const codigosStr = batch.join(',');
      const request = pool.request();
      request.input('codigos', sql.VarChar(4000), codigosStr);
      const sqlQuery = [
        `SELECT ${normCod} AS codigo, ${costoExpr} AS costoBase, ${ivaPctExpr} AS ivaPorcentaje, ${ventaExpr} AS precioVenta, ${margenExpr} AS margenPorc`,
        `FROM [${TABLE_ARTICULOS}] a`,
        `LEFT JOIN [${TABLE_IVA}] i ON i.[${COL_IVA_CODIGO}] = a.[${COL_ARTICULOS_IVA}]`,
        `WHERE ${normCod} IN (SELECT LTRIM(RTRIM(n.value('.', 'VARCHAR(50)'))) FROM (SELECT CAST('<r>' + REPLACE(@codigos, ',', '</r><r>') + '</r>' AS XML) AS x) t CROSS APPLY x.nodes('/r') AS a(n))`,
      ].join(' ');
      const result = await request.query(sqlQuery);
      const rows = result.recordset || [];
      for (const row of rows) {
        const cod = normalizarCodigoStock(row.codigo);
        if (!cod || !(cod in map)) continue;
        const costoBase = Number(row.costoBase) || 0;
        const ivaPct = Number(row.ivaPorcentaje) || 0;
        const costoConIva = costoBase * (1 + ivaPct / 100);
        map[cod].costo = Math.round(costoConIva * 100) / 100;
        map[cod].precioVenta = Number(row.precioVenta) || 0;
        map[cod].margenPorc = Number(row.margenPorc) || 0;
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      const conDatos = Object.values(map).filter((m) => m.costo > 0 || m.precioVenta > 0 || m.margenPorc !== 0).length;
      console.log(`[articulos precios] ${unicos.length} códigos → ${conDatos} con costo+IVA/venta/margen`);
    }
    return map;
  } catch (e) {
    console.error('SQL Server (articulos precios):', e.message);
    return {};
  }
}

/** Máximo de códigos por lote para no superar 4000 caracteres en VarChar (SQL Server). */
const STOCK_BATCH_SIZE = 280;

/**
 * Normaliza código para comparación con la tabla Stock.
 * Quita espacios, puntos/comas de miles; evita que "3065.0" (decimal) se convierta en "30650".
 * Exportada para usar la misma lógica al buscar stock por producto en la API.
 */
export function normalizarCodigoStock(val) {
  if (val == null) return '';
  let s = String(val).trim().replace(/\s/g, '');
  s = s.replace(/\.0+$/, '').replace(/,0+$/, ''); // quitar decimal .0 o ,0 al final
  return s.replace(/[.,]/g, '').trim() || '0';
}

/**
 * Expresión SQL para el valor numérico de stock.
 * En ELABASTECEDOR la columna Stock es MONEY (numérica): se usa TRY_CAST a DECIMAL directamente.
 * Si en otro entorno fuera VARCHAR con "1.500"/"2,5", habría que usar REPLACE antes del CAST.
 */
function sqlExprStockNumerico(colStock) {
  return `ISNULL(TRY_CAST(s.[${colStock}] AS DECIMAL(18,2)), 0)`;
}

/**
 * Normaliza codigo en SQL para comparar con articulos (quita puntos y comas como en ELABASTECEDOR).
 */
function sqlNormalizarCodigoStock(colCodigo) {
  return `REPLACE(REPLACE(LTRIM(RTRIM(CAST(s.[${colCodigo}] AS VARCHAR(50)))), '.', ''), ',', '')`;
}

/**
 * Obtiene stock por código desde la tabla Stock.
 * - Columna "Sucursal" en la web: suma de [stock] donde sucursal IN (1, 28, 32, ...).
 * - Columna "CD" en la web: suma de [stock] donde sucursal = 2.
 * El campo stock en ELABASTECEDOR puede tener puntos/comas; se normaliza a número antes de SUM.
 * El codigo se normaliza (sin puntos/comas) para que coincida con articulos.
 */
export async function fetchStockPorCodigos(codigos) {
  if (!Array.isArray(codigos) || codigos.length === 0) return {};
  const unicos = [...new Set(codigos.map((c) => normalizarCodigoStock(c)).filter(Boolean))];
  if (unicos.length === 0) return {};
  const map = {};
  for (const cod of unicos) map[cod] = { stockSucursales: 0, stockCD: 0 };
  const sucursalesInClause = SUCURSALES_LISTA.join(', ');
  const stockNumericoExpr = sqlExprStockNumerico(COL_STOCK_STOCK);
  const normalizedCodigoExpr = sqlNormalizarCodigoStock(COL_STOCK_CODIGO);
  try {
    const pool = await getSqlServerPool();
    for (let i = 0; i < unicos.length; i += STOCK_BATCH_SIZE) {
      const batch = unicos.slice(i, i + STOCK_BATCH_SIZE);
      const codigosStr = batch.join(',');
      const request = pool.request();
      request.input('codigos', sql.VarChar(4000), codigosStr);
      const sqlQuery = [
        `SELECT`,
        `  ${normalizedCodigoExpr} AS codigo,`,
        `  SUM(CASE WHEN s.[${COL_STOCK_SUCURSAL}] IN (${sucursalesInClause}) THEN ${stockNumericoExpr} ELSE 0 END) AS stockSucursales,`,
        `  SUM(CASE WHEN s.[${COL_STOCK_SUCURSAL}] = ${SUCURSAL_CD} THEN ${stockNumericoExpr} ELSE 0 END) AS stockCD`,
        `FROM [${TABLE_STOCK}] s`,
        `WHERE ${normalizedCodigoExpr} IN (SELECT LTRIM(RTRIM(n.value('.', 'VARCHAR(50)'))) FROM (SELECT CAST('<r>' + REPLACE(@codigos, ',', '</r><r>') + '</r>' AS XML) AS x) t CROSS APPLY x.nodes('/r') AS a(n))`,
        `GROUP BY ${normalizedCodigoExpr}`,
      ].join(' ');
      const result = await request.query(sqlQuery);
      const rows = result.recordset || [];
      for (const row of rows) {
        const cod = normalizarCodigoStock(row.codigo);
        if (!cod || !(cod in map)) continue;
        map[cod].stockSucursales = Number(row.stockSucursales) || 0;
        map[cod].stockCD = Number(row.stockCD) || 0;
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      const conDatos = Object.values(map).filter((s) => s.stockSucursales > 0 || s.stockCD > 0).length;
      console.log(`[stock] ${unicos.length} códigos → ${conDatos} con stock desde SQL Server`);
    }
    return map;
  } catch (e) {
    console.error('SQL Server (Stock):', e.message);
    return {};
  }
}

/**
 * Normaliza código en SQL para VTAARTICULOS (misma lógica que stock: quitar puntos/comas y trim).
 */
function sqlNormalizarCodigoVta(alias = 'v') {
  const col = `[${COL_VTA_CODIGO}]`;
  return `REPLACE(REPLACE(LTRIM(RTRIM(CAST(${alias}.${col} AS VARCHAR(50)))), '.', ''), ',', '')`;
}

/**
 * Obtiene ventas (N-1, N-2, 7 días acumulado) desde VTAARTICULOS.
 * - N-1 = ventas (CANTIDAD) del día anterior a fechaPlanilla.
 * - N-2 = ventas de 2 días antes.
 * - 7 días = suma acumulada de ventas de los últimos 7 días (día-1 a día-7 respecto a fechaPlanilla).
 * - Sucursales: solo las de venta (SUCURSALES_LISTA), sin CD.
 * (Costo, PrecioVenta y Margen se obtienen de la tabla articulos vía fetchPreciosDesdeArticulos.)
 * @param {string[]} codigos - Códigos de artículo (se normalizan internamente).
 * @param {string} fechaPlanilla - Fecha de la planilla 'YYYY-MM-DD'.
 * @returns {Promise<Object.<string, { ventasN1: number, ventasN2: number, ventas7dias: number }>>}
 */
export async function fetchVentasYCostoDesdeVTAARTICULOS(codigos, fechaPlanilla) {
  if (!Array.isArray(codigos) || codigos.length === 0 || !fechaPlanilla || typeof fechaPlanilla !== 'string') {
    return {};
  }
  const unicos = [...new Set(codigos.map((c) => normalizarCodigoStock(c)).filter(Boolean))];
  if (unicos.length === 0) return {};
  const planillaDate = new Date(fechaPlanilla + 'T12:00:00');
  if (Number.isNaN(planillaDate.getTime())) return {};
  const d1 = new Date(planillaDate);
  d1.setUTCDate(d1.getUTCDate() - 1);
  const d2 = new Date(planillaDate);
  d2.setUTCDate(d2.getUTCDate() - 2);
  const d7Inicio = new Date(planillaDate);
  d7Inicio.setUTCDate(d7Inicio.getUTCDate() - 7);
  const fechaN1 = d1.toISOString().slice(0, 10);
  const fechaN2 = d2.toISOString().slice(0, 10);
  const fecha7dInicio = d7Inicio.toISOString().slice(0, 10);
  const fecha7dFin = fechaN1;
  const sucursalesClause = SUCURSALES_VENTAS.join(', ');
  const normCod = sqlNormalizarCodigoVta('v');
  const map = {};
  for (const cod of unicos) {
    map[cod] = {
      ventasN1: 0,
      ventasN2: 0,
      ventas7dias: 0,
    };
  }
  try {
    const pool = await getSqlServerPool();
    for (let i = 0; i < unicos.length; i += STOCK_BATCH_SIZE) {
      const batch = unicos.slice(i, i + STOCK_BATCH_SIZE);
      const codigosStr = batch.join(',');
      const request = pool.request();
      request.input('codigos', sql.VarChar(4000), codigosStr);
      request.input('fecha7dInicio', sql.Date, fecha7dInicio);
      request.input('fecha7dFin', sql.Date, fecha7dFin);
      const cantidadExpr = `ISNULL(TRY_CAST(v.[${COL_VTA_CANTIDAD}] AS DECIMAL(18,2)), 0)`;
      const sqlQuery = [
        `SELECT`,
        `  ${normCod} AS codigo,`,
        `  CAST(v.[${COL_VTA_FECHA}] AS DATE) AS fecha,`,
        `  SUM(${cantidadExpr}) AS cantidad`,
        `FROM [${TABLE_VTA}] v`,
        `WHERE CAST(v.[${COL_VTA_FECHA}] AS DATE) >= @fecha7dInicio AND CAST(v.[${COL_VTA_FECHA}] AS DATE) <= @fecha7dFin`,
        `  AND v.[${COL_VTA_SUCURSAL}] IN (${sucursalesClause})`,
        `  AND ${normCod} IN (SELECT LTRIM(RTRIM(n.value('.', 'VARCHAR(50)'))) FROM (SELECT CAST('<r>' + REPLACE(@codigos, ',', '</r><r>') + '</r>' AS XML) AS x) t CROSS APPLY x.nodes('/r') AS a(n))`,
        `GROUP BY ${normCod}, CAST(v.[${COL_VTA_FECHA}] AS DATE)`,
      ].join(' ');
      const result = await request.query(sqlQuery);
      const rows = result.recordset || [];
      for (const row of rows) {
        const cod = normalizarCodigoStock(row.codigo);
        if (!cod || !(cod in map)) continue;
        const fecha = row.fecha ? (row.fecha instanceof Date ? row.fecha.toISOString().slice(0, 10) : String(row.fecha).slice(0, 10)) : '';
        const cantidad = Number(row.cantidad) || 0;
        if (fecha === fechaN1) map[cod].ventasN1 = Math.round(cantidad);
        else if (fecha === fechaN2) map[cod].ventasN2 = Math.round(cantidad);
        map[cod].ventas7dias += cantidad;
      }
    }
    for (const cod of unicos) {
      map[cod].ventas7dias = Math.round(map[cod].ventas7dias);
    }
    if (process.env.NODE_ENV !== 'production') {
      const conDatos = Object.values(map).filter((m) => m.ventasN1 > 0 || m.ventasN2 > 0 || m.ventas7dias > 0).length;
      console.log(`[VTAARTICULOS] fecha=${fechaPlanilla} N-1=${fechaN1} N-2=${fechaN2} 7d acumulado [${fecha7dInicio}..${fecha7dFin}] → ${unicos.length} códigos, ${conDatos} con datos`);
    }
    return map;
  } catch (e) {
    console.error('SQL Server (VTAARTICULOS):', e.message);
    return {};
  }
}
