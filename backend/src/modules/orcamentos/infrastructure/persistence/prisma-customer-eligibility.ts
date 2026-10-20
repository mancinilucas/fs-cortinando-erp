import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { CustomerEligibility } from '../../application/ports/customer-eligibility.port.js';

// Existence and soft-delete check used when a quote is created and sent
// (D78/D97). Only active customers are eligible.
@Injectable()
export class PrismaCustomerEligibility implements CustomerEligibility {
  constructor(private readonly prisma: PrismaService) {}

  async existsAndIsActive(customerId: string): Promise<boolean> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });

    return customer !== null;
  }
}
