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
import { CreateCustomerUseCase } from '../application/create-customer.use-case.js';
import { CustomerNotFoundError } from '../application/customer-not-found.error.js';
import { DeleteCustomerUseCase } from '../application/delete-customer.use-case.js';
import { GetCustomerUseCase } from '../application/get-customer.use-case.js';
import { SearchCustomersQuery } from '../application/search-customers.query.js';
import { UpdateCustomerUseCase } from '../application/update-customer.use-case.js';
import { Customer } from '../domain/customer.js';
import type { CustomerSnapshot } from '../domain/customer.js';
import { CustomerAddress } from '../domain/value-objects/customer-address.js';
import { ClientesController } from './clientes.controller.js';

const CUSTOMER_ID = '7a4b2c9e-0000-4000-8000-000000000000';
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
  create: vi.fn<CreateCustomerUseCase['execute']>(),
  get: vi.fn<GetCustomerUseCase['execute']>(),
  update: vi.fn<UpdateCustomerUseCase['execute']>(),
  delete: vi.fn<DeleteCustomerUseCase['execute']>(),
  search: vi.fn<SearchCustomersQuery['execute']>(),
};

function sampleCustomer(overrides: Partial<CustomerSnapshot> = {}): Customer {
  return Customer.rehydrate({
    id: CUSTOMER_ID,
    name: 'Maria Silva',
    phone: '(11) 99999-9999',
    email: 'maria@example.com',
    taxId: '12345678901',
    address: CustomerAddress.create({
      postalCode: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 10',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    }),
    notes: 'Cliente preferencial',
    createdAt: new Date('2026-10-19T12:00:00.000Z'),
    updatedAt: new Date('2026-10-19T13:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  });
}

const DETAIL_BODY = {
  id: CUSTOMER_ID,
  name: 'Maria Silva',
  phone: '(11) 99999-9999',
  email: 'maria@example.com',
  taxId: '12345678901',
  address: {
    postalCode: '01310100',
    street: 'Avenida Paulista',
    number: '1000',
    complement: 'Apto 10',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
  notes: 'Cliente preferencial',
  createdAt: '2026-10-19T12:00:00.000Z',
  updatedAt: '2026-10-19T13:00:00.000Z',
};

describe('ClientesController (HTTP)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ClientesController],
      providers: [
        SessionTokenService,
        AuthGuard,
        { provide: SessionStore, useValue: new FakeSessionStore() },
        { provide: UserStore, useValue: new FakeUserStore() },
        { provide: CreateCustomerUseCase, useValue: { execute: mocks.create } },
        { provide: GetCustomerUseCase, useValue: { execute: mocks.get } },
        {
          provide: UpdateCustomerUseCase,
          useValue: { execute: mocks.update },
        },
        { provide: DeleteCustomerUseCase, useValue: { execute: mocks.delete } },
        { provide: SearchCustomersQuery, useValue: { execute: mocks.search } },
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

  describe('authentication', () => {
    it('protects every route with AuthGuard', async () => {
      const server = app.getHttpServer();

      await request(server).get('/clientes').expect(401);
      await request(server).post('/clientes').send({}).expect(401);
      await request(server).get(`/clientes/${CUSTOMER_ID}`).expect(401);
      await request(server)
        .patch(`/clientes/${CUSTOMER_ID}`)
        .send({})
        .expect(401);
      await request(server).delete(`/clientes/${CUSTOMER_ID}`).expect(401);
    });

    it('returns the generic authentication message', async () => {
      const response = await request(app.getHttpServer())
        .get('/clientes')
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });

    it('rejects an unknown session token', async () => {
      await request(app.getHttpServer())
        .get('/clientes')
        .set('Cookie', `cortinando_session=${'a'.repeat(43)}`)
        .expect(401);
    });
  });

  describe('GET /clientes', () => {
    it('forwards the search term and returns summaries', async () => {
      mocks.search.mockResolvedValue([
        {
          id: CUSTOMER_ID,
          name: 'Maria Silva',
          phone: '11999999999',
          email: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/clientes')
        .query({ search: ' maria ', ignored: 'x' })
        .set(COOKIE)
        .expect(200);

      expect(mocks.search).toHaveBeenCalledWith(' maria ');
      expect(response.body).toEqual([
        {
          id: CUSTOMER_ID,
          name: 'Maria Silva',
          phone: '11999999999',
          email: null,
        },
      ]);
    });

    it('lists all customers when search is omitted', async () => {
      mocks.search.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/clientes')
        .set(COOKIE)
        .expect(200);

      expect(mocks.search).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /clientes/:id', () => {
    it('returns the detail contract without deletedAt', async () => {
      mocks.get.mockResolvedValue(sampleCustomer());

      const response = await request(app.getHttpServer())
        .get(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .expect(200);

      expect(mocks.get).toHaveBeenCalledWith(CUSTOMER_ID);
      expect(response.body).toEqual(DETAIL_BODY);
      expect(response.body).not.toHaveProperty('deletedAt');
    });

    it('returns 404 for a customer that does not exist', async () => {
      mocks.get.mockRejectedValue(new CustomerNotFoundError());

      const response = await request(app.getHttpServer())
        .get(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Customer not found',
      });
    });

    it('returns 400 for a malformed id before reaching the use case', async () => {
      await request(app.getHttpServer())
        .get('/clientes/not-a-uuid')
        .set(COOKIE)
        .expect(400);

      expect(mocks.get).not.toHaveBeenCalled();
    });
  });

  describe('POST /clientes', () => {
    it('creates a customer and returns the persisted detail', async () => {
      mocks.create.mockResolvedValue(sampleCustomer());
      mocks.get.mockResolvedValue(sampleCustomer());

      const response = await request(app.getHttpServer())
        .post('/clientes')
        .set(COOKIE)
        .send({
          id: 'ignored-id',
          createdAt: '2026-10-19T11:00:00.000Z',
          name: '  Maria Silva  ',
          phone: '  (11) 99999-9999  ',
          email: '  MARIA@EXAMPLE.COM ',
          taxId: '123.456.789-01',
          address: {
            postalCode: '01310-100',
            street: ' Avenida Paulista ',
            number: ' 1000 ',
            complement: ' Apto 10 ',
            neighborhood: ' Bela Vista ',
            city: ' São Paulo ',
            state: 'sp',
          },
          notes: ' Cliente preferencial ',
        })
        .expect(201);

      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.create.mock.calls[0][0]).toMatchObject({
        name: 'Maria Silva',
        phone: '(11) 99999-9999',
        email: 'maria@example.com',
        taxId: '12345678901',
        address: {
          postalCode: '01310100',
          street: 'Avenida Paulista',
          number: '1000',
          complement: 'Apto 10',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        notes: 'Cliente preferencial',
      });
      expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('id');
      expect(mocks.get).toHaveBeenCalledWith(CUSTOMER_ID);
      expect(response.body).toEqual(DETAIL_BODY);
      expect(response.body).not.toHaveProperty('deletedAt');
    });

    it('rejects an invalid payload with 400 before reaching the use case', async () => {
      await request(app.getHttpServer())
        .post('/clientes')
        .set(COOKIE)
        .send({ name: 'Maria Silva' })
        .expect(400);

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('does not leak unexpected persistence errors', async () => {
      mocks.create.mockRejectedValue(new Error('P2002: unique constraint'));

      const response = await request(app.getHttpServer())
        .post('/clientes')
        .set(COOKIE)
        .send({ name: 'Maria Silva', phone: '11999999999' })
        .expect(500);

      expect(response.body).toMatchObject({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(JSON.stringify(response.body)).not.toContain('P2002');
    });
  });

  describe('PATCH /clientes/:id', () => {
    it('forwards only the provided fields and returns the updated detail', async () => {
      mocks.update.mockResolvedValue(sampleCustomer());
      mocks.get.mockResolvedValue(
        sampleCustomer({
          name: 'Maria Souza',
          updatedAt: new Date('2026-10-19T14:00:00.000Z'),
        }),
      );

      const response = await request(app.getHttpServer())
        .patch(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .send({ name: ' Maria Souza ' })
        .expect(200);

      const [id, input] = mocks.update.mock.calls[0];

      expect(id).toBe(CUSTOMER_ID);
      expect(input).toMatchObject({ name: 'Maria Souza' });
      expect(input.email).toBeUndefined();
      expect(input.address).toBeUndefined();
      expect(mocks.get).toHaveBeenCalledWith(CUSTOMER_ID);
      expect(response.body).toEqual({
        ...DETAIL_BODY,
        name: 'Maria Souza',
        updatedAt: '2026-10-19T14:00:00.000Z',
      });
    });

    it('treats an empty body as a no-op', async () => {
      mocks.update.mockResolvedValue(sampleCustomer());
      mocks.get.mockResolvedValue(sampleCustomer());

      await request(app.getHttpServer())
        .patch(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .send({})
        .expect(200);

      expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    it('rejects a partial address with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .send({ address: { city: 'Campinas' } })
        .expect(400);

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('returns 404 for a customer that does not exist', async () => {
      mocks.update.mockRejectedValue(new CustomerNotFoundError());

      await request(app.getHttpServer())
        .patch(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .send({ name: 'Maria Souza' })
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .patch('/clientes/not-a-uuid')
        .set(COOKIE)
        .send({ name: 'Maria Souza' })
        .expect(400);

      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /clientes/:id', () => {
    it('returns 204 and removes the customer', async () => {
      mocks.delete.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .delete(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .expect(204);

      expect(response.text).toBe('');
      expect(mocks.delete).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('returns 204 when the customer is already deleted', async () => {
      mocks.delete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .expect(204);
    });

    it('returns 404 when the customer never existed', async () => {
      mocks.delete.mockRejectedValue(new CustomerNotFoundError());

      const response = await request(app.getHttpServer())
        .delete(`/clientes/${CUSTOMER_ID}`)
        .set(COOKIE)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Customer not found',
      });
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .delete('/clientes/not-a-uuid')
        .set(COOKIE)
        .expect(400);

      expect(mocks.delete).not.toHaveBeenCalled();
    });
  });
});
