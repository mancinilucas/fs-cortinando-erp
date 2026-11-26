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

// UFIN-07: integrated regression of the unified financial composition after
// the structural change. A single flow travels HTTP -> Application -> Domain ->
// Prisma -> PostgreSQL through creation, reading, edits that transfer items
// between curtains and the general composition, curtain removal, sending,
// confirmation, production and both documents. After each decisive step the
// persisted rows are checked for orphan lançamentos and inconsistent
// associations. Deletion and foreign-association rejection are covered
// separately because they must leave no residue either.

const ORIGIN = 'http://localhost:5173';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const COMPLETE_ADDRESS = {
  postalCode: '01310-100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 10',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

const BUSINESS_DATA = {
  commercialNameOrConsultant: 'Cortinando Regressão',
  phone: '(11) 99999-0000',
  email: 'regressao@example.com',
  taxId: '12345678000199',
};

interface QuoteFinancialItem {
  id: string;
  curtainId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  totalCents: number | null;
}

interface QuoteCurtain {
  id: string;
  sequence: number;
  room: string | null;
  totalCents: number;
}

interface QuoteTotals {
  curtainsSubtotalCents: number;
  generalAddOnsSubtotalCents: number;
  subtotalCents: number;
  discountValueCents: number;
  calculatedTotalCents: number;
  commercialAdjustmentCents: number;
  totalCents: number;
}

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: string;
  curtains: QuoteCurtain[];
  financialItems: QuoteFinancialItem[];
  totals: QuoteTotals;
  expired: boolean;
}

interface QuoteHistoryEntry {
  eventType: string;
}

describe('Financial composition regression (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;
  let customerIds: string[];

  const email = `e2e-financial-regression-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  beforeAll(async () => {
    originalAppOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = ORIGIN;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Mirror the bootstrap configuration in main.ts.
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
    // Documents need the singleton business_data row; e2e runs serially.
    await prisma.businessData.deleteMany();
    await prisma.businessData.create({
      data: { id: 'business', ...BUSINESS_DATA },
    });
  });

  afterEach(async () => {
    if (customerIds.length > 0) {
      // Quote -> Customer is Restrict; children and history cascade from the
      // quote itself.
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

  async function createCustomer(): Promise<string> {
    const response = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        name: `Cliente ${randomUUID()}`,
        phone: '(11) 98888-7777',
      })
      .expect(201);

    const id = response.body.id as string;
    customerIds.push(id);

    return id;
  }

  async function createQuote(
    customerId: string,
    body: Record<string, unknown> = {},
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .post(`/clientes/${customerId}/orcamentos`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as QuoteDetail;
  }

  async function patchQuote(
    id: string,
    body: Record<string, unknown>,
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .patch(`/orcamentos/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(200);

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

  async function getQuote(id: string): Promise<QuoteDetail> {
    const response = await request(server())
      .get(`/orcamentos/${id}`)
      .set('Cookie', cookie)
      .expect(200);

    return response.body as QuoteDetail;
  }

  async function history(id: string): Promise<QuoteHistoryEntry[]> {
    const response = await request(server())
      .get(`/orcamentos/${id}/historico`)
      .set('Cookie', cookie)
      .expect(200);

    return response.body as QuoteHistoryEntry[];
  }

  function getDocument(id: string, route: 'pdf' | 'ordem-producao') {
    return request(server())
      .get(`/orcamentos/${id}/${route}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);
  }

  function expectPdfResponse(response: request.Response): void {
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).subarray(0, 5).toString('ascii')).toBe(
      '%PDF-',
    );
  }

  function curtainByRoom(quote: QuoteDetail, room: string): QuoteCurtain {
    const curtain = quote.curtains.find((candidate) => candidate.room === room);

    if (curtain === undefined) {
      throw new Error(`quote has no curtain in ${room}`);
    }

    return curtain;
  }

  function itemFor(
    quote: QuoteDetail,
    curtainId: string | null,
    name: string,
  ): QuoteFinancialItem {
    const item = quote.financialItems.find(
      (candidate) =>
        candidate.curtainId === curtainId && candidate.name === name,
    );

    if (item === undefined) {
      throw new Error(`quote has no item ${name} for curtain ${curtainId}`);
    }

    return item;
  }

  // A quote with three curtains and a mixed composition: two items on the
  // first curtain, one on each of the others and one general add-on.
  function completeBody(): Record<string, unknown> {
    return {
      installationAddress: COMPLETE_ADDRESS,
      curtains: [
        {
          clientRef: 'sala',
          room: 'Sala',
          material: 'Linho',
          openingWidth: 2,
          borderValue: 0,
          height: 2.2,
          fabricFactor: 2,
        },
        {
          clientRef: 'quarto',
          room: 'Quarto',
          material: 'Voal',
          openingWidth: 1.5,
          borderValue: 0,
          height: 2,
          fabricFactor: 2,
        },
        {
          clientRef: 'cozinha',
          room: 'Cozinha',
          material: 'Linho',
          openingWidth: 1,
          borderValue: 0.05,
          height: 1.5,
          fabricFactor: 2,
        },
      ],
      financialItems: [
        {
          curtainRef: 'sala',
          name: 'Tecido',
          quantity: 2,
          unit: 'm',
          unitPriceCents: 10_000,
        },
        {
          curtainRef: 'sala',
          name: 'Forro',
          quantity: 1,
          unit: 'm',
          unitPriceCents: 5_000,
        },
        {
          curtainRef: 'quarto',
          name: 'Tecido',
          quantity: 1,
          unit: 'm',
          unitPriceCents: 10_000,
        },
        {
          curtainRef: 'cozinha',
          name: 'Tecido',
          quantity: 1,
          unit: 'm',
          unitPriceCents: 4_000,
        },
        { name: 'Frete', quantity: 1, unit: 'un', unitPriceCents: 5_000 },
      ],
    };
  }

  async function expectConsistentComposition(quoteId: string): Promise<void> {
    const curtains = await prisma.curtain.findMany({ where: { quoteId } });
    const items = await prisma.financialItem.findMany({ where: { quoteId } });
    const curtainIds = new Set(curtains.map((curtain) => curtain.id));

    for (const item of items) {
      expect(item.quoteId).toBe(quoteId);

      if (item.curtainId !== null) {
        expect(curtainIds.has(item.curtainId)).toBe(true);
      }
    }

    // Every persisted association must point at a curtain of its own quote.
    const associations = await prisma.financialItem.findMany({
      where: { curtainId: { not: null } },
      include: { curtain: true },
    });

    expect(
      associations.filter(
        (item) =>
          item.curtain === null || item.curtain.quoteId !== item.quoteId,
      ),
    ).toEqual([]);
  }

  it('keeps the composition consistent from creation to both documents', async () => {
    const customerId = await createCustomer();
    const created = await createQuote(customerId, completeBody());

    const sala = curtainByRoom(created, 'Sala');
    const quarto = curtainByRoom(created, 'Quarto');
    const cozinha = curtainByRoom(created, 'Cozinha');

    expect(created.status).toBe('DRAFT');
    expect(created.curtains).toHaveLength(3);
    expect(created.financialItems).toHaveLength(5);

    // Creation resolves clientRef/curtainRef into definitive ids.
    const tecidoSala = itemFor(created, sala.id, 'Tecido');
    const forro = itemFor(created, sala.id, 'Forro');
    const tecidoQuarto = itemFor(created, quarto.id, 'Tecido');
    const tecidoCozinha = itemFor(created, cozinha.id, 'Tecido');
    const frete = itemFor(created, null, 'Frete');

    for (const item of created.financialItems) {
      expect(item.id).toMatch(UUID);
    }

    expect(new Set(created.financialItems.map((item) => item.id)).size).toBe(5);
    expect(frete.curtainId).toBeNull();
    expect(created.totals).toEqual({
      curtainsSubtotalCents: 39_000,
      generalAddOnsSubtotalCents: 5_000,
      subtotalCents: 44_000,
      discountValueCents: 0,
      calculatedTotalCents: 44_000,
      commercialAdjustmentCents: 0,
      totalCents: 44_000,
    });
    await expectConsistentComposition(created.id);

    // Reading returns the same associations and totals.
    await expect(getQuote(created.id)).resolves.toEqual(created);

    // Editing transfers existing items to other curtains while preserving
    // their ids; the collection describes the complete final state.
    const transferred = await patchQuote(created.id, {
      financialItems: [
        { id: tecidoSala.id },
        { id: forro.id, curtainId: quarto.id },
        { id: tecidoQuarto.id },
        { id: tecidoCozinha.id },
        { id: frete.id, curtainId: cozinha.id },
      ],
    });

    expect(itemFor(transferred, quarto.id, 'Forro').id).toBe(forro.id);
    expect(itemFor(transferred, cozinha.id, 'Frete').id).toBe(frete.id);
    expect(transferred.financialItems).toHaveLength(5);
    expect(transferred.totals).toEqual({
      curtainsSubtotalCents: 44_000,
      generalAddOnsSubtotalCents: 0,
      subtotalCents: 44_000,
      discountValueCents: 0,
      calculatedTotalCents: 44_000,
      commercialAdjustmentCents: 0,
      totalCents: 44_000,
    });
    await expectConsistentComposition(created.id);

    // Removing a curtain while omitting financialItems drops the lançamentos
    // associated with it and preserves the others.
    const afterRemoval = await patchQuote(created.id, {
      curtains: [{ id: sala.id }, { id: quarto.id }],
    });

    expect(afterRemoval.curtains).toHaveLength(2);
    expect(afterRemoval.financialItems).toHaveLength(3);
    await expect(
      prisma.financialItem.findUnique({ where: { id: tecidoCozinha.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.financialItem.findUnique({ where: { id: frete.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.financialItem.findUnique({ where: { id: forro.id } }),
    ).resolves.not.toBeNull();
    expect(afterRemoval.totals).toMatchObject({
      curtainsSubtotalCents: 35_000,
      generalAddOnsSubtotalCents: 0,
      subtotalCents: 35_000,
      totalCents: 35_000,
    });
    await expectConsistentComposition(created.id);

    // Sending revalidates the commercial composition built from the unified
    // collection.
    const validUntil = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const sent = await act(created.id, 'enviar', { validUntil });
    expect(sent.status).toBe('SENT');
    expect(sent.expired).toBe(false);

    // The production order is not available before confirmation.
    await getDocument(created.id, 'ordem-producao').expect(409);

    const commercialPdf = await getDocument(created.id, 'pdf').expect(200);
    expectPdfResponse(commercialPdf);

    const confirmed = await act(created.id, 'confirmar');
    expect(confirmed.status).toBe('CONFIRMED');

    const inProduction = await act(created.id, 'iniciar-producao');
    expect(inProduction.status).toBe('IN_PRODUCTION');

    const productionOrder = await getDocument(
      created.id,
      'ordem-producao',
    ).expect(200);
    expectPdfResponse(productionOrder);

    // Document generation is recorded in the append-only history.
    const eventTypes = (await history(created.id)).map(
      (entry) => entry.eventType,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'QUOTE_SENT',
        'COMMERCIAL_PDF_GENERATED',
        'QUOTE_CONFIRMED',
        'PRODUCTION_STARTED',
        'PRODUCTION_ORDER_GENERATED',
      ]),
    );

    await expect(getQuote(created.id)).resolves.toEqual(inProduction);
    await expectConsistentComposition(created.id);
  }, 30_000);

  it('rejects a foreign curtain association without mutating either quote', async () => {
    const customerId = await createCustomer();
    const target = await createQuote(customerId, completeBody());
    const other = await createQuote(customerId, completeBody());

    const sala = curtainByRoom(target, 'Sala');
    const quarto = curtainByRoom(target, 'Quarto');
    const cozinha = curtainByRoom(target, 'Cozinha');
    const foreignCurtain = curtainByRoom(other, 'Sala');
    const tecido = itemFor(target, sala.id, 'Tecido');
    const forro = itemFor(target, sala.id, 'Forro');
    const tecidoQuarto = itemFor(target, quarto.id, 'Tecido');
    const tecidoCozinha = itemFor(target, cozinha.id, 'Tecido');
    const frete = itemFor(target, null, 'Frete');

    const response = await request(server())
      .patch(`/orcamentos/${target.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        financialItems: [
          { id: tecido.id, curtainId: foreignCurtain.id },
          { id: forro.id },
          { id: tecidoQuarto.id },
          { id: tecidoCozinha.id },
          { id: frete.id },
        ],
      })
      .expect(422);

    expect(response.body).toMatchObject({
      message: expect.any(String),
    });

    // Validation happens before mutation: both quotes keep their state.
    await expect(getQuote(target.id)).resolves.toEqual(target);
    await expect(getQuote(other.id)).resolves.toEqual(other);

    const persisted = await prisma.financialItem.findUniqueOrThrow({
      where: { id: tecido.id },
    });
    expect(persisted.curtainId).toBe(sala.id);
    await expectConsistentComposition(target.id);
    await expectConsistentComposition(other.id);
  });

  it('deletes a draft physically without leaving orphan children', async () => {
    const customerId = await createCustomer();
    const quote = await createQuote(customerId, completeBody());

    await request(server())
      .delete(`/orcamentos/${quote.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(204);

    await request(server())
      .get(`/orcamentos/${quote.id}`)
      .set('Cookie', cookie)
      .expect(404);

    await expect(
      prisma.curtain.count({ where: { quoteId: quote.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.financialItem.count({ where: { quoteId: quote.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.financialItem.count({
        where: { id: { in: quote.financialItems.map((item) => item.id) } },
      }),
    ).resolves.toBe(0);
  });
});
