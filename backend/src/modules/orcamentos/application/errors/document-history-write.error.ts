// D180: when the history append fails, the request fails and the rendered
// bytes are not returned.
export class DocumentHistoryWriteError extends Error {
  constructor(cause?: unknown) {
    super('Could not generate the document', { cause });
    this.name = 'DocumentHistoryWriteError';
  }
}
