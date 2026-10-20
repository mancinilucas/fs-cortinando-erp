import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { sessionCookieName } from '../src/modules/auth/presentation/session-cookie.js';
import { GetCustomerContactQuery } from '../src/modules/clientes/application/get-customer-contact.query.js';
import { GetBusinessDataQuery } from '../src/modules/dados-do-negocio/application/get-business-data.query.js';
import { QuoteDocumentRenderer } from '../src/modules/orcamentos/application/documents/quote-document-renderer.js';
import { BusinessDataNotConfiguredError } from '../src/modules/orcamentos/application/errors/business-data-not-configured.error.js';
import { DocumentHistoryWriteError } from '../src/modules/orcamentos/application/errors/document-history-write.error.js';
import { DocumentRenderError } from '../src/modules/orcamentos/application/errors/document-render.error.js';
import { Clock } from '../src/modules/orcamentos/application/ports/clock.port.js';
import { QuoteHistoryWriter } from '../src/modules/orcamentos/application/ports/quote-history-writer.port.js';
import { GenerateCommercialPdfUseCase } from '../src/modules/orcamentos/application/use-cases/generate-commercial-pdf.use-case.js';
import { GenerateProductionOrderUseCase } from '../src/modules/orcamentos/application/use-cases/generate-production-order.use-case.js';
import { QuoteRepository } from '../src/modules/orcamentos/domain/repositories/quote.repository.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';
import { extractPdfText } from './helpers/pdf-text.js';

// DOCUMENTOS-19: integration coverage of the document flows. The Application
// runs against the real Prisma persistence, BusinessData store and customer
// contact query. Quote setup uses the ordinary HTTP API; the document use
// cases are invoked directly so no document HTTP contract is exercised here
// (that belongs to DOCUMENTOS-20).

const ORIGIN = 'http://localhost:5173';

const BUSINESS_DATA = {
  commercialNameOrConsultant: 'Cortinando Documentos',
  phone: '(11) 99999-0000',
  email: 'documentos@example.com',
  taxId: '12345678000199',
};

const COMPLETE_ADDRESS = {
  postalCode: '01310-100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 10',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: string;
}

interface QuoteState {
  quote: Record<string, unknown>;
  curtains: { id: string; components: { id: string }[] }[];
  generalAddOns: { id: string }[];
}

class FailingRenderer extends QuoteDocumentRenderer {
  override async renderCommercialPdf(): Promise<Uint8Array> {
    throw new DocumentRenderError(new Error('forced render failure'));
  }

  override async renderProductionOrder(): Promise<Uint8Array> {
    throw new DocumentRenderError(new Error('forced render failure'));
  }
}

class FailingHistoryWriter extends QuoteHistoryWriter {
  async append(): Promise<void> {
    throw new Error('forced history failure');
  }
}

describe('Documents integration (e2e-style Application + PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;
  let customerIds: string[];

  let commercialPdf: GenerateCommercialPdfUseCase;
  let productionOrder: GenerateProductionOrderUseCase;
  let historyWriter: QuoteHistoryWriter;

  const email = `documentos-integration-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  beforeAll(async () => {
    originalAppOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = ORIGIN;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    commercialPdf = app.get(GenerateCommercialPdfUseCase);
    productionOrder = app.get(GenerateProductionOrderUseCase);
    historyWriter = app.get(QuoteHistoryWriter);

    userId = (
      await prisma.user.create({
        data: {
          email,
          passwordHash: await new Argon2PasswordHasher().hash(password),
        },
      })
    ).id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({ email, password })
      .expect(200);

    const prefix = `${sessionCookieName()}=`;
    const session = (
      loginResponse.headers['set-cookie'] as string[] | undefined
    )?.find((value) => value.startsWith(prefix));

    if (!session) {
      throw new Error('session cookie was not set');
    }

    cookie = session.slice(0, session.indexOf(';'));
  }, 30_000);

  beforeEach(async () => {
    customerIds = [];
    await prisma.businessData.deleteMany();
    await prisma.businessData.create({
      data: { id: 'business', ...BUSINESS_DATA },
    });
  });

  afterEach(async () => {
    if (customerIds.length > 0) {
      await prisma.quote.deleteMany({
        where: { customerId: { in: customerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
  });

  afterAll(async () => {
    await prisma.businessData.deleteMany();
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app.close();

    if (originalAppOrigin === undefined) {
      delete process.env.APP_ORIGIN;
    } else {
      process.env.APP_ORIGIN = originalAppOrigin;
    }
  });

  function server() {
    return app.getHttpServer();
  }

  function completeQuoteBody(): Record<string, unknown> {
    return {
      installationAddress: COMPLETE_ADDRESS,
      curtains: [
        {
          room: 'Sala',
          description: 'Janela principal',
          material: 'Linho',
          openingWidth: 2,
          borderValue: 0,
          height: 2.2,
          fabricFactor: 2,
          components: [
            { name: 'Tecido', quantity: 1, unit: 'm', unitPriceCents: 10_000 },
          ],
        },
      ],
      generalAddOns: [
        { name: 'Instalação', quantity: 1, unitPriceCents: 15_000 },
      ],
    };
  }

  async function createCustomer(name = `Cliente ${randomUUID()}`) {
    const response = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ name, phone: '(11) 98888-7777' })
      .expect(201);

    const id = response.body.id as string;
    customerIds.push(id);

    return { id, name };
  }

  async function createQuote(
    customerId: string,
    body: Record<string, unknown>,
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .post(`/clientes/${customerId}/orcamentos`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as QuoteDetail;
  }

  async function sendQuote(id: string): Promise<QuoteDetail> {
    const validUntil = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const response = await request(server())
      .post(`/orcamentos/${id}/enviar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ validUntil })
      .expect(200);

    return response.body as QuoteDetail;
  }

  async function createSentQuote(): Promise<{
    quote: QuoteDetail;
    customerName: string;
  }> {
    const customer = await createCustomer();
    const draft = await createQuote(customer.id, completeQuoteBody());
    const quote = await sendQuote(draft.id);

    return { quote, customerName: customer.name };
  }

  async function createConfirmedQuote(): Promise<{
    quote: QuoteDetail;
    customerName: string;
  }> {
    const { quote, customerName } = await createSentQuote();
    const response = await request(server())
      .post(`/orcamentos/${quote.id}/confirmar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(200);

    return { quote: response.body as QuoteDetail, customerName };
  }

  // Normalizes Decimal and Date values so states can be compared as plain
  // JSON, and orders nested collections deterministically.
  async function quoteState(id: string): Promise<QuoteState> {
    const row = await prisma.quote.findUniqueOrThrow({
      where: { id },
      include: {
        curtains: {
          include: { components: true },
          orderBy: { sequence: 'asc' },
        },
        generalAddOns: true,
      },
    });
    const state = JSON.parse(JSON.stringify(row)) as QuoteState;

    state.generalAddOns.sort((left, right) => left.id.localeCompare(right.id));

    for (const curtain of state.curtains) {
      curtain.components.sort((left, right) => left.id.localeCompare(right.id));
    }

    return state;
  }

  async function historyRows(id: string) {
    return prisma.quoteHistory.findMany({
      where: { quoteId: id },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }

  async function knownHistoryIds(id: string): Promise<Set<string>> {
    return new Set((await historyRows(id)).map((row) => row.id));
  }

  async function expectSingleNewEvent(
    quoteId: string,
    knownIds: Set<string>,
    eventType: string,
    since: Date,
  ) {
    const rows = await historyRows(quoteId);
    const added = rows.filter((row) => !knownIds.has(row.id));

    expect(added).toHaveLength(1);
    expect(added[0].eventType).toBe(eventType);
    expect(added[0].details).toBeNull();
    expect(added[0].occurredAt.getTime()).toBeGreaterThanOrEqual(
      since.getTime(),
    );

    return added[0];
  }

  describe('commercial PDF', () => {
    it('uses real business data and customer contact, appending one event', async () => {
      const { quote, customerName } = await createSentQuote();
      const before = await quoteState(quote.id);
      const customerBefore = await prisma.customer.findUniqueOrThrow({
        where: { id: quote.customerId },
      });
      const businessBefore = await prisma.businessData.findUniqueOrThrow({
        where: { id: 'business' },
      });
      const knownIds = await knownHistoryIds(quote.id);
      const startedAt = new Date();

      const bytes = await commercialPdf.execute({ id: quote.id });
      const { text } = await extractPdfText(bytes);

      expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
      expect(text).toContain(quote.quoteNumber);
      expect(text).toContain(BUSINESS_DATA.commercialNameOrConsultant);
      expect(text).toContain(customerName);

      expect(await quoteState(quote.id)).toEqual(before);
      expect(
        await prisma.customer.findUniqueOrThrow({
          where: { id: quote.customerId },
        }),
      ).toEqual(customerBefore);
      expect(
        await prisma.businessData.findUniqueOrThrow({
          where: { id: 'business' },
        }),
      ).toEqual(businessBefore);
      await expectSingleNewEvent(
        quote.id,
        knownIds,
        'COMMERCIAL_PDF_GENERATED',
        startedAt,
      );
    });

    it('regenerates without touching the quote and records one event per run', async () => {
      const { quote } = await createSentQuote();
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);
      const startedAt = new Date();

      await commercialPdf.execute({ id: quote.id });
      await commercialPdf.execute({ id: quote.id });

      expect(await quoteState(quote.id)).toEqual(before);

      const rows = await historyRows(quote.id);
      const added = rows.filter((row) => !knownIds.has(row.id));

      expect(added).toHaveLength(2);
      expect(added.map((row) => row.eventType)).toEqual([
        'COMMERCIAL_PDF_GENERATED',
        'COMMERCIAL_PDF_GENERATED',
      ]);
      for (const row of added) {
        expect(row.occurredAt.getTime()).toBeGreaterThanOrEqual(
          startedAt.getTime(),
        );
      }
    });

    it('previews a DRAFT without writing history', async () => {
      const customer = await createCustomer();
      const draft = await createQuote(customer.id, {
        curtains: [{ room: 'Sala' }],
      });
      const before = await quoteState(draft.id);
      const knownIds = await knownHistoryIds(draft.id);

      const bytes = await commercialPdf.execute({ id: draft.id });
      const { text } = await extractPdfText(bytes);

      expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
      expect(text).not.toContain('VALOR TOTAL DO SERVIÇO');

      expect(await quoteState(draft.id)).toEqual(before);
      expect(await historyRows(draft.id)).toHaveLength(knownIds.size);
    });

    it('fails before rendering and history when business data is missing', async () => {
      const { quote } = await createSentQuote();
      await prisma.businessData.deleteMany();
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);

      await expect(
        commercialPdf.execute({ id: quote.id }),
      ).rejects.toBeInstanceOf(BusinessDataNotConfiguredError);

      expect(await quoteState(quote.id)).toEqual(before);
      expect(await historyRows(quote.id)).toHaveLength(knownIds.size);
    });

    it('reissues the document after the customer is soft-deleted', async () => {
      const { quote, customerName } = await createSentQuote();
      await prisma.customer.update({
        where: { id: quote.customerId },
        data: { deletedAt: new Date() },
      });
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);
      const startedAt = new Date();

      const bytes = await commercialPdf.execute({ id: quote.id });
      const { text } = await extractPdfText(bytes);

      expect(text).toContain(customerName);

      expect(await quoteState(quote.id)).toEqual(before);
      await expectSingleNewEvent(
        quote.id,
        knownIds,
        'COMMERCIAL_PDF_GENERATED',
        startedAt,
      );
    });
  });

  describe('production order', () => {
    it('generates from the persisted aggregate with technical data only', async () => {
      const { quote, customerName } = await createConfirmedQuote();
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);
      const startedAt = new Date();

      const bytes = await productionOrder.execute({ id: quote.id });
      const { text } = await extractPdfText(bytes);

      expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
      expect(text).toContain(quote.quoteNumber);
      expect(text).toContain('Sala');
      expect(text).toContain('Linho');
      expect(text).toContain('2 m');
      expect(text).toContain('2,2 m');
      expect(text).not.toContain(customerName);
      expect(text).not.toContain(BUSINESS_DATA.commercialNameOrConsultant);

      expect(await quoteState(quote.id)).toEqual(before);
      await expectSingleNewEvent(
        quote.id,
        knownIds,
        'PRODUCTION_ORDER_GENERATED',
        startedAt,
      );
    });
  });

  describe('failure semantics (D180)', () => {
    function useCaseWith(
      renderer: QuoteDocumentRenderer,
      history: QuoteHistoryWriter,
    ): GenerateCommercialPdfUseCase {
      return new GenerateCommercialPdfUseCase(
        app.get(QuoteRepository),
        app.get(GetBusinessDataQuery),
        app.get(GetCustomerContactQuery),
        renderer,
        history,
        app.get(Clock),
      );
    }

    it('does not append history when the renderer fails', async () => {
      const { quote } = await createSentQuote();
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);
      const useCase = useCaseWith(new FailingRenderer(), historyWriter);

      await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
        DocumentRenderError,
      );

      expect(await quoteState(quote.id)).toEqual(before);
      expect(await historyRows(quote.id)).toHaveLength(knownIds.size);
    });

    it('rejects and keeps the quote untouched when the history write fails', async () => {
      const { quote } = await createSentQuote();
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);
      const useCase = useCaseWith(
        app.get(QuoteDocumentRenderer),
        new FailingHistoryWriter(),
      );

      await expect(useCase.execute({ id: quote.id })).rejects.toBeInstanceOf(
        DocumentHistoryWriteError,
      );

      expect(await quoteState(quote.id)).toEqual(before);
      expect(await historyRows(quote.id)).toHaveLength(knownIds.size);
    });
  });

  describe('append-only history writer (D202)', () => {
    it('inserts the event without changing the quote or its children', async () => {
      const { quote } = await createSentQuote();
      const before = await quoteState(quote.id);
      const knownIds = await knownHistoryIds(quote.id);
      const occurredAt = new Date();

      await historyWriter.append({
        quoteId: quote.id,
        event: { type: 'COMMERCIAL_PDF_GENERATED' },
        occurredAt,
      });

      const rows = await historyRows(quote.id);
      const added = rows.filter((row) => !knownIds.has(row.id));

      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({
        quoteId: quote.id,
        eventType: 'COMMERCIAL_PDF_GENERATED',
        details: null,
      });
      expect(added[0].occurredAt.getTime()).toBe(occurredAt.getTime());
      expect(await quoteState(quote.id)).toEqual(before);
    });

    it('makes the event visible through the history route', async () => {
      const { quote } = await createSentQuote();
      const occurredAt = new Date();

      await historyWriter.append({
        quoteId: quote.id,
        event: { type: 'PRODUCTION_ORDER_GENERATED' },
        occurredAt,
      });

      const response = await request(server())
        .get(`/orcamentos/${quote.id}/historico`)
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .expect(200);

      const entries = response.body as {
        eventType: string;
        occurredAt: string;
      }[];
      const generated = entries.find(
        (entry) => entry.eventType === 'PRODUCTION_ORDER_GENERATED',
      );

      expect(generated).toBeDefined();
      expect(generated?.occurredAt).toBe(occurredAt.toISOString());
      expect(entries).toHaveLength((await historyRows(quote.id)).length);
    });

    it('rejects an event for an unknown quote through the foreign key', async () => {
      const { quote } = await createSentQuote();
      const knownIds = await knownHistoryIds(quote.id);

      await expect(
        historyWriter.append({
          quoteId: randomUUID(),
          event: { type: 'COMMERCIAL_PDF_GENERATED' },
          occurredAt: new Date(),
        }),
      ).rejects.toThrow();

      expect(await historyRows(quote.id)).toHaveLength(knownIds.size);
    });
  });
});
