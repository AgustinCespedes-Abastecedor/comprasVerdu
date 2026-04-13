import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyUsuarioPassword } from './usuariosSqlServer.js';

describe('verifyUsuarioPassword modo plain', () => {
  it('acepta contraseña con espacios al final (trimEnd)', async () => {
    assert.equal(await verifyUsuarioPassword('Secreto2025  ', 'Secreto2025', 'plain'), true);
  });

  it('acepta valor almacenado con espacios (trim en almacenado)', async () => {
    assert.equal(await verifyUsuarioPassword('x', '  x  ', 'plain'), true);
  });

  it('rechaza contraseña incorrecta', async () => {
    assert.equal(await verifyUsuarioPassword('mal', 'bien', 'plain'), false);
  });
});
