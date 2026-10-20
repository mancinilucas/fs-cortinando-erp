// Creation targets a customer defined by the route. A missing or soft-deleted
// customer is reported as not found, without distinguishing the two cases
// (D78/D118).
export class QuoteCustomerNotFoundError extends Error {
  constructor() {
    super('Customer not found');
    this.name = 'QuoteCustomerNotFoundError';
  }
}
