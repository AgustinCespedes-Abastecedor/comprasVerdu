import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYmdToPrismaDateOnly } from './dateOnly.js';

test('parseYmdToPrismaDateOnly: YYYY-MM-DD → medianoche UTC de ese día civil', () => {
  const d = parseYmdToPrismaDateOnly('2026-04-16');
  assert.ok(d);
  assert.equal(d.toISOString(), '2026-04-16T00:00:00.000Z');
});

test('parseYmdToPrismaDateOnly: ISO con T…Z usa solo la parte fecha', () => {
  const d = parseYmdToPrismaDateOnly('2026-04-16T00:00:00.000Z');
  assert.ok(d);
  assert.equal(d.toISOString(), '2026-04-16T00:00:00.000Z');
});

test('parseYmdToPrismaDateOnly: rechaza calendario inválido', () => {
  assert.equal(parseYmdToPrismaDateOnly('2026-02-30'), null);
  assert.equal(parseYmdToPrismaDateOnly('no-fecha'), null);
  assert.equal(parseYmdToPrismaDateOnly(''), null);
});
