export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

// Read projection for the customer list (D58/D59). It does not rebuild the
// aggregate: listing and search only expose summary fields.
export abstract class SearchCustomersQuery {
  abstract execute(search?: string): Promise<CustomerSummary[]>;
}
