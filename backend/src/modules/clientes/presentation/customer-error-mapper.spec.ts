import { NotFoundException } from '@nestjs/common';
import { CustomerNotFoundError } from '../application/customer-not-found.error.js';
import { mapCustomerError } from './customer-error-mapper.js';

describe('mapCustomerError', () => {
  it('maps a missing customer to 404 with the application message', () => {
    let mapped: unknown;

    try {
      mapCustomerError(new CustomerNotFoundError());
    } catch (error) {
      mapped = error;
    }

    expect(mapped).toBeInstanceOf(NotFoundException);
    expect((mapped as NotFoundException).getStatus()).toBe(404);
    expect((mapped as NotFoundException).message).toBe('Customer not found');
  });

  it('rethrows unexpected errors so they stay generic 500 responses', () => {
    const persistenceError = new Error('P2025: record not found');

    expect(() => mapCustomerError(persistenceError)).toThrow(persistenceError);
  });

  it('never turns persistence errors into client errors', () => {
    const persistenceError = Object.assign(new Error('unique constraint'), {
      code: 'P2002',
    });

    let mapped: unknown;

    try {
      mapCustomerError(persistenceError);
    } catch (error) {
      mapped = error;
    }

    expect(mapped).toBe(persistenceError);
    expect(mapped).not.toBeInstanceOf(NotFoundException);
  });
});
