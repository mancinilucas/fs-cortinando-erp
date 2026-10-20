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
