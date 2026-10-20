// Application error for values that violate the business data invariants.
// The Presentation layer maps it to 400 according to D132/D136.
export class BusinessDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessDataValidationError';
  }
}
