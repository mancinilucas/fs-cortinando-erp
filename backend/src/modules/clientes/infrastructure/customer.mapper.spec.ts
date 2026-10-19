import { CustomerAddress } from '../domain/value-objects/customer-address.js';
import { CustomerMapper, type CustomerRecord } from './customer.mapper.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');
const updatedAt = new Date('2026-10-19T12:30:00.000Z');

const record: CustomerRecord = {
  id: '00000000-0000-4000-8000-000000000000',
  name: 'Maria Silva',
  phone: '(11) 99999-9999',
  email: 'maria@example.com',
  taxId: '12345678901',
  addressPostalCode: '01310100',
  addressStreet: 'Avenida Paulista',
  addressNumber: '1000',
  addressComplement: 'Apto 10',
  addressNeighborhood: 'Bela Vista',
  addressCity: 'São Paulo',
  addressState: 'SP',
  notes: 'Cliente preferencial',
  createdAt,
  updatedAt,
  deletedAt: null,
};

function withoutAddress(value: CustomerRecord): CustomerRecord {
  return {
    ...value,
    addressPostalCode: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
  };
}

describe('CustomerMapper', () => {
  describe('toDomain', () => {
    it('reconstructs the aggregate with its address', () => {
      const customer = CustomerMapper.toDomain(record);

      expect(customer.id).toBe(record.id);
      expect(customer.name).toBe('Maria Silva');
      expect(customer.phone).toBe('(11) 99999-9999');
      expect(customer.email).toBe('maria@example.com');
      expect(customer.taxId).toBe('12345678901');
      expect(customer.notes).toBe('Cliente preferencial');
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
    });

    it('maps all-null address columns to a null address', () => {
      const customer = CustomerMapper.toDomain(withoutAddress(record));

      expect(customer.address).toBeNull();
    });

    it('preserves null optional fields', () => {
      const customer = CustomerMapper.toDomain({
        ...withoutAddress(record),
        email: null,
        taxId: null,
        notes: null,
      });

      expect(customer.email).toBeNull();
      expect(customer.taxId).toBeNull();
      expect(customer.notes).toBeNull();
    });

    it('maps technical dates correctly', () => {
      const customer = CustomerMapper.toDomain(record);

      expect(customer.createdAt).toBe(createdAt);
      expect(customer.updatedAt).toBe(updatedAt);
      expect(customer.deletedAt).toBeNull();
    });

    it('preserves the soft delete instant', () => {
      const deletedAt = new Date('2026-10-19T13:00:00.000Z');
      const customer = CustomerMapper.toDomain({ ...record, deletedAt });

      expect(customer.deletedAt).toBe(deletedAt);
    });

    it('rejects an inconsistent partial address', () => {
      expect(() =>
        CustomerMapper.toDomain({ ...record, addressStreet: null }),
      ).toThrow(/requires street, number, neighborhood and city/);
    });
  });

  describe('toPersistence', () => {
    it('flattens the address and preserves every field', () => {
      const customer = CustomerMapper.toDomain(record);

      expect(CustomerMapper.toPersistence(customer)).toEqual({
        name: 'Maria Silva',
        phone: '(11) 99999-9999',
        email: 'maria@example.com',
        taxId: '12345678901',
        addressPostalCode: '01310100',
        addressStreet: 'Avenida Paulista',
        addressNumber: '1000',
        addressComplement: 'Apto 10',
        addressNeighborhood: 'Bela Vista',
        addressCity: 'São Paulo',
        addressState: 'SP',
        notes: 'Cliente preferencial',
        deletedAt: null,
      });
    });

    it('writes every address column as null when there is no address', () => {
      const customer = CustomerMapper.toDomain(withoutAddress(record));

      const data = CustomerMapper.toPersistence(customer);

      expect(data.addressPostalCode).toBeNull();
      expect(data.addressStreet).toBeNull();
      expect(data.addressNumber).toBeNull();
      expect(data.addressComplement).toBeNull();
      expect(data.addressNeighborhood).toBeNull();
      expect(data.addressCity).toBeNull();
      expect(data.addressState).toBeNull();
    });

    it('leaves identity and technical timestamps to persistence', () => {
      const customer = CustomerMapper.toDomain(record);

      const data = CustomerMapper.toPersistence(customer);

      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('createdAt');
      expect(data).not.toHaveProperty('updatedAt');
    });

    it('persists the soft delete instant', () => {
      const deletedAt = new Date('2026-10-19T13:00:00.000Z');
      const customer = CustomerMapper.toDomain({ ...record, deletedAt });

      expect(CustomerMapper.toPersistence(customer).deletedAt).toBe(deletedAt);
    });
  });
});
