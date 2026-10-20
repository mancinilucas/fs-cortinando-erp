import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { Customer } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { PrismaCustomerRepository } from '../infrastructure/prisma-customer.repository.js';
import { CustomerNotFoundError } from './customer-not-found.error.js';
import { GetCustomerUseCase } from './get-customer.use-case.js';

describe('GetCustomerUseCase', () => {
  let prisma: PrismaService;
  let repository: CustomerRepository;
  let useCase: GetCustomerUseCase;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    repository = new PrismaCustomerRepository(prisma);
    useCase = new GetCustomerUseCase(repository);
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

  async function seedCustomer(): Promise<Customer> {
    const customer = Customer.create({
      name: `Maria ${randomUUID()}`,
      phone: '(11) 99999-9999',
      email: 'maria@example.com',
      address: {
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
      },
    });

    await repository.save(customer);
    createdIds.push(customer.id);

    return customer;
  }

  it('returns an active customer by id', async () => {
    const created = await seedCustomer();

    const customer = await useCase.execute(created.id);

    expect(customer.id).toBe(created.id);
    expect(customer.name).toBe(created.name);
    expect(customer.email).toBe('maria@example.com');
    expect(customer.address).toMatchObject({
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
    });
  });

  it('throws when the customer never existed', async () => {
    await expect(useCase.execute(randomUUID())).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });

  it('treats a soft-deleted customer exactly like a missing one', async () => {
    const created = await seedCustomer();
    created.softDelete();
    await repository.save(created);

    await expect(useCase.execute(created.id)).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
    await expect(useCase.execute(created.id)).rejects.toThrow(
      'Customer not found',
    );
    await expect(useCase.execute(randomUUID())).rejects.toThrow(
      'Customer not found',
    );
  });
});
