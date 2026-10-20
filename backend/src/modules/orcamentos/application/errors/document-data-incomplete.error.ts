// D173: generation refuses to produce a document when technical data required
// by the document is missing, instead of rendering blank or assumed values.
export class DocumentDataIncompleteError extends Error {
  constructor() {
    super('Document data is incomplete');
    this.name = 'DocumentDataIncompleteError';
  }
}
