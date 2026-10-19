import { NotFoundException } from '@nestjs/common';
import { CustomerNotFoundError } from '../application/customer-not-found.error.js';

// Translates application/domain errors to HTTP in the Presentation layer
// (D69). Any other error is rethrown untouched so Nest answers with a generic
// 500 and persistence details never reach the client.
export function mapCustomerError(error: unknown): never {
  if (error instanceof CustomerNotFoundError) {
    throw new NotFoundException(error.message);
  }

  throw error;
}
