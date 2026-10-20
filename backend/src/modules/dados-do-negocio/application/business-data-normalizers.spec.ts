import {
  normalizeBusinessDataEmail,
  normalizeBusinessDataName,
  normalizeBusinessDataPhone,
  normalizeBusinessDataTaxId,
  normalizeBusinessDataValues,
} from './business-data-normalizers.js';

describe('business data normalizers', () => {
  it('normalizes required text with trim and NFC', () => {
    expect(normalizeBusinessDataName('  Cortinando é  ')).toBe('Cortinando é');
    expect(normalizeBusinessDataPhone('  (11) 99999-9999  ')).toBe(
      '(11) 99999-9999',
    );
  });

  it('normalizes optional email and turns blanks into null', () => {
    expect(normalizeBusinessDataEmail('  Contato@Example.COM  ')).toBe(
      'contato@example.com',
    );
    expect(normalizeBusinessDataEmail('   ')).toBeNull();
    expect(normalizeBusinessDataEmail(null)).toBeNull();
  });

  it('keeps only digits in tax id and turns blanks into null', () => {
    expect(normalizeBusinessDataTaxId(' 123.456.789-01 ')).toBe('12345678901');
    expect(normalizeBusinessDataTaxId('   ')).toBeNull();
    expect(normalizeBusinessDataTaxId(undefined)).toBeNull();
  });

  it('normalizes a complete input', () => {
    expect(
      normalizeBusinessDataValues({
        commercialNameOrConsultant: '  Ana  ',
        phone: ' 11999999999 ',
        email: ' ANA@EXAMPLE.COM ',
        taxId: '12.345.678/0001-90',
      }),
    ).toEqual({
      commercialNameOrConsultant: 'Ana',
      phone: '11999999999',
      email: 'ana@example.com',
      taxId: '12345678000190',
    });
  });

  it('turns missing required fields into empty strings for validation', () => {
    expect(
      normalizeBusinessDataValues({
        email: '',
        taxId: null,
      }),
    ).toEqual({
      commercialNameOrConsultant: '',
      phone: '',
      email: null,
      taxId: null,
    });
  });
});
