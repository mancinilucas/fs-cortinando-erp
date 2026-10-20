import { randomUUID } from 'node:crypto';
import {
  BusinessDataStore,
  type BusinessDataRecord,
  type BusinessDataValues,
} from '../../../dados-do-negocio/application/business-data-store.js';
import { GetBusinessDataQuery } from '../../../dados-do-negocio/application/get-business-data.query.js';
import {
  GetCustomerContactQuery,
  type CustomerContact,
} from '../../../clientes/application/get-customer-contact.query.js';
import { Curtain } from '../../domain/entities/curtain.js';
import {
  Quote,
  QuoteStatus,
  type QuoteSnapshot,
} from '../../domain/entities/quote.js';
import {
  QuoteRepository,
  type QuoteCreation,
  type QuoteMutation,
} from '../../domain/repositories/quote.repository.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import type { CommercialPdfProjection } from '../documents/document-projections.js';
import { QuoteDocumentRenderer } from '../documents/quote-document-renderer.js';
import { BusinessDataNotConfiguredError } from '../errors/business-data-not-configured.error.js';
import { DocumentCustomerNotFoundError } from '../errors/document-customer-not-found.error.js';
import { DocumentDataIncompleteError } from '../errors/document-data-incomplete.error.js';
import { DocumentHistoryWriteError } from '../errors/document-history-write.error.js';
import { DocumentNotAvailableError } from '../errors/document-not-available.error.js';
import { DocumentRenderError } from '../errors/document-render.error.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { QuoteHistoryWriter } from '../ports/quote-history-writer.port.js';
import { GenerateCommercialPdfUseCase } from './generate-commercial-pdf.use-case.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const OCCURRED_AT = new Date('2026-10-20T12:00:05.000Z');
const FUTURE = new Date('2026-11-19T12:00:00.000Z');
const PAST = new Date('2026-10-01T12:00:00.000Z');
const CUSTOMER_ID = randomUUID();

const BUSINESS_RECORD: BusinessDataRecord = {
  commercialNameOrConsultant: 'Cortinando',
  phone: '(11) 99999-9999',
  email: 'contato@example.com',
  taxId: '12345678901',
  updatedAt: NOW,
};

const CONTACT: CustomerContact = {
  name: 'Maria Silva',
  phone: '(11) 98888-7777',
};

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

class FakeBusinessDataStore extends BusinessDataStore {
  record: BusinessDataRecord | null;
  findCalls = 0;

  constructor(record: BusinessDataRecord | null) {
    super();
    this.record = record;
  }

  async find(): Promise<BusinessDataRecord | null> {
    this.findCalls += 1;

    return this.record;
  }

  async upsert(_values: BusinessDataValues): Promise<BusinessDataRecord> {
    throw new Error('not used');
  }
}

class FakeCustomerContactQuery extends GetCustomerContactQuery {
  contact: CustomerContact | null;
  calls: string[] = [];

  constructor(contact: CustomerContact | null) {
    super();
    this.contact = contact;
  }

  async execute(customerId: string): Promise<CustomerContact | null> {
    this.calls.push(customerId);

    return this.contact;
  }
}

class FakeRenderer extends QuoteDocumentRenderer {
  readonly bytes = new Uint8Array([37, 80, 68, 70]);
  projection: CommercialPdfProjection | null = null;
  error: Error | null = null;
  calls = 0;

  constructor(private readonly order: string[]) {
    super();
  }

  async renderCommercialPdf(
    projection: CommercialPdfProjection,
  ): Promise<Uint8Array> {
    this.order.push('render');
    this.calls += 1;

    if (this.error !== null) {
      throw this.error;
    }

    this.projection = projection;

    return this.bytes;
  }

  async renderProductionOrder(): Promise<Uint8Array> {
    throw new Error('not used');
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

function makeQuote(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: randomUUID(),
    quoteNumber: QuoteNumber.create(2026, 7),
    customerId: CUSTOMER_ID,
    status: QuoteStatus.SENT,
    installationAddress: null,
    curtains: [Curtain.create({ room: 'Sala' })],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    firstSentAt: NOW,
    validUntil: FUTURE,
    confirmedAt: null,
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
  const store = new FakeBusinessDataStore(BUSINESS_RECORD);
  const customers = new FakeCustomerContactQuery(CONTACT);
  const renderer = new FakeRenderer(order);
  const history = new FakeHistoryWriter(order);
  const useCase = new GenerateCommercialPdfUseCase(
    repository,
    new GetBusinessDataQuery(store),
    customers,
    renderer,
    history,
    { now: () => new Date(OCCURRED_AT) },
  );

  return { useCase, repository, store, customers, renderer, history, order };
}

describe('GenerateCommercialPdfUseCase', () => {
  it('returns DRAFT preview bytes without writing history', async () => {
    const quote = makeQuote({
      status: QuoteStatus.DRAFT,
      firstSentAt: null,
      validUntil: null,
    });
    const { useCase, renderer, history } = setup(quote);

    await expect(useCase.execute({ id: quote.id })).resolves.toBe(
      renderer.bytes,
    );

    expect(history.appends).toHaveLength(0);
    expect(renderer.projection).toMatchObject({
      quoteNumber: 'ORÇ-2026-007',
      businessIdentity: {
        commercialNameOrConsultant: 'Cortinando',
        phone: '(11) 99999-9999',
        email: 'contato@example.com',
        taxId: '12345678901',
      },
      customer: CONTACT,
      serviceLines: [{ room: 'Sala' }],
    });
    expect(renderer.projection).not.toHaveProperty('totalCents');
    expect(renderer.projection).not.toHaveProperty('validUntil');
  });

  it('rejects a preview without any curtain room', async () => {
    const quote = makeQuote({
      status: QuoteStatus.DRAFT,
      firstSentAt: null,
      validUntil: null,
      curtains: [Curtain.create({ room: null })],
    });
    const { useCase, renderer, history } = setup(quote);

    await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
      DocumentDataIncompleteError,
    );

    expect(renderer.calls).toBe(0);
    expect(history.appends).toHaveLength(0);
  });

  it('renders before appending the event in a generation state', async () => {
    const quote = makeQuote();
    const { useCase, renderer, history, order } = setup(quote);

    await expect(useCase.execute({ id: quote.id })).resolves.toBe(
      renderer.bytes,
    );

    expect(order).toEqual(['render', 'history']);
    expect(history.appends).toEqual([
      {
        quoteId: quote.id,
        event: { type: 'COMMERCIAL_PDF_GENERATED' },
        occurredAt: OCCURRED_AT,
      },
    ]);
  });

  it('treats an EXPIRED quote as a generation', async () => {
    const quote = makeQuote({ validUntil: PAST });
    const { useCase, history } = setup(quote);

    expect(quote.isExpired(NOW)).toBe(true);

    await useCase.execute({ id: quote.id });

    expect(history.appends).toHaveLength(1);
    expect(history.appends[0].event.type).toBe('COMMERCIAL_PDF_GENERATED');
  });

  it.each([
    QuoteStatus.CONFIRMED,
    QuoteStatus.IN_PRODUCTION,
    QuoteStatus.COMPLETED,
  ])('records generation from %s', async (status) => {
    const quote = makeQuote({ status });
    const { useCase, history } = setup(quote);

    await useCase.execute({ id: quote.id });

    expect(history.appends).toHaveLength(1);
    expect(history.appends[0]).toMatchObject({
      quoteId: quote.id,
      event: { type: 'COMMERCIAL_PDF_GENERATED' },
      occurredAt: OCCURRED_AT,
    });
  });

  it('rejects CANCELLED before fetching any document data', async () => {
    const quote = makeQuote({ status: QuoteStatus.CANCELLED });
    const { useCase, store, customers, renderer, history } = setup(quote);

    await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
      DocumentNotAvailableError,
    );

    expect(store.findCalls).toBe(0);
    expect(customers.calls).toHaveLength(0);
    expect(renderer.calls).toBe(0);
    expect(history.appends).toHaveLength(0);
  });

  it('rejects a quote that does not exist', async () => {
    const { useCase } = setup(null);

    await expect(useCase.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it('translates an unconfigured business into a document error', async () => {
    const quote = makeQuote();
    const { useCase, store, customers, renderer, history } = setup(quote);
    store.record = null;

    await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
      BusinessDataNotConfiguredError,
    );

    expect(customers.calls).toHaveLength(0);
    expect(renderer.calls).toBe(0);
    expect(history.appends).toHaveLength(0);
  });

  it('rejects when the quote customer cannot be found', async () => {
    const quote = makeQuote();
    const { useCase, customers, renderer, history } = setup(quote);
    customers.contact = null;

    await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
      DocumentCustomerNotFoundError,
    );

    expect(renderer.calls).toBe(0);
    expect(history.appends).toHaveLength(0);
  });

  it('rejects a generation without validity', async () => {
    const quote = makeQuote({ validUntil: null });
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

  it('appends one event per generation request', async () => {
    const quote = makeQuote();
    const { useCase, history } = setup(quote);

    await useCase.execute({ id: quote.id });
    await useCase.execute({ id: quote.id });

    expect(history.appends.map((append) => append.event.type)).toEqual([
      'COMMERCIAL_PDF_GENERATED',
      'COMMERCIAL_PDF_GENERATED',
    ]);
  });
});
