import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { Customer } from '../domain/customer.js';
import { CustomerRepository } from '../domain/repositories/customer.repository.js';
import { PrismaCustomerRepository } from '../infrastructure/prisma-customer.repository.js';
import { CustomerNotFoundError } from './customer-not-found.error.js';
import { DeleteCustomerUseCase } from './delete-customer.use-case.js';

describe('DeleteCustomerUseCase', () => {
  let prisma: PrismaService;
  let repository: CustomerRepository;
  let useCase: DeleteCustomerUseCase;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    repository = new PrismaCustomerRepository(prisma);
    useCase = new DeleteCustomerUseCase(repository);
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
    });

    await repository.save(customer);
    createdIds.push(customer.id);

    return customer;
  }

  async function row(id: string) {
    return prisma.customer.findUnique({ where: { id } });
  }

  it('soft deletes an active customer without removing the row', async () => {
    const customer = await seedCustomer();

    await useCase.execute(customer.id);

    const deleted = await row(customer.id);

    expect(deleted).not.toBeNull();
    expect(deleted!.deletedAt).toBeInstanceOf(Date);
    expect(deleted!.name).toBe(customer.name);
  });

  it('is idempotent and does not rewrite an already deleted customer', async () => {
    const customer = await seedCustomer();
    await useCase.execute(customer.id);

    const first = await row(customer.id);

    await expect(useCase.execute(customer.id)).resolves.toBeUndefined();

    const second = await row(customer.id);

    expect(second!.deletedAt).toEqual(first!.deletedAt);
    expect(second!.updatedAt).toEqual(first!.updatedAt);
  });

  it('throws when the customer never existed', async () => {
    await expect(useCase.execute(randomUUID())).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });
});
