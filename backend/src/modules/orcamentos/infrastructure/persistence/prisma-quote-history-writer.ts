import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteHistoryWriter } from '../../application/ports/quote-history-writer.port.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';

// Inserts a single history row and nothing else (D183). It never loads or
// saves the Quote aggregate, so quotes.updatedAt and the child rows are left
// untouched.
@Injectable()
export class PrismaQuoteHistoryWriter extends QuoteHistoryWriter {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async append(input: {
    quoteId: string;
    event: QuoteHistoryEventDraft;
    occurredAt: Date;
  }): Promise<void> {
    await this.prisma.quoteHistory.create({
      data: {
        quoteId: input.quoteId,
        eventType: input.event.type,
        occurredAt: input.occurredAt,
        details:
          input.event.details === undefined
            ? Prisma.DbNull
            : (input.event.details as Prisma.InputJsonValue),
      },
    });
  }
}
