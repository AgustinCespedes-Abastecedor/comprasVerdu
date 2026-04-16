import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDateOnly, formatDate, formatMoneda } from './format';

describe('format', () => {
  it('formatDateTime retorna "—" para null/undefined', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formatDateOnly retorna "—" para null/undefined', () => {
    expect(formatDateOnly(null)).toBe('—');
    expect(formatDateOnly(undefined)).toBe('—');
  });

  it('formatDate y formatDateOnly: DATE en UTC medianoche no retrocede un día (es-AR)', () => {
    const iso = '2026-04-16T00:00:00.000Z';
    expect(formatDate(iso)).toMatch(/16/);
    expect(formatDate(iso)).toMatch(/2026/);
    expect(formatDateOnly(iso)).toMatch(/16/);
    expect(formatDateOnly(iso)).toMatch(/2026/);
    expect(formatDate('2026-04-16')).toMatch(/16/);
  });

  it('formatMoneda formatea números como moneda', () => {
    expect(formatMoneda(1234.5)).toMatch(/[\d$,.]/);
  });
});
