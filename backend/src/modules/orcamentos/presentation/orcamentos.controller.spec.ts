import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  SessionRecord,
  SessionStore,
} from '../../auth/application/session-store.js';
import { SessionTokenService } from '../../auth/application/session-token.service.js';
import { UserIdentity, UserStore } from '../../auth/application/user-store.js';
import { AuthGuard } from '../../auth/presentation/auth.guard.js';
import { BusinessDataNotConfiguredError } from '../application/errors/business-data-not-configured.error.js';
import { DocumentCustomerNotFoundError } from '../application/errors/document-customer-not-found.error.js';
import { DocumentDataIncompleteError } from '../application/errors/document-data-incomplete.error.js';
import { DocumentHistoryWriteError } from '../application/errors/document-history-write.error.js';
import { DocumentNotAvailableError } from '../application/errors/document-not-available.error.js';
import { DocumentRenderError } from '../application/errors/document-render.error.js';
import { QuoteCustomerNotFoundError } from '../application/errors/quote-customer-not-found.error.js';
import { QuoteNotFoundError } from '../application/errors/quote-not-found.error.js';
import type { QuoteHistoryEntry } from '../application/ports/quote-history-query.repository.js';
import type { QuoteSummaryView } from '../application/ports/quote-search-query.repository.js';
import type {
  DashboardView,
  InstallationListItem,
} from '../application/queries/dashboard-read-model.js';
import { GetDashboardQuery } from '../application/queries/get-dashboard.query.js';
import { GetQuoteQuery } from '../application/queries/get-quote.query.js';
import { ListCustomerQuotesQuery } from '../application/queries/list-customer-quotes.query.js';
import { ListQuoteHistoryQuery } from '../application/queries/list-quote-history.query.js';
import type { QuoteDetailView } from '../application/queries/quote-read-model.js';
import { SearchQuotesQuery } from '../application/queries/search-quotes.query.js';
import { CancelQuoteUseCase } from '../application/use-cases/cancel-quote.use-case.js';
import { CompleteServiceUseCase } from '../application/use-cases/complete-service.use-case.js';
import { ConfirmQuoteUseCase } from '../application/use-cases/confirm-quote.use-case.js';
import { CreateQuoteFromCustomerUseCase } from '../application/use-cases/create-quote-from-customer.use-case.js';
import { DeleteDraftQuoteUseCase } from '../application/use-cases/delete-draft-quote.use-case.js';
import { GenerateCommercialPdfUseCase } from '../application/use-cases/generate-commercial-pdf.use-case.js';
import { GenerateProductionOrderUseCase } from '../application/use-cases/generate-production-order.use-case.js';
import { MarkQuoteAsSentUseCase } from '../application/use-cases/mark-quote-as-sent.use-case.js';
import { RemoveInstallationUseCase } from '../application/use-cases/remove-installation.use-case.js';
import { RenewQuoteUseCase } from '../application/use-cases/renew-quote.use-case.js';
import { ReopenQuoteUseCase } from '../application/use-cases/reopen-quote.use-case.js';
import { ScheduleInstallationUseCase } from '../application/use-cases/schedule-installation.use-case.js';
import { StartProductionUseCase } from '../application/use-cases/start-production.use-case.js';
import { UpdateQuoteUseCase } from '../application/use-cases/update-quote.use-case.js';
import type { Quote } from '../domain/entities/quote.js';
import {
  InvalidQuoteTransitionError,
  QuoteNotEditableError,
  QuoteValidationError,
  UnknownQuoteItemError,
} from '../domain/errors/quote-domain.errors.js';
import { QuoteStatus } from '../domain/entities/quote.js';
import { DiscountType } from '../domain/value-objects/discount.js';
import { OrcamentosController } from './orcamentos.controller.js';

const CUSTOMER_ID = '7a4b2c9e-0000-4000-8000-000000000000';
const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const CURTAIN_ID = '22222222-2222-4222-8222-222222222222';
const COMPONENT_ID = '33333333-3333-4333-8333-333333333333';
const ADD_ON_ID = '44444444-4444-4444-8444-444444444444';
const HISTORY_ID = '55555555-5555-4555-8555-555555555555';
// Session tokens must be 43 base64url characters (request-session.ts).
const SESSION_TOKEN = 'A'.repeat(43);
const USER: UserIdentity = { id: 'user-id', email: 'admin@example.com' };
const COOKIE = { Cookie: `cortinando_session=${SESSION_TOKEN}` };

class FakeSessionStore extends SessionStore {
  async create(): Promise<SessionRecord> {
    throw new Error('not used in controller tests');
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    if (tokenHash !== new SessionTokenService().hash(SESSION_TOKEN)) {
      return null;
    }

    return {
      id: 'session-id',
      userId: USER.id,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }

  async deleteByTokenHash(): Promise<void> {}
}

class FakeUserStore extends UserStore {
  async findByEmail(): Promise<null> {
    return null;
  }

  async findById(id: string): Promise<UserIdentity | null> {
    return id === USER.id ? USER : null;
  }
}

const mocks = {
  create: vi.fn<CreateQuoteFromCustomerUseCase['execute']>(),
  get: vi.fn<GetQuoteQuery['execute']>(),
  update: vi.fn<UpdateQuoteUseCase['execute']>(),
  remove: vi.fn<DeleteDraftQuoteUseCase['execute']>(),
  send: vi.fn<MarkQuoteAsSentUseCase['execute']>(),
  confirm: vi.fn<ConfirmQuoteUseCase['execute']>(),
  reopen: vi.fn<ReopenQuoteUseCase['execute']>(),
  renew: vi.fn<RenewQuoteUseCase['execute']>(),
  cancel: vi.fn<CancelQuoteUseCase['execute']>(),
  startProduction: vi.fn<StartProductionUseCase['execute']>(),
  complete: vi.fn<CompleteServiceUseCase['execute']>(),
  scheduleInstallation: vi.fn<ScheduleInstallationUseCase['execute']>(),
  removeInstallation: vi.fn<RemoveInstallationUseCase['execute']>(),
  search: vi.fn<SearchQuotesQuery['execute']>(),
  listByCustomer: vi.fn<ListCustomerQuotesQuery['execute']>(),
  history: vi.fn<ListQuoteHistoryQuery['execute']>(),
  dashboard: vi.fn<GetDashboardQuery['execute']>(),
  commercialPdf: vi.fn<GenerateCommercialPdfUseCase['execute']>(),
  productionOrder: vi.fn<GenerateProductionOrderUseCase['execute']>(),
};

function sampleDetail(
  overrides: Partial<QuoteDetailView> = {},
): QuoteDetailView {
  return {
    id: QUOTE_ID,
    quoteNumber: 'ORÇ-2026-0001',
    customerId: CUSTOMER_ID,
    status: QuoteStatus.SENT,
    notes: 'Cliente preferencial',
    discount: {
      type: DiscountType.PERCENTAGE,
      percentage: 10,
      fixedAmountCents: null,
    },
    commercialAdjustmentCents: -500,
    installationAddress: {
      postalCode: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 10',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    curtains: [
      {
        id: CURTAIN_ID,
        sequence: 1,
        room: 'Sala',
        description: 'Cortina principal',
        material: 'Linho',
        openingWidth: 2.5,
        borderValue: 0.15,
        finalWidth: 2.65,
        height: 2.7,
        fabricFactor: 3.5,
        fabricQuantity: 9.275,
        notes: 'Sem forro',
        components: [
          {
            id: COMPONENT_ID,
            name: 'Tecido',
            quantity: 8.05,
            unit: 'm',
            unitPriceCents: 3000,
            totalCents: 24150,
          },
        ],
        totalCents: 24150,
      },
    ],
    generalAddOns: [
      {
        id: ADD_ON_ID,
        name: 'Instalação',
        quantity: 1,
        unit: null,
        unitPriceCents: 15000,
        totalCents: 15000,
      },
    ],
    totals: {
      curtainsSubtotalCents: 24150,
      generalAddOnsSubtotalCents: 15000,
      subtotalCents: 39150,
      discountValueCents: 3915,
      calculatedTotalCents: 35235,
      commercialAdjustmentCents: -500,
      totalCents: 34735,
    },
    createdAt: new Date('2026-10-19T12:00:00.000Z'),
    updatedAt: new Date('2026-10-19T13:00:00.000Z'),
    firstSentAt: new Date('2026-10-19T14:00:00.000Z'),
    validUntil: new Date('2026-11-18T14:00:00.000Z'),
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: new Date('2026-10-25T09:00:00.000Z'),
    completedAt: null,
    expired: false,
    lateInstallation: false,
    ...overrides,
  };
}

const DETAIL_BODY = {
  id: QUOTE_ID,
  quoteNumber: 'ORÇ-2026-0001',
  customerId: CUSTOMER_ID,
  status: 'SENT',
  notes: 'Cliente preferencial',
  discount: { type: 'PERCENTAGE', percentage: 10, fixedAmountCents: null },
  commercialAdjustmentCents: -500,
  installationAddress: {
    postalCode: '01310100',
    street: 'Avenida Paulista',
    number: '1000',
    complement: 'Apto 10',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
  curtains: [
    {
      id: CURTAIN_ID,
      sequence: 1,
      room: 'Sala',
      description: 'Cortina principal',
      material: 'Linho',
      openingWidth: 2.5,
      borderValue: 0.15,
      finalWidth: 2.65,
      height: 2.7,
      fabricFactor: 3.5,
      fabricQuantity: 9.275,
      notes: 'Sem forro',
      components: [
        {
          id: COMPONENT_ID,
          name: 'Tecido',
          quantity: 8.05,
          unit: 'm',
          unitPriceCents: 3000,
          totalCents: 24150,
        },
      ],
      totalCents: 24150,
    },
  ],
  generalAddOns: [
    {
      id: ADD_ON_ID,
      name: 'Instalação',
      quantity: 1,
      unit: null,
      unitPriceCents: 15000,
      totalCents: 15000,
    },
  ],
  totals: {
    curtainsSubtotalCents: 24150,
    generalAddOnsSubtotalCents: 15000,
    subtotalCents: 39150,
    discountValueCents: 3915,
    calculatedTotalCents: 35235,
    commercialAdjustmentCents: -500,
    totalCents: 34735,
  },
  createdAt: '2026-10-19T12:00:00.000Z',
  updatedAt: '2026-10-19T13:00:00.000Z',
  firstSentAt: '2026-10-19T14:00:00.000Z',
  validUntil: '2026-11-18T14:00:00.000Z',
  confirmedAt: null,
  productionStartedAt: null,
  scheduledInstallationAt: '2026-10-25T09:00:00.000Z',
  completedAt: null,
  expired: false,
  lateInstallation: false,
};

function sampleSummary(
  overrides: Partial<QuoteSummaryView> = {},
): QuoteSummaryView {
  return {
    id: QUOTE_ID,
    quoteNumber: 'ORÇ-2026-0001',
    customer: { id: CUSTOMER_ID, name: 'Maria Silva' },
    status: QuoteStatus.SENT,
    expired: false,
    totalCents: 34735,
    createdAt: new Date('2026-10-19T12:00:00.000Z'),
    validUntil: new Date('2026-11-18T14:00:00.000Z'),
    scheduledInstallationAt: null,
    ...overrides,
  };
}

const SUMMARY_BODY = {
  id: QUOTE_ID,
  quoteNumber: 'ORÇ-2026-0001',
  customer: { id: CUSTOMER_ID, name: 'Maria Silva' },
  status: 'SENT',
  expired: false,
  totalCents: 34735,
  createdAt: '2026-10-19T12:00:00.000Z',
  validUntil: '2026-11-18T14:00:00.000Z',
  scheduledInstallationAt: null,
};

function sampleInstallation(
  overrides: Partial<InstallationListItem> = {},
): InstallationListItem {
  return {
    quoteId: QUOTE_ID,
    quoteNumber: 'ORÇ-2026-0001',
    customerName: 'Maria Silva',
    scheduledInstallationAt: new Date('2026-10-25T09:00:00.000Z'),
    status: QuoteStatus.CONFIRMED,
    ...overrides,
  };
}

function sampleDashboard(): DashboardView {
  return {
    statusCounts: {
      draft: 1,
      sent: 2,
      expired: 3,
      confirmed: 4,
      inProduction: 5,
    },
    upcomingInstallations: [sampleInstallation()],
    weeklyInstallations: [
      sampleInstallation({
        quoteId: CURTAIN_ID,
        status: QuoteStatus.IN_PRODUCTION,
      }),
    ],
    overdueInstallations: [sampleInstallation({ quoteId: COMPONENT_ID })],
  };
}

const SIMPLE_ACTIONS = [
  ['confirmar', 'confirm'],
  ['reabrir', 'reopen'],
  ['iniciar-producao', 'startProduction'],
  ['concluir', 'complete'],
] as const;

describe('OrcamentosController (HTTP)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [OrcamentosController],
      providers: [
        SessionTokenService,
        AuthGuard,
        { provide: SessionStore, useValue: new FakeSessionStore() },
        { provide: UserStore, useValue: new FakeUserStore() },
        {
          provide: CreateQuoteFromCustomerUseCase,
          useValue: { execute: mocks.create },
        },
        { provide: GetQuoteQuery, useValue: { execute: mocks.get } },
        {
          provide: GetDashboardQuery,
          useValue: { execute: mocks.dashboard },
        },
        { provide: UpdateQuoteUseCase, useValue: { execute: mocks.update } },
        {
          provide: DeleteDraftQuoteUseCase,
          useValue: { execute: mocks.remove },
        },
        {
          provide: MarkQuoteAsSentUseCase,
          useValue: { execute: mocks.send },
        },
        { provide: ConfirmQuoteUseCase, useValue: { execute: mocks.confirm } },
        { provide: ReopenQuoteUseCase, useValue: { execute: mocks.reopen } },
        { provide: RenewQuoteUseCase, useValue: { execute: mocks.renew } },
        { provide: CancelQuoteUseCase, useValue: { execute: mocks.cancel } },
        {
          provide: StartProductionUseCase,
          useValue: { execute: mocks.startProduction },
        },
        {
          provide: CompleteServiceUseCase,
          useValue: { execute: mocks.complete },
        },
        {
          provide: ScheduleInstallationUseCase,
          useValue: { execute: mocks.scheduleInstallation },
        },
        {
          provide: RemoveInstallationUseCase,
          useValue: { execute: mocks.removeInstallation },
        },
        { provide: SearchQuotesQuery, useValue: { execute: mocks.search } },
        {
          provide: ListCustomerQuotesQuery,
          useValue: { execute: mocks.listByCustomer },
        },
        {
          provide: ListQuoteHistoryQuery,
          useValue: { execute: mocks.history },
        },
        {
          provide: GenerateCommercialPdfUseCase,
          useValue: { execute: mocks.commercialPdf },
        },
        {
          provide: GenerateProductionOrderUseCase,
          useValue: { execute: mocks.productionOrder },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function server() {
    return app.getHttpServer();
  }

  describe('authentication', () => {
    it('protects every route with AuthGuard', async () => {
      await request(server())
        .post(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .send({})
        .expect(401);
      await request(server())
        .get(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .expect(401);
      await request(server()).get('/dashboard').expect(401);
      await request(server()).get('/orcamentos').expect(401);
      await request(server()).get(`/orcamentos/${QUOTE_ID}`).expect(401);
      await request(server())
        .patch(`/orcamentos/${QUOTE_ID}`)
        .send({})
        .expect(401);
      await request(server()).delete(`/orcamentos/${QUOTE_ID}`).expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/enviar`)
        .send({})
        .expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/confirmar`)
        .expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/reabrir`)
        .expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/renovar`)
        .send({})
        .expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/cancelar`)
        .send({})
        .expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/iniciar-producao`)
        .expect(401);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/concluir`)
        .expect(401);
      await request(server())
        .put(`/orcamentos/${QUOTE_ID}/instalacao`)
        .send({})
        .expect(401);
      await request(server())
        .delete(`/orcamentos/${QUOTE_ID}/instalacao`)
        .expect(401);
      await request(server())
        .get(`/orcamentos/${QUOTE_ID}/historico`)
        .expect(401);
      await request(server()).get(`/orcamentos/${QUOTE_ID}/pdf`).expect(401);
      await request(server())
        .get(`/orcamentos/${QUOTE_ID}/ordem-producao`)
        .expect(401);
    });

    it('returns the generic authentication message', async () => {
      const response = await request(server()).get('/orcamentos').expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });

    it('rejects an unknown session token', async () => {
      await request(server())
        .get('/orcamentos')
        .set('Cookie', `cortinando_session=${'b'.repeat(43)}`)
        .expect(401);
    });
  });

  describe('POST /clientes/:customerId/orcamentos', () => {
    it('creates a quote, returns the persisted detail and maps the body', async () => {
      mocks.create.mockResolvedValue({ id: QUOTE_ID } as Quote);
      mocks.get.mockResolvedValue(sampleDetail());

      const response = await request(server())
        .post(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .set(COOKIE)
        .send({
          customerId: 'ignored-id',
          status: 'CONFIRMED',
          notes: '  Cliente preferencial  ',
          discount: { type: 'PERCENTAGE', percentage: 10 },
          commercialAdjustmentCents: -500,
          installationAddress: { state: 'sp' },
          curtains: [
            {
              room: ' Sala ',
              openingWidth: 2.5,
              components: [
                {
                  name: ' Tecido ',
                  quantity: 8.05,
                  unit: ' m ',
                  unitPriceCents: 3000,
                },
              ],
            },
          ],
          generalAddOns: [
            { name: ' Instalação ', quantity: 1, unitPriceCents: 15000 },
          ],
        })
        .expect(201);

      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.create.mock.calls[0][0]).toMatchObject({
        customerId: CUSTOMER_ID,
        notes: 'Cliente preferencial',
        discount: { type: 'PERCENTAGE', percentage: 10 },
        commercialAdjustmentCents: -500,
        installationAddress: { state: 'SP' },
        curtains: [
          {
            room: 'Sala',
            openingWidth: 2.5,
            components: [
              {
                name: 'Tecido',
                quantity: 8.05,
                unit: 'm',
                unitPriceCents: 3000,
              },
            ],
          },
        ],
        generalAddOns: [
          { name: 'Instalação', quantity: 1, unitPriceCents: 15000 },
        ],
      });
      expect(mocks.get).toHaveBeenCalledWith({ id: QUOTE_ID });
      expect(response.body).toEqual(DETAIL_BODY);
    });

    it('accepts an empty body as a minimal draft', async () => {
      mocks.create.mockResolvedValue({ id: QUOTE_ID } as Quote);
      mocks.get.mockResolvedValue(sampleDetail());

      await request(server())
        .post(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .set(COOKIE)
        .expect(201);

      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.create.mock.calls[0][0]).toEqual({
        customerId: CUSTOMER_ID,
        notes: undefined,
        discount: undefined,
        commercialAdjustmentCents: undefined,
        installationAddress: undefined,
        curtains: undefined,
        generalAddOns: undefined,
      });
    });

    it('returns 404 when the customer does not exist or is inactive', async () => {
      mocks.create.mockRejectedValue(new QuoteCustomerNotFoundError());

      const response = await request(server())
        .post(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .set(COOKIE)
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Customer not found',
      });
      expect(mocks.get).not.toHaveBeenCalled();
    });

    it('rejects a malformed body before reaching the use case', async () => {
      await request(server())
        .post(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .set(COOKIE)
        .send({ curtains: 'not-an-array' })
        .expect(400);

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('rejects a malformed customer id before reaching the use case', async () => {
      await request(server())
        .post('/clientes/not-a-uuid/orcamentos')
        .set(COOKIE)
        .send({})
        .expect(400);

      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /clientes/:customerId/orcamentos', () => {
    it('returns the customer quote summaries', async () => {
      mocks.listByCustomer.mockResolvedValue([sampleSummary()]);

      const response = await request(server())
        .get(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.listByCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
      expect(response.body).toEqual([SUMMARY_BODY]);
    });

    it('returns 404 when the customer does not exist', async () => {
      mocks.listByCustomer.mockRejectedValue(new QuoteCustomerNotFoundError());

      await request(server())
        .get(`/clientes/${CUSTOMER_ID}/orcamentos`)
        .set(COOKIE)
        .expect(404);
    });

    it('returns 400 for a malformed customer id', async () => {
      await request(server())
        .get('/clientes/not-a-uuid/orcamentos')
        .set(COOKIE)
        .expect(400);

      expect(mocks.listByCustomer).not.toHaveBeenCalled();
    });
  });

  describe('GET /dashboard', () => {
    it('returns the exact dashboard contract as ISO 8601', async () => {
      mocks.dashboard.mockResolvedValue(sampleDashboard());

      const response = await request(server())
        .get('/dashboard')
        .set(COOKIE)
        .expect(200);

      expect(mocks.dashboard).toHaveBeenCalledTimes(1);
      expect(mocks.dashboard).toHaveBeenCalledWith();
      expect(response.body).toEqual({
        statusCounts: {
          draft: 1,
          sent: 2,
          expired: 3,
          confirmed: 4,
          inProduction: 5,
        },
        upcomingInstallations: [
          {
            quoteId: QUOTE_ID,
            quoteNumber: 'ORÇ-2026-0001',
            customerName: 'Maria Silva',
            scheduledInstallationAt: '2026-10-25T09:00:00.000Z',
            status: 'CONFIRMED',
          },
        ],
        weeklyInstallations: [
          {
            quoteId: CURTAIN_ID,
            quoteNumber: 'ORÇ-2026-0001',
            customerName: 'Maria Silva',
            scheduledInstallationAt: '2026-10-25T09:00:00.000Z',
            status: 'IN_PRODUCTION',
          },
        ],
        overdueInstallations: [
          {
            quoteId: COMPONENT_ID,
            quoteNumber: 'ORÇ-2026-0001',
            customerName: 'Maria Silva',
            scheduledInstallationAt: '2026-10-25T09:00:00.000Z',
            status: 'CONFIRMED',
          },
        ],
      });
      expect(response.body.statusCounts).not.toHaveProperty('completed');
      expect(response.body.statusCounts).not.toHaveProperty('cancelled');
      for (const list of [
        response.body.upcomingInstallations,
        response.body.weeklyInstallations,
        response.body.overdueInstallations,
      ]) {
        expect(list[0]).not.toHaveProperty('phone');
      }
    });

    it('ignores query parameters', async () => {
      mocks.dashboard.mockResolvedValue(sampleDashboard());

      await request(server())
        .get('/dashboard')
        .query({ status: 'DRAFT', limit: 1 })
        .set(COOKIE)
        .expect(200);

      expect(mocks.dashboard).toHaveBeenCalledWith();
    });

    it('preserves zero counters and empty arrays', async () => {
      mocks.dashboard.mockResolvedValue({
        statusCounts: {
          draft: 0,
          sent: 0,
          expired: 0,
          confirmed: 0,
          inProduction: 0,
        },
        upcomingInstallations: [],
        weeklyInstallations: [],
        overdueInstallations: [],
      });

      const response = await request(server())
        .get('/dashboard')
        .set(COOKIE)
        .expect(200);

      expect(response.body).toEqual({
        statusCounts: {
          draft: 0,
          sent: 0,
          expired: 0,
          confirmed: 0,
          inProduction: 0,
        },
        upcomingInstallations: [],
        weeklyInstallations: [],
        overdueInstallations: [],
      });
    });
  });

  describe('GET /orcamentos', () => {
    it('forwards the approved filters and returns summaries', async () => {
      mocks.search.mockResolvedValue([sampleSummary()]);

      const response = await request(server())
        .get('/orcamentos')
        .query({ search: ' maria ', status: 'SENT' })
        .set(COOKIE)
        .expect(200);

      expect(mocks.search).toHaveBeenCalledWith({
        search: ' maria ',
        status: 'SENT',
      });
      expect(response.body).toEqual([SUMMARY_BODY]);
    });

    it('supports the EXPIRED virtual status', async () => {
      mocks.search.mockResolvedValue([]);

      await request(server())
        .get('/orcamentos')
        .query({ status: 'EXPIRED' })
        .set(COOKIE)
        .expect(200);

      expect(mocks.search).toHaveBeenCalledWith({
        search: undefined,
        status: 'EXPIRED',
      });
    });

    it('rejects unknown statuses with 400', async () => {
      await request(server())
        .get('/orcamentos')
        .query({ status: 'INVALID' })
        .set(COOKIE)
        .expect(400);

      expect(mocks.search).not.toHaveBeenCalled();
    });
  });

  describe('GET /orcamentos/:id', () => {
    it('returns the detail contract as ISO 8601', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      const response = await request(server())
        .get(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.get).toHaveBeenCalledWith({ id: QUOTE_ID });
      expect(response.body).toEqual(DETAIL_BODY);
    });

    it('returns 404 when the quote does not exist', async () => {
      mocks.get.mockRejectedValue(new QuoteNotFoundError());

      const response = await request(server())
        .get(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Quote not found',
      });
    });

    it('returns 400 for a malformed id', async () => {
      await request(server())
        .get('/orcamentos/not-a-uuid')
        .set(COOKIE)
        .expect(400);

      expect(mocks.get).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /orcamentos/:id', () => {
    it('forwards only the provided fields and returns the updated detail', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      const response = await request(server())
        .patch(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .send({ notes: '  Revisado  ' })
        .expect(200);

      const [input] = mocks.update.mock.calls[0];

      expect(input.id).toBe(QUOTE_ID);
      expect(input).toMatchObject({ notes: 'Revisado' });
      expect(input.discount).toBeUndefined();
      expect(input.installationAddress).toBeUndefined();
      expect(input.curtains).toBeUndefined();
      expect(input.generalAddOns).toBeUndefined();
      expect(mocks.get).toHaveBeenCalledWith({ id: QUOTE_ID });
      expect(response.body).toEqual(DETAIL_BODY);
    });

    it('treats an empty patch as a no-op and returns the detail', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      const response = await request(server())
        .patch(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.update).toHaveBeenCalledWith({ id: QUOTE_ID });
      expect(response.body).toEqual(DETAIL_BODY);
    });

    it('accepts null to clear and preserves nested ids', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      await request(server())
        .patch(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .send({
          discount: null,
          curtains: [
            {
              id: CURTAIN_ID,
              components: [{ id: COMPONENT_ID, quantity: 9 }],
            },
          ],
        })
        .expect(200);

      const input = mocks.update.mock.calls[0][0];

      expect(input.discount).toBeNull();
      expect(input.curtains).toEqual([
        {
          id: CURTAIN_ID,
          room: undefined,
          description: undefined,
          material: undefined,
          openingWidth: undefined,
          borderValue: undefined,
          height: undefined,
          fabricFactor: undefined,
          notes: undefined,
          components: [
            {
              id: COMPONENT_ID,
              name: undefined,
              quantity: 9,
              unit: undefined,
              unitPriceCents: undefined,
            },
          ],
        },
      ]);
    });

    it('maps unknown child ids to 422', async () => {
      mocks.update.mockRejectedValue(new UnknownQuoteItemError());

      const response = await request(server())
        .patch(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .send({ notes: 'Revisado' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        message: 'Unknown or duplicated quote item id',
      });
      expect(mocks.get).not.toHaveBeenCalled();
    });

    it('maps a non-editable status to 409', async () => {
      mocks.update.mockRejectedValue(new QuoteNotEditableError());

      await request(server())
        .patch(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .send({ notes: 'Revisado' })
        .expect(409);
    });
  });

  describe('DELETE /orcamentos/:id', () => {
    it('deletes a draft and returns 204', async () => {
      await request(server())
        .delete(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(204);

      expect(mocks.remove).toHaveBeenCalledWith({ id: QUOTE_ID });
    });

    it('maps a non-draft deletion to 409', async () => {
      mocks.remove.mockRejectedValue(new InvalidQuoteTransitionError());

      await request(server())
        .delete(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(409);
    });

    it('returns 404 when the quote does not exist', async () => {
      mocks.remove.mockRejectedValue(new QuoteNotFoundError());

      await request(server())
        .delete(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(404);
    });
  });

  describe('POST /orcamentos/:id/enviar', () => {
    it('forwards the validity and returns the updated detail', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      const response = await request(server())
        .post(`/orcamentos/${QUOTE_ID}/enviar`)
        .set(COOKIE)
        .send({ validUntil: '2026-11-01T12:00:00.000Z' })
        .expect(200);

      expect(mocks.send).toHaveBeenCalledWith({
        id: QUOTE_ID,
        validUntil: new Date('2026-11-01T12:00:00.000Z'),
      });
      expect(mocks.get).toHaveBeenCalledWith({ id: QUOTE_ID });
      expect(response.body).toEqual(DETAIL_BODY);
    });

    it('accepts a send without a body', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/enviar`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.send).toHaveBeenCalledWith({
        id: QUOTE_ID,
        validUntil: undefined,
      });
    });

    it('maps the sending gate to 422 with violations', async () => {
      mocks.send.mockRejectedValue(
        new QuoteValidationError([
          {
            code: 'CUSTOMER_NOT_ACTIVE',
            message: 'Customer must exist and be active',
          },
        ]),
      );

      const response = await request(server())
        .post(`/orcamentos/${QUOTE_ID}/enviar`)
        .set(COOKIE)
        .send({})
        .expect(422);

      expect(response.body).toMatchObject({
        message: 'Quote does not satisfy the sending requirements',
        errors: [
          {
            code: 'CUSTOMER_NOT_ACTIVE',
            message: 'Customer must exist and be active',
          },
        ],
      });
    });

    it('maps an invalid transition to 409', async () => {
      mocks.send.mockRejectedValue(
        new InvalidQuoteTransitionError('Quote is already sent'),
      );

      const response = await request(server())
        .post(`/orcamentos/${QUOTE_ID}/enviar`)
        .set(COOKIE)
        .send({})
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Quote is already sent',
      });
    });
  });

  describe('state action routes', () => {
    for (const [route, mockName] of SIMPLE_ACTIONS) {
      it(`POST /orcamentos/:id/${route} delegates and returns the detail`, async () => {
        mocks.get.mockResolvedValue(sampleDetail());

        const response = await request(server())
          .post(`/orcamentos/${QUOTE_ID}/${route}`)
          .set(COOKIE)
          .expect(200);

        expect(mocks[mockName]).toHaveBeenCalledWith({ id: QUOTE_ID });
        expect(mocks.get).toHaveBeenCalledWith({ id: QUOTE_ID });
        expect(response.body).toEqual(DETAIL_BODY);
      });
    }

    it('POST /orcamentos/:id/renovar forwards the new validity', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/renovar`)
        .set(COOKIE)
        .send({ validUntil: '2026-12-01T12:00:00.000Z' })
        .expect(200);

      expect(mocks.renew).toHaveBeenCalledWith({
        id: QUOTE_ID,
        validUntil: new Date('2026-12-01T12:00:00.000Z'),
      });
    });

    it('POST /orcamentos/:id/renovar requires a valid date', async () => {
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/renovar`)
        .set(COOKIE)
        .send({ validUntil: '01/12/2026' })
        .expect(400);

      expect(mocks.renew).not.toHaveBeenCalled();
    });

    it('POST /orcamentos/:id/cancelar trims the reason', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/cancelar`)
        .set(COOKIE)
        .send({ reason: '  Cliente desistiu  ' })
        .expect(200);

      expect(mocks.cancel).toHaveBeenCalledWith({
        id: QUOTE_ID,
        reason: 'Cliente desistiu',
      });
    });

    it('POST /orcamentos/:id/cancelar normalizes a blank reason and accepts no body', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/cancelar`)
        .set(COOKIE)
        .send({ reason: '   ' })
        .expect(200);
      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/cancelar`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.cancel).toHaveBeenNthCalledWith(1, {
        id: QUOTE_ID,
        reason: null,
      });
      expect(mocks.cancel).toHaveBeenNthCalledWith(2, {
        id: QUOTE_ID,
        reason: undefined,
      });
    });

    it('POST /orcamentos/:id/concluir maps a future installation to 409', async () => {
      mocks.complete.mockRejectedValue(new InvalidQuoteTransitionError());

      await request(server())
        .post(`/orcamentos/${QUOTE_ID}/concluir`)
        .set(COOKIE)
        .expect(409);
    });
  });

  describe('installation routes', () => {
    it('PUT /orcamentos/:id/instalacao forwards the scheduled instant', async () => {
      mocks.get.mockResolvedValue(sampleDetail());

      const response = await request(server())
        .put(`/orcamentos/${QUOTE_ID}/instalacao`)
        .set(COOKIE)
        .send({ scheduledInstallationAt: '2026-10-25T09:00:00Z' })
        .expect(200);

      expect(mocks.scheduleInstallation).toHaveBeenCalledWith({
        id: QUOTE_ID,
        scheduledInstallationAt: new Date('2026-10-25T09:00:00.000Z'),
      });
      expect(response.body).toEqual(DETAIL_BODY);
    });

    it('PUT /orcamentos/:id/instalacao requires a valid instant', async () => {
      await request(server())
        .put(`/orcamentos/${QUOTE_ID}/instalacao`)
        .set(COOKIE)
        .send({ scheduledInstallationAt: 'tomorrow' })
        .expect(400);

      expect(mocks.scheduleInstallation).not.toHaveBeenCalled();
    });

    it('DELETE /orcamentos/:id/instalacao returns 204', async () => {
      await request(server())
        .delete(`/orcamentos/${QUOTE_ID}/instalacao`)
        .set(COOKIE)
        .expect(204);

      expect(mocks.removeInstallation).toHaveBeenCalledWith({ id: QUOTE_ID });
    });
  });

  describe('GET /orcamentos/:id/historico', () => {
    it('returns the events as ISO 8601, including opaque details', async () => {
      const entries: QuoteHistoryEntry[] = [
        {
          id: HISTORY_ID,
          eventType: 'QUOTE_CREATED',
          occurredAt: new Date('2026-10-19T12:00:00.000Z'),
          details: { quoteNumber: 'ORÇ-2026-0001' },
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          eventType: 'INSTALLATION_SCHEDULED',
          occurredAt: new Date('2026-10-20T12:00:00.000Z'),
          details: { scheduledInstallationAt: '2026-10-25T09:00:00.000Z' },
        },
      ];
      mocks.history.mockResolvedValue(entries);

      const response = await request(server())
        .get(`/orcamentos/${QUOTE_ID}/historico`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.history).toHaveBeenCalledWith({ id: QUOTE_ID });
      expect(response.body).toEqual([
        {
          id: HISTORY_ID,
          eventType: 'QUOTE_CREATED',
          occurredAt: '2026-10-19T12:00:00.000Z',
          details: { quoteNumber: 'ORÇ-2026-0001' },
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          eventType: 'INSTALLATION_SCHEDULED',
          occurredAt: '2026-10-20T12:00:00.000Z',
          details: { scheduledInstallationAt: '2026-10-25T09:00:00.000Z' },
        },
      ]);
    });

    it('returns 404 when the quote does not exist', async () => {
      mocks.history.mockRejectedValue(new QuoteNotFoundError());

      await request(server())
        .get(`/orcamentos/${QUOTE_ID}/historico`)
        .set(COOKIE)
        .expect(404);
    });
  });

  describe('document routes', () => {
    const PDF_BYTES = Buffer.from('%PDF-1.7\nrendered document\n%%EOF\n');

    const DOCUMENTS = [
      {
        route: 'pdf',
        mock: mocks.commercialPdf,
        disposition:
          'inline; filename="orcamento-ORC-2026-0001.pdf"; ' +
          "filename*=UTF-8''orcamento-OR%C3%87-2026-0001.pdf",
      },
      {
        route: 'ordem-producao',
        mock: mocks.productionOrder,
        disposition:
          'inline; filename="ordem-de-producao-ORC-2026-0001.pdf"; ' +
          "filename*=UTF-8''ordem-de-producao-OR%C3%87-2026-0001.pdf",
      },
    ] as const;

    it.each(DOCUMENTS)(
      'GET /orcamentos/:id/$route streams the rendered PDF',
      async ({ route, mock, disposition }) => {
        mocks.get.mockResolvedValue(sampleDetail());
        mock.mockResolvedValue(PDF_BYTES);

        const response = await request(server())
          .get(`/orcamentos/${QUOTE_ID}/${route}`)
          .set(COOKIE)
          .expect(200);

        expect(mocks.get).toHaveBeenCalledWith({ id: QUOTE_ID });
        expect(mock).toHaveBeenCalledWith({ id: QUOTE_ID });
        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toBe(disposition);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['content-length']).toBe(
          String(PDF_BYTES.byteLength),
        );
        // A raw PDF body, not a JSON envelope.
        expect(Buffer.isBuffer(response.body)).toBe(true);
        expect(response.body.toString('ascii').slice(0, 5)).toBe('%PDF-');
        expect(response.body.equals(PDF_BYTES)).toBe(true);
      },
    );

    it.each(['pdf', 'ordem-producao'])(
      'rejects a malformed id on /%s before reading the quote',
      async (route) => {
        await request(server())
          .get(`/orcamentos/not-a-uuid/${route}`)
          .set(COOKIE)
          .expect(400);

        expect(mocks.get).not.toHaveBeenCalled();
        expect(mocks.commercialPdf).not.toHaveBeenCalled();
        expect(mocks.productionOrder).not.toHaveBeenCalled();
      },
    );

    it.each(DOCUMENTS)(
      'returns 404 on /$route when the quote does not exist',
      async ({ route, mock }) => {
        mocks.get.mockRejectedValue(new QuoteNotFoundError());

        const response = await request(server())
          .get(`/orcamentos/${QUOTE_ID}/${route}`)
          .set(COOKIE)
          .expect(404);

        expect(response.body).toMatchObject({
          statusCode: 404,
          message: 'Quote not found',
        });
        expect(mock).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        DocumentNotAvailableError,
        'Document is not available in the current status',
      ],
      [BusinessDataNotConfiguredError, 'Business data is not configured'],
      [DocumentCustomerNotFoundError, 'Document data is incomplete'],
      [DocumentDataIncompleteError, 'Document data is incomplete'],
    ])('maps %s to 409', async (ErrorClass, message) => {
      mocks.get.mockResolvedValue(sampleDetail());
      mocks.commercialPdf.mockRejectedValue(new ErrorClass());

      const response = await request(server())
        .get(`/orcamentos/${QUOTE_ID}/pdf`)
        .set(COOKIE)
        .expect(409);

      expect(response.body).toMatchObject({ statusCode: 409, message });
    });

    it('maps a production order conflict to 409', async () => {
      mocks.get.mockResolvedValue(sampleDetail());
      mocks.productionOrder.mockRejectedValue(new DocumentNotAvailableError());

      await request(server())
        .get(`/orcamentos/${QUOTE_ID}/ordem-producao`)
        .set(COOKIE)
        .expect(409);
    });

    it.each([
      [DocumentRenderError, 'rendering failure'],
      [DocumentHistoryWriteError, 'history failure'],
    ])(
      'maps %s to 500 without exposing technical details',
      async (ErrorClass, detail) => {
        mocks.get.mockResolvedValue(sampleDetail());
        mocks.commercialPdf.mockRejectedValue(
          new ErrorClass(new Error(detail)),
        );

        const response = await request(server())
          .get(`/orcamentos/${QUOTE_ID}/pdf`)
          .set(COOKIE)
          .expect(500);

        expect(response.body).toMatchObject({
          statusCode: 500,
          message: 'Could not generate the document',
        });
        expect(JSON.stringify(response.body)).not.toContain(detail);
      },
    );
  });

  describe('unexpected failures', () => {
    it('does not leak persistence errors', async () => {
      mocks.get.mockRejectedValue(new Error('P2002: unique constraint'));

      const response = await request(server())
        .get(`/orcamentos/${QUOTE_ID}`)
        .set(COOKIE)
        .expect(500);

      expect(response.body).toMatchObject({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(JSON.stringify(response.body)).not.toContain('P2002');
    });
  });
});
