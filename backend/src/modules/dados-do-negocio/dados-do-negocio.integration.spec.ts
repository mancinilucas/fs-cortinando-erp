import 'dotenv/config';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { BusinessDataNotFoundError } from './application/business-data-not-found.error.js';
import { BusinessDataValidationError } from './application/business-data-validation.error.js';
import { GetBusinessDataQuery } from './application/get-business-data.query.js';
import { UpdateBusinessDataUseCase } from './application/update-business-data.use-case.js';
import { PrismaBusinessDataStore } from './infrastructure/prisma-business-data.store.js';

// Exercises the module against the real PostgreSQL database: store, query and
// use case are wired without mocks (D138). This is the only test file that
// writes to business_data, and each test starts from an empty table.
describe('Dados do Negocio module integration', () => {
  let prisma: PrismaService;
  let getBusinessData: GetBusinessDataQuery;
  let updateBusinessData: UpdateBusinessDataUseCase;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const store = new PrismaBusinessDataStore(prisma);
    getBusinessData = new GetBusinessDataQuery(store);
    updateBusinessData = new UpdateBusinessDataUseCase(store);
  });

  beforeEach(async () => {
    await prisma.businessData.deleteMany();
  });

  afterAll(async () => {
    await prisma.businessData.deleteMany();
    await prisma.$disconnect();
  });

  it('reports absence while the configuration does not exist', async () => {
    await expect(getBusinessData.execute()).rejects.toBeInstanceOf(
      BusinessDataNotFoundError,
    );
    await expect(prisma.businessData.count()).resolves.toBe(0);
  });

  it('creates the singleton with normalized values', async () => {
    const created = await updateBusinessData.execute({
      commercialNameOrConsultant: '  Cortinando  ',
      phone: '  (11) 99999-9999  ',
      email: '  Contato@Example.COM ',
      taxId: '123.456.789-01',
    });

    expect(created).toMatchObject({
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });
    expect(created.updatedAt).toBeInstanceOf(Date);

    const rows = await prisma.businessData.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'business',
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });
  });

  it('reads the configured business data through the query', async () => {
    await updateBusinessData.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });

    await expect(getBusinessData.execute()).resolves.toMatchObject({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });
  });

  it('updates the same singleton and refreshes updatedAt', async () => {
    const first = await updateBusinessData.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const second = await updateBusinessData.execute({
      commercialNameOrConsultant: 'Cortinando Consultoria',
      phone: '11888887777',
      email: 'contato@example.com',
      taxId: '12345678000190',
    });

    expect(second).toMatchObject({
      commercialNameOrConsultant: 'Cortinando Consultoria',
      phone: '11888887777',
      email: 'contato@example.com',
      taxId: '12345678000190',
    });
    expect(second.updatedAt.getTime()).toBeGreaterThan(
      first.updatedAt.getTime(),
    );
    await expect(prisma.businessData.count()).resolves.toBe(1);
  });

  it('replaces all fields and clears omitted optional fields', async () => {
    await updateBusinessData.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });

    await updateBusinessData.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
    });

    await expect(getBusinessData.execute()).resolves.toMatchObject({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: null,
      taxId: null,
    });
  });

  it('does not persist a blank required field', async () => {
    await expect(
      updateBusinessData.execute({
        commercialNameOrConsultant: '   ',
        phone: '11999999999',
      }),
    ).rejects.toBeInstanceOf(BusinessDataValidationError);
    await expect(prisma.businessData.count()).resolves.toBe(0);
  });

  it('does not persist an invalid email', async () => {
    await expect(
      updateBusinessData.execute({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        email: 'not-an-email',
      }),
    ).rejects.toBeInstanceOf(BusinessDataValidationError);
    await expect(prisma.businessData.count()).resolves.toBe(0);
  });

  it('does not persist a tax id without 11 or 14 digits', async () => {
    await expect(
      updateBusinessData.execute({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        taxId: '1234567890',
      }),
    ).rejects.toBeInstanceOf(BusinessDataValidationError);
    await expect(prisma.businessData.count()).resolves.toBe(0);
  });

  it('always reads the singleton identifier even if another row exists', async () => {
    await prisma.businessData.create({
      data: {
        id: 'other',
        commercialNameOrConsultant: 'Other',
        phone: '00000000000',
      },
    });
    await updateBusinessData.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
    });

    await expect(getBusinessData.execute()).resolves.toMatchObject({
      commercialNameOrConsultant: 'Cortinando',
    });
  });
});
