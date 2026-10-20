import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import {
  CustomerContact,
  GetCustomerContactQuery,
} from '../application/get-customer-contact.query.js';

@Injectable()
export class PrismaGetCustomerContactQuery implements GetCustomerContactQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(customerId: string): Promise<CustomerContact | null> {
    // findUnique does not filter deletedAt on purpose (D155): the quote keeps
    // being reissuable after the customer is soft-deleted. The select keeps
    // email, taxId, address and notes out of the projection.
    const record = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true, phone: true },
    });

    return record;
  }
}
