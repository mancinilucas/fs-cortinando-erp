export class BusinessDataNotConfiguredError extends Error {
  constructor() {
    super('Business data is not configured');
    this.name = 'BusinessDataNotConfiguredError';
  }
}
