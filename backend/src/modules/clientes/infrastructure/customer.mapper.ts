import { Customer } from '../domain/customer.js';
import { CustomerAddress } from '../domain/value-objects/customer-address.js';

// Flat persistence shape of the customers table. Keeping it structural avoids
// importing generated Prisma types into the mapper contract.
export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  addressPostalCode: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Mutable columns written by the application. Identity and creation/update
// timestamps are omitted because they are managed by persistence (D74);
// deletedAt is application-controlled soft delete state.
export interface CustomerPersistenceData {
  name: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  addressPostalCode: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  notes: string | null;
  deletedAt: Date | null;
}

export class CustomerMapper {
  static toDomain(record: CustomerRecord): Customer {
    return Customer.rehydrate({
      id: record.id,
      name: record.name,
      phone: record.phone,
      email: record.email,
      taxId: record.taxId,
      address: toAddress(record),
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toPersistence(customer: Customer): CustomerPersistenceData {
    return {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      taxId: customer.taxId,
      addressPostalCode: customer.address?.postalCode ?? null,
      addressStreet: customer.address?.street ?? null,
      addressNumber: customer.address?.number ?? null,
      addressComplement: customer.address?.complement ?? null,
      addressNeighborhood: customer.address?.neighborhood ?? null,
      addressCity: customer.address?.city ?? null,
      addressState: customer.address?.state ?? null,
      notes: customer.notes,
      deletedAt: customer.deletedAt,
    };
  }
}

function toAddress(record: CustomerRecord): CustomerAddress | null {
  const input = {
    postalCode: record.addressPostalCode,
    street: record.addressStreet,
    number: record.addressNumber,
    complement: record.addressComplement,
    neighborhood: record.addressNeighborhood,
    city: record.addressCity,
    state: record.addressState,
  };

  const hasAnyValue = Object.values(input).some((value) => value !== null);

  return hasAnyValue ? CustomerAddress.create(input) : null;
}
