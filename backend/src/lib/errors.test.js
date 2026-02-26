import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendError, apiError, MSG } from './errors.js';

test('MSG exporta códigos de mensaje', () => {
  assert.ok(MSG);
  assert.strictEqual(typeof MSG.AUTH_CREDENCIALES, 'string');
});

test('apiError crea error con code y status', () => {
  const err = apiError('Test', 'TEST_001', 400);
  assert.ok(err instanceof Error);
  assert.strictEqual(err.message, 'Test');
  assert.strictEqual(err.code, 'TEST_001');
  assert.strictEqual(err.status, 400);
});

test('sendError es una función', () => {
  assert.strictEqual(typeof sendError, 'function');
});
