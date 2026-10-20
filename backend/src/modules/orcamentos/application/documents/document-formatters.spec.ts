import {
  formatCurrency,
  formatDate,
  formatMeasure,
  formatTaxId,
} from './document-formatters.js';

describe('document formatters', () => {
  describe('formatCurrency', () => {
    it('formats integer cents as Brazilian reais', () => {
      expect(formatCurrency(123_456)).toBe('R$ 1.234,56');
      expect(formatCurrency(0)).toBe('R$ 0,00');
      expect(formatCurrency(123_456_789)).toBe('R$ 1.234.567,89');
    });

    it('replaces non-breaking spaces with regular spaces', () => {
      const formatted = formatCurrency(123_456);

      expect(formatted).not.toMatch(/[  ]/);
      expect(formatted).toContain('R$ ');
    });
  });

  describe('formatDate', () => {
    it('formats the instant in America/Sao_Paulo', () => {
      expect(formatDate(new Date('2026-10-20T12:00:00.000Z'))).toBe(
        '20/10/2026',
      );
    });

    it('keeps the São Paulo day around UTC midnight', () => {
      // 02:30 UTC is still the previous day in São Paulo (UTC-3).
      expect(formatDate(new Date('2026-10-21T02:30:00.000Z'))).toBe(
        '20/10/2026',
      );
      expect(formatDate(new Date('2026-10-21T03:30:00.000Z'))).toBe(
        '21/10/2026',
      );
      expect(formatDate(new Date('2026-01-01T01:00:00.000Z'))).toBe(
        '31/12/2025',
      );
    });
  });

  describe('formatMeasure', () => {
    it('preserves one, two and three decimal places without trailing zeros', () => {
      expect(formatMeasure(2.6)).toBe('2,6 m');
      expect(formatMeasure(2.65)).toBe('2,65 m');
      expect(formatMeasure(2.605)).toBe('2,605 m');
    });

    it('does not round a third decimal place to two places', () => {
      expect(formatMeasure(2.605)).not.toBe('2,61 m');
    });

    it('omits decimals for whole measures', () => {
      expect(formatMeasure(10)).toBe('10 m');
    });
  });

  describe('formatTaxId', () => {
    it('formats an 11-digit CPF for presentation', () => {
      expect(formatTaxId('12345678901')).toBe('123.456.789-01');
    });

    it('formats a 14-digit CNPJ for presentation', () => {
      expect(formatTaxId('12345678000190')).toBe('12.345.678/0001-90');
    });

    it('leaves a value of another length unchanged', () => {
      expect(formatTaxId('1234567890')).toBe('1234567890');
    });
  });
});
