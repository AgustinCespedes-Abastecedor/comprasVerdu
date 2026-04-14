import test from 'node:test';
import assert from 'node:assert/strict';
import { getCalendarDayBoundsUtc, utcInstantToCalendarDayString } from './appCalendarDay.js';

test('getCalendarDayBoundsUtc: 24 mar 2026 ART', () => {
  const { gte, lt } = getCalendarDayBoundsUtc('2026-03-24');
  assert.equal(gte.toISOString(), '2026-03-24T03:00:00.000Z');
  assert.equal(lt.toISOString(), '2026-03-25T03:00:00.000Z');
});

test('utcInstantToCalendarDayString: medianoche ART', () => {
  const s = utcInstantToCalendarDayString(new Date('2026-03-24T03:00:00.000Z'));
  assert.equal(s, '2026-03-24');
});

test('utcInstantToCalendarDayString: antes de medianoche ART cae día anterior', () => {
  const s = utcInstantToCalendarDayString(new Date('2026-03-24T02:59:59.999Z'));
  assert.equal(s, '2026-03-23');
});

test('getCalendarDayBoundsUtc: fecha inválida (31 feb)', () => {
  assert.equal(getCalendarDayBoundsUtc('2026-02-31'), null);
});
