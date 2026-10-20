import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type { Quote } from '../../domain/entities/quote.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteMapper } from './quote.mapper.js';

// Prisma adapter for the Quote aggregate (D112). findById loads the complete
// aggregate; history is never loaded with it (D108).
@Injectable()
export class PrismaQuoteRepository extends QuoteRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Quote | null> {
    const record = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        curtains: {
          include: { components: true },
          orderBy: { sequence: 'asc' },
        },
        generalAddOns: true,
      },
    });

    return record === null ? null : QuoteMapper.toDomain(record);
  }

  // Implemented by ORCAMENTO-22/23.
  async create(): Promise<Quote> {
    throw new Error('Quote creation is not implemented yet');
  }

  async save(_quote: Quote, _event: QuoteHistoryEventDraft): Promise<void> {
    throw new Error('Quote persistence is not implemented yet');
  }

  async deleteDraft(): Promise<boolean> {
    throw new Error('Draft deletion is not implemented yet');
  }
}
