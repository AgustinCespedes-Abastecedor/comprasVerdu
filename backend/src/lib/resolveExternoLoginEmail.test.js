import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrismaEmailForExternoUser } from './resolveExternoLoginEmail.js';

describe('resolvePrismaEmailForExternoUser', () => {
  it('usa el correo tecleado si es válido', () => {
    assert.equal(
      resolvePrismaEmailForExternoUser('A.Cespedes@elabastecedor.com.ar', 'otro@mail.com'),
      'a.cespedes@elabastecedor.com.ar',
    );
  });

  it('si teclea el código de usuario, usa el EMail de SQL', () => {
    assert.equal(
      resolvePrismaEmailForExternoUser('2558', 'a.cespedes@elabastecedor.com.ar'),
      'a.cespedes@elabastecedor.com.ar',
    );
  });

  it('sin correo SQL válido conserva el identificador tecleado', () => {
    assert.equal(resolvePrismaEmailForExternoUser('2558', ''), '2558');
  });
});
