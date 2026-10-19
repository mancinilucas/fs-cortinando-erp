import { Injectable } from '@nestjs/common';
import { Customer, UpdateCustomerInput } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { CustomerNotFoundError } from './customer-not-found.error.js';

@Injectable()
export class UpdateCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(id: string, input: UpdateCustomerInput): Promise<Customer> {
    const customer = await this.customers.findActiveById(id);

    if (customer === null) {
      throw new CustomerNotFoundError();
    }

    // D62: an empty patch is a no-op, so it must not rewrite the row nor bump
    // the persistence-managed updatedAt.
    if (Object.values(input).every((value) => value === undefined)) {
      return customer;
    }

    customer.update(input);
    await this.customers.save(customer);

    return customer;
  }
}
