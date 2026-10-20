import { describe, expect, it } from 'vitest';
import {
  commercialYearFrom,
  formatQuoteNumber,
  QuoteNumber,
} from './quote-number.js';

describe('QuoteNumber', () => {
  it('formats the first sequence with three digits', () => {
    expect(QuoteNumber.create(2026, 1).value).toBe('ORÇ-2026-001');
    expect(QuoteNumber.create(2026, 999).value).toBe('ORÇ-2026-999');
  });

  it('grows naturally above 999', () => {
    expect(QuoteNumber.create(2026, 1_000).value).toBe('ORÇ-2026-1000');
  });

  it('exposes year and sequence', () => {
    const quoteNumber = QuoteNumber.parse('ORÇ-2026-123');

    expect(quoteNumber.year).toBe(2026);
    expect(quoteNumber.sequence).toBe(123);
    expect(quoteNumber.toString()).toBe('ORÇ-2026-123');
  });

  it('parses a canonical value', () => {
    expect(
      QuoteNumber.parse('ORÇ-2026-001').equals(QuoteNumber.create(2026, 1)),
    ).toBe(true);
  });

  it('is immutable by value comparison', () => {
    const first = QuoteNumber.create(2026, 10);
    const second = QuoteNumber.create(2026, 10);
    const other = QuoteNumber.create(2026, 11);

    expect(first.equals(second)).toBe(true);
    expect(first.equals(other)).toBe(false);
  });

  it('rejects invalid formats', () => {
    for (const value of [
      'ORC-2026-001',
      'ORÇ-26-001',
      'ORÇ-2026-01',
      'ORÇ-2026-ABC',
      'orç-2026-001',
      ' ORÇ-2026-001',
      'ORÇ-2026-001 ',
      'ORÇ-2026-000',
    ]) {
      expect(() => QuoteNumber.parse(value)).toThrow();
    }
  });

  it('rejects invalid year and sequence when created directly', () => {
    expect(() => QuoteNumber.create(0, 1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(10_000, 1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, 0)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, -1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, 1.5)).toThrow(RangeError);
  });

  it('formats through the standalone helper', () => {
    expect(formatQuoteNumber(2025, 42)).toBe('ORÇ-2025-042');
  });
});

describe('commercialYearFrom', () => {
  it('uses the America/Sao_Paulo calendar year', () => {
    // 2025-12-31 23:00 in São Paulo (UTC-3).
    expect(commercialYearFrom(new Date('2026-01-01T02:00:00.000Z'))).toBe(2025);

    // 2026-01-01 00:00 in São Paulo.
    expect(commercialYearFrom(new Date('2026-01-01T03:00:00.000Z'))).toBe(2026);
  });

  it('rejects an invalid instant', () => {
    expect(() => commercialYearFrom(new Date(Number.NaN))).toThrow(RangeError);
  });
});
