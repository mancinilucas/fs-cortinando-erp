export class QuoteNotFoundError extends Error {
  constructor() {
    super('Quote not found');
    this.name = 'QuoteNotFoundError';
  }
}
