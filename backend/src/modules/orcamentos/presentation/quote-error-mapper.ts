import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuoteCustomerNotFoundError } from '../application/errors/quote-customer-not-found.error.js';
import { QuoteNotFoundError } from '../application/errors/quote-not-found.error.js';
import {
  InvalidQuoteTransitionError,
  QuoteNotEditableError,
  QuoteValidationError,
  UnknownQuoteItemError,
} from '../domain/errors/quote-domain.errors.js';

// Translates domain/application errors to HTTP in the Presentation layer
// (D118). DTO failures are already handled by the global ValidationPipe (400)
// and authentication by AuthGuard (401). Any other error is rethrown untouched
// so Nest answers with a generic 500 and persistence details never reach the
// client.
export function mapQuoteError(error: unknown): never {
  if (
    error instanceof QuoteNotFoundError ||
    error instanceof QuoteCustomerNotFoundError
  ) {
    throw new NotFoundException(error.message);
  }

  if (
    error instanceof InvalidQuoteTransitionError ||
    error instanceof QuoteNotEditableError
  ) {
    throw new ConflictException(error.message);
  }

  if (error instanceof QuoteValidationError) {
    throw new UnprocessableEntityException({
      message: error.message,
      errors: error.violations,
    });
  }

  // Unknown, duplicated or foreign child ids are business-data conflicts
  // (D117/D118). Foreign ids cannot reach the database: reconciliation rejects
  // any id that does not belong to the quote.
  if (error instanceof UnknownQuoteItemError) {
    throw new UnprocessableEntityException(error.message);
  }

  throw error;
}
