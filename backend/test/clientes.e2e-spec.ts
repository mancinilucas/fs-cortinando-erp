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

const ORIGIN = 'http://localhost:5173';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Customers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let createdIds: string[];
  let originalAppOrigin: string | undefined;

  const email = `e2e-clientes-${randomUUID()}@example.com`;
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
  });

  beforeEach(() => {
    createdIds = [];
  });

  afterEach(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
  });

  afterAll(async () => {
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

  it('runs the customer flow from creation to soft delete', async () => {
    const token = randomUUID();
    const name = `Maria ${token}`;

    const created = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        name: `  ${name}  `,
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
        notes: '  Cliente preferencial  ',
      })
      .expect(201);

    const id = created.body.id as string;
    createdIds.push(id);

    expect(created.body).toMatchObject({
      id,
      name,
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
    expect(created.body.createdAt).toMatch(ISO_DATE);
    expect(created.body.updatedAt).toMatch(ISO_DATE);
    expect(created.body).not.toHaveProperty('deletedAt');

    const fetched = await request(server())
      .get(`/clientes/${id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(fetched.body).toEqual(created.body);

    const search = await request(server())
      .get('/clientes')
      .query({ search: token })
      .set('Cookie', cookie)
      .expect(200);

    expect(search.body).toEqual([
      { id, name, phone: '(11) 99999-9999', email: 'maria@example.com' },
    ]);

    const patched = await request(server())
      .patch(`/clientes/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ name: `Maria Souza ${token}`, address: null })
      .expect(200);

    expect(patched.body).toMatchObject({
      id,
      name: `Maria Souza ${token}`,
      phone: '(11) 99999-9999',
      email: 'maria@example.com',
      address: null,
    });
    expect(patched.body.updatedAt).toMatch(ISO_DATE);

    await request(server())
      .delete(`/clientes/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(204);

    // Idempotent repeated delete.
    await request(server())
      .delete(`/clientes/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(204);

    const afterDelete = await request(server())
      .get(`/clientes/${id}`)
      .set('Cookie', cookie)
      .expect(404);

    expect(afterDelete.body).toMatchObject({
      statusCode: 404,
      message: 'Customer not found',
    });
  });

  it('rejects unauthenticated access to every route', async () => {
    const id = randomUUID();

    await request(server()).get('/clientes').expect(401);
    await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .send({ name: 'Maria', phone: '11999999999' })
      .expect(401);
    await request(server()).get(`/clientes/${id}`).expect(401);
    await request(server())
      .patch(`/clientes/${id}`)
      .set('Origin', ORIGIN)
      .send({ name: 'Maria' })
      .expect(401);
    await request(server())
      .delete(`/clientes/${id}`)
      .set('Origin', ORIGIN)
      .expect(401);
  });

  it('rejects a partial address with 400 and creates nothing', async () => {
    const token = randomUUID();

    const response = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        name: `Partial ${token}`,
        phone: '11999999999',
        address: { city: 'Campinas' },
      })
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
    await expect(
      prisma.customer.findFirst({ where: { name: { contains: token } } }),
    ).resolves.toBeNull();
  });

  it('rejects a malformed id with 400', async () => {
    await request(server())
      .get('/clientes/not-a-uuid')
      .set('Cookie', cookie)
      .expect(400);
    await request(server())
      .patch('/clientes/not-a-uuid')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ name: 'Maria' })
      .expect(400);
    await request(server())
      .delete('/clientes/not-a-uuid')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('allows duplicated tax ids', async () => {
    const token = randomUUID();
    const body = {
      phone: '11999999999',
      taxId: '12345678901',
    };

    const first = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ ...body, name: `First ${token}` })
      .expect(201);

    createdIds.push(first.body.id);

    const second = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ ...body, name: `Second ${token}` })
      .expect(201);

    createdIds.push(second.body.id);

    expect(first.body.id).not.toBe(second.body.id);
    expect(first.body.taxId).toBe('12345678901');
    expect(second.body.taxId).toBe('12345678901');

    await expect(
      prisma.customer.count({
        where: { id: { in: [first.body.id, second.body.id] } },
      }),
    ).resolves.toBe(2);
  });
});
