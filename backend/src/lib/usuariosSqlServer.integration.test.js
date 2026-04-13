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

    it('login 2558 resuelve fila (externUserId = Codigo, puede ≠ 2558 si Usuario es 2558)', async () => {
      const row = await fetchUsuarioExternoPorLogin('2558');
      assert.ok(row);
      assert.ok(row.externUserId);
      assert.equal(row.loginUsuario, '2558');
    });

    it('valida contraseña Sinergia2025 (modo auto: plain + SQL + hashes)', async () => {
      const row = await fetchUsuarioExternoPorLogin('2558');
      assert.ok(row);
      const ok = await verifyUsuarioPassword('Sinergia2025', row.passwordStored, 'auto');
      assert.ok(
        ok,
        'Si falla: UPDATE Usuarios SET Clave = N\'Sinergia2025\' WHERE Codigo = 2558 '
          + 'y ejecutá: cd backend && node scripts/analyze-usuario-2558-clave.js',
      );
    });
  });
}
