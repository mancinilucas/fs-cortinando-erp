import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { CreateCustomerUseCase } from './application/create-customer.use-case.js';
import { CustomerNotFoundError } from './application/customer-not-found.error.js';
import { DeleteCustomerUseCase } from './application/delete-customer.use-case.js';
import { GetCustomerUseCase } from './application/get-customer.use-case.js';
import { SearchCustomersQuery } from './application/search-customers.query.js';
import { UpdateCustomerUseCase } from './application/update-customer.use-case.js';
import { Customer } from './domain/customer.js';
import type { CreateCustomerInput } from './domain/customer.js';
import { CustomerRepository } from './domain/repositories/customer.repository.js';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository.js';
import { PrismaSearchCustomersQuery } from './infrastructure/prisma-search-customers.query.js';

// Exercises the module against the real PostgreSQL database: use cases and
// repository/query services are wired without mocks (CLIENTES-21).
describe('Clientes module integration', () => {
  let prisma: PrismaService;
  let createCustomer: CreateCustomerUseCase;
  let getCustomer: GetCustomerUseCase;
  let updateCustomer: UpdateCustomerUseCase;
  let deleteCustomer: DeleteCustomerUseCase;
  let searchCustomers: SearchCustomersQuery;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const repository: CustomerRepository = new PrismaCustomerRepository(prisma);
    createCustomer = new CreateCustomerUseCase(repository);
    getCustomer = new GetCustomerUseCase(repository);
    updateCustomer = new UpdateCustomerUseCase(repository);
    deleteCustomer = new DeleteCustomerUseCase(repository);
    searchCustomers = new PrismaSearchCustomersQuery(prisma);
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

  async function create(
    input: Partial<CreateCustomerInput> = {},
  ): Promise<Customer> {
    const customer = await createCustomer.execute({
      name: `Maria ${randomUUID()}`,
      phone: '11999999999',
      ...input,
    });
    createdIds.push(customer.id);

    return customer;
  }

  it('creates, looks up and persists the address block', async () => {
    const token = randomUUID();

    const created = await create({
      name: `  Maria ${token}  `,
      email: '  Maria@Example.COM ',
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
    });

    const found = await getCustomer.execute(created.id);

    expect(found.name).toBe(`Maria ${token}`);
    expect(found.email).toBe('maria@example.com');
    expect(found.taxId).toBe('12345678901');
    expect(found.address).toMatchObject({
      postalCode: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 10',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });

    const row = await prisma.customer.findUnique({ where: { id: created.id } });

    expect(row).toMatchObject({
      name: `Maria ${token}`,
      email: 'maria@example.com',
      taxId: '12345678901',
      addressPostalCode: '01310100',
      addressStreet: 'Avenida Paulista',
      addressNumber: '1000',
      addressComplement: 'Apto 10',
      addressNeighborhood: 'Bela Vista',
      addressCity: 'São Paulo',
      addressState: 'SP',
      notes: 'Cliente preferencial',
      deletedAt: null,
    });
  });

  it('updates fields and clears optional data', async () => {
    const created = await create({
      email: 'maria@example.com',
      taxId: '12345678901',
      address: {
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
      },
      notes: 'Cliente preferencial',
    });
    const token = randomUUID();

    const updated = await updateCustomer.execute(created.id, {
      name: `  Maria ${token}  `,
      email: null,
      taxId: null,
      address: null,
      notes: null,
    });

    expect(updated.name).toBe(`Maria ${token}`);
    expect(updated.phone).toBe('11999999999');
    expect(updated.email).toBeNull();
    expect(updated.taxId).toBeNull();
    expect(updated.address).toBeNull();
    expect(updated.notes).toBeNull();

    await expect(
      prisma.customer.findUnique({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      name: `Maria ${token}`,
      phone: '11999999999',
      email: null,
      taxId: null,
      addressPostalCode: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
      notes: null,
    });
  });

  it('soft deletes, hides the customer from lookups and is idempotent', async () => {
    const created = await create();

    await deleteCustomer.execute(created.id);

    await expect(getCustomer.execute(created.id)).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );

    const first = await prisma.customer.findUnique({
      where: { id: created.id },
    });

    expect(first).not.toBeNull();
    expect(first!.deletedAt).toBeInstanceOf(Date);

    await deleteCustomer.execute(created.id);

    const second = await prisma.customer.findUnique({
      where: { id: created.id },
    });

    expect(second).not.toBeNull();
    expect(second!.deletedAt).toEqual(first!.deletedAt);
    expect(second!.updatedAt).toEqual(first!.updatedAt);
  });

  it('searches active customers by name in ascending order', async () => {
    const token = randomUUID();

    const alpha = await create({ name: `Alpha ${token}` });
    const zulu = await create({ name: `Zulu ${token}` });
    const deleted = await create({ name: `Mike ${token}` });

    await deleteCustomer.execute(deleted.id);

    const results = await searchCustomers.execute(token);

    expect(results.map((summary) => summary.id)).toEqual([alpha.id, zulu.id]);
    expect(results[0]).toMatchObject({
      id: alpha.id,
      name: `Alpha ${token}`,
      phone: '11999999999',
    });
  });

  it('allows duplicated tax ids', async () => {
    const first = await create({ taxId: '12345678901' });
    const second = await create({ taxId: '12345678901' });

    const rows = await prisma.customer.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { taxId: true },
    });

    expect(rows.map((row) => row.taxId)).toEqual([
      '12345678901',
      '12345678901',
    ]);
  });

  it('keeps historical quotes after the customer is soft-deleted', async () => {
    const customer = await create();
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `Q-${randomUUID()}`,
        customerId: customer.id,
        status: 'DRAFT',
      },
      select: { id: true },
    });

    try {
      await deleteCustomer.execute(customer.id);

      await expect(
        prisma.quote.findUnique({ where: { id: quote.id } }),
      ).resolves.toMatchObject({ customerId: customer.id });
    } finally {
      await prisma.quote.delete({ where: { id: quote.id } });
    }
  });

  it('blocks physical deletion of a customer with quotes', async () => {
    const customer = await create();
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `Q-${randomUUID()}`,
        customerId: customer.id,
        status: 'DRAFT',
      },
      select: { id: true },
    });

    try {
      await expect(
        prisma.customer.delete({ where: { id: customer.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      await prisma.quote.delete({ where: { id: quote.id } });
    }
  });
});
