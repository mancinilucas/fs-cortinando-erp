import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { Customer } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { CustomerMapper } from './customer.mapper.js';

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    return record === null ? null : CustomerMapper.toDomain(record);
  }

  async findByIdIncludingDeleted(id: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({ where: { id } });

    return record === null ? null : CustomerMapper.toDomain(record);
  }

  async save(customer: Customer): Promise<void> {
    const data = CustomerMapper.toPersistence(customer);

    await this.prisma.customer.upsert({
      where: { id: customer.id },
      create: { id: customer.id, ...data },
      update: data,
    });
  }
}
