import { Injectable } from '@nestjs/common';
import { Customer } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { CustomerNotFoundError } from './customer-not-found.error.js';

@Injectable()
export class GetCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.customers.findActiveById(id);

    if (customer === null) {
      throw new CustomerNotFoundError();
    }

    return customer;
  }
}
