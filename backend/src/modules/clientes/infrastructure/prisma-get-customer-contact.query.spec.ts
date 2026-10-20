import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { PrismaGetCustomerContactQuery } from './prisma-get-customer-contact.query.js';

describe('PrismaGetCustomerContactQuery', () => {
  let prisma: PrismaService;
  let query: PrismaGetCustomerContactQuery;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    query = new PrismaGetCustomerContactQuery(prisma);
  });

  beforeEach(() => {
    createdIds = [];
  });

  afterEach(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createCustomer(
    options: { deleted?: boolean } = {},
  ): Promise<{ id: string; name: string; phone: string }> {
    const customer = await prisma.customer.create({
      data: {
        name: `Contato ${randomUUID()}`,
        phone: '(11) 98888-7777',
        email: 'sentinel@example.com',
        taxId: '12345678901',
        addressStreet: 'Rua Sentinela 123',
        notes: 'SENTINELA-NOTA',
        deletedAt: options.deleted ? new Date() : null,
      },
      select: { id: true, name: true, phone: true },
    });

    createdIds.push(customer.id);

    return customer;
  }

  it('returns only name and phone for an active customer', async () => {
    const created = await createCustomer();

    const contact = await query.execute(created.id);

    expect(contact).toEqual({ name: created.name, phone: created.phone });
    expect(Object.keys(contact ?? {}).sort()).toEqual(['name', 'phone']);
  });

  it('reads a soft-deleted customer', async () => {
    const created = await createCustomer({ deleted: true });

    await expect(query.execute(created.id)).resolves.toEqual({
      name: created.name,
      phone: created.phone,
    });
  });

  it('returns null when the customer does not exist', async () => {
    await expect(query.execute(randomUUID())).resolves.toBeNull();
  });
});
