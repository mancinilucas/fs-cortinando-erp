import { Injectable } from '@nestjs/common';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { CustomerNotFoundError } from './customer-not-found.error.js';

@Injectable()
export class DeleteCustomerUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(id: string): Promise<void> {
    const customer = await this.customers.findByIdIncludingDeleted(id);

    if (customer === null) {
      throw new CustomerNotFoundError();
    }

    if (customer.deletedAt !== null) {
      return;
    }

    customer.softDelete();
    await this.customers.save(customer);
  }
}
