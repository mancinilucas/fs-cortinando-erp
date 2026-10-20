import { Injectable } from '@nestjs/common';
import { Customer, CreateCustomerInput } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';

@Injectable()
export class CreateCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    const customer = Customer.create(input);

    await this.customers.save(customer);

    return customer;
  }
}
