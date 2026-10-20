import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import {
  QuoteHistoryQueryRepository,
  type QuoteHistoryEntry,
} from '../../application/ports/quote-history-query.repository.js';

@Injectable()
export class PrismaQuoteHistoryQueryRepository extends QuoteHistoryQueryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listByQuoteId(quoteId: string): Promise<QuoteHistoryEntry[] | null> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true },
    });

    if (quote === null) {
      return null;
    }

    const rows = await this.prisma.quoteHistory.findMany({
      where: { quoteId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      occurredAt: row.occurredAt,
      details: row.details,
    }));
  }
}
