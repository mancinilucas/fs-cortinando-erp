// D193 reports a missing quote customer with the same stable message as any
// other incomplete document data.
export class DocumentCustomerNotFoundError extends Error {
  constructor() {
    super('Document data is incomplete');
    this.name = 'DocumentCustomerNotFoundError';
  }
}
