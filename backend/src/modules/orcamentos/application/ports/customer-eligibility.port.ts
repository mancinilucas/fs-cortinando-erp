// Narrow read port over the Customer aggregate (D78/D97). Quote never imports
// the Customer aggregate; it only needs to know whether the linked customer
// still exists and is active.

export abstract class CustomerEligibility {
  /** True when the customer exists and was not soft-deleted. */
  abstract existsAndIsActive(customerId: string): Promise<boolean>;
}
