/**
 * Integración con SQL Server (ELABASTECEDOR). Requiere EXTERNAL_DB_* en .env y red al servidor.
 * Ejecutar: RUN_SQL_USUARIOS_INTEG=1 npm run test:sql-usuarios
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import {
  fetchUsuarioExternoPorLogin,
  verifyUsuarioPassword,
} from './usuariosSqlServer.js';

const RUN = process.env.RUN_SQL_USUARIOS_INTEG === '1' || process.env.RUN_SQL_USUARIOS_INTEG === 'true';

if (!RUN) {
  it.skip('integración Usuarios SQL (definí RUN_SQL_USUARIOS_INTEG=1 para ejecutar)', () => {});
} else {
  describe('Usuarios ELABASTECEDOR (integración)', () => {
    before(async () => {
      if (!process.env.EXTERNAL_DB_SERVER) {
        throw new Error('Falta EXTERNAL_DB_SERVER');
      }
    });

    it('encuentra por Usuario 2558', async () => {
      const row = await fetchUsuarioExternoPorLogin('2558');
      assert.ok(row);
      assert.equal(row.loginUsuario, '2558');
      assert.match(row.loginMail, /cespedes/i);
    });

    it('encuentra por EMail a.cespedes@elabastecedor.com.ar', async () => {
      const row = await fetchUsuarioExternoPorLogin('a.cespedes@elabastecedor.com.ar');
      assert.ok(row);
      assert.equal(row.loginUsuario, '2558');
    });

    it('encuentra por Codigo 2546', async () => {
      const row = await fetchUsuarioExternoPorLogin('2546');
      assert.ok(row);
      assert.equal(row.externUserId, '2546');
    });

    it('valida contraseña Sinergia2025 (Clave en texto plano en SQL)', async () => {
      const row = await fetchUsuarioExternoPorLogin('2558');
      assert.ok(row);
      const ok = await verifyUsuarioPassword('Sinergia2025', row.passwordStored, 'plain');
      assert.ok(
        ok,
        'Si falla: ejecutá UPDATE Usuarios SET Clave = N\'Sinergia2025\' WHERE Codigo = 2546 '
          + '(la Clave legacy no coincide con hash estándar; ver scripts/analyze-cespedes-password.js).',
      );
    });
  });
}
