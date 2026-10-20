// Application error for a customer that does not exist or is soft-deleted.
// Both cases are intentionally indistinguishable (D56/D69).
export class CustomerNotFoundError extends Error {
  constructor() {
    super('Customer not found');
    this.name = 'CustomerNotFoundError';
  }
}
