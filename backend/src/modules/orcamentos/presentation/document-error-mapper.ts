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

// Dedicated mapping for document generation (D193/D196). The controller
// composes it with mapQuoteError, which keeps handling QuoteNotFoundError.
// The messages are stable and never include technical causes (D198).
export function mapDocumentError(error: unknown): never {
  if (
    error instanceof DocumentNotAvailableError ||
    error instanceof BusinessDataNotConfiguredError ||
    error instanceof DocumentCustomerNotFoundError ||
    error instanceof DocumentDataIncompleteError
  ) {
    throw new ConflictException(error.message);
  }

  if (
    error instanceof DocumentRenderError ||
    error instanceof DocumentHistoryWriteError
  ) {
    throw new InternalServerErrorException(error.message);
  }

  throw error;
}
