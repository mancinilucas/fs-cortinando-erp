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
import { mapQuoteError } from './quote-error-mapper.js';

function capture(error: unknown): Error {
  try {
    mapQuoteError(error);
  } catch (mapped) {
    return mapped as Error;
  }

  throw new Error('mapQuoteError must always throw');
}

describe('mapQuoteError', () => {
  it('maps a missing quote or customer to 404', () => {
    for (const error of [
      new QuoteNotFoundError(),
      new QuoteCustomerNotFoundError(),
    ]) {
      const mapped = capture(error);

      expect(mapped).toBeInstanceOf(NotFoundException);
      expect((mapped as NotFoundException).getStatus()).toBe(404);
    }
  });

  it('maps state conflicts to 409', () => {
    for (const error of [
      new InvalidQuoteTransitionError(),
      new QuoteNotEditableError(),
    ]) {
      const mapped = capture(error);

      expect(mapped).toBeInstanceOf(ConflictException);
      expect((mapped as ConflictException).getStatus()).toBe(409);
    }
  });

  it('maps validation violations to 422 with the rule list', () => {
    const violations = [
      { code: 'CUSTOMER_INACTIVE', message: 'Customer is not active' },
      { code: 'TOTAL_NOT_POSITIVE', message: 'Total must be positive' },
    ];
    const mapped = capture(new QuoteValidationError(violations));

    expect(mapped).toBeInstanceOf(UnprocessableEntityException);
    expect((mapped as UnprocessableEntityException).getStatus()).toBe(422);
    expect((mapped as UnprocessableEntityException).getResponse()).toEqual({
      message: 'Quote does not satisfy the sending requirements',
      errors: violations,
    });
  });

  it('maps unknown, duplicated or foreign child ids to 422', () => {
    const mapped = capture(new UnknownQuoteItemError('Unknown curtain id'));

    expect(mapped).toBeInstanceOf(UnprocessableEntityException);
    expect((mapped as UnprocessableEntityException).getStatus()).toBe(422);
    expect((mapped as UnprocessableEntityException).message).toBe(
      'Unknown curtain id',
    );
  });

  it('rethrows unexpected errors so Nest answers a generic 500', () => {
    const unexpected = new Error('database credentials leaked?');

    expect(capture(unexpected)).toBe(unexpected);
  });
});
