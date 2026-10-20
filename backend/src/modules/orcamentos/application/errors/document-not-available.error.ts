export class DocumentNotAvailableError extends Error {
  constructor() {
    super('Document is not available in the current status');
    this.name = 'DocumentNotAvailableError';
  }
}
