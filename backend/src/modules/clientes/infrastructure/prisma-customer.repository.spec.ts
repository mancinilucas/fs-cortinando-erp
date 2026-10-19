import 'dotenv/config';
import { Customer } from '../domain/customer.js';
import { CustomerAddress } from '../domain/value-objects/customer-address.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { PrismaCustomerRepository } from './prisma-customer.repository.js';

describe('PrismaCustomerRepository', () => {
  let prisma: PrismaService;
  let repository: PrismaCustomerRepository;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaCustomerRepository(prisma);
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

  function buildCustomer(): Customer {
    const customer = Customer.create({
      name: '  Maria Silva  ',
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

    createdIds.push(customer.id);

    return customer;
  }

  it('persists a new customer with flattened address columns', async () => {
    const customer = buildCustomer();

    await repository.save(customer);

    const row = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      id: customer.id,
      name: 'Maria Silva',
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
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it('updates an existing customer and clears removed fields', async () => {
    const customer = buildCustomer();
    await repository.save(customer);

    customer.update({
      name: 'Maria Souza',
      email: null,
      address: null,
      notes: null,
    });
    await repository.save(customer);

    const row = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    expect(row).toMatchObject({
      name: 'Maria Souza',
      phone: '(11) 99999-9999',
      email: null,
      taxId: '12345678901',
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

  it('returns an active customer with its address', async () => {
    const customer = buildCustomer();
    await repository.save(customer);

    const found = await repository.findActiveById(customer.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(customer.id);
    expect(found!.name).toBe('Maria Silva');
    expect(found!.email).toBe('maria@example.com');
    expect(found!.address).toBeInstanceOf(CustomerAddress);
    expect(found!.address).toMatchObject({
      postalCode: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 10',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('returns null for an active lookup when the customer does not exist', async () => {
    await expect(
      repository.findActiveById('00000000-0000-4000-8000-000000000000'),
    ).resolves.toBeNull();
  });

  it('persists a customer without an address', async () => {
    const customer = Customer.create({
      name: 'João Souza',
      phone: '11988887777',
    });
    createdIds.push(customer.id);
    await repository.save(customer);

    const found = await repository.findActiveById(customer.id);

    expect(found).not.toBeNull();
    expect(found!.address).toBeNull();
  });

  it('hides a soft-deleted customer from active lookups', async () => {
    const customer = buildCustomer();
    await repository.save(customer);

    customer.softDelete();
    await repository.save(customer);

    await expect(repository.findActiveById(customer.id)).resolves.toBeNull();
  });

  it('finds a soft-deleted customer when deleted rows are included', async () => {
    const customer = buildCustomer();
    await repository.save(customer);

    customer.softDelete();
    await repository.save(customer);

    const found = await repository.findByIdIncludingDeleted(customer.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(customer.id);
    expect(found!.deletedAt).toBeInstanceOf(Date);
  });
});
