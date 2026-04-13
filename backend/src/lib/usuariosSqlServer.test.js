import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bufferClaveToComparableString,
  normalizeSqlPasswordColumnValue,
  verifyUsuarioPassword,
} from './usuariosSqlServer.js';

describe('bufferClaveToComparableString / normalizeSqlPasswordColumnValue', () => {
  it('UTF-8 ASCII en Buffer → mismo texto', () => {
    const buf = Buffer.from('Sinergia2025', 'utf8');
    assert.equal(bufferClaveToComparableString(buf), 'Sinergia2025');
    assert.equal(normalizeSqlPasswordColumnValue(buf), 'Sinergia2025');
  });

  it('UTF-16LE ASCII en Buffer → mismo texto', () => {
    const buf = Buffer.from('Ab12', 'utf16le');
    assert.equal(bufferClaveToComparableString(buf), 'Ab12');
  });

  it('string pasa sin cambios', () => {
    assert.equal(normalizeSqlPasswordColumnValue('x'), 'x');
  });
});

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

  it('modo plain: acepta Buffer UTF-8 (mismo flujo que VARBINARY texto en login)', async () => {
    const buf = Buffer.from('Sinergia2025', 'utf8');
    assert.equal(await verifyUsuarioPassword('Sinergia2025', buf, 'plain'), true);
  });
});
