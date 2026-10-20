import { Customer } from './customer.js';
import { CustomerAddress } from './value-objects/customer-address.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const completeAddress = {
  postalCode: '01310-100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 10',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

describe('Customer', () => {
  describe('create', () => {
    it('creates a customer with all fields normalized', () => {
      const customer = Customer.create({
        name: '  Maria Silva  ',
        phone: '  (11) 99999-9999  ',
        email: '  Maria@Example.COM  ',
        taxId: ' 123.456.789-01 ',
        address: completeAddress,
        notes: '  Cliente preferencial  ',
      });

      expect(customer.id).toMatch(UUID_V4);
      expect(customer.name).toBe('Maria Silva');
      expect(customer.phone).toBe('(11) 99999-9999');
      expect(customer.email).toBe('maria@example.com');
      expect(customer.taxId).toBe('12345678901');
      expect(customer.address).toBeInstanceOf(CustomerAddress);
      expect(customer.address).toMatchObject({
        postalCode: '01310100',
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Apto 10',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      });
      expect(customer.notes).toBe('Cliente preferencial');
      expect(customer.createdAt).toBeInstanceOf(Date);
      expect(customer.createdAt).toEqual(customer.updatedAt);
      expect(customer.deletedAt).toBeNull();
    });

    it('creates a minimal customer with every optional field as null', () => {
      const customer = Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
      });

      expect(customer.email).toBeNull();
      expect(customer.taxId).toBeNull();
      expect(customer.address).toBeNull();
      expect(customer.notes).toBeNull();
    });

    it('maps blank optional fields to null', () => {
      const customer = Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
        email: '   ',
        taxId: '   ',
        notes: '   ',
      });

      expect(customer.email).toBeNull();
      expect(customer.taxId).toBeNull();
      expect(customer.notes).toBeNull();
    });

    it('accepts a 14-digit CNPJ', () => {
      const customer = Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
        taxId: '12.345.678/0001-90',
      });

      expect(customer.taxId).toBe('12345678000190');
    });

    it('rejects a blank name', () => {
      expect(() =>
        Customer.create({ name: '   ', phone: '11999999999' }),
      ).toThrow(/Customer name is required/);
    });

    it('rejects a blank phone', () => {
      expect(() =>
        Customer.create({ name: 'Maria Silva', phone: '   ' }),
      ).toThrow(/Customer phone is required/);
    });

    it.each(['123', '1234567890', '1234567890123'])(
      'rejects the tax ID %s because it is neither 11 nor 14 digits',
      (taxId) => {
        expect(() =>
          Customer.create({
            name: 'Maria Silva',
            phone: '11999999999',
            taxId,
          }),
        ).toThrow(/Customer tax ID must have 11 or 14 digits/);
      },
    );

    it('rejects a partial address', () => {
      expect(() =>
        Customer.create({
          name: 'Maria Silva',
          phone: '11999999999',
          address: { street: 'Avenida Paulista' },
        }),
      ).toThrow(/requires street, number, neighborhood and city/);
    });
  });

  describe('update', () => {
    function activeCustomer(): Customer {
      return Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
        email: 'maria@example.com',
        taxId: '12345678901',
        address: completeAddress,
        notes: 'Cliente preferencial',
      });
    }

    it('changes only the supplied fields', () => {
      const customer = activeCustomer();

      customer.update({ name: '  Maria Souza  ' });

      expect(customer.name).toBe('Maria Souza');
      expect(customer.phone).toBe('11999999999');
      expect(customer.email).toBe('maria@example.com');
      expect(customer.taxId).toBe('12345678901');
      expect(customer.notes).toBe('Cliente preferencial');
      expect(customer.address).toMatchObject({
        street: 'Avenida Paulista',
      });
    });

    it('normalizes supplied fields', () => {
      const customer = activeCustomer();

      customer.update({
        phone: '  (11) 98888-7777  ',
        email: '  MARIA@EXAMPLE.COM ',
        taxId: ' 12.345.678/0001-90 ',
        notes: '  Atualizado  ',
      });

      expect(customer.phone).toBe('(11) 98888-7777');
      expect(customer.email).toBe('maria@example.com');
      expect(customer.taxId).toBe('12345678000190');
      expect(customer.notes).toBe('Atualizado');
    });

    it('clears optional fields sent as null or blank', () => {
      const customer = activeCustomer();

      customer.update({
        email: null,
        taxId: '   ',
        notes: '   ',
        address: null,
      });

      expect(customer.email).toBeNull();
      expect(customer.taxId).toBeNull();
      expect(customer.notes).toBeNull();
      expect(customer.address).toBeNull();
    });

    it('replaces the whole address block instead of merging it', () => {
      const customer = activeCustomer();

      customer.update({
        address: {
          street: 'Rua Nova',
          number: '42',
          neighborhood: 'Centro',
          city: 'Campinas',
        },
      });

      expect(customer.address).toMatchObject({
        postalCode: null,
        street: 'Rua Nova',
        number: '42',
        complement: null,
        neighborhood: 'Centro',
        city: 'Campinas',
        state: null,
      });
    });

    it('rejects a partial address', () => {
      const customer = activeCustomer();

      expect(() => customer.update({ address: { city: 'Campinas' } })).toThrow(
        /requires street, number, neighborhood and city/,
      );
    });

    it('rejects null or blank required fields', () => {
      const customer = activeCustomer();

      expect(() => customer.update({ name: null })).toThrow(
        /Customer name is required/,
      );
      expect(() => customer.update({ name: '   ' })).toThrow(
        /Customer name is required/,
      );
      expect(() => customer.update({ phone: null })).toThrow(
        /Customer phone is required/,
      );
      expect(() => customer.update({ phone: '   ' })).toThrow(
        /Customer phone is required/,
      );
    });

    it('rejects an invalid tax ID', () => {
      const customer = activeCustomer();

      expect(() => customer.update({ taxId: '123' })).toThrow(
        /Customer tax ID must have 11 or 14 digits/,
      );
    });

    it('is a no-op for an empty patch', () => {
      const customer = activeCustomer();

      customer.update({});

      expect(customer.name).toBe('Maria Silva');
      expect(customer.phone).toBe('11999999999');
      expect(customer.email).toBe('maria@example.com');
    });
  });

  describe('soft delete', () => {
    it('marks the customer as deleted', () => {
      const customer = Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
      });

      customer.softDelete();

      expect(customer.deletedAt).toBeInstanceOf(Date);
    });

    it('is idempotent and preserves the first deletion instant', () => {
      const customer = Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
      });

      customer.softDelete();
      const deletedAt = customer.deletedAt;

      customer.softDelete();

      expect(customer.deletedAt).toBe(deletedAt);
    });

    it('rejects updates after deletion', () => {
      const customer = Customer.create({
        name: 'Maria Silva',
        phone: '11999999999',
      });
      customer.softDelete();

      expect(() => customer.update({ name: 'Maria Souza' })).toThrow(
        /Customer is deleted and cannot be updated/,
      );
    });

    it('does not restore a deleted customer through rehydrate', () => {
      const snapshot = {
        id: '00000000-0000-4000-8000-000000000000',
        name: 'Maria Silva',
        phone: '11999999999',
        email: null,
        taxId: null,
        address: null,
        notes: null,
        createdAt: new Date('2026-10-19T12:00:00.000Z'),
        updatedAt: new Date('2026-10-19T12:00:00.000Z'),
        deletedAt: new Date('2026-10-19T13:00:00.000Z'),
      };

      const customer = Customer.rehydrate(snapshot);

      expect(customer.id).toBe(snapshot.id);
      expect(customer.deletedAt).toBe(snapshot.deletedAt);
      expect(customer.createdAt).toBe(snapshot.createdAt);
      expect(customer.updatedAt).toBe(snapshot.updatedAt);
    });
  });
});
