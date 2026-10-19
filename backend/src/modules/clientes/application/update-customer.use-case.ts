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

    customer.update(input);
    await this.customers.save(customer);

    return customer;
  }
}
