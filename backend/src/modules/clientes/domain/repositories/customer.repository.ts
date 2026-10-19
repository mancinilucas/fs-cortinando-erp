import type { Customer } from '../customer.js';

// Persistence port for the Customer aggregate (D64). Lookup by id filters
// active customers; findByIdIncludingDeleted exists only for the idempotent
// soft delete and for historical queries. Listing and search are projections
// and do not belong here.
export abstract class CustomerRepository {
  abstract findActiveById(id: string): Promise<Customer | null>;
  abstract findByIdIncludingDeleted(id: string): Promise<Customer | null>;
  abstract save(customer: Customer): Promise<void>;
}
