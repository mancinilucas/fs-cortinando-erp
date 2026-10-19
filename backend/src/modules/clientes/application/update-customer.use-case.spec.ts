import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { Customer, CreateCustomerInput } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { PrismaCustomerRepository } from '../infrastructure/prisma-customer.repository.js';
import { CustomerNotFoundError } from './customer-not-found.error.js';
import { UpdateCustomerUseCase } from './update-customer.use-case.js';

describe('UpdateCustomerUseCase', () => {
  let prisma: PrismaService;
  let repository: CustomerRepository;
  let useCase: UpdateCustomerUseCase;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    repository = new PrismaCustomerRepository(prisma);
    useCase = new UpdateCustomerUseCase(repository);
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

  async function seed(
    overrides: Partial<CreateCustomerInput> = {},
  ): Promise<Customer> {
    const customer = Customer.create({
      name: `Maria ${randomUUID()}`,
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
      ...overrides,
    });

    await repository.save(customer);
    createdIds.push(customer.id);

    return customer;
  }

  async function row(id: string) {
    return prisma.customer.findUnique({ where: { id } });
  }

  it('patches a single field and keeps every omitted field', async () => {
    const customer = await seed();
    const name = `Maria ${randomUUID()}`;

    const updated = await useCase.execute(customer.id, { name });

    expect(updated.name).toBe(name);
    expect(updated.phone).toBe(customer.phone);
    expect(updated.email).toBe(customer.email);
    expect(updated.taxId).toBe(customer.taxId);
    expect(updated.notes).toBe(customer.notes);
    expect(updated.address).toMatchObject({
      street: 'Avenida Paulista',
    });

    await expect(row(customer.id)).resolves.toMatchObject({
      name,
      phone: '(11) 99999-9999',
      email: 'maria@example.com',
      taxId: '12345678901',
      addressStreet: 'Avenida Paulista',
      addressPostalCode: '01310100',
      notes: 'Cliente preferencial',
    });
  });

  it('clears optional fields sent as null or blank', async () => {
    const customer = await seed();

    await useCase.execute(customer.id, {
      email: null,
      taxId: '   ',
      notes: null,
      address: null,
    });

    await expect(row(customer.id)).resolves.toMatchObject({
      email: null,
      taxId: null,
      notes: null,
      addressPostalCode: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
    });
  });

  it('replaces the whole address block', async () => {
    const customer = await seed();

    await useCase.execute(customer.id, {
      address: {
        street: 'Rua Nova',
        number: '42',
        neighborhood: 'Centro',
        city: 'Campinas',
      },
    });

    await expect(row(customer.id)).resolves.toMatchObject({
      addressPostalCode: null,
      addressStreet: 'Rua Nova',
      addressNumber: '42',
      addressComplement: null,
      addressNeighborhood: 'Centro',
      addressCity: 'Campinas',
      addressState: null,
    });
  });

  it('rejects a partial address and keeps the stored one', async () => {
    const customer = await seed();

    await expect(
      useCase.execute(customer.id, {
        address: { city: 'Campinas' },
      }),
    ).rejects.toThrow(/requires street, number, neighborhood and city/);

    await expect(row(customer.id)).resolves.toMatchObject({
      addressStreet: 'Avenida Paulista',
      addressCity: 'São Paulo',
    });
  });

  it('revalidates required fields and the tax id format', async () => {
    const customer = await seed();

    await expect(useCase.execute(customer.id, { name: '   ' })).rejects.toThrow(
      /Customer name is required/,
    );
    await expect(useCase.execute(customer.id, { phone: null })).rejects.toThrow(
      /Customer phone is required/,
    );
    await expect(
      useCase.execute(customer.id, { taxId: '123' }),
    ).rejects.toThrow(/Customer tax ID must have 11 or 14 digits/);
  });

  it('allows the tax id of another customer', async () => {
    const first = await seed();
    const second = await seed({ taxId: '98765432100' });

    await useCase.execute(second.id, { taxId: first.taxId });

    const rows = await prisma.customer.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { taxId: true },
    });

    expect(rows.map((row) => row.taxId)).toEqual([
      '12345678901',
      '12345678901',
    ]);
  });

  it('rejects updates to a soft-deleted customer', async () => {
    const customer = await seed();
    const originalName = customer.name;
    customer.softDelete();
    await repository.save(customer);

    await expect(
      useCase.execute(customer.id, { name: 'Maria Souza' }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);

    await expect(row(customer.id)).resolves.toMatchObject({
      name: originalName,
    });
  });
});
