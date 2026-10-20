export interface CustomerContact {
  name: string;
  phone: string;
}

// Narrow read projection for commercial documents (D155/D162). It exposes
// only the two authorized fields and deliberately includes soft-deleted
// customers: an existing quote remains valid after the customer is deleted.
export abstract class GetCustomerContactQuery {
  abstract execute(customerId: string): Promise<CustomerContact | null>;
}
