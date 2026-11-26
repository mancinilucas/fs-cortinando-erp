import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type { Quote } from '../../domain/entities/quote.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import {
  QuoteRepository,
  type QuoteCreation,
  type QuoteMutation,
} from '../../domain/repositories/quote.repository.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import { PrismaQuoteSequence } from './prisma-quote-sequence.js';
import { QuoteMapper } from './quote.mapper.js';

// Moving the surviving curtains out of the 1..N range before writing their
// final sequences avoids transient unique violations when they are reordered.
const SEQUENCE_OFFSET = 1_000_000;

// Prisma adapter for the Quote aggregate (D112). findById loads the complete
// aggregate; history is never loaded with it (D108). Every write runs in one
// interactive transaction so state and history never diverge (D119).
@Injectable()
export class PrismaQuoteRepository extends QuoteRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequence: PrismaQuoteSequence,
  ) {
    super();
  }

  async findById(id: string): Promise<Quote | null> {
    return this.load(this.prisma, id);
  }

  private async load(
    client: Prisma.TransactionClient,
    id: string,
    options: { lock?: boolean } = {},
  ): Promise<Quote | null> {
    if (options.lock === true) {
      // Prisma loads relations with separate statements, so a concurrent hard
      // delete could commit between them and yield a partial aggregate under
      // READ COMMITTED. Locking the quote row first makes the whole load
      // consistent: the delete either finishes before it (no row) or waits
      // for the write transaction (D119/D120).
      const locked = await client.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM quotes WHERE id = ${id}::uuid FOR UPDATE
      `;

      if (locked.length === 0) {
        return null;
      }
    }

    const record = await client.quote.findUnique({
      where: { id },
      include: {
        curtains: { orderBy: { sequence: 'asc' } },
        financialItems: true,
      },
    });

    return record === null ? null : QuoteMapper.toDomain(record);
  }

  async create(
    year: number,
    build: (quoteNumber: QuoteNumber) => QuoteCreation,
  ): Promise<Quote> {
    return this.prisma.$transaction(async (tx) => {
      const reserved = await this.sequence.reserveInTransaction(tx, year);
      const { quote, event } = build(QuoteNumber.create(year, reserved));

      await tx.quote.create({
        data: {
          id: quote.id,
          ...QuoteMapper.toPersistence(quote),
          curtains: {
            create: quote.curtains.map((curtain) =>
              QuoteMapper.curtainToPersistence(curtain),
            ),
          },
        },
      });

      // Financial items are written after their quote and curtains exist in
      // the same transaction, so the optional composite foreign key can bind
      // each item to a curtain of the same quote.
      if (quote.financialItems.length > 0) {
        await tx.financialItem.createMany({
          data: quote.financialItems.map((item) =>
            QuoteMapper.financialItemToPersistence(item),
          ),
        });
      }

      await this.insertHistory(tx, quote.id, event);

      return quote;
    });
  }

  async save(quote: Quote, event: QuoteHistoryEventDraft): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          ...QuoteMapper.toPersistence(quote),
          updatedAt: new Date(),
        },
      });

      await this.reconcileCurtains(tx, quote);
      await this.reconcileFinancialItems(tx, quote);
      await this.insertHistory(tx, quote.id, event);
    });
  }

  async mutate(id: string, operation: QuoteMutation): Promise<Quote | null> {
    return this.prisma.$transaction(async (tx) => {
      const quote = await this.load(tx, id, { lock: true });

      if (quote === null) {
        return null;
      }

      const expectedStatus = quote.status;
      const event = operation(quote);

      if (event === null) {
        return quote;
      }

      // The guarded update makes the write conditional on the status read
      // inside this transaction. An edit racing another edit still wins by
      // last write (D120), but a status change performed in between is never
      // overwritten (D119/D120).
      const written = await tx.quote.updateMany({
        where: { id, status: expectedStatus },
        data: {
          ...QuoteMapper.toPersistence(quote),
          updatedAt: new Date(),
        },
      });

      if (written.count === 0) {
        const current = await tx.quote.findUnique({
          where: { id },
          select: { status: true },
        });

        if (current === null) {
          return null;
        }

        throw new InvalidQuoteTransitionError(
          `Quote status changed from ${expectedStatus} to ${current.status}`,
        );
      }

      await this.reconcileCurtains(tx, quote);
      await this.reconcileFinancialItems(tx, quote);
      await this.insertHistory(tx, quote.id, event);

      return quote;
    });
  }

  private async insertHistory(
    tx: Prisma.TransactionClient,
    quoteId: string,
    event: QuoteHistoryEventDraft,
  ): Promise<void> {
    await tx.quoteHistory.create({
      data: {
        quoteId,
        eventType: event.type,
        details:
          event.details === undefined
            ? Prisma.DbNull
            : (event.details as Prisma.InputJsonValue),
      },
    });
  }

  private async reconcileCurtains(
    tx: Prisma.TransactionClient,
    quote: Quote,
  ): Promise<void> {
    const existing = await tx.curtain.findMany({
      where: { quoteId: quote.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const requestedIds = quote.curtains.map((curtain) => curtain.id);

    await tx.curtain.deleteMany({
      where: { quoteId: quote.id, id: { notIn: requestedIds } },
    });

    if (existingIds.size > 0) {
      await tx.curtain.updateMany({
        where: { quoteId: quote.id },
        data: { sequence: { increment: SEQUENCE_OFFSET } },
      });
    }

    for (const curtain of quote.curtains) {
      const data = QuoteMapper.curtainToPersistence(curtain);

      if (existingIds.has(curtain.id)) {
        await tx.curtain.update({ where: { id: curtain.id }, data });
      } else {
        await tx.curtain.create({
          data: { ...data, quoteId: quote.id },
        });
      }
    }
  }

  // The financial composition is one collection whose items are optionally
  // associated with a curtain (PROJECT_SPEC §2.4-2.5). Updates run after
  // curtains, so an item can move between curtains and the general
  // composition while keeping its id; items omitted from the aggregate are
  // removed. Deleting a curtain cascades to its items, and the aggregate never
  // keeps them in that case.
  private async reconcileFinancialItems(
    tx: Prisma.TransactionClient,
    quote: Quote,
  ): Promise<void> {
    const existing = await tx.financialItem.findMany({
      where: { quoteId: quote.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const requestedIds = quote.financialItems.map((item) => item.id);

    await tx.financialItem.deleteMany({
      where: { quoteId: quote.id, id: { notIn: requestedIds } },
    });

    for (const item of quote.financialItems) {
      const data = QuoteMapper.financialItemToPersistence(item);

      if (existingIds.has(item.id)) {
        await tx.financialItem.update({
          where: { id: item.id },
          data,
        });
      } else {
        await tx.financialItem.create({ data });
      }
    }
  }

  async deleteDraft(id: string): Promise<boolean> {
    const result = await this.prisma.quote.deleteMany({
      where: { id, status: 'DRAFT' },
    });

    return result.count > 0;
  }
}
