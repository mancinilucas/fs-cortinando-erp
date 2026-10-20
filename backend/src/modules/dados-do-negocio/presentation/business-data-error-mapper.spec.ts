import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessDataNotFoundError } from '../application/business-data-not-found.error.js';
import { BusinessDataValidationError } from '../application/business-data-validation.error.js';
import { mapBusinessDataError } from './business-data-error-mapper.js';

describe('mapBusinessDataError', () => {
  it('maps an unconfigured business to 404 with the application message', () => {
    let mapped: unknown;

    try {
      mapBusinessDataError(new BusinessDataNotFoundError());
    } catch (error) {
      mapped = error;
    }

    expect(mapped).toBeInstanceOf(NotFoundException);
    expect((mapped as NotFoundException).getStatus()).toBe(404);
    expect((mapped as NotFoundException).message).toBe(
      'Business data is not configured',
    );
  });

  it('maps an invariant violation to 400 with the application message', () => {
    let mapped: unknown;

    try {
      mapBusinessDataError(
        new BusinessDataValidationError('Phone is required'),
      );
    } catch (error) {
      mapped = error;
    }

    expect(mapped).toBeInstanceOf(BadRequestException);
    expect((mapped as BadRequestException).getStatus()).toBe(400);
    expect((mapped as BadRequestException).message).toBe('Phone is required');
  });

  it('rethrows unexpected errors so they stay generic 500 responses', () => {
    const persistenceError = new Error('P2025: record not found');

    expect(() => mapBusinessDataError(persistenceError)).toThrow(
      persistenceError,
    );
  });
});
