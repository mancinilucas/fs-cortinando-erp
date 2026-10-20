import { describe, expect, it } from 'vitest';
import { InstallationAddress } from './installation-address.js';

const completeAddress = {
  street: 'Rua das Flores',
  number: '123A',
  neighborhood: 'Centro',
  city: 'São Paulo',
  complement: 'Apto 45',
  postalCode: '01234-567',
  state: 'sp',
};

describe('InstallationAddress', () => {
  it('creates a complete address and normalizes optional fields', () => {
    const address = InstallationAddress.create(completeAddress);

    expect(address).not.toBeNull();
    expect(address?.isComplete()).toBe(true);
    expect(address?.street).toBe('Rua das Flores');
    expect(address?.number).toBe('123A');
    expect(address?.complement).toBe('Apto 45');
    expect(address?.postalCode).toBe('01234567');
    expect(address?.state).toBe('SP');
  });

  it('accepts a partial address for a draft', () => {
    const address = InstallationAddress.create({ street: 'Rua das Flores' });

    expect(address).not.toBeNull();
    expect(address?.isComplete()).toBe(false);
    expect(address?.street).toBe('Rua das Flores');
    expect(address?.city).toBeNull();
  });

  it('treats absent and empty addresses as null', () => {
    expect(InstallationAddress.create(null)).toBeNull();
    expect(InstallationAddress.create(undefined)).toBeNull();
    expect(InstallationAddress.create({})).toBeNull();
    expect(
      InstallationAddress.create({ street: '   ', city: '', state: '  ' }),
    ).toBeNull();
  });

  it('normalizes blank optional fields to null', () => {
    const address = InstallationAddress.create({
      street: 'Rua das Flores',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      complement: '   ',
      postalCode: '',
    });

    expect(address?.complement).toBeNull();
    expect(address?.postalCode).toBeNull();
  });

  it('normalizes postal code to eight digits', () => {
    const address = InstallationAddress.create({
      postalCode: '01234-567',
      state: 'SP',
    });

    expect(address?.postalCode).toBe('01234567');
  });

  it('rejects postal codes that do not have eight digits', () => {
    expect(() => InstallationAddress.create({ postalCode: '1234567' })).toThrow(
      RangeError,
    );
    expect(() =>
      InstallationAddress.create({ postalCode: '123456789' }),
    ).toThrow(RangeError);
  });

  it('rejects invalid state codes', () => {
    expect(() => InstallationAddress.create({ state: 'SPX' })).toThrow(
      RangeError,
    );
    expect(() => InstallationAddress.create({ state: 'S' })).toThrow(
      RangeError,
    );
    expect(() => InstallationAddress.create({ state: '12' })).toThrow(
      RangeError,
    );
  });

  it('compares addresses by value', () => {
    const first = InstallationAddress.create(completeAddress);
    const second = InstallationAddress.create(completeAddress);

    expect(first?.equals(second ?? null)).toBe(true);
    expect(first?.equals(null)).toBe(false);
  });

  it('keeps an independent snapshot', () => {
    const input = { ...completeAddress };
    const address = InstallationAddress.create(input);

    input.city = 'Campinas';

    expect(address?.city).toBe('São Paulo');
  });
});
