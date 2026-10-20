import 'dotenv/config';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { PrismaBusinessDataStore } from './prisma-business-data.store.js';

describe('PrismaBusinessDataStore', () => {
  let prisma: PrismaService;
  let store: PrismaBusinessDataStore;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    store = new PrismaBusinessDataStore(prisma);
  });

  beforeEach(async () => {
    await prisma.businessData.deleteMany();
  });

  afterAll(async () => {
    await prisma.businessData.deleteMany();
    await prisma.$disconnect();
  });

  it('returns null when the configuration does not exist', async () => {
    await expect(store.find()).resolves.toBeNull();
  });

  it('creates the singleton and reads it back', async () => {
    const created = await store.upsert({
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });

    expect(created).toEqual({
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
      updatedAt: expect.any(Date),
    });

    const row = await prisma.businessData.findUnique({
      where: { id: 'business' },
    });

    expect(row).toMatchObject({
      id: 'business',
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });
    await expect(store.find()).resolves.toEqual(created);
  });

  it('updates the same singleton without creating another row', async () => {
    const first = await store.upsert({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: null,
      taxId: null,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const second = await store.upsert({
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

  it('always reads the singleton identifier even if another row exists', async () => {
    await prisma.businessData.create({
      data: {
        id: 'other',
        commercialNameOrConsultant: 'Other',
        phone: '00000000000',
      },
    });
    await store.upsert({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: null,
      taxId: null,
    });

    await expect(store.find()).resolves.toMatchObject({
      commercialNameOrConsultant: 'Cortinando',
    });
  });
});
