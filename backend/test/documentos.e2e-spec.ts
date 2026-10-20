import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { sessionCookieName } from '../src/modules/auth/presentation/session-cookie.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';
import { extractPdfText } from './helpers/pdf-text.js';

// DOCUMENTOS-20: end-to-end coverage of the document HTTP contract. Each test
// travels HTTP -> Application -> pdf-lib -> history writer -> PostgreSQL. The
// e2e suite runs without file parallelism (D206) because it shares the
// singleton business_data row.

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

type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'EXPIRED'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELLED';

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: string;
}

interface HistoryEntry {
  id: string;
  eventType: string;
  occurredAt: string;
  details: unknown;
}

interface StatusFixture {
  quote: QuoteDetail;
  customer: { id: string; name: string };
}

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;
  let customerIds: string[];

  const email = `e2e-documentos-${randomUUID()}@example.com`;
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

  async function createCustomer() {
    const response = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ name: `Cliente ${randomUUID()}`, phone: '(11) 98888-7777' })
      .expect(201);

    const customer = response.body as { id: string; name: string };
    customerIds.push(customer.id);

    return customer;
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

  async function act(
    id: string,
    action: string,
    body: Record<string, unknown> = {},
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .post(`/orcamentos/${id}/${action}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(200);

    return response.body as QuoteDetail;
  }

  async function sendQuote(id: string): Promise<QuoteDetail> {
    return act(id, 'enviar', {
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  async function createQuoteInStatus(
    status: QuoteStatus,
  ): Promise<StatusFixture> {
    const customer = await createCustomer();
    const body =
      status === 'DRAFT'
        ? { curtains: [{ room: 'Sala' }] }
        : completeQuoteBody();
    const quote = await createQuote(customer.id, body);

    switch (status) {
      case 'DRAFT':
        return { quote, customer };
      case 'SENT':
        return { quote: await sendQuote(quote.id), customer };
      case 'EXPIRED': {
        const sent = await sendQuote(quote.id);
        await prisma.quote.update({
          where: { id: quote.id },
          data: { validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });

        return { quote: sent, customer };
      }
      case 'CONFIRMED':
        await sendQuote(quote.id);
        return { quote: await act(quote.id, 'confirmar'), customer };
      case 'IN_PRODUCTION': {
        await sendQuote(quote.id);
        await act(quote.id, 'confirmar');
        return { quote: await act(quote.id, 'iniciar-producao'), customer };
      }
      case 'COMPLETED': {
        await sendQuote(quote.id);
        await act(quote.id, 'confirmar');
        await act(quote.id, 'iniciar-producao');
        await request(server())
          .put(`/orcamentos/${quote.id}/instalacao`)
          .set('Origin', ORIGIN)
          .set('Cookie', cookie)
          .send({
            scheduledInstallationAt: new Date(
              Date.now() - 24 * 60 * 60 * 1000,
            ).toISOString(),
          })
          .expect(200);

        return { quote: await act(quote.id, 'concluir'), customer };
      }
      case 'CANCELLED':
        return { quote: await act(quote.id, 'cancelar'), customer };
    }
  }

  async function historyFor(id: string): Promise<HistoryEntry[]> {
    const response = await request(server())
      .get(`/orcamentos/${id}/historico`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(200);

    return response.body as HistoryEntry[];
  }

  async function eventCount(id: string, eventType: string): Promise<number> {
    return (await historyFor(id)).filter(
      (entry) => entry.eventType === eventType,
    ).length;
  }

  function getDocument(id: string, route: 'pdf' | 'ordem-producao') {
    return request(server())
      .get(`/orcamentos/${id}/${route}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);
  }

  function expectPdfResponse(
    response: request.Response,
    prefix: 'orcamento' | 'ordem-de-producao',
  ): void {
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-disposition']).toMatch(
      new RegExp(
        `^inline; filename="${prefix}-ORC-\\d{4}-\\d{3,}\\.pdf"; ` +
          `filename\\*=UTF-8''${prefix}-OR%C3%87-\\d{4}-\\d{3,}\\.pdf$`,
      ),
    );
    expect(Number(response.headers['content-length'])).toBe(
      (response.body as Buffer).length,
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).subarray(0, 5).toString('ascii')).toBe(
      '%PDF-',
    );
  }

  describe('authentication', () => {
    it('rejects both document routes without a session', async () => {
      const id = randomUUID();

      await request(server()).get(`/orcamentos/${id}/pdf`).expect(401);
      await request(server())
        .get(`/orcamentos/${id}/ordem-producao`)
        .expect(401);
    });
  });

  describe('shared HTTP contract', () => {
    it.each(['pdf', 'ordem-producao'] as const)(
      'rejects a malformed id on /%s',
      async (route) => {
        await getDocument('not-a-uuid', route).expect(400);
      },
    );

    it.each(['pdf', 'ordem-producao'] as const)(
      'returns 404 for an unknown quote on /%s',
      async (route) => {
        const response = await getDocument(randomUUID(), route).expect(404);

        expect(response.body).toMatchObject({
          statusCode: 404,
          message: 'Quote not found',
        });
      },
    );

    it('streams the PDF headers and raw bytes without a JSON envelope', async () => {
      const { quote } = await createQuoteInStatus('SENT');
      const response = await getDocument(quote.id, 'pdf').expect(200);

      expectPdfResponse(response, 'orcamento');
      expect(response.body.toString('latin1')).toContain('%EOF');
      expect(response.text).toBeUndefined();
    });
  });

  describe('commercial PDF', () => {
    it.each([
      'SENT',
      'EXPIRED',
      'CONFIRMED',
      'IN_PRODUCTION',
      'COMPLETED',
    ] as const)(
      'generates the document in %s and records one event',
      async (status) => {
        const { quote, customer } = await createQuoteInStatus(status);
        const before = await eventCount(quote.id, 'COMMERCIAL_PDF_GENERATED');
        const startedAt = Date.now();

        const response = await getDocument(quote.id, 'pdf').expect(200);
        const { text } = await extractPdfText(response.body as Buffer);

        expectPdfResponse(response, 'orcamento');
        expect(text).toContain(quote.quoteNumber);
        expect(text).toContain(BUSINESS_DATA.commercialNameOrConsultant);
        expect(text).toContain(customer.name);

        const entries = await historyFor(quote.id);
        const generated = entries.filter(
          (entry) => entry.eventType === 'COMMERCIAL_PDF_GENERATED',
        );

        expect(generated).toHaveLength(before + 1);
        expect(
          new Date(generated.at(-1)?.occurredAt ?? 0).getTime(),
        ).toBeGreaterThanOrEqual(startedAt);
      },
    );

    it('previews a DRAFT and writes no history', async () => {
      const { quote } = await createQuoteInStatus('DRAFT');
      const before = (await historyFor(quote.id)).length;

      const response = await getDocument(quote.id, 'pdf').expect(200);
      const { text } = await extractPdfText(response.body as Buffer);

      expect(text).not.toContain('VALOR TOTAL DO SERVIÇO');
      expect(await historyFor(quote.id)).toHaveLength(before);
    });

    it('rejects a CANCELLED quote without writing history', async () => {
      const { quote } = await createQuoteInStatus('CANCELLED');
      const before = (await historyFor(quote.id)).length;

      const response = await getDocument(quote.id, 'pdf').expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Document is not available in the current status',
      });
      expect(await historyFor(quote.id)).toHaveLength(before);
    });

    it('requires BusinessData and records no event when it is missing', async () => {
      const { quote } = await createQuoteInStatus('SENT');
      await prisma.businessData.deleteMany();
      const before = (await historyFor(quote.id)).length;

      const response = await getDocument(quote.id, 'pdf').expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Business data is not configured',
      });
      expect(await historyFor(quote.id)).toHaveLength(before);
    });

    it('reissues after the customer is soft-deleted', async () => {
      const { quote, customer } = await createQuoteInStatus('SENT');
      await prisma.customer.update({
        where: { id: customer.id },
        data: { deletedAt: new Date() },
      });
      const before = await eventCount(quote.id, 'COMMERCIAL_PDF_GENERATED');

      const response = await getDocument(quote.id, 'pdf').expect(200);
      const { text } = await extractPdfText(response.body as Buffer);

      expect(text).toContain(customer.name);
      expect(await eventCount(quote.id, 'COMMERCIAL_PDF_GENERATED')).toBe(
        before + 1,
      );
    });

    it('records one event per repeated generation', async () => {
      const { quote } = await createQuoteInStatus('SENT');
      const before = await eventCount(quote.id, 'COMMERCIAL_PDF_GENERATED');

      await getDocument(quote.id, 'pdf').expect(200);
      await getDocument(quote.id, 'pdf').expect(200);

      expect(await eventCount(quote.id, 'COMMERCIAL_PDF_GENERATED')).toBe(
        before + 2,
      );
    });
  });

  describe('production order', () => {
    it.each(['CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'] as const)(
      'generates the document in %s with technical data only',
      async (status) => {
        const { quote, customer } = await createQuoteInStatus(status);
        const before = await eventCount(quote.id, 'PRODUCTION_ORDER_GENERATED');

        const response = await getDocument(quote.id, 'ordem-producao').expect(
          200,
        );
        const { text } = await extractPdfText(response.body as Buffer);

        expectPdfResponse(response, 'ordem-de-producao');
        expect(text).toContain(quote.quoteNumber);
        expect(text).toContain('ORDEM DE PRODUÇÃO');
        expect(text).toContain('Sala');
        expect(text).toContain('Linho');
        expect(text).toContain('2 m');
        expect(text).toContain('2,2 m');
        expect(text).not.toContain(customer.name);
        expect(text).not.toContain('(11) 98888-7777');
        expect(text).not.toContain(BUSINESS_DATA.commercialNameOrConsultant);
        expect(text).not.toContain('R$');

        expect(await eventCount(quote.id, 'PRODUCTION_ORDER_GENERATED')).toBe(
          before + 1,
        );
      },
    );

    it.each(['DRAFT', 'SENT', 'EXPIRED', 'CANCELLED'] as const)(
      'rejects the document in %s without writing history',
      async (status) => {
        const { quote } = await createQuoteInStatus(status);
        const before = (await historyFor(quote.id)).length;

        const response = await getDocument(quote.id, 'ordem-producao').expect(
          409,
        );

        expect(response.body).toMatchObject({
          statusCode: 409,
          message: 'Document is not available in the current status',
        });
        expect(await historyFor(quote.id)).toHaveLength(before);
      },
    );

    it('does not require BusinessData', async () => {
      const { quote } = await createQuoteInStatus('CONFIRMED');
      await prisma.businessData.deleteMany();

      const response = await getDocument(quote.id, 'ordem-producao').expect(
        200,
      );

      expectPdfResponse(response, 'ordem-de-producao');
    });
  });
});
