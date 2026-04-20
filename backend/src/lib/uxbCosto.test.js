import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PESO_CAJON_MAX_KG,
  normalizarPesoCajonKg,
  uxbNetoParaCosto,
  recepcionUxBBrutoInvalidoVsCajon,
  costoPorUnidadDesdeBulto,
} from './uxbCosto.js';

test('uxbNetoParaCosto: 15 − 1 = 14', () => {
  assert.equal(uxbNetoParaCosto(15, 1), 14);
});

test('uxbNetoParaCosto: sin bruto → 0', () => {
  assert.equal(uxbNetoParaCosto(0, 1), 0);
  assert.equal(uxbNetoParaCosto('', 1), 0);
});

test('uxbNetoParaCosto: cajón mayor o igual al bruto → 0', () => {
  assert.equal(uxbNetoParaCosto(15, 15), 0);
  assert.equal(uxbNetoParaCosto(15, 20), 0);
});

test('recepcionUxBBrutoInvalidoVsCajon', () => {
  assert.equal(recepcionUxBBrutoInvalidoVsCajon(0, 5), false);
  assert.equal(recepcionUxBBrutoInvalidoVsCajon(15, 1), false);
  assert.equal(recepcionUxBBrutoInvalidoVsCajon(15, 15), true);
  assert.equal(recepcionUxBBrutoInvalidoVsCajon(1, 2), true);
});

test('costoPorUnidadDesdeBulto: 140 / 14 = 10', () => {
  assert.equal(costoPorUnidadDesdeBulto(140, 15, 1), 10);
});

test('costoPorUnidadDesdeBulto: neto 0 → 0', () => {
  assert.equal(costoPorUnidadDesdeBulto(100, 1, 2), 0);
});

test('normalizarPesoCajonKg: negativos y no finitos → 0', () => {
  assert.equal(normalizarPesoCajonKg(-3), 0);
  assert.equal(normalizarPesoCajonKg(NaN), 0);
  assert.equal(normalizarPesoCajonKg(undefined), 0);
});

test('normalizarPesoCajonKg: respeta techo', () => {
  assert.equal(normalizarPesoCajonKg(PESO_CAJON_MAX_KG + 1), PESO_CAJON_MAX_KG);
});
