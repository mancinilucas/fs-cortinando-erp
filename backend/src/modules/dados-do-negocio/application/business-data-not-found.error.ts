// Application error for an unconfigured business. The Presentation layer maps
// it to 404 according to D129/D136.
export class BusinessDataNotFoundError extends Error {
  constructor() {
    super('Business data is not configured');
    this.name = 'BusinessDataNotFoundError';
  }
}
