// D197: adapter boundaries wrap technical rendering failures in this error
// and keep the original cause off the HTTP response.
export class DocumentRenderError extends Error {
  constructor(cause?: unknown) {
    super('Could not generate the document', { cause });
    this.name = 'DocumentRenderError';
  }
}
