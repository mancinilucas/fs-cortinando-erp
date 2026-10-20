import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessDataNotFoundError } from '../application/business-data-not-found.error.js';
import { BusinessDataValidationError } from '../application/business-data-validation.error.js';

// Translates application errors to HTTP in the Presentation layer (D136). Any
// other error is rethrown untouched so Nest answers with a generic 500 and
// persistence details never reach the client.
export function mapBusinessDataError(error: unknown): never {
  if (error instanceof BusinessDataNotFoundError) {
    throw new NotFoundException(error.message);
  }

  if (error instanceof BusinessDataValidationError) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
