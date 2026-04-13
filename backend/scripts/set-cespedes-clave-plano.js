/**
 * Establece Clave en texto plano para el usuario de prueba (Codigo 2546).
 * Aviso: puede afectar el login del ERP si usa la misma columna.
 * Uso: cd backend && node scripts/set-cespedes-clave-plano.js
 */
import 'dotenv/config';
import sql from 'mssql';

const pool = await sql.connect({
  server: process.env.EXTERNAL_DB_SERVER || '192.168.1.200',
  port: parseInt(process.env.EXTERNAL_DB_PORT || '1433', 10),
  database: process.env.EXTERNAL_DB_DATABASE || 'ELABASTECEDOR',
  user: process.env.EXTERNAL_DB_USER || 'shs',
  password: process.env.EXTERNAL_DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true },
});
await pool.request().query("UPDATE dbo.Usuarios SET Clave = N'Sinergia2025' WHERE Codigo = 2546");
const r = await pool.request().query('SELECT Clave FROM dbo.Usuarios WHERE Codigo = 2546');
console.log('Clave actual:', r.recordset[0]?.Clave);
await pool.close();
