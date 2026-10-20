import { randomUUID } from 'node:crypto';
import { Curtain } from '../../domain/entities/curtain.js';
import {
  Quote,
  QuoteStatus,
  type QuoteSnapshot,
} from '../../domain/entities/quote.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import {
  QuoteRepository,
  type QuoteCreation,
  type QuoteMutation,
} from '../../domain/repositories/quote.repository.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import type { ProductionOrderProjection } from '../documents/document-projections.js';
import { QuoteDocumentRenderer } from '../documents/quote-document-renderer.js';
import { DocumentDataIncompleteError } from '../errors/document-data-incomplete.error.js';
import { DocumentHistoryWriteError } from '../errors/document-history-write.error.js';
import { DocumentNotAvailableError } from '../errors/document-not-available.error.js';
import { DocumentRenderError } from '../errors/document-render.error.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { QuoteHistoryWriter } from '../ports/quote-history-writer.port.js';
import { GenerateProductionOrderUseCase } from './generate-production-order.use-case.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const OCCURRED_AT = new Date('2026-10-20T12:00:05.000Z');
const FUTURE = new Date('2026-11-19T12:00:00.000Z');
const PAST = new Date('2026-10-01T12:00:00.000Z');

class FakeQuoteRepository extends QuoteRepository {
  quote: Quote | null = null;

  async findById(_id: string): Promise<Quote | null> {
    return this.quote;
  }

  async create(
    _year: number,
    _build: (quoteNumber: QuoteNumber) => QuoteCreation,
  ): Promise<Quote> {
    throw new Error('not used');
  }

  async save(_quote: Quote, _event: QuoteHistoryEventDraft): Promise<void> {
    throw new Error('not used');
  }

  async mutate(_id: string, _operation: QuoteMutation): Promise<Quote | null> {
    throw new Error('not used');
  }

  async deleteDraft(_id: string): Promise<boolean> {
    throw new Error('not used');
  }
}

class FakeRenderer extends QuoteDocumentRenderer {
  readonly bytes = new Uint8Array([37, 80, 68, 70]);
  projection: ProductionOrderProjection | null = null;
  error: Error | null = null;
  calls = 0;

  constructor(private readonly order: string[]) {
    super();
  }

  async renderCommercialPdf(): Promise<Uint8Array> {
    throw new Error('not used');
  }

  async renderProductionOrder(
    projection: ProductionOrderProjection,
  ): Promise<Uint8Array> {
    this.order.push('render');
    this.calls += 1;

    if (this.error !== null) {
      throw this.error;
    }

    this.projection = projection;

    return this.bytes;
  }
}

interface AppendCall {
  quoteId: string;
  event: QuoteHistoryEventDraft;
  occurredAt: Date;
}

class FakeHistoryWriter extends QuoteHistoryWriter {
  appends: AppendCall[] = [];
  error: Error | null = null;

  constructor(private readonly order: string[]) {
    super();
  }

  async append(input: AppendCall): Promise<void> {
    this.order.push('history');

    if (this.error !== null) {
      throw this.error;
    }

    this.appends.push(input);
  }
}

function makeCurtain(
  input: {
    room?: string | null;
    material?: string | null;
    openingWidth?: number | null;
    height?: number | null;
  } = {},
): Curtain {
  return Curtain.create({
    sequence: 1,
    room: input.room === undefined ? 'Sala' : input.room,
    material: input.material === undefined ? 'Linho' : input.material,
    openingWidth: input.openingWidth === undefined ? 2.6 : input.openingWidth,
    height: input.height === undefined ? 2.65 : input.height,
  });
}

function makeQuote(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: randomUUID(),
    quoteNumber: QuoteNumber.create(2026, 8),
    customerId: randomUUID(),
    status: QuoteStatus.CONFIRMED,
    installationAddress: null,
    curtains: [makeCurtain()],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    firstSentAt: NOW,
    validUntil: FUTURE,
    confirmedAt: NOW,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

function setup(quote: Quote | null) {
  const order: string[] = [];
  const repository = new FakeQuoteRepository();
  repository.quote = quote;
  const renderer = new FakeRenderer(order);
  const history = new FakeHistoryWriter(order);
  const useCase = new GenerateProductionOrderUseCase(
    repository,
    renderer,
    history,
    { now: () => new Date(OCCURRED_AT) },
  );

  return { useCase, repository, renderer, history, order };
}

describe('GenerateProductionOrderUseCase', () => {
  it('renders the technical projection before appending the event', async () => {
    const quote = makeQuote();
    const { useCase, renderer, history, order } = setup(quote);

    await expect(useCase.execute({ id: quote.id })).resolves.toBe(
      renderer.bytes,
    );

    expect(order).toEqual(['render', 'history']);
    expect(renderer.projection).toEqual({
      quoteNumber: 'ORÇ-2026-008',
      curtains: [
        {
          sequence: 1,
          room: 'Sala',
          material: 'Linho',
          finalWidth: 2.9,
          height: 2.65,
        },
      ],
    });
    expect(history.appends).toEqual([
      {
        quoteId: quote.id,
        event: { type: 'PRODUCTION_ORDER_GENERATED' },
        occurredAt: OCCURRED_AT,
      },
    ]);
  });

  it.each([QuoteStatus.IN_PRODUCTION, QuoteStatus.COMPLETED])(
    'records generation from %s',
    async (status) => {
      const quote = makeQuote({ status });
      const { useCase, history } = setup(quote);

      await useCase.execute({ id: quote.id });

      expect(history.appends).toHaveLength(1);
      expect(history.appends[0]).toMatchObject({
        quoteId: quote.id,
        event: { type: 'PRODUCTION_ORDER_GENERATED' },
        occurredAt: OCCURRED_AT,
      });
    },
  );

  it.each([QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.CANCELLED])(
    'rejects %s',
    async (status) => {
      const quote = makeQuote({ status });
      const { useCase, renderer, history } = setup(quote);

      await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
        DocumentNotAvailableError,
      );

      expect(renderer.calls).toBe(0);
      expect(history.appends).toHaveLength(0);
    },
  );

  it('rejects an EXPIRED quote (SENT with elapsed validity)', async () => {
    const quote = makeQuote({
      status: QuoteStatus.SENT,
      validUntil: PAST,
    });
    const { useCase, renderer, history } = setup(quote);

    expect(quote.isExpired(NOW)).toBe(true);

    await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
      DocumentNotAvailableError,
    );

    expect(renderer.calls).toBe(0);
    expect(history.appends).toHaveLength(0);
  });

  it('rejects a quote that does not exist', async () => {
    const { useCase } = setup(null);

    await expect(useCase.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it.each([
    ['room', makeCurtain({ room: null })],
    ['material', makeCurtain({ material: null })],
    ['height', makeCurtain({ height: null })],
    ['final width', makeCurtain({ openingWidth: null })],
  ])('rejects incomplete technical data: %s', async (_label, curtain) => {
    const quote = makeQuote({ curtains: [curtain] });
    const { useCase, renderer, history } = setup(quote);

    await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
      DocumentDataIncompleteError,
    );

    expect(renderer.calls).toBe(0);
    expect(history.appends).toHaveLength(0);
  });

  it('does not write history when rendering fails', async () => {
    const quote = makeQuote();
    const { useCase, renderer, history } = setup(quote);
    const renderError = new DocumentRenderError(new Error('library failure'));
    renderer.error = renderError;

    await expect(useCase.execute({ id: quote.id })).rejects.toBe(renderError);

    expect(history.appends).toHaveLength(0);
  });

  it('fails without returning bytes when history cannot be written', async () => {
    const quote = makeQuote();
    const { useCase, renderer, history } = setup(quote);
    const cause = new Error('insert failed');
    history.error = cause;

    const error = await useCase
      .execute({ id: quote.id })
      .catch((caught: unknown) => caught);

    expect(renderer.calls).toBe(1);
    expect(error).toBeInstanceOf(DocumentHistoryWriteError);
    expect((error as DocumentHistoryWriteError).cause).toBe(cause);
  });

  it('appends one event per reissue', async () => {
    const quote = makeQuote();
    const { useCase, history } = setup(quote);

    await useCase.execute({ id: quote.id });
    await useCase.execute({ id: quote.id });

    expect(history.appends.map((append) => append.event.type)).toEqual([
      'PRODUCTION_ORDER_GENERATED',
      'PRODUCTION_ORDER_GENERATED',
    ]);
  });
});
