import {
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerOptionalText,
  normalizeCustomerPhone,
  normalizeCustomerPostalCode,
  normalizeCustomerState,
  normalizeCustomerTaxId,
} from './customer-normalizers.js';

describe('customer normalizers', () => {
  describe('normalizeCustomerName', () => {
    it('trims edges while preserving case and accents', () => {
      expect(normalizeCustomerName('  José da Silva  ')).toBe('José da Silva');
    });

    it('applies Unicode NFC normalization', () => {
      expect(normalizeCustomerName('  José  ')).toBe('José');
    });

    it('returns an empty string for blank input', () => {
      expect(normalizeCustomerName('   ')).toBe('');
    });

    it('is idempotent', () => {
      const once = normalizeCustomerName('  José  ');

      expect(normalizeCustomerName(once)).toBe(once);
    });
  });

  describe('normalizeCustomerPhone', () => {
    it('trims edges but preserves the informed formatting', () => {
      expect(normalizeCustomerPhone('  (11) 99999-9999  ')).toBe(
        '(11) 99999-9999',
      );
    });

    it('does not remove non-digit characters', () => {
      expect(normalizeCustomerPhone('+55 11 99999-9999')).toBe(
        '+55 11 99999-9999',
      );
    });

    it('is idempotent', () => {
      const once = normalizeCustomerPhone('  11999999999  ');

      expect(normalizeCustomerPhone(once)).toBe(once);
    });
  });

  describe('normalizeCustomerEmail', () => {
    it('reuses the shared normalization: trim, NFC and lowercase', () => {
      expect(normalizeCustomerEmail(' \tUser@Example.COM \n')).toBe(
        'user@example.com',
      );
    });

    it('applies Unicode NFC normalization', () => {
      expect(normalizeCustomerEmail('José@Example.com')).toBe(
        'josé@example.com',
      );
    });

    it('maps blank, null and undefined to null', () => {
      expect(normalizeCustomerEmail('   ')).toBeNull();
      expect(normalizeCustomerEmail('')).toBeNull();
      expect(normalizeCustomerEmail(null)).toBeNull();
      expect(normalizeCustomerEmail(undefined)).toBeNull();
    });

    it('is idempotent', () => {
      const once = normalizeCustomerEmail(' User@Example.com ');

      expect(normalizeCustomerEmail(once)).toBe(once);
    });
  });

  describe('normalizeCustomerTaxId', () => {
    it('keeps only the digits of a masked CPF', () => {
      expect(normalizeCustomerTaxId(' 123.456.789-01 ')).toBe('12345678901');
    });

    it('keeps only the digits of a masked CNPJ', () => {
      expect(normalizeCustomerTaxId('12.345.678/0001-90')).toBe(
        '12345678000190',
      );
    });

    it('does not validate length or check digits', () => {
      expect(normalizeCustomerTaxId('123')).toBe('123');
    });

    it('maps blank, null and undefined to null', () => {
      expect(normalizeCustomerTaxId('   ')).toBeNull();
      expect(normalizeCustomerTaxId('')).toBeNull();
      expect(normalizeCustomerTaxId(null)).toBeNull();
      expect(normalizeCustomerTaxId(undefined)).toBeNull();
    });

    it('is idempotent', () => {
      const once = normalizeCustomerTaxId('123.456.789-01');

      expect(normalizeCustomerTaxId(once)).toBe(once);
    });
  });

  describe('normalizeCustomerPostalCode', () => {
    it('removes the mask', () => {
      expect(normalizeCustomerPostalCode(' 01310-100 ')).toBe('01310100');
    });

    it('maps blank, null and undefined to null', () => {
      expect(normalizeCustomerPostalCode('   ')).toBeNull();
      expect(normalizeCustomerPostalCode(null)).toBeNull();
      expect(normalizeCustomerPostalCode(undefined)).toBeNull();
    });

    it('is idempotent', () => {
      const once = normalizeCustomerPostalCode('01310-100');

      expect(normalizeCustomerPostalCode(once)).toBe(once);
    });
  });

  describe('normalizeCustomerState', () => {
    it('trims and uppercases', () => {
      expect(normalizeCustomerState('  sp ')).toBe('SP');
    });

    it('does not validate against an official UF list', () => {
      expect(normalizeCustomerState(' zz ')).toBe('ZZ');
    });

    it('maps blank, null and undefined to null', () => {
      expect(normalizeCustomerState('   ')).toBeNull();
      expect(normalizeCustomerState(null)).toBeNull();
      expect(normalizeCustomerState(undefined)).toBeNull();
    });

    it('is idempotent', () => {
      const once = normalizeCustomerState(' sp ');

      expect(normalizeCustomerState(once)).toBe(once);
    });
  });

  describe('normalizeCustomerOptionalText', () => {
    it('trims edges while preserving inner content', () => {
      expect(normalizeCustomerOptionalText('  Apto 12, bloco B  ')).toBe(
        'Apto 12, bloco B',
      );
    });

    it('maps blank, null and undefined to null', () => {
      expect(normalizeCustomerOptionalText(' \t\n ')).toBeNull();
      expect(normalizeCustomerOptionalText('')).toBeNull();
      expect(normalizeCustomerOptionalText(null)).toBeNull();
      expect(normalizeCustomerOptionalText(undefined)).toBeNull();
    });

    it('is idempotent', () => {
      const once = normalizeCustomerOptionalText('  observação  ');

      expect(normalizeCustomerOptionalText(once)).toBe(once);
    });
  });
});
