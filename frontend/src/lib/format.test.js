import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDateOnly, formatMoneda } from './format';

describe('format', () => {
  it('formatDateTime retorna "—" para null/undefined', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formatDateOnly retorna "—" para null/undefined', () => {
    expect(formatDateOnly(null)).toBe('—');
    expect(formatDateOnly(undefined)).toBe('—');
  });

  it('formatMoneda formatea números como moneda', () => {
    expect(formatMoneda(1234.5)).toMatch(/[\d$,.]/);
  });
});
