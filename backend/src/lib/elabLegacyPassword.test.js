import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeElabLegacyClave, verifyElabLegacyClave } from './elabLegacyPassword.js';

describe('elabLegacyPassword (Clave NVARCHAR legada ELAB)', () => {
  it('Sinergia2025 → valor observado en SQL para usuario 2558', () => {
    assert.equal(encodeElabLegacyClave('Sinergia2025'), 'bX]TaVXPA?AD');
    assert.equal(verifyElabLegacyClave('Sinergia2025', 'bX]TaVXPA?AD'), true);
    assert.equal(verifyElabLegacyClave('mal', 'bX]TaVXPA?AD'), false);
  });

  it('bloques de letras separados por dígitos reinician primera letra +15', () => {
    const enc = encodeElabLegacyClave('Ab12Cd');
    assert.equal(enc.length, 6);
    assert.equal(verifyElabLegacyClave('Ab12Cd', enc), true);
  });
});
