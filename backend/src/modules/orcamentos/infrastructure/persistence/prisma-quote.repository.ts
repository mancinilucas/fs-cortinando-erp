import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type { Curtain } from '../../domain/entities/curtain.js';
import type { Quote } from '../../domain/entities/quote.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import {
  QuoteRepository,
  type QuoteCreation,
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
            create: quote.curtains.map((curtain) => ({
              ...QuoteMapper.curtainToPersistence(curtain),
              components: {
                create: curtain.components.map((component) =>
                  QuoteMapper.financialItemToPersistence(component),
                ),
              },
            })),
          },
          generalAddOns: {
            create: quote.generalAddOns.map((addOn) =>
              QuoteMapper.financialItemToPersistence(addOn),
            ),
          },
        },
      });

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
      await this.reconcileGeneralAddOns(tx, quote);
      await this.insertHistory(tx, quote.id, event);
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

      await this.reconcileComponents(tx, curtain);
    }
  }

  private async reconcileComponents(
    tx: Prisma.TransactionClient,
    curtain: Curtain,
  ): Promise<void> {
    const existing = await tx.financialComponent.findMany({
      where: { curtainId: curtain.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const requestedIds = curtain.components.map((component) => component.id);

    await tx.financialComponent.deleteMany({
      where: { curtainId: curtain.id, id: { notIn: requestedIds } },
    });

    for (const component of curtain.components) {
      const data = QuoteMapper.financialItemToPersistence(component);

      if (existingIds.has(component.id)) {
        await tx.financialComponent.update({
          where: { id: component.id },
          data,
        });
      } else {
        await tx.financialComponent.create({
          data: { ...data, curtainId: curtain.id },
        });
      }
    }
  }

  private async reconcileGeneralAddOns(
    tx: Prisma.TransactionClient,
    quote: Quote,
  ): Promise<void> {
    const existing = await tx.generalAddOn.findMany({
      where: { quoteId: quote.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const requestedIds = quote.generalAddOns.map((addOn) => addOn.id);

    await tx.generalAddOn.deleteMany({
      where: { quoteId: quote.id, id: { notIn: requestedIds } },
    });

    for (const addOn of quote.generalAddOns) {
      const data = QuoteMapper.financialItemToPersistence(addOn);

      if (existingIds.has(addOn.id)) {
        await tx.generalAddOn.update({ where: { id: addOn.id }, data });
      } else {
        await tx.generalAddOn.create({
          data: { ...data, quoteId: quote.id },
        });
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
