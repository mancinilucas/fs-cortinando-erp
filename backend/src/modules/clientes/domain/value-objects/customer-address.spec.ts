import {
  CustomerAddress,
  type CustomerAddressInput,
} from './customer-address.js';

describe('CustomerAddress', () => {
  const centralFields = {
    street: 'Rua das Flores',
    number: '123A',
    neighborhood: 'Centro',
    city: 'São Paulo',
  } satisfies CustomerAddressInput;

  const completeAddress = {
    ...centralFields,
    postalCode: '01310-100',
    complement: 'Apto 12',
    state: 'sp',
  };

  it('creates a complete address with normalized fields', () => {
    const address = CustomerAddress.create(completeAddress);

    expect(address).not.toBeNull();
    expect(address).toMatchObject({
      postalCode: '01310100',
      street: 'Rua das Flores',
      number: '123A',
      complement: 'Apto 12',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('creates an address with only the four central fields', () => {
    const address = CustomerAddress.create(centralFields);

    expect(address).not.toBeNull();
    expect(address!.postalCode).toBeNull();
    expect(address!.complement).toBeNull();
    expect(address!.state).toBeNull();
  });

  it('trims text fields and maps blank optional fields to null', () => {
    const address = CustomerAddress.create({
      street: '  Rua das Flores  ',
      number: '  s/n  ',
      neighborhood: '  Centro  ',
      city: '  São Paulo  ',
      postalCode: '   ',
      complement: '   ',
      state: '   ',
    });

    expect(address).not.toBeNull();
    expect(address!.street).toBe('Rua das Flores');
    expect(address!.number).toBe('s/n');
    expect(address!.neighborhood).toBe('Centro');
    expect(address!.city).toBe('São Paulo');
    expect(address!.postalCode).toBeNull();
    expect(address!.complement).toBeNull();
    expect(address!.state).toBeNull();
  });

  it('represents the complete absence of an address with null', () => {
    expect(CustomerAddress.create(null)).toBeNull();
    expect(CustomerAddress.create(undefined)).toBeNull();
  });

  it.each(['street', 'number', 'neighborhood', 'city'] as const)(
    'rejects an address without %s',
    (field) => {
      const input: CustomerAddressInput = { ...centralFields };

      delete input[field];

      expect(() => CustomerAddress.create(input)).toThrow(
        /requires street, number, neighborhood and city/,
      );
    },
  );

  it.each(['street', 'number', 'neighborhood', 'city'] as const)(
    'rejects a blank %s',
    (field) => {
      const input: CustomerAddressInput = { ...centralFields, [field]: '   ' };

      expect(() => CustomerAddress.create(input)).toThrow(
        /requires street, number, neighborhood and city/,
      );
    },
  );

  it.each(['1234567', '123456789', '01310-10A'])(
    'rejects the invalid postal code %s',
    (postalCode) => {
      expect(() =>
        CustomerAddress.create({ ...centralFields, postalCode }),
      ).toThrow(/postal code must have exactly 8 digits/);
    },
  );

  it('accepts a postal code without or with mask after normalization', () => {
    expect(
      CustomerAddress.create({ ...centralFields, postalCode: '01310100' })!
        .postalCode,
    ).toBe('01310100');
    expect(
      CustomerAddress.create({ ...centralFields, postalCode: ' 01310-100 ' })!
        .postalCode,
    ).toBe('01310100');
  });

  it.each(['S', 'SPX', 'S1', 'SÃ'])('rejects the invalid state %s', (state) => {
    expect(() => CustomerAddress.create({ ...centralFields, state })).toThrow(
      /state must have exactly 2 uppercase letters/,
    );
  });

  it('does not validate the state against an official UF list', () => {
    expect(
      CustomerAddress.create({ ...centralFields, state: ' zz ' })!.state,
    ).toBe('ZZ');
  });
});
