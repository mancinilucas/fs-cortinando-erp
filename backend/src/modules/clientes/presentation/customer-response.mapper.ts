import type { CustomerSummary } from '../application/search-customers.query.js';
import type { Customer } from '../domain/customer.js';
import type { CustomerAddress } from '../domain/value-objects/customer-address.js';
import type { CustomerAddressDto } from './dto/customer-address.dto.js';
import type { CustomerDetailResponseDto } from './dto/customer-detail-response.dto.js';
import type { CustomerSummaryResponseDto } from './dto/customer-summary-response.dto.js';

// Keeps the HTTP contract separate from the aggregate and exposes the
// persistence-managed timestamps as ISO 8601 (D60/D74). deletedAt stays out.
export class CustomerResponseMapper {
  static toDetail(customer: Customer): CustomerDetailResponseDto {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      taxId: customer.taxId,
      address: customer.address === null ? null : addressOf(customer.address),
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  static toSummary(summary: CustomerSummary): CustomerSummaryResponseDto {
    return {
      id: summary.id,
      name: summary.name,
      phone: summary.phone,
      email: summary.email,
    };
  }
}

function addressOf(address: CustomerAddress): CustomerAddressDto {
  return {
    postalCode: address.postalCode,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
  };
}
