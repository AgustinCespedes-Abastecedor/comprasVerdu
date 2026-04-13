import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  mapNivelToRoleNombre,
  ROL_ADMINISTRADOR,
  ROL_COMPRADOR,
  ROL_RECEPCIONISTA,
  ROL_ADMINISTRATIVO,
} from './nivelRol.js';

describe('mapNivelToRoleNombre (Nivel ELABASTECEDOR → rol en app)', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.EXTERNAL_NIVEL_RECEP_MIN;
    delete process.env.EXTERNAL_NIVEL_RECEP_MAX;
    delete process.env.EXTERNAL_NIVEL_COMP_MIN;
    delete process.env.EXTERNAL_NIVEL_COMP_MAX;
    delete process.env.EXTERNAL_NIVEL_ADMIN_MIN;
    delete process.env.EXTERNAL_NIVEL_ADMIN_MAX;
    delete process.env.EXTERNAL_NIVEL_ADMIN_SISTEMA;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('Nivel 100 (default) → Administrador', () => {
    assert.equal(mapNivelToRoleNombre(100), ROL_ADMINISTRADOR);
    assert.equal(mapNivelToRoleNombre('100'), ROL_ADMINISTRADOR);
  });

  it('Nivel 0–20 (default) → Recepcionista', () => {
    assert.equal(mapNivelToRoleNombre(0), ROL_RECEPCIONISTA);
    assert.equal(mapNivelToRoleNombre(20), ROL_RECEPCIONISTA);
  });

  it('Nivel 25–30 (default) → Comprador', () => {
    assert.equal(mapNivelToRoleNombre(25), ROL_COMPRADOR);
    assert.equal(mapNivelToRoleNombre(30), ROL_COMPRADOR);
  });

  it('Nivel 35–40 (default) → Administrativo', () => {
    assert.equal(mapNivelToRoleNombre(35), ROL_ADMINISTRATIVO);
    assert.equal(mapNivelToRoleNombre(40), ROL_ADMINISTRATIVO);
  });

  it('Nivel fuera de rangos → null (sin acceso)', () => {
    assert.equal(mapNivelToRoleNombre(21), null);
    assert.equal(mapNivelToRoleNombre(24), null);
    assert.equal(mapNivelToRoleNombre(99), null);
  });

  it('respeta EXTERNAL_NIVEL_ADMIN_SISTEMA', () => {
    process.env.EXTERNAL_NIVEL_ADMIN_SISTEMA = '99';
    assert.equal(mapNivelToRoleNombre(99), ROL_ADMINISTRADOR);
    assert.equal(mapNivelToRoleNombre(100), null);
  });

  it('acepta decimal como string (común en SQL)', () => {
    assert.equal(mapNivelToRoleNombre('25.0'), ROL_COMPRADOR);
  });
});
