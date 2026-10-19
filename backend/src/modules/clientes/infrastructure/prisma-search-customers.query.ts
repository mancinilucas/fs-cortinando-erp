import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import {
  CustomerSummary,
  SearchCustomersQuery,
} from '../application/search-customers.query.js';

@Injectable()
export class PrismaSearchCustomersQuery implements SearchCustomersQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(search?: string): Promise<CustomerSummary[]> {
    const term = search?.trim() ?? '';

    return this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(term === ''
          ? {}
          : { name: { contains: term, mode: 'insensitive' } }),
      },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}
