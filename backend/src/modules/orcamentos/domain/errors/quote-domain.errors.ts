// Domain errors for quote mutation (D118). They carry no HTTP concern; the
// presentation layer maps them to status codes.

export class QuoteNotEditableError extends Error {
  constructor(
    message = 'Quote can only be edited while in DRAFT or SENT status',
  ) {
    super(message);
    this.name = 'QuoteNotEditableError';
  }
}

export class UnknownQuoteItemError extends Error {
  constructor(message = 'Unknown or duplicated quote item id') {
    super(message);
    this.name = 'UnknownQuoteItemError';
  }
}

export class InvalidQuoteTransitionError extends Error {
  constructor(
    message = 'Quote transition is not allowed in the current status',
  ) {
    super(message);
    this.name = 'InvalidQuoteTransitionError';
  }
}

export interface QuoteValidationViolation {
  code: string;
  message: string;
}

export class QuoteValidationError extends Error {
  constructor(readonly violations: QuoteValidationViolation[]) {
    super('Quote does not satisfy the sending requirements');
    this.name = 'QuoteValidationError';
  }
}
