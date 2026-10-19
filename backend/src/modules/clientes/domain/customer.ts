import { randomUUID } from 'node:crypto';
import {
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerOptionalText,
  normalizeCustomerPhone,
  normalizeCustomerTaxId,
} from './customer-normalizers.js';
import type { CustomerAddressInput } from './value-objects/customer-address.js';
import { CustomerAddress } from './value-objects/customer-address.js';

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  taxId?: string | null;
  address?: CustomerAddressInput | null;
  notes?: string | null;
}

export interface UpdateCustomerInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: CustomerAddressInput | null;
  notes?: string | null;
}

export interface CustomerSnapshot {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  address: CustomerAddress | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Customer Aggregate Root (D46–D57). It enforces the domain invariants for
// creation, partial updates and soft delete; persistence and transport
// concerns stay outside.
export class Customer {
  private constructor(
    readonly id: string,
    public name: string,
    public phone: string,
    public email: string | null,
    public taxId: string | null,
    public address: CustomerAddress | null,
    public notes: string | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  static create(input: CreateCustomerInput): Customer {
    const now = new Date();

    return new Customer(
      randomUUID(),
      requiredText(
        input.name,
        normalizeCustomerName,
        'Customer name is required',
      ),
      requiredText(
        input.phone,
        normalizeCustomerPhone,
        'Customer phone is required',
      ),
      normalizeCustomerEmail(input.email),
      validatedTaxId(input.taxId),
      CustomerAddress.create(input.address ?? null),
      normalizeCustomerOptionalText(input.notes),
      now,
      now,
      null,
    );
  }

  // Rebuilds the aggregate from persisted state. It does not restore a
  // deleted customer; deletedAt is preserved as stored.
  static rehydrate(snapshot: CustomerSnapshot): Customer {
    return new Customer(
      snapshot.id,
      snapshot.name,
      snapshot.phone,
      snapshot.email,
      snapshot.taxId,
      snapshot.address,
      snapshot.notes,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.deletedAt,
    );
  }

  update(input: UpdateCustomerInput): void {
    if (this.deletedAt !== null) {
      throw new Error('Customer is deleted and cannot be updated');
    }

    if (input.name !== undefined) {
      this.name = requiredText(
        input.name,
        normalizeCustomerName,
        'Customer name is required',
      );
    }

    if (input.phone !== undefined) {
      this.phone = requiredText(
        input.phone,
        normalizeCustomerPhone,
        'Customer phone is required',
      );
    }

    if (input.email !== undefined) {
      this.email = normalizeCustomerEmail(input.email);
    }

    if (input.taxId !== undefined) {
      this.taxId = validatedTaxId(input.taxId);
    }

    if (input.address !== undefined) {
      this.address = CustomerAddress.create(input.address);
    }

    if (input.notes !== undefined) {
      this.notes = normalizeCustomerOptionalText(input.notes);
    }
  }

  softDelete(now: Date = new Date()): void {
    if (this.deletedAt === null) {
      this.deletedAt = now;
    }
  }
}

function requiredText(
  value: string | null | undefined,
  normalize: (value: string) => string,
  message: string,
): string {
  const normalized =
    value === null || value === undefined ? '' : normalize(value);

  if (normalized === '') {
    throw new Error(message);
  }

  return normalized;
}

function validatedTaxId(value: string | null | undefined): string | null {
  const taxId = normalizeCustomerTaxId(value);

  if (taxId !== null && !/^(\d{11}|\d{14})$/.test(taxId)) {
    throw new Error('Customer tax ID must have 11 or 14 digits');
  }

  return taxId;
}
