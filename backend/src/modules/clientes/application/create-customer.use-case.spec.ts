import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { Customer } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { PrismaCustomerRepository } from '../infrastructure/prisma-customer.repository.js';
import { CreateCustomerUseCase } from './create-customer.use-case.js';

describe('CreateCustomerUseCase', () => {
  let prisma: PrismaService;
  let useCase: CreateCustomerUseCase;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const repository: CustomerRepository = new PrismaCustomerRepository(prisma);
    useCase = new CreateCustomerUseCase(repository);
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

  async function execute(
    input: Parameters<CreateCustomerUseCase['execute']>[0],
  ): Promise<Customer> {
    const customer = await useCase.execute(input);
    createdIds.push(customer.id);

    return customer;
  }

  it('creates a complete customer and persists normalized values', async () => {
    const token = randomUUID();

    const customer = await execute({
      name: `  Maria ${token}  `,
      phone: '  (11) 99999-9999  ',
      email: '  Maria@Example.COM  ',
      taxId: ' 123.456.789-01 ',
      address: {
        postalCode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Apto 10',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'sp',
      },
      notes: '  Cliente preferencial  ',
    });

    expect(customer.name).toBe(`Maria ${token}`);
    expect(customer.phone).toBe('(11) 99999-9999');
    expect(customer.email).toBe('maria@example.com');
    expect(customer.taxId).toBe('12345678901');

    const row = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    expect(row).toMatchObject({
      name: `Maria ${token}`,
      phone: '(11) 99999-9999',
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

  it('creates a minimal customer with optional fields as null', async () => {
    const token = randomUUID();

    const customer = await execute({
      name: `João ${token}`,
      phone: '11988887777',
    });

    const row = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    expect(row).toMatchObject({
      name: `João ${token}`,
      phone: '11988887777',
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
      deletedAt: null,
    });
  });

  it('allows duplicated tax ids', async () => {
    const token = randomUUID();

    const first = await execute({
      name: `First ${token}`,
      phone: '11999990001',
      taxId: '12345678901',
    });
    const second = await execute({
      name: `Second ${token}`,
      phone: '11999990002',
      taxId: '12345678901',
    });

    const rows = await prisma.customer.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { taxId: true },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.taxId)).toEqual([
      '12345678901',
      '12345678901',
    ]);
  });

  it('rejects invalid input through the domain invariants', async () => {
    const token = randomUUID();
    const name = `Invalid ${token}`;

    await expect(
      useCase.execute({ name: '   ', phone: '11999999999' }),
    ).rejects.toThrow(/Customer name is required/);
    await expect(useCase.execute({ name, phone: '   ' })).rejects.toThrow(
      /Customer phone is required/,
    );
    await expect(
      useCase.execute({ name, phone: '11999999999', taxId: '123' }),
    ).rejects.toThrow(/Customer tax ID must have 11 or 14 digits/);
    await expect(
      useCase.execute({
        name,
        phone: '11999999999',
        address: { street: 'Avenida Paulista' },
      }),
    ).rejects.toThrow(/requires street, number, neighborhood and city/);

    await expect(
      prisma.customer.findMany({ where: { name } }),
    ).resolves.toEqual([]);
  });
});
