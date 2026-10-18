import { normalizeEmail } from './normalize-email.js';

describe('normalizeEmail', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('lowercases uppercase characters', () => {
    expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('combines trimming and lowercasing', () => {
    expect(normalizeEmail(' \tUser@Example.COM \n')).toBe('user@example.com');
  });

  it('keeps an already normalized address unchanged', () => {
    expect(normalizeEmail('user@example.com')).toBe('user@example.com');
  });

  it('applies Unicode NFC normalization', () => {
    const decomposed = 'José@Example.com';

    expect(normalizeEmail(decomposed)).toBe('josé@example.com');
  });
});
