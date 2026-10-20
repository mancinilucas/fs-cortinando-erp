import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BusinessDataNotConfiguredError } from '../application/errors/business-data-not-configured.error.js';
import { DocumentCustomerNotFoundError } from '../application/errors/document-customer-not-found.error.js';
import { DocumentDataIncompleteError } from '../application/errors/document-data-incomplete.error.js';
import { DocumentHistoryWriteError } from '../application/errors/document-history-write.error.js';
import { DocumentNotAvailableError } from '../application/errors/document-not-available.error.js';
import { DocumentRenderError } from '../application/errors/document-render.error.js';
import { QuoteNotFoundError } from '../application/errors/quote-not-found.error.js';
import { mapDocumentError } from './document-error-mapper.js';

function capture(error: unknown): Error {
  try {
    mapDocumentError(error);
  } catch (mapped) {
    return mapped as Error;
  }

  throw new Error('mapDocumentError must always throw');
}

describe('mapDocumentError', () => {
  it.each([
    [
      new DocumentNotAvailableError(),
      'Document is not available in the current status',
    ],
    [new BusinessDataNotConfiguredError(), 'Business data is not configured'],
    [new DocumentCustomerNotFoundError(), 'Document data is incomplete'],
    [new DocumentDataIncompleteError(), 'Document data is incomplete'],
  ])('maps %s to 409 with its stable message', (error, message) => {
    const mapped = capture(error);

    expect(mapped).toBeInstanceOf(ConflictException);
    expect((mapped as ConflictException).getStatus()).toBe(409);
    expect(mapped.message).toBe(message);
  });

  it.each([new DocumentRenderError(), new DocumentHistoryWriteError()])(
    'maps %s to a generic 500',
    (error) => {
      const mapped = capture(error);

      expect(mapped).toBeInstanceOf(InternalServerErrorException);
      expect((mapped as InternalServerErrorException).getStatus()).toBe(500);
      expect(mapped.message).toBe('Could not generate the document');
    },
  );

  it('keeps the technical cause out of the HTTP message', () => {
    const cause = new Error('pdf-lib internal failure');
    const mapped = capture(new DocumentRenderError(cause));

    expect(mapped.message).toBe('Could not generate the document');
    expect(mapped.message).not.toContain('pdf-lib');
  });

  it('rethrows unexpected errors so the controller can compose mapQuoteError', () => {
    const quoteNotFound = new QuoteNotFoundError();

    expect(capture(quoteNotFound)).toBe(quoteNotFound);

    const unexpected = new Error('database credentials leaked?');

    expect(capture(unexpected)).toBe(unexpected);
  });
});
