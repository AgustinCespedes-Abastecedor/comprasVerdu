import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePasswordForLogin } from './validation.js';

describe('validatePasswordForLogin', () => {
  it('ELAB: acepta contraseña de menos de 8 caracteres', () => {
    const r = validatePasswordForLogin('abc123', { externalAuth: true });
    assert.equal(r.ok, true);
  });

  it('local: exige 8 caracteres', () => {
    const r = validatePasswordForLogin('abc123', { externalAuth: false });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'too_short');
  });
});
